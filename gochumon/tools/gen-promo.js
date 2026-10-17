// 紹介画像(1280x720)を作る。ロゴ・プレイ画面・遊び方4つ・スコアの計算を一枚にまとめる
// 使い方: node tools/gen-promo.js tools/promo-shot/play.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const uri = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const img = (n) => uri(path.join(ROOT, "image", n + ".png"));
const srcs = {
	shot: uri(process.argv[2]), logo: img("logo"), star: img("star"), kaere: img("kaere")
};

async function draw(srcs) {
	const im = {};
	await Promise.all(Object.keys(srcs).map((k) => new Promise((ok) => { const i = new Image(); i.onload = () => { im[k] = i; ok(); }; i.src = srcs[k]; })));
	const c = document.createElement("canvas");
	c.width = 1280; c.height = 720;
	const x = c.getContext("2d");
	const F = "IPAGothic";
	const round = (l, t, w, h, r) => {
		x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
		x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
	};
	const text = (t, tx, ty, size, fill, align, stroke) => {
		x.font = "bold " + size + "px " + F; x.textAlign = align || "left"; x.textBaseline = "middle"; x.lineJoin = "round";
		if (stroke) { x.lineWidth = size * 0.22; x.strokeStyle = stroke; x.strokeText(t, tx, ty); }
		x.fillStyle = fill; x.fillText(t, tx, ty);
	};
	const badge = (n, bx, by, r) => {
		x.fillStyle = "#3a1810"; x.beginPath(); x.arc(bx + 2, by + 3, r, 0, Math.PI * 2); x.fill();
		x.fillStyle = "#b0202e"; x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
		x.strokeStyle = "#fff4d8"; x.lineWidth = 4; x.stroke();
		text(String(n), bx, by + 1, r * 1.25, "#ffffff", "center");
	};

	// 背景: 店の絵をぼかして暗く
	x.filter = "blur(8px) brightness(0.45)"; x.drawImage(im.shot, -40, -20, 1360, 760); x.filter = "none";
	x.fillStyle = "rgba(40,16,10,0.35)"; x.fillRect(0, 0, 1280, 720);

	// ロゴ
	x.drawImage(im.logo, 640 - 315, 2, 630, 175);

	// 左: プレイ画面(番号つき)
	const SX = 26, SY = 186, SW = 668, SH = 376, k = SW / 1280;
	x.fillStyle = "#d8a84a"; round(SX - 8, SY - 8, SW + 16, SH + 16, 14); x.fill();
	x.save(); round(SX, SY, SW, SH, 8); x.clip(); x.drawImage(im.shot, SX, SY, SW, SH); x.restore();
	const at = (gx, gy) => [SX + gx * k, SY + gy * k];
	const ring = (gx, gy, gw, gh) => {
		const p = at(gx, gy);
		x.strokeStyle = "#ffe14a"; x.lineWidth = 4; x.setLineDash([10, 6]); round(p[0], p[1], gw * k, gh * k, 10); x.stroke(); x.setLineDash([]);
	};
	ring(398, 70, 466, 150); ring(194, 546, 892, 128); ring(1098, 534, 166, 130); ring(424, 262, 280, 66);
	let p = at(398, 70); badge(1, p[0], p[1], 20);
	p = at(194, 546); badge(1, p[0], p[1], 20);
	p = at(424, 262); badge(2, p[0], p[1], 20);
	p = at(1098, 534); badge(3, p[0], p[1], 20);
	p = at(1212, 132); badge(4, p[0], p[1], 20);
	ring(1146, 10, 128, 94);

	// 右: 遊び方カード
	const CX = 714, CW = 546, CH = 88;
	const card = (n, cy, l1, l2) => {
		x.fillStyle = "rgba(0,0,0,0.35)"; round(CX + 3, cy + 4, CW, CH, 14); x.fill();
		x.fillStyle = "#fff6e2"; round(CX, cy, CW, CH, 14); x.fill();
		x.strokeStyle = "#c8962e"; x.lineWidth = 3; round(CX + 4, cy + 4, CW - 8, CH - 8, 11); x.stroke();
		badge(n, CX + 34, cy + CH / 2, 22);
		text(l1, CX + 66, cy + 28, 27, "#3a1c12");
		text(l2, CX + 66, cy + 64, 22, "#8a1c28");
	};
	card(1, 178, "吹き出しの注文と同じ料理をタップ", "そろったら、お客さんは笑顔でお帰り");
	card(2, 274, "早く出すほど★がふえる！", "★1つで1000円の売上");
	card(3, 370, "クレーマーは「帰れ！」で撃退", "ラーメン・お寿司・かつ丼を頼む客");
	card(4, 466, "残り30秒は深夜営業", "メニュー2倍、売上もボーナスも1.2倍");
	// カードの右はしに小さな絵
	x.drawImage(im.star, CX + 404, 296, 40, 40); x.drawImage(im.star, CX + 444, 296, 40, 40); x.drawImage(im.star, CX + 484, 296, 40, 40);
	x.drawImage(im.kaere, CX + 462, 378, 80, 65);

	// 下: スコアの計算
	x.fillStyle = "rgba(30,12,8,0.9)"; x.fillRect(0, 588, 1280, 132);
	x.fillStyle = "#d8a84a"; x.fillRect(0, 588, 1280, 4);
	text("営業終了で、ぜんぶ足してスコアに！", 640, 618, 30, "#ffe8a8", "center");
	const chips = [["売上", "#7a1a26"], ["クレーマー撃退", "#2f5a52"], ["連チャン", "#8a5a12"], ["お店の評価", "#3a3a7a"]];
	x.font = "bold 28px " + F;
	const ws = chips.map((ch) => x.measureText(ch[0]).width + 40);
	const plus = 44, eq = 150;
	let total = ws.reduce((a, b) => a + b, 0) + plus * 3 + eq;
	let px = 640 - total / 2;
	chips.forEach((ch, i) => {
		x.fillStyle = ch[1]; round(px, 648, ws[i], 52, 26); x.fill();
		x.strokeStyle = "#fff4d8"; x.lineWidth = 2; round(px + 3, 651, ws[i] - 6, 46, 23); x.stroke();
		text(ch[0], px + ws[i] / 2, 675, 28, "#ffffff", "center");
		px += ws[i];
		if (i < 3) { text("＋", px + plus / 2, 675, 32, "#ffe8a8", "center"); px += plus; }
	});
	text("＝ スコア", px + 12, 675, 34, "#ffd24a", "left", "#3a1810");
	return c.toDataURL("image/png");
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const url = await p.evaluate(draw, srcs);
	await b.close();
	const buf = Buffer.from(url.split(",")[1], "base64");
	fs.writeFileSync(path.join(ROOT, "promo.png"), buf);
	console.log("wrote promo.png", Math.round(buf.length / 1024) + "KB");
})();
