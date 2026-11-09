import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const H = 720;
const N = 8; // 盤は 8x8
const CELL = 64;
const BX = 640; // 盤の中心
const BY = 404;
const LEFT = BX - N * CELL / 2; // 盤の左上(画面)
const TOP = BY - N * CELL / 2;
const INTRO_SEC = 4;
const END_SEC = 3;
const KINDS0 = 5; // さいしょの柄の数
const KINDS1 = 6; // とちゅうから増える
const JOKER = 6; // どの柄ともそろう金のタイル
const JOKER_RATE = 0.04;
const AUTO0 = 3.2; // 置かずにいると自動で落ちるまでの秒(だんだん短く)
const AUTO1 = 2.0;
const CLEAR_PT = 100; // 1枚あたり
const BIG_PT = 600; // 6枚以上いっぺんに消したおまけ
const OVER_PENALTY = 1000;
const TURN_MUL = 2; // 回して消したときの倍率。連鎖するたびに+1(×2→×3→×4…)
const FALL_V = 1900; // タイルが落ちる速さ(px/秒)

interface Tile { kind: number; spr: g.Sprite; tx: number; ty: number; v: number; }
interface Fx { e: g.E; vx: number; vy: number; g: number; life: number; max: number; spin: number; grow: number; base: number; }

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"bg", "board", "t0", "t1", "t2", "t3", "t4", "t5", "tj", "btn_cw", "btn_ccw", "fx_sq", "fx_star", "fx_frame", "lane", "logo"
	];
	const audioIds = [
		"drop", "land", "turn", "ng", "clear0", "clear1", "clear2", "clear3", "clear4", "clear5", "bigclear", "joker",
		"count", "go", "finish", "over", "turnbonus"
	];
	const scene = new g.Scene({ game: g.game, assetIds: imageIds.concat(audioIds, ["bgm"]) });
	let time = 70;
	if (param.sessionParameter.totalTimeLimit) time = param.sessionParameter.totalTimeLimit;
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const rand = (): number => param.random.generate();
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const se = (id: string, vol = 0.7): void => {
			scene.asset.getAudioById(id).play().changeVolume(vol);
		};
		const tileImg = (k: number): string => (k === JOKER ? "tj" : "t" + k);
		const playSec = Math.max(30, time - INTRO_SEC - END_SEC);

		// ======== 画面 ========
		scene.append(new g.Sprite({ scene, src: img("bg") }));
		const root = new g.E({ scene });
		scene.append(root);
		// 回して消したときに光る、盤のまわりの金のわく
		const glow = new g.FilledRect({ scene, cssColor: "#f2cf6a", x: BX - 290, y: BY - 290, width: 580, height: 580, opacity: 0 });
		root.append(glow);
		let frameGlow = 0;
		root.append(new g.Sprite({ scene, src: img("board"), x: BX, y: BY, anchorX: 0.5, anchorY: 0.5 }));
		// 盤の中身(回すときはこれごと回す)
		const boardE = new g.E({ scene, x: BX, y: BY });
		root.append(boardE);
		const laneHi = new g.FilledRect({ scene, cssColor: "rgba(236,213,154,0.10)", width: CELL, height: N * CELL, y: -N * CELL / 2 });
		laneHi.hide();
		boardE.append(laneHi);
		const fxLayer = new g.E({ scene });
		scene.append(fxLayer);
		const ui = new g.E({ scene });
		scene.append(ui);

		const font = (color: string, stroke: string, sw = 6, fam = "sans-serif"): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: fam, fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontG = font("#ecd59a", "#141218");
		const fontW = font("#f4efe6", "#141218");
		const fontR = font("#ff8a8a", "#141218");
		const fontS = font("#ecd59a", "#141218", 6, "serif");
		type Align = "left" | "center" | "right";
		const label = (
			parent: g.E, f: g.Font, size: number, x: number, y: number, text: string, align: Align = "left", w = 400
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

		// ======== 左右のパネル ========
		label(ui, fontS, 26, 190, 150, "SCORE", "center", 300);
		const scoreLabel = label(ui, fontW, 52, 190, 182, "0", "center", 320);
		const chainLabel = label(ui, fontG, 30, 190, 248, "", "center", 320);
		const turnLabel = label(ui, fontS, 24, 190, 290, "", "center", 320);
		label(ui, fontS, 26, 1090, 150, "TIME", "center", 300);
		const timeLabel = label(ui, fontW, 52, 1090, 182, "", "center", 300);
		label(ui, fontS, 22, 1090, 258, "NEXT", "center", 300);
		const nextSpr: g.Sprite[] = [];
		for (let k = 0; k < 2; k++) {
			const sc = k ? 0.38 : 0.52;
			const s = new g.Sprite({ scene, src: img("t0"), x: 1060 + k * 74, y: 320, anchorX: 0.5, anchorY: 0.5, scaleX: sc, scaleY: sc });
			ui.append(s);
			nextSpr.push(s);
		}
		// 自動で落ちるまでのゲージ
		const autoBack = new g.FilledRect({ scene, cssColor: "#2a2630", x: 1010, y: 366, width: 160, height: 8 });
		const autoBar = new g.FilledRect({ scene, cssColor: "#c9a45c", x: 1010, y: 366, width: 160, height: 8 });
		ui.append(autoBack); ui.append(autoBar);
		// 回転ボタン
		const button = (id: string, x: number, y: number, cw: boolean): g.Sprite => {
			const b = new g.Sprite({ scene, src: img(id), x, y, anchorX: 0.5, anchorY: 0.5, touchable: true });
			ui.append(b);
			b.onPointDown.add(() => rotate(cw));
			return b;
		};
		const btnL = button("btn_ccw", 190, 500, false);
		const btnR = button("btn_cw", 1090, 500, true);
		label(ui, fontS, 22, 190, 592, "LEFT TURN", "center", 300);
		label(ui, fontS, 22, 1090, 592, "RIGHT TURN", "center", 300);

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
		const ringFx = (x: number, y: number, size: number, life: number): void => {
			const a = img("fx_frame");
			const s = new g.Sprite({ scene, src: a, x, y, anchorX: 0.5, anchorY: 0.5 });
			const base = size / a.width;
			s.scale(base * 0.6);
			fxLayer.append(s);
			fxs.push({ e: s, vx: 0, vy: 0, g: 0, life, max: life, spin: 0, grow: 1, base });
		};
		const pop = (t: string, f: g.Font, size: number, x: number, y: number, life = 0.9): void => {
			const l = label(fxLayer, f, size, x, y, t, "center", 600);
			fxs.push({ e: l, vx: 0, vy: -70, g: 0, life, max: life, spin: 0, grow: 0, base: 1 });
		};
		const banners: { e: g.E; life: number }[] = [];
		const banner = (t: string, f: g.Font, size: number, y: number): void => {
			const e = new g.E({ scene, x: BX, y });
			const l = label(e, f, size, 0, -size / 2, t, "center", 1000);
			l.x = -500;
			e.scale(0.3);
			ui.append(e);
			banners.push({ e, life: 1.1 });
		};
		let shake = 0;
		const flash = new g.FilledRect({ scene, cssColor: "#fff4d0", width: W, height: H, opacity: 0 });
		ui.append(flash);

		// ======== 盤の状態 ========
		const grid: (Tile | null)[][] = [];
		for (let r = 0; r < N; r++) {
			grid.push([]);
			for (let c = 0; c < N; c++) grid[r].push(null);
		}
		const cellX = (c: number): number => -N * CELL / 2 + c * CELL + CELL / 2;
		const cellY = (r: number): number => -N * CELL / 2 + r * CELL + CELL / 2;
		let phase: "intro" | "play" | "end" = "intro";
		let state: "idle" | "turning" | "falling" | "clearing" = "idle";
		let introLeft = INTRO_SEC;
		let t = 0;
		let score = 0;
		let chain = 0;
		let fromTurn = false; // 回転がきっかけの連鎖
		let turnCount = 0; // 回して消した回数
		let turnT = 0;
		let turnFrom = 0;
		let clearT = 0;
		let clearing: Tile[] = [];
		let autoLeft = AUTO0;
		const queue: number[] = [];
		const kinds = (): number => (t > playSec * 0.45 ? KINDS1 : KINDS0);
		const newKind = (): number => (rand() < JOKER_RATE ? JOKER : Math.floor(rand() * kinds()));
		queue.push(newKind(), newKind());
		const showNext = (): void => {
			nextSpr.forEach((s, k) => {
				s.src = img(tileImg(queue[k])); s.invalidate();
			});
		};
		showNext();
		const addScore = (p: number): number => {
			score = Math.max(0, score + p);
			g.game.vars.gameState.score = score;
			setText(scoreLabel, String(score));
			return p;
		};
		const makeTile = (kind: number, r: number, c: number, fromY: number): Tile => {
			const spr = new g.Sprite({
				scene, src: img(tileImg(kind)), anchorX: 0.5, anchorY: 0.5, scaleX: 0.5, scaleY: 0.5, x: cellX(c), y: fromY
			});
			boardE.append(spr);
			return { kind, spr, tx: cellX(c), ty: cellY(r), v: 0 };
		};

		// ======== 落とす ========
		const dropAt = (c: number, auto = false): boolean => {
			let r = -1;
			for (let k = N - 1; k >= 0; k--) {
				if (!grid[k][c]) {
					r = k; break;
				}
			}
			if (r < 0) return false;
			const kind = queue.shift()!;
			queue.push(newKind());
			showNext();
			grid[r][c] = makeTile(kind, r, c, cellY(-1) - 10);
			se("drop", auto ? 0.35 : 0.55);
			state = "falling";
			chain = 0; fromTurn = false;
			autoLeft = AUTO0 + (AUTO1 - AUTO0) * Math.min(1, t / playSec);
			return true;
		};
		// 下に詰める(重力)
		const gravity = (): void => {
			for (let c = 0; c < N; c++) {
				let w = N - 1;
				for (let r = N - 1; r >= 0; r--) {
					const tl = grid[r][c];
					if (tl) {
						grid[r][c] = null;
						grid[w][c] = tl;
						tl.tx = cellX(c); tl.ty = cellY(w);
						w--;
					}
				}
			}
			state = "falling";
		};
		// ======== 回す ========
		const rotate = (cw: boolean): void => {
			if (phase !== "play" || state !== "idle") return;
			const old: (Tile | null)[][] = grid.map((row) => row.slice());
			for (let r = 0; r < N; r++) {
				for (let c = 0; c < N; c++) {
					const tl = cw ? old[N - 1 - c][r] : old[c][N - 1 - r];
					grid[r][c] = tl;
					if (tl) {
						tl.spr.x = cellX(c); tl.spr.y = cellY(r); tl.tx = tl.spr.x; tl.ty = tl.spr.y; tl.v = 0;
						tl.spr.modified();
					}
				}
			}
			// 新しい並びを、もとの向きから回して見せる
			turnFrom = cw ? -90 : 90;
			boardE.angle = turnFrom;
			boardE.modified();
			turnT = 0;
			state = "turning";
			chain = 0; fromTurn = true;
			se("turn", 0.7);
			(cw ? btnR : btnL).scale(0.85);
		};
		// ======== そろったかどうか ========
		const findMatches = (): Tile[] => {
			const mark: boolean[][] = grid.map((row) => row.map(() => false));
			for (let k = 0; k < KINDS1; k++) {
				const seen: boolean[][] = grid.map((row) => row.map(() => false));
				for (let r = 0; r < N; r++) {
					for (let c = 0; c < N; c++) {
						const tl = grid[r][c];
						if (!tl || seen[r][c] || (tl.kind !== k && tl.kind !== JOKER)) continue;
						const group: number[][] = [];
						let real = 0;
						const stack = [[r, c]];
						seen[r][c] = true;
						while (stack.length) {
							const p = stack.pop()!;
							group.push(p);
							if (grid[p[0]][p[1]]!.kind === k) real++;
							[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => {
								const rr = p[0] + d[0], cc = p[1] + d[1];
								if (rr < 0 || cc < 0 || rr >= N || cc >= N || seen[rr][cc]) return;
								const o = grid[rr][cc];
								if (o && (o.kind === k || o.kind === JOKER)) {
									seen[rr][cc] = true; stack.push([rr, cc]);
								}
							});
						}
						if (group.length >= 3 && real > 0) group.forEach((p) => {
							mark[p[0]][p[1]] = true;
						});
					}
				}
			}
			const res: Tile[] = [];
			for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (mark[r][c]) res.push(grid[r][c]!);
			return res;
		};
		const toScreen = (tl: Tile): number[] => {
			const a = boardE.angle * Math.PI / 180;
			return [BX + tl.spr.x * Math.cos(a) - tl.spr.y * Math.sin(a), BY + tl.spr.x * Math.sin(a) + tl.spr.y * Math.cos(a)];
		};
		const startClear = (list: Tile[]): void => {
			chain++;
			clearing = list;
			clearT = 0;
			state = "clearing";
			const turnMul = fromTurn ? TURN_MUL + chain - 1 : 1;
			const mul = chain * turnMul;
			let pts = list.length * CLEAR_PT * mul;
			if (list.length >= 6) pts += BIG_PT;
			pts = addScore(Math.round(pts));
			let cx = 0, cy = 0;
			list.forEach((tl) => {
				const p = toScreen(tl);
				cx += p[0]; cy += p[1];
			});
			cx /= list.length; cy /= list.length;
			pop("+" + pts, fontG, 34 + Math.min(20, chain * 4), cx, cy - 30);
			se(list.length >= 6 || chain >= 3 ? "bigclear" : "clear" + Math.min(5, chain - 1), 0.7);
			if (list.some((tl) => tl.kind === JOKER)) se("joker", 0.5);
			if (chain >= 2) {
				banner(chain + " CHAIN", fontS, 64 + Math.min(40, chain * 8), 110 + 260);
				setText(chainLabel, chain + " CHAIN!");
			}
			if (fromTurn) {
				// 回して消した: 金色に光って、大きく「TURN BONUS」
				if (chain === 1) {
					turnCount++;
					setText(turnLabel, "回して消した " + turnCount + "回");
				}
				se("turnbonus", 0.8);
				banner("TURN BONUS ×" + turnMul, fontS, 70 + Math.min(30, chain * 6), 250);
				flash.cssColor = "#f2cf6a"; flash.opacity = 0.45; flash.modified();
				shake = 0.3;
				ringFx(cx, cy, 260, 0.5);
				for (let k = 0; k < 18; k++) {
					const a = k / 18 * Math.PI * 2, v = 380 + rand() * 200;
					particle("fx_star", cx, cy, Math.cos(a) * v, Math.sin(a) * v, 0.7, 26 + rand() * 18, 300, 0.3);
				}
				frameGlow = 1;
			}
			if (!fromTurn && (list.length >= 6 || chain >= 3)) {
				flash.cssColor = "#fff4d0"; flash.opacity = 0.35; flash.modified(); shake = 0.25;
			}
		};
		const finishClear = (): void => {
			clearing.forEach((tl) => {
				const p = toScreen(tl);
				for (let k = 0; k < 5; k++) {
					const a = rand() * Math.PI * 2, v = 200 + rand() * 260;
					const sz = 14 + rand() * 10;
					particle(tileImg(tl.kind), p[0], p[1], Math.cos(a) * v, Math.sin(a) * v - 200, 0.6, sz, 1200, (rand() - 0.5) * 20);
				}
				particle("fx_star", p[0], p[1], 0, -40, 0.4, 40);
				ringFx(p[0], p[1], 90, 0.35);
				for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === tl) grid[r][c] = null;
				tl.spr.destroy();
			});
			clearing = [];
			gravity();
		};
		// 置けるところがないとき: 上の2段を消してやり直し
		const overflow = (): void => {
			let n = 0;
			for (let r = 0; r < 2; r++) {
				for (let c = 0; c < N; c++) {
					const tl = grid[r][c];
					if (tl) {
						const p = toScreen(tl);
						particle(tileImg(tl.kind), p[0], p[1], (rand() - 0.5) * 400, -300, 0.6, 30, 1200, 8);
						tl.spr.destroy(); grid[r][c] = null; n++;
					}
				}
			}
			addScore(-OVER_PENALTY);
			se("over", 0.8);
			shake = 0.35;
			banner("あふれた！ -" + OVER_PENALTY, fontR, 56, 360);
			if (n > 0) gravity();
		};

		// ======== タップ: 盤の列をタップして落とす ========
		const colAt = (x: number): number => Math.floor((x - LEFT) / CELL);
		let hoverCol = -1;
		scene.onPointDownCapture.add((ev) => {
			if (phase !== "play" || ev.target) return;
			const x = ev.point.x, y = ev.point.y;
			if (x < LEFT || x >= LEFT + N * CELL || y < TOP - 60 || y > TOP + N * CELL + 20) return;
			hoverCol = colAt(x);
			if (state !== "idle") return;
			if (!dropAt(hoverCol)) {
				se("ng", 0.5);
				shake = 0.12;
			}
		});

		// ======== はじめの説明 ========
		const intro = new g.E({ scene });
		ui.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(10,8,14,0.78)", width: W, height: H }));
		intro.append(new g.Sprite({ scene, src: img("logo"), x: BX, y: 190, anchorX: 0.5, anchorY: 0.5, scaleX: 0.8, scaleY: 0.8 }));
		label(intro, fontW, 32, BX, 320, "盤の列をタップして、タイルを落とそう", "center", 1100);
		label(intro, fontG, 32, BX, 372, "同じ柄を3つ以上つなげると消える", "center", 1100);
		label(intro, fontW, 32, BX, 424, "左右のボタンで盤をくるっと回すと、重力の向きが変わる！", "center", 1100);
		label(intro, fontG, 28, BX, 476, "回して消すとスコア×2！ 回して連鎖すると×3、×4…", "center", 1100);
		const countLabel = label(intro, fontS, 90, BX, 520, "", "center", 400);

		// ======== おしまい ========
		const finish = (): void => {
			phase = "end";
			se("finish", 0.7);
			const over = new g.E({ scene });
			ui.append(over);
			over.append(new g.FilledRect({ scene, cssColor: "rgba(10,8,14,0.6)", width: W, height: H }));
			label(over, fontS, 96, BX, 250, "FINISH", "center", 1000);
			label(over, fontW, 60, BX, 380, score + " pts", "center", 1000);
		};

		// ======== 毎フレーム ========
		let lastCount = -1;
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
					banner("START", fontS, 110, 360);
					g.game.audio.music.play(scene.asset.getAudioById("bgm"));
				}
			} else if (phase === "play") {
				t += dt;
				if (t >= playSec && state === "idle") finish();
			}
			setText(timeLabel, phase === "intro" ? String(Math.ceil(playSec)) : String(Math.max(0, Math.ceil(playSec - t))));
			// 自動で落ちる
			if (phase === "play" && state === "idle" && t < playSec) {
				autoLeft -= dt;
				if (autoLeft <= 0) {
					const free: number[] = [];
					for (let c = 0; c < N; c++) if (!grid[0][c]) free.push(c);
					if (free.length === 0) overflow();
					else dropAt(free[Math.floor(rand() * free.length)], true);
				}
			}
			const autoMax = AUTO0 + (AUTO1 - AUTO0) * Math.min(1, t / playSec);
			autoBar.width = 160 * Math.max(0, Math.min(1, autoLeft / autoMax));
			autoBar.cssColor = autoLeft < 1 ? "#d96a6a" : "#c9a45c";
			autoBar.modified();

			// 回転のアニメーション
			if (state === "turning") {
				turnT += dt / 0.24;
				const k = Math.min(1, turnT);
				const e = 1 - (1 - k) * (1 - k) * (1 - k);
				boardE.angle = turnFrom * (1 - e) + (k < 1 ? 0 : 0);
				boardE.scaleX = boardE.scaleY = 1 - Math.sin(k * Math.PI) * 0.06;
				boardE.modified();
				if (k >= 1) {
					boardE.angle = 0; boardE.scale(1); boardE.modified();
					gravity();
				}
			}
			// 落ちるアニメーション
			let moving = false;
			for (let r = 0; r < N; r++) {
				for (let c = 0; c < N; c++) {
					const tl = grid[r][c];
					if (!tl) continue;
					if (tl.spr.y < tl.ty - 0.5) {
						tl.v = Math.min(FALL_V, tl.v + 6000 * dt);
						tl.spr.y = Math.min(tl.ty, tl.spr.y + tl.v * dt);
						if (tl.spr.y >= tl.ty) {
							tl.v = 0;
							if (state === "falling") se("land", 0.15);
						}
						tl.spr.modified();
						moving = true;
					}
				}
			}
			if (state === "falling" && !moving) {
				const m = findMatches();
				if (m.length) startClear(m);
				else {
					state = "idle";
					if (chain >= 2) pop(chain + " CHAIN 終了", fontS, 26, 190, 280, 0.8);
					setText(chainLabel, "");
				}
			}
			if (state === "clearing") {
				clearT += dt;
				clearing.forEach((tl) => {
					const s = 0.5 * (1 + Math.sin(clearT * 30) * 0.08 + clearT * 0.6);
					tl.spr.scaleX = tl.spr.scaleY = s;
					tl.spr.opacity = Math.floor(clearT * 20) % 2 ? 0.6 : 1;
					tl.spr.modified();
				});
				if (clearT >= 0.28) finishClear();
			}
			// ボタンのもどり
			[btnL, btnR].forEach((b) => {
				if (b.scaleX < 1) {
					b.scale(Math.min(1, b.scaleX + dt * 1.5)); b.modified();
				}
			});
			// ゆれ・光
			if (shake > 0) {
				shake -= dt;
				root.x = (rand() - 0.5) * 18 * shake / 0.25; root.y = (rand() - 0.5) * 12 * shake / 0.25;
			} else {
				root.x = 0; root.y = 0;
			}
			root.modified();
			if (frameGlow > 0) {
				frameGlow = Math.max(0, frameGlow - dt * 1.6);
				glow.opacity = frameGlow * 0.55 * (0.7 + Math.sin(t * 30) * 0.3); glow.modified();
			}
			if (flash.opacity > 0) {
				flash.opacity = Math.max(0, flash.opacity - dt * 2); flash.modified();
			}
			// エフェクト
			for (let i = fxs.length - 1; i >= 0; i--) {
				const f = fxs[i];
				f.life -= dt;
				f.e.x += f.vx * dt; f.e.y += f.vy * dt; f.vy += f.g * dt;
				f.e.angle += f.spin;
				const r = f.life / f.max;
				if (f.grow) f.e.scaleX = f.e.scaleY = f.base * (0.6 + 0.6 * (1 - r));
				f.e.opacity = Math.min(1, r * 2);
				f.e.modified();
				if (f.life <= 0) {
					f.e.destroy(); fxs.splice(i, 1);
				}
			}
			for (let i = banners.length - 1; i >= 0; i--) {
				const b = banners[i];
				b.life -= dt;
				const k = 1.1 - b.life;
				b.e.scaleX = b.e.scaleY = k < 0.15 ? 0.3 + k / 0.15 * 0.85 : k < 0.25 ? 1.15 - (k - 0.15) * 1.5 : 1;
				b.e.opacity = Math.min(1, b.life * 3);
				b.e.modified();
				if (b.life <= 0) {
					b.e.destroy(); banners.splice(i, 1);
				}
			}
			if (hoverCol >= 0 && phase === "play") {
				laneHi.show(); laneHi.x = -N * CELL / 2 + hoverCol * CELL; laneHi.modified();
			}
		});
	});
	g.game.pushScene(scene);
}
