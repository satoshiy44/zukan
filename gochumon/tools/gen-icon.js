// アイコン(320x320)を作る。紋章(クロッシュ)を大きく置き、下に題字の札をつける
// 使い方: node tools/gen-icon.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const emblem = "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "image", "emblem.png")).toString("base64");

async function draw(emblemSrc) {
	const em = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = emblemSrc; });
	const S = 320;
	const c = document.createElement("canvas");
	c.width = S; c.height = S;
	const x = c.getContext("2d");
	const round = (l, t, w, h, r) => {
		x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
		x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
	};
	// 背景: えんじ色 + 金ふちの丸
	x.fillStyle = "#6a1e24"; x.fillRect(0, 0, S, S);
	const bg = x.createRadialGradient(160, 130, 20, 160, 150, 170);
	bg.addColorStop(0, "#3e6e66"); bg.addColorStop(1, "#22403c");
	x.fillStyle = bg; x.beginPath(); x.arc(160, 160, 148, 0, Math.PI * 2); x.fill();
	x.strokeStyle = "#d8a84a"; x.lineWidth = 9; x.stroke();
	// 紋章
	const ew = 300, eh = em.height * ew / em.width;
	x.drawImage(em, (S - ew) / 2, 14, ew, eh);
	// リボンに「喫茶店」
	x.font = "bold 26px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
	x.fillStyle = "#6a1e24"; x.fillText("喫 茶 店", 160, 14 + eh * 0.765);
	// 題字の札
	x.fillStyle = "rgba(0,0,0,0.35)"; round(22, 222, 282, 78, 20); x.fill();
	x.fillStyle = "#5e2e16"; round(18, 216, 284, 78, 20); x.fill();
	x.fillStyle = "#fff6e2"; round(25, 223, 270, 64, 15); x.fill();
	x.font = "bold 54px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
	x.lineWidth = 8; x.strokeStyle = "#fffaf0"; x.strokeText("ご注文どぞ", 160, 257);
	x.fillStyle = "#9c1e2c"; x.fillText("ご注文どぞ", 160, 257);
	return c.toDataURL("image/png");
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const url = await p.evaluate(draw, emblem);
	await b.close();
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(url.split(",")[1], "base64"));
	console.log("wrote icon.png");
})();
