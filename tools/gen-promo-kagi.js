// 囲んで鍵探しの紹介画像(1280x720)とアイコン(320x320)を作る
// 使い方: node tools/gen-promo-kagi.js tools/promo-shots/kagi.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const srcs = {
	shot: dataUrl(process.argv[2]),
	bg: dataUrl(path.join(ROOT, "kagi/image/bg.png")),
	logo: dataUrl(path.join(ROOT, "kagi/image/logo.png")),
	key: dataUrl(path.join(ROOT, "kagi/image/key.png")),
	coin1: dataUrl(path.join(ROOT, "kagi/image/coin1.png")),
	coin2: dataUrl(path.join(ROOT, "kagi/image/coin2.png")),
	coin3: dataUrl(path.join(ROOT, "kagi/image/coin3.png"))
};

async function draw(srcs) {
	const imgs = {};
	await Promise.all(Object.entries(srcs).map(([k, s]) => new Promise((ok) => {
		const im = new Image();
		im.onload = () => { imgs[k] = im; ok(); };
		im.src = s;
	})));
	let seed = 7;
	const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
	// ---- 紹介画像 ----
	const c = document.createElement("canvas");
	c.width = 1280; c.height = 720;
	const ctx = c.getContext("2d");
	ctx.fillStyle = "#1a1d23";
	ctx.fillRect(0, 0, 1280, 720);
	ctx.save();
	ctx.translate(560, 440);
	const w = 820, h = w * 9 / 16;
	ctx.shadowColor = "rgba(0,0,0,0.6)";
	ctx.shadowBlur = 30;
	ctx.strokeStyle = "#8a7a52";
	ctx.lineWidth = 3;
	ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
	ctx.shadowColor = "transparent";
	ctx.drawImage(imgs.shot, -w / 2, -h / 2, w, h);
	ctx.restore();
	ctx.drawImage(imgs.logo, 640 - 420, 0, 840, 181);
	// 右に鍵
	ctx.save();
	ctx.shadowColor = "rgba(232,212,154,0.5)";
	ctx.shadowBlur = 40;
	ctx.drawImage(imgs.key, 1000, 300, 260, 260);
	ctx.restore();
	ctx.font = "bold 36px IPAGothic";
	ctx.textAlign = "center";
	ctx.fillStyle = "#e8e2d0";
	ctx.fillText("囲んで、しぼって、", 1110, 600);
	ctx.fillStyle = "#c9b06a";
	ctx.fillText("鍵をさがす。", 1110, 650);
	const promo = c.toDataURL("image/png");
	// ---- アイコン ----
	const S = 320;
	const ic = document.createElement("canvas");
	ic.width = ic.height = S;
	const ix = ic.getContext("2d");
	ix.fillStyle = "#14161b";
	ix.fillRect(0, 0, S, S);
	for (let i = 0; i < 1400; i++) {
		const im = [imgs.coin1, imgs.coin2, imgs.coin3][Math.floor(rnd() * 3)];
		ix.drawImage(im, rnd() * (S - 12), rnd() * (S - 12), 14, 14);
	}
	ix.fillStyle = "rgba(20,22,27,0.55)";
	ix.fillRect(0, 0, S, S);
	ix.lineWidth = 8;
	ix.strokeStyle = "#e8e2d0";
	ix.beginPath(); ix.ellipse(S / 2, S / 2 + 10, 110, 92, -0.2, 0.2, Math.PI * 2 - 0.1); ix.stroke();
	ix.drawImage(imgs.key, S / 2 - 70, S / 2 - 60, 140, 140);
	ix.font = "bold 66px IPAGothic";
	ix.textAlign = "center";
	ix.textBaseline = "middle";
	ix.lineJoin = "round";
	ix.lineWidth = 12;
	ix.strokeStyle = "#14161b";
	ix.strokeText("囲んで", S / 2, 42);
	ix.fillStyle = "#e8e2d0";
	ix.fillText("囲んで", S / 2, 42);
	ix.strokeText("鍵探し", S / 2, 282);
	ix.fillStyle = "#c9b06a";
	ix.fillText("鍵探し", S / 2, 282);
	// アイコンは100KB以内にするため JPEG にする
	return { promo, icon: ic.toDataURL("image/jpeg", 0.88) };
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
	save("dist/kakonde-kagisagashi_promo.png", out.promo);
	save("dist/kakonde-kagisagashi_icon.jpg", out.icon);
	save("kagi/submission/icon.jpg", out.icon);
})();
