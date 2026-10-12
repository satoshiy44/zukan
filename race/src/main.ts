import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const CY = 330; // 地平線の高さ
const YS = 360; // 縦方向の広がり
const SEG = 200; // 道の1区切りの長さ
const ROAD = 1500; // 道の半分の幅(基準)
const CAM_H = 1200; // カメラの高さ
const DEPTH = 0.84; // 視野の広さ(1 / tan(画角/2))
const PLAYER_Z = CAM_H * DEPTH; // カメラから車までの距離
const DRAW = 140; // 何区切り先まで描くか
const N_SEG = 6500; // コースの長さ(区切りの数)
const MAX_SPEED = 10000;
const BOOST_SPEED = 15000;
const OFFROAD_SPEED = 3500;
const ACCEL = 5000;
const CENTRIFUGAL = 0.08; // カーブで外へ押される強さ
const DRAG_RATE = 1 / 450; // 指を1px動かしたときの横移動
const PLAYER_HALF = 0.19; // 自分の車の半分の幅(道の半分の幅=1)
const CAR_W = 300; // 自分の車の絵の幅
const INTRO_SEC = 5;
const END_SEC = 2;
const BOOST_SEC = 2.5;
const JUMP_SEC = 1.1;
const JUMP_H = 190; // ジャンプの高さ(画面のpx)
const MEDIAN = 0.55; // 分かれ道の真ん中の草地(半分の幅)

type Kind = "yen" | "boost" | "jump" | "hit" | "slow" | "deco" | "fly";
interface Obj {
	id: string; off: number; size: number; kind: Kind; taken: boolean;
	val?: number; alt?: number; vx?: number; act?: boolean; si?: number;
}
interface Seg { i: number; curve: number; y1: number; y2: number; zone: number; w: number; split: number; cross: boolean; objs: Obj[]; }
interface Rival { z: number; off: number; speed: number; id: string; size: number; }
interface Zone {
	name: string; w: number; lanes: number; speedMul: number;
	grass: string[]; rumble: string[]; road: string[]; line: string; center: string;
	sky: string; far: string; farY: number; near: string; nearY: number;
}
const ZONES: Zone[] = [
	{
		name: "いなかみち", w: 1.0, lanes: 3, speedMul: 1.0,
		grass: ["#7ab85a", "#6aa84a"], rumble: ["#d8403a", "#f4f0e8"], road: ["#86807a", "#7a746e"],
		line: "#f4f0e8", center: "", sky: "sky", far: "mountains", farY: 180, near: "hills", nearY: 250
	},
	{
		name: "まちなか", w: 1.0, lanes: 2, speedMul: 0.9,
		grass: ["#cdc2ae", "#c2b6a2"], rumble: ["#9a9aa2", "#e8e8ec"], road: ["#6e6a72", "#66626a"],
		line: "#f4f0e8", center: "#f0c040", sky: "sky", far: "skyline", farY: 130, near: "citynear", nearY: 235
	},
	{
		name: "こうそくどうろ", w: 1.35, lanes: 4, speedMul: 1.15,
		grass: ["#5e9e4c", "#548e42"], rumble: ["#c8c8cc", "#f4f4f4"], road: ["#5e5c62", "#66646a"],
		line: "#f4f4f4", center: "", sky: "sky", far: "skyline", farY: 130, near: "hills", nearY: 250
	},
	{
		name: "さばく", w: 0.95, lanes: 2, speedMul: 1.0,
		grass: ["#e8c888", "#dcbc7c"], rumble: ["#c88a4a", "#f4e8d0"], road: ["#8a7a6a", "#958574"],
		line: "#f4e8d0", center: "#f0c040", sky: "sky_desert", far: "mesas", farY: 180, near: "dunes", nearY: 250
	}
];
const YEN_IMG: { [v: number]: string } = { 1: "yen1", 5: "yen5", 10: "yen10", 50: "yen50", 100: "yen100", 500: "yen500" };
const YEN_SIZE: { [v: number]: number } = { 1: 0.2, 5: 0.22, 10: 0.23, 50: 0.22, 100: 0.25, 500: 0.3 };
const SIZE: { [id: string]: number } = {
	tree: 1.0, pine: 0.75, bush: 0.6, house: 1.3, windmill: 1.2, flowers: 0.7, billboard: 1.2, sign_l: 0.5, sign_r: 0.5,
	bld_a: 1.6, bld_b: 1.4, bld_c: 1.7, bld_d: 1.5, lamp: 0.35, signal: 0.4, roundtree: 0.6, hwlamp: 0.5, wall: 1.0, hwsign: 3.4,
	cactus: 0.6, drock: 0.9, skull: 0.4, oasis: 1.4, gate: 2.9, ysign: 0.6,
	chicken: 0.3, bike: 0.55, ball: 0.25, tumble: 0.4, birds: 1.0, vulture: 0.8,
	cone: 0.2, rock: 0.42, barrier: 0.95, box: 0.35, puddle: 0.6, ramp: 0.55, boost: 0.5
};

class RoadView extends g.E {
	draw: (r: g.Renderer) => void = () => undefined;
	override renderSelf(r: g.Renderer): boolean {
		this.draw(r);
		return true;
	}
}

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"sky", "sky_desert", "mountains", "hills", "skyline", "citynear", "mesas", "dunes", "car", "car_l", "car_r",
		"rival_a", "rival_b", "rival_c", "truck", "yen1", "yen5", "yen10", "yen50", "yen100", "yen500", "boost", "ramp", "puddle",
		"cone", "rock", "barrier", "box", "tree", "pine", "bush", "house", "windmill", "flowers", "sign_l", "sign_r", "billboard",
		"gate", "ysign", "bld_a", "bld_b", "bld_c", "bld_d", "lamp", "signal", "roundtree", "hwlamp", "wall", "hwsign",
		"cactus", "drock", "skull", "oasis", "chicken", "bike", "ball", "tumble", "birds", "vulture",
		"spark", "dust", "shadow", "splash", "logo"
	];
	const audioIds = ["coin", "coin2", "gem", "boost", "crash", "beep", "go", "finish", "combo", "jump", "splash", "land"];
	const scene = new g.Scene({
		game: g.game,
		assetIds: imageIds.concat(audioIds.map((a) => "se_" + a), ["bgm"])
	});
	let time = 80;
	if (param.sessionParameter.totalTimeLimit) {
		time = param.sessionParameter.totalTimeLimit;
	}
	// ランキングモードでは g.game.vars.gameState.score をスコアとして扱う
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const dt = 1 / g.game.fps;
		const rand = (): number => param.random.generate();
		const pick = <T>(a: T[]): T => a[Math.floor(rand() * a.length)];
		const se = (id: string, vol = 0.8): void => {
			scene.asset.getAudioById("se_" + id).play().changeVolume(vol);
		};
		const img = (id: string): g.ImageAsset => scene.asset.getImageById(id);
		const surf: { [id: string]: g.Surface } = {};
		imageIds.forEach((id) => {
			surf[id] = g.SurfaceUtil.asSurface(img(id))!;
		});

		// ======== コースを作る(みんな同じコース) ========
		const segs: Seg[] = [];
		let lastY = 0;
		let curZone = 0;
		let curSplit = -1; // 分かれ道を作っている間だけ 0〜1
		const addSeg = (curve: number, y: number): void => {
			const split = Math.max(0, curSplit);
			segs.push({ i: segs.length, curve, y1: lastY, y2: y, zone: curZone, w: 1, split, cross: false, objs: [] });
			lastY = y;
		};
		const easeIn = (a: number, b: number, p: number): number => a + (b - a) * p * p;
		const easeInOut = (a: number, b: number, p: number): number => a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);
		const addRoad = (enter: number, hold: number, leave: number, curve: number, height: number): void => {
			const startY = lastY;
			const endY = startY + height * SEG;
			const total = enter + hold + leave;
			for (let n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
			for (let n = 0; n < hold; n++) addSeg(curve, easeInOut(startY, endY, (enter + n) / total));
			for (let n = 0; n < leave; n++) addSeg(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
		};
		const splits: number[] = []; // 分かれ道の始まり
		const addSplit = (height: number): void => {
			splits.push(segs.length);
			const startY = lastY;
			for (let n = 0; n < 120; n++) {
				curSplit = n < 25 ? easeInOut(0, 1, n / 25) : n < 95 ? 1 : easeInOut(1, 0, (n - 95) / 25);
				addSeg(0, easeInOut(startY, startY + height * SEG, n / 120));
			}
			curSplit = -1;
		};
		// エリアの順番: いなか → まち → 高速 → 砂漠 → まち → いなか → 高速 → 砂漠
		const plan = [[0, 560], [1, 640], [2, 760], [3, 720], [1, 600], [0, 640], [2, 760], [3, 900]];
		addRoad(0, 60, 0, 0, 0);
		for (let pi = 0; pi < plan.length && segs.length < N_SEG - 150; pi++) {
			curZone = plan[pi][0];
			const end = Math.min(N_SEG - 150, segs.length + plan[pi][1]);
			let splitDone = false;
			while (segs.length < end) {
				const dir = rand() < 0.5 ? -1 : 1;
				const r = rand();
				if (curZone === 0) {
					// いなか: カーブと丘
					if (r < 0.3) addRoad(15, 20 + Math.floor(rand() * 25), 15, dir * (2 + rand() * 3), Math.round((rand() - 0.5) * 30));
					else if (r < 0.5) {
						addRoad(12, 16, 12, dir * 3.5, 0);
						addRoad(12, 16, 12, -dir * 3.5, Math.round((rand() - 0.5) * 20));
					} else if (r < 0.75) addRoad(25, 20, 25, 0, (rand() < 0.5 ? -1 : 1) * (14 + Math.floor(rand() * 12)));
					else if (r < 0.9 || splitDone) addRoad(10, 30, 10, dir * 1.5, Math.round((rand() - 0.5) * 16));
					else {
						addSplit(Math.round((rand() - 0.5) * 16));
						splitDone = true;
					}
				} else if (curZone === 1) {
					// まち: まっすぐが多く、小さな坂と横断歩道
					if (r < 0.45) {
						addRoad(5, 30 + Math.floor(rand() * 20), 5, 0, Math.round((rand() - 0.5) * 12));
						for (let k = 0; k < 3; k++) segs[segs.length - 20 + k].cross = true;
					} else if (r < 0.8) addRoad(12, 20, 12, dir * (1.5 + rand() * 2), Math.round((rand() - 0.5) * 10));
					else addRoad(10, 10, 10, 0, (rand() < 0.5 ? -1 : 1) * 10);
				} else if (curZone === 2) {
					// 高速: 大きくゆるいカーブと、高い高架
					if (r < 0.4) addRoad(25, 40 + Math.floor(rand() * 40), 25, dir * (1.5 + rand() * 1.5), Math.round((rand() - 0.5) * 50));
					else if (r < 0.75 || splitDone) addRoad(30, 40, 30, 0, (rand() < 0.5 ? -1 : 1) * (20 + Math.floor(rand() * 15)));
					else {
						addSplit(Math.round((rand() - 0.5) * 20));
						splitDone = true;
					}
				} else {
					// 砂漠: 長いまっすぐと、大きな砂の丘
					const dune = (rand() < 0.5 ? -1 : 1) * (22 + Math.floor(rand() * 14));
					if (r < 0.55) addRoad(30, 20 + Math.floor(rand() * 20), 30, 0, dune);
					else if (r < 0.8) addRoad(20, 30, 20, dir * (2 + rand() * 2.5), Math.round((rand() - 0.5) * 20));
					else for (let k = 0; k < 3; k++) addRoad(12, 6, 12, 0, k % 2 ? -12 : 12);
				}
			}
		}
		addRoad(30, 60, 30, 0, -lastY / SEG);
		// 道はばをエリアに合わせて、なめらかに変える
		for (let k = 0; k < segs.length; k++) {
			let sum = 0;
			let cnt = 0;
			for (let j = Math.max(0, k - 30); j <= Math.min(segs.length - 1, k + 30); j += 3) {
				sum += ZONES[segs[j].zone].w;
				cnt++;
			}
			segs[k].w = sum / cnt + segs[k].split * 0.9;
		}
		const trackLen = segs.length * SEG;

		// ======== お金・じゃまもの・仕掛けを置く ========
		const put = (si: number, o: Obj): void => {
			if (si >= 0 && si < segs.length) segs[si].objs.push(o);
		};
		const obj = (si: number, id: string, off: number, kind: Kind): Obj => {
			const o: Obj = { id, off, size: SIZE[id], kind, taken: false };
			put(si, o);
			return o;
		};
		const yen = (si: number, off: number, val: number, alt?: number): void => {
			put(si, { id: YEN_IMG[val], off, size: YEN_SIZE[val], kind: "yen", taken: false, val, alt });
		};
		// その区切りの車線の真ん中
		const lanesAt = (si: number): number[] => {
			const sg = segs[Math.min(si, segs.length - 1)];
			const n = ZONES[sg.zone].lanes;
			const res: number[] = [];
			for (let k = 0; k < n; k++) res.push(-sg.w * 0.85 + sg.w * 1.7 * (k + 0.5) / n);
			return res;
		};
		// 1円が基本。ときどき5円や10円
		const small = (): number => {
			const r = rand();
			return r < 0.8 ? 1 : r < 0.93 ? 5 : 10;
		};
		const movers: Obj[] = [];
		const mover = (si: number, id: string, speed: number, kind: Kind, alt?: number): void => {
			const dir = rand() < 0.5 ? -1 : 1;
			const o: Obj = { id, off: -dir * 2.6, size: SIZE[id], kind, taken: false, vx: dir * speed, act: false, alt, si };
			put(si, o);
			movers.push(o);
		};
		// 分かれ道: 左は高いお金とじゃまもの、右は加速パネルで安全
		splits.forEach((s0) => {
			obj(s0 + 6, "ysign", 0, "hit");
			const risky = rand() < 0.5 ? -1 : 1;
			const mid = (MEDIAN + 1.9) / 2;
			for (let k = 0; k < 12; k++) {
				const si = s0 + 30 + k * 5;
				yen(si, risky * mid + (k % 2 ? 0.3 : -0.3), k % 4 === 3 ? 100 : 10);
				if (k % 3 === 1) obj(si + 2, k % 2 ? "rock" : "cone", risky * mid + (k % 2 ? -0.3 : 0.3), "hit");
			}
			yen(s0 + 92, risky * mid, 500);
			obj(s0 + 32, "boost", -risky * mid, "boost");
			for (let k = 0; k < 18; k++) yen(s0 + 40 + k * 3, -risky * mid, small());
		});
		let si = 70;
		let jumps = 0;
		const isSplit = (a: number, b: number): boolean => {
			for (let k = a; k <= b && k < segs.length; k++) if (segs[k].split > 0) return true;
			return false;
		};
		while (si < segs.length - 140) {
			if (isSplit(si - 10, si + 60)) {
				si += 20;
				continue;
			}
			const zone = segs[si].zone;
			const L = lanesAt(si);
			const lane = Math.floor(rand() * L.length);
			const other = (lane + 1 + Math.floor(rand() * (L.length - 1))) % L.length;
			// エリアごとに出やすい仕掛けを変える
			const pats = zone === 0 ? [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 11] :
				zone === 1 ? [0, 1, 4, 5, 6, 10, 10, 12, 12, 13, 7] :
				zone === 2 ? [0, 1, 4, 4, 5, 8, 13, 13, 14, 7, 3] : [0, 1, 3, 4, 8, 8, 9, 15, 15, 6, 2];
			const pat = pick(pats);
			if (pat === 0) {
				// 1円の列(最後は少し高いお金)
				for (let k = 0; k < 10; k++) yen(si + k * 3, L[lane], k === 9 ? 10 : 1);
				si += 30;
			} else if (pat === 1) {
				// くねくね
				const ph = rand() * 6;
				for (let k = 0; k < 14; k++) yen(si + k * 3, Math.sin(ph + k * 0.45) * L[L.length - 1], k === 7 ? 50 : small());
				si += 42;
			} else if (pat === 2) {
				// コーンのすき間(すき間に50円)
				for (let l = 0; l < L.length; l++) {
					if (l === lane) {
						for (let k = 0; k < 4; k++) yen(si - 9 + k * 3, L[l], 1);
						yen(si, L[l], 50);
					} else obj(si, "cone", L[l], "hit");
				}
				si += 20;
			} else if (pat === 3) {
				// 岩のすぐうしろに100円(ときどき500円)
				obj(si, zone === 3 ? "drock" : "rock", L[lane], "hit").size = 0.45;
				yen(si + 5, L[lane], rand() < 0.15 ? 500 : 100);
				for (let k = 0; k < 4; k++) yen(si - 12 + k * 3, L[other], 1);
				si += 26;
			} else if (pat === 4) {
				// 加速パネルとその先のお金
				obj(si, "boost", L[lane], "boost");
				for (let k = 0; k < 14; k++) yen(si + 8 + k * 3, L[lane], k % 5 === 4 ? 10 : 1);
				si += 52;
			} else if (pat === 5) {
				// 工事中: さくとコーンで車線がせまい
				const open = lane;
				for (let k = 0; k < 6; k++) {
					for (let l = 0; l < L.length; l++) {
						if (l === open) continue;
						obj(si + k * 6, k === 0 ? "barrier" : "cone", L[l], "hit").size = k === 0 ? 0.6 : 0.2;
					}
					yen(si + k * 6 + 3, L[open], k === 5 ? 50 : 5);
				}
				si += 40;
			} else if (pat === 6) {
				// 道をよこぎる弧(真ん中に5円)
				const sgn = lane === 0 ? -1 : 1;
				for (let k = 0; k < 9; k++) yen(si + k * 2, sgn * L[L.length - 1] * (1 - k / 4), k === 4 ? 5 : 1);
				si += 24;
			} else if (pat === 7) {
				// 2列ならび
				for (let k = 0; k < 8; k++) {
					yen(si + k * 3, L[lane], 1);
					yen(si + k * 3, L[other], 1);
				}
				si += 30;
			} else if (pat === 8) {
				// ジャンプ台: 空中のお金と、飛びこえる水たまり
				obj(si, "ramp", L[lane], "jump");
				jumps++;
				const top = jumps % 3 === 0 ? 500 : 100;
				for (let k = 0; k < 9; k++) {
					const p = (k + 1) / 10;
					yen(si + 6 + k * 5, L[lane], k === 4 ? top : k % 2 ? 5 : 1, Math.sin(p * Math.PI) * 0.3 + 0.05);
				}
				for (let l = 0; l < L.length; l++) if (l !== lane) obj(si + 24, "puddle", L[l], "slow");
				obj(si + 26, "barrier", L[lane], "hit");
				si += 60;
			} else if (pat === 9) {
				// 横切るもの(いなか: ニワトリ、砂漠: 転がる草)
				mover(si, zone === 3 ? "tumble" : "chicken", zone === 3 ? 1.1 : 0.8, "hit");
				for (let k = 0; k < 8; k++) yen(si - 12 + k * 3, L[lane], small());
				si += 26;
			} else if (pat === 10) {
				// まち: 横切る自転車とボール
				mover(si, rand() < 0.6 ? "bike" : "ball", rand() < 0.5 ? 0.9 : 1.2, "hit");
				for (let k = 0; k < 8; k++) yen(si + 4 + k * 3, L[lane], small());
				si += 32;
			} else if (pat === 11) {
				// 鳥の群れ(空を横切るだけ)とお金
				mover(si + 10, "birds", 1.6, "fly", 0.9);
				for (let k = 0; k < 10; k++) yen(si + k * 3, L[lane], small());
				si += 30;
			} else if (pat === 12) {
				// まち: 水たまり(すべってスピードダウン)
				for (let k = 0; k < 3; k++) obj(si + k * 10, "puddle", L[(lane + k) % L.length], "slow");
				for (let k = 0; k < 10; k++) yen(si + k * 3, L[(lane + 1) % L.length], 1);
				si += 34;
			} else if (pat === 13) {
				// 落とし物の段ボール
				for (let k = 0; k < 3; k++) obj(si + k * 8, "box", L[(lane + k) % L.length], "hit");
				for (let k = 0; k < 6; k++) yen(si + 2 + k * 4, L[(lane + 2) % L.length], k === 5 ? 50 : 5);
				si += 30;
			} else if (pat === 14) {
				// 高速: 10円のシャワー
				for (let k = 0; k < 6; k++) for (let l = 0; l < L.length; l++) if ((k + l) % 2 === 0) yen(si + k * 4, L[l], 10);
				si += 26;
			} else {
				// 砂漠: ハゲワシが横切る下の100円
				mover(si + 6, "vulture", 1.3, "fly", 0.8);
				yen(si + 6, L[lane], 100);
				for (let k = 0; k < 6; k++) yen(si + k * 2, L[other], 1);
				si += 24;
			}
			si += 10 + Math.floor(rand() * 10);
		}

		// ======== 道ばたの景色 ========
		obj(12, "gate", 0, "deco");
		const deco = (k: number, id: string, off: number): void => {
			obj(k, id, off, "deco");
		};
		for (let k = 20; k < segs.length; k++) {
			const sg = segs[k];
			const ew = sg.w;
			if (sg.zone === 0) {
				if (k % 5 === 0) {
					const side = rand() < 0.5 ? -1 : 1;
					const id = pick(["tree", "tree", "pine", "bush", "house", "windmill", "flowers", "billboard"]);
					deco(k, id, side * (ew + 0.5 + rand() * 1.6 + (id === "house" || id === "windmill" ? 0.8 : 0)));
					if (rand() < 0.5) deco(k + 2, "tree", -side * (ew + 0.4 + rand() * 2));
				}
			} else if (sg.zone === 1) {
				if (k % 4 === 0) {
					deco(k, pick(["bld_a", "bld_b", "bld_c", "bld_d"]), -(ew + 1.5 + rand() * 0.3));
					deco(k + 2, pick(["bld_a", "bld_b", "bld_c", "bld_d"]), ew + 1.5 + rand() * 0.3);
				}
				if (k % 10 === 0) {
					deco(k, "lamp", -(ew + 0.25));
					deco(k, "lamp", ew + 0.25);
				}
				if (k % 10 === 5) deco(k, "roundtree", (rand() < 0.5 ? -1 : 1) * (ew + 0.45));
				if (sg.cross && !segs[k - 1].cross) {
					deco(k - 2, "signal", -(ew + 0.3));
					deco(k - 2, "signal", ew + 0.3);
				}
			} else if (sg.zone === 2) {
				if (k % 12 === 0) {
					deco(k, "hwlamp", -(ew + 0.3));
					deco(k, "hwlamp", ew + 0.3);
				}
				if (Math.floor(k / 150) % 2 === 0) {
					if (k % 3 === 0) {
						deco(k, "wall", -(ew + 0.7));
						deco(k, "wall", ew + 0.7);
					}
				} else if (k % 6 === 0) deco(k, pick(["tree", "pine", "bush"]), (rand() < 0.5 ? -1 : 1) * (ew + 0.6 + rand() * 1.5));
				if (k % 180 === 90 && sg.split === 0) deco(k, "hwsign", 0);
			} else {
				if (k % 5 === 0) {
					const id = pick(["cactus", "cactus", "drock", "skull", "cactus", "drock"]);
					deco(k, id, (rand() < 0.5 ? -1 : 1) * (ew + 0.4 + rand() * 2.2));
				}
				if (k % 200 === 100) deco(k, "oasis", (rand() < 0.5 ? -1 : 1) * (ew + 2.2));
			}
			// きついカーブの手前に矢印の看板
			if (k % 8 === 0 && Math.abs(sg.curve) > 3) deco(k, sg.curve > 0 ? "sign_r" : "sign_l", (sg.curve > 0 ? 1 : -1) * (ew + 0.3));
		}
		// ======== ほかの車(高速道路で多い) ========
		const rivals: Rival[] = [];
		for (let k = 150; k < segs.length - 200; k += 0) {
			const sg = segs[k];
			const L = lanesAt(k);
			if (sg.split === 0) {
				const truck = sg.zone === 2 && rand() < 0.35;
				const id = truck ? "truck" : pick(["rival_a", "rival_b", "rival_c"]);
				const base = sg.zone === 2 ? 0.5 : sg.zone === 1 ? 0.3 : 0.4;
				rivals.push({ z: k * SEG, off: pick(L), speed: MAX_SPEED * (base + rand() * 0.15), id, size: truck ? 0.5 : 0.34 });
			}
			k += sg.zone === 2 ? 25 + Math.floor(rand() * 20) : 60 + Math.floor(rand() * 40);
		}

		// ======== 状態 ========
		let phase: "intro" | "race" | "end" = "intro";
		let elapsed = 0;
		let raceLeft = Math.max(20, time - INTRO_SEC - END_SEC);
		let position = 0;
		let speed = 0;
		let playerX = 0;
		let steer = 0; // 車のかたむき(-1〜1)
		let boostLeft = 0;
		let hurtLeft = 0;
		let slowLeft = 0;
		let airLeft = 0; // ジャンプ中の残り時間
		let score = 0;
		let combo = 0;
		let skyOffset = 0;
		let hillOffset = 0;
		let shake = 0;
		let zoneNow = 0;
		let zonePrev = 0;
		let fade = 1; // 背景の切りかえ(0→1)
		const mult = (): number => 1 + Math.min(4, Math.floor(combo / 10)) * 0.5;
		const lift = (): number => (airLeft > 0 ? Math.sin((1 - airLeft / JUMP_SEC) * Math.PI) * JUMP_H : 0);

		// ======== 画面 ========
		const road = new RoadView({ scene, width: W, height: 720 });
		scene.append(road);
		const fx = new g.E({ scene });
		scene.append(fx);
		const hud = new g.E({ scene });
		scene.append(hud);
		const makeFont = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 64, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = makeFont("#fff8e8", "#3b2616");
		const fontY = makeFont("#ffe060", "#3b2616");
		const fontR = makeFont("#ffb0a0", "#5a1a10");
		type Align = "left" | "center" | "right";
		const label = (text: string, font: g.Font, size: number, x: number, y: number, parent: g.E, align: Align = "left"): g.Label => {
			const l = new g.Label({ scene, text, font, fontSize: size, x, y });
			if (align !== "left") l.anchorX = align === "center" ? 0.5 : 1;
			parent.append(l);
			return l;
		};
		const setText = (l: g.Label, t: string): void => {
			if (l.text !== t) {
				l.text = t;
				l.invalidate();
			}
		};
		hud.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,14,0.6)", x: 16, y: 14, width: 360, height: 110 }));
		label("ひろったお金", fontW, 28, 32, 22, hud);
		const scoreLabel = label("0円", fontY, 56, 360, 54, hud, "right");
		const comboLabel = label("", fontY, 34, 32, 132, hud);
		hud.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,14,0.6)", x: 1100, y: 14, width: 164, height: 110 }));
		label("のこり", fontW, 28, 1182, 22, hud, "center");
		const timeLabel = label("", fontW, 60, 1182, 54, hud, "center");
		const speedLabel = label("", fontW, 34, 1260, 668, hud, "right");
		const msgLabel = label("", fontY, 96, 640, 300, hud, "center");
		msgLabel.anchorY = 0.5;

		// ---- 小さなアニメーション ----
		interface Anim { t: number; dur: number; fn: (p: number) => void; end?: () => void; }
		const anims: Anim[] = [];
		const animate = (dur: number, fn: (p: number) => void, end?: () => void): void => {
			anims.push({ t: 0, dur, fn, end });
		};
		const popText = (text: string, font: g.Font, size: number, x: number, y: number, dur = 0.7): void => {
			const l = label(text, font, size, x, y, fx, "center");
			l.anchorY = 0.5;
			animate(dur, (q) => {
				l.y = y - q * 70;
				l.scaleX = l.scaleY = q < 0.15 ? 0.6 + q / 0.15 * 0.5 : 1.1 - Math.min(0.1, (q - 0.15));
				l.opacity = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
				l.modified();
			}, () => l.destroy());
		};
		let fxSeed = 77;
		const fxRand = (): number => {
			fxSeed = (fxSeed * 1103515245 + 12345) & 0x7fffffff;
			return fxSeed / 0x7fffffff;
		};
		const sparks = (x: number, y: number, n: number, id = "spark"): void => {
			for (let k = 0; k < n; k++) {
				const a = Math.PI * 2 * (k + fxRand() * 0.5) / n;
				const r = 50 + fxRand() * 50;
				const s = new g.Sprite({ scene, src: img(id), x, y, anchorX: 0.5, anchorY: 0.5 });
				fx.append(s);
				animate(0.45, (q) => {
					s.x = x + Math.cos(a) * r * q;
					s.y = y + Math.sin(a) * r * q;
					s.scaleX = s.scaleY = 1.2 * (1 - q * 0.7);
					s.opacity = 1 - q;
					s.modified();
				}, () => s.destroy());
			}
		};

		// ======== 描画 ========
		const P1X: number[] = [], P1Y: number[] = [], P1W: number[] = [];
		const P2X: number[] = [], P2Y: number[] = [], P2W: number[] = [], CLIP: number[] = [];
		const rivalBySeg: Rival[][] = [];
		for (let k = 0; k < segs.length + 10; k++) rivalBySeg.push([]);
		const drawSprite = (r: g.Renderer, id: string, cx: number, bottom: number, destW: number, clipY: number, squash: number): void => {
			if (destW < 2) return;
			const a = img(id);
			const sc = destW / a.width;
			const destH = a.height * sc;
			const top = bottom - destH;
			const visH = clipY < bottom ? clipY - top : destH;
			if (visH <= 1) return;
			const sx = sc * squash;
			r.save();
			r.transform([sx, 0, 0, sc, cx - a.width * sx / 2, top]);
			r.drawImage(surf[id], 0, 0, a.width, Math.min(a.height, visH / sc), 0, 0);
			r.restore();
		};
		const tiled = (r: g.Renderer, id: string, offset: number, y: number): void => {
			const a = img(id);
			let x0 = -(((offset % a.width) + a.width) % a.width);
			while (x0 < W) {
				r.drawImage(surf[id], 0, 0, a.width, a.height, x0, y);
				x0 += a.width;
			}
		};
		const drawBg = (r: g.Renderer, z: Zone, alpha: number): void => {
			r.save();
			if (alpha < 1) r.opacity(alpha);
			r.drawImage(surf[z.sky], 0, 0, 1280, 340, 0, 0);
			tiled(r, z.far, skyOffset, z.farY + hillOffset * 0.3);
			tiled(r, z.near, skyOffset * 2, z.nearY + hillOffset * 0.6);
			r.restore();
		};
		let frameT = 0;
		road.draw = (r: g.Renderer): void => {
			const zn = ZONES[zoneNow];
			r.fillRect(0, 0, W, 720, zn.grass[1]);
			if (fade < 1) drawBg(r, ZONES[zonePrev], 1);
			drawBg(r, zn, fade);
			const baseIdx = Math.floor(position / SEG) % segs.length;
			const basePct = (position % SEG) / SEG;
			const pIdx = Math.floor((position + PLAYER_Z) / SEG) % segs.length;
			const pPct = ((position + PLAYER_Z) % SEG) / SEG;
			const pSeg = segs[pIdx];
			const playerY = pSeg.y1 + (pSeg.y2 - pSeg.y1) * pPct;
			let maxy = 720;
			let x = 0;
			let dx = -(segs[baseIdx].curve * basePct);
			// ほかの車を区切りごとにふり分ける
			for (let k = 0; k < rivals.length; k++) {
				const rv = rivals[k];
				const idx = Math.floor(rv.z / SEG);
				if (idx >= baseIdx && idx < baseIdx + DRAW && idx < rivalBySeg.length) rivalBySeg[idx].push(rv);
			}
			for (let n = 0; n < DRAW; n++) {
				const sg = segs[(baseIdx + n) % segs.length];
				const nx = segs[(baseIdx + n + 1) % segs.length];
				const looped = sg.i < baseIdx;
				const camZ = position - (looped ? trackLen : 0);
				const camY = playerY + CAM_H;
				const z1 = sg.i * SEG - camZ;
				const z2 = (sg.i + 1) * SEG - camZ;
				const s1 = DEPTH / z1, s2 = DEPTH / z2;
				const cx1 = 0 - (playerX * ROAD - x), cx2 = 0 - (playerX * ROAD - x - dx);
				P1X[n] = W / 2 + s1 * cx1 * W / 2; P1Y[n] = CY - s1 * (sg.y1 - camY) * YS; P1W[n] = s1 * ROAD * W / 2;
				P2X[n] = W / 2 + s2 * cx2 * W / 2; P2Y[n] = CY - s2 * (sg.y2 - camY) * YS; P2W[n] = s2 * ROAD * W / 2;
				CLIP[n] = maxy;
				x += dx;
				dx += sg.curve;
				if (z1 <= DEPTH || P2Y[n] >= P1Y[n] || P2Y[n] >= maxy) continue;
				const z = ZONES[sg.zone];
				const c = Math.floor(sg.i / 3) % 2;
				const y2 = Math.max(0, P2Y[n]);
				const y1 = Math.min(maxy, P1Y[n]);
				r.fillRect(0, Math.floor(y2), W, Math.ceil(y1) - Math.floor(y2) + 1, z.grass[c]);
				const span = P1Y[n] - P2Y[n];
				const nl = z.lanes;
				for (let yy = Math.floor(y2); yy < y1; yy += 3) {
					const t = (yy - P2Y[n]) / span;
					const rx = P2X[n] + (P1X[n] - P2X[n]) * t;
					const unit = P2W[n] + (P1W[n] - P2W[n]) * t; // 道はば1あたりのpx
					const sw = sg.w + (nx.w - sg.w) * (1 - t);
					const rw = unit * sw;
					const h = Math.min(3, Math.ceil(y1) - yy) + 1;
					const rum = unit * 0.12;
					r.fillRect(rx - rw - rum, yy, (rw + rum) * 2, h, z.rumble[c]);
					r.fillRect(rx - rw, yy, rw * 2, h, z.road[c]);
					const sp = sg.split + (nx.split - sg.split) * (1 - t);
					const mw = unit * MEDIAN * sp;
					if (sg.cross) {
						// 横断歩道
						const stripe = rw / 7;
						for (let k = 0; k < 7; k++) r.fillRect(rx - rw + k * stripe * 2 + stripe * 0.3, yy, stripe * 1.4, h, "#f4f0e8");
					} else if (c === 0) {
						const lw = Math.max(1, unit * 0.025);
						for (let k = 1; k < nl; k++) {
							const lx = rx - rw + rw * 2 * k / nl;
							if (Math.abs(lx - rx) < mw + lw) continue;
							const col = z.center && k * 2 === nl ? z.center : z.line;
							r.fillRect(lx - lw / 2, yy, lw, h, col);
						}
					}
					if (sp > 0.01) {
						r.fillRect(rx - mw - rum, yy, (mw + rum) * 2, h, z.rumble[c]);
						r.fillRect(rx - mw, yy, mw * 2, h, z.grass[c]);
					}
				}
				maxy = P2Y[n];
			}
			// 奥から順に、景色・お金・車を描く
			for (let n = DRAW - 1; n > 0; n--) {
				const sg = segs[(baseIdx + n) % segs.length];
				const w1 = P1W[n];
				if (P1Y[n] === undefined) continue;
				for (let k = 0; k < sg.objs.length; k++) {
					const o = sg.objs[k];
					if (o.taken || (o.kind === "deco" && n < 3)) continue;
					const cx = P1X[n] + w1 * o.off;
					if (cx < -w1 * 3.5 || cx > W + w1 * 3.5) continue;
					const up = w1 * (o.alt || 0);
					if (o.kind === "yen") {
						const spin = Math.abs(Math.cos(frameT * 4 + sg.i * 0.3));
						drawSprite(r, o.id, cx, P1Y[n] - w1 * 0.1 - up, w1 * o.size, CLIP[n] + up, 0.3 + spin * 0.7);
					} else if (o.vx) {
						const dir = o.vx > 0 ? 1 : -1;
						const bob = o.kind === "fly" ? Math.sin(frameT * 10) * w1 * 0.03 : 0;
						const roll = o.id === "ball" || o.id === "tumble" ? Math.abs(Math.cos(frameT * 6)) * 0.15 + 0.85 : 1;
						drawSprite(r, o.id, cx, P1Y[n] - up + bob, w1 * o.size, CLIP[n] + up, dir * roll);
					} else drawSprite(r, o.id, cx, P1Y[n], w1 * o.size, CLIP[n], 1);
				}
				const rl = rivalBySeg[sg.i];
				for (let k = 0; k < rl.length; k++) {
					const rv = rl[k];
					const pct = (rv.z % SEG) / SEG;
					const cy = P1Y[n] + (P2Y[n] - P1Y[n]) * pct;
					const cw = P1W[n] + (P2W[n] - P1W[n]) * pct;
					const cxx = P1X[n] + (P2X[n] - P1X[n]) * pct + cw * rv.off;
					drawSprite(r, rv.id, cxx, cy, cw * rv.size, CLIP[n], 1);
				}
				rl.length = 0;
			}
			for (let k = baseIdx; k < Math.min(rivalBySeg.length, baseIdx + DRAW); k++) rivalBySeg[k].length = 0;
			// スピード線(加速中)
			if (boostLeft > 0) {
				for (let k = 0; k < 14; k++) {
					const a = (k * 2.4 + frameT * 7) % (Math.PI * 2);
					const d = 300 + ((frameT * 900 + k * 97) % 360);
					r.fillRect(W / 2 + Math.cos(a) * d, CY + 60 + Math.sin(a) * d * 0.6, 40, 3, "rgba(255,255,240,0.7)");
				}
			}
			// 自分の車
			const lf = lift();
			if (lf > 0) drawSprite(r, "shadow", W / 2, 712, CAR_W * (1 - lf / JUMP_H * 0.4), 9999, 1);
			const bounce = speed > 100 && lf === 0 ? Math.sin(frameT * 30) * 1.5 : 0;
			const carId = steer < -0.3 ? "car_l" : steer > 0.3 ? "car_r" : "car";
			const blink = hurtLeft > 0 && Math.floor(frameT * 12) % 2 === 0;
			const carX = W / 2 + shake * Math.sin(frameT * 50);
			if (!blink) drawSprite(r, carId, carX, 712 + bounce - lf, CAR_W * (1 + lf / JUMP_H * 0.1), 9999, 1);
			if (Math.abs(playerX) > pSeg.w && speed > 1000 && lf === 0) {
				for (let k = 0; k < 3; k++) {
					const dxp = W / 2 + (k - 1) * 120 + Math.sin(frameT * 20 + k) * 10;
					drawSprite(r, "dust", dxp, 712 - Math.abs(Math.sin(frameT * 9 + k)) * 20, 70, 9999, 1);
				}
			}
			if (slowLeft > 0 && lf === 0) drawSprite(r, "splash", W / 2, 700, 340, 9999, 1);
		};

		// ======== 操作: 指を左右にスライドしてハンドル ========
		let dragX: number | null = null;
		scene.onPointDownCapture.add((ev) => {
			dragX = ev.point.x;
		});
		scene.onPointMoveCapture.add((ev) => {
			if (dragX === null || phase !== "race") return;
			const d = ev.prevDelta.x;
			playerX = Math.max(-2.6, Math.min(2.6, playerX + d * DRAG_RATE));
			steer = Math.max(-1, Math.min(1, steer + d * 0.03));
		});
		scene.onPointUpCapture.add(() => {
			dragX = null;
		});

		// ======== ひろったとき・ぶつかったとき ========
		let popIdx = 0;
		const addScore = (pts: number): void => {
			score += pts;
			g.game.vars.gameState.score = score;
			setText(scoreLabel, score + "円");
		};
		const updateCombo = (): void => {
			setText(comboLabel, combo >= 2 ? combo + "コンボ  ×" + mult().toFixed(1) : "");
		};
		const hit = (): void => {
			if (hurtLeft > 0) return;
			speed *= 0.25;
			boostLeft = 0;
			hurtLeft = 1.2;
			shake = 14;
			if (combo >= 10) popText("コンボがきれた…", fontR, 40, W / 2, 470);
			combo = 0;
			updateCombo();
			se("crash", 0.6);
		};
		const touch = (o: Obj): void => {
			if (o.kind === "yen") {
				o.taken = true;
				const before = mult();
				combo++;
				const v = o.val || 1;
				const pts = Math.max(v, Math.round(v * mult()));
				addScore(pts);
				if (v >= 500) {
					se("gem", 0.6);
					popText("500円玉! +" + pts + "円", fontY, 60, W / 2, 430, 1.1);
					sparks(W / 2, 560 - lift(), 12);
				} else {
					se(v >= 50 ? "coin2" : "coin", v >= 50 ? 0.5 : 0.35);
					popIdx = (popIdx + 1) % 4;
					const px = W / 2 + (popIdx % 2 ? 120 : -120);
					popText("+" + pts + "円", v >= 50 ? fontY : fontW, v >= 50 ? 50 : 38, px, 540 - popIdx * 26 - lift());
					sparks(W / 2, 600 - lift(), v >= 50 ? 8 : 3);
				}
				if (mult() > before) {
					popText("×" + mult().toFixed(1) + "!", fontY, 70, W / 2, 380);
					se("combo", 0.6);
				}
				updateCombo();
			} else if (o.kind === "boost") {
				if (boostLeft <= 0) se("boost", 0.6);
				boostLeft = BOOST_SEC;
				popText("ダッシュ!", fontW, 56, W / 2, 440);
			} else if (o.kind === "jump") {
				if (airLeft <= 0) {
					airLeft = JUMP_SEC;
					se("jump", 0.6);
					popText("ジャンプ!", fontW, 56, W / 2, 420);
					speed = Math.max(speed, MAX_SPEED);
				}
			} else if (o.kind === "slow") {
				if (slowLeft <= 0) se("splash", 0.6);
				slowLeft = 0.8;
				speed *= 0.6;
			} else if (o.kind === "hit") {
				o.taken = o.id === "cone" || o.id === "box" || o.id === "ball" || o.id === "tumble"; // 軽いものははじき飛ばす
				hit();
			}
		};

		// ======== イントロ ========
		const intro = new g.E({ scene });
		scene.append(intro);
		intro.append(new g.FilledRect({ scene, cssColor: "rgba(40,24,14,0.6)", y: 70, width: W, height: 470 }));
		const logo = new g.Sprite({ scene, src: img("logo"), x: W / 2, y: 190, anchorX: 0.5, anchorY: 0.5 });
		logo.scaleX = logo.scaleY = 0.85;
		intro.append(logo);
		label("指を左右にスライドしてハンドル!", fontW, 46, W / 2, 330, intro, "center");
		label("1円から500円まで、落ちているお金をひろおう。続けてひろうとコンボ!", fontW, 30, W / 2, 400, intro, "center");
		const countLabel = label("", fontY, 110, W / 2, 470, intro, "center");
		let lastCount = -1;
		const bgm = scene.asset.getAudioById("bgm");

		// ======== メインループ ========
		scene.onUpdate.add(() => {
			frameT += dt;
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
			elapsed += dt;
			fade = Math.min(1, fade + dt / 1.5);
			if (phase === "intro") {
				const c = Math.ceil(INTRO_SEC - elapsed);
				if (elapsed > INTRO_SEC - 3 && c !== lastCount && c > 0) {
					lastCount = c;
					setText(countLabel, String(c));
					se("beep", 0.4);
				}
				if (elapsed >= INTRO_SEC) {
					intro.destroy();
					phase = "race";
					se("go", 0.5);
					bgm.play().changeVolume(0.35);
					setText(msgLabel, "GO!");
					animate(0.8, (q) => {
						msgLabel.opacity = 1 - q;
						msgLabel.scaleX = msgLabel.scaleY = 1 + q * 0.5;
						msgLabel.modified();
					}, () => setText(msgLabel, ""));
				}
				setText(timeLabel, String(Math.ceil(raceLeft)));
				road.modified();
				return;
			}
			const pIdx0 = Math.floor((position + PLAYER_Z) / SEG) % segs.length;
			const seg0 = segs[pIdx0];
			const inAir = airLeft > 0;
			// ---- 速さ ----
			const inMedian = seg0.split > 0.2 && Math.abs(playerX) < MEDIAN * seg0.split;
			const offroad = !inAir && (Math.abs(playerX) > seg0.w || inMedian);
			let target = (boostLeft > 0 ? BOOST_SPEED : MAX_SPEED) * ZONES[seg0.zone].speedMul;
			if (phase === "end") target = 0;
			else if (offroad) target = Math.min(target, OFFROAD_SPEED);
			if (speed < target) speed = Math.min(target, speed + ACCEL * dt * (boostLeft > 0 ? 3 : 1));
			else if (!inAir) speed = Math.max(target, speed - ACCEL * 1.6 * dt);
			boostLeft = Math.max(0, boostLeft - dt);
			hurtLeft = Math.max(0, hurtLeft - dt);
			slowLeft = Math.max(0, slowLeft - dt);
			shake = Math.max(0, shake - 40 * dt);
			if (airLeft > 0) {
				airLeft = Math.max(0, airLeft - dt);
				if (airLeft === 0) {
					se("land", 0.6);
					shake = 6;
				}
			}
			steer *= 0.8;
			// 分かれ道の真ん中にいたら、近いほうの道へ押し出す
			if (inMedian && !inAir) playerX += (playerX < 0 ? -1 : 1) * dt * 1.2;
			// ---- 進む ----
			const oldPos = position;
			position += speed * dt;
			const pIdx = Math.floor((position + PLAYER_Z) / SEG) % segs.length;
			const pSeg = segs[pIdx];
			const pct = speed / MAX_SPEED;
			if (!inAir) playerX -= dt * pct * pSeg.curve * CENTRIFUGAL;
			playerX = Math.max(-2.6, Math.min(2.6, playerX));
			skyOffset += pSeg.curve * pct * 6;
			hillOffset = -(pSeg.y1 / SEG) * 0.4;
			// ---- エリアが変わった ----
			if (pSeg.zone !== zoneNow) {
				zonePrev = zoneNow;
				zoneNow = pSeg.zone;
				fade = 0;
				if (phase === "race") popText(ZONES[zoneNow].name + "に入った!", fontW, 60, W / 2, 230, 1.6);
			}
			// ---- 横切るもの ----
			const pz = position + PLAYER_Z;
			for (let k = 0; k < movers.length; k++) {
				const m = movers[k];
				if (m.act) {
					m.off += m.vx! * dt;
					continue;
				}
				const mz = m.si! * SEG;
				if (mz - pz < (2.6 / Math.abs(m.vx!)) * Math.max(speed, 5000) && mz > pz) m.act = true;
			}
			// ---- 通りすぎた区切りのお金やじゃまものを調べる ----
			if (phase === "race") {
				const from = Math.floor((oldPos + PLAYER_Z) / SEG);
				const to = Math.floor(pz / SEG);
				const lf = lift();
				for (let s = from; s <= to; s++) {
					const sg = segs[s % segs.length];
					for (let k = 0; k < sg.objs.length; k++) {
						const o = sg.objs[k];
						if (o.taken || o.kind === "deco" || o.kind === "fly") continue;
						const air = (o.alt || 0) > 0.08;
						if (o.kind === "yen") {
							// 空中のお金はジャンプ中だけ、地面のお金は地面にいるときだけ
							if (air !== lf > 60) continue;
						} else if (lf > 30) continue;
						if (Math.abs(playerX - o.off) < PLAYER_HALF + o.size / 2 * (o.kind === "hit" ? 0.8 : 1)) touch(o);
					}
				}
			}
			// ---- ほかの車 ----
			for (let k = 0; k < rivals.length; k++) {
				const rv = rivals[k];
				rv.z += rv.speed * dt;
				const dz = rv.z - pz;
				const near = dz > -40 && dz < 120 && Math.abs(rv.off - playerX) < PLAYER_HALF + rv.size * 0.45;
				if (phase === "race" && airLeft === 0 && near) {
					if (speed > rv.speed) {
						hit();
						speed = Math.min(speed, rv.speed * 0.6);
						rv.z = pz + 600;
					}
				}
			}
			// ---- 時間 ----
			if (phase === "race") {
				raceLeft = Math.max(0, raceLeft - dt);
				setText(timeLabel, String(Math.ceil(raceLeft)));
				timeLabel.opacity = raceLeft <= 5 && Math.floor(raceLeft * 4) % 2 === 0 ? 0.5 : 1;
				timeLabel.modified();
				if (raceLeft <= 0) {
					phase = "end";
					se("finish", 0.7);
					setText(msgLabel, "FINISH!");
					msgLabel.opacity = 1;
					msgLabel.scaleX = msgLabel.scaleY = 1;
					msgLabel.modified();
				}
			}
			setText(speedLabel, Math.round(speed / MAX_SPEED * 180) + " km/h");
			road.modified();
		});
	});
	g.game.pushScene(scene);
}
