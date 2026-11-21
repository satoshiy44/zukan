// このファイルは tools/make-data.js で作る。直すときは tools/data.js を直す
export interface Item {
	name: string; price: number; luck: number; chaos: number; mon: number; col: string;
}
export const MONSTER_NAMES: string[] = [
	"ヒノコン", "アワザラシ", "モコリーフ", "ピカモッチ", "ゴロガメ", "ペンヒョウ", "ハナジカ", "ヨルニャン", "ドラプチ", "キノピョン", "フワメェ", "ハチミツン", "タコリン",
	"ホシコウモリ", "ツキフクロ", "マグマゴン", "サンゴギョ", "キラハリー", "カゼツバメ", "キングモフ"
];
export const RARITY_NAMES: string[] = [
	"ノーマル", "ブロンズ", "シルバー", "ゴールド", "ホロ", "キラ", "ダブルキラ", "アート", "スーパー", "ウルトラ", "レインボー", "プリズム", "ミラクル", "レジェンド",
	"ミシック", "ファントム", "ギャラクシー", "ゴッド", "シークレット", "シークレットゴッド"
];
export const RARITY_SHORT: string[] = [
	"N", "B", "S", "G", "H", "K", "KK", "AR", "SR", "UR", "RB", "PR", "MR", "LG", "MY", "PH", "GX", "GD", "SC", "SG"
];
export const RARITY_WEIGHTS: number[] = [
	4200, 2600, 1600, 1000, 640, 420, 260, 160, 100, 62, 38, 24, 15, 9, 5.5, 3.4, 2, 1.1, 0.6, 0.22
];
export const RARITY_VALUES: number[] = [
	20, 60, 150, 300, 600, 1000, 1800, 3000, 5000, 8000, 13000, 19000, 27000, 40000, 60000, 90000, 140000, 230000,
	400000, 1200000
];
export const PACKS: Item[] = [
	{ name: "爆炎ヒノコンパック", price: 12500, luck: 0.3, chaos: 0.6, mon: 0, col: "#ff6a2a" },
	{ name: "深海アワザラシパック", price: 13000, luck: 0.3, chaos: 0.5, mon: 1, col: "#2a7ae8" },
	{ name: "森のモコリーフパック", price: 13000, luck: 0.25, chaos: 0.4, mon: 2, col: "#3ab85a" },
	{ name: "雷鳴ピカモッチパック", price: 13500, luck: 0.35, chaos: 0.8, mon: 3, col: "#ffc820" },
	{ name: "大地のゴロガメパック", price: 13000, luck: 0.3, chaos: 0.3, mon: 4, col: "#8a6a3a" },
	{ name: "氷結ペンヒョウパック", price: 15500, luck: 0.4, chaos: 0.6, mon: 5, col: "#5ac8f0" },
	{ name: "花園ハナジカパック", price: 13500, luck: 0.35, chaos: 0.5, mon: 6, col: "#ff7ac0" },
	{ name: "月夜のヨルニャンパック", price: 16000, luck: 0.5, chaos: 0.9, mon: 7, col: "#5a3aa8" },
	{ name: "竜王ドラプチパック", price: 20000, luck: 0.7, chaos: 0.7, mon: 8, col: "#c82a2a" },
	{ name: "ふしぎキノピョンパック", price: 14000, luck: 0.4, chaos: 1.4, mon: 9, col: "#9a5ae8" },
	{ name: "ふわふわフワメェパック", price: 14000, luck: 0.35, chaos: 0.6, mon: 10, col: "#7ab8ff" },
	{ name: "ハニーハチミツンパック", price: 16000, luck: 0.45, chaos: 0.8, mon: 11, col: "#f0a820" },
	{ name: "ぷにぷにタコリンパック", price: 14000, luck: 0.4, chaos: 1, mon: 12, col: "#ff6aa8" },
	{ name: "流星ホシコウモリパック", price: 17500, luck: 0.6, chaos: 1.1, mon: 13, col: "#3a4ac8" },
	{ name: "夜空のツキフクロパック", price: 19000, luck: 0.65, chaos: 0.9, mon: 14, col: "#2a2a6a" },
	{ name: "灼熱マグマゴンパック", price: 18500, luck: 0.7, chaos: 1.2, mon: 15, col: "#e83a1a" },
	{ name: "さんご礁サンゴギョパック", price: 17500, luck: 0.6, chaos: 0.8, mon: 16, col: "#20b0a8" },
	{ name: "結晶キラハリーパック", price: 21500, luck: 0.8, chaos: 1, mon: 17, col: "#a888ff" },
	{ name: "疾風カゼツバメパック", price: 18000, luck: 0.65, chaos: 0.9, mon: 18, col: "#30b868" },
	{ name: "王者キングモフパック", price: 23500, luck: 1, chaos: 0.8, mon: 19, col: "#d8a020" },
	{ name: "スターターパック", price: 9500, luck: 0, chaos: 0.3, mon: 0, col: "#5a8ae8" },
	{ name: "ブースターパック", price: 10500, luck: 0.15, chaos: 0.4, mon: 2, col: "#e85a7a" },
	{ name: "プレミアムパック", price: 22000, luck: 0.9, chaos: 0.6, mon: 8, col: "#1a1a2a" },
	{ name: "ハイクラスパック", price: 25000, luck: 1.05, chaos: 0.7, mon: 17, col: "#7a1a3a" },
	{ name: "ドリームパック", price: 22500, luck: 0.95, chaos: 1.3, mon: 10, col: "#ff8ad8" },
	{ name: "ゴールドパック", price: 26000, luck: 1.15, chaos: 0.9, mon: 19, col: "#e8b820" },
	{ name: "ギャンブルパック", price: 17000, luck: 0.5, chaos: 2.4, mon: 15, col: "#202020" },
	{ name: "ミステリーパック", price: 19500, luck: 0.75, chaos: 1.8, mon: 13, col: "#4a2a6a" },
	{ name: "レジェンドパック", price: 27500, luck: 1.25, chaos: 1, mon: 14, col: "#b88a20" },
	{ name: "神域のパック", price: 30500, luck: 1.4, chaos: 1.2, mon: 19, col: "#f0f0f0" },
];
export const BOXES: Item[] = [
	{ name: "はじめてBOX", price: 110000, luck: 0.3, chaos: 0.5, mon: 0, col: "#3a8ae8" },
	{ name: "モンスター大集合BOX", price: 128000, luck: 0.45, chaos: 0.6, mon: 10, col: "#3ab85a" },
	{ name: "爆アドBOX", price: 146000, luck: 0.6, chaos: 1.2, mon: 3, col: "#ff7a2a" },
	{ name: "深夜の闇BOX", price: 158000, luck: 0.55, chaos: 1.8, mon: 13, col: "#2a2a5a" },
	{ name: "ドラゴン王BOX", price: 176000, luck: 0.8, chaos: 0.9, mon: 8, col: "#c82a2a" },
	{ name: "クリスタルBOX", price: 198000, luck: 0.95, chaos: 1, mon: 17, col: "#9a7aff" },
	{ name: "一発逆転BOX", price: 214000, luck: 0.7, chaos: 2.6, mon: 15, col: "#1a1a1a" },
	{ name: "黄金キングBOX", price: 243000, luck: 1.25, chaos: 1.1, mon: 19, col: "#e8b020" },
];
