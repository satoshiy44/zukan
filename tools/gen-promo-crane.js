// クレーン取り放題の紹介画像(1280x720)を作る
// 使い方: node tools/gen-promo-crane.js tools/promo-shots/crane.png (アイコンも一緒に作る)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const srcs = {
	shot: dataUrl(process.argv[2]),
	bg: dataUrl(path.join(ROOT, "crane/image/bg.png")),
	logo: dataUrl(path.join(ROOT, "crane/image/logo.png")),
	tanuki: dataUrl(path.join(ROOT, "crane/image/p_lion.png")),
	kago: dataUrl(path.join(ROOT, "crane/image/p_unicorn.png")),
	medal: dataUrl(path.join(ROOT, "crane/image/p_gold.png"))
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
	ctx.drawImage(imgs.logo, 640 - 450, 6, 900, 194);
	ctx.drawImage(imgs.tanuki, 6, 420, 222, 212);
	ctx.drawImage(imgs.kago, 1085, 210, 180, 188);
	ctx.drawImage(imgs.medal, 1075, 425, 200, 207);
	ctx.fillStyle = "rgba(90,10,58,0.85)";
	ctx.fillRect(0, 636, W, 84);
	text("ぬいぐるみの山を 取りまくれ！", 640, 678, 54, "#ffe14a", "#5a0a3a", 14);
	return c.toDataURL("image/png");
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const url = await page.evaluate(draw, srcs);
	await browser.close();
	const buf = Buffer.from(url.split(",")[1], "base64");
	fs.writeFileSync(path.join(ROOT, "dist/crane-torihoudai_promo.png"), buf);
	console.log("wrote dist/crane-torihoudai_promo.png", Math.round(buf.length / 1024) + "KB");
})();

// アイコン(320x320): アームがでかパンダをつかんでいる絵
async function drawIcon(srcs) {
	const imgs = {};
	await Promise.all(Object.entries(srcs).map(([k, s]) => new Promise((ok) => {
		const im = new Image();
		im.onload = () => { imgs[k] = im; ok(); };
		im.src = s;
	})));
	const S = 320;
	const c = document.createElement("canvas");
	c.width = c.height = S;
	const ctx = c.getContext("2d");
	const g = ctx.createLinearGradient(0, 0, 0, S);
	g.addColorStop(0, "#5a3ab0");
	g.addColorStop(1, "#ff6aa0");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, S, S);
	// ケーブルとアームの頭
	ctx.fillStyle = "#2a2f38";
	ctx.fillRect(S / 2 - 5, 0, 10, 70);
	ctx.drawImage(imgs.head, S / 2 - 66, 56, 132, 84);
	// ぬいぐるみ(パンダ)をアームではさむ
	ctx.drawImage(imgs.panda, S / 2 - 100, 118, 200, 200);
	// アームはパンダの顔の外側から、体をはさむ
	ctx.save();
	ctx.translate(S / 2 - 50, 126);
	ctx.rotate(0.55);
	ctx.drawImage(imgs.arm, -18, 0, 48, 150);
	ctx.restore();
	ctx.save();
	ctx.translate(S / 2 + 50, 126);
	ctx.scale(-1, 1);
	ctx.rotate(0.55);
	ctx.drawImage(imgs.arm, -18, 0, 48, 150);
	ctx.restore();
	// 文字
	const text = (t, x, y, size, fill, inner, outer) => {
		ctx.font = "bold " + size + "px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		ctx.lineWidth = size * 0.36;
		ctx.strokeStyle = outer;
		ctx.strokeText(t, x, y);
		ctx.lineWidth = size * 0.18;
		ctx.strokeStyle = inner;
		ctx.strokeText(t, x, y);
		ctx.fillStyle = fill;
		for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) ctx.fillText(t, x + dx - 1, y + dy - 1);
	};
	text("クレーン", S / 2, 40, 62, "#ffffff", "#e8407a", "#3a0c22");
	text("取り放題", S / 2, 282, 66, "#ffe14a", "#e8407a", "#3a0c22");
	return c.toDataURL("image/png");
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const url = await page.evaluate(drawIcon, {
		panda: dataUrl(path.join(ROOT, "crane/image/p_panda.png")),
		head: dataUrl(path.join(ROOT, "crane/image/claw_head.png")),
		arm: dataUrl(path.join(ROOT, "crane/image/claw_arm.png"))
	});
	await browser.close();
	const buf = Buffer.from(url.split(",")[1], "base64");
	for (const p of ["dist/crane-torihoudai_icon.png", "crane/submission/icon.png"]) fs.writeFileSync(path.join(ROOT, p), buf);
	console.log("wrote icon", Math.round(buf.length / 1024) + "KB");
})();
