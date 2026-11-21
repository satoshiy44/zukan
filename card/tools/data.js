// ゲームと絵づくりで共通のデータ。node tools/make-data.js で src/data.ts を作る
// モンスター20体(すべてオリジナル)。f は絵の部品
const MONSTERS = [
	{ name: "ヒノコン", col: "#ff8a3a", sub: "#ffe0a0", f: { ears: "pointy", tail: "flame", head: "flame" } },
	{ name: "アワザラシ", col: "#7ac8ff", sub: "#e8f6ff", f: { ears: "none", tail: "fish", extra: "bubbles", whisker: true } },
	{ name: "モコリーフ", col: "#f4ecd4", sub: "#8ad860", f: { ears: "long", head: "leaf", body: "wool" } },
	{ name: "ピカモッチ", col: "#ffd83a", sub: "#ff7a5a", f: { ears: "round", tail: "bolt", extra: "cheekbolt" } },
	{ name: "ゴロガメ", col: "#6ac07a", sub: "#a8885a", f: { ears: "none", extra: "shell", head: "rock" } },
	{ name: "ペンヒョウ", col: "#3a5aa8", sub: "#ffffff", f: { ears: "none", head: "crystal", belly: true, beak: true } },
	{ name: "ハナジカ", col: "#ffaac8", sub: "#ffffff", f: { ears: "long", head: "flowerantler" } },
	{ name: "ヨルニャン", col: "#7a5ac8", sub: "#ffe060", f: { ears: "pointy", tail: "fluffy", extra: "moonmark" } },
	{ name: "ドラプチ", col: "#ff5a5a", sub: "#ffd060", f: { ears: "none", head: "horns", wings: "dragon", tail: "dragon", belly: true } },
	{ name: "キノピョン", col: "#fff0dc", sub: "#ff5a6a", f: { ears: "none", head: "mushroom" } },
	{ name: "フワメェ", col: "#ffffff", sub: "#9ad0ff", f: { ears: "round", body: "cloud", head: "cloud" } },
	{ name: "ハチミツン", col: "#ffc83a", sub: "#3a2a30", f: { ears: "round", wings: "bee", extra: "stripes", head: "antenna" } },
	{ name: "タコリン", col: "#ff7ab0", sub: "#ffd0e4", f: { ears: "none", extra: "tentacles" } },
	{ name: "ホシコウモリ", col: "#3a3a7a", sub: "#ffe860", f: { ears: "pointy", wings: "bat", extra: "stars" } },
	{ name: "ツキフクロ", col: "#9a7ae0", sub: "#fff4c0", f: { ears: "tuft", wings: "bird", beak: true, extra: "moon" } },
	{ name: "マグマゴン", col: "#4a3a48", sub: "#ff7a20", f: { ears: "none", body: "rock", extra: "lava", head: "horns" } },
	{ name: "サンゴギョ", col: "#30c8c0", sub: "#ff8a8a", f: { ears: "fin", tail: "fish", head: "coral" } },
	{ name: "キラハリー", col: "#b8a0ff", sub: "#e8f8ff", f: { ears: "round", extra: "crystals" } },
	{ name: "カゼツバメ", col: "#40c870", sub: "#fff8e0", f: { ears: "none", wings: "bird", beak: true, tail: "swallow", head: "swirl" } },
	{ name: "キングモフ", col: "#ffe8a0", sub: "#ffb020", f: { ears: "round", head: "crown", tail: "fluffy", body: "wool", extra: "cape" } }
];
// レアリティ20段階: 名前・略号・出やすさ(重み)・基本の買取額
const RARITIES = [
	["ノーマル", "N", 4200, 20], ["ブロンズ", "B", 2600, 60], ["シルバー", "S", 1600, 150], ["ゴールド", "G", 1000, 300],
	["ホロ", "H", 640, 600], ["キラ", "K", 420, 1000], ["ダブルキラ", "KK", 260, 1800], ["アート", "AR", 160, 3000],
	["スーパー", "SR", 100, 5000], ["ウルトラ", "UR", 62, 8000], ["レインボー", "RB", 38, 13000], ["プリズム", "PR", 24, 19000],
	["ミラクル", "MR", 15, 27000], ["レジェンド", "LG", 9, 40000], ["ミシック", "MY", 5.5, 60000], ["ファントム", "PH", 3.4, 90000],
	["ギャラクシー", "GX", 2, 140000], ["ゴッド", "GD", 1.1, 230000], ["シークレット", "SC", 0.6, 400000],
	["シークレットゴッド", "SG", 0.22, 1200000]
];
// パック30種: 名前・価格・luck(高レアの出やすさ)・chaos(ふれはば)・モンスター
// [名前, モンスター, luck, chaos]
const PACK_LIST = [
	["爆炎ヒノコン", 0, 0.3, 0.6], ["深海アワザラシ", 1, 0.3, 0.5], ["森のモコリーフ", 2, 0.25, 0.4], ["雷鳴ピカモッチ", 3, 0.35, 0.8],
	["大地のゴロガメ", 4, 0.3, 0.3], ["氷結ペンヒョウ", 5, 0.4, 0.6], ["花園ハナジカ", 6, 0.35, 0.5], ["月夜のヨルニャン", 7, 0.5, 0.9],
	["竜王ドラプチ", 8, 0.7, 0.7], ["ふしぎキノピョン", 9, 0.4, 1.4], ["ふわふわフワメェ", 10, 0.35, 0.6], ["ハニーハチミツン", 11, 0.45, 0.8],
	["ぷにぷにタコリン", 12, 0.4, 1.0], ["流星ホシコウモリ", 13, 0.6, 1.1], ["夜空のツキフクロ", 14, 0.65, 0.9], ["灼熱マグマゴン", 15, 0.7, 1.2],
	["さんご礁サンゴギョ", 16, 0.6, 0.8], ["結晶キラハリー", 17, 0.8, 1.0], ["疾風カゼツバメ", 18, 0.65, 0.9], ["王者キングモフ", 19, 1.0, 0.8],
	["スターター", 0, 0.0, 0.3], ["ブースター", 2, 0.15, 0.4], ["プレミアム", 8, 0.9, 0.6], ["ハイクラス", 17, 1.05, 0.7],
	["ドリーム", 10, 0.95, 1.3], ["ゴールド", 19, 1.15, 0.9], ["ギャンブル", 15, 0.5, 2.4], ["ミステリー", 13, 0.75, 1.8],
	["レジェンド", 14, 1.25, 1.0], ["神域の", 19, 1.4, 1.2]
];
const PACK_COLS = [
	"#ff6a2a", "#2a7ae8", "#3ab85a", "#ffc820", "#8a6a3a", "#5ac8f0", "#ff7ac0", "#5a3aa8", "#c82a2a", "#9a5ae8",
	"#7ab8ff", "#f0a820", "#ff6aa8", "#3a4ac8", "#2a2a6a", "#e83a1a", "#20b0a8", "#a888ff", "#30b868", "#d8a020",
	"#5a8ae8", "#e85a7a", "#1a1a2a", "#7a1a3a", "#ff8ad8", "#e8b820", "#202020", "#4a2a6a", "#b88a20", "#f0f0f0"
];
const PACKS = PACK_LIST.map((t, i) => {
	const price = Math.round((8000 + (t[2] / 1.4) * 21000 + (i % 3) * 700) / 500) * 500;
	return { name: t[0] + "パック", price: Math.min(30500, price), luck: t[2], chaos: t[3], mon: t[1], col: PACK_COLS[i] };
});
// ボックス8種(1ボックス25枚)
const BOXES = [
	{ name: "はじめてBOX", price: 110000, luck: 0.3, chaos: 0.5, mon: 0, col: "#3a8ae8" },
	{ name: "モンスター大集合BOX", price: 128000, luck: 0.45, chaos: 0.6, mon: 10, col: "#3ab85a" },
	{ name: "爆アドBOX", price: 146000, luck: 0.6, chaos: 1.2, mon: 3, col: "#ff7a2a" },
	{ name: "深夜の闇BOX", price: 158000, luck: 0.55, chaos: 1.8, mon: 13, col: "#2a2a5a" },
	{ name: "ドラゴン王BOX", price: 176000, luck: 0.8, chaos: 0.9, mon: 8, col: "#c82a2a" },
	{ name: "クリスタルBOX", price: 198000, luck: 0.95, chaos: 1.0, mon: 17, col: "#9a7aff" },
	{ name: "一発逆転BOX", price: 214000, luck: 0.7, chaos: 2.6, mon: 15, col: "#1a1a1a" },
	{ name: "黄金キングBOX", price: 243000, luck: 1.25, chaos: 1.1, mon: 19, col: "#e8b020" }
];
module.exports = { MONSTERS, RARITIES, PACKS, BOXES };
