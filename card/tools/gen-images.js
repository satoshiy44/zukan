// 100万円カード爆買い！の絵を作る(オリジナルモンスター20体・カード枠20種・パック30種・ボックス8種・背景・UI)
// 使い方: node tools/gen-images.js のあと python3 tools/shrink.py
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const DATA = require("./data.js");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "image");

function build(D) {
	const out = {};
	const OL = "#2a1a30";
	const mk = (w, h) => {
		const c = document.createElement("canvas"); c.width = w; c.height = h;
		const x = c.getContext("2d"); x.lineJoin = "round"; x.lineCap = "round"; return [c, x];
	};
	const save = (n, c) => { out[n] = c.toDataURL("image/png"); };
	let seed = 777;
	const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
	const shade = (hex, f) => {
		const n = parseInt(hex.slice(1), 16);
		const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))));
		return "rgb(" + ch.join(",") + ")";
	};
	const ell = (x, cx, cy, rx, ry, fill, line, lw, rot) => {
		x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
		if (fill) { x.fillStyle = fill; x.fill(); }
		if (line) { x.lineWidth = lw || 5; x.strokeStyle = line; x.stroke(); }
	};
	const rr = (x, l, t, w, h, r, fill, line, lw) => {
		x.beginPath(); x.roundRect(l, t, w, h, r);
		if (fill) { x.fillStyle = fill; x.fill(); }
		if (line) { x.lineWidth = lw || 5; x.strokeStyle = line; x.stroke(); }
	};
	const poly = (x, pts, fill, line, lw) => {
		x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath();
		if (fill) { x.fillStyle = fill; x.fill(); }
		if (line) { x.lineWidth = lw || 5; x.strokeStyle = line; x.stroke(); }
	};
	const star = (x, cx, cy, r, fill, line, lw) => {
		const p = [];
		for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, q = k % 2 ? r * 0.45 : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); }
		poly(x, p, fill, line, lw);
	};
	// 立体感のあるぬり(左上が明るい)
	const ball = (x, cx, cy, rx, ry, col, lw, rot) => {
		const g = x.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, Math.min(rx, ry) * 0.1, cx, cy, Math.max(rx, ry) * 1.05);
		g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.3));
		ell(x, cx, cy, rx, ry, g, OL, lw === undefined ? 6 : lw, rot);
	};
	const shine = (x, cx, cy, rx, ry, rot) => ell(x, cx, cy, rx, ry, "rgba(255,255,255,0.7)", null, 0, rot || -0.5);
	const text = (x, t, cx, cy, size, fill, stroke, sw, font) => {
		x.font = "bold " + size + "px " + (font || "IPAGothic"); x.textAlign = "center"; x.textBaseline = "middle";
		if (stroke) { x.lineWidth = sw || size * 0.25; x.strokeStyle = stroke; x.strokeText(t, cx, cy); }
		x.fillStyle = fill; x.fillText(t, cx, cy);
	};
	const fitText = (x, t, cx, cy, maxW, size, fill, stroke, sw) => {
		let s = size;
		x.font = "bold " + s + "px IPAGothic";
		while (x.measureText(t).width > maxW && s > 10) { s -= 1; x.font = "bold " + s + "px IPAGothic"; }
		text(x, t, cx, cy, s, fill, stroke, sw);
	};

	// ======== モンスター 256x256 ========
	const monster = (m) => {
		const [c, x] = mk(256, 256);
		const f = m.f, col = m.col, sub = m.sub;
		const hx = 128, hy = 104, hr = 64; // 頭
		const by = 182; // からだ
		// --- うしろ: つばさ・しっぽ・マント ---
		if (f.extra === "cape") poly(x, [[80, 140], [176, 140], [200, 236], [56, 236]], "#d83a4a", OL, 5);
		if (f.wings) [-1, 1].forEach((s) => {
			x.save(); x.translate(hx + s * 58, 150); x.scale(s, 1);
			if (f.wings === "bat" || f.wings === "dragon") {
				const wc = f.wings === "bat" ? shade(col, 0.15) : shade(col, -0.1);
				poly(x, [[0, -10], [60, -70], [88, -40], [92, 0], [70, -10], [62, 16], [40, 0], [26, 20]], wc, OL, 5);
				poly(x, [[10, -6], [56, -56], [48, -14]], shade(sub, 0.2));
			} else if (f.wings === "bee") {
				ell(x, 40, -40, 40, 24, "rgba(220,240,255,0.85)", OL, 4, -0.5); ell(x, 34, -6, 28, 16, "rgba(220,240,255,0.85)", OL, 4, -0.2);
			} else {
				ell(x, 36, -10, 46, 26, shade(col, -0.1), OL, 5, -0.6);
				[0, 1, 2].forEach((k) => ell(x, 50 + k * 10, 2 + k * 6, 22, 10, shade(col, 0.15 - k * 0.08), OL, 3, -0.3));
			}
			x.restore();
		});
		if (f.tail === "flame") { poly(x, [[180, 196], [236, 150], [220, 186], [246, 178], [214, 220]], "#ff5a20", OL, 5); poly(x, [[190, 200], [226, 168], [214, 196]], "#ffe060"); }
		if (f.tail === "fluffy") { ball(x, 200, 200, 34, 24, f.extra === "cape" ? sub : col, 5, -0.6); ell(x, 222, 186, 12, 9, sub); }
		if (f.tail === "fish") { poly(x, [[180, 210], [238, 180], [226, 214], [240, 244]], shade(col, -0.05), OL, 5); }
		if (f.tail === "dragon") { poly(x, [[176, 214], [240, 196], [228, 216], [250, 226], [180, 232]], col, OL, 5); }
		if (f.tail === "bolt") poly(x, [[178, 200], [216, 168], [206, 192], [238, 176], [196, 224], [204, 204]], "#ffe040", OL, 5);
		if (f.tail === "swallow") { poly(x, [[176, 204], [246, 214], [208, 222], [240, 246], [180, 226]], shade(col, -0.2), OL, 5); }
		// --- からだ ---
		if (f.body === "wool" || f.body === "cloud") {
			const wc = f.body === "cloud" ? "#ffffff" : col;
			for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; ball(x, 128 + Math.cos(a) * 52, by + Math.sin(a) * 38, 24, 22, wc, 4); }
			ball(x, 128, by, 56, 42, wc, 0);
		} else if (f.body === "rock") {
			poly(x, [[66, 230], [70, 160], [100, 136], [156, 136], [188, 164], [192, 230]], col, OL, 6);
			poly(x, [[80, 166], [102, 146], [120, 160], [100, 180]], shade(col, 0.2));
		} else {
			ball(x, 128, by, 64, 54, col);
		}
		if (f.extra === "shell") { ball(x, 128, 186, 70, 46, sub, 6); [[100, 176], [140, 170], [118, 200], [160, 198]].forEach(([a, b]) => poly(x, [[a - 14, b], [a, b - 12], [a + 14, b], [a, b + 12]], shade(sub, -0.2), OL, 3)); }
		if (f.belly) ell(x, 128, 196, 38, 30, f.beak ? "#ffffff" : sub, OL, 4);
		if (f.extra === "stripes") [0, 1].forEach((k) => { x.save(); x.beginPath(); x.ellipse(128, by, 64, 54, 0, 0, Math.PI * 2); x.clip(); x.fillStyle = sub; x.fillRect(60, 174 + k * 26, 140, 12); x.restore(); });
		if (f.extra === "lava") { x.strokeStyle = "#ff7a20"; x.lineWidth = 6; x.beginPath(); x.moveTo(96, 160); x.lineTo(112, 190); x.lineTo(104, 214); x.moveTo(160, 170); x.lineTo(148, 198); x.stroke(); }
		if (f.extra === "tentacles") for (let k = 0; k < 6; k++) { const tx = 74 + k * 22; x.strokeStyle = OL; x.lineWidth = 22; x.beginPath(); x.moveTo(tx, 200); x.quadraticCurveTo(tx + (k % 2 ? 14 : -14), 230, tx + (k % 2 ? -4 : 4), 248); x.stroke(); x.strokeStyle = col; x.lineWidth = 13; x.stroke(); }
		// 足
		if (f.extra !== "tentacles" && f.body !== "cloud") [-1, 1].forEach((s) => ball(x, 128 + s * 34, 232, 20, 13, shade(col, -0.1), 5));
		// 手
		if (f.extra !== "tentacles" && f.wings !== "bird") [-1, 1].forEach((s) => ball(x, 128 + s * 58, 182, 15, 13, col, 5));
		// --- 耳(頭のうしろ) ---
		const ear = (fn) => [-1, 1].forEach((s) => fn(s));
		if (f.ears === "pointy") ear((s) => { poly(x, [[hx + s * 20, hy - 50], [hx + s * 62, hy - 92], [hx + s * 62, hy - 30]], col, OL, 6); poly(x, [[hx + s * 34, hy - 52], [hx + s * 56, hy - 78], [hx + s * 54, hy - 42]], sub); });
		if (f.ears === "round") ear((s) => { ball(x, hx + s * 50, hy - 48, 24, 24, col, 6); ell(x, hx + s * 50, hy - 46, 12, 12, sub); });
		if (f.ears === "long") ear((s) => { ball(x, hx + s * 36, hy - 70, 16, 42, col, 6, s * 0.25); ell(x, hx + s * 36, hy - 66, 7, 30, shade(sub, 0.3), null, 0, s * 0.25); });
		if (f.ears === "tuft") ear((s) => poly(x, [[hx + s * 30, hy - 52], [hx + s * 58, hy - 86], [hx + s * 58, hy - 40]], col, OL, 6));
		if (f.ears === "fin") ear((s) => poly(x, [[hx + s * 54, hy - 10], [hx + s * 92, hy - 34], [hx + s * 80, hy + 14]], sub, OL, 5));
		// --- 頭 ---
		if (f.head === "cloud") for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; ball(x, hx + Math.cos(a) * 54, hy + Math.sin(a) * 50, 22, 20, "#ffffff", 4); }
		ball(x, hx, hy, hr, hr * 0.92, col);
		shine(x, hx - 30, hy - 32, 20, 11);
		if (f.body === "wool" && f.head !== "crown") for (let k = 0; k < 5; k++) ball(x, hx - 40 + k * 20, hy - 54, 16, 14, col, 4);
		// --- 顔 ---
		const ey = hy + 6;
		[-1, 1].forEach((s) => {
			ell(x, hx + s * 24, ey, 13, 16, OL);
			ell(x, hx + s * 24 - 4, ey - 6, 6, 6, "#ffffff"); ell(x, hx + s * 24 + 4, ey + 6, 3, 3, "#ffffff");
		});
		[-1, 1].forEach((s) => ell(x, hx + s * 44, ey + 22, 11, 7, "rgba(255,110,140,0.55)"));
		if (f.beak) poly(x, [[hx - 10, ey + 22], [hx + 10, ey + 22], [hx, ey + 34]], "#ffb020", OL, 4);
		else { x.strokeStyle = OL; x.lineWidth = 4; x.beginPath(); x.arc(hx - 7, ey + 24, 7, 0.2, Math.PI - 0.2); x.arc(hx + 7, ey + 24, 7, 0.2, Math.PI - 0.2); x.stroke(); }
		if (f.whisker) [-1, 1].forEach((s) => { x.strokeStyle = OL; x.lineWidth = 2; [-4, 4].forEach((o) => { x.beginPath(); x.moveTo(hx + s * 30, ey + 26 + o); x.lineTo(hx + s * 56, ey + 22 + o * 2); x.stroke(); }); });
		if (f.extra === "cheekbolt") [-1, 1].forEach((s) => poly(x, [[hx + s * 40, ey + 12], [hx + s * 52, ey + 24], [hx + s * 44, ey + 24], [hx + s * 54, ey + 38], [hx + s * 36, ey + 22], [hx + s * 44, ey + 22]], "#ff5a3a", OL, 2));
		if (f.extra === "moonmark") { ell(x, hx, hy - 38, 13, 13, sub); ell(x, hx + 6, hy - 42, 11, 11, col); }
		// --- 頭のかざり ---
		const hd = f.head;
		if (hd === "flame") { poly(x, [[hx - 22, hy - 54], [hx - 6, hy - 104], [hx + 4, hy - 70], [hx + 22, hy - 96], [hx + 26, hy - 52]], "#ff5a20", OL, 5); poly(x, [[hx - 10, hy - 56], [hx - 2, hy - 84], [hx + 14, hy - 58]], "#ffe060"); }
		if (hd === "leaf") { ell(x, hx + 12, hy - 70, 26, 13, sub, OL, 5, -0.6); x.strokeStyle = OL; x.lineWidth = 3; x.beginPath(); x.moveTo(hx - 4, hy - 56); x.lineTo(hx + 26, hy - 82); x.stroke(); }
		if (hd === "rock") poly(x, [[hx - 30, hy - 52], [hx - 14, hy - 76], [hx + 10, hy - 68], [hx + 30, hy - 52]], "#a8885a", OL, 5);
		if (hd === "crystal") { poly(x, [[hx - 12, hy - 54], [hx, hy - 96], [hx + 12, hy - 54]], "#bfefff", OL, 4); poly(x, [[hx - 34, hy - 46], [hx - 30, hy - 78], [hx - 16, hy - 52]], "#bfefff", OL, 4); poly(x, [[hx + 34, hy - 46], [hx + 30, hy - 78], [hx + 16, hy - 52]], "#bfefff", OL, 4); }
		if (hd === "flowerantler") [-1, 1].forEach((s) => { x.strokeStyle = OL; x.lineWidth = 9; x.beginPath(); x.moveTo(hx + s * 22, hy - 54); x.lineTo(hx + s * 38, hy - 90); x.lineTo(hx + s * 56, hy - 100); x.moveTo(hx + s * 34, hy - 80); x.lineTo(hx + s * 20, hy - 98); x.stroke(); x.strokeStyle = "#c89a6a"; x.lineWidth = 4; x.stroke(); [[38, 90], [56, 100], [20, 98]].forEach(([dx, dy]) => { for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ell(x, hx + s * dx + Math.cos(a) * 7, hy - dy + Math.sin(a) * 7, 6, 6, "#ffffff", OL, 2); } ell(x, hx + s * dx, hy - dy, 4, 4, "#ffd040"); }); });
		if (hd === "horns") [-1, 1].forEach((s) => poly(x, [[hx + s * 18, hy - 54], [hx + s * 40, hy - 96], [hx + s * 40, hy - 48]], sub, OL, 5));
		if (hd === "mushroom") { x.beginPath(); x.ellipse(hx, hy - 40, 84, 56, 0, Math.PI, 0); x.closePath(); const g = x.createLinearGradient(0, hy - 96, 0, hy - 40); g.addColorStop(0, shade(sub, 0.3)); g.addColorStop(1, sub); x.fillStyle = g; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke(); [[hx - 40, hy - 64, 12], [hx + 10, hy - 82, 14], [hx + 46, hy - 58, 10]].forEach(([a, b, r]) => ell(x, a, b, r, r * 0.8, "#ffffff")); }
		if (hd === "cloud") { ell(x, hx - 30, hy - 60, 4, 4, sub); }
		if (hd === "antenna") [-1, 1].forEach((s) => { x.strokeStyle = OL; x.lineWidth = 4; x.beginPath(); x.moveTo(hx + s * 16, hy - 58); x.quadraticCurveTo(hx + s * 26, hy - 90, hx + s * 40, hy - 96); x.stroke(); ball(x, hx + s * 40, hy - 96, 9, 9, sub, 4); });
		if (hd === "coral") [-1, 0, 1].forEach((s) => { x.strokeStyle = OL; x.lineWidth = 12; x.beginPath(); x.moveTo(hx + s * 22, hy - 56); x.lineTo(hx + s * 30, hy - 86); x.stroke(); x.strokeStyle = sub; x.lineWidth = 6; x.stroke(); ell(x, hx + s * 30, hy - 88, 7, 7, sub, OL, 3); });
		if (hd === "swirl") { x.strokeStyle = "#ffffff"; x.lineWidth = 6; x.beginPath(); x.arc(hx + 4, hy - 62, 14, Math.PI, Math.PI * 2.6); x.stroke(); }
		if (hd === "crown") { poly(x, [[hx - 40, hy - 50], [hx - 44, hy - 96], [hx - 20, hy - 72], [hx, hy - 104], [hx + 20, hy - 72], [hx + 44, hy - 96], [hx + 40, hy - 50]], "#ffd030", OL, 5); [-22, 0, 22].forEach((dx) => ell(x, hx + dx, hy - 62, 6, 6, dx ? "#40c8ff" : "#ff4a6a", OL, 2)); }
		// --- まわりのかざり ---
		if (f.extra === "bubbles") [[40, 70, 14], [26, 120, 9], [214, 60, 12], [226, 108, 8]].forEach(([a, b, r]) => { ell(x, a, b, r, r, "rgba(200,240,255,0.6)", "#ffffff", 3); ell(x, a - r * 0.3, b - r * 0.3, r * 0.25, r * 0.25, "#ffffff"); });
		if (f.extra === "stars") [[36, 60, 12], [220, 70, 10], [30, 150, 8]].forEach(([a, b, r]) => star(x, a, b, r, sub, OL, 3));
		if (f.extra === "moon") { ell(x, 214, 52, 22, 22, sub, OL, 4); ell(x, 224, 46, 18, 18, "rgba(0,0,0,0)"); x.save(); x.globalCompositeOperation = "destination-out"; ell(x, 226, 44, 18, 18, "#000"); x.restore(); }
		if (f.extra === "crystals") [[64, 140, -0.8], [192, 140, 0.8], [90, 120, -0.4], [166, 120, 0.4]].forEach(([a, b, r]) => { x.save(); x.translate(a, b); x.rotate(r); poly(x, [[-10, 0], [0, -38], [10, 0]], sub, OL, 4); poly(x, [[-4, -2], [0, -26], [4, -2]], "#ffffff"); x.restore(); });
		return c;
	};
	const monC = D.MONSTERS.map((m, i) => { const c = monster(m); save("mon" + i, c); return c; });

	// ======== カード枠 20種 180x252(絵のまど: 16,44,148x120) ========
	const RCOL = [
		["#c8c8d0", "#a0a0b0"], ["#d8905a", "#a8602a"], ["#e8eef8", "#a8b8d0"], ["#ffe060", "#d8a020"],
		["#a8e8ff", "#ff9ae8"], ["#fff8b0", "#ffd040"], ["#ffd0f0", "#ffd040"], ["#ffffff", "#ffb0d0"],
		["#ff6a6a", "#c82a3a"], ["#b07aff", "#6a2ad8"], ["rainbow", ""], ["#c8f8ff", "#80a8ff"],
		["#ffb0f0", "#80f0ff"], ["#ffd040", "#a86a10"], ["#7a2ab0", "#2a0a4a"], ["#1a1a2a", "#40ffd0"],
		["#1a1050", "#8a5aff"], ["#fff0a0", "#ffb000"], ["rainbow", "#ffd040"], ["#101010", "#ffd040"]
	];
	const rainbowG = (x, x0, y0, x1, y1) => {
		const g = x.createLinearGradient(x0, y0, x1, y1);
		["#ff5a5a", "#ffb03a", "#ffe84a", "#5ae87a", "#4ab0ff", "#9a6aff", "#ff6ad8"].forEach((cc, i) => g.addColorStop(i / 6, cc));
		return g;
	};
	D.RARITIES.forEach((r, i) => {
		const [c, x] = mk(180, 252);
		const [c0, c1] = RCOL[i];
		// 外わく
		let g;
		if (c0 === "rainbow") g = rainbowG(x, 0, 0, 180, 252);
		else { g = x.createLinearGradient(0, 0, 180, 252); g.addColorStop(0, c0); g.addColorStop(0.5, shade(c0, 0.3)); g.addColorStop(1, c1); }
		rr(x, 3, 3, 174, 246, 14, g, OL, 5);
		// 中の地
		const inner = i >= 14 ? "#1a1430" : i >= 8 ? "#fff8f0" : "#ffffff";
		rr(x, 12, 12, 156, 228, 9, inner);
		// 絵のまど(背景)
		x.save(); x.beginPath(); x.roundRect(16, 40, 148, 94, 6); x.clip();
		if (i >= 16) { const sg = x.createLinearGradient(0, 40, 0, 134); sg.addColorStop(0, "#1a0a4a"); sg.addColorStop(1, "#4a2aa8"); x.fillStyle = sg; x.fillRect(16, 40, 148, 94); seed = i * 13; for (let k = 0; k < 40; k++) ell(x, 16 + rnd() * 148, 40 + rnd() * 94, 1 + rnd() * 1.5, 1 + rnd() * 1.5, "#ffffff"); }
		else if (c0 === "rainbow" || i === 4 || i === 11 || i === 12) { x.fillStyle = rainbowG(x, 16, 40, 164, 134); x.globalAlpha = 0.45; x.fillRect(16, 40, 148, 94); x.globalAlpha = 1; }
		else { const sg = x.createRadialGradient(90, 84, 10, 90, 88, 90); sg.addColorStop(0, "#ffffff"); sg.addColorStop(1, shade(c0 === "rainbow" ? "#ffe0a0" : c0, 0.2)); x.fillStyle = sg; x.fillRect(16, 40, 148, 94); }
		if (i >= 5 && i <= 7) { seed = i; for (let k = 0; k < 14; k++) star(x, 20 + rnd() * 140, 44 + rnd() * 86, 3 + rnd() * 4, "rgba(255,255,255,0.9)"); }
		x.restore();
		rr(x, 16, 40, 148, 94, 6, null, OL, 3);
		// 名前の帯(上)・説明の帯(下)
		rr(x, 16, 16, 148, 21, 6, i >= 14 ? "#2a2050" : shade(c0 === "rainbow" ? "#ffe0a0" : c0, 0.4), OL, 2);
		rr(x, 16, 138, 148, 78, 6, i >= 14 ? "#241c40" : "#f8f4fc", OL, 2);
		// ワザの欄の区切り線
		x.strokeStyle = i >= 14 ? "rgba(255,255,255,0.2)" : "rgba(40,20,50,0.18)"; x.lineWidth = 1;
		[166, 183, 200].forEach((ly) => { x.beginPath(); x.moveTo(22, ly); x.lineTo(158, ly); x.stroke(); });
		// レアリティの帯
		rr(x, 16, 220, 148, 18, 6, c0 === "rainbow" ? rainbowG(x, 16, 0, 164, 0) : c1 || c0, OL, 2);
		// レアリティ名
		const rc = i >= 14 ? "#ffe060" : OL;
		fitText(x, r[0], 76, 229, 104, 12, "#ffffff", OL, 3);
		// 右下のマーク
		rr(x, 132, 222, 30, 14, 6, "#ffffff", OL, 1.5);
		text(x, r[1], 147, 229, 10, OL);
		// 高レアは外わくに飾り
		if (i >= 13) [[12, 12], [168, 12], [12, 240], [168, 240]].forEach(([a, b]) => star(x, a, b, 9, "#ffe060", OL, 2));
		save("frame" + i, c);
	});

	// ======== パック 30種 150x220 ========
	D.PACKS.forEach((p, i) => {
		const [c, x] = mk(150, 220);
		const col = p.col;
		const g = x.createLinearGradient(0, 0, 150, 220); g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.35));
		rr(x, 6, 14, 138, 192, 6, g, OL, 4);
		// ギザギザ(銀)
		[[4, 2], [4, 204]].forEach(([l, t]) => {
			x.beginPath(); x.moveTo(l, t + 14);
			for (let k = 0; k <= 14; k++) x.lineTo(l + k * 10, t + (k % 2 ? 0 : 14));
			x.lineTo(l + 142, t + 14); x.closePath();
			const sg = x.createLinearGradient(0, t, 0, t + 14); sg.addColorStop(0, "#f8f8ff"); sg.addColorStop(1, "#a8a8c0"); x.fillStyle = sg; x.fill(); x.lineWidth = 3; x.strokeStyle = OL; x.stroke();
		});
		// つやの線
		x.fillStyle = "rgba(255,255,255,0.25)"; poly(x, [[20, 16], [44, 16], [10, 200], [6, 200], [6, 110]], "rgba(255,255,255,0.2)");
		// 光の円とモンスター
		const lg = x.createRadialGradient(75, 100, 10, 75, 100, 70); lg.addColorStop(0, "rgba(255,255,255,0.8)"); lg.addColorStop(1, "rgba(255,255,255,0)");
		x.fillStyle = lg; x.fillRect(6, 30, 138, 140);
		x.drawImage(monC[p.mon], 14, 40, 122, 122);
		// ロゴ帯
		rr(x, 10, 22, 130, 30, 6, "rgba(20,10,30,0.75)");
		const nm = p.name.replace("パック", "");
		fitText(x, nm, 75, 38, 122, 20, "#ffffff", OL, 4);
		rr(x, 14, 166, 122, 30, 8, "#ffffff", OL, 3);
		text(x, "モンスターカード", 75, 176, 11, OL);
		text(x, "5枚入り", 75, 189, 12, "#e83a5a");
		save("pack" + i, c);
	});

	// ======== ボックス 8種 240x190 ========
	D.BOXES.forEach((b, i) => {
		const [c, x] = mk(240, 190);
		const col = b.col;
		// 上の面
		poly(x, [[20, 40], [44, 12], [232, 12], [208, 40]], shade(col, 0.35), OL, 4);
		// 横の面
		poly(x, [[208, 40], [232, 12], [232, 160], [208, 186]], shade(col, -0.4), OL, 4);
		// 前の面
		const g = x.createLinearGradient(0, 40, 0, 186); g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.2));
		rr(x, 8, 40, 200, 146, 4, g, OL, 4);
		const lg = x.createRadialGradient(150, 112, 6, 150, 112, 70); lg.addColorStop(0, "rgba(255,255,255,0.7)"); lg.addColorStop(1, "rgba(255,255,255,0)");
		x.fillStyle = lg; x.fillRect(80, 44, 128, 140);
		x.drawImage(monC[b.mon], 104, 58, 104, 104);
		rr(x, 14, 48, 110, 34, 6, "rgba(20,10,30,0.8)");
		fitText(x, b.name.replace("BOX", ""), 69, 66, 102, 20, "#ffe860", OL, 4);
		text(x, "BOX", 46, 104, 30, "#ffffff", OL, 7);
		rr(x, 14, 144, 92, 30, 8, "#ffffff", OL, 3);
		text(x, "25枚入り", 60, 160, 15, "#e83a5a");
		save("box" + i, c);
	});

	// ======== 背景: ATM(実写調) ========
	{
		const [c, x] = mk(1280, 720);
		// 壁(タイル)と床
		let g = x.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, "#d8dce4"); g.addColorStop(1, "#a8b0bc"); x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
		for (let k = 0; k < 20; k++) { x.fillStyle = "rgba(255,255,255,0.18)"; x.fillRect(k * 64, 0, 2, 600); }
		for (let k = 0; k < 10; k++) { x.fillStyle = "rgba(0,0,0,0.06)"; x.fillRect(0, k * 64, 1280, 2); }
		g = x.createLinearGradient(0, 600, 0, 720); g.addColorStop(0, "#6a6a72"); g.addColorStop(1, "#3a3a42"); x.fillStyle = g; x.fillRect(0, 600, 1280, 120);
		// 天井の光
		const lg = x.createRadialGradient(640, -100, 50, 640, 0, 700); lg.addColorStop(0, "rgba(255,255,240,0.6)"); lg.addColorStop(1, "rgba(255,255,240,0)"); x.fillStyle = lg; x.fillRect(0, 0, 1280, 720);
		// ATM本体
		const body = (l, t, w, h) => {
			x.save(); x.shadowColor = "rgba(0,0,0,0.45)"; x.shadowBlur = 40; x.shadowOffsetY = 20;
			const bg = x.createLinearGradient(l, 0, l + w, 0); bg.addColorStop(0, "#8a909c"); bg.addColorStop(0.15, "#e0e4ea"); bg.addColorStop(0.5, "#c4c8d0"); bg.addColorStop(0.85, "#e8ecf0"); bg.addColorStop(1, "#7a808a");
			rr(x, l, t, w, h, 18, bg); x.restore();
			rr(x, l, t, w, h, 18, null, "#4a4e58", 3);
		};
		body(300, 40, 680, 640);
		// 上の看板
		rr(x, 330, 60, 620, 70, 10, "#1a6ae8"); text(x, "モンスター銀行 ATM", 640, 96, 40, "#ffffff");
		// 画面
		rr(x, 400, 150, 480, 250, 12, "#22262e");
		const sg = x.createLinearGradient(0, 160, 0, 390); sg.addColorStop(0, "#2a8af0"); sg.addColorStop(1, "#0a4ab0");
		rr(x, 414, 162, 452, 226, 6, sg);
		x.fillStyle = "rgba(255,255,255,0.12)"; poly(x, [[414, 162], [600, 162], [500, 388], [414, 388]], "rgba(255,255,255,0.08)");
		// キーパッド
		rr(x, 470, 420, 340, 150, 10, "#9aa0aa", "#5a606a", 3);
		const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
		keys.forEach((k, i) => {
			const kx = 490 + (i % 4) * 0, row = Math.floor(i / 3), cc = i % 3;
			const px = 494 + cc * 70, py = 432 + row * 34;
			const kg = x.createLinearGradient(0, py, 0, py + 28); kg.addColorStop(0, "#fafafa"); kg.addColorStop(1, "#c8ccd4");
			rr(x, px, py, 60, 28, 5, kg, "#6a707a", 2); text(x, k, px + 30, py + 15, 18, "#2a2e38");
			void kx;
		});
		[["取消", "#e83a3a"], ["訂正", "#f0c020"], ["確認", "#2ab85a"]].forEach(([t, cc], i) => { rr(x, 712, 432 + i * 46, 84, 36, 6, cc, "#4a4e58", 2); text(x, t, 754, 451 + i * 46, 18, "#ffffff"); });
		// カード口・明細口
		rr(x, 870, 430, 80, 14, 4, "#1a1a20"); text(x, "カード", 910, 456, 14, "#4a4e58");
		rr(x, 870, 480, 80, 10, 4, "#1a1a20"); text(x, "明細", 910, 502, 14, "#4a4e58");
		// お札の出口
		rr(x, 420, 590, 440, 60, 10, "#3a3e48"); rr(x, 436, 602, 408, 36, 6, "#0e0e12");
		x.fillStyle = "rgba(80,255,120,0.6)"; x.fillRect(440, 600, 400, 3);
		save("bg_atm", c);
	}
	// ======== 背景: 秋葉原っぽい架空カードショップの正面 ========
	{
		const [c, x] = mk(1280, 720);
		let g = x.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, "#2a3a8a"); g.addColorStop(1, "#ff9a7a"); x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
		// まわりのビル
		seed = 3;
		[[0, 220, "#4a4a6a"], [170, 160, "#5a5070"], [1040, 140, "#4a4a6a"], [1170, 200, "#5a4a6a"]].forEach(([l, w, cc], k) => {
			const top = 40 + k * 20; x.fillStyle = cc; x.fillRect(l, top, w + 20, 720 - top);
			for (let yy = top + 20; yy < 520; yy += 40) for (let xx = l + 14; xx < l + w; xx += 34) { x.fillStyle = rnd() < 0.6 ? "#ffe8a0" : "#2a2a40"; x.fillRect(xx, yy, 20, 24); }
		});
		// 縦長のネオン看板(架空)
		const neon = (l, t, w, h, word, cc) => { rr(x, l, t, w, h, 8, "#1a1a2a", cc, 5); x.save(); x.shadowColor = cc; x.shadowBlur = 18; for (let k = 0; k < word.length; k++) text(x, word[k], l + w / 2, t + 30 + k * ((h - 40) / Math.max(1, word.length - 1)), 30, cc); x.restore(); };
		neon(70, 80, 60, 300, "カード", "#40f0ff"); neon(1180, 70, 60, 330, "高価買取", "#ff5ac8"); neon(1090, 160, 54, 220, "TCG", "#ffe040");
		// 店の建物
		g = x.createLinearGradient(0, 60, 0, 640); g.addColorStop(0, "#f4f0e8"); g.addColorStop(1, "#d8d0c4"); x.fillStyle = g; x.fillRect(240, 60, 820, 600);
		// 大きな看板
		const sg = x.createLinearGradient(0, 80, 0, 200); sg.addColorStop(0, "#ff4a5a"); sg.addColorStop(1, "#c81a3a");
		rr(x, 260, 80, 780, 130, 14, sg, OL, 5);
		x.save(); x.shadowColor = "#ffe060"; x.shadowBlur = 16; text(x, "カードショップ", 650, 118, 40, "#ffffff", OL, 8); text(x, "モンスターネスト", 650, 174, 58, "#ffe860", OL, 10); x.restore();
		x.drawImage(monC[8], 270, 86, 120, 120); x.drawImage(monC[19], 910, 86, 120, 120);
		// のれん風の横断幕
		rr(x, 260, 222, 780, 46, 8, "#ffe040", OL, 4); text(x, "★ 新弾入荷！ BOX・パック大量在庫 ★ 開封スペースあり ★", 650, 246, 26, "#c81a3a");
		// ショーウィンドウ(ポスター)
		[[270, 290], [790, 290]].forEach(([l, t], k) => {
			rr(x, l, t, 240, 300, 6, "#bfe8ff", OL, 6);
			const wg = x.createLinearGradient(l, t, l + 240, t + 300); wg.addColorStop(0, "rgba(255,255,255,0.5)"); wg.addColorStop(0.5, "rgba(255,255,255,0)"); wg.addColorStop(1, "rgba(255,255,255,0.3)");
			[0, 1, 2, 3].forEach((q) => { const px = l + 16 + (q % 2) * 110, py = t + 16 + Math.floor(q / 2) * 140; rr(x, px, py, 100, 128, 6, ["#ffe060", "#ff7ac8", "#7ad8ff", "#a8f07a"][(q + k) % 4], OL, 3); x.drawImage(monC[(q * 5 + k * 3) % 20], px + 4, py + 10, 92, 92); text(x, ["SR", "UR", "SG", "LG"][(q + k) % 4], px + 50, py + 114, 18, OL); });
			x.fillStyle = wg; x.fillRect(l, t, 240, 300);
		});
		// 入り口(ガラスの自動ドア)
		rr(x, 540, 290, 220, 350, 6, "#8ac8f0", OL, 6);
		const dg = x.createLinearGradient(540, 290, 760, 640); dg.addColorStop(0, "rgba(255,255,255,0.55)"); dg.addColorStop(0.4, "rgba(255,255,255,0.05)"); dg.addColorStop(1, "rgba(255,255,255,0.3)");
		x.fillStyle = dg; x.fillRect(540, 290, 220, 350); x.fillStyle = OL; x.fillRect(648, 290, 4, 350);
		rr(x, 584, 330, 132, 40, 8, "#ffffff", OL, 3); text(x, "OPEN", 650, 351, 26, "#2ab85a");
		// のぼり
		[[230, "#ffe040", "高価買取"], [1050, "#40c8ff", "爆アド"]].forEach(([l, cc, t]) => { x.fillStyle = "#5a5a5a"; x.fillRect(l, 300, 6, 360); rr(x, l + 6, 310, 42, 220, 2, cc, OL, 3); for (let k = 0; k < t.length; k++) text(x, t[k], l + 27, 340 + k * 50, 30, "#c81a3a"); });
		// 歩道
		g = x.createLinearGradient(0, 640, 0, 720); g.addColorStop(0, "#9a96a0"); g.addColorStop(1, "#6a6670"); x.fillStyle = g; x.fillRect(0, 640, 1280, 80);
		for (let k = 0; k < 20; k++) { x.fillStyle = "rgba(0,0,0,0.12)"; x.fillRect(k * 70, 640, 2, 80); }
		save("bg_front", c);
	}
	// ======== 背景: パックをかける壁(30パックを2ページで15ずつ) ========
	const wall = (name, hooks) => {
		const [c, x] = mk(1280, 720);
		const g = x.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, "#f0e4cc"); g.addColorStop(1, "#d8c8a8"); x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
		// 有孔ボード
		for (let yy = 20; yy < 700; yy += 28) for (let xx = 20; xx < 1270; xx += 28) ell(x, xx, yy, 3.5, 3.5, "rgba(90,60,30,0.35)");
		// 上の看板
		rr(x, 0, 0, 1280, 70, 0, "#c81a3a"); x.fillStyle = "#ffe040"; x.fillRect(0, 66, 1280, 6);
		const lg = x.createRadialGradient(640, 0, 30, 640, 200, 800); lg.addColorStop(0, "rgba(255,255,230,0.35)"); lg.addColorStop(1, "rgba(255,255,230,0)"); x.fillStyle = lg; x.fillRect(0, 0, 1280, 720);
		if (hooks) {
			for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) {
				const hx = 180 + k * 230, hy = 108 + r * 205;
				rr(x, hx - 30, hy - 8, 60, 10, 4, "#8a8a96", "#4a4a56", 2);
				x.strokeStyle = "#a8a8b4"; x.lineWidth = 5; x.beginPath(); x.moveTo(hx, hy - 4); x.lineTo(hx, hy + 18); x.stroke();
			}
		} else {
			// ボックスの棚(2段)
			[300, 560].forEach((sy) => {
				const sg = x.createLinearGradient(0, sy, 0, sy + 36); sg.addColorStop(0, "#c89a5a"); sg.addColorStop(1, "#8a5a2a");
				rr(x, 40, sy, 1200, 34, 4, sg, OL, 4);
				x.fillStyle = "rgba(0,0,0,0.18)"; x.fillRect(46, sy + 34, 1188, 14);
				rr(x, 40, sy + 4, 1200, 8, 2, "#ffe040");
			});
		}
		save(name, c);
	};
	wall("bg_wall", true);
	wall("bg_shelf", false);
	// ======== 背景: 開封部屋 ========
	{
		const [c, x] = mk(1280, 720);
		let g = x.createLinearGradient(0, 0, 0, 420); g.addColorStop(0, "#3a3050"); g.addColorStop(1, "#5a4a70"); x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
		// 壁のポスターと棚
		[[80, 60], [1040, 60]].forEach(([l, t], k) => { rr(x, l, t, 160, 210, 6, k ? "#ffe060" : "#7ad8ff", OL, 4); x.drawImage(monC[k ? 19 : 8], l + 10, t + 20, 140, 140); text(x, k ? "SECRET GOD" : "LEGEND", l + 80, t + 186, 20, OL); });
		// 机
		g = x.createLinearGradient(0, 360, 0, 720); g.addColorStop(0, "#8a5a3a"); g.addColorStop(1, "#5a3a22"); x.fillStyle = g; x.fillRect(0, 380, 1280, 340);
		for (let k = 0; k < 8; k++) { x.strokeStyle = "rgba(0,0,0,0.12)"; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 400 + k * 40); x.lineTo(1280, 410 + k * 40); x.stroke(); }
		// プレイマット
		g = x.createLinearGradient(160, 410, 1120, 700); g.addColorStop(0, "#2a4ab0"); g.addColorStop(1, "#1a2a70");
		rr(x, 160, 400, 960, 300, 26, g, "#0a1440", 5);
		x.strokeStyle = "rgba(255,255,255,0.25)"; x.lineWidth = 3; x.beginPath(); x.ellipse(640, 550, 300, 110, 0, 0, Math.PI * 2); x.stroke();
		// ライトの光
		const lg = x.createRadialGradient(640, 300, 40, 640, 450, 700); lg.addColorStop(0, "rgba(255,240,200,0.45)"); lg.addColorStop(1, "rgba(255,240,200,0)"); x.fillStyle = lg; x.fillRect(0, 0, 1280, 720);
		save("bg_room", c);
	}
	// ======== UI ========
	{
		// お札(架空) 220x104
		const [c, x] = mk(220, 104);
		const g = x.createLinearGradient(0, 0, 220, 104); g.addColorStop(0, "#f0e8d0"); g.addColorStop(1, "#d8ccb0");
		rr(x, 2, 2, 216, 100, 6, g, "#8a7a5a", 3);
		rr(x, 10, 10, 200, 84, 4, null, "#a89a70", 2);
		ell(x, 160, 52, 34, 36, "rgba(160,140,100,0.25)"); x.globalAlpha = 0.85; x.drawImage(monC[19], 126, 18, 68, 68); x.globalAlpha = 1;
		text(x, "壱万円", 64, 40, 26, "#5a4a2a"); text(x, "MONSTER BANK", 64, 72, 12, "#7a6a4a");
		save("bill", c);
	}
	{
		// カゴ(手前の網) 560x320
		const [c, x] = mk(560, 320);
		poly(x, [[10, 30], [550, 30], [500, 314], [60, 314]], "rgba(255,80,90,0.35)", "#c81a3a", 8);
		for (let k = 1; k < 12; k++) { const t = k / 12; x.strokeStyle = "#e83a4a"; x.lineWidth = 6; x.beginPath(); x.moveTo(10 + 540 * t, 30); x.lineTo(60 + 440 * t, 314); x.stroke(); }
		for (let k = 1; k < 5; k++) { const t = k / 5; x.beginPath(); x.moveTo(10 + 50 * t, 30 + 284 * t); x.lineTo(550 - 50 * t, 30 + 284 * t); x.stroke(); }
		rr(x, 0, 18, 560, 26, 10, "#ff4a5a", "#a81a2a", 4);
		save("basket", c);
	}
	{
		const btn = (name, label, c0, c1) => {
			const [c, x] = mk(320, 96);
			const g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, c0); g.addColorStop(1, c1);
			rr(x, 4, 8, 312, 84, 42, shade(c1, -0.3)); rr(x, 4, 4, 312, 80, 40, g, OL, 5);
			ell(x, 110, 22, 80, 10, "rgba(255,255,255,0.45)");
			text(x, label, 160, 46, 40, "#ffffff", OL, 9);
			save(name, c);
		};
		btn("btn_ok", "決定！", "#ff8a3a", "#e83a2a");
		btn("btn_off", "決定！", "#c8c8d0", "#8a8a96");
		const arrow = (name, dir) => {
			const [c, x] = mk(96, 96);
			ell(x, 48, 48, 42, 42, "#ffffff", OL, 5);
			poly(x, dir > 0 ? [[36, 26], [70, 48], [36, 70]] : [[60, 26], [26, 48], [60, 70]], "#e83a4a", OL, 4);
			save(name, c);
		};
		arrow("btn_next", 1); arrow("btn_prev", -1);
	}
	{
		// ERRORのはんこ 240x96
		const [c, x] = mk(240, 96);
		x.save(); x.translate(120, 48); x.rotate(-0.12);
		rr(x, -110, -38, 220, 76, 10, "rgba(255,255,255,0.15)", "#ff2a3a", 8);
		text(x, "ERROR!!", 0, 2, 48, "#ff2a3a");
		x.restore();
		save("stamp_error", c);
	}
	{
		const [c, x] = mk(48, 48);
		x.fillStyle = "#ffffff"; x.beginPath(); x.moveTo(24, 0); x.quadraticCurveTo(27, 21, 48, 24); x.quadraticCurveTo(27, 27, 24, 48); x.quadraticCurveTo(21, 27, 0, 24); x.quadraticCurveTo(21, 21, 24, 0); x.fill();
		save("spark", c);
	}
	{
		// 光の筋 800x800
		const [c, x] = mk(800, 800);
		for (let i = 0; i < 18; i++) {
			const a = i / 18 * Math.PI * 2;
			const g = x.createRadialGradient(400, 400, 30, 400, 400, 400); g.addColorStop(0, "rgba(255,245,180,0.95)"); g.addColorStop(1, "rgba(255,245,180,0)");
			x.fillStyle = g; x.beginPath(); x.moveTo(400, 400); x.arc(400, 400, 400, a, a + Math.PI / 24); x.closePath(); x.fill();
		}
		save("rays", c);
	}
	{
		// カードのうら 180x252
		const [c, x] = mk(180, 252);
		const g = x.createLinearGradient(0, 0, 180, 252); g.addColorStop(0, "#3a5ae8"); g.addColorStop(1, "#1a2a8a");
		rr(x, 3, 3, 174, 246, 14, g, OL, 5);
		rr(x, 14, 14, 152, 224, 10, null, "#ffe060", 4);
		ell(x, 90, 126, 54, 54, "#ffe060", OL, 4); ell(x, 90, 126, 40, 40, "#e83a4a", OL, 3); star(x, 90, 126, 26, "#ffffff", OL, 3);
		save("card_back", c);
	}
	return out;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build, DATA);
	// ロゴ(正方形 480x480)
	res.logo = await p.evaluate(async (src) => {
		const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
		const m1 = await load(src.m1), m2 = await load(src.m2), f = await load(src.f), bill = await load(src.bill);
		const c = document.createElement("canvas"); c.width = 480; c.height = 480; const x = c.getContext("2d");
		const OL = "#2a1a30";
		x.lineJoin = "round";
		// うしろの光
		for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.fillStyle = i % 2 ? "rgba(255,220,80,0.6)" : "rgba(255,120,80,0.5)"; x.beginPath(); x.moveTo(240, 250); x.arc(240, 250, 260, a, a + Math.PI / 16); x.closePath(); x.fill(); }
		// お札とカード
		[[-0.4, 60, 300], [0.3, 300, 320], [-0.15, 160, 360]].forEach(([r, bx, by]) => { x.save(); x.translate(bx, by); x.rotate(r); x.drawImage(bill, -88, -42, 176, 84); x.restore(); });
		x.save(); x.translate(160, 230); x.rotate(-0.2); x.drawImage(f, -80, -112, 160, 224); x.drawImage(m1, -42, -80, 84, 84); x.restore();
		x.save(); x.translate(330, 220); x.rotate(0.18); x.drawImage(f, -80, -112, 160, 224); x.drawImage(m2, -42, -80, 84, 84); x.restore();
		const word = (t, cx, cy, size, c0, c1, rot) => {
			x.save(); x.translate(cx, cy); x.rotate(rot || 0);
			x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
			x.lineWidth = size * 0.34; x.strokeStyle = OL; x.strokeText(t, 4, 6); x.strokeText(t, 0, 0);
			x.lineWidth = size * 0.16; x.strokeStyle = "#ffffff"; x.strokeText(t, 0, 0);
			const g = x.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, c0); g.addColorStop(1, c1);
			x.fillStyle = g; x.fillText(t, 0, 0); x.restore();
		};
		word("100万円", 240, 70, 96, "#fff27a", "#ffa020", -0.05);
		word("カード", 240, 360, 84, "#ffffff", "#ffd8e8", -0.04);
		word("爆買い！", 250, 436, 88, "#ff8a8a", "#e8203a", -0.04);
		return c.toDataURL("image/png");
	}, { m1: res.mon8, m2: res.mon19, f: res.frame17, bill: res.bill });
	await b.close();
	Object.keys(res).forEach((k) => fs.writeFileSync(path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64")));
	console.log("wrote", Object.keys(res).length, "images");
})();
