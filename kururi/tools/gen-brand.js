// アイコン(320x320・透過なし)と紹介画像(1280x720)を作る
// 使い方: node tools/gen-brand.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const uri = (p) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, p)).toString("base64");
const srcs = { logo: uri("image/logo.png"), bg: uri("image/bg.png"), play: uri("tools/promo-shot/play.png") };
["t0", "t1", "t2", "t3", "t4", "t5", "tj", "btn_cw", "btn_ccw"].forEach((k) => { srcs[k] = uri("image/" + k + ".png"); });

async function draw(srcs) {
	const im = {};
	await Promise.all(Object.keys(srcs).map((k) => new Promise((ok) => { const i = new Image(); i.onload = () => { im[k] = i; ok(); }; i.src = srcs[k]; })));
	const GOLD = "#c9a45c", GOLD_L = "#ecd59a", INK = "#141218";
	const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
	const rr = (x, l, t, w, h, r) => {
		x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
		x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
	};
	const text = (x, t, tx, ty, size, fill, align, font) => {
		x.font = (font || "bold " + size + "px IPAGothic"); x.textAlign = align || "left"; x.textBaseline = "middle";
		x.lineJoin = "round"; x.lineWidth = size * 0.2; x.strokeStyle = INK; x.strokeText(t, tx, ty);
		x.fillStyle = fill; x.fillText(t, tx, ty);
	};
	const out = {};
	// ======== アイコン ========
	{
		const [c, x] = mk(320, 320);
		x.drawImage(im.bg, 480, 200, 320, 320, 0, 0, 320, 320);
		// 3x3のタイルを、少しかたむけて
		x.save(); x.translate(160, 124); x.rotate(-0.2); x.scale(0.92, 0.92);
		const order = ["t2", "t2", "t1", "t3", "t0", "t2", "t4", "t5", "tj"];
		rr(x, -112, -112, 224, 224, 14); x.fillStyle = INK; x.fill(); x.lineWidth = 4; x.strokeStyle = GOLD; x.stroke();
		order.forEach((k, i) => x.drawImage(im[k], -102 + (i % 3) * 68, -102 + Math.floor(i / 3) * 68, 64, 64));
		x.restore();
		// まわる矢印
		rr(x, 10, 236, 300, 74, 14); x.fillStyle = INK; x.fill(); x.lineWidth = 3; x.strokeStyle = GOLD; x.stroke();
		const g = x.createLinearGradient(0, 250, 0, 300); g.addColorStop(0, "#fff1c8"); g.addColorStop(1, "#c9a45c");
		x.font = "bold 35px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = g;
		x.fillText("くるりグラビティ", 160, 274);
		out.icon = c.toDataURL("image/png");
	}
	// ======== 紹介画像 ========
	{
		const [c, x] = mk(1280, 720);
		x.drawImage(im.bg, 0, 0);
		// 右: プレイ画面(盤のまわり)
		rr(x, 556, 24, 700, 420, 16); x.fillStyle = INK; x.fill(); x.lineWidth = 4; x.strokeStyle = GOLD; x.stroke();
		x.save(); rr(x, 564, 32, 684, 404, 12); x.clip(); x.drawImage(im.play, 0, 38, 1280, 756, 564, 32, 684, 404); x.restore();
		// 左上: ロゴとひとこと
		x.drawImage(im.logo, 10, 20, 560, 168);
		text(x, "盤をくるっと回すと、", 290, 236, 34, "#f4efe6", "center");
		text(x, "重力の向きが変わる！", 290, 286, 34, GOLD_L, "center");
		text(x, "落ちもの × 回転の新感覚パズル", 290, 346, 26, "#f4efe6", "center");
		// タイルの柄のならび
		["t0", "t1", "t2", "t3", "t4", "t5"].forEach((k, i) => x.drawImage(im[k], 70 + i * 74, 390, 64, 64));
		// 下: 遊び方3つ
		const card = (l, n, t1, t2, draw) => {
			rr(x, l, 478, 392, 220, 16); x.fillStyle = "rgba(20,18,24,0.92)"; x.fill(); x.lineWidth = 3; x.strokeStyle = GOLD; x.stroke();
			x.beginPath(); x.arc(l + 40, 518, 22, 0, Math.PI * 2); x.fillStyle = GOLD; x.fill();
			text(x, n, l + 40, 520, 28, "#ffffff", "center");
			text(x, t1, l + 74, 518, 26, GOLD_L, "left");
			text(x, t2, l + 196, 672, 22, "#f4efe6", "center");
			draw(l);
		};
		card(24, "1", "列をタップして落とす", "同じ柄を3つつなげて消す", (l) => {
			["t2", "t2", "t2"].forEach((k, i) => x.drawImage(im[k], l + 40 + i * 66, 572, 62, 62));
			text(x, "→ 消える！", l + 314, 603, 26, GOLD_L, "center");
		});
		card(444, "2", "ボタンで盤を回す", "重力の向きが変わって一気に落ちる", (l) => {
			x.drawImage(im.btn_ccw, l + 50, 556, 84, 84);
			x.save(); x.translate(l + 270, 596); x.rotate(-0.4);
			["t0", "t3", "t5", "t2"].forEach((k, i) => x.drawImage(im[k], -50 + (i % 2) * 50, -50 + Math.floor(i / 2) * 50, 48, 48));
			x.restore();
			text(x, "→", l + 175, 598, 40, GOLD_L, "center");
		});
		card(864, "3", "回して消すと×1.5", "連鎖でスコアがどんどん上がる", (l) => {
			text(x, "3 CHAIN", l + 196, 600, 62, GOLD_L, "center", "bold 62px DejaVu Serif");
		});
		out.promo = c.toDataURL("image/png");
	}
	return out;
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(draw, srcs);
	await b.close();
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(res.icon.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "promo.png"), Buffer.from(res.promo.split(",")[1], "base64"));
	console.log("wrote icon, promo");
})();
