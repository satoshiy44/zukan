import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const H = 720;
const K0 = 1100; // 遠近の強さ
const D = 3; // カメラから自分までの距離(u)
const CAM_H = 1.0; // カメラの高さ(u)
const FOOT_Y = 650; // 自分のカートの下の高さ(画面)
const UNIT = 320; // 道ばたの絵の 320px = 1u
const ROAD = 1.8; // 道の半分の幅(u)
const Z_FAR = 60; // ここまで遠くを描く(u)
const INTRO_SEC = 5;
const END_SEC = 3;
const SPEED0 = 22; // ふつうの速さ(u/秒)
const SPEED1 = 29; // 最後のころの速さ
const HOP_V = 2.3; // ジャンプの初速
const GRAVITY = 15;
const LV_SEC = 0.45; // これだけドリフトを続けると、オーラが1段上がる
const TURN = 0.06; // 直線でドリフトしたときに曲がる強さ(1u 走るあいだに横へ動く量)
const DRIFT_IN = 0.012; // カーブの中で同じ向きにドリフトしているとき、内がわへよる強さ
const PUSH = 2.5; // カーブで外がわへ押される強さ(道の曲がり具合 × これ)
const GRIP = 0.12; // 横の動きが、目標の動きに近づく速さ(1u 走るごと)
const WALL = ROAD - 0.42; // ここより外はカベ
const VALID_SEC = 0.4; // カーブの中でこれ以上ドリフトすると点数になる
const SKEW = 0.8; // 横に動くと、道がこれだけななめに見える
const BOOST_V = 12; // ミニターボで上がる速さ
const BOOST_SEC = [0.25, 0.35, 0.5, 0.65, 0.8, 1.0, 1.3, 1.8];
const LV_PT = [50, 100, 200, 400, 700, 1100, 1600, 2400]; // はなしたときの点(段ごと)
const METER = 5; // 1u を何mとして数えるか。最後に、走ったきょり 1m = 1点 を足す
const NOTES = ["ド", "レ", "ミ", "ファ", "ソ", "ラ", "シ", "ド"];
const LV_COL = ["#ffffff", "#40a8ff", "#ffe030", "#40e070", "#b060ff", "#ff70c8", "#ff3a3a", "rainbow"];
const LV_NAME = ["白", "青", "黄", "緑", "紫", "ピンク", "赤", "虹"];

interface Animal { id: string; name: string; }
const ANIMALS: Animal[] = [
	{ id: "dog", name: "いぬ" }, { id: "cat", name: "ねこ" }, { id: "rabbit", name: "うさぎ" }, { id: "panda", name: "パンダ" },
	{ id: "bear", name: "くま" }, { id: "penguin", name: "ペンギン" }, { id: "fox", name: "きつね" }, { id: "pig", name: "ぶた" },
	{ id: "frog", name: "かえる" }, { id: "chick", name: "ひよこ" }
];
interface Stage {
	name: string; sky: string[]; far: string; cloud: string; road: string[]; side: string[]; curb: string[]; line: string;
	props: string[]; stand: string; hill: number; lava: boolean;
	fans: string[]; row: string; fly: string; // 道ばたの観客・モンスター、さくのうしろの観客の列、空をとぶもの
}
const STAGES: Stage[] = [
	{
		name: "ポップサーキット", sky: ["#3aa8ff", "#c8f0ff"], far: "far_c", cloud: "cloud_c", road: ["#6c6c80", "#646478"],
		side: ["#6cc860", "#5fb854"], curb: ["#ff4a5a", "#ffffff"], line: "#ffffff",
		props: ["tires", "flagpole", "billboard", "cone", "balloons", "flowers", "lights", "tires", "balloons"],
		stand: "stand_c", hill: 0.5, lava: false,
		fans: ["fan_a", "fan_b", "fan_c", "fan_d", "fan_e", "fan_f", "fan_g", "fan_h"], row: "row_c", fly: "bird"
	},
	{
		name: "マグマ城", sky: ["#2a0f40", "#d04a6a"], far: "far_k", cloud: "cloud_k", road: ["#4e3e60", "#463858"],
		side: ["#ff6a20", "#f05418"], curb: ["#2a1830", "#ffb020"], line: "",
		props: ["torch", "spike", "lava", "dragon", "candles", "cauldron", "crystal", "torch", "crystal"],
		stand: "stand_k", hill: 1.0, lava: true,
		fans: ["mon_ghost", "mon_imp", "mon_slime", "mon_pump", "mon_ghost", "mon_imp"], row: "row_k", fly: "bat"
	},
	{
		name: "ゆうやけ山道", sky: ["#ff8a7a", "#ffe6a8"], far: "far_m", cloud: "cloud_m", road: ["#5c5c6c", "#565666"],
		side: ["#7ac858", "#6eb84e"], curb: ["#ffffff", "#ffffff"], line: "#ffd020",
		props: ["pine", "pine", "rock", "touge", "chochin", "fence", "mushroom", "hay", "flowers", "pine"],
		stand: "stand_m", hill: 2.2, lava: false,
		fans: ["fan_a", "fan_b", "fan_c", "fan_d", "fan_e", "fan_f", "fan_g", "fan_h"], row: "row_m", fly: "bird"
	}
];

interface Seg { d0: number; d1: number; k: number; big: boolean; }
interface Curve {
	d0: number; d1: number; dir: number; warned: boolean; scored: boolean; scraped: boolean; n: number;
}
interface Prop {
	d: number; x: number; id: string; flip: boolean; kind: "sprite" | "stand" | "anim"; ph?: number; lift?: number;
}
interface Part {
	x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; col: string;
	img: string; grow: number; drag: number;
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
	const imageIds: string[] = [
		"smoke", "spark", "flame", "star", "shadow", "curve_sign", "chevron", "gate", "logo", "blimp",
		"aura0", "aura1", "aura2", "aura3", "aura4", "aura5", "aura6", "aura7",
		"stand_c0", "stand_c1", "stand_k0", "stand_k1", "stand_m0", "stand_m1",
		"tires", "flagpole", "billboard", "cone", "torch", "spike", "lava", "dragon", "pine", "rock", "rail", "touge",
		"far_c", "far_k", "far_m", "cloud_c", "cloud_k", "cloud_m",
		"balloons", "flowers", "lights", "candles", "cauldron", "crystal", "chochin", "fence", "mushroom", "hay"
	];
	["fan_a", "fan_b", "fan_c", "fan_d", "fan_e", "fan_f", "fan_g", "fan_h", "mon_ghost", "mon_imp", "mon_slime", "mon_pump",
		"bat", "bird", "row_c", "row_k", "row_m"].forEach((a) => imageIds.push(a + "0", a + "1"));
	ANIMALS.forEach((a) => imageIds.push("kart_" + a.id + "_back", "kart_" + a.id + "_side", "face_" + a.id));
	const audioIds = [
		"do0", "do1", "do2", "do3", "do4", "do5", "do6", "do7", "hop", "land", "drift", "boost1", "boost2", "boost3", "great", "perfect",
		"spin", "scrape", "wall", "warn", "count", "go", "finish", "cheer", "firework"
	];
	const scene = new g.Scene({
		game: g.game,
		assetIds: imageIds.concat(audioIds.map((a) => "se_" + a), ["bgm_c", "bgm_k", "bgm_m"])
	});
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
		// 遠くの物を軽く描くため、道ばたの絵は 1/2・1/4 の大きさのものも作っておく
		const mips: { [id: string]: g.Surface[] } = {};
		const mipOf = (id: string, f: number): g.Surface => {
			if (!mips[id]) {
				const a = img(id);
				mips[id] = [2, 4].map((k) => {
					const m = g.game.resourceFactory.createSurface(Math.ceil(a.width / k), Math.ceil(a.height / k));
					const mr = m.renderer();
					mr.begin();
					mr.save();
					mr.transform([1 / k, 0, 0, 1 / k, 0, 0]);
					mr.drawImage(surf[id], 0, 0, a.width, a.height, 0, 0);
					mr.restore();
					mr.end();
					return m;
				});
			}
			return mips[id][f === 2 ? 0 : 1];
		};
		const se = (id: string, vol = 0.6): void => {
			scene.asset.getAudioById("se_" + id).play().changeVolume(vol);
		};
		const playSec = Math.max(30, time - INTRO_SEC - END_SEC);
		const stageNo = Math.floor(rand() * STAGES.length);
		const st = STAGES[stageNo];
		const animal = ANIMALS[Math.floor(rand() * ANIMALS.length)];
		const kartBack = "kart_" + animal.id + "_back";
		const kartSide = "kart_" + animal.id + "_side";

		// ======== 状態 ========
		let phase: "intro" | "play" | "end" = "intro";
		let introLeft = INTRO_SEC;
		let elapsed = 0;
		let dist = 0;
		let speed = 0;
		let held = false;
		let py = 0; // ジャンプの高さ(u)
		let vy = 0;
		let drifting = false;
		let driftDir = 1;
		let driftT = 0;
		let level = 0; // 1〜8
		let vx = 0; // 横に動く速さ(1u 走るあいだに動く量)
		let inCurveT = 0; // いまのドリフトで、カーブの中を走った秒
		let wallSide = 0; // カベにふれている向き
		let wallCool = 0;
		let bumpT = 0;
		let boostT = 0;
		let boostPow = 0;
		let scraping = false;
		let scrapeSnd = 0;
		let px = 0; // カートの横の位置(u)
		let yaw = 0; // 見た目の向き(-1〜1)
		let combo = 0;
		let driftScore = 0;
		let drifts = 0;
		let bestLv = 0;
		let shake = 0;
		let flash = 0;
		let flashCol = "#ffffff";
		let bgX = 0;
		let cheer = 0; // 観客のもりあがり(0〜1)
		let crowdT = 0;
		let K = K0;
		const meters = (): number => Math.floor(dist * METER);

		// ======== コース ========
		const segs: Seg[] = [];
		const curves: Curve[] = [];
		const props: Prop[] = [];
		let genEnd = 0;
		let curveCount = 0;
		const estSpeed = (d: number): number => {
			const p = Math.min(1, d / ((SPEED0 + SPEED1) / 2 * playSec));
			return SPEED0 + (SPEED1 - SPEED0) * p + 2;
		};
		// 文字の入った看板は左右反転しない
		const canFlip = (id: string): boolean => id !== "touge" && id !== "billboard";
		// 道の両わきに、観客・モンスター・小物をびっしり置く
		const addProps = (d0: number, d1: number, avoid: Curve | null): void => {
			[-1, 1].forEach((side) => {
				const outer = !!avoid && side === -avoid.dir; // カーブの外がわは観客を多めに
				for (let d = d0 + rand() * 1.2; d < d1; d += 1.25 + rand() * 0.8) {
					const r = rand();
					if (r < (outer ? 0.45 : 0.25)) {
						// さくのうしろの観客の列
						props.push({ d, x: side * (ROAD + 1.6), id: st.row, flip: rand() < 0.5, kind: "anim", ph: rand() * 2 });
						d += 0.8;
					} else if (r < 0.75) {
						const id = st.fans[Math.floor(rand() * st.fans.length)];
						props.push({ d, x: side * (ROAD + 0.85 + rand() * 1.1), id, flip: rand() < 0.5, kind: "anim", ph: rand() * 2 });
					} else {
						const id = st.props[Math.floor(rand() * st.props.length)];
						const w = img(id).width / UNIT;
						const x = side * (ROAD + 0.8 + w / 2 + rand() * 1.2);
						props.push({ d, x, id, flip: canFlip(id) && rand() < 0.5, kind: "sprite" });
					}
					// 奥にも、もう一列(観客席や大きな物)
					if (rand() < 0.3) {
						if (rand() < 0.4) props.push({ d: d + 0.3, x: side * (ROAD + 3.6), id: st.stand, flip: false, kind: "stand" });
						else {
							const id = st.props[Math.floor(rand() * st.props.length)];
							const x = side * (ROAD + 3.0 + rand() * 1.5);
							props.push({ d: d + 0.3, x, id, flip: canFlip(id) && rand() < 0.5, kind: "sprite" });
						}
					}
				}
			});
			// 空をとぶ、こうもり・鳥
			for (let d = d0 + rand() * 6; d < d1; d += 6 + rand() * 6) {
				const x = (rand() * 2 - 1) * (ROAD + 1.5);
				props.push({ d, x, id: st.fly, flip: rand() < 0.5, kind: "anim", ph: rand() * 2, lift: 1.3 + rand() * 1.2 });
			}
		};
		const addCurve = (d: number, sec: number, dir: number, ang: number, sp: number): number => {
			const n = curveCount++;
			const len = sp * sec;
			const k = Math.min(0.05, ang / len) * dir;
			segs.push({ d0: d, d1: d + len, k, big: true });
			curves.push({ d0: d, d1: d + len, dir, warned: false, scored: false, scraped: false, n });
			// 入口のライン、外がわの矢印の看板、出口のゲート、観客席
			for (let q = d + 2; q < d + len - 2; q += 4.5) props.push(
				{ d: q, x: -dir * (ROAD + 0.55), id: "chevron", flip: dir < 0, kind: "sprite" }
			);
			if (len > 30) props.push({ d: d + len * 0.5, x: -dir * (ROAD + 3.6), id: st.stand, flip: false, kind: "stand" });
			addProps(d, d + len, curves[curves.length - 1]);
			return d + len;
		};
		const genCourse = (): void => {
			while (genEnd < dist + Z_FAR + 120) {
				const sp = estSpeed(genEnd);
				const first = curveCount === 0;
				// みじかい直線(ゆるく曲がる)
				const straight = sp * (first ? 3.4 : 0.8 + rand() * 1.0);
				let d = genEnd;
				segs.push({ d0: d, d1: d + straight, k: first ? 0 : (rand() * 2 - 1) * 0.004, big: false });
				addProps(d, d + straight, null);
				d += straight;
				// カーブ: 1つだけのときと、左右に切りかえすS字(2〜4つ)
				const r = rand();
				const chain = first ? 1 : r < 0.3 ? 1 : r < 0.7 ? 2 : r < 0.9 ? 3 : 4;
				let dir = rand() < 0.5 ? -1 : 1;
				for (let j = 0; j < chain; j++) {
					const t = rand();
					// みじかい・ふつう・ながいカーブをまぜる
					let sec = first ? 2.2 : t < 0.35 ? 1.1 + rand() * 0.5 : t < 0.75 ? 1.9 + rand() * 0.8 : 3.3 + rand() * 1.3;
					if (chain >= 3 && sec > 3) sec = 2.0 + rand() * 0.6;
					const ang = sec < 1.7 ? 0.9 + rand() * 0.4 : sec < 3 ? 1.4 + rand() * 0.5 : 2.0 + rand() * 0.6;
					d = addCurve(d, sec, dir, ang, sp);
					dir = -dir;
				}
				genEnd = d;
			}
			props.sort((a, b) => a.d - b.d);
		};
		let segIdx = 0;
		const curvAt = (d: number): number => {
			let i = segIdx;
			while (i < segs.length - 1 && segs[i].d1 <= d) i++;
			const s = segs[i];
			if (!s || d < s.d0) return 0;
			const t = (d - s.d0) / (s.d1 - s.d0);
			const e = Math.min(1, t / 0.12, (1 - t) / 0.12);
			return s.k * e * e * (3 - 2 * e);
		};
		const courseY = (d: number): number => st.hill * (Math.sin(d / 38) + 0.5 * Math.sin(d / 16 + 1.2)) * Math.min(1, d / 60);
		genCourse();

		// 奥の道の横ずれを、毎フレームまとめて計算する
		const ZS: number[] = [];
		for (let z = -1; z <= Z_FAR + 1; z += z < 10 ? 0.25 : 0.5) ZS.push(z);
		const CX: number[] = ZS.map(() => 0);
		const calcCurve = (): void => {
			let x = 0, dx = 0;
			for (let i = 0; i < ZS.length; i++) {
				const z = ZS[i];
				if (z <= 0) {
					CX[i] = 0; continue;
				}
				const dz = z - Math.max(0, ZS[i - 1]);
				dx += curvAt(dist + z) * dz;
				x += dx * dz;
				CX[i] = x;
			}
		};
		let skew = 0;
		const curveX = (z: number): number => curveX0(z) - (z > 0 ? skew * z : 0);
		const curveX0 = (z: number): number => {
			if (z <= 0) return 0;
			if (z >= ZS[ZS.length - 1]) return CX[CX.length - 1];
			let lo = 0, hi = ZS.length - 1;
			while (hi - lo > 1) {
				const m = (lo + hi) >> 1;
				if (ZS[m] <= z) lo = m; else hi = m;
			}
			const t = (z - ZS[lo]) / (ZS[hi] - ZS[lo]);
			return CX[lo] + (CX[hi] - CX[lo]) * t;
		};
		let baseY = 0;
		const scale = (z: number): number => K / (z + D);
		const hor = (): number => FOOT_Y - CAM_H * K / D;
		const elev = (z: number): number => courseY(dist + z) - baseY;
		const groundY = (z: number): number => hor() + (CAM_H - elev(z)) * scale(z);
		const camX = (): number => px * 0.45;
		const screenX = (x: number, z: number): number => W / 2 + (x - camX() + curveX(z)) * scale(z);

		// ======== 絵 ========
		const view = new View({ scene, width: W, height: H });
		scene.append(view);
		const lerpCol = (a: string, b: string, t: number): string => {
			const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
			const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
			return "rgb(" + c.join(",") + ")";
		};
		const SKY: string[] = [];
		for (let i = 0; i < 24; i++) SKY.push(lerpCol(st.sky[0], st.sky[1], i / 23));
		const tile = (r: g.Renderer, id: string, off: number, bottom: number): void => {
			const a = img(id);
			let x0 = (((off % a.width) + a.width) % a.width) - a.width;
			while (x0 < W) {
				r.drawImage(surf[id], 0, 0, a.width, a.height, x0, bottom - a.height);
				x0 += a.width;
			}
		};
		const drawSky = (r: g.Renderer): void => {
			const h0 = hor();
			const bh = (h0 + 40) / SKY.length;
			for (let i = 0; i < SKY.length; i++) r.fillRect(0, i * bh, W, bh + 1, SKY[i]);
			tile(r, st.cloud, -bgX * 0.4 + elapsed * 6, h0 - 40);
			if (stageNo === 0) {
				const b = img("blimp");
				const bx = ((((-bgX * 0.6 + elapsed * 14 + 300) % 3000) + 3000) % 3000) - 600;
				r.drawImage(surf.blimp, 0, 0, b.width, b.height, bx, 110 + Math.sin(elapsed * 0.8) * 6);
			}
			tile(r, st.far, -bgX, h0 + 12);
		};
		// 坂の向こうにかくれるところ
		const clipZ: number[] = [];
		const clipV: number[] = [];
		const clipFor = (z: number): number => {
			// clipZ は小さい順なので、二分探索で z 以下の最後の場所をさがす
			if (clipZ.length === 0 || clipZ[0] > z) return H;
			let lo = 0, hi = clipZ.length - 1;
			while (lo < hi) {
				const m = (lo + hi + 1) >> 1;
				if (clipZ[m] <= z) lo = m; else hi = m - 1;
			}
			return clipV[lo];
		};
		const drawGround = (r: g.Renderer): void => {
			const h0 = hor();
			r.fillRect(0, h0, W, H - h0, st.side[0]);
			clipZ.length = 0;
			clipV.length = 0;
			let clip = H;
			let z0 = -0.9;
			let y0 = groundY(z0), c0 = curveX(z0), s0 = scale(z0);
			const cx = camX();
			while (z0 < Z_FAR) {
				const z1 = z0 + 0.12 + Math.max(0, z0) * 0.035;
				const y1 = groundY(z1), c1 = curveX(z1), s1 = scale(z1);
				clipZ.push(z0);
				clipV.push(clip);
				if (y1 < clip) {
					const band = ((Math.floor((z0 + dist) / 1.2) % 2) + 2) % 2;
					const band2 = ((Math.floor((z0 + dist) / 2.4) % 2) + 2) % 2;
					const bottom = Math.min(y0, clip);
					for (let y = Math.max(0, Math.floor(y1)); y < bottom; y += 3) {
						const t = y0 === y1 ? 0 : (y0 - y) / (y0 - y1);
						const sc = s0 + (s1 - s0) * t, c = c0 + (c1 - c0) * t;
						const hh = Math.min(3, bottom - y);
						const mid = W / 2 + (c - cx) * sc;
						r.fillRect(0, y, W, hh, st.side[band]);
						const l = mid - ROAD * sc, rr = mid + ROAD * sc;
						if (st.lava) {
							// マグマの道ばた: 道のきわは石のふち
							const e2 = 0.35 * sc;
							r.fillRect(l - e2, y, e2, hh, "#5a3a4a");
							r.fillRect(rr, y, e2, hh, "#5a3a4a");
						}
						r.fillRect(l, y, rr - l, hh, st.road[band]);
						const e = Math.max(1, 0.13 * sc);
						r.fillRect(l, y, e, hh, st.curb[band]);
						r.fillRect(rr - e, y, e, hh, st.curb[band]);
						if (st.line && band2 === 0) {
							const lw = Math.max(1, 0.05 * sc);
							r.fillRect(mid - lw / 2, y, lw, hh, st.line);
						}
					}
					clip = Math.min(clip, y1);
				}
				z0 = z1; y0 = y1; c0 = c1; s0 = s1;
			}
		};
		const drawSprite = (r: g.Renderer, id: string, x: number, z: number, flip: boolean, alpha: number, lift = 0): void => {
			const a = img(id);
			const sc = scale(z) / UNIT;
			const sx = screenX(x, z);
			const w = a.width * sc;
			if (sx + w / 2 < 0 || sx - w / 2 > W) return;
			if (w < 7 && a.height * sc < 10) return; // 遠くて小さすぎるものは描かない
			const top = groundY(z) - a.height * sc - lift * scale(z);
			const visH = lift > 0 ? a.height : Math.min(a.height, (clipFor(z) - top) / sc);
			if (visH <= 1) return;
			// 小さく描くときは、小さく作っておいた絵を使う
			const f = sc < 0.25 ? 4 : sc < 0.5 ? 2 : 1;
			const ss = sc * f;
			r.save();
			if (alpha < 1) r.opacity(alpha);
			if (flip) r.transform([-ss, 0, 0, ss, sx + w / 2, top]);
			else r.transform([ss, 0, 0, ss, sx - w / 2, top]);
			if (f === 1) r.drawImage(surf[id], 0, 0, a.width, visH, 0, 0);
			else r.drawImage(mipOf(id, f), 0, 0, Math.ceil(a.width / f), Math.max(1, Math.floor(visH / f)), 0, 0);
			r.restore();
		};
		// 観客席の場所(紙ふぶきを出すため)
		const standPos: { x: number; y: number; w: number }[] = [];
		const auraId = (): string => "aura" + Math.min(7, Math.max(0, level - 1));
		// 虹は1つぶずつ色をかえる
		const pcol = (c: string): string => c === "rainbow" ? "hsl(" + Math.floor(rand() * 360) + ",95%,62%)" : c;
		const kartPos = (): { x: number; y: number } => ({ x: screenX(px, 0), y: groundY(0) - py * scale(0) });
		const drawKart = (r: g.Renderer): void => {
			const kp = kartPos();
			const bob = py <= 0 && phase !== "intro" ? Math.sin(elapsed * 30) * 1.5 : 0;
			// 影
			const sh = img("shadow"), ss = Math.max(0.5, 1 - py * 0.8) * 1.1;
			r.save();
			r.transform([ss, 0, 0, ss, kp.x - sh.width * ss / 2, groundY(0) - sh.height * ss / 2 - 6]);
			r.drawImage(surf.shadow, 0, 0, sh.width, sh.height, 0, 0);
			r.restore();
			// オーラ
			if (drifting && level > 0) {
				const a = img(auraId());
				const pul = 1 + Math.sin(elapsed * 22) * 0.05 + level * 0.03;
				r.save();
				r.opacity(0.7 + Math.min(0.3, level * 0.04));
				r.transform([pul, 0, 0, pul, kp.x - a.width * pul / 2, kp.y - 125 - a.height * pul / 2]);
				r.drawImage(surf[auraId()], 0, 0, a.width, a.height, 0, 0);
				r.restore();
			}
			// ターボの炎
			if (boostT > 0) {
				const f = img("flame");
				[-1, 1].forEach((s) => {
					const fl = 0.8 + Math.sin(elapsed * 50 + s) * 0.25;
					r.save();
					r.transform([fl * 0.8, 0, 0, -fl, kp.x + s * 52 - f.width * 0.4 * fl - yaw * 60, kp.y + 20 + f.height * fl - 30]);
					r.drawImage(surf.flame, 0, 0, f.width, f.height, 0, 0);
					r.restore();
				});
			}
			// カート: 向きでうしろ/ななめの絵を使い分ける
			let id = kartBack, flip = false, rot = 0;
			if (Math.abs(yaw) > 0.35) {
				id = kartSide;
				flip = yaw < 0;
				rot = yaw * 0.06 + (drifting ? Math.sin(elapsed * 40) * 0.02 : 0);
			} else {
				rot = yaw * 0.12;
			}
			const a = img(id);
			const s = 1.0;
			const cos = Math.cos(rot) * s, sin = Math.sin(rot) * s;
			r.save();
			r.transform([flip ? -cos : cos, flip ? -sin : sin, -sin, cos, kp.x, kp.y + bob]);
			r.drawImage(surf[id], 0, 0, a.width, a.height, -a.width / 2, -a.height + 6);
			r.restore();
			if (wallSide !== 0) {
				// カベにふれているあいだは、手前がわで火花がちる
				rot += Math.sin(elapsed * 60) * 0.03;
			}
			if (bumpT > 0) {
				for (let k = 0; k < 3; k++) {
					const t = elapsed * 9 + k * 2.1;
					const sa = img("star");
					r.drawImage(surf.star, 0, 0, sa.width, sa.height, kp.x + Math.cos(t) * 90 - 28, kp.y - 250 + Math.sin(t) * 20);
				}
			}
		};
		const parts: Part[] = [];
		const drawParts = (r: g.Renderer, front: boolean): void => {
			parts.forEach((p) => {
				if ((p.img === "smoke") === front) return;
				const al = Math.min(1, p.life / p.max * 2);
				r.save();
				r.opacity(al);
				if (p.img) {
					const a = img(p.img);
					const s = p.size / a.width;
					if (p.img === "spark") r.setCompositeOperation("lighter");
					r.transform([s, 0, 0, s, p.x - p.size / 2, p.y - p.size / 2]);
					r.drawImage(surf[p.img], 0, 0, a.width, a.height, 0, 0);
				} else {
					r.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.col);
				}
				r.restore();
			});
		};
		const speedLines: { a: number; r: number; l: number; life: number }[] = [];
		const winds: { x: number; y: number; vy: number; len: number; w: number; life: number }[] = [];
		view.draw = (r: g.Renderer): void => {
			r.save();
			if (shake > 0) r.translate(Math.sin(shake * 60) * shake * 24, Math.cos(shake * 47) * shake * 10);
			drawSky(r);
			drawGround(r);
			// 遠いものから順に
			standPos.length = 0;
			type Item = { z: number; fn: () => void };
			const items: Item[] = [];
			props.forEach((p) => {
				const z = p.d - dist;
				if (z > Z_FAR || z < -D + 0.6) return;
				const alpha = z > Z_FAR - 8 ? Math.max(0, (Z_FAR - z) / 8) : z < 0 ? Math.max(0, 1 + z / 1.6) : 1;
				if (p.kind === "stand") {
					const id = p.id + (Math.floor(crowdT) % 2);
					items.push({
						z, fn: () => {
							drawSprite(r, id, p.x, z, false, alpha);
							if (z > 2 && z < 30) {
								const w = img(id).width * scale(z) / UNIT;
								standPos.push({ x: screenX(p.x, z), y: groundY(z) - img(id).height * scale(z) / UNIT * 0.7, w });
							}
						}
					});
				} else if (p.kind === "anim") {
					// 2コマで動く。ひとりずつタイミングをずらす
					const id = p.id + (Math.floor(crowdT * 1.3 + (p.ph || 0)) % 2);
					const lift = p.lift ? p.lift + Math.sin(elapsed * 3 + (p.ph || 0) * 3) * 0.15 : 0;
					items.push({ z, fn: () => drawSprite(r, id, p.x, z, p.flip, alpha, lift) });
				} else {
					items.push({ z, fn: () => drawSprite(r, p.id, p.x, z, p.flip, alpha) });
				}
			});
			items.sort((a, b) => b.z - a.z);
			items.forEach((it) => it.fn());
			drawParts(r, false);
			drawKart(r);
			drawParts(r, true);
			winds.forEach((w) => {
				r.save();
				r.opacity(Math.min(1, w.life * 5) * 0.85);
				r.fillRect(w.x - w.w / 2, w.y, w.w, w.len, "#ffffff");
				r.restore();
			});
			// スピード線
			speedLines.forEach((s) => {
				const cx = W / 2, cy = hor() + 60;
				r.save();
				r.opacity(Math.min(1, s.life * 4) * 0.8);
				r.transform([Math.cos(s.a), Math.sin(s.a), -Math.sin(s.a), Math.cos(s.a), cx, cy]);
				r.fillRect(s.r, -2, s.l, 4, "#ffffff");
				r.restore();
			});
			r.restore();
			if (flash > 0) {
				r.save();
				r.opacity(Math.min(0.6, flash));
				r.fillRect(0, 0, W, H, flashCol);
				r.restore();
			}
		};

		// ======== 文字 ========
		const font = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 72, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = font("#ffffff", "#2a1840");
		const fontY = font("#ffe840", "#2a1840");
		const fontR = font("#ff5a6a", "#ffffff");
		const fontC = font("#70e8ff", "#2a1840");
		const fontP = font("#ff8ad8", "#ffffff");
		const lvFonts = LV_COL.map((c) => c === "rainbow" ? font("#ffffff", "#ff4a9a", 10) : font(c, "#2a1840"));
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
		const hud = new View({ scene, width: W, height: H });
		scene.append(hud);
		const face = new g.Sprite({ scene, src: img("face_" + animal.id), x: 14, y: 6, scaleX: 0.62, scaleY: 0.62 });
		scene.append(face);
		const scoreLabel = label(fontW, 46, 118, 18, "0");
		const timeLabel = label(fontW, 44, W - 24, 18, "", "right");
		const distLabel = label(fontC, 32, W - 24, 74, "", "right");
		const comboLabel = label(fontY, 36, 118, 74, "");
		const pops: Pop[] = [];
		const popText = (t: string, f: g.Font, size: number, x: number, y: number, life = 0.9): void => {
			const l = label(f, size, x, y, t, "center");
			l.anchorX = 0.5;
			l.anchorY = 0.5;
			l.x = x;
			l.y = y + size / 2;
			pops.push({ l, life, vy: -70, scale: 1.4 });
		};
		// ドレミのメーター
		const meterLabels: g.Label[] = [];
		NOTES.forEach((n, i) => meterLabels.push(label(fontW, 26, W / 2 + (i - 3.5) * 74, H - 50, n, "center")));
		hud.draw = (r: g.Renderer): void => {
			// カーブ注意の看板(点滅)
			const c = nextWarn();
			if (c && phase === "play" && Math.floor(elapsed * 7) % 2 === 0) {
				const a = img("curve_sign");
				const s = 0.75;
				r.save();
				if (c.dir < 0) r.transform([-s, 0, 0, s, W / 2 + a.width * s / 2, 92]);
				else r.transform([s, 0, 0, s, W / 2 - a.width * s / 2, 92]);
				r.drawImage(surf.curve_sign, 0, 0, a.width, a.height, 0, 0);
				r.restore();
			}
			// メーター
			for (let i = 0; i < 8; i++) {
				const x = W / 2 + (i - 3.5) * 74 - 32, y = H - 56;
				const on = drifting && level > i;
				r.fillRect(x - 3, y - 3, 70, 48, "#2a1840");
				if (on) {
					r.fillRect(x, y, 64, 42, i === 7 ? "hsl(" + Math.floor((elapsed * 500) % 360) + ",95%,62%)" : LV_COL[i]);
				} else {
					r.save();
					r.opacity(0.35);
					r.fillRect(x, y, 64, 42, i === 7 ? "#ffb0e0" : LV_COL[i]);
					r.restore();
				}
			}
		};

		// ======== はじめの説明 ========
		const intro = new g.E({ scene });
		scene.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(30,12,50,0.6)", width: W, height: H }));
		intro.append(new g.Sprite({ scene, src: img("logo"), x: W / 2, y: 130, anchorX: 0.5, anchorY: 0.5, scaleX: 0.5, scaleY: 0.5 }));
		intro.append(new g.Sprite({ scene, src: img("face_" + animal.id), x: 300, y: 262, scaleX: 0.7, scaleY: 0.7 }));
		label(fontY, 40, 420, 268, "ドライバー：" + animal.name, "left", intro);
		label(fontC, 40, 420, 318, "コース：" + st.name, "left", intro);
		label(fontW, 34, W / 2, 400, "タップでジャンプ → 長押しでドリフト！ ドリフトしているあいだだけ曲がる", "center", intro);
		label(fontY, 34, W / 2, 448, "長く続けるほど ドレミファソラシド とオーラの色が上がる", "center", intro);
		label(fontP, 34, W / 2, 496, "はなすとまっすぐ加速！ はなすタイミングで走るラインを決めよう", "center", intro);
		label(fontR, 30, W / 2, 544, "カーブの中で長くドリフトするほど高得点！ カベにぶつかるとコンボがとぎれる", "center", intro);
		const countLabel = label(fontY, 100, W / 2, 586, "", "center", intro);

		// ======== 操作: タップ(ジャンプ) → 長押し(ドリフト) → はなす ========
		const canHop = (): boolean => phase === "play" && py <= 0 && !drifting;
		scene.onPointDownCapture.add(() => {
			held = true;
			if (canHop()) {
				vy = HOP_V;
				py = 0.001;
				se("hop", 0.5);
			}
		});
		scene.onPointUpCapture.add(() => {
			held = false;
			if (drifting) releaseDrift();
		});

		// ======== カーブ ========
		// いま走っている(またはすぐ先の)大きなカーブ
		const curveNear = (ahead: number): Curve | null => {
			const sp = Math.max(10, speed);
			for (let i = 0; i < curves.length; i++) {
				const c = curves[i];
				if (dist >= c.d0 - ahead * sp && dist < c.d1) return c;
				if (c.d0 > dist + 200) break;
			}
			return null;
		};
		const nextWarn = (): Curve | null => {
			for (let i = 0; i < curves.length; i++) {
				const c = curves[i];
				const sp = Math.max(10, speed);
				const t = (c.d0 - dist) / sp;
				if (t < 1.3 && dist < c.d0 + 0.3 * sp) return c;
				if (t > 2) break;
			}
			return null;
		};
		const nextCurve = (): Curve | null => {
			for (let i = 0; i < curves.length; i++) if (curves[i].d1 > dist) return curves[i];
			return null;
		};

		// ======== ドリフト ========
		const burst = (x: number, y: number, n: number, col: string, sp: number, size = 10): void => {
			for (let k = 0; k < n; k++) {
				const a = rand() * Math.PI * 2, v = sp * (0.4 + rand() * 0.8);
				parts.push({
					x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 300, life: 0.5 + rand() * 0.4, max: 0.9,
					size: size * (0.6 + rand() * 0.8), col: pcol(col),
					img: "", grow: 0, drag: 0.93
				});
			}
		};
		const starBurst = (x: number, y: number, n: number, sp: number): void => {
			for (let k = 0; k < n; k++) {
				const a = k / n * Math.PI * 2;
				parts.push({
					x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, life: 0.6,
					max: 0.6, size: 40, col: "", img: "spark", grow: -30, drag: 0.9
				});
			}
		};
		const startDrift = (): void => {
			// 向きは自動: カーブの中・手前ならそのカーブの向き、直線なら道のまん中へもどる向き
			const c = curveNear(0.8);
			if (c) driftDir = c.dir;
			else if (Math.abs(px) > 0.35) driftDir = px > 0 ? -1 : 1;
			else {
				const n = nextCurve();
				driftDir = n ? n.dir : 1;
			}
			drifting = true;
			driftT = 0;
			inCurveT = 0;
			level = 1;
			se("drift", 0.5);
			se("do0", 0.55);
			const kp = kartPos();
			popText(NOTES[0], lvFonts[0], 44, kp.x, kp.y - 300, 0.6);
			burst(kp.x, kp.y - 40, 12, LV_COL[0], 380);
		};
		const firework = (): void => {
			const x = 200 + rand() * (W - 400), y = 80 + rand() * 160;
			const hue = Math.floor(rand() * 360);
			for (let k = 0; k < 36; k++) {
				const a = k / 36 * Math.PI * 2, v = 260 + rand() * 60;
				parts.push({
					x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120, life: 1.1, max: 1.1, size: 9,
					col: "hsl(" + ((hue + k * 7) % 360) + ",95%,65%)", img: "", grow: 0, drag: 0.95
				});
			}
			se("firework", 0.4);
		};
		const confetti = (n: number): void => {
			standPos.forEach((s) => {
				for (let k = 0; k < n; k++) {
					parts.push({
						x: s.x + (rand() - 0.5) * s.w, y: s.y, vx: (rand() - 0.5) * 200,
						vy: -200 - rand() * 250, g: 500, life: 1.0 + rand() * 0.5, max: 1.5,
						size: 7 + rand() * 6, col: "hsl(" + Math.floor(rand() * 360) + ",95%,65%)", img: "", grow: 0, drag: 0.97
					});
				}
			});
		};
		const comboMul = (): number => 1 + 0.1 * Math.min(20, Math.max(0, combo - 1));
		const RATING = ["ナイス！", "ナイス！", "グッド！", "グッド！", "グレート！", "グレート！", "すごい！", "にじいろ！！"];
		const releaseDrift = (): void => {
			const lv = level;
			const valid = inCurveT >= VALID_SEC;
			drifting = false;
			level = 0;
			const kp = kartPos();
			// ドリフトのあとは、まっすぐ加速(白い風)
			boostT = BOOST_SEC[lv - 1] * (valid ? 1 : 0.5);
			boostPow = 0.4 + lv * 0.09;
			se(lv >= 7 ? "boost3" : lv >= 4 ? "boost2" : "boost1", 0.6);
			if (!valid) return; // 直線のドリフトは点数にならない
			combo++;
			// 点数は、カーブの中でドリフトしていた長さで決まる
			const plv = Math.min(lv, 1 + Math.floor(inCurveT / LV_SEC));
			const pts = Math.round(LV_PT[plv - 1] * comboMul());
			driftScore += pts;
			drifts++;
			bestLv = Math.max(bestLv, lv);
			const f = lv >= 8 ? fontP : lv >= 5 ? fontY : fontW;
			popText(RATING[lv - 1], f, 52 + lv * 3, kp.x, kp.y - 360);
			popText("+" + pts, lvFonts[lv - 1], 48, kp.x, kp.y - 290);
			burst(kp.x, kp.y - 60, 14 + lv * 4, LV_COL[lv - 1], 500 + lv * 40, 12);
			if (lv >= 5) {
				se("perfect", 0.6);
				starBurst(kp.x, kp.y - 100, 10, 700);
				flash = 0.3;
				flashCol = "#ffffff";
				cheer = Math.min(1, cheer + 0.2 + lv * 0.08);
				if (lv >= 6) {
					se("cheer", 0.5);
					confetti(10);
				}
				if (lv >= 8) {
					firework(); firework(); firework();
					popText("にじいろドリフト！！", fontP, 54, W / 2, 120, 1.4);
				}
			} else {
				se("great", 0.5);
				cheer = Math.min(1, cheer + 0.15);
			}
		};

		// ======== おしまい ========
		let finished = false;
		// 最後に、走ったきょりを点数にして、画面のまん中で数えながら左上の点数に足す
		let tallyT = -1;
		let distPts = 0;
		let tallyDone = false;
		let tallyTick = 0;
		let addLabel: g.Label | null = null;
		const finish = (): void => {
			if (finished) return;
			finished = true;
			phase = "end";
			if (drifting) releaseDrift();
			distPts = meters();
			// ランキングに使う点数は、すぐに最終の値にしておく
			g.game.vars.gameState.score = driftScore + distPts;
			se("finish", 0.7);
			se("cheer", 0.5);
			const over = new g.FilledRect({ scene, cssColor: "rgba(30,12,50,0.55)", width: W, height: H });
			scene.insertBefore(over, face);
			label(fontY, 96, W / 2, 110, "おしまい！", "center");
			label(fontC, 48, W / 2, 250, "走ったきょり " + distPts + "m", "center");
			addLabel = label(fontY, 76, W / 2, 316, "+0", "center");
			tallyT = 0;
		};
		const finishTally = (): void => {
			tallyDone = true;
			se("perfect", 0.6);
			flash = 0.3; flashCol = "#ffffff";
			burst(W / 2, 360, 30, "rainbow", 600, 12);
			label(fontW, 64, W / 2, 420, "ごうけい " + (driftScore + distPts) + "てん", "center");
			label(fontP, 36, W / 2, 510, "カーブでドリフト " + drifts + "回", "center");
			if (bestLv > 0) label(
				lvFonts[bestLv - 1], 36, W / 2, 560, "いちばん長いドリフト：" + LV_NAME[bestLv - 1] + "（" + NOTES[bestLv - 1] + "）", "center"
			);
		};


		// ======== 毎フレーム ========
		const bgm = scene.asset.getAudioById(stageNo === 0 ? "bgm_c" : stageNo === 1 ? "bgm_k" : "bgm_m");
		let lastCount = -1;
		const progress = (): number => Math.min(1, elapsed / playSec);
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
					popText("GO!!", fontY, 110, W / 2, 230, 1.0);
					g.game.audio.music.play(bgm);
				}
			} else if (phase === "play") {
				elapsed += dt;
				if (elapsed >= playSec) finish();
			} else {
				elapsed += dt;
			}
			const playing = phase === "play";
			genCourse();
			while (segIdx < segs.length - 1 && segs[segIdx].d1 <= dist) segIdx++;

			// ジャンプと着地
			if (py > 0) {
				py += vy * dt;
				vy -= GRAVITY * dt;
				if (py <= 0) {
					py = 0; vy = 0;
					se("land", 0.4);
					if (held && playing) startDrift();
				}
			}
			// ドリフト中: 段が上がる
			const kNow = curvAt(dist);
			const cNow = curveNear(0);
			if (drifting) {
				driftT += dt;
				if (cNow && cNow.dir === driftDir) inCurveT += dt;
				const nl = Math.min(8, 1 + Math.floor(driftT / LV_SEC));
				const kp = kartPos();
				if (nl !== level) {
					level = nl;
					se("do" + (level - 1), 0.55);
					popText(NOTES[level - 1], lvFonts[level - 1], 44 + level * 3, kp.x + driftDir * 160, kp.y - 280, 0.6);
					burst(kp.x, kp.y - 80, 10 + level * 2, LV_COL[level - 1], 400 + level * 30);
					if (level === 8) {
						flash = 0.25; flashCol = "#ffe0ff";
					}
				}
			}
			// カーブの予告
			for (let i = 0; i < curves.length && playing; i++) {
				const c = curves[i];
				if (c.d0 > dist + 60) break;
				if (!c.warned && (c.d0 - dist) / Math.max(10, speed) < 1.3) {
					c.warned = true;
					se("warn", 0.5);
					if (c.n < 2) popText("タップ＆長押しでドリフトして曲がろう！", fontC, 40, W / 2, 330, 1.6);
				}
			}
			// カベ
			if (wallCool > 0) wallCool -= dt;
			if (bumpT > 0) bumpT -= dt;
			if (wallSide !== 0) {
				scrapeSnd -= dt;
				if (scrapeSnd <= 0) {
					se("scrape", 0.4); scrapeSnd = 0.28;
				}
			}
			scraping = wallSide !== 0;
			// 速さ
			let target = phase === "intro" ? 0 : SPEED0 + (SPEED1 - SPEED0) * progress();
			if (boostT > 0) target += BOOST_V * boostPow;
			if (scraping) target *= 0.6;
			speed += (target - speed) * Math.min(1, dt * (boostT > 0 ? 5 : phase === "intro" ? 3 : 2));
			const move = speed * dt;
			dist += move;
			baseY = courseY(dist);
			const curv = kNow;
			// 横の動き: ドリフト中は内がわへ曲がり、そうでないとカーブの外へ押される
			if (phase !== "intro") {
				let want = -curv * PUSH;
				if (drifting) want = cNow && cNow.dir === driftDir ? driftDir * DRIFT_IN : want + driftDir * TURN;
				vx += (want - vx) * Math.min(1, move * GRIP);
				px += vx * move;
			}
			wallSide = 0;
			if (Math.abs(px) > WALL) {
				wallSide = px > 0 ? 1 : -1;
				px = wallSide * WALL;
				if (vx * wallSide > 0) vx = -vx * 0.2;
				if (wallCool <= 0 && playing) {
					se("wall", 0.6);
					shake = 0.25;
					if (combo >= 2) popText("コンボがとぎれた…", fontR, 34, W / 2, 200);
					combo = 0;
					popText("ゴツン！", fontR, 56, kartPos().x, kartPos().y - 320);
					bumpT = 0.6;
				}
				wallCool = 0.8;
			}
			skew += (vx * SKEW - skew) * Math.min(1, dt * 6);
			bgX += curv * move * 380;
			calcCurve();
			if (boostT > 0) boostT -= dt;
			if (shake > 0) shake = Math.max(0, shake - dt);
			if (flash > 0) flash = Math.max(0, flash - dt * 2);
			// 見た目の向き
			const tyaw = drifting ? driftDir : Math.max(-0.3, Math.min(0.3, vx * 4));
			yaw += (tyaw - yaw) * Math.min(1, dt * 10);
			// カメラの遠近: ターボで少し広角に
			const kt = K0 * (boostT > 0 ? 0.9 : 1);
			K += (kt - K) * Math.min(1, dt * 4);
			// 観客
			cheer = Math.max(0, cheer - dt * 0.25);
			const hype = Math.max(cheer, drifting ? level / 10 : 0);
			crowdT += dt * (2 + hype * 8);
			if (hype > 0.5 && rand() < hype * 0.3) confetti(1);

			// パーティクル
			const kp = kartPos();
			if (drifting) {
				// タイヤの火花と白いけむり
				const col = LV_COL[level - 1];
				[-1, 1].forEach((s) => {
					const wx = kp.x + (s === -driftDir ? -driftDir * 120 : driftDir * 30), wy = kp.y - 12;
					if (rand() < 0.9) {
						parts.push({
							x: wx, y: wy, vx: -driftDir * (100 + rand() * 300), vy: -100 - rand() * 300, g: 900, life: 0.35, max: 0.35,
							size: 7 + level, col: pcol(col), img: "", grow: 0, drag: 0.96
						});
					}
				});
				if (rand() < 0.7) {
					parts.push({
						x: kp.x - driftDir * 110 + (rand() - 0.5) * 40, y: kp.y - 20,
						vx: -driftDir * (80 + rand() * 120), vy: 40 + rand() * 60, g: 0,
						life: 0.6, max: 0.6, size: 60, col: "", img: "smoke", grow: 160, drag: 0.97
					});
				}
				if (level >= 3 && rand() < 0.4) {
					parts.push({
						x: kp.x + (rand() - 0.5) * 300, y: kp.y - 60 - rand() * 160, vx: 0, vy: -120, g: 0, life: 0.4, max: 0.4,
						size: 26 + level * 3, col: "", img: "spark", grow: -40, drag: 1
					});
				}
			}
			if (scraping) {
				for (let k = 0; k < 2; k++) {
					const side = wallSide;
					parts.push({
						x: kp.x + side * 130, y: kp.y - 30, vx: -side * (-50 + rand() * 150),
						vy: -150 - rand() * 300, g: 1000, life: 0.3, max: 0.3,
						size: 8, col: rand() < 0.5 ? "#ffe060" : "#ff9a30", img: "", grow: 0, drag: 0.95
					});
				}
			}
			if (boostT > 0) {
				// 白く風を切る
				for (let k = 0; k < 2; k++) speedLines.push(
					{ a: rand() * Math.PI * 2, r: 300 + rand() * 200, l: 120 + rand() * 200, life: 0.25 }
				);
				for (let k = 0; k < 3; k++) {
					const side = rand() < 0.5 ? -1 : 1;
					winds.push({
						x: kp.x + side * (110 + rand() * 220), y: kp.y - 260 - rand() * 120,
						vy: 1600 + rand() * 600, len: 70 + rand() * 120, w: 3 + rand() * 3, life: 0.3
					});
				}
			}
			for (let i = winds.length - 1; i >= 0; i--) {
				const w = winds[i];
				w.y += w.vy * dt; w.x += (w.x - kp.x) * dt * 1.5; w.life -= dt;
				if (w.life <= 0 || w.y > H) winds.splice(i, 1);
			}
			for (let i = parts.length - 1; i >= 0; i--) {
				const p = parts[i];
				p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= p.drag; p.vy *= p.drag;
				p.size = Math.max(1, p.size + p.grow * dt);
				p.life -= dt;
				if (p.life <= 0) parts.splice(i, 1);
			}
			for (let i = speedLines.length - 1; i >= 0; i--) {
				const s = speedLines[i];
				s.r += 2400 * dt; s.life -= dt;
				if (s.life <= 0) speedLines.splice(i, 1);
			}
			for (let i = props.length - 1; i >= 0; i--) {
				if (props[i].d - dist < -D) props.splice(i, 1);
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

			// 表示
			let sc = driftScore;
			if (phase === "end") {
				// 0.4秒まってから、1.2秒で数え上げる
				tallyT += dt;
				const t = Math.max(0, Math.min(1, (tallyT - 0.4) / 1.2));
				const add = Math.round(distPts * t);
				sc = driftScore + add;
				if (addLabel) setText(addLabel, "+" + add + "てん");
				if (t > 0 && t < 1) {
					tallyTick -= dt;
					if (tallyTick <= 0) {
						se("count", 0.25); tallyTick = 0.07;
					}
				}
				if (t >= 1 && !tallyDone) finishTally();
			} else {
				g.game.vars.gameState.score = sc;
			}
			setText(scoreLabel, sc + "てん");
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(playSec - elapsed)));
			setText(distLabel, (phase === "end" ? distPts : meters()) + "m");
			setText(comboLabel, combo >= 2 ? combo + "コンボ ×" + comboMul().toFixed(1) : "");
			meterLabels.forEach((l, i) => {
				const op = drifting && level > i ? 1 : 0.5;
				if (l.opacity !== op) {
					l.opacity = op; l.modified();
				}
			});
			view.modified();
			hud.modified();
		});
	});
	g.game.pushScene(scene);
}
