import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const H = 720;
const K = 1280; // 遠近の強さ(手前で 1u = 320px)
const D = 4; // カメラから自分までの距離(u)
const CAM_H = 1.7; // カメラの高さ(u)。板より少し低く、上から見下ろす
const FOOT_Y = 690; // 自分の足もとの高さ(画面)
const HOR = FOOT_Y - CAM_H * K / D; // 地平線の高さ
const UNIT = 320; // 絵の 320px = 1u
const ROAD = 1.2; // 道の半分の幅(u)
const MOVE = 0.8; // 自分が動ける範囲(u)
const Z_FAR = 40; // 板が出てくる遠さ(u)
const DRAG_RATE = 1 / 330; // 指を1px動かしたときの横移動(u)
const TAP_MOVE = 16; // これより動かなければタップ(px)
const TAP_SEC = 0.35;
const JUMP_V = 3.4; // ジャンプの初速(u/秒)
const GRAVITY = 9.4;
const TOL = 0.11; // 型からずれてもよい幅(u)
const PERFECT = 0.04; // ピッタリの幅(u)
const LOW_MAX = 0.15; // 地面の型: この高さより上だと頭をぶつける
const HIGH_MIN = 0.28; // 高い型: この高さより上でないと足をぶつける
const SPEED0 = 11; // 走る速さ(u/秒)
const SPEED1 = 20;
const GAP0 = 15; // 板と板の間(u)
const GAP1 = 9;
const PASS_PT = 100;
const PERFECT_PT = 100;
const COMBO_PT = 15; // 1れんぞくごとの上乗せ
const COMBO_MAX_PT = 300;
const INTRO_SEC = 5;
const END_SEC = 3;

type PanelKind = "ground" | "high" | "kid_l" | "kid_r";
interface Panel { z: number; x: number; base: number; kind: PanelKind; amp: number; ph: number; done: boolean; broken: boolean; }
interface Prop { z: number; x: number; id: string; }
interface Piece { x: number; y: number; vx: number; vy: number; s: number; rot: number; life: number; }
interface Stage { name: string; bg: string; top: string; road: string[]; side: string[]; edge: string; props: string[]; }
const STAGES: Stage[] = [
	{
		name: "ひるの住宅街", bg: "bg_day", top: "#3878e8", road: ["#a8a098", "#9c948c"], side: ["#68b850", "#5aa844"], edge: "#f8f8f0",
		props: ["pole", "house", "tree", "wall", "wall"]
	},
	{
		name: "夕やけの河原", bg: "bg_river", top: "#583890", road: ["#c8a070", "#bc9464"], side: ["#7aa848", "#6c983e"], edge: "#f8e8c8",
		props: ["susuki", "susuki", "sign", "tree", "pole"]
	},
	{
		name: "よるの商店街", bg: "bg_night", top: "#101838", road: ["#686078", "#605870"], side: ["#8a8098", "#7e748c"], edge: "#f8e070",
		props: ["shop", "lantern", "vending", "shop", "lantern"]
	}
];
// 板の絵の真ん中から見た、ほんとうの型(角刈り)の位置(u)
const HOLE_OFF: { [k: string]: number } = { ground: 0, high: 0, kid_r: -0.4, kid_l: 0.4 };

class View extends g.E {
	draw: (r: g.Renderer) => void = () => undefined;
	override renderSelf(r: g.Renderer): boolean {
		this.draw(r);
		return true;
	}
}

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"bg_day", "bg_river", "bg_night", "man_run0", "man_run1", "man_jump", "man_stand",
		"panel_ground", "panel_high", "panel_kid_l", "panel_kid_r", "piece", "shadow", "spark", "star",
		"pole", "wall", "house", "tree", "susuki", "sign", "lantern", "vending", "shop", "logo"
	];
	const audioIds = ["jump", "pass", "perfect", "crash", "beep", "go", "finish", "combo", "land"];
	const scene = new g.Scene({
		game: g.game,
		assetIds: imageIds.concat(audioIds.map((a) => "se_" + a), ["bgm"])
	});
	let time = 70;
	if (param.sessionParameter.totalTimeLimit) {
		time = param.sessionParameter.totalTimeLimit;
	}
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const rand = (): number => param.random.generate();
		const se = (id: string, vol = 0.8): void => {
			scene.asset.getAudioById("se_" + id).play().changeVolume(vol);
		};
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const surf: { [id: string]: g.Surface } = {};
		imageIds.forEach((id) => {
			surf[id] = g.SurfaceUtil.asSurface(img(id))!;
		});

		// ======== 状態 ========
		const playSec = Math.max(20, time - INTRO_SEC - END_SEC);
		let phase: "intro" | "play" | "end" = "intro";
		let elapsed = 0; // 走りはじめてからの秒
		let introLeft = INTRO_SEC;
		let dist = 0; // 走った距離(u)
		let speed = 0;
		let px = 0; // 自分の横の位置(u)
		let py = 0; // ジャンプの高さ(u)
		let vy = 0;
		let stun = 0; // ぶつかってふらふらしている秒
		let score = 0;
		let combo = 0;
		let nextGap = 6; // 次の板までの距離
		let panelCount = 0;
		let stage = 0;
		let stageFade = 1;
		let prevStage = 0;
		let shake = 0;
		let runAnim = 0;
		const panels: Panel[] = [];
		const props: Prop[] = [];
		const pieces: Piece[] = [];
		let propGap = 0;

		const scale = (z: number): number => K / (z + D);
		const groundY = (z: number): number => HOR + CAM_H * scale(z);
		const camX = (): number => px * 0.35;
		const screenX = (x: number, z: number): number => W / 2 + (x - camX()) * scale(z);

		// ======== 絵を描く ========
		const view = new View({ scene, width: W, height: H });
		scene.append(view);
		const drawBg = (r: g.Renderer, st: Stage, alpha: number): void => {
			r.save();
			if (alpha < 1) r.opacity(alpha);
			r.fillRect(0, 0, W, HOR, st.top);
			const a = img(st.bg);
			const off = -camX() * 60;
			let x0 = (((off % a.width) + a.width) % a.width) - a.width;
			while (x0 < W) {
				r.drawImage(surf[st.bg], 0, 0, a.width, a.height, x0, HOR + 8 - a.height);
				x0 += a.width;
			}
			r.restore();
		};
		const drawGround = (r: g.Renderer, st: Stage): void => {
			const step = 4;
			for (let y = HOR; y < H; y += step) {
				const s = (y + step / 2 - HOR) / CAM_H;
				const z = K / s - D;
				const band = Math.floor((z + dist) / 1.6) % 2 === 0 ? 0 : 1;
				r.fillRect(0, y, W, step, st.side[band]);
				const l = W / 2 + (-ROAD - camX()) * s, rr = W / 2 + (ROAD - camX()) * s;
				r.fillRect(l, y, rr - l, step, st.road[band]);
				const e = Math.max(1, 0.05 * s);
				r.fillRect(l - e, y, e, step, st.edge);
				r.fillRect(rr, y, e, step, st.edge);
			}
		};
		const drawSprite = (r: g.Renderer, id: string, x: number, z: number, alpha: number): void => {
			const a = img(id);
			const sc = scale(z) / UNIT;
			const sx = screenX(x, z);
			if (sx + a.width * sc / 2 < 0 || sx - a.width * sc / 2 > W) return;
			r.save();
			if (alpha < 1) r.opacity(alpha);
			r.transform([sc, 0, 0, sc, sx - a.width * sc / 2, groundY(z) - a.height * sc]);
			r.drawImage(surf[id], 0, 0, a.width, a.height, 0, 0);
			r.restore();
		};
		const drawPanel = (r: g.Renderer, p: Panel, alpha: number): void => {
			const id = "panel_" + p.kind;
			const sc = scale(p.z) / UNIT;
			// 板は道の幅だけ見せる。型の位置に合わせて絵を切りだす
			const srcX = Math.round(UNIT * (2 - ROAD - p.x));
			const srcW = UNIT * ROAD * 2;
			const h = img(id).height;
			r.save();
			if (alpha < 1) r.opacity(alpha);
			r.transform([sc, 0, 0, sc, screenX(-ROAD, p.z), groundY(p.z) - h * sc]);
			r.drawImage(surf[id], srcX, 0, srcW, h, 0, 0);
			r.restore();
		};
		const drawMan = (r: g.Renderer): void => {
			const sx = screenX(px, 0), gy = groundY(0);
			// 影
			const sh = img("shadow"), ss = Math.max(0.5, 1 - py * 0.6);
			r.save();
			r.opacity(0.9);
			r.transform([ss, 0, 0, ss, sx - sh.width * ss / 2, gy - sh.height * ss / 2]);
			r.drawImage(surf.shadow, 0, 0, sh.width, sh.height, 0, 0);
			r.restore();
			let id = "man_stand";
			const runId = Math.floor(runAnim) % 2 === 0 ? "man_run0" : "man_run1";
			if (phase === "play" || phase === "end") id = py > 0.02 ? "man_jump" : runId;
			if (stun > 0) id = "man_jump";
			const a = img(id);
			const bob = py <= 0.02 && phase === "play" ? Math.abs(Math.sin(runAnim * Math.PI)) * 8 : 0;
			r.save();
			if (stun > 0 && Math.floor(stun * 12) % 2 === 0) r.opacity(0.5);
			r.drawImage(surf[id], 0, 0, a.width, a.height, sx - a.width / 2, gy - a.height - py * UNIT - bob);
			r.restore();
			if (stun > 0) {
				// 頭のまわりをまわる星
				for (let k = 0; k < 3; k++) {
					const t = stun * 8 + k * 2.1;
					const st = img("star");
					r.drawImage(surf.star, 0, 0, st.width, st.height,
						sx + Math.cos(t) * 56 - st.width / 2, gy - a.height - py * UNIT - 10 + Math.sin(t) * 16);
				}
			}
		};
		view.draw = (r: g.Renderer): void => {
			r.save();
			if (shake > 0) r.translate(Math.sin(shake * 40) * shake * 30, 0);
			if (stageFade < 1) drawBg(r, STAGES[prevStage], 1);
			drawBg(r, STAGES[stage], stageFade);
			drawGround(r, STAGES[stage]);
			// 遠いものから順に
			type Item = { z: number; fn: () => void };
			const items: Item[] = [];
			props.forEach((p) => {
				items.push({ z: p.z, fn: () => drawSprite(r, p.id, p.x, p.z, p.z < 0 ? Math.max(0, 1 + p.z / 1.5) : 1) });
			});
			panels.forEach((p) => {
				if (p.broken) return;
				const alpha = p.z < 0 ? Math.max(0, 1 + p.z / 0.6) : Math.min(1, (Z_FAR - p.z) / 4);
				items.push({ z: p.z, fn: () => drawPanel(r, p, alpha) });
			});
			items.push({ z: 0.001, fn: () => drawMan(r) });
			items.sort((a, b) => b.z - a.z);
			items.forEach((it) => {
				if (it.z > -D + 0.6) it.fn();
			});
			// ダンボールのかけら
			const pc = img("piece");
			pieces.forEach((q) => {
				r.save();
				r.opacity(Math.min(1, q.life * 2));
				r.transform([q.s * Math.cos(q.rot), q.s * Math.sin(q.rot), -q.s * Math.sin(q.rot), q.s * Math.cos(q.rot), q.x, q.y]);
				r.drawImage(surf.piece, 0, 0, pc.width, pc.height, -pc.width / 2, -pc.height / 2);
				r.restore();
			});
			r.restore();
		};

		// ======== 文字 ========
		const font = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = font("#ffffff", "#201018");
		const fontY = font("#fff040", "#201018");
		const fontR = font("#ff5040", "#ffffff");
		const fontC = font("#60f0ff", "#201018");
		type Align = "left" | "center" | "right";
		const label = (f: g.Font, size: number, x: number, y: number, text: string, align: Align = "left"): g.Label => {
			const l = new g.Label({
				scene, font: f, fontSize: size, text, x, y, width: 600, textAlign: align, widthAutoAdjust: false
			});
			if (align === "center") l.x = x - 300;
			if (align === "right") l.x = x - 600;
			scene.append(l);
			return l;
		};
		const setText = (l: g.Label, t: string): void => {
			if (l.text !== t) {
				l.text = t; l.invalidate();
			}
		};
		const scoreLabel = label(fontW, 44, 24, 14, "0てん");
		const timeLabel = label(fontW, 44, W - 24, 14, "", "right");
		const comboLabel = label(fontY, 38, W / 2, 16, "", "center");
		// ふわっと出て消える文字
		interface Pop { l: g.Label; life: number; vy: number; }
		const pops: Pop[] = [];
		const popText = (t: string, f: g.Font, size: number, x: number, y: number): void => {
			const l = label(f, size, x, y, t, "center");
			pops.push({ l, life: 0.9, vy: -60 });
		};

		// ======== はじめの説明 ========
		const intro = new g.E({ scene });
		scene.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(16,8,24,0.55)", width: W, height: H }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: W / 2, y: 150, anchorX: 0.5, anchorY: 0.5 });
		intro.append(logo);
		const rule = (t: string, y: number, f: g.Font): void => {
			const l = new g.Label({
				scene, font: f, fontSize: 40, text: t, x: 0, y, width: W, textAlign: "center", widthAutoAdjust: false
			});
			intro.append(l);
		};
		rule("指を左右にスライドして、型の位置に合わせよう", 320, fontW);
		rule("高いところの型は、タップでジャンプ！", 380, fontY);
		rule("小さい子どもの型はダミー！自分の型を通れ", 440, fontC);
		rule("ピッタリ通ると高得点！れんぞくでボーナス", 500, fontW);
		const countLabel = new g.Label({
			scene, font: fontY, fontSize: 90, text: "", x: 0, y: 570, width: W, textAlign: "center", widthAutoAdjust: false
		});
		intro.append(countLabel);
		const stageLabel = label(fontC, 52, W / 2, 84, "", "center");
		let stageLabelLeft = 0;

		// ======== 操作 ========
		let down: { x: number; y: number; t: number; moved: number } | null = null;
		scene.onPointDownCapture.add((ev) => {
			down = { x: ev.point.x, y: ev.point.y, t: elapsed, moved: 0 };
		});
		scene.onPointMoveCapture.add((ev) => {
			if (!down) return;
			down.moved += Math.abs(ev.prevDelta.x) + Math.abs(ev.prevDelta.y);
			if (phase !== "play") return;
			px = Math.max(-MOVE, Math.min(MOVE, px + ev.prevDelta.x * DRAG_RATE));
		});
		scene.onPointUpCapture.add(() => {
			if (down && phase === "play" && down.moved < TAP_MOVE && elapsed - down.t < TAP_SEC && py <= 0.001 && stun <= 0) {
				vy = JUMP_V;
				py = 0.002;
				se("jump", 0.6);
			}
			down = null;
		});

		// ======== 板・道ばたの物を出す ========
		const progress = (): number => Math.min(1, elapsed / playSec);
		const spawnPanel = (): void => {
			const p = progress();
			panelCount++;
			let kind: PanelKind = "ground";
			const r = rand();
			if (panelCount > 2) {
				const high = 0.18 + 0.17 * p, kid = p > 0.2 ? 0.16 : 0;
				if (r < high) kind = "high";
				else if (r < high + kid) kind = rand() < 0.5 ? "kid_l" : "kid_r";
			}
			const lim = kind === "kid_l" || kind === "kid_r" ? 0.4 : 0.75;
			const base = (rand() * 2 - 1) * lim;
			// 後半は型が左右に動く
			const moving = kind === "ground" && p > 0.3 && rand() < 0.25 + 0.25 * p;
			const amp = moving ? Math.min(lim - Math.abs(base), 0.25 + 0.25 * rand()) : 0;
			panels.push({ z: Z_FAR, x: base, base, kind, amp, ph: rand() * Math.PI * 2, done: false, broken: false });
		};
		const spawnProp = (): void => {
			const st = STAGES[stage];
			const id = st.props[Math.floor(rand() * st.props.length)];
			const side = rand() < 0.5 ? -1 : 1;
			const x = id === "wall" ? side * (ROAD + 0.75) : side * (ROAD + 0.6 + rand() * 1.3 + img(id).width / UNIT / 2);
			props.push({ z: Z_FAR, x, id });
		};
		for (let z = 2; z < Z_FAR; z += 2.2) {
			spawnProp();
			props[props.length - 1].z = z;
		}

		// ======== 通れた/ぶつかった ========
		const judge = (p: Panel): void => {
			p.done = true;
			const hole = p.x + HOLE_OFF[p.kind];
			const dx = Math.abs(px - hole);
			const heightOk = p.kind === "high" ? py >= HIGH_MIN : py <= LOW_MAX;
			if (dx <= TOL && heightOk && stun <= 0) {
				combo++;
				let pts = PASS_PT + Math.min(COMBO_MAX_PT, (combo - 1) * COMBO_PT);
				const perfect = dx <= PERFECT;
				if (perfect) pts += PERFECT_PT;
				score += pts;
				g.game.vars.gameState.score = score;
				const sy = groundY(0) - 380 - py * UNIT;
				if (perfect) {
					se("perfect", 0.6);
					popText("ピッタリ！ +" + pts, fontY, 52, screenX(px, 0), sy);
					for (let k = 0; k < 8; k++) {
						const a = k / 8 * Math.PI * 2;
						sparks.push({ x: screenX(px, 0), y: sy + 120, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 0.5 });
					}
				} else {
					se("pass", 0.7);
					popText("スポッ！ +" + pts, fontW, 44, screenX(px, 0), sy);
				}
				if (combo > 0 && combo % 10 === 0) {
					se("combo", 0.6);
					popText(combo + "れんぞく！", fontC, 60, W / 2, 150);
				}
			} else {
				// ダンボールをつきやぶる
				p.broken = true;
				se("crash", 0.8);
				if (combo >= 5) popText("れんぞくがとぎれた…", fontR, 36, W / 2, 210);
				combo = 0;
				stun = 0.7;
				shake = 0.35;
				speed *= 0.55;
				const cx = screenX(px, 0), cy = groundY(0) - 200 - py * UNIT;
				popText("バリッ！", fontR, 70, cx, cy - 260);
				for (let k = 0; k < 16; k++) {
					pieces.push({
						x: cx + (rand() - 0.5) * 500, y: cy + (rand() - 0.5) * 360, vx: (rand() - 0.5) * 900, vy: -200 - rand() * 500,
						s: 0.7 + rand() * 0.8, rot: rand() * 6, life: 0.8 + rand() * 0.4
					});
				}
			}
		};
		interface Spark { x: number; y: number; vx: number; vy: number; life: number; }
		const sparks: Spark[] = [];
		const sparkLayer = new View({ scene, width: W, height: H });
		scene.insertBefore(sparkLayer, scoreLabel);
		sparkLayer.draw = (r: g.Renderer): void => {
			const a = img("spark");
			sparks.forEach((s) => {
				r.save();
				r.opacity(Math.min(1, s.life * 3));
				r.drawImage(surf.spark, 0, 0, a.width, a.height, s.x - a.width / 2, s.y - a.height / 2);
				r.restore();
			});
		};

		// ======== おしまい ========
		let finished = false;
		const finish = (): void => {
			if (finished) return;
			finished = true;
			phase = "end";
			g.game.vars.gameState.score = score;
			se("finish", 0.7);
			const over = new g.FilledRect({ scene, cssColor: "rgba(16,8,24,0.5)", width: W, height: H });
			scene.append(over);
			label(fontY, 96, W / 2, 230, "おしまい！", "center");
			label(fontW, 64, W / 2, 360, score + "てん", "center");
		};

		// ======== 毎フレーム ========
		const bgm = scene.asset.getAudioById("bgm");
		let lastCount = -1;
		scene.onUpdate.add(() => {
			if (phase === "intro") {
				introLeft -= dt;
				const n = Math.ceil(introLeft);
				if (n !== lastCount && n <= 3 && n > 0) {
					se("beep", 0.5); lastCount = n;
				}
				countLabel.text = n <= 3 && n > 0 ? String(n) : "";
				countLabel.invalidate();
				if (introLeft <= 0) {
					phase = "play";
					intro.destroy();
					se("go", 0.6);
					popText("スタート！", fontY, 80, W / 2, 260);
					g.game.audio.music.play(bgm);
				}
			} else if (phase === "play") {
				elapsed += dt;
				if (elapsed >= playSec) finish();
			}
			const playing = phase === "play";
			// 速さ
			const target = playing ? SPEED0 + (SPEED1 - SPEED0) * progress() : phase === "end" ? 0 : 0;
			speed += (target - speed) * Math.min(1, dt * (stun > 0 ? 0.8 : 2));
			const move = speed * dt;
			dist += move;
			runAnim += speed * dt * 0.55;
			// ジャンプ
			if (py > 0) {
				py += vy * dt;
				vy -= GRAVITY * dt;
				if (py <= 0) {
					py = 0; vy = 0; se("land", 0.4);
				}
			}
			if (stun > 0) stun -= dt;
			if (shake > 0) shake = Math.max(0, shake - dt);
			// 面がかわる
			const st = Math.min(STAGES.length - 1, Math.floor(progress() * STAGES.length));
			if (st !== stage && playing) {
				prevStage = stage;
				stage = st;
				stageFade = 0;
				setText(stageLabel, STAGES[stage].name);
				stageLabelLeft = 2;
			}
			if (stageFade < 1) stageFade = Math.min(1, stageFade + dt);
			if (stageLabelLeft > 0) {
				stageLabelLeft -= dt;
				stageLabel.opacity = Math.min(1, stageLabelLeft);
				stageLabel.modified();
				if (stageLabelLeft <= 0) setText(stageLabel, "");
			}
			// 板
			if (playing) {
				nextGap -= move;
				if (nextGap <= 0 && elapsed < playSec - 1.5) {
					spawnPanel();
					nextGap = GAP0 + (GAP1 - GAP0) * progress();
				}
			}
			for (let i = panels.length - 1; i >= 0; i--) {
				const p = panels[i];
				p.z -= move;
				if (p.amp > 0) p.x = p.base + Math.sin(p.ph + elapsed * 2.2) * p.amp;
				if (!p.done && p.z <= 0 && playing) judge(p);
				if (p.z < -D + 0.5) panels.splice(i, 1);
			}
			// 道ばたの物
			propGap -= move;
			if (propGap <= 0) {
				spawnProp(); propGap = 1.6 + rand() * 1.4;
			}
			for (let i = props.length - 1; i >= 0; i--) {
				props[i].z -= move;
				if (props[i].z < -D + 0.5) props.splice(i, 1);
			}
			// かけら・キラキラ・文字
			for (let i = pieces.length - 1; i >= 0; i--) {
				const q = pieces[i];
				q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 1400 * dt; q.rot += dt * 8; q.s += dt * 0.8; q.life -= dt;
				if (q.life <= 0) pieces.splice(i, 1);
			}
			for (let i = sparks.length - 1; i >= 0; i--) {
				const s = sparks[i];
				s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.92; s.vy *= 0.92; s.life -= dt;
				if (s.life <= 0) sparks.splice(i, 1);
			}
			sparkLayer.modified();
			for (let i = pops.length - 1; i >= 0; i--) {
				const pp = pops[i];
				pp.life -= dt;
				pp.l.y += pp.vy * dt;
				pp.l.opacity = Math.min(1, pp.life * 3);
				pp.l.modified();
				if (pp.life <= 0) {
					pp.l.destroy(); pops.splice(i, 1);
				}
			}
			// 表示
			setText(scoreLabel, score + "てん");
			const left = Math.max(0, Math.ceil(playSec - elapsed));
			setText(timeLabel, "のこり " + left);
			setText(comboLabel, combo >= 2 ? combo + "れんぞく" : "");
			view.modified();
		});
	});
	g.game.pushScene(scene);
}
