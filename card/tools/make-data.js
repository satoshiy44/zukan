// tools/data.js から src/data.ts を作る(ゲームが使う)
// 使い方: node tools/make-data.js のあと npx eslint src --fix (整形)
const fs = require("fs");
const path = require("path");
const d = require("./data.js");
const j = (v) => {
	// 長い配列は 1行140文字に収まるように折り返す
	const t = JSON.stringify(v);
	if (!Array.isArray(v) || t.length < 60) return t;
	const items = v.map((e) => JSON.stringify(e));
	const rows = [];
	let cur = "";
	items.forEach((it) => {
		if ((cur + it).length > 110) { rows.push(cur); cur = ""; }
		cur += (cur ? ", " : "") + it;
	});
	if (cur) rows.push(cur);
	return "[\n\t" + rows.join(",\n\t") + "\n]";
};
const lines = [
	"// このファイルは tools/make-data.js で作る。直すときは tools/data.js を直す",
	"export interface Item {", "\tname: string; price: number; luck: number; chaos: number; mon: number; col: string;", "}",
	"export const MONSTER_NAMES: string[] = " + j(d.MONSTERS.map((m) => m.name)) + ";",
	"export const RARITY_NAMES: string[] = " + j(d.RARITIES.map((r) => r[0])) + ";",
	"export const RARITY_SHORT: string[] = " + j(d.RARITIES.map((r) => r[1])) + ";",
	"export const RARITY_WEIGHTS: number[] = " + j(d.RARITIES.map((r) => r[2])) + ";",
	"export const RARITY_VALUES: number[] = " + j(d.RARITIES.map((r) => r[3])) + ";",
	"export const PACKS: Item[] = ["
].concat(d.PACKS.map((p) => "\t" + j(p) + ",")).concat(["];", "export const BOXES: Item[] = ["])
	.concat(d.BOXES.map((p) => "\t" + j(p) + ",")).concat(["];", ""]);
fs.writeFileSync(path.join(__dirname, "..", "src", "data.ts"), lines.join("\n").replace(/"(\w+)":/g, "$1: ").replace(/,(\w+): /g, ", $1: ").replace(/\{(\w+): /g, "{ $1: ").replace(/([^\t])\}/g, "$1 }").replace(/\[ \}/g, "[}"));
console.log("wrote src/data.ts");
