import { BOXES, Item, MONSTER_NAMES, PACKS, RARITY_NAMES, RARITY_VALUES, RARITY_WEIGHTS } from "./data";
import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const W = 1280;
const H = 720;
const BUDGET = 1000000;
const ATM_SEC = 2.8;
const FRONT_SEC = 2.8;
const PACK_SEC = 20; // パックを選ぶ時間(これをすぎると自動で選ぶ)
const BOX_SEC = 14;
const CART_SEC = 2.8;
const BLACK_SEC = 1.3;
const OPEN_SEC = 12;
const END_BEFORE = 5; // 制限時間のこれだけ前に、ゲームを止める
const PICK_PACKS = 5;
const PICK_BOXES = 3;
const CARDS_PER_PACK = 5;
const CARDS_PER_BOX = 25;
const SHOW_TOP = 16; // 開封で大きく見せる枚数
const FOIL_RATE = 0.12; // ホイルカードになる確率
const FOIL_MUL = 1.35;
const LUCK_K = 0.14; // luck が高レアをどれだけ出やすくするか
const CHAOS_K = 0.18; // chaos が上位レアをどれだけ出やすくするか(ミラクル以上)
// モンスターごとの人気(買取額の倍率)
const MON_POP = [1.1, 1.0, 0.95, 1.15, 0.9, 1.0, 1.0, 1.1, 1.3, 0.9, 1.0, 0.95, 0.9, 1.05, 1.1, 1.05, 0.95, 1.2, 1.0, 1.5];

interface Card { mon: number; rar: number; foil: boolean; error: number; value: number; }
interface Part { x: number; y: number; vx: number; vy: number; g: number;
	life: number; max: number; size: number; col: string; img: string; }
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
		"bg_atm", "bg_front", "bg_wall", "bg_shelf", "bg_room", "bill", "basket", "btn_ok", "btn_off", "btn_next", "btn_prev",
		"stamp_error", "spark", "rays", "card_back", "logo"
	];
	for (let i = 0; i < 20; i++) imageIds.push("mon" + i, "frame" + i);
	for (let i = 0; i < PACKS.length; i++) imageIds.push("pack" + i);
	for (let i = 0; i < BOXES.length; i++) imageIds.push("box" + i);
	const audioIds = [
		"atm", "cash", "door", "select", "unselect", "decide", "cart", "rip", "flip", "rare1", "rare2", "rare3", "god", "error",
		"tick", "finish", "cheer"
	];
	const scene = new g.Scene({ game: g.game, assetIds: imageIds.concat(audioIds.map((a) => "se_" + a), ["bgm_shop", "bgm_open"]) });
	let time = 82;
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
		const yen = (v: number): string => {
			const s = String(Math.round(v));
			let o = "";
			for (let i = 0; i < s.length; i++) {
				if (i > 0 && (s.length - i) % 3 === 0) o += ",";
				o += s.charAt(i);
			}
			return "¥" + o;
		};

		// ======== 状態 ========
		type Phase = "atm" | "front" | "packs" | "boxes" | "cart" | "black" | "opening" | "appraisal" | "end";
		let phase: Phase = "atm";
		let phaseT = 0;
		let total = 0; // ゲーム全体の秒
		const pickedPacks: number[] = [];
		const pickedBoxes: number[] = [];
		let page = 0;
		const cards: Card[] = [];
		let appraisal = 0; // 買取総額
		let shown = 0; // 画面に出している買取額(数えあげ)
		let shake = 0;
		let flash = 0;
		let flashCol = "#ffffff";
		const parts: Part[] = [];
		const pops: Pop[] = [];

		// ======== 文字 ========
		const font = (color: string, stroke: string, sw = 8): g.DynamicFont => new g.DynamicFont({
			game: g.game, fontFamily: "sans-serif", fontWeight: "bold", size: 72, fontColor: color, strokeColor: stroke, strokeWidth: sw
		});
		const fontW = font("#ffffff", "#2a1a30");
		const fontY = font("#ffe860", "#2a1a30");
		const fontR = font("#ff5a6a", "#ffffff");
		const fontC = font("#70e8ff", "#2a1a30");
		const fontP = font("#ff8ad8", "#ffffff");
		const fontG = font("#ffe040", "#a81a2a", 10);
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
		const popText = (t: string, f: g.Font, size: number, x: number, y: number, life = 0.9): void => {
			const l = label(f, size, x, y, t, "center");
			l.anchorX = 0.5;
			l.anchorY = 0.5;
			l.x = x;
			l.y = y + size / 2;
			pops.push({ l, life, vy: -50, scale: 1.4 });
		};

		// ======== 層 ========
		const layer = (): g.E => {
			const e = new g.E({ scene });
			scene.append(e);
			e.hide();
			return e;
		};
		const atmL = layer();
		const frontL = layer();
		const packL = layer();
		const boxL = layer();
		const cartL = layer();
		const openL = layer();
		const fx = new View({ scene, width: W, height: H });
		scene.append(fx);
		const hud = new g.E({ scene });
		scene.append(hud);
		const blackR = new g.FilledRect({ scene, cssColor: "#000000", width: W, height: H, opacity: 0 });
		scene.append(blackR);
		const top = new g.E({ scene }); // いちばん上に出す文字
		scene.append(top);

		// ---- 上の帯(えらぶ画面) ----
		const titleL = label(fontW, 30, 24, 10, "", "left", hud);
		const subL = label(fontY, 22, 24, 44, "", "left", hud);
		const timeL = label(fontW, 30, 760, 10, "", "center", hud);
		const okBtn = new g.Sprite({ scene, src: img("btn_off"), x: 1070, y: 4, scaleX: 0.62, scaleY: 0.62, touchable: true });
		hud.append(okBtn);
		let okState = "btn_off";
		const showHud = (on: boolean): void => {
			[titleL, subL, timeL, okBtn].forEach((e) => {
				if (on) e.show(); else e.hide();
			});
		};
		showHud(false);

		// ======== ATM ========
		const atmBg = new g.Sprite({ scene, src: img("bg_atm") });
		atmL.append(atmBg);
		label(fontW, 30, 640, 190, "お引き出し", "center", atmL);
		const atmMoney = label(fontY, 64, 640, 240, "¥0", "center", atmL);
		label(fontC, 22, 640, 330, "カードを爆買いするぞ！", "center", atmL);
		const bills: g.Sprite[] = [];
		for (let i = 0; i < 10; i++) {
			const b = new g.Sprite({ scene, src: img("bill"), x: 530, y: 610, anchorX: 0, anchorY: 0 });
			b.hide();
			atmL.append(b);
			bills.push(b);
		}

		// ======== 店の正面 ========
		frontL.append(new g.Sprite({ scene, src: img("bg_front") }));
		const frontLogo = new g.Sprite({ scene, src: img("logo"), x: W / 2,
			y: 380, anchorX: 0.5, anchorY: 0.5, scaleX: 0.01, scaleY: 0.01 });
		frontL.append(frontLogo);

		// ======== パックの壁 ========
		packL.append(new g.Sprite({ scene, src: img("bg_wall") }));
		const PACK_S = 0.72;
		interface Slot { sp: g.Sprite; idx: number; tag: g.Label; }
		const packSlots: Slot[] = [];
		const packPos = (k: number): { x: number; y: number } => {
			const r = Math.floor(k / 5), c = k % 5;
			return { x: 180 + c * 230, y: 108 + r * 205 + 8 };
		};
		for (let k = 0; k < 15; k++) {
			const p = packPos(k);
			const sp = new g.Sprite({
				scene, src: img("pack0"), x: p.x, y: p.y, anchorX: 0.5, anchorY: 0, scaleX: PACK_S, scaleY: PACK_S, touchable: true
			});
			packL.append(sp);
			const tag = label(fontW, 20, p.x, p.y + 162, "", "center", packL);
			const slot: Slot = { sp, idx: k, tag };
			sp.onPointDown.add(() => togglePack(slot));
			packSlots.push(slot);
		}
		const prevBtn = new g.Sprite({ scene, src: img("btn_prev"), x: 8, y: 340, scaleX: 0.7, scaleY: 0.7, touchable: true });
		const nextBtn = new g.Sprite({ scene, src: img("btn_next"), x: 1205, y: 340, scaleX: 0.7, scaleY: 0.7, touchable: true });
		packL.append(prevBtn);
		packL.append(nextBtn);
		const pageL = label(fontC, 20, 760, 46, "", "center", packL);
		prevBtn.onPointDown.add(() => setPage(0));
		nextBtn.onPointDown.add(() => setPage(1));
		const packOverlay = new View({ scene, width: W, height: H });
		packL.append(packOverlay);
		const setPage = (p: number): void => {
			if (page !== p) se("flip", 0.4);
			page = p;
			packSlots.forEach((s) => {
				const i = page * 15 + s.idx;
				s.sp.src = img("pack" + i);
				s.sp.invalidate();
				setText(s.tag, yen(PACKS[i].price));
			});
			setText(pageL, "ページ " + (page + 1) + " / 2（◀ ▶ でめくる）");
		};
		const togglePack = (s: Slot): void => {
			if (phase !== "packs") return;
			const i = page * 15 + s.idx;
			const at = pickedPacks.indexOf(i);
			if (at >= 0) {
				pickedPacks.splice(at, 1);
				se("unselect", 0.5);
			} else if (pickedPacks.length < PICK_PACKS) {
				pickedPacks.push(i);
				se("select", 0.5);
				const p = packPos(s.idx);
				burst(p.x, p.y + 80, 10, 300, ["#ffe040", "#ffffff"]);
			} else {
				se("unselect", 0.4);
				popText("5種類までだよ！ 外すときはもう一度タップ", fontR, 30, W / 2, 360, 1.0);
			}
		};
		// 選んだものに黄色いわく
		const frameRect = (r: g.Renderer, x: number, y: number, w: number, h: number, t: number, col: string): void => {
			r.fillRect(x - t, y - t, w + t * 2, t, col);
			r.fillRect(x - t, y + h, w + t * 2, t, col);
			r.fillRect(x - t, y, t, h, col);
			r.fillRect(x + w, y, t, h, col);
		};
		packOverlay.draw = (r: g.Renderer): void => {
			const blink = Math.floor(total * 6) % 2 === 0 ? "#ffe040" : "#fff6a0";
			packSlots.forEach((s) => {
				const i = page * 15 + s.idx;
				const n = pickedPacks.indexOf(i);
				if (n < 0) return;
				const p = packPos(s.idx);
				const w = 150 * PACK_S, h = 220 * PACK_S;
				frameRect(r, p.x - w / 2 - 4, p.y - 4, w + 8, h + 8, 8, blink);
				r.fillRect(p.x + w / 2 - 22, p.y - 14, 36, 36, "#e83a4a");
			});
		};
		const packNums: g.Label[] = [];
		for (let k = 0; k < 15; k++) {
			const p = packPos(k);
			packNums.push(label(fontW, 26, p.x + 150 * PACK_S / 2 - 4, p.y - 14, "", "center", packL));
		}

		// ======== ボックスの棚 ========
		boxL.append(new g.Sprite({ scene, src: img("bg_shelf") }));
		const BOX_S = 0.95;
		const boxPos = (k: number): { x: number; y: number } => {
			const r = Math.floor(k / 4), c = k % 4;
			return { x: 210 + c * 287, y: (r === 0 ? 300 : 560) - 190 * BOX_S + 6 };
		};
		const boxSprites: g.Sprite[] = [];
		BOXES.forEach((b, k) => {
			const p = boxPos(k);
			const sp = new g.Sprite({ scene, src: img("box" + k), x: p.x, y: p.y,
				anchorX: 0.5, scaleX: BOX_S, scaleY: BOX_S, touchable: true });
			boxL.append(sp);
			label(fontY, 24, p.x - 12, p.y + 190 * BOX_S + 4, yen(b.price), "center", boxL);
			sp.onPointDown.add(() => toggleBox(k));
			boxSprites.push(sp);
		});
		const boxOverlay = new View({ scene, width: W, height: H });
		boxL.append(boxOverlay);
		boxOverlay.draw = (r: g.Renderer): void => {
			const blink = Math.floor(total * 6) % 2 === 0 ? "#ffe040" : "#fff6a0";
			pickedBoxes.forEach((k) => {
				const p = boxPos(k);
				const w = 240 * BOX_S, h = 190 * BOX_S;
				frameRect(r, p.x - w / 2 - 4, p.y - 4, w + 8, h + 8, 8, blink);
			});
		};
		const toggleBox = (k: number): void => {
			if (phase !== "boxes") return;
			const at = pickedBoxes.indexOf(k);
			if (at >= 0) {
				pickedBoxes.splice(at, 1);
				se("unselect", 0.5);
			} else if (pickedBoxes.length < PICK_BOXES) {
				pickedBoxes.push(k);
				se("select", 0.5);
				const p = boxPos(k);
				burst(p.x, p.y + 90, 12, 320, ["#ffe040", "#ffffff"]);
			} else {
				se("unselect", 0.4);
				popText("3個までだよ！ 外すときはもう一度タップ", fontR, 30, W / 2, 380, 1.0);
			}
		};

		// ======== カゴ(お会計) ========
		cartL.append(new g.Sprite({ scene, src: img("bg_shelf") }));
		cartL.append(new g.FilledRect({ scene, cssColor: "rgba(20,10,30,0.55)", width: W, height: H }));
		const cartItems = new g.E({ scene });
		cartL.append(cartItems);
		const basket = new g.Sprite({ scene, src: img("basket"), x: W / 2, y: 380, anchorX: 0.5 });
		cartL.append(basket);
		const cartTitle = label(fontY, 54, W / 2, 40, "ぜんぶカゴへ！", "center", cartL);
		const cartSum = label(fontW, 40, W / 2, 120, "", "center", cartL);
		const cartSub = label(fontC, 30, W / 2, 176, "", "center", cartL);
		void cartTitle;

		// ======== 開封部屋 ========
		openL.append(new g.Sprite({ scene, src: img("bg_room") }));
		const cardView = new View({ scene, width: W, height: H });
		openL.append(cardView);
		const totalL = label(fontG, 50, W / 2, 8, "", "center", openL);
		const bigName = label(fontW, 34, W / 2, 0, "", "center", openL);
		const bigInfo = label(fontY, 30, W / 2, 0, "", "center", openL);
		const bigValue = label(fontG, 50, W / 2, 0, "", "center", openL);

		// ======== カードを引く ========
		const drawRarity = (it: Item): number => {
			let sum = 0;
			const ws: number[] = [];
			for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
				let w = RARITY_WEIGHTS[i] * Math.exp(it.luck * LUCK_K * i);
				if (i >= 12) w *= Math.exp(it.chaos * CHAOS_K * (i - 11));
				ws.push(w);
				sum += w;
			}
			let v = rand() * sum;
			for (let i = 0; i < ws.length; i++) {
				v -= ws[i];
				if (v <= 0) return i;
			}
			return 0;
		};
		const drawCard = (it: Item): Card => {
			const rar = drawRarity(it);
			const mon = rand() < 0.45 ? it.mon : Math.floor(rand() * 20);
			const foil = rand() < FOIL_RATE;
			const errRate = 0.002 + it.chaos * 0.0018;
			const error = rand() < errRate ? 8 + rand() * 4 : 0;
			let value = RARITY_VALUES[rar] * (0.75 + rand() * 0.5) * MON_POP[mon];
			if (foil) value *= FOIL_MUL;
			if (error > 0) value *= error;
			return { mon, rar, foil, error, value: Math.round(value / 10) * 10 };
		};
		const openAll = (): void => {
			pickedPacks.forEach((i) => {
				for (let k = 0; k < CARDS_PER_PACK; k++) cards.push(drawCard(PACKS[i]));
			});
			pickedBoxes.forEach((i) => {
				for (let k = 0; k < CARDS_PER_BOX; k++) cards.push(drawCard(BOXES[i]));
			});
			appraisal = 0;
			cards.forEach((c) => {
				appraisal += c.value;
			});
			appraisal = Math.round(appraisal);
			g.game.vars.gameState.score = appraisal;
		};

		// ======== エフェクト ========
		const burst = (x: number, y: number, n: number, sp: number, cols: string[]): void => {
			for (let k = 0; k < n; k++) {
				const a = rand() * Math.PI * 2, v = sp * (0.4 + rand() * 0.8);
				parts.push({
					x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, g: 700, life: 0.6, max: 0.6, size: 7 + rand() * 7,
					col: cols[Math.floor(rand() * cols.length)], img: ""
				});
			}
		};
		const confetti = (n: number): void => {
			for (let k = 0; k < n; k++) {
				parts.push({
					x: rand() * W, y: -20 - rand() * 100, vx: (rand() - 0.5) * 200, vy: 200 + rand() * 250, g: 120, life: 2.2, max: 2.2,
					size: 8 + rand() * 7, col: "hsl(" + Math.floor(rand() * 360) + ",95%,62%)", img: ""
				});
			}
		};
		const sparkle = (x: number, y: number, n: number, sp: number): void => {
			for (let k = 0; k < n; k++) {
				const a = k / n * Math.PI * 2;
				parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
					g: 0, life: 0.5, max: 0.5, size: 40, col: "", img: "spark" });
			}
		};
		let raysT = 0;
		let raysS = 1;
		fx.draw = (r: g.Renderer): void => {
			if (raysT > 0) {
				const a = img("rays"), s = raysS * (1 + (1 - Math.min(1, raysT)) * 0.2), rot = total * 0.8;
				r.save();
				r.opacity(Math.min(1, raysT) * 0.85);
				const c = Math.cos(rot) * s, sn = Math.sin(rot) * s;
				r.transform([c, sn, -sn, c, W / 2, 380]);
				r.drawImage(surf.rays, 0, 0, a.width, a.height, -a.width / 2, -a.height / 2);
				r.restore();
			}
			parts.forEach((p) => {
				r.save();
				r.opacity(Math.min(1, p.life / p.max * 2));
				if (p.img) {
					const a = img(p.img), s = p.size / a.width;
					r.transform([s, 0, 0, s, p.x - p.size / 2, p.y - p.size / 2]);
					r.drawImage(surf[p.img], 0, 0, a.width, a.height, 0, 0);
				} else r.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, p.col);
				r.restore();
			});
			if (flash > 0) {
				r.save();
				r.opacity(Math.min(0.7, flash));
				r.fillRect(0, 0, W, H, flashCol);
				r.restore();
			}
		};

		// ======== カードを描く ========
		// flip: 0=うら 1=おもて。s: 大きさ
		const drawCardAt = (r: g.Renderer, c: Card, cx: number, cy: number, s: number, flip: number, alpha = 1): void => {
			const fw = 180, fh = 252;
			const sx = Math.abs(Math.cos((1 - flip) * Math.PI)) * s;
			const front = flip > 0.5;
			r.save();
			if (alpha < 1) r.opacity(alpha);
			r.transform([sx, 0, 0, s, cx, cy]);
			if (!front) {
				r.drawImage(surf.card_back, 0, 0, fw, fh, -fw / 2, -fh / 2);
				r.restore();
				return;
			}
			r.drawImage(surf["frame" + c.rar], 0, 0, fw, fh, -fw / 2, -fh / 2);
			const m = img("mon" + c.mon), ms = 118 / m.width;
			const ox = c.error > 0 ? 10 : 0;
			r.save();
			if (c.error > 0) {
				// エラーカード: 絵がずれて二重に印刷
				r.save();
				r.opacity(0.5);
				r.transform([ms, 0, 0, ms, -59 - 8, -86 - 4]);
				r.drawImage(surf["mon" + c.mon], 0, 0, m.width, m.height, 0, 0);
				r.restore();
			}
			r.transform([ms, 0, 0, ms, -59 + ox, -86 + (c.error > 0 ? 6 : 0)]);
			r.drawImage(surf["mon" + c.mon], 0, 0, m.width, m.height, 0, 0);
			r.restore();
			if (c.foil) {
				// ホイル: 光の帯がすべる
				const p = ((total * 0.9 + c.mon * 0.13) % 1.6) - 0.3;
				r.save();
				r.opacity(0.45);
				r.transform([1, 0, -0.5, 1, -90 + p * 220, -126]);
				r.fillRect(0, 0, 26, 252, "#ffffff");
				r.restore();
			}
			if (c.error > 0) {
				const st = img("stamp_error"), ss = 0.62;
				r.transform([ss, 0, 0, ss, -st.width * ss / 2, -st.height * ss / 2 + 10]);
				r.drawImage(surf.stamp_error, 0, 0, st.width, st.height, 0, 0);
			}
			r.restore();
		};
		// 開封の段取り
		let order: number[] = []; // 大きく見せる順(安い→高い)
		let reveal = -1; // いま大きく見せているカード
		let revealT = 0;
		const GRID_C = 20;
		const gridPos = (i: number): { x: number; y: number } => ({ x: 30 + (i % GRID_C) * 61, y: 150 + Math.floor(i / GRID_C) * 86 });
		const flipAt = (i: number): number => 0.6 + i * 0.022;
		const STEP_A = 3.2; // ここまでで100枚いっせいにめくる
		const STEP_T = (OPEN_SEC - STEP_A - 0.6) / SHOW_TOP; // 1枚ずつ見せる間かく
		cardView.draw = (r: g.Renderer): void => {
			const t = phaseT;
			const inA = t < STEP_A;
			const gridAlpha = inA ? 1 : Math.max(0.18, 1 - (t - STEP_A) * 2);
			// 100枚のグリッド
			cards.forEach((c, i) => {
				const p = gridPos(i);
				const f = Math.max(0, Math.min(1, (t - flipAt(i)) / 0.25));
				drawCardAt(r, c, p.x + 29, p.y + 40, 0.32, f, gridAlpha);
				if (f >= 1 && c.rar >= 12 && gridAlpha >= 1) {
					r.save();
					r.opacity(0.35 + Math.sin(total * 8 + i) * 0.2);
					frameRect(r, p.x, p.y, 58, 81, 3, c.rar >= 16 ? "#ff60f0" : "#ffe040");
					r.restore();
				}
			});
			if (inA || reveal < 0) return;
			// 見せおわったカードは左右にならべる
			for (let k = 0; k < reveal; k++) {
				const c = cards[order[k]];
				const side = k % 2 === 0 ? 0 : 1, row = Math.floor(k / 2);
				drawCardAt(r, c, side === 0 ? 70 + (row % 2) * 70 : W - 70 - (row % 2) * 70, 140 + row * 66, 0.42, 1);
			}
			// いま見せているカード(大きく)
			const c = cards[order[reveal]];
			const k = Math.min(1, revealT / 0.22);
			const s = 1.55 + (1 - k) * 0.6;
			drawCardAt(r, c, W / 2, 360, s, Math.min(1, revealT / 0.16));
		};
		const tierOf = (c: Card): number => c.error > 0 ? 5 : c.rar >= 18 ? 4 : c.rar >= 16 ? 3 : c.rar >= 12 ? 2 : c.rar >= 8 ? 1 : 0;
		const showReveal = (k: number): void => {
			reveal = k;
			revealT = 0;
			const c = cards[order[k]];
			shown += c.value;
			setText(bigName, MONSTER_NAMES[c.mon] + "　" + RARITY_NAMES[c.rar]);
			const extra = (c.foil ? "  ホイル×1.35" : "") + (c.error > 0 ? "  エラー×" + c.error.toFixed(1) : "");
			setText(bigInfo, extra);
			setText(bigValue, "買取 " + yen(c.value));
			bigName.y = 560; bigInfo.y = 604; bigValue.y = 640;
			[bigName, bigInfo, bigValue].forEach((l) => l.modified());
			const tier = tierOf(c);
			se("flip", 0.5);
			if (tier === 1) {
				se("rare1", 0.6); sparkle(W / 2, 360, 10, 500);
			} else if (tier === 2) {
				se("rare2", 0.65); sparkle(W / 2, 360, 14, 600); flash = 0.4; flashCol = "#ffffff"; confetti(30);
			} else if (tier === 3) {
				se("rare3", 0.7); raysT = 1.6; raysS = 1.1; flash = 0.6; flashCol = "#ffe8ff"; shake = 0.4; confetti(60);
				popText(RARITY_NAMES[c.rar] + "レア！！", fontP, 60, W / 2, 80, 1.4);
			} else if (tier >= 4) {
				const god = c.rar === 19;
				se(c.error > 0 ? "error" : "god", 0.75);
				if (c.error > 0) se("rare3", 0.6);
				se("cheer", 0.6);
				raysT = 2.4; raysS = 1.4; flash = 0.9; flashCol = c.error > 0 ? "#ff4040" : "#fff4a0"; shake = 0.7; confetti(120);
				popText(c.error > 0 ? "エラーカード出現！！" : god ? "シークレットゴッド降臨！！" : "シークレット！！", c.error > 0 ? fontR : fontG, 66, W / 2, 80, 1.8);
			}
		};

		// ======== 最終査定 ========
		const finalL = new g.E({ scene });
		scene.insertBefore(finalL, top);
		finalL.hide();
		const showAppraisal = (): void => {
			finalL.show();
			totalL.hide();
			finalL.append(new g.FilledRect({ scene, cssColor: "rgba(20,10,30,0.82)", width: W, height: H }));
			const spent = pickedPacks.reduce((a, i) => a + PACKS[i].price, 0) + pickedBoxes.reduce((a, i) => a + BOXES[i].price, 0);
			const diff = appraisal - spent;
			label(fontW, 40, W / 2, 30, "査定結果", "center", finalL);
			label(fontG, 90, W / 2, 84, "買取総額 " + yen(appraisal), "center", finalL);
			label(fontW, 30, W / 2, 200,
				"使ったお金 " + yen(spent) + "　→　" + (diff >= 0 ? "+" : "−") + yen(Math.abs(diff)).slice(1) + "円", "center", finalL);
			label(diff >= 0 ? fontY : fontC, 44, W / 2, 244, diff >= 0 ? "大もうけ！ 爆アド！！" : "ざんねん…でも開封は楽しい！", "center", finalL);
			// いちばん高いカード
			let best = 0;
			cards.forEach((c, i) => {
				if (c.value > cards[best].value) best = i;
			});
			const bc = cards[best];
			const v = new View({ scene, width: W, height: H });
			v.draw = (r: g.Renderer): void => drawCardAt(r, bc, 300, 480, 1.0, 1);
			v.onUpdate.add(() => v.modified());
			finalL.append(v);
			label(fontY, 28, 300, 618, "いちばん高い1枚", "center", finalL);
			label(fontW, 26, 300, 652, MONSTER_NAMES[bc.mon] + " " + yen(bc.value), "center", finalL);
			// レアリティの内訳(上位)
			const cnt: number[] = [];
			for (let i = 0; i < 20; i++) cnt.push(0);
			let errs = 0;
			let foils = 0;
			cards.forEach((c) => {
				cnt[c.rar]++;
				if (c.error > 0) errs++;
				if (c.foil) foils++;
			});
			let y = 316;
			label(fontC, 28, 820, y, "100枚の内訳（高いレア）", "center", finalL);
			y += 40;
			let shownN = 0;
			for (let i = 19; i >= 0 && shownN < 7; i--) {
				if (cnt[i] === 0) continue;
				label(i >= 16 ? fontP : i >= 12 ? fontY : fontW, 26, 820, y, RARITY_NAMES[i] + "　×" + cnt[i], "center", finalL);
				y += 34;
				shownN++;
			}
			label(fontR, 26, 820, y + 6, "エラーカード ×" + errs + "　ホイル ×" + foils, "center", finalL);
			se("finish", 0.7);
			if (diff >= 0) {
				se("cheer", 0.6); confetti(80);
			}
		};

		// ======== おしまい ========
		const finish = (): void => {
			if (phase === "end") return;
			if (cards.length === 0) {
				// まだ開封していなければ、ここで全部開ける
				autoPick();
				openAll();
			}
			g.game.vars.gameState.score = appraisal;
			phase = "end";
			showHud(false);
			label(fontY, 44, 1110, 22, "おしまい！", "center", top);
		};

		// ======== 自動で選ぶ ========
		const autoPick = (): void => {
			while (pickedPacks.length < PICK_PACKS) {
				const i = Math.floor(rand() * PACKS.length);
				if (pickedPacks.indexOf(i) < 0) pickedPacks.push(i);
			}
			while (pickedBoxes.length < PICK_BOXES) {
				const i = Math.floor(rand() * BOXES.length);
				if (pickedBoxes.indexOf(i) < 0) pickedBoxes.push(i);
			}
		};

		// ======== 場面の切りかえ ========
		const go = (p: Phase): void => {
			phase = p;
			phaseT = 0;
			[atmL, frontL, packL, boxL, cartL, openL].forEach((l) => l.hide());
			showHud(false);
			if (p === "atm") {
				atmL.show();
				se("atm", 0.5);
			} else if (p === "front") {
				frontL.show();
				se("door", 0.6);
				g.game.audio.music.play(scene.asset.getAudioById("bgm_shop"));
			} else if (p === "packs") {
				packL.show();
				showHud(true);
				setPage(0);
				popText("気になるパックをタップ！", fontY, 44, W / 2, 330, 1.4);
			} else if (p === "boxes") {
				boxL.show();
				showHud(true);
				popText("下の段のボックスから3個えらぼう！", fontY, 44, W / 2, 340, 1.4);
			} else if (p === "cart") {
				cartL.show();
				buildCart();
				se("cart", 0.7);
			} else if (p === "black") {
				g.game.audio.music.stopAll();
			} else if (p === "opening") {
				openL.show();
				openAll();
				order = [];
				cards.forEach((c, i) => order.push(i));
				order.sort((a, b) => cards[b].value - cards[a].value);
				order = order.slice(0, SHOW_TOP).reverse();
				// グリッドの最初の合計は、大きく見せない残りの84枚
				shown = 0;
				g.game.audio.music.play(scene.asset.getAudioById("bgm_open"));
				popText("100枚 いっせい開封！！", fontG, 70, W / 2, 300, 1.6);
				se("rip", 0.7);
			} else if (p === "appraisal") {
				openL.show();
				showAppraisal();
			}
		};
		const buildCart = (): void => {
			const spent = pickedPacks.reduce((a, i) => a + PACKS[i].price, 0) + pickedBoxes.reduce((a, i) => a + BOXES[i].price, 0);
			setText(cartSum, "お会計 " + yen(spent) + "　（おつり " + yen(BUDGET - spent) + "）");
			setText(cartSub, "パック5種＋ボックス3個 ＝ カード100枚！");
			pickedBoxes.forEach((k, n) => {
				const sp = new g.Sprite({ scene, src: img("box" + k), x: 380 + n * 170, y: -200, scaleX: 0.75, scaleY: 0.75 });
				cartItems.append(sp);
				cartDrops.push({ sp, ty: 380 + 70 - n * 6, delay: n * 0.18 });
			});
			pickedPacks.forEach((k, n) => {
				const sp = new g.Sprite({ scene, src: img("pack" + k), x: 400 + n * 90,
					y: -260, scaleX: 0.6, scaleY: 0.6, angle: (n - 2) * 8 });
				cartItems.append(sp);
				cartDrops.push({ sp, ty: 300 + (n % 2) * 20, delay: 0.5 + n * 0.12 });
			});
		};
		const cartDrops: { sp: g.Sprite; ty: number; delay: number }[] = [];

		// ======== 決定ボタン ========
		okBtn.onPointDown.add(() => {
			if (phase === "packs" && pickedPacks.length === PICK_PACKS) {
				se("decide", 0.7); go("boxes");
			} else if (phase === "boxes" && pickedBoxes.length === PICK_BOXES) {
				se("decide", 0.7); go("cart");
			}
		});

		// ======== 毎フレーム ========
		const endAt = Math.max(40, time - END_BEFORE);
		let lastTick = 0;
		go("atm");
		scene.onUpdate.add(() => {
			total += dt;
			phaseT += dt;
			if (phase !== "end" && total >= endAt) finish();
			if (phase === "atm") {
				const k = Math.min(1, phaseT / (ATM_SEC - 0.6));
				setText(atmMoney, yen(Math.floor(k * 100) * 10000));
				bills.forEach((b, i) => {
					const st = 0.4 + i * 0.16;
					if (phaseT > st) {
						if (!b.visible()) {
							b.show(); if (i % 3 === 0) se("cash", 0.4);
						}
						const q = Math.min(1, (phaseT - st) / 0.35);
						b.y = 610 - q * (200 + i * 4);
						b.x = 530 + Math.sin(i * 1.7) * 30 * q;
						b.angle = (i % 2 ? 1 : -1) * 8 * q;
						b.modified();
					}
				});
				if (phaseT >= ATM_SEC) go("front");
			} else if (phase === "front") {
				const k = Math.min(1, phaseT / 0.5);
				const s = 0.8 * (k < 1 ? 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2) : 1);
				frontLogo.scaleX = frontLogo.scaleY = Math.max(0.01, s);
				frontLogo.modified();
				if (phaseT >= FRONT_SEC) go("packs");
			} else if (phase === "packs" || phase === "boxes") {
				const isPack = phase === "packs";
				const lim = isPack ? PACK_SEC : BOX_SEC;
				const left = Math.max(0, lim - phaseT);
				const n = isPack ? pickedPacks.length : pickedBoxes.length;
				const need = isPack ? PICK_PACKS : PICK_BOXES;
				setText(titleL, isPack ? "パックを5種類えらぼう！ " + n + "/5" : "ボックスを3個えらぼう！ " + n + "/3");
				const cost = pickedPacks.reduce((a, i) => a + PACKS[i].price, 0) + pickedBoxes.reduce((a, i) => a + BOXES[i].price, 0);
				setText(subL, "合計 " + yen(cost) + "　予算 " + yen(BUDGET));
				setText(timeL, "のこり " + Math.ceil(left) + "秒");
				const ready = n === need;
				const want = ready ? "btn_ok" : "btn_off";
				if (okState !== want) {
					okState = want; okBtn.src = img(want); okBtn.invalidate();
				}
				okBtn.scaleX = okBtn.scaleY = 0.62 * (ready ? 1 + Math.sin(total * 8) * 0.04 : 1);
				okBtn.modified();
				if (isPack) {
					packSlots.forEach((s, k) => {
						const at = pickedPacks.indexOf(page * 15 + s.idx);
						setText(packNums[k], at >= 0 ? String(at + 1) : "");
					});
					packOverlay.modified();
				} else boxOverlay.modified();
				if (left <= 3 && Math.ceil(left) !== lastTick && left > 0) {
					lastTick = Math.ceil(left); se("tick", 0.5);
				}
				if (left <= 0) {
					autoPick();
					popText("時間切れ！ のこりは自動でえらんだよ", fontR, 36, W / 2, 360, 1.2);
					se("decide", 0.6);
					go(isPack ? "boxes" : "cart");
				}
			} else if (phase === "cart") {
				cartDrops.forEach((d) => {
					const q = Math.max(0, Math.min(1, (phaseT - d.delay) / 0.4));
					d.sp.y = -260 + (d.ty + 260) * (1 - Math.pow(1 - q, 3));
					d.sp.modified();
				});
				if (phaseT >= CART_SEC) go("black");
			} else if (phase === "black") {
				blackR.opacity = Math.min(1, phaseT / 0.4);
				blackR.modified();
				if (phaseT >= BLACK_SEC) go("opening");
			} else if (phase === "opening") {
				if (blackR.opacity > 0) {
					blackR.opacity = Math.max(0, blackR.opacity - dt * 3); blackR.modified();
				}
				// 100枚めくるあいだ、残りの84枚の合計を数えあげる
				if (phaseT < STEP_A) {
					let sum = 0;
					const top16: { [i: number]: boolean } = {};
					order.forEach((i) => {
						top16[i] = true;
					});
					cards.forEach((c, i) => {
						if (!top16[i] && phaseT >= flipAt(i) + 0.25) sum += c.value;
					});
					shown = sum;
					if (Math.floor(phaseT * 12) !== Math.floor((phaseT - dt) * 12)) se("flip", 0.25);
				} else {
					const k = Math.min(SHOW_TOP - 1, Math.floor((phaseT - STEP_A) / STEP_T));
					if (k !== reveal) showReveal(k);
					revealT += dt;
				}
				setText(totalL, "買取額 " + yen(shown));
				cardView.modified();
				if (phaseT >= OPEN_SEC) {
					setText(bigName, ""); setText(bigInfo, ""); setText(bigValue, "");
					go("appraisal");
				}
			}
			// エフェクト
			if (raysT > 0) raysT -= dt;
			if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
			if (shake > 0) {
				shake = Math.max(0, shake - dt);
				openL.x = Math.sin(shake * 70) * shake * 20;
				openL.y = Math.cos(shake * 53) * shake * 12;
				openL.modified();
			}
			for (let i = parts.length - 1; i >= 0; i--) {
				const p = parts[i];
				p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.97; p.vy *= 0.97;
				p.life -= dt;
				if (p.life <= 0) parts.splice(i, 1);
			}
			fx.modified();
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
			if (phase !== "end" && cards.length > 0) g.game.vars.gameState.score = appraisal;
		});
	});
	g.game.pushScene(scene);
}
