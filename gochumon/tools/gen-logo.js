// タイトルロゴ(900x250)を作る。紋章(image/emblem.png)を左に置き、題字を右に書く
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
	// 紋章
	const eh = 200, ew = em.width * eh / em.height;
	x.drawImage(em, 10, 20, ew, eh);
	// 紋章のリボンに「喫茶店」
	x.font = "bold 30px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
	x.fillStyle = "#6a1e24"; x.fillText("喫 茶 店", 10 + ew / 2, 20 + eh * 0.765);
	const tx = 575;
	const text = (t, y, size, g1, g2) => {
		x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
		x.lineWidth = size * 0.34; x.strokeStyle = "#3a1810"; x.strokeText(t, tx, y + 4);
		x.lineWidth = size * 0.3; x.strokeStyle = "#fff4d8"; x.strokeText(t, tx, y);
		x.lineWidth = size * 0.12; x.strokeStyle = "#6a1e24"; x.strokeText(t, tx, y);
		const g = x.createLinearGradient(0, y - size / 2, 0, y + size / 2);
		g.addColorStop(0, g1); g.addColorStop(0.55, g2); g.addColorStop(1, "#b8781e");
		x.fillStyle = g; x.fillText(t, tx, y);
		x.fillStyle = "rgba(255,255,255,0.35)"; x.fillRect(0, 0, 0, 0);
	};
	text("ご注文を", 70, 74, "#fff8e0", "#f0d890");
	text("どうぞ！", 162, 104, "#fff4c0", "#f2c048");
	// 飾り線とキラリ
	const line = (x0, x1, y) => {
		x.strokeStyle = "#c8962e"; x.lineWidth = 4; x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke();
		x.fillStyle = "#c8962e"; x.beginPath(); x.moveTo((x0 + x1) / 2, y - 9); x.lineTo((x0 + x1) / 2 + 9, y); x.lineTo((x0 + x1) / 2, y + 9); x.lineTo((x0 + x1) / 2 - 9, y); x.fill();
	};
	line(410, 790, 228);
	const star = (cx, cy, r) => {
		x.fillStyle = "#fff8d0"; x.beginPath();
		for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.25 : r, a = k * Math.PI / 4 - Math.PI / 2; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
		x.fill();
	};
	star(834, 120, 18); star(864, 92, 10); star(392, 46, 12);
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
