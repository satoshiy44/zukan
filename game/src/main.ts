import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const GY = 300; // 地面のY座標
const ROOT_X = 700; // つる(根)のX座標
const BASKET_X = 1080;
const BASKET_Y = 190;
const INTRO_SEC = 4; // 説明+カウントダウン
const RESULT_SEC = 11; // 結果表示に使う時間(制限時間の約10秒前には終える)
const LAST_SEC = 15; // 残りこの秒数で「ラスト大株」
const PULL_SPEED = 260; // px/秒
const STRAIN_UP = 52; // 引っぱり中のメーター上昇/秒(×かたさ)
const STRAIN_DOWN = 105; // はなしている間のメーター回復/秒
const ROCK_SPIKE = 42; // 石が引っかかったときのメーター上昇
const STUN_SEC = 1.2; // ブチッの後に動けない時間
const MAX_CHAIN = 8; // れんぞくぬきの倍率の上限
const IMO_SCORE: { [key: string]: number } = { imo: 100, imo_big: 250, imo_gold: 600 };
const FULL_BONUS = 300;
const IPPON_BONUS = 1000;
const LAST_FULL_BONUS = 2000;
const HAND_X = 250; // 手もとのいもを積む場所
const HAND_Y = 268;

type ItemKind = "imo" | "imo_big" | "imo_gold" | "rock";
interface ItemDef {
	kind: ItemKind;
	depth: number; // 地面からの深さ(px)
	side: number; // 根から左右どちらにつくか(-1/1)
}
interface PlantDef {
	length: number;
	stiffness: number;
	items: ItemDef[];
	isLast: boolean;
	isGold: boolean;
}

// 共通乱数からつるを作る(全員同じ順番・同じ形のつるになる)
function createPlant(random: g.RandomGenerator, index: number, isLast: boolean): PlantDef {
	const r = (): number => random.generate();
	const items: ItemDef[] = [];
	if (isLast) {
		const length = 1700;
		const imoCount = 14;
		const depthOf = (i: number): number => 110 + (i / (imoCount - 1)) * (length - 150);
		for (let i = 0; i < imoCount; i++) {
			let kind: ItemKind = r() < 0.3 ? "imo_big" : "imo";
			if (i === 6 || i === 10 || i === imoCount - 1) kind = "imo_gold";
			items.push({ kind, depth: depthOf(i), side: i % 2 === 0 ? -1 : 1 });
		}
		// 石は金のいもの手前などに(いもといもの間)
		[2, 5, 9, 12, 13].forEach((i) => items.push({ kind: "rock", depth: (depthOf(i - 1) + depthOf(i)) / 2, side: 0 }));
		return { length, stiffness: 1.0, items, isLast, isGold: false };
	}
	const level = Math.min(index, 10);
	const length = Math.round(330 + r() * 180 + level * 22);
	const imoCount = 3 + Math.floor(r() * 3) + (level >= 4 ? 1 : 0);
	const firstSide = r() < 0.5 ? -1 : 1;
	const step = (length - 110) / imoCount;
	const depths: number[] = [];
	for (let i = 0; i < imoCount; i++) {
		depths.push(80 + step * i + r() * step * 0.3);
		items.push({ kind: r() < 0.18 ? "imo_big" : "imo", depth: depths[i], side: i % 2 === 0 ? firstSide : -firstSide });
	}
	// いちばん深いところは大きい(たまに金の)いも
	const lastSide = imoCount % 2 === 0 ? firstSide : -firstSide;
	items.push({ kind: r() < 0.14 + level * 0.012 ? "imo_gold" : "imo_big", depth: length - 20, side: lastSide });
	depths.push(length - 20);
	// 石はいもといもの間に置く
	// 石なしのつるは「一本釣り」のチャンス
	const rockCount = index === 0 || r() < 0.35 ? 0 : 1 + (level >= 5 && r() < 0.5 ? 1 : 0);
	const slots: number[] = [];
	for (let i = 1; i < depths.length; i++) slots.push(i);
	for (let i = 0; i < rockCount && slots.length > 0; i++) {
		const k = slots.splice(Math.floor(r() * slots.length), 1)[0];
		items.push({ kind: "rock", depth: (depths[k - 1] + depths[k]) / 2, side: 0 });
	}
	let stiffness = 0.85 + r() * 0.35 + level * 0.025;
	// たまに「金のつる」: いもが全部 金。そのかわり かたい
	const isGold = index >= 2 && r() < 0.12;
	if (isGold) {
		items.forEach((it) => {
			if (it.kind !== "rock") it.kind = "imo_gold";
		});
		stiffness += 0.3;
	}
	return { length, stiffness, items, isLast, isGold };
}

interface LiveItem {
	def: ItemDef;
	sprite: g.Sprite;
	done: boolean;
}

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "imo", "imo_big", "imo_gold", "rock", "vine", "basket", "tanuki_idle", "tanuki_pull", "tanuki_fall",
			"leaf_red", "leaf_yellow", "snap", "logo",
			"pop1", "pop2", "pop3", "pop4", "pop5", "pop6", "pop7", "pop8",
			"gold", "snap_se", "creak", "rock_se", "harvest", "bank", "lose", "heart", "beep", "go", "finish", "last", "result", "bgm"
		]
	});
	let time = 75; // 制限時間
	if (param.sessionParameter.totalTimeLimit) {
		time = param.sessionParameter.totalTimeLimit;
	}
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const fps = g.game.fps;
		const dt = 1 / fps;
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const se = (id: string): void => {
			scene.asset.getAudioById(id).play();
		};
		const cosmeticRandom = g.game.random; // 見た目用(プレイヤーごとに違ってよい)

		// ---- フォント ----
		const makeFont = (color: string, stroke: string, size: number): g.DynamicFont =>
			new g.DynamicFont({
				game: g.game,
				fontFamily: "sans-serif",
				fontWeight: "bold",
				size,
				fontColor: color,
				strokeColor: stroke,
				strokeWidth: size / 6
			});
		const fontWhite = makeFont("#fff8e6", "#3a1a0a", 64);
		const fontYellow = makeFont("#ffe14a", "#5b1638", 64);
		const fontRed = makeFont("#ff5a4a", "#fff8e6", 64);
		const fontPink = makeFont("#ffd0e4", "#5b1638", 64);

		type Align = "left" | "center" | "right";
		const label = (text: string, font: g.Font, size: number, x: number, y: number, parent: g.E, align: Align = "left"): g.Label => {
			const l = new g.Label({ scene, text, font, fontSize: size, x, y });
			if (align !== "left") {
				l.anchorX = align === "center" ? 0.5 : 1;
			}
			parent.append(l);
			return l;
		};
		const setText = (l: g.Label, text: string): void => {
			if (l.text !== text) {
				l.text = text;
				l.invalidate();
			}
		};

		// ---- 小さなアニメーション管理 ----
		interface Anim { t: number; dur: number; fn: (p: number) => void; end?: () => void; }
		const anims: Anim[] = [];
		const animate = (dur: number, fn: (p: number) => void, end?: () => void): void => {
			anims.push({ t: 0, dur, fn, end });
		};

		// ---- レイヤー ----
		const bgLayer = new g.E({ scene });
		const worldLayer = new g.E({ scene });
		const gaugeLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const hudLayer = new g.E({ scene });
		scene.append(bgLayer);
		scene.append(worldLayer);
		scene.append(gaugeLayer);
		scene.append(fxLayer);
		scene.append(hudLayer);

		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));

		// 落ち葉
		const leafTimer = { t: 0 };
		const spawnLeaf = (): void => {
			const red = cosmeticRandom.generate() < 0.55;
			const leaf = new g.Sprite({
				scene,
				src: img(red ? "leaf_red" : "leaf_yellow"),
				x: cosmeticRandom.generate() * 1280,
				y: -40,
				anchorX: 0.5,
				anchorY: 0.5
			});
			const vx = -20 - cosmeticRandom.generate() * 40;
			const vy = 50 + cosmeticRandom.generate() * 40;
			const spin = (cosmeticRandom.generate() - 0.5) * 8;
			const phase = cosmeticRandom.generate() * 6;
			leaf.onUpdate.add(() => {
				leaf.x += (vx + Math.sin(g.game.age / 10 + phase) * 40) * dt;
				leaf.y += vy * dt;
				leaf.angle += spin;
				leaf.modified();
				if (leaf.y > GY + 5) {
					leaf.destroy();
				}
			});
			bgLayer.append(leaf);
		};

		// ---- 世界(かご・たぬき・つる・根) ----
		const basket = new g.Sprite({ scene, src: img("basket"), x: BASKET_X, y: BASKET_Y + 40, anchorX: 0.5, anchorY: 0.5 });
		worldLayer.append(basket);
		const basketCount = label("0こ", fontWhite, 30, BASKET_X, BASKET_Y + 70, worldLayer, "center");

		const rootLine = new g.FilledRect({ scene, cssColor: "#e6c79a", x: ROOT_X - 5, y: GY, width: 10, height: 10 });
		worldLayer.append(rootLine);
		const itemLayer = new g.E({ scene });
		worldLayer.append(itemLayer);

		const vine = new g.Sprite({ scene, src: img("vine"), x: ROOT_X, y: GY + 8, anchorX: 0.5, anchorY: 1 });
		worldLayer.append(vine);

		const tanukiImages = { idle: img("tanuki_idle"), pull: img("tanuki_pull"), fall: img("tanuki_fall") };
		const tanuki = new g.Sprite({ scene, src: tanukiImages.idle, x: 590, y: GY + 20, anchorX: 0.5, anchorY: 1 });
		worldLayer.append(tanuki);
		let tanukiPose: "idle" | "pull" | "fall" = "idle";
		const setPose = (pose: "idle" | "pull" | "fall"): void => {
			if (tanukiPose === pose) return;
			tanukiPose = pose;
			tanuki.src = tanukiImages[pose];
			tanuki.invalidate();
		};

		// メーターが赤いときの画面の点滅
		const dangerFlash = new g.FilledRect({ scene, cssColor: "#ff2a1a", width: 1280, height: 720, opacity: 0 });
		gaugeLayer.append(dangerFlash);
		// 手もと(まだ確定していないいも)
		const handLabel = label("", fontYellow, 40, HAND_X, 150, worldLayer, "center");
		const nextLabel = label("", fontWhite, 26, HAND_X, 205, worldLayer, "center");

		// メーター
		const GAUGE_X = 880;
		const GAUGE_Y = 70;
		const GAUGE_H = 200;
		gaugeLayer.append(new g.FilledRect({
			scene, cssColor: "#3a1a0a", x: GAUGE_X - 6, y: GAUGE_Y - 6, width: 44, height: GAUGE_H + 12
		}));
		gaugeLayer.append(new g.FilledRect({ scene, cssColor: "#fff8e6", x: GAUGE_X, y: GAUGE_Y, width: 32, height: GAUGE_H }));
		const gaugeDanger = new g.FilledRect({ scene, cssColor: "#ffd6d0", x: GAUGE_X, y: GAUGE_Y, width: 32, height: GAUGE_H * 0.25 });
		gaugeLayer.append(gaugeDanger);
		const gaugeFill = new g.FilledRect({ scene, cssColor: "#6cc04a", x: GAUGE_X, y: GAUGE_Y + GAUGE_H, width: 32, height: 0 });
		gaugeLayer.append(gaugeFill);
		label("ピン", fontWhite, 22, GAUGE_X + 16, GAUGE_Y - 36, gaugeLayer, "center");
		const stiffLabel = label("", fontWhite, 28, ROOT_X, GY - 200, worldLayer, "center");
		const ipponLabel = label("", fontYellow, 30, ROOT_X - 40, GY - 240, worldLayer, "center");
		const warnLabel = label("", fontRed, 34, ROOT_X + 60, GY + 10, worldLayer);
		const remainLabel = label("", fontWhite, 24, ROOT_X + 20, 670, worldLayer);

		// ---- HUD ----
		const scoreLabel = label("0", fontWhite, 56, 24, 8, hudLayer);
		const comboLabel = label("", fontYellow, 30, 28, 76, hudLayer);
		const timeLabel = label("", fontWhite, 44, 1256, 10, hudLayer, "right");

		// ---- ゲーム状態 ----
		let phase: "intro" | "play" | "result" = "intro";
		let elapsed = 0;
		const playTime = Math.max(10, time - INTRO_SEC - RESULT_SEC);
		const lastSec = Math.min(LAST_SEC, playTime * 0.3); // 制限時間が短い場合は大株も短く
		let playLeft = playTime;
		let score = 0;
		let holding = false;
		let wasHolding = false;
		let heartTimer = 0;
		interface HandItem { sprite: g.Sprite; state: "flying" | "hand" | "gone"; }
		let hand: HandItem[] = [];
		let handValue = 0;
		const pointers: { [id: number]: boolean } = {};
		let strain = 0;
		let progress = 0;
		let slowTimer = 0;
		let stun = 0;
		let plantActive = false;
		let ippon = true; // 一本釣り(一度もはなさずに抜く)継続中
		let creakTimer = 0;
		let lastStarted = false;
		let plantIndex = 0;
		let plant: PlantDef;
		let liveItems: LiveItem[] = [];
		const stats = { imo: 0, gold: 0, full: 0, snap: 0, maxChain: 0, bestHold: 0, lost: 0, ippon: 0, lastFull: false };

		// つるは最初にまとめて作る(プレイ内容で乱数の消費がずれないように)
		const plants: PlantDef[] = [];
		for (let i = 0; i < 40; i++) plants.push(createPlant(param.random, i, false));
		const lastPlant = createPlant(param.random, 99, true);
		const lastExtra: PlantDef[] = [];
		for (let i = 0; i < 10; i++) lastExtra.push(createPlant(param.random, 10, false));
		let lastExtraIndex = 0;

		const lastMult = (): number => lastStarted ? 2 : 1;

		const addScore = (v: number): void => {
			score += Math.round(v);
			g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
			setText(scoreLabel, String(score));
		};

		const popup = (text: string, font: g.DynamicFont, size: number, x: number, y: number, dur = 0.8): void => {
			const l = label(text, font, size, x, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.y = y - 50 * p;
				l.scaleX = l.scaleY = p < 0.15 ? 0.5 + p / 0.15 * 0.7 : 1.2 - Math.min(0.2, (p - 0.15));
				l.opacity = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
				l.modified();
			}, () => l.destroy());
		};

		const bigText = (text: string, font: g.DynamicFont, size: number, dur: number, y = 360): void => {
			const l = label(text, font, size, 640, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.scaleX = l.scaleY = p < 0.12 ? 2 - p / 0.12 : 1;
				l.opacity = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
				l.modified();
			}, () => l.destroy());
		};

		const shake = (power: number): void => {
			animate(0.3, (p) => {
				worldLayer.x = (1 - p) * power * (cosmeticRandom.generate() - 0.5) * 2;
				worldLayer.y = (1 - p) * power * (cosmeticRandom.generate() - 0.5) * 2;
				worldLayer.modified();
			}, () => {
				worldLayer.x = worldLayer.y = 0;
				worldLayer.modified();
			});
		};

		const clearItems = (): void => {
			liveItems.forEach((it) => {
				if (!it.sprite.destroyed()) it.sprite.destroy();
			});
			liveItems = [];
			rootLine.height = 0;
			rootLine.modified();
			setText(remainLabel, "");
		};

		const spawnPlant = (def: PlantDef): void => {
			clearItems();
			plant = def;
			progress = 0;
			strain = 0;
			slowTimer = 0;
			ippon = true;
			plantActive = true;
			liveItems = def.items.map((d) => {
				const sprite = new g.Sprite({
					scene,
					src: img(d.kind),
					anchorX: 0.5,
					anchorY: 0.5,
					x: ROOT_X + d.side * (d.kind === "imo_big" ? 52 : 40),
					y: GY + d.depth
				});
				sprite.angle = d.side * -20;
				itemLayer.append(sprite);
				return { def: d, sprite, done: false };
			});
			// つるがにょきっと生える
			animate(0.25, (p) => {
				vine.scaleX = vine.scaleY = p;
				vine.modified();
			});
			const s = def.stiffness;
			setText(stiffLabel, def.isLast ? "ラスト大株!!" : def.isGold ? "金のつる!!" : s > 1.25 ? "かったい!" : s > 1.05 ? "かため" : "ふつう");
			if (def.isGold) {
				se("gold");
				popup("金のつる!! ぜんぶ金のいも!", fontYellow, 44, 640, 160, 1.4);
			}
			layoutRoot();
		};

		const nextPlant = (): void => {
			if (lastStarted) {
				spawnPlant(lastExtra[lastExtraIndex++ % lastExtra.length]);
				return;
			}
			spawnPlant(plants[plantIndex++ % plants.length]);
		};

		const layoutRoot = (): void => {
			const bottom = GY + plant.length - progress;
			rootLine.y = GY;
			rootLine.height = Math.max(0, bottom - GY);
			const danger = strain > 75;
			rootLine.cssColor = danger ? "#ff8a7a" : "#e6c79a";
			rootLine.width = danger ? 7 : 10;
			rootLine.x = ROOT_X - rootLine.width / 2 + (danger ? (cosmeticRandom.generate() - 0.5) * 6 : 0);
			rootLine.modified();
			let remain = 0;
			for (let i = 0; i < liveItems.length; i++) {
				const it = liveItems[i];
				if (it.done) continue;
				it.sprite.y = GY + it.def.depth - progress;
				const jitter = danger ? (cosmeticRandom.generate() - 0.5) * 4 : 0;
				it.sprite.x = ROOT_X + it.def.side * (it.def.kind === "imo_big" ? 52 : 40) + jitter;
				it.sprite.modified();
				if (it.def.kind !== "rock") remain++;
			}
			setText(remainLabel, plantActive ? "のこり " + remain + "こ" : "");
		};

		const bounceBasket = (): void => {
			animate(0.2, (p) => {
				basket.scaleX = 1 + Math.sin(p * Math.PI) * 0.12;
				basket.scaleY = 1 - Math.sin(p * Math.PI) * 0.08;
				basket.modified();
			});
		};

		const handPos = (i: number): { x: number; y: number } => ({
			x: HAND_X + ((i % 4) - 1.5) * 38,
			y: HAND_Y - Math.floor(i / 4) * 26
		});

		const updateHandLabel = (): void => {
			const k = hand.length;
			setText(handLabel, k > 0 ? "手もと " + handValue : "");
			handLabel.scaleX = handLabel.scaleY = 1 + Math.min(k, MAX_CHAIN) * 0.08;
			handLabel.modified();
			setText(nextLabel, k > 0 ? "つぎのいも ×" + Math.min(k + 1, MAX_CHAIN) : "");
		};

		// 指をはなしたら手もとのいもが確定
		const bankHand = (): void => {
			if (hand.length === 0) return;
			const v = handValue;
			addScore(v);
			stats.bestHold = Math.max(stats.bestHold, v);
			se("bank");
			popup("ゲット! +" + v, v >= 3000 ? fontYellow : fontPink, v >= 3000 ? 54 : 42, HAND_X, 140, 1.0);
			hand.forEach((h, i) => {
				h.state = "gone";
				const sp = h.sprite;
				const sx = sp.x, sy = sp.y;
				const ex = BASKET_X + (cosmeticRandom.generate() - 0.5) * 60, ey = BASKET_Y + 20;
				const delay = i * 0.03;
				animate(0.45 + delay, (p) => {
					const q = Math.max(0, (p * (0.45 + delay) - delay) / 0.45);
					sp.x = sx + (ex - sx) * q;
					sp.y = sy + (ey - sy) * q - Math.sin(q * Math.PI) * 120;
					sp.modified();
				}, () => {
					sp.destroy();
					setText(basketCount, stats.imo + "こ");
					bounceBasket();
				});
			});
			hand = [];
			handValue = 0;
			updateHandLabel();
		};

		// ブチッと切れたら手もとのいもはパー
		const loseHand = (): void => {
			if (hand.length === 0) return;
			stats.lost += handValue;
			se("lose");
			popup("パー… -" + handValue, fontRed, 48, HAND_X, 150, 1.4);
			hand.forEach((h) => {
				h.state = "gone";
				const sp = h.sprite;
				const vx = (cosmeticRandom.generate() - 0.5) * 300;
				let vy = -200 - cosmeticRandom.generate() * 200;
				animate(1.0, (p) => {
					vy += 900 * dt;
					sp.x += vx * dt;
					sp.y += vy * dt;
					sp.angle += 12;
					sp.opacity = 1 - p;
					sp.modified();
				}, () => sp.destroy());
			});
			hand = [];
			handValue = 0;
			updateHandLabel();
		};

		const harvestItem = (it: LiveItem): void => {
			it.done = true;
			if (it.def.kind === "rock") {
				// 石が地上で引っかかった
				strain += ROCK_SPIKE;
				slowTimer = 0.35;
				se("rock_se");
				shake(10);
				popup("ガッ!", fontRed, 48, ROOT_X - 70, GY - 30);
				const sp = it.sprite;
				const sx = sp.x, sy = sp.y;
				const dir = cosmeticRandom.generate() < 0.5 ? -1 : 1;
				animate(0.6, (p) => {
					sp.x = sx + dir * 260 * p;
					sp.y = sy - Math.sin(p * Math.PI) * 120 + p * 40;
					sp.opacity = 1 - p;
					sp.modified();
				}, () => sp.destroy());
				return;
			}
			// 1回の長押しで抜けた数だけ倍率が上がる
			const k = Math.min(hand.length + 1, MAX_CHAIN);
			const v = IMO_SCORE[it.def.kind] * k * lastMult();
			handValue += v;
			stats.imo++;
			stats.maxChain = Math.max(stats.maxChain, hand.length + 1);
			se("pop" + k);
			if (it.def.kind === "imo_gold") {
				stats.gold++;
				se("gold");
			}
			const fancy = it.def.kind !== "imo" || k >= 4;
			popup("+" + v + (k >= 2 ? " ×" + k : ""), fancy ? fontYellow : fontWhite, 30 + k * 3, ROOT_X + 100, GY - 40);
			// 手もとへ飛ばす
			const sp = it.sprite;
			const entry: HandItem = { sprite: sp, state: "flying" };
			const target = handPos(hand.length);
			hand.push(entry);
			updateHandLabel();
			const sx = sp.x, sy = sp.y;
			sp.remove();
			fxLayer.append(sp);
			animate(0.3, (p) => {
				if (entry.state !== "flying") return;
				sp.x = sx + (target.x - sx) * p;
				sp.y = sy + (target.y - sy) * p - Math.sin(p * Math.PI) * 140;
				sp.angle = 360 * p;
				sp.scaleX = sp.scaleY = 1 - p * 0.35;
				sp.modified();
			}, () => {
				if (entry.state === "flying") entry.state = "hand";
			});
		};

		const fullHarvest = (): void => {
			plantActive = false;
			const wasLast = plant.isLast;
			stats.full++;
			const m = lastMult();
			bankHand();
			addScore((wasLast ? LAST_FULL_BONUS : FULL_BONUS) * m);
			se("harvest");
			if (wasLast) {
				stats.lastFull = true;
				bigText("大株ぶっこ抜き!! +" + Math.round(LAST_FULL_BONUS * m), fontYellow, 64, 1.6, 330);
			} else {
				popup("まるごと! +" + Math.round(FULL_BONUS * m), fontPink, 40, ROOT_X + 150, GY - 110, 1.0);
			}
			if (ippon) {
				stats.ippon++;
				addScore(IPPON_BONUS * m);
				popup("一本釣り!! +" + Math.round(IPPON_BONUS * m), fontYellow, 46, 640, 200, 1.2);
			}
			strain = 0;
			const harvested = plant;
			animate(0.2, (p) => {
				vine.y = GY + 8 - p * 120;
				vine.opacity = 1 - p;
				vine.modified();
			}, () => {
				vine.y = GY + 8;
				vine.opacity = 1;
				vine.modified();
				// 途中でラスト大株に切り替わっていたら何もしない
				if (phase === "play" && plant === harvested && !plantActive) nextPlant();
			});
		};

		const snapPlant = (): void => {
			plantActive = false;
			stats.snap++;
			loseHand();
			strain = 0;
			stun = STUN_SEC;
			se("snap_se");
			shake(18);
			setPose("fall");
			const snapSprite = new g.Sprite({ scene, src: img("snap"), x: ROOT_X, y: GY - 20, anchorX: 0.5, anchorY: 0.5 });
			fxLayer.append(snapSprite);
			animate(0.9, (p) => {
				snapSprite.scaleX = snapSprite.scaleY = p < 0.1 ? 0.5 + p * 6 : 1.1;
				snapSprite.opacity = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
				snapSprite.modified();
			}, () => snapSprite.destroy());
			popup("いもが土にかえった…", fontWhite, 30, ROOT_X, GY + 70, 1.2);
			// 残りの根といもが沈んでいく
			const startProgress = progress;
			const snapped = plant;
			animate(0.6, (p) => {
				if (plant !== snapped) return;
				progress = startProgress - p * 400;
				layoutRoot();
			}, () => {
				if (plant === snapped) clearItems();
			});
			vine.opacity = 0.3;
			vine.modified();
		};

		const startLast = (): void => {
			bankHand(); // 切りかえの前に手もとは確定
			lastStarted = true;
			se("last");
			bigText("ラスト大株!!", fontYellow, 96, 1.4, 300);
			popup("ぜんぶ抜けば一発逆転! 得点2倍!", fontPink, 36, 640, 420, 1.8);
			stun = 0;
			setPose("idle");
			vine.opacity = 1;
			vine.modified();
			spawnPlant(lastPlant);
		};

		// ---- 入力(長押しで引っぱる) ----
		scene.onPointDownCapture.add((ev) => {
			pointers[ev.pointerId] = true;
			holding = true;
		});
		scene.onPointUpCapture.add((ev) => {
			delete pointers[ev.pointerId];
			holding = Object.keys(pointers).length > 0;
		});

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		fxLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(40,15,5,0.55)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 150, anchorX: 0.5, anchorY: 0.5 });
		introLayer.append(logo);
		const howto = [
			"長押しでつるを引っぱる! 続けて抜くほど いもの点が倍々に",
			"指をはなすと 手もとのいもが確定(ゲット!)",
			"メーター満タンで ブチッ! 手もとのいもはパー…",
			"ラスト15秒の「大株」は得点2倍で一発逆転!"
		];
		howto.forEach((t, i) => label(t, i === 3 ? fontYellow : fontWhite, 34, 640, 300 + i * 56, introLayer, "center"));
		const countLabel = label("", fontYellow, 120, 640, 560, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		const finishPlay = (): void => {
			bankHand();
			phase = "result";
			dangerFlash.opacity = 0;
			dangerFlash.modified();
			setText(nextLabel, "");
			plantActive = false;
			setText(warnLabel, "");
			setText(ipponLabel, "");
			setText(remainLabel, "");
			setText(stiffLabel, "");
			gaugeLayer.hide();
			holding = false;
			setPose("idle");
			se("finish");
			bigText("しゅうりょう〜!", fontYellow, 100, 1.5, 330);
			g.game.vars.gameState.score = score;
			scene.setTimeout(showResult, 1600);
		};

		const showResult = (): void => {
			se("result");
			const panel = new g.E({ scene, x: 640, y: 380, anchorX: 0.5, anchorY: 0.5, width: 760, height: 520 });
			fxLayer.append(panel);
			panel.append(new g.FilledRect({ scene, cssColor: "#3a1a0a", x: -6, y: -6, width: 772, height: 532 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#fff4dc", width: 760, height: 520 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#c2326f", width: 760, height: 80 }));
			label("しゅうかく けっか", fontWhite, 48, 380, 12, panel, "center");
			label(score + " 点", fontPink, 96, 380, 96, panel, "center");
			const title = score >= 70000 ? "いもの神さま"
				: score >= 50000 ? "伝説のいもほり師"
					: score >= 30000 ? "いもほり名人"
						: score >= 12000 ? "いもほり職人" : "いもほり見習い";
			label("称号: " + title, fontYellow, 44, 380, 206, panel, "center");
			const lines = [
				"とれたいも " + stats.imo + "こ(金のいも " + stats.gold + "こ)",
				"最大れんぞくぬき " + stats.maxChain + "こ  最高ゲット " + stats.bestHold,
				"ブチッ " + stats.snap + "回(パーにした点 " + stats.lost + ")",
				stats.lastFull ? "ラスト大株 ぶっこ抜き成功!!" : "ラスト大株… またこんど!"
			];
			lines.forEach((t, i) => label(t, i === 3 && stats.lastFull ? fontPink : fontWhite, 32, 380, 280 + i * 52, panel, "center"));
			animate(0.35, (p) => {
				panel.scaleX = panel.scaleY = 0.6 + 0.4 * (1 - Math.pow(1 - p, 3));
				panel.modified();
			});
		};

		const bgm = scene.asset.getAudioById("bgm");

		// ---- メインループ ----
		scene.onUpdate.add(() => {
			// アニメーション
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
			leafTimer.t += dt;
			if (leafTimer.t > 0.45) {
				leafTimer.t = 0;
				spawnLeaf();
			}

			time -= dt;
			elapsed += dt;

			if (phase === "intro") {
				const c = Math.ceil(INTRO_SEC - elapsed);
				if (elapsed > INTRO_SEC - 3 && c !== lastCount && c > 0) {
					lastCount = c;
					setText(countLabel, String(c));
					se("beep");
				}
				if (elapsed >= INTRO_SEC) {
					phase = "play";
					introLayer.destroy();
					se("go");
					bigText("スタート!", fontYellow, 110, 0.8);
					bgm.play().changeVolume(0.45);
					nextPlant();
				}
				setText(timeLabel, "のこり " + Math.ceil(playLeft) + "秒");
				return;
			}
			if (phase !== "play") {
				return;
			}

			playLeft -= dt;
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playLeft)) + "秒");
			if (playLeft <= 5) {
				timeLabel.opacity = Math.floor(playLeft * 4) % 2 === 0 ? 1 : 0.5;
				timeLabel.modified();
			}
			if (!lastStarted && playLeft <= lastSec) {
				startLast();
			}
			if (playLeft <= 0) {
				finishPlay();
				return;
			}

			if (stun > 0) {
				stun -= dt;
				if (stun <= 0) {
					setPose("idle");
					vine.opacity = 1;
					vine.modified();
					nextPlant();
				}
			} else if (plantActive) {
				if (holding) {
					const speed = PULL_SPEED * (slowTimer > 0 ? 0.35 : 1);
					progress = Math.min(plant.length, progress + speed * dt);
					strain += STRAIN_UP * plant.stiffness * dt;
					setPose("pull");
					creakTimer -= dt;
					if (strain > 70 && creakTimer <= 0) {
						se("creak");
						creakTimer = 0.3;
					}
				} else {
					if (progress > 0) ippon = false;
					if (wasHolding) bankHand();
					strain = Math.max(0, strain - STRAIN_DOWN * dt);
					setPose("idle");
				}
				if (slowTimer > 0) slowTimer -= dt;
				// 地面を通過したものを収穫
				for (let i = 0; i < liveItems.length; i++) {
					const it = liveItems[i];
					if (!it.done && GY + it.def.depth - progress <= GY + 12) {
						harvestItem(it);
					}
				}
				if (strain >= 100) {
					snapPlant();
				} else if (progress >= plant.length) {
					fullHarvest();
				} else {
					layoutRoot();
				}
				// 石が近いときの注意
				const rockNear = liveItems.some((it) => !it.done && it.def.kind === "rock" && it.def.depth - progress < 90);
				setText(warnLabel, rockNear ? "石だ! ゆるめて!" : "");
				setText(ipponLabel, ippon && progress > 0 ? "一本釣りチャレンジ中!" : "");
			}
			if (!plantActive) {
				setText(warnLabel, "");
				setText(ipponLabel, "");
			}
			wasHolding = holding;

			// あぶないときのドキドキ
			const danger = holding && plantActive && strain > 72;
			dangerFlash.opacity = danger ? 0.08 + 0.1 * Math.abs(Math.sin(g.game.age / 3)) : 0;
			dangerFlash.modified();
			heartTimer -= dt;
			if (danger && heartTimer <= 0) {
				se("heart");
				heartTimer = strain > 88 ? 0.28 : 0.42;
			}

			// つるの伸び・メーター
			const s = Math.min(100, strain);
			vine.scaleY = 1 + (holding && plantActive ? s / 100 * 0.35 : 0);
			vine.angle = holding && plantActive ? -8 - s / 10 : 0;
			vine.modified();
			tanuki.x = 590 - (holding && plantActive ? 10 + s / 5 : 0);
			tanuki.modified();
			gaugeFill.height = GAUGE_H * s / 100;
			gaugeFill.y = GAUGE_Y + GAUGE_H - gaugeFill.height;
			gaugeFill.cssColor = s > 75 ? "#e8412f" : s > 50 ? "#f2b632" : "#6cc04a";
			gaugeFill.modified();
			setText(comboLabel, lastStarted ? "大株タイム 得点×2" : "");
		});
	});
	g.game.pushScene(scene);
}
