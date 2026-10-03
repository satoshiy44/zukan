import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const FLOOR_Y = 640; // 景品が乗る床
const WALL_L = 312; // 景品置き場の左(とりだし口の仕切り)
const WALL_R = 1160; // 景品置き場の右
const BARRIER_TOP = 512; // 仕切りの高さ。これより上から仕切りを越えた景品はとりだし口へ
const CHUTE_X = 208; // とりだし口の真ん中(クレーンの定位置)
const CLAW_UP_Y = 236; // 上がったときのアームの先の高さ
const CLAW_MAX_X = 1110;
const MOVE_SPEED = 400; // 押している間クレーンが進む速さ(px/秒)
const DOWN_SPEED = 1150;
const UP_SPEED = 950;
const BACK_SPEED = 1300;
const GRAVITY = 2200;
const PILE_TOP_LIMIT = 340; // 景品の山の高さの上限(これより上には積まない)
const REFILL_BELOW = 16; // 景品がこれより少なくなったら補充
const INTRO_SEC = 4;
const RESULT_SEC = 10;
const FEVER_SEC = 10;

interface PrizeType {
	id: string;
	name: string;
	w: number; // 当たり判定の幅
	h: number;
	value: number;
	need: number; // しっかりつかむのに必要な「つかみの良さ」(0〜1)
}
const TYPES: PrizeType[] = [
	{ id: "p_candy", name: "あめ", w: 62, h: 36, value: 30, need: 0 },
	{ id: "p_box", name: "おかし", w: 86, h: 72, value: 80, need: 0.25 },
	{ id: "p_plush", name: "ぬいぐるみ", w: 110, h: 108, value: 200, need: 0.4 },
	{ id: "p_big", name: "でかぐるみ", w: 132, h: 135, value: 600, need: 0.55 },
	{ id: "p_gold", name: "金のたぬき", w: 68, h: 76, value: 1500, need: 0.5 }
];
const GOLD = 4;

// 共通乱数で、補充される景品の順番と落とす位置を決める(全員同じ)
interface Drop { type: number; x: number; }
function createDrops(random: g.RandomGenerator, n: number): Drop[] {
	const out: Drop[] = [];
	for (let i = 0; i < n; i++) {
		const r = random.generate();
		// 8こに1こは金のたぬき、あとは あめ・おかし・ぬいぐるみ・でかぐるみ
		const type = i % 8 === 3 ? GOLD : r < 0.34 ? 0 : r < 0.64 ? 1 : r < 0.9 ? 2 : 3;
		out.push({ type, x: random.generate() });
	}
	return out;
}

interface Prize {
	t: PrizeType;
	x: number; // 真ん中
	y: number; // 下のはし
	vy: number;
	state: "pile" | "held" | "chute" | "gone";
	sprite: g.Sprite;
	off: number; // つかまれているときの、アームとの縦のずれ
	offX: number;
	slipAt: number; // つかまれてから落ちるまでの進み具合(1以上なら落ちない)
}

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "chute_front", "barrier", "claw_head", "claw_arm", "p_candy", "p_box", "p_plush", "p_big", "p_gold", "sparkle", "logo",
			"move", "down", "grab", "slip", "miss", "get", "jackpot", "refill", "beep", "go", "finish", "fever", "result", "bgm"
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
		const fontWhite = makeFont("#ffffff", "#5a0a3a");
		const fontYellow = makeFont("#ffe14a", "#5a0a3a");
		const fontPink = makeFont("#ff6aa0", "#ffffff");
		const fontBlue = makeFont("#6af0ff", "#1a1050");

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
		const prizeLayer = new g.E({ scene });
		const clawLayer = new g.E({ scene });
		const frontLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const hudLayer = new g.E({ scene });
		const overLayer = new g.E({ scene });
		[bgLayer, prizeLayer, clawLayer, frontLayer, fxLayer, hudLayer, overLayer].forEach((e) => scene.append(e));
		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));
		frontLayer.append(new g.Sprite({ scene, src: img("chute_front"), x: 109, y: 632 }));
		frontLayer.append(new g.Sprite({ scene, src: img("barrier"), x: WALL_L - 14, y: BARRIER_TOP }));

		// クレーン
		const cable = new g.FilledRect({ scene, cssColor: "#2a2f38", x: CHUTE_X - 4, y: 60, width: 8, height: 10 });
		clawLayer.append(cable);
		const head = new g.Sprite({ scene, src: img("claw_head"), anchorX: 0.5, anchorY: 1 });
		const armL = new g.Sprite({ scene, src: img("claw_arm"), anchorX: 0.35, anchorY: 0.07 });
		const armR = new g.Sprite({ scene, src: img("claw_arm"), anchorX: 0.35, anchorY: 0.07 });
		armR.scaleX = -1;
		clawLayer.append(armL);
		clawLayer.append(armR);
		clawLayer.append(head);
		const trolley = new g.FilledRect({ scene, cssColor: "#ff4a7a", x: 0, y: 46, width: 70, height: 28 });
		clawLayer.append(trolley);

		// ---- HUD ----
		const scoreLabel = label("0", fontWhite, 56, 130, 86, hudLayer);
		const timeLabel = label("", fontWhite, 44, 1150, 90, hudLayer, "right");
		const multLabel = label("", fontYellow, 34, 134, 150, hudLayer);
		const feverLabel = label("", fontYellow, 34, 1150, 146, hudLayer, "right");
		const hintLabel = label("", fontBlue, 40, 700, 4, hudLayer, "center");

		// ---- 状態 ----
		let phase: "intro" | "play" | "result" = "intro";
		let elapsed = 0;
		const playTime = Math.max(20, time - INTRO_SEC - RESULT_SEC);
		let playLeft = playTime;
		let score = 0;
		let fever = false;
		let streak = 0; // 続けて取れた回数
		let clawX = CHUTE_X;
		let clawY = CLAW_UP_Y;
		let open = 1; // アームの開き具合(1=開いている)
		let claw: "ready" | "move" | "down" | "close" | "up" | "back" | "drop" = "ready";
		let clawT = 0; // 今の動きをはじめてからの秒数
		let downTo = FLOOR_Y; // アームが下りる先
		let liftDist = 1; // つかんでから定位置に戻るまでの道のり
		let liftDone = 0;
		let pressing = false;
		let tryGot = 0; // この1回で取れた数
		const prizes: Prize[] = [];
		const stats = { tries: 0, got: 0, gold: 0, big: 0, bestStreak: 0, multi: 0 };
		const drops = createDrops(param.random, 400);
		let dropIdx = 0;

		const mult = (): number => 1 + Math.min(streak, 10) * 0.2;
		const addScore = (v: number): void => {
			score += Math.round(v);
			g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
			setText(scoreLabel, String(score));
		};
		const popup = (text: string, font: g.Font, size: number, x: number, y: number, dur = 0.9): void => {
			const l = label(text, font, size, x, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.y = y - 60 * p;
				l.opacity = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const bigText = (text: string, font: g.Font, size: number, dur: number, y = 330): void => {
			const l = label(text, font, size, 640, y, overLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.scaleX = l.scaleY = p < 0.12 ? 2 - p / 0.12 : 1;
				l.opacity = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const sparkles = (x: number, y: number, n: number): void => {
			for (let i = 0; i < n; i++) {
				const c = new g.Sprite({ scene, src: img("sparkle"), x, y, anchorX: 0.5, anchorY: 0.5 });
				fxLayer.append(c);
				const a = cosmeticRandom.generate() * Math.PI * 2, sp = 150 + cosmeticRandom.generate() * 250;
				animate(0.6, (p) => {
					c.x = x + Math.cos(a) * sp * p;
					c.y = y + Math.sin(a) * sp * p;
					c.scaleX = c.scaleY = 1.4 - p;
					c.opacity = 1 - p;
					c.modified();
				}, () => c.destroy());
			}
		};
		const updateMult = (): void => setText(multLabel, streak > 0 ? "れんぞく " + streak + "  ×" + mult().toFixed(1) : "");

		// ---- 景品の山 ----
		const left = (p: Prize): number => p.x - p.t.w / 2;
		const right = (p: Prize): number => p.x + p.t.w / 2;
		const top = (p: Prize): number => p.y - p.t.h;
		const overlap = (p: Prize, q: Prize): number => Math.min(right(p), right(q)) - Math.max(left(p), left(q));
		const supports = (p: Prize, q: Prize): boolean => overlap(p, q) > 6;
		// p がいまの位置から下に落ちたときに止まる高さ(下のはし)と、支えている景品
		const restOf = (p: Prize): { y: number; lo: number; hi: number } => {
			let y = FLOOR_Y;
			let lo = -9999;
			let hi = 9999;
			for (let i = 0; i < prizes.length; i++) {
				const q = prizes[i];
				if (q === p || q.state !== "pile" || top(q) < p.y - 2 || !supports(p, q)) continue;
				if (top(q) < y - 3) {
					y = top(q);
					lo = left(q);
					hi = right(q);
				} else if (top(q) <= y + 3) {
					// 同じくらいの高さの支えは、まとめて1つの台とみなす
					y = Math.min(y, top(q));
					lo = lo === -9999 ? left(q) : Math.min(lo, left(q));
					hi = hi === 9999 ? right(q) : Math.max(hi, right(q));
				}
			}
			return { y, lo, hi };
		};
		const makePrize = (type: number, x: number, y: number): Prize => {
			const t = TYPES[type];
			const sprite = new g.Sprite({ scene, src: img(t.id), anchorX: 0.5, anchorY: 1, x, y });
			prizeLayer.append(sprite);
			const p: Prize = { t, x, y, vy: 0, state: "pile", sprite, off: 0, offX: 0, slipAt: 2 };
			prizes.push(p);
			return p;
		};
		const pileCount = (): number => prizes.filter((p) => p.state === "pile").length;
		// 落とす位置を、山が高すぎない所から選ぶ
		const dropX = (type: number, r: number): number => {
			const t = TYPES[type];
			const span = WALL_R - WALL_L - t.w - 8;
			let best = WALL_L + 4 + t.w / 2 + r * span;
			let bestTop = -9999;
			for (let k = 0; k < 6; k++) {
				const x = WALL_L + 4 + t.w / 2 + ((r + k * 0.381) % 1) * span;
				const probe: Prize = { t, x, y: -1000, vy: 0, state: "gone", sprite: null as any, off: 0, offX: 0, slipAt: 2 };
				const restTop = restOf(probe).y - t.h;
				if (restTop >= PILE_TOP_LIMIT) return x;
				if (restTop > bestTop) {
					bestTop = restTop;
					best = x;
				}
			}
			return best;
		};
		// 最初の山は、上から積んだ形をすぐ作る
		for (let i = 0; i < 26; i++) {
			const d = drops[dropIdx++];
			const x = dropX(d.type, d.x);
			const p = makePrize(d.type, x, -1000);
			p.y = restOf(p).y;
		}
		let refillQueue = 0;
		let refillTimer = 0;
		const refill = (n: number): void => {
			refillQueue += n;
			se("refill");
			bigText("景品 補充!", fontBlue, 64, 0.9, 250);
		};

		const collect = (p: Prize): void => {
			p.state = "gone";
			p.sprite.destroy();
			tryGot++;
			stats.got++;
			if (p.t === TYPES[GOLD]) stats.gold++;
			if (p.t === TYPES[3]) stats.big++;
			// 1回でたくさん取るほど1こあたりの点が上がる
			const multi = 1 + (tryGot - 1) * 0.5;
			const v = Math.round(p.t.value * multi * mult() * (fever ? 2 : 1));
			addScore(v);
			const isGold = p.t === TYPES[GOLD];
			se(isGold ? "jackpot" : "get");
			sparkles(CHUTE_X, 600, isGold ? 16 : 6);
			const font = isGold || tryGot >= 2 ? fontYellow : fontWhite;
			const text = (tryGot >= 2 ? tryGot + "こ目! " : "") + p.t.name + " +" + v;
			popup(text, font, isGold ? 52 : 40, CHUTE_X + 120, 470 - Math.min(tryGot - 1, 3) * 50, 1.2);
			if (isGold) bigText("金のたぬき!!", fontYellow, 100, 1.2, 330);
		};

		const settle = (): void => {
			// 下にある景品から順に、支えがなければ落とす
			const pile = prizes.filter((p) => p.state === "pile" || p.state === "chute");
			pile.sort((a, b) => b.y - a.y);
			for (let i = 0; i < pile.length; i++) {
				const p = pile[i];
				if (p.state === "chute") {
					p.vy += GRAVITY * dt;
					p.y += p.vy * dt;
					p.x += (CHUTE_X - p.x) * Math.min(1, 5 * dt);
					if (p.y > 820) collect(p);
					continue;
				}
				// 仕切りより左に入ったら、とりだし口へ
				if (p.x < WALL_L && p.y < BARRIER_TOP + 10) {
					p.state = "chute";
					continue;
				}
				if (p.x - p.t.w / 2 < WALL_L && p.y > BARRIER_TOP) p.x = WALL_L + p.t.w / 2;
				if (p.x + p.t.w / 2 > WALL_R) p.x = WALL_R - p.t.w / 2;
				const r = restOf(p);
				if (p.y < r.y - 0.5) {
					p.vy += GRAVITY * dt;
					p.y = Math.min(r.y, p.y + p.vy * dt);
				} else {
					p.y = r.y;
					if (p.vy > 300) se("grab");
					p.vy = 0;
					// 真ん中が支えからはみ出していたら、すべり落ちる
					if (p.x < r.lo || p.x > r.hi) {
						p.x += (p.x < r.lo ? -1 : 1) * 260 * dt;
						// 仕切りに寄りかかったら、仕切りを越えてとりだし口へころがる
						if (p.x < r.lo && left(p) <= WALL_L + 1 && p.y < BARRIER_TOP + 70) {
							p.state = "chute";
							popup("ころがりゲット!?", fontBlue, 40, CHUTE_X + 60, 440, 0.9);
						}
					}
				}
			}
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state === "gone") continue;
				p.sprite.x = p.x;
				p.sprite.y = p.y;
				p.sprite.modified();
			}
			for (let i = prizes.length - 1; i >= 0; i--) if (prizes[i].state === "gone") prizes.splice(i, 1);
		};

		// ---- クレーンの動き ----
		const drawClaw = (): void => {
			head.x = clawX;
			head.y = clawY - 88;
			const ang = 6 + open * 28;
			armL.x = clawX - 20;
			armR.x = clawX + 20;
			armL.y = armR.y = clawY - 96;
			armL.angle = ang;
			armR.angle = -ang;
			cable.x = clawX - 4;
			cable.height = Math.max(1, head.y - head.height - 60 + 6);
			trolley.x = clawX - 35;
			[head, armL, armR, cable, trolley].forEach((e) => e.modified());
		};
		const startDown = (): void => {
			claw = "down";
			clawT = 0;
			se("down");
			// アームの真ん中の下で、いちばん高い景品の上まで下りる
			let target = FLOOR_Y;
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "pile") continue;
				if (right(p) > clawX - 18 && left(p) < clawX + 18) target = Math.min(target, top(p));
			}
			downTo = Math.min(FLOOR_Y - 4, target + 34);
		};
		const doGrab = (): void => {
			// アームの先がとどく景品をつかむ
			const tipTop = downTo - 34;
			const grabbed: Prize[] = [];
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "pile") continue;
				const dx = Math.abs(p.x - clawX);
				if (top(p) > tipTop + 30 || top(p) < tipTop - 30 || dx > p.t.w / 2 + 12) continue;
				grabbed.push(p);
			}
			grabbed.forEach((p) => {
				const dx = Math.abs(p.x - clawX);
				const grip = Math.max(0, 1 - dx / (p.t.w / 2 + 12));
				p.state = "held";
				p.off = p.y - clawY;
				p.offX = (p.x - clawX) * 0.5;
				p.vy = 0;
				// つかみが甘いと、持ち上げる途中で落ちる。甘いほど早く落ちる
				p.slipAt = p.t.need <= 0 || grip >= p.t.need ? 2 : 0.1 + 0.9 * grip / p.t.need;
			});
			se(grabbed.length > 0 ? "grab" : "miss");
			if (grabbed.length >= 2) popup(grabbed.length + "こ つかんだ!", fontYellow, 44, clawX, clawY - 160, 0.9);
		};
		const releaseHeld = (all: boolean): void => {
			const progress = liftDone / liftDist;
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "held" || (!all && progress < p.slipAt)) continue;
				p.state = "pile";
				p.vy = 0;
				if (!all) {
					se("slip");
					popup("ぽろっ…", fontPink, 40, p.x, top(p) - 20, 0.8);
				}
			}
		};
		const endTry = (): void => {
			stats.tries++;
			if (tryGot > 0) {
				streak++;
				stats.bestStreak = Math.max(stats.bestStreak, streak);
				if (tryGot >= 2) {
					stats.multi++;
					bigText(tryGot + "こ どり!!", fontYellow, 90, 1.0, 300);
				}
			} else {
				streak = 0;
			}
			updateMult();
			tryGot = 0;
			if (pileCount() < REFILL_BELOW && refillQueue === 0) refill(8);
			claw = "ready";
			setText(hintLabel, "長押しで右へ → はなすと つかむ");
		};

		const updateClaw = (): void => {
			clawT += dt;
			switch (claw) {
				case "ready":
					open = 1;
					break;
				case "move":
					clawX = Math.min(CLAW_MAX_X, clawX + MOVE_SPEED * dt);
					if (!pressing || clawX >= CLAW_MAX_X) startDown();
					break;
				case "down":
					clawY = Math.min(downTo, clawY + DOWN_SPEED * dt);
					if (clawY >= downTo) {
						claw = "close";
						clawT = 0;
					}
					break;
				case "close":
					open = Math.max(0, 1 - clawT / 0.18);
					if (clawT >= 0.18) {
						doGrab();
						claw = "up";
						clawT = 0;
						liftDist = (clawY - CLAW_UP_Y) + (clawX - CHUTE_X);
						liftDone = 0;
					}
					break;
				case "up": {
					const d = Math.min(UP_SPEED * dt, clawY - CLAW_UP_Y);
					clawY -= d;
					liftDone += d;
					if (clawY <= CLAW_UP_Y) {
						claw = "back";
						clawT = 0;
					}
					break;
				}
				case "back": {
					const d = Math.min(BACK_SPEED * dt, clawX - CHUTE_X);
					clawX -= d;
					liftDone += d;
					if (clawX <= CHUTE_X) {
						claw = "drop";
						clawT = 0;
					}
					break;
				}
				case "drop":
					open = Math.min(1, clawT / 0.2);
					if (clawT >= 0.1) releaseHeld(true);
					// 落ちた景品が全部とりだし口に入るのを待つ
					if (clawT >= 0.4 && !prizes.some((p) => p.state === "chute")) endTry();
					break;
			}
			if (claw === "up" || claw === "back") releaseHeld(false);
			// つかんでいる景品はアームといっしょに動く
			for (let i = 0; i < prizes.length; i++) {
				const p = prizes[i];
				if (p.state !== "held") continue;
				p.x = clawX + p.offX;
				p.y = clawY + p.off;
			}
			drawClaw();
		};

		scene.onPointDownCapture.add(() => {
			pressing = true;
			if (phase === "play" && claw === "ready") {
				claw = "move";
				clawT = 0;
				se("move");
				setText(hintLabel, "");
			}
		});
		scene.onPointUpCapture.add(() => {
			pressing = false;
		});

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		overLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(40,10,50,0.88)", width: 1280, height: 720 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: 640, y: 92, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.68;
		introLayer.append(logo);
		const introLines = ["長押しで クレーンが動く!", "はなすと つかむ!", "とり口に入れば ゲット!"];
		const introFonts = [fontWhite, fontYellow, fontBlue];
		introLines.forEach((t, i) => label(t, introFonts[i], 76, 640, 196 + i * 112, introLayer, "center"));
		const countLabel = label("", fontYellow, 96, 640, 650, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		const finishPlay = (): void => {
			phase = "result";
			pressing = false;
			setText(hintLabel, "");
			se("finish");
			bigText("しゅうりょう!", fontYellow, 110, 1.4, 340);
			scene.setTimeout(showResult, 1500);
		};
		const showResult = (): void => {
			se("result");
			const panel = new g.E({ scene, x: 640, y: 380, anchorX: 0.5, anchorY: 0.5, width: 760, height: 500 });
			overLayer.append(panel);
			panel.append(new g.FilledRect({ scene, cssColor: "#5a0a3a", x: -6, y: -6, width: 772, height: 512 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#fff6fa", width: 760, height: 500 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#e8407a", width: 760, height: 80 }));
			label("取った景品", fontWhite, 48, 380, 12, panel, "center");
			label(score + " 点", fontPink, 96, 380, 96, panel, "center");
			const title = stats.got >= 30 ? "クレーンの神"
				: stats.got >= 22 ? "クレーン名人"
					: stats.got >= 15 ? "上級者"
						: stats.got >= 8 ? "常連さん" : "ビギナー";
			label("称号: " + title, fontYellow, 44, 380, 206, panel, "center");
			[
				"取った景品 " + stats.got + "こ (" + stats.tries + "回中)",
				"金のたぬき " + stats.gold + "こ  でかぐるみ " + stats.big + "こ",
				"最大れんぞく " + stats.bestStreak + "  まとめ取り " + stats.multi + "回"
			].forEach((t, i) => label(t, fontWhite, 32, 380, 286 + i * 56, panel, "center"));
			animate(0.35, (p) => {
				panel.scaleX = panel.scaleY = 0.6 + 0.4 * (1 - Math.pow(1 - p, 3));
				panel.modified();
			});
		};

		const bgm = scene.asset.getAudioById("bgm");
		drawClaw();
		settle();

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
					se("beep");
				}
				if (elapsed >= INTRO_SEC) {
					phase = "play";
					introLayer.destroy();
					se("go");
					bigText("スタート!", fontYellow, 110, 0.9);
					bgm.play().changeVolume(0.4);
					setText(hintLabel, "長押しで右へ → はなすと つかむ");
				}
				setText(timeLabel, "のこり " + Math.ceil(playLeft) + "秒");
				return;
			}
			// 景品はいつでも落ちる
			if (refillQueue > 0) {
				refillTimer -= dt;
				if (refillTimer <= 0) {
					const d = drops[dropIdx++ % drops.length];
					makePrize(d.type, dropX(d.type, d.x), -40);
					refillQueue--;
					refillTimer = 0.12;
				}
			}
			settle();
			if (phase !== "play") return;
			playLeft -= dt;
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playLeft)) + "秒");
			if (!fever && playLeft <= FEVER_SEC) {
				fever = true;
				se("fever");
				bigText("ラスト10秒! 得点2倍!!", fontYellow, 70, 1.3, 250);
				setText(feverLabel, "得点×2");
				refill(6);
			}
			if (fever) {
				timeLabel.opacity = Math.floor(playLeft * 4) % 2 === 0 ? 1 : 0.55;
				timeLabel.modified();
			}
			if (playLeft <= 0) {
				finishPlay();
				return;
			}
			updateClaw();
		});
	});
	g.game.pushScene(scene);
}
