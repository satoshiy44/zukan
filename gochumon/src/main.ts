import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const WIDTH = 1280;
const HEIGHT = 720;
const INTRO_SECONDS = 6;
const END_MARGIN_SECONDS = 3;
const DISH_COUNT = 6;
const MAX_ORDER_COUNT = 5;
const DISH_NAMES = ["オムライス", "スープ", "ケーキ", "紅茶", "サンド", "パスタ"];
// 待っていられる時間 = 基本 + 1品あたり
const PATIENCE_BASE = 3.5;
const PATIENCE_PER_DISH = 1.8;
const MISS_PENALTY = 0.12; // まちがえたとき、ゲージが減る割合
// 列の位置(先頭が真ん中、うしろは右へ)
const SLOT_X = [560, 790, 960, 1110];
const SLOT_Y = [540, 520, 505, 494];
const SLOT_SCALE = [1.25, 1.05, 0.95, 0.88];
const QUEUE_LEN = SLOT_X.length;
// 料理ボタン(下に1列)
const BTN_X0 = 200;
const BTN_STEP = 150;
const BTN_Y = 548;
const BTN_SCALE = 0.73;

interface Customer {
	e: g.E; // 足もとを原点にした入れもの
	body: g.Sprite;
	tray: g.E | null;
	slot: number;
	walking: boolean;
	walkT: number;
	fromX: number; fromY: number; toX: number; toY: number; fromS: number; toS: number;
	onArrive: (() => void) | null;
}

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"restaurant", "check", "dish_panel", "tray", "logo", "emblem", "intro_panel", "hud_panel",
		"customer0", "customer1", "customer2", "dish0", "dish1", "dish2", "dish3", "dish4", "dish5",
		"star", "star_off", "speech"
	];
	const audioIds = ["bgm", "tap", "serve", "cash", "miss", "count", "finish"];
	const scene = new g.Scene({ game: g.game, assetIds: imageIds.concat(audioIds) });
	let totalTime = 60;
	if (param.sessionParameter.totalTimeLimit) {
		totalTime = param.sessionParameter.totalTimeLimit;
	}
	// ランキングの点数 = もらった星の合計
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const random = (): number => param.random.generate();
		const image = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const sound = (id: string, volume: number): void => {
			scene.asset.getAudioById(id).play().changeVolume(volume);
		};
		const makeFont = (color: string, stroke: string): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: 7
		});
		const mainFont = makeFont("#fff4cf", "#352a2d");
		const goldFont = makeFont("#ffd86a", "#352a2d");
		const redFont = makeFont("#ffb39c", "#54252c");
		const label = (text: string, font: g.Font, size: number, x: number, y: number, parent: g.E, anchorX = 0): g.Label => {
			const l = new g.Label({ scene, text, font, fontSize: size, x, y, anchorX });
			parent.append(l);
			return l;
		};
		const setText = (l: g.Label, text: string): void => {
			if (l.text === text) return;
			l.text = text;
			l.invalidate();
		};
		const sprite = (id: string, x: number, y: number, parent: g.E, scale = 1, ax = 0, ay = 0): g.Sprite => {
			const s = new g.Sprite({ scene, src: image(id), x, y, scaleX: scale, scaleY: scale, anchorX: ax, anchorY: ay });
			parent.append(s);
			return s;
		};

		// ---- 小さなアニメーション ----
		interface Anim { t: number; dur: number; fn: (p: number) => void; end?: () => void; }
		const anims: Anim[] = [];
		const animate = (dur: number, fn: (p: number) => void, end?: () => void): void => {
			anims.push({ t: 0, dur, fn, end });
		};
		const easeOut = (p: number): number => 1 - (1 - p) * (1 - p);

		// ======== 画面 ========
		scene.append(new g.Sprite({ scene, src: image("restaurant") }));
		scene.append(new g.FilledRect({ scene, cssColor: "rgba(29,22,24,0.15)", width: WIDTH, height: HEIGHT }));
		const customerLayer = new g.E({ scene });
		scene.append(customerLayer);
		const orderLayer = new g.E({ scene });
		scene.append(orderLayer);
		const dishLayer = new g.E({ scene });
		scene.append(dishLayer);
		const effectLayer = new g.E({ scene });
		scene.append(effectLayer);
		const hud = new g.E({ scene });
		scene.append(hud);

		// ---- 上の表示: お店の評価(星0から) ----
		hud.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,20,0.72)", x: 16, y: 12, width: 380, height: 124 }));
		label("お店の評価", mainFont, 24, 30, 18, hud);
		const avgLabel = label("0.0", goldFont, 50, 30, 50, hud);
		const starOffs: g.Sprite[] = [];
		const starOns: g.Sprite[] = [];
		for (let k = 0; k < 5; k++) {
			starOffs.push(sprite("star_off", 118 + k * 44, 56, hud, 0.8));
			const on = sprite("star", 118 + k * 44, 56, hud, 0.8);
			on.hide();
			starOns.push(on);
		}
		const reviewLabel = label("口コミ 0件", mainFont, 22, 385, 104, hud, 1);
		const totalLabel = label("星の合計 0", goldFont, 24, 30, 104, hud);
		hud.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,20,0.72)", x: 1070, y: 12, width: 194, height: 84 }));
		label("のこり", mainFont, 22, 1167, 16, hud, 0.5);
		const timeLabel = label(String(totalTime), mainFont, 48, 1167, 40, hud, 0.5);
		let totalStars = 0;
		let reviews = 0;
		const updateRating = (): void => {
			const avg = reviews > 0 ? totalStars / reviews : 0;
			setText(avgLabel, avg.toFixed(1));
			for (let k = 0; k < 5; k++) {
				const fill = Math.max(0, Math.min(1, avg - k));
				const s = starOns[k];
				if (fill <= 0) {
					s.hide();
					continue;
				}
				s.show();
				// 星を途中まで塗る(4.3なら5つめは3割)
				s.srcWidth = 52 * fill;
				s.width = 52 * fill;
				s.invalidate();
			}
			setText(reviewLabel, "口コミ " + reviews + "件");
			setText(totalLabel, "星の合計 " + totalStars);
			g.game.vars.gameState.score = totalStars;
		};

		// ---- 吹き出し(注文)とゲージ ----
		const bubble = new g.E({ scene, x: 600, y: 245 }); // しっぽの先を原点に
		orderLayer.append(bubble);
		sprite("speech", -196, -176, bubble);
		const orderDish: g.Sprite[][] = [];
		const orderCheck: g.Sprite[] = [];
		for (let s = 0; s < MAX_ORDER_COUNT; s++) {
			const row: g.Sprite[] = [];
			for (let d = 0; d < DISH_COUNT; d++) {
				const sp = sprite("dish" + d, 0, -104, bubble, 0.72, 0.5, 0.5);
				sp.hide();
				row.push(sp);
			}
			orderDish.push(row);
			const ck = sprite("check", 0, -96, bubble, 0.42, 0.5, 0.5);
			ck.hide();
			orderCheck.push(ck);
		}
		// 待ち時間ゲージ(上から下へ減っていく)
		const GAUGE_H = 140;
		bubble.append(new g.FilledRect({ scene, cssColor: "#5a3412", x: 270, y: -172, width: 34, height: GAUGE_H + 8 }));
		bubble.append(new g.FilledRect({ scene, cssColor: "#2e2018", x: 274, y: -168, width: 26, height: GAUGE_H }));
		const gauge = new g.FilledRect({ scene, cssColor: "#6ac06a", x: 274, y: -168, width: 26, height: GAUGE_H });
		bubble.append(gauge);
		bubble.hide();

		// ---- 料理ボタン ----
		const buttons: g.Sprite[] = [];
		for (let d = 0; d < DISH_COUNT; d++) {
			const bx = BTN_X0 + d * BTN_STEP;
			const panel = new g.Sprite({
				scene, src: image("dish_panel"), x: bx, y: BTN_Y, scaleX: BTN_SCALE, scaleY: BTN_SCALE, touchable: true
			});
			dishLayer.append(panel);
			buttons.push(panel);
			sprite("dish" + d, bx + 8, BTN_Y + 4, dishLayer, 0.72);
			label(DISH_NAMES[d], mainFont, 20, bx + 66, BTN_Y + 91, dishLayer, 0.5);
		}
		const btnCenter = (d: number): number[] => [BTN_X0 + d * BTN_STEP + 66, BTN_Y + 48];

		// ---- ふわっと出る文字 ----
		const popText = (text: string, font: g.Font, size: number, x: number, y: number, dur = 1.0): void => {
			const l = label(text, font, size, x, y, effectLayer, 0.5);
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.y = y - easeOut(p) * 50;
				l.scaleX = l.scaleY = p < 0.15 ? 0.6 + p / 0.15 * 0.5 : 1.1 - Math.min(0.1, p - 0.15);
				l.opacity = p < 0.65 ? 1 : 1 - (p - 0.65) / 0.35;
				l.modified();
			}, () => l.destroy());
		};
		// もらった星がぽんぽん出る
		const popStars = (n: number, x: number, y: number): void => {
			const box = new g.E({ scene, x, y });
			effectLayer.append(box);
			box.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,20,0.75)", x: -150, y: -34, width: 300, height: 68 }));
			for (let k = 0; k < 5; k++) {
				const st = sprite(k < n ? "star" : "star_off", -112 + k * 56, 0, box, 0.0001, 0.5, 0.5);
				const delay = k * 0.08;
				animate(0.35 + delay, (p) => {
					const q = Math.max(0, (p * (0.35 + delay) - delay) / 0.35);
					st.scaleX = st.scaleY = q < 0.7 ? q / 0.7 * 1.25 : 1.25 - (q - 0.7) / 0.3 * 0.25;
					st.modified();
				});
			}
			animate(1.6, (p) => {
				box.y = y - easeOut(p) * 40;
				box.opacity = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
				box.modified();
			}, () => box.destroy());
		};

		// ======== お客さんの列 ========
		const queue: Customer[] = [];
		const leaving: Customer[] = [];
		const makeCustomer = (slot: number, x: number): Customer => {
			const e = new g.E({ scene, x, y: SLOT_Y[slot], scaleX: SLOT_SCALE[slot], scaleY: SLOT_SCALE[slot] });
			customerLayer.append(e);
			const body = sprite("customer" + Math.floor(random() * 3), 0, 0, e, 1, 0.5, 1);
			return {
				e, body, tray: null, slot, walking: false, walkT: 0,
				fromX: x, fromY: e.y, toX: x, toY: e.y, fromS: e.scaleX, toS: e.scaleX, onArrive: null
			};
		};
		const walkTo = (c: Customer, x: number, y: number, s: number, onArrive: (() => void) | null): void => {
			c.walking = true;
			c.walkT = 0;
			c.fromX = c.e.x; c.fromY = c.e.y; c.fromS = c.e.scaleX;
			c.toX = x; c.toY = y; c.toS = s;
			c.onArrive = onArrive;
		};
		// 奥(右)ほど後ろに描く
		const sortLayer = (): void => {
			const kids = customerLayer.children ? customerLayer.children.slice() : [];
			kids.sort((a, b) => b.x - a.x);
			kids.forEach((k) => {
				customerLayer.remove(k);
				customerLayer.append(k);
			});
		};

		// ======== 注文 ========
		let phase = "intro";
		let timeLeft = totalTime;
		let introElapsed = 0;
		let playElapsed = 0;
		let lastCount = -1;
		let ordering = false; // 先頭のお客さんが注文中
		let patience = 0;
		let patienceMax = 1;
		const orderIds: number[] = [];
		const served: boolean[] = [];
		let servedCount = 0;

		const placeOrderDishes = (): void => {
			const n = orderIds.length;
			for (let s = 0; s < MAX_ORDER_COUNT; s++) {
				for (let d = 0; d < DISH_COUNT; d++) orderDish[s][d].hide();
				orderCheck[s].hide();
			}
			for (let s = 0; s < n; s++) {
				const x = (s - (n - 1) / 2) * 86 + 30;
				const sp = orderDish[s][orderIds[s]];
				sp.x = x;
				sp.opacity = 1;
				sp.show();
				sp.modified();
				orderCheck[s].x = x;
				orderCheck[s].modified();
			}
		};
		const startOrder = (): void => {
			const front = queue[0];
			if (!front || phase !== "play") return;
			// だんだん注文が多くなる
			const maxN = Math.min(MAX_ORDER_COUNT, 2 + Math.floor(playElapsed / 10));
			const n = 1 + Math.floor(random() * maxN);
			orderIds.length = 0;
			served.length = 0;
			servedCount = 0;
			for (let s = 0; s < n; s++) {
				orderIds.push(Math.floor(random() * DISH_COUNT));
				served.push(false);
			}
			patienceMax = PATIENCE_BASE + PATIENCE_PER_DISH * n;
			patience = patienceMax;
			placeOrderDishes();
			// 先頭のお客さんがトレーを持つ
			const tray = new g.E({ scene, x: 0, y: -112 });
			front.e.append(tray);
			sprite("tray", 0, 0, tray, 0.3, 0.5, 0.5);
			front.tray = tray;
			ordering = true;
			bubble.show();
			bubble.scaleX = bubble.scaleY = 0.2;
			bubble.modified();
			animate(0.25, (p) => {
				bubble.scaleX = bubble.scaleY = 0.2 + easeOut(p) * 0.8;
				bubble.modified();
			});
			sound("tap", 0.3);
		};
		// 列を1つずつ前へ。いちばん後ろに新しいお客さん
		const advanceQueue = (): void => {
			queue.shift();
			for (let k = 0; k < queue.length; k++) {
				const c = queue[k];
				c.slot = k;
				walkTo(c, SLOT_X[k], SLOT_Y[k], SLOT_SCALE[k], k === 0 ? startOrder : null);
			}
			const nc = makeCustomer(QUEUE_LEN - 1, WIDTH + 160);
			queue.push(nc);
			walkTo(nc, SLOT_X[QUEUE_LEN - 1], SLOT_Y[QUEUE_LEN - 1], SLOT_SCALE[QUEUE_LEN - 1], null);
			sortLayer();
		};
		// 先頭のお客さんが左へ帰っていく
		const leaveFront = (happy: boolean): void => {
			const c = queue[0];
			ordering = false;
			bubble.hide();
			c.body.scaleX = -1; // 左を向く
			c.body.modified();
			if (!happy && c.tray) {
				c.tray.destroy();
				c.tray = null;
			}
			leaving.push(c);
			walkTo(c, -220, SLOT_Y[0] + 10, SLOT_SCALE[0], null);
			advanceQueue();
		};
		const review = (stars: number): void => {
			totalStars += stars;
			reviews++;
			updateRating();
		};
		const completeOrder = (): void => {
			const r = patience / patienceMax;
			const stars = r > 0.7 ? 5 : r > 0.5 ? 4 : r > 0.3 ? 3 : r > 0.15 ? 2 : 1;
			review(stars);
			sound("cash", 0.6);
			popStars(stars, SLOT_X[0], 330);
			const words = stars === 5 ? "さいこう！" : stars >= 4 ? "ありがとう！" : stars >= 3 ? "どうも" : "おそいよ〜";
			popText(words, stars >= 3 ? goldFont : redFont, 40, SLOT_X[0], 400);
			leaveFront(true);
		};
		const giveUp = (): void => {
			review(1);
			sound("miss", 0.5);
			popStars(1, SLOT_X[0], 330);
			popText("もう帰ります…", redFont, 42, SLOT_X[0], 400);
			leaveFront(false);
		};

		// 料理が飛んでいって、トレーにのる
		const flyDish = (d: number, slotIdx: number, n: number): void => {
			const front = queue[0];
			const from = btnCenter(d);
			const lx = (slotIdx - (n - 1) / 2) * 34;
			const s = front.e.scaleX;
			const tx = front.e.x + lx * s, ty = front.e.y + (-112 - 12) * s;
			const sp = sprite("dish" + d, from[0], from[1], effectLayer, 0.5, 0.5, 0.5);
			animate(0.22, (p) => {
				sp.x = from[0] + (tx - from[0]) * p;
				sp.y = from[1] + (ty - from[1]) * p - Math.sin(p * Math.PI) * 90;
				sp.scaleX = sp.scaleY = 0.5 - p * 0.14;
				sp.modified();
			}, () => {
				sp.destroy();
				if (front.tray) sprite("dish" + d, lx, -12, front.tray, 0.3, 0.5, 0.5);
			});
		};
		const serveDish = (d: number): void => {
			if (phase !== "play" || !ordering) return;
			let target = -1;
			for (let s = 0; s < orderIds.length; s++) {
				if (!served[s] && orderIds[s] === d) {
					target = s;
					break;
				}
			}
			const btn = buttons[d];
			animate(0.15, (p) => {
				btn.scaleX = btn.scaleY = BTN_SCALE * (1 - Math.sin(p * Math.PI) * 0.08);
				btn.modified();
			});
			if (target < 0) {
				// まちがい: お客さんがいらいら(待ち時間が減る)
				patience = Math.max(0.01, patience - patienceMax * MISS_PENALTY);
				sound("miss", 0.45);
				popText("ちがうよ！", redFont, 40, 860, 300, 0.8);
				const bx = bubble.x;
				animate(0.3, (p) => {
					bubble.x = bx + Math.sin(p * Math.PI * 6) * 10 * (1 - p);
					bubble.modified();
				}, () => {
					bubble.x = bx;
					bubble.modified();
				});
				return;
			}
			served[target] = true;
			orderDish[target][d].opacity = 0.35;
			orderDish[target][d].modified();
			orderCheck[target].show();
			flyDish(d, servedCount, orderIds.length);
			servedCount++;
			sound("serve", 0.5);
			if (servedCount === orderIds.length) {
				ordering = false;
				animate(0.25, () => undefined, completeOrder);
			}
		};
		for (let d = 0; d < DISH_COUNT; d++) {
			const idx = d;
			buttons[d].onPointDown.add(() => serveDish(idx));
		}

		// ======== はじまりの列 ========
		for (let k = 0; k < QUEUE_LEN; k++) queue.push(makeCustomer(k, SLOT_X[k]));
		sortLayer();

		// ======== イントロ ========
		const intro = new g.E({ scene });
		scene.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(20,12,10,0.35)", width: WIDTH, height: HEIGHT }));
		sprite("intro_panel", 140, 110, intro);
		sprite("logo", 190, 116, intro, 0.9);
		label("① 吹き出しの注文を見て、同じ料理をタップ", mainFont, 32, 200, 356, intro);
		label("② 全部そろえたら、お客さんは笑顔でお帰り", mainFont, 32, 200, 402, intro);
		label("③ 早く出すほど高評価！星5をめざそう", mainFont, 32, 200, 448, intro);
		label("待たせすぎると星1…　まちがえるとお客さんがイライラ！", redFont, 26, WIDTH / 2, 510, intro, 0.5);
		const countLabel = label("", goldFont, 96, 1040, 380, intro, 0.5);

		const bgm = scene.asset.getAudioById("bgm").play();
		bgm.changeVolume(0.24);

		const finishGame = (): void => {
			phase = "finish";
			ordering = false;
			bubble.hide();
			bgm.stop();
			sound("finish", 0.6);
			const box = new g.E({ scene });
			scene.append(box);
			sprite("intro_panel", 250, 190, box);
			box.children![0].scaleX = 0.78;
			box.children![0].scaleY = 0.56;
			box.children![0].modified();
			label("本日の営業おしまい！", goldFont, 64, WIDTH / 2, 230, box, 0.5);
			const avg = reviews > 0 ? totalStars / reviews : 0;
			label("お店の評価 ★" + avg.toFixed(1) + "　星の合計 " + totalStars, mainFont, 38, WIDTH / 2, 330, box, 0.5);
		};

		// ======== メインループ ========
		scene.onUpdate.add(() => {
			for (let i = anims.length - 1; i >= 0; i--) {
				const a = anims[i];
				a.t += dt;
				const p = Math.min(1, a.t / a.dur);
				a.fn(p);
				if (p >= 1) {
					anims.splice(i, 1);
					if (a.end) a.end();
				}
			}
			// 歩く(ひょこひょこ)
			const walkers = queue.concat(leaving);
			for (let k = 0; k < walkers.length; k++) {
				const c = walkers[k];
				if (!c.walking) {
					// 待っている間は小さく呼吸
					c.body.y = Math.sin(g.game.age / 9 + k) * 1.5;
					c.body.angle = 0;
					c.body.modified();
					continue;
				}
				const dur = Math.max(0.5, Math.abs(c.toX - c.fromX) / 420);
				c.walkT += dt;
				const p = Math.min(1, c.walkT / dur);
				c.e.x = c.fromX + (c.toX - c.fromX) * p;
				c.e.y = c.fromY + (c.toY - c.fromY) * p;
				c.e.scaleX = c.e.scaleY = c.fromS + (c.toS - c.fromS) * p;
				c.e.modified();
				c.body.y = -Math.abs(Math.sin(c.walkT * 11)) * 10;
				c.body.angle = Math.sin(c.walkT * 11) * 3;
				c.body.modified();
				if (p >= 1) {
					c.walking = false;
					if (c.onArrive) {
						const f = c.onArrive;
						c.onArrive = null;
						f();
					}
				}
			}
			for (let k = leaving.length - 1; k >= 0; k--) {
				if (!leaving[k].walking) {
					leaving[k].e.destroy();
					leaving.splice(k, 1);
				}
			}

			timeLeft = Math.max(0, timeLeft - dt);
			setText(timeLabel, String(Math.ceil(timeLeft)));
			if (phase === "intro") {
				introElapsed += dt;
				if (introElapsed >= 3) {
					const count = Math.max(1, Math.ceil(INTRO_SECONDS - introElapsed));
					setText(countLabel, String(count));
					if (count !== lastCount) {
						lastCount = count;
						sound("count", 0.45);
					}
				}
				if (introElapsed >= INTRO_SECONDS) {
					phase = "play";
					intro.destroy();
					startOrder();
				}
				return;
			}
			if (phase !== "play") return;
			playElapsed += dt;
			// 待ち時間ゲージ
			if (ordering) {
				patience = Math.max(0, patience - dt);
				const r = patience / patienceMax;
				const h = GAUGE_H * r;
				gauge.y = -168 + (GAUGE_H - h);
				gauge.height = h;
				gauge.cssColor = r > 0.5 ? "#6ac06a" : r > 0.25 ? "#e8c040" : "#e05a4a";
				gauge.modified();
				// あせってくるとお客さんがふるえる
				const front = queue[0];
				if (r < 0.25 && front) {
					front.body.x = Math.sin(g.game.age * 2.2) * 3;
					front.body.modified();
				} else if (front && front.body.x !== 0) {
					front.body.x = 0;
					front.body.modified();
				}
				if (patience <= 0) giveUp();
			}
			if (timeLeft <= END_MARGIN_SECONDS) finishGame();
		});
	});
	g.game.pushScene(scene);
}
