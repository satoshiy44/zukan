import { GameMainParameterObject } from "./parameterObject";

// ======== 調整用パラメータ ========
const GY = 300; // 地面のY座標
const ROOT_X = 700; // つる(根)のX座標
const BASKET_X = 1080;
const BASKET_Y = 190;
const INTRO_SEC = 5; // 説明+カウントダウン
const RESULT_SEC = 11; // 結果表示に使う時間(制限時間の約10秒前には終える)
const SWITCH_SEC = 4; // 前半→後半の切りかえ
const DIG_SHARE = 0.5; // プレイ時間のうち前半(いもほり)の割合
const PULL_SPEED = 360; // px/秒
const STRAIN_UP = 70; // 引っぱり中のメーター上昇/秒(×かたさ)。引っぱる速さに合わせて、1pxあたりの上がり方は同じくらい
const STRAIN_DOWN = 130; // はなしている間のメーター回復/秒
const ROCK_SPIKE = 42; // 石が引っかかったときのメーター上昇
const STUN_SEC = 1.2; // ブチッの後に動けない時間
const UPGRADE_CHAIN = 4; // 1回の長押しでこの数以上続けて抜くと、いもがランクアップ
const HAND_X = 250; // 手もとのいもを積む場所
const HAND_Y = 268;
// 後半: やきいも屋台
const FEVER_SEC = 8; // 残りこの秒数で「閉店まぎわの大行列」(値段2倍)
const SELLOUT_BONUS = 1000; // 完売ボーナス(+残り1秒ごとに100)
const LEFTOVER_PRICE = 20; // 売れ残りの安売り
const OVEN_X = 430; // 窯の中のいもの位置
const OVEN_Y = 520;
const METER_X = 190;
const METER_Y = 640;
const METER_W = 900;
const CUSTOMER_X = 960;
const SALE_X = 820; // 売れたときの文字の位置(お客さんの左上)
const SALE_Y = 330;

type ImoKind = "imo" | "imo_big" | "imo_gold";
type ItemKind = ImoKind | "rock";
const DIG_SCORE: { [key: string]: number } = { imo: 10, imo_big: 30, imo_gold: 100 };
const SELL_PRICE: { [key: string]: number } = { imo: 50, imo_big: 150, imo_gold: 400 };
const KIND_SPEED: { [key: string]: number } = { imo: 1, imo_big: 1.1, imo_gold: 1.25 }; // いいいもほど焼けるのが速い
const UPGRADE: { [key: string]: ImoKind } = { imo: "imo_big", imo_big: "imo_gold", imo_gold: "imo_gold" };
const KIND_ORDER: { [key: string]: number } = { imo_gold: 0, imo_big: 1, imo: 2 };

// 焼き加減(メーターの位置 0〜1)
interface Zone { from: number; to: number; name: string; mult: number; color: string; }
const ZONES: Zone[] = [
	{ from: 0, to: 0.42, name: "なま", mult: 0.3, color: "#e9d9a8" },
	{ from: 0.42, to: 0.56, name: "ほくほく", mult: 2, color: "#f4a640" },
	{ from: 0.56, to: 0.64, name: "極上", mult: 3, color: "#e8412f" },
	{ from: 0.64, to: 0.76, name: "ほくほく", mult: 2, color: "#f4a640" },
	{ from: 0.76, to: 1.01, name: "こげ", mult: 0, color: "#3a2a24" }
];

// お客さん(キャラ)ごとに、焼き加減の針の動き方がちがう
type CustomerType = "kuma" | "usagi" | "kitsune";
interface CustomerDef {
	type: CustomerType;
	base: number; // 針の基本の速さ(メーター/秒)
	at: number; // くま: 強火になる位置 / うさぎ: 止まる位置
	pause: number; // うさぎ: 止まる時間
	freq: number; // きつね: 緩急の周期(回/秒)
	phase: number; // きつね: 緩急の始まり
}
const CUSTOMER_INFO: { [key: string]: { image: string; name: string; hint: string } } = {
	kuma: { image: "cust_kuma", name: "くまさん", hint: "のんびり… でも急に強火!" },
	usagi: { image: "cust_usagi", name: "うさぎさん", hint: "せっかち! 一瞬止まって一気に" },
	kitsune: { image: "cust_kitsune", name: "きつねさん", hint: "きまぐれ 速くなったり遅くなったり" }
};
// 共通乱数からお客さんの列を作る(全員同じ順番・同じ動き)
function createCustomer(random: g.RandomGenerator): CustomerDef {
	const r = (): number => random.generate();
	const pick = r();
	const type: CustomerType = pick < 0.34 ? "kuma" : pick < 0.67 ? "usagi" : "kitsune";
	if (type === "kuma") return { type, base: 0.45 + r() * 0.12, at: 0.22 + r() * 0.2, pause: 0, freq: 0, phase: 0 };
	if (type === "usagi") return { type, base: 0.9 + r() * 0.25, at: 0.28 + r() * 0.16, pause: 0.25 + r() * 0.3, freq: 0, phase: 0 };
	return { type, base: 0.6 + r() * 0.2, at: 0, pause: 0, freq: 0.7 + r() * 0.8, phase: r() * Math.PI * 2 };
}

interface ItemDef {
	kind: ItemKind;
	depth: number; // 地面からの深さ(px)
	side: number; // 根から左右どちらにつくか(-1/1)
}
interface PlantDef {
	length: number;
	stiffness: number;
	items: ItemDef[];
	isGold: boolean;
}

// 共通乱数からつるを作る(全員同じ順番・同じ形のつるになる)
function createPlant(random: g.RandomGenerator, index: number): PlantDef {
	const r = (): number => random.generate();
	const items: ItemDef[] = [];
	const level = Math.min(index, 10);
	const length = Math.round(290 + r() * 150 + level * 18);
	const imoCount = 3 + Math.floor(r() * 3) + (level >= 4 ? 1 : 0);
	const firstSide = r() < 0.5 ? -1 : 1;
	const step = (length - 110) / imoCount;
	const depths: number[] = [];
	for (let i = 0; i < imoCount; i++) {
		depths.push(80 + step * i + r() * step * 0.3);
		items.push({ kind: r() < 0.18 ? "imo_big" : "imo", depth: depths[i], side: i % 2 === 0 ? firstSide : -firstSide });
	}
	// いちばん深いところは大きい(たまに金の)いも
	const lastSide = imoCount % 2 === 0 ? firstSide : -firstSide;
	items.push({ kind: r() < 0.14 + level * 0.012 ? "imo_gold" : "imo_big", depth: length - 20, side: lastSide });
	depths.push(length - 20);
	// 石はいもといもの間に置く。石なしのつるは「一本釣り」のチャンス
	const rockCount = index === 0 || r() < 0.35 ? 0 : 1 + (level >= 5 && r() < 0.5 ? 1 : 0);
	const slots: number[] = [];
	for (let i = 1; i < depths.length; i++) slots.push(i);
	for (let i = 0; i < rockCount && slots.length > 0; i++) {
		const k = slots.splice(Math.floor(r() * slots.length), 1)[0];
		items.push({ kind: "rock", depth: (depths[k - 1] + depths[k]) / 2, side: 0 });
	}
	let stiffness = 0.85 + r() * 0.35 + level * 0.025;
	// たまに「金のつる」: いもが全部 金。そのかわり かたい
	const isGold = index >= 2 && r() < 0.12;
	if (isGold) {
		items.forEach((it) => {
			if (it.kind !== "rock") it.kind = "imo_gold";
		});
		stiffness += 0.3;
	}
	return { length, stiffness, items, isGold };
}

interface LiveItem {
	def: ItemDef;
	sprite: g.Sprite;
	done: boolean;
}

export function main(param: GameMainParameterObject): void {
	const scene = new g.Scene({
		game: g.game,
		assetIds: [
			"bg", "imo", "imo_big", "imo_gold", "rock", "vine", "basket", "tanuki_idle", "tanuki_pull", "tanuki_fall",
			"leaf_red", "leaf_yellow", "snap", "logo",
			"stall_bg", "yatai", "cust_kitsune", "cust_usagi", "cust_kuma", "imo_burnt", "imo_yaki",
			"pop1", "pop2", "pop3", "pop4", "pop5", "pop6", "pop7", "pop8",
			"gold", "snap_se", "creak", "rock_se", "harvest", "bank", "lose", "heart", "beep", "go", "finish", "last", "result",
			"perfect", "good", "bad", "open", "bgm"
		]
	});
	let time = 90; // 制限時間
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
		const cosmeticRandom = g.game.random; // 見た目用(プレイヤーごとに違ってよい)

		// ---- フォント ----
		const makeFont = (color: string, stroke: string, size: number): g.DynamicFont =>
			new g.DynamicFont({
				game: g.game,
				fontFamily: "sans-serif",
				fontWeight: "bold",
				size,
				fontColor: color,
				strokeColor: stroke,
				strokeWidth: size / 6
			});
		const fontWhite = makeFont("#fff8e6", "#3a1a0a", 64);
		const fontYellow = makeFont("#ffe14a", "#5b1638", 64);
		const fontRed = makeFont("#ff5a4a", "#fff8e6", 64);
		const fontPink = makeFont("#ffd0e4", "#5b1638", 64);

		type Align = "left" | "center" | "right";
		const label = (text: string, font: g.Font, size: number, x: number, y: number, parent: g.E, align: Align = "left"): g.Label => {
			const l = new g.Label({ scene, text, font, fontSize: size, x, y });
			if (align !== "left") l.anchorX = align === "center" ? 0.5 : 1;
			parent.append(l);
			return l;
		};
		// スプライトの画像を差しかえる(大きさもその画像に合わせる)
		const setImage = (sp: g.Sprite, src: g.ImageAsset): void => {
			if (sp.src === src) return;
			sp.src = src;
			sp.width = sp.srcWidth = src.width;
			sp.height = sp.srcHeight = src.height;
			sp.invalidate();
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
		const worldLayer = new g.E({ scene });
		const stallLayer = new g.E({ scene });
		const gaugeLayer = new g.E({ scene });
		const fxLayer = new g.E({ scene });
		const hudLayer = new g.E({ scene });
		[bgLayer, worldLayer, stallLayer, gaugeLayer, fxLayer, hudLayer].forEach((e) => scene.append(e));
		stallLayer.hide();
		bgLayer.append(new g.Sprite({ scene, src: img("bg") }));

		// 落ち葉
		let leafTimer = 0;
		const spawnLeaf = (): void => {
			const red = cosmeticRandom.generate() < 0.55;
			const leaf = new g.Sprite({
				scene, src: img(red ? "leaf_red" : "leaf_yellow"),
				x: cosmeticRandom.generate() * 1280, y: -40, anchorX: 0.5, anchorY: 0.5
			});
			const vx = -20 - cosmeticRandom.generate() * 40;
			const vy = 50 + cosmeticRandom.generate() * 40;
			const spin = (cosmeticRandom.generate() - 0.5) * 8;
			const phaseOffset = cosmeticRandom.generate() * 6;
			leaf.onUpdate.add(() => {
				leaf.x += (vx + Math.sin(g.game.age / 10 + phaseOffset) * 40) * dt;
				leaf.y += vy * dt;
				leaf.angle += spin;
				leaf.modified();
				if (leaf.y > GY + 5) leaf.destroy();
			});
			bgLayer.append(leaf);
		};

		// ---- 前半の世界(かご・たぬき・つる・根) ----
		const basket = new g.Sprite({ scene, src: img("basket"), x: BASKET_X, y: BASKET_Y + 40, anchorX: 0.5, anchorY: 0.5 });
		worldLayer.append(basket);
		const basketCount = label("0こ", fontWhite, 30, BASKET_X, BASKET_Y + 70, worldLayer, "center");

		const rootLine = new g.FilledRect({ scene, cssColor: "#e6c79a", x: ROOT_X - 5, y: GY, width: 10, height: 0 });
		worldLayer.append(rootLine);
		const itemLayer = new g.E({ scene });
		worldLayer.append(itemLayer);
		const vine = new g.Sprite({ scene, src: img("vine"), x: ROOT_X, y: GY + 8, anchorX: 0.5, anchorY: 1 });
		worldLayer.append(vine);

		const tanukiImages = { idle: img("tanuki_idle"), pull: img("tanuki_pull"), fall: img("tanuki_fall") };
		const tanuki = new g.Sprite({ scene, src: tanukiImages.idle, x: 590, y: GY + 20, anchorX: 0.5, anchorY: 1 });
		worldLayer.append(tanuki);
		let tanukiPose: "idle" | "pull" | "fall" = "idle";
		const setPose = (pose: "idle" | "pull" | "fall"): void => {
			if (tanukiPose === pose) return;
			tanukiPose = pose;
			setImage(tanuki, tanukiImages[pose]);
		};

		// メーターが赤いときの画面の点滅
		const dangerFlash = new g.FilledRect({ scene, cssColor: "#ff2a1a", width: 1280, height: 720, opacity: 0 });
		gaugeLayer.append(dangerFlash);
		// 手もと(まだ確定していないいも)
		const handLabel = label("", fontYellow, 40, HAND_X, 150, worldLayer, "center");
		const nextLabel = label("", fontWhite, 26, HAND_X, 205, worldLayer, "center");

		// ピンメーター
		const GAUGE_X = 880;
		const GAUGE_Y = 70;
		const GAUGE_H = 200;
		gaugeLayer.append(new g.FilledRect({
			scene, cssColor: "#3a1a0a", x: GAUGE_X - 6, y: GAUGE_Y - 6, width: 44, height: GAUGE_H + 12
		}));
		gaugeLayer.append(new g.FilledRect({ scene, cssColor: "#fff8e6", x: GAUGE_X, y: GAUGE_Y, width: 32, height: GAUGE_H }));
		gaugeLayer.append(new g.FilledRect({ scene, cssColor: "#ffd6d0", x: GAUGE_X, y: GAUGE_Y, width: 32, height: GAUGE_H * 0.25 }));
		const gaugeFill = new g.FilledRect({ scene, cssColor: "#6cc04a", x: GAUGE_X, y: GAUGE_Y + GAUGE_H, width: 32, height: 0 });
		gaugeLayer.append(gaugeFill);
		label("ピン", fontWhite, 22, GAUGE_X + 16, GAUGE_Y - 36, gaugeLayer, "center");
		const stiffLabel = label("", fontWhite, 28, ROOT_X, GY - 200, worldLayer, "center");
		const ipponLabel = label("", fontYellow, 30, ROOT_X - 40, GY - 240, worldLayer, "center");
		const warnLabel = label("", fontRed, 34, ROOT_X + 60, GY + 10, worldLayer);
		const remainLabel = label("", fontWhite, 24, ROOT_X + 20, 670, worldLayer);

		// ---- 後半の世界(やきいも屋台) ----
		stallLayer.append(new g.Sprite({ scene, src: img("stall_bg") }));
		stallLayer.append(new g.Sprite({ scene, src: img("yatai"), x: 150, y: 230 }));
		const customer = new g.Sprite({ scene, src: img("cust_kuma"), x: CUSTOMER_X, y: 600, anchorX: 0.5, anchorY: 1 });
		stallLayer.append(customer);
		const ovenImo = new g.Sprite({ scene, src: img("imo"), x: OVEN_X, y: OVEN_Y, anchorX: 0.5, anchorY: 0.5 });
		ovenImo.scaleX = ovenImo.scaleY = 1.4;
		stallLayer.append(ovenImo);
		const wantLabel = label("", fontWhite, 30, CUSTOMER_X, 270, stallLayer, "center");
		const customerName = label("", fontYellow, 30, CUSTOMER_X, 160, stallLayer, "center");
		const customerHint = label("", fontWhite, 24, CUSTOMER_X, 204, stallLayer, "center");
		// 焼き加減メーター
		stallLayer.append(new g.FilledRect({
			scene, cssColor: "#2a1408", x: METER_X - 8, y: METER_Y - 8, width: METER_W + 16, height: 60
		}));
		ZONES.forEach((z) => {
			const w = (Math.min(1, z.to) - z.from) * METER_W;
			const x = METER_X + z.from * METER_W;
			stallLayer.append(new g.FilledRect({ scene, cssColor: z.color, x, y: METER_Y, width: w, height: 44 }));
			label(z.name, z.mult === 0 ? fontRed : z.mult >= 3 ? fontYellow : fontWhite, 24,
				METER_X + (z.from + Math.min(1, z.to)) / 2 * METER_W, METER_Y - 36, stallLayer, "center");
		});
		const needleShadow = new g.FilledRect({ scene, cssColor: "#2a1408", x: METER_X - 7, y: METER_Y - 18, width: 14, height: 80 });
		const needle = new g.FilledRect({ scene, cssColor: "#fffbe8", x: METER_X - 4, y: METER_Y - 15, width: 8, height: 74 });
		stallLayer.append(needleShadow);
		stallLayer.append(needle);
		const stockLabel = label("", fontWhite, 28, 1250, 80, stallLayer, "right");
		const regularLabel = label("", fontYellow, 30, 28, 76, stallLayer);
		const tapHint = label("焼けたらタップ!", fontYellow, 34, OVEN_X, 170, stallLayer, "center");

		// ---- HUD ----
		const scoreLabel = label("0", fontWhite, 56, 24, 8, hudLayer);
		const stageLabel = label("", fontWhite, 26, 640, 14, hudLayer, "center");
		const timeLabel = label("", fontWhite, 44, 1256, 10, hudLayer, "right");

		// ---- ゲーム状態 ----
		let phase: "intro" | "dig" | "switch" | "stall" | "result" = "intro";
		let elapsed = 0;
		const playTime = Math.max(20, time - INTRO_SEC - RESULT_SEC - SWITCH_SEC);
		const digTime = Math.round(playTime * DIG_SHARE);
		const stallTime = playTime - digTime;
		let phaseLeft = digTime;
		let score = 0;
		let holding = false;
		let wasHolding = false;
		let heartTimer = 0;
		interface HandItem { sprite: g.Sprite; kind: ImoKind; state: "flying" | "hand" | "gone"; }
		let hand: HandItem[] = [];
		const pointers: { [id: number]: boolean } = {};
		let strain = 0;
		let progress = 0;
		let slowTimer = 0;
		let stun = 0;
		let plantActive = false;
		let ippon = true; // 一本釣り(一度もはなさずに抜く)継続中
		let creakTimer = 0;
		let plantIndex = 0;
		let plant: PlantDef;
		let liveItems: LiveItem[] = [];
		const stock: ImoKind[] = []; // かごの中のいも(後半で売る)
		const stats = { imo: 0, gold: 0, snap: 0, maxChain: 0, upgrade: 0, ippon: 0, sold: 0, perfect: 0, maxRegular: 0, soldOut: false };

		// つるは最初にまとめて作る(プレイ内容で乱数の消費がずれないように)
		const plants: PlantDef[] = [];
		for (let i = 0; i < 40; i++) plants.push(createPlant(param.random, i));
		const customers: CustomerDef[] = [];
		for (let i = 0; i < 80; i++) customers.push(createCustomer(param.random));
		let customerIndex = 0;

		const addScore = (v: number): void => {
			score += Math.round(v);
			g.game.vars.gameState.score = score; // 常に最新のスコアを入れておく
			setText(scoreLabel, String(score));
		};

		const popup = (text: string, font: g.Font, size: number, x: number, y: number, dur = 0.8): void => {
			const l = label(text, font, size, x, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.y = y - 50 * p;
				l.scaleX = l.scaleY = p < 0.15 ? 0.5 + p / 0.15 * 0.7 : 1.2 - Math.min(0.2, p - 0.15);
				l.opacity = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const bigText = (text: string, font: g.Font, size: number, dur: number, y = 360): void => {
			const l = label(text, font, size, 640, y, fxLayer, "center");
			l.anchorY = 0.5;
			animate(dur, (p) => {
				l.scaleX = l.scaleY = p < 0.12 ? 2 - p / 0.12 : 1;
				l.opacity = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
				l.modified();
			}, () => l.destroy());
		};
		const shake = (target: g.E, power: number): void => {
			animate(0.3, (p) => {
				target.x = (1 - p) * power * (cosmeticRandom.generate() - 0.5) * 2;
				target.y = (1 - p) * power * (cosmeticRandom.generate() - 0.5) * 2;
				target.modified();
			}, () => {
				target.x = target.y = 0;
				target.modified();
			});
		};

		const stockText = (): string => {
			let gold = 0, big = 0, small = 0;
			stock.forEach((k) => {
				if (k === "imo_gold") gold++;
				else if (k === "imo_big") big++;
				else small++;
			});
			return "金" + gold + " 大" + big + " ふつう" + small;
		};

		// ================= 前半: いもほり =================
		const clearItems = (): void => {
			liveItems.forEach((it) => {
				if (!it.sprite.destroyed()) it.sprite.destroy();
			});
			liveItems = [];
			rootLine.height = 0;
			rootLine.modified();
			setText(remainLabel, "");
		};

		const layoutRoot = (): void => {
			const bottom = GY + plant.length - progress;
			rootLine.y = GY;
			rootLine.height = Math.max(0, bottom - GY);
			const danger = strain > 75;
			rootLine.cssColor = danger ? "#ff8a7a" : "#e6c79a";
			rootLine.width = danger ? 7 : 10;
			rootLine.x = ROOT_X - rootLine.width / 2 + (danger ? (cosmeticRandom.generate() - 0.5) * 6 : 0);
			rootLine.modified();
			let remain = 0;
			for (let i = 0; i < liveItems.length; i++) {
				const it = liveItems[i];
				if (it.done) continue;
				it.sprite.y = GY + it.def.depth - progress;
				const jitter = danger ? (cosmeticRandom.generate() - 0.5) * 4 : 0;
				it.sprite.x = ROOT_X + it.def.side * (it.def.kind === "imo_big" ? 52 : 40) + jitter;
				it.sprite.modified();
				if (it.def.kind !== "rock") remain++;
			}
			setText(remainLabel, plantActive ? "のこり " + remain + "こ" : "");
		};

		const spawnPlant = (def: PlantDef): void => {
			clearItems();
			plant = def;
			progress = 0;
			strain = 0;
			slowTimer = 0;
			ippon = true;
			plantActive = true;
			liveItems = def.items.map((d) => {
				const sprite = new g.Sprite({
					scene, src: img(d.kind), anchorX: 0.5, anchorY: 0.5,
					x: ROOT_X + d.side * (d.kind === "imo_big" ? 52 : 40), y: GY + d.depth
				});
				sprite.angle = d.side * -20;
				itemLayer.append(sprite);
				return { def: d, sprite, done: false };
			});
			animate(0.25, (p) => {
				vine.scaleX = vine.scaleY = p;
				vine.modified();
			});
			const s = def.stiffness;
			setText(stiffLabel, def.isGold ? "金のつる!!" : s > 1.25 ? "かったい!" : s > 1.05 ? "かため" : "ふつう");
			if (def.isGold) {
				se("gold");
				popup("金のつる!! ぜんぶ金のいも!", fontYellow, 44, 640, 160, 1.4);
			}
			layoutRoot();
		};
		const nextPlant = (): void => spawnPlant(plants[plantIndex++ % plants.length]);

		const bounceBasket = (): void => {
			animate(0.2, (p) => {
				basket.scaleX = 1 + Math.sin(p * Math.PI) * 0.12;
				basket.scaleY = 1 - Math.sin(p * Math.PI) * 0.08;
				basket.modified();
			});
		};
		const handPos = (i: number): { x: number; y: number } => ({
			x: HAND_X + ((i % 4) - 1.5) * 38,
			y: HAND_Y - Math.floor(i / 4) * 26
		});
		const updateHandLabel = (): void => {
			const k = hand.length;
			setText(handLabel, k > 0 ? "手もと " + k + "こ" : "");
			handLabel.scaleX = handLabel.scaleY = 1 + Math.min(k, 8) * 0.06;
			handLabel.modified();
			const next = k + 1 >= UPGRADE_CHAIN ? "つぎのいもは ランクアップ!" : "あと" + (UPGRADE_CHAIN - 1 - k) + "こで ランクアップ";
			setText(nextLabel, k > 0 ? next : "");
		};
		// いもをかごに入れる(後半で売る在庫になる)
		const addStock = (kind: ImoKind, sprite: g.Sprite, delay: number): void => {
			stock.push(kind);
			addScore(DIG_SCORE[kind]);
			const sx = sprite.x, sy = sprite.y;
			const ex = BASKET_X + (cosmeticRandom.generate() - 0.5) * 60, ey = BASKET_Y + 20;
			if (sprite.parent !== fxLayer) {
				sprite.remove();
				fxLayer.append(sprite);
			}
			animate(0.45 + delay, (p) => {
				const q = Math.max(0, (p * (0.45 + delay) - delay) / 0.45);
				sprite.x = sx + (ex - sx) * q;
				sprite.y = sy + (ey - sy) * q - Math.sin(q * Math.PI) * 120;
				sprite.modified();
			}, () => {
				sprite.destroy();
				setText(basketCount, stock.length + "こ");
				bounceBasket();
			});
		};
		// 指をはなしたら手もとのいもが確定
		const bankHand = (): void => {
			if (hand.length === 0) return;
			se("bank");
			const many = hand.length >= UPGRADE_CHAIN;
			popup("ゲット! " + hand.length + "こ", many ? fontYellow : fontPink, many ? 50 : 40, HAND_X, 140, 1.0);
			hand.forEach((h, i) => {
				h.state = "gone";
				addStock(h.kind, h.sprite, i * 0.03);
			});
			hand = [];
			updateHandLabel();
		};
		// ブチッと切れたら手もとのいもはパー
		const loseHand = (): void => {
			if (hand.length === 0) return;
			se("lose");
			popup("パー… " + hand.length + "こ", fontRed, 48, HAND_X, 150, 1.4);
			hand.forEach((h) => {
				h.state = "gone";
				const sp = h.sprite;
				const vx = (cosmeticRandom.generate() - 0.5) * 300;
				let vy = -200 - cosmeticRandom.generate() * 200;
				animate(1.0, (p) => {
					vy += 900 * dt;
					sp.x += vx * dt;
					sp.y += vy * dt;
					sp.angle += 12;
					sp.opacity = 1 - p;
					sp.modified();
				}, () => sp.destroy());
			});
			hand = [];
			updateHandLabel();
		};

		const harvestItem = (it: LiveItem): void => {
			it.done = true;
			if (it.def.kind === "rock") {
				strain += ROCK_SPIKE;
				slowTimer = 0.35;
				se("rock_se");
				shake(worldLayer, 10);
				popup("ガッ!", fontRed, 48, ROOT_X - 70, GY - 30);
				const sp = it.sprite;
				const sx = sp.x, sy = sp.y;
				const dir = cosmeticRandom.generate() < 0.5 ? -1 : 1;
				animate(0.6, (p) => {
					sp.x = sx + dir * 260 * p;
					sp.y = sy - Math.sin(p * Math.PI) * 120 + p * 40;
					sp.opacity = 1 - p;
					sp.modified();
				}, () => sp.destroy());
				return;
			}
			// 1回の長押しで続けて抜くと、いもがランクアップ
			const k = hand.length + 1;
			let kind = it.def.kind as ImoKind;
			const upgraded = k >= UPGRADE_CHAIN && kind !== "imo_gold";
			if (upgraded) {
				kind = UPGRADE[kind];
				stats.upgrade++;
				setImage(it.sprite, img(kind));
			}
			stats.imo++;
			if (kind === "imo_gold") stats.gold++;
			stats.maxChain = Math.max(stats.maxChain, k);
			se("pop" + Math.min(k, 8));
			if (kind === "imo_gold") se("gold");
			const name = kind === "imo_gold" ? "金のいも!" : kind === "imo_big" ? "大きいいも!" : "";
			if (upgraded) popup("ランクアップ! " + name, fontYellow, 34 + Math.min(k, 8) * 2, ROOT_X + 110, GY - 40);
			else if (name) popup(name, fontYellow, 34, ROOT_X + 110, GY - 40);
			const sp = it.sprite;
			const entry: HandItem = { sprite: sp, kind, state: "flying" };
			const target = handPos(hand.length);
			hand.push(entry);
			updateHandLabel();
			const sx = sp.x, sy = sp.y;
			sp.remove();
			fxLayer.append(sp);
			animate(0.3, (p) => {
				if (entry.state !== "flying") return;
				sp.x = sx + (target.x - sx) * p;
				sp.y = sy + (target.y - sy) * p - Math.sin(p * Math.PI) * 140;
				sp.angle = 360 * p;
				sp.scaleX = sp.scaleY = 1 - p * 0.35;
				sp.modified();
			}, () => {
				if (entry.state === "flying") entry.state = "hand";
			});
		};

		// おまけのいもを空からかごへ
		const bonusImo = (kind: ImoKind, text: string): void => {
			const sp = new g.Sprite({ scene, src: img(kind), x: 640, y: 200, anchorX: 0.5, anchorY: 0.5 });
			fxLayer.append(sp);
			popup(text, fontYellow, 40, 640, 200, 1.2);
			addStock(kind, sp, 0.3);
		};

		const fullHarvest = (): void => {
			plantActive = false;
			bankHand();
			se("harvest");
			if (ippon) {
				stats.ippon++;
				bonusImo("imo_gold", "一本釣り!! おまけ 金のいも");
			} else {
				bonusImo("imo_big", "まるごと! おまけ 大きいいも");
			}
			strain = 0;
			const harvested = plant;
			animate(0.2, (p) => {
				vine.y = GY + 8 - p * 120;
				vine.opacity = 1 - p;
				vine.modified();
			}, () => {
				vine.y = GY + 8;
				vine.opacity = 1;
				vine.modified();
				if (phase === "dig" && plant === harvested && !plantActive) nextPlant();
			});
		};

		const snapPlant = (): void => {
			plantActive = false;
			stats.snap++;
			loseHand();
			strain = 0;
			stun = STUN_SEC;
			se("snap_se");
			shake(worldLayer, 18);
			setPose("fall");
			const snapSprite = new g.Sprite({ scene, src: img("snap"), x: ROOT_X, y: GY - 20, anchorX: 0.5, anchorY: 0.5 });
			fxLayer.append(snapSprite);
			animate(0.9, (p) => {
				snapSprite.scaleX = snapSprite.scaleY = p < 0.1 ? 0.5 + p * 6 : 1.1;
				snapSprite.opacity = p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1;
				snapSprite.modified();
			}, () => snapSprite.destroy());
			popup("いもが土にかえった…", fontWhite, 30, ROOT_X, GY + 70, 1.2);
			const startProgress = progress;
			const snapped = plant;
			animate(0.6, (p) => {
				if (plant !== snapped) return;
				progress = startProgress - p * 400;
				layoutRoot();
			}, () => {
				if (plant === snapped) clearItems();
			});
			vine.opacity = 0.3;
			vine.modified();
		};

		// ================= 後半: やきいも屋台 =================
		let bakeKind: ImoKind | null = null;
		let bakeT = 0; // 焼きはじめてからの時間
		let bakeP = 0; // 焼き加減(0〜1)
		let cust: CustomerDef = customers[0];
		let burstTimer = 0; // くま: 強火の残り時間
		let pauseTimer = 0; // うさぎ: 止まっている残り時間
		let eventDone = false;
		let regular = 0; // 常連さん(うまく焼けた連続回数)
		let fever = false;
		let nextBakeTimer = 0;
		let steamTimer = 0;
		const regularMult = (): number => Math.min(2, 1 + regular * 0.2); // 常連さんは最大×2

		const zoneAt = (p: number): Zone => {
			for (let i = 0; i < ZONES.length; i++) {
				if (p < ZONES[i].to) return ZONES[i];
			}
			return ZONES[ZONES.length - 1];
		};
		const setOvenImage = (id: string): void => setImage(ovenImo, img(id));
		const nextCustomer = (): void => {
			cust = customers[customerIndex++ % customers.length];
			const info = CUSTOMER_INFO[cust.type];
			setImage(customer, img(info.image));
			setText(customerName, info.name);
			setText(customerHint, info.hint);
			animate(0.25, (p) => {
				customer.x = CUSTOMER_X + 300 * (1 - p);
				customer.modified();
			});
		};
		// お客さんごとの針の速さ
		const needleSpeed = (kind: ImoKind): number => {
			let v = cust.base;
			if (cust.type === "kuma") {
				if (!eventDone && bakeP >= cust.at) {
					eventDone = true;
					burstTimer = 0.16;
					se("rock_se");
					popup("ボッ! 強火!", fontRed, 40, OVEN_X, OVEN_Y - 110, 0.7);
				}
				if (burstTimer > 0) {
					burstTimer -= dt;
					v *= 5;
				}
			} else if (cust.type === "usagi") {
				if (!eventDone && bakeP >= cust.at) {
					eventDone = true;
					pauseTimer = cust.pause;
				}
				if (pauseTimer > 0) {
					pauseTimer -= dt;
					v = 0;
				} else if (eventDone) {
					v *= 1.4;
				}
			} else {
				v = cust.base * (1 + 0.85 * Math.sin(Math.PI * 2 * cust.freq * bakeT + cust.phase));
				v = Math.max(0.1, v);
			}
			return v * KIND_SPEED[kind];
		};
		const loadBake = (): void => {
			if (stock.length === 0) {
				bakeKind = null;
				ovenImo.hide();
				setText(wantLabel, "");
				setText(tapHint, "");
				setText(customerName, "");
				setText(customerHint, "");
				if (!stats.soldOut) {
					stats.soldOut = true;
					const bonus = SELLOUT_BONUS + Math.floor(phaseLeft) * 100;
					addScore(bonus);
					se("harvest");
					bigText("完売!! +" + bonus, fontYellow, 80, 1.6, 300);
				}
				return;
			}
			bakeKind = stock.shift()!;
			bakeT = 0;
			bakeP = 0;
			burstTimer = 0;
			pauseTimer = 0;
			eventDone = false;
			ovenImo.show();
			ovenImo.x = OVEN_X;
			ovenImo.y = OVEN_Y;
			ovenImo.scaleX = ovenImo.scaleY = 1.4;
			ovenImo.modified();
			setOvenImage(bakeKind);
			setText(stockLabel, "のこり " + stockText());
			setText(wantLabel, bakeKind === "imo_gold" ? "金のいも ください!" : "ほくほく ください!");
		};
		const takeOut = (): void => {
			if (!bakeKind) return;
			const zone = zoneAt(bakeP);
			const kind = bakeKind;
			bakeKind = null;
			let price = 0;
			if (zone.mult >= 2) {
				regular++;
				stats.maxRegular = Math.max(stats.maxRegular, regular);
				if (zone.mult >= 3) stats.perfect++;
				price = SELL_PRICE[kind] * zone.mult * regularMult() * (fever ? 2 : 1);
				se(zone.mult >= 3 ? "perfect" : "good");
				se("bank");
				const top = zone.mult >= 3;
				const text = (top ? "極上〜!! " : "うまい! ") + "+" + Math.round(price);
				popup(text, top ? fontYellow : fontPink, top ? 52 : 42, SALE_X, SALE_Y, 1.0);
			} else {
				regular = 0;
				price = SELL_PRICE[kind] * zone.mult;
				se("bad");
				shake(stallLayer, 8);
				popup(zone.mult === 0 ? "こげてる… +0" : "なまだよ… +" + Math.round(price), fontRed, 40, SALE_X, SALE_Y, 1.0);
			}
			stats.sold++;
			if (price > 0) addScore(price);
			setText(regularLabel, regular > 0 ? "常連さん ×" + regularMult() : "");
			// お客さんに渡す
			const sx = ovenImo.x, sy = ovenImo.y;
			animate(0.3, (q) => {
				ovenImo.x = sx + (CUSTOMER_X - sx) * q;
				ovenImo.y = sy + (440 - sy) * q - Math.sin(q * Math.PI) * 120;
				ovenImo.scaleX = ovenImo.scaleY = 1.4 - q * 0.6;
				ovenImo.modified();
			}, () => {
				if (!bakeKind) ovenImo.hide();
			});
			nextBakeTimer = 0.35;
		};

		// ---- 入力 ----
		scene.onPointDownCapture.add((ev) => {
			pointers[ev.pointerId] = true;
			holding = true;
			if (phase === "stall") takeOut();
		});
		scene.onPointUpCapture.add((ev) => {
			delete pointers[ev.pointerId];
			holding = Object.keys(pointers).length > 0;
		});

		// ---- イントロ ----
		const introLayer = new g.E({ scene });
		fxLayer.append(introLayer);
		introLayer.append(new g.FilledRect({ scene, cssColor: "rgba(40,15,5,0.6)", width: 1280, height: 720 }));
		introLayer.append(new g.Sprite({ scene, src: img("logo"), x: 640, y: 135, anchorX: 0.5, anchorY: 0.5 }));
		// 5秒で読めるように、短く大きく
		[
			"前半：長押しで ひっこぬく！",
			"欲ばると ブチッ！",
			"後半：焼けたら タップ！"
		].forEach((t, i) => label(t, i === 1 ? fontRed : i === 2 ? fontPink : fontWhite, 52, 640, 270 + i * 76, introLayer, "center"));
		const countLabel = label("", fontYellow, 110, 640, 590, introLayer, "center");
		countLabel.anchorY = 0.5;
		let lastCount = -1;

		// ---- 切りかえ・結果 ----
		const switchPanel = new g.E({ scene });
		const startSwitch = (): void => {
			bankHand();
			phase = "switch";
			phaseLeft = SWITCH_SEC;
			plantActive = false;
			holding = false;
			setPose("idle");
			[warnLabel, ipponLabel, remainLabel, stiffLabel, handLabel, nextLabel].forEach((l) => setText(l, ""));
			dangerFlash.opacity = 0;
			dangerFlash.modified();
			se("finish");
			fxLayer.append(switchPanel);
			switchPanel.append(new g.FilledRect({ scene, cssColor: "rgba(40,15,5,0.75)", width: 1280, height: 720 }));
			label("前半しゅうりょう!", fontYellow, 72, 640, 150, switchPanel, "center");
			label("かごの中: " + stock.length + "こ", fontWhite, 48, 640, 270, switchPanel, "center");
			label(stockText(), fontPink, 40, 640, 340, switchPanel, "center");
			label("後半は やきいも屋台! いいものから順に焼いて売るよ", fontWhite, 32, 640, 420, switchPanel, "center");
			label("くま:のんびり→急に強火 / うさぎ:一瞬止まる / きつね:緩急", fontPink, 28, 640, 464, switchPanel, "center");
			label("焼けたら タップ!", fontYellow, 56, 640, 520, switchPanel, "center");
		};
		const startStall = (): void => {
			switchPanel.destroy();
			phase = "stall";
			phaseLeft = stallTime;
			worldLayer.hide();
			gaugeLayer.hide();
			bgLayer.hide();
			stallLayer.show();
			setText(stageLabel, "後半 やきいも屋台");
			se("open");
			bigText("やきいも屋台 オープン!", fontYellow, 80, 1.0, 330);
			// 高く売れるいもから焼く
			stock.sort((a, b) => KIND_ORDER[a] - KIND_ORDER[b]);
			nextCustomer();
			loadBake();
		};

		const showResult = (): void => {
			se("result");
			const panel = new g.E({ scene, x: 640, y: 380, anchorX: 0.5, anchorY: 0.5, width: 760, height: 520 });
			fxLayer.append(panel);
			panel.append(new g.FilledRect({ scene, cssColor: "#3a1a0a", x: -6, y: -6, width: 772, height: 532 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#fff4dc", width: 760, height: 520 }));
			panel.append(new g.FilledRect({ scene, cssColor: "#c2326f", width: 760, height: 80 }));
			label("きょうの売り上げ", fontWhite, 48, 380, 12, panel, "center");
			label(score + " 点", fontPink, 96, 380, 96, panel, "center");
			const title = score >= 45000 ? "いもの神さま"
				: score >= 32000 ? "伝説のやきいも屋"
					: score >= 20000 ? "やきいも名人"
						: score >= 10000 ? "やきいも職人" : "やきいも見習い";
			label("称号: " + title, fontYellow, 44, 380, 206, panel, "center");
			const best = "最大常連 ×" + Math.min(2, 1 + stats.maxRegular * 0.2);
			[
				"前半: とれたいも " + stats.imo + "こ(金 " + stats.gold + " / ランクアップ " + stats.upgrade + ")",
				"ブチッ " + stats.snap + "回  最大れんぞくぬき " + stats.maxChain + "こ",
				"後半: 売れたいも " + stats.sold + "こ(極上 " + stats.perfect + "回)",
				(stats.soldOut ? "完売!!  " : "売れ残り " + stock.length + "こ  ") + best
			].forEach((t, i) => label(t, fontWhite, 30, 380, 280 + i * 52, panel, "center"));
			animate(0.35, (p) => {
				panel.scaleX = panel.scaleY = 0.6 + 0.4 * (1 - Math.pow(1 - p, 3));
				panel.modified();
			});
		};

		const finishPlay = (): void => {
			phase = "result";
			bakeKind = null;
			setText(tapHint, "");
			setText(wantLabel, "");
			setText(customerName, "");
			setText(customerHint, "");
			// 売れ残りは安売り
			if (stock.length > 0) addScore(stock.length * LEFTOVER_PRICE);
			se("finish");
			bigText("閉店〜!", fontYellow, 100, 1.5, 330);
			scene.setTimeout(showResult, 1600);
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
			if (phase === "intro" || phase === "dig") {
				leafTimer += dt;
				if (leafTimer > 0.45) {
					leafTimer = 0;
					spawnLeaf();
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
					phase = "dig";
					introLayer.destroy();
					se("go");
					bigText("前半 いもほり スタート!", fontYellow, 90, 0.9);
					setText(stageLabel, "前半 いもほり");
					bgm.play().changeVolume(0.45);
					nextPlant();
				}
				setText(timeLabel, "のこり " + Math.ceil(phaseLeft) + "秒");
				return;
			}
			if (phase === "switch") {
				phaseLeft -= dt;
				if (phaseLeft <= 0) startStall();
				return;
			}
			if (phase === "stall") {
				phaseLeft -= dt;
				setText(timeLabel, "のこり " + Math.max(0, Math.ceil(phaseLeft)) + "秒");
				if (!fever && phaseLeft <= FEVER_SEC) {
					fever = true;
					se("last");
					bigText("閉店まぎわの大行列!! 値段2倍", fontYellow, 64, 1.4, 300);
					setText(stageLabel, "大行列! 値段×2");
				}
				if (phaseLeft <= 5) {
					timeLabel.opacity = Math.floor(phaseLeft * 4) % 2 === 0 ? 1 : 0.5;
					timeLabel.modified();
				}
				if (phaseLeft <= 0) {
					finishPlay();
					return;
				}
				if (bakeKind) {
					bakeP += needleSpeed(bakeKind) * dt;
					bakeT += dt;
					const p = bakeP;
					needle.x = METER_X + Math.min(1, p) * METER_W - 4;
					needleShadow.x = needle.x - 3;
					needle.modified();
					needleShadow.modified();
					const baked = bakeKind === "imo_gold" ? "imo_gold" : "imo_yaki";
					setOvenImage(p >= 0.76 ? "imo_burnt" : p >= 0.42 ? baked : bakeKind);
					ovenImo.angle = Math.sin(g.game.age / 2) * (p > 0.6 ? 6 : 2);
					ovenImo.modified();
					tapHint.opacity = 0.6 + 0.4 * Math.abs(Math.sin(g.game.age / 4));
					tapHint.modified();
					steamTimer -= dt;
					if (steamTimer <= 0 && p > 0.3) {
						steamTimer = 0.12;
						const puff = new g.FilledRect({
							scene, cssColor: p >= 0.76 ? "#3a3a3a" : "#ffffff", width: 14, height: 14, anchorX: 0.5, anchorY: 0.5,
							x: OVEN_X + (cosmeticRandom.generate() - 0.5) * 60, y: OVEN_Y - 30, opacity: 0.6
						});
						stallLayer.append(puff);
						animate(0.8, (q) => {
							puff.y -= 70 * dt;
							puff.scaleX = puff.scaleY = 1 + q * 2;
							puff.opacity = 0.6 * (1 - q);
							puff.modified();
						}, () => puff.destroy());
					}
					if (p >= 1) takeOut(); // 放っておくと こげて売れない
				} else if (nextBakeTimer > 0) {
					nextBakeTimer -= dt;
					if (nextBakeTimer <= 0) {
						if (stock.length > 0) nextCustomer();
						loadBake();
					}
				}
				return;
			}
			if (phase !== "dig") return;

			// ---- 前半 ----
			phaseLeft -= dt;
			setText(timeLabel, "のこり " + Math.max(0, Math.ceil(phaseLeft)) + "秒");
			if (phaseLeft <= 0) {
				startSwitch();
				return;
			}
			if (stun > 0) {
				stun -= dt;
				if (stun <= 0) {
					setPose("idle");
					vine.opacity = 1;
					vine.modified();
					nextPlant();
				}
			} else if (plantActive) {
				if (holding) {
					const speed = PULL_SPEED * (slowTimer > 0 ? 0.35 : 1);
					progress = Math.min(plant.length, progress + speed * dt);
					strain += STRAIN_UP * plant.stiffness * dt;
					setPose("pull");
					creakTimer -= dt;
					if (strain > 70 && creakTimer <= 0) {
						se("creak");
						creakTimer = 0.3;
					}
				} else {
					if (progress > 0) ippon = false;
					if (wasHolding) bankHand();
					strain = Math.max(0, strain - STRAIN_DOWN * dt);
					setPose("idle");
				}
				if (slowTimer > 0) slowTimer -= dt;
				for (let i = 0; i < liveItems.length; i++) {
					const it = liveItems[i];
					if (!it.done && GY + it.def.depth - progress <= GY + 12) harvestItem(it);
				}
				if (strain >= 100) snapPlant();
				else if (progress >= plant.length) fullHarvest();
				else layoutRoot();
				const rockNear = liveItems.some((it) => !it.done && it.def.kind === "rock" && it.def.depth - progress < 90);
				setText(warnLabel, rockNear ? "石だ! ゆるめて!" : "");
				setText(ipponLabel, ippon && progress > 0 ? "一本釣りチャレンジ中!" : "");
			}
			if (!plantActive) {
				setText(warnLabel, "");
				setText(ipponLabel, "");
			}
			wasHolding = holding;

			// あぶないときのドキドキ
			const danger = holding && plantActive && strain > 72;
			dangerFlash.opacity = danger ? 0.08 + 0.1 * Math.abs(Math.sin(g.game.age / 3)) : 0;
			dangerFlash.modified();
			heartTimer -= dt;
			if (danger && heartTimer <= 0) {
				se("heart");
				heartTimer = strain > 88 ? 0.28 : 0.42;
			}
			const s = Math.min(100, strain);
			vine.scaleY = 1 + (holding && plantActive ? s / 100 * 0.35 : 0);
			vine.angle = holding && plantActive ? -8 - s / 10 : 0;
			vine.modified();
			tanuki.x = 590 - (holding && plantActive ? 10 + s / 5 : 0);
			tanuki.modified();
			gaugeFill.height = GAUGE_H * s / 100;
			gaugeFill.y = GAUGE_Y + GAUGE_H - gaugeFill.height;
			gaugeFill.cssColor = s > 75 ? "#e8412f" : s > 50 ? "#f2b632" : "#6cc04a";
			gaugeFill.modified();
		});
	});
	g.game.pushScene(scene);
}
