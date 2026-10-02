// 投稿用の紹介画像(1280x720)を作る
// 使い方: node tools/gen-promo.js tools/promo-shots/oimo_dig.png tools/promo-shots/oimo_stall.png tools/promo-shots/puzzle.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const [digShot, stallShot, puzzleShot] = process.argv.slice(2);
const files = {
	digShot, stallShot, puzzleShot,
	oimoLogo: path.join(ROOT, "game/image/logo.png"),
	tanuki: path.join(ROOT, "game/image/tanuki_pull.png"),
	kitsune: path.join(ROOT, "game/image/cust_kitsune.png"),
	usagi: path.join(ROOT, "game/image/cust_usagi.png"),
	kuma: path.join(ROOT, "game/image/cust_kuma.png"),
	imoGold: path.join(ROOT, "game/image/imo_gold.png"),
	puzzleBg: path.join(ROOT, "puzzle/image/bg.png"),
	puzzleLogo: path.join(ROOT, "puzzle/image/logo.png"),
	fire: path.join(ROOT, "puzzle/image/fire1.png"),
	pimo: path.join(ROOT, "puzzle/image/p_imo.png")
};
const srcs = {};
for (const [k, p] of Object.entries(files)) srcs[k] = dataUrl(p);

async function draw(srcs) {
	const imgs = {};
	await Promise.all(Object.entries(srcs).map(([k, s]) => new Promise((ok) => {
		const im = new Image();
		im.onload = () => { imgs[k] = im; ok(); };
		im.src = s;
	})));
	const W = 1280, H = 720;
	const out = {};
	const make = (name, fn) => {
		const c = document.createElement("canvas");
		c.width = W; c.height = H;
		fn(c.getContext("2d"));
		out[name] = c.toDataURL("image/png");
	};
	const outlineText = (ctx, text, x, y, size, fill, stroke, sw, align = "center") => {
		ctx.font = "bold " + size + "px IPAGothic";
		ctx.textAlign = align;
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		ctx.lineWidth = sw;
		ctx.strokeStyle = stroke;
		ctx.strokeText(text, x, y);
		ctx.fillStyle = fill;
		for (const [dx, dy] of [[0, 0], [1.5, 0], [0, 1.5]]) ctx.fillText(text, x + dx, y + dy);
	};
	// 白いふちと影をつけたスクリーンショット
	const card = (ctx, im, cx, cy, w, rot) => {
		const h = w * 9 / 16;
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(rot);
		ctx.shadowColor = "rgba(0,0,0,0.45)";
		ctx.shadowBlur = 24;
		ctx.shadowOffsetY = 10;
		ctx.fillStyle = "#fff8e6";
		ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
		ctx.shadowColor = "transparent";
		ctx.drawImage(im, -w / 2, -h / 2, w, h);
		ctx.restore();
	};
	const tag = (ctx, text, x, y, bg) => {
		ctx.font = "bold 34px IPAGothic";
		const w = ctx.measureText(text).width + 44;
		ctx.save();
		ctx.fillStyle = bg;
		ctx.strokeStyle = "#fff8e6";
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.roundRect(x - w / 2, y - 30, w, 60, 30);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
		outlineText(ctx, text, x, y + 1, 34, "#fff8e6", bg, 2);
	};

	// ===== ひっこぬけ！おいもチキン =====
	make("oimo", (ctx) => {
		// 左は夕方の畑、右は夜の屋台
		const day = ctx.createLinearGradient(0, 0, 0, H);
		day.addColorStop(0, "#ffb36b");
		day.addColorStop(1, "#ffe0a8");
		ctx.fillStyle = day;
		ctx.fillRect(0, 0, W, H);
		const night = ctx.createLinearGradient(0, 0, 0, H);
		night.addColorStop(0, "#2b2050");
		night.addColorStop(1, "#8a3f5a");
		ctx.fillStyle = night;
		ctx.beginPath();
		ctx.moveTo(760, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(520, H);
		ctx.closePath();
		ctx.fill();
		// スクリーンショット2枚
		card(ctx, imgs.digShot, 340, 400, 560, -0.05);
		card(ctx, imgs.stallShot, 940, 420, 560, 0.05);
		tag(ctx, "前半 いもほり", 250, 236, "#c2326f");
		tag(ctx, "後半 やきいも屋台", 1000, 252, "#6a3fa0");
		// 矢印
		ctx.save();
		ctx.translate(640, 410);
		ctx.fillStyle = "#ffe14a";
		ctx.strokeStyle = "#3a0c22";
		ctx.lineWidth = 8;
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(-50, -26); ctx.lineTo(10, -26); ctx.lineTo(10, -56); ctx.lineTo(62, 0);
		ctx.lineTo(10, 56); ctx.lineTo(10, 26); ctx.lineTo(-50, 26); ctx.closePath();
		ctx.stroke();
		ctx.fill();
		ctx.restore();
		// ロゴ
		ctx.drawImage(imgs.oimoLogo, 640 - 380, 0, 760, 220);
		// キャラクター
		ctx.drawImage(imgs.tanuki, -30, 470, 240, 250);
		ctx.drawImage(imgs.kuma, 1060, 520, 170, 205);
		ctx.drawImage(imgs.usagi, 1150, 500, 150, 181);
		ctx.drawImage(imgs.imoGold, 180, 600, 110, 76);
		// キャッチコピー
		outlineText(ctx, "掘って、焼いて、大逆転！", 640, 668, 58, "#ffe14a", "#3a0c22", 14);
	});

	// ===== たきびでポン！やきいもパズル =====
	make("puzzle", (ctx) => {
		// 空と地面のグラデーションに、ゲーム背景の右側(紅葉の木)だけを重ねる
		const sky = ctx.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, "#ffb870");
		sky.addColorStop(0.62, "#f6c27a");
		sky.addColorStop(0.75, "#b98a52");
		sky.addColorStop(1, "#8a5e32");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, W, H);
		ctx.drawImage(imgs.puzzleBg, 880, 0, 400, 640, 880, 0, 400, 640);
		ctx.fillStyle = "rgba(60,25,8,0.3)";
		ctx.fillRect(0, 0, W, H);
		card(ctx, imgs.puzzleShot, 520, 430, 760, -0.03);
		ctx.drawImage(imgs.puzzleLogo, 640 - 400, -6, 800, 222);
		// たき火とやきいも
		ctx.drawImage(imgs.fire, 960, 330, 320, 277);
		ctx.drawImage(imgs.pimo, 1060, 250, 110, 110);
		ctx.fillStyle = "rgba(42,12,4,0.7)";
		ctx.fillRect(0, 630, W, 90);
		outlineText(ctx, "落ち葉をつなげて たき火にポン！", 600, 674, 52, "#ffe14a", "#2a0c04", 14);
		outlineText(ctx, "全消し", 1120, 640, 40, "#fff8e6", "#c8321a", 10);
		outlineText(ctx, "+5000！", 1120, 686, 40, "#ffe14a", "#c8321a", 10);
	});
	return out;
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(draw, srcs);
	await browser.close();
	const dests = { oimo: "dist/oimo-chicken_promo.png", puzzle: "dist/yakiimo-puzzle_promo.png" };
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		fs.writeFileSync(path.join(ROOT, dests[name]), buf);
		console.log("wrote", dests[name], Math.round(buf.length / 1024) + "KB");
	}
})();
