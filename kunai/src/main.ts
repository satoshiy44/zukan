import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const LOG_X = 640; // 丸太の中心
const LOG_Y = 290;
const LOG_R = 150; // 丸太の半径
const THROW_X = 640; // クナイを投げる位置
const THROW_Y = 600;
const THROW_SPEED = 2800; // px/秒
const MIN_GAP = 11; // 刺さったクナイ同士がこの角度(度)より近いと失敗
const KOBAN_GAP = 13; // 小判をとれる角度(度)
const INTRO_SEC = 4;
const RESULT_SEC = 10;
const FEVER_SEC = 10; // 残りこの秒数で得点2倍
const RETRY_SEC = 0.9; // 失敗してからやり直すまで
const HIT_SCORE = 100;
const KOBAN_SCORE = 500;

type Motion = "const" | "reverse" | "sine" | "stopgo" | "boss";
interface StageDef {
	needed: number; // 刺す本数
	obstacles: number[]; // 最初から刺さっているクナイの角度
	kobans: number[]; // 小判の角度
	motion: Motion;
	base: number; // 回転の速さ(度/秒)
	period: number;
	dir: number;
	boss: boolean;
}

// 共通乱数から修行(丸太の回り方と配置)を作る。全員同じ修行で競う
function createStage(random: g.RandomGenerator, i: number): StageDef {
	const r = (): number => random.generate();
	const boss = (i + 1) % 5 === 0;
	const needed = Math.min(4 + Math.floor(i * 0.5), 8) + (boss ? 1 : 0);
	const used: number[] = [];
	const freeAngle = (gap: number): number => {
		for (let k = 0; k < 50; k++) {
			const a = Math.floor(r() * 360);
			if (used.every((u) => Math.abs(((a - u + 540) % 360) - 180) >= gap)) {
				used.push(a);
				return a;
			}
		}
		return Math.floor(r() * 360);
	};
	const obstacles: number[] = [];
	const obsCount = Math.min(Math.floor(i / 2), 3) + (boss ? 1 : 0);
	for (let k = 0; k < obsCount; k++) obstacles.push(freeAngle(36));
	const kobans: number[] = [];
	for (let k = 0; k < 1 + (i % 2); k++) kobans.push(freeAngle(26));
	const motions: Motion[] = ["const", "reverse", "sine", "stopgo"];
	const motion: Motion = boss ? "boss" : i === 0 ? "const" : motions[i % 4];
	const base = Math.min(70 + i * 13, 230) * (0.9 + r() * 0.2);
	return { needed, obstacles, kobans, motion, base, period: 2 + r(), dir: r() < 0.5 ? -1 : 1, boss };
}

// 修行ごとの回転の速さ(度/秒)。t はその修行を始めてからの秒数
// どの回り方でも、全体としては同じ向きに進み、丸太の全周が下に来るようにする
function angularSpeed(s: StageDef, t: number): number {
	const tau = Math.PI * 2;
	switch (s.motion) {
		case "reverse": {
			// 長く進んで、短く戻る
			const ph = (t % s.period) / s.period;
			return s.dir * s.base * (ph < 0.7 ? 1.2 : -0.8);
		}
		case "sine":
			// 速くなったり遅くなったり(止まるくらいまで遅くなるが、戻らない)
			return s.dir * s.base * (1 + 0.85 * Math.sin(tau * t / s.period));
		case "stopgo":
			return (t % 1.4) < 0.55 ? 0 : s.dir * s.base * 2;
		case "boss": {
			// 師匠: 緩急に、ときどき急加速がまざる。向きは変わらない
			const wave = 1 + 0.7 * Math.sin(tau * t / 2.3) + 0.2 * Math.sin(tau * t / 0.8 + 1);
			const dash = (t % 1.9) < 0.22 ? 1.6 : 0;
			return s.dir * s.base * (wave + dash);
		}
		default:
			return s.dir * s.base;
	}
}

const angleDiff = (a: number, b: number): number => Math.abs(((a - b) % 360 + 540) % 360 - 180);

interface Stuck { rel: number; sprite: g.Sprite; mine: boolean; }
interface Koban { rel: number; sprite: g.Sprite; taken: boolean; key: string; }

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "log", "log_boss", "chip", "kunai", "kunai_dark", "koban", "spark", "ninja_idle", "ninja_throw", "logo",
			"throw", "hit", "koban_se", "clang", "break", "clear", "boss", "beep", "go", "finish", "fever", "result", "bgm"
		]
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
		const cosmeticRandom = g.game.random;

		// ---- フォント ----
		const makeFont = (color: string, stroke: string): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: 11
		});
		const fontWhite = makeFont("#ffffff", "#1e2a44");
		const fontYellow = makeFont("#ffe14a", "#3a1a08");
		const fontRed = makeFont("#ff5a4a", "#ffffff");
		const fontPink = makeFont("#ffd0e4", "#5a0a2a");

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
		const logLayer = new g.E({ scene });
		const throwLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const hudLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, logLayer, throwLayer, fxLayer, hudLayer, overLayer].forEach((e) => scene.append(e));
		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));

		// 丸太(刺さったクナイと小判は丸太といっしょに回る)
		const logGroup = new g.E({ scene, x: LOG_X, y: LOG_Y });
		logLayer.append(logGroup);
		const logSprite = new g.Sprite({ scene, src: img("log"), anchorX: 0.5, anchorY: 0.5 });
		const ninja = new g.Sprite({ scene, src: img("ninja_idle"), x: 470, y: 715, anchorX: 0.5, anchorY: 1 });
		ninja.scaleX = ninja.scaleY = 0.62;
		throwLayer.append(ninja);
		const readyKunai = new g.Sprite({ scene, src: img("kunai"), x: THROW_X, y: THROW_Y, anchorX: 0.5, anchorY: 0 });
		throwLayer.append(readyKunai);

		// ---- HUD ----
		const scoreLabel = label("0", fontWhite, 56, 30, 18, hudLayer);
		const timeLabel = label("", fontWhite, 44, 1250, 24, hudLayer, "right");
		const stageLabel = label("", fontYellow, 40, 640, 470, hudLayer, "center");
		const multLabel = label("", fontPink, 32, 34, 88, hudLayer);
		const leftLabel = label("", fontWhite, 40, 900, 560, hudLayer);
		const feverLabel = label("", fontYellow, 30, 1250, 78, hudLayer, "right");

		// ---- 状態 ----
		let phase: "intro" | "play" | "result" = "intro";
		let elapsed = 0;
		const playTime = Math.max(20, time - INTRO_SEC - RESULT_SEC);
		let playLeft = playTime;
		let score = 0;
		let fever = false;
		let streak = 0; // ミスなしで刺した数
		let stageNo = 0;
		let stage: StageDef;
		let stageT = 0;
		let logAngle = 0;
		let stuck: Stuck[] = [];
		let kobans: Koban[] = [];
		let placed = 0; // この修行で刺した本数
		let missedInStage = false;
		let attemptScore = 0; // この挑戦で刺して得た点(カキーンしたら没収)
		let busy = true; // 修行の切りかえ中・失敗中は投げられない
		let flying: g.Sprite | null = null;
		const stats = { hits: 0, miss: 0, clears: 0, koban: 0, bestStreak: 0, perfect: 0 };
		const stages: StageDef[] = [];
		for (let i = 0; i < 30; i++) stages.push(createStage(param.random, i));

		const mult = (): number => 1 + Math.min(streak, 20) * 0.1;
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
		const chips = (x: number, y: number, n: number): void => {
			for (let i = 0; i < n; i++) {
				const c = new g.Sprite({ scene, src: img("chip"), x, y, anchorX: 0.5, anchorY: 0.5 });
				fxLayer.append(c);
				const vx = (cosmeticRandom.generate() - 0.5) * 500, vy0 = -150 - cosmeticRandom.generate() * 250;
				let vy = vy0;
				animate(0.6, (p) => {
					vy += 1400 * dt;
					c.x += vx * dt;
					c.y += vy * dt;
					c.angle += 20;
					c.opacity = 1 - p;
					c.modified();
				}, () => c.destroy());
			}
		};
		const updateLeft = (): void => setText(leftLabel, "のこり " + (stage.needed - placed) + "本");
		const updateMult = (): void => setText(multLabel, streak > 0 ? "れんぞく " + streak + "  ×" + mult().toFixed(1) : "");

		// 丸太にクナイを刺す(rel は丸太から見た角度)
		const addStuck = (rel: number, mine: boolean): void => {
			const rad = rel * Math.PI / 180;
			const sp = new g.Sprite({
				scene, src: img(mine ? "kunai" : "kunai_dark"), anchorX: 0.5, anchorY: 0.16,
				x: Math.cos(rad) * (LOG_R - 6), y: Math.sin(rad) * (LOG_R - 6)
			});
			sp.angle = rel - 90;
			logGroup.append(sp);
			stuck.push({ rel, sprite: sp, mine });
		};

		const setupStage = (): void => {
			logGroup.children?.slice().forEach((c) => {
				if (c !== logSprite) c.destroy();
			});
			if (!logSprite.parent) logGroup.append(logSprite);
			logSprite.src = img(stage.boss ? "log_boss" : "log");
			logSprite.invalidate();
			logGroup.scaleX = logGroup.scaleY = 1;
			logGroup.opacity = 1;
			stuck = [];
			placed = 0;
			stageT = 0;
			logAngle = 0;
			stage.obstacles.forEach((a) => addStuck(a, false));
			kobans = [];
			stage.kobans.forEach((a, i) => {
				const key = stageNo + ":" + i;
				if (takenKoban[key]) return; // 一度とった小判は、やり直しても出ない
				const rad = a * Math.PI / 180;
				const sp = new g.Sprite({
					scene, src: img("koban"), anchorX: 0.5, anchorY: 0.5,
					x: Math.cos(rad) * (LOG_R + 20), y: Math.sin(rad) * (LOG_R + 20)
				});
				sp.angle = a + 90;
				logGroup.append(sp);
				kobans.push({ rel: a, sprite: sp, taken: false, key });
			});
			updateLeft();
		};
		const takenKoban: { [key: string]: boolean } = {};

		const startStage = (next: boolean): void => {
			attemptScore = 0;
			if (next) {
				stage = stages[stageNo % stages.length];
				stageNo++;
				missedInStage = false;
				const name = stage.boss ? "師匠の丸太!!" : "第" + stageNo + "の修行";
				setText(stageLabel, name);
				if (stage.boss) {
					se("boss");
					bigText("師匠の丸太!!", fontRed, 90, 1.2, 300);
				}
			}
			setupStage();
			logGroup.scaleX = logGroup.scaleY = 0.2;
			animate(0.25, (p) => {
				logGroup.scaleX = logGroup.scaleY = 0.2 + 0.8 * p;
				logGroup.modified();
			});
			busy = false;
			readyKunai.show();
		};

		const stageClear = (): void => {
			busy = true;
			stats.clears++;
			const perfect = !missedInStage;
			const bonus = (500 * stageNo + (perfect ? 1000 : 0)) * (fever ? 2 : 1);
			if (perfect) stats.perfect++;
			addScore(bonus);
			se("break");
			se("clear");
			chips(LOG_X, LOG_Y, 24);
			bigText((perfect ? "一発クリア!! " : "修行クリア! ") + "+" + bonus, perfect ? fontYellow : fontWhite, 60, 1.1, 300);
			// 刺さったクナイが飛び散る
			stuck.forEach((s) => {
				const sp = s.sprite;
				const a = (s.rel + logAngle) * Math.PI / 180;
				animate(0.6, (p) => {
					sp.x += Math.cos(a) * 14;
					sp.y += Math.sin(a) * 14 + p * 10;
					sp.opacity = 1 - p;
					sp.modified();
				});
			});
			animate(0.45, (p) => {
				logGroup.scaleX = logGroup.scaleY = 1 + p * 0.3;
				logGroup.opacity = 1 - p;
				logGroup.modified();
			});
			scene.setTimeout(() => {
				if (phase === "play") startStage(true);
			}, 900);
		};

		const fail = (k: g.Sprite): void => {
			busy = true;
			stats.miss++;
			missedInStage = true;
			streak = 0;
			updateMult();
			se("clang");
			const spark = new g.Sprite({ scene, src: img("spark"), x: k.x, y: k.y, anchorX: 0.5, anchorY: 0.5 });
			fxLayer.append(spark);
			animate(0.3, (p) => {
				spark.scaleX = spark.scaleY = 1 + p * 2;
				spark.opacity = 1 - p;
				spark.modified();
			}, () => spark.destroy());
			bigText("カキーン!! やりなおし", fontRed, 70, 0.9, 470);
			// この挑戦で得た点は没収
			if (attemptScore > 0) {
				const lost = Math.min(attemptScore, score);
				addScore(-lost);
				popup("-" + lost, fontRed, 48, 220, 70, 1.0);
				attemptScore = 0;
			}
			const vx = (cosmeticRandom.generate() < 0.5 ? -1 : 1) * 300;
			let vy = 200;
			animate(0.8, (p) => {
				vy += 1500 * dt;
				k.x += vx * dt;
				k.y += vy * dt;
				k.angle += 25;
				k.opacity = 1 - p;
				k.modified();
			}, () => k.destroy());
			scene.setTimeout(() => {
				if (phase === "play") startStage(false);
			}, RETRY_SEC * 1000);
		};

		const land = (k: g.Sprite): void => {
			// 丸太のいちばん下(90度)に刺さる
			const hitStuck = stuck.some((s) => angleDiff(s.rel + logAngle, 90) < MIN_GAP);
			if (hitStuck) {
				fail(k);
				return;
			}
			k.destroy();
			const rel = ((90 - logAngle) % 360 + 360) % 360;
			addStuck(rel, true);
			placed++;
			streak++;
			stats.hits++;
			stats.bestStreak = Math.max(stats.bestStreak, streak);
			const v = Math.round(HIT_SCORE * mult() * (fever ? 2 : 1));
			addScore(v);
			attemptScore += v;
			se("hit");
			chips(LOG_X, LOG_Y + LOG_R, 4);
			popup("+" + Math.round(v), fontWhite, 30, LOG_X + 70, LOG_Y + LOG_R + 10);
			// 丸太がゆれる
			animate(0.12, (p) => {
				logGroup.y = LOG_Y - Math.sin(p * Math.PI) * 10;
				logGroup.modified();
			});
			// 小判
			kobans.forEach((kb) => {
				if (kb.taken || angleDiff(kb.rel + logAngle, 90) >= KOBAN_GAP) return;
				kb.taken = true;
				takenKoban[kb.key] = true;
				stats.koban++;
				const kv = KOBAN_SCORE * (fever ? 2 : 1);
				addScore(kv);
				attemptScore += kv;
				se("koban_se");
				popup("小判! +" + kv, fontYellow, 40, LOG_X - 90, LOG_Y + LOG_R + 10, 1.0);
				const sp = kb.sprite;
				animate(0.5, (p) => {
					sp.y += 6;
					sp.opacity = 1 - p;
					sp.modified();
				}, () => sp.hide());
			});
			updateMult();
			updateLeft();
			if (placed >= stage.needed) stageClear();
		};

		const throwKunai = (): void => {
			if (busy || flying) return;
			const k = new g.Sprite({ scene, src: img("kunai"), x: THROW_X, y: THROW_Y, anchorX: 0.5, anchorY: 0 });
			throwLayer.append(k);
			flying = k;
			readyKunai.hide();
			se("throw");
			ninja.src = img("ninja_throw");
			ninja.invalidate();
			scene.setTimeout(() => {
				ninja.src = img("ninja_idle");
				ninja.invalidate();
				if (!busy) readyKunai.show();
			}, 160);
		};

		scene.onPointDownCapture.add(() => {
			if (phase === "play") throwKunai();
		});

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(20,14,40,0.88)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 90, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.66;
		introLayer.append(logo);
		const introLines = ["タップで クナイを投げる!", "クナイに当たると カキーン!", "全部刺して 次の修行へ!"];
		const introFonts = [fontWhite, fontRed, fontYellow];
		introLines.forEach((t, i) => label(t, introFonts[i], 76, 640, 196 + i * 112, introLayer, "center"));
		const countLabel = label("", fontYellow, 96, 640, 650, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		const finishPlay = (): void => {
			phase = "result";
			busy = true;
			readyKunai.hide();
			se("finish");
			bigText("そこまで!", fontYellow, 110, 1.4, 340);
			scene.setTimeout(showResult, 1500);
		};
		const showResult = (): void => {
			se("result");
			const panel = new g.E({ scene, x: 640, y: 380, anchorX: 0.5, anchorY: 0.5, width: 760, height: 500 });
			overLayer.append(panel);
			panel.append(new g.FilledRect({ scene, cssColor: "#1e2a44", x: -6, y: -6, width: 772, height: 512 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#fffaf0", width: 760, height: 500 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#c62828", width: 760, height: 80 }));
			label("修行の成果", fontWhite, 48, 380, 12, panel, "center");
			label(score + " 点", fontRed, 96, 380, 96, panel, "center");
			const title = stats.clears >= 12 ? "免許皆伝"
				: stats.clears >= 9 ? "上忍"
					: stats.clears >= 6 ? "中忍"
						: stats.clears >= 3 ? "下忍" : "見習い忍者";
			label("称号: " + title, fontYellow, 44, 380, 206, panel, "center");
			[
				"クリアした修行 " + stats.clears + "(一発クリア " + stats.perfect + ")",
				"刺したクナイ " + stats.hits + "本  カキーン " + stats.miss + "回",
				"最大れんぞく " + stats.bestStreak + "  小判 " + stats.koban + "枚"
			].forEach((t, i) => label(t, fontWhite, 32, 380, 286 + i * 56, panel, "center"));
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
			time -= dt;
			elapsed += dt;
			if (phase === "intro") {
				const c = Math.ceil(INTRO_SEC - elapsed);
				if (elapsed > INTRO_SEC - 3 && c !== lastCount && c > 0) {
					lastCount = c;
					setText(countLabel, String(c));
					scene.asset.getAudioById("beep").play().changeVolume(0.35); // カウントダウンの音は小さめに
				}
				if (elapsed >= INTRO_SEC) {
					phase = "play";
					introLayer.destroy();
					se("go");
					bigText("修行はじめ!", fontYellow, 100, 0.9);
					bgm.play().changeVolume(0.45);
					startStage(true);
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
				bigText("ラスト10秒! 得点2倍!!", fontYellow, 70, 1.3, 470);
				setText(feverLabel, "得点×2");
			}
			if (fever) {
				timeLabel.opacity = Math.floor(playLeft * 4) % 2 === 0 ? 1 : 0.55;
				timeLabel.modified();
			}
			if (playLeft <= 0) {
				finishPlay();
				return;
			}
			// 丸太を回す
			if (stage) {
				stageT += dt;
				logAngle = (logAngle + angularSpeed(stage, stageT) * dt) % 360;
				logGroup.angle = logAngle;
				logGroup.modified();
			}
			// 飛んでいるクナイ
			if (flying) {
				const k = flying;
				k.y -= THROW_SPEED * dt;
				k.modified();
				if (k.y <= LOG_Y + LOG_R - 6) {
					flying = null;
					k.y = LOG_Y + LOG_R - 6;
					if (busy) {
						k.destroy();
					} else {
						land(k);
					}
				}
			}
		});
	});
	g.game.pushScene(scene);
}
