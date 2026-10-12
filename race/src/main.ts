import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const CY = 330; // 地平線の高さ
const YS = 360; // 縦方向の広がり
const SEG = 200; // 道の1区切りの長さ
const ROAD = 1500; // 道の半分の幅
const CAM_H = 1200; // カメラの高さ
const DEPTH = 0.84; // 視野の広さ(1 / tan(画角/2))
const PLAYER_Z = CAM_H * DEPTH; // カメラから車までの距離
const DRAW = 140; // 何区切り先まで描くか
const N_SEG = 6500; // コースの長さ(区切りの数)
const MAX_SPEED = 10000;
const BOOST_SPEED = 15000;
const OFFROAD_SPEED = 3500;
const ACCEL = 5000;
const CENTRIFUGAL = 0.08; // カーブで外へ押される強さ
const DRAG_RATE = 1 / 450; // 指を1px動かしたときの横移動
const PLAYER_HALF = 0.19; // 自分の車の半分の幅(道の半分の幅=1)
const CAR_W = 300; // 自分の車の絵の幅
const INTRO_SEC = 5;
const END_SEC = 2;
const BOOST_SEC = 2.5;
const COIN_PT = 100;
const GEM_PT = 1000;

type Kind = "coin" | "gem" | "boost" | "hit" | "deco";
interface Obj { id: string; off: number; size: number; kind: Kind; taken: boolean; }
interface Seg { i: number; curve: number; y1: number; y2: number; objs: Obj[]; }
interface Rival { z: number; off: number; speed: number; id: string; }

class RoadView extends g.E {
	draw: (r: g.Renderer) => void = () => undefined;
	override renderSelf(r: g.Renderer): boolean {
		this.draw(r);
		return true;
	}
}

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"sky", "mountains", "hills", "car", "car_l", "car_r", "rival_a", "rival_b", "rival_c", "coin", "gem", "boost", "cone", "rock",
		"barrier", "tree", "pine", "bush", "house", "windmill", "flowers", "sign_l", "sign_r", "billboard", "gate", "spark", "dust", "logo"
	];
	const scene = new g.Scene({
		game: g.game,
		assetIds: imageIds.concat(["se_coin", "se_gem", "se_boost", "se_crash", "se_beep", "se_go", "se_finish", "se_combo", "bgm"])
	});
	let time = 80;
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

		// ======== コースを作る(みんな同じコース) ========
		const segs: Seg[] = [];
		let lastY = 0;
		const addSeg = (curve: number, y: number): void => {
			segs.push({ i: segs.length, curve, y1: lastY, y2: y, objs: [] });
			lastY = y;
		};
		const easeIn = (a: number, b: number, p: number): number => a + (b - a) * p * p;
		const easeInOut = (a: number, b: number, p: number): number => a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);
		const addRoad = (enter: number, hold: number, leave: number, curve: number, height: number): void => {
			const startY = lastY;
			const endY = startY + height * SEG;
			const total = enter + hold + leave;
			for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
			for (let n = 0; n < hold; n++) addSeg(curve, easeInOut(startY, endY, (enter + n) / total));
			for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
		};
		addRoad(0, 60, 0, 0, 0);
		while (segs.length < N_SEG - 120) {
			const kind = Math.floor(rand() * 6);
			const dir = rand() < 0.5 ? -1 : 1;
			const len = 20 + Math.floor(rand() * 30);
			const hill = Math.round((rand() - 0.5) * 24);
			if (kind === 0) addRoad(10, len, 10, 0, hill);
			else if (kind === 1) addRoad(15, len, 15, dir * (2 + rand() * 2), 0);
			else if (kind === 2) addRoad(15, len, 15, dir * (4 + rand() * 2), hill);
			else if (kind === 3) {
				// S字カーブ
				addRoad(12, 18, 12, dir * 3, 0);
				addRoad(12, 18, 12, -dir * 3, hill);
			} else if (kind === 4) {
				// 小さな坂の連続
				for (let k = 0; k < 3; k++) addRoad(10, 10, 10, 0, k % 2 ? -9 : 9);
			} else addRoad(20, len, 20, dir * 1.5, hill);
		}
		addRoad(30, 60, 30, 0, -lastY / SEG);
		const trackLen = segs.length * SEG;

		// ---- コインやじゃまものを置く ----
		const LANES = [-0.62, 0, 0.62];
		const put = (si: number, o: Obj): void => {
			if (si < segs.length) segs[si].objs.push(o);
		};
		const coin = (si: number, off: number): void => put(si, { id: "coin", off, size: 0.24, kind: "coin", taken: false });
		let si = 70;
		let lastGem = 0;
		while (si < segs.length - 140) {
			const pat = Math.floor(rand() * 8);
			const lane = Math.floor(rand() * 3);
			if (pat === 0) {
				// まっすぐの列
				for (let k = 0; k < 10; k++) coin(si + k * 3, LANES[lane]);
				si += 30;
			} else if (pat === 1) {
				// くねくね
				const ph = rand() * 6;
				for (let k = 0; k < 14; k++) coin(si + k * 3, Math.sin(ph + k * 0.45) * 0.62);
				si += 42;
			} else if (pat === 2) {
				// コーンのすき間をぬける
				const open = lane;
				for (let l = 0; l < 3; l++) {
					if (l === open) for (let k = 0; k < 5; k++) coin(si - 6 + k * 3, LANES[l]);
					else put(si, { id: "cone", off: LANES[l], size: 0.2, kind: "hit", taken: false });
				}
				si += 20;
			} else if (pat === 3) {
				// 岩のうしろの宝石(取れたら大きい)
				put(si, { id: "rock", off: LANES[lane], size: 0.42, kind: "hit", taken: false });
				const side = LANES[(lane + 1 + Math.floor(rand() * 2)) % 3];
				for (let k = 0; k < 4; k++) coin(si - 12 + k * 3, side);
				if (si - lastGem > 200) {
					put(si + 10, { id: "gem", off: LANES[lane], size: 0.28, kind: "gem", taken: false });
					lastGem = si;
				}
				si += 26;
			} else if (pat === 4) {
				// 加速パネルとその先のコイン
				put(si, { id: "boost", off: LANES[lane], size: 0.5, kind: "boost", taken: false });
				for (let k = 0; k < 12; k++) coin(si + 8 + k * 3, LANES[lane]);
				si += 50;
			} else if (pat === 5) {
				// さくで道の半分がふさがっている
				const left = rand() < 0.5;
				put(si, { id: "barrier", off: left ? -0.45 : 0.45, size: 0.95, kind: "hit", taken: false });
				for (let k = 0; k < 6; k++) coin(si - 6 + k * 3, left ? 0.62 : -0.62);
				si += 22;
			} else if (pat === 6) {
				// 道をよこぎる弧
				for (let k = 0; k < 9; k++) coin(si + k * 2, (lane === 0 ? -1 : 1) * (0.7 - k * 0.175));
				si += 24;
			} else {
				// 2列ならび
				for (let k = 0; k < 8; k++) {
					coin(si + k * 3, LANES[lane]);
					coin(si + k * 3, LANES[(lane + 1) % 3]);
				}
				si += 30;
			}
			si += 10 + Math.floor(rand() * 12);
		}
		// ---- 道ばたの景色 ----
		put(12, { id: "gate", off: 0, size: 2.9, kind: "deco", taken: false });
		const decos = ["tree", "tree", "pine", "bush", "house", "windmill", "flowers", "pine", "tree", "billboard"];
		const decoSize: { [id: string]: number } = {
			tree: 1.0, pine: 0.75, bush: 0.6, house: 1.3, windmill: 1.2, flowers: 0.7, billboard: 1.2, sign_l: 0.5, sign_r: 0.5
		};
		for (let k = 20; k < segs.length; k += 4 + Math.floor(rand() * 4)) {
			const side = rand() < 0.5 ? -1 : 1;
			const id = decos[Math.floor(rand() * decos.length)];
			const far = id === "house" || id === "windmill" ? 0.8 : 0;
			put(k, { id, off: side * (1.5 + rand() * 1.6 + far), size: decoSize[id], kind: "deco", taken: false });
			if (rand() < 0.5) put(k + 2, { id: "tree", off: -side * (1.4 + rand() * 2), size: 1.0, kind: "deco", taken: false });
		}
		// きついカーブの手前に矢印の看板
		for (let k = 30; k < segs.length; k += 8) {
			const c = segs[k].curve;
			if (Math.abs(c) > 3) {
				put(k, { id: c > 0 ? "sign_r" : "sign_l", off: c > 0 ? 1.3 : -1.3, size: 0.5, kind: "deco", taken: false });
			}
		}
		// ---- ほかの車 ----
		const rivals: Rival[] = [];
		for (let k = 150; k < segs.length - 200; k += 45 + Math.floor(rand() * 40)) {
			const id = ["rival_a", "rival_b", "rival_c"][Math.floor(rand() * 3)];
			rivals.push({ z: k * SEG, off: LANES[Math.floor(rand() * 3)], speed: MAX_SPEED * (0.35 + rand() * 0.2), id });
		}

		// ======== 状態 ========
		let phase: "intro" | "race" | "end" = "intro";
		let elapsed = 0;
		let raceLeft = Math.max(20, time - INTRO_SEC - END_SEC);
		let position = 0;
		let speed = 0;
		let playerX = 0;
		let steer = 0; // 車のかたむき(-1〜1)
		let boostLeft = 0;
		let hurtLeft = 0;
		let score = 0;
		let combo = 0;
		let skyOffset = 0;
		let hillOffset = 0;
		let shake = 0;
		const mult = (): number => 1 + Math.min(4, Math.floor(combo / 10)) * 0.5;

		// ======== 画面 ========
		const road = new RoadView({ scene, width: W, height: 720 });
		scene.append(road);
		const fx = new g.E({ scene });
		scene.append(fx);
		const hud = new g.E({ scene });
		scene.append(hud);
		const makeFont = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = makeFont("#fff8e8", "#3b2616");
		const fontY = makeFont("#ffe060", "#3b2616");
		const fontR = makeFont("#ffb0a0", "#5a1a10");
		type Align = "left" | "center" | "right";
		const label = (text: string, font: g.Font, size: number, x: number, y: number, parent: g.E, align: Align = "left"): g.Label => {
			const l = new g.Label({ scene, text, font, fontSize: size, x, y });
			if (align !== "left") l.anchorX = align === "center" ? 0.5 : 1;
			parent.append(l);
			return l;
		};
		const setText = (l: g.Label, t: string): void => {
			if (l.text !== t) {
				l.text = t;
				l.invalidate();
			}
		};
		hud.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,14,0.55)", x: 16, y: 14, width: 330, height: 110 }));
		label("とくてん", fontW, 28, 32, 22, hud);
		const scoreLabel = label("0", fontY, 56, 330, 54, hud, "right");
		const comboLabel = label("", fontY, 34, 32, 132, hud);
		hud.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,14,0.55)", x: 1100, y: 14, width: 164, height: 110 }));
		label("のこり", fontW, 28, 1182, 22, hud, "center");
		const timeLabel = label("", fontW, 60, 1182, 54, hud, "center");
		const speedLabel = label("", fontW, 34, 1260, 668, hud, "right");
		const msgLabel = label("", fontY, 96, 640, 300, hud, "center");
		msgLabel.anchorY = 0.5;

		// ---- 小さなアニメーション ----
		interface Anim { t: number; dur: number; fn: (p: number) => void; end?: () => void; }
		const anims: Anim[] = [];
		const animate = (dur: number, fn: (p: number) => void, end?: () => void): void => {
			anims.push({ t: 0, dur, fn, end });
		};
		const popText = (text: string, font: g.Font, size: number, x: number, y: number): void => {
			const l = label(text, font, size, x, y, fx, "center");
			l.anchorY = 0.5;
			animate(0.7, (q) => {
				l.y = y - q * 70;
				l.scaleX = l.scaleY = q < 0.15 ? 0.6 + q / 0.15 * 0.5 : 1.1 - Math.min(0.1, (q - 0.15));
				l.opacity = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
				l.modified();
			}, () => l.destroy());
		};
		let fxSeed = 77;
		const fxRand = (): number => {
			fxSeed = (fxSeed * 1103515245 + 12345) & 0x7fffffff;
			return fxSeed / 0x7fffffff;
		};
		const sparks = (x: number, y: number, n: number): void => {
			for (let k = 0; k < n; k++) {
				const a = Math.PI * 2 * (k + fxRand() * 0.5) / n;
				const r = 50 + fxRand() * 50;
				const s = new g.Sprite({ scene, src: img("spark"), x, y, anchorX: 0.5, anchorY: 0.5 });
				fx.append(s);
				animate(0.45, (q) => {
					s.x = x + Math.cos(a) * r * q;
					s.y = y + Math.sin(a) * r * q;
					s.scaleX = s.scaleY = 1.2 * (1 - q * 0.7);
					s.opacity = 1 - q;
					s.modified();
				}, () => s.destroy());
			}
		};

		// ======== 描画 ========
		const P1X: number[] = [], P1Y: number[] = [], P1W: number[] = [];
		const P2X: number[] = [], P2Y: number[] = [], P2W: number[] = [], CLIP: number[] = [];
		const SC: number[] = [], OK: boolean[] = [];
		const rivalBySeg: Rival[][] = [];
		for (let k = 0; k < N_SEG + 10; k++) rivalBySeg.push([]);
		const drawSprite = (r: g.Renderer, id: string, cx: number, bottom: number, destW: number, clipY: number, squash: number): void => {
			if (destW < 2) return;
			const a = img(id);
			const sc = destW / a.width;
			const destH = a.height * sc;
			const top = bottom - destH;
			const visH = clipY < bottom ? clipY - top : destH;
			if (visH <= 1) return;
			const sx = sc * squash;
			r.save();
			r.transform([sx, 0, 0, sc, cx - a.width * sx / 2, top]);
			r.drawImage(surf[id], 0, 0, a.width, Math.min(a.height, visH / sc), 0, 0);
			r.restore();
		};
		const tiled = (r: g.Renderer, id: string, offset: number, y: number): void => {
			const a = img(id);
			let x0 = -(((offset % a.width) + a.width) % a.width);
			while (x0 < W) {
				r.drawImage(surf[id], 0, 0, a.width, a.height, x0, y);
				x0 += a.width;
			}
		};
		let frameT = 0;
		road.draw = (r: g.Renderer): void => {
			r.fillRect(0, 0, W, 720, "#6aa84a");
			r.drawImage(surf.sky, 0, 0, 1280, 340, 0, 0);
			tiled(r, "mountains", skyOffset, 180 + hillOffset * 0.3);
			tiled(r, "hills", skyOffset * 2, 250 + hillOffset * 0.6);
			const baseIdx = Math.floor(position / SEG) % segs.length;
			const basePct = (position % SEG) / SEG;
			const pIdx = Math.floor((position + PLAYER_Z) / SEG) % segs.length;
			const pPct = ((position + PLAYER_Z) % SEG) / SEG;
			const pSeg = segs[pIdx];
			const playerY = pSeg.y1 + (pSeg.y2 - pSeg.y1) * pPct;
			let maxy = 720;
			let x = 0;
			let dx = -(segs[baseIdx].curve * basePct);
			// ほかの車を区切りごとにふり分ける
			for (let k = 0; k < rivals.length; k++) {
				const rv = rivals[k];
				const idx = Math.floor(rv.z / SEG);
				if (idx >= baseIdx && idx < baseIdx + DRAW && idx < rivalBySeg.length) rivalBySeg[idx].push(rv);
			}
			for (let n = 0; n < DRAW; n++) {
				const sg = segs[(baseIdx + n) % segs.length];
				const looped = sg.i < baseIdx;
				const camZ = position - (looped ? trackLen : 0);
				const camY = playerY + CAM_H;
				// 手前の点
				const z1 = sg.i * SEG - camZ;
				const z2 = (sg.i + 1) * SEG - camZ;
				const s1 = DEPTH / z1, s2 = DEPTH / z2;
				const cx1 = 0 - (playerX * ROAD - x), cx2 = 0 - (playerX * ROAD - x - dx);
				P1X[n] = W / 2 + s1 * cx1 * W / 2; P1Y[n] = CY - s1 * (sg.y1 - camY) * YS; P1W[n] = s1 * ROAD * W / 2;
				P2X[n] = W / 2 + s2 * cx2 * W / 2; P2Y[n] = CY - s2 * (sg.y2 - camY) * YS; P2W[n] = s2 * ROAD * W / 2;
				SC[n] = s1;
				CLIP[n] = maxy;
				x += dx;
				dx += sg.curve;
				OK[n] = !(z1 <= DEPTH || P2Y[n] >= P1Y[n] || P2Y[n] >= maxy);
				if (!OK[n]) continue;
				const light = Math.floor(sg.i / 3) % 2 === 0;
				const y2 = Math.max(0, P2Y[n]);
				const y1 = Math.min(maxy, P1Y[n]);
				r.fillRect(0, Math.floor(y2), W, Math.ceil(y1) - Math.floor(y2) + 1, light ? "#7ab85a" : "#6aa84a");
				const span = P1Y[n] - P2Y[n];
				for (let yy = Math.floor(y2); yy < y1; yy += 3) {
					const t = (yy - P2Y[n]) / span;
					const rx = P2X[n] + (P1X[n] - P2X[n]) * t;
					const rw = P2W[n] + (P1W[n] - P2W[n]) * t;
					const h = Math.min(3, Math.ceil(y1) - yy) + 1;
					const rum = rw * 0.12;
					r.fillRect(rx - rw - rum, yy, (rw + rum) * 2, h, light ? "#d8403a" : "#f4f0e8");
					r.fillRect(rx - rw, yy, rw * 2, h, light ? "#86807a" : "#7a746e");
					if (light) {
						const lw = Math.max(1, rw * 0.025);
						r.fillRect(rx - rw / 3 - lw / 2, yy, lw, h, "#f4f0e8");
						r.fillRect(rx + rw / 3 - lw / 2, yy, lw, h, "#f4f0e8");
					}
				}
				maxy = P2Y[n];
			}
			// 奥から順に、景色・アイテム・車を描く
			for (let n = DRAW - 1; n > 0; n--) {
				const sg = segs[(baseIdx + n) % segs.length];
				const w1 = P1W[n];
				for (let k = 0; k < sg.objs.length; k++) {
					const o = sg.objs[k];
					if (o.taken || (o.kind === "deco" && n < 3)) continue;
					const cx = P1X[n] + w1 * o.off;
					if (cx < -w1 * 3 || cx > W + w1 * 3) continue;
					if (o.kind === "coin" || o.kind === "gem") {
						const spin = Math.abs(Math.cos(frameT * 4 + sg.i * 0.3));
						drawSprite(r, o.id, cx, P1Y[n] - w1 * 0.12, w1 * o.size, CLIP[n], 0.25 + spin * 0.75);
					} else drawSprite(r, o.id, cx, P1Y[n], w1 * o.size, CLIP[n], 1);
				}
				const rl = rivalBySeg[sg.i];
				for (let k = 0; k < rl.length; k++) {
					const rv = rl[k];
					const pct = (rv.z % SEG) / SEG;
					const cy = P1Y[n] + (P2Y[n] - P1Y[n]) * pct;
					const cw = P1W[n] + (P2W[n] - P1W[n]) * pct;
					const cxx = P1X[n] + (P2X[n] - P1X[n]) * pct + cw * rv.off;
					drawSprite(r, rv.id, cxx, cy, cw * 0.34, CLIP[n], 1);
				}
				rl.length = 0;
			}
			for (let k = baseIdx; k < Math.min(rivalBySeg.length, baseIdx + DRAW); k++) rivalBySeg[k].length = 0;
			// スピード線(加速中)
			if (boostLeft > 0) {
				for (let k = 0; k < 14; k++) {
					const a = (k * 2.4 + frameT * 7) % (Math.PI * 2);
					const d = 300 + ((frameT * 900 + k * 97) % 360);
					r.fillRect(W / 2 + Math.cos(a) * d, CY + 60 + Math.sin(a) * d * 0.6, 40, 3, "rgba(255,255,240,0.7)");
				}
			}
			// 自分の車
			const bounce = speed > 100 ? Math.sin(frameT * 30) * 1.5 : 0;
			const carId = steer < -0.3 ? "car_l" : steer > 0.3 ? "car_r" : "car";
			const blink = hurtLeft > 0 && Math.floor(frameT * 12) % 2 === 0;
			if (!blink) drawSprite(r, carId, W / 2 + shake * Math.sin(frameT * 50), 712 + bounce, CAR_W, 9999, 1);
			if (Math.abs(playerX) > 1 && speed > 1000) {
				for (let k = 0; k < 3; k++) {
					const dxp = W / 2 + (k - 1) * 120 + Math.sin(frameT * 20 + k) * 10;
					drawSprite(r, "dust", dxp, 712 - Math.abs(Math.sin(frameT * 9 + k)) * 20, 70, 9999, 1);
				}
			}
		};

		// ======== 操作: 指を左右にスライドしてハンドル ========
		let dragX: number | null = null;
		scene.onPointDownCapture.add((ev) => {
			dragX = ev.point.x;
		});
		scene.onPointMoveCapture.add((ev) => {
			if (dragX === null || phase !== "race") return;
			const d = ev.prevDelta.x;
			playerX = Math.max(-1.8, Math.min(1.8, playerX + d * DRAG_RATE));
			steer = Math.max(-1, Math.min(1, steer + d * 0.03));
		});
		scene.onPointUpCapture.add(() => {
			dragX = null;
		});

		// ======== ひろったとき・ぶつかったとき ========
		let popIdx = 0;
		const addScore = (pts: number): void => {
			score += pts;
			g.game.vars.gameState.score = score;
			setText(scoreLabel, String(score));
		};
		const updateCombo = (): void => {
			setText(comboLabel, combo >= 2 ? combo + "コンボ  ×" + mult().toFixed(1) : "");
		};
		const hit = (): void => {
			if (hurtLeft > 0) return;
			speed *= 0.25;
			boostLeft = 0;
			hurtLeft = 1.2;
			shake = 14;
			if (combo >= 10) popText("コンボがきれた…", fontR, 40, W / 2, 470);
			combo = 0;
			updateCombo();
			se("crash", 0.6);
		};
		const touch = (o: Obj): void => {
			if (o.kind === "coin") {
				o.taken = true;
				const before = mult();
				combo++;
				const pts = Math.round(COIN_PT * mult());
				addScore(pts);
				se("coin", 0.4);
				popIdx = (popIdx + 1) % 4;
				popText("+" + pts, fontY, 40, W / 2 + (popIdx % 2 ? 110 : -110), 540 - popIdx * 26);
				sparks(W / 2, 600, 4);
				if (mult() > before) {
					popText("×" + mult().toFixed(1) + "!", fontY, 70, W / 2, 400);
					se("combo", 0.6);
				}
				updateCombo();
			} else if (o.kind === "gem") {
				o.taken = true;
				const pts = Math.round(GEM_PT * mult());
				addScore(pts);
				se("gem", 0.6);
				popText("ほうせき! +" + pts, fontY, 56, W / 2, 470);
				sparks(W / 2, 590, 12);
			} else if (o.kind === "boost") {
				if (boostLeft <= 0) se("boost", 0.6);
				boostLeft = BOOST_SEC;
				popText("ダッシュ!", fontW, 56, W / 2, 440);
			} else if (o.kind === "hit") {
				o.taken = o.id === "cone"; // コーンははじき飛ばす
				hit();
			}
		};

		// ======== イントロ ========
		const intro = new g.E({ scene });
		scene.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,14,0.6)", y: 70, width: W, height: 470 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: W / 2, y: 190, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.85;
		intro.append(logo);
		label("指を左右にスライドしてハンドル!", fontW, 46, W / 2, 330, intro, "center");
		label("コインを続けてひろうと点数アップ。ぶつかるとコンボがきれるよ", fontW, 32, W / 2, 400, intro, "center");
		const countLabel = label("", fontY, 110, W / 2, 470, intro, "center");
		let lastCount = -1;
		const bgm = scene.asset.getAudioById("bgm");

		// ======== メインループ ========
		scene.onUpdate.add(() => {
			frameT += dt;
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
			elapsed += dt;
			if (phase === "intro") {
				const c = Math.ceil(INTRO_SEC - elapsed);
				if (elapsed > INTRO_SEC - 3 && c !== lastCount && c > 0) {
					lastCount = c;
					setText(countLabel, String(c));
					se("beep", 0.4);
				}
				if (elapsed >= INTRO_SEC) {
					intro.destroy();
					phase = "race";
					se("go", 0.5);
					bgm.play().changeVolume(0.35);
					setText(msgLabel, "GO!");
					animate(0.8, (q) => {
						msgLabel.opacity = 1 - q;
						msgLabel.scaleX = msgLabel.scaleY = 1 + q * 0.5;
						msgLabel.modified();
					}, () => setText(msgLabel, ""));
				}
				setText(timeLabel, String(Math.ceil(raceLeft)));
				road.modified();
				return;
			}
			// ---- 速さ ----
			const offroad = Math.abs(playerX) > 1;
			let target = boostLeft > 0 ? BOOST_SPEED : MAX_SPEED;
			if (phase === "end") target = 0;
			else if (offroad) target = Math.min(target, OFFROAD_SPEED);
			if (speed < target) speed = Math.min(target, speed + ACCEL * dt * (boostLeft > 0 ? 3 : 1));
			else speed = Math.max(target, speed - ACCEL * 1.6 * dt);
			boostLeft = Math.max(0, boostLeft - dt);
			hurtLeft = Math.max(0, hurtLeft - dt);
			shake = Math.max(0, shake - 40 * dt);
			steer *= 0.8;
			// ---- 進む ----
			const oldPos = position;
			position += speed * dt;
			const pIdx = Math.floor((position + PLAYER_Z) / SEG) % segs.length;
			const pSeg = segs[pIdx];
			const pct = speed / MAX_SPEED;
			playerX -= dt * pct * pSeg.curve * CENTRIFUGAL;
			playerX = Math.max(-1.8, Math.min(1.8, playerX));
			skyOffset += pSeg.curve * pct * 6;
			hillOffset = -(pSeg.y1 / SEG) * 0.4;
			// ---- 通りすぎた区切りのアイテムを調べる ----
			if (phase === "race") {
				const from = Math.floor((oldPos + PLAYER_Z) / SEG);
				const to = Math.floor((position + PLAYER_Z) / SEG);
				for (let s = from; s <= to; s++) {
					const sg = segs[s % segs.length];
					for (let k = 0; k < sg.objs.length; k++) {
						const o = sg.objs[k];
						if (o.taken || o.kind === "deco") continue;
						if (Math.abs(playerX - o.off) < PLAYER_HALF + o.size / 2 * (o.kind === "hit" ? 0.8 : 1)) touch(o);
					}
				}
			}
			// ---- ほかの車 ----
			const pz = position + PLAYER_Z;
			for (let k = 0; k < rivals.length; k++) {
				const rv = rivals[k];
				rv.z += rv.speed * dt;
				const dz = rv.z - pz;
				if (phase === "race" && dz > -40 && dz < 120 && Math.abs(rv.off - playerX) < PLAYER_HALF + 0.15) {
					if (speed > rv.speed) {
						hit();
						speed = Math.min(speed, rv.speed * 0.6);
						rv.z = pz + 600;
					}
				}
			}
			// ---- 時間 ----
			if (phase === "race") {
				raceLeft = Math.max(0, raceLeft - dt);
				setText(timeLabel, String(Math.ceil(raceLeft)));
				timeLabel.opacity = raceLeft <= 5 && Math.floor(raceLeft * 4) % 2 === 0 ? 0.5 : 1;
				timeLabel.modified();
				if (raceLeft <= 0) {
					phase = "end";
					se("finish", 0.7);
					setText(msgLabel, "FINISH!");
					msgLabel.opacity = 1;
					msgLabel.scaleX = msgLabel.scaleY = 1;
					msgLabel.modified();
				}
			}
			setText(speedLabel, Math.round(speed / MAX_SPEED * 180) + " km/h");
			road.modified();
		});
	});
	g.game.pushScene(scene);
}
