import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const H = 720;
const GROUND = 620; // 地面(足もと)の高さ
const PX = 560; // さぼこの横の位置(画面)
const INTRO_SEC = 4;
const END_SEC = 5; // 終わる5秒前に動きと演出を止める
const RUSH_SEC = 20; // のこり何秒からラッシュ
const SPEED0 = 470; // 走る速さ(px/秒)
const SPEED1 = 650;
const GRAVITY = 3600;
const HOLD_GRAVITY = 1900; // 長押し中の上昇は重力が弱い(高くとぶ)
const HOLD_MAX = 0.22;
const JUMP_V = 1250;
const DJUMP_V = 1050; // 空中でもう1回
const HERO_S = 0.72;
const GHOST_S = 0.66;
const HELPER_S = 0.62;
const HIT_W = 34; // さぼこの当たり判定(半分の幅)
const HIT_H = 165;
const FAR = 380; // 白凸男との距離の最大
const CANDY_PT = 100;
const LOLLI_PT = 300;
const GOLD_PT = 1000;
const DODGE_PT = 1000;
const NEAR_PT = 200;
const ASSIST_PT = 300;
const HIT_PENALTY = 300;
const FALL_PENALTY = 500;
const CAUGHT_PENALTY = 500;
const DASH_TIMES = [10, 24, 38, 52]; // 走り始めてからの秒。白凸男が右まで突進する(最低4回)
const SPLIT_TIMES = [17, 31, 45]; // 上の道と下の道にわかれるところ
const SPLIT_LEN = 1800; // わかれ道の長さ(px)
const SPLIT_UP = 230; // 上の道の高さ
const SAFE_PT = 500; // 白タイツとちがう道をえらんだボーナス
const LOOK_SEC = 10; // ふり返る間かく
const LOOK_LEN = 0.9;

type Kind = "candy" | "lolli" | "gold" | "grave" | "root" | "pumpkin" | "bat" | "hole" | "plat" | "sign";
interface Obj {
	kind: Kind; x: number; y: number; w: number; h: number; spr: g.E; done: boolean; vx: number; phase: number; near: boolean;
	pair: Obj | null; // 穴の看板
}
interface Fx { e: g.E; vx: number; vy: number; g: number; life: number; max: number; spin: number; grow: number; base: number; }

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"background", "ground_tile", "hero0", "hero1", "hero2", "hero3", "hero_look0", "hero_look1", "ghost0", "ghost1", "ghost2", "ghost3",
		"helper0", "helper1", "helper2", "helper3", "candy", "lollipop", "gold_light", "light", "bat", "gravestone",
		"pumpkin_stack", "root", "platform", "hole", "logo",
		"fx_star", "fx_spark", "fx_dust", "fx_ring", "fx_candy", "shadow", "sweat", "speedline", "vignette", "warn_hole",
		"bubble_l", "bubble_r", "dash_lane"
	];
	const audioIds = [
		"jump", "djump", "pickup", "gold", "hit", "dodge", "fall", "caught", "warn", "shout", "bonk", "combo",
		"count", "go", "finish", "fever"
	];
	const scene = new g.Scene({ game: g.game, assetIds: imageIds.concat(audioIds, ["bgm", "rush_bgm"]) });
	let time = 80;
	if (param.sessionParameter.totalTimeLimit) time = param.sessionParameter.totalTimeLimit;
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0, playThreshold: 100 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const rand = (): number => param.random.generate();
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const se = (id: string, vol = 0.7): void => {
			scene.asset.getAudioById(id).play().changeVolume(vol);
		};
		const playSec = Math.max(30, time - INTRO_SEC - END_SEC);

		// ======== 重ね順 ========
		const root = new g.E({ scene });
		scene.append(root);
		const bgLayer = new g.E({ scene });
		const objLayer = new g.E({ scene });
		const charLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		root.append(bgLayer); root.append(objLayer); root.append(charLayer); root.append(fxLayer);
		const ui = new g.E({ scene });
		scene.append(ui);

		// 背景: 左右反転した絵を交互にならべて、つなぎ目を目立たなくする
		const bgTiles: g.Sprite[] = [];
		for (let k = 0; k < 3; k++) {
			const s = new g.Sprite({ scene, src: img("background"), anchorX: 0.5, anchorY: 0, y: 0, scaleX: k % 2 ? -1 : 1 });
			bgLayer.append(s);
			bgTiles.push(s);
		}
		const rushTint = new g.FilledRect({ scene, cssColor: "#ff1030", width: W, height: H, opacity: 0 });
		bgLayer.append(rushTint);
		const groundTiles: g.Sprite[] = [];
		for (let k = 0; k < 6; k++) {
			const s = new g.Sprite({ scene, src: img("ground_tile"), y: GROUND + 22 });
			bgLayer.append(s);
			groundTiles.push(s);
		}

		// ======== 文字 ========
		const font = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = font("#ffffff", "#2a1630");
		const fontY = font("#ffe040", "#3a1a10");
		const fontR = font("#ff4a5a", "#ffffff");
		const fontO = font("#ff9a2a", "#2a1630");
		const fontInk = font("#2a1630", "#ffffff", 4);
		type Align = "left" | "center" | "right";
		const label = (
			parent: g.E, f: g.Font, size: number, x: number, y: number, text: string, align: Align = "left", w = 700
		): g.Label => {
			const l = new g.Label({ scene, font: f, fontSize: size, text, x, y, width: w, textAlign: align, widthAutoAdjust: false });
			if (align === "center") l.x = x - w / 2;
			if (align === "right") l.x = x - w;
			parent.append(l);
			return l;
		};
		const setText = (l: g.Label, t: string): void => {
			if (l.text !== t) {
				l.text = t; l.invalidate();
			}
		};

		// ======== キャラ ========
		const shadowP = new g.Sprite({ scene, src: img("shadow"), anchorX: 0.5, anchorY: 0.5, x: PX, y: GROUND, scaleX: 0.8 });
		const shadowG = new g.Sprite({ scene, src: img("shadow"), anchorX: 0.5, anchorY: 0.5, y: GROUND, scaleX: 0.9 });
		charLayer.append(shadowP); charLayer.append(shadowG);
		const ghost = new g.Sprite({ scene, src: img("ghost0"), anchorX: 0.5, anchorY: 0.93, scaleX: GHOST_S, scaleY: GHOST_S, y: GROUND });
		charLayer.append(ghost);
		const helper = new g.Sprite({
			scene, src: img("helper0"), anchorX: 0.5, anchorY: 0.95, scaleX: -HELPER_S, scaleY: HELPER_S, y: GROUND
		});
		helper.hide();
		charLayer.append(helper);
		const hero = new g.Sprite({
			scene, src: img("hero0"), anchorX: 0.5, anchorY: 0.96, scaleX: HERO_S, scaleY: HERO_S, x: PX, y: GROUND
		});
		charLayer.append(hero);
		const sweatIcon = new g.Sprite({ scene, src: img("sweat"), anchorX: 0.5, anchorY: 0.5, scaleX: 1.1, scaleY: 1.1 });
		sweatIcon.hide();
		charLayer.append(sweatIcon);
		// 吹き出し
		const bubble = (id: string, f: g.Font, size: number): { e: g.E; l: g.Label } => {
			const e = new g.E({ scene });
			e.append(new g.Sprite({ scene, src: img(id), scaleX: 0.75, scaleY: 0.75 }));
			const l = label(e, f, size, 135, 20, "", "center", 260);
			e.hide();
			fxLayer.append(e);
			return { e, l };
		};
		const ghostTalk = bubble("bubble_l", fontInk, 28);
		const helperTalk = bubble("bubble_r", fontR, 30);
		let ghostTalkLeft = 0;
		let helperTalkLeft = 0;
		const talk = (b: { e: g.E; l: g.Label }, t: string): void => {
			setText(b.l, t); b.e.show();
		};

		// ======== エフェクト ========
		const fxs: Fx[] = [];
		const particle = (
			id: string, x: number, y: number, vx: number, vy: number, life: number, size: number, grav = 0, spin = 0
		): void => {
			const a = img(id);
			const s = new g.Sprite({ scene, src: a, x, y, anchorX: 0.5, anchorY: 0.5 });
			const base = size / a.width;
			s.scale(base);
			fxLayer.append(s);
			fxs.push({ e: s, vx, vy, g: grav, life, max: life, spin, grow: 0, base });
		};
		const ring = (x: number, y: number, size: number, life: number): void => {
			const a = img("fx_ring");
			const s = new g.Sprite({ scene, src: a, x, y, anchorX: 0.5, anchorY: 0.5 });
			const base = size / a.width;
			s.scale(base * 0.2);
			fxLayer.append(s);
			fxs.push({ e: s, vx: 0, vy: 0, g: 0, life, max: life, spin: 0, grow: 1, base });
		};
		const burst = (id: string, x: number, y: number, n: number, speed: number, size: number): void => {
			for (let k = 0; k < n; k++) {
				const a = k / n * Math.PI * 2 + rand() * 0.5;
				const v = speed * (0.6 + rand() * 0.6);
				const sz = size * (0.7 + rand() * 0.6);
				particle(id, x, y, Math.cos(a) * v, Math.sin(a) * v - speed * 0.3, 0.5 + rand() * 0.3, sz, 900, (rand() - 0.5) * 12);
			}
		};
		const dust = (x: number, n: number): void => {
			for (let k = 0; k < n; k++) {
				particle("fx_dust", x + (rand() - 0.5) * 40, GROUND - 10, -120 - rand() * 160, -40 - rand() * 60, 0.45, 50 + rand() * 30);
			}
		};
		// ふわっと上がる文字
		const pop = (t: string, f: g.Font, size: number, x: number, y: number, life = 0.8): void => {
			const l = label(fxLayer, f, size, x, y, t, "center", 600);
			fxs.push({ e: l, vx: 0, vy: -90, g: 0, life, max: life, spin: 0, grow: 0, base: 1 });
		};
		// 画面中央の大きな文字(ぽんっと出る)
		const banners: { e: g.E; life: number }[] = [];
		const banner = (t: string, f: g.Font, size: number, y = 300): void => {
			const e = new g.E({ scene, x: W / 2, y });
			const l = label(e, f, size, 0, -size / 2, t, "center", 1200);
			l.x = -600;
			e.scale(0.2);
			ui.append(e);
			banners.push({ e, life: 1.2 });
		};
		let shake = 0;
		const flash = new g.FilledRect({ scene, cssColor: "#ffffff", width: W, height: H, opacity: 0 });
		const vignette = new g.Sprite({ scene, src: img("vignette"), opacity: 0 });
		ui.append(vignette); ui.append(flash);
		const doFlash = (col: string, a: number): void => {
			flash.cssColor = col; flash.opacity = a; flash.modified();
		};
		let hitStop = 0;
		// 集中線
		const lines: g.Sprite[] = [];
		for (let k = 0; k < 10; k++) {
			const s = new g.Sprite({ scene, src: img("speedline"), x: rand() * W, y: 120 + rand() * 480, opacity: 0 });
			fxLayer.append(s);
			lines.push(s);
		}

		// ======== 表示(上18%はさけて、少し下に) ========
		const hudBg = new g.FilledRect({ scene, cssColor: "rgba(20,10,30,0.55)", x: 0, y: 128, width: W, height: 64 });
		ui.append(hudBg);
		const scoreLabel = label(ui, fontY, 44, 24, 136, "0てん");
		const timeLabel = label(ui, fontW, 40, W - 24, 140, "", "right");
		const comboLabel = label(ui, fontO, 32, 330, 144, "", "left", 300);
		// 危険メーター(白凸男との距離)
		label(ui, fontW, 22, 840, 133, "白凸男", "center", 120);
		const meterBack = new g.FilledRect({ scene, cssColor: "#2a1630", x: 690, y: 162, width: 300, height: 16 });
		const meterBar = new g.FilledRect({ scene, cssColor: "#5ad04a", x: 692, y: 164, width: 296, height: 12 });
		ui.append(meterBack); ui.append(meterBar);
		const multLabel = label(ui, fontR, 30, 600, 142, "", "center", 160);

		// ======== 状態 ========
		let phase: "intro" | "play" | "end" = "intro";
		let introLeft = INTRO_SEC;
		let t = 0; // 走り始めてからの秒
		let score = 0;
		let combo = 0;
		let speed = SPEED0;
		let worldX = 0; // 進んだ距離
		let py = 0; // 地面からの高さ(上がプラス)
		let vy = 0;
		let onGround = true;
		let groundLevel = 0; // いま乗っている足場の高さ(地面=0)
		let jumps = 0;
		let holding = false;
		let holdT = 0;
		let invuln = 0;
		let stumble = 0;
		let falling = 0;
		let runAnim = 0;
		let squash = 0;
		let lookBack = 6;
		let lookLeft = 0;
		let sweatLeft = 0;
		let d = 300; // 白凸男との距離
		let ghostMode = 2; // 0:本気 1:つかれた 2:ふつう
		let ghostModeLeft = 6;
		let ghostStun = 0;
		let ghostX = PX - 130 - d;
		let ghostTalkCd = 9;
		// 突進
		let dashIdx = 0;
		let dashState: "none" | "warn" | "run" | "gone" = "none";
		let dashT = 0;
		let dashDodged = false;
		let dashCount = 0;
		// 助っ人
		let helperCd = 7;
		let helperState: "none" | "run" | "back" = "none";
		let helperX = 0;
		let rush = false;
		const objs: Obj[] = [];
		let nextChunk = W + 300; // 次の仕掛けを置く位置(worldX 基準)
		const holes: Obj[] = [];
		const plats: Obj[] = [];

		const addScore = (pts: number): number => {
			score = Math.max(0, score + pts);
			g.game.vars.gameState.score = score;
			setText(scoreLabel, score + "てん");
			return pts;
		};
		const danger = (): number => (d < 110 ? 3 : d < 210 ? 2 : 1);
		const comboMul = (): number => 1 + Math.min(2, Math.floor(combo / 10) * 0.5);

		// ======== 仕掛けを置く ========
		const sprAt = (id: string, sx: number, sy: number, ax = 0.5, ay = 1): g.Sprite => {
			const s = new g.Sprite({ scene, src: img(id), anchorX: ax, anchorY: ay, scaleX: sx, scaleY: sy });
			objLayer.append(s);
			return s;
		};
		// 障害物どうしは、ジャンプして着地してから次をとべる間をかならずあける
		let lastHazard = -99999;
		const isHazard = (k: Kind): boolean => k === "grave" || k === "root" || k === "pumpkin" || k === "bat" || k === "hole";
		const room = (x: number): boolean => x + worldX >= lastHazard + speed * 0.95 + 120;
		const add = (kind: Kind, x: number, y: number): Obj | null => {
			if (isHazard(kind)) {
				if (!room(x)) return null;
				lastHazard = x + worldX;
			}
			let spr: g.E;
			let w = 40, h = 40;
			if (kind === "candy") {
				spr = sprAt("candy", 0.75, 0.75, 0.5, 0.5); w = 30; h = 26;
			} else if (kind === "lolli") {
				spr = sprAt("lollipop", 0.85, 0.85, 0.5, 0.5); w = 34; h = 34;
			} else if (kind === "gold") {
				const e = new g.E({ scene });
				const glow = new g.Sprite({ scene, src: img("gold_light"), anchorX: 0.5, anchorY: 0.5, scaleX: 2.2, scaleY: 2.2 });
				const c = new g.Sprite({ scene, src: img("lollipop"), anchorX: 0.5, anchorY: 0.5, scaleX: 1.3, scaleY: 1.3 });
				e.append(glow); e.append(c);
				objLayer.append(e);
				spr = e; w = 44; h = 50;
			} else if (kind === "grave") {
				spr = sprAt("gravestone", 0.8, 0.8); w = 44; h = 72;
			} else if (kind === "root") {
				spr = sprAt("root", 0.8, 0.8); w = 46; h = 44;
			} else if (kind === "pumpkin") {
				spr = sprAt("pumpkin_stack", 0.95, 0.95); w = 40; h = 150;
			} else if (kind === "bat") {
				spr = sprAt("bat", 0.9, 0.9, 0.5, 0.5); w = 46; h = 26;
			} else if (kind === "hole") {
				spr = sprAt("hole", 0.7, 1.1, 0.5, 0.5); w = 105; h = 0;
			} else if (kind === "plat") {
				spr = sprAt("platform", 1, 1, 0.5, 0); w = 150; h = 0;
			} else {
				spr = sprAt("warn_hole", 0.8, 0.8, 0.5, 1);
			}
			const o: Obj = { kind, x, y, w, h, spr, done: false, vx: 0, phase: rand() * 6, near: false, pair: null };
			objs.push(o);
			if (kind === "hole") holes.push(o);
			if (kind === "plat") plats.push(o);
			return o;
		};
		const candyLine = (x0: number, n: number, gap: number, y: number, rare = false): void => {
			for (let k = 0; k < n; k++) add(rare && k === n - 1 ? "lolli" : "candy", x0 + k * gap, y);
		};
		const candyArc = (x0: number, n: number, gap: number, y: number, hgt: number): void => {
			for (let k = 0; k < n; k++) add("candy", x0 + k * gap, y - Math.sin((k + 0.5) / n * Math.PI) * hgt);
		};
		// 足場の高さ(地面からの高さ)
		const LOW = 150, HIGH = 270;
		const chunk = (x: number, lv: number): number => {
			const r = rand();
			const ground = GROUND - 40;
			if (r < 0.14) {
				candyLine(x, 7, 70, ground, lv > 0.4);
				return 560;
			} else if (r < 0.3) {
				// 墓石をとびこえるアーチ
				add("grave", x + 200, GROUND);
				candyArc(x + 60, 6, 56, ground, 200);
				if (lv > 0.5) add("root", x + 460, GROUND);
				return 560;
			} else if (r < 0.46) {
				// 段差の足場: 下段→上段。上にキャンディ、さいごに大アメ
				add("plat", x + 160, GROUND - LOW);
				candyLine(x + 100, 3, 60, GROUND - LOW - 40);
				add("plat", x + 460, GROUND - HIGH);
				candyLine(x + 400, 3, 60, GROUND - HIGH - 40);
				add(rand() < 0.4 + lv * 0.3 ? "gold" : "lolli", x + 600, GROUND - HIGH - 60);
				return 760;
			} else if (r < 0.6) {
				// 穴(手前に看板)と、上のキャンディ
				const hl = add("hole", x + 120, GROUND);
				if (hl) {
					hl.pair = add("sign", x - 220, GROUND);
					if (hl.pair) hl.pair.w = 0;
				}
				candyArc(x + 20, 5, 50, ground - 20, 190);
				return 460;
			} else if (r < 0.72) {
				// コウモリ(頭の上)。ジャンプするとぶつかる。地面のキャンディを取ろう
				add("bat", x + 260, GROUND - 260);
				if (lv > 0.5) add("bat", x + 520, GROUND - 250);
				candyLine(x + 100, 7, 70, ground);
				return 680;
			} else if (r < 0.84) {
				// 高いかぼちゃ: 長押しか2段ジャンプ
				add("pumpkin", x + 220, GROUND);
				candyArc(x + 80, 6, 56, ground, 300);
				return 560;
			} else {
				// 連続の障害物
				add("root", x + 120, GROUND);
				add("grave", x + 380, GROUND);
				if (lv > 0.4) add("root", x + 600, GROUND);
				candyArc(x + 40, 4, 50, ground, 170);
				candyArc(x + 300, 4, 50, ground, 190);
				return lv > 0.4 ? 760 : 620;
			}
		};

		// ======== わかれ道: 上の道(長い足場)と下の道(地面)。白タイツはどちらかに入る ========
		interface Split { x0: number; x1: number; lane: number; judged: boolean; label: g.E; }
		const splits: Split[] = [];
		let splitIdx = 0;
		let chase = false; // 白タイツが同じ道でダッシュしてくる
		const makeSplit = (x: number): number => {
			const x0 = x + 260;
			// 上の道へのぼる小さな段
			add("plat", x0 - 230, GROUND - 120);
			for (let k = 0; k * 300 < SPLIT_LEN; k++) add("plat", x0 + 150 + k * 300, GROUND - SPLIT_UP);
			candyLine(x0 + 80, 10, 150, GROUND - SPLIT_UP - 45, true);
			candyLine(x0 + 150, 10, 150, GROUND - 45, true);
			const lane = rand() < 0.5 ? 1 : 0; // 1:上 0:下
			// 道の入り口に、白タイツがどっちに入るかの看板
			const e = new g.E({ scene, x: x0 - 120, y: GROUND - SPLIT_UP - 210 });
			e.append(new g.FilledRect({ scene, cssColor: "#2a1630", x: -150, y: 0, width: 300, height: 92 }));
			e.append(new g.FilledRect({ scene, cssColor: lane ? "#c03a6a" : "#3a6ac0", x: -144, y: 6, width: 288, height: 80 }));
			label(e, fontW, 26, 0, 10, "白タイツは", "center", 300);
			label(e, fontY, 34, 0, 42, lane ? "上の道 ↑" : "下の道 ↓", "center", 300);
			objLayer.append(e);
			splits.push({ x0, x1: x0 + SPLIT_LEN, lane, judged: false, label: e });
			lastHazard = x0 + SPLIT_LEN + worldX;
			talk(ghostTalk, lane ? "上の道を行くぞー！" : "下の道を行くぞー！"); ghostTalkLeft = 2.5;
			banner("わかれ道！白タイツとちがう道へ！", fontO, 54, 300);
			se("warn", 0.6);
			return SPLIT_LEN + 520;
		};

		// ======== 操作 ========
		const jump = (): void => {
			if (phase !== "play" || falling > 0) return;
			if (onGround) {
				vy = JUMP_V; onGround = false; jumps = 1; holdT = 0;
				se("jump", 0.5);
				dust(PX, 3);
				squash = -0.25;
			} else if (jumps < 2) {
				vy = DJUMP_V; jumps = 2; holdT = HOLD_MAX;
				se("djump", 0.5);
				ring(PX, GROUND - py, 140, 0.3);
				burst("fx_spark", PX, GROUND - py, 6, 260, 26);
			}
		};
		scene.onPointDownCapture.add(() => {
			holding = true;
			jump();
		});
		scene.onPointUpCapture.add(() => {
			holding = false;
		});

		// ======== ダメージ ========
		const hurt = (msg: string, pen: number, closer: number): void => {
			if (invuln > 0) return;
			combo = 0;
			addScore(-pen);
			d = Math.max(0, d - closer);
			invuln = 1.2;
			stumble = 0.35;
			shake = 0.3;
			doFlash("#ff2040", 0.35);
			se("hit", 0.7);
			burst("fx_star", PX, GROUND - py - 150, 6, 220, 30);
			pop(msg + " -" + pen, fontR, 36, PX, GROUND - py - 260);
		};
		const caught = (): void => {
			if (invuln > 0) return;
			combo = 0;
			addScore(-CAUGHT_PENALTY);
			invuln = 1.8;
			stumble = 0.6;
			shake = 0.5;
			doFlash("#ff2040", 0.5);
			se("caught", 0.8);
			banner("つかまった！ -" + CAUGHT_PENALTY, fontR, 64, 330);
			burst("fx_star", PX - 40, GROUND - 180, 10, 300, 34);
			d = 280;
			ghostStun = 0.8;
		};

		// ======== はじめ ========
		const intro = new g.E({ scene });
		ui.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(15,8,30,0.6)", width: W, height: H }));
		intro.append(new g.Sprite({ scene, src: img("logo"), x: W / 2, y: 250, anchorX: 0.5, anchorY: 0.5 }));
		label(intro, fontW, 36, W / 2, 360, "タップでジャンプ・長押しで高く・空中でもう1回！", "center", 1200);
		label(intro, fontY, 32, W / 2, 412, "お菓子を集めて、白凸男からにげきれ！", "center", 1200);
		label(intro, fontR, 30, W / 2, 460, "「いくぞー！」のあとの突進はジャンプでよけろ", "center", 1200);
		const countLabel = label(intro, fontY, 90, W / 2, 500, "", "center", 400);

		// ======== おしまい ========
		const finish = (): void => {
			phase = "end";
			se("finish", 0.7);
			const over = new g.E({ scene });
			ui.append(over);
			over.append(new g.FilledRect({ scene, cssColor: "rgba(15,8,30,0.55)", width: W, height: H }));
			label(over, fontY, 96, W / 2, 230, "おしまい！", "center", 1000);
			label(over, fontW, 64, W / 2, 360, score + "てん", "center", 1000);
		};

		// ======== 毎フレーム ========
		let lastCount = -1;
		const heroFrames = ["hero0", "hero1", "hero2", "hero1"];
		const ghostFrames = ["ghost0", "ghost1", "ghost2", "ghost3"];
		const helperFrames = ["helper0", "helper1"];
		const setSrc = (s: g.Sprite, id: string): void => {
			const a = img(id);
			if (s.src !== a) {
				s.src = a; s.invalidate();
			}
		};
		scene.onUpdate.add(() => {
			if (phase === "intro") {
				introLeft -= dt;
				const n = Math.ceil(introLeft);
				if (n !== lastCount && n <= 3 && n > 0) {
					se("count", 0.6); lastCount = n;
				}
				setText(countLabel, n <= 3 && n > 0 ? String(n) : "");
				if (introLeft <= 0) {
					phase = "play";
					intro.destroy();
					se("go", 0.7);
					banner("GO！", fontY, 120);
					g.game.audio.music.play(scene.asset.getAudioById("bgm"));
				}
			}
			if (hitStop > 0) {
				hitStop -= dt;
				return;
			}
			const playing = phase === "play";
			if (playing) {
				t += dt;
				if (t >= playSec) finish();
			}
			const p = Math.min(1, t / playSec);
			const left = Math.max(0, Math.ceil(playSec - t));
			setText(timeLabel, phase === "intro" ? "のこり " + Math.ceil(playSec) + "秒" : "のこり " + left + "秒");
			// ラッシュ
			if (playing && !rush && playSec - t <= RUSH_SEC) {
				rush = true;
				se("fever", 0.7);
				banner("ラスト20秒！白凸男もうつい！", fontR, 60, 320);
				g.game.audio.music.play(scene.asset.getAudioById("rush_bgm"));
			}
			// 速さ
			const target = playing ? (SPEED0 + (SPEED1 - SPEED0) * p) * (rush ? 1.15 : 1) * (stumble > 0 ? 0.55 : 1) : 0;
			speed += (target - speed) * Math.min(1, dt * 4);
			const move = speed * dt;
			worldX += move;
			// 背景(遠くはゆっくり)
			const bgOff = (worldX * 0.25) % 2560;
			bgTiles.forEach((s, k) => {
				s.x = 640 + k * 1280 - bgOff; s.modified();
			});
			const gOff = worldX % 320;
			groundTiles.forEach((s, k) => {
				s.x = k * 320 - gOff; s.modified();
			});
			rushTint.opacity = rush ? 0.16 + Math.sin(t * 6) * 0.04 : 0;
			rushTint.modified();

			// ---- 仕掛けを出す ----
			if (playing && worldX + W + 200 > nextChunk && t < playSec - 3) {
				if (splitIdx < SPLIT_TIMES.length && t >= SPLIT_TIMES[splitIdx] && dashState === "none") {
					splitIdx++;
					nextChunk += makeSplit(nextChunk - worldX);
				} else nextChunk += chunk(nextChunk - worldX, p) * (1.1 - p * 0.25) + 120;
			}
			// わかれ道の判定: 白タイツが道に入ったとき、さぼこが同じ道なら、ダッシュしてつかまえに来る
			for (let i = splits.length - 1; i >= 0; i--) {
				const sp = splits[i];
				sp.x0 -= move; sp.x1 -= move;
				sp.label.x -= move; sp.label.modified();
				if (playing && !sp.judged && sp.x0 + 200 <= ghostX) {
					sp.judged = true;
					const myLane = py >= SPLIT_UP - 12 ? 1 : 0;
					if (myLane === sp.lane && falling <= 0) {
						chase = true;
						se("warn", 0.8);
						talk(ghostTalk, "同じ道だー！まてー！"); ghostTalkLeft = 1.5;
					} else {
						const pts = addScore(SAFE_PT);
						se("dodge", 0.6);
						banner("セーフ！ +" + pts, fontY, 64, 300);
						burst("fx_star", PX, GROUND - py - 100, 10, 320, 30);
					}
				}
				if (sp.x1 < -400) {
					sp.label.destroy(); splits.splice(i, 1);
				}
			}
			for (let i = objs.length - 1; i >= 0; i--) {
				const o = objs[i];
				o.x -= move + o.vx * dt;
				// 取ったお菓子は絵を消してあるので、画面の外に出たらリストからも消す
				if (o.done && (o.kind === "candy" || o.kind === "lolli" || o.kind === "gold")) {
					objs.splice(i, 1);
					continue;
				}
				let sy = o.y;
				if (o.kind === "candy" || o.kind === "lolli" || o.kind === "gold") sy += Math.sin(t * 5 + o.phase) * 5;
				if (o.kind === "bat") sy += Math.sin(t * 7 + o.phase) * 14;
				if (o.kind === "gold") {
					o.spr.children![0].angle += 3; o.spr.children![0].modified();
				}
				o.spr.x = o.x; o.spr.y = sy;
				if (o.kind === "sign") o.spr.opacity = Math.floor(t * 6) % 2 ? 1 : 0.6;
				o.spr.modified();
				if (o.x < -300) {
					o.spr.destroy();
					objs.splice(i, 1);
					const hi = holes.indexOf(o);
					if (hi >= 0) holes.splice(hi, 1);
					const pi = plats.indexOf(o);
					if (pi >= 0) plats.splice(pi, 1);
					continue;
				}
				if (!playing || o.done || falling > 0) continue;
				// 当たり判定
				const feet = GROUND - py, head = feet - HIT_H;
				const dx = Math.abs(o.x - PX);
				if (o.kind === "candy" || o.kind === "lolli" || o.kind === "gold") {
					if (dx < o.w + HIT_W && sy > head - o.h && sy < feet + o.h) {
						o.done = true;
						o.spr.destroy();
						combo++;
						const base = o.kind === "gold" ? GOLD_PT : o.kind === "lolli" ? LOLLI_PT : CANDY_PT;
						const pts = addScore(Math.round(base * danger() * comboMul()));
						if (o.kind === "gold") {
							se("gold", 0.8);
							hitStop = 0.08;
							doFlash("#fff6c0", 0.5);
							ring(o.x, sy, 260, 0.45);
							burst("fx_star", o.x, sy, 14, 420, 36);
							banner("大アメ！ +" + pts, fontY, 64, 300);
						} else {
							se("pickup", 0.4);
							burst(o.kind === "lolli" ? "fx_star" : "fx_candy", o.x, sy, o.kind === "lolli" ? 8 : 5, 220, 22);
							pop("+" + pts, fontY, o.kind === "lolli" ? 40 : 28, o.x, sy - 60, 0.6);
						}
						if (combo > 0 && combo % 10 === 0) {
							se("combo", 0.6);
							pop(combo + "コンボ！ ×" + comboMul(), fontO, 44, PX, GROUND - py - 300);
						}
					}
				} else if (o.kind === "grave" || o.kind === "root" || o.kind === "pumpkin" || o.kind === "bat") {
					const top = o.kind === "bat" ? sy - o.h : o.y - o.h;
					const bottom = o.kind === "bat" ? sy + o.h : o.y;
					if (dx < o.w + HIT_W - 10 && feet > top + 6 && head < bottom - 4) {
						o.done = true;
						hurt(o.kind === "bat" ? "コウモリ！" : "ドテッ！", HIT_PENALTY, 110);
						o.spr.opacity = 0.5;
					} else if (o.x < PX - o.w - HIT_W && !o.near) {
						// よけきった。ギリギリならボーナス
						o.near = true;
						const gap = o.kind === "bat" ? top - feet : feet < top ? top - feet : 999;
						if (o.kind !== "bat" && gap >= 0 && gap < 40) {
							const pts = addScore(Math.round(NEAR_PT * danger()));
							pop("ギリギリ！ +" + pts, fontO, 34, PX, GROUND - py - 240);
							burst("fx_spark", PX, GROUND - py - 40, 6, 240, 24);
						}
					}
				}
			}

			// ---- さぼこ ----
			if (playing) {
				// 足もとの高さ(足場の上か、地面か)
				let floor = 0;
				let overHole = false;
				plats.forEach((pl) => {
					if (Math.abs(pl.x - PX) < pl.w + 10 && py >= GROUND - pl.y - 8) floor = Math.max(floor, GROUND - pl.y);
				});
				holes.forEach((hl) => {
					if (Math.abs(hl.x - PX) < hl.w - 35) overHole = true;
				});
				if (falling > 0) {
					falling -= dt;
					py -= 700 * dt;
					if (falling <= 0) {
						// 上から点滅してもどる
						py = 360; vy = 0; onGround = false; jumps = 1;
						invuln = 1.8;
					}
				} else {
					if (!onGround) {
						const rising = vy > 0;
						if (holding && rising && holdT < HOLD_MAX) {
							holdT += dt; vy -= HOLD_GRAVITY * dt;
						} else vy -= GRAVITY * dt;
						py += vy * dt;
						if (vy <= 0 && py <= floor && (floor > 0 || !overHole)) {
							py = floor; vy = 0; onGround = true; jumps = 0; groundLevel = floor;
							squash = 0.25;
							dust(PX, 2);
						}
						if (py < -40 && overHole) {
							falling = 0.6;
							combo = 0;
							addScore(-FALL_PENALTY);
							d = Math.max(0, d - 150);
							se("fall", 0.7);
							pop("落ちた！ -" + FALL_PENALTY, fontR, 40, PX, GROUND - 260);
						}
					} else {
						// 足場がなくなったら落ちる
						if (groundLevel > 0 && floor < groundLevel) {
							onGround = false; vy = 0; jumps = 1;
						} else if (groundLevel === 0 && overHole) {
							onGround = false; vy = 0; jumps = 2;
						}
					}
				}
			}
			if (invuln > 0) invuln -= dt;
			if (stumble > 0) stumble -= dt;
			runAnim += speed * dt / 60;
			const looking = lookLeft > 0 && falling <= 0;
			const runFrame = looking ? (Math.floor(runAnim) % 2 ? "hero_look1" : "hero_look0") : heroFrames[Math.floor(runAnim) % 4];
			const frame = !onGround && !looking ? "hero2" : stumble > 0 ? "hero3" : runFrame;
			setSrc(hero, frame);
			squash *= 0.8;
			hero.scaleX = HERO_S * (1 + squash * 0.5);
			hero.scaleY = HERO_S * (1 - squash * 0.5);
			hero.y = GROUND - py + (onGround ? Math.abs(Math.sin(runAnim * Math.PI)) * -6 : 0);
			hero.opacity = invuln > 0 && Math.floor(invuln * 14) % 2 === 0 ? 0.35 : 1;
			hero.angle = stumble > 0 ? -12 : !onGround ? Math.max(-12, Math.min(12, -vy / 120)) : 0;
			hero.modified();
			if (lookLeft > 0) {
				sweatIcon.show();
				sweatIcon.x = PX + 46; sweatIcon.y = hero.y - 190 + Math.sin(t * 20) * 3;
				sweatIcon.modified();
			} else sweatIcon.hide();
			shadowP.scaleX = 0.8 * Math.max(0.3, 1 - py / 400);
			shadowP.y = GROUND - groundLevel * (onGround ? 1 : 0);
			shadowP.opacity = falling > 0 ? 0 : 1;
			shadowP.modified();
			// ふり返り(約10びょうごと)と汗
			if (playing) {
				// 10びょうに1回、走りながら後ろをふり返る。頭のうしろに汗がとぶ
				lookBack -= dt;
				if (lookBack <= 0) {
					lookBack = LOOK_SEC;
					lookLeft = LOOK_LEN;
				}
				if (lookLeft > 0) {
					lookLeft -= dt;
					sweatLeft -= dt;
					if (sweatLeft <= 0) {
						sweatLeft = 0.12;
						particle("sweat", PX + 34, GROUND - py - 205, 140 + rand() * 120, -160 - rand() * 80, 0.5, 24, 900, 0.2);
					}
				}
			}

			// ---- 白凸男 ----
			if (playing && dashState === "none") {
				ghostModeLeft -= dt;
				if (ghostModeLeft <= 0) {
					ghostMode = ghostMode === 0 ? 1 : ghostMode === 1 ? 2 : 0;
					ghostModeLeft = ghostMode === 0 ? 5 : ghostMode === 1 ? 4 : 6;
					if (ghostMode === 0) pop("白凸男が本気になった！", fontR, 32, 260, 360);
					if (ghostMode === 1) pop("白凸男がつかれた…チャンス！", fontY, 30, 260, 360);
				}
				if (ghostStun > 0) ghostStun -= dt;
				else d += (ghostMode === 0 ? -42 : ghostMode === 1 ? 38 : 8) * (rush ? 1.6 : 1) * dt;
				d = Math.max(0, Math.min(FAR, d));
				if (d <= 0) caught();
			}
			// 突進
			const inSplit = splits.some((sp) => sp.x1 > ghostX - 100 && sp.x0 < W + 200) || chase;
			const dashDue = dashIdx < DASH_TIMES.length && t >= DASH_TIMES[dashIdx];
			if (playing && dashState === "none" && dashDue && helperState === "none" && !inSplit) {
				dashState = "warn"; dashT = 3; dashIdx++;
				// 突進と障害物がかさならないように、まだ画面の外にある障害物をどけて、しばらく置かない
				for (let i = objs.length - 1; i >= 0; i--) {
					const o = objs[i];
					if (isHazard(o.kind) && o.x > W + 20) {
						o.done = true; o.x = -9999;
						if (o.pair) o.pair.x = -9999;
					}
				}
				lastHazard = Math.max(lastHazard, worldX + PX + speed * 4.6 - (speed * 0.95 + 120));
				se("warn", 0.7);
				talk(ghostTalk, "いくぞー！"); ghostTalkLeft = 3;
				banner("白凸男の突進がくる！ジャンプでよけろ", fontR, 48, 300);
			}
			if (dashState === "warn") {
				dashT -= dt;
				if (Math.ceil(dashT) !== Math.ceil(dashT + dt)) se("count", 0.6);
				if (dashT <= 0) {
					dashState = "run"; dashDodged = false;
					shake = 0.2;
				}
			} else if (dashState === "run") {
				ghostX += 1500 * dt;
				// さぼこの位置を通るとき
				if (!dashDodged && Math.abs(ghostX - PX) < 60) {
					if (py > 110 || falling > 0) {
						dashDodged = true;
						const pts = addScore(Math.round(DODGE_PT * Math.max(1, danger())));
						se("dodge", 0.8);
						hitStop = 0.1;
						doFlash("#ffffff", 0.45);
						ring(PX, GROUND - py, 300, 0.5);
						burst("fx_star", PX, GROUND - py - 60, 12, 380, 34);
						banner("ジャンプ回避！ +" + pts, fontY, 64, 300);
					} else {
						dashDodged = true;
						caught();
					}
				}
				if (ghostX > W + 220) {
					dashState = "gone"; dashT = 1.2; dashCount++;
					g.game.vars.dashCount = dashCount;
				}
			} else if (dashState === "gone") {
				dashT -= dt;
				if (dashT <= 0) {
					dashState = "none"; d = FAR; ghostX = -200;
				}
			}
			if (chase) {
				// 同じ道: いっきにダッシュしてつかまえる
				ghostX += 1600 * dt;
				if (ghostX >= PX - 70) {
					chase = false;
					caught();
					ghostX = PX - 130 - d;
				}
			} else if (dashState !== "run" && dashState !== "gone") {
				const tx = PX - 130 - d;
				ghostX += (tx - ghostX) * Math.min(1, dt * (dashState === "none" && ghostX < -100 ? 2 : 6));
			}
			ghost.x = ghostX + (dashState === "warn" ? Math.sin(t * 50) * 4 : 0);
			const gRun = dashState === "run" ? 3 : 1;
			setSrc(ghost, ghostStun > 0 && dashState === "none" ? "ghost3" : ghostFrames[Math.floor(runAnim * gRun * 0.9) % 3]);
			// わかれ道の上の道にいるときは、足場の高さを走る
			let gLift = 0;
			splits.forEach((sp) => {
				if (sp.lane === 1 && ghostX > sp.x0 && ghostX < sp.x1) gLift = SPLIT_UP;
			});
			ghost.y = GROUND - gLift - Math.abs(Math.sin(runAnim * Math.PI * (chase ? 3 : gRun))) * 8;
			ghost.angle = ghostStun > 0 ? -18 : dashState === "run" ? 8 : 0;
			ghost.opacity = dashState === "gone" ? 0 : 1;
			ghost.modified();
			shadowG.x = ghostX; shadowG.y = GROUND - gLift; shadowG.opacity = ghost.opacity; shadowG.modified();
			if (dashState === "run" && Math.floor(t * 30) % 2 === 0) dust(ghostX - 40, 1);
			// 白凸男のひとこと
			if (playing && dashState === "none") {
				ghostTalkCd -= dt;
				if (ghostTalkCd <= 0) {
					ghostTalkCd = 14;
					const ph = ["待てー", "いかにゃ軍団の作ったよー", "歌聞いてー", "逃げないでー"];
					talk(ghostTalk, ph[Math.floor(rand() * ph.length)]); ghostTalkLeft = 2.2;
				}
			}
			if (ghostTalkLeft > 0) {
				ghostTalkLeft -= dt;
				ghostTalk.e.x = Math.max(10, ghostX - 30); ghostTalk.e.y = GROUND - 330; ghostTalk.e.modified();
				if (ghostTalkLeft <= 0) ghostTalk.e.hide();
			}

			// ---- 助っ人の女の子(右から走ってきて、白凸男をこうげき) ----
			if (playing && helperState === "none" && dashState === "none") {
				helperCd -= dt;
				if (helperCd <= 0) {
					helperState = "run"; helperX = W + 150;
					helper.show();
					se("shout", 0.8);
					talk(helperTalk, "にげろさぼこ！"); helperTalkLeft = 1.6;
					banner("にげろさぼこ！", fontO, 72, 300);
				}
			}
			if (helperState === "run") {
				helperX -= (900 + speed) * dt;
				if (helperX <= ghostX + 60) {
					// こうげき！
					helperState = "back";
					se("bonk", 0.8);
					burst("fx_star", ghostX, GROUND - 160, 10, 320, 34);
					ring(ghostX, GROUND - 140, 200, 0.4);
					shake = 0.2;
					ghostStun = 1.2;
					d = Math.min(FAR, d + 150);
					const pts = addScore(ASSIST_PT);
					pop("ナイスアシスト！ +" + pts, fontY, 38, Math.max(200, ghostX + 60), GROUND - 330);
				}
			} else if (helperState === "back") {
				helperX -= (500 + speed * 0.3) * dt;
				if (helperX < -200) {
					helperState = "none"; helper.hide(); helperCd = 7 + rand() * 2;
				}
			}
			if (helperState !== "none") {
				helper.x = helperX;
				const hb = Math.floor(t * 8) % 2 ? "helper2" : "helper3";
				setSrc(helper, helperState === "back" ? hb : helperFrames[Math.floor(runAnim * 1.5) % 2]);
				helper.y = GROUND - Math.abs(Math.sin(runAnim * Math.PI * 1.5)) * 8;
				helper.modified();
			}
			if (helperTalkLeft > 0) {
				helperTalkLeft -= dt;
				helperTalk.e.x = Math.min(W - 280, helperX - 220); helperTalk.e.y = GROUND - 300; helperTalk.e.modified();
				if (helperTalkLeft <= 0) helperTalk.e.hide();
			}

			// ---- 表示 ----
			setText(comboLabel, combo >= 5 ? combo + "コンボ ×" + comboMul() : "");
			const mul = danger();
			setText(multLabel, mul > 1 ? "×" + mul + "!" : "");
			meterBar.width = 296 * d / FAR;
			meterBar.cssColor = d < 110 ? "#ff3a4a" : d < 210 ? "#ffb030" : "#5ad04a";
			meterBar.modified();
			const near = Math.max(0, Math.min(0.8, (160 - d) / 160));
			vignette.opacity = near * (0.7 + Math.sin(t * 10) * 0.3) + (dashState === "warn" ? 0.4 : 0);
			vignette.modified();
			// 集中線
			const lineOn = rush || dashState === "run" ? 0.7 : speed > 560 ? 0.3 : 0;
			lines.forEach((s, k) => {
				s.x -= speed * 2.5 * dt * (1 + (k % 3) * 0.3);
				if (s.x < -330) {
					s.x = W + rand() * 200; s.y = 120 + rand() * 480;
				}
				s.opacity = lineOn; s.modified();
			});
			// ゆれ
			if (shake > 0) {
				shake -= dt;
				root.x = (rand() - 0.5) * 24 * shake / 0.3; root.y = (rand() - 0.5) * 16 * shake / 0.3;
			} else {
				root.x = 0; root.y = 0;
			}
			root.modified();
			if (flash.opacity > 0) {
				flash.opacity = Math.max(0, flash.opacity - dt * 2.5); flash.modified();
			}
			// エフェクト
			for (let i = fxs.length - 1; i >= 0; i--) {
				const f = fxs[i];
				f.life -= dt;
				f.e.x += f.vx * dt; f.e.y += f.vy * dt; f.vy += f.g * dt;
				f.e.angle += f.spin;
				const r = f.life / f.max;
				if (f.grow) {
					f.e.scaleX = f.e.scaleY = f.base * (0.2 + 0.8 * (1 - r));
				}
				f.e.opacity = Math.min(1, r * 2);
				f.e.modified();
				if (f.life <= 0) {
					f.e.destroy(); fxs.splice(i, 1);
				}
			}
			for (let i = banners.length - 1; i >= 0; i--) {
				const b = banners[i];
				b.life -= dt;
				const k = 1.2 - b.life;
				const s = k < 0.15 ? 0.2 + k / 0.15 * 1.0 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
				b.e.scaleX = b.e.scaleY = s;
				b.e.opacity = Math.min(1, b.life * 3);
				b.e.modified();
				if (b.life <= 0) {
					b.e.destroy(); banners.splice(i, 1);
				}
			}
		});
	});
	g.game.pushScene(scene);
}
