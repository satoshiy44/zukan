// 画像アセット生成スクリプト: Chromium の canvas で描画して image/ 以下に PNG を書き出す
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");

function drawAll() {
	const out = {};
	const make = (name, w, h, fn) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		fn(c.getContext("2d"), w, h);
		out[name] = c.toDataURL("image/png");
	};
	const ellipse = (ctx, x, y, rx, ry, fill, stroke, lw) => {
		ctx.beginPath();
		ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
		if (fill) { ctx.fillStyle = fill; ctx.fill(); }
		if (stroke) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke; ctx.stroke(); }
	};
	const text = (ctx, t, x, y, size, fill, font) => {
		ctx.font = (font || "bold ") + size + "px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = fill;
		ctx.fillText(t, x, y);
	};

	// ---- 背景(落ち着いた濃いグレーと、静かな枠) ----
	make("bg", 1280, 720, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, "#23272f");
		g.addColorStop(1, "#1a1d23");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		// うっすら紙の目
		let seed = 3;
		const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
		for (let i = 0; i < 4000; i++) {
			ctx.fillStyle = "rgba(255,255,255," + (rnd() * 0.025) + ")";
			ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
		}
		// 盤の枠
		ctx.fillStyle = "#14161b";
		ctx.fillRect(52, 52, 616, 616);
		ctx.strokeStyle = "#8a7a52";
		ctx.lineWidth = 2;
		ctx.strokeRect(52, 52, 616, 616);
		ctx.strokeStyle = "rgba(138,122,82,0.35)";
		ctx.strokeRect(44, 44, 632, 632);
		// 右側の細い線
		ctx.fillStyle = "rgba(138,122,82,0.5)";
		ctx.fillRect(720, 160, 500, 1);
		ctx.fillRect(720, 430, 500, 1);
	});
	// ---- コイン(少しずつ色のちがう3種類。鍵も同じ見た目にする) ----
	const coin = (ctx, c1, c2, rim) => {
		const g = ctx.createRadialGradient(4, 4, 1, 6, 6, 6);
		g.addColorStop(0, c1);
		g.addColorStop(1, c2);
		ellipse(ctx, 6, 6, 5.2, 5.2, g, rim, 1.2);
	};
	make("coin1", 12, 12, (ctx) => coin(ctx, "#e8d49a", "#a88a3e", "#6e5a28"));
	make("coin2", 12, 12, (ctx) => coin(ctx, "#d8c08a", "#94783a", "#5e4c22"));
	make("coin3", 12, 12, (ctx) => coin(ctx, "#f0dfae", "#b4964c", "#7a6430"));
	// 見つかったときに出す鍵
	make("key", 160, 160, (ctx) => {
		ctx.translate(80, 80);
		ctx.rotate(-0.6);
		const g = ctx.createLinearGradient(-60, 0, 60, 0);
		g.addColorStop(0, "#f2e2b0");
		g.addColorStop(1, "#a8883c");
		ctx.fillStyle = g;
		ctx.strokeStyle = "#5e4c22";
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(-38, 0, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
		ctx.fillStyle = "#14161b";
		ctx.beginPath(); ctx.arc(-38, 0, 10, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = g;
		ctx.fillRect(-16, -7, 78, 14); ctx.strokeRect(-16, -7, 78, 14);
		ctx.fillRect(38, 7, 10, 16); ctx.strokeRect(38, 7, 10, 16);
		ctx.fillRect(54, 7, 8, 11); ctx.strokeRect(54, 7, 8, 11);
	});
	// ○ と ×
	make("ok", 300, 300, (ctx) => {
		ctx.lineWidth = 26;
		ctx.strokeStyle = "rgba(143,191,159,0.95)";
		ctx.beginPath(); ctx.arc(150, 150, 110, 0, Math.PI * 2); ctx.stroke();
	});
	make("ng", 300, 300, (ctx) => {
		ctx.lineWidth = 26;
		ctx.lineCap = "round";
		ctx.strokeStyle = "rgba(208,128,128,0.95)";
		ctx.beginPath(); ctx.moveTo(60, 60); ctx.lineTo(240, 240); ctx.moveTo(240, 60); ctx.lineTo(60, 240); ctx.stroke();
	});
	// 線を引く点
	make("dot", 10, 10, (ctx) => ellipse(ctx, 5, 5, 4.5, 4.5, "#e8e2d0"));
	// ---- タイトルロゴ(明朝っぽい細めの文字で静かに) ----
	make("logo", 1160, 250, (ctx, w) => {
		text(ctx, "一万枚の中の、一本の鍵をさがせ。", w / 2, 48, 40, "#b8a874", "");
		ctx.font = "bold 120px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = "#e8e2d0";
		ctx.fillText("一万枚の中の鍵", w / 2, 160);
		ctx.fillStyle = "#8a7a52";
		ctx.fillRect(w / 2 - 300, 236, 600, 2);
	});
	return out;
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(drawAll);
	await browser.close();
	fs.mkdirSync(OUT, { recursive: true });
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		fs.writeFileSync(path.join(OUT, name + ".png"), buf);
		console.log("wrote", name, buf.length);
	}
})();
