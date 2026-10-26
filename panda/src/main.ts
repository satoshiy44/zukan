import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const H = 720;
const SETUP_SEC = 20; // さいしょに動物を置く時間
const END_SEC = 3;
const BUDGET = 100; // 置くのに使えるポイント
const CASTLE_X = 640;
const CASTLE_Y = 330;
const CASTLE_HP = 120;
const CASTLE_R = 70; // 敵がここまで来たらお城をこうげき
const BREAK_PENALTY = 2000; // お城がこわれたときのマイナス
const HIT_PENALTY = 30; // 敵のこうげき1あたりのマイナス
const ATTACK_SEC = 2.0; // お城に着いた敵が、こうげきする間かく
const ROAD_KEEP = 48; // 道からこれだけはなさないと置けない
const UNIT_GAP = 52; // 動物どうしの間
const FIELD_TOP = 70;
const FIELD_BOTTOM = 600;
// 道(tools/course.json と同じ)。最後はお城
const PATHS: number[][][] = [
	[[-60, 170], [210, 170], [290, 300], [520, 330]],
	[[1340, 520], [1060, 520], [980, 380], [760, 340]],
	[[930, -60], [930, 110], [740, 150], [660, 230]],
	[[300, 780], [300, 520], [500, 500], [600, 430]]
];

type UnitKind = "chick" | "rabbit" | "penguin" | "elephant" | "lion";
interface UnitDef { kind: UnitKind; name: string; cost: number; range: number; rate: number; dmg: number; desc: string; }
const UNITS: UnitDef[] = [
	{ kind: "chick", name: "ひよこ", cost: 2, range: 135, rate: 0.45, dmg: 2, desc: "まめでっぽう" },
	{ kind: "rabbit", name: "うさぎ", cost: 5, range: 200, rate: 0.8, dmg: 5, desc: "にんじんミサイル" },
	{ kind: "penguin", name: "ペンギン", cost: 10, range: 165, rate: 1.0, dmg: 3, desc: "こおりで3体まで足止め" },
	{ kind: "elephant", name: "ゾウ", cost: 20, range: 190, rate: 1.5, dmg: 9, desc: "みずでっぽう(まわりも)" },
	{ kind: "lion", name: "ライオン", cost: 30, range: 160, rate: 1.8, dmg: 14, desc: "ほえて全体こうげき" }
];
type EnemyKind = "slime" | "goblin" | "devil" | "witch" | "ogre";
interface EnemyDef { kind: EnemyKind; hp: number; speed: number; pts: number; dmg: number; scale: number; }
const ENEMIES: { [k: string]: EnemyDef } = {
	slime: { kind: "slime", hp: 8, speed: 46, pts: 100, dmg: 1, scale: 0.7 },
	goblin: { kind: "goblin", hp: 14, speed: 60, pts: 200, dmg: 2, scale: 0.72 },
	devil: { kind: "devil", hp: 16, speed: 88, pts: 300, dmg: 3, scale: 0.7 },
	witch: { kind: "witch", hp: 32, speed: 50, pts: 500, dmg: 4, scale: 0.75 },
	ogre: { kind: "ogre", hp: 130, speed: 30, pts: 2000, dmg: 10, scale: 0.9 }
};

interface Unit { def: UnitDef; x: number; y: number; cool: number; spr: g.Sprite; bounce: number; }
interface Enemy {
	def: EnemyDef; path: number; d: number; hp: number; maxHp: number; x: number; y: number;
	slow: number; flash: number; e: g.E; spr: g.Sprite; bar: g.FilledRect; dead: boolean;
	stop: number; atk: number; lunge: number;
}
interface Shot {
	kind: string; x: number; y: number; tx: number; ty: number; target: Enemy | null;
	dmg: number; spr: g.Sprite; t: number; dur: number; sx: number; sy: number;
}
interface Fx { spr: g.E; life: number; max: number; grow: number; base: number; vy: number; }

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"bg", "castle", "u_chick", "u_rabbit", "u_penguin", "u_elephant", "u_lion",
		"e_slime", "e_goblin", "e_devil", "e_witch", "e_ogre",
		"p_pea", "p_carrot", "p_water", "p_ice", "ring", "ring_ng", "roar", "splash", "poof", "star", "card", "card_on", "logo"
	];
	const audioIds = [
		"place", "cancel", "ng", "pea", "carrot", "ice", "splash", "roar", "hit", "poof", "castle", "break", "beep", "go", "finish"
	];
	const scene = new g.Scene({
		game: g.game,
		assetIds: imageIds.concat(audioIds.map((a) => "se_" + a), ["bgm"])
	});
	let time = 90;
	if (param.sessionParameter.totalTimeLimit) {
		time = param.sessionParameter.totalTimeLimit;
	}
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const rand = (): number => param.random.generate();
		const se = (id: string, vol = 0.7): void => {
			scene.asset.getAudioById("se_" + id).play().changeVolume(vol);
		};
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const dist = (ax: number, ay: number, bx: number, by: number): number => Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));

		// ======== 道の長さ ========
		const pts = PATHS.map((p) => p.concat([[CASTLE_X, CASTLE_Y]]));
		const lens = pts.map((p) => {
			const l: number[] = [0];
			for (let k = 1; k < p.length; k++) l.push(l[k - 1] + dist(p[k - 1][0], p[k - 1][1], p[k][0], p[k][1]));
			return l;
		});
		const posAt = (pi: number, d: number): number[] => {
			const p = pts[pi], l = lens[pi];
			for (let k = 1; k < p.length; k++) {
				if (d <= l[k]) {
					const t = (d - l[k - 1]) / (l[k] - l[k - 1]);
					return [p[k - 1][0] + (p[k][0] - p[k - 1][0]) * t, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * t];
				}
			}
			return [CASTLE_X, CASTLE_Y];
		};
		const roadDist = (x: number, y: number): number => {
			let best = 99999;
			pts.forEach((p) => {
				for (let k = 0; k < p.length - 1; k++) {
					const ax = p[k][0], ay = p[k][1], bx = p[k + 1][0], by = p[k + 1][1];
					const L = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
					const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L));
					best = Math.min(best, dist(x, y, ax + t * (bx - ax), ay + t * (by - ay)));
				}
			});
			return best;
		};

		// ======== 画面 ========
		scene.append(new g.Sprite({ scene, src: img("bg") }));
		const world = new g.E({ scene });
		scene.append(world);
		const castle = new g.Sprite({
			scene, src: img("castle"), x: CASTLE_X, y: CASTLE_Y + 70, anchorX: 0.5, anchorY: 0.9, scaleX: 0.8, scaleY: 0.8
		});
		world.append(castle);
		const fxLayer = new g.E({ scene });
		scene.append(fxLayer);
		const ui = new g.E({ scene });
		scene.append(ui);

		const font = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = font("#ffffff", "#3a2416");
		const fontY = font("#ffe040", "#3a2416");
		const fontR = font("#ff5a5a", "#ffffff");
		const fontInk = font("#3a2416", "#ffffff", 4);
		type Align = "left" | "center" | "right";
		const label = (
			parent: g.E, f: g.Font, size: number, x: number, y: number, text: string, align: Align = "left", w = 600
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
		// お城のHPバー
		const hpBack = new g.FilledRect({ scene, cssColor: "#3a2416", x: CASTLE_X - 62, y: CASTLE_Y + 78, width: 124, height: 14 });
		const hpBar = new g.FilledRect({ scene, cssColor: "#5ad04a", x: CASTLE_X - 60, y: CASTLE_Y + 80, width: 120, height: 10 });
		ui.append(hpBack); ui.append(hpBar);
		// 上の表示
		ui.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,14,0.55)", width: W, height: 58 }));
		const scoreLabel = label(ui, fontW, 40, 20, 9, "スコア 0");
		const timeLabel = label(ui, fontW, 40, W - 20, 9, "", "right");
		const infoLabel = label(ui, fontY, 36, W / 2, 11, "", "center", 700);

		// ふわっと出る文字・こうか
		const fxs: Fx[] = [];
		const pop = (t: string, f: g.Font, size: number, x: number, y: number): void => {
			const l = label(fxLayer, f, size, x, y, t, "center", 400);
			fxs.push({ spr: l, life: 1, max: 1, grow: 0, base: 1, vy: -50 });
		};
		const burst = (id: string, x: number, y: number, size: number, life: number): void => {
			const a = img(id);
			const s = new g.Sprite({ scene, src: a, x, y, anchorX: 0.5, anchorY: 0.5 });
			const base = size / a.width;
			s.scale(base * 0.3);
			fxLayer.append(s);
			fxs.push({ spr: s, life, max: life, grow: 1, base, vy: 0 });
		};

		// ======== 状態 ========
		const playSec = Math.max(30, time - SETUP_SEC - END_SEC);
		let phase: "setup" | "battle" | "end" = "setup";
		let setupLeft = SETUP_SEC;
		let battleT = 0;
		let budget = BUDGET;
		let killPts = 0;
		let penalty = 0;
		let castleHp = CASTLE_HP;
		let breaks = 0;
		let castleShake = 0;
		const units: Unit[] = [];
		const enemies: Enemy[] = [];
		const shots: Shot[] = [];
		let selected = 0;
		let introOn = true; // はじめの説明が出ている
		const score = (): number => Math.max(0, killPts - penalty);
		g.game.vars.detail = { kill: 0, penalty: 0 };
		const updateScore = (): void => {
			g.game.vars.gameState.score = score();
			g.game.vars.detail = { kill: killPts, penalty };
			setText(scoreLabel, "スコア " + score());
		};

		// ======== 配置のパレット ========
		const palette = new g.E({ scene, y: 606 });
		ui.append(palette);
		palette.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,14,0.6)", width: W, height: 114 }));
		const cards: { bg: g.Sprite; on: g.Sprite; cost: g.Label; e: g.E }[] = [];
		UNITS.forEach((u, i) => {
			const e = new g.E({ scene, x: 150 + i * 160, y: 6, width: 150, height: 104, touchable: true });
			const bg = new g.Sprite({ scene, src: img("card") });
			const on = new g.Sprite({ scene, src: img("card_on") });
			on.hide();
			e.append(bg); e.append(on);
			e.append(new g.Sprite({ scene, src: img("u_" + u.kind), x: -4, y: 12, scaleX: 0.78, scaleY: 0.78 }));
			label(e, fontInk, u.name.length > 3 ? 19 : 23, 108, 16, u.name, "center", 80);
			const cost = label(e, fontR, 30, 108, 52, u.cost + "pt", "center", 80);
			e.onPointDown.add(() => {
				if (phase !== "setup") return;
				selected = i;
				se("cancel", 0.3);
				refreshCards();
			});
			palette.append(e);
			cards.push({ bg, on, cost, e });
		});
		const budgetLabel = label(palette, fontY, 30, 1090, 16, "", "center", 200);
		label(palette, fontW, 20, 1090, 56, "草の上をタップで配置", "center", 260);
		label(palette, fontW, 20, 1090, 82, "置いた動物をタップで戻す", "center", 260);
		const descLabel = label(palette, fontW, 22, 20, -34, "", "left", 900);
		const refreshCards = (): void => {
			cards.forEach((c, i) => {
				if (i === selected) c.on.show(); else c.on.hide();
				c.e.opacity = UNITS[i].cost <= budget ? 1 : 0.45;
				c.e.modified();
			});
			setText(budgetLabel, "のこり " + budget + "pt");
			const u = UNITS[selected];
			setText(descLabel, u.name + "(" + u.cost + "pt): " + u.desc);
		};
		refreshCards();
		// スタートボタン
		const startBtn = new g.E({ scene, x: W - 230, y: 70, width: 210, height: 62, touchable: true });
		startBtn.append(new g.FilledRect({ scene, cssColor: "#3a2416", width: 210, height: 62 }));
		startBtn.append(new g.FilledRect({ scene, cssColor: "#ff7a4a", x: 4, y: 4, width: 202, height: 54 }));
		label(startBtn, fontW, 30, 105, 13, "じゅんびOK!", "center", 210);
		ui.append(startBtn);
		// 置ける範囲を見せる輪
		const preview = new g.Sprite({ scene, src: img("ring"), anchorX: 0.5, anchorY: 0.5 });
		preview.hide();
		fxLayer.append(preview);

		// ======== 動物を置く・戻す ========
		const canPlace = (x: number, y: number): boolean => {
			if (y < FIELD_TOP || y > FIELD_BOTTOM || x < 30 || x > W - 30) return false;
			if (roadDist(x, y) < ROAD_KEEP) return false;
			const dx = (x - CASTLE_X) / 150, dy = (y - CASTLE_Y - 20) / 105;
			if (dx * dx + dy * dy < 1) return false;
			for (let i = 0; i < units.length; i++) if (dist(x, y, units[i].x, units[i].y) < UNIT_GAP) return false;
			return true;
		};
		const showRing = (id: string, x: number, y: number, r: number): void => {
			preview.src = img(id); preview.invalidate();
			preview.x = x; preview.y = y; preview.scaleX = preview.scaleY = r / 100; preview.opacity = 1;
			preview.show(); preview.modified();
		};
		const place = (x: number, y: number): void => {
			const def = UNITS[selected];
			if (def.cost > budget) {
				se("ng", 0.5); pop("ポイントがたりない", fontR, 28, x, y - 60); return;
			}
			if (!canPlace(x, y)) {
				se("ng", 0.5); showRing("ring_ng", x, y, 40); return;
			}
			budget -= def.cost;
			const spr = new g.Sprite({
				scene, src: img("u_" + def.kind), x, y: y + 30, anchorX: 0.5, anchorY: 0.92, scaleX: 0.8, scaleY: 0.8
			});
			world.append(spr);
			units.push({ def, x, y, cool: rand() * def.rate, spr, bounce: 0.3 });
			se("place", 0.6);
			showRing("ring", x, y, def.range);
			burst("star", x, y - 20, 40, 0.4);
			refreshCards();
		};
		scene.onPointDownCapture.add((ev) => {
			if (phase !== "setup" || introOn) return;
			const x = ev.point.x, y = ev.point.y;
			if (y >= 606 || (x > W - 240 && y > 60 && y < 140)) return; // パレットとボタン
			// 置いた動物をタップしたら戻す
			for (let i = units.length - 1; i >= 0; i--) {
				const u = units[i];
				if (Math.abs(x - u.x) < 36 && y > u.y - 50 && y < u.y + 30) {
					budget += u.def.cost;
					u.spr.destroy();
					units.splice(i, 1);
					se("cancel", 0.6);
					refreshCards();
					return;
				}
			}
			place(x, y);
		});

		// ======== はじめの説明 ========
		const intro = new g.E({ scene, width: W, height: 606 });
		ui.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(30,20,10,0.55)", width: W, height: 606 }));
		intro.append(new g.Sprite({ scene, src: img("logo"), x: 330, y: 300, anchorX: 0.5, anchorY: 0.5, scaleX: 0.95, scaleY: 0.95 }));
		const rules = [
			"① 20びょうで、どうぶつを道のそばに配置！",
			"　 100ptまで。強い子ほどポイントが高い",
			"② 道から来る敵を、どうぶつが自動でこうげき",
			"③ 敵をたおすとポイントゲット！",
			"④ お城をこうげきされるとマイナス…"
		];
		rules.forEach((t, i) => label(intro, i === 4 ? fontR : fontW, 30, 590, 150 + i * 62, t, "left", 690));
		label(intro, fontY, 28, 590, 470, "画面をタップしてはじめる", "left", 690);
		const closeIntro = (): void => {
			if (!introOn) return;
			introOn = false;
			intro.destroy();
		};
		intro.touchable = true;
		intro.onPointDown.add(closeIntro);

		// ======== 戦いスタート ========
		const startBattle = (): void => {
			if (phase !== "setup") return;
			closeIntro();
			phase = "battle";
			palette.hide();
			startBtn.hide();
			preview.hide();
			se("go", 0.7);
			pop("たたかい開始！", fontY, 72, W / 2, 230);
			g.game.audio.music.play(scene.asset.getAudioById("bgm"));
		};
		startBtn.onPointDown.add(startBattle);

		// ======== 敵 ========
		const spawn = (kind: EnemyKind, path: number): void => {
			const def = ENEMIES[kind];
			const mul = 1 + Math.min(1, battleT / playSec) * 0.8;
			const e = new g.E({ scene });
			const a = img("e_" + kind);
			const spr = new g.Sprite({ scene, src: a, anchorX: 0.5, anchorY: 0.92, scaleX: def.scale, scaleY: def.scale });
			e.append(spr);
			const bw = 50 * def.scale + 10;
			const barY = -a.height * def.scale;
			e.append(new g.FilledRect({ scene, cssColor: "#3a2416", x: -bw / 2 - 2, y: barY - 8, width: bw + 4, height: 9 }));
			const bar = new g.FilledRect({ scene, cssColor: "#ff4a4a", x: -bw / 2, y: barY - 6, width: bw, height: 5 });
			e.append(bar);
			world.append(e);
			const hp = Math.round(def.hp * mul);
			enemies.push({ def, path, d: 0, hp, maxHp: hp, x: -999, y: -999, slow: 0, flash: 0, e, spr, bar, dead: false,
				stop: lens[path][lens[path].length - 1] - CASTLE_R - rand() * 45, atk: 0.4, lunge: 0 });
		};
		let spawnLeft = 1.5;
		const bossTimes = [0.38, 0.68, 0.9];
		let bossIdx = 0;
		const pickKind = (p: number): EnemyKind => {
			const r = rand();
			if (p < 0.15) return r < 0.75 ? "slime" : "goblin";
			if (p < 0.35) return r < 0.45 ? "slime" : r < 0.85 ? "goblin" : "devil";
			if (p < 0.6) return r < 0.3 ? "slime" : r < 0.6 ? "goblin" : r < 0.85 ? "devil" : "witch";
			return r < 0.2 ? "slime" : r < 0.45 ? "goblin" : r < 0.7 ? "devil" : "witch";
		};
		const kill = (en: Enemy): void => {
			if (en.dead) return;
			en.dead = true;
			killPts += en.def.pts;
			updateScore();
			se("poof", 0.4);
			burst("poof", en.x, en.y - 20, 90 * en.def.scale, 0.45);
			pop("+" + en.def.pts, fontY, en.def.kind === "ogre" ? 48 : 30, en.x, en.y - 90);
			en.e.destroy();
		};
		const damage = (en: Enemy, dmg: number): void => {
			if (en.dead) return;
			en.hp -= dmg;
			en.flash = 0.12;
			if (en.hp <= 0) kill(en);
		};
		// お城に着いた敵は、そこに居すわってこうげきし続ける
		const hitCastle = (en: Enemy): void => {
			en.lunge = 0.25;
			castleHp -= en.def.dmg;
			penalty += en.def.dmg * HIT_PENALTY;
			castleShake = 0.3;
			se("castle", 0.6);
			pop("-" + en.def.dmg * HIT_PENALTY, fontR, 30, en.x, en.y - 80);
			if (castleHp <= 0) {
				breaks++;
				penalty += BREAK_PENALTY;
				castleHp = CASTLE_HP;
				castleShake = 1;
				se("break", 0.8);
				pop("お城がこわれた！ -" + BREAK_PENALTY, fontR, 52, CASTLE_X, CASTLE_Y - 190);
				for (let k = 0; k < 5; k++) burst("poof", CASTLE_X + (rand() - 0.5) * 200, CASTLE_Y + (rand() - 0.5) * 120, 120, 0.8);
			}
			updateScore();
		};

		// ======== こうげき ========
		const inRange = (u: Unit): Enemy[] => {
			const res: Enemy[] = [];
			enemies.forEach((en) => {
				const onScreen = en.x > -50 && en.x < W + 50 && en.y > -50 && en.y < H + 50;
				if (!en.dead && onScreen && dist(u.x, u.y, en.x, en.y - 20) <= u.def.range) res.push(en);
			});
			// お城に近い(道を進んだ)順
			res.sort((a, b) => (b.d / lens[b.path][lens[b.path].length - 1]) - (a.d / lens[a.path][lens[a.path].length - 1]));
			return res;
		};
		const shoot = (kind: string, u: Unit, target: Enemy, dmg: number, dur: number): void => {
			const a = img(kind);
			const spr = new g.Sprite({ scene, src: a, x: u.x, y: u.y - 30, anchorX: 0.5, anchorY: 0.5 });
			fxLayer.append(spr);
			shots.push({ kind, x: u.x, y: u.y - 30, tx: target.x, ty: target.y - 20, target, dmg, spr, t: 0, dur, sx: u.x, sy: u.y - 30 });
		};
		const attack = (u: Unit): boolean => {
			const list = inRange(u);
			if (list.length === 0) return false;
			const k = u.def.kind;
			if (k === "chick") {
				shoot("p_pea", u, list[0], u.def.dmg, 0.18); se("pea", 0.25);
			} else if (k === "rabbit") {
				shoot("p_carrot", u, list[0], u.def.dmg, 0.25); se("carrot", 0.3);
			} else if (k === "penguin") {
				for (let i = 0; i < Math.min(3, list.length); i++) shoot("p_ice", u, list[i], u.def.dmg, 0.22);
				se("ice", 0.35);
			} else if (k === "elephant") {
				shoot("p_water", u, list[0], u.def.dmg, 0.45); se("splash", 0.25);
			} else {
				list.forEach((en) => damage(en, u.def.dmg));
				burst("roar", u.x, u.y - 20, u.def.range * 2, 0.4);
				se("roar", 0.45);
			}
			return true;
		};

		// ======== おしまい ========
		let finished = false;
		const finish = (): void => {
			if (finished) return;
			finished = true;
			phase = "end";
			g.game.vars.gameState.score = score();
			se("finish", 0.7);
			const over = new g.E({ scene });
			ui.append(over);
			over.append(new g.FilledRect({ scene, cssColor: "rgba(30,20,10,0.6)", width: W, height: H }));
			over.append(new g.FilledRect({ scene, cssColor: "#3a2416", x: 330, y: 150, width: 620, height: 400 }));
			over.append(new g.FilledRect({ scene, cssColor: "#fff8e8", x: 338, y: 158, width: 604, height: 384 }));
			label(over, fontY, 64, W / 2, 180, breaks > 0 ? "おしまい！" : "まもりきった！", "center", 600);
			label(over, fontInk, 34, 380, 290, "たおしたポイント", "left", 500);
			label(over, fontInk, 34, 900, 290, "+" + killPts, "right", 300);
			label(over, fontInk, 34, 380, 350, "お城のダメージ", "left", 500);
			if (breaks > 0) label(over, fontR, 22, 640, 358, "(こわれた×" + breaks + ")", "left", 200);
			label(over, fontR, 34, 900, 350, "-" + penalty, "right", 300);
			over.append(new g.FilledRect({ scene, cssColor: "#3a2416", x: 380, y: 410, width: 520, height: 4 }));
			label(over, fontY, 56, W / 2, 440, "スコア " + score(), "center", 600);
		};

		// ======== 毎フレーム ========
		let lastCount = -1;
		scene.onUpdate.add(() => {
			if (phase === "setup") {
				setupLeft -= dt;
				const n = Math.ceil(setupLeft);
				setText(infoLabel, "配置タイム  のこり" + Math.max(0, n) + "びょう");
				if (n !== lastCount && n <= 3 && n > 0) {
					se("beep", 0.5); lastCount = n;
				}
				if (setupLeft <= 0) startBattle();
				if (preview.visible()) {
					preview.opacity = Math.max(0, preview.opacity - dt * 0.8); preview.modified();
				}
			} else if (phase === "battle") {
				battleT += dt;
				const p = battleT / playSec;
				setText(infoLabel, "");
				// 敵を出す(だんだん多く)
				spawnLeft -= dt;
				if (spawnLeft <= 0 && p < 0.97) {
					spawn(pickKind(p), Math.floor(rand() * PATHS.length));
					if (p > 0.6 && rand() < 0.2) spawn(pickKind(p), Math.floor(rand() * PATHS.length));
					spawnLeft = 1.6 - 0.95 * Math.min(1, p);
				}
				if (bossIdx < bossTimes.length && p >= bossTimes[bossIdx]) {
					bossIdx++;
					spawn("ogre", Math.floor(rand() * PATHS.length));
					pop("ボスのオーガが来た！", fontR, 44, W / 2, 150);
				}
				if (battleT >= playSec) finish();
			}
			const left = phase === "setup" ? playSec : Math.max(0, Math.ceil(playSec - battleT));
			setText(timeLabel, "のこり " + left);
			// 敵の移動
			for (let i = enemies.length - 1; i >= 0; i--) {
				const en = enemies[i];
				if (en.dead) {
					enemies.splice(i, 1); continue;
				}
				if (phase === "battle") {
					en.d += en.def.speed * (en.slow > 0 ? 0.45 : 1) * dt;
					if (en.slow > 0) en.slow -= dt;
				}
				const q = posAt(en.path, en.d);
				en.x = q[0]; en.y = q[1];
				if (en.d >= en.stop) {
					en.d = en.stop;
					if (phase === "battle") {
						en.atk -= dt;
						if (en.atk <= 0) {
							en.atk = ATTACK_SEC; hitCastle(en);
						}
					}
				}
				if (en.lunge > 0) {
					// お城に向かってとびかかる
					en.lunge -= dt;
					const k = Math.sin(Math.max(0, en.lunge) / 0.25 * Math.PI) * 14;
					const dx = CASTLE_X - en.x, dy = CASTLE_Y - en.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
					en.x += dx / l * k; en.y += dy / l * k;
				}
				en.e.x = en.x; en.e.y = en.y + Math.sin(battleT * 10 + i) * 2;
				en.e.modified();
				en.bar.width = Math.max(0, (50 * en.def.scale + 10) * en.hp / en.maxHp);
				en.bar.modified();
				if (en.flash > 0) {
					en.flash -= dt; en.spr.opacity = 0.5;
				} else en.spr.opacity = 1;
				en.spr.scaleX = en.def.scale * (en.slow > 0 ? 0.92 : 1);
				en.spr.modified();
			}
			// 動物のこうげき
			units.forEach((u) => {
				if (phase === "battle") {
					u.cool -= dt;
					if (u.cool <= 0) {
						if (attack(u)) {
							u.cool = u.def.rate; u.bounce = 0.2;
						} else u.cool = 0.1;
					}
				}
				if (u.bounce > 0) u.bounce -= dt;
				const s = 0.8 * (1 + Math.max(0, u.bounce) * 0.8);
				u.spr.scaleX = 0.8 * (1 + Math.max(0, u.bounce) * 0.3); u.spr.scaleY = s;
				u.spr.y = u.y + 30 + (phase === "setup" ? Math.sin(battleT * 4 + u.x) * 2 : 0);
				u.spr.modified();
			});
			// たま
			for (let i = shots.length - 1; i >= 0; i--) {
				const s = shots[i];
				s.t += dt;
				if (s.target && !s.target.dead) {
					s.tx = s.target.x; s.ty = s.target.y - 20;
				}
				const t = Math.min(1, s.t / s.dur);
				const arc = s.kind === "p_water" ? Math.sin(t * Math.PI) * 80 : 0;
				s.x = s.sx + (s.tx - s.sx) * t; s.y = s.sy + (s.ty - s.sy) * t - arc;
				s.spr.x = s.x; s.spr.y = s.y;
				if (s.kind === "p_carrot") s.spr.angle = Math.atan2(s.ty - s.sy, s.tx - s.sx) * 180 / Math.PI + 180;
				if (s.kind === "p_ice") s.spr.angle += 20;
				s.spr.modified();
				if (t >= 1) {
					if (s.kind === "p_water") {
						burst("splash", s.tx, s.ty, 140, 0.35);
						enemies.forEach((en) => {
							if (!en.dead && dist(en.x, en.y - 20, s.tx, s.ty) < 70) damage(en, s.dmg);
						});
					} else if (s.target && !s.target.dead) {
						if (s.kind === "p_ice") s.target.slow = 1.6;
						damage(s.target, s.dmg);
						se("hit", 0.15);
					}
					s.spr.destroy();
					shots.splice(i, 1);
				}
			}
			// お城
			hpBar.width = 120 * castleHp / CASTLE_HP;
			hpBar.cssColor = castleHp > CASTLE_HP * 0.5 ? "#5ad04a" : castleHp > CASTLE_HP * 0.25 ? "#f0c040" : "#ff4a4a";
			hpBar.modified();
			if (castleShake > 0) {
				castleShake -= dt;
				castle.x = CASTLE_X + Math.sin(castleShake * 60) * 8 * castleShake;
			} else castle.x = CASTLE_X;
			castle.modified();
			// 奥(上)から順に重ねる
			world.children!.sort((a, b) => a.y - b.y);
			world.modified();
			// こうか
			for (let i = fxs.length - 1; i >= 0; i--) {
				const f = fxs[i];
				f.life -= dt;
				const t = 1 - f.life / f.max;
				if (f.grow) {
					f.spr.scaleX = f.spr.scaleY = f.base * (0.3 + 0.7 * Math.min(1, t * 1.6));
					f.spr.opacity = Math.min(1, f.life / f.max * 2);
				} else {
					f.spr.y += f.vy * dt; f.spr.opacity = Math.min(1, f.life * 3);
				}
				f.spr.modified();
				if (f.life <= 0) {
					f.spr.destroy(); fxs.splice(i, 1);
				}
			}
		});
	});
	g.game.pushScene(scene);
}
