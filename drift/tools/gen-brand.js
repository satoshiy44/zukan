// アイコン(320x320)と紹介画像(1280x720)を作る
// 使い方: node tools/gen-brand.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const data = (p) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, p)).toString("base64");

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const imgs = {
		logo: data("image/logo.png"), kart: data("image/kart_cat_side.png"), aura: data("image/aura7.png"),
		warn: data("tools/promo-shot/c_drift2.png"), rainbow: data("tools/promo-shot/k_rainbow.png"), perfect: data("tools/promo-shot/c_wind.png"),
		faces: ["dog", "cat", "rabbit", "panda", "bear", "penguin", "fox", "pig", "frog", "chick"].map((a) => data("image/face_" + a + ".png"))
	};
	const res = await p.evaluate(async (I) => {
		const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
		const im = {};
		for (const k of Object.keys(I)) im[k] = Array.isArray(I[k]) ? await Promise.all(I[k].map(load)) : await load(I[k]);
		const OL = "#2a1840";
		const word = (x, t, cx, cy, size, c0, c1, rot) => {
			x.save(); x.translate(cx, cy); x.rotate(rot || 0);
			x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
			x.lineWidth = size * 0.32; x.strokeStyle = OL; x.strokeText(t, 3, 5); x.strokeText(t, 0, 0);
			x.lineWidth = size * 0.14; x.strokeStyle = "#ffffff"; x.strokeText(t, 0, 0);
			const g = x.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, c0); g.addColorStop(1, c1);
			x.fillStyle = g; x.fillText(t, 0, 0); x.restore();
		};
		const rainbow = (x, x0, y0, x1, y1, cxp, cyp, w) => {
			["#ff4040", "#ff9a30", "#ffe040", "#50e070", "#40b0ff", "#9a60ff"].forEach((col, i) => {
				x.strokeStyle = col; x.lineWidth = w; x.lineCap = "round"; x.beginPath();
				x.moveTo(x0, y0 - i * w * 0.95); x.quadraticCurveTo(cxp, cyp - i * w * 0.95, x1, y1 - i * w * 0.8); x.stroke();
			});
		};
		// ---- アイコン ----
		const ic = document.createElement("canvas"); ic.width = 320; ic.height = 320; const x = ic.getContext("2d");
		const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, "#3aa8ff"); g.addColorStop(1, "#bfefff"); x.fillStyle = g; x.fillRect(0, 0, 320, 320);
		x.fillStyle = "#6cc860"; x.beginPath(); x.ellipse(160, 360, 260, 120, 0, 0, Math.PI * 2); x.fill();
		rainbow(x, -20, 250, 210, 215, 90, 290, 13);
		x.globalAlpha = 0.85; x.drawImage(im.aura, 60, 80, 280, 200); x.globalAlpha = 1;
		x.save(); x.translate(200, 196); x.rotate(-0.12); x.drawImage(im.kart, -115, -110, 230, 220); x.restore();
		word(x, "ドリフト", 160, 52, 66, "#ffe860", "#ff8a20", -0.05);
		word(x, "いっぽん", 112, 120, 46, "#9ae8ff", "#3a8ae8", -0.05);
		const icon = ic.toDataURL("image/png");
		// ---- 紹介画像 ----
		const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const y = c.getContext("2d");
		const g2 = y.createLinearGradient(0, 0, 0, 720); g2.addColorStop(0, "#ffe6f4"); g2.addColorStop(1, "#d8f0ff"); y.fillStyle = g2; y.fillRect(0, 0, 1280, 720);
		for (let i = 0; i < 40; i++) { y.fillStyle = "rgba(255,255,255,0.7)"; y.beginPath(); y.arc((i * 137) % 1280, (i * 71) % 720, 10 + (i % 4) * 4, 0, Math.PI * 2); y.fill(); }
		y.drawImage(im.logo, 20, 0, 560, 213);
		y.font = "bold 34px IPAGothic"; y.textAlign = "left"; y.textBaseline = "middle"; y.lineJoin = "round";
		const txt = (t, tx, ty, size, col, st) => { y.font = "bold " + size + "px IPAGothic"; y.lineWidth = size * 0.28; y.strokeStyle = st || OL; y.strokeText(t, tx, ty); y.fillStyle = col; y.fillText(t, tx, ty); };
		txt("タップ・長押し・はなすだけ！", 620, 60, 44, "#ffffff");
		txt("コース3種類×ドライバー10種類がランダムで登場！", 620, 120, 28, "#ffe860");
		// 動物たち
		im.faces.forEach((f, i) => y.drawImage(f, 620 + i * 64, 150, 64, 64));
		const panel = (shot, n, title, sub, px, col) => {
			const w = 400, h = 225, py = 260;
			y.fillStyle = OL; y.beginPath(); y.roundRect(px - 8, py - 8, w + 16, h + 16, 18); y.fill();
			y.save(); y.beginPath(); y.roundRect(px, py, w, h, 12); y.clip(); y.drawImage(shot, px, py, w, h); y.restore();
			y.fillStyle = col; y.beginPath(); y.arc(px + 10, py + 6, 34, 0, Math.PI * 2); y.fill(); y.lineWidth = 6; y.strokeStyle = OL; y.stroke();
			y.textAlign = "center"; txt(String(n), px + 10, py + 8, 44, "#ffffff"); y.textAlign = "left";
			y.textAlign = "center";
			txt(title, px + w / 2, py + h + 52, 31, col);
			sub.forEach((s, i) => txt(s, px + w / 2, py + h + 104 + i * 44, 27, "#ffffff"));
			y.textAlign = "left";
		};
		panel(im.warn, 1, "タップ＆長押しでドリフト", ["ドリフトしているあいだだけ", "カーブを曲がれる！"], 24, "#40a8ff");
		panel(im.rainbow, 2, "ドレミファソラシド", ["カーブで長く続けるほど", "オーラが 白→…→虹 に！"], 440, "#ff70c8");
		panel(im.perfect, 3, "はなすと まっすぐ加速！", ["はなすタイミングで", "走るラインを決めよう"], 856, "#ffb020");
		return { icon, promo: c.toDataURL("image/png") };
	}, imgs);
	await b.close();
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(res.icon.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "promo.png"), Buffer.from(res.promo.split(",")[1], "base64"));
	console.log("wrote icon.png promo.png");
})();
