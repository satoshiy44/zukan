import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const PX = 30; // 額縁の中(絵を作る場所)の左上
const PY = 120;
const PW = 640;
const PH = 480;
const RX = 720; // おてほんの左上(半分の大きさで表示)
const RY = 40;
const RS = 0.5;
const TX = 712; // パーツ置き場の左上
const TY = 318;
const TCW = 140; // パーツ置き場の1マス
const TCH = 196;
const INTRO_SEC = 4;
const PLAY_SEC = 30;
const REVIEW_SEC = 4.5;
const NEXT_SEC = 1.8; // 2枚目の名前を出す時間
const FULL_DIST = 160; // これより離れると0点
const PERFECT_DIST = 10; // これより近いとピッタリ

type Zone = "sky" | "tree" | "ground" | "wall" | "tall" | "floor";
interface PartDef { id: string; zone: Zone; }
interface SceneDef { name: string; bg: string; parts: PartDef[]; }
const SCENES: SceneDef[] = [
	{
		name: "春の野原", bg: "bg_spring", parts: [
			{ id: "p_sakura", zone: "tree" }, { id: "p_tulip_r", zone: "ground" }, { id: "p_tulip_y", zone: "ground" },
			{ id: "p_butterfly", zone: "sky" }, { id: "p_cloud", zone: "sky" }, { id: "p_sun", zone: "sky" },
			{ id: "p_bird", zone: "sky" }, { id: "p_hiyoko", zone: "ground" }
		]
	},
	{
		name: "夏の野原", bg: "bg_summer", parts: [
			{ id: "p_sun_s", zone: "sky" }, { id: "p_himawari_l", zone: "tree" }, { id: "p_himawari_s", zone: "ground" },
			{ id: "p_nyudo", zone: "sky" }, { id: "p_suika", zone: "ground" }, { id: "p_ball", zone: "ground" },
			{ id: "p_parasol", zone: "tree" }, { id: "p_kabuto", zone: "ground" }
		]
	},
	{
		name: "秋の野原", bg: "bg_autumn", parts: [
			{ id: "p_moon", zone: "sky" }, { id: "p_usagi", zone: "ground" }, { id: "p_usagi2", zone: "ground" },
			{ id: "p_susuki", zone: "tree" }, { id: "p_momiji", zone: "tree" }, { id: "p_dango", zone: "ground" },
			{ id: "p_kinoko", zone: "ground" }, { id: "p_tonbo", zone: "sky" }
		]
	},
	{
		name: "冬の野原", bg: "bg_winter", parts: [
			{ id: "p_snowman", zone: "ground" }, { id: "p_momi", zone: "tree" }, { id: "p_kamakura", zone: "ground" },
			{ id: "p_yukiusagi", zone: "ground" }, { id: "p_sori", zone: "ground" }, { id: "p_yukigumo", zone: "sky" },
			{ id: "p_star", zone: "sky" }, { id: "p_robin", zone: "sky" }
		]
	}
];
const ROOM: SceneDef = {
	name: "おへや", bg: "bg_room", parts: [
		{ id: "p_window", zone: "wall" }, { id: "p_clock", zone: "wall" }, { id: "p_picture", zone: "wall" },
		{ id: "p_lamp", zone: "tall" }, { id: "p_table", zone: "floor" }, { id: "p_cat", zone: "floor" },
		{ id: "p_plant", zone: "tall" }, { id: "p_sofa", zone: "floor" }
	]
};
// 置き場所の高さ(絵の中の中心のy)
const ZONE_Y: { [z: string]: number[] } = {
	sky: [55, 185], tree: [230, 300], ground: [335, 430], wall: [70, 210], tall: [300, 360], floor: [345, 420]
};

interface Part {
	id: string;
	tx: number; // おてほんの位置(絵の中の座標)
	ty: number;
	sprite: g.Sprite;
	slot: number; // パーツ置き場のマス
	placed: boolean;
	trayScale: number;
}

export function main(param: GameMainParameterObject): void {
	const partIds: string[] = [];
	SCENES.concat([ROOM]).forEach((s) => s.parts.forEach((p) => partIds.push(p.id)));
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg_spring", "bg_summer", "bg_autumn", "bg_winter", "bg_room", "frame", "frame_s", "ghost", "dot", "logo",
			"pick", "put", "check", "great", "round", "beep", "go", "finish", "bgm"
		].concat(partIds)
	});
	let time = 85;
	if (param.sessionParameter.totalTimeLimit) {
		time = param.sessionParameter.totalTimeLimit;
	}
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const se = (id: string, vol = 0.8): void => {
			scene.asset.getAudioById(id).play().changeVolume(vol);
		};
		const rand = (): number => param.random.generate();

		// ---- フォント(絵本のような、やさしい色) ----
		const makeFont = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontCream = makeFont("#fff6e0", "#5a3a1a");
		const fontGold = makeFont("#f2d48a", "#5a3a1a");
		const fontGreen = makeFont("#d8f4b0", "#2a5a1a");

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
		const setImage = (s: g.Sprite, asset: g.ImageAsset): void => {
			s.src = asset;
			s.width = s.srcWidth = asset.width;
			s.height = s.srcHeight = asset.height;
			s.invalidate();
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
		const paintLayer = new g.E({ scene, x: PX, y: PY }); // 絵を作る場所
		const uiLayer = new g.E({ scene });
		const reviewLayer = new g.E({ scene, x: PX, y: PY });
		const partLayer = new g.E({ scene }); // パーツは画面の座標で動かす
		const fxLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, paintLayer, uiLayer, reviewLayer, partLayer, fxLayer, overLayer].forEach((e) => scene.append(e));
		bgLayer.append(new g.FilledRect({ scene, cssColor: "#3a2c22", width: 1280, height: 720 }));
		// 木の床もよう
		for (let y = 0; y < 720; y += 36) {
			bgLayer.append(new g.FilledRect({ scene, cssColor: "rgba(0,0,0,0.12)", y, width: 1280, height: 2 }));
		}
		const tray = new g.FilledRect({ scene, cssColor: "rgba(255,246,224,0.08)", x: 700, y: 300, width: 572, height: 412 });
		bgLayer.append(tray);
		const paintBg = new g.Sprite({ scene, src: img("bg_spring") });
		paintLayer.append(paintBg);
		uiLayer.append(new g.Sprite({ scene, src: img("frame"), x: PX - 20, y: PY - 20 }));
		const hintLabel = label("おてほんを見て、パーツを額縁に置こう", fontCream, 34, PX + PW / 2, 638, uiLayer, "center");
		const titleLabel = label("", fontGold, 40, PX + PW / 2, 46, uiLayer, "center");
		// おてほん
		const ref = new g.E({ scene, x: RX, y: RY, scaleX: RS, scaleY: RS, anchorX: 0, anchorY: 0 });
		const refBg = new g.Sprite({ scene, src: img("bg_spring") });
		ref.append(refBg);
		const refParts = new g.E({ scene });
		ref.append(refParts);
		uiLayer.append(ref);
		uiLayer.append(new g.Sprite({ scene, src: img("frame_s"), x: RX - 10, y: RY - 10 }));
		label("おてほん", fontGold, 26, RX + 160, RY + 248, uiLayer, "center");
		// 右上の情報
		label("のこり", fontCream, 26, 1166, 40, uiLayer, "center");
		const timeLabel = label("", fontCream, 64, 1166, 70, uiLayer, "center");
		const roundLabel = label("", fontGold, 28, 1166, 150, uiLayer, "center");
		label("とくてん", fontCream, 26, 1166, 196, uiLayer, "center");
		const scoreLabel = label("0", fontGold, 48, 1166, 226, uiLayer, "center");

		// ---- 状態 ----
		let phase: "intro" | "play" | "review" | "next" | "end" = "intro";
		let elapsed = 0;
		let phaseT = 0;
		let round = 0; // 0 = 1枚目、1 = 2枚目
		// 制限時間が短いときは、1枚あたりの時間を短くする
		const playSec = Math.max(10, Math.min(PLAY_SEC, (time - INTRO_SEC - REVIEW_SEC * 2 - NEXT_SEC - 6) / 2));
		let playLeft = playSec;
		let score = 0;
		let parts: Part[] = [];
		// 1枚目は季節をえらぶ。2枚目はおへや
		const firstScene = SCENES[Math.floor(rand() * SCENES.length)];
		const sceneOf = (r: number): SceneDef => (r === 0 ? firstScene : ROOM);

		const slotPos = (i: number): number[] => [TX + (i % 4) * TCW + TCW / 2, TY + Math.floor(i / 4) * TCH + TCH / 2];
		const trayScaleOf = (s: g.Sprite): number => Math.min(1, (TCW - 18) / s.width, (TCH - 30) / s.height);

		// おてほんの配置を作る(毎回ちがう)
		const setupRound = (r: number): void => {
			const sc = sceneOf(r);
			parts.forEach((p) => p.sprite.destroy());
			parts = [];
			refParts.children?.slice().forEach((c) => c.destroy());
			reviewLayer.children?.slice().forEach((c) => c.destroy());
			setImage(paintBg, img(sc.bg));
			setImage(refBg, img(sc.bg));
			setText(titleLabel, (r + 1) + "枚目  " + sc.name);
			setText(roundLabel, (r + 1) + "枚目 / 2枚");
			// 6〜8個を、ばらばらの順でえらぶ
			const pool = sc.parts.slice();
			for (let i = pool.length - 1; i > 0; i--) {
				const j = Math.floor(rand() * (i + 1));
				const t = pool[i];
				pool[i] = pool[j];
				pool[j] = t;
			}
			const n = 6 + Math.floor(rand() * 3);
			const picked = pool.slice(0, n);
			const placed: number[][] = []; // x, y, 半径
			picked.forEach((def, i) => {
				const a = img(def.id);
				const half = Math.max(a.width, a.height) / 2;
				const zy = ZONE_Y[def.zone];
				let best = [PW / 2, (zy[0] + zy[1]) / 2];
				let bestGap = -9999;
				for (let k = 0; k < 80; k++) {
					const x = a.width / 2 + 16 + rand() * (PW - a.width - 32);
					const y = Math.max(a.height / 2 + 8, Math.min(PH - a.height / 2 - 8, zy[0] + rand() * (zy[1] - zy[0])));
					// ほかのパーツとの重なりが、いちばん少ない場所をえらぶ
					let gap = 9999;
					placed.forEach((q) => {
						gap = Math.min(gap, Math.sqrt((x - q[0]) * (x - q[0]) + (y - q[1]) * (y - q[1])) - (half + q[2]) * 0.7);
					});
					if (gap > bestGap) {
						bestGap = gap;
						best = [x, y];
					}
					if (gap > 0) break;
				}
				placed.push([best[0], best[1], half]);
				// おてほんに描く
				refParts.append(new g.Sprite({ scene, src: a, x: best[0], y: best[1], anchorX: 0.5, anchorY: 0.5 }));
				// 置き場のパーツ
				const s = new g.Sprite({ scene, src: a, anchorX: 0.5, anchorY: 0.5, touchable: true });
				const part: Part = { id: def.id, tx: best[0], ty: best[1], sprite: s, slot: i, placed: false, trayScale: trayScaleOf(s) };
				toTray(part, false);
				partLayer.append(s);
				bindDrag(part);
				parts.push(part);
			});
			// 置き場のマスの順番もばらばらにする
			const order = parts.map((_, i) => i);
			for (let i = order.length - 1; i > 0; i--) {
				const j = Math.floor(rand() * (i + 1));
				const t = order[i];
				order[i] = order[j];
				order[j] = t;
			}
			parts.forEach((p, i) => {
				p.slot = order[i];
				toTray(p, false);
			});
		};
		const toTray = (p: Part, anim: boolean): void => {
			const pos = slotPos(p.slot);
			p.placed = false;
			if (!anim) {
				p.sprite.x = pos[0];
				p.sprite.y = pos[1];
				p.sprite.scaleX = p.sprite.scaleY = p.trayScale;
				p.sprite.modified();
				return;
			}
			const sx = p.sprite.x, sy = p.sprite.y, ss = p.sprite.scaleX;
			animate(0.2, (q) => {
				const e = ease(q);
				p.sprite.x = sx + (pos[0] - sx) * e;
				p.sprite.y = sy + (pos[1] - sy) * e;
				p.sprite.scaleX = p.sprite.scaleY = ss + (p.trayScale - ss) * e;
				p.sprite.modified();
			});
		};

		// ---- ドラッグ ----
		let dragging: Part | null = null;
		let gx = 0; // 指の位置(画面の座標)
		let gy = 0;
		const bindDrag = (p: Part): void => {
			const s = p.sprite;
			s.onPointDown.add((ev) => {
				if (phase !== "play" || dragging) return;
				dragging = p;
				gx = s.x + (ev.point.x - s.width / 2) * s.scaleX;
				gy = s.y + (ev.point.y - s.height / 2) * s.scaleY;
				// いちばん手前に出して、実物大にする
				partLayer.remove(s);
				partLayer.append(s);
				s.scaleX = s.scaleY = 1;
				s.x = gx;
				s.y = gy;
				s.modified();
				se("pick", 0.5);
			});
			s.onPointMove.add((ev) => {
				if (dragging !== p) return;
				gx += ev.prevDelta.x;
				gy += ev.prevDelta.y;
				s.x = gx;
				s.y = gy;
				s.modified();
			});
			s.onPointUp.add(() => {
				if (dragging !== p) return;
				dragging = null;
				drop(p);
			});
		};
		const drop = (p: Part): void => {
			const s = p.sprite;
			// 額縁の中なら置く。外なら置き場にもどす
			if (s.x > PX - 30 && s.x < PX + PW + 30 && s.y > PY - 30 && s.y < PY + PH + 30) {
				s.x = Math.max(PX, Math.min(PX + PW, s.x));
				s.y = Math.max(PY, Math.min(PY + PH, s.y));
				s.modified();
				p.placed = true;
				se("put", 0.6);
				animate(0.15, (q) => {
					s.scaleX = s.scaleY = 1 + 0.08 * Math.sin(q * Math.PI);
					s.modified();
				});
			} else {
				toTray(p, true);
			}
		};

		// ---- 答え合わせ ----
		const popup = (text: string, font: g.Font, size: number, x: number, y: number, dur = 1.0): void => {
			const l = label(text, font, size, x, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (q) => {
				l.y = y - 30 * q;
				l.opacity = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const review = (): void => {
			phase = "review";
			phaseT = 0;
			if (dragging) {
				drop(dragging);
				dragging = null;
			}
			setText(hintLabel, "こたえあわせ");
			let total = 0;
			let accSum = 0;
			parts.forEach((p, i) => {
				scene.setTimeout(() => {
					// おてほんの位置をうすく出して、置いた場所と線でつなぐ
					const ghost = new g.Sprite({ scene, src: img(p.id), x: p.tx, y: p.ty, anchorX: 0.5, anchorY: 0.5 });
					ghost.opacity = 0.45;
					reviewLayer.append(ghost);
					reviewLayer.append(new g.Sprite({ scene, src: img("ghost"), x: p.tx, y: p.ty, anchorX: 0.5, anchorY: 0.5 }));
					let pts = 0;
					let acc = 0;
					if (p.placed) {
						const px = p.sprite.x - PX, py = p.sprite.y - PY;
						const d = Math.sqrt((px - p.tx) * (px - p.tx) + (py - p.ty) * (py - p.ty));
						acc = Math.max(0, 1 - d / FULL_DIST);
						pts = Math.round(1000 * acc * acc);
						const steps = Math.floor(d / 10);
						for (let k = 1; k < steps; k++) {
							const dx = px + (p.tx - px) * k / steps, dy = py + (p.ty - py) * k / steps;
							reviewLayer.append(new g.Sprite({ scene, src: img("dot"), x: dx, y: dy, anchorX: 0.5, anchorY: 0.5 }));
						}
						if (d < PERFECT_DIST) {
							pts += 500;
							popup("ピッタリ! +" + pts, fontGold, 34, p.sprite.x, p.sprite.y - 50, 1.4);
							se("great", 0.6);
						} else {
							popup("+" + pts, pts >= 500 ? fontGreen : fontCream, 32, p.sprite.x, p.sprite.y - 40, 1.4);
							se("check", 0.5);
						}
					} else {
						popup("置いてない", fontCream, 28, PX + p.tx, PY + p.ty, 1.4);
						se("check", 0.3);
					}
					total += pts;
					accSum += acc;
					score += pts;
					g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
					setText(scoreLabel, String(score));
					if (i === parts.length - 1) {
						const rate = Math.round(accSum / parts.length * 100);
						setText(hintLabel, "そっくり度 " + rate + "%   +" + total + "点");
						se("round", 0.6);
					}
				}, 250 + i * 300);
			});
		};

		const startPlay = (): void => {
			phase = "play";
			phaseT = 0;
			playLeft = playSec;
			setText(hintLabel, "おてほんを見て、パーツを額縁に置こう");
			se("go", 0.6);
		};
		const nextRound = (): void => {
			round++;
			phase = "next";
			phaseT = 0;
			setupRound(round);
			const l = label("2枚目  " + sceneOf(round).name, fontGold, 80, 640, 360, overLayer, "center");
			l.anchorY = 0.5;
			animate(NEXT_SEC, (q) => {
				l.opacity = q < 0.8 ? 1 : 1 - (q - 0.8) / 0.2;
				l.modified();
			}, () => l.destroy());
		};
		const finish = (): void => {
			phase = "end";
			se("finish", 0.7);
			setText(hintLabel, "おしまい!  " + score + "点");
		};

		setupRound(0);

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(40,28,20,0.96)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 200, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.85;
		introLayer.append(logo);
		label("おてほんと同じ場所に、パーツを置こう!", fontCream, 52, 640, 400, introLayer, "center");
		const countLabel = label("", fontGold, 96, 640, 600, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

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
			phaseT += dt;
			if (phase === "intro") {
				const c = Math.ceil(INTRO_SEC - elapsed);
				if (elapsed > INTRO_SEC - 3 && c !== lastCount && c > 0) {
					lastCount = c;
					setText(countLabel, String(c));
					se("beep", 0.35);
				}
				if (elapsed >= INTRO_SEC) {
					introLayer.destroy();
					bgm.play().changeVolume(0.35);
					startPlay();
				}
				setText(timeLabel, String(Math.ceil(playSec)));
				return;
			}
			if (phase === "play") {
				playLeft = Math.max(0, playLeft - dt);
				setText(timeLabel, String(Math.ceil(playLeft)));
				timeLabel.opacity = playLeft <= 5 && Math.floor(playLeft * 4) % 2 === 0 ? 0.5 : 1;
				timeLabel.modified();
				if (playLeft <= 0) review();
			} else if (phase === "review" && phaseT >= REVIEW_SEC) {
				if (round === 0) nextRound();
				else finish();
			} else if (phase === "next" && phaseT >= NEXT_SEC) {
				startPlay();
			}
		});
	});
	g.game.pushScene(scene);
}
