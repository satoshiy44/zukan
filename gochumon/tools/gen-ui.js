// 星・吹き出しなど、評価システム用の画像を作る
// 使い方: node tools/gen-ui.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const IMG = path.join(__dirname, "..", "image");

function draw() {
	const out = {};
	const make = (name, w, h, fn) => {
		const c = document.createElement("canvas");
		c.width = w; c.height = h;
		fn(c.getContext("2d"), w, h);
		out[name] = c.toDataURL("image/png");
	};
	const starPath = (x, cx, cy, r) => {
		x.beginPath();
		for (let i = 0; i < 10; i++) {
			const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
			x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
		}
		x.closePath();
	};
	make("star", 52, 52, (x) => {
		starPath(x, 26, 28, 24);
		const g = x.createLinearGradient(0, 4, 0, 50);
		g.addColorStop(0, "#fff2a0"); g.addColorStop(0.5, "#f8c830"); g.addColorStop(1, "#e09a18");
		x.fillStyle = g; x.fill();
		x.lineWidth = 3; x.lineJoin = "round"; x.strokeStyle = "#5a3412"; x.stroke();
		x.fillStyle = "rgba(255,255,255,0.55)"; x.beginPath(); x.ellipse(21, 20, 4, 6, -0.5, 0, Math.PI * 2); x.fill();
	});
	make("star_off", 52, 52, (x) => {
		starPath(x, 26, 28, 24);
		x.fillStyle = "rgba(70,50,40,0.75)"; x.fill();
		x.lineWidth = 3; x.lineJoin = "round"; x.strokeStyle = "#c8a878"; x.stroke();
	});
	// 吹き出し(しっぽは左下、お客さんの頭へ)
	make("speech", 460, 180, (x) => {
		x.fillStyle = "#fffaf0"; x.strokeStyle = "#5a3412"; x.lineWidth = 5; x.lineJoin = "round";
		x.beginPath(); x.roundRect(6, 6, 448, 136, 30);
		x.moveTo(170, 140); x.lineTo(196, 176); x.lineTo(220, 140);
		x.fill(); x.stroke();
		x.fillStyle = "#fffaf0"; x.fillRect(172, 132, 46, 10);
		x.strokeStyle = "rgba(200,150,80,0.6)"; x.lineWidth = 2; x.beginPath(); x.roundRect(16, 16, 428, 116, 22); x.stroke();
	});
	return out;
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const imgs = await p.evaluate(draw);
	await b.close();
	for (const k of Object.keys(imgs)) fs.writeFileSync(path.join(IMG, k + ".png"), Buffer.from(imgs[k].split(",")[1], "base64"));
	console.log("wrote", Object.keys(imgs).join(", "));
})();
