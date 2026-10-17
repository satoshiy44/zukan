// タイトルロゴ(900x250)を作る。どんな背景の上でも読めるよう、木の枠のクリーム色の看板に、えんじ色の太字で題字を書く
// 使い方: node tools/gen-logo.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const IMG = path.join(__dirname, "..", "image");
const emblem = "data:image/png;base64," + fs.readFileSync(path.join(IMG, "emblem.png")).toString("base64");

async function draw(emblemSrc) {
	const em = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = emblemSrc; });
	const c = document.createElement("canvas");
	c.width = 900; c.height = 250;
	const x = c.getContext("2d");
	const round = (l, t, w, h, r) => {
		x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
		x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
	};
	// 看板: 影 → 木の枠 → 金の線 → クリームの板
	x.fillStyle = "rgba(0,0,0,0.35)"; round(14, 30, 880, 210, 34); x.fill();
	const wood = x.createLinearGradient(0, 22, 0, 232);
	wood.addColorStop(0, "#8a4a26"); wood.addColorStop(0.5, "#5e2e16"); wood.addColorStop(1, "#3e1c0c");
	x.fillStyle = wood; round(8, 22, 880, 210, 34); x.fill();
	x.fillStyle = "#d8a84a"; round(20, 34, 856, 186, 26); x.fill();
	const paper = x.createLinearGradient(0, 40, 0, 214);
	paper.addColorStop(0, "#fffaf0"); paper.addColorStop(1, "#f4e2bc");
	x.fillStyle = paper; round(26, 40, 844, 174, 22); x.fill();
	// 左に紋章(クロッシュ)
	const eh = 236, ew = em.width * eh / em.height;
	x.drawImage(em, 6 - 30, 6, ew, eh);
	// 題字: こげ茶の影 + 白ふち + えんじ色
	const text = (t, cx, cy, size, fill) => {
		x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
		x.lineWidth = size * 0.26; x.strokeStyle = "#3a1810"; x.strokeText(t, cx + 3, cy + 5);
		x.lineWidth = size * 0.22; x.strokeStyle = "#fffaf0"; x.strokeText(t, cx, cy);
		x.fillStyle = fill; x.fillText(t, cx, cy);
	};
	const cx = 600;
	text("ご注文を", cx, 86, 72, "#7a1a26");
	text("どうぞ！", cx, 166, 104, "#9c1e2c");
	// 紋章のリボンに「喫茶店」
	x.font = "bold 34px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
	x.fillStyle = "#7a1a26"; x.fillText("喫 茶 店", 6 - 30 + ew / 2, 6 + eh * 0.765);
	// キラリ
	const star = (sx, sy, r) => {
		x.fillStyle = "#e8b440"; x.beginPath();
		for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.28 : r, a = k * Math.PI / 4 - Math.PI / 2; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
		x.fill();
	};
	star(846, 74, 16); star(820, 46, 9); star(356, 70, 11);
	return c.toDataURL("image/png");
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const url = await p.evaluate(draw, emblem);
	await b.close();
	fs.writeFileSync(path.join(IMG, "logo.png"), Buffer.from(url.split(",")[1], "base64"));
	console.log("wrote logo.png");
})();
