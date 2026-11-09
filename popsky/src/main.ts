import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const H = 720;
const INTRO_SEC = 4;
const END_SEC = 3;
const SHIP_S = 0.9;
const SHIP_HIT = 20; // 自機の当たり判定(半径)。見た目より小さい
const MOVE_RATE = 1.15; // 指を動かした分の何倍動くか
const FIRE_SEC = 0.11;
const SHOT_V = 1300;
const BELL_G = 260; // ベルの重さ
const BELL_KICK = 380; // 撃ったときに上へはねる速さ
const BELL_HITS = 4; // この回数うつと色がかわる
const YELLOW_PTS = [500, 1000, 2000, 4000, 8000, 10000]; // 黄色ベルを続けて取ったときの点
const DAMAGE_PEN = 1000;
const TRIPLE_SEC = 10;
const BOSS_AT = 0.68; // 時間のどのあたりでボスが来るか
const BOSS_HP = 200;
const BOSS_PT = 20000;

type EnemyKind = "puff" | "ufo" | "bird" | "jelly";
interface Enemy {
	kind: EnemyKind; x: number; y: number; vx: number; vy: number; t: number; hp: number; pts: number;
	spr: g.Sprite; flash: number; fire: number; path: number; baseX: number; r: number;
}
interface Shot { x: number; y: number; vx: number; vy: number; spr: g.Sprite; }
interface Bell { x: number; y: number; vy: number; vx: number; color: number; hits: number; spr: g.Sprite; }
interface Fx { e: g.E; vx: number; vy: number; g: number; life: number; max: number; spin: number; grow: number; base: number; }
const BELL_IDS = ["bell_y", "bell_b", "bell_w", "bell_r"];

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"bg", "bgcloud", "island", "ship0", "ship1", "e_puff", "e_ufo", "e_bird", "e_jelly", "boss", "cloud",
		"bell_y", "bell_b", "bell_w", "bell_r", "shot", "ebullet", "fx_star", "fx_glow", "barrier", "fx_ring", "logo"
	];
	const audioIds = ["shot", "hit", "pop", "cloudpop", "ding", "bell", "power", "bomb", "damage", "boom", "warn", "count", "go", "finish"];
	const scene = new g.Scene({ game: g.game, assetIds: imageIds.concat(audioIds.map((a) => "se_" + a), ["bgm", "boss_bgm"]) });
	let time = 70;
	if (param.sessionParameter.totalTimeLimit) time = param.sessionParameter.totalTimeLimit;
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const rand = (): number => param.random.generate();
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const se = (id: string, vol = 0.6): void => {
			scene.asset.getAudioById("se_" + id).play().changeVolume(vol);
		};
		const playSec = Math.max(30, time - INTRO_SEC - END_SEC);

		// ======== 重ね順 ========
		const bgLayer = new g.E({ scene });
		scene.append(bgLayer);
		const root = new g.E({ scene });
		scene.append(root);
		const cloudLayer = new g.E({ scene });
		const enemyLayer = new g.E({ scene });
		const bellLayer = new g.E({ scene });
		const shotLayer = new g.E({ scene });
		const shipLayer = new g.E({ scene });
		const bulletLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		[cloudLayer, enemyLayer, shotLayer, bellLayer, shipLayer, bulletLayer, fxLayer].forEach((e) => root.append(e));
		const ui = new g.E({ scene });
		scene.append(ui);

		// 背景(下へ流れる)
		const bgs: g.Sprite[] = [];
		for (let k = 0; k < 2; k++) {
			const s = new g.Sprite({ scene, src: img("bg"), y: -k * H });
			bgLayer.append(s);
			bgs.push(s);
		}
		const islands: g.Sprite[] = [];
		for (let k = 0; k < 4; k++) {
			const s = new g.Sprite({ scene, src: img("island"), x: rand() * (W - 220), y: k * 190 - 100, scaleX: 0.6 + rand() * 0.5 });
			s.scaleY = s.scaleX;
			bgLayer.append(s);
			islands.push(s);
		}
		const bgClouds: g.Sprite[] = [];
		for (let k = 0; k < 5; k++) {
			const s = new g.Sprite({ scene, src: img("bgcloud"), x: rand() * W - 200, y: rand() * H, opacity: 0.85 });
			bgLayer.append(s);
			bgClouds.push(s);
		}

		// ======== 文字 ========
		const font = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = font("#ffffff", "#3a2050");
		const fontY = font("#ffe04a", "#3a2050");
		const fontP = font("#ff6aa8", "#ffffff");
		const fontB = font("#4ab0ff", "#ffffff");
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
		const scoreLabel = label(ui, fontW, 48, 20, 8, "0");
		const timeLabel = label(ui, fontW, 42, W - 20, 12, "", "right");
		const bellInfo = label(ui, fontY, 30, 22, 64, "", "left", 700);
		const powInfo = label(ui, fontB, 26, W - 22, 62, "", "right", 600);

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
		const ring = (x: number, y: number, size: number, life: number): void => {
			const a = img("fx_ring");
			const s = new g.Sprite({ scene, src: a, x, y, anchorX: 0.5, anchorY: 0.5 });
			const base = size / a.width;
			s.scale(base * 0.2);
			fxLayer.append(s);
			fxs.push({ e: s, vx: 0, vy: 0, g: 0, life, max: life, spin: 0, grow: 1, base });
		};
		const burst = (x: number, y: number, n: number, speed: number, size: number): void => {
			for (let k = 0; k < n; k++) {
				const a = k / n * Math.PI * 2 + rand() * 0.4, v = speed * (0.6 + rand() * 0.6);
				particle("fx_star", x, y, Math.cos(a) * v, Math.sin(a) * v, 0.5, size * (0.6 + rand() * 0.6), 0, (rand() - 0.5) * 16);
			}
			particle("fx_glow", x, y, 0, 0, 0.3, size * 3.5);
		};
		const pop = (t: string, f: g.Font, size: number, x: number, y: number, life = 0.8): void => {
			const l = label(fxLayer, f, size, x, y, t, "center", 500);
			fxs.push({ e: l, vx: 0, vy: -70, g: 0, life, max: life, spin: 0, grow: 0, base: 1 });
		};
		const banners: { e: g.E; life: number }[] = [];
		const banner = (t: string, f: g.Font, size: number, y = 330): void => {
			const e = new g.E({ scene, x: W / 2, y });
			const l = label(e, f, size, 0, -size / 2, t, "center", 1200);
			l.x = -600;
			e.scale(0.3);
			ui.append(e);
			banners.push({ e, life: 1.3 });
		};
		let shake = 0;
		const flash = new g.FilledRect({ scene, cssColor: "#ffffff", width: W, height: H, opacity: 0 });
		ui.append(flash);
		const doFlash = (col: string, a: number): void => {
			flash.cssColor = col; flash.opacity = a; flash.modified();
		};

		// ======== 状態 ========
		let phase: "intro" | "play" | "end" = "intro";
		let introLeft = INTRO_SEC;
		let t = 0;
		let score = 0;
		let sx = W / 2, sy = 590; // 自機
		let fireT = 0;
		let invuln = 0;
		let triple = 0;
		let barrier = false;
		let yellowIdx = 0;
		let enemyT = 1.5;
		let cloudT = 0.8;
		let bossOn = false;
		let bossDone = false;
		let bossHp = BOSS_HP;
		let bossX = W / 2, bossY = -200, bossT = 0, bossFire = 1.5, bossFlash = 0;
		const enemies: Enemy[] = [];
		const shots: Shot[] = [];
		const bullets: Shot[] = [];
		const bells: Bell[] = [];
		const clouds: { x: number; y: number; spr: g.Sprite; hp: number }[] = [];

		const addScore = (p: number): number => {
			score = Math.max(0, score + p);
			g.game.vars.gameState.score = score;
			setText(scoreLabel, String(score));
			return p;
		};
		const ship = new g.Sprite({ scene, src: img("ship0"), anchorX: 0.5, anchorY: 0.5, scaleX: SHIP_S, scaleY: SHIP_S, x: sx, y: sy });
		shipLayer.append(ship);
		const barrierSpr = new g.Sprite({ scene, src: img("barrier"), anchorX: 0.5, anchorY: 0.5, scaleX: 0.95, scaleY: 0.95 });
		barrierSpr.hide();
		shipLayer.append(barrierSpr);
		const boss = new g.Sprite({ scene, src: img("boss"), anchorX: 0.5, anchorY: 0.5, scaleX: 0.85, scaleY: 0.85, x: bossX, y: bossY });
		boss.hide();
		enemyLayer.append(boss);
		const bossBarBack = new g.FilledRect({ scene, cssColor: "#3a2050", x: 390, y: 100, width: 500, height: 18 });
		const bossBar = new g.FilledRect({ scene, cssColor: "#ff6aa8", x: 393, y: 103, width: 494, height: 12 });
		bossBarBack.hide(); bossBar.hide();
		ui.append(bossBarBack); ui.append(bossBar);

		// ======== 操作: どこでもドラッグして動かす(自動で撃つ) ========
		let dragging = false;
		scene.onPointDownCapture.add(() => {
			dragging = true;
		});
		scene.onPointMoveCapture.add((ev) => {
			if (!dragging || phase !== "play") return;
			sx = Math.max(40, Math.min(W - 40, sx + ev.prevDelta.x * MOVE_RATE));
			sy = Math.max(120, Math.min(H - 50, sy + ev.prevDelta.y * MOVE_RATE));
		});
		scene.onPointUpCapture.add(() => {
			dragging = false;
		});

		// ======== 出す ========
		const spawnEnemy = (kind: EnemyKind, x: number, y: number, vx: number, vy: number, path: number): void => {
			const hp = kind === "jelly" ? 4 : kind === "ufo" ? 3 : kind === "bird" ? 1 : 2;
			const pts = kind === "jelly" ? 400 : kind === "ufo" ? 300 : kind === "bird" ? 150 : 200;
			const spr = new g.Sprite({ scene, src: img("e_" + kind), anchorX: 0.5, anchorY: 0.5, scaleX: 0.8, scaleY: 0.8, x, y });
			enemyLayer.append(spr);
			enemies.push({ kind, x, y, vx, vy, t: rand() * 6, hp, pts, spr, flash: 0, fire: 1 + rand() * 2, path, baseX: x, r: 32 });
		};
		const wave = (p: number): void => {
			const r = rand();
			if (r < 0.3) {
				// 鳥が横一列で下りてくる
				const n = 4 + Math.floor(p * 3);
				for (let k = 0; k < n; k++) spawnEnemy("bird", 180 + k * (920 / (n - 1)), -60 - k * 30, 0, 170 + p * 60, 0);
			} else if (r < 0.55) {
				// フグがくねくね
				const x0 = 200 + rand() * 880;
				for (let k = 0; k < 4; k++) spawnEnemy("puff", x0, -60 - k * 90, 0, 140 + p * 50, 1);
			} else if (r < 0.78) {
				// UFOが横から横切る
				const side = rand() < 0.5 ? -1 : 1;
				const uy = 170 + rand() * 120;
				for (let k = 0; k < 3; k++) spawnEnemy("ufo", side < 0 ? -80 - k * 120 : W + 80 + k * 120, uy, -side * 260, 30, 2);
			} else {
				// ゼリーがふわふわ下りて、たまを撃つ
				for (let k = 0; k < 2; k++) spawnEnemy("jelly", 300 + k * 680 + (rand() - 0.5) * 120, -60, 0, 80, 3);
			}
		};
		const spawnCloud = (): void => {
			const x = 120 + rand() * (W - 240);
			const spr = new g.Sprite({ scene, src: img("cloud"), anchorX: 0.5, anchorY: 0.5, x, y: -60, scaleX: 0.8, scaleY: 0.8 });
			cloudLayer.append(spr);
			clouds.push({ x, y: -60, spr, hp: 1 });
		};
		const spawnBell = (x: number, y: number): void => {
			const spr = new g.Sprite({ scene, src: img("bell_y"), anchorX: 0.5, anchorY: 0.5, x, y, scaleX: 0.85, scaleY: 0.85 });
			bellLayer.append(spr);
			bells.push({ x, y, vy: -300, vx: (rand() - 0.5) * 80, color: 0, hits: 0, spr });
		};
		const enemyShot = (x: number, y: number, ang: number, v: number): void => {
			const spr = new g.Sprite({ scene, src: img("ebullet"), anchorX: 0.5, anchorY: 0.5, x, y });
			bulletLayer.append(spr);
			bullets.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, spr });
		};

		// ======== ダメージ・ボム ========
		const damage = (): void => {
			if (invuln > 0) return;
			if (barrier) {
				barrier = false;
				invuln = 1;
				se("pop", 0.7);
				ring(sx, sy, 200, 0.4);
				pop("バリア！", fontB, 34, sx, sy - 90);
				return;
			}
			addScore(-DAMAGE_PEN);
			triple = 0;
			yellowIdx = 0;
			invuln = 2;
			shake = 0.35;
			doFlash("#ff4a6a", 0.4);
			se("damage", 0.7);
			burst(sx, sy, 10, 320, 30);
			pop("あいたた！ -" + DAMAGE_PEN, fontP, 34, sx, sy - 100);
		};
		const killEnemy = (e: Enemy, i: number): void => {
			const pts = addScore(e.pts);
			burst(e.x, e.y, 7, 260, 26);
			pop("+" + pts, fontY, 26, e.x, e.y - 40, 0.6);
			se("pop", 0.35);
			e.spr.destroy();
			enemies.splice(i, 1);
		};
		const bomb = (): void => {
			se("bomb", 0.8);
			doFlash("#ffffff", 0.7);
			shake = 0.4;
			ring(sx, sy, 1400, 0.6);
			bullets.forEach((b) => b.spr.destroy());
			bullets.length = 0;
			for (let i = enemies.length - 1; i >= 0; i--) killEnemy(enemies[i], i);
			if (bossOn) {
				bossHp -= 30; bossFlash = 0.2;
			}
			banner("ボム！", fontB, 90, 300);
		};

		// ======== ベルを取る ========
		const getBell = (b: Bell): void => {
			if (b.color === 0) {
				const pts = addScore(YELLOW_PTS[Math.min(yellowIdx, YELLOW_PTS.length - 1)]);
				yellowIdx++;
				se("bell", 0.7);
				ring(b.x, b.y, 160, 0.35);
				burst(b.x, b.y, 8, 260, 26);
				pop("+" + pts, fontY, pts >= 4000 ? 48 : 36, b.x, b.y - 50);
			} else {
				se("power", 0.7);
				ring(b.x, b.y, 200, 0.4);
				if (b.color === 1) bomb();
				else if (b.color === 2) {
					triple = TRIPLE_SEC;
					banner("3WAYショット！", fontW, 70, 300);
				} else {
					barrier = true;
					banner("バリア！", fontP, 70, 300);
				}
			}
		};

		// ======== はじめの説明 ========
		const intro = new g.E({ scene });
		ui.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(40,30,80,0.55)", width: W, height: H }));
		intro.append(new g.Sprite({ scene, src: img("logo"), x: W / 2, y: 190, anchorX: 0.5, anchorY: 0.5, scaleX: 0.75, scaleY: 0.75 }));
		label(intro, fontW, 34, W / 2, 330, "画面をドラッグして動かそう(たまは自動で出る)", "center", 1200);
		label(intro, fontY, 32, W / 2, 384, "雲を撃つとベル！ベルを撃つと色がかわる", "center", 1200);
		label(intro, fontW, 28, W / 2, 434, "黄=高得点(続けて取るほどアップ)　青=ボム　白=3WAY　赤=バリア", "center", 1200);
		const countLabel = label(intro, fontY, 90, W / 2, 480, "", "center", 400);

		// ======== おしまい ========
		const finish = (): void => {
			phase = "end";
			se("finish", 0.7);
			const over = new g.E({ scene });
			ui.append(over);
			over.append(new g.FilledRect({ scene, cssColor: "rgba(40,30,80,0.5)", width: W, height: H }));
			label(over, fontY, 96, W / 2, 230, "おしまい！", "center", 1000);
			label(over, fontW, 64, W / 2, 360, score + "てん", "center", 1000);
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
					banner("GO！", fontY, 120);
					g.game.audio.music.play(scene.asset.getAudioById("bgm"));
				}
			} else if (phase === "play") {
				t += dt;
				if (t >= playSec) finish();
			}
			const playing = phase === "play";
			const p = Math.min(1, t / playSec);
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playSec - (phase === "intro" ? 0 : t))));
			setText(bellInfo, "つぎの黄ベル +" + YELLOW_PTS[Math.min(yellowIdx, YELLOW_PTS.length - 1)]);
			const pw: string[] = [];
			if (triple > 0) pw.push("3WAY " + Math.ceil(triple));
			if (barrier) pw.push("バリア");
			setText(powInfo, pw.join("  "));

			// 背景
			bgs.forEach((s) => {
				s.y += 60 * dt; if (s.y >= H) s.y -= H * 2; s.modified();
			});
			islands.forEach((s) => {
				s.y += 75 * dt;
				if (s.y > H) {
					s.y = -160; s.x = rand() * (W - 220); s.scaleX = s.scaleY = 0.6 + rand() * 0.5;
				}
				s.modified();
			});
			bgClouds.forEach((s, k) => {
				s.y += (90 + k * 20) * dt;
				if (s.y > H) {
					s.y = -160; s.x = rand() * W - 200;
				}
				s.modified();
			});

			// 自機
			if (invuln > 0) invuln -= dt;
			if (triple > 0) triple -= dt;
			ship.x += (sx - ship.x) * Math.min(1, dt * 20);
			ship.y += (sy - ship.y) * Math.min(1, dt * 20);
			const s0 = ship.x;
			setSrc(ship, Math.floor(t * 12) % 2 ? "ship1" : "ship0");
			ship.angle = Math.max(-15, Math.min(15, (sx - s0) * 0.6));
			ship.opacity = invuln > 0 && Math.floor(invuln * 14) % 2 === 0 ? 0.35 : 1;
			ship.modified();
			if (barrier) {
				barrierSpr.show(); barrierSpr.x = ship.x; barrierSpr.y = ship.y; barrierSpr.angle += 3; barrierSpr.modified();
			} else barrierSpr.hide();
			// 撃つ
			if (playing) {
				fireT -= dt;
				if (fireT <= 0) {
					fireT = FIRE_SEC;
					const add = (dx: number, vx: number): void => {
						const spr = new g.Sprite({ scene, src: img("shot"), anchorX: 0.5, anchorY: 0.5, x: ship.x + dx, y: ship.y - 40 });
						if (vx) spr.angle = vx > 0 ? 14 : -14;
						shotLayer.append(spr);
						shots.push({ x: ship.x + dx, y: ship.y - 40, vx, vy: -SHOT_V, spr });
					};
					add(-14, 0); add(14, 0);
					if (triple > 0) {
						add(-20, -320); add(20, 320);
					}
					if (Math.floor(t / FIRE_SEC) % 3 === 0) se("shot", 0.12);
				}
			}

			// 敵・雲を出す
			if (playing && !bossOn && t < playSec - 2) {
				enemyT -= dt;
				if (enemyT <= 0) {
					wave(p); enemyT = 2.6 - 1.2 * p;
				}
				cloudT -= dt;
				if (cloudT <= 0) {
					spawnCloud(); cloudT = 1.6 + rand() * 0.8;
				}
				if (!bossDone && p >= BOSS_AT) {
					bossOn = true; bossT = 0; bossHp = BOSS_HP; bossY = -200;
					boss.show(); bossBarBack.show(); bossBar.show();
					se("warn", 0.8);
					banner("ボスがきた！", fontP, 90, 330);
					g.game.audio.music.play(scene.asset.getAudioById("boss_bgm"));
				}
			}

			// たま
			for (let i = shots.length - 1; i >= 0; i--) {
				const s = shots[i];
				s.x += s.vx * dt; s.y += s.vy * dt;
				s.spr.x = s.x; s.spr.y = s.y; s.spr.modified();
				let hit = false;
				// ベル: うつと上にはねて、4回で色がかわる
				for (let k = 0; k < bells.length && !hit; k++) {
					const b = bells[k];
					if (Math.abs(b.x - s.x) < 32 && Math.abs(b.y - s.y) < 34) {
						hit = true;
						b.vy = -BELL_KICK; b.vx += (b.x - s.x) * 3;
						b.hits++;
						if (b.hits >= BELL_HITS) {
							b.hits = 0;
							b.color = (b.color + 1) % 4;
							b.spr.src = img(BELL_IDS[b.color]); b.spr.invalidate();
							se("ding", 0.45);
							ring(b.x, b.y, 110, 0.25);
						}
					}
				}
				for (let k = 0; k < clouds.length && !hit; k++) {
					const c = clouds[k];
					if (Math.abs(c.x - s.x) < 56 && Math.abs(c.y - s.y) < 36) {
						hit = true;
						se("cloudpop", 0.5);
						spawnBell(c.x, c.y);
						burst(c.x, c.y, 6, 200, 22);
						c.spr.destroy(); clouds.splice(k, 1);
					}
				}
				for (let k = enemies.length - 1; k >= 0 && !hit; k--) {
					const e = enemies[k];
					if (Math.abs(e.x - s.x) < e.r + 8 && Math.abs(e.y - s.y) < e.r + 10) {
						hit = true;
						e.hp--; e.flash = 0.08;
						if (e.hp <= 0) killEnemy(e, k);
						else se("hit", 0.15);
					}
				}
				if (!hit && bossOn && bossY > 0 && Math.abs(bossX - s.x) < 130 && Math.abs(bossY - s.y) < 100) {
					hit = true;
					bossHp--; bossFlash = 0.06;
					if (bossHp % 6 === 0) se("hit", 0.2);
				}
				if (hit || s.y < -40 || s.x < -40 || s.x > W + 40) {
					s.spr.destroy(); shots.splice(i, 1);
				}
			}

			// 雲
			for (let i = clouds.length - 1; i >= 0; i--) {
				const c = clouds[i];
				c.y += 90 * dt; c.spr.y = c.y; c.spr.modified();
				if (c.y > H + 80) {
					c.spr.destroy(); clouds.splice(i, 1);
				}
			}
			// ベル
			for (let i = bells.length - 1; i >= 0; i--) {
				const b = bells[i];
				b.vy = Math.min(220, b.vy + BELL_G * dt);
				b.y += b.vy * dt; b.x += b.vx * dt; b.vx *= 0.97;
				if (b.x < 40) {
					b.x = 40; b.vx = Math.abs(b.vx);
				}
				if (b.x > W - 40) {
					b.x = W - 40; b.vx = -Math.abs(b.vx);
				}
				if (b.y < 120) {
					b.y = 120; b.vy = Math.max(b.vy, 0);
				}
				b.spr.x = b.x; b.spr.y = b.y; b.spr.angle = Math.sin(t * 8 + i) * 12; b.spr.modified();
				if (playing && Math.abs(b.x - ship.x) < 48 && Math.abs(b.y - ship.y) < 50) {
					getBell(b);
					b.spr.destroy(); bells.splice(i, 1);
					continue;
				}
				if (b.y > H + 60) {
					if (b.color === 0 && yellowIdx > 0) pop("黄ベルのがした…", fontP, 26, b.x, H - 80);
					if (b.color === 0) yellowIdx = 0;
					b.spr.destroy(); bells.splice(i, 1);
				}
			}

			// 敵
			for (let i = enemies.length - 1; i >= 0; i--) {
				const e = enemies[i];
				e.t += dt;
				if (e.path === 1) {
					e.x = e.baseX + Math.sin(e.t * 2.4) * 160;
				} else if (e.path === 2) {
					e.y += Math.sin(e.t * 3) * 60 * dt;
				}
				e.x += e.vx * dt; e.y += e.vy * dt;
				if (e.kind === "bird") e.spr.scaleX = 0.8 * (1 + Math.sin(e.t * 16) * 0.08);
				e.spr.x = e.x; e.spr.y = e.y;
				if (e.flash > 0) {
					e.flash -= dt; e.spr.opacity = 0.5;
				} else e.spr.opacity = 1;
				e.spr.modified();
				// たまを撃つ(自機をねらう)
				if (playing && (e.kind === "jelly" || e.kind === "ufo") && e.y > 60 && e.y < H - 200) {
					e.fire -= dt;
					if (e.fire <= 0) {
						e.fire = (e.kind === "jelly" ? 1.8 : 2.4) - p * 0.6;
						enemyShot(e.x, e.y + 20, Math.atan2(ship.y - e.y, ship.x - e.x), 260 + p * 80);
					}
				}
				if (playing && Math.abs(e.x - ship.x) < e.r + SHIP_HIT && Math.abs(e.y - ship.y) < e.r + SHIP_HIT) damage();
				if (e.y > H + 100 || e.x < -300 || e.x > W + 300) {
					e.spr.destroy(); enemies.splice(i, 1);
				}
			}
			// 敵のたま
			for (let i = bullets.length - 1; i >= 0; i--) {
				const b = bullets[i];
				b.x += b.vx * dt; b.y += b.vy * dt;
				b.spr.x = b.x; b.spr.y = b.y; b.spr.angle += 8; b.spr.modified();
				if (playing && Math.abs(b.x - ship.x) < SHIP_HIT && Math.abs(b.y - ship.y) < SHIP_HIT) {
					damage();
					b.spr.destroy(); bullets.splice(i, 1);
					continue;
				}
				if (b.y > H + 40 || b.y < -40 || b.x < -40 || b.x > W + 40) {
					b.spr.destroy(); bullets.splice(i, 1);
				}
			}

			// ボス
			if (bossOn) {
				bossT += dt;
				bossY += (170 - bossY) * Math.min(1, dt * 1.5);
				bossX = W / 2 + Math.sin(bossT * 0.8) * 380;
				boss.x = bossX; boss.y = bossY + Math.sin(bossT * 3) * 8;
				if (bossFlash > 0) {
					bossFlash -= dt; boss.opacity = 0.6;
				} else boss.opacity = 1;
				boss.modified();
				bossBar.width = 494 * Math.max(0, bossHp) / BOSS_HP; bossBar.modified();
				if (playing && bossY > 100) {
					bossFire -= dt;
					if (bossFire <= 0) {
						bossFire = 1.4;
						const n = bossT % 6 < 3 ? 5 : 7;
						for (let k = 0; k < n; k++) {
							enemyShot(bossX + (k % 2 ? 120 : -120), bossY + 80, Math.PI / 2 + (k - (n - 1) / 2) * 0.22, 240);
						}
					}
					// ボスのまわりの雲(ベル補給)
					if (Math.floor(bossT * 30) % 75 === 0) spawnCloud();
				}
				if (bossHp <= 0) {
					bossOn = false; bossDone = true;
					const pts = addScore(BOSS_PT);
					se("boom", 0.9);
					doFlash("#ffffff", 0.8);
					shake = 0.6;
					for (let k = 0; k < 6; k++) burst(bossX + (rand() - 0.5) * 220, bossY + (rand() - 0.5) * 160, 8, 380, 34);
					ring(bossX, bossY, 600, 0.6);
					banner("ボスげきは！ +" + pts, fontY, 76, 330);
					boss.hide(); bossBarBack.hide(); bossBar.hide();
					bullets.forEach((b) => b.spr.destroy());
					bullets.length = 0;
					g.game.audio.music.play(scene.asset.getAudioById("bgm"));
				}
				if (playing && Math.abs(bossX - ship.x) < 130 && Math.abs(bossY - ship.y) < 90) damage();
			}
			if (phase === "end" && bossOn) {
				boss.y -= 200 * dt; boss.modified();
			}

			// ゆれ・光・エフェクト
			if (shake > 0) {
				shake -= dt;
				root.x = (rand() - 0.5) * 20 * shake / 0.3; root.y = (rand() - 0.5) * 14 * shake / 0.3;
			} else {
				root.x = 0; root.y = 0;
			}
			root.modified();
			if (flash.opacity > 0) {
				flash.opacity = Math.max(0, flash.opacity - dt * 2.5); flash.modified();
			}
			for (let i = fxs.length - 1; i >= 0; i--) {
				const f = fxs[i];
				f.life -= dt;
				f.e.x += f.vx * dt; f.e.y += f.vy * dt; f.vy += f.g * dt;
				f.e.angle += f.spin;
				const r = f.life / f.max;
				if (f.grow) f.e.scaleX = f.e.scaleY = f.base * (0.2 + 0.8 * (1 - r));
				f.e.opacity = Math.min(1, r * 2);
				f.e.modified();
				if (f.life <= 0) {
					f.e.destroy(); fxs.splice(i, 1);
				}
			}
			for (let i = banners.length - 1; i >= 0; i--) {
				const b = banners[i];
				b.life -= dt;
				const k = 1.3 - b.life;
				b.e.scaleX = b.e.scaleY = k < 0.15 ? 0.3 + k / 0.15 * 0.9 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
				b.e.opacity = Math.min(1, b.life * 3);
				b.e.modified();
				if (b.life <= 0) {
					b.e.destroy(); banners.splice(i, 1);
				}
			}
		});
		function setSrc(s: g.Sprite, id: string): void {
			const a = img(id);
			if (s.src !== a) {
				s.src = a; s.invalidate();
			}
		}
	});
	g.game.pushScene(scene);
}
