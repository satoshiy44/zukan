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
const RENDA_SEC = 0.09; // 連打パートで長押ししているとき、うさぎがつく間かく(秒)
const RENDA_PT = 30; // 連打1回の点
const JUDGE_X = 200; // 判定の輪の位置
const LANE_END = 1240;
const LANE_Y = 150;
const MOCHI_X = 640;
const MOCHI_Y = 540; // もちの下のはし
const STAGE_S = 0.85; // 舞台の大きさ

// 区間ごとのテンポと、出てくる並び(8分音符8つで1小節。T=つく h=たぬきの手 .=休み)
interface Section { t: number; bpm: number; pats: string[]; name: string; rush: boolean; }
const SECTIONS: Section[] = [
	{ t: 0, bpm: 100, pats: ["ThThThTh"], name: "", rush: false },
	{ t: 12, bpm: 116, pats: ["ThThThTh", "ThT.ThTT", "ThThTh.h", "RRRRRR.h"], name: "テンポアップ！", rush: false },
	{ t: 24, bpm: 132, pats: ["ThThThTh", "ThT.ThTT", "Th.hThTh", "ThThh.Th", "RRRRRRRh"], name: "もっと速く！", rush: false },
	{ t: 36, bpm: 148, pats: ["ThThThTh", "TTTTThTh", "Th.hThTh", "ThTh..Th", "ThT.ThTT", "RRRRR.hT"], name: "れんだも来るよ！", rush: false },
	{
		t: 48, bpm: 164, pats: ["TTTTThTh", "Th.hThTh", "ThT.ThTT", "ThThThTh", "TTThTTTh", "RRRRRR.h"],
		name: "大もちラッシュ！ 点数2ばい", rush: true
	}
];
// 曲は5つ。ゲームの時計で8分音符ごとに鳴らす。inst: k=琴 s=三味線 f=笛 / mel: 陽音階の 0〜9 番(-1 は休み)
// drum: 8分音符8つぶんの太鼓。D=太鼓(強) d=太鼓 k=かね .=なし
interface Song { name: string; inst: string; drum: string; mel: number[]; }
const SONGS: Song[] = [
	{
		name: "おめでた音頭", inst: "k", drum: "DkdkDkdk", mel: [
			5, -1, 4, 5, 7, -1, 5, -1, 4, -1, 2, 4, 5, -1, -1, -1, 3, -1, 4, 5, 4, -1, 2, -1, 1, -1, 2, 4, 2, -1, -1, -1,
			5, -1, 7, 8, 7, -1, 5, 4, 5, -1, 7, -1, 9, -1, 8, 7, 5, -1, 4, 2, 4, -1, 5, -1, 2, -1, 1, -1, 0, -1, -1, -1
		]
	},
	{
		name: "ペッタンばやし", inst: "s", drum: "DkkdDkdk", mel: [
			2, 2, 4, -1, 5, 4, 2, -1, 4, 4, 5, -1, 7, 5, 4, -1, 5, 7, 8, 7, 5, -1, 4, -1, 2, 4, 2, -1, 0, -1, -1, -1,
			2, 2, 4, -1, 5, 4, 2, -1, 4, 4, 5, -1, 7, 8, 9, -1, 8, 7, 5, 7, 8, -1, 7, -1, 5, 4, 2, 4, 5, -1, -1, -1
		]
	},
	{
		name: "はつひの笛", inst: "f", drum: "Dk.kdk.k", mel: [
			5, -1, -1, -1, 7, -1, 8, -1, 7, -1, 5, -1, 4, -1, -1, -1, 2, -1, 4, -1, 5, -1, 7, -1, 5, -1, -1, -1, -1, -1, -1, -1,
			8, -1, -1, -1, 9, -1, 8, -1, 7, -1, 5, -1, 7, -1, -1, -1, 5, -1, 4, -1, 2, -1, 4, -1, 5, -1, -1, -1, -1, -1, -1, -1
		]
	},
	{
		name: "もちもち三味線", inst: "s", drum: "DkdkDddk", mel: [
			0, -1, 2, 0, 4, -1, 2, -1, 5, -1, 4, 2, 4, -1, -1, -1, 0, -1, 2, 0, 4, -1, 5, -1, 7, -1, 5, 4, 5, -1, -1, -1,
			7, -1, 8, 7, 5, -1, 4, -1, 5, -1, 4, 2, 0, -1, 2, -1, 4, -1, 5, 4, 2, -1, 0, -1, 2, -1, -1, -1, 0, -1, -1, -1
		]
	},
	{
		name: "宝船のうた", inst: "k", drum: "DkkkDkdk", mel: [
			9, -1, 8, -1, 7, -1, 5, -1, 7, -1, 8, 9, 8, -1, -1, -1, 7, -1, 5, -1, 4, -1, 5, -1, 7, -1, -1, -1, -1, -1, -1, -1,
			4, 5, 7, -1, 8, -1, 7, -1, 5, -1, 4, -1, 5, -1, 7, -1, 8, -1, 7, -1, 5, -1, 4, -1, 5, -1, -1, -1, -1, -1, -1, -1
		]
	}
];
// 背景は5つ(空はゲームが時間帯ごとに描く)
const THEMES = [
	{ id: "asa", name: "富士の見える神社" }, { id: "yuki", name: "雪の神社" }, { id: "ume", name: "梅の庭" },
	{ id: "yuu", name: "城下町" }, { id: "takara", name: "宝船のうたげ" }
];
// 時間帯は 朝→昼→夕方→夜。空の色と、画面全体にかける色
interface TimeOfDay { name: string; sky: string[]; tint: number[]; }
const TIMES: TimeOfDay[] = [
	{ name: "朝", sky: ["#7aa8f0", "#ffc8a8", "#ffe8b8"], tint: [255, 190, 140, 0.1] },
	{ name: "昼", sky: ["#3a96f0", "#86ccff", "#d8f4ff"], tint: [255, 255, 255, 0] },
	{ name: "夕方", sky: ["#5a3a8a", "#ff7a5a", "#ffc870"], tint: [255, 110, 60, 0.18] },
	{ name: "夜", sky: ["#0a1238", "#1e2c66", "#3a4a86"], tint: [20, 30, 90, 0.4] }
];
const SHOT_SEC = 10; // カメラを切りかえる間かく(秒)
const UP_ZOOM = 1.75; // アップのときの大きさ
const MOCHI_TYPES = ["m_kin", "m_kouhaku", "m_kinako", "m_anko", "m_kusa"];
const MOCHI_NAMES = ["金ぱくもち", "紅白もち", "きなこもち", "あんこもち", "草もち"];

// T=つく h=たぬきの手 R=連打(t から t2 まで)
interface Ev { t: number; t2: number; kind: "T" | "h" | "R"; done: boolean; res: string; rush: boolean; }
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
		"note_renda",
		"crowd0", "crowd1", "kadomatsu", "glow", "rays",

		"ov_crowd0", "ov_crowd1", "ov_usu", "ov_mochi", "ov_usagi", "ov_kine", "ov_tanuki", "ov_arm",
		"usu", "usu_front", "mochi", "usagi_up", "usagi_mid", "usagi_down",
		"tanuki_idle", "tanuki_hand", "tanuki_ouch", "note_tsuki", "note_te", "judge", "ring", "tray", "spark", "star", "splash", "logo"
	].concat(MOCHI_TYPES, THEMES.map((t) => "bg_" + t.id), THEMES.map((t) => "ov_" + t.id));
	const audioIds = [
		"don", "ka", "pettan", "perfect", "good", "miss", "ouch", "hai", "complete", "count", "go", "finish", "rush", "cheer"
	];
	for (let i = 0; i < 10; i++) audioIds.push("k" + i, "s" + i, "f" + i);
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
			let lastSec = -1;
			let barInSec = 0;
			while (t < playSec - 0.8) {
				const sec = sectionAt(t);
				const slot = 60 / sec.bpm / 2;
				// 区間に入って3小節めは、かならず連打(連打のある区間だけ)
				const si = SECTIONS.indexOf(sec);
				if (si !== lastSec) {
					lastSec = si; barInSec = 0;
				}
				const renda = sec.pats.filter((q) => q.charAt(0) === "R");
				let pat = bar < 2 ? sec.pats[0] : sec.pats[Math.floor(rand() * sec.pats.length)];
				if (barInSec === 2 && renda.length > 0) pat = renda[0];
				barInSec++;
				for (let k = 0; k < 8 && t < playSec - 0.8; k++) {
					const c = pat.charAt(k);
					if (c === "T" || c === "h") evs.push({ t, t2: t, kind: c, done: false, res: "", rush: sec.rush });
					if (c === "R" && (k === 0 || pat.charAt(k - 1) !== "R")) {
						let n = 0;
						while (pat.charAt(k + n) === "R") n++;
						evs.push({ t, t2: t + slot * n, kind: "R", done: false, res: "", rush: sec.rush });
					}
					slots.push({ t, idx: idx++, beat: k % 2 === 0, rush: sec.rush });
					t += slot;
				}
				bar++;
			}
		}

		// 曲と背景は、ゲームごとにランダム
		const song = SONGS[Math.floor(rand() * SONGS.length)];
		const theme = THEMES[Math.floor(rand() * THEMES.length)];

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
		let glowT = 0; // おもち完成の光
		let held = false; // 画面を押しているか
		let heldFromRenda = false; // 連打のときから押しっぱなし
		let rendaTimer = 0;
		let rendaCount = 0;
		let rendaPts = 0;
		let shot = 0; // 0=いつもの 1=アップ 2=俯瞰
		let todIdx = 0;
		const parts: Part[] = [];

		// ======== 絵 ========
		const view = new View({ scene, width: W, height: H });
		scene.append(view);
		// いま連打パートの中なら、その印
		const rendaNow = (): Ev | null => {
			for (let i = 0; i < evs.length; i++) {
				const e = evs[i];
				if (e.kind === "R" && now >= e.t - 0.05 && now <= e.t2) return e;
				if (e.t > now + 1) break;
			}
			return null;
		};
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
		// ---- 時間帯: 朝→昼→夕方→夜 ----
		const hex = (c: string): number[] => {
			const n = parseInt(c.slice(1), 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		};
		const mix3 = (a: number[], b: number[], t: number): number[] => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
		const rgb = (c: number[]): string => "rgb(" + c.map((v) => Math.round(v)).join(",") + ")";
		// いまの時間帯(0〜3)と、次の時間帯へのうつりかわり(0〜1)
		const todNow = (): { i: number; t: number } => {
			const f = Math.max(0, Math.min(3.999, now / playSec * 4));
			const i = Math.floor(f), fr = f - i;
			return { i, t: i < 3 ? Math.max(0, (fr - 0.85) / 0.15) : 0 };
		};
		const drawSky = (r: g.Renderer): void => {
			const td = todNow(), a = TIMES[td.i], b = TIMES[Math.min(3, td.i + 1)];
			const N = 18;
			for (let k = 0; k < N; k++) {
				const v = k / (N - 1) * 2;
				const ia = Math.min(1, Math.floor(v)), fv = v - ia;
				const ca = mix3(hex(a.sky[ia]), hex(a.sky[ia + 1]), fv), cb = mix3(hex(b.sky[ia]), hex(b.sky[ia + 1]), fv);
				const col = rgb(mix3(ca, cb, td.t));
				r.fillRect(0, k * 440 / N, W, 440 / N + 1, col);
			}
			const p = Math.min(1, now / playSec);
			// お日さま(朝にのぼって夕方にしずむ)
			if (p < 0.8) {
				const q = p / 0.75;
				const x = 160 + q * 960, y = 360 - Math.sin(Math.min(1, q) * Math.PI) * 280;
				r.save();
				r.opacity(Math.max(0, Math.min(1, (0.8 - p) * 10)));
				const gl = img("glow");
				r.transform([0.6, 0, 0, 0.6, x - gl.width * 0.3, y - gl.height * 0.3]);
				r.drawImage(surf.glow, 0, 0, gl.width, gl.height, 0, 0);
				r.restore();
				r.save();
				r.opacity(Math.max(0, Math.min(1, (0.8 - p) * 10)));
				r.fillRect(x - 46, y - 46, 92, 92, p > 0.55 ? "#ff8a4a" : "#fff0a0");
				r.restore();
			}
			// 夜: 月と星
			if (p > 0.72) {
				const al = Math.min(1, (p - 0.72) * 8);
				r.save();
				r.opacity(al);
				for (let k = 0; k < 40; k++) {
					const sx2 = (k * 197) % W, sy2 = (k * 83) % 330, tw = 2 + ((k * 7) % 3);
					r.fillRect(sx2, sy2, tw, tw, "#fff8d0");
				}
				r.fillRect(980, 80, 70, 70, "#fff8d8");
				r.fillRect(1004, 80, 46, 46, TIMES[3].sky[0]);
				r.restore();
			}
		};
		const drawTint = (r: g.Renderer): void => {
			const td = todNow(), a = TIMES[td.i].tint, b = TIMES[Math.min(3, td.i + 1)].tint;
			const m = (k: number): number => a[k] + (b[k] - a[k]) * td.t;
			if (m(3) <= 0.001) return;
			r.save();
			r.opacity(m(3));
			r.fillRect(0, 0, W, H, "rgb(" + Math.round(m(0)) + "," + Math.round(m(1)) + "," + Math.round(m(2)) + ")");
			r.restore();
		};
		// ---- おもち完成の光(臼のうしろで回る光の筋と、臼をつつむ光) ----
		const drawGlow = (r: g.Renderer, cx: number, cy: number, s: number): void => {
			if (glowT <= 0) return;
			const a = Math.min(1, glowT);
			const ry = img("rays"), gl = img("glow");
			const rot = now * 1.5, rs = s * (1.1 + (1.6 - glowT) * 0.3);
			r.save();
			r.setCompositeOperation("lighter");
			r.opacity(a * 0.9);
			const c = Math.cos(rot) * rs, si = Math.sin(rot) * rs;
			r.transform([c, si, -si, c, cx, cy]);
			r.drawImage(surf.rays, 0, 0, ry.width, ry.height, -ry.width / 2, -ry.height / 2);
			r.setCompositeOperation("source-over");
			r.restore();
			r.save();
			r.setCompositeOperation("lighter");
			r.opacity(a * (0.6 + Math.sin(now * 20) * 0.2));
			r.transform([s * 1.3, 0, 0, s * 0.9, cx - gl.width * s * 0.65, cy - gl.height * s * 0.45]);
			r.drawImage(surf.glow, 0, 0, gl.width, gl.height, 0, 0);
			r.setCompositeOperation("source-over");
			r.restore();
		};
		const drawParts = (r: g.Renderer): void => {
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
		};
		const drawRing = (r: g.Renderer, cx: number, cy: number, base: number): void => {
			const n = nextT();
			if (!n || phase !== "play") return;
			const k = (n.t - now) / (slotLen() * 2);
			if (k <= -0.1 || k >= 1) return;
			const s = base * (0.28 + Math.max(0, k) * 0.9);
			const a = img("ring");
			drawImg(r, "ring", cx - a.width * s / 2, cy - a.height * s / 2, s, s, Math.min(1, (1 - k) * 2));
		};
		// 観客のジャンプ(おもち完成のとき)
		const crowdJump = (): number => glowT > 0 ? -Math.abs(Math.sin(glowT * 14)) * 34 * Math.min(1, glowT) : 0;
		// ---- 横から見た画面(いつもの・アップ) ----
		const drawSide = (r: g.Renderer): void => {
			drawImg(r, "bg_" + theme.id, 0, 0);
			drawImg(r, "crowd" + (Math.floor(crowdT) % 2), 0, 318 + crowdJump());
			// 門松は観客の手前
			drawImg(r, "kadomatsu", -20, 330);
			drawImg(r, "kadomatsu", 1080, 330);
			// 舞台(臼・もち・うさぎ・たぬき)は少し小さく、画面の下はしを中心にちぢめる
			r.save();
			r.transform([STAGE_S, 0, 0, STAGE_S, W / 2 * (1 - STAGE_S), H * (1 - STAGE_S)]);
			drawGlow(r, MOCHI_X, 520, 1);
			drawImg(r, "usu", MOCHI_X - 230, 470);
			const grow = 0.72 + 0.4 * Math.min(1, hits / PER_MOCHI);
			const sq = Math.max(0, squash);
			const mw = 300 * grow * (1 + sq * 0.35), mh = 170 * grow * (1 - sq * 0.45);
			drawImg(r, "mochi", MOCHI_X - mw / 2, MOCHI_Y - mh, mw / 300, mh / 170);
			drawImg(r, "usu_front", MOCHI_X - 230, 530);
			if (glowT > 0) {
				// 臼のふちが金色に光る
				r.save();
				r.setCompositeOperation("lighter");
				r.opacity(Math.min(1, glowT) * 0.55);
				drawImg(r, "usu", MOCHI_X - 230, 470);
				r.setCompositeOperation("source-over");
				r.restore();
			}
			drawImg(r, rabbitPose(), 230, 63 + (glowT > 0 ? crowdJump() * 0.5 : 0));
			const tid = ouchT > 0 ? "tanuki_ouch" : handIn() ? "tanuki_hand" : "tanuki_idle";
			drawImg(r, tid, 640, 90 + (glowT > 0 && ouchT <= 0 ? crowdJump() * 0.5 : 0));
			// 完成したおもち(おぼんの上に積む)
			drawImg(r, "tray", 1010, 650);
			made.forEach((m, i) => {
				const col = i % 2, row = Math.floor(i / 2);
				if (row > 4) return;
				drawImg(r, MOCHI_TYPES[m], 1040 + col * 100 + (row % 2) * 30, 590 - row * 56, 0.8, 0.8);
			});
			drawRing(r, MOCHI_X, MOCHI_Y - 70, 1);
			drawParts(r);
			r.restore();
		};
		const rabbitPose = (): string => {
			const n = nextT();
			if (now - lastHit < (rendaNow() ? 0.05 : 0.12)) return "usagi_down";
			if (phase === "play" && n && n.t - now < slotLen() * 1.1) return "usagi_up";
			return "usagi_mid";
		};
		// ---- 上から見た画面(俯瞰) ----
		const OV_X = 640, OV_Y = 450;
		const drawOver = (r: g.Renderer): void => {
			drawImg(r, "ov_" + theme.id, 0, 0);
			drawGlow(r, OV_X, OV_Y, 1.1);
			const u = img("ov_usu");
			drawImg(r, "ov_usu", OV_X - u.width / 2, OV_Y - u.height / 2);
			const grow = 0.6 + 0.35 * Math.min(1, hits / PER_MOCHI);
			const sq = Math.max(0, squash);
			const ms = grow * (1 + sq * 0.25);
			const mo = img("ov_mochi");
			drawImg(r, "ov_mochi", OV_X - mo.width * ms / 2, OV_Y - mo.height * ms / 2, ms, ms);
			if (glowT > 0) {
				r.save();
				r.setCompositeOperation("lighter");
				r.opacity(Math.min(1, glowT) * 0.5);
				drawImg(r, "ov_usu", OV_X - u.width / 2, OV_Y - u.height / 2);
				r.setCompositeOperation("source-over");
				r.restore();
			}
			drawRing(r, OV_X, OV_Y, 1);
			// うさぎと杵(上げているほど、カメラに近くて大きい)
			const us = img("ov_usagi");
			const hop = glowT > 0 ? crowdJump() * 0.3 : 0;
			drawImg(r, "ov_usagi", 330 - us.width / 2, OV_Y - us.height / 2 + hop);
			const pose = rabbitPose();
			const ks = pose === "usagi_down" ? 1 : pose === "usagi_up" ? 1.4 : 1.18;
			const kx = pose === "usagi_down" ? OV_X - 245 : pose === "usagi_up" ? 360 : 380;
			const ka = pose === "usagi_down" ? 0 : pose === "usagi_up" ? -0.18 : -0.08;
			const ki = img("ov_kine");
			r.save();
			const c = Math.cos(ka) * ks, si = Math.sin(ka) * ks;
			r.transform([c, si, -si, c, kx, OV_Y]);
			r.drawImage(surf.ov_kine, 0, 0, ki.width, ki.height, -10, -ki.height / 2);
			r.restore();
			// たぬきと手
			const tn = img("ov_tanuki"), ar = img("ov_arm");
			const shake2 = ouchT > 0 ? Math.sin(now * 60) * 8 : 0;
			const reach = handIn() ? 0.95 : 0.4;
			r.save();
			r.transform([reach, 0, 0, 1, 930 - ar.width * reach, OV_Y - 60 - ar.height / 2]);
			r.drawImage(surf.ov_arm, 0, 0, ar.width, ar.height, 0, 0);
			r.restore();
			drawImg(r, "ov_tanuki", 990 - tn.width / 2 + shake2, OV_Y - tn.height / 2 + (glowT > 0 && ouchT <= 0 ? hop : 0));
			if (ouchT > 0) {
				for (let k = 0; k < 3; k++) {
					const t = now * 9 + k * 2.1, st = img("star");
					drawImg(r, "star", 960 + Math.cos(t) * 70 - st.width / 2, OV_Y - 20 + Math.sin(t) * 40 - st.height / 2);
				}
			}
			// まわりの観客
			const cs = 1 + (glowT > 0 ? Math.abs(Math.sin(glowT * 14)) * 0.02 : 0);
			drawImg(r, "ov_crowd" + (Math.floor(crowdT) % 2), W / 2 * (1 - cs), H / 2 * (1 - cs), cs, cs);
			// 完成したおもち
			made.forEach((m, i) => {
				if (i > 9) return;
				drawImg(r, MOCHI_TYPES[m], 1150 - (i % 5) * 70, 560 + Math.floor(i / 5) * 56, 0.6, 0.6);
			});
			drawParts(r);
		};
		// カメラ: いつもの / アップ(もちに寄る) / 俯瞰
		const camMat = (): number[] => {
			if (shot !== 1) return [1, 0, 0, 1, 0, 0];
			const fx = W / 2, fy = H * (1 - STAGE_S) + 500 * STAGE_S;
			return [UP_ZOOM, 0, 0, UP_ZOOM, W / 2 - fx * UP_ZOOM, 450 - fy * UP_ZOOM];
		};
		view.draw = (r: g.Renderer): void => {
			drawSky(r);
			r.save();
			if (shake > 0) r.translate(Math.sin(shake * 70) * shake * 18, Math.cos(shake * 53) * shake * 10);
			if (shot === 2) {
				drawOver(r);
			} else {
				r.transform(camMat());
				drawSide(r);
			}
			r.restore();
			drawTint(r);
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
				if (dtt > LEAD || (e.kind === "R" ? e.t2 - now < -0.1 : dtt < -0.4)) continue;
				if (e.kind === "T" && e.done) continue;
				const x = JUDGE_X + dtt / LEAD * (LANE_END - JUDGE_X);
				if (e.kind === "R") {
					// 連打の帯: 先頭の印から終わりまで
					const x1 = Math.max(JUDGE_X, x), x2 = Math.min(LANE_END, JUDGE_X + (e.t2 - now) / LEAD * (LANE_END - JUDGE_X));
					if (x2 > x1) {
						r.fillRect(x1, LANE_Y - 30, x2 - x1, 60, "#3a1e2a");
						r.fillRect(x1, LANE_Y - 24, x2 - x1, 48, "#ffb020");
						r.fillRect(x1, LANE_Y - 18, x2 - x1, 12, "#fff27a");
						const re = img("note_renda");
						drawImg(r, "note_renda", x2 - re.width * 0.5, LANE_Y - re.height * 0.4, 0.8, 0.8);
					}
					const re = img("note_renda");
					drawImg(r, "note_renda", x1 - re.width * 0.45, LANE_Y - re.height * 0.45, 0.9, 0.9);
					continue;
				}
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
		const todLabel = label(fontC, 30, W - 24, 108, "", "right");
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
		label(fontP, 34, W / 2, 456, "黄色い帯は長押しで連打！ 最後は大もちラッシュ（点数2ばい）！", "center", intro);
		label(fontW, 30, W / 2, 510, "ステージ：" + theme.name + "　　曲：" + song.name, "center", intro);
		const countLabel = label(fontY, 100, W / 2, 560, "", "center", intro);

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
		// (カメラがアップや俯瞰のときも、文字がもちのまわりに出るようにする)
		const sx = (x: number): number => {
			if (shot === 2) return x;
			const b = W / 2 * (1 - STAGE_S) + x * STAGE_S;
			return shot === 1 ? W / 2 + (b - W / 2) * UP_ZOOM : b;
		};
		const sy = (y: number): number => {
			if (shot === 2) return y - 20;
			const b = H * (1 - STAGE_S) + y * STAGE_S;
			return shot === 1 ? Math.max(260, 450 + (b - (H * (1 - STAGE_S) + 500 * STAGE_S)) * UP_ZOOM) : b;
		};
		const comboMul = (): number => 1 + Math.min(50, combo) / 25;

		// ======== おもち完成 ========
		const completeMochi = (): void => {
			glowT = 1.8;
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
		// 連打で1回つく
		const rendaPound = (e: Ev): void => {
			lastHit = now;
			se("pettan", 0.5);
			squash = 0.8;
			const pts = Math.round(RENDA_PT * comboMul() * (e.rush ? 2 : 1));
			score += pts;
			rendaPts += pts;
			rendaCount++;
			hits++;
			perfectsInMochi++;
			shake = 0.08;
			const mx = MOCHI_X, my = MOCHI_Y - 90;
			burst(mx, my, 5, 380, ["#ffffff", "#fff4d0", "#ffe060"]);
			if (rendaCount % 4 === 0) popText(rendaCount + "回！", fontY, 44, sx(mx + 170), sy(my - 120), 0.4);
			if (hits >= PER_MOCHI) completeMochi();
		};
		scene.onPointUpCapture.add(() => {
			held = false;
			heldFromRenda = false;
		});
		scene.onPointDownCapture.add(() => {
			if (phase !== "play") return;
			held = true;
			const rd = rendaNow();
			if (rd) {
				// 連打パートでは、押すたびにつく(押しっぱなしでも自動でつく)
				heldFromRenda = true;
				rendaTimer = RENDA_SEC;
				rendaPound(rd);
				return;
			}
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
					const dr = song.drum.charAt(s.idx % 8);
					if (dr === "D" || dr === "d") se("don", dr === "D" ? 0.55 : 0.38);
					else if (dr === "k") se("ka", 0.3);
					if (s.beat) lastBeat = s.t;
					const m = song.mel[s.idx % song.mel.length];
					if (m >= 0) se(song.inst + m, (s.rush ? 0.42 : 0.32) * (song.inst === "f" ? 1.1 : 1));
					slotIdx++;
				}
				// 連打パート
				const rd = rendaNow();
				if (rd && held && now >= rd.t) {
					rendaTimer -= dt;
					if (rendaTimer <= 0) {
						rendaPound(rd);
						rendaTimer = RENDA_SEC;
					}
				}
				for (let i = 0; i < evs.length; i++) {
					const e = evs[i];
					if (e.t > now + 1.2) break;
					if (e.kind !== "R") continue;
					if (e.res === "" && e.t - now < 0.9) {
						e.res = "warned";
						popText("長押しで連打！", fontY, 64, W / 2, 330, 1.0);
					}
					if (!e.done && now > e.t2) {
						e.done = true;
						if (rendaCount > 0) {
							se("good", 0.5);
							popText("連打 " + rendaCount + "回！ +" + rendaPts, fontP, 50, W / 2, 330, 1.0);
						}
						rendaCount = 0;
						rendaPts = 0;
					}
				}
				// 連打のあとも押しっぱなしで、たぬきの手が来たら手をつく
				if (held && heldFromRenda && !rendaNow() && handIn()) {
					heldFromRenda = false;
					ouchT = 0.5;
					shake = 0.35;
					se("ouch", 0.7);
					score = Math.max(0, score - OUCH_PT);
					breakCombo();
					popText("はなすのがおそい！ -" + OUCH_PT, fontR, 50, sx(860), sy(330), 0.9);
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
			if (glowT > 0) glowT -= dt;
			if (phase === "play") {
				// 10秒ごとにカメラを切りかえる(いつもの→アップ→俯瞰)
				const ns = Math.floor(now / SHOT_SEC) % 3;
				if (ns !== shot) {
					shot = ns;
					flash = Math.max(flash, 0.3); flashCol = "#ffffff";
				}
				// 時間帯がかわったら知らせる
				const ti = todNow().i;
				if (ti !== todIdx) {
					todIdx = ti;
					popText(["", "お昼になったよ！", "夕方になったよ！", "夜になったよ！"][ti], fontW, 44, W / 2, 330, 1.4);
				}
			} else if (phase === "end") {
				shot = 0;
			}
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
			setText(todLabel, "じかん：" + TIMES[todNow().i].name);
			view.modified();
		});
	});
	g.game.pushScene(scene);
}
