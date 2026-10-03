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
	const ellipse = (ctx, x, y, rx, ry, rot, fill, stroke, lw) => {
		ctx.beginPath();
		ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
		if (fill) { ctx.fillStyle = fill; ctx.fill(); }
		if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
	};
	let seed = 777;
	const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

	// ---- 背景(校庭) ----
	make("bg", 1280, 720, (ctx, w, h) => {
		const sky = ctx.createLinearGradient(0, 0, 0, 260);
		sky.addColorStop(0, "#5bb8f0");
		sky.addColorStop(1, "#bfe6ff");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, w, 260);
		// 雲
		for (const [x, y, s] of [[200, 70, 1], [1020, 55, 1.2], [640, 40, 0.8]]) {
			for (const [dx, dy, r] of [[0, 0, 30], [32, -10, 26], [-30, 4, 22], [60, 6, 20]]) ellipse(ctx, x + dx * s, y + dy * s, r * s, r * s * 0.8, 0, "rgba(255,255,255,0.9)");
		}
		// 校舎
		ctx.fillStyle = "#f2ead8";
		ctx.fillRect(820, 150, 420, 110);
		ctx.fillStyle = "#d9cfb8";
		ctx.fillRect(820, 150, 420, 14);
		for (let i = 0; i < 7; i++) {
			ctx.fillStyle = "#8ec9f0";
			ctx.fillRect(840 + i * 56, 180, 36, 26);
			ctx.fillRect(840 + i * 56, 220, 36, 26);
		}
		ctx.fillStyle = "#f2ead8";
		ctx.fillRect(990, 110, 70, 50);
		ellipse(ctx, 1025, 132, 16, 16, 0, "#fff", "#8a7a5a", 3);
		// 木
		for (const x of [60, 150, 260, 720]) {
			ctx.fillStyle = "#6b4a2a";
			ctx.fillRect(x - 6, 200, 12, 60);
			ellipse(ctx, x, 190, 40, 36, 0, "#4caf50");
			ellipse(ctx, x - 18, 200, 26, 22, 0, "#43a047");
			ellipse(ctx, x + 20, 196, 26, 22, 0, "#66bb6a");
		}
		// 校庭
		const ground = ctx.createLinearGradient(0, 250, 0, h);
		ground.addColorStop(0, "#e8c88e");
		ground.addColorStop(1, "#d4a865");
		ctx.fillStyle = ground;
		ctx.fillRect(0, 250, w, h - 250);
		// 白線(トラック)
		ctx.strokeStyle = "rgba(255,255,255,0.75)";
		ctx.lineWidth = 6;
		for (const r of [300, 380]) {
			ctx.beginPath();
			ctx.ellipse(640, 560, r * 1.7, r * 0.55, 0, Math.PI * 1.05, Math.PI * 1.95);
			ctx.stroke();
		}
		// 砂つぶ
		for (let i = 0; i < 300; i++) ellipse(ctx, rnd() * w, 260 + rnd() * 460, 1.5 + rnd() * 2, 1 + rnd() * 1.5, 0, rnd() < 0.5 ? "rgba(150,110,60,0.3)" : "rgba(255,240,210,0.4)");
		// 万国旗
		const flagColors = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#fb8c00", "#8e24aa", "#ffffff"];
		for (const [y0, sag] of [[18, 40], [8, 70]]) {
			ctx.strokeStyle = "#555";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(0, y0);
			ctx.quadraticCurveTo(640, y0 + sag * 2, 1280, y0);
			ctx.stroke();
			for (let i = 1; i < 26; i++) {
				const t = i / 26;
				const x = t * 1280;
				const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
				ctx.fillStyle = flagColors[(i + (sag > 50 ? 3 : 0)) % flagColors.length];
				ctx.beginPath();
				ctx.moveTo(x - 14, y);
				ctx.lineTo(x + 14, y);
				ctx.lineTo(x, y + 26);
				ctx.closePath();
				ctx.fill();
				ctx.strokeStyle = "rgba(0,0,0,0.25)";
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}
		// 左右の紅白幕(壁)
		for (const x0 of [0, 1140]) {
			for (let i = 0; i < 7; i++) {
				ctx.fillStyle = i % 2 === 0 ? "#e53935" : "#ffffff";
				ctx.fillRect(x0 + i * 20, 110, 20, 610);
			}
			ctx.fillStyle = "rgba(0,0,0,0.12)";
			ctx.fillRect(x0 === 0 ? 132 : 1140, 110, 8, 610);
		}
	});

	// ---- 玉(ピン) ----
	const ball = (ctx, s, base, light, dark, glow) => {
		const c = s / 2;
		if (glow) {
			const g = ctx.createRadialGradient(c, c, s * 0.2, c, c, s * 0.5);
			g.addColorStop(0, glow);
			g.addColorStop(1, "rgba(255,255,200,0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, s, s);
		}
		const r = s * 0.34;
		const g2 = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r);
		g2.addColorStop(0, light);
		g2.addColorStop(0.6, base);
		g2.addColorStop(1, dark);
		ctx.beginPath();
		ctx.arc(c, c, r, 0, Math.PI * 2);
		ctx.fillStyle = g2;
		ctx.fill();
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = "rgba(0,0,0,0.35)";
		ctx.stroke();
		// お手玉のぬい目
		ctx.strokeStyle = "rgba(0,0,0,0.18)";
		ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.arc(c, c, r * 0.65, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
	};
	make("peg_white", 40, 40, (ctx, s) => ball(ctx, s, "#f4f4f4", "#ffffff", "#b8b8b8"));
	make("peg_white_lit", 40, 40, (ctx, s) => ball(ctx, s, "#fff3a0", "#ffffff", "#e0b800", "rgba(255,240,120,0.9)"));
	make("peg_red", 40, 40, (ctx, s) => ball(ctx, s, "#e53935", "#ff8a80", "#8e0000"));
	make("peg_red_lit", 40, 40, (ctx, s) => ball(ctx, s, "#ff7043", "#ffe0b2", "#c62828", "rgba(255,200,80,0.95)"));
	// 金メダル
	const medal = (ctx, s, glow) => {
		const c = s / 2;
		if (glow) {
			const g = ctx.createRadialGradient(c, c, 4, c, c, c);
			g.addColorStop(0, "rgba(255,250,180,1)");
			g.addColorStop(1, "rgba(255,240,120,0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, s, s);
		}
		ctx.fillStyle = "#1e88e5";
		ctx.beginPath(); ctx.moveTo(c - 8, 2); ctx.lineTo(c + 8, 2); ctx.lineTo(c + 4, c - 4); ctx.lineTo(c - 4, c - 4); ctx.closePath(); ctx.fill();
		const r = s * 0.3;
		const g2 = ctx.createRadialGradient(c - 4, c + 2, 2, c, c + 6, r);
		g2.addColorStop(0, "#fff7b0");
		g2.addColorStop(0.6, "#f4c430");
		g2.addColorStop(1, "#b8860b");
		ctx.beginPath();
		ctx.arc(c, c + 6, r, 0, Math.PI * 2);
		ctx.fillStyle = g2;
		ctx.fill();
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = "#8a6400";
		ctx.stroke();
		ctx.fillStyle = "#8a6400";
		ctx.font = "bold 14px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("1", c, c + 7);
	};
	make("peg_gold", 48, 48, (ctx, s) => medal(ctx, s, false));
	make("peg_gold_lit", 48, 48, (ctx, s) => medal(ctx, s, true));

	// 投げる玉(青いお手玉)
	make("ball", 40, 40, (ctx, s) => {
		const c = s / 2, r = s * 0.42;
		const g = ctx.createRadialGradient(c - 5, c - 6, 2, c, c, r);
		g.addColorStop(0, "#9fd3ff");
		g.addColorStop(0.6, "#1e88e5");
		g.addColorStop(1, "#0d47a1");
		ctx.beginPath();
		ctx.arc(c, c, r, 0, Math.PI * 2);
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = "#0a2f6b";
		ctx.stroke();
		// 白い水玉もよう
		for (const [dx, dy] of [[-6, 4], [6, -5], [5, 7]]) ellipse(ctx, c + dx, c + dy, 3, 3, 0, "rgba(255,255,255,0.85)");
	});
	// ねらいの点
	make("dot", 16, 16, (ctx) => {
		ellipse(ctx, 8, 8, 6, 6, 0, "rgba(255,255,255,0.95)", "rgba(30,60,120,0.7)", 2);
	});
	// 発射台(メガホン型)
	make("cannon", 60, 110, (ctx) => {
		ctx.beginPath();
		ctx.moveTo(18, 0); ctx.lineTo(42, 0); ctx.lineTo(54, 100); ctx.lineTo(6, 100); ctx.closePath();
		const g = ctx.createLinearGradient(0, 0, 60, 0);
		g.addColorStop(0, "#c62828");
		g.addColorStop(0.5, "#ff5252");
		g.addColorStop(1, "#c62828");
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = "#5a0000";
		ctx.stroke();
		ctx.fillStyle = "#fff";
		ctx.fillRect(10, 40, 40, 12);
		ellipse(ctx, 30, 100, 24, 8, 0, "#8e0000", "#5a0000", 3);
	});
	// 玉入れのかご(ポールの上のかご)
	make("kago", 200, 150, (ctx) => {
		// ポール
		ctx.fillStyle = "#e0e0e0";
		ctx.fillRect(94, 60, 12, 90);
		ctx.strokeStyle = "#9e9e9e";
		ctx.lineWidth = 2;
		ctx.strokeRect(94, 60, 12, 90);
		// かご(網)
		ctx.beginPath();
		ctx.moveTo(14, 14); ctx.lineTo(186, 14); ctx.lineTo(150, 70); ctx.lineTo(50, 70); ctx.closePath();
		ctx.fillStyle = "rgba(255,255,255,0.35)";
		ctx.fill();
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 2;
		for (let i = 0; i <= 10; i++) {
			ctx.beginPath(); ctx.moveTo(14 + i * 17.2, 14); ctx.lineTo(50 + i * 10, 70); ctx.stroke();
		}
		for (let j = 1; j < 4; j++) {
			const y = 14 + j * 14, k = j * 14 / 56;
			ctx.beginPath(); ctx.moveTo(14 + 36 * k, y); ctx.lineTo(186 - 36 * k, y); ctx.stroke();
		}
		// ふち(赤)
		ctx.fillStyle = "#e53935";
		ctx.fillRect(8, 8, 184, 12);
		ctx.strokeStyle = "#8e0000";
		ctx.lineWidth = 2;
		ctx.strokeRect(8, 8, 184, 12);
	});
	// はじけるほし
	make("star", 48, 48, (ctx) => {
		ctx.fillStyle = "#fff59d";
		ctx.beginPath();
		for (let i = 0; i < 10; i++) {
			const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 === 0 ? 22 : 9;
			ctx.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r);
		}
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = "#f9a825";
		ctx.lineWidth = 2;
		ctx.stroke();
	});

	// ---- タイトルロゴ ----
	make("logo", 900, 250, (ctx, w) => {
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		ctx.font = "bold 58px IPAGothic";
		ctx.lineWidth = 14;
		ctx.strokeStyle = "#0d47a1";
		ctx.strokeText("運動会ピンボール", w / 2, 52);
		ctx.fillStyle = "#ffffff";
		ctx.fillText("運動会ピンボール", w / 2, 52);
		const g = ctx.createLinearGradient(0, 100, 0, 220);
		g.addColorStop(0, "#ff8a80");
		g.addColorStop(0.5, "#e53935");
		g.addColorStop(1, "#8e0000");
		ctx.font = "bold 128px IPAGothic";
		ctx.lineWidth = 26;
		ctx.strokeStyle = "#ffffff";
		ctx.strokeText("ころころ玉入れ", w / 2, 160);
		ctx.lineWidth = 12;
		ctx.strokeStyle = "#5a0000";
		ctx.strokeText("ころころ玉入れ", w / 2, 160);
		ctx.fillStyle = g;
		ctx.fillText("ころころ玉入れ", w / 2, 160);
	});
	return out;
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(drawAll);
	await browser.close();
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		fs.writeFileSync(path.join(OUT, name + ".png"), buf);
		console.log("wrote", name, buf.length);
	}
})();
