import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
// 景品置き場は3Dの箱。x: 左右、y: 高さ(床が0)、z: 奥行き(手前が0)
const XL = -400;
const XR = 400;
const ZB = 500;
const CHX = -230; // とりだし口は x < CHX かつ z < CHZ の角
const CHZ = 170;
const BH = 80; // とりだし口の仕切りの高さ
const HOME_X = -315; // クレーンの定位置(とりだし口の真上)
const HOME_Z = 85;
const CLAW_UP = 300; // 上がったときのアームの先の高さ
const PILE_LIMIT = 190; // 景品の山の高さの上限(これより上には積まない)
const MOVE_X_SPEED = 460; // 押している間クレーンが進む速さ
const MOVE_Z_SPEED = 380;
const ACCEL = 1800; // クレーンの加速
const BRAKE = 2400; // クレーンのブレーキ
const DOWN_SPEED = 950;
const UP_SPEED = 850;
const BACK_SPEED = 1150;
const GRAVITY = 1800;
const SWAY_W2 = 30; // アームのゆれ(振り子)の強さ
const SWAY_DAMP = 3.2;
const SWAY_GAIN = 0.0065;
const SWAY_LEN = 200; // ゆれの角度を出すための、ひもの長さ
const MAX_GRAB = 4; // 1回でつかめる最大の数
const START_CAPSULES = 56;
const REFILL_BELOW = 40; // カプセルがこれより少なくなったら補充
const INTRO_SEC = 4;
const RESULT_SEC = 10;
const FEVER_SEC = 10;

// 3Dの点 → 画面の点(遠近法)。tools/gen-images.js の背景も同じ計算で描いている
const FOCAL = 520;
const Z0 = 420;
const CAM_H = 430;
const HORIZON = 117;
const RAIL_Y = 14;
const depthScale = (z: number): number => FOCAL / (z + Z0);
const screenX = (x: number, z: number): number => 640 + x * depthScale(z);
const screenY = (y: number, z: number): number => HORIZON + (CAM_H - y) * depthScale(z);

// カプセルの種類
interface CapType {
	id: string;
	gold: boolean;
	h: number;
	r: number; // 上から見たときの半径
	need: number; // しっかりつかむのに必要な「つかみの良さ」(0〜1)
	color: string; // 上から見た図の色
}
const BLACK: CapType = { id: "p_black", gold: false, h: 72, r: 34, need: 0.12, color: "#1a1a22" };
const GOLD: CapType = { id: "p_gold", gold: true, h: 72, r: 34, need: 0.3, color: "#ffb400" };

// 三角くじの等級
interface Rank { name: string; pt: number; }
const RANKS: Rank[] = [
	{ name: "特賞", pt: 2000 },
	{ name: "1等", pt: 1000 },
	{ name: "2等", pt: 500 },
	{ name: "3等", pt: 300 },
	{ name: "4等", pt: 200 },
	{ name: "5等", pt: 100 }
];
// 黒カプセルはほとんど4〜5等、金カプセルは3等以上
function drawRank(gold: boolean, r: number): number {
	if (gold) return r < 0.05 ? 0 : r < 0.25 ? 1 : r < 0.6 ? 2 : 3;
	return r < 0.05 ? 2 : r < 0.2 ? 3 : r < 0.5 ? 4 : 5;
}

// 共通乱数で、カプセルの色・置く場所・中のくじを決める(全員同じ)
interface Drop { gold: boolean; x: number; z: number; rank: number; }
function createDrops(random: g.RandomGenerator, n: number): Drop[] {
	const out: Drop[] = [];
	for (let i = 0; i < n; i++) {
		const gold = random.generate() < 0.2;
		out.push({ gold, x: random.generate(), z: random.generate(), rank: drawRank(gold, random.generate()) });
	}
	return out;
}

const inChute = (x: number, z: number): boolean => x < CHX && z < CHZ;

interface Prize {
	t: CapType;
	rank: number;
	x: number;
	y: number; // 下のはしの高さ
	z: number;
	vx: number;
	vy: number; // 下向きが正
	vz: number;
	ang: number; // 見た目の回転(度)
	spin: number;
	squash: number;
	state: "pile" | "held" | "chute" | "gone";
	sprite: g.Sprite;
	dot: g.FilledRect; // 上から見た図の点
	off: number; // つかまれているときの、アームとの位置のずれ
	offX: number;
	offZ: number;
	slipAt: number; // つかまれてから落ちるまでの進み具合(1以上なら落ちない)
	weak: boolean; // 上で「ガクッ」と止まったときに落ちる
}

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "front_panel", "marker", "claw_head", "claw_arm", "p_black", "p_gold",
			"cap_black_top", "cap_black_bottom", "cap_gold_top", "cap_gold_bottom", "kuji", "kuji_open", "sparkle", "logo",
			"move", "down", "grab", "slip", "miss", "get", "jackpot", "refill", "beep", "go", "finish", "fever", "result", "bgm",
			"coin", "thud", "jolt", "pop", "rip"
		]
	});
	let time = 75;
	if (param.sessionParameter.totalTimeLimit) {
		time = param.sessionParameter.totalTimeLimit;
	}
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const se = (id: string): void => {
			scene.asset.getAudioById(id).play();
		};
		const cosmeticRandom = g.game.random;

		// ---- フォント ----
		const makeFont = (color: string, stroke: string): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: 11
		});
		const fontWhite = makeFont("#ffffff", "#5a0a3a");
		const fontYellow = makeFont("#ffe14a", "#5a0a3a");
		const fontPink = makeFont("#ff6aa0", "#ffffff");
		const fontBlue = makeFont("#6af0ff", "#1a1050");
		const fontRank = makeFont("#e8205a", "#ffffff");
		const fontInk = makeFont("#3a1a2a", "#ffffff");

		type Align = "left" | "center" | "right";
		const label = (text: string, font: g.Font, size: number, x: number, y: number, parent: g.E, align: Align = "left"): g.Label => {
			const l = new g.Label({ scene, text, font, fontSize: size, x, y });
			if (align !== "left") l.anchorX = align === "center" ? 0.5 : 1;
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
		const worldLayer = new g.E({ scene }); // カプセルとクレーン。奥にあるものから順に描く
		const markerLayer = new g.E({ scene });
		const frontLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const hudLayer = new g.E({ scene });
		const kujiLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, worldLayer, markerLayer, frontLayer, fxLayer, hudLayer, kujiLayer, overLayer].forEach((e) => scene.append(e));
		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));
		frontLayer.append(new g.Sprite({ scene, src: img("front_panel"), y: 650 }));

		// クレーン。アームの先を原点にして、遠近に合わせて大きさを変える
		const clawE = new g.E({ scene });
		const head = new g.Sprite({ scene, src: img("claw_head"), anchorX: 0.5, anchorY: 1, y: -88 });
		const armL = new g.Sprite({ scene, src: img("claw_arm"), anchorX: 0.35, anchorY: 0.07, x: -20, y: -96 });
		const armR = new g.Sprite({ scene, src: img("claw_arm"), anchorX: 0.35, anchorY: 0.07, x: 20, y: -96 });
		armR.scaleX = -1;
		[armL, armR, head].forEach((e) => clawE.append(e));
		// ケーブルは天井のレールから、ゆれているアームの頭まで斜めにのびる
		const cable = new g.FilledRect({ scene, cssColor: "#2a2f38", width: 7, height: 10, anchorX: 0.5, anchorY: 0 });
		worldLayer.append(cable);
		worldLayer.append(clawE);
		const trolley = new g.FilledRect({ scene, cssColor: "#ff4a7a", width: 70, height: 22, anchorX: 0.5, anchorY: 0.5, y: RAIL_Y });
		hudLayer.append(trolley);
		// アームの真下の目印
		const marker = new g.Sprite({ scene, src: img("marker"), anchorX: 0.5, anchorY: 0.5 });
		markerLayer.append(marker);
		const guide = new g.FilledRect({ scene, cssColor: "rgba(255,40,120,0.35)", width: 3, height: 10 });
		markerLayer.append(guide);

		// ---- HUD ----
		const scoreLabel = label("0", fontWhite, 56, 16, 40, hudLayer);
		const multLabel = label("", fontYellow, 30, 18, 104, hudLayer);
		const timeLabel = label("", fontWhite, 44, 1264, 40, hudLayer, "right");
		const feverLabel = label("", fontYellow, 30, 1264, 96, hudLayer, "right");
		const hintLabel = label("", fontBlue, 48, 640, 40, hudLayer, "center");

		// 上から見た図(奥行きをねらうための助け)
		const MM_S = 0.17;
		const miniMap = new g.E({ scene, x: 1140, y: 500 });
		hudLayer.append(miniMap);
		label("上から見た図", fontWhite, 20, (XR - XL) * MM_S / 2, -30, miniMap, "center");
		miniMap.append(new g.FilledRect({ scene, cssColor: "#5a0a3a", x: -4, y: -4, width: (XR - XL) * MM_S + 8, height: ZB * MM_S + 8 }));
		miniMap.append(new g.FilledRect({ scene, cssColor: "#ffe9a8", width: (XR - XL) * MM_S, height: ZB * MM_S }));
		miniMap.append(new g.FilledRect({
			scene, cssColor: "#7a5ad0", x: 0, y: (ZB - CHZ) * MM_S, width: (CHX - XL) * MM_S, height: CHZ * MM_S
		}));
		const mmX = (x: number): number => (x - XL) * MM_S;
		const mmY = (z: number): number => (ZB - z) * MM_S; // 奥が上
		const dotLayer = new g.E({ scene });
		miniMap.append(dotLayer);
		const mmClawH = new g.FilledRect({ scene, cssColor: "#e8004a", width: 22, height: 4, anchorX: 0.5, anchorY: 0.5 });
		const mmClawV = new g.FilledRect({ scene, cssColor: "#e8004a", width: 4, height: 22, anchorX: 0.5, anchorY: 0.5 });
		miniMap.append(mmClawH);
		miniMap.append(mmClawV);

		// ---- 状態 ----
		let phase: "intro" | "play" | "result" = "intro";
		let elapsed = 0;
		const playTime = Math.max(20, time - INTRO_SEC - RESULT_SEC);
		let playLeft = playTime;
		let score = 0;
		let fever = false;
		let streak = 0; // 続けて取れた回数
		// クレーン(台車の位置と速さ、アームのゆれ)
		let clawX = HOME_X;
		let clawZ = HOME_Z;
		let clawY = CLAW_UP;
		let velX = 0;
		let velZ = 0;
		let swayX = 0;
		let swayZ = 0;
		let swayVX = 0;
		let swayVZ = 0;
		let tipX = clawX;
		let tipZ = clawZ;
		let tipVX = 0;
		let tipVZ = 0;
		let open = 1; // アームの開き具合(1=開いている)
		let openTarget = 1;
		type ClawState = "ready" | "moveX" | "stopX" | "wait" | "moveZ" | "stopZ" | "pause" | "down" | "close" | "lift" | "jolt" | "back" |
			"settle" | "drop";
		let claw: ClawState = "ready";
		let clawT = 0; // 今の動きをはじめてからの秒数
		let downTo = 0; // アームが下りる先(高さ)
		let liftDist = 1; // つかんでから定位置に戻るまでの道のり
		let liftDone = 0;
		let pressing = false;
		let tryGot = 0; // この1回で取れた数
		const prizes: Prize[] = [];
		const stats = { tries: 0, got: 0, gold: 0, top: 0, bestStreak: 0, multi: 0, bestRank: 9 };
		const drops = createDrops(param.random, 600);
		let dropIdx = 0;

		const mult = (): number => 1 + Math.min(streak, 10) * 0.2;
		const addScore = (v: number): void => {
			score += Math.round(v);
			g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
			setText(scoreLabel, String(score));
		};
		const popup = (text: string, font: g.Font, size: number, x: number, y: number, dur = 0.9): void => {
			const l = label(text, font, size, x, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.y = y - 60 * p;
				l.opacity = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const bigText = (text: string, font: g.Font, size: number, dur: number, y = 330): void => {
			const l = label(text, font, size, 640, y, overLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.scaleX = l.scaleY = p < 0.12 ? 2 - p / 0.12 : 1;
				l.opacity = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const sparkles = (x: number, y: number, n: number, parent: g.E = fxLayer): void => {
			for (let i = 0; i < n; i++) {
				const c = new g.Sprite({ scene, src: img("sparkle"), x, y, anchorX: 0.5, anchorY: 0.5 });
				parent.append(c);
				const a = cosmeticRandom.generate() * Math.PI * 2, sp = 150 + cosmeticRandom.generate() * 250;
				animate(0.6, (p) => {
					c.x = x + Math.cos(a) * sp * p;
					c.y = y + Math.sin(a) * sp * p;
					c.scaleX = c.scaleY = 1.4 - p;
					c.opacity = 1 - p;
					c.modified();
				}, () => c.destroy());
			}
		};
		const updateMult = (): void => setText(multLabel, streak > 0 ? "れんぞく " + streak + " ×" + mult().toFixed(1) : "");

		// ---- カプセルを開けて三角くじ ----
		let opening = 0; // 開けている途中の数
		let openCount = 0;
		let nextOpenAt = 0; // 次のくじを開けられる時刻(重ならないように少しずらす)
		const openCapsule = (p: Prize, bonus: number): void => {
			opening++;
			const delay = Math.max(0, nextOpenAt - elapsed);
			nextOpenAt = elapsed + delay + 0.45;
			scene.setTimeout(() => revealKuji(p, bonus), delay * 1000);
		};
		const revealKuji = (p: Prize, bonus: number): void => {
			const rank = RANKS[p.rank];
			const color = p.t.gold ? "gold" : "black";
			// 続けて開けたくじは、上下にずらして並べる
			const cx = 250, cy = 230 + (openCount++ % 3) * 150;
			const box = new g.E({ scene, x: cx, y: cy });
			kujiLayer.append(box);
			// カプセルがパカッと開く
			const capTop = new g.Sprite({ scene, src: img("cap_" + color + "_top"), anchorX: 0.5, anchorY: 1 });
			const capBot = new g.Sprite({ scene, src: img("cap_" + color + "_bottom"), anchorX: 0.5, anchorY: 0 });
			const kuji = new g.Sprite({ scene, src: img("kuji"), anchorX: 0.5, anchorY: 0.5 });
			kuji.scaleX = kuji.scaleY = 0.3;
			box.append(kuji);
			box.append(capBot);
			box.append(capTop);
			se("pop");
			animate(0.25, (q) => {
				capTop.y = -q * 70;
				capTop.angle = -q * 40;
				capTop.x = -q * 50;
				capBot.y = q * 70;
				capBot.angle = q * 30;
				capBot.x = q * 40;
				capTop.opacity = capBot.opacity = 1 - q * 0.8;
				kuji.scaleX = kuji.scaleY = 0.3 + 0.7 * q;
				kuji.y = -q * 20;
				[capTop, capBot, kuji].forEach((e) => e.modified());
			}, () => {
				capTop.destroy();
				capBot.destroy();
				// くじをペリッと開く
				scene.setTimeout(() => {
					se("rip");
					const paper = new g.Sprite({ scene, src: img("kuji_open"), anchorX: 0.5, anchorY: 0.5, y: -20 });
					paper.scaleX = 0.1;
					box.append(paper);
					const big = p.rank <= 1;
					const rankLabel = label(rank.name, big ? fontYellow : fontRank, big ? 84 : 72, 0, -66, box, "center");
					const v = Math.round(rank.pt * bonus);
					const ptLabel = label("+" + v + "点", fontInk, 40, 0, 20, box, "center");
					rankLabel.opacity = ptLabel.opacity = 0;
					animate(0.15, (q) => {
						kuji.scaleX = 1 - q;
						kuji.modified();
						paper.scaleX = 0.1 + 0.9 * q;
						paper.modified();
					}, () => {
						kuji.destroy();
						rankLabel.opacity = ptLabel.opacity = 1;
						rankLabel.modified();
						ptLabel.modified();
						addScore(v);
						opening--;
						stats.bestRank = Math.min(stats.bestRank, p.rank);
						if (p.rank <= 1) stats.top++;
						if (big) {
							se("jackpot");
							sparkles(cx, cy, 18, kujiLayer);
							bigText(rank.name + "!! +" + v, fontYellow, 100, 1.4, 300);
						} else {
							se(p.rank <= 3 ? "get" : "coin");
						}
						animate(0.7, (q) => {
							box.opacity = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
							box.y = cy - q * 30;
							box.modified();
						}, () => box.destroy());
					});
				}, 60);
			});
		};

		// ---- カプセルの山 ----
		const top = (p: Prize): number => p.y + p.t.h;
		const dist = (ax: number, az: number, bx: number, bz: number): number => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
		// 位置 (x, z) の半径 r のものが、高さ y から下に落ちたときに止まる高さと、乗っているカプセル
		const restOf = (self: Prize | null, r: number, x: number, y: number, z: number): { y: number; under: Prize[] } => {
			let ry = 0;
			let under: Prize[] = [];
			for (let i = 0; i < prizes.length; i++) {
				const q = prizes[i];
				if (q === self || q.state !== "pile" || top(q) > y + 2) continue;
				if (dist(x, z, q.x, q.z) >= (r + q.t.r) * 0.85) continue;
				// 球なので、真上ほど高く乗る
				const d = dist(x, z, q.x, q.z) / ((r + q.t.r) * 0.85);
				const h = top(q) - q.t.h * 0.35 * d * d;
				if (h > ry + 3) {
					ry = h;
					under = [q];
				} else if (h >= ry - 3) {
					ry = Math.max(ry, h);
					under.push(q);
				}
			}
			return { y: ry, under };
		};
		const makePrize = (d: Drop, x: number, y: number, z: number): Prize => {
			const t = d.gold ? GOLD : BLACK;
			const sprite = new g.Sprite({ scene, src: img(t.id), anchorX: 0.5, anchorY: 0.5 });
			worldLayer.append(sprite);
			const dot = new g.FilledRect({ scene, cssColor: t.color, width: 9, height: 9, anchorX: 0.5, anchorY: 0.5 });
			dotLayer.append(dot);
			const p: Prize = {
				t, rank: d.rank, x, y, z, vx: 0, vy: 0, vz: 0, ang: 0, spin: 0, squash: 0, state: "pile",
				sprite, dot, off: 0, offX: 0, offZ: 0, slipAt: 2, weak: false
			};
			prizes.push(p);
			return p;
		};
		const pileCount = (): number => prizes.filter((p) => p.state === "pile").length;
		// 置く場所を、とりだし口の外で、山が高すぎない所から選ぶ
		const placeOf = (rx: number, rz: number): { x: number; z: number } => {
			const r = BLACK.r;
			let best = { x: 0, z: 300 };
			let bestTop = 99999;
			for (let k = 0; k < 8; k++) {
				const x = XL + r + ((rx + k * 0.381) % 1) * (XR - XL - r * 2);
				const z = r + ((rz + k * 0.618) % 1) * (ZB - r * 2);
				if (x - r < CHX + 10 && z - r < CHZ + 10) continue;
				const restTop = restOf(null, r, x, 99999, z).y + BLACK.h;
				if (restTop <= PILE_LIMIT) return { x, z };
				if (restTop < bestTop) {
					bestTop = restTop;
					best = { x, z };
				}
			}
			return best;
		};
		// 最初の山は、上から積んだ形をすぐ作る
		for (let i = 0; i < START_CAPSULES; i++) {
			const d = drops[dropIdx++];
			const at = placeOf(d.x, d.z);
			const p = makePrize(d, at.x, 99999, at.z);
			p.y = restOf(p, p.t.r, p.x, p.y, p.z).y;
		}
		let refillQueue = 0;
		let refillTimer = 0;
		const refill = (n: number): void => {
			refillQueue += n;
			se("refill");
			bigText("カプセル 補充!", fontBlue, 64, 0.9, 250);
		};

		const collect = (p: Prize): void => {
			p.state = "gone";
			p.sprite.destroy();
			p.dot.destroy();
			tryGot++;
			stats.got++;
			if (p.t.gold) stats.gold++;
			// 1回でたくさん取るほど1こあたりの点が上がる
			const bonus = (1 + (tryGot - 1) * 0.5) * mult() * (fever ? 2 : 1);
			se("get");
			sparkles(screenX((XL + CHX) / 2, CHZ / 2), 600, p.t.gold ? 12 : 5);
			if (tryGot >= 2) popup(tryGot + "こ目! ×" + (1 + (tryGot - 1) * 0.5).toFixed(1), fontYellow, 40, 250, 470, 1.0);
			openCapsule(p, bonus);
		};

		const settle = (): void => {
			// 下にあるカプセルから順に、支えがなければ落とす
			const pile = prizes.filter((p) => p.state === "pile" || p.state === "chute");
			pile.sort((a, b) => a.y - b.y);
			for (let i = 0; i < pile.length; i++) {
				const p = pile[i];
				p.squash = Math.max(0, p.squash - dt * 2.5);
				if (p.state === "chute") {
					p.vy += GRAVITY * dt;
					p.y -= p.vy * dt;
					p.ang += p.spin * dt;
					p.x += ((XL + CHX) / 2 - p.x) * Math.min(1, 5 * dt);
					p.z += (CHZ / 2 - p.z) * Math.min(1, 5 * dt);
					if (p.y < -260) collect(p);
					continue;
				}
				// 仕切りより上からとりだし口に入ったらゲット。低いと仕切りに止められる
				if (inChute(p.x, p.z)) {
					if (p.y >= BH * 0.5) {
						p.state = "chute";
						continue;
					}
					if (CHX - p.x < CHZ - p.z) {
						p.x = CHX + 1;
						p.vx = Math.abs(p.vx) * 0.4;
					} else {
						p.z = CHZ + 1;
						p.vz = Math.abs(p.vz) * 0.4;
					}
				}
				// かべで跳ね返る
				const r = p.t.r;
				if (p.x < XL + r || p.x > XR - r) {
					p.x = Math.max(XL + r, Math.min(XR - r, p.x));
					p.vx = -p.vx * 0.4;
				}
				if (p.z < r || p.z > ZB - r) {
					p.z = Math.max(r, Math.min(ZB - r, p.z));
					p.vz = -p.vz * 0.4;
				}
				const rest = restOf(p, p.t.r, p.x, p.y, p.z);
				if (p.y > rest.y + 0.5 || p.vy < 0) {
					// 空中: 落ちながら回る
					p.vy += GRAVITY * dt;
					p.y -= p.vy * dt;
					p.x += p.vx * dt;
					p.z += p.vz * dt;
					p.ang += p.spin * dt;
					if (p.y <= rest.y) {
						p.y = rest.y;
						if (p.vy > 260) {
							// 跳ねる
							se("thud");
							p.vy = -p.vy * 0.32;
							p.spin *= 0.5;
							p.squash = 0.22;
							p.vx *= 0.6;
							p.vz *= 0.6;
						} else {
							p.vy = 0;
						}
					}
				} else {
					p.y = rest.y;
					p.vy = 0;
					p.vx *= 0.8;
					p.vz *= 0.8;
					p.x += p.vx * dt;
					p.z += p.vz * dt;
					p.ang += (0 - p.ang) * Math.min(1, 6 * dt);
					// 真ん中が下のカプセルからはみ出していたら、ころがり落ちる
					if (rest.under.length === 1) {
						const q = rest.under[0];
						const d = dist(p.x, p.z, q.x, q.z);
						if (d > q.t.r * 0.35) {
							const k = 260 * dt / Math.max(1, d);
							p.x += (p.x - q.x) * k;
							p.z += (p.z - q.z) * k;
							p.ang += (p.x > q.x ? 1 : -1) * 260 * dt;
							if (inChute(p.x, p.z) && p.y >= BH * 0.5) popup("ころがりゲット!?", fontBlue, 40, 300, 440, 0.9);
						}
					}
				}
			}
		};

		// カプセルとクレーンの見た目を、3Dの位置から画面に合わせる
		const aiming = (): boolean => claw === "ready" || claw === "moveX" || claw === "stopX" || claw === "wait" || claw === "moveZ" ||
			claw === "stopZ" || claw === "pause";
		const swayAngle = (): number => Math.atan(swayX / SWAY_LEN) * 180 / Math.PI;
		const render = (): void => {
			for (let i = prizes.length - 1; i >= 0; i--) {
				const p = prizes[i];
				if (p.state === "gone") {
					prizes.splice(i, 1);
					continue;
				}
				const k = depthScale(p.z);
				const sp = p.sprite;
				sp.x = screenX(p.x, p.z);
				sp.y = screenY(p.y, p.z) - sp.height * k / 2;
				sp.scaleX = k * (1 + p.squash * 0.5);
				sp.scaleY = k * (1 - p.squash);
				sp.angle = p.ang;
				sp.opacity = p.y < 0 ? Math.max(0, 1 + p.y / 200) : 1;
				// 奥のものから描く。同じ奥行きなら下のものから
				sp.tag = p.z * 1000 - p.y;
				sp.modified();
				p.dot.x = mmX(p.x);
				p.dot.y = mmY(p.z);
				p.dot.modified();
			}
			const k = depthScale(tipZ);
			const a = swayAngle();
			clawE.x = screenX(tipX, tipZ);
			clawE.y = screenY(clawY, tipZ);
			clawE.scaleX = clawE.scaleY = k;
			clawE.angle = -a;
			clawE.tag = tipZ * 1000 - clawY - 0.5;
			const ang = 4 + open * 30;
			armL.angle = ang;
			armR.angle = -ang;
			armL.modified();
			armR.modified();
			clawE.modified();
			// ケーブル: 台車から頭の上まで
			const rad = -a * Math.PI / 180;
			const hx = clawE.x + 150 * k * Math.sin(-rad) * -1;
			const hy = clawE.y - 150 * k * Math.cos(rad);
			const rx = screenX(clawX, clawZ);
			const dx = hx - rx, dy = hy - RAIL_Y;
			cable.x = rx;
			cable.y = RAIL_Y;
			cable.height = Math.max(1, Math.sqrt(dx * dx + dy * dy));
			cable.angle = Math.atan2(-dx, dy) * 180 / Math.PI;
			cable.width = 7 * k;
			cable.tag = clawE.tag + 0.1;
			cable.modified();
			trolley.x = rx;
			trolley.modified();
			worldLayer.children!.sort((p, q) => q.tag - p.tag);
			worldLayer.modified();
			// アームの真下の目印(山の上か床)。ねらっている間だけ出す
			if (aiming()) {
				const below = restOf(null, 4, tipX, clawY, tipZ).y;
				marker.x = screenX(tipX, tipZ);
				marker.y = screenY(below, tipZ);
				marker.scaleX = marker.scaleY = k;
				guide.x = marker.x - 1.5;
				guide.y = clawE.y;
				guide.height = Math.max(1, marker.y - clawE.y);
				marker.show();
				guide.show();
				marker.modified();
				guide.modified();
			} else {
				marker.hide();
				guide.hide();
			}
			mmClawH.x = mmClawV.x = mmX(tipX);
			mmClawH.y = mmClawV.y = mmY(tipZ);
			mmClawH.modified();
			mmClawV.modified();
		};

		// ---- クレーンの動き ----
		const startDown = (): void => {
			claw = "down";
			clawT = 0;
			se("down");
			setText(hintLabel, "");
			// アームの真下で、いちばん高いカプセルの上まで下りる
			let target = 0;
			for (let i = 0; i < prizes.length; i++) {
				const q = prizes[i];
				if (q.state !== "pile") continue;
				if (dist(q.x, q.z, tipX, tipZ) < q.t.r * 0.8 + 8) target = Math.max(target, top(q));
			}
			downTo = Math.max(4, target - 34);
		};
		const doGrab = (): void => {
			// アームの先がとどくカプセルを、近い順につかむ
			const tipTop = downTo + 34;
			const cand: Prize[] = [];
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "pile") continue;
				if (Math.abs(top(p) - tipTop) > 40 || dist(p.x, p.z, tipX, tipZ) > p.t.r + 30) continue;
				cand.push(p);
			}
			cand.sort((a, b) => dist(a.x, a.z, tipX, tipZ) - dist(b.x, b.z, tipX, tipZ));
			const grabbed = cand.slice(0, MAX_GRAB);
			grabbed.forEach((p) => {
				const grip = Math.max(0, 1 - dist(p.x, p.z, tipX, tipZ) / (p.t.r + 30));
				p.state = "held";
				p.off = p.y - clawY;
				p.offX = (p.x - tipX) * 0.4;
				p.offZ = (p.z - tipZ) * 0.4;
				p.vx = p.vy = p.vz = 0;
				// つかみが甘いと、持ち上げる途中で落ちる。ギリギリだと上で「ガクッ」と止まったときに落ちる
				p.slipAt = grip >= p.t.need ? 2 : 0.05 + 0.6 * grip / p.t.need;
				p.weak = grip >= p.t.need && grip < p.t.need + 0.08;
			});
			openTarget = grabbed.length > 0 ? 0.3 : 0;
			se(grabbed.length > 0 ? "grab" : "miss");
			if (grabbed.length >= 2) popup(grabbed.length + "こ つかんだ!", fontYellow, 44, clawE.x, clawE.y - 160, 0.9);
		};
		const releaseHeld = (cond: (p: Prize) => boolean, slip: boolean): void => {
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "held" || !cond(p)) continue;
				p.state = "pile";
				// アームの勢いのまま飛んでいく
				p.vx = tipVX;
				p.vz = tipVZ;
				p.vy = 0;
				p.spin = (cosmeticRandom.generate() - 0.5) * 500 + tipVX;
				if (slip) {
					se("slip");
					popup("ぽろっ…", fontPink, 44, p.sprite.x, p.sprite.y - 70, 0.8);
				}
			}
		};
		const showHint = (): void => {
			setText(hintLabel, claw === "ready" ? "① 長押しで → 右へ" : claw === "wait" ? "② 長押しで ↑ 奥へ" : "");
		};
		const endTry = (): void => {
			stats.tries++;
			if (tryGot > 0) {
				streak++;
				stats.bestStreak = Math.max(stats.bestStreak, streak);
				if (tryGot >= 2) {
					stats.multi++;
					bigText(tryGot + "こ どり!!", fontYellow, 90, 1.0, 300);
				}
			} else {
				streak = 0;
			}
			updateMult();
			tryGot = 0;
			if (pileCount() < REFILL_BELOW && refillQueue === 0) refill(14);
			claw = "ready";
			showHint();
		};
		// 目標の速さに向けて、加速・ブレーキをかける
		const approach = (v: number, target: number): number =>
			v < target ? Math.min(target, v + ACCEL * dt) : Math.max(target, v - BRAKE * dt);

		const updateClaw = (): void => {
			clawT += dt;
			const prevVX = velX, prevVZ = velZ;
			switch (claw) {
				case "ready":
				case "wait":
					openTarget = 1;
					break;
				case "moveX":
					velX = approach(velX, MOVE_X_SPEED);
					if (!pressing || clawX >= XR - 60) claw = "stopX";
					break;
				case "stopX":
					velX = approach(velX, 0);
					if (velX <= 0) {
						claw = "wait";
						showHint();
					}
					break;
				case "moveZ":
					velZ = approach(velZ, MOVE_Z_SPEED);
					if (!pressing || clawZ >= ZB - 60) claw = "stopZ";
					break;
				case "stopZ":
					velZ = approach(velZ, 0);
					if (velZ <= 0) {
						claw = "pause";
						clawT = 0;
					}
					break;
				case "pause":
					// 止まってから、ひと呼吸おいて下りる
					if (clawT >= 0.1) startDown();
					break;
				case "down": {
					const sp = Math.min(DOWN_SPEED, 300 + clawT * 3000);
					clawY = Math.max(downTo, clawY - sp * dt);
					if (clawY <= downTo) {
						claw = "close";
						clawT = 0;
						doGrab();
					}
					break;
				}
				case "close":
					if (clawT >= 0.25) {
						claw = "lift";
						clawT = 0;
						liftDist = (CLAW_UP - clawY) + dist(clawX, clawZ, HOME_X, HOME_Z);
						liftDone = 0;
					}
					break;
				case "lift": {
					const sp = Math.min(UP_SPEED, Math.max(0, clawT - 0.05) * 2500);
					const d = Math.min(sp * dt, CLAW_UP - clawY);
					clawY += d;
					liftDone += d;
					if (clawY >= CLAW_UP) {
						claw = "jolt";
						clawT = 0;
						se("jolt");
						// 上で止まった衝撃で、ゆれる
						swayVX += (cosmeticRandom.generate() - 0.5) * 60;
						swayVZ += 40;
						releaseHeld((p) => p.weak, true);
					}
					break;
				}
				case "jolt":
					clawY = CLAW_UP - Math.sin(Math.min(1, clawT / 0.22) * Math.PI) * 12;
					if (clawT >= 0.25) {
						clawY = CLAW_UP;
						claw = "back";
						clawT = 0;
					}
					break;
				case "back": {
					const rest = dist(clawX, clawZ, HOME_X, HOME_Z);
					// 加速して、着く前にブレーキ
					const cur = Math.sqrt(velX * velX + velZ * velZ);
					const want = Math.min(BACK_SPEED, Math.sqrt(2 * BRAKE * 0.8 * rest));
					const sp = cur < want ? Math.min(want, cur + ACCEL * dt) : want;
					const d = Math.min(sp * dt, rest);
					if (rest > 0.5) {
						velX = (HOME_X - clawX) / rest * sp;
						velZ = (HOME_Z - clawZ) / rest * sp;
					}
					liftDone += d;
					if (rest - d <= 0.5) {
						velX = velZ = 0;
						clawX = HOME_X;
						clawZ = HOME_Z;
						claw = "settle";
						clawT = 0;
					}
					break;
				}
				case "settle":
					if (clawT >= 0.12) {
						claw = "drop";
						clawT = 0;
					}
					break;
				case "drop":
					openTarget = 1;
					if (clawT >= 0.08) releaseHeld(() => true, false);
					// 落ちたカプセルが全部とりだし口に入るのを待つ
					if (clawT >= 0.3 && !prizes.some((p) => p.state === "held")) endTry();
					break;
			}
			if (claw !== "back") {
				clawX = Math.min(XR - 60, clawX + velX * dt);
				clawZ = Math.min(ZB - 60, clawZ + velZ * dt);
			} else {
				clawX += velX * dt;
				clawZ += velZ * dt;
			}
			if (claw === "lift" || claw === "back") {
				const progress = liftDone / liftDist;
				releaseHeld((p) => progress >= p.slipAt, true);
			}
			// アームは振り子のようにゆれる(台車の加速と逆向きに振れる)
			const ax = (velX - prevVX) / dt, az = (velZ - prevVZ) / dt;
			swayVX += (-SWAY_W2 * swayX - SWAY_DAMP * swayVX - ax * SWAY_GAIN * 30) * dt;
			swayVZ += (-SWAY_W2 * swayZ - SWAY_DAMP * swayVZ - az * SWAY_GAIN * 30) * dt;
			swayX += swayVX * dt;
			swayZ += swayVZ * dt;
			const nx = clawX + swayX, nz = clawZ + swayZ;
			tipVX = (nx - tipX) / dt;
			tipVZ = (nz - tipZ) / dt;
			tipX = nx;
			tipZ = nz;
			open += (openTarget - open) * Math.min(1, (claw === "close" ? 7 : 9) * dt);
			// つかんでいるカプセルはアームといっしょにゆれる
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "held") continue;
				p.x = tipX + p.offX;
				p.z = tipZ + p.offZ;
				p.y = clawY + p.off;
				p.ang = -swayAngle();
			}
		};

		scene.onPointDownCapture.add(() => {
			pressing = true;
			if (phase !== "play") return;
			if (claw === "ready" || claw === "wait") {
				claw = claw === "ready" ? "moveX" : "moveZ";
				clawT = 0;
				se("move");
				setText(hintLabel, "");
			}
		});
		scene.onPointUpCapture.add(() => {
			pressing = false;
		});

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(40,10,50,0.88)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 92, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.68;
		introLayer.append(logo);
		const introLines = ["① 長押しで 右へ動く!", "② 長押しで 奥へ動く!", "カプセルの中は 三角くじ!"];
		const introFonts = [fontWhite, fontBlue, fontYellow];
		introLines.forEach((t, i) => label(t, introFonts[i], 76, 640, 196 + i * 112, introLayer, "center"));
		const countLabel = label("", fontYellow, 96, 640, 650, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		const finishPlay = (): void => {
			phase = "result";
			pressing = false;
			setText(hintLabel, "");
			se("finish");
			bigText("しゅうりょう!", fontYellow, 110, 1.4, 340);
			scene.setTimeout(showResult, 1500);
		};
		const showResult = (): void => {
			// 開けている途中のくじがあれば、全部開いてから結果を出す
			if (opening > 0) {
				scene.setTimeout(showResult, 300);
				return;
			}
			se("result");
			const panel = new g.E({ scene, x: 640, y: 380, anchorX: 0.5, anchorY: 0.5, width: 760, height: 500 });
			overLayer.append(panel);
			panel.append(new g.FilledRect({ scene, cssColor: "#5a0a3a", x: -6, y: -6, width: 772, height: 512 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#fff6fa", width: 760, height: 500 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#e8407a", width: 760, height: 80 }));
			label("くじの結果", fontWhite, 48, 380, 12, panel, "center");
			label(score + " 点", fontPink, 96, 380, 96, panel, "center");
			const title = stats.got >= 18 ? "クレーンの神"
				: stats.got >= 13 ? "クレーン名人"
					: stats.got >= 8 ? "上級者"
						: stats.got >= 4 ? "常連さん" : "ビギナー";
			label("称号: " + title, fontYellow, 44, 380, 206, panel, "center");
			[
				"取ったカプセル " + stats.got + "こ (金 " + stats.gold + "こ)",
				"いちばん良いくじ " + (stats.bestRank < RANKS.length ? RANKS[stats.bestRank].name : "なし") + "  1等以上 " + stats.top + "回",
				"最大れんぞく " + stats.bestStreak + "  まとめ取り " + stats.multi + "回"
			].forEach((t, i) => label(t, fontWhite, 32, 380, 286 + i * 56, panel, "center"));
			animate(0.35, (p) => {
				panel.scaleX = panel.scaleY = 0.6 + 0.4 * (1 - Math.pow(1 - p, 3));
				panel.modified();
			});
		};

		const bgm = scene.asset.getAudioById("bgm");
		settle();
		render();

		// ---- メインループ ----
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
					bigText("スタート!", fontYellow, 110, 0.9);
					bgm.play().changeVolume(0.4);
					showHint();
				}
				setText(timeLabel, "のこり " + Math.ceil(playLeft) + "秒");
				render();
				return;
			}
			// カプセルの補充は上から降ってくる
			if (refillQueue > 0) {
				refillTimer -= dt;
				if (refillTimer <= 0) {
					const d = drops[dropIdx++ % drops.length];
					const at = placeOf(d.x, d.z);
					const p = makePrize(d, at.x, 520, at.z);
					p.spin = (cosmeticRandom.generate() - 0.5) * 400;
					refillQueue--;
					refillTimer = 0.1;
				}
			}
			if (phase === "play") {
				playLeft -= dt;
				setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playLeft)) + "秒");
				if (!fever && playLeft <= FEVER_SEC) {
					fever = true;
					se("fever");
					bigText("ラスト10秒! 得点2倍!!", fontYellow, 70, 1.3, 250);
					setText(feverLabel, "得点×2");
					refill(10);
				}
				if (fever) {
					timeLabel.opacity = Math.floor(playLeft * 4) % 2 === 0 ? 1 : 0.55;
					timeLabel.modified();
				}
				if (playLeft <= 0) finishPlay();
				else updateClaw();
			}
			settle();
			render();
		});
	});
	g.game.pushScene(scene);
}
