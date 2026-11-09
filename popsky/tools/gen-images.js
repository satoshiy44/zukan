// ポップでかわいいシューティングの絵を作る(自機・敵・ボス・雲・ベル・たま・背景・ロゴ)
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "image");

function build() {
	const out = {};
	const OL = "#3a2050";
	const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.lineJoin = "round"; x.lineCap = "round"; return [c, x]; };
	const save = (n, c) => { out[n] = c.toDataURL("image/png"); };
	const ell = (x, cx, cy, rx, ry, fill, line, lw) => {
		x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
		if (fill) { x.fillStyle = fill; x.fill(); }
		if (line) { x.lineWidth = lw || 5; x.strokeStyle = line; x.stroke(); }
	};
	const shine = (x, cx, cy, rx, ry) => ell(x, cx, cy, rx, ry, "rgba(255,255,255,0.75)");
	const eyes = (x, cx, cy, gap, r) => {
		[-1, 1].forEach((s) => {
			ell(x, cx + s * gap, cy, r, r * 1.25, OL);
			ell(x, cx + s * gap - r * 0.3, cy - r * 0.45, r * 0.42, r * 0.42, "#ffffff");
		});
	};
	const cheeks = (x, cx, cy, gap, r) => [-1, 1].forEach((s) => ell(x, cx + s * gap, cy, r, r * 0.6, "rgba(255,110,150,0.6)"));

	// ======== 自機(120x120): まるいポッドに小さな羽とプロペラ ========
	const ship = (name, flap) => {
		const [c, x] = mk(120, 130);
		// 羽
		[-1, 1].forEach((s) => {
			x.save(); x.translate(60 + s * 38, 66); x.rotate(s * (0.5 + flap * 0.25));
			ell(x, 0, 0, 26, 14, "#bfe8ff", OL, 4); ell(x, -4, -3, 12, 5, "rgba(255,255,255,0.8)");
			x.restore();
		});
		// 足(ジェット)
		[-1, 1].forEach((s) => { x.fillStyle = "#ffb050"; x.beginPath(); x.moveTo(60 + s * 14, 104); x.lineTo(60 + s * 20, 122 + flap * 6); x.lineTo(60 + s * 8, 106); x.fill(); });
		ell(x, 48, 104, 10, 9, "#7a6ad0", OL, 4); ell(x, 72, 104, 10, 9, "#7a6ad0", OL, 4);
		// からだ
		ell(x, 60, 70, 38, 36, "#ff7ab0", OL, 5);
		ell(x, 60, 84, 28, 18, "#ffd0e4");
		// まど
		ell(x, 60, 58, 22, 18, "#6ad8ff", OL, 4); shine(x, 52, 52, 8, 5);
		eyes(x, 60, 60, 8, 3.4);
		// アンテナ
		x.strokeStyle = OL; x.lineWidth = 4; x.beginPath(); x.moveTo(60, 34); x.lineTo(60, 16); x.stroke();
		ell(x, 60, 14, 7, 7, "#ffe04a", OL, 3);
		save(name, c);
	};
	ship("ship0", 0); ship("ship1", 1);

	// ======== 敵 ========
	// ぷかぷかフグ風の風船
	{
		const [c, x] = mk(90, 90);
		for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; x.fillStyle = "#ffcf40"; x.beginPath(); x.moveTo(45 + Math.cos(a) * 30, 45 + Math.sin(a) * 30); x.lineTo(45 + Math.cos(a + 0.15) * 42, 45 + Math.sin(a + 0.15) * 42); x.lineTo(45 + Math.cos(a + 0.3) * 30, 45 + Math.sin(a + 0.3) * 30); x.fill(); x.lineWidth = 3; x.strokeStyle = OL; x.stroke(); }
		ell(x, 45, 45, 32, 30, "#ffe86a", OL, 5); shine(x, 34, 33, 9, 6);
		eyes(x, 45, 44, 9, 4); cheeks(x, 45, 54, 17, 5);
		x.lineWidth = 3; x.strokeStyle = OL; x.beginPath(); x.arc(45, 55, 5, 0.1 * Math.PI, 0.9 * Math.PI); x.stroke();
		save("e_puff", c);
	}
	// キャンディUFO
	{
		const [c, x] = mk(110, 80);
		ell(x, 55, 34, 22, 20, "#a8f0ff", OL, 4); shine(x, 48, 26, 7, 4);
		eyes(x, 55, 34, 7, 3);
		ell(x, 55, 50, 50, 16, "#7ad06a", OL, 5);
		for (let k = 0; k < 5; k++) ell(x, 17 + k * 19, 51, 5, 4, ["#ff6a9a", "#ffe04a", "#6ac8ff", "#ff6a9a", "#ffe04a"][k]);
		save("e_ufo", c);
	}
	// ぱたぱた鳥
	{
		const [c, x] = mk(100, 80);
		[-1, 1].forEach((s) => { x.save(); x.translate(50 + s * 26, 38); x.rotate(s * -0.5); ell(x, 0, 0, 20, 11, "#ffffff", OL, 4); x.restore(); });
		ell(x, 50, 44, 26, 24, "#6ac0ff", OL, 5); ell(x, 50, 52, 16, 12, "#d8f2ff");
		eyes(x, 50, 40, 8, 3.4);
		x.fillStyle = "#ffa030"; x.beginPath(); x.moveTo(44, 48); x.lineTo(56, 48); x.lineTo(50, 58); x.closePath(); x.fill(); x.lineWidth = 3; x.strokeStyle = OL; x.stroke();
		save("e_bird", c);
	}
	// ぷるぷるゼリー
	{
		const [c, x] = mk(90, 90);
		x.beginPath(); x.moveTo(12, 70); x.quadraticCurveTo(10, 16, 45, 14); x.quadraticCurveTo(80, 16, 78, 70);
		for (let k = 0; k < 4; k++) x.quadraticCurveTo(78 - k * 16.5 - 8, 82, 78 - (k + 1) * 16.5, 70);
		x.closePath(); x.fillStyle = "#c08aff"; x.fill(); x.lineWidth = 5; x.strokeStyle = OL; x.stroke();
		shine(x, 30, 28, 9, 6); eyes(x, 45, 42, 10, 4); cheeks(x, 45, 54, 19, 5);
		save("e_jelly", c);
	}
	// ボス: ケーキのお城
	{
		const [c, x] = mk(320, 260);
		const tier = (cx, cy, w, h, col, cream) => {
			x.fillStyle = col; x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, 16); x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
			x.fillStyle = cream; x.beginPath(); x.moveTo(cx - w / 2 + 6, cy - h / 2 + 4);
			for (let k = 0; k <= 8; k++) { const px = cx - w / 2 + 6 + (w - 12) * k / 8; x.lineTo(px, cy - h / 2 + 4 + (k % 2 ? 18 : 6)); }
			x.lineTo(cx + w / 2 - 6, cy - h / 2 + 4); x.closePath(); x.fill();
		};
		tier(160, 196, 290, 90, "#ff8ab8", "#fff4f8");
		tier(160, 122, 210, 76, "#ffd27a", "#fffaf0");
		tier(160, 60, 130, 60, "#8ad8ff", "#ffffff");
		// いちごと目
		ell(x, 160, 26, 18, 16, "#ff4a6a", OL, 4); x.fillStyle = "#4ab84a"; x.fillRect(154, 6, 12, 8);
		eyes(x, 160, 198, 40, 9); cheeks(x, 160, 216, 70, 10);
		x.lineWidth = 5; x.strokeStyle = OL; x.beginPath(); x.arc(160, 214, 14, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
		for (let k = 0; k < 6; k++) ell(x, 52 + k * 43, 164, 6, 6, ["#ff4a6a", "#ffe04a", "#6ac8ff"][k % 3]);
		// 大砲(左右)
		[-1, 1].forEach((s) => { x.fillStyle = "#7a6ad0"; x.beginPath(); x.roundRect(160 + s * 150 - 16, 196, 32, 50, 10); x.fill(); x.lineWidth = 5; x.strokeStyle = OL; x.stroke(); });
		save("boss", c);
	}
	// 雲(撃つとベルが出る)
	{
		const [c, x] = mk(150, 100);
		[[45, 60, 30], [80, 46, 36], [112, 62, 28], [75, 70, 34]].forEach((q) => ell(x, q[0], q[1], q[2], q[2], "#ffffff"));
		x.globalCompositeOperation = "destination-over";
		[[45, 60, 34], [80, 46, 40], [112, 62, 32], [75, 70, 38]].forEach((q) => ell(x, q[0], q[1], q[2], q[2], OL));
		x.globalCompositeOperation = "source-over";
		ell(x, 72, 76, 40, 8, "rgba(160,200,255,0.5)");
		save("cloud", c);
	}
	// ベル(4色)
	const bell = (name, col, dark) => {
		const [c, x] = mk(80, 84);
		x.beginPath(); x.moveTo(40, 10); x.bezierCurveTo(16, 10, 16, 42, 12, 60); x.lineTo(68, 60); x.bezierCurveTo(64, 42, 64, 10, 40, 10); x.closePath();
		x.fillStyle = col; x.fill(); x.lineWidth = 5; x.strokeStyle = OL; x.stroke();
		x.fillStyle = dark; x.fillRect(12, 56, 56, 9); x.strokeRect(12, 56, 56, 9);
		ell(x, 40, 72, 8, 8, dark, OL, 4); ell(x, 40, 8, 6, 5, dark, OL, 3);
		shine(x, 30, 28, 6, 11);
		save(name, c);
	};
	bell("bell_y", "#ffe04a", "#d0a020"); bell("bell_b", "#6ac8ff", "#3a8ad0"); bell("bell_w", "#ffffff", "#b8c0d8"); bell("bell_r", "#ff6a7a", "#c03a4a");
	// たま
	{
		let [c, x] = mk(20, 40); ell(x, 10, 20, 7, 17, "#fff6a0", "#ff9a30", 3); save("shot", c);
		[c, x] = mk(28, 28); ell(x, 14, 14, 11, 11, "#ff5a9a", "#ffffff", 4); ell(x, 11, 11, 3, 3, "#ffffff"); save("ebullet", c);
		[c, x] = mk(48, 48);
		x.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 9 : 22; x.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); } x.closePath();
		x.fillStyle = "#ffe04a"; x.fill(); x.lineWidth = 3; x.strokeStyle = "#ff8a30"; x.stroke(); save("fx_star", c);
		[c, x] = mk(64, 64); const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,230,140,0.7)"); g.addColorStop(1, "rgba(255,180,80,0)");
		x.fillStyle = g; x.fillRect(0, 0, 64, 64); save("fx_glow", c);
		[c, x] = mk(160, 160); ell(x, 80, 80, 74, 74, "rgba(255,120,160,0.12)", "rgba(255,120,160,0.85)", 6); ell(x, 80, 80, 66, 66, null, "rgba(255,255,255,0.7)", 2); save("barrier", c);
		[c, x] = mk(128, 128); ell(x, 64, 64, 58, 58, null, "#ffffff", 10); save("fx_ring", c);
	}
	// ======== 背景(1280x720 を縦につなげる): 空と島 ========
	{
		const [c, x] = mk(1280, 720);
		// 上下につなげても切れ目が出ないよう、空は1色
		x.fillStyle = "#a6e0ff"; x.fillRect(0, 0, 1280, 720);
		// 水玉もよう
		for (let yy = 0; yy < 720; yy += 60) for (let xx = (yy / 60) % 2 ? 30 : 0; xx < 1280; xx += 60) ell(x, xx, yy, 6, 6, "rgba(255,255,255,0.25)");
		// 浮き島
		const island = (cx, cy, s) => {
			x.save(); x.translate(cx, cy); x.scale(s, s);
			x.fillStyle = "#c8865a"; x.beginPath(); x.moveTo(-90, 0); x.quadraticCurveTo(0, 110, 90, 0); x.closePath(); x.fill(); x.lineWidth = 5; x.strokeStyle = "#7a4a3a"; x.stroke();
			ell(x, 0, 0, 96, 22, "#7ad86a", "#3a8a3a", 5);
			ell(x, -40, -18, 16, 14, "#ff8ab8", OL, 3); ell(x, 30, -24, 22, 20, "#4ab84a", "#2a6a2a", 3); x.fillStyle = "#8a5a32"; x.fillRect(27, -10, 6, 14);
			x.restore();
		};
		save("bg", c);
		const [ci, xi] = mk(220, 140);
		x.save(); const xs = x; // 島は別の絵に
		(function () {
			const xx = xi;
			xx.save(); xx.translate(110, 40);
			xx.fillStyle = "#c8865a"; xx.beginPath(); xx.moveTo(-90, 0); xx.quadraticCurveTo(0, 110, 90, 0); xx.closePath(); xx.fill(); xx.lineWidth = 5; xx.strokeStyle = "#7a4a3a"; xx.stroke();
			ell(xx, 0, 0, 96, 22, "#7ad86a", "#3a8a3a", 5);
			ell(xx, -40, -18, 16, 14, "#ff8ab8", OL, 3); ell(xx, 30, -24, 22, 20, "#4ab84a", "#2a6a2a", 3); xx.fillStyle = "#8a5a32"; xx.fillRect(27, -10, 6, 14);
			xx.restore();
		})();
		xs.restore();
		save("island", ci);
		const [c2, x2] = mk(400, 150);
		[[90, 90, 50], [160, 66, 62], [240, 80, 54], [300, 96, 40], [180, 104, 56]].forEach((q) => ell(x2, q[0], q[1], q[2], q[2] * 0.75, "rgba(255,255,255,0.85)"));
		save("bgcloud", c2);
	}
	return out;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build);
	// ロゴ(1000x300)
	res.logo = await p.evaluate(async (ship) => {
		const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = ship; });
		const c = document.createElement("canvas"); c.width = 1000; c.height = 300; const x = c.getContext("2d");
		const OL = "#3a2050";
		x.lineJoin = "round";
		const word = (t, cx, cy, size, cols) => {
			x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
			x.lineWidth = size * 0.34; x.strokeStyle = OL; x.strokeText(t, cx + 4, cy + 7);
			x.lineWidth = size * 0.3; x.strokeText(t, cx, cy);
			x.lineWidth = size * 0.16; x.strokeStyle = "#ffffff"; x.strokeText(t, cx, cy);
			const g = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
			x.fillStyle = g; x.fillText(t, cx, cy);
		};
		word("ぽっぷん", 400, 92, 100, ["#ffb0d8", "#ff4a8a"]);
		word("スカイ", 640, 206, 120, ["#a8eaff", "#3a9ae8"]);
		x.drawImage(im, 820, 40, 150, 162);
		// 星
		const st = (cx, cy, r, col) => { x.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.42 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 4; x.strokeStyle = OL; x.stroke(); };
		st(130, 220, 30, "#ffe04a"); st(80, 140, 18, "#ff8ab8"); st(950, 240, 22, "#ffe04a");
		return c.toDataURL("image/png");
	}, res.ship0);
	await b.close();
	Object.keys(res).forEach((k) => fs.writeFileSync(path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64")));
	console.log("wrote", Object.keys(res).length, "images");
})();
