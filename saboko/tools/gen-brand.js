// ロゴ・アイコン・紹介画像を作る
// 使い方: node tools/gen-brand.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const uri = (p) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, p)).toString("base64");
const srcs = {
	face: uri("art_sources/hero-face-reference.png"), hero: uri("image/hero0.png"), ghost: uri("image/ghost0.png"),
	helper: uri("image/helper0.png"), candy: uri("image/candy.png"), lolli: uri("image/lollipop.png"), bg: uri("image/background.png"),
	s_hero: uri("tools/promo-shot/hero.png"), s_candy: uri("tools/promo-shot/candy.png"),
	s_split: uri("tools/promo-shot/split.png"), s_helper: uri("tools/promo-shot/helper.png")
};

async function draw(srcs) {
	const im = {};
	await Promise.all(Object.keys(srcs).map((k) => new Promise((ok) => { const i = new Image(); i.onload = () => { im[k] = i; ok(); }; i.src = srcs[k]; })));
	const INK = "#2a1030", F = "IPAGothic";
	const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
	const rr = (x, l, t, w, h, r) => {
		x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
		x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
	};
	const text = (x, t, tx, ty, size, fill, align, stroke, sw) => {
		x.font = "bold " + size + "px " + F; x.textAlign = align || "left"; x.textBaseline = "middle"; x.lineJoin = "round";
		if (stroke) { x.lineWidth = sw || size * 0.22; x.strokeStyle = stroke; x.strokeText(t, tx, ty); }
		x.fillStyle = fill; x.fillText(t, tx, ty);
	};
	// ハロウィンの題字: 白→こい紫の2重ふち、オレンジのグラデーション
	const title = (x, t, cx, cy, size) => {
		x.font = "bold " + size + "px " + F; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
		x.lineWidth = size * 0.36; x.strokeStyle = INK; x.strokeText(t, cx + 4, cy + 7);
		x.lineWidth = size * 0.32; x.strokeStyle = INK; x.strokeText(t, cx, cy);
		x.lineWidth = size * 0.2; x.strokeStyle = "#ffffff"; x.strokeText(t, cx, cy);
		x.lineWidth = size * 0.1; x.strokeStyle = "#7a2ab0"; x.strokeText(t, cx, cy);
		const g = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
		g.addColorStop(0, "#ffe060"); g.addColorStop(0.5, "#ff9a20"); g.addColorStop(1, "#ff5a10");
		x.fillStyle = g; x.fillText(t, cx, cy);
	};
	// さぼこの頭(かぼちゃぼうしつき)を走る絵から切り出す
	const headOf = (src, sx, sy, sw, sh) => { const [c, x] = mk(sw, sh); x.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh); return c; };
	const sabokoHead = headOf(im.hero, 98, 0, 128, 128);
	const ghostHead = headOf(im.ghost, 140, 0, 136, 152);
	const out = {};

	// ======== ロゴ 1000x300 ========
	{
		const [c, x] = mk(1000, 300);
		// 月
		const mg = x.createRadialGradient(500, 150, 20, 500, 150, 140); mg.addColorStop(0, "rgba(255,240,180,0.55)"); mg.addColorStop(1, "rgba(255,240,180,0)");
		x.fillStyle = mg; x.fillRect(300, 0, 400, 300);
		// 顔を丸いバッジに入れる
		const badge = (head, cx, cy, r, col) => {
			x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = col; x.fill(); x.clip();
			const k = (r * 2.15) / head.width;
			x.drawImage(head, cx - head.width * k / 2, cy - r * 1.02, head.width * k, head.height * k);
			x.restore();
			x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.lineWidth = 8; x.strokeStyle = "#ffffff"; x.stroke();
			x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		};
		badge(sabokoHead, 100, 128, 86, "#ffcf80");
		badge(ghostHead, 900, 128, 86, "#bfe0ff");
		title(x, "にげろさぼこ！", 500, 122, 100);
		x.drawImage(im.candy, 250, 228, 60, 46); x.drawImage(im.lolli, 708, 220, 52, 58);
		x.font = "bold 30px IPAGothic"; x.textAlign = "center"; x.lineJoin = "round"; x.lineWidth = 8; x.strokeStyle = INK;
		x.strokeText("白タイツからにげきれ！", 510, 252); x.fillStyle = "#ffffff"; x.fillText("白タイツからにげきれ！", 510, 252);
		out.logo = c.toDataURL("image/png");
	}

	// ======== アイコン 320x320(透過なし): さぼこの顔を大きく ========
	{
		const [c, x] = mk(320, 320);
		const g = x.createRadialGradient(160, 130, 30, 160, 160, 230); g.addColorStop(0, "#ffb050"); g.addColorStop(0.6, "#ff7a20"); g.addColorStop(1, "#7a2ab0");
		x.fillStyle = g; x.fillRect(0, 0, 320, 320);
		// 放射の線
		for (let k = 0; k < 16; k++) {
			const a0 = k / 16 * Math.PI * 2, a1 = a0 + Math.PI / 16;
			x.fillStyle = "rgba(255,255,255,0.12)"; x.beginPath(); x.moveTo(160, 140);
			x.lineTo(160 + Math.cos(a0) * 300, 140 + Math.sin(a0) * 300); x.lineTo(160 + Math.cos(a1) * 300, 140 + Math.sin(a1) * 300); x.fill();
		}
		// 顔の写真(かみの毛ごと)
		x.save();
		x.beginPath(); x.arc(160, 132, 112, 0, Math.PI * 2); x.closePath();
		x.fillStyle = "#ffffff"; x.fill();
		x.clip();
		x.fillStyle = "#3a2030"; x.fillRect(40, 20, 240, 230);
		x.drawImage(im.face, 166, 0, 940, 980, 48, 24, 224, 234);
		x.restore();
		x.beginPath(); x.arc(160, 132, 112, 0, Math.PI * 2); x.lineWidth = 9; x.strokeStyle = "#ffffff"; x.stroke();
		x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		// かぼちゃのぼうし(さぼこらしさ)
		x.save(); x.translate(160, 50); x.rotate(-0.12);
		x.fillStyle = "#ff7a1a"; x.beginPath(); x.ellipse(0, 0, 70, 24, 0, 0, Math.PI * 2); x.fill();
		x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		x.fillStyle = "#ffa040"; x.beginPath(); x.ellipse(-14, -6, 30, 9, 0, 0, Math.PI * 2); x.fill();
		x.fillStyle = "#3a8a2a"; x.fillRect(-5, -36, 10, 16); x.strokeRect(-5, -36, 10, 16);
		x.fillStyle = "#5ab840"; x.beginPath(); x.ellipse(18, -26, 16, 8, -0.4, 0, Math.PI * 2); x.fill(); x.stroke();
		x.restore();
		// 汗(にげている感じ)
		x.fillStyle = "#8ad8ff"; x.beginPath(); x.moveTo(268, 70); x.quadraticCurveTo(286, 96, 268, 110); x.quadraticCurveTo(250, 96, 268, 70); x.fill();
		x.lineWidth = 3; x.strokeStyle = "#2a6aa8"; x.stroke();
		// 題字の台
		rr(x, 8, 238, 304, 74, 20); x.fillStyle = INK; x.fill();
		rr(x, 14, 244, 292, 62, 15); x.fillStyle = "#3a1858"; x.fill();
		title(x, "にげろさぼこ！", 160, 276, 44);
		out.icon = c.toDataURL("image/png");
	}

	// ======== 紹介画像 1280x720 ========
	{
		const [c, x] = mk(1280, 720);
		x.filter = "blur(6px) brightness(0.55)"; x.drawImage(im.bg, -30, -20, 1340, 760); x.filter = "none";
		x.fillStyle = "rgba(40,10,60,0.35)"; x.fillRect(0, 0, 1280, 720);
		const frame = (img, sx, sy, sw, sh, l, t, w, h, col) => {
			rr(x, l - 8, t - 8, w + 16, h + 16, 16); x.fillStyle = INK; x.fill();
			rr(x, l - 5, t - 5, w + 10, h + 10, 13); x.fillStyle = col; x.fill();
			x.save(); rr(x, l, t, w, h, 10); x.clip(); x.drawImage(img, sx, sy, sw, sh, l, t, w, h); x.restore();
		};
		// 右上: 大きなプレイ画面(突進の予告)
		frame(im.s_hero, 0, 60, 1280, 660, 440, 24, 816, 421, "#ff9a20");
		// 左上: ロゴとひとこと
		const [lc] = [document.createElement("img")];
		await new Promise((ok) => { lc.onload = ok; lc.src = out.logo; });
		x.drawImage(lc, -10, 20, 460, 138);
		text(x, "かぼちゃのさぼこが", 220, 210, 32, "#ffffff", "center", INK, 8);
		text(x, "白タイツから", 220, 256, 32, "#ffffff", "center", INK, 8);
		text(x, "全力でにげる！", 220, 312, 46, "#ffe060", "center", INK, 10);
		x.drawImage(im.hero, 110, 330, 140, 150);
		x.drawImage(im.ghost, -10, 340, 140, 140);
		x.drawImage(im.candy, 270, 410, 54, 42); x.drawImage(im.lolli, 330, 380, 50, 56);
		// 下: 遊び方3コマ
		const cards = [
			{ img: im.s_candy, s: [180, 260, 760, 391], n: "1", t1: "タップでジャンプ", t2: "お菓子を集めてコンボ！", col: "#ff9a20" },
			{ img: im.s_split, s: [300, 300, 900, 463], n: "2", t1: "わかれ道は運だめし", t2: "白タイツと同じ道はアウト", col: "#9a4ae0" },
			{ img: im.s_helper, s: [0, 330, 820, 422], n: "3", t1: "突進はジャンプでよけろ", t2: "女の子が助けにくる！", col: "#e03a5a" }
		];
		cards.forEach((cd, i) => {
			const l = 24 + i * 420, t = 476, w = 392, h = 222;
			frame(cd.img, cd.s[0], cd.s[1], cd.s[2], cd.s[3], l, t, w, h, cd.col);
			x.fillStyle = "rgba(30,10,40,0.85)"; x.fillRect(l, t + h - 70, w, 70);
			x.fillStyle = cd.col; x.beginPath(); x.arc(l + 36, t + h - 35, 24, 0, Math.PI * 2); x.fill();
			x.lineWidth = 4; x.strokeStyle = "#ffffff"; x.stroke();
			text(x, cd.n, l + 36, t + h - 34, 32, "#ffffff", "center");
			text(x, cd.t1, l + 72, t + h - 50, 26, "#ffffff", "left", INK, 6);
			text(x, cd.t2, l + 72, t + h - 18, 22, "#ffe060", "left", INK, 6);
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
	fs.writeFileSync(path.join(ROOT, "image", "logo.png"), Buffer.from(res.logo.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(res.icon.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "promo.png"), Buffer.from(res.promo.split(",")[1], "base64"));
	console.log("wrote logo, icon, promo");
})();
