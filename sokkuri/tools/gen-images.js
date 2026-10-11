// 画像アセット生成スクリプト: Chromium の canvas で描画して image/ 以下に PNG を書き出す
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");

function drawAll() {
	const out = {};
	// パーツは透明なふちを切り落として保存する
	const crop = (c) => {
		const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
		let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
		for (let y = 0; y < c.height; y++) {
			for (let x = 0; x < c.width; x++) {
				if (d[(y * c.width + x) * 4 + 3] > 20) {
					x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
				}
			}
		}
		const o = document.createElement("canvas");
		o.width = x1 - x0 + 3;
		o.height = y1 - y0 + 3;
		o.getContext("2d").drawImage(c, -x0 + 1, -y0 + 1);
		return o;
	};
	// ---- 古い絵本のような仕上げ(セピアがかった色・こげ茶のふち線・斜線の陰・紙の目) ----
	const INKD = "#3b2616";
	const grade = (c, amt) => {
		const x = c.getContext("2d");
		const im = x.getImageData(0, 0, c.width, c.height);
		const d = im.data;
		for (let i = 0; i < d.length; i += 4) {
			if (d[i + 3] === 0) continue;
			const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
			let r = d[i] + (l - d[i]) * amt, gg = d[i + 1] + (l - d[i + 1]) * amt, b = d[i + 2] + (l - d[i + 2]) * amt;
			r = r * 1.0 + 6; gg = gg * 0.94 + 4; b = b * 0.8 + 2;
			// 白は生成り色に、黒はこげ茶に
			d[i] = Math.min(255, r * 0.94 + 10); d[i + 1] = Math.min(255, gg * 0.94 + 8); d[i + 2] = Math.min(255, b * 0.94 + 4);
		}
		x.putImageData(im, 0, 0);
	};
	const hatch = (x, w, h, step, color, lw) => {
		x.strokeStyle = color; x.lineWidth = lw;
		x.beginPath();
		for (let k = -h; k < w; k += step) { x.moveTo(k, h); x.lineTo(k + h, 0); }
		x.stroke();
	};
	let grainSeed = 7;
	const grainRnd = () => { grainSeed = (grainSeed * 1103515245 + 12345) & 0x7fffffff; return grainSeed / 0x7fffffff; };
	const grain = (x, w, h, n, alpha) => {
		for (let i = 0; i < n; i++) {
			x.fillStyle = grainRnd() < 0.5 ? "rgba(80,50,20," + alpha + ")" : "rgba(255,245,220," + alpha + ")";
			x.fillRect(grainRnd() * w, grainRnd() * h, 1 + grainRnd() * 2, 1 + grainRnd() * 2);
		}
	};
	const stylePart = (c) => {
		const w = c.width, h = c.height;
		grade(c, 0.36);
		const x = c.getContext("2d");
		x.save();
		x.globalCompositeOperation = "source-atop";
		const sh = x.createLinearGradient(0, 0, w, h);
		sh.addColorStop(0, "rgba(255,240,200,0.18)");
		sh.addColorStop(0.55, "rgba(255,240,200,0)");
		sh.addColorStop(1, "rgba(70,40,15,0.30)");
		x.fillStyle = sh; x.fillRect(0, 0, w, h);
		x.save();
		x.beginPath(); x.moveTo(w * 0.35, h); x.lineTo(w, h * 0.35); x.lineTo(w, h); x.closePath(); x.clip();
		hatch(x, w, h, 5, "rgba(60,35,12,0.16)", 1.2);
		x.restore();
		grain(x, w, h, w * h / 30, 0.10);
		x.restore();
		// こげ茶のふち線
		const sil = document.createElement("canvas");
		sil.width = w; sil.height = h;
		const sx = sil.getContext("2d");
		sx.drawImage(c, 0, 0);
		sx.globalCompositeOperation = "source-in";
		sx.fillStyle = INKD; sx.fillRect(0, 0, w, h);
		x.save();
		x.globalCompositeOperation = "destination-over";
		for (let k = 0; k < 12; k++) {
			const a = k * Math.PI / 6;
			x.drawImage(sil, Math.cos(a) * 2.6, Math.sin(a) * 2.6);
		}
		x.restore();
	};
	const styleBg = (c) => {
		const w = c.width, h = c.height;
		grade(c, 0.32);
		const x = c.getContext("2d");
		hatch(x, w, h, 7, "rgba(70,45,20,0.05)", 1);
		grain(x, w, h, 9000, 0.07);
		const v = x.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
		v.addColorStop(0, "rgba(60,35,15,0)");
		v.addColorStop(1, "rgba(60,35,15,0.38)");
		x.fillStyle = v; x.fillRect(0, 0, w, h);
	};
	const PLAIN = ["ghost", "dot", "spark", "ring", "glow", "logo", "frame", "frame_s"];
	const make = (name, w, h, fn, noCrop) => {
		const c = document.createElement("canvas");
		const pad = noCrop ? 0 : 8;
		c.width = w + pad * 2;
		c.height = h + pad * 2;
		const ctx = c.getContext("2d");
		ctx.translate(pad, pad);
		fn(ctx, w, h);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		if (PLAIN.indexOf(name) < 0) {
			if (name.indexOf("bg_") === 0) styleBg(c);
			else stylePart(c);
		}
		// 背景は写真のように色数が多いので、軽い JPEG で保存する
		out[name] = name.indexOf("bg_") === 0 ? c.toDataURL("image/jpeg", 0.86) : (noCrop ? c : crop(c)).toDataURL("image/png");
	};
	const E = (ctx, x, y, rx, ry, fill, stroke, lw, rot) => {
		ctx.beginPath();
		ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
		if (fill) { ctx.fillStyle = fill; ctx.fill(); }
		if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
	};
	const R = (ctx, x, y, w, h, r, fill, stroke, lw) => {
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, r);
		if (fill) { ctx.fillStyle = fill; ctx.fill(); }
		if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
	};
	const poly = (ctx, pts, fill, stroke, lw) => {
		ctx.beginPath();
		pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
		ctx.closePath();
		if (fill) { ctx.fillStyle = fill; ctx.fill(); }
		if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
	};
	const line = (ctx, pts, color, lw) => {
		ctx.beginPath();
		pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
		ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
		ctx.stroke();
	};
	const eyes = (ctx, x, y, gap, r) => {
		E(ctx, x - gap, y, r, r * 1.2, "#3a2a20");
		E(ctx, x + gap, y, r, r * 1.2, "#3a2a20");
	};
	const INK = "#4a3020";
	const sun = (ctx, cx, cy, r, c1, c2) => {
		for (let i = 0; i < 12; i++) {
			const a = i * Math.PI / 6;
			line(ctx, [[cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6)], [cx + Math.cos(a) * (r + 20), cy + Math.sin(a) * (r + 20)]], c2, 6);
		}
		E(ctx, cx, cy, r, r, c1, c2, 4);
	};
	const cloud = (ctx, cx, cy, s, fill, stroke) => {
		[[-0.6, 0.15, 0.45], [-0.2, -0.15, 0.55], [0.3, -0.05, 0.5], [0.65, 0.2, 0.38], [0.05, 0.25, 0.5]].forEach((q) => E(ctx, cx + q[0] * s, cy + q[1] * s, q[2] * s, q[2] * s * 0.85, fill, stroke, 3));
		[[-0.6, 0.15, 0.45], [-0.2, -0.15, 0.55], [0.3, -0.05, 0.5], [0.65, 0.2, 0.38], [0.05, 0.25, 0.5]].forEach((q) => E(ctx, cx + q[0] * s, cy + q[1] * s, q[2] * s - 3, q[2] * s * 0.85 - 3, fill));
	};
	const flower = (ctx, cx, cy, r, petal, center) => {
		for (let i = 0; i < 6; i++) {
			const a = i * Math.PI / 3;
			E(ctx, cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8, r * 0.55, r * 0.55, petal, INK, 2);
		}
		E(ctx, cx, cy, r * 0.5, r * 0.5, center, INK, 2);
	};
	const stem = (ctx, x, y0, y1) => {
		line(ctx, [[x, y0], [x, y1]], "#4a8a3a", 6);
		E(ctx, x - 12, (y0 + y1) / 2 + 6, 12, 6, "#5ab04a", "#3a7a2a", 2, -0.5);
		E(ctx, x + 12, (y0 + y1) / 2 + 16, 12, 6, "#5ab04a", "#3a7a2a", 2, 0.5);
	};
	const tree = (ctx, cx, top, w, h, leaf, leafDark, dots) => {
		R(ctx, cx - 10, top + h * 0.55, 20, h * 0.45, 4, "#8a5a32", INK, 3);
		[[0, 0.25, 0.5], [-0.32, 0.4, 0.36], [0.32, 0.4, 0.36], [0, 0.48, 0.4]].forEach((q) => E(ctx, cx + q[0] * w, top + q[1] * h, q[2] * w, q[2] * w * 0.8, leaf, leafDark, 3));
		if (dots) for (let i = 0; i < 14; i++) E(ctx, cx + Math.sin(i * 2.3) * w * 0.38, top + h * 0.15 + (i * 37 % 100) / 100 * h * 0.42, 4, 4, dots);
	};
	const rabbit = (ctx, cx, cy, body, ear) => {
		E(ctx, cx - 14, cy - 40, 7, 22, body, INK, 2.5, -0.2);
		E(ctx, cx + 6, cy - 42, 7, 22, body, INK, 2.5, 0.25);
		E(ctx, cx - 14, cy - 40, 3, 14, ear, null, 0, -0.2);
		E(ctx, cx + 6, cy - 42, 3, 14, ear, null, 0, 0.25);
		E(ctx, cx + 14, cy + 8, 30, 20, body, INK, 2.5);
		E(ctx, cx - 6, cy - 10, 20, 17, body, INK, 2.5);
		E(ctx, cx + 42, cy + 2, 8, 8, body, INK, 2.5);
		E(ctx, cx - 12, cy - 12, 2.5, 3, "#3a2a20");
		E(ctx, cx - 20, cy - 4, 4, 2.5, "#f0a0a8");
	};
	// ---- 背景(640x480): ヨーロッパの古い町なみが見える野原 ----
	let seed = 5;
	const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
	// 遠くの町(家・教会の塔・風車)
	const house = (ctx, x, base, w, h, wall, roof, win, snow) => {
		R(ctx, x, base - h, w, h, 0, wall, INK, 1.5);
		poly(ctx, [[x - 4, base - h], [x + w / 2, base - h - w * 0.7], [x + w + 4, base - h]], roof, INK, 1.5);
		if (snow) poly(ctx, [[x - 4, base - h], [x + w / 2, base - h - w * 0.7], [x + w + 4, base - h], [x + w / 2, base - h - w * 0.45]], "#f4f0e6");
		R(ctx, x + w * 0.62, base - h - w * 0.55, 5, 12, 0, wall, INK, 1);
		for (let r = 0; r < Math.floor(h / 13); r++) {
			for (let c2 = 0; c2 < Math.floor(w / 11); c2++) R(ctx, x + 4 + c2 * 11, base - h + 5 + r * 13, 5, 7, 0, win);
		}
	};
	const town = (ctx, base, wall, roof, win, snow) => {
		const xs = [12, 46, 74, 112, 150, 330, 362, 396, 430, 470, 520, 556, 594];
		xs.forEach((x, k) => house(ctx, x, base + (k % 3) * 3, 24 + (k * 7) % 16, 22 + (k * 11) % 20, wall[k % wall.length], roof[k % roof.length], win, snow));
		// 教会
		R(ctx, 196, base - 70, 26, 70, 0, wall[0], INK, 1.5);
		poly(ctx, [[192, base - 70], [209, base - 122], [226, base - 70]], roof[1], INK, 1.5);
		line(ctx, [[209, base - 122], [209, base - 134]], INK, 2); line(ctx, [[204, base - 129], [214, base - 129]], INK, 2);
		E(ctx, 209, base - 54, 6, 6, "#f4ead0", INK, 1.2);
		R(ctx, 222, base - 34, 60, 34, 0, wall[1], INK, 1.5);
		poly(ctx, [[218, base - 34], [252, base - 56], [286, base - 34]], roof[0], INK, 1.5);
		if (snow) poly(ctx, [[218, base - 34], [252, base - 56], [286, base - 34], [252, base - 46]], "#f4f0e6");
		// 風車
		R(ctx, 288, base - 46, 16, 46, 2, wall[2 % wall.length], INK, 1.5);
		poly(ctx, [[286, base - 46], [296, base - 60], [306, base - 46]], roof[2 % roof.length], INK, 1.5);
		[0.4, 1.97, 3.54, 5.11].forEach((a) => poly(ctx, [[296, base - 50], [296 + Math.cos(a) * 30 - Math.sin(a) * 5, base - 50 + Math.sin(a) * 30 + Math.cos(a) * 5],
			[296 + Math.cos(a) * 30, base - 50 + Math.sin(a) * 30]], "#e8dcc0", INK, 1));
		// 細い木(ポプラ)
		[[170, 0], [318, 1], [500, 0], [624, 1]].forEach((q) => {
			E(ctx, q[0], base - 26, 7, 24, q[1] ? "#6a7a3a" : "#7a8a44", INK, 1.2);
			line(ctx, [[q[0], base - 4], [q[0], base + 4]], INK, 2);
		});
	};
	const fence = (ctx, y, color) => {
		line(ctx, [[0, y + 6], [640, y + 2]], color, 3);
		line(ctx, [[0, y + 16], [640, y + 12]], color, 3);
		for (let x = 6; x < 640; x += 34) R(ctx, x, y - 2 - x / 160, 6, 26, 1, color, INK, 1);
	};
	const path2 = (ctx, fill, stone) => {
		ctx.fillStyle = fill;
		ctx.beginPath(); ctx.moveTo(296, 300); ctx.quadraticCurveTo(250, 380, 300, 480); ctx.lineTo(420, 480); ctx.quadraticCurveTo(330, 390, 316, 300); ctx.fill();
		for (let k = 0; k < 40; k++) {
			const t = k / 40, y = 304 + t * 172;
			const cx = 306 + (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * -40 + t * t * 54;
			E(ctx, cx + (rnd() - 0.5) * 40 * t, y, 4 + t * 7, 2 + t * 3, stone, null);
		}
	};
	const tufts = (ctx, n, y0, color, flowers) => {
		for (let k = 0; k < n; k++) {
			const x = rnd() * 640, y = y0 + rnd() * (470 - y0);
			const s = 0.6 + (y - y0) / (470 - y0);
			line(ctx, [[x - 4 * s, y], [x - 6 * s, y - 8 * s]], color, 1.6);
			line(ctx, [[x, y], [x, y - 11 * s]], color, 1.6);
			line(ctx, [[x + 4 * s, y], [x + 7 * s, y - 8 * s]], color, 1.6);
			if (flowers && k % 3 === 0) E(ctx, x, y - 11 * s, 2.4 * s, 2.4 * s, flowers[k % flowers.length]);
		}
	};
	const bushes = (ctx, color, dark, dots) => {
		[[40, 336], [140, 344], [520, 338], [612, 346]].forEach((q) => {
			E(ctx, q[0] - 14, q[1], 20, 14, color, dark, 1.5); E(ctx, q[0] + 12, q[1] + 2, 18, 12, color, dark, 1.5); E(ctx, q[0], q[1] - 8, 18, 14, color, dark, 1.5);
			if (dots) for (let k = 0; k < 6; k++) E(ctx, q[0] - 20 + rnd() * 40, q[1] - 14 + rnd() * 20, 2.2, 2.2, dots);
		});
	};
	const meadow = (name, o) => make(name, 640, 480, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, 300);
		g.addColorStop(0, o.sky1); g.addColorStop(1, o.sky2);
		ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
		if (o.sky) o.sky(ctx);
		// 遠くの山
		ctx.fillStyle = o.far;
		ctx.beginPath(); ctx.moveTo(0, 230); ctx.lineTo(70, 196); ctx.lineTo(130, 214); ctx.lineTo(210, 180); ctx.lineTo(300, 220); ctx.lineTo(400, 186);
		ctx.lineTo(480, 210); ctx.lineTo(560, 182); ctx.lineTo(640, 214); ctx.lineTo(640, 300); ctx.lineTo(0, 300); ctx.fill();
		ctx.fillStyle = o.hill1;
		ctx.beginPath(); ctx.moveTo(0, 262); ctx.quadraticCurveTo(160, 236, 340, 256); ctx.quadraticCurveTo(500, 238, 640, 252); ctx.lineTo(640, 480); ctx.lineTo(0, 480); ctx.fill();
		town(ctx, 262, o.walls, o.roofs, o.win, o.snow);
		ctx.fillStyle = o.hill2;
		ctx.beginPath(); ctx.moveTo(0, 292); ctx.quadraticCurveTo(220, 266, 420, 290); ctx.quadraticCurveTo(540, 280, 640, 294); ctx.lineTo(640, 480); ctx.lineTo(0, 480); ctx.fill();
		// 畑のうね
		for (let k = 0; k < 7; k++) line(ctx, [[0, 300 + k * 5], [640, 296 + k * 5]], "rgba(60,40,20,0.10)", 1.5);
		ctx.fillStyle = o.ground; ctx.fillRect(0, 326, w, 154);
		path2(ctx, o.path, o.stone);
		fence(ctx, 316, o.fence);
		bushes(ctx, o.bush, o.bushDark, o.bushDots);
		tufts(ctx, 70, 340, o.grass, o.flowers);
		if (o.extra) o.extra(ctx, w, h);
	}, true);
	meadow("bg_spring", {
		sky1: "#b8d8ec", sky2: "#eef2e6", far: "#a8b8c8", hill1: "#b4cc8a", hill2: "#9cc078", ground: "#a2c67c",
		walls: ["#f0e2c4", "#e8d0a8", "#f4ead4"], roofs: ["#b8583a", "#8a4a32", "#c87a4a"], win: "#6a5a4a",
		path: "#d8c49a", stone: "rgba(150,120,80,0.45)", fence: "#a07a4a", bush: "#f0b8c8", bushDark: "#c88898", bushDots: "#fff0f4",
		grass: "#6a9a4a", flowers: ["#fff8f0", "#ffd0e0", "#fff0a0"]
	});
	meadow("bg_summer", {
		sky1: "#6ab0e0", sky2: "#d4ecf4", far: "#7a9ab8", hill1: "#6aa84a", hill2: "#58983c", ground: "#6eb04e",
		walls: ["#f4e8cc", "#e8d4ac", "#f8f0dc"], roofs: ["#c0502e", "#3a6a8a", "#d08a3a"], win: "#4a5a6a",
		path: "#e0cc9a", stone: "rgba(150,120,80,0.45)", fence: "#b08850", bush: "#4a8a34", bushDark: "#2e6a22", bushDots: "#ffe060",
		grass: "#3a7a2a", flowers: ["#ffe060", "#ffffff"]
	});
	meadow("bg_autumn", {
		sky1: "#232848", sky2: "#6a587a", far: "#4a4458", hill1: "#7a6a40", hill2: "#94804a", ground: "#a88e56",
		walls: ["#8a7a68", "#7a6a5a", "#9a8a74"], roofs: ["#5a3a2a", "#4a3a3a", "#6a4a32"], win: "#ffd27a",
		path: "#b8a070", stone: "rgba(90,70,40,0.45)", fence: "#6a5032", bush: "#b8642a", bushDark: "#8a4a1a", bushDots: "#e8a040",
		grass: "#6a5a2a", flowers: ["#e8a040", "#c86a2a"],
		sky: (ctx) => { for (let k = 0; k < 70; k++) E(ctx, rnd() * 640, rnd() * 200, 1.3, 1.3, "rgba(255,250,220,0.85)"); }
	});
	meadow("bg_winter", {
		sky1: "#98aac4", sky2: "#e2e6ee", far: "#c4ccd8", hill1: "#eef0f4", hill2: "#e4e8f0", ground: "#f2f4f8",
		walls: ["#d8c8a8", "#c8b494", "#e4d8bc"], roofs: ["#7a4a3a", "#5a4a5a", "#8a5a3a"], win: "#ffd890", snow: true,
		path: "#d8d4cc", stone: "rgba(120,110,100,0.35)", fence: "#8a6a4a", bush: "#e8ecf2", bushDark: "#a8b0c0", bushDots: null,
		grass: "rgba(120,130,140,0.4)", flowers: null,
		sky: (ctx) => { for (let k = 0; k < 90; k++) E(ctx, rnd() * 640, rnd() * 470, 2.2, 2.2, "rgba(255,255,255,0.9)"); }
	});
	// ---- 古い洋館の書斎 ----
	make("bg_room", 640, 480, (ctx, w, h) => {
		ctx.fillStyle = "#c8a878"; ctx.fillRect(0, 0, w, 300);
		// 壁紙のもよう
		for (let y = 10; y < 210; y += 40) {
			for (let x = (y / 40) % 2 ? 20 : 0; x < w; x += 40) {
				E(ctx, x, y, 7, 10, "rgba(120,70,40,0.22)");
				E(ctx, x, y - 12, 3, 3, "rgba(120,70,40,0.22)");
				line(ctx, [[x - 9, y + 8], [x, y + 14], [x + 9, y + 8]], "rgba(120,70,40,0.2)", 1.5);
			}
		}
		for (let x = 0; x < w; x += 40) R(ctx, x, 0, 2, 210, 0, "rgba(120,70,40,0.12)");
		// 天井の飾りぶち
		R(ctx, 0, 0, w, 14, 0, "#8a5a32", INK, 1.5);
		for (let x = 4; x < w; x += 12) R(ctx, x, 14, 6, 6, 1, "#a8784a", INK, 1);
		// 腰板
		R(ctx, 0, 206, w, 8, 0, "#7a4a2a", INK, 1.5);
		R(ctx, 0, 214, w, 80, 0, "#8a5a36");
		for (let x = 10; x < w; x += 80) R(ctx, x, 224, 64, 60, 3, "#946440", "#5a3a20", 2);
		// 本棚(左右のはし)
		[[0, 46], [594, 46]].forEach((q) => {
			R(ctx, q[0], 40, q[1], 256, 0, "#6a3e22", INK, 2);
			for (let r = 0; r < 5; r++) {
				const y = 46 + r * 50;
				R(ctx, q[0] + 2, y + 42, q[1] - 4, 5, 0, "#4a2a16");
				let x = q[0] + 4;
				let k = r;
				while (x < q[0] + q[1] - 8) {
					const bw = 5 + (k * 3) % 5, bh = 26 + (k * 7) % 14;
					R(ctx, x, y + 42 - bh, bw, bh, 1, ["#8a3a2a", "#3a5a4a", "#a8843a", "#4a3a6a", "#6a4a2a"][k % 5], INK, 0.8);
					x += bw + 1; k++;
				}
			}
		});
		// 床(板張り)
		ctx.fillStyle = "#8a5a34"; ctx.fillRect(0, 296, w, 184);
		for (let y = 296; y < h; y += 22) {
			R(ctx, 0, y, w, 2, 0, "rgba(50,25,10,0.35)");
			for (let x = ((y / 22) % 2) * 60; x < w; x += 120) R(ctx, x, y, 2, 22, 0, "rgba(50,25,10,0.25)");
		}
		R(ctx, 0, 290, w, 10, 0, "#5a3420", INK, 1.5);
		// じゅうたん
		E(ctx, 320, 410, 250, 54, "#8a2e2a", INK, 2);
		E(ctx, 320, 410, 230, 46, null, "#d8a84a", 3);
		E(ctx, 320, 410, 200, 36, "#a8443a", null);
		for (let k = 0; k < 18; k++) {
			const a = k * Math.PI / 9;
			E(ctx, 320 + Math.cos(a) * 150, 410 + Math.sin(a) * 26, 6, 3, "#d8a84a");
		}
		E(ctx, 320, 410, 60, 14, null, "#d8a84a", 2);
		// 窓からの光
		poly(ctx, [[200, 0], [440, 0], [520, 480], [120, 480]], "rgba(255,240,200,0.06)");
	}, true);
	// ---- 額縁(金の飾りぶち) ----
	const ornate = (ctx, w, h, b) => {
		const g = ctx.createLinearGradient(0, 0, w, h);
		g.addColorStop(0, "#e0c070"); g.addColorStop(0.3, "#a8803a"); g.addColorStop(0.6, "#d8b468"); g.addColorStop(1, "#8a6428");
		ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
		ctx.clearRect(b, b, w - b * 2, h - b * 2);
		ctx.strokeStyle = "#4a3014"; ctx.lineWidth = 2.5;
		ctx.strokeRect(1.5, 1.5, w - 3, h - 3); ctx.strokeRect(b - 1.5, b - 1.5, w - b * 2 + 3, h - b * 2 + 3);
		// 玉のもよう
		const bead = Math.max(1.6, b * 0.14);
		for (let x = b; x < w - b; x += bead * 4) { E(ctx, x, b * 0.5, bead, bead, "#f4dc98", "#6a4a1a", 1); E(ctx, x, h - b * 0.5, bead, bead, "#f4dc98", "#6a4a1a", 1); }
		for (let y = b; y < h - b; y += bead * 4) { E(ctx, b * 0.5, y, bead, bead, "#f4dc98", "#6a4a1a", 1); E(ctx, w - b * 0.5, y, bead, bead, "#f4dc98", "#6a4a1a", 1); }
		// 四すみの飾り
		[[0, 0], [w, 0], [0, h], [w, h]].forEach((q) => {
			const cx = q[0] + (q[0] ? -1 : 1) * b * 0.5, cy = q[1] + (q[1] ? -1 : 1) * b * 0.5;
			E(ctx, cx, cy, b * 0.62, b * 0.62, "#e8c878", "#4a3014", 2);
			E(ctx, cx, cy, b * 0.3, b * 0.3, "#a8803a", "#4a3014", 1.5);
		});
	};
	make("frame", 680, 520, (ctx, w, h) => ornate(ctx, w, h, 20), true);
	make("frame_s", 340, 260, (ctx, w, h) => ornate(ctx, w, h, 10), true);
	// ---- パーツ ----
	// 春
	make("p_sakura", 200, 200, (ctx) => tree(ctx, 100, 10, 170, 180, "#ffc8dc", "#e890b0", "#ff8ab0"));
	make("p_tulip_r", 80, 120, (ctx) => { stem(ctx, 40, 40, 115); poly(ctx, [[18, 20], [26, 50], [54, 50], [62, 20], [50, 34], [40, 14], [30, 34]], "#ff5a6a", INK, 2.5); });
	make("p_tulip_y", 80, 120, (ctx) => { stem(ctx, 40, 40, 115); poly(ctx, [[18, 20], [26, 50], [54, 50], [62, 20], [50, 34], [40, 14], [30, 34]], "#ffd23a", INK, 2.5); });
	make("p_butterfly", 100, 80, (ctx) => {
		E(ctx, 30, 28, 22, 18, "#ffb0d0", INK, 2.5, -0.4); E(ctx, 70, 28, 22, 18, "#ffb0d0", INK, 2.5, 0.4);
		E(ctx, 34, 54, 14, 12, "#ffe08a", INK, 2.5); E(ctx, 66, 54, 14, 12, "#ffe08a", INK, 2.5);
		E(ctx, 50, 40, 5, 22, "#5a4632");
		line(ctx, [[48, 20], [42, 6]], INK, 2); line(ctx, [[52, 20], [58, 6]], INK, 2);
	});
	make("p_cloud", 160, 100, (ctx) => cloud(ctx, 80, 50, 70, "#ffffff", "#c8d8e8"));
	make("p_sun", 140, 140, (ctx) => { sun(ctx, 70, 70, 38, "#ffe066", "#ffb43a"); eyes(ctx, 70, 66, 12, 3.5); });
	make("p_bird", 100, 70, (ctx) => {
		E(ctx, 46, 38, 30, 20, "#6ab4ff", INK, 2.5);
		E(ctx, 70, 26, 14, 13, "#6ab4ff", INK, 2.5);
		poly(ctx, [[82, 26], [94, 30], [82, 33]], "#ffb43a", INK, 2);
		E(ctx, 72, 23, 2.5, 2.5, "#3a2a20");
		poly(ctx, [[30, 32], [10, 12], [46, 30]], "#4a94e0", INK, 2.5);
		poly(ctx, [[18, 40], [2, 46], [18, 50]], "#4a94e0", INK, 2);
	});
	make("p_hiyoko", 80, 80, (ctx) => {
		E(ctx, 40, 44, 30, 28, "#ffe14a", "#c8a000", 3);
		poly(ctx, [[64, 42], [76, 46], [64, 50]], "#ff9a1a", INK, 2);
		E(ctx, 52, 36, 3, 3.5, "#3a2a20");
		E(ctx, 30, 48, 10, 6, "#ffd000", "#c8a000", 2, -0.4);
		line(ctx, [[34, 72], [32, 78]], "#ff9a1a", 3); line(ctx, [[46, 72], [48, 78]], "#ff9a1a", 3);
	});
	// 夏
	make("p_sun_s", 160, 160, (ctx) => { sun(ctx, 80, 80, 46, "#ffcc1a", "#ff7a1a"); eyes(ctx, 80, 74, 14, 4); });
	make("p_himawari_l", 110, 200, (ctx) => { stem(ctx, 55, 70, 196); flower(ctx, 55, 52, 42, "#ffcc1a", "#8a5a1a"); });
	make("p_himawari_s", 80, 140, (ctx) => { stem(ctx, 40, 50, 136); flower(ctx, 40, 38, 28, "#ffe066", "#8a5a1a"); });
	make("p_nyudo", 200, 140, (ctx) => { cloud(ctx, 100, 90, 70, "#ffffff", "#c8d8e8"); cloud(ctx, 100, 50, 50, "#ffffff", "#c8d8e8"); });
	make("p_suika", 110, 80, (ctx) => {
		ctx.beginPath(); ctx.moveTo(8, 18); ctx.arc(55, 18, 47, 0, Math.PI); ctx.closePath(); ctx.fillStyle = "#3a9a3a"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(14, 18); ctx.arc(55, 18, 41, 0, Math.PI); ctx.closePath(); ctx.fillStyle = "#ff5a5a"; ctx.fill();
		for (let i = 0; i < 6; i++) E(ctx, 30 + i * 9, 30 + (i % 2) * 10, 2.5, 4, "#2a1a10");
	});
	make("p_ball", 90, 90, (ctx) => {
		const cs = ["#ff5a5a", "#ffffff", "#3a8aff", "#ffffff", "#ffd23a", "#ffffff"];
		for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(45, 45); ctx.arc(45, 45, 40, i * Math.PI / 3, (i + 1) * Math.PI / 3); ctx.closePath(); ctx.fillStyle = cs[i]; ctx.fill(); }
		E(ctx, 45, 45, 40, 40, null, INK, 3); E(ctx, 45, 45, 8, 8, "#ffffff", INK, 2);
	});
	make("p_parasol", 160, 170, (ctx) => {
		line(ctx, [[80, 30], [80, 166]], "#8a6a4a", 6);
		ctx.beginPath(); ctx.moveTo(6, 70); ctx.quadraticCurveTo(80, -20, 154, 70); ctx.closePath();
		ctx.fillStyle = "#ff7a8a"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
		for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(80, 18); ctx.quadraticCurveTo(30 + i * 50, 30, 30 + i * 50 + (i - 1) * 6, 70); ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.stroke(); }
	});
	make("p_kabuto", 100, 80, (ctx) => {
		E(ctx, 56, 48, 34, 24, "#6a3a1a", INK, 3);
		line(ctx, [[56, 26], [56, 70]], "#3a1a08", 2);
		E(ctx, 22, 44, 14, 12, "#4a2a10", INK, 2.5);
		line(ctx, [[14, 40], [4, 18], [12, 14]], "#4a2a10", 5);
		for (let i = 0; i < 3; i++) { line(ctx, [[40 + i * 14, 68], [36 + i * 16, 78]], INK, 3); }
	});
	// 秋
	make("p_moon", 120, 120, (ctx) => {
		E(ctx, 60, 60, 50, 50, "#fff3b0", "#e0c060", 3);
		E(ctx, 44, 46, 8, 6, "rgba(220,190,100,0.6)"); E(ctx, 74, 72, 10, 7, "rgba(220,190,100,0.6)"); E(ctx, 70, 40, 5, 4, "rgba(220,190,100,0.6)");
	});
	make("p_usagi", 120, 110, (ctx) => rabbit(ctx, 50, 66, "#ffffff", "#ffc0cc"));
	make("p_usagi2", 110, 100, (ctx) => { ctx.translate(110, 0); ctx.scale(-0.85, 0.85); rabbit(ctx, 60, 70, "#e8ddd0", "#ffb0bc"); });
	make("p_susuki", 100, 170, (ctx) => {
		[[30, -0.25], [50, 0], [70, 0.25]].forEach((q) => {
			line(ctx, [[50, 168], [q[0], 40]], "#8a7a3a", 3);
			E(ctx, q[0] + q[1] * 20, 30, 10, 30, "#e8dcb0", "#b8a870", 2, q[1]);
		});
	});
	make("p_momiji", 190, 200, (ctx) => tree(ctx, 95, 10, 160, 180, "#ff7a3a", "#c84a1a", "#ffb43a"));
	make("p_dango", 90, 140, (ctx) => {
		line(ctx, [[45, 30], [45, 136]], "#c8a060", 4);
		E(ctx, 45, 40, 20, 20, "#fff6e0", INK, 2.5); E(ctx, 45, 78, 20, 20, "#fff6e0", INK, 2.5); E(ctx, 45, 116, 20, 18, "#fff6e0", INK, 2.5);
	});
	make("p_kinoko", 90, 90, (ctx) => {
		R(ctx, 33, 40, 24, 44, 8, "#fff6e0", INK, 2.5);
		ctx.beginPath(); ctx.moveTo(4, 50); ctx.quadraticCurveTo(45, -14, 86, 50); ctx.closePath(); ctx.fillStyle = "#d8402a"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
		E(ctx, 30, 30, 7, 6, "#ffffff"); E(ctx, 56, 24, 8, 6, "#ffffff"); E(ctx, 70, 40, 5, 4, "#ffffff");
	});
	make("p_tonbo", 110, 70, (ctx) => {
		E(ctx, 40, 22, 22, 9, "rgba(220,240,255,0.9)", "#8aa8c8", 2, -0.2); E(ctx, 40, 44, 22, 9, "rgba(220,240,255,0.9)", "#8aa8c8", 2, 0.2);
		E(ctx, 66, 22, 18, 8, "rgba(220,240,255,0.9)", "#8aa8c8", 2, 0.2); E(ctx, 66, 44, 18, 8, "rgba(220,240,255,0.9)", "#8aa8c8", 2, -0.2);
		R(ctx, 20, 30, 80, 8, 4, "#d84a2a", INK, 2);
		E(ctx, 16, 34, 9, 9, "#d84a2a", INK, 2);
	});
	// 冬
	make("p_snowman", 120, 170, (ctx) => {
		E(ctx, 60, 120, 46, 44, "#ffffff", "#9ab0c8", 3);
		E(ctx, 60, 54, 34, 32, "#ffffff", "#9ab0c8", 3);
		R(ctx, 34, 4, 52, 26, 4, "#d84a4a", INK, 2.5);
		eyes(ctx, 60, 48, 11, 3.5);
		poly(ctx, [[58, 58], [80, 62], [58, 66]], "#ff8a1a", INK, 1.5);
		R(ctx, 28, 80, 64, 12, 6, "#3a7ad8", INK, 2);
	});
	make("p_momi", 140, 190, (ctx) => {
		R(ctx, 62, 150, 16, 36, 3, "#8a5a32", INK, 2.5);
		[[150, 60], [110, 50], [70, 38]].forEach((q, i) => poly(ctx, [[70 - q[1], q[0]], [70, q[0] - 70], [70 + q[1], q[0]]], "#3a7a4a", "#2a5a3a", 3));
		[[136, 54], [96, 44], [56, 32]].forEach((q) => { ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.ellipse(70, q[0] - 24, q[1] * 0.6, 8, 0, 0, Math.PI * 2); ctx.fill(); });
	});
	make("p_kamakura", 170, 120, (ctx) => {
		ctx.beginPath(); ctx.moveTo(4, 116); ctx.quadraticCurveTo(85, -44, 166, 116); ctx.closePath(); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.strokeStyle = "#9ab0c8"; ctx.lineWidth = 3; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(56, 116); ctx.quadraticCurveTo(85, 40, 114, 116); ctx.closePath(); ctx.fillStyle = "#3a3048"; ctx.fill();
		E(ctx, 85, 108, 16, 6, "rgba(255,190,90,0.7)");
	});
	make("p_yukiusagi", 100, 70, (ctx) => {
		E(ctx, 50, 44, 42, 22, "#ffffff", "#9ab0c8", 3);
		E(ctx, 34, 20, 8, 16, "#5ab04a", "#3a7a2a", 2, -0.4); E(ctx, 50, 16, 8, 16, "#5ab04a", "#3a7a2a", 2, 0.2);
		E(ctx, 28, 40, 3.5, 3.5, "#e84a4a"); E(ctx, 44, 38, 3.5, 3.5, "#e84a4a");
	});
	make("p_sori", 140, 80, (ctx) => {
		R(ctx, 16, 24, 110, 18, 6, "#c8402a", INK, 3);
		line(ctx, [[10, 60], [120, 60], [132, 46]], "#8a6a4a", 6);
		line(ctx, [[30, 42], [30, 60]], "#8a6a4a", 5); line(ctx, [[104, 42], [104, 60]], "#8a6a4a", 5);
		line(ctx, [[18, 30], [4, 10]], "#c8a060", 3);
	});
	make("p_yukigumo", 180, 110, (ctx) => { cloud(ctx, 90, 55, 74, "#d8e0ec", "#9aa8bc"); for (let i = 0; i < 5; i++) E(ctx, 40 + i * 25, 100 - (i % 2) * 6, 3, 3, "#ffffff"); });
	make("p_star", 100, 100, (ctx) => {
		const pts = [];
		for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 42; pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]); }
		poly(ctx, pts, "#fff3a0", "#e0c040", 3);
	});
	make("p_robin", 90, 80, (ctx) => {
		E(ctx, 44, 44, 30, 26, "#8a6a4a", INK, 2.5);
		E(ctx, 50, 52, 20, 18, "#e8603a");
		E(ctx, 56, 34, 3, 3, "#3a2a20");
		poly(ctx, [[72, 38], [84, 42], [72, 46]], "#ffb43a", INK, 2);
		poly(ctx, [[16, 40], [2, 30], [6, 50]], "#6a4a32", INK, 2);
		line(ctx, [[40, 70], [38, 78]], INK, 3); line(ctx, [[52, 70], [54, 78]], INK, 3);
	});
	// 家の中
	make("p_window", 160, 140, (ctx) => {
		R(ctx, 6, 6, 148, 128, 6, "#9ad4ff", "#8a5a32", 8);
		line(ctx, [[80, 8], [80, 132]], "#8a5a32", 6); line(ctx, [[8, 70], [152, 70]], "#8a5a32", 6);
		cloud(ctx, 46, 36, 22, "#ffffff", "#c8d8e8");
	});
	make("p_clock", 100, 100, (ctx) => {
		E(ctx, 50, 50, 44, 44, "#fff8e8", "#8a5a32", 6);
		for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; E(ctx, 50 + Math.cos(a) * 34, 50 + Math.sin(a) * 34, 2.5, 2.5, INK); }
		line(ctx, [[50, 50], [50, 22]], INK, 4); line(ctx, [[50, 50], [70, 58]], INK, 3);
	});
	make("p_picture", 130, 110, (ctx) => {
		R(ctx, 4, 4, 122, 102, 4, "#d8b468", "#8a6a2a", 4);
		ctx.fillStyle = "#bfe4ff"; ctx.fillRect(16, 16, 98, 78);
		ctx.fillStyle = "#6ac050"; ctx.beginPath(); ctx.moveTo(16, 94); ctx.lineTo(50, 50); ctx.lineTo(80, 80); ctx.lineTo(96, 62); ctx.lineTo(114, 94); ctx.fill();
		E(ctx, 92, 32, 9, 9, "#ffd23a");
	});
	make("p_lamp", 90, 190, (ctx) => {
		poly(ctx, [[22, 10], [68, 10], [84, 60], [6, 60]], "#ffe8a8", INK, 3);
		line(ctx, [[45, 60], [45, 170]], "#8a6a4a", 6);
		E(ctx, 45, 176, 30, 8, "#8a6a4a", INK, 2.5);
	});
	make("p_table", 180, 120, (ctx) => {
		R(ctx, 6, 20, 168, 18, 4, "#c8884a", INK, 3);
		line(ctx, [[24, 38], [24, 116]], "#a8683a", 9); line(ctx, [[156, 38], [156, 116]], "#a8683a", 9);
		R(ctx, 70, 4, 34, 18, 4, "#ffffff", INK, 2); E(ctx, 87, 4, 14, 4, "#c88a4a");
	});
	make("p_cat", 120, 100, (ctx) => {
		E(ctx, 70, 66, 44, 26, "#ffb45a", INK, 2.5);
		line(ctx, [[110, 62], [118, 34]], "#ffb45a", 9);
		E(ctx, 34, 46, 26, 24, "#ffb45a", INK, 2.5);
		poly(ctx, [[14, 34], [16, 10], [32, 26]], "#ffb45a", INK, 2.5); poly(ctx, [[54, 34], [52, 10], [36, 26]], "#ffb45a", INK, 2.5);
		ctx.beginPath(); ctx.arc(26, 46, 4, Math.PI * 0.1, Math.PI * 0.9); ctx.arc(42, 46, 4, Math.PI * 0.1, Math.PI * 0.9); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
	});
	make("p_plant", 100, 160, (ctx) => {
		poly(ctx, [[24, 104], [76, 104], [68, 156], [32, 156]], "#c8603a", INK, 3);
		[[-0.8, 50], [-0.3, 30], [0.3, 30], [0.8, 50], [0, 20]].forEach((q) => E(ctx, 50 + q[0] * 34, 104 - (104 - q[1]) / 2, 12, (104 - q[1]) / 2, "#5ab04a", "#3a7a2a", 2.5, q[0] * 0.6));
	});
	make("p_sofa", 220, 130, (ctx) => {
		R(ctx, 20, 10, 180, 70, 16, "#6a8ad0", INK, 3);
		R(ctx, 6, 50, 208, 52, 14, "#7a9ae0", INK, 3);
		R(ctx, 2, 40, 34, 70, 12, "#5a7ac0", INK, 3); R(ctx, 184, 40, 34, 70, 12, "#5a7ac0", INK, 3);
		line(ctx, [[30, 102], [30, 124]], "#5a3a20", 7); line(ctx, [[190, 102], [190, 124]], "#5a3a20", 7);
	});
	// サーカス
	const clown = (ctx, cx, cy, suit1, suit2, hair) => {
		poly(ctx, [[cx - 34, cy + 10], [cx + 34, cy + 10], [cx + 44, cy + 86], [cx - 44, cy + 86]], suit1, INK, 3);
		poly(ctx, [[cx, cy + 10], [cx + 34, cy + 10], [cx + 44, cy + 86], [cx, cy + 86]], suit2, INK, 3);
		[0, 1, 2].forEach((i) => E(ctx, cx, cy + 26 + i * 20, 5, 5, "#ffffff", INK, 1.5));
		R(ctx, cx - 40, cy + 86, 34, 12, 6, "#c8402a", INK, 2.5); R(ctx, cx + 6, cy + 86, 34, 12, 6, "#c8402a", INK, 2.5);
		E(ctx, cx - 26, cy - 22, 14, 12, hair, INK, 2); E(ctx, cx + 26, cy - 22, 14, 12, hair, INK, 2);
		E(ctx, cx, cy - 18, 24, 24, "#fff6ee", INK, 2.5);
		poly(ctx, [[cx - 16, cy - 36], [cx, cy - 76], [cx + 16, cy - 36]], suit2, INK, 2.5);
		E(ctx, cx, cy - 78, 6, 6, "#ffe14a", INK, 1.5);
		E(ctx, cx, cy - 14, 7, 7, "#ff3a3a");
		E(ctx, cx - 9, cy - 24, 2.5, 3, "#3a2a20"); E(ctx, cx + 9, cy - 24, 2.5, 3, "#3a2a20");
		ctx.beginPath(); ctx.arc(cx, cy - 8, 10, 0.3, Math.PI - 0.3); ctx.strokeStyle = "#e84a5a"; ctx.lineWidth = 3; ctx.stroke();
		poly(ctx, [[cx - 18, cy + 6], [cx, cy + 14], [cx + 18, cy + 6], [cx, cy - 2]], "#ffffff", INK, 1.5);
	};
	// ---- サーカス(テントの中、観客でいっぱい) ----
	make("bg_circus", 640, 480, (ctx, w, h) => {
		ctx.fillStyle = "#2a1a2a"; ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 12; i++) poly(ctx, [[320, -40], [i * 58 - 20, 150], [(i + 1) * 58 - 20, 150]], i % 2 ? "#ece0c8" : "#a8302e");
		for (let i = 0; i < 12; i++) E(ctx, i * 58 + 9, 150, 30, 14, i % 2 ? "#ece0c8" : "#a8302e");
		// 電球のひも
		for (let r = 0; r < 2; r++) {
			ctx.beginPath(); ctx.moveTo(0, 40 + r * 60);
			for (let x = 0; x < 640; x += 80) ctx.quadraticCurveTo(x + 40, 70 + r * 60, x + 80, 40 + r * 60);
			ctx.strokeStyle = "rgba(40,20,10,0.8)"; ctx.lineWidth = 1.5; ctx.stroke();
			for (let x = 10; x < 640; x += 20) {
				const t = (x % 80) / 80, y = 40 + r * 60 + 30 * t * (1 - t);
				E(ctx, x, y + 3, 5, 5, "rgba(255,220,120,0.35)"); E(ctx, x, y + 3, 2.5, 2.5, "#fff0b0");
			}
		}
		// 柱
		[150, 490].forEach((px) => {
			R(ctx, px - 5, 0, 10, 200, 2, "#c8a050", INK, 1.5);
			for (let y = 10; y < 200; y += 24) line(ctx, [[px - 5, y], [px + 5, y + 12]], "#8a3a2a", 3);
		});
		// 観客席(人の頭がずらっと)
		ctx.fillStyle = "#3a2430"; ctx.fillRect(0, 200, w, 150);
		const cols = ["#5a3a3a", "#3a3a5a", "#4a4a3a", "#6a4a3a", "#3a4a4a"];
		const skins = ["#d8b090", "#c89a78", "#e8c8a8", "#b8886a"];
		for (let r = 0; r < 4; r++) {
			const y = 214 + r * 26;
			for (let x = (r % 2) * 9; x < w + 9; x += 18) {
				const k = Math.floor(x / 18) + r * 7;
				E(ctx, x, y + 14, 9, 9, cols[k % 5]);
				E(ctx, x, y, 6, 7, skins[k % 4]);
				if (k % 5 === 0) { R(ctx, x - 7, y - 7, 14, 3, 0, "#2a1a14"); R(ctx, x - 5, y - 15, 10, 9, 0, "#2a1a14"); }
				if (k % 7 === 3) E(ctx, x, y - 5, 6.5, 3, ["#8a5a2a", "#3a2a1a", "#c8a050"][k % 3]);
			}
			R(ctx, 0, y + 20, w, 4, 0, "rgba(20,10,10,0.6)");
		}
		// スポットライト
		poly(ctx, [[120, 0], [40, 480], [270, 480]], "rgba(255,240,180,0.12)");
		poly(ctx, [[520, 0], [370, 480], [600, 480]], "rgba(255,240,180,0.12)");
		// 舞台
		E(ctx, 320, 420, 330, 90, "#8a2e22");
		for (let k = 0; k < 24; k++) {
			const a = Math.PI * k / 23;
			E(ctx, 320 - Math.cos(a) * 322, 420 - Math.sin(a) * 86, 4, 4, "#ffe9a8");
		}
		E(ctx, 320, 410, 310, 80, "#dcb46a", "#7a4a1a", 4);
		for (let k = 0; k < 16; k++) {
			const a = k * Math.PI / 8;
			line(ctx, [[320 + Math.cos(a) * 120, 410 + Math.sin(a) * 28], [320 + Math.cos(a) * 220, 410 + Math.sin(a) * 54]], "rgba(122,74,26,0.25)", 2);
		}
		E(ctx, 320, 410, 220, 54, null, "rgba(122,74,26,0.5)", 3);
		E(ctx, 320, 410, 120, 28, null, "rgba(122,74,26,0.35)", 2);
		for (let i = 0; i < 16; i++) poly(ctx, [[i * 42, 176], [i * 42 + 42, 176], [i * 42 + 21, 200]], ["#d8b03a", "#3a6aa8", "#4a8a3a", "#c8607a"][i % 4], INK, 1);
		line(ctx, [[0, 176], [640, 176]], "#ece0c8", 2);
	}, true);
	make("p_clown_a", 120, 200, (ctx) => {
		clown(ctx, 60, 90, "#3a8aff", "#ffd23a", "#ff7a1a");
		[[20, 6, "#ff5a5a"], [60, -2, "#5ab04a"], [100, 6, "#b07aff"]].forEach((q) => E(ctx, q[0], q[1] + 10, 9, 9, q[2], INK, 2));
	});
	make("p_clown_b", 110, 220, (ctx) => {
		ctx.translate(0, 10);
		clown(ctx, 55, 80, "#5ab04a", "#ff7aa8", "#3a8aff");
		R(ctx, 10, 176, 90, 14, 7, "#8a6a4a", INK, 2.5);
		E(ctx, 30, 196, 12, 12, "#4a4a5a", INK, 2); E(ctx, 80, 196, 12, 12, "#4a4a5a", INK, 2);
	});
	make("p_elephant", 170, 200, (ctx) => {
		const g2 = ctx.createRadialGradient(70, 140, 5, 85, 150, 46);
		g2.addColorStop(0, "#ffffff"); g2.addColorStop(0.5, "#ff5a5a"); g2.addColorStop(1, "#c8303a");
		E(ctx, 85, 150, 40, 38, g2, INK, 3);
		R(ctx, 46, 92, 16, 30, 6, "#a8b4d8", "#56628a", 2.5); R(ctx, 96, 92, 16, 30, 6, "#a8b4d8", "#56628a", 2.5);
		E(ctx, 80, 70, 52, 40, "#a8b4d8", "#56628a", 3);
		E(ctx, 130, 52, 28, 26, "#a8b4d8", "#56628a", 3);
		E(ctx, 116, 50, 16, 22, "#c8d0ec", "#56628a", 2.5);
		line(ctx, [[150, 60], [164, 40], [160, 20]], "#56628a", 13); line(ctx, [[150, 60], [164, 40], [160, 20]], "#a8b4d8", 7);
		E(ctx, 138, 44, 3, 3.5, "#3a2a20");
		poly(ctx, [[70, 30], [90, 4], [104, 32]], "#ff7aa8", INK, 2);
	});
	make("p_lion", 150, 120, (ctx) => {
		E(ctx, 60, 64, 46, 24, "#e8a040", INK, 3);
		line(ctx, [[16, 60], [2, 40]], "#e8a040", 7); E(ctx, 4, 38, 6, 6, "#a8601a");
		for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; E(ctx, 112 + Math.cos(a) * 24, 50 + Math.sin(a) * 24, 12, 12, "#a8601a", INK, 1.5); }
		E(ctx, 112, 50, 24, 24, "#e8a040", "#a8601a", 3);
		E(ctx, 104, 44, 2.5, 3, "#3a2a20"); E(ctx, 120, 44, 2.5, 3, "#3a2a20"); E(ctx, 112, 56, 5, 3.5, "#5a3a1a");
		line(ctx, [[30, 80], [16, 108]], "#e8a040", 10); line(ctx, [[86, 80], [104, 106]], "#e8a040", 10);
	});
	make("p_ring", 130, 170, (ctx) => {
		line(ctx, [[65, 120], [65, 166]], "#8a6a4a", 6);
		E(ctx, 65, 68, 46, 54, null, "#c8402a", 8);
		for (let i = 0; i < 14; i++) {
			const a = i * Math.PI / 7;
			const x = 65 + Math.cos(a) * 46, y = 68 + Math.sin(a) * 54;
			poly(ctx, [[x - 6, y], [x, y - 16], [x + 6, y]], "#ffb43a");
			poly(ctx, [[x - 3, y], [x, y - 9], [x + 3, y]], "#fff36a");
		}
	});
	make("p_seal", 130, 120, (ctx) => {
		E(ctx, 70, 82, 46, 28, "#5a6a80", "#2a3a50", 3);
		E(ctx, 46, 50, 24, 24, "#5a6a80", "#2a3a50", 3);
		poly(ctx, [[100, 90], [128, 76], [124, 104]], "#5a6a80", "#2a3a50", 2.5);
		E(ctx, 40, 44, 2.5, 3, "#1a1a20"); E(ctx, 30, 54, 4, 3, "#1a1a20");
		const g3 = ctx.createRadialGradient(36, 10, 2, 40, 14, 14);
		g3.addColorStop(0, "#ffffff"); g3.addColorStop(1, "#3a8aff");
		E(ctx, 40, 14, 13, 13, g3, INK, 2);
	});
	make("p_monkey", 100, 175, (ctx) => {
		E(ctx, 50, 152, 18, 18, "#4a4a5a", INK, 3); E(ctx, 50, 152, 6, 6, "#c8c8d0");
		line(ctx, [[50, 134], [50, 104]], "#8a8a9a", 5);
		R(ctx, 36, 98, 28, 8, 4, "#c8402a", INK, 2);
		E(ctx, 50, 76, 20, 24, "#a8683a", INK, 2.5);
		E(ctx, 50, 40, 20, 18, "#a8683a", INK, 2.5);
		E(ctx, 30, 38, 7, 7, "#e8b888", INK, 2); E(ctx, 70, 38, 7, 7, "#e8b888", INK, 2);
		E(ctx, 50, 44, 12, 10, "#e8b888");
		E(ctx, 45, 38, 2, 2.5, "#3a2a20"); E(ctx, 55, 38, 2, 2.5, "#3a2a20");
		poly(ctx, [[38, 24], [50, 4], [62, 24]], "#3a8aff", INK, 2);
		line(ctx, [[34, 70], [16, 54]], "#a8683a", 6); line(ctx, [[66, 70], [84, 54]], "#a8683a", 6);
	});
	make("p_bear", 140, 165, (ctx) => {
		E(ctx, 70, 130, 30, 30, "#3a8aff", INK, 3);
		[0, 1, 2].forEach((i) => line(ctx, [[48 + i * 22, 108], [48 + i * 22, 152]], "rgba(255,255,255,0.6)", 4));
		E(ctx, 70, 72, 34, 30, "#8a5a32", INK, 3);
		E(ctx, 50, 16, 9, 9, "#8a5a32", INK, 2); E(ctx, 90, 16, 9, 9, "#8a5a32", INK, 2);
		E(ctx, 70, 34, 26, 24, "#8a5a32", INK, 3);
		E(ctx, 70, 42, 11, 8, "#d8b08a"); E(ctx, 70, 38, 4, 3, "#3a2a20");
		E(ctx, 61, 28, 2.5, 3, "#3a2a20"); E(ctx, 79, 28, 2.5, 3, "#3a2a20");
		poly(ctx, [[56, 58], [70, 66], [84, 58], [70, 52]], "#ffd23a", INK, 1.5);
	});
	make("p_trapeze", 140, 165, (ctx) => {
		line(ctx, [[30, 0], [30, 120]], "#c8c8d0", 3); line(ctx, [[110, 0], [110, 120]], "#c8c8d0", 3);
		line(ctx, [[26, 120], [114, 120]], "#c8402a", 7);
		E(ctx, 70, 106, 12, 12, "#fff6ee", INK, 2);
		E(ctx, 70, 100, 12, 6, "#3a2a20");
		poly(ctx, [[58, 122], [82, 122], [88, 150], [52, 150]], "#ff7aa8", INK, 2.5);
		line(ctx, [[58, 124], [36, 118]], "#fff6ee", 5); line(ctx, [[82, 124], [104, 118]], "#fff6ee", 5);
		line(ctx, [[62, 150], [56, 160]], "#fff6ee", 5); line(ctx, [[78, 150], [84, 160]], "#fff6ee", 5);
	});
	make("p_drum", 110, 90, (ctx) => {
		R(ctx, 8, 20, 94, 64, 6, "#3a8aff", INK, 3);
		E(ctx, 55, 20, 47, 14, "#ffd23a", INK, 3);
		for (let i = 0; i < 6; i++) E(ctx, 18 + i * 15, 52, 5, 5, "#ffffff");
	});
	make("p_star_c", 90, 90, (ctx) => {
		const pts = [];
		for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 16 : 40; pts.push([45 + Math.cos(a) * r, 45 + Math.sin(a) * r]); }
		poly(ctx, pts, "#ffd23a", "#c8902a", 3);
	});
	// ---- 結果の丸 ----
	make("ghost", 40, 40, (ctx) => { E(ctx, 20, 20, 16, 16, null, "#ffffff", 4); E(ctx, 20, 20, 4, 4, "#ffffff"); }, true);
	make("dot", 8, 8, (ctx) => E(ctx, 4, 4, 3.5, 3.5, "#ffffff"), true);
	// ======== 追加ステージの背景 ========
	const skyGrad = (ctx, y1, c1, c2) => {
		const g = ctx.createLinearGradient(0, 0, 0, y1);
		g.addColorStop(0, c1); g.addColorStop(1, c2);
		ctx.fillStyle = g; ctx.fillRect(0, 0, 640, y1);
	};
	const stones = (ctx, y0, y1, fill, joint) => {
		ctx.fillStyle = fill; ctx.fillRect(0, y0, 640, y1 - y0);
		let row = 0;
		for (let y = y0; y < y1; y += 14 + row * 2) {
			const hgt = 14 + row * 2;
			for (let x = (row % 2) * 18 - 18; x < 640; x += 36 + row * 4) R(ctx, x + 1, y + 1, 34 + row * 4, hgt - 2, 4, null, joint, 1.2);
			row++;
		}
	};
	// 港町
	make("bg_harbor", 640, 480, (ctx) => {
		skyGrad(ctx, 240, "#a8c4d8", "#efe6d0");
		// 向こう岸の丘と町
		ctx.fillStyle = "#9aa888";
		ctx.beginPath(); ctx.moveTo(0, 230); ctx.quadraticCurveTo(80, 170, 200, 200); ctx.lineTo(260, 236); ctx.lineTo(0, 236); ctx.fill();
		ctx.beginPath(); ctx.moveTo(380, 236); ctx.quadraticCurveTo(500, 160, 640, 180); ctx.lineTo(640, 236); ctx.fill();
		[[20, 214], [52, 206], [86, 200], [120, 204], [150, 212], [420, 214], [452, 200], [486, 192], [520, 188], [556, 186], [594, 188]].forEach((q, k) =>
			house(ctx, q[0], q[1] + 20, 22 + (k * 5) % 10, 18 + (k * 7) % 12, ["#f0e2c4", "#e8d0a8", "#d8c0a0"][k % 3], ["#b8583a", "#8a4a32", "#5a6a8a"][k % 3], "#6a5a4a"));
		// 海
		const sg = ctx.createLinearGradient(0, 230, 0, 340);
		sg.addColorStop(0, "#7aa0b0"); sg.addColorStop(1, "#3a6a80");
		ctx.fillStyle = sg; ctx.fillRect(0, 232, 640, 110);
		for (let k = 0; k < 60; k++) {
			const x = rnd() * 640, y = 240 + rnd() * 96;
			line(ctx, [[x, y], [x + 8 + (y - 240) / 6, y - 2], [x + 16 + (y - 240) / 3, y]], "rgba(240,240,230,0.45)", 1.5);
		}
		// 岸壁
		stones(ctx, 336, 480, "#b4a486", "rgba(80,60,40,0.4)");
		R(ctx, 0, 330, 640, 10, 0, "#8a7a62", INK, 1.5);
		[60, 230, 470].forEach((x) => { R(ctx, x - 9, 316, 18, 22, 6, "#4a4a4a", INK, 1.5); R(ctx, x - 12, 314, 24, 6, 3, "#5a5a5a", INK, 1); });
		// ロープ
		ctx.beginPath(); ctx.moveTo(60, 322); ctx.quadraticCurveTo(145, 350, 230, 322); ctx.quadraticCurveTo(350, 350, 470, 322);
		ctx.strokeStyle = "#c8a870"; ctx.lineWidth = 3; ctx.stroke();
		// 網とかご
		for (let k = 0; k < 8; k++) line(ctx, [[560 + k * 8, 350], [556 + k * 9, 470]], "rgba(90,70,40,0.35)", 1);
		for (let k = 0; k < 10; k++) line(ctx, [[556, 360 + k * 11], [628, 358 + k * 11]], "rgba(90,70,40,0.35)", 1);
	}, true);
	// 駅のホーム
	make("bg_station", 640, 480, (ctx) => {
		ctx.fillStyle = "#d8ccb0"; ctx.fillRect(0, 0, 640, 300);
		// ガラスの屋根と鉄のアーチ
		for (let k = 0; k < 4; k++) {
			ctx.beginPath(); ctx.arc(320, 300, 380 - k * 40, Math.PI, 0); ctx.strokeStyle = k === 0 ? "#4a4038" : "rgba(74,64,56,0.5)"; ctx.lineWidth = k === 0 ? 8 : 3; ctx.stroke();
		}
		for (let k = 0; k <= 12; k++) {
			const a = Math.PI + k * Math.PI / 12;
			line(ctx, [[320 + Math.cos(a) * 220, 300 + Math.sin(a) * 220], [320 + Math.cos(a) * 380, 300 + Math.sin(a) * 380]], "rgba(74,64,56,0.55)", 2.5);
		}
		// 向こうのアーチの出口(明るい)
		ctx.beginPath(); ctx.arc(320, 300, 120, Math.PI, 0); ctx.fillStyle = "#f4ead0"; ctx.fill();
		ctx.strokeStyle = "#4a4038"; ctx.lineWidth = 4; ctx.stroke();
		[[240, 250], [290, 236], [350, 240], [396, 252]].forEach((q, k) => house(ctx, q[0], 300, 30, 300 - q[1], "#c8b8a0", ["#8a5a3a", "#6a6a7a"][k % 2], "#7a6a5a"));
		// レンガの壁
		ctx.fillStyle = "#9a5a40"; ctx.fillRect(0, 210, 190, 90); ctx.fillRect(450, 210, 190, 90);
		for (let y = 210; y < 300; y += 10) for (let x = ((y / 10) % 2) * 12; x < 640; x += 24) if (x < 190 || x > 450) R(ctx, x, y, 23, 9, 0, null, "rgba(60,30,20,0.4)", 1);
		R(ctx, 0, 204, 190, 8, 0, "#6a4a3a", INK, 1); R(ctx, 450, 204, 190, 8, 0, "#6a4a3a", INK, 1);
		// 鉄の柱
		[60, 190, 450, 580].forEach((x) => { R(ctx, x - 6, 60, 12, 250, 2, "#4a4a52", INK, 1.5); E(ctx, x, 60, 12, 8, "#4a4a52", INK, 1.5); });
		// ホーム
		ctx.fillStyle = "#b8ac94"; ctx.fillRect(0, 300, 640, 120);
		for (let y = 300; y < 420; y += 20) line(ctx, [[0, y], [640, y]], "rgba(70,55,40,0.3)", 1.2);
		for (let x = 0; x < 640; x += 40) line(ctx, [[x, 300], [x - 20, 420]], "rgba(70,55,40,0.2)", 1.2);
		R(ctx, 0, 412, 640, 8, 0, "#e0c060", INK, 1);
		// 線路
		ctx.fillStyle = "#6a5a4a"; ctx.fillRect(0, 420, 640, 60);
		for (let x = 0; x < 640; x += 22) R(ctx, x, 432, 14, 44, 1, "#7a5a3a", "rgba(40,25,15,0.5)", 1);
		line(ctx, [[0, 442], [640, 442]], "#a8a8b0", 4); line(ctx, [[0, 466], [640, 466]], "#a8a8b0", 4);
	}, true);
	// 海の中
	make("bg_sea", 640, 480, (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 0, 480);
		g.addColorStop(0, "#5a9ab0"); g.addColorStop(0.6, "#2a6a88"); g.addColorStop(1, "#1a4a68");
		ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 480);
		// 光のすじ
		for (let k = 0; k < 6; k++) poly(ctx, [[60 + k * 110, 0], [100 + k * 110, 0], [40 + k * 120, 400], [-10 + k * 120, 400]], "rgba(240,250,230,0.07)");
		// 水面のゆらぎ
		for (let k = 0; k < 30; k++) { const x = rnd() * 640; line(ctx, [[x, 8 + rnd() * 10], [x + 20, 6 + rnd() * 10]], "rgba(255,255,240,0.3)", 2); }
		// 遠くの岩とサンゴ
		ctx.fillStyle = "rgba(30,60,80,0.55)";
		ctx.beginPath(); ctx.moveTo(0, 360); ctx.quadraticCurveTo(60, 250, 140, 320); ctx.quadraticCurveTo(200, 280, 250, 350); ctx.lineTo(0, 380); ctx.fill();
		ctx.beginPath(); ctx.moveTo(400, 360); ctx.quadraticCurveTo(480, 260, 560, 300); ctx.quadraticCurveTo(620, 290, 640, 330); ctx.lineTo(640, 380); ctx.fill();
		for (let k = 0; k < 7; k++) {
			const x = 30 + k * 95, y = 360;
			for (let b = -2; b <= 2; b++) line(ctx, [[x, y], [x + b * 10, y - 30 - Math.abs(b) * -6], [x + b * 16, y - 50 + Math.abs(b) * 8]], "rgba(200,110,100,0.35)", 4);
		}
		// 砂
		ctx.fillStyle = "#cdb88a";
		ctx.beginPath(); ctx.moveTo(0, 370); ctx.quadraticCurveTo(200, 340, 360, 366); ctx.quadraticCurveTo(520, 384, 640, 360); ctx.lineTo(640, 480); ctx.lineTo(0, 480); ctx.fill();
		for (let k = 0; k < 14; k++) line(ctx, [[rnd() * 600, 390 + k * 6], [rnd() * 640, 392 + k * 6]], "rgba(120,95,60,0.25)", 1.5);
		for (let k = 0; k < 30; k++) E(ctx, rnd() * 640, 380 + rnd() * 96, 3, 2, "rgba(110,90,60,0.5)");
		// 泡
		for (let k = 0; k < 40; k++) E(ctx, rnd() * 640, rnd() * 360, 2 + rnd() * 3, 2 + rnd() * 3, null, "rgba(240,250,255,0.5)", 1.2);
	}, true);
	// 台所
	make("bg_kitchen", 640, 480, (ctx) => {
		ctx.fillStyle = "#e8dcc0"; ctx.fillRect(0, 0, 640, 270);
		for (let y = 0; y < 270; y += 32) for (let x = 0; x < 640; x += 32) {
			R(ctx, x + 1, y + 1, 30, 30, 2, (x + y) % 64 ? "#ece2c8" : "#dcd0b4", "rgba(120,100,70,0.35)", 1);
			if ((x / 32 + y / 32) % 4 === 0) E(ctx, x + 16, y + 16, 5, 5, null, "rgba(60,90,130,0.35)", 1.5);
		}
		// 棚とびん
		R(ctx, 30, 40, 580, 10, 0, "#8a5a32", INK, 1.5);
		for (let k = 0; k < 16; k++) {
			const x = 46 + k * 36, h = 24 + (k * 7) % 16;
			if (k % 5 === 2) { E(ctx, x, 40 - 12, 14, 12, ["#c8b890", "#8aa0b0"][k % 2], INK, 1); continue; }
			R(ctx, x - 9, 40 - h, 18, h, 3, ["#a87a4a", "#7a9a7a", "#c8a050", "#9a6a8a"][k % 4], INK, 1);
			R(ctx, x - 5, 40 - h - 5, 10, 5, 1, "#6a4a32", INK, 1);
		}
		// つるした香草
		for (let k = 0; k < 5; k++) {
			const x = 80 + k * 120;
			line(ctx, [[x, 50], [x, 80]], "#6a5a3a", 1.5);
			for (let j = 0; j < 5; j++) E(ctx, x + (j - 2) * 4, 86 + j * 3, 3, 9, "#7a9a5a", null, 0, (j - 2) * 0.3);
		}
		// かまど
		R(ctx, 250, 130, 140, 140, 6, "#9a6a4a", INK, 2);
		ctx.beginPath(); ctx.arc(320, 230, 44, Math.PI, 0); ctx.lineTo(364, 270); ctx.lineTo(276, 270); ctx.closePath(); ctx.fillStyle = "#2a1a14"; ctx.fill();
		E(ctx, 320, 256, 30, 10, "rgba(255,150,60,0.6)");
		for (let y = 140; y < 200; y += 12) for (let x = 254 + ((y / 12) % 2) * 10; x < 384; x += 20) R(ctx, x, y, 19, 11, 0, null, "rgba(60,30,20,0.35)", 1);
		// テーブル
		ctx.fillStyle = "#a87a4a"; ctx.fillRect(0, 270, 640, 210);
		for (let y = 270; y < 480; y += 30) line(ctx, [[0, y], [640, y]], "rgba(70,40,15,0.35)", 1.5);
		for (let k = 0; k < 30; k++) { const x = rnd() * 640, y = 280 + rnd() * 190; line(ctx, [[x, y], [x + 30 + rnd() * 40, y + 1]], "rgba(70,40,15,0.18)", 1); }
		R(ctx, 0, 264, 640, 10, 0, "#8a5a32", INK, 1.5);
		// テーブルクロス
		poly(ctx, [[150, 274], [490, 274], [540, 480], [100, 480]], "rgba(240,232,214,0.55)");
		for (let k = 0; k < 8; k++) line(ctx, [[150 + k * 48, 274], [100 + k * 63, 480]], "rgba(170,60,50,0.25)", 3);
	}, true);
	// お城の中庭
	make("bg_castle", 640, 480, (ctx) => {
		skyGrad(ctx, 300, "#a4bcd0", "#ece4d0");
		// 城壁
		ctx.fillStyle = "#b8ac98"; ctx.fillRect(0, 160, 640, 150);
		for (let x = 0; x < 640; x += 28) R(ctx, x, 146, 18, 16, 0, "#b8ac98", INK, 1.2);
		for (let y = 166; y < 300; y += 16) for (let x = ((y / 16) % 2) * 16; x < 640; x += 32) R(ctx, x, y, 31, 15, 1, null, "rgba(80,65,50,0.35)", 1);
		// 塔
		[[50, 70], [590, 70], [210, 40], [430, 40]].forEach((q, k) => {
			const tw = k < 2 ? 70 : 50;
			R(ctx, q[0] - tw / 2, q[1] + 30, tw, 280 - q[1], 0, "#c4b8a2", INK, 1.5);
			for (let y = q[1] + 40; y < 300; y += 16) for (let x = q[0] - tw / 2 + ((y / 16) % 2) * 10; x < q[0] + tw / 2 - 10; x += 20) R(ctx, x, y, 19, 15, 1, null, "rgba(80,65,50,0.3)", 1);
			poly(ctx, [[q[0] - tw / 2 - 6, q[1] + 30], [q[0], q[1] - 40], [q[0] + tw / 2 + 6, q[1] + 30]], k % 2 ? "#4a5a8a" : "#8a3a3a", INK, 1.5);
			R(ctx, q[0] - 6, q[1] + 60, 12, 20, 6, "#3a2a20");
		});
		// 門
		ctx.beginPath(); ctx.moveTo(270, 310); ctx.lineTo(270, 230); ctx.arc(320, 230, 50, Math.PI, 0); ctx.lineTo(370, 310); ctx.fillStyle = "#3a2a20"; ctx.fill();
		for (let x = 280; x < 370; x += 14) line(ctx, [[x, 190], [x, 300]], "#6a5a4a", 3);
		for (let y = 210; y < 300; y += 18) line(ctx, [[272, y], [368, y]], "#6a5a4a", 3);
		// たれ幕
		[[120, "#8a3a3a"], [520, "#4a5a8a"]].forEach((q) => { poly(ctx, [[q[0] - 18, 170], [q[0] + 18, 170], [q[0] + 18, 240], [q[0], 228], [q[0] - 18, 240]], q[1], INK, 1.2); E(ctx, q[0], 196, 8, 8, "#e0c060"); });
		// 石だたみ
		stones(ctx, 306, 480, "#c8bca4", "rgba(90,75,55,0.4)");
		R(ctx, 0, 300, 640, 8, 0, "#8a7e6a", INK, 1);
		// 生けがき
		[[30, 330], [610, 330]].forEach((q) => { R(ctx, q[0] - 30, q[1] - 24, 60, 40, 14, "#5a7a3a", "#3a5a2a", 1.5); });
	}, true);
	// 宇宙
	make("bg_space", 640, 480, (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 0, 480);
		g.addColorStop(0, "#14142a"); g.addColorStop(1, "#2a2440");
		ctx.fillStyle = g; ctx.fillRect(0, 0, 640, 480);
		// 星雲
		[[160, 120, "rgba(150,90,160,0.25)"], [470, 200, "rgba(80,120,170,0.25)"], [330, 60, "rgba(190,140,90,0.18)"]].forEach((q) => {
			const r = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], 170);
			r.addColorStop(0, q[2]); r.addColorStop(1, "rgba(0,0,0,0)");
			ctx.fillStyle = r; ctx.fillRect(0, 0, 640, 480);
		});
		for (let k = 0; k < 220; k++) E(ctx, rnd() * 640, rnd() * 380, rnd() * 1.6 + 0.4, rnd() * 1.6 + 0.4, "rgba(255,250,230," + (0.4 + rnd() * 0.6) + ")");
		// 遠くの小さな星たち(天の川)
		for (let k = 0; k < 160; k++) { const t = rnd(); E(ctx, t * 640, 60 + t * 200 + (rnd() - 0.5) * 60, 0.8, 0.8, "rgba(255,255,240,0.6)"); }
		E(ctx, 560, 60, 18, 18, "#8a6a5a", INK, 1); E(ctx, 80, 300, 10, 10, "#6a8a9a", INK, 1);
		// 月面
		ctx.fillStyle = "#9a9488";
		ctx.beginPath(); ctx.moveTo(0, 380); ctx.quadraticCurveTo(160, 350, 320, 372); ctx.quadraticCurveTo(480, 392, 640, 362); ctx.lineTo(640, 480); ctx.lineTo(0, 480); ctx.fill();
		[[80, 420, 40], [260, 450, 26], [420, 410, 34], [580, 440, 30], [180, 395, 16], [520, 392, 14]].forEach((q) => {
			E(ctx, q[0], q[1], q[2], q[2] * 0.3, "#7a756a", "#5a564e", 1.5); E(ctx, q[0], q[1] - 2, q[2] * 0.8, q[2] * 0.2, "#86817a");
		});
	}, true);
	// 遊園地
	make("bg_amuse", 640, 480, (ctx) => {
		skyGrad(ctx, 320, "#9cc0d8", "#f2e2c4");
		// 観覧車
		const cx = 470, cy = 150;
		E(ctx, cx, cy, 120, 120, null, "rgba(90,70,60,0.7)", 3);
		E(ctx, cx, cy, 100, 100, null, "rgba(90,70,60,0.4)", 1.5);
		for (let k = 0; k < 12; k++) {
			const a = k * Math.PI / 6;
			line(ctx, [[cx, cy], [cx + Math.cos(a) * 120, cy + Math.sin(a) * 120]], "rgba(90,70,60,0.5)", 1.5);
			R(ctx, cx + Math.cos(a) * 120 - 9, cy + Math.sin(a) * 120, 18, 14, 3, ["#c8604a", "#4a7aa8", "#d8b040", "#5a9a5a"][k % 4], INK, 1);
		}
		poly(ctx, [[cx, cy], [cx - 60, 320], [cx - 48, 320]], "#7a6a5a"); poly(ctx, [[cx, cy], [cx + 60, 320], [cx + 48, 320]], "#7a6a5a");
		E(ctx, cx, cy, 10, 10, "#c8a050", INK, 1);
		// ジェットコースター
		ctx.beginPath(); ctx.moveTo(0, 220); ctx.bezierCurveTo(60, 90, 120, 90, 160, 200); ctx.bezierCurveTo(190, 260, 230, 150, 300, 240);
		ctx.strokeStyle = "rgba(120,60,50,0.8)"; ctx.lineWidth = 4; ctx.stroke();
		for (let x = 10; x < 300; x += 20) line(ctx, [[x, 320], [x, 200 + Math.abs(Math.sin(x / 50)) * 30]], "rgba(120,90,70,0.4)", 1.5);
		// テント
		[[90, 270, "#c8504a"], [250, 280, "#4a7aa8"]].forEach((q) => {
			R(ctx, q[0] - 40, q[1], 80, 40, 0, "#ece0c8", INK, 1.2);
			for (let k = 0; k < 4; k++) R(ctx, q[0] - 40 + k * 20, q[1], 10, 40, 0, q[2]);
			poly(ctx, [[q[0] - 46, q[1]], [q[0], q[1] - 40], [q[0] + 46, q[1]]], q[2], INK, 1.2);
			line(ctx, [[q[0], q[1] - 40], [q[0], q[1] - 56]], INK, 1.5); poly(ctx, [[q[0], q[1] - 56], [q[0] + 12, q[1] - 51], [q[0], q[1] - 46]], "#e0c060");
		});
		// 旗のロープ
		for (let r = 0; r < 2; r++) {
			ctx.beginPath(); ctx.moveTo(0, 30 + r * 50); ctx.quadraticCurveTo(320, 90 + r * 50, 640, 30 + r * 50); ctx.strokeStyle = "rgba(60,40,30,0.7)"; ctx.lineWidth = 1.2; ctx.stroke();
			for (let k = 0; k < 20; k++) {
				const t = (k + 0.5) / 20, x = t * 640, y = 30 + r * 50 + 2 * t * (1 - t) * 60;
				poly(ctx, [[x - 10, y], [x + 10, y], [x, y + 16]], ["#c8504a", "#e0c060", "#4a7aa8", "#5a9a5a"][(k + r) % 4]);
			}
		}
		// 地面(タイル)とさく
		ctx.fillStyle = "#d4c0a0"; ctx.fillRect(0, 320, 640, 160);
		for (let y = 320; y < 480; y += 20) for (let x = ((y / 20) % 2) * 20; x < 640; x += 40) R(ctx, x, y, 20, 20, 0, "rgba(160,120,90,0.25)");
		for (let x = 0; x < 640; x += 16) R(ctx, x, 300, 4, 24, 1, "#7a5a3a");
		line(ctx, [[0, 306], [640, 306]], "#7a5a3a", 3);
	}, true);
	// 博士の研究室
	make("bg_lab", 640, 480, (ctx) => {
		ctx.fillStyle = "#6a7a5a"; ctx.fillRect(0, 0, 640, 300);
		for (let x = 0; x < 640; x += 24) R(ctx, x, 0, 12, 300, 0, "rgba(40,50,30,0.18)");
		// 黒板の数式
		R(ctx, 190, 30, 260, 150, 4, "#2e3a32", "#7a5a3a", 8);
		["a²+b²=c²", "x = ?", "△ABC", "1+1=?"].forEach((t, k) => { ctx.font = "20px serif"; ctx.fillStyle = "rgba(240,240,220,0.7)"; ctx.fillText(t, 210 + (k % 2) * 120, 70 + Math.floor(k / 2) * 50); });
		line(ctx, [[220, 150], [300, 120], [360, 160], [420, 130]], "rgba(240,240,220,0.5)", 2);
		// 左右の棚
		[[0, 150], [490, 150]].forEach((q) => {
			R(ctx, q[0], 20, q[1], 280, 0, "#5a3a22", INK, 2);
			for (let r = 0; r < 4; r++) {
				const y = 26 + r * 68;
				R(ctx, q[0] + 4, y + 60, q[1] - 8, 6, 0, "#3a2414");
				for (let k = 0; k < 6; k++) {
					const x = q[0] + 14 + k * 22;
					if ((k + r) % 3 === 0) { E(ctx, x, y + 46, 8, 12, ["#8ab0a0", "#c8a870", "#a87a9a"][(k + r) % 3], INK, 1); R(ctx, x - 3, y + 28, 6, 8, 1, "#c8b890", INK, 1); }
					else R(ctx, x - 7, y + 60 - 34 - (k * 5) % 12, 14, 34 + (k * 5) % 12, 1, ["#8a3a2a", "#3a5a4a", "#a8843a", "#4a3a6a"][(k + r) % 4], INK, 0.8);
				}
			}
		});
		// 床と、じゅうたん
		ctx.fillStyle = "#7a4e2e"; ctx.fillRect(0, 300, 640, 180);
		for (let y = 300; y < 480; y += 20) line(ctx, [[0, y], [640, y]], "rgba(40,20,10,0.35)", 1.5);
		R(ctx, 0, 294, 640, 10, 0, "#4a2e1a", INK, 1.5);
		R(ctx, 120, 360, 400, 100, 4, "#5a3a5a", INK, 2);
		R(ctx, 132, 370, 376, 80, 2, null, "#c8a050", 3);
		for (let k = 0; k < 6; k++) poly(ctx, [[180 + k * 56, 410], [196 + k * 56, 390], [212 + k * 56, 410], [196 + k * 56, 430]], "#a8604a");
	}, true);
	// 街角
	make("bg_street", 640, 480, (ctx) => {
		skyGrad(ctx, 340, "#e8b88a", "#f4dcb4");
		// 奥の建物の影
		for (let x = 0; x < 640; x += 60) R(ctx, x, 60 + (x * 7) % 50, 60, 280, 0, "#9a8070");
		// 建物
		const fronts = [[0, 120, "#d8c4a0"], [130, 100, "#c8a888"], [250, 140, "#e0d0b0"], [400, 110, "#b89a80"], [520, 120, "#d0b898"]];
		fronts.forEach((q, k) => {
			const top = 20 + (k * 17) % 40;
			R(ctx, q[0], top, q[1], 330 - top, 0, q[2], INK, 1.5);
			R(ctx, q[0] - 4, top - 10, q[1] + 8, 12, 0, "#8a6a4a", INK, 1.2);
			for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < Math.floor(q[1] / 40); c2++) {
				const wx = q[0] + 14 + c2 * 40, wy = top + 24 + r * 56;
				if (wy > 210) continue;
				R(ctx, wx, wy, 22, 34, 10, (r + c2 + k) % 3 ? "#5a6a7a" : "#f4d890", INK, 1.2);
				R(ctx, wx - 4, wy + 34, 30, 5, 0, "#8a6a4a");
				if ((r + c2) % 2) for (let f = 0; f < 4; f++) E(ctx, wx + 2 + f * 6, wy + 32, 3, 3, ["#c8504a", "#e0a0b0", "#e0c060"][f % 3]);
			}
			// 一階のお店
			R(ctx, q[0] + 8, 250, q[1] - 16, 80, 2, "#6a4a32", INK, 1.2);
			R(ctx, q[0] + 14, 262, q[1] - 28, 50, 1, k % 2 ? "#f4d890" : "#8aa0a8", INK, 1);
			for (let s = 0; s < Math.floor((q[1] - 8) / 14); s++) poly(ctx, [[q[0] + 4 + s * 14, 236], [q[0] + 18 + s * 14, 236], [q[0] + 18 + s * 14, 252], [q[0] + 11 + s * 14, 258], [q[0] + 4 + s * 14, 252]], s % 2 ? "#ece0c8" : ["#a8403a", "#3a6a5a", "#4a5a8a"][k % 3]);
		});
		// 歩道と石だたみ
		R(ctx, 0, 330, 640, 22, 0, "#a8a090", INK, 1.2);
		stones(ctx, 352, 480, "#8a8478", "rgba(40,35,30,0.45)");
		// 水たまり
		E(ctx, 160, 430, 60, 12, "rgba(170,190,210,0.45)"); E(ctx, 480, 400, 44, 9, "rgba(170,190,210,0.45)");
	}, true);
	// ======== 追加ステージのパーツ ========
	const star5 = (ctx, cx, cy, r, fill, stroke) => {
		const pts = [];
		for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
		poly(ctx, pts, fill, stroke || INK, 2);
	};
	const wheel = (ctx, x, y, r, fill) => {
		E(ctx, x, y, r, r, fill || "#3a2a20", INK, 2);
		E(ctx, x, y, r * 0.55, r * 0.55, "#c8b890", INK, 1.5);
		for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; line(ctx, [[x, y], [x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55]], INK, 1.5); }
	};
	// ---- 港町 ----
	make("p_sailboat", 150, 150, (ctx) => {
		poly(ctx, [[10, 110], [140, 110], [118, 140], [30, 140]], "#8a5a32", INK, 2.5);
		R(ctx, 30, 116, 90, 6, 0, "#e8d8b0");
		line(ctx, [[72, 110], [72, 12]], INK, 4);
		poly(ctx, [[76, 16], [76, 100], [132, 100]], "#f4ecd8", INK, 2);
		poly(ctx, [[68, 26], [68, 100], [22, 100]], "#e8c8a0", INK, 2);
		poly(ctx, [[72, 12], [96, 18], [72, 24]], "#c8403a", INK, 1.5);
	});
	make("p_lighthouse", 90, 210, (ctx) => {
		poly(ctx, [[26, 200], [64, 200], [56, 50], [34, 50]], "#f4ecd8", INK, 2.5);
		[70, 110, 150].forEach((y) => poly(ctx, [[34 - (y - 50) * 0.04, y], [56 + (y - 50) * 0.04, y], [57 + (y - 50) * 0.05, y + 20], [33 - (y - 50) * 0.05, y + 20]], "#c8403a"));
		R(ctx, 26, 40, 38, 12, 2, "#4a4a52", INK, 2);
		R(ctx, 32, 18, 26, 22, 3, "#ffe9a0", INK, 2);
		poly(ctx, [[28, 18], [45, 2], [62, 18]], "#4a4a52", INK, 2);
		R(ctx, 38, 170, 14, 30, 6, "#6a4a32", INK, 1.5);
	});
	make("p_gull", 110, 60, (ctx) => {
		ctx.beginPath(); ctx.moveTo(6, 30); ctx.quadraticCurveTo(30, 6, 55, 30); ctx.quadraticCurveTo(80, 6, 104, 30);
		ctx.quadraticCurveTo(80, 18, 55, 38); ctx.quadraticCurveTo(30, 18, 6, 30); ctx.fillStyle = "#f4f0e8"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
		E(ctx, 55, 36, 10, 8, "#f4f0e8", INK, 2); poly(ctx, [[60, 40], [70, 44], [60, 46]], "#e0a040", INK, 1.2);
		line(ctx, [[14, 26], [24, 20]], "#5a5a62", 3); line(ctx, [[96, 26], [86, 20]], "#5a5a62", 3);
	});
	make("p_anchor", 100, 120, (ctx) => {
		E(ctx, 50, 14, 10, 10, null, INK, 5);
		line(ctx, [[50, 24], [50, 104]], "#5a5a62", 9); line(ctx, [[30, 36], [70, 36]], "#5a5a62", 8);
		ctx.beginPath(); ctx.arc(50, 64, 40, 0.3, Math.PI - 0.3); ctx.strokeStyle = "#5a5a62"; ctx.lineWidth = 9; ctx.stroke();
		poly(ctx, [[6, 70], [18, 82], [20, 66]], "#5a5a62", INK, 1.5); poly(ctx, [[94, 70], [82, 82], [80, 66]], "#5a5a62", INK, 1.5);
	});
	make("p_barrel", 90, 110, (ctx) => {
		ctx.beginPath(); ctx.moveTo(18, 6); ctx.quadraticCurveTo(4, 55, 18, 104); ctx.lineTo(72, 104); ctx.quadraticCurveTo(86, 55, 72, 6); ctx.closePath();
		ctx.fillStyle = "#a8743e"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		[30, 45, 60].forEach((x) => line(ctx, [[x, 8], [x - (x - 45) * 0.3, 55], [x, 102]], "rgba(60,30,10,0.4)", 1.5));
		[20, 88].forEach((y) => line(ctx, [[12, y], [78, y]], "#4a4a52", 6));
		E(ctx, 45, 6, 27, 5, "#c8945a", INK, 2);
	});
	make("p_crab", 110, 80, (ctx) => {
		[-1, 1].forEach((s) => {
			for (let k = 0; k < 3; k++) line(ctx, [[55 + s * 20, 50 + k * 6], [55 + s * 42, 58 + k * 8], [55 + s * 48, 72 + k * 4]], "#c84a3a", 4);
			line(ctx, [[55 + s * 22, 38], [55 + s * 36, 22]], "#c84a3a", 5);
			ctx.beginPath(); ctx.arc(55 + s * 40, 16, 12, 0, Math.PI * 2); ctx.fillStyle = "#d85a4a"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
			poly(ctx, [[55 + s * 40, 16], [55 + s * 52, 4], [55 + s * 50, 18]], "#f0dcc0");
		});
		E(ctx, 55, 48, 30, 20, "#d85a4a", INK, 2.5);
		line(ctx, [[48, 30], [46, 20]], INK, 2); line(ctx, [[62, 30], [64, 20]], INK, 2);
		E(ctx, 46, 18, 4, 4, "#fff", INK, 1.5); E(ctx, 64, 18, 4, 4, "#fff", INK, 1.5);
	});
	make("p_lifebuoy", 100, 100, (ctx) => {
		E(ctx, 50, 50, 44, 44, "#f4ecd8", INK, 2.5); E(ctx, 50, 50, 22, 22, "#000", INK, 2.5);
		for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(50, 50, 33, k * Math.PI / 2 + 0.3, k * Math.PI / 2 + 1.2); ctx.strokeStyle = "#c8403a"; ctx.lineWidth = 20; ctx.stroke(); }
		ctx.globalCompositeOperation = "destination-out"; E(ctx, 50, 50, 21, 21, "#000"); ctx.globalCompositeOperation = "source-over";
		E(ctx, 50, 50, 22, 22, null, INK, 2.5); E(ctx, 50, 50, 44, 44, null, INK, 2.5);
	});
	make("p_fishbox", 130, 80, (ctx) => {
		R(ctx, 6, 30, 118, 46, 2, "#b8945e", INK, 2.5);
		line(ctx, [[6, 52], [124, 52]], "rgba(60,30,10,0.4)", 2);
		[[30, 26, "#8aa0b0"], [64, 22, "#a8b8c0"], [98, 26, "#7a90a8"]].forEach((q) => {
			E(ctx, q[0], q[1], 20, 9, q[2], INK, 2, -0.2);
			poly(ctx, [[q[0] + 18, q[1] - 4], [q[0] + 30, q[1] - 12], [q[0] + 30, q[1] + 4]], q[2], INK, 1.5);
			E(ctx, q[0] - 12, q[1] - 2, 2, 2, INK);
		});
	});
	make("p_steamship", 200, 120, (ctx) => {
		poly(ctx, [[6, 70], [194, 70], [174, 110], [26, 110]], "#3a3a42", INK, 2.5);
		R(ctx, 26, 92, 148, 6, 0, "#c8403a");
		R(ctx, 40, 46, 120, 26, 2, "#f4ecd8", INK, 2);
		for (let k = 0; k < 6; k++) E(ctx, 54 + k * 19, 58, 4, 4, "#8ab0c8", INK, 1);
		[[80, "#c8403a"], [120, "#c8403a"]].forEach((q) => { R(ctx, q[0] - 9, 10, 18, 38, 1, q[1], INK, 2); R(ctx, q[0] - 9, 10, 18, 7, 0, "#2a2a2a"); });
		E(ctx, 60, 8, 12, 7, "rgba(200,200,200,0.8)"); E(ctx, 44, 4, 9, 5, "rgba(200,200,200,0.6)");
	});
	make("p_kikyu", 110, 160, (ctx) => {
		ctx.beginPath(); ctx.moveTo(55, 4); ctx.bezierCurveTo(118, 4, 112, 80, 70, 110); ctx.lineTo(40, 110); ctx.bezierCurveTo(-2, 80, -8, 4, 55, 4);
		ctx.fillStyle = "#d8a040"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		ctx.save(); ctx.clip();
		for (let k = 0; k < 5; k++) R(ctx, 4 + k * 22, 0, 11, 120, 0, "#c84a3a");
		ctx.restore();
		ctx.beginPath(); ctx.moveTo(55, 4); ctx.bezierCurveTo(118, 4, 112, 80, 70, 110); ctx.lineTo(40, 110); ctx.bezierCurveTo(-2, 80, -8, 4, 55, 4); ctx.strokeStyle = INK; ctx.stroke();
		line(ctx, [[42, 110], [44, 132]], INK, 1.5); line(ctx, [[68, 110], [66, 132]], INK, 1.5);
		R(ctx, 40, 132, 30, 22, 3, "#8a5a32", INK, 2);
	});
	// ---- 駅のホーム ----
	make("p_train", 220, 130, (ctx) => {
		R(ctx, 6, 40, 120, 56, 4, "#2e3a32", INK, 2.5);
		R(ctx, 120, 14, 70, 82, 4, "#3a4a3e", INK, 2.5);
		R(ctx, 132, 26, 22, 22, 3, "#f4d890", INK, 1.5); R(ctx, 160, 26, 22, 22, 3, "#f4d890", INK, 1.5);
		R(ctx, 114, 8, 82, 10, 3, "#2a2a2a", INK, 2);
		R(ctx, 30, 10, 20, 32, 2, "#2a2a2a", INK, 2); R(ctx, 26, 6, 28, 8, 2, "#c8a050", INK, 1.5);
		E(ctx, 80, 38, 12, 8, "#c8a050", INK, 1.5);
		R(ctx, 6, 70, 184, 6, 0, "#a8403a");
		poly(ctx, [[0, 96], [18, 80], [18, 96]], "#a8403a", INK, 1.5);
		wheel(ctx, 40, 104, 18); wheel(ctx, 90, 104, 18); wheel(ctx, 150, 104, 20);
		line(ctx, [[40, 104], [150, 104]], "#a8a8b0", 3);
	});
	make("p_stclock", 120, 140, (ctx) => {
		line(ctx, [[60, 4], [60, 28]], INK, 5); R(ctx, 30, 2, 60, 8, 2, "#4a4a52", INK, 1.5);
		E(ctx, 60, 80, 50, 50, "#3a3a42", INK, 2.5); E(ctx, 60, 80, 42, 42, "#f4ecd8", INK, 2);
		for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; line(ctx, [[60 + Math.cos(a) * 34, 80 + Math.sin(a) * 34], [60 + Math.cos(a) * 39, 80 + Math.sin(a) * 39]], INK, 2.5); }
		line(ctx, [[60, 80], [60, 50]], INK, 3); line(ctx, [[60, 80], [80, 92]], INK, 3); E(ctx, 60, 80, 4, 4, "#c8a050");
	});
	make("p_signal", 80, 210, (ctx) => {
		R(ctx, 34, 40, 10, 166, 2, "#5a5a62", INK, 2);
		R(ctx, 18, 196, 42, 10, 2, "#4a4a52", INK, 1.5);
		R(ctx, 20, 10, 38, 74, 8, "#2a2a2a", INK, 2);
		E(ctx, 39, 30, 12, 12, "#e85a4a", INK, 1.5); E(ctx, 39, 62, 12, 12, "#4a6a4a", INK, 1.5);
		poly(ctx, [[44, 100], [76, 94], [76, 112], [44, 110]], "#c8403a", INK, 1.5);
	});
	make("p_trunk", 130, 100, (ctx) => {
		R(ctx, 6, 26, 118, 70, 6, "#8a4a2e", INK, 2.5);
		R(ctx, 6, 40, 118, 6, 0, "#5a3020");
		[24, 106].forEach((x) => R(ctx, x - 6, 26, 12, 70, 0, "#c8a050", INK, 1));
		R(ctx, 50, 10, 30, 18, 6, null, INK, 4);
		R(ctx, 58, 46, 14, 12, 2, "#e0c060", INK, 1.2);
		R(ctx, 30, 60, 30, 18, 2, "#e8dcc0", INK, 1); R(ctx, 76, 64, 22, 14, 2, "#a8c0a0", INK, 1);
	});
	make("p_bench", 190, 100, (ctx) => {
		[[16, 6], [16, 26], [16, 46]].forEach((q) => R(ctx, q[0], q[1], 158, 12, 3, "#a8743e", INK, 2));
		R(ctx, 8, 62, 174, 12, 3, "#a8743e", INK, 2);
		[[18, 0], [158, 0]].forEach((q) => {
			line(ctx, [[q[0] + 6, 4], [q[0] + 6, 96]], "#3a3a42", 6);
			line(ctx, [[q[0] + 6, 74], [q[0] - 4, 96]], "#3a3a42", 5);
		});
	});
	make("p_gaslamp", 70, 220, (ctx) => {
		R(ctx, 30, 60, 10, 150, 2, "#2e3a32", INK, 2);
		R(ctx, 20, 200, 30, 14, 3, "#2e3a32", INK, 1.5);
		line(ctx, [[20, 66], [50, 66]], "#2e3a32", 4);
		poly(ctx, [[18, 18], [52, 18], [46, 56], [24, 56]], "#ffe8a0", INK, 2);
		E(ctx, 35, 36, 9, 12, "rgba(255,200,90,0.8)");
		poly(ctx, [[12, 18], [35, 2], [58, 18]], "#2e3a32", INK, 2);
	});
	make("p_pigeon", 90, 80, (ctx) => {
		E(ctx, 46, 46, 30, 20, "#9aa0aa", INK, 2.5);
		poly(ctx, [[20, 44], [2, 54], [20, 58]], "#7a808a", INK, 2);
		E(ctx, 70, 28, 13, 13, "#8a909a", INK, 2.5);
		E(ctx, 66, 40, 9, 7, "#6a9a8a");
		poly(ctx, [[82, 28], [92, 32], [82, 34]], "#e8a080", INK, 1.2);
		E(ctx, 72, 25, 2.5, 2.5, "#c84a3a");
		E(ctx, 42, 44, 16, 9, "#80868f", null, 0, -0.2);
		line(ctx, [[42, 64], [40, 76]], "#e8a080", 3); line(ctx, [[54, 64], [56, 76]], "#e8a080", 3);
	});
	make("p_tophat", 100, 90, (ctx) => {
		E(ctx, 50, 76, 46, 10, "#2a2a30", INK, 2.5);
		R(ctx, 22, 10, 56, 66, 4, "#2e2e36", INK, 2.5);
		R(ctx, 22, 54, 56, 12, 0, "#8a3a3a");
		E(ctx, 50, 10, 28, 6, "#3a3a42", INK, 2);
	});
	make("p_poster", 110, 140, (ctx) => {
		R(ctx, 6, 6, 98, 128, 2, "#f0e2c0", INK, 2.5);
		R(ctx, 14, 14, 82, 56, 2, "#c8604a");
		E(ctx, 55, 54, 30, 14, "#e0c060"); poly(ctx, [[30, 54], [55, 24], [80, 54]], "#3a5a6a");
		for (let k = 0; k < 4; k++) R(ctx, 18, 80 + k * 12, 74 - (k % 2) * 20, 5, 2, "#7a5a4a");
		E(ctx, 20, 12, 3, 3, "#a8a8b0"); E(ctx, 90, 12, 3, 3, "#a8a8b0");
	});
	// ---- 海の中 ----
	const fish = (ctx, cx, cy, s, body, fin, stripe) => {
		poly(ctx, [[cx + 22 * s, cy], [cx + 40 * s, cy - 16 * s], [cx + 40 * s, cy + 16 * s]], fin, INK, 2);
		E(ctx, cx, cy, 30 * s, 20 * s, body, INK, 2.5);
		if (stripe) [-8, 6].forEach((d) => { ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, 30 * s, 20 * s, 0, 0, Math.PI * 2); ctx.clip(); R(ctx, cx + d * s, cy - 22 * s, 6 * s, 44 * s, 0, stripe); ctx.restore(); });
		poly(ctx, [[cx - 4 * s, cy - 18 * s], [cx + 12 * s, cy - 30 * s], [cx + 16 * s, cy - 16 * s]], fin, INK, 1.5);
		E(ctx, cx - 16 * s, cy - 4 * s, 4 * s, 4 * s, "#fff", INK, 1.2); E(ctx, cx - 17 * s, cy - 4 * s, 2 * s, 2 * s, INK);
	};
	make("p_fish_a", 120, 90, (ctx) => fish(ctx, 50, 46, 1.1, "#e8904a", "#d8603a", "#f4ecd8"));
	make("p_fish_b", 100, 70, (ctx) => fish(ctx, 40, 36, 0.8, "#6a9ac8", "#4a7aa8", null));
	make("p_octopus", 120, 120, (ctx) => {
		for (let k = 0; k < 6; k++) {
			const x = 20 + k * 16;
			ctx.beginPath(); ctx.moveTo(x, 60); ctx.quadraticCurveTo(x + (k % 2 ? 14 : -14), 90, x + (k < 3 ? -8 : 8), 112);
			ctx.strokeStyle = "#c86a7a"; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.stroke();
		}
		E(ctx, 60, 44, 38, 36, "#d87a8a", INK, 2.5);
		E(ctx, 48, 44, 6, 7, "#fff", INK, 1.5); E(ctx, 72, 44, 6, 7, "#fff", INK, 1.5);
		E(ctx, 49, 45, 3, 3, INK); E(ctx, 73, 45, 3, 3, INK);
		E(ctx, 60, 60, 6, 4, "#b85a6a", INK, 1.5);
		E(ctx, 44, 24, 6, 4, "rgba(255,255,255,0.4)");
	});
	make("p_jelly", 90, 130, (ctx) => {
		for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(20 + k * 12, 50); ctx.bezierCurveTo(10 + k * 12, 80, 30 + k * 12, 100, 18 + k * 12, 126); ctx.strokeStyle = "rgba(220,180,220,0.9)"; ctx.lineWidth = 3; ctx.stroke(); }
		ctx.beginPath(); ctx.arc(45, 50, 38, Math.PI, 0); ctx.quadraticCurveTo(45, 62, 7, 50); ctx.fillStyle = "rgba(230,200,235,0.95)"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		E(ctx, 45, 36, 16, 10, "rgba(200,140,200,0.6)");
	});
	make("p_turtle", 150, 100, (ctx) => {
		E(ctx, 26, 30, 14, 8, "#8aa86a", INK, 2, -0.6); E(ctx, 26, 72, 14, 8, "#8aa86a", INK, 2, 0.6);
		E(ctx, 110, 28, 16, 8, "#8aa86a", INK, 2, 0.6); E(ctx, 110, 74, 16, 8, "#8aa86a", INK, 2, -0.6);
		E(ctx, 130, 50, 16, 13, "#9ab87a", INK, 2.5); E(ctx, 136, 46, 2.5, 2.5, INK);
		E(ctx, 70, 50, 50, 34, "#7a6a3a", INK, 2.5);
		for (let k = 0; k < 3; k++) poly(ctx, [[46 + k * 24, 50], [56 + k * 24, 34], [70 + k * 24, 34], [80 + k * 24, 50], [70 + k * 24, 66], [56 + k * 24, 66]].map((p) => [p[0] - 10, p[1]]), "#a8904a", INK, 1.5);
	});
	make("p_starfish", 90, 90, (ctx) => { star5(ctx, 45, 47, 42, "#e8904a"); for (let k = 0; k < 10; k++) E(ctx, 45 + Math.cos(k) * (6 + k * 2), 47 + Math.sin(k) * (6 + k * 2), 2, 2, "#f4c890"); });
	make("p_shell", 90, 80, (ctx) => {
		ctx.beginPath(); ctx.moveTo(45, 74); ctx.lineTo(6, 34); ctx.quadraticCurveTo(45, -14, 84, 34); ctx.closePath();
		ctx.fillStyle = "#f0d0c0"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		for (let k = 1; k < 6; k++) line(ctx, [[45, 72], [6 + k * 13, 34 - Math.sin(k / 6 * Math.PI) * 22]], "rgba(150,80,70,0.6)", 2);
		R(ctx, 34, 66, 22, 12, 3, "#e0b0a0", INK, 2);
	});
	make("p_seaweed", 90, 180, (ctx) => {
		[[30, "#4a8a5a"], [58, "#5a9a4a"], [44, "#3a7a4a"]].forEach((q, k) => {
			ctx.beginPath(); ctx.moveTo(q[0], 176);
			for (let y = 176; y > 10 + k * 20; y -= 20) ctx.quadraticCurveTo(q[0] + (((176 - y) / 20) % 2 ? 16 : -16), y - 10, q[0], y - 20);
			ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.stroke(); ctx.strokeStyle = q[1]; ctx.lineWidth = 8; ctx.stroke();
		});
	});
	make("p_treasure", 130, 100, (ctx) => {
		R(ctx, 10, 44, 110, 52, 3, "#8a5a32", INK, 2.5);
		ctx.beginPath(); ctx.moveTo(10, 46); ctx.quadraticCurveTo(65, 0, 120, 46); ctx.closePath(); ctx.fillStyle = "#9a6a3a"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		[30, 100].forEach((x) => R(ctx, x - 5, 26, 10, 70, 0, "#c8a050", INK, 1));
		R(ctx, 56, 46, 18, 20, 3, "#e0c060", INK, 1.5);
		for (let k = 0; k < 5; k++) E(ctx, 40 + k * 12, 40 - (k % 2) * 4, 6, 4, "#f4dc78", INK, 1);
	});
	// ---- 台所 ----
	make("p_fpan", 160, 70, (ctx) => {
		R(ctx, 92, 28, 66, 12, 5, "#5a3a22", INK, 2);
		E(ctx, 50, 34, 46, 28, "#3a3a42", INK, 2.5); E(ctx, 50, 34, 38, 22, "#4a4a52");
		E(ctx, 46, 34, 14, 10, "#f8f4e8", INK, 1.5); E(ctx, 46, 34, 6, 6, "#f0c040");
	});
	make("p_ladle", 60, 150, (ctx) => {
		R(ctx, 26, 4, 8, 104, 3, "#a8a8b0", INK, 1.5); E(ctx, 30, 10, 6, 6, null, INK, 2);
		ctx.beginPath(); ctx.arc(30, 116, 26, 0, Math.PI); ctx.closePath(); ctx.fillStyle = "#b8b8c0"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
	});
	make("p_pot", 140, 110, (ctx) => {
		R(ctx, 20, 30, 100, 72, 8, "#b8543a", INK, 2.5);
		R(ctx, 4, 40, 18, 10, 4, "#8a3a2a", INK, 2); R(ctx, 118, 40, 18, 10, 4, "#8a3a2a", INK, 2);
		E(ctx, 70, 30, 54, 10, "#c8643a", INK, 2.5);
		E(ctx, 70, 20, 10, 6, "#5a3a22", INK, 2);
		ctx.beginPath(); ctx.moveTo(50, 14); ctx.quadraticCurveTo(40, 4, 50, -4); ctx.moveTo(90, 14); ctx.quadraticCurveTo(100, 4, 90, -4); ctx.strokeStyle = "rgba(240,240,240,0.8)"; ctx.lineWidth = 3; ctx.stroke();
	});
	make("p_kettle", 120, 110, (ctx) => {
		ctx.beginPath(); ctx.arc(56, 32, 30, Math.PI, 0); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
		poly(ctx, [[86, 70], [114, 44], [118, 50], [96, 82]], "#c8a050", INK, 2);
		E(ctx, 56, 72, 44, 32, "#c8a050", INK, 2.5);
		E(ctx, 56, 44, 18, 6, "#a8803a", INK, 2); E(ctx, 56, 36, 6, 5, "#5a3a22", INK, 1.5);
		E(ctx, 40, 62, 10, 6, "rgba(255,250,220,0.6)");
	});
	make("p_bread", 130, 70, (ctx) => {
		E(ctx, 65, 40, 60, 26, "#c88a4a", INK, 2.5);
		for (let k = 0; k < 4; k++) line(ctx, [[30 + k * 22, 26], [42 + k * 22, 50]], "#8a5a2a", 3);
		E(ctx, 50, 28, 20, 8, "rgba(255,230,180,0.4)");
	});
	make("p_cheese", 110, 80, (ctx) => {
		poly(ctx, [[6, 70], [104, 70], [104, 34], [6, 54]], "#f0c850", INK, 2.5);
		poly(ctx, [[6, 54], [104, 34], [80, 10]], "#f8dc78", INK, 2.5);
		[[30, 60, 6], [70, 54, 8], [92, 62, 5], [56, 32, 5]].forEach((q) => E(ctx, q[0], q[1], q[2], q[2] * 0.8, "#d8a838"));
	});
	make("p_apple", 70, 80, (ctx) => {
		E(ctx, 26, 46, 22, 26, "#c8403a", INK, 2.5); E(ctx, 44, 46, 22, 26, "#c8403a", INK, 2.5); E(ctx, 35, 48, 26, 26, "#c8403a");
		line(ctx, [[35, 26], [38, 10]], "#5a3a22", 4);
		E(ctx, 48, 14, 10, 5, "#6a9a4a", INK, 1.5, -0.4);
		E(ctx, 24, 38, 6, 9, "rgba(255,240,220,0.5)");
	});
	make("p_teacup", 110, 80, (ctx) => {
		E(ctx, 50, 70, 46, 8, "#f4ecd8", INK, 2);
		ctx.beginPath(); ctx.moveTo(14, 20); ctx.quadraticCurveTo(18, 66, 50, 66); ctx.quadraticCurveTo(82, 66, 86, 20); ctx.closePath();
		ctx.fillStyle = "#f4ecd8"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		E(ctx, 98, 36, 12, 12, null, INK, 4);
		E(ctx, 50, 20, 36, 7, "#a8643a", INK, 2);
		R(ctx, 22, 36, 56, 6, 2, "#6a8ab0");
		E(ctx, 50, 50, 6, 4, "#c8604a");
	});
	make("p_cake", 120, 110, (ctx) => {
		E(ctx, 60, 96, 56, 10, "#e8e4dc", INK, 2);
		R(ctx, 14, 40, 92, 56, 6, "#f4e4c8", INK, 2.5);
		R(ctx, 14, 64, 92, 8, 0, "#d86a7a");
		ctx.beginPath(); ctx.moveTo(14, 46); for (let k = 0; k < 6; k++) ctx.quadraticCurveTo(22 + k * 15.3, 58, 29 + k * 15.3, 46); ctx.fillStyle = "#fff8f0"; ctx.fill();
		E(ctx, 60, 40, 46, 8, "#fff8f0", INK, 2);
		[[40, 30], [60, 26], [80, 30]].forEach((q) => { E(ctx, q[0], q[1], 8, 8, "#c8403a", INK, 1.5); line(ctx, [[q[0], q[1] - 8], [q[0] + 2, q[1] - 14]], "#5a7a3a", 2); });
	});
	// ---- お城の中庭 ----
	make("p_knight", 110, 200, (ctx) => {
		R(ctx, 32, 140, 18, 54, 4, "#a8acb4", INK, 2); R(ctx, 58, 140, 18, 54, 4, "#a8acb4", INK, 2);
		R(ctx, 26, 70, 58, 76, 10, "#b8bcc4", INK, 2.5);
		R(ctx, 26, 110, 58, 10, 0, "#8a3a3a");
		E(ctx, 55, 44, 26, 30, "#c8ccd4", INK, 2.5);
		R(ctx, 36, 40, 38, 6, 2, "#2a2a30"); R(ctx, 36, 50, 38, 4, 2, "#2a2a30");
		poly(ctx, [[54, 14], [70, 0], [80, 10], [62, 20]], "#c8403a", INK, 1.5);
		line(ctx, [[96, 20], [96, 190]], "#7a5a3a", 5); poly(ctx, [[96, 4], [104, 22], [88, 22]], "#c8ccd4", INK, 1.5);
		R(ctx, 2, 80, 30, 46, 10, "#4a5a8a", INK, 2); poly(ctx, [[17, 90], [24, 104], [17, 118], [10, 104]], "#e0c060");
	});
	make("p_flagpole", 100, 200, (ctx) => {
		line(ctx, [[20, 6], [20, 196]], "#7a5a3a", 6);
		E(ctx, 20, 6, 6, 6, "#e0c060", INK, 1.5);
		ctx.beginPath(); ctx.moveTo(23, 14); ctx.quadraticCurveTo(60, 0, 96, 20); ctx.lineTo(96, 66); ctx.quadraticCurveTo(60, 50, 23, 64); ctx.closePath();
		ctx.fillStyle = "#4a5a8a"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
		star5(ctx, 60, 38, 12, "#e0c060");
	});
	make("p_fountain", 170, 140, (ctx) => {
		E(ctx, 85, 112, 80, 22, "#b8b0a0", INK, 2.5); E(ctx, 85, 106, 70, 16, "#7aa0b0");
		R(ctx, 75, 50, 20, 60, 4, "#c8c0b0", INK, 2);
		E(ctx, 85, 50, 36, 10, "#c8c0b0", INK, 2); E(ctx, 85, 47, 28, 6, "#7aa0b0");
		R(ctx, 80, 20, 10, 30, 3, "#c8c0b0", INK, 1.5);
		for (let s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.moveTo(85, 18); ctx.quadraticCurveTo(85 + s * 40, 0, 85 + s * 56, 46); ctx.strokeStyle = "rgba(200,230,240,0.9)"; ctx.lineWidth = 4; ctx.stroke(); }
		ctx.beginPath(); ctx.moveTo(85, 50); ctx.quadraticCurveTo(85 - 60, 50, 30, 100); ctx.moveTo(85, 50); ctx.quadraticCurveTo(85 + 60, 50, 140, 100); ctx.stroke();
	});
	make("p_cannon", 160, 100, (ctx) => {
		poly(ctx, [[20, 50], [130, 20], [138, 40], [30, 76]], "#3a3a42", INK, 2.5);
		E(ctx, 134, 30, 6, 11, "#2a2a30", INK, 2, -0.3);
		R(ctx, 30, 58, 70, 22, 4, "#8a5a32", INK, 2);
		wheel(ctx, 50, 78, 20, "#6a4a2a"); wheel(ctx, 92, 80, 16, "#6a4a2a");
		[[140, 90], [152, 90], [146, 80]].forEach((q) => E(ctx, q[0], q[1], 7, 7, "#2a2a30", INK, 1.5));
	});
	make("p_horse", 170, 150, (ctx) => {
		[[44, 96], [62, 98], [112, 96], [130, 94]].forEach((q) => R(ctx, q[0] - 5, q[1], 11, 48, 4, "#d8c8b0", INK, 2));
		E(ctx, 88, 82, 58, 30, "#e8dcc8", INK, 2.5);
		poly(ctx, [[130, 74], [146, 20], [164, 28], [150, 84]], "#e8dcc8", INK, 2.5);
		E(ctx, 156, 32, 14, 11, "#e8dcc8", INK, 2.5, 0.6);
		poly(ctx, [[142, 22], [146, 8], [150, 22]], "#e8dcc8", INK, 1.5);
		ctx.beginPath(); ctx.moveTo(134, 30); ctx.quadraticCurveTo(122, 50, 126, 76); ctx.strokeStyle = "#8a6a4a"; ctx.lineWidth = 8; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(32, 74); ctx.quadraticCurveTo(10, 90, 14, 120); ctx.stroke();
		R(ctx, 64, 56, 50, 30, 6, "#8a3a3a", INK, 2); E(ctx, 154, 30, 2.5, 2.5, INK);
	});
	make("p_dragon", 160, 120, (ctx) => {
		poly(ctx, [[70, 50], [40, 4], [96, 36]], "#8ab070", INK, 2); poly(ctx, [[90, 50], [126, 6], [118, 50]], "#7aa060", INK, 2);
		ctx.beginPath(); ctx.moveTo(40, 80); ctx.quadraticCurveTo(10, 100, 4, 70); ctx.strokeStyle = "#6a9a5a"; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.stroke();
		poly(ctx, [[0, 66], [10, 58], [8, 72]], "#c8604a", INK, 1.2);
		E(ctx, 76, 74, 40, 26, "#6a9a5a", INK, 2.5);
		E(ctx, 76, 80, 26, 14, "#e8dca0");
		E(ctx, 124, 54, 24, 20, "#6a9a5a", INK, 2.5);
		E(ctx, 140, 60, 12, 10, "#7aaa6a", INK, 2);
		E(ctx, 124, 48, 4, 5, "#fff", INK, 1.2); E(ctx, 125, 49, 2, 2, INK);
		poly(ctx, [[112, 36], [116, 24], [122, 36]], "#e0c060", INK, 1.2); poly(ctx, [[126, 34], [132, 22], [136, 36]], "#e0c060", INK, 1.2);
		R(ctx, 60, 96, 10, 16, 4, "#6a9a5a", INK, 1.5); R(ctx, 86, 96, 10, 16, 4, "#6a9a5a", INK, 1.5);
	});
	make("p_shield", 90, 110, (ctx) => {
		ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(82, 8); ctx.lineTo(82, 50); ctx.quadraticCurveTo(82, 90, 45, 104); ctx.quadraticCurveTo(8, 90, 8, 50); ctx.closePath();
		ctx.fillStyle = "#8a3a3a"; ctx.fill(); ctx.strokeStyle = "#c8a050"; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
		R(ctx, 39, 12, 12, 86, 0, "#e0c060"); R(ctx, 12, 40, 66, 12, 0, "#e0c060");
	});
	make("p_owl", 80, 100, (ctx) => {
		E(ctx, 40, 58, 30, 38, "#a8845a", INK, 2.5);
		E(ctx, 40, 70, 18, 22, "#e8d8b8");
		poly(ctx, [[14, 30], [18, 8], [30, 26]], "#a8845a", INK, 2); poly(ctx, [[66, 30], [62, 8], [50, 26]], "#a8845a", INK, 2);
		E(ctx, 28, 40, 11, 11, "#f4ecd8", INK, 1.5); E(ctx, 52, 40, 11, 11, "#f4ecd8", INK, 1.5);
		E(ctx, 28, 40, 5, 5, INK); E(ctx, 52, 40, 5, 5, INK);
		poly(ctx, [[36, 50], [44, 50], [40, 58]], "#e0a040", INK, 1.2);
		for (let k = 0; k < 6; k++) ctx.beginPath(), ctx.arc(30 + (k % 3) * 10, 66 + Math.floor(k / 3) * 10, 4, 0.2, Math.PI - 0.2), ctx.stroke();
	});
	make("p_rosebush", 130, 100, (ctx) => {
		[[30, 66, 28], [64, 54, 34], [100, 66, 28]].forEach((q) => E(ctx, q[0], q[1], q[2], q[2] * 0.8, "#4a7a3a", "#2e5a22", 2));
		[[24, 54], [48, 40], [70, 34], [92, 46], [108, 60], [60, 66], [36, 74], [86, 72]].forEach((q, k) => {
			E(ctx, q[0], q[1], 8, 8, k % 3 ? "#c8403a" : "#e8a0b0", INK, 1.2); ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, 4.5); ctx.strokeStyle = "rgba(80,20,20,0.6)"; ctx.lineWidth = 1.2; ctx.stroke();
		});
	});
	// ---- 宇宙 ----
	make("p_planet", 170, 110, (ctx) => {
		ctx.beginPath(); ctx.ellipse(85, 56, 80, 20, -0.25, Math.PI, Math.PI * 2); ctx.strokeStyle = "#c8a870"; ctx.lineWidth = 8; ctx.stroke();
		E(ctx, 85, 56, 42, 42, "#d8a060", INK, 2.5);
		ctx.save(); ctx.beginPath(); ctx.arc(85, 56, 42, 0, Math.PI * 2); ctx.clip();
		R(ctx, 30, 40, 120, 8, 0, "#b8804a"); R(ctx, 30, 66, 120, 10, 0, "#c8904a"); ctx.restore();
		ctx.beginPath(); ctx.ellipse(85, 56, 80, 20, -0.25, 0, Math.PI); ctx.strokeStyle = "#c8a870"; ctx.lineWidth = 8; ctx.stroke();
		ctx.beginPath(); ctx.ellipse(85, 56, 80, 20, -0.25, 0, Math.PI * 2); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
	});
	make("p_rocket", 90, 170, (ctx) => {
		poly(ctx, [[22, 110], [4, 150], [26, 140]], "#c8403a", INK, 2); poly(ctx, [[68, 110], [86, 150], [64, 140]], "#c8403a", INK, 2);
		ctx.beginPath(); ctx.moveTo(45, 4); ctx.quadraticCurveTo(76, 40, 68, 140); ctx.lineTo(22, 140); ctx.quadraticCurveTo(14, 40, 45, 4); ctx.closePath();
		ctx.fillStyle = "#e8e0d0"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		E(ctx, 45, 66, 13, 13, "#7ab0d0", "#a8a8b0", 4);
		poly(ctx, [[30, 140], [60, 140], [54, 166], [45, 156], [36, 166]], "#f0a040", INK, 1.5);
		poly(ctx, [[36, 22], [54, 22], [45, 4]], "#c8403a");
	});
	make("p_ufo", 150, 100, (ctx) => {
		poly(ctx, [[60, 56], [90, 56], [118, 96], [32, 96]], "rgba(255,240,160,0.4)");
		E(ctx, 75, 34, 28, 26, "#a8d0d8", INK, 2.5);
		E(ctx, 75, 52, 70, 16, "#8a8a98", INK, 2.5);
		for (let k = 0; k < 6; k++) E(ctx, 22 + k * 21, 54, 5, 4, "#f4d860", INK, 1);
		E(ctx, 68, 26, 8, 6, "rgba(255,255,255,0.6)");
	});
	make("p_astronaut", 100, 140, (ctx) => {
		R(ctx, 30, 96, 16, 36, 6, "#e8e4dc", INK, 2); R(ctx, 54, 96, 16, 36, 6, "#e8e4dc", INK, 2);
		R(ctx, 8, 60, 16, 40, 8, "#e8e4dc", INK, 2, 0); R(ctx, 76, 60, 16, 40, 8, "#e8e4dc", INK, 2);
		R(ctx, 22, 54, 56, 54, 12, "#f0ece4", INK, 2.5);
		R(ctx, 38, 66, 24, 16, 3, "#c8604a", INK, 1.5);
		E(ctx, 50, 32, 28, 28, "#f0ece4", INK, 2.5); E(ctx, 50, 34, 20, 16, "#4a6a8a", INK, 2);
		E(ctx, 44, 30, 6, 4, "rgba(255,255,255,0.6)");
	});
	make("p_comet", 170, 80, (ctx) => {
		const g = ctx.createLinearGradient(10, 0, 130, 0);
		g.addColorStop(0, "rgba(255,240,180,0)"); g.addColorStop(1, "rgba(255,230,150,0.9)");
		poly(ctx, [[6, 20], [140, 30], [140, 54], [6, 66]], g);
		E(ctx, 142, 42, 20, 20, "#f4d878", INK, 2.5); E(ctx, 136, 36, 6, 5, "rgba(255,255,255,0.7)");
	});
	make("p_satellite", 160, 90, (ctx) => {
		[[6, 26], [110, 26]].forEach((q) => { R(ctx, q[0], q[1], 44, 38, 1, "#3a5a8a", INK, 2); for (let k = 1; k < 4; k++) line(ctx, [[q[0] + k * 11, q[1]], [q[0] + k * 11, q[1] + 38]], "#8ab0d0", 1); });
		line(ctx, [[50, 45], [110, 45]], INK, 3);
		R(ctx, 62, 26, 36, 38, 4, "#c8a050", INK, 2);
		line(ctx, [[80, 26], [80, 8]], INK, 2); E(ctx, 80, 6, 5, 5, "#c8403a", INK, 1.5);
	});
	make("p_alien", 90, 110, (ctx) => {
		line(ctx, [[34, 26], [26, 4]], INK, 2.5); line(ctx, [[56, 26], [64, 4]], INK, 2.5);
		E(ctx, 26, 4, 5, 5, "#e0c060", INK, 1.5); E(ctx, 64, 4, 5, 5, "#e0c060", INK, 1.5);
		R(ctx, 24, 66, 42, 38, 12, "#8ac07a", INK, 2.5);
		E(ctx, 45, 44, 30, 26, "#9ad08a", INK, 2.5);
		E(ctx, 45, 40, 11, 12, "#fff", INK, 1.5); E(ctx, 45, 42, 5, 5, INK);
		ctx.beginPath(); ctx.arc(45, 54, 7, 0.3, Math.PI - 0.3); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
	});
	make("p_moonflag", 80, 140, (ctx) => {
		line(ctx, [[14, 4], [14, 136]], "#a8a8b0", 4);
		R(ctx, 16, 8, 58, 40, 1, "#f4ecd8", INK, 2);
		star5(ctx, 45, 28, 13, "#e0b040");
		E(ctx, 14, 136, 12, 4, "#7a756a");
	});
	make("p_rover", 150, 100, (ctx) => {
		R(ctx, 16, 36, 118, 34, 6, "#d8d0c0", INK, 2.5);
		R(ctx, 40, 14, 40, 24, 3, "#c8a050", INK, 2);
		line(ctx, [[110, 36], [118, 8]], INK, 2.5); E(ctx, 118, 8, 12, 5, "#e8e4dc", INK, 1.5, -0.4);
		wheel(ctx, 34, 78, 16); wheel(ctx, 75, 78, 16); wheel(ctx, 116, 78, 16);
	});
	// ---- 遊園地 ----
	make("p_balloons", 110, 170, (ctx) => {
		[[30, 40, "#c8403a"], [70, 30, "#e0c060"], [50, 64, "#4a7aa8"], [86, 66, "#6aa05a"]].forEach((q) => {
			line(ctx, [[q[0], q[1] + 26], [54, 164]], INK, 1.2);
			E(ctx, q[0], q[1], 20, 25, q[2], INK, 2); poly(ctx, [[q[0] - 4, q[1] + 28], [q[0] + 4, q[1] + 28], [q[0], q[1] + 22]], q[2], INK, 1);
			E(ctx, q[0] - 7, q[1] - 9, 4, 7, "rgba(255,255,255,0.5)");
		});
	});
	make("p_icecream", 70, 130, (ctx) => {
		poly(ctx, [[14, 60], [56, 60], [35, 126]], "#d8a860", INK, 2.5);
		for (let k = 0; k < 4; k++) { line(ctx, [[18 + k * 10, 62], [32 + k * 4, 110]], "rgba(120,70,30,0.5)", 1.2); line(ctx, [[52 - k * 10, 62], [38 - k * 4, 110]], "rgba(120,70,30,0.5)", 1.2); }
		E(ctx, 35, 54, 24, 16, "#f4ecd8", INK, 2.5); E(ctx, 35, 34, 21, 18, "#e8a0b0", INK, 2.5); E(ctx, 35, 16, 8, 8, "#c8403a", INK, 1.5);
	});
	make("p_popcorn", 90, 120, (ctx) => {
		for (let k = 0; k < 14; k++) E(ctx, 20 + (k * 37) % 52, 18 + (k * 13) % 24, 9, 8, "#f8ecc0", INK, 1.2);
		poly(ctx, [[10, 40], [80, 40], [70, 116], [20, 116]], "#f4ecd8", INK, 2.5);
		for (let k = 0; k < 4; k++) poly(ctx, [[14 + k * 17.5, 40], [23 + k * 17.5, 40], [29 + k * 12.5 - 2, 116], [22 + k * 12.5 - 2, 116]], "#c8403a");
		R(ctx, 26, 64, 38, 22, 4, "#e0c060", INK, 1.5);
	});
	make("p_merry", 130, 180, (ctx) => {
		line(ctx, [[64, 2], [64, 176]], "#c8a050", 6);
		for (let y = 10; y < 176; y += 14) line(ctx, [[61, y], [67, y + 7]], "#8a3a2a", 2);
		[[24, 132], [100, 132]].forEach((q) => line(ctx, [[q[0], q[1]], [q[0], 150]], INK, 4));
		E(ctx, 60, 96, 40, 20, "#f4ecd8", INK, 2.5);
		poly(ctx, [[90, 90], [106, 54], [122, 60], [106, 98]], "#f4ecd8", INK, 2.5);
		E(ctx, 116, 58, 12, 9, "#f4ecd8", INK, 2, 0.5);
		ctx.beginPath(); ctx.moveTo(104, 56); ctx.quadraticCurveTo(94, 70, 96, 88); ctx.strokeStyle = "#c8604a"; ctx.lineWidth = 6; ctx.stroke();
		R(ctx, 42, 80, 34, 14, 4, "#4a7aa8", INK, 1.5);
		line(ctx, [[30, 106], [16, 140]], "#f4ecd8", 9); line(ctx, [[90, 106], [104, 140]], "#f4ecd8", 9);
		E(ctx, 118, 56, 2.5, 2.5, INK);
	});
	make("p_cotton", 80, 140, (ctx) => {
		line(ctx, [[40, 70], [40, 136]], "#e8dcc0", 6); line(ctx, [[40, 70], [40, 136]], INK, 1);
		[[24, 40], [56, 40], [40, 22], [30, 60], [52, 60], [40, 44]].forEach((q) => E(ctx, q[0], q[1], 20, 18, "#f0b8c8", "#c88898", 1.5));
	});
	make("p_cupride", 140, 110, (ctx) => {
		E(ctx, 70, 98, 64, 10, "#8a5a8a", INK, 2);
		ctx.beginPath(); ctx.moveTo(12, 30); ctx.quadraticCurveTo(16, 96, 70, 96); ctx.quadraticCurveTo(124, 96, 128, 30); ctx.closePath();
		ctx.fillStyle = "#e8a0b0"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		E(ctx, 70, 30, 58, 10, "#c8607a", INK, 2);
		for (let k = 0; k < 5; k++) E(ctx, 30 + k * 20, 62, 5, 5, "#f4ecd8", INK, 1);
		R(ctx, 64, 6, 12, 24, 2, "#c8a050", INK, 1.5); E(ctx, 70, 6, 14, 5, "#c8a050", INK, 1.5);
	});
	make("p_pinwheel", 80, 170, (ctx) => {
		line(ctx, [[40, 40], [40, 166]], "#8a5a32", 5);
		[["#c8403a", 0], ["#e0c060", 1], ["#4a7aa8", 2], ["#6aa05a", 3]].forEach((q) => {
			const a = q[1] * Math.PI / 2;
			poly(ctx, [[40, 40], [40 + Math.cos(a) * 34, 40 + Math.sin(a) * 34], [40 + Math.cos(a + 0.8) * 26, 40 + Math.sin(a + 0.8) * 26]], q[0], INK, 1.5);
		});
		E(ctx, 40, 40, 5, 5, "#f4ecd8", INK, 1.5);
	});
	make("p_booth", 130, 180, (ctx) => {
		R(ctx, 14, 60, 102, 116, 2, "#e8d8b8", INK, 2.5);
		R(ctx, 30, 82, 70, 40, 4, "#8ab0c8", INK, 2);
		R(ctx, 26, 122, 78, 8, 0, "#8a5a32", INK, 1.5);
		poly(ctx, [[4, 64], [65, 10], [126, 64]], "#c8403a", INK, 2.5);
		for (let k = 0; k < 6; k++) poly(ctx, [[4 + k * 20.3, 64], [24 + k * 20.3, 64], [14 + k * 20.3, 76]], k % 2 ? "#f4ecd8" : "#c8403a", INK, 1);
		R(ctx, 40, 140, 50, 18, 2, "#e0c060", INK, 1.5);
		E(ctx, 65, 4, 5, 5, "#e0c060", INK, 1.5);
	});
	make("p_firework", 140, 140, (ctx) => {
		for (let k = 0; k < 16; k++) {
			const a = k * Math.PI / 8;
			line(ctx, [[70 + Math.cos(a) * 16, 70 + Math.sin(a) * 16], [70 + Math.cos(a) * 60, 70 + Math.sin(a) * 60]], ["#f4d060", "#e8806a", "#f4ecd8"][k % 3], 4);
			E(ctx, 70 + Math.cos(a) * 64, 70 + Math.sin(a) * 64, 4, 4, ["#f4d060", "#e8806a", "#f4ecd8"][k % 3]);
		}
		E(ctx, 70, 70, 8, 8, "#fff8e0");
	});
	// ---- 博士の研究室 ----
	make("p_globe", 110, 150, (ctx) => {
		R(ctx, 30, 134, 50, 10, 3, "#8a5a32", INK, 2); line(ctx, [[55, 134], [55, 112]], "#8a5a32", 6);
		ctx.beginPath(); ctx.arc(55, 62, 50, 0.6, Math.PI * 1.6); ctx.strokeStyle = "#c8a050"; ctx.lineWidth = 5; ctx.stroke();
		E(ctx, 55, 62, 42, 42, "#7aa0b8", INK, 2.5);
		poly(ctx, [[34, 36], [56, 30], [62, 48], [44, 64], [30, 54]], "#a8b86a", INK, 1.2);
		poly(ctx, [[60, 70], [82, 62], [86, 84], [68, 94]], "#a8b86a", INK, 1.2);
		line(ctx, [[14, 62], [96, 62]], "rgba(60,40,20,0.3)", 1); E(ctx, 55, 62, 20, 42, null, "rgba(60,40,20,0.3)", 1);
	});
	make("p_telescope", 170, 190, (ctx) => {
		line(ctx, [[84, 100], [44, 186]], "#7a5a3a", 5); line(ctx, [[84, 100], [124, 186]], "#7a5a3a", 5); line(ctx, [[84, 100], [84, 186]], "#7a5a3a", 5);
		poly(ctx, [[20, 120], [140, 30], [154, 50], [34, 140]], "#c8a050", INK, 2.5);
		poly(ctx, [[136, 26], [162, 8], [168, 44], [150, 56]], "#a8803a", INK, 2.5);
		poly(ctx, [[14, 116], [26, 108], [40, 130], [28, 140]], "#3a3a42", INK, 2);
		[60, 100].forEach((t) => line(ctx, [[20 + t, 120 - t * 0.75], [34 + t, 140 - t * 0.75]], "#8a5a2a", 3));
	});
	make("p_microscope", 100, 150, (ctx) => {
		R(ctx, 14, 130, 72, 14, 3, "#3a3a42", INK, 2);
		ctx.beginPath(); ctx.arc(66, 92, 34, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = "#3a3a42"; ctx.lineWidth = 12; ctx.stroke();
		R(ctx, 20, 96, 44, 8, 2, "#5a5a62", INK, 1.5);
		poly(ctx, [[30, 10], [50, 6], [54, 80], [38, 82]], "#c8a050", INK, 2.5);
		R(ctx, 28, 2, 24, 10, 2, "#3a3a42", INK, 1.5);
		R(ctx, 36, 80, 18, 12, 2, "#3a3a42", INK, 1.5);
	});
	make("p_flask", 80, 120, (ctx) => {
		ctx.beginPath(); ctx.moveTo(30, 6); ctx.lineTo(30, 44); ctx.lineTo(6, 108); ctx.lineTo(74, 108); ctx.lineTo(50, 44); ctx.lineTo(50, 6); ctx.closePath();
		ctx.fillStyle = "rgba(230,240,240,0.9)"; ctx.fill();
		ctx.save(); ctx.clip(); poly(ctx, [[0, 70], [80, 64], [80, 120], [0, 120]], "#7ac0a0"); ctx.restore();
		ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		R(ctx, 26, 2, 28, 8, 2, "#c8b890", INK, 1.5);
		[[30, 86, 4], [46, 78, 3], [52, 92, 5]].forEach((q) => E(ctx, q[0], q[1], q[2], q[2], null, "rgba(255,255,255,0.8)", 1.5));
	});
	make("p_books", 120, 110, (ctx) => {
		[["#8a3a2a", 80, 6], ["#3a5a4a", 90, 2], ["#a8843a", 74, 12], ["#4a3a6a", 86, 4]].forEach((q, k) => {
			const y = 92 - k * 22;
			R(ctx, q[2] + 10, y, q[1], 20, 3, q[0], INK, 2);
			R(ctx, q[2] + 14, y + 4, q[1] - 10, 3, 1, "rgba(240,220,160,0.7)");
			R(ctx, q[2] + q[1] + 4, y + 3, 4, 14, 1, "#f0e6cc");
		});
	});
	make("p_candle", 70, 140, (ctx) => {
		E(ctx, 35, 126, 30, 9, "#c8a050", INK, 2);
		ctx.beginPath(); ctx.arc(60, 118, 8, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = "#c8a050"; ctx.lineWidth = 4; ctx.stroke();
		R(ctx, 22, 50, 26, 72, 3, "#f4ecd8", INK, 2.5);
		E(ctx, 30, 70, 4, 10, "#e8dcc0");
		line(ctx, [[35, 50], [35, 42]], INK, 2);
		E(ctx, 35, 30, 12, 20, "rgba(255,210,100,0.4)"); E(ctx, 35, 32, 6, 12, "#f4c040", "#e08a3a", 1.5);
	});
	make("p_map", 140, 110, (ctx) => {
		poly(ctx, [[8, 10], [130, 6], [134, 100], [6, 104]], "#e8d8b0", INK, 2.5);
		poly(ctx, [[30, 30], [70, 24], [90, 50], [60, 78], [26, 64]], "#c8b888", "rgba(80,60,30,0.6)", 1.5);
		ctx.setLineDash([5, 5]); line(ctx, [[20, 90], [60, 70], [100, 64]], "#a8403a", 2.5); ctx.setLineDash([]);
		line(ctx, [[96, 58], [108, 70]], "#a8403a", 4); line(ctx, [[108, 58], [96, 70]], "#a8403a", 4);
		star5(ctx, 116, 24, 12, "#f4ecd8", "rgba(80,60,30,0.8)");
	});
	make("p_hourglass", 70, 120, (ctx) => {
		R(ctx, 4, 4, 62, 10, 3, "#8a5a32", INK, 2); R(ctx, 4, 106, 62, 10, 3, "#8a5a32", INK, 2);
		ctx.beginPath(); ctx.moveTo(14, 14); ctx.quadraticCurveTo(14, 50, 35, 60); ctx.quadraticCurveTo(14, 70, 14, 106); ctx.lineTo(56, 106); ctx.quadraticCurveTo(56, 70, 35, 60); ctx.quadraticCurveTo(56, 50, 56, 14); ctx.closePath();
		ctx.fillStyle = "rgba(220,235,240,0.9)"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		poly(ctx, [[22, 30], [48, 30], [35, 56]], "#e0c070"); poly(ctx, [[18, 104], [52, 104], [35, 84]], "#e0c070");
		line(ctx, [[35, 58], [35, 86]], "#e0c070", 1.5);
		[10, 60].forEach((x) => line(ctx, [[x, 14], [x, 106]], "#8a5a32", 4));
	});
	make("p_puzzlebox", 100, 100, (ctx) => {
		poly(ctx, [[10, 34], [56, 18], [92, 34], [46, 52]], "#c8a060", INK, 2);
		poly(ctx, [[10, 34], [46, 52], [46, 96], [10, 78]], "#a8784a", INK, 2);
		poly(ctx, [[46, 52], [92, 34], [92, 78], [46, 96]], "#8a5a32", INK, 2);
		ctx.font = "bold 26px serif"; ctx.fillStyle = "#f4dc90"; ctx.fillText("?", 62, 76);
		line(ctx, [[28, 43], [28, 87]], "rgba(240,220,160,0.6)", 2); line(ctx, [[33, 26], [74, 43]], "rgba(240,220,160,0.6)", 2);
	});
	// ---- 街角 ----
	make("p_oldcar", 200, 110, (ctx) => {
		R(ctx, 10, 50, 180, 34, 8, "#3a5a6a", INK, 2.5);
		poly(ctx, [[50, 50], [62, 14], [128, 14], [140, 50]], "#3a5a6a", INK, 2.5);
		R(ctx, 70, 20, 26, 26, 2, "#c8d8e0", INK, 1.5); R(ctx, 102, 20, 26, 26, 2, "#c8d8e0", INK, 1.5);
		E(ctx, 184, 64, 8, 8, "#f4e090", INK, 1.5);
		R(ctx, 4, 78, 192, 6, 3, "#a8a8b0", INK, 1.5);
		wheel(ctx, 46, 88, 18); wheel(ctx, 154, 88, 18);
	});
	make("p_bicycle", 170, 110, (ctx) => {
		[[36, 76], [134, 76]].forEach((q) => { E(ctx, q[0], q[1], 30, 30, null, INK, 4); E(ctx, q[0], q[1], 4, 4, INK); });
		line(ctx, [[36, 76], [76, 40], [120, 40], [134, 76]], "#a8403a", 5);
		line(ctx, [[76, 40], [86, 76], [36, 76]], "#a8403a", 5); line(ctx, [[86, 76], [120, 40]], "#a8403a", 5);
		line(ctx, [[120, 40], [116, 18], [132, 14]], INK, 4);
		R(ctx, 64, 30, 24, 8, 4, "#5a3a22", INK, 1.5);
		R(ctx, 132, 26, 28, 18, 3, "#c8a060", INK, 1.5);
	});
	make("p_dog", 130, 100, (ctx) => {
		[[36, 70], [52, 72], [88, 70], [100, 70]].forEach((q) => R(ctx, q[0] - 5, q[1], 10, 26, 4, "#c8945a", INK, 2));
		ctx.beginPath(); ctx.moveTo(26, 56); ctx.quadraticCurveTo(8, 40, 16, 22); ctx.strokeStyle = "#c8945a"; ctx.lineWidth = 7; ctx.stroke();
		E(ctx, 66, 62, 42, 20, "#c8945a", INK, 2.5);
		E(ctx, 104, 38, 20, 18, "#c8945a", INK, 2.5);
		E(ctx, 120, 44, 10, 8, "#d8a46a", INK, 2); E(ctx, 128, 42, 3.5, 3, INK);
		E(ctx, 94, 36, 8, 14, "#8a5a32", INK, 2, 0.3);
		E(ctx, 108, 32, 2.5, 2.5, INK);
		R(ctx, 84, 48, 22, 6, 2, "#c8403a");
	});
	make("p_mailbox", 70, 150, (ctx) => {
		R(ctx, 8, 30, 54, 114, 6, "#b83a32", INK, 2.5);
		E(ctx, 35, 30, 30, 12, "#c8443a", INK, 2.5);
		R(ctx, 16, 54, 38, 6, 2, "#2a1a14");
		R(ctx, 20, 76, 30, 20, 2, "#f0e2c0", INK, 1.2);
		R(ctx, 4, 138, 62, 8, 2, "#8a2a24", INK, 1.5);
	});
	make("p_sign", 130, 110, (ctx) => {
		line(ctx, [[4, 10], [110, 10]], INK, 5); line(ctx, [[10, 10], [10, 34]], INK, 4);
		ctx.beginPath(); ctx.moveTo(10, 30); ctx.quadraticCurveTo(10, 10, 40, 10); ctx.stroke();
		line(ctx, [[34, 10], [34, 30]], INK, 2); line(ctx, [[96, 10], [96, 30]], INK, 2);
		R(ctx, 24, 30, 84, 68, 8, "#e8d0a0", "#8a5a32", 5);
		E(ctx, 66, 62, 26, 14, "#c88a4a", INK, 2);
		for (let k = 0; k < 3; k++) line(ctx, [[50 + k * 12, 54], [56 + k * 12, 70]], "#8a5a2a", 2);
	});
	make("p_umbrella", 140, 170, (ctx) => {
		ctx.beginPath(); ctx.moveTo(70, 56); ctx.lineTo(70, 150); ctx.arc(80, 150, 10, Math.PI, 0, true); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(6, 64); ctx.quadraticCurveTo(70, -30, 134, 64);
		for (let k = 4; k > 0; k--) ctx.quadraticCurveTo(6 + k * 32 - 16, 54, 6 + (k - 1) * 32, 64);
		ctx.closePath(); ctx.fillStyle = "#3a6a5a"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
		for (let k = 1; k < 4; k++) line(ctx, [[70, 12], [6 + k * 32, 62]], "rgba(20,40,30,0.6)", 1.5);
		line(ctx, [[70, 12], [70, 2]], INK, 3);
	});
	make("p_flowerpot", 100, 120, (ctx) => {
		[[30, 30, "#c8403a"], [52, 16, "#e8a0b0"], [72, 32, "#e0c060"], [44, 40, "#f4ecd8"], [62, 46, "#c8403a"]].forEach((q) => {
			line(ctx, [[q[0], q[1]], [50, 80]], "#5a8a3a", 3);
			for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; E(ctx, q[0] + Math.cos(a) * 6, q[1] + Math.sin(a) * 6, 5, 5, q[2], INK, 1); }
			E(ctx, q[0], q[1], 3.5, 3.5, "#e0a040");
		});
		poly(ctx, [[16, 76], [84, 76], [74, 116], [26, 116]], "#b8643a", INK, 2.5);
		R(ctx, 12, 72, 76, 12, 3, "#c8744a", INK, 2);
	});
	// ---- 答え合わせのエフェクト ----
	// キラキラ(4方向にのびる星)
	make("spark", 48, 48, (ctx) => {
		const gr = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
		gr.addColorStop(0, "#ffffff");
		gr.addColorStop(0.35, "#fff2b0");
		gr.addColorStop(1, "rgba(255,214,90,0)");
		ctx.fillStyle = gr;
		ctx.beginPath();
		for (let k = 0; k < 8; k++) {
			const r = k % 2 === 0 ? 24 : 5;
			const a = k * Math.PI / 4 - Math.PI / 2;
			ctx.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r);
		}
		ctx.closePath();
		ctx.fill();
	}, true);
	// ふわっと広がる輪
	make("ring", 160, 160, (ctx) => {
		E(ctx, 80, 80, 70, 70, null, "rgba(255,240,180,0.95)", 10);
		E(ctx, 80, 80, 60, 60, null, "rgba(255,255,255,0.5)", 4);
	}, true);
	// 光の玉(パーツの後ろでぱっと光る)
	make("glow", 200, 200, (ctx) => {
		const gr = ctx.createRadialGradient(100, 100, 0, 100, 100, 100);
		gr.addColorStop(0, "rgba(255,250,210,0.95)");
		gr.addColorStop(0.5, "rgba(255,230,140,0.45)");
		gr.addColorStop(1, "rgba(255,220,120,0)");
		ctx.fillStyle = gr;
		ctx.fillRect(0, 0, 200, 200);
	}, true);
	// ---- ロゴ ----
	make("logo", 1160, 250, (ctx, w) => {
		ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
		ctx.font = "bold 42px IPAGothic";
		ctx.lineWidth = 10; ctx.strokeStyle = "#5a3a1a"; ctx.strokeText("おてほんと おなじ絵を つくろう", w / 2, 44);
		ctx.fillStyle = "#fff6e0"; ctx.fillText("おてほんと おなじ絵を つくろう", w / 2, 44);
		ctx.font = "bold 120px IPAGothic";
		ctx.lineWidth = 28; ctx.strokeStyle = "#fff6e0"; ctx.strokeText("そっくり絵合わせ", w / 2, 160);
		ctx.lineWidth = 12; ctx.strokeStyle = "#6e4e1e"; ctx.strokeText("そっくり絵合わせ", w / 2, 160);
		const g = ctx.createLinearGradient(0, 100, 0, 220);
		g.addColorStop(0, "#f2dc9a"); g.addColorStop(1, "#b88a3a");
		ctx.fillStyle = g; ctx.fillText("そっくり絵合わせ", w / 2, 160);
	}, true);
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
		const ext = url.indexOf("image/jpeg") >= 0 ? ".jpg" : ".png";
		fs.writeFileSync(path.join(OUT, name + ext), buf);
	}
	console.log("wrote", Object.keys(images).length, "images");
})();
