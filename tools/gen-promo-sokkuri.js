// そっくり絵合わせの紹介画像(1280x720)とアイコン(320x320)を作る
// 使い方: node tools/gen-promo-sokkuri.js tools/promo-shots/sokkuri.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const I = (n) => dataUrl(path.join(ROOT, "sokkuri/image/" + n + (n.indexOf("bg_") === 0 ? ".jpg" : ".png")));
const srcs = {
	shot: dataUrl(process.argv[2]), logo: I("logo"), frame: I("frame"), bg: I("bg_spring"),
	sakura: I("p_sakura"), sun: I("p_sun"), tulip: I("p_tulip_r"), butterfly: I("p_butterfly"),
	snowman: I("p_snowman"), usagi: I("p_usagi"), himawari: I("p_himawari_l"),
	frameS: I("frame_s"), circus: I("bg_circus"), clown: I("p_clown_a"), elephant: I("p_elephant"), starc: I("p_star_c")
};

async function draw(srcs) {
	const imgs = {};
	await Promise.all(Object.entries(srcs).map(([k, s]) => new Promise((ok) => {
		const im = new Image();
		im.onload = () => { imgs[k] = im; ok(); };
		im.src = s;
	})));
	const wood = (ctx, w, h) => {
		ctx.fillStyle = "#3a2c22";
		ctx.fillRect(0, 0, w, h);
		for (let y = 0; y < h; y += 36) { ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, y, w, 2); }
	};
	const text = (ctx, t, x, y, size, fill, stroke) => {
		ctx.font = "bold " + size + "px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		ctx.lineWidth = size * 0.25;
		ctx.strokeStyle = stroke;
		ctx.strokeText(t, x, y);
		ctx.fillStyle = fill;
		ctx.fillText(t, x, y);
	};
	// ---- 紹介画像 ----
	const c = document.createElement("canvas");
	c.width = 1280; c.height = 720;
	const ctx = c.getContext("2d");
	wood(ctx, 1280, 720);
	ctx.save();
	ctx.translate(640, 440);
	ctx.rotate(-0.02);
	const w = 820, h = w * 9 / 16;
	ctx.shadowColor = "rgba(0,0,0,0.5)";
	ctx.shadowBlur = 24;
	ctx.fillStyle = "#fff6e0";
	ctx.fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
	ctx.shadowColor = "transparent";
	ctx.drawImage(imgs.shot, -w / 2, -h / 2, w, h);
	ctx.restore();
	ctx.drawImage(imgs.logo, 640 - 430, -8, 860, 185);
	ctx.drawImage(imgs.sakura, 4, 300, 190, 190);
	ctx.drawImage(imgs.tulip, 150, 560, 60, 90);
	ctx.drawImage(imgs.snowman, 1110, 300, 120, 170);
	ctx.drawImage(imgs.usagi, 1100, 500, 130, 119);
	ctx.drawImage(imgs.sun, 40, 180, 110, 110);
	ctx.fillStyle = "rgba(40,28,20,0.9)";
	ctx.fillRect(0, 650, 1280, 70);
	text(ctx, "おてほんを見て、同じ場所に置けるかな？", 640, 686, 46, "#fff6e0", "#5a3a1a");
	const promo = c.toDataURL("image/png");
	// ---- アイコン: 左の「おてほん」と右の「自分の絵」を見くらべる ----
	const S = 320;
	const ic = document.createElement("canvas");
	ic.width = ic.height = S;
	const ix = ic.getContext("2d");
	wood(ix, S, S);
	const pic = (x, y, w, h, shift) => {
		const k = w / 640;
		ix.drawImage(imgs.circus, x, y, w, h);
		const put = (im, px, py, sc, dx, dy) => {
			const iw = im.width * k * sc, ih = im.height * k * sc;
			if (shift && (dx || dy)) {
				ix.globalAlpha = 0.4;
				ix.drawImage(im, x + px * k - iw / 2, y + py * k - ih / 2, iw, ih);
				ix.globalAlpha = 1;
			}
			ix.drawImage(im, x + (px + (shift ? dx : 0)) * k - iw / 2, y + (py + (shift ? dy : 0)) * k - ih / 2, iw, ih);
		};
		put(imgs.clown, 200, 300, 1.25, 0, 0);
		put(imgs.elephant, 440, 300, 1.25, 90, -50);
		put(imgs.starc, 330, 110, 1.25, 0, 0);
		ix.drawImage(imgs.frameS, x - 7, y - 7, w + 14, h + 14);
	};
	pic(16, 30, 132, 99, false);
	pic(172, 30, 132, 99, true);
	text(ix, "?", 160, 80, 34, "#f2d48a", "#5a3a1a");
	ix.font = "bold 18px IPAGothic";
	ix.textAlign = "center";
	ix.fillStyle = "#f2d48a";
	ix.fillText("おてほん", 82, 152);
	ix.fillText("じぶん", 238, 152);
	text(ix, "そっくり", S / 2, 210, 64, "#f2d48a", "#5a3a1a");
	text(ix, "絵合わせ", S / 2, 278, 56, "#fff6e0", "#5a3a1a");
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
	save("dist/sokkuri-eawase_promo.png", out.promo);
	save("dist/sokkuri-eawase_icon.png", out.icon);
	save("sokkuri/submission/icon.png", out.icon);
})();
