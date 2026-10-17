// タイトルロゴ(900x250)とアイコン(320x320)を作る。かざりは入れず、平たいコーヒーカップと太い題字だけのシンプルな形
// 使い方: node tools/gen-logo.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

async function draw(kind) {
	const c = document.createElement("canvas");
	const x = c.getContext("2d");
	const INK = "#3a1810", RED = "#9c1e2c", CREAM = "#fff6e2";
	// 平たいコーヒーカップ(中心 cx,cy、大きさ s)
	const cup = (cx, cy, s, body, line) => {
		x.lineJoin = "round"; x.lineCap = "round";
		// 湯気
		x.strokeStyle = line; x.lineWidth = s * 0.07;
		[-0.18, 0.06].forEach((dx) => {
			x.beginPath(); x.moveTo(cx + dx * s, cy - 0.36 * s);
			x.bezierCurveTo(cx + (dx - 0.1) * s, cy - 0.48 * s, cx + (dx + 0.1) * s, cy - 0.56 * s, cx + dx * s, cy - 0.7 * s);
			x.stroke();
		});
		// 取っ手
		x.lineWidth = s * 0.09; x.strokeStyle = body;
		x.beginPath(); x.arc(cx + 0.33 * s, cy - 0.04 * s, 0.13 * s, -Math.PI / 2, Math.PI / 2); x.stroke();
		// カップ
		x.fillStyle = body; x.beginPath();
		x.moveTo(cx - 0.38 * s, cy - 0.24 * s); x.lineTo(cx + 0.34 * s, cy - 0.24 * s);
		x.quadraticCurveTo(cx + 0.32 * s, cy + 0.2 * s, cx - 0.02 * s, cy + 0.2 * s);
		x.quadraticCurveTo(cx - 0.36 * s, cy + 0.2 * s, cx - 0.38 * s, cy - 0.24 * s); x.fill();
		// 受け皿
		x.beginPath(); x.ellipse(cx - 0.02 * s, cy + 0.27 * s, 0.5 * s, 0.07 * s, 0, 0, Math.PI * 2); x.fill();
	};
	const title = (t, tx, ty, size, fill, edge, shadow) => {
		x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
		if (shadow) { x.lineWidth = size * 0.24; x.strokeStyle = shadow; x.strokeText(t, tx + 4, ty + 6); }
		x.lineWidth = size * 0.2; x.strokeStyle = edge; x.strokeText(t, tx, ty);
		x.fillStyle = fill; x.fillText(t, tx, ty);
	};
	if (kind === "logo") {
		c.width = 900; c.height = 250;
		cup(122, 146, 180, RED, "#e8b440");
		title("ご注文どぞ", 548, 136, 116, RED, CREAM, INK);
	} else {
		c.width = 320; c.height = 320;
		x.fillStyle = RED; x.fillRect(0, 0, 320, 320);
		cup(170, 150, 180, CREAM, "#f2c86a");
		title("ご注文どぞ", 160, 270, 58, CREAM, INK);
	}
	return c.toDataURL("image/png");
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const logo = await p.evaluate(draw, "logo");
	const icon = await p.evaluate(draw, "icon");
	await b.close();
	fs.writeFileSync(path.join(ROOT, "image", "logo.png"), Buffer.from(logo.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(icon.split(",")[1], "base64"));
	console.log("wrote logo.png, icon.png");
})();
