import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const H = 720;
const INTRO_SEC = 5;
const END_SEC = 3;
const FIRST_SEC = 1.2; // スタートしてから最初の印までの秒
const LEAD = 1.6; // 印がレーンの右はしから判定の輪までくる秒
const PERFECT_W = 0.075; // ぴったりの幅(秒)
const GOOD_W = 0.15; // まあまあの幅(秒)
const HAND_PRE = 0.12; // たぬきの手が臼に入っているあいだ(手の印の前後、秒)
const HAND_POST = 0.16;
const PERFECT_PT = 100;
const GOOD_PT = 50;
const OUCH_PT = 300; // 手をついたときに引かれる点
const PER_MOCHI = 16; // これだけつくと、おもちが1つ完成
const MOCHI_PT = 500; // おもち完成のボーナス(+ ぴったり1回ごとに 50)
const JUDGE_X = 200; // 判定の輪の位置
const LANE_END = 1240;
const LANE_Y = 150;
const MOCHI_X = 640;
const MOCHI_Y = 540; // もちの下のはし
const STAGE_S = 0.85; // 舞台の大きさ

// 区間ごとのテンポと、出てくる並び(8分音符8つで1小節。T=つく h=たぬきの手 .=休み)
interface Section { t: number; bpm: number; pats: string[]; name: string; rush: boolean; }
const SECTIONS: Section[] = [
	{ t: 0, bpm: 96, pats: ["ThThThTh"], name: "", rush: false },
	{ t: 12, bpm: 108, pats: ["ThThThTh", "ThT.ThTT", "ThThTh.h"], name: "テンポアップ！", rush: false },
	{ t: 24, bpm: 120, pats: ["ThThThTh", "ThT.ThTT", "Th.hThTh", "ThThh.Th"], name: "もっと速く！", rush: false },
	{ t: 36, bpm: 132, pats: ["ThThThTh", "TTTTThTh", "Th.hThTh", "ThTh..Th", "ThT.ThTT"], name: "れんだも来るよ！", rush: false },
	{ t: 48, bpm: 146, pats: ["TTTTThTh", "Th.hThTh", "ThT.ThTT", "ThThThTh", "TTThTTTh"], name: "大もちラッシュ！ 点数2ばい", rush: true }
];
// 琴のメロディ(8分音符ごと。-1 は休み)。陽音階の 0〜9 番
const MELODY = [
	5, -1, 4, 5, 7, -1, 5, -1, 4, -1, 2, 4, 5, -1, -1, -1,
	3, -1, 4, 5, 4, -1, 2, -1, 1, -1, 2, 4, 2, -1, -1, -1,
	5, -1, 7, 8, 7, -1, 5, 4, 5, -1, 7, -1, 9, -1, 8, 7,
	5, -1, 4, 2, 4, -1, 5, -1, 2, -1, 1, -1, 0, -1, -1, -1
];
const MOCHI_TYPES = ["m_kin", "m_ichigo", "m_kinako", "m_anko", "m_kusa"];
const MOCHI_NAMES = ["金ぱくもち", "いちご大福", "きなこもち", "あんこもち", "草もち"];

interface Ev { t: number; kind: "T" | "h"; done: boolean; res: string; rush: boolean; }
interface Slot { t: number; idx: number; beat: boolean; rush: boolean; }
interface Part {
	x: number; y: number; vx: number; vy: number; g: number; life: number; max: number;
	size: number; col: string; img: string; spin: number;
}
interface Pop { l: g.Label; life: number; vy: number; scale: number; }

class View extends g.E {
	draw: (r: g.Renderer) => void = () => undefined;
	override renderSelf(r: g.Renderer): boolean {
		this.draw(r);
		return true;
	}
}

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"bg", "crowd0", "crowd1", "usu", "usu_front", "mochi", "usagi_up", "usagi_mid", "usagi_down",
		"tanuki_idle", "tanuki_hand", "tanuki_ouch", "note_tsuki", "note_te", "judge", "ring", "tray", "spark", "star", "splash", "logo"
	].concat(MOCHI_TYPES);
	const audioIds = [
		"don", "ka", "pettan", "perfect", "good", "miss", "ouch", "hai", "complete", "count", "go", "finish", "rush", "cheer"
	];
	for (let i = 0; i < 10; i++) audioIds.push("k" + i);
	const scene = new g.Scene({ game: g.game, assetIds: imageIds.concat(audioIds.map((a) => "se_" + a)) });
	let time = 70;
	if (param.sessionParameter.totalTimeLimit) time = param.sessionParameter.totalTimeLimit;
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const rand = (): number => param.random.generate();
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const surf: { [id: string]: g.Surface } = {};
		imageIds.forEach((id) => {
			surf[id] = g.SurfaceUtil.asSurface(img(id))!;
		});
		const se = (id: string, vol = 0.6): void => {
			scene.asset.getAudioById("se_" + id).play().changeVolume(vol);
		};
		const playSec = Math.max(30, time - INTRO_SEC - END_SEC);

		// ======== 譜面: 参加者みんな同じ ========
		const evs: Ev[] = [];
		const slots: Slot[] = [];
		const sectionAt = (t: number): Section => {
			let s = SECTIONS[0];
			SECTIONS.forEach((q) => {
				if (t >= q.t * playSec / 62) s = q;
			});
			return s;
		};
		{
			let t = FIRST_SEC;
			let idx = 0;
			let bar = 0;
			while (t < playSec - 0.8) {
				const sec = sectionAt(t);
				const slot = 60 / sec.bpm / 2;
				const pat = bar < 2 ? sec.pats[0] : sec.pats[Math.floor(rand() * sec.pats.length)];
				for (let k = 0; k < 8 && t < playSec - 0.8; k++) {
					const c = pat.charAt(k);
					if (c === "T" || c === "h") evs.push({ t, kind: c, done: false, res: "", rush: sec.rush });
					slots.push({ t, idx: idx++, beat: k % 2 === 0, rush: sec.rush });
					t += slot;
				}
				bar++;
			}
		}

		// ======== 状態 ========
		let phase: "intro" | "play" | "end" = "intro";
		let introLeft = INTRO_SEC;
		let now = 0; // 曲の時間(秒)
		let score = 0;
		let combo = 0;
		let maxCombo = 0;
		let hits = 0; // いまのおもちを何回ついたか
		let perfectsInMochi = 0;
		const made: number[] = []; // 完成したおもちの種類
		let slotIdx = 0;
		let lastBeat = -9;
		let lastHit = -9; // うさぎが杵をおろした時刻
		let ouchT = 0;
		let squash = 0;
		let shake = 0;
		let flash = 0;
		let flashCol = "#ffffff";
		let crowdT = 0;
		let cheer = 0;
		let sectionName = "";
		const parts: Part[] = [];

		// ======== 絵 ========
		const bg = new g.Sprite({ scene, src: img("bg") });
		scene.append(bg);
		const view = new View({ scene, width: W, height: H });
		scene.append(view);
		const nextT = (): Ev | null => {
			for (let i = 0; i < evs.length; i++) if (!evs[i].done && evs[i].kind === "T" && evs[i].t > now - GOOD_W) return evs[i];
			return null;
		};
		// たぬきの手が臼に入っていれば、その手の印までの近さ(秒)。入っていなければ -1
		const handNear = (): number => {
			for (let i = 0; i < evs.length; i++) {
				const e = evs[i];
				if (e.kind === "h" && now >= e.t - HAND_PRE && now <= e.t + HAND_POST) return Math.abs(e.t - now);
				if (e.t > now + 1) break;
			}
			return -1;
		};
		const handIn = (): boolean => handNear() >= 0;
		const slotLen = (): number => 60 / sectionAt(now).bpm / 2;
		const drawImg = (r: g.Renderer, id: string, x: number, y: number, sx = 1, sy = 1, alpha = 1): void => {
			const a = img(id);
			r.save();
			if (alpha < 1) r.opacity(alpha);
			r.transform([sx, 0, 0, sy, x, y]);
			r.drawImage(surf[id], 0, 0, a.width, a.height, 0, 0);
			r.restore();
		};
		view.draw = (r: g.Renderer): void => {
			r.save();
			if (shake > 0) r.translate(Math.sin(shake * 70) * shake * 18, Math.cos(shake * 53) * shake * 10);
			// 観客
			drawImg(r, "crowd" + (Math.floor(crowdT) % 2), 0, 318);
			// 舞台(臼・もち・うさぎ・たぬき)は少し小さく、画面の下はしを中心にちぢめる
			r.save();
			r.transform([STAGE_S, 0, 0, STAGE_S, W / 2 * (1 - STAGE_S), H * (1 - STAGE_S)]);
			// 臼ともち
			drawImg(r, "usu", MOCHI_X - 230, 470);
			const grow = 0.72 + 0.4 * Math.min(1, hits / PER_MOCHI);
			const sq = Math.max(0, squash);
			const mw = 300 * grow * (1 + sq * 0.35), mh = 170 * grow * (1 - sq * 0.45);
			drawImg(r, "mochi", MOCHI_X - mw / 2, MOCHI_Y - mh, mw / 300, mh / 170);
			drawImg(r, "usu_front", MOCHI_X - 230, 530);
			// うさぎ(つき手)
			const n = nextT();
			let uid = "usagi_mid";
			if (now - lastHit < 0.12) uid = "usagi_down";
			else if (phase === "play" && n && n.t - now < slotLen() * 1.1) uid = "usagi_up";
			drawImg(r, uid, 230, 63);
			// たぬき(返し手)
			const tid = ouchT > 0 ? "tanuki_ouch" : handIn() ? "tanuki_hand" : "tanuki_idle";
			drawImg(r, tid, 640, 90);
			// 完成したおもち(おぼんの上に積む)
			drawImg(r, "tray", 1010, 650);
			made.forEach((m, i) => {
				const col = i % 2, row = Math.floor(i / 2);
				if (row > 4) return;
				drawImg(r, MOCHI_TYPES[m], 1040 + col * 100 + (row % 2) * 30, 590 - row * 56, 0.8, 0.8);
			});
			// タイミングの輪(もちの上で小さくなる)
			if (n && phase === "play") {
				const k = (n.t - now) / (slotLen() * 2);
				if (k > -0.1 && k < 1) {
					const s = 0.28 + Math.max(0, k) * 0.9;
					const a = img("ring");
					drawImg(r, "ring", MOCHI_X - a.width * s / 2, MOCHI_Y - 70 - a.height * s / 2, s, s, Math.min(1, (1 - k) * 2));
				}
			}
			// パーティクル
			parts.forEach((p) => {
				r.save();
				r.opacity(Math.min(1, p.life / p.max * 2));
				if (p.img) {
					const a = img(p.img);
					const s = p.size / a.width;
					r.transform([s * Math.cos(p.spin), s * Math.sin(p.spin), -s * Math.sin(p.spin), s * Math.cos(p.spin), p.x, p.y]);
					r.drawImage(surf[p.img], 0, 0, a.width, a.height, -a.width / 2, -a.height / 2);
				} else {
					r.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.col);
				}
				r.restore();
			});
			r.restore();
			r.restore();
			// レーン
			r.save();
			r.opacity(0.75);
			r.fillRect(110, LANE_Y - 48, LANE_END - 80, 96, "#3a1e2a");
			r.restore();
			r.fillRect(110, LANE_Y - 48, LANE_END - 80, 4, "#ffd040");
			r.fillRect(110, LANE_Y + 44, LANE_END - 80, 4, "#ffd040");
			const jd = img("judge");
			const pulse = 1 + Math.max(0, 0.15 - (now - lastBeat)) * 1.2; // 太鼓に合わせてふくらむ
			drawImg(r, "judge", JUDGE_X - jd.width * pulse / 2, LANE_Y - jd.height * pulse / 2, pulse, pulse);
			for (let i = evs.length - 1; i >= 0; i--) {
				const e = evs[i];
				const dtt = e.t - now;
				if (dtt > LEAD || dtt < -0.4) continue;
				if (e.kind === "T" && e.done) continue;
				const x = JUDGE_X + dtt / LEAD * (LANE_END - JUDGE_X);
				const id = e.kind === "T" ? "note_tsuki" : "note_te";
				const s = e.kind === "T" ? 0.9 : 0.72;
				const a = img(id);
				drawImg(r, id, x - a.width * s / 2, LANE_Y - a.height * s / 2, s, s, dtt < 0 ? Math.max(0, 1 + dtt * 3) : 1);
			}
			if (flash > 0) {
				r.save();
				r.opacity(Math.min(0.5, flash));
				r.fillRect(0, 0, W, H, flashCol);
				r.restore();
			}
		};

		// ======== 文字 ========
		const font = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 72, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = font("#ffffff", "#3a1e2a");
		const fontY = font("#ffe840", "#3a1e2a");
		const fontR = font("#ff5a6a", "#ffffff");
		const fontP = font("#ff8ad8", "#ffffff");
		const fontC = font("#70e8ff", "#3a1e2a");
		type Align = "left" | "center" | "right";
		const label = (f: g.Font, size: number, x: number, y: number, text: string, align: Align = "left", parent?: g.E): g.Label => {
			const l = new g.Label({ scene, font: f, fontSize: size, text, x, y, width: 1240, textAlign: align, widthAutoAdjust: false });
			if (align === "center") l.x = x - 620;
			if (align === "right") l.x = x - 1240;
			(parent || scene).append(l);
			return l;
		};
		const setText = (l: g.Label, t: string): void => {
			if (l.text !== t) {
				l.text = t; l.invalidate();
			}
		};
		const scoreLabel = label(fontW, 44, 20, 18, "0てん");
		const timeLabel = label(fontW, 44, W - 24, 18, "", "right");
		const comboLabel = label(fontY, 40, 20, 210, "");
		const mochiLabel = label(fontY, 32, W - 24, 70, "", "right");
		const pops: Pop[] = [];
		const popText = (t: string, f: g.Font, size: number, x: number, y: number, life = 0.8): void => {
			const l = label(f, size, x, y, t, "center");
			l.anchorX = 0.5;
			l.anchorY = 0.5;
			l.x = x;
			l.y = y + size / 2;
			pops.push({ l, life, vy: -60, scale: 1.4 });
		};

		// ======== はじめの説明 ========
		const intro = new g.E({ scene });
		scene.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(40,16,30,0.62)", width: W, height: H }));
		intro.append(new g.Sprite({ scene, src: img("logo"), x: W / 2, y: 140, anchorX: 0.5, anchorY: 0.5, scaleX: 0.52, scaleY: 0.52 }));
		label(fontW, 34, W / 2, 300, "上のレーンの「おもち」が輪にかさなったら、タップでペッタン！", "center", intro);
		label(fontC, 34, W / 2, 352, "「たぬきの手」のときは押しちゃダメ！ 手をついちゃうよ", "center", intro);
		label(fontY, 34, W / 2, 404, "16回つくと おもち完成！ ぴったりが多いほど豪華なおもちに", "center", intro);
		label(fontP, 34, W / 2, 456, "だんだん速くなって、最後は大もちラッシュ（点数2ばい）！", "center", intro);
		const countLabel = label(fontY, 100, W / 2, 540, "", "center", intro);

		// ======== エフェクト ========
		const burst = (x: number, y: number, n: number, sp: number, cols: string[]): void => {
			for (let k = 0; k < n; k++) {
				const a = rand() * Math.PI * 2, v = sp * (0.4 + rand() * 0.8);
				parts.push({
					x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 200, g: 900, life: 0.6, max: 0.6,
					size: 8 + rand() * 8, col: cols[Math.floor(rand() * cols.length)], img: "", spin: 0
				});
			}
		};
		const sparkle = (x: number, y: number, n: number): void => {
			for (let k = 0; k < n; k++) {
				const a = k / n * Math.PI * 2;
				const vx = Math.cos(a) * 500, vy = Math.sin(a) * 500;
				parts.push({ x, y, vx, vy, g: 0, life: 0.45, max: 0.45, size: 36, col: "", img: "spark", spin: 0 });
			}
		};
		const confetti = (n: number): void => {
			for (let k = 0; k < n; k++) {
				parts.push({
					x: rand() * W, y: 300 + rand() * 60, vx: (rand() - 0.5) * 300, vy: -300 - rand() * 300, g: 600, life: 1.4, max: 1.4,
					size: 8 + rand() * 6, col: "hsl(" + Math.floor(rand() * 360) + ",95%,65%)", img: "", spin: 0
				});
			}
		};
		// 舞台の中の位置を、画面の位置にする
		const sx = (x: number): number => W / 2 * (1 - STAGE_S) + x * STAGE_S;
		const sy = (y: number): number => H * (1 - STAGE_S) + y * STAGE_S;
		const comboMul = (): number => 1 + Math.min(50, combo) / 25;

		// ======== おもち完成 ========
		const completeMochi = (): void => {
			const ratio = perfectsInMochi / PER_MOCHI;
			const type = ratio >= 0.9 ? 0 : ratio >= 0.75 ? 1 : ratio >= 0.55 ? 2 : ratio >= 0.35 ? 3 : 4;
			made.push(type);
			const bonus = MOCHI_PT + perfectsInMochi * 50;
			score += bonus;
			hits = 0;
			perfectsInMochi = 0;
			se("complete", 0.6);
			se("cheer", 0.5);
			flash = 0.35; flashCol = "#fff8e0";
			cheer = 1;
			confetti(40);
			sparkle(MOCHI_X, MOCHI_Y - 80, 12);
			popText(MOCHI_NAMES[type] + " かんせい！", fontY, 60, MOCHI_X, 300, 1.3);
			popText("+" + bonus, fontW, 44, MOCHI_X, 370, 1.3);
		};

		// ======== 判定 ========
		const breakCombo = (): void => {
			if (combo >= 10) popText("コンボがとぎれた…", fontR, 32, W / 2, 250);
			combo = 0;
		};
		scene.onPointDownCapture.add(() => {
			if (phase !== "play") return;
			lastHit = now;
			// いちばん近い「つく」印
			let best: Ev | null = null;
			let bd = 9;
			for (let i = 0; i < evs.length; i++) {
				const e = evs[i];
				if (e.done || e.kind !== "T") continue;
				const d = Math.abs(e.t - now);
				if (d < bd) {
					bd = d; best = e;
				}
				if (e.t > now + 1) break;
			}
			const hn = handNear();
			if (hn >= 0 && !(best && bd <= GOOD_W && bd < hn)) {
				// たぬきの手をついてしまった
				ouchT = 0.5;
				shake = 0.35;
				se("ouch", 0.7);
				score = Math.max(0, score - OUCH_PT);
				breakCombo();
				popText("いたーっ！ -" + OUCH_PT, fontR, 56, sx(860), sy(330), 0.9);
				return;
			}
			se("pettan", 0.7);
			squash = 1;
			const mx = MOCHI_X, my = MOCHI_Y - 90;
			parts.push({ x: mx, y: my, vx: 0, vy: 0, g: 0, life: 0.25, max: 0.25, size: 260, col: "", img: "splash", spin: 0 });
			if (best && bd <= GOOD_W) {
				best.done = true;
				const perfect = bd <= PERFECT_W;
				best.res = perfect ? "perfect" : "good";
				combo++;
				maxCombo = Math.max(maxCombo, combo);
				const pts = Math.round((perfect ? PERFECT_PT : GOOD_PT) * comboMul() * (best.rush ? 2 : 1));
				score += pts;
				hits++;
				if (perfect) perfectsInMochi++;
				shake = perfect ? 0.18 : 0.1;
				if (perfect) {
					se("perfect", 0.35);
					sparkle(mx, my, 8);
					popText(combo % 8 === 0 ? "よいしょー！" : "ペッタン！", fontY, 52, sx(mx - 170), sy(my - 110), 0.6);
				} else {
					se("good", 0.35);
					popText("ペタッ", fontW, 42, sx(mx - 170), sy(my - 110), 0.5);
				}
				burst(mx, my, perfect ? 14 : 8, 420, ["#ffffff", "#fff4d0", "#ffe0f0"]);
				popText("+" + pts, fontW, 34, sx(mx + 150), sy(my - 60), 0.5);
				if (combo > 0 && combo % 10 === 0) {
					se("cheer", 0.45);
					cheer = 1;
					confetti(20);
					popText(combo + "コンボ！", fontP, 64, W / 2, 250, 1.0);
				}
				if (hits >= PER_MOCHI) completeMochi();
			} else {
				// 何もないところでついた
				breakCombo();
				popText("スカッ", fontC, 40, sx(mx - 170), sy(my - 110), 0.5);
			}
		});

		// ======== おしまい ========
		let finished = false;
		const finish = (): void => {
			if (finished) return;
			finished = true;
			phase = "end";
			g.game.vars.gameState.score = score;
			se("finish", 0.7);
			se("cheer", 0.5);
			const over = new g.FilledRect({ scene, cssColor: "rgba(40,16,30,0.6)", width: W, height: H });
			scene.append(over);
			label(fontY, 100, W / 2, 140, "おしまい！", "center");
			label(fontW, 76, W / 2, 270, score + "てん", "center");
			label(fontC, 40, W / 2, 380, "完成したおもち " + made.length + "こ　さいだい " + maxCombo + "コンボ", "center");
			made.slice(0, 12).forEach((m, i) => {
				const n = Math.min(12, made.length);
				const sp = new g.Sprite({ scene, src: img(MOCHI_TYPES[m]), x: W / 2 - n * 50 + i * 100, y: 450 });
				scene.append(sp);
			});
		};

		// ======== 毎フレーム ========
		let lastCount = -1;
		let curSection = 0;
		scene.onUpdate.add(() => {
			if (phase === "intro") {
				introLeft -= dt;
				const n = Math.ceil(introLeft);
				if (n !== lastCount && n <= 3 && n > 0) {
					se("count", 0.5); lastCount = n;
				}
				setText(countLabel, n <= 3 && n > 0 ? String(n) : "");
				if (introLeft <= 0) {
					phase = "play";
					intro.destroy();
					se("go", 0.6);
					popText("ペッタン、スタート！", fontY, 80, W / 2, 300, 1.0);
				}
			} else if (phase === "play") {
				now += dt;
				if (now >= playSec) finish();
			}
			if (phase === "play") {
				// 曲: 8分音符ごとに太鼓・かね・琴
				while (slotIdx < slots.length && slots[slotIdx].t <= now) {
					const s = slots[slotIdx];
					if (s.beat) {
						se("don", s.idx % 8 === 0 ? 0.55 : 0.38);
						lastBeat = s.t;
					} else se("ka", 0.3);
					const m = MELODY[s.idx % MELODY.length];
					if (m >= 0) se("k" + m, s.rush ? 0.42 : 0.32);
					slotIdx++;
				}
				// たぬきの「はいっ」と、のがした「つく」
				for (let i = 0; i < evs.length; i++) {
					const e = evs[i];
					if (e.t > now + 1) break;
					if (e.done) continue;
					if (e.kind === "h" && now >= e.t) {
						e.done = true;
						se("hai", 0.35);
					} else if (e.kind === "T" && now > e.t + GOOD_W) {
						e.done = true;
						e.res = "miss";
						se("miss", 0.35);
						breakCombo();
						popText("ミス", fontR, 40, sx(MOCHI_X - 170), sy(MOCHI_Y - 200), 0.5);
					}
				}
				// 区間がかわる
				const si = SECTIONS.indexOf(sectionAt(now));
				if (si !== curSection) {
					curSection = si;
					sectionName = SECTIONS[si].name;
					if (SECTIONS[si].rush) {
						se("rush", 0.6);
						flash = 0.4; flashCol = "#ffe060";
						confetti(30);
					} else se("hai", 0.5);
					popText(sectionName, SECTIONS[si].rush ? fontP : fontC, SECTIONS[si].rush ? 60 : 52, W / 2, 250, 1.6);
				}
			}
			if (ouchT > 0) ouchT -= dt;
			if (squash > 0) squash = Math.max(-0.3, squash - dt * 9);
			else if (squash < 0) squash = Math.min(0, squash + dt * 3);
			if (shake > 0) shake = Math.max(0, shake - dt);
			if (flash > 0) flash = Math.max(0, flash - dt * 2);
			cheer = Math.max(0, cheer - dt * 0.5);
			crowdT += dt * (1.5 + Math.min(1, combo / 30) * 3 + cheer * 4);
			for (let i = parts.length - 1; i >= 0; i--) {
				const p = parts[i];
				p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.96; p.vy *= 0.96;
				p.spin += dt * 4;
				p.life -= dt;
				if (p.life <= 0) parts.splice(i, 1);
			}
			for (let i = pops.length - 1; i >= 0; i--) {
				const pp = pops[i];
				pp.life -= dt;
				pp.l.y += pp.vy * dt;
				pp.scale += (1 - pp.scale) * Math.min(1, dt * 14);
				pp.l.scaleX = pp.l.scaleY = pp.scale;
				pp.l.opacity = Math.min(1, pp.life * 3);
				pp.l.modified();
				if (pp.life <= 0) {
					pp.l.destroy(); pops.splice(i, 1);
				}
			}
			if (phase !== "end") g.game.vars.gameState.score = score;
			setText(scoreLabel, score + "てん");
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playSec - now)));
			setText(comboLabel, combo >= 2 ? combo + "コンボ ×" + comboMul().toFixed(1) : "");
			setText(mochiLabel, "おもち " + made.length + "こ");
			view.modified();
		});
	});
	g.game.pushScene(scene);
}
