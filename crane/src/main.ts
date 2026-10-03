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
const CLAW_UP = 390; // 上がったときのアームの先の高さ
const PILE_LIMIT = 300; // 景品の山の高さの上限(これより上には積まない)
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
const MAX_GRAB = 6; // 1回でつかめる最大の数
const ARM = 1.5; // アームの大きさ(つかめる広さもこれに合わせて広がる)
const REACH = 30 * ARM; // ぬいぐるみの半径より、どれだけ外までつかめるか
const PUSH = 90 * ARM; // 山に突っ込んだとき、はじく範囲
const START_PLUSH = 170;
const REFILL_BELOW = 130; // ぬいぐるみがこれより少なくなったら補充
const INTRO_SEC = 4;
const RESULT_SEC = 10;
const FEVER_SEC = 15;

// 3Dの点 → 画面の点(遠近法)。tools/gen-images.js の背景も同じ計算で描いている
const FOCAL = 520;
const Z0 = 420;
const CAM_H = 430;
const HORIZON = 117;
const RAIL_Y = 14;
const depthScale = (z: number): number => FOCAL / (z + Z0);
const screenX = (x: number, z: number): number => 640 + x * depthScale(z);
const screenY = (y: number, z: number): number => HORIZON + (CAM_H - y) * depthScale(z);

// ぬいぐるみの種類(大きいほど高得点で、つかみにくい)
interface PlushType {
	id: string;
	name: string;
	h: number;
	r: number; // 上から見たときの半径
	value: number;
	need: number; // しっかりつかむのに必要な「つかみの良さ」(0〜1)
	color: string; // 上から見た図の色
	big: boolean; // 大当たりの演出をする
}
const TYPES: PlushType[] = [
	// 小
	{ id: "p_hiyoko", name: "ひよこ", h: 62, r: 26, value: 100, need: 0.05, color: "#ffd000", big: false },
	{ id: "p_buta", name: "こぶた", h: 68, r: 30, value: 100, need: 0.05, color: "#ff9ac0", big: false },
	{ id: "p_penguin", name: "ペンギン", h: 60, r: 27, value: 100, need: 0.05, color: "#2a3a6a", big: false },
	{ id: "p_kaeru", name: "かえる", h: 66, r: 29, value: 100, need: 0.05, color: "#5ab02a", big: false },
	{ id: "p_hamster", name: "ハムスター", h: 55, r: 26, value: 100, need: 0.05, color: "#e0a060", big: false },
	// 中
	{ id: "p_usagi", name: "うさぎ", h: 118, r: 36, value: 250, need: 0.18, color: "#ff5a9a", big: false },
	{ id: "p_neko", name: "ねこ", h: 100, r: 42, value: 250, need: 0.2, color: "#ff8a1a", big: false },
	{ id: "p_inu", name: "いぬ", h: 95, r: 46, value: 250, need: 0.2, color: "#3a8aff", big: false },
	{ id: "p_hitsuji", name: "ひつじ", h: 97, r: 46, value: 250, need: 0.2, color: "#d8d0c0", big: false },
	{ id: "p_kitsune", name: "きつね", h: 105, r: 40, value: 250, need: 0.2, color: "#ff6a0a", big: false },
	// 大
	{ id: "p_kuma", name: "くま", h: 132, r: 60, value: 600, need: 0.32, color: "#8a4a1a", big: false },
	{ id: "p_lion", name: "ライオン", h: 136, r: 62, value: 600, need: 0.32, color: "#c8641a", big: false },
	{ id: "p_zou", name: "ぞう", h: 118, r: 66, value: 600, need: 0.32, color: "#8890b8", big: false },
	// 特大
	{ id: "p_panda", name: "でかパンダ", h: 186, r: 82, value: 1500, need: 0.42, color: "#222222", big: true },
	{ id: "p_kujira", name: "でかクジラ", h: 160, r: 90, value: 1500, need: 0.42, color: "#2a7aff", big: true },
	// レア
	{ id: "p_gold", name: "金のくま", h: 96, r: 44, value: 2000, need: 0.3, color: "#ffb400", big: true },
	{ id: "p_unicorn", name: "ユニコーン", h: 132, r: 54, value: 3000, need: 0.36, color: "#d070ff", big: true }
];
const RARE_FROM = 15; // これ以降はレア

// 共通乱数で、ぬいぐるみの種類と置く場所を決める(全員同じ)
interface Drop { type: number; x: number; z: number; }
function pickType(a: number, b: number): number {
	if (a < 0.38) return Math.floor(b * 5);
	if (a < 0.72) return 5 + Math.floor(b * 5);
	if (a < 0.87) return 10 + Math.floor(b * 3);
	if (a < 0.94) return 13 + Math.floor(b * 2);
	return a < 0.98 ? RARE_FROM : RARE_FROM + 1;
}
function createDrops(random: g.RandomGenerator, n: number): Drop[] {
	const out: Drop[] = [];
	for (let i = 0; i < n; i++) {
		const type = pickType(random.generate(), random.generate());
		out.push({ type, x: random.generate(), z: random.generate() });
	}
	return out;
}

const inChute = (x: number, z: number): boolean => x < CHX && z < CHZ;

interface Prize {
	t: PlushType;
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
	still: number; // 止まっているフレーム数(長く止まっているものは計算を間引く)
}

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "front_panel", "marker", "claw_head", "claw_arm", "sparkle", "logo",
			"p_hiyoko", "p_buta", "p_penguin", "p_kaeru", "p_hamster", "p_usagi", "p_neko", "p_inu", "p_hitsuji", "p_kitsune",
			"p_kuma", "p_lion", "p_zou", "p_panda", "p_kujira", "p_gold", "p_unicorn",
			"move", "down", "grab", "slip", "miss", "get", "jackpot", "refill", "beep", "go", "finish", "fever", "result", "bgm",
			"thud", "jolt", "pop"
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
		const worldLayer = new g.E({ scene }); // ぬいぐるみとクレーン。奥にあるものから順に描く
		const markerLayer = new g.E({ scene });
		const frontLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const hudLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, worldLayer, markerLayer, frontLayer, fxLayer, hudLayer, overLayer].forEach((e) => scene.append(e));
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
		let hitStop = 0; // つかんだ瞬間に一瞬止める
		let queued = false; // 戻っている間に押された
		const prizes: Prize[] = [];
		const stats = { tries: 0, got: 0, gold: 0, panda: 0, bestStreak: 0, multi: 0 };
		const drops = createDrops(param.random, 1500);
		// つかむたびのホールド力(6〜10)と、落ちるかどうかのくじ。共通乱数なので全員同じ順番
		const holdSeq: number[] = [];
		// 3〜7がよく出て、8〜10はたまに出る
		const holdWeights = [14, 16, 18, 16, 14, 10, 7, 5]; // ホールド力 3,4,5,…,10 の出やすさ
		const pickHold = (u: number): number => {
			let acc = 0;
			for (let k = 0; k < holdWeights.length; k++) {
				acc += holdWeights[k] / 100;
				if (u < acc) return 3 + k;
			}
			return 10;
		};
		for (let i = 0; i < 300; i++) holdSeq.push(pickHold(param.random.generate()));
		const rollSeq: number[] = [];
		for (let i = 0; i < 1500; i++) rollSeq.push(param.random.generate());
		let rollIdx = 0;
		let hold = 10;
		let dropIdx = 0;

		const mult = (): number => 1 + Math.min(streak, 10) * 0.2;
		const addScore = (v: number): void => {
			score += Math.round(v);
			g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
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
		let shakeT = 0;
		let shakeAmp = 0;
		const shake = (dur: number, amp: number): void => {
			shakeT = Math.max(shakeT, dur);
			shakeAmp = Math.max(shakeT > 0 ? shakeAmp : 0, amp);
		};
		const updateShake = (): void => {
			const shaking = shakeT > 0;
			shakeT = Math.max(0, shakeT - dt);
			const dx = shaking ? (cosmeticRandom.generate() - 0.5) * 2 * shakeAmp : 0;
			const dy = shaking ? (cosmeticRandom.generate() - 0.5) * 2 * shakeAmp : 0;
			[bgLayer, worldLayer, markerLayer, frontLayer].forEach((e) => {
				e.x = dx;
				e.y = dy;
				e.modified();
			});
		};
		// 表示の点数は、本当の点数に向かってカウントアップする
		let shownScore = 0;
		const updateScoreLabel = (): void => {
			if (shownScore === score) return;
			shownScore = Math.min(score, shownScore + Math.max(7, Math.ceil((score - shownScore) * 0.18)));
			setText(scoreLabel, String(shownScore));
			scoreLabel.scaleX = scoreLabel.scaleY = 1.15;
			scoreLabel.modified();
		};
		// ホールド力の表示(アームの横について動く)
		const holdColors = ["#ff2a2a", "#ff5a2a", "#ff8a1a", "#ffb42a", "#ffe14a", "#c8f04a", "#5af08a", "#6af0ff"]; // 3〜10
		const holdFonts = holdColors.map((c) => makeFont(c, "#2a0a2a"));
		const holdBox = new g.E({ scene });
		fxLayer.append(holdBox);
		holdBox.append(new g.FilledRect({ scene, cssColor: "rgba(30,10,40,0.75)", x: -6, y: -6, width: 192, height: 74 }));
		const holdLabel = label("", fontWhite, 30, 90, -2, holdBox, "center");
		const holdBars: g.FilledRect[] = [];
		for (let i = 0; i < 10; i++) {
			const b = new g.FilledRect({ scene, cssColor: "#555", x: i * 18, y: 40, width: 14, height: 22 });
			holdBox.append(b);
			holdBars.push(b);
		}
		holdBox.hide();
		const showHold = (): void => {
			const c = hold - 3;
			holdLabel.font = holdFonts[c];
			setText(holdLabel, "ホールド力 " + hold);
			holdBars.forEach((b, i) => {
				b.cssColor = i < hold ? holdColors[c] : "#555";
				b.modified();
			});
			holdBox.show();
			if (hold >= 10 || hold <= 4) popup(hold >= 10 ? "MAX!!" : "弱い…", holdFonts[c], 48, clawE.x, clawE.y - 220, 0.9);
		};
		const updateMult = (): void => setText(multLabel, streak > 0 ? "れんぞく " + streak + " ×" + mult().toFixed(1) : "");

		// ---- ぬいぐるみの山 ----
		const top = (p: Prize): number => p.y + p.t.h;
		const dist = (ax: number, az: number, bx: number, bz: number): number => Math.sqrt((ax - bx) * (ax - bx) + (az - bz) * (az - bz));
		// 位置 (x, z) の半径 r のものが、高さ y から下に落ちたときに止まる高さと、乗っているぬいぐるみ
		const restOf = (self: Prize | null, r: number, x: number, y: number, z: number): { y: number; under: Prize[] } => {
			let ry = 0;
			let under: Prize[] = [];
			for (let i = 0; i < prizes.length; i++) {
				const q = prizes[i];
				if (q === self || q.state !== "pile" || top(q) > y + 2) continue;
				const lim = r + q.t.r;
				if (x - q.x > lim || q.x - x > lim || z - q.z > lim || q.z - z > lim) continue;
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
			const t = TYPES[d.type];
			const sprite = new g.Sprite({ scene, src: img(t.id), anchorX: 0.5, anchorY: 0.5 });
			worldLayer.append(sprite);
			const size = Math.max(6, t.r * MM_S * 1.6);
			const dot = new g.FilledRect({ scene, cssColor: t.color, width: size, height: size, anchorX: 0.5, anchorY: 0.5 });
			dotLayer.append(dot);
			const p: Prize = {
				t, x, y, z, vx: 0, vy: 0, vz: 0, ang: 0, spin: 0, squash: 0, state: "pile",
				sprite, dot, off: 0, offX: 0, offZ: 0, slipAt: 2, weak: false, still: 0
			};
			prizes.push(p);
			return p;
		};
		const pileCount = (): number => prizes.filter((p) => p.state === "pile").length;
		// 置く場所を、とりだし口の外で、山が高すぎない所から選ぶ
		const toCenter = (u: number): number => 0.5 + (u < 0.5 ? -1 : 1) * 2 * (u - 0.5) * (u - 0.5);
		const placeOf = (type: number, rx0: number, rz0: number): { x: number; z: number } => {
			const t = TYPES[type];
			const r = t.r;
			let best = { x: 0, z: 300 };
			let bestTop = 99999;
			// 高得点のものほど右(とりだし口から遠い所)に置く。右がいっぱいなら、だんだん左へ広げる
			const left0 = t.value >= 600 ? 0.62 : t.value >= 250 ? 0.25 : 0;
			const width0 = t.value >= 600 ? 0.38 : t.value >= 250 ? 0.6 : 0.8;
			for (let k = 0; k < 24; k++) {
				const widen = Math.floor(k / 8) * 0.25; // 8回ごとに左へ広げる
				const lo = Math.max(0, left0 - widen);
				const u = (rx0 + k * 0.381) % 1;
				const fx = lo + (left0 + width0 - lo) * (t.value >= 600 ? u : toCenter(u));
				const x = XL + r + fx * (XR - XL - r * 2);
				const uz = (rz0 + k * 0.618) % 1;
				const z = r + (t.value >= 600 ? uz : toCenter(uz)) * (ZB - r * 2);
				if (x - r < CHX + 10 && z - r < CHZ + 10) continue;
				const restTop = restOf(null, r, x, 99999, z).y + t.h;
				if (restTop <= PILE_LIMIT) return { x, z };
				if (restTop < bestTop) {
					bestTop = restTop;
					best = { x, z };
				}
			}
			return best;
		};
		// 最初の山は、上から積んだ形をすぐ作る
		for (let i = 0; i < START_PLUSH; i++) {
			const d = drops[dropIdx++];
			const at = placeOf(d.type, d.x, d.z);
			const p = makePrize(d, at.x, 99999, at.z);
			p.y = restOf(p, p.t.r, p.x, p.y, p.z).y;
		}
		let refillQueue = 0;
		let refillTimer = 0;
		const refill = (n: number, text = "ぬいぐるみ 補充!", y = 250): void => {
			refillQueue += n;
			se("refill");
			bigText(text, fontBlue, 64, 1.1, y);
		};

		const collect = (p: Prize): void => {
			p.state = "gone";
			p.sprite.destroy();
			p.dot.destroy();
			tryGot++;
			stats.got++;
			if (TYPES.indexOf(p.t) >= RARE_FROM) stats.gold++;
			else if (p.t.big) stats.panda++;
			// 1回でたくさん取るほど1こあたりの点が上がる
			const multi = 1 + (tryGot - 1) * 0.5;
			const v = Math.round(p.t.value * multi * mult() * (fever ? 2 : 1));
			addScore(v);
			const cx = screenX((XL + CHX) / 2, CHZ / 2);
			se(p.t.big ? "jackpot" : "get");
			se("pop");
			sparkles(cx, 600, p.t.big ? 18 : 7);
			shake(p.t.big ? 0.4 : 0.18, p.t.big ? 14 : 7);
			const text = (tryGot >= 2 ? tryGot + "こ目! " : "") + p.t.name + " +" + v;
			const font = p.t.big || tryGot >= 2 ? fontYellow : fontWhite;
			popup(text, font, p.t.big ? 56 : 46, cx + 110, 480 - Math.min(tryGot - 1, 4) * 54, 1.1);
			if (p.t.big) bigText(p.t.name + "!!", fontYellow, 110, 1.2, 300);
		};

		// まわりのぬいぐるみを「起こす」(止まっていて計算を間引いていたものも、また毎フレーム動かす)
		const wake = (x: number, z: number, radius: number): void => {
			for (let i = 0; i < prizes.length; i++) {
				const q = prizes[i];
				if (q.still > 0 && dist(q.x, q.z, x, z) < radius + q.t.r) q.still = 0;
			}
		};
		let frameNo = 0;
		const settle = (): void => {
			frameNo++;
			// 下にあるぬいぐるみから順に、支えがなければ落とす
			const pile = prizes.filter((p) => p.state === "pile" || p.state === "chute");
			pile.sort((a, b) => a.y - b.y);
			for (let i = 0; i < pile.length; i++) {
				const p = pile[i];
				p.squash = Math.max(0, p.squash - dt * 2.5);
				// 長く止まっているものは、8フレームに1回だけ調べる
				if (p.state === "pile" && p.still > 20 && (frameNo + i) % 8 !== 0) continue;
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
					p.still = 0;
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
					let moving = Math.abs(p.vx) + Math.abs(p.vz) > 3;
					// 真ん中が下のぬいぐるみからはみ出していたら、ころがり落ちる
					if (rest.under.length === 1) {
						const q = rest.under[0];
						const d = dist(p.x, p.z, q.x, q.z);
						if (d > q.t.r * 0.35) {
							const k = 260 * dt / Math.max(1, d);
							p.x += (p.x - q.x) * k;
							p.z += (p.z - q.z) * k;
							p.ang += (p.x > q.x ? 1 : -1) * 260 * dt;
							if (inChute(p.x, p.z) && p.y >= BH * 0.5) popup("ころがりゲット!?", fontBlue, 40, 300, 440, 0.9);
							moving = true;
						}
					}
					if (moving) {
						if (p.still > 20) wake(p.x, p.z, p.t.r * 2);
						p.still = 0;
					} else {
						p.still++;
					}
				}
			}
		};

		// ぬいぐるみとクレーンの見た目を、3Dの位置から画面に合わせる
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
			clawE.scaleX = clawE.scaleY = k * ARM;
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
			const hx = clawE.x + 150 * k * ARM * Math.sin(rad);
			const hy = clawE.y - 150 * k * ARM * Math.cos(rad);
			const rx = screenX(clawX, clawZ);
			const dx = hx - rx, dy = hy - RAIL_Y;
			cable.x = rx;
			cable.y = RAIL_Y;
			cable.height = Math.max(1, Math.sqrt(dx * dx + dy * dy));
			cable.angle = Math.atan2(-dx, dy) * 180 / Math.PI;
			cable.width = 7 * k * ARM;
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
				marker.scaleX = marker.scaleY = k * ARM;
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
			if (holdBox.visible()) {
				holdBox.x = Math.min(1080, clawE.x + 70);
				holdBox.y = Math.max(110, clawE.y - 200);
				holdBox.modified();
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
			// アームの真下で、いちばん高いぬいぐるみの上まで下りる
			let target = 0;
			for (let i = 0; i < prizes.length; i++) {
				const q = prizes[i];
				if (q.state !== "pile") continue;
				if (dist(q.x, q.z, tipX, tipZ) < q.t.r * 0.8 + 8 * ARM) target = Math.max(target, top(q));
			}
			downTo = Math.max(4, target - 34);
		};
		const doGrab = (): void => {
			// アームの先がとどくぬいぐるみを、近い順につかむ
			const tipTop = downTo + 34;
			const cand: Prize[] = [];
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "pile") continue;
				if (Math.abs(top(p) - tipTop) > 40 || dist(p.x, p.z, tipX, tipZ) > p.t.r + REACH) continue;
				cand.push(p);
			}
			cand.sort((a, b) => dist(a.x, a.z, tipX, tipZ) - dist(b.x, b.z, tipX, tipZ));
			const grabbed = cand.slice(0, MAX_GRAB);
			hold = holdSeq[stats.tries % holdSeq.length];
			if (grabbed.length > 0) showHold();
			grabbed.forEach((p) => {
				const grip = Math.max(0, 1 - dist(p.x, p.z, tipX, tipZ) / (p.t.r + REACH));
				p.state = "held";
				p.off = p.y - clawY;
				p.offX = (p.x - tipX) * 0.4;
				p.offZ = (p.z - tipZ) * 0.4;
				p.vx = p.vy = p.vz = 0;
				// つかみが甘いと、持ち上げる途中で落ちる。ギリギリだと上で「ガクッ」と止まったときに落ちる
				// 落ちる確率: ホールド力が弱いほど、つかみが甘いほど、大きいほど落ちやすい
				const q = grip / Math.max(0.01, p.t.need);
				const weak = Math.pow((10 - hold) / 7, 1.2) * 0.9; // 3で0.9、6で約0.46、10で0
				const chance = Math.max(0, Math.min(0.97, weak + (q < 1 ? (1 - q) * 0.9 : 0) + p.t.need * 0.3 - 0.06));
				const r1 = rollSeq[rollIdx++ % rollSeq.length];
				const r2 = rollSeq[rollIdx++ % rollSeq.length];
				p.slipAt = 2;
				p.weak = false;
				if (r1 < chance) {
					// 4割は上で「ガクッ」と止まったとき、それ以外は持ち上げ中〜運ぶ途中で落ちる
					if (r2 < 0.4) p.weak = true;
					else p.slipAt = 0.05 + r2 * 0.6;
				}
			});
			wake(tipX, tipZ, PUSH + 120);
			// アームが山に突っ込んだ勢いで、まわりのぬいぐるみがはじかれて転がる
			let pushed = 0;
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "pile") continue;
				const d = dist(p.x, p.z, tipX, tipZ);
				if (d > p.t.r + PUSH || Math.abs(top(p) - tipTop) > 110) continue;
				const k = (1 - d / (p.t.r + PUSH)) * 260 / Math.max(1, d);
				// とりだし口の方へは、少し強めに転がる
				const toChute = p.x < tipX && p.z < tipZ + 60 ? 1.4 : 1;
				p.vx += (p.x - tipX) * k * toChute;
				p.vz += (p.z - tipZ) * k * toChute;
				p.vy = -160 - 140 * (1 - d / (p.t.r + PUSH));
				p.spin = (p.x > tipX ? 1 : -1) * 300;
				pushed++;
			}
			if (pushed > 0) shake(0.12, 4);
			hitStop = grabbed.length > 0 ? 0.09 : 0;
			openTarget = grabbed.length > 0 ? 0.3 : 0;
			se(grabbed.length > 0 ? "grab" : "miss");
			if (grabbed.length >= 2) popup(grabbed.length + "こ つかんだ!", fontYellow, 44, clawE.x, clawE.y - 160, 0.9);
		};
		const releaseHeld = (cond: (p: Prize) => boolean, slip: boolean): void => {
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "held" || !cond(p)) continue;
				p.state = "pile";
				p.still = 0;
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
			holdBox.hide();
			if (pileCount() < REFILL_BELOW && refillQueue === 0) refill(50);
			claw = "ready";
			if (queued && pressing) {
				claw = "moveX";
				clawT = 0;
				se("move");
			}
			queued = false;
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
					// 落ちたぬいぐるみが全部とりだし口に入るのを待つ
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
			// つかんでいるぬいぐるみはアームといっしょにゆれる
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
			} else if (claw === "jolt" || claw === "back" || claw === "settle" || claw === "drop") {
				queued = true;
			}
		});
		scene.onPointUpCapture.add(() => {
			pressing = false;
			queued = false;
		});

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(40,10,50,0.88)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 92, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.68;
		introLayer.append(logo);
		const introLines = ["① 長押しで 右へ動く!", "② 長押しで 奥へ動く!", "でっかいのは 高得点!"];
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
			se("result");
			const panel = new g.E({ scene, x: 640, y: 380, anchorX: 0.5, anchorY: 0.5, width: 760, height: 500 });
			overLayer.append(panel);
			panel.append(new g.FilledRect({ scene, cssColor: "#5a0a3a", x: -6, y: -6, width: 772, height: 512 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#fff6fa", width: 760, height: 500 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#e8407a", width: 760, height: 80 }));
			label("取ったぬいぐるみ", fontWhite, 48, 380, 12, panel, "center");
			label(score + " 点", fontPink, 96, 380, 96, panel, "center");
			const title = stats.got >= 28 ? "クレーンの神"
				: stats.got >= 20 ? "クレーン名人"
					: stats.got >= 12 ? "上級者"
						: stats.got >= 6 ? "常連さん" : "ビギナー";
			label("称号: " + title, fontYellow, 44, 380, 206, panel, "center");
			[
				"取ったぬいぐるみ " + stats.got + "こ (" + stats.tries + "回中)",
				"特大 " + stats.panda + "こ  レア " + stats.gold + "こ",
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
			// ぬいぐるみの補充は上から降ってくる
			if (refillQueue > 0) {
				refillTimer -= dt;
				if (refillTimer <= 0) {
					const d = drops[dropIdx++ % drops.length];
					const at = placeOf(d.type, d.x, d.z);
					const p = makePrize(d, at.x, 520, at.z);
					p.spin = (cosmeticRandom.generate() - 0.5) * 400;
					refillQueue--;
					refillTimer = 0.03;
				}
			}
			if (phase === "play") {
				playLeft -= dt;
				setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playLeft)) + "秒");
				if (!fever && playLeft <= FEVER_SEC) {
					fever = true;
					se("fever");
					bigText("ラスト15秒! 得点2倍!!", fontYellow, 70, 1.3, 250);
					setText(feverLabel, "得点×2");
					refill(90, "ぬいぐるみ 大放出!!", 400);
				}
				if (fever) {
					timeLabel.opacity = Math.floor(playLeft * 4) % 2 === 0 ? 1 : 0.55;
					timeLabel.modified();
				}
				if (playLeft <= 0) finishPlay();
				else if (hitStop > 0) hitStop -= dt;
				else updateClaw();
			}
			if (hitStop <= 0) settle();
			render();
			updateShake();
			updateScoreLabel();
			scoreLabel.scaleX = scoreLabel.scaleY = 1 + (scoreLabel.scaleX - 1) * 0.8;
			scoreLabel.modified();
		});
	});
	g.game.pushScene(scene);
}
