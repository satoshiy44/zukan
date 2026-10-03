import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const FIELD_L = 140; // 紅白幕(左右の壁)の内側
const FIELD_R = 1140;
const SHOOT_X = 640; // 発射台
const SHOOT_Y = 92;
const MUZZLE = 96; // 発射台の長さ(玉が出る位置)
const GRAVITY = 780;
const LAUNCH_SPEED = 700;
const BALL_R = 15;
const BIG_BALL_R = 27; // 大玉ころがし
const PEG_R = 14;
const BOUNCE_PEG = 0.8;
const BOUNCE_WALL = 0.8;
const KAGO_Y = 646; // かごの口の高さ
const KAGO_HALF = 78; // かごの口の半分の幅
const INTRO_SEC = 4;
const RESULT_SEC = 10;
const FEVER_SEC = 12; // 残りこの秒数で「大玉ころがし」
const SCORE: { [key: string]: number } = { white: 20, red: 200, gold: 1000 };
const RED_PER_STAGE = 8;

type PegKind = "white" | "red" | "gold";
interface PegDef { x: number; y: number; kind: PegKind; }
interface StageDef { name: string; pegs: PegDef[]; }

// 共通乱数からピンの配置(種目)を作る。全員同じ配置で競う
function createStage(random: g.RandomGenerator, index: number): StageDef {
	const r = (): number => random.generate();
	const pts: { x: number; y: number }[] = [];
	const pattern = index % 4;
	let name = "";
	if (pattern === 0) {
		name = "ならべ玉";
		for (let row = 0; row < 7; row++) {
			for (let col = 0; col < 14; col++) {
				if (r() < 0.12) continue;
				pts.push({ x: 190 + col * 66 + (row % 2) * 33, y: 232 + row * 56 });
			}
		}
	} else if (pattern === 1) {
		name = "にじのアーチ";
		for (let k = 0; k < 6; k++) {
			const rad = 230 + k * 62;
			const n = Math.floor(rad * Math.PI * 0.7 / 54);
			for (let i = 0; i <= n; i++) {
				const a = Math.PI * (1.15 + 0.7 * i / n);
				pts.push({ x: 640 + Math.cos(a) * rad * 1.45, y: 700 + Math.sin(a) * rad });
			}
		}
	} else if (pattern === 2) {
		name = "わっかリレー";
		const centers = [[330, 320], [640, 300], [950, 320], [480, 500], [800, 500]];
		centers.forEach((c) => {
			const cx = c[0], cy = c[1];
			for (let i = 0; i < 11; i++) {
				const a = i / 11 * Math.PI * 2 + r();
				pts.push({ x: cx + Math.cos(a) * 96, y: cy + Math.sin(a) * 82 });
			}
			for (let i = 0; i < 5; i++) {
				const a = i / 5 * Math.PI * 2 + r();
				pts.push({ x: cx + Math.cos(a) * 44, y: cy + Math.sin(a) * 38 });
			}
			pts.push({ x: cx, y: cy });
		});
	} else {
		name = "ジグザグ走";
		for (let row = 0; row < 6; row++) {
			for (let i = 0; i < 16; i++) {
				const x = 186 + i * 58;
				const zig = (i % 4 < 2 ? i % 4 : 4 - i % 4) * 22;
				pts.push({ x, y: 236 + row * 64 + zig });
			}
		}
	}
	// 少しずらして、近すぎるもの・はみ出すものは取りのぞく
	const pegs: PegDef[] = [];
	pts.forEach((p) => {
		const x = p.x + (r() - 0.5) * 12, y = p.y + (r() - 0.5) * 12;
		if (x < FIELD_L + 36 || x > FIELD_R - 36 || y < 210 || y > 615) return;
		if (pegs.some((q) => (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y) < 50 * 50)) return;
		pegs.push({ x, y, kind: "white" });
	});
	// 赤い玉と金メダルを決める
	const idx = pegs.map((_, i) => i);
	for (let i = idx.length - 1; i > 0; i--) {
		const j = Math.floor(r() * (i + 1));
		const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
	}
	const reds = Math.min(RED_PER_STAGE, Math.floor(pegs.length / 3));
	for (let i = 0; i < reds; i++) pegs[idx[i]].kind = "red";
	if (idx.length > reds) pegs[idx[reds]].kind = "gold";
	return { name, pegs };
}

interface Peg {
	def: PegDef;
	sprite: g.Sprite;
	lit: boolean;
	gone: boolean;
}

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "peg_white", "peg_white_lit", "peg_red", "peg_red_lit", "peg_gold", "peg_gold_lit", "ball", "dot", "cannon", "kago",
			"star", "logo", "tanuki_idle", "tanuki_pull",
			"shoot", "hit1", "hit2", "hit3", "hit4", "hit5", "hit6", "hit7", "hit8", "hit9", "hit10", "hit11", "hit12",
			"red", "gold", "kago_se", "clear", "beep", "go", "finish", "fever", "result", "pop", "bgm"
		]
	});
	let time = 80;
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
		const fontWhite = makeFont("#ffffff", "#0d2a5a");
		const fontYellow = makeFont("#ffe14a", "#5a1a08");
		const fontRed = makeFont("#ff5a4a", "#ffffff");
		const fontPink = makeFont("#ffd0e4", "#7a0a2a");

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
		const setImage = (sp: g.Sprite, src: g.ImageAsset): void => {
			if (sp.src === src) return;
			sp.src = src;
			sp.width = sp.srcWidth = src.width;
			sp.height = sp.srcHeight = src.height;
			sp.invalidate();
		};

		// ---- 小さなアニメーション管理 ----
		interface Anim { t: number; dur: number; fn: (p: number) => void; end?: () => void; }
		const anims: Anim[] = [];
		const animate = (dur: number, fn: (p: number) => void, end?: () => void): void => {
			anims.push({ t: 0, dur, fn, end });
		};

		// ---- レイヤー ----
		const bgLayer = new g.E({ scene });
		const fieldLayer = new g.E({ scene });
		const ballLayer = new g.E({ scene });
		const uiLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const hudLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, fieldLayer, ballLayer, uiLayer, fxLayer, hudLayer, overLayer].forEach((e) => scene.append(e));
		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));

		const kago = new g.Sprite({ scene, src: img("kago"), x: SHOOT_X, y: KAGO_Y - 12, anchorX: 0.5, anchorY: 0 });
		fieldLayer.append(kago);
		const ball = new g.Sprite({ scene, src: img("ball"), anchorX: 0.5, anchorY: 0.5, x: SHOOT_X, y: SHOOT_Y });
		ball.hide();
		ballLayer.append(ball);
		const tanukiImages = { idle: img("tanuki_idle"), pull: img("tanuki_pull") };
		const tanuki = new g.Sprite({ scene, src: tanukiImages.idle, x: SHOOT_X - 120, y: 150, anchorX: 0.5, anchorY: 1 });
		tanuki.scaleX = tanuki.scaleY = 0.48;
		uiLayer.append(tanuki);
		const cannon = new g.Sprite({ scene, src: img("cannon"), x: SHOOT_X, y: SHOOT_Y - 6, anchorX: 0.5, anchorY: 0 });
		uiLayer.append(cannon);
		const dots: g.Sprite[] = [];
		for (let i = 0; i < 16; i++) {
			const d = new g.Sprite({ scene, src: img("dot"), anchorX: 0.5, anchorY: 0.5 });
			d.hide();
			uiLayer.append(d);
			dots.push(d);
		}

		// ---- HUD ----
		const scoreLabel = label("0", fontWhite, 56, 160, 118, hudLayer);
		const timeLabel = label("", fontWhite, 44, 1120, 124, hudLayer, "right");
		const stageLabel = label("", fontWhite, 28, 160, 180, hudLayer);
		const redLabel = label("", fontRed, 32, 1120, 176, hudLayer, "right");
		const chainLabel = label("", fontYellow, 44, 640, 640, hudLayer, "center");
		const feverLabel = label("", fontYellow, 30, 640, 196, hudLayer, "center");

		// ---- 状態 ----
		let phase: "intro" | "play" | "result" = "intro";
		let elapsed = 0;
		const playTime = Math.max(20, time - INTRO_SEC - RESULT_SEC);
		let playLeft = playTime;
		let score = 0;
		let shotState: "ready" | "fly" | "resolve" = "ready";
		let aiming = false;
		let aimAngle = Math.PI / 2; // 真下
		let bx = 0, by = 0, vx = 0, vy = 0;
		let ballR = BALL_R;
		let fever = false;
		let shotHits = 0;
		let shotScore = 0;
		let shotTime = 0;
		let slowTime = 0;
		let stageNo = 0;
		let pegs: Peg[] = [];
		const stats = { shots: 0, maxChain: 0, kago: 0, clears: 0, gold: 0, red: 0 };
		const stages: StageDef[] = [];
		for (let i = 0; i < 12; i++) stages.push(createStage(param.random, i));

		const addScore = (v: number): void => {
			score += Math.round(v);
			g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
			setText(scoreLabel, String(score));
		};
		const popup = (text: string, font: g.Font, size: number, x: number, y: number, dur = 0.7): void => {
			const l = label(text, font, size, x, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.y = y - 40 * p;
				l.opacity = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
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
		const burst = (x: number, y: number, n: number): void => {
			for (let i = 0; i < n; i++) {
				const s = new g.Sprite({ scene, src: img("star"), x, y, anchorX: 0.5, anchorY: 0.5 });
				s.scaleX = s.scaleY = 0.5;
				fxLayer.append(s);
				const a = cosmeticRandom.generate() * Math.PI * 2, sp = 120 + cosmeticRandom.generate() * 160;
				animate(0.6, (p) => {
					s.x = x + Math.cos(a) * sp * p;
					s.y = y + Math.sin(a) * sp * p + 60 * p * p;
					s.angle += 12;
					s.opacity = 1 - p;
					s.modified();
				}, () => s.destroy());
			}
		};

		const pegImage = (p: Peg): g.ImageAsset => img("peg_" + p.def.kind + (p.lit ? "_lit" : ""));
		const pegR = (p: Peg): number => p.def.kind === "gold" ? PEG_R + 3 : PEG_R;
		const redsLeft = (): number => pegs.filter((p) => p.def.kind === "red" && !p.gone && !p.lit).length;
		const updateRedLabel = (): void => setText(redLabel, "赤玉 のこり " + redsLeft());

		const loadStage = (): void => {
			pegs.forEach((p) => p.sprite.destroy());
			const def = stages[stageNo % stages.length];
			stageNo++;
			setText(stageLabel, "第" + stageNo + "種目 " + def.name);
			pegs = def.pegs.map((d, i) => {
				const sprite = new g.Sprite({ scene, src: img("peg_" + d.kind), x: d.x, y: d.y, anchorX: 0.5, anchorY: 0.5 });
				sprite.scaleX = sprite.scaleY = 0;
				fieldLayer.append(sprite);
				animate(0.25 + i * 0.006, (p) => {
					const q = Math.max(0, (p * (0.25 + i * 0.006) - i * 0.006) / 0.25);
					sprite.scaleX = sprite.scaleY = q < 1 ? q * 1.15 : 1;
					sprite.modified();
				});
				return { def: d, sprite, lit: false, gone: false };
			});
			updateRedLabel();
		};

		// ---- ねらい ----
		const launchPos = (): { x: number; y: number } => ({
			x: SHOOT_X + Math.cos(aimAngle) * MUZZLE,
			y: SHOOT_Y + Math.sin(aimAngle) * MUZZLE
		});
		const setAim = (x: number, y: number): void => {
			let a = Math.atan2(y - SHOOT_Y, x - SHOOT_X);
			const min = Math.PI * 0.06, max = Math.PI * 0.94; // 下向きだけ
			if (a < min || a > max) a = a < -Math.PI / 2 || a > max ? max : min;
			aimAngle = a;
			cannon.angle = aimAngle * 180 / Math.PI - 90;
			cannon.modified();
			// 玉の飛ぶ道すじ(はね返り前まで)を点で見せる
			const lp = launchPos();
			let px = lp.x, py = lp.y, pvx = Math.cos(aimAngle) * LAUNCH_SPEED, pvy = Math.sin(aimAngle) * LAUNCH_SPEED;
			for (let i = 0; i < dots.length; i++) {
				for (let k = 0; k < 3; k++) {
					pvy += GRAVITY * 0.012;
					px += pvx * 0.012;
					py += pvy * 0.012;
				}
				const inside = px > FIELD_L && px < FIELD_R && py < 700;
				const d = dots[i];
				d.x = px;
				d.y = py;
				d.opacity = 1 - i / dots.length * 0.7;
				if (inside) d.show();
				else d.hide();
				d.modified();
			}
		};
		const hideDots = (): void => dots.forEach((d) => d.hide());

		const fire = (): void => {
			aiming = false;
			hideDots();
			shotState = "fly";
			stats.shots++;
			shotHits = 0;
			shotScore = 0;
			shotTime = 0;
			slowTime = 0;
			ballR = fever ? BIG_BALL_R : BALL_R;
			const lp = launchPos();
			bx = lp.x;
			by = lp.y;
			vx = Math.cos(aimAngle) * LAUNCH_SPEED;
			vy = Math.sin(aimAngle) * LAUNCH_SPEED;
			ball.scaleX = ball.scaleY = ballR / 17;
			ball.show();
			se("shoot");
			tanuki.src = tanukiImages.pull;
			tanuki.invalidate();
			scene.setTimeout(() => {
				tanuki.src = tanukiImages.idle;
				tanuki.invalidate();
			}, 300);
		};

		const chainMult = (n: number): number => n >= 20 ? 5 : n >= 15 ? 4 : n >= 10 ? 3 : n >= 5 ? 2 : 1;

		const hitPeg = (p: Peg): void => {
			p.lit = true;
			setImage(p.sprite, pegImage(p));
			shotHits++;
			stats.maxChain = Math.max(stats.maxChain, shotHits);
			const v = SCORE[p.def.kind] * chainMult(shotHits) * (fever ? 2 : 1);
			shotScore += v;
			addScore(v);
			se("hit" + Math.min(shotHits, 12));
			if (p.def.kind === "red") {
				se("red");
				stats.red++;
				updateRedLabel();
				popup("+" + v, fontYellow, 30, p.def.x, p.def.y - 26);
			} else if (p.def.kind === "gold") {
				se("gold");
				stats.gold++;
				burst(p.def.x, p.def.y, 8);
				popup("金メダル! +" + v, fontYellow, 40, p.def.x, p.def.y - 30, 1.1);
			}
			const m = chainMult(shotHits);
			setText(chainLabel, shotHits >= 3 ? shotHits + "れんさ" + (m > 1 ? " ×" + m : "") : "");
			animate(0.15, (q) => {
				p.sprite.scaleX = p.sprite.scaleY = 1 + Math.sin(q * Math.PI) * 0.35;
				p.sprite.modified();
			});
		};

		// 光ったピンを消す
		const popLit = (stagger: number): void => {
			let i = 0;
			pegs.forEach((p) => {
				if (!p.lit || p.gone) return;
				p.gone = true;
				const sp = p.sprite;
				const delay = i++ * stagger;
				animate(0.2 + delay, (q) => {
					const t = Math.max(0, (q * (0.2 + delay) - delay) / 0.2);
					sp.scaleX = sp.scaleY = 1 + t * 0.6;
					sp.opacity = 1 - t;
					sp.modified();
				}, () => sp.hide());
				if (i % 3 === 1) scene.setTimeout(() => se("pop"), delay * 1000);
			});
		};

		const endShot = (inKago: boolean): void => {
			shotState = "resolve";
			ball.hide();
			setText(chainLabel, "");
			if (inKago) {
				stats.kago++;
				addScore(shotScore); // かごに入ったら、この1投の点が2倍
				se("kago_se");
				burst(kago.x, KAGO_Y, 10);
				bigText("かごイン!! ×2  +" + shotScore, fontYellow, 60, 1.2, 520);
			} else if (shotHits >= 10) {
				bigText(shotHits + "れんさ!!", fontPink, 64, 0.9, 520);
			}
			popLit(0.03);
			const cleared = redsLeft() === 0;
			scene.setTimeout(() => {
				if (phase !== "play") return;
				if (cleared) {
					stats.clears++;
					const bonus = 3000 + 1500 * (stageNo - 1);
					addScore(bonus * (fever ? 2 : 1));
					se("clear");
					bigText("赤玉ぜんぶ!! 種目クリア +" + bonus * (fever ? 2 : 1), fontYellow, 56, 1.4, 360);
					scene.setTimeout(() => {
						if (phase !== "play") return;
						loadStage();
						shotState = "ready";
					}, 1300);
				} else {
					shotState = "ready";
				}
			}, 450);
		};

		// ---- 入力: 押して ねらって はなすと発射 ----
		scene.onPointDownCapture.add((ev) => {
			if (phase !== "play" || shotState !== "ready") return;
			aiming = true;
			setAim(ev.point.x, ev.point.y);
		});
		scene.onPointMoveCapture.add((ev) => {
			if (!aiming) return;
			setAim(ev.point.x + ev.startDelta.x, ev.point.y + ev.startDelta.y);
		});
		scene.onPointUpCapture.add(() => {
			if (aiming && phase === "play" && shotState === "ready") fire();
			aiming = false;
		});

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(10,30,70,0.86)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 90, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.66;
		introLayer.append(logo);
		const introLines = ["ねらって はなす!", "赤い玉を ぜんぶ たおせ!", "かごに入ると 2倍!"];
		const introFonts = [fontWhite, fontRed, fontYellow];
		introLines.forEach((t, i) => label(t, introFonts[i], 76, 640, 196 + i * 112, introLayer, "center"));
		const countLabel = label("", fontYellow, 96, 640, 650, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		const finishPlay = (): void => {
			phase = "result";
			aiming = false;
			hideDots();
			ball.hide();
			setText(chainLabel, "");
			se("finish");
			bigText("しゅうりょう〜!", fontYellow, 100, 1.4, 340);
			scene.setTimeout(showResult, 1500);
		};
		const showResult = (): void => {
			se("result");
			const panel = new g.E({ scene, x: 640, y: 390, anchorX: 0.5, anchorY: 0.5, width: 760, height: 500 });
			overLayer.append(panel);
			panel.append(new g.FilledRect({ scene, cssColor: "#0d2a5a", x: -6, y: -6, width: 772, height: 512 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#fffaf0", width: 760, height: 500 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#e53935", width: 760, height: 80 }));
			label("けっか はっぴょう", fontWhite, 48, 380, 12, panel, "center");
			label(score + " 点", fontRed, 96, 380, 96, panel, "center");
			const title = score >= 30000 ? "玉入れの神さま"
				: score >= 20000 ? "優勝!金メダル"
					: score >= 12000 ? "銀メダル"
						: score >= 6000 ? "銅メダル" : "がんばったで賞";
			label("称号: " + title, fontYellow, 44, 380, 206, panel, "center");
			[
				"クリアした種目 " + stats.clears + "  投げた玉 " + stats.shots + "こ",
				"最大れんさ " + stats.maxChain + "  かごイン " + stats.kago + "回",
				"金メダル " + stats.gold + "こ  たおした赤玉 " + stats.red + "こ"
			].forEach((t, i) => label(t, fontWhite, 32, 380, 286 + i * 56, panel, "center"));
			animate(0.35, (p) => {
				panel.scaleX = panel.scaleY = 0.6 + 0.4 * (1 - Math.pow(1 - p, 3));
				panel.modified();
			});
		};

		const bgm = scene.asset.getAudioById("bgm");

		// ---- 玉の動き(1フレームを細かく分けて計算) ----
		const stepBall = (): boolean => {
			const SUB = 5;
			const h = dt / SUB;
			for (let s = 0; s < SUB; s++) {
				const prevY = by;
				vy += GRAVITY * h;
				bx += vx * h;
				by += vy * h;
				// 左右の壁と天井
				if (bx < FIELD_L + ballR) {
					bx = FIELD_L + ballR;
					vx = Math.abs(vx) * BOUNCE_WALL;
				} else if (bx > FIELD_R - ballR) {
					bx = FIELD_R - ballR;
					vx = -Math.abs(vx) * BOUNCE_WALL;
				}
				if (by < 40 + ballR && vy < 0) vy = -vy;
				// ピン
				for (let i = 0; i < pegs.length; i++) {
					const p = pegs[i];
					if (p.gone) continue;
					const dx = bx - p.def.x, dy = by - p.def.y;
					const rr = ballR + pegR(p);
					const d2 = dx * dx + dy * dy;
					if (d2 >= rr * rr) continue;
					const d = Math.sqrt(d2) || 0.01;
					const nx = dx / d, ny = dy / d;
					bx = p.def.x + nx * rr;
					by = p.def.y + ny * rr;
					const vn = vx * nx + vy * ny;
					if (vn < 0) {
						vx -= (1 + BOUNCE_PEG) * vn * nx;
						vy -= (1 + BOUNCE_PEG) * vn * ny;
					}
					if (!p.lit) hitPeg(p);
				}
				// かご(口を上から通ったら入る)
				if (vy > 0 && prevY < KAGO_Y && by >= KAGO_Y && Math.abs(bx - kago.x) < KAGO_HALF - ballR * 0.5) {
					endShot(true);
					return false;
				}
				if (by > 760) {
					endShot(false);
					return false;
				}
			}
			ball.x = bx;
			ball.y = by;
			ball.angle += vx * dt * 1.5;
			ball.modified();
			// ピンの上で止まってしまったときは、光ったピンを先に消す
			shotTime += dt;
			const speed = Math.sqrt(vx * vx + vy * vy);
			slowTime = speed < 70 ? slowTime + dt : 0;
			if (slowTime > 0.8 || shotTime > 10) {
				popLit(0);
				vx += (cosmeticRandom.generate() - 0.5) * 120;
				slowTime = 0;
				shotTime = Math.min(shotTime, 8);
			}
			return true;
		};

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
			// かごは左右に動く(全員同じ動き)
			kago.x = 640 + 360 * Math.sin(Math.max(0, elapsed - INTRO_SEC) * 0.85);
			kago.modified();

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
					bigText("よーい スタート!", fontYellow, 100, 0.9);
					bgm.play().changeVolume(0.45);
					loadStage();
					setAim(SHOOT_X, 400);
					hideDots();
				}
				setText(timeLabel, "のこり " + Math.ceil(playLeft) + "秒");
				return;
			}
			if (phase !== "play") return;
			playLeft -= dt;
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playLeft)) + "秒");
			if (!fever && playLeft <= FEVER_SEC) {
				fever = true;
				se("fever");
				bigText("ラスト! 大玉ころがし!! 得点2倍", fontYellow, 64, 1.4, 300);
				setText(feverLabel, "大玉ころがし 得点×2");
			}
			if (fever) {
				timeLabel.opacity = Math.floor(playLeft * 4) % 2 === 0 ? 1 : 0.55;
				timeLabel.modified();
			}
			if (playLeft <= 0) {
				finishPlay();
				return;
			}
			if (shotState === "fly") stepBall();
		});
	});
	g.game.pushScene(scene);
}
