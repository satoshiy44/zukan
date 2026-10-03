// ぬいぐるみ合体パズルの紹介画像(1280x720)とアイコン(320x320)を作る
// 使い方: node tools/gen-promo-gattai.js tools/promo-shots/gattai.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const srcs = {
	shot: dataUrl(process.argv[2]),
	bg: dataUrl(path.join(ROOT, "gattai/image/bg.png")),
	logo: dataUrl(path.join(ROOT, "gattai/image/logo.png"))
};
for (let i = 1; i <= 9; i++) srcs["lv" + i] = dataUrl(path.join(ROOT, "gattai/image/lv" + i + ".png"));

async function draw(srcs) {
	const imgs = {};
	await Promise.all(Object.entries(srcs).map(([k, s]) => new Promise((ok) => {
		const im = new Image();
		im.onload = () => { imgs[k] = im; ok(); };
		im.src = s;
	})));
	const text = (ctx, t, x, y, size, fill, inner, outer) => {
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
		for (const [dx, dy] of [[0, 0], [1.5, 0], [0, 1.5]]) ctx.fillText(t, x + dx, y + dy);
	};
	// ---- 紹介画像 ----
	const c = document.createElement("canvas");
	c.width = 1280; c.height = 720;
	const ctx = c.getContext("2d");
	ctx.drawImage(imgs.bg, 0, 0);
	ctx.fillStyle = "rgba(255,255,255,0.25)";
	ctx.fillRect(0, 0, 1280, 720);
	ctx.save();
	ctx.translate(640, 430);
	ctx.rotate(-0.025);
	const w = 800, h = w * 9 / 16;
	ctx.shadowColor = "rgba(60,30,90,0.4)";
	ctx.shadowBlur = 24;
	ctx.shadowOffsetY = 10;
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
	ctx.shadowColor = "transparent";
	ctx.drawImage(imgs.shot, -w / 2, -h / 2, w, h);
	ctx.restore();
	ctx.drawImage(imgs.logo, 640 - 450, 4, 900, 194);
	// 左: ひよこ3つ → 右: 金のくま
	[0, 1, 2].forEach((i) => ctx.drawImage(imgs.lv1, 18 + (i % 2) * 70, 250 + i * 95, 104, 104));
	text(ctx, "⇒", 1180, 300, 60, "#ffffff", "#ff6aa0", "#5a2a7a");
	ctx.drawImage(imgs.lv9, 1080, 380, 190, 190);
	ctx.fillStyle = "rgba(90,42,122,0.88)";
	ctx.fillRect(0, 636, 1280, 84);
	text(ctx, "3つそろえて しんか！ れんさで大量得点！", 640, 678, 50, "#ffe14a", "#ff6aa0", "#3a1a5a");
	const promo = c.toDataURL("image/png");
	// ---- アイコン ----
	const S = 320;
	const ic = document.createElement("canvas");
	ic.width = ic.height = S;
	const ix = ic.getContext("2d");
	const g = ix.createLinearGradient(0, 0, 0, S);
	g.addColorStop(0, "#ffd0e4");
	g.addColorStop(1, "#c8b8ff");
	ix.fillStyle = g;
	ix.fillRect(0, 0, S, S);
	ix.drawImage(imgs.lv1, 10, 70, 96, 96);
	ix.drawImage(imgs.lv1, 112, 70, 96, 96);
	ix.drawImage(imgs.lv1, 214, 70, 96, 96);
	ix.drawImage(imgs.lv9, 90, 150, 140, 140);
	ix.font = "bold 44px IPAGothic";
	ix.textAlign = "center";
	ix.fillStyle = "#ff5a9a";
	ix.fillText("▼", S / 2, 150);
	text(ix, "ぬいぐるみ", S / 2, 40, 54, "#ffffff", "#ff6aa0", "#3a1a5a");
	text(ix, "合体", S / 2, 288, 62, "#ffe14a", "#ff6aa0", "#3a1a5a");
	return { promo, icon: ic.toDataURL("image/png") };
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const out = await page.evaluate(draw, srcs);
	await browser.close();
	const save = (p, url) => {
		const buf = Buffer.from(url.split(",")[1], "base64");
		fs.writeFileSync(path.join(ROOT, p), buf);
		console.log("wrote", p, Math.round(buf.length / 1024) + "KB");
	};
	save("dist/nuigurumi-gattai_promo.png", out.promo);
	save("dist/nuigurumi-gattai_icon.png", out.icon);
	save("gattai/submission/icon.png", out.icon);
})();
