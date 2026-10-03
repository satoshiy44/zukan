// ころころ玉入れの紹介画像(1280x720)を作る
// 使い方: node tools/gen-promo-tamaire.js tools/promo-shots/tamaire.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const srcs = {
	shot: dataUrl(process.argv[2]),
	bg: dataUrl(path.join(ROOT, "tamaire/image/bg.png")),
	logo: dataUrl(path.join(ROOT, "tamaire/image/logo.png")),
	tanuki: dataUrl(path.join(ROOT, "tamaire/image/tanuki_pull.png")),
	kago: dataUrl(path.join(ROOT, "tamaire/image/kago.png")),
	medal: dataUrl(path.join(ROOT, "tamaire/image/peg_gold_lit.png"))
};

async function draw(srcs) {
	const imgs = {};
	await Promise.all(Object.entries(srcs).map(([k, s]) => new Promise((ok) => {
		const im = new Image();
		im.onload = () => { imgs[k] = im; ok(); };
		im.src = s;
	})));
	const W = 1280, H = 720;
	const c = document.createElement("canvas");
	c.width = W; c.height = H;
	const ctx = c.getContext("2d");
	const text = (t, x, y, size, fill, stroke, sw) => {
		ctx.font = "bold " + size + "px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		ctx.lineWidth = sw;
		ctx.strokeStyle = stroke;
		ctx.strokeText(t, x, y);
		ctx.fillStyle = fill;
		for (const [dx, dy] of [[0, 0], [1.5, 0], [0, 1.5]]) ctx.fillText(t, x + dx, y + dy);
	};
	ctx.drawImage(imgs.bg, 0, 0);
	ctx.fillStyle = "rgba(255,255,255,0.15)";
	ctx.fillRect(0, 0, W, H);
	// プレイ画面
	ctx.save();
	ctx.translate(640, 420);
	ctx.rotate(-0.025);
	const w = 820, h = w * 9 / 16;
	ctx.shadowColor = "rgba(0,0,0,0.45)";
	ctx.shadowBlur = 24;
	ctx.shadowOffsetY = 10;
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
	ctx.shadowColor = "transparent";
	ctx.drawImage(imgs.shot, -w / 2, -h / 2, w, h);
	ctx.restore();
	ctx.drawImage(imgs.logo, 640 - 390, -10, 780, 216);
	ctx.drawImage(imgs.tanuki, 0, 440, 260, 271);
	ctx.drawImage(imgs.kago, 1040, 520, 240, 180);
	ctx.drawImage(imgs.medal, 1080, 200, 110, 110);
	ctx.fillStyle = "rgba(13,42,90,0.75)";
	ctx.fillRect(0, 636, W, 84);
	text("ねらって、はねて、かごにイン！", 640, 678, 54, "#ffe14a", "#0d2a5a", 14);
	return c.toDataURL("image/png");
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const url = await page.evaluate(draw, srcs);
	await browser.close();
	const buf = Buffer.from(url.split(",")[1], "base64");
	fs.writeFileSync(path.join(ROOT, "dist/korokoro-tamaire_promo.png"), buf);
	console.log("wrote dist/korokoro-tamaire_promo.png", Math.round(buf.length / 1024) + "KB");
})();
