import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const FX = 60; // 盤(コインの入った四角)の左上
const FY = 60;
const FS = 600; // 盤の大きさ
const COINS = 10000; // 最初のコインの数(鍵をふくむ)
const COIN_SIZE = 12;
const INTRO_SEC = 4;
const PLAY_SEC = 30;
const NG_LOCK = 0.6; // はずれたあと、線を引けない秒数
const MIN_POINTS = 6; // これより短い線は無視する

interface Coin { x: number; y: number; v: number; key: boolean; }

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "coin1", "coin2", "coin3", "key", "ok", "ng", "dot", "logo",
			"draw", "ok_se", "ng_se", "found", "beep", "go", "finish", "bgm"
		]
	});
	let time = 45;
	if (param.sessionParameter.totalTimeLimit) {
		time = param.sessionParameter.totalTimeLimit;
	}
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const se = (id: string, vol = 1): void => {
			scene.asset.getAudioById(id).play().changeVolume(vol);
		};

		// ---- フォント(落ち着いた色) ----
		const makeFont = (color: string, stroke: string, sw = 6): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontCream = makeFont("#e8e2d0", "#14161b");
		const fontGold = makeFont("#c9b06a", "#14161b");
		const fontDim = makeFont("#8c8676", "#14161b", 4);

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
		const fieldLayer = new g.E({ scene });
		const lineLayer = new g.E({ scene });
		const uiLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, fieldLayer, lineLayer, uiLayer, fxLayer, overLayer].forEach((e) => scene.append(e));
		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));

		// コイン1万枚は、1枚の絵(サーフェス)にまとめて描く
		const surface = g.game.resourceFactory.createSurface(FS, FS);
		const field = new g.Sprite({ scene, src: surface, x: FX, y: FY, width: FS, height: FS });
		fieldLayer.append(field);
		const coinSurfaces = [img("coin1").asSurface(), img("coin2").asSurface(), img("coin3").asSurface()];
		const keySprite = new g.Sprite({ scene, src: img("key"), x: FX + FS / 2, y: FY + FS / 2, anchorX: 0.5, anchorY: 0.5 });
		keySprite.hide();
		fieldLayer.append(keySprite);

		// ---- 右側 ----
		label("のこり", fontDim, 30, 970, 74, uiLayer, "center");
		const timeLabel = label("", fontCream, 64, 970, 106, uiLayer, "center");
		label("いまの候補", fontDim, 30, 970, 186, uiLayer, "center");
		const ratioLabel = label("1 / 10000", fontGold, 92, 970, 230, uiLayer, "center");
		const scoreLabel = label("", fontDim, 30, 970, 344, uiLayer, "center");
		const msgLabel = label("指で丸く囲んでください", fontCream, 34, 970, 384, uiLayer, "center");
		label("これまで", fontDim, 26, 970, 448, uiLayer, "center");
		const historyLabels: g.Label[] = [];
		for (let i = 0; i < 6; i++) historyLabels.push(label("", fontDim, 28, 970, 486 + i * 34, uiLayer, "center"));

		// ---- 状態 ----
		let phase: "intro" | "play" | "end" = "intro";
		let elapsed = 0;
		// 遊べる時間は30秒。ただし制限時間が短いときは、終わりの余裕を残して短くする
		let playLeft = Math.max(10, Math.min(PLAY_SEC, time - INTRO_SEC - 8));
		let lock = 0; // 線を引けない残り秒数
		let coins: Coin[] = [];
		const history: string[] = [];
		const stats = { hits: 0, misses: 0 };

		const scoreOf = (n: number): number => Math.floor(100000 / n);
		const setScore = (v: number): void => {
			g.game.vars.gameState.score = v; // 常に最新のスコアを入れておく
			setText(scoreLabel, v + " 点");
		};

		// 共通乱数で、n 枚(鍵1本をふくむ)を盤に散らばらせる
		const scatter = (n: number): void => {
			coins = [];
			const keyIdx = Math.floor(param.random.generate() * n);
			const m = COIN_SIZE / 2;
			for (let i = 0; i < n; i++) {
				coins.push({
					x: m + param.random.generate() * (FS - COIN_SIZE),
					y: m + param.random.generate() * (FS - COIN_SIZE),
					v: Math.floor(param.random.generate() * 3),
					key: i === keyIdx
				});
			}
			redraw();
		};
		const redraw = (): void => {
			const r = surface.renderer();
			r.begin();
			r.clear();
			for (let i = 0; i < coins.length; i++) {
				const c = coins[i];
				r.drawImage(coinSurfaces[c.v], 0, 0, COIN_SIZE, COIN_SIZE, c.x - COIN_SIZE / 2, c.y - COIN_SIZE / 2);
			}
			r.end();
			field.invalidate();
		};
		const updateRatio = (): void => {
			setText(ratioLabel, "1 / " + coins.length);
			setScore(scoreOf(coins.length));
		};
		const pushHistory = (text: string): void => {
			history.unshift(text);
			historyLabels.forEach((l, i) => setText(l, history[i] || ""));
		};

		// ---- 指で引く線 ----
		let drawing = false;
		let points: number[][] = []; // 盤の中の座標
		const dots: g.Sprite[] = [];
		const clearLine = (): void => {
			dots.forEach((d) => d.destroy());
			dots.length = 0;
		};
		const addPoint = (x: number, y: number): void => {
			const last = points[points.length - 1];
			if (last) {
				// 点と点のあいだを埋めて、なめらかな線にする
				const dx = x - last[0], dy = y - last[1], d = Math.sqrt(dx * dx + dy * dy);
				if (d < 4) return;
				const steps = Math.floor(d / 5);
				for (let k = 1; k <= steps; k++) {
					const px = last[0] + dx * k / steps, py = last[1] + dy * k / steps;
					const s = new g.Sprite({ scene, src: img("dot"), x: FX + px, y: FY + py, anchorX: 0.5, anchorY: 0.5 });
					lineLayer.append(s);
					dots.push(s);
				}
			}
			points.push([x, y]);
		};
		// 点が、閉じた線の内側にあるか(レイキャスト法)
		const inside = (x: number, y: number, poly: number[][]): boolean => {
			let hit = false;
			for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
				const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
				if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
			}
			return hit;
		};
		const showMark = (id: string): void => {
			const s = new g.Sprite({ scene, src: img(id), x: FX + FS / 2, y: FY + FS / 2, anchorX: 0.5, anchorY: 0.5 });
			fxLayer.append(s);
			animate(0.7, (p) => {
				s.scaleX = s.scaleY = 0.8 + 0.2 * ease(Math.min(1, p * 3));
				s.opacity = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
				s.modified();
			}, () => s.destroy());
		};
		const judge = (): void => {
			const poly = points;
			points = [];
			if (poly.length < MIN_POINTS) {
				clearLine();
				return;
			}
			// 線を閉じる
			const first = poly[0];
			addPoint(first[0], first[1]);
			const picked: Coin[] = [];
			let hasKey = false;
			for (let i = 0; i < coins.length; i++) {
				const c = coins[i];
				if (inside(c.x, c.y, poly)) {
					picked.push(c);
					if (c.key) hasKey = true;
				}
			}
			if (picked.length === 0) {
				clearLine();
				setText(msgLabel, "コインを囲んでください");
				return;
			}
			if (!hasKey) {
				// はずれ: 何も変わらず、少しのあいだ線を引けない
				stats.misses++;
				se("ng_se", 0.8);
				showMark("ng");
				setText(msgLabel, picked.length + "枚の中には なかった");
				pushHistory("× " + picked.length + "枚");
				lock = NG_LOCK;
				animate(0.5, (p) => dots.forEach((d) => {
					d.opacity = 1 - p;
					d.modified();
				}), clearLine);
				return;
			}
			// あたり: 囲んだぶんだけが、新しい四角に移る
			stats.hits++;
			const before = coins.length;
			se("ok_se", 0.8);
			showMark("ok");
			pushHistory("○ " + before + " → " + picked.length + "枚");
			lock = 0.5;
			animate(0.4, (p) => {
				field.opacity = 1 - p;
				field.modified();
				dots.forEach((d) => {
					d.opacity = 1 - p;
					d.modified();
				});
			}, () => {
				clearLine();
				scatter(picked.length);
				updateRatio();
				if (coins.length === 1) {
					found();
					return;
				}
				setText(msgLabel, "入っていた! 次の四角へ");
				animate(0.3, (p) => {
					field.opacity = p;
					field.scaleX = field.scaleY = 0.92 + 0.08 * ease(p);
					field.modified();
				});
			});
		};
		// 鍵だけになった
		const found = (): void => {
			phase = "end";
			se("found", 0.8);
			field.opacity = 1;
			field.modified();
			surface.renderer().clear();
			field.invalidate();
			keySprite.show();
			keySprite.scaleX = keySprite.scaleY = 0.2;
			animate(0.8, (p) => {
				keySprite.scaleX = keySprite.scaleY = 0.2 + 1.3 * ease(p);
				keySprite.modified();
			});
			// 残り時間ぶんのボーナス
			const bonus = Math.floor(playLeft * 1000);
			setScore(scoreOf(1) + bonus);
			setText(msgLabel, "見つけた!  時間ボーナス +" + bonus);
		};

		const touch = new g.E({ scene, x: FX, y: FY, width: FS, height: FS, touchable: true });
		uiLayer.append(touch);
		const clamp = (v: number): number => Math.max(0, Math.min(FS, v));
		touch.onPointDown.add((ev) => {
			if (phase !== "play" || lock > 0) return;
			drawing = true;
			clearLine();
			points = [];
			addPoint(clamp(ev.point.x), clamp(ev.point.y));
			se("draw", 0.5);
		});
		touch.onPointMove.add((ev) => {
			if (!drawing) return;
			addPoint(clamp(ev.point.x + ev.startDelta.x), clamp(ev.point.y + ev.startDelta.y));
		});
		touch.onPointUp.add((ev) => {
			if (!drawing) return;
			drawing = false;
			addPoint(clamp(ev.point.x + ev.startDelta.x), clamp(ev.point.y + ev.startDelta.y));
			if (phase === "play") judge();
		});

		scatter(COINS);
		updateRatio();

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(20,22,27,0.9)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 120, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.8;
		introLayer.append(logo);
		const introLines = ["指で丸く囲むと、その中に鍵があるか分かる", "あれば、囲んだぶんだけに しぼられる", "30秒で、どこまで しぼれるか"];
		introLines.forEach((t, i) => label(t, i === 2 ? fontGold : fontCream, 52, 640, 270 + i * 90, introLayer, "center"));
		const countLabel = label("", fontGold, 90, 640, 640, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		const finishPlay = (): void => {
			phase = "end";
			drawing = false;
			points = [];
			clearLine();
			se("finish", 0.8);
			setText(msgLabel, "時間です");
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
			if (phase === "intro") {
				const c = Math.ceil(INTRO_SEC - elapsed);
				if (elapsed > INTRO_SEC - 3 && c !== lastCount && c > 0) {
					lastCount = c;
					setText(countLabel, String(c));
					se("beep", 0.35);
				}
				if (elapsed >= INTRO_SEC) {
					phase = "play";
					introLayer.destroy();
					se("go", 0.7);
					bgm.play().changeVolume(0.35);
				}
				setText(timeLabel, playLeft.toFixed(1));
				return;
			}
			if (phase !== "play") return;
			lock = Math.max(0, lock - dt);
			playLeft = Math.max(0, playLeft - dt);
			setText(timeLabel, playLeft.toFixed(1));
			if (playLeft <= 0) finishPlay();
		});
	});
	g.game.pushScene(scene);
}
