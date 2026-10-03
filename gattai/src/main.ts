import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const N = 5; // 盤面のマス数(N×N)
const CELL = 112;
const BX = 80; // 盤面の左上
const BY = 100;
const MAX_LV = 9;
const WILD = 99; // なんでも(虹色の星)
const INTRO_SEC = 4;
const RESULT_SEC = 10;
const MERGE_SEC = 0.22; // 合体の動きの長さ
// レベル L のぬいぐるみを作ったときの点(3つ合体したとき)
const VALUE = [0, 0, 20, 60, 180, 500, 1500, 4000, 10000, 25000];
const BLAST_SCORE = 50000; // 金のくまを3つそろえた大爆発
const NAMES = ["", "ひよこ", "こぶた", "ペンギン", "ねこ", "いぬ", "くま", "パンダ", "ユニコーン", "金のくま"];

// 共通乱数で、出てくるぬいぐるみの順番のもとを決める(全員同じ)
function createPieces(random: g.RandomGenerator, n: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < n; i++) out.push(random.generate());
	return out;
}
// 出てくるぬいぐるみは、これまでに作ったいちばん高いレベルに合わせて底上げされる
// ただし盤面に取り残された小さいぬいぐるみも、ときどき出して片づけられるようにする
function pieceOf(u: number, bestLv: number, lowest: number): number {
	if (u < 0.06) return WILD;
	const base = 1 + Math.max(0, bestLv - 3);
	if (u < 0.3 && lowest > 0 && lowest < base) return lowest;
	return Math.min(MAX_LV, u < 0.55 ? base : u < 0.85 ? base + 1 : base + 2);
}

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "cell", "cell_hi", "lv1", "lv2", "lv3", "lv4", "lv5", "lv6", "lv7", "lv8", "lv9", "wild", "sparkle", "logo",
			"place", "ng", "merge1", "merge2", "merge3", "merge4", "merge5", "jackpot", "swap", "full",
			"beep", "go", "finish", "bgm"
		]
	});
	let time = 90;
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
		const pieceImg = (lv: number): g.ImageAsset => img(lv === WILD ? "wild" : "lv" + lv);

		// ---- フォント ----
		const makeFont = (color: string, stroke: string): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: 11
		});
		const fontWhite = makeFont("#ffffff", "#5a2a7a");
		const fontYellow = makeFont("#ffe14a", "#5a2a7a");
		const fontPink = makeFont("#ff5a9a", "#ffffff");
		const fontInk = makeFont("#5a2a7a", "#ffffff");

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
		const ease = (p: number): number => 1 - Math.pow(1 - p, 3);

		// ---- レイヤー ----
		const bgLayer = new g.E({ scene });
		const boardLayer = new g.E({ scene });
		const pieceLayer = new g.E({ scene });
		const uiLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, boardLayer, pieceLayer, uiLayer, fxLayer, overLayer].forEach((e) => scene.append(e));
		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));
		const cellX = (c: number): number => BX + c * CELL + CELL / 2;
		const cellY = (r: number): number => BY + r * CELL + CELL / 2;
		for (let r = 0; r < N; r++) {
			for (let c = 0; c < N; c++) {
				boardLayer.append(new g.Sprite({ scene, src: img("cell"), x: cellX(c), y: cellY(r), anchorX: 0.5, anchorY: 0.5 }));
			}
		}

		// ---- 右のパネル ----
		const scoreLabel = label("0", fontPink, 72, 982, 70, uiLayer, "center");
		const timeLabel = label("", fontInk, 40, 982, 150, uiLayer, "center");
		label("いまの", fontInk, 30, 820, 206, uiLayer, "center");
		label("つぎ", fontInk, 30, 990, 206, uiLayer, "center");
		label("ほかん", fontInk, 30, 1150, 206, uiLayer, "center");
		const nowSprite = new g.Sprite({ scene, src: img("lv1"), x: 820, y: 320, anchorX: 0.5, anchorY: 0.5 });
		nowSprite.scaleX = nowSprite.scaleY = 1.45;
		const nextSprite = new g.Sprite({ scene, src: img("lv1"), x: 990, y: 320, anchorX: 0.5, anchorY: 0.5 });
		const stashBox = new g.FilledRect({
			scene, cssColor: "rgba(184,168,255,0.35)", x: 1150, y: 320, width: 140, height: 140, anchorX: 0.5, anchorY: 0.5, touchable: true
		});
		const stashSprite = new g.Sprite({ scene, src: img("lv1"), x: 1150, y: 320, anchorX: 0.5, anchorY: 0.5 });
		const stashHint = label("タップで\n入れかえ", fontInk, 22, 1150, 398, uiLayer, "center");
		stashHint.text = "タップで入れかえ";
		stashHint.invalidate();
		[stashBox, nowSprite, nextSprite, stashSprite].forEach((e) => uiLayer.append(e));
		stashSprite.hide();
		const chainLabel = label("", fontYellow, 34, 982, 440, uiLayer, "center");
		// 進化の表
		label("しんかの じゅんばん", fontInk, 26, 982, 500, uiLayer, "center");
		for (let i = 1; i <= MAX_LV; i++) {
			const s = new g.Sprite({ scene, src: img("lv" + i), x: 742 + (i - 1) * 60, y: 590, anchorX: 0.5, anchorY: 0.5 });
			s.scaleX = s.scaleY = 0.52;
			uiLayer.append(s);
		}
		const bestMark = new g.FilledRect({ scene, cssColor: "#ff5a9a", x: 742, y: 630, width: 44, height: 8, anchorX: 0.5 });
		uiLayer.append(bestMark);

		// ---- 状態 ----
		let phase: "intro" | "play" | "result" = "intro";
		let elapsed = 0;
		const playTime = Math.max(20, time - INTRO_SEC - RESULT_SEC);
		let playLeft = playTime;
		let score = 0;
		let busy = false; // 合体のアニメーション中は置けない
		const grid: number[][] = [];
		const sprites: (g.Sprite | null)[][] = [];
		for (let r = 0; r < N; r++) {
			grid.push([]);
			sprites.push([]);
			for (let c = 0; c < N; c++) {
				grid[r].push(0);
				sprites[r].push(null);
			}
		}
		const pieces = createPieces(param.random, 1000);
		let pieceIdx = 0;
		let now = 0;
		let next = 0;
		let stash = 0; // 0 = 空
		const stats = { merges: 0, bestChain: 0, bestLv: 1, blasts: 0, places: 0 };

		const addScore = (v: number): void => {
			score += Math.round(v);
			g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
		};
		let shownScore = 0;
		const updateScoreLabel = (): void => {
			if (shownScore === score) return;
			shownScore = Math.min(score, shownScore + Math.max(7, Math.ceil((score - shownScore) * 0.2)));
			setText(scoreLabel, String(shownScore));
		};
		const popup = (text: string, font: g.Font, size: number, x: number, y: number, dur = 0.9): void => {
			const l = label(text, font, size, x, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.y = y - 50 * p;
				l.opacity = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const bigText = (text: string, font: g.Font, size: number, dur: number, x = 360, y = 380): void => {
			const l = label(text, font, size, x, y, overLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.scaleX = l.scaleY = p < 0.12 ? 2 - p / 0.12 : 1;
				l.opacity = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const sparkles = (x: number, y: number, n: number): void => {
			for (let i = 0; i < n; i++) {
				const s = new g.Sprite({ scene, src: img("sparkle"), x, y, anchorX: 0.5, anchorY: 0.5 });
				fxLayer.append(s);
				const a = cosmeticRandom.generate() * Math.PI * 2, sp = 80 + cosmeticRandom.generate() * 160;
				animate(0.5, (p) => {
					s.x = x + Math.cos(a) * sp * p;
					s.y = y + Math.sin(a) * sp * p;
					s.scaleX = s.scaleY = 1.3 - p;
					s.opacity = 1 - p;
					s.modified();
				}, () => s.destroy());
			}
		};
		const setImage = (s: g.Sprite, asset: g.ImageAsset): void => {
			s.src = asset;
			s.width = s.srcWidth = asset.width;
			s.height = s.srcHeight = asset.height;
			s.invalidate();
		};
		const updatePanel = (): void => {
			setImage(nowSprite, pieceImg(now));
			setImage(nextSprite, pieceImg(next));
			if (stash) {
				setImage(stashSprite, pieceImg(stash));
				stashSprite.show();
			} else {
				stashSprite.hide();
			}
			bestMark.x = 742 + (stats.bestLv - 1) * 60;
			bestMark.modified();
		};
		const lowestOnBoard = (): number => {
			let lo = 0;
			for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] && (!lo || grid[r][c] < lo)) lo = grid[r][c];
			return lo;
		};
		const drawPiece = (): number => pieceOf(pieces[pieceIdx++ % pieces.length], stats.bestLv, lowestOnBoard());

		// ---- 盤面 ----
		const setCell = (r: number, c: number, lv: number, pop: boolean): void => {
			const old = sprites[r][c];
			if (old) old.destroy();
			sprites[r][c] = null;
			grid[r][c] = lv;
			if (!lv) return;
			const s = new g.Sprite({ scene, src: pieceImg(lv), x: cellX(c), y: cellY(r), anchorX: 0.5, anchorY: 0.5 });
			pieceLayer.append(s);
			sprites[r][c] = s;
			if (pop) {
				animate(0.25, (p) => {
					s.scaleX = s.scaleY = p < 0.5 ? 0.4 + 1.6 * p * 2 * 0.6 : 1.36 - 0.36 * ease((p - 0.5) * 2);
					s.modified();
				});
			}
		};
		const inBoard = (r: number, c: number): boolean => r >= 0 && r < N && c >= 0 && c < N;
		const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
		// (r, c) をレベル lv とみなしたとき、つながっている同じレベルのマス
		const groupOf = (r0: number, c0: number, lv: number): number[][] => {
			const seen: { [k: string]: boolean } = {};
			const out: number[][] = [];
			const stack = [[r0, c0]];
			seen[r0 + "," + c0] = true;
			while (stack.length) {
				const p = stack.pop()!;
				out.push(p);
				DIRS.forEach((d) => {
					const r = p[0] + d[0], c = p[1] + d[1];
					if (!inBoard(r, c) || seen[r + "," + c] || grid[r][c] !== lv) return;
					seen[r + "," + c] = true;
					stack.push([r, c]);
				});
			}
			return out;
		};
		// なんでもは、合体できるいちばん高いレベルになる。どれもだめならひよこ
		const wildLevel = (r: number, c: number): number => {
			const levels: number[] = [];
			DIRS.forEach((d) => {
				const rr = r + d[0], cc = c + d[1];
				if (inBoard(rr, cc) && grid[rr][cc] && levels.indexOf(grid[rr][cc]) < 0) levels.push(grid[rr][cc]);
			});
			levels.sort((a, b) => b - a);
			for (let i = 0; i < levels.length; i++) {
				if (groupOf(r, c, levels[i]).length >= 3) return levels[i];
			}
			return 1;
		};
		const emptyCount = (): number => {
			let n = 0;
			for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) n++;
			return n;
		};

		// (r, c) にできたレベル lv のぬいぐるみから、合体と連鎖を進める
		const resolve = (r: number, c: number, lv: number, chain: number): void => {
			const group = groupOf(r, c, lv);
			if (group.length < 3) {
				finishMove(chain - 1);
				return;
			}
			stats.merges++;
			stats.bestChain = Math.max(stats.bestChain, chain);
			const k = Math.min(chain, 5);
			se("merge" + k);
			const sizeBonus = group.length >= 4 ? 1 : group.length / 3; // 4つ以上はレベルが2つ上がるので、点の倍率はつけない
			const chainBonus = 1 + (chain - 1) * 0.5;
			// 合体: まわりのぬいぐるみが、置いたマスに吸いこまれる
			group.forEach((p) => {
				const s = sprites[p[0]][p[1]];
				grid[p[0]][p[1]] = 0;
				sprites[p[0]][p[1]] = null;
				if (!s) return;
				const sx = s.x, sy = s.y;
				animate(MERGE_SEC, (q) => {
					const e = ease(q);
					s.x = sx + (cellX(c) - sx) * e;
					s.y = sy + (cellY(r) - sy) * e;
					s.scaleX = s.scaleY = 1 - 0.3 * e;
					s.modified();
				}, () => s.destroy());
			});
			scene.setTimeout(() => {
				if (lv >= MAX_LV) {
					// 金のくまを3つ: まわり3×3をまとめて吹き飛ばす大爆発
					stats.blasts++;
					const v = BLAST_SCORE * sizeBonus * chainBonus;
					addScore(v);
					se("jackpot");
					for (let rr = r - 1; rr <= r + 1; rr++) {
						for (let cc = c - 1; cc <= c + 1; cc++) {
							if (!inBoard(rr, cc) || !grid[rr][cc]) continue;
							sparkles(cellX(cc), cellY(rr), 4);
							setCell(rr, cc, 0, false);
						}
					}
					sparkles(cellX(c), cellY(r), 24);
					bigText("だいばくはつ!! +" + Math.round(v), fontYellow, 70, 1.4);
					finishMove(chain);
					return;
				}
				// 3つなら1つ上、4つ以上なら2つ上にしんか
				const nlv = Math.min(MAX_LV, lv + (group.length >= 4 ? 2 : 1));
				setCell(r, c, nlv, true);
				const v = VALUE[nlv] * sizeBonus * chainBonus;
				addScore(v);
				sparkles(cellX(c), cellY(r), 6 + chain * 3);
				popup("+" + Math.round(v), chain >= 2 ? fontYellow : fontWhite, 34 + Math.min(chain, 4) * 6, cellX(c), cellY(r) - 50);
				if (chain >= 2) bigText(chain + "れんさ!", fontYellow, 60 + Math.min(chain, 5) * 10, 0.8, cellX(c), cellY(r) - 100);
				if (nlv > stats.bestLv) {
					stats.bestLv = nlv;
					if (nlv >= 5) bigText(NAMES[nlv] + " できた!", fontPink, 64, 1.1, 360, 620);
					updatePanel();
				}
				scene.setTimeout(() => resolve(r, c, nlv, chain + 1), 120);
			}, MERGE_SEC * 1000);
		};
		// 1手が終わったら、盤面がいっぱいなら小さいものを片づける
		const finishMove = (chains: number): void => {
			setText(chainLabel, chains >= 2 ? "さいだい " + stats.bestChain + "れんさ" : "");
			if (emptyCount() === 0) {
				se("full");
				bigText("ぎゅうぎゅう! おかたづけ", fontPink, 56, 1.2);
				// いちばん小さいレベルから、5マス以上あくまで片づける
				for (let lv = 1; lv <= MAX_LV && emptyCount() < 5; lv++) {
					for (let r = 0; r < N; r++) {
						for (let c = 0; c < N; c++) {
							if (grid[r][c] !== lv) continue;
							const s = sprites[r][c];
							grid[r][c] = 0;
							sprites[r][c] = null;
							if (!s) continue;
							animate(0.4, (p) => {
								s.scaleX = s.scaleY = 1 - p;
								s.angle = p * 180;
								s.modified();
							}, () => s.destroy());
						}
					}
				}
			}
			busy = false;
		};

		const placeAt = (r: number, c: number): void => {
			if (busy || phase !== "play") return;
			if (grid[r][c]) {
				se("ng");
				const s = sprites[r][c];
				if (s) {
					animate(0.2, (p) => {
						s.x = cellX(c) + Math.sin(p * Math.PI * 4) * 6;
						s.modified();
					});
				}
				return;
			}
			busy = true;
			stats.places++;
			const lv = now === WILD ? wildLevel(r, c) : now;
			if (now === WILD) popup(NAMES[lv] + "に へんしん!", fontYellow, 30, cellX(c), cellY(r) - 60);
			se("place");
			setCell(r, c, lv, true);
			now = next;
			next = drawPiece();
			updatePanel();
			scene.setTimeout(() => resolve(r, c, lv, 1), 80);
		};
		const swapStash = (): void => {
			if (busy || phase !== "play") return;
			se("swap");
			if (stash) {
				const t = stash;
				stash = now;
				now = t;
			} else {
				stash = now;
				now = next;
				next = drawPiece();
			}
			updatePanel();
		};

		// 盤面のマスをタップ
		const boardTouch = new g.E({ scene, x: BX, y: BY, width: N * CELL, height: N * CELL, touchable: true });
		uiLayer.append(boardTouch);
		boardTouch.onPointDown.add((ev) => {
			const c = Math.floor(ev.point.x / CELL), r = Math.floor(ev.point.y / CELL);
			if (inBoard(r, c)) placeAt(r, c);
		});
		stashBox.onPointDown.add(() => swapStash());

		// 最初の盤面: 合体しないように少しだけ置いておく
		for (let i = 0; i < 7; i++) {
			const r = Math.floor(param.random.generate() * N), c = Math.floor(param.random.generate() * N);
			const lv = 1 + Math.floor(param.random.generate() * 3);
			if (grid[r][c]) continue;
			grid[r][c] = lv;
			if (groupOf(r, c, lv).length >= 3) {
				grid[r][c] = 0;
				continue;
			}
			setCell(r, c, lv, false);
		}
		now = drawPiece();
		next = drawPiece();
		updatePanel();

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(60,30,90,0.88)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 92, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.68;
		introLayer.append(logo);
		const introLines = ["マスをタップして おく!", "3つつなげると しんか!", "れんさで 大きく かせげ!"];
		const introFonts = [fontWhite, fontYellow, fontWhite];
		introLines.forEach((t, i) => label(t, introFonts[i], 76, 640, 196 + i * 112, introLayer, "center"));
		const countLabel = label("", fontYellow, 96, 640, 650, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		const finishPlay = (): void => {
			phase = "result";
			se("finish");
			// 結果はニコ生のランキングで出るので、ゲームの中では出さない
			bigText("しゅうりょう!", fontYellow, 110, 1.4, 640, 340);
			setText(scoreLabel, String(score));
		};
		const bgm = scene.asset.getAudioById("bgm");

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
			updateScoreLabel();
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
					bigText("スタート!", fontYellow, 110, 0.9, 640, 360);
					bgm.play().changeVolume(0.4);
				}
				setText(timeLabel, "のこり " + Math.ceil(playLeft) + "秒");
				return;
			}
			if (phase !== "play") return;
			playLeft -= dt;
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playLeft)) + "秒");
			if (playLeft <= 0) finishPlay();
		});
	});
	g.game.pushScene(scene);
}
