// ひろってドライブの紹介画像(1280x720)とアイコン(320x320)を作る
// 使い方: node tools/gen-promo-race.js tools/promo-shots/race.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dataUrl = (p) => "data:image/" + (p.endsWith(".jpg") ? "jpeg" : "png") + ";base64," + fs.readFileSync(p).toString("base64");
const I = (n) => dataUrl(path.join(ROOT, "race/image/" + n + (n === "sky" ? ".jpg" : ".png")));
const shots = path.join(ROOT, "tools/promo-shots/");
const srcs = {
	shot: dataUrl(process.argv[2]), town: dataUrl(shots + "race_town.png"), hw: dataUrl(shots + "race_hw.png"), desert: dataUrl(shots + "race_desert.png"),
	logo: I("logo"), car: I("car_r"), coin: I("yen500"), gem: I("yen100"), y1: I("yen1"), y10: I("yen10"), sky: I("sky"), mountains: I("mountains")
};

async function draw(srcs) {
	const imgs = {};
	await Promise.all(Object.entries(srcs).map(([k, s]) => new Promise((ok) => {
		const im = new Image();
		im.onload = () => { imgs[k] = im; ok(); };
		im.src = s;
	})));
	const text = (ctx, t, x, y, size, fill, stroke) => {
		ctx.font = "bold " + size + "px IPAGothic";
		ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
		ctx.lineWidth = size * 0.25; ctx.strokeStyle = stroke; ctx.strokeText(t, x, y);
		ctx.fillStyle = fill; ctx.fillText(t, x, y);
	};
	// ---- 紹介画像 ----
	const c = document.createElement("canvas");
	c.width = 1280; c.height = 720;
	const x = c.getContext("2d");
	x.drawImage(imgs.shot, 0, 0, 1280, 720);
	const g = x.createLinearGradient(0, 0, 0, 300);
	g.addColorStop(0, "rgba(40,24,14,0.75)"); g.addColorStop(1, "rgba(40,24,14,0)");
	x.fillStyle = g; x.fillRect(0, 0, 1280, 300);
	x.drawImage(imgs.logo, 640 - 520, 10, 1040, 224);
	// エリアの小窓
	[["town", "まちなか"], ["hw", "こうそくどうろ"], ["desert", "さばく"]].forEach((q, k) => {
		const wx = 1000, wy = 250 + k * 128, ww = 250, wh = 141;
		x.save(); x.translate(wx, wy); x.rotate(-0.03 + k * 0.03);
		x.fillStyle = "#fff8e8"; x.fillRect(-6, -6, ww + 12, wh + 12);
		x.drawImage(imgs[q[0]], 0, 0, ww, wh);
		x.restore();
		text(x, q[1], wx + ww / 2, wy + 78, 30, "#ffe060", "#3b2616");
	});
	[[110, 330, 100, "coin"], [190, 450, 80, "gem"], [80, 520, 60, "y10"], [240, 330, 54, "y1"]].forEach((q) => x.drawImage(imgs[q[3]], q[0] - q[2] / 2, q[1] - q[2] / 2, q[2], q[2]));
	x.fillStyle = "rgba(40,24,14,0.8)"; x.fillRect(0, 640, 1280, 80);
	text(x, "1円から500円まで、お金をひろってドライブ!", 640, 680, 46, "#fff8e8", "#3b2616");
	const promo = c.toDataURL("image/png");
	// ---- アイコン ----
	const S = 320;
	const ic = document.createElement("canvas");
	ic.width = ic.height = S;
	const ix = ic.getContext("2d");
	ix.drawImage(imgs.sky, 0, 0, 1280, 340, -200, -40, 900, 240);
	ix.drawImage(imgs.mountains, 0, 0, 640, 170, -20, 70, 400, 106);
	ix.fillStyle = "#7ab85a"; ix.fillRect(0, 170, S, 150);
	ix.fillStyle = "#86807a";
	ix.beginPath(); ix.moveTo(140, 170); ix.lineTo(180, 170); ix.lineTo(330, 320); ix.lineTo(-10, 320); ix.fill();
	ix.fillStyle = "#d8403a";
	ix.beginPath(); ix.moveTo(140, 170); ix.lineTo(134, 170); ix.lineTo(-40, 320); ix.lineTo(-10, 320); ix.fill();
	ix.beginPath(); ix.moveTo(180, 170); ix.lineTo(186, 170); ix.lineTo(360, 320); ix.lineTo(330, 320); ix.fill();
	[[150, 188, 22, "y1"], [128, 210, 32, "y10"], [92, 246, 52, "coin"]].forEach((q) => ix.drawImage(imgs[q[3]], q[0] - q[2] / 2, q[1] - q[2] / 2, q[2], q[2]));
	ix.drawImage(imgs.car, 130, 214, 170, 111);
	text(ix, "ひろって", S / 2, 52, 60, "#ffe060", "#3b2616");
	text(ix, "ドライブ", S / 2, 116, 60, "#fff8e8", "#3b2616");
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
	save("dist/hirotte-drive_promo.png", out.promo);
	save("dist/hirotte-drive_icon.png", out.icon);
	save("race/submission/icon.png", out.icon);
})();
