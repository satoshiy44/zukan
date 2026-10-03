// 投稿用アイコン(320x320)を作る。スマホで小さく表示されても読めるよう、文字を大きく太くする
// 使い方: node tools/gen-icons.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUTPUTS = {
	oimo: [path.join(ROOT, "dist", "oimo-chicken_icon.png"), path.join(ROOT, "game", "submission", "icon.png")],
	puzzle: [path.join(ROOT, "dist", "yakiimo-puzzle_icon.png"), path.join(ROOT, "puzzle", "submission", "icon.png")],
	tamaire: [path.join(ROOT, "dist", "korokoro-tamaire_icon.png"), path.join(ROOT, "tamaire", "submission", "icon.png")],
	kunai: [path.join(ROOT, "dist", "kunai-shugyo_icon.png"), path.join(ROOT, "kunai", "submission", "icon.png")]
};

function draw() {
	const S = 320;
	const out = {};
	const make = (name, fn) => {
		const c = document.createElement("canvas");
		c.width = c.height = S;
		fn(c.getContext("2d"));
		out[name] = c.toDataURL("image/png");
	};
	// 太い2重の縁取りで、小さくしてもつぶれない文字
	const bigText = (ctx, text, x, y, size, fill, inner, outer) => {
		ctx.font = "bold " + size + "px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		ctx.lineWidth = size * 0.36;
		ctx.strokeStyle = outer;
		ctx.strokeText(text, x, y);
		ctx.lineWidth = size * 0.18;
		ctx.strokeStyle = inner;
		ctx.strokeText(text, x, y);
		// 太字に見せるため少しずらして重ねる
		ctx.fillStyle = fill;
		for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) ctx.fillText(text, x + dx - 1, y + dy - 1);
	};
	const imo = (ctx, cx, cy, w, h, rot, body, dark, outline) => {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(rot);
		const rx = w / 2, ry = h / 2;
		ctx.beginPath();
		ctx.moveTo(-rx, 0);
		ctx.bezierCurveTo(-rx * 0.9, -ry * 1.15, rx * 0.5, -ry * 1.25, rx, -ry * 0.1);
		ctx.bezierCurveTo(rx * 0.6, ry * 1.2, -rx * 0.8, ry * 1.15, -rx, 0);
		ctx.closePath();
		const g = ctx.createLinearGradient(0, -ry, 0, ry);
		g.addColorStop(0, body);
		g.addColorStop(1, dark);
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 8;
		ctx.strokeStyle = outline;
		ctx.stroke();
		ctx.restore();
	};

	// ひっこぬけ！おいもチキン
	make("oimo", (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 0, S);
		g.addColorStop(0, "#ff9a3c");
		g.addColorStop(1, "#ffcf6a");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, S, S);
		// 後ろに大きなさつまいも
		imo(ctx, 165, 168, 300, 170, -0.35, "#d8457f", "#7c1c48", "#4a0e2a");
		bigText(ctx, "いも", S / 2, 92, 132, "#ffffff", "#c2326f", "#3a0c22");
		bigText(ctx, "チキ", S / 2, 238, 132, "#ffe14a", "#c2326f", "#3a0c22");
	});

	// たきびでポン！やきいもパズル
	make("puzzle", (ctx) => {
		ctx.fillStyle = "#3a1a0a";
		ctx.fillRect(0, 0, S, S);
		// たき火の光
		const glow = ctx.createRadialGradient(S / 2, 230, 10, S / 2, 230, 220);
		glow.addColorStop(0, "#ff8a1a");
		glow.addColorStop(0.5, "#c8401a");
		glow.addColorStop(1, "#3a1a0a");
		ctx.fillStyle = glow;
		ctx.fillRect(0, 0, S, S);
		// 炎
		const flame = (x, w, h, c1, c2) => {
			ctx.beginPath();
			ctx.moveTo(x - w, 330);
			ctx.bezierCurveTo(x - w * 1.1, 330 - h * 0.5, x - w * 0.2, 330 - h * 0.6, x, 330 - h);
			ctx.bezierCurveTo(x + w * 0.3, 330 - h * 0.6, x + w * 1.1, 330 - h * 0.5, x + w, 330);
			ctx.closePath();
			const fg = ctx.createLinearGradient(0, 330 - h, 0, 330);
			fg.addColorStop(0, c1);
			fg.addColorStop(1, c2);
			ctx.fillStyle = fg;
			ctx.fill();
		};
		flame(S / 2, 150, 300, "rgba(255,120,30,0.9)", "#e83a1a");
		flame(S / 2, 90, 220, "#ffd84a", "#ff9a1a");
		bigText(ctx, "やき", S / 2, 92, 132, "#ffffff", "#e0602a", "#2a0c04");
		bigText(ctx, "いも", S / 2, 238, 132, "#ffe14a", "#e0602a", "#2a0c04");
	});
	// ころころ玉入れ
	make("tamaire", (ctx) => {
		// 紅白のしま
		for (let i = 0; i < 8; i++) {
			ctx.fillStyle = i % 2 === 0 ? "#e53935" : "#ffffff";
			ctx.fillRect(i * 40, 0, 40, S);
		}
		// まん中に大きな青い玉
		const g = ctx.createRadialGradient(140, 140, 10, S / 2, S / 2, 150);
		g.addColorStop(0, "#9fd3ff");
		g.addColorStop(0.6, "#1e88e5");
		g.addColorStop(1, "#0d47a1");
		ctx.beginPath();
		ctx.arc(S / 2, S / 2, 140, 0, Math.PI * 2);
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 10;
		ctx.strokeStyle = "#0a2f6b";
		ctx.stroke();
		bigText(ctx, "たま", S / 2, 92, 132, "#ffffff", "#1e88e5", "#0a2f6b");
		bigText(ctx, "いれ", S / 2, 238, 132, "#ffe14a", "#e53935", "#5a0000");
	});
	// クナイ修行
	make("kunai", (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 0, S);
		g.addColorStop(0, "#2a1c4a");
		g.addColorStop(1, "#c8603a");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, S, S);
		// 丸太の切り口
		ctx.beginPath();
		ctx.arc(S / 2, S / 2, 138, 0, Math.PI * 2);
		ctx.fillStyle = "#e0a868";
		ctx.fill();
		ctx.lineWidth = 14;
		ctx.strokeStyle = "#7a4a24";
		ctx.stroke();
		ctx.strokeStyle = "rgba(120,70,30,0.45)";
		ctx.lineWidth = 3;
		for (let k = 1; k <= 5; k++) {
			ctx.beginPath();
			ctx.arc(S / 2, S / 2, 22 * k, 0, Math.PI * 2);
			ctx.stroke();
		}
		bigText(ctx, "クナイ", S / 2, 98, 104, "#ffffff", "#c62828", "#111111");
		bigText(ctx, "修行", S / 2, 236, 132, "#ffe14a", "#c62828", "#111111");
	});
	return out;
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(draw);
	await browser.close();
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		for (const dest of OUTPUTS[name]) {
			fs.writeFileSync(dest, buf);
			console.log("wrote", path.relative(ROOT, dest), Math.round(buf.length / 1024) + "KB");
		}
	}
})();
