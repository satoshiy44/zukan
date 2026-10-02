import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const COLS = 11;
const ROWS = 5;
const CELL = 96;
const BX = 24; // 盤面の左上
const BY = 150;
const FIRE_X = 1180; // たき火の中心
const FIRE_SCALE = 0.62; // 盤面が広いので、たき火は小さめに置く
const FIRE_Y = 520;
const INTRO_SEC = 4;
const RESULT_SEC = 11;
const FEVER_SEC = 10; // 残りこの秒数で得点2倍
const LEAF_TYPES = 4;
const IMO = 4; // やきいものピース番号
const IMO_PER_BOARD = 3;
const IMO_SCORE = 1000;
const PIECE_IMAGES = ["p_momiji", "p_ichou", "p_donguri", "p_budou", "p_imo"];

// 盤面の定義: columns[c][r] = ピース番号 (r=0 がいちばん下)
function createBoard(random: g.RandomGenerator): number[][] {
	const r = (): number => random.generate();
	const cols: number[][] = [];
	for (let c = 0; c < COLS; c++) {
		const col: number[] = [];
		for (let y = 0; y < ROWS; y++) col.push(Math.floor(r() * LEAF_TYPES));
		cols.push(col);
	}
	// やきいもは上のほう(別々の列)に置く
	const used: { [c: number]: boolean } = {};
	for (let i = 0; i < IMO_PER_BOARD; i++) {
		let c = Math.floor(r() * COLS);
		while (used[c]) c = (c + 1) % COLS;
		used[c] = true;
		cols[c][3 + Math.floor(r() * (ROWS - 3))] = IMO;
	}
	return cols;
}

interface Piece {
	type: number;
	sprite: g.Sprite;
}

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: ["bg", "fire1", "fire2", "spark", "logo"].concat(PIECE_IMAGES, [
			"pop_s", "pop_m", "pop_l", "miss", "imo", "clear", "next", "beep", "go", "finish", "fever", "result", "bgm"
		])
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
		const cosmeticRandom = g.game.random; // 見た目用(プレイヤーごとに違ってよい)

		// ---- フォント ----
		const makeFont = (color: string, stroke: string): g.DynamicFont =>
			new g.DynamicFont({
				game: g.game,
				fontFamily: "sans-serif",
				fontWeight: "bold",
				size: 64,
				fontColor: color,
				strokeColor: stroke,
				strokeWidth: 11
			});
		const fontWhite = makeFont("#fff8e6", "#3a1a0a");
		const fontYellow = makeFont("#ffe14a", "#5a1a08");
		const fontOrange = makeFont("#ff9a3a", "#fff8e6");
		const fontPink = makeFont("#ffd0e4", "#5b1638");

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
		const boardLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const hudLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, boardLayer, fxLayer, hudLayer, overLayer].forEach((e) => scene.append(e));
		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));

		// たき火
		const fireImages = [img("fire1"), img("fire2")];
		const fire = new g.Sprite({ scene, src: fireImages[0], x: FIRE_X, y: FIRE_Y + 110, anchorX: 0.5, anchorY: 1 });
		fire.scaleX = fire.scaleY = FIRE_SCALE * 0.8;
		bgLayer.append(fire);
		let heat = 0; // たき火の勢い(消した数で増えて、だんだん減る)
		const imoCountLabel = label("やきいも 0こ", fontWhite, 30, FIRE_X, FIRE_Y + 130, bgLayer, "center");

		const spawnSpark = (): void => {
			const s = new g.Sprite({
				scene, src: img("spark"), anchorX: 0.5, anchorY: 0.5,
				x: FIRE_X + (cosmeticRandom.generate() - 0.5) * 70, y: FIRE_Y + 60
			});
			const vx = (cosmeticRandom.generate() - 0.5) * 60;
			const vy = -120 - cosmeticRandom.generate() * 160;
			animate(0.9 + cosmeticRandom.generate() * 0.5, (p) => {
				s.x += vx * dt;
				s.y += vy * dt;
				s.opacity = 1 - p;
				s.modified();
			}, () => s.destroy());
			fxLayer.append(s);
		};

		// ---- HUD ----
		const scoreLabel = label("0", fontWhite, 60, 30, 20, hudLayer);
		const subLabel = label("", fontYellow, 30, 34, 92, hudLayer);
		const timeLabel = label("", fontWhite, 44, 1250, 14, hudLayer, "right");
		const boardLabel = label("", fontWhite, 30, BX + COLS * CELL, 100, hudLayer, "right");

		// ---- 状態 ----
		let phase: "intro" | "play" | "result" = "intro";
		let elapsed = 0;
		const playTime = Math.max(10, time - INTRO_SEC - RESULT_SEC);
		const feverSec = Math.min(FEVER_SEC, playTime * 0.3);
		let playLeft = playTime;
		let fever = false;
		let score = 0;
		let boardNo = 0;
		let busy = false; // 盤面の入れかえ中は操作できない
		let columns: Piece[][] = [];
		const stats = { leaves: 0, maxGroup: 0, imo: 0, allClear: 0, boards: 0 };

		// 盤面は最初にまとめて作る(プレイ内容で乱数の消費がずれないように)
		const boards: number[][][] = [];
		for (let i = 0; i < 12; i++) boards.push(createBoard(param.random));

		const addScore = (v: number): void => {
			score += Math.round(v);
			g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
			setText(scoreLabel, String(score));
		};

		const popup = (text: string, font: g.Font, size: number, x: number, y: number, dur = 0.8): void => {
			const l = label(text, font, size, x, y, overLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.y = y - 60 * p;
				l.scaleX = l.scaleY = p < 0.15 ? 0.5 + p / 0.15 * 0.7 : 1.2 - Math.min(0.2, p - 0.15);
				l.opacity = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const bigText = (text: string, font: g.Font, size: number, dur: number, y = 360): void => {
			const l = label(text, font, size, 640, y, overLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.scaleX = l.scaleY = p < 0.12 ? 2 - p / 0.12 : 1;
				l.opacity = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
				l.modified();
			}, () => l.destroy());
		};

		const cellX = (c: number): number => BX + c * CELL + CELL / 2;
		const cellY = (r: number): number => BY + (ROWS - 1 - r) * CELL + CELL / 2;

		const loadBoard = (): void => {
			const def = boards[boardNo % boards.length];
			boardNo++;
			setText(boardLabel, "盤面 " + boardNo);
			columns = def.map((col, c) => col.map((type, r) => {
				const sprite = new g.Sprite({
					scene, src: img(PIECE_IMAGES[type]), anchorX: 0.5, anchorY: 0.5,
					x: cellX(c), y: cellY(r) - 560 - r * 30 - c * 8
				});
				boardLayer.append(sprite);
				return { type, sprite };
			}));
		};

		// つながっている同じ種類のピースを探す
		const findGroup = (c0: number, r0: number): { c: number; r: number }[] => {
			const type = columns[c0][r0].type;
			const seen: { [key: string]: boolean } = {};
			const stack = [{ c: c0, r: r0 }];
			const group: { c: number; r: number }[] = [];
			while (stack.length > 0) {
				const p = stack.pop()!;
				const key = p.c + "," + p.r;
				if (seen[key]) continue;
				seen[key] = true;
				if (p.c < 0 || p.c >= columns.length || p.r < 0 || p.r >= columns[p.c].length) continue;
				if (columns[p.c][p.r].type !== type) continue;
				group.push(p);
				stack.push({ c: p.c + 1, r: p.r }, { c: p.c - 1, r: p.r }, { c: p.c, r: p.r + 1 }, { c: p.c, r: p.r - 1 });
			}
			return group;
		};

		const hasMove = (): boolean => {
			for (let c = 0; c < columns.length; c++) {
				for (let r = 0; r < columns[c].length; r++) {
					const t = columns[c][r].type;
					if (t === IMO) continue;
					if (r + 1 < columns[c].length && columns[c][r + 1].type === t) return true;
					if (c + 1 < columns.length && r < columns[c + 1].length && columns[c + 1][r].type === t) return true;
				}
			}
			return false;
		};

		const flyToFire = (sprite: g.Sprite, delay: number): void => {
			const sx = sprite.x, sy = sprite.y;
			const ex = FIRE_X + (cosmeticRandom.generate() - 0.5) * 80, ey = FIRE_Y + 20;
			sprite.remove();
			fxLayer.append(sprite);
			animate(0.5 + delay, (p) => {
				const q = Math.max(0, Math.min(1, (p * (0.5 + delay) - delay) / 0.5));
				if (q === 0) return;
				sprite.x = sx + (ex - sx) * q;
				sprite.y = sy + (ey - sy) * q - Math.sin(q * Math.PI) * 140;
				sprite.scaleX = sprite.scaleY = 1 - q * 0.6;
				sprite.angle += 15;
				sprite.modified();
			}, () => {
				sprite.destroy();
				heat += 1;
			});
		};

		// 下まで落ちたやきいもをたき火へ
		const bakeImo = (): void => {
			let found = true;
			while (found) {
				found = false;
				for (let c = 0; c < columns.length; c++) {
					if (columns[c].length > 0 && columns[c][0].type === IMO) {
						const p = columns[c].shift()!;
						found = true;
						stats.imo++;
						const v = IMO_SCORE * (fever ? 2 : 1);
						addScore(v);
						se("imo");
						popup("やきいも! +" + v, fontYellow, 42, p.sprite.x, p.sprite.y - 20, 1.1);
						setText(imoCountLabel, "やきいも " + stats.imo + "こ");
						heat += 8;
						flyToFire(p.sprite, 0.15);
					}
				}
			}
		};

		const endBoard = (): void => {
			busy = true;
			stats.boards++;
			let left = 0;
			columns.forEach((col) => left += col.length);
			const m = fever ? 2 : 1;
			if (left === 0) {
				stats.allClear++;
				addScore(5000 * m);
				se("clear");
				bigText("ぜんぶたき火!! +" + 5000 * m, fontYellow, 80, 1.4, 330);
			} else {
				const bonus = left <= 3 ? 2000 : left <= 6 ? 800 : 0;
				if (bonus > 0) addScore(bonus * m);
				se("next");
				const msg = bonus > 0 ? "のこり" + left + "こ おしい! +" + bonus * m : "つみ! のこり" + left + "こ";
				bigText(msg, bonus > 0 ? fontPink : fontWhite, 60, 1.2, 330);
			}
			// 残ったピースを片づけて次の盤面へ
			columns.forEach((col) => col.forEach((p) => {
				const s = p.sprite;
				animate(0.4, (q) => {
					s.opacity = 1 - q;
					s.y += 12;
					s.modified();
				}, () => s.destroy());
			}));
			columns = [];
			scene.setTimeout(() => {
				if (phase !== "play") return;
				loadBoard();
				busy = false;
			}, 900);
		};

		// 見えている位置でピースを探す(落下中・列つめ中のピースも押せるように)
		const pieceAt = (x: number, y: number): { c: number; r: number } | null => {
			let best: { c: number; r: number } | null = null;
			let bestDist = CELL * 0.6;
			for (let c = 0; c < columns.length; c++) {
				for (let r = 0; r < columns[c].length; r++) {
					const s = columns[c][r].sprite;
					const d = Math.max(Math.abs(s.x - x), Math.abs(s.y - y));
					if (d < bestDist) {
						bestDist = d;
						best = { c, r };
					}
				}
			}
			return best;
		};

		const tap = (x: number, y: number): void => {
			const hit = pieceAt(x, y);
			if (!hit) return;
			const c = hit.c, r = hit.r;
			const piece = columns[c][r];
			if (piece.type === IMO) {
				se("miss");
				popup("下まで落とそう!", fontWhite, 28, cellX(c), cellY(r) - 30);
				return;
			}
			const group = findGroup(c, r);
			if (group.length < 2) {
				se("miss");
				popup("つながってないよ", fontWhite, 26, piece.sprite.x, piece.sprite.y - 40, 0.6);
				const s = piece.sprite;
				animate(0.25, (p) => {
					s.angle = Math.sin(p * Math.PI * 4) * 15 * (1 - p);
					s.modified();
				});
				return;
			}
			const n = group.length;
			const v = n * n * 10 * (fever ? 2 : 1);
			addScore(v);
			stats.leaves += n;
			stats.maxGroup = Math.max(stats.maxGroup, n);
			se(n >= 10 ? "pop_l" : n >= 5 ? "pop_m" : "pop_s");
			const word = n >= 20 ? "超特大!!! " : n >= 14 ? "特大!! " : n >= 9 ? "でかい! " : "";
			const big = n >= 9;
			popup(word + "+" + v, big ? fontYellow : fontWhite, n >= 14 ? 56 : big ? 46 : 36, cellX(c), cellY(r) - 20, big ? 1.2 : 0.8);
			// 消す(上から順に取り除いて、飛ばす)
			group.sort((a, b) => b.r - a.r);
			group.forEach((p, i) => {
				const piece = columns[p.c][p.r];
				columns[p.c].splice(p.r, 1);
				flyToFire(piece.sprite, i * 0.015);
			});
			heat += n;
			bakeImo();
			columns = columns.filter((col) => col.length > 0); // 空いた列はつめる
			if (!hasMove()) {
				scene.setTimeout(endBoard, 250);
				busy = true;
			}
		};

		// 押した場所に輪っかを出す(押した手ごたえ)
		const tapRing = (x: number, y: number): void => {
			const ring = new g.FilledRect({
				scene, cssColor: "#fff6d0", x, y, width: 36, height: 36, anchorX: 0.5, anchorY: 0.5, opacity: 0.8
			});
			ring.angle = 45;
			overLayer.append(ring);
			animate(0.25, (p) => {
				ring.scaleX = ring.scaleY = 0.4 + p * 0.9;
				ring.opacity = 0.8 * (1 - p);
				ring.modified();
			}, () => ring.destroy());
		};

		scene.onPointDownCapture.add((ev) => {
			if (phase !== "play") return;
			tapRing(ev.point.x, ev.point.y);
			if (busy) return;
			tap(ev.point.x, ev.point.y);
		});

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(40,15,5,0.6)", width: 1280, height: 720 }));
		introLayer.append(new g.Sprite({ scene, src: img("logo"), x: 640, y: 140, anchorX: 0.5, anchorY: 0.5 }));
		[
			"同じ葉っぱが2つ以上つながっているところをタップで消す!",
			"いっぺんにたくさん消すほど 点がぐーんと増える",
			"やきいもを いちばん下まで落とすと たき火でボーナス",
			"ラスト10秒は たき火フィーバーで得点2倍!"
		].forEach((t, i) => label(t, i === 3 ? fontYellow : fontWhite, 34, 640, 290 + i * 56, introLayer, "center"));
		const countLabel = label("", fontYellow, 120, 640, 560, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		const finishPlay = (): void => {
			phase = "result";
			se("finish");
			bigText("しゅうりょう〜!", fontYellow, 100, 1.5, 330);
			scene.setTimeout(showResult, 1600);
		};

		const showResult = (): void => {
			se("result");
			const panel = new g.E({ scene, x: 640, y: 380, anchorX: 0.5, anchorY: 0.5, width: 760, height: 520 });
			overLayer.append(panel);
			panel.append(new g.FilledRect({ scene, cssColor: "#3a1a0a", x: -6, y: -6, width: 772, height: 532 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#fff4dc", width: 760, height: 520 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#e0602a", width: 760, height: 80 }));
			label("たきび けっか", fontWhite, 48, 380, 12, panel, "center");
			label(score + " 点", fontOrange, 96, 380, 96, panel, "center");
			const title = score >= 55000 ? "たき火の神さま"
				: score >= 38000 ? "やきいも仙人"
					: score >= 22000 ? "やきいも名人"
						: score >= 10000 ? "落ち葉そうじ係" : "たき火見習い";
			label("称号: " + title, fontYellow, 44, 380, 206, panel, "center");
			[
				"消した葉っぱ " + stats.leaves + "まい  やきいも " + stats.imo + "こ",
				"いっぺんに消した最大 " + stats.maxGroup + "まい",
				"ぜんぶたき火(全消し) " + stats.allClear + "回",
				"クリアした盤面 " + stats.boards + "まい"
			].forEach((t, i) => label(t, fontWhite, 32, 380, 280 + i * 52, panel, "center"));
			animate(0.35, (p) => {
				panel.scaleX = panel.scaleY = 0.6 + 0.4 * (1 - Math.pow(1 - p, 3));
				panel.modified();
			});
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
			// ピースを目標の位置へすべらせる(落下・列つめ)
			for (let c = 0; c < columns.length; c++) {
				for (let r = 0; r < columns[c].length; r++) {
					const s = columns[c][r].sprite;
					const tx = cellX(c), ty = cellY(r);
					if (s.x !== tx || s.y !== ty) {
						s.x += Math.max(-24, Math.min(24, (tx - s.x) * 0.5));
						s.y = Math.min(ty, s.y + 36);
						if (Math.abs(s.x - tx) < 0.5) s.x = tx;
						s.modified();
					}
				}
			}
			// たき火
			heat = Math.max(0, heat - heat * 0.02 - 0.02);
			const fireScale = FIRE_SCALE * Math.min(1.7, 0.8 + heat / 40 + (fever ? 0.3 : 0));
			const fireImage = fireImages[Math.floor(g.game.age / 5) % 2];
			fire.scaleX = fire.scaleY = fire.scaleX + (fireScale - fire.scaleX) * 0.2;
			if (fire.src !== fireImage) {
				fire.src = fireImage;
				fire.invalidate();
			} else {
				fire.modified();
			}
			if (cosmeticRandom.generate() < 0.1 + heat / 60) spawnSpark();

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
					loadBoard();
				}
				setText(timeLabel, "のこり " + Math.ceil(playLeft) + "秒");
				return;
			}
			if (phase !== "play") return;

			playLeft -= dt;
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playLeft)) + "秒");
			if (!fever && playLeft <= feverSec) {
				fever = true;
				se("fever");
				bigText("たき火フィーバー!! 得点2倍", fontYellow, 80, 1.4, 300);
				setText(subLabel, "フィーバー ×2");
			}
			if (fever) {
				timeLabel.opacity = Math.floor(playLeft * 4) % 2 === 0 ? 1 : 0.55;
				timeLabel.modified();
			}
			if (playLeft <= 0) finishPlay();
		});
	});
	g.game.pushScene(scene);
}
