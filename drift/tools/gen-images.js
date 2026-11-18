// ドリフトいっぽんの絵を作る(動物ドライバー10種とカート・3つのステージの背景/観客席/小物・エフェクト・ロゴ)
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "image");

function build() {
	const out = {};
	const OL = "#2a1840";
	const mk = (w, h) => {
		const c = document.createElement("canvas"); c.width = w; c.height = h;
		const x = c.getContext("2d"); x.lineJoin = "round"; x.lineCap = "round"; return [c, x];
	};
	const save = (n, c) => { out[n] = c.toDataURL("image/png"); };
	let seed = 12345;
	const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
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
	const shade = (hex, f) => {
		const n = parseInt(hex.slice(1), 16);
		const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))));
		return "rgb(" + ch.join(",") + ")";
	};

	// ======== 動物 ========
	const ANIMALS = [
		{ id: "dog", fur: "#e0a868", ear: "#8a5a30", kart: "#ff5a5a", muzzle: "#fff4e0", nose: OL },
		{ id: "cat", fur: "#ffb050", ear: "#ffb050", kart: "#4aaeff", muzzle: "#fff4e0", nose: "#ff7090" },
		{ id: "rabbit", fur: "#ffffff", ear: "#ffffff", kart: "#ff7ac8", muzzle: "#ffffff", nose: "#ff7090" },
		{ id: "panda", fur: "#ffffff", ear: "#34303c", kart: "#5ccf5c", muzzle: "#ffffff", nose: OL },
		{ id: "bear", fur: "#a8743e", ear: "#a8743e", kart: "#ffae20", muzzle: "#f2d0a0", nose: OL },
		{ id: "penguin", fur: "#3a4262", ear: "#3a4262", kart: "#30d0e0", muzzle: "#ffffff", nose: "#ffa020" },
		{ id: "fox", fur: "#ff8a30", ear: "#ff8a30", kart: "#9a6aff", muzzle: "#ffffff", nose: OL },
		{ id: "pig", fur: "#ffb4c4", ear: "#ff98b0", kart: "#ffe040", muzzle: "#ff98b0", nose: "#e06a88" },
		{ id: "frog", fur: "#70d060", ear: "#70d060", kart: "#ff7a40", muzzle: "#d8f8b0", nose: OL },
		{ id: "chick", fur: "#ffe050", ear: "#ffe050", kart: "#4a7aff", muzzle: "#ffe050", nose: "#ff9a20" }
	];
	// 耳(頭のうしろに描く)。view: 0=前 1=横(右向き) 2=うしろ
	const ears = (x, a, cx, cy, r, view) => {
		const sideShift = view === 1 ? -r * 0.18 : 0;
		const pair = (fn) => [-1, 1].forEach((s) => fn(s, cx + sideShift + s * r * (view === 1 ? 0.5 : 0.62)));
		if (a.id === "dog") pair((s, ex) => ell(x, ex + s * r * 0.22, cy - r * 0.05, r * 0.3, r * 0.55, a.ear, OL, 5, s * 0.35));
		if (a.id === "cat" || a.id === "fox") pair((s, ex) => {
			const big = a.id === "fox" ? 1.25 : 1;
			poly(x, [[ex - r * 0.32 * big, cy - r * 0.55], [ex + s * r * 0.08, cy - r * 1.25 * big], [ex + r * 0.32 * big, cy - r * 0.5]], a.ear, OL, 5);
			if (view !== 2) poly(x, [[ex - r * 0.15, cy - r * 0.62], [ex + s * r * 0.06, cy - r * 1.02 * big], [ex + r * 0.15, cy - r * 0.6]], a.id === "fox" ? "#3a2030" : "#ff9ab0");
			else if (a.id === "fox") poly(x, [[ex - r * 0.12, cy - r * 1.0 * big], [ex + s * r * 0.08, cy - r * 1.25 * big], [ex + r * 0.1, cy - r * 1.0 * big]], "#3a2030");
		});
		if (a.id === "rabbit") pair((s, ex) => {
			ell(x, ex - s * r * 0.15, cy - r * 1.25, r * 0.24, r * 0.72, a.ear, OL, 5, s * 0.15);
			if (view !== 2) ell(x, ex - s * r * 0.15, cy - r * 1.22, r * 0.11, r * 0.5, "#ffa8c8", null, 0, s * 0.15);
		});
		if (a.id === "panda" || a.id === "bear") pair((s, ex) => {
			ell(x, ex + s * r * 0.12, cy - r * 0.78, r * 0.3, r * 0.3, a.ear, OL, 5);
			if (a.id === "bear" && view !== 2) ell(x, ex + s * r * 0.12, cy - r * 0.78, r * 0.15, r * 0.15, "#e8b880");
		});
		if (a.id === "pig") pair((s, ex) => poly(x, [[ex - r * 0.25, cy - r * 0.7], [ex + s * r * 0.3, cy - r * 1.05], [ex + r * 0.25, cy - r * 0.62]], a.ear, OL, 5));
		if (a.id === "chick") {
			[-0.3, 0, 0.3].forEach((o) => ell(x, cx + sideShift + o * r * 0.6, cy - r * 1.02, r * 0.12, r * 0.28, a.fur, OL, 4, o));
		}
	};
	const eye = (x, ex, ey, r) => {
		ell(x, ex, ey, r, r * 1.25, OL);
		ell(x, ex - r * 0.3, ey - r * 0.45, r * 0.45, r * 0.45, "#ffffff");
	};
	const head = (x, a, cx, cy, r, view) => {
		ears(x, a, cx, cy, r, view);
		// 頭
		ell(x, cx, cy, r, r * 0.92, a.fur, OL, 6);
		if (a.id === "frog") {
			// 頭の上の目玉
			[-1, 1].forEach((s) => {
				const ex = cx + (view === 1 ? (s < 0 ? -r * 0.15 : r * 0.42) : s * r * 0.5);
				ell(x, ex, cy - r * 0.72, r * 0.32, r * 0.3, a.fur, OL, 5);
				if (view !== 2) eye(x, ex + (view === 1 ? r * 0.06 : 0), cy - r * 0.74, r * 0.13);
			});
		}
		if (view === 2) {
			// うしろすがた: 毛並みのつや
			ell(x, cx - r * 0.3, cy - r * 0.42, r * 0.28, r * 0.14, "rgba(255,255,255,0.45)", null, 0, -0.5);
			if (a.id === "penguin") ell(x, cx, cy + r * 0.55, r * 0.55, r * 0.22, "rgba(255,255,255,0.15)");
			if (a.id === "cat") [-0.35, 0, 0.35].forEach((o) => { x.strokeStyle = "#e07a20"; x.lineWidth = 7; x.beginPath(); x.moveTo(cx + o * r, cy - r * 0.8); x.lineTo(cx + o * r * 0.8, cy - r * 0.35); x.stroke(); });
			if (a.id === "panda") ell(x, cx, cy + r * 0.62, r * 0.7, r * 0.25, "#34303c");
			return;
		}
		const front = view === 0;
		const fx = front ? cx : cx + r * 0.38; // 顔の真ん中
		if (a.id === "penguin") ell(x, fx + (front ? 0 : r * 0.05), cy + r * 0.12, r * (front ? 0.72 : 0.58), r * 0.66, "#ffffff");
		if (a.id === "fox") ell(x, fx + (front ? 0 : r * 0.1), cy + r * 0.35, r * (front ? 0.7 : 0.5), r * 0.42, "#ffffff");
		if (a.id === "cat" && front) [-1, 1].forEach((s) => { x.strokeStyle = "#e07a20"; x.lineWidth = 6; x.beginPath(); x.moveTo(cx + s * r * 0.9, cy); x.lineTo(cx + s * r * 0.62, cy + r * 0.04); x.stroke(); });
		// 目
		if (a.id !== "frog") {
			const eg = r * 0.36, ey = cy - r * 0.08;
			if (front) {
				[-1, 1].forEach((s) => {
					if (a.id === "panda") ell(x, cx + s * eg, ey + r * 0.04, r * 0.24, r * 0.3, "#34303c", null, 0, -s * 0.5);
					eye(x, cx + s * eg, ey, r * 0.11);
				});
			} else {
				if (a.id === "panda") ell(x, fx + r * 0.05, ey + r * 0.04, r * 0.22, r * 0.28, "#34303c", null, 0, -0.4);
				eye(x, fx + r * 0.06, ey, r * 0.11);
				ell(x, fx - r * 0.42, ey, r * 0.08, r * 0.1, OL);
			}
		}
		// ほっぺ
		const ck = (px) => ell(x, px, cy + r * 0.24, r * 0.15, r * 0.09, "rgba(255,100,140,0.6)");
		if (front) { ck(cx - r * 0.58); ck(cx + r * 0.58); } else ck(fx - r * 0.12);
		// 口もと
		const mx = front ? cx : fx + r * 0.42, my = cy + r * 0.24;
		if (a.id === "chick" || a.id === "penguin") {
			poly(x, front ? [[mx - r * 0.16, my - r * 0.06], [mx + r * 0.16, my - r * 0.06], [mx, my + r * 0.14]] : [[mx - r * 0.16, my - r * 0.12], [mx + r * 0.3, my], [mx - r * 0.16, my + r * 0.08]], a.nose, OL, 4);
		} else if (a.id === "pig") {
			ell(x, mx + (front ? 0 : r * 0.08), my, r * 0.24, r * 0.17, a.muzzle, OL, 4);
			ell(x, mx - r * 0.08 + (front ? 0 : r * 0.08), my, r * 0.04, r * 0.06, a.nose);
			ell(x, mx + r * 0.08 + (front ? 0 : r * 0.08), my, r * 0.04, r * 0.06, a.nose);
		} else if (a.id === "frog") {
			x.strokeStyle = OL; x.lineWidth = 5; x.beginPath(); x.arc(front ? cx : fx, cy + r * 0.05, r * 0.4, 0.3, Math.PI - 0.3); x.stroke();
		} else {
			if (a.id === "dog" || a.id === "bear") ell(x, mx + (front ? 0 : r * 0.08), my + r * 0.04, r * 0.3, r * 0.22, a.muzzle, OL, 4);
			ell(x, mx + (front ? 0 : r * 0.24), my - r * 0.04, r * 0.09, r * 0.065, a.nose);
			x.strokeStyle = OL; x.lineWidth = 4;
			x.beginPath(); x.arc(mx - r * 0.07 + (front ? 0 : r * 0.18), my + r * 0.06, r * 0.07, 0.2, Math.PI - 0.2);
			x.arc(mx + r * 0.07 + (front ? 0 : r * 0.18), my + r * 0.06, r * 0.07, 0.2, Math.PI - 0.2); x.stroke();
		}
	};
	const wheel = (x, l, t, w, h) => {
		rr(x, l, t, w, h, 14, "#2a2436", OL, 5);
		rr(x, l + w * 0.2, t + h * 0.3, w * 0.6, h * 0.4, 8, "#c8c0d8");
		x.fillStyle = "rgba(255,255,255,0.25)"; x.fillRect(l + 6, t + 8, 6, h - 16);
	};
	ANIMALS.forEach((a) => {
		// ---- うしろから(280x230) ----
		{
			const [c, x] = mk(280, 272);
			x.translate(0, 42);
			const k = a.kart;
			// マフラー(風になびく)
			x.fillStyle = shade(k, 0.55); x.strokeStyle = OL; x.lineWidth = 4;
			x.beginPath(); x.moveTo(150, 116); x.quadraticCurveTo(205, 104, 236, 124); x.lineTo(232, 140); x.quadraticCurveTo(205, 124, 152, 132); x.closePath(); x.fill(); x.stroke();
			// うしろのタイヤ
			wheel(x, 14, 128, 58, 92); wheel(x, 208, 128, 58, 92);
			// シート
			rr(x, 82, 84, 116, 70, 24, shade(k, -0.35), OL, 5);
			head(x, a, 140, 76, 56, 2);
			// 車体
			x.beginPath(); x.moveTo(46, 136); x.lineTo(234, 136); x.lineTo(222, 206); x.lineTo(58, 206); x.closePath();
			x.fillStyle = k; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
			x.fillStyle = shade(k, 0.45); x.fillRect(58, 142, 164, 12);
			// ウイング
			rr(x, 40, 124, 200, 18, 8, shade(k, -0.15), OL, 5);
			// ナンバー(白い丸に星)
			ell(x, 140, 176, 22, 20, "#ffffff", OL, 4); star(x, 140, 177, 13, k);
			// マフラーの出口
			[-1, 1].forEach((s) => { rr(x, 140 + s * 52 - 10, 194, 20, 18, 6, "#9890a8", OL, 4); ell(x, 140 + s * 52, 204, 5, 4, "#2a2436"); });
			// テールランプ
			rr(x, 64, 160, 28, 14, 6, "#ff4060", OL, 3); rr(x, 188, 160, 28, 14, 6, "#ff4060", OL, 3);
			save("kart_" + a.id + "_back", c);
		}
		// ---- ななめうしろ(ドリフト中・右へ曲がる向き 300x230) ----
		{
			const [c, x] = mk(300, 272);
			x.translate(0, 42);
			const k = a.kart;
			// 奥のタイヤ
			wheel(x, 218, 120, 44, 70); wheel(x, 60, 118, 40, 64);
			// シート
			rr(x, 70, 82, 100, 70, 24, shade(k, -0.35), OL, 5);
			head(x, a, 128, 74, 54, 1);
			// マフラー
			x.fillStyle = shade(k, 0.55); x.strokeStyle = OL; x.lineWidth = 4;
			x.beginPath(); x.moveTo(100, 112); x.quadraticCurveTo(50, 96, 18, 116); x.lineTo(22, 132); x.quadraticCurveTo(52, 116, 100, 128); x.closePath(); x.fill(); x.stroke();
			// 車体(右が鼻先)
			x.beginPath(); x.moveTo(26, 140); x.lineTo(190, 128); x.quadraticCurveTo(268, 132, 290, 168); x.lineTo(280, 200); x.lineTo(40, 206); x.closePath();
			x.fillStyle = k; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
			x.fillStyle = shade(k, 0.45); x.beginPath(); x.moveTo(40, 146); x.lineTo(190, 136); x.quadraticCurveTo(250, 140, 270, 160); x.lineTo(40, 160); x.closePath(); x.fill();
			// ウイング
			x.save(); x.translate(44, 128); x.rotate(-0.08); rr(x, -30, -8, 110, 18, 8, shade(k, -0.15), OL, 5); x.restore();
			ell(x, 150, 180, 20, 18, "#ffffff", OL, 4); star(x, 150, 181, 12, k);
			// 手前のタイヤ
			wheel(x, 22, 150, 60, 76); wheel(x, 214, 154, 56, 72);
			rr(x, 270, 162, 18, 12, 5, "#fff6b0", OL, 3);
			save("kart_" + a.id + "_side", c);
		}
		// ---- 顔(160x160) ----
		{
			const [c, x] = mk(160, 160);
			head(x, a, 80, 104, 47, 0);
			save("face_" + a.id, c);
		}
	});

	// ======== エフェクト ========
	{
		const [c, x] = mk(96, 96);
		const g = x.createRadialGradient(48, 48, 4, 48, 48, 46); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.6, "rgba(245,240,255,0.8)"); g.addColorStop(1, "rgba(255,255,255,0)");
		x.fillStyle = g; x.beginPath(); x.arc(48, 48, 46, 0, Math.PI * 2); x.fill();
		save("smoke", c);
	}
	// オーラ: 白 青 黄 緑 紫 ピンク 赤 虹
	const AURA = ["#ffffff", "#40a8ff", "#ffe030", "#40e070", "#b060ff", "#ff70c8", "#ff3a3a"];
	const aura = (name, cols) => {
		const [c, x] = mk(420, 300);
		// もえあがる炎のような輪
		for (let layer = 0; layer < 3; layer++) {
			const col = cols[layer % cols.length];
			for (let i = 0; i < 26; i++) {
				const a = i / 26 * Math.PI * 2;
				const px = 210 + Math.cos(a) * (150 - layer * 26), py = 170 + Math.sin(a) * (95 - layer * 16);
				const fl = (Math.sin(a) < 0 ? 1.7 : 0.9) * (1 - layer * 0.2);
				const g = x.createRadialGradient(px, py - 10, 2, px, py - 10, 52 * fl);
				const cc = cols.length > 3 ? cols[(i + layer * 2) % cols.length] : col;
				g.addColorStop(0, cc); g.addColorStop(1, "rgba(255,255,255,0)");
				x.globalAlpha = 0.55; x.fillStyle = g; x.beginPath(); x.ellipse(px, py - 10 * fl, 30, 52 * fl, 0, 0, Math.PI * 2); x.fill();
			}
		}
		x.globalAlpha = 1;
		const g = x.createRadialGradient(210, 170, 20, 210, 170, 170);
		g.addColorStop(0, "rgba(255,255,255,0.0)"); g.addColorStop(0.6, "rgba(255,255,255,0.0)"); g.addColorStop(0.8, "rgba(255,255,255,0.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
		x.fillStyle = g; x.fillRect(0, 0, 420, 300);
		save(name, c);
	};
	AURA.forEach((col, i) => aura("aura" + i, [col, shade(col, 0.5), col]));
	aura("aura7", ["#ff4040", "#ff9a30", "#ffe040", "#50e070", "#40b0ff", "#9a60ff", "#ff70c8"]);
	{
		// キラキラ
		const [c, x] = mk(48, 48);
		x.fillStyle = "#ffffff"; x.beginPath(); x.moveTo(24, 0); x.quadraticCurveTo(27, 21, 48, 24); x.quadraticCurveTo(27, 27, 24, 48); x.quadraticCurveTo(21, 27, 0, 24); x.quadraticCurveTo(21, 21, 24, 0); x.fill();
		save("spark", c);
	}
	{
		// ブーストの炎
		const [c, x] = mk(80, 140);
		const g = x.createLinearGradient(0, 0, 0, 140); g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, "#ffe860"); g.addColorStop(0.7, "#ff7a30"); g.addColorStop(1, "rgba(255,60,80,0)");
		x.fillStyle = g; x.beginPath(); x.moveTo(40, 0); x.quadraticCurveTo(80, 40, 52, 140); x.lineTo(28, 140); x.quadraticCurveTo(0, 40, 40, 0); x.fill();
		ell(x, 40, 30, 14, 24, "rgba(255,255,255,0.9)");
		save("flame", c);
	}
	{
		const [c, x] = mk(56, 56);
		star(x, 28, 28, 24, "#ffe040", OL, 4);
		save("star", c);
	}
	{
		const [c, x] = mk(260, 120);
		const g = x.createRadialGradient(130, 60, 10, 130, 60, 130); g.addColorStop(0, "rgba(20,10,40,0.5)"); g.addColorStop(1, "rgba(20,10,40,0)");
		x.fillStyle = g; x.save(); x.scale(1, 0.46); x.beginPath(); x.arc(130, 130, 130, 0, Math.PI * 2); x.restore(); x.fill();
		save("shadow", c);
	}
	// カーブの看板(画面に出る大きな点滅マーク) 右向き。左はプログラムで左右反転
	{
		const [c, x] = mk(260, 260);
		x.save(); x.translate(130, 130); x.rotate(Math.PI / 4);
		rr(x, -86, -86, 172, 172, 22, "#ffd820", OL, 10);
		rr(x, -72, -72, 144, 144, 14, null, "#ffffff", 5);
		x.restore();
		x.strokeStyle = OL; x.lineWidth = 22; x.lineCap = "round";
		x.beginPath(); x.moveTo(98, 196); x.lineTo(98, 128); x.quadraticCurveTo(98, 92, 140, 92); x.lineTo(150, 92); x.stroke();
		poly(x, [[146, 58], [196, 92], [146, 126]], OL);
		save("curve_sign", c);
	}
	// 道ばたの矢印看板(右カーブ用) 200x220
	{
		const [c, x] = mk(200, 220);
		rr(x, 92, 110, 16, 110, 4, "#e8e0f0", OL, 4);
		rr(x, 8, 20, 184, 104, 14, "#ffffff", OL, 6);
		rr(x, 18, 30, 164, 84, 8, "#ff4a5a");
		[0, 1, 2].forEach((i) => {
			x.strokeStyle = "#ffffff"; x.lineWidth = 16; x.beginPath(); x.moveTo(40 + i * 46, 44); x.lineTo(70 + i * 46, 72); x.lineTo(40 + i * 46, 100); x.stroke();
		});
		save("chevron", c);
	}

	// ======== 観客席 ========
	const crowdHead = (x, cx, cy, r, col, up, kind) => {
		// 両手をあげる
		if (up) [-1, 1].forEach((s) => { x.strokeStyle = OL; x.lineWidth = r * 0.5 + 2; x.beginPath(); x.moveTo(cx + s * r * 0.7, cy + r * 0.6); x.lineTo(cx + s * r * 1.15, cy - r * 0.9); x.stroke(); x.strokeStyle = col; x.lineWidth = r * 0.5 - 2; x.stroke(); });
		if (kind === "ghost") {
			x.beginPath(); x.arc(cx, cy, r, Math.PI, 0); x.lineTo(cx + r, cy + r * 1.1);
			for (let k = 0; k < 3; k++) x.quadraticCurveTo(cx + r - (k + 0.5) * r * 2 / 3, cy + r * 0.7, cx + r - (k + 1) * r * 2 / 3, cy + r * 1.1);
			x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 3; x.strokeStyle = OL; x.stroke();
		} else {
			if (kind === "cat") [-1, 1].forEach((s) => poly(x, [[cx + s * r * 0.9, cy - r * 0.2], [cx + s * r * 0.75, cy - r * 1.1], [cx + s * r * 0.2, cy - r * 0.8]], col, OL, 3));
			if (kind === "bear") [-1, 1].forEach((s) => ell(x, cx + s * r * 0.72, cy - r * 0.72, r * 0.36, r * 0.36, col, OL, 3));
			if (kind === "bunny") [-1, 1].forEach((s) => ell(x, cx + s * r * 0.4, cy - r * 1.2, r * 0.24, r * 0.65, col, OL, 3));
			if (kind === "imp") [-1, 1].forEach((s) => poly(x, [[cx + s * r * 0.75, cy - r * 0.4], [cx + s * r * 1.05, cy - r * 1.3], [cx + s * r * 0.3, cy - r * 0.75]], "#fff0d0", OL, 3));
			ell(x, cx, cy, r, r * 0.92, col, OL, 3);
		}
		ell(x, cx - r * 0.35, cy - r * 0.05, r * 0.13, r * 0.17, OL); ell(x, cx + r * 0.35, cy - r * 0.05, r * 0.13, r * 0.17, OL);
		x.strokeStyle = OL; x.lineWidth = 2.5; x.beginPath(); x.arc(cx, cy + r * 0.2, r * (up ? 0.28 : 0.18), 0.1, Math.PI - 0.1); x.stroke();
		ell(x, cx - r * 0.62, cy + r * 0.25, r * 0.16, r * 0.1, "rgba(255,100,140,0.6)"); ell(x, cx + r * 0.62, cy + r * 0.25, r * 0.16, r * 0.1, "rgba(255,100,140,0.6)");
	};
	const crowd = (x, rows, cols, kinds) => {
		// 前の列から順に、席ごとに動物をきめる(2コマで同じ並び)
		const list = [];
		seed = 777;
		rows.forEach((row) => {
			for (let i = 0; i < row.n; i++) {
				const k = kinds[Math.floor(rnd() * kinds.length)];
				list.push({ x: row.x0 + (i + 0.5) * row.w / row.n + (rnd() - 0.5) * 6, y: row.y, r: row.r, col: cols[Math.floor(rnd() * cols.length)], k, ph: rnd() });
			}
		});
		return list;
	};
	const drawCrowd = (x, list, frame) => {
		list.forEach((p) => {
			const up = (p.ph < 0.5) === (frame === 1);
			crowdHead(x, p.x, p.y - (up ? p.r * 0.35 : 0), p.r, p.col, up, p.k);
		});
	};
	const FURS = ["#ffb050", "#ffffff", "#a8743e", "#ffb4c4", "#e0a868", "#70d060", "#ffe050", "#9ad0ff", "#c8a0ff"];
	// サーキットのグランドスタンド 960x460
	[0, 1].forEach((frame) => {
		const [c, x] = mk(960, 460);
		// 骨組み
		x.fillStyle = "#c0c8e0"; [60, 300, 660, 900].forEach((px) => { x.fillRect(px - 8, 70, 16, 390); });
		// 段
		for (let i = 0; i < 5; i++) {
			const y = 150 + i * 58;
			rr(x, 30, y, 900, 58, 6, i % 2 ? "#5a6aa8" : "#4a5a98", OL, 4);
		}
		const list = crowd(x, [0, 1, 2, 3, 4].map((i) => ({ x0: 40, w: 880, n: 15 + (i % 2), y: 170 + i * 58, r: 22 })), FURS, ["cat", "bear", "bunny", "round"]);
		drawCrowd(x, list, frame);
		// 屋根(しましま)
		x.beginPath(); x.moveTo(10, 120); x.lineTo(950, 120); x.lineTo(920, 40); x.lineTo(40, 40); x.closePath(); x.fillStyle = "#ffffff"; x.fill();
		x.save(); x.clip(); for (let i = 0; i < 20; i++) { x.fillStyle = i % 2 ? "#ff5a7a" : "#ffffff"; x.fillRect(i * 50, 30, 50, 100); } x.restore();
		x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
		for (let i = 0; i < 19; i++) { ell(x, 35 + i * 50, 122, 25, 12, i % 2 ? "#ff5a7a" : "#ffffff", OL, 3); }
		// 旗
		[120, 480, 840].forEach((px, i) => {
			x.strokeStyle = OL; x.lineWidth = 5; x.beginPath(); x.moveTo(px, 40); x.lineTo(px, 0); x.stroke();
			poly(x, [[px, 2], [px + 44 + frame * 6, 12 + frame * 4], [px, 26]], ["#ffe040", "#40c8ff", "#70e070"][i], OL, 3);
		});
		// 手前の看板
		rr(x, 20, 420, 920, 40, 6, "#ffffff", OL, 5);
		x.font = "bold 30px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#ff4a6a";
		x.fillText("★ DRIFT CUP ★   GO GO KART!   ★ DRIFT CUP ★", 480, 441);
		save("stand_c" + frame, c);
	});
	// お城の石の観客席 960x460 (おばけ・小鬼・こうもり)
	[0, 1].forEach((frame) => {
		const [c, x] = mk(960, 460);
		for (let i = 0; i < 5; i++) {
			const y = 140 + i * 60;
			rr(x, 20 + (4 - i) * 0, y, 920, 60, 4, i % 2 ? "#6a5a7a" : "#5a4a6a", OL, 4);
			for (let k = 0; k < 12; k++) { x.strokeStyle = "rgba(30,15,40,0.35)"; x.lineWidth = 3; x.beginPath(); x.moveTo(40 + k * 78 + (i % 2) * 39, y + 4); x.lineTo(40 + k * 78 + (i % 2) * 39, y + 56); x.stroke(); }
		}
		const list = crowd(x, [0, 1, 2, 3, 4].map((i) => ({ x0: 40, w: 880, n: 14 + (i % 2), y: 160 + i * 60, r: 22 })),
			["#e8e0ff", "#c8b0ff", "#ff9ab0", "#a0e0c0", "#ffd080", "#b8c0d0"], ["ghost", "imp", "ghost", "cat", "round"]);
		drawCrowd(x, list, frame);
		// 上の城壁(ギザギザ)
		x.fillStyle = "#4a3a5a"; x.fillRect(10, 60, 940, 70);
		for (let k = 0; k < 12; k++) rr(x, 10 + k * 80, 24, 50, 50, 4, "#4a3a5a", OL, 5);
		x.lineWidth = 6; x.strokeStyle = OL; x.strokeRect(10, 60, 940, 70);
		// たれ幕
		[160, 480, 800].forEach((px, i) => {
			poly(x, [[px - 50, 60], [px + 50, 60], [px + 50, 150], [px, 130 + frame * 6], [px - 50, 150]], i === 1 ? "#ff5a3a" : "#9a4adf", OL, 5);
			star(x, px, 100, 22, "#ffe040", OL, 3);
		});
		// たいまつ
		[60, 900].forEach((px) => {
			rr(x, px - 8, 70, 16, 60, 4, "#8a6040", OL, 4);
			ell(x, px, 54 - frame * 6, 20, 30 + frame * 6, "#ff8a20"); ell(x, px, 60 - frame * 4, 10, 16, "#ffe060");
		});
		rr(x, 20, 420, 920, 40, 6, "#2a1840", "#ff8a20", 5);
		x.font = "bold 30px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#ffb040";
		x.fillText("★ マグマ城グランプリ ★", 480, 441);
		save("stand_k" + frame, c);
	});
	// 山道の土手の観客(ロープ・テント・旗) 960x400
	[0, 1].forEach((frame) => {
		const [c, x] = mk(960, 400);
		// 土手
		x.beginPath(); x.moveTo(0, 400); x.lineTo(0, 170); x.quadraticCurveTo(480, 60, 960, 170); x.lineTo(960, 400); x.closePath();
		x.fillStyle = "#6ab850"; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
		// テント
		[[130, 150, "#ff6a6a"], [800, 150, "#4ab0ff"]].forEach(([px, py, col]) => {
			poly(x, [[px - 90, py + 60], [px, py - 40], [px + 90, py + 60]], col, OL, 5);
			poly(x, [[px - 26, py + 60], [px, py], [px + 26, py + 60]], "#3a2a40");
		});
		const list = crowd(x, [
			{ x0: 230, w: 500, n: 9, y: 150, r: 22 },
			{ x0: 40, w: 880, n: 15, y: 215, r: 24 },
			{ x0: 20, w: 920, n: 15, y: 285, r: 26 }
		], FURS, ["cat", "bear", "bunny", "round"]);
		drawCrowd(x, list, frame);
		// 旗をふる
		[[300, "#ffe040"], [640, "#ff5a8a"]].forEach(([px, col]) => {
			x.strokeStyle = OL; x.lineWidth = 5; x.beginPath(); x.moveTo(px, 270); x.lineTo(px + (frame ? 20 : -20), 170); x.stroke();
			const tx = px + (frame ? 20 : -20);
			poly(x, [[tx, 170], [tx + (frame ? 70 : 60), 160 + frame * 14], [tx, 210]], col, OL, 4);
		});
		// ロープ
		x.strokeStyle = "#ffe8a0"; x.lineWidth = 6; x.beginPath(); x.moveTo(0, 330); for (let k = 0; k <= 8; k++) x.quadraticCurveTo(k * 120 - 60, 352, k * 120, 330); x.stroke();
		for (let k = 0; k <= 8; k++) rr(x, k * 120 - 6, 320, 12, 80, 3, "#c8a070", OL, 3);
		save("stand_m" + frame, c);
	});

	// ======== 道ばたの小物 ========
	{
		// タイヤの山 200x150
		const [c, x] = mk(200, 150);
		[[50, 112], [100, 112], [150, 112], [75, 70], [125, 70], [100, 30]].forEach(([px, py], i) => {
			ell(x, px, py, 32, 22, "#2a2436", OL, 5); ell(x, px, py - 4, 16, 9, i % 2 ? "#ff5a7a" : "#ffffff");
		});
		save("tires", c);
	}
	{
		// 旗のポール 120x360
		const [c, x] = mk(120, 360);
		rr(x, 14, 20, 10, 340, 4, "#e0e0f0", OL, 4);
		x.beginPath(); x.moveTo(24, 26); x.quadraticCurveTo(70, 10, 116, 40); x.lineTo(110, 120); x.quadraticCurveTo(70, 96, 24, 110); x.closePath();
		x.save(); x.clip(); for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? "#2a2436" : "#ffffff"; x.fillRect(24 + i * 16, 10 + j * 28, 16, 28); } x.restore();
		x.lineWidth = 5; x.strokeStyle = OL; x.stroke();
		save("flagpole", c);
	}
	{
		// 看板 520x300
		const [c, x] = mk(520, 300);
		[90, 430].forEach((px) => rr(x, px - 10, 150, 20, 150, 4, "#e0e0f0", OL, 4));
		rr(x, 10, 10, 500, 170, 20, "#ffe040", OL, 7);
		rr(x, 26, 26, 468, 138, 12, "#ff5a8a");
		x.font = "bold 92px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
		x.lineWidth = 14; x.strokeStyle = OL; x.strokeText("DRIFT!!", 260, 98); x.fillStyle = "#ffffff"; x.fillText("DRIFT!!", 260, 98);
		save("billboard", c);
	}
	{
		// コーン 80x100
		const [c, x] = mk(80, 100);
		poly(x, [[40, 4], [64, 86], [16, 86]], "#ff8a20", OL, 5);
		x.fillStyle = "#ffffff"; x.fillRect(27, 40, 26, 12); x.fillRect(21, 62, 38, 12);
		rr(x, 6, 84, 68, 14, 4, "#ff8a20", OL, 4);
		save("cone", c);
	}
	{
		// 飛行船 420x180
		const [c, x] = mk(420, 180);
		poly(x, [[30, 80], [6, 40], [6, 120]], "#ff5a8a", OL, 5);
		ell(x, 210, 80, 190, 70, "#f0f0ff", OL, 7);
		x.fillStyle = "#ff5a8a"; x.fillRect(60, 64, 300, 32);
		x.font = "bold 34px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#ffffff"; x.fillText("DRIFT CUP", 210, 81);
		ell(x, 150, 50, 60, 14, "rgba(255,255,255,0.8)");
		rr(x, 170, 146, 80, 26, 10, "#ffe040", OL, 5);
		save("blimp", c);
	}
	{
		// たいまつ 100x300
		const [c, x] = mk(100, 300);
		rr(x, 40, 110, 20, 190, 4, "#7a5a40", OL, 4);
		rr(x, 22, 96, 56, 26, 8, "#5a4a5a", OL, 5);
		ell(x, 50, 62, 34, 48, "#ff6a20"); ell(x, 50, 74, 22, 32, "#ffb020"); ell(x, 50, 84, 12, 18, "#fff0a0");
		save("torch", c);
	}
	{
		// とがった岩 180x260
		const [c, x] = mk(180, 260);
		poly(x, [[10, 256], [60, 40], [90, 4], [120, 60], [170, 256]], "#4a3a5a", OL, 6);
		poly(x, [[60, 40], [90, 4], [96, 120], [70, 200]], "rgba(255,255,255,0.12)");
		x.strokeStyle = "#ff7a20"; x.lineWidth = 6; x.beginPath(); x.moveTo(110, 120); x.lineTo(96, 170); x.lineTo(118, 210); x.stroke();
		save("spike", c);
	}
	{
		// マグマの池(道ばた) 360x120
		const [c, x] = mk(360, 120);
		ell(x, 180, 60, 172, 52, "#ff5a20", OL, 6);
		ell(x, 180, 56, 130, 34, "#ffa020"); ell(x, 120, 50, 36, 12, "#fff080"); ell(x, 240, 64, 26, 9, "#fff080");
		save("lava", c);
	}
	{
		// ドラゴンの石像(オリジナル) 260x320
		const [c, x] = mk(260, 320);
		rr(x, 40, 250, 180, 70, 8, "#6a5a7a", OL, 6);
		ell(x, 130, 180, 80, 80, "#8a7a9a", OL, 6);
		poly(x, [[70, 120], [40, 40], [100, 100]], "#8a7a9a", OL, 5); poly(x, [[190, 120], [220, 40], [160, 100]], "#8a7a9a", OL, 5);
		ell(x, 100, 170, 14, 16, "#ff5a20", OL, 3); ell(x, 160, 170, 14, 16, "#ff5a20", OL, 3);
		rr(x, 96, 212, 68, 22, 10, "#5a4a6a", OL, 4);
		[110, 130, 150].forEach((px) => poly(x, [[px - 6, 214], [px, 226], [px + 6, 214]], "#ffffff"));
		save("dragon", c);
	}
	{
		// 松の木 220x380
		const [c, x] = mk(220, 380);
		rr(x, 96, 280, 28, 100, 6, "#8a5a3a", OL, 5);
		[[300, 100], [220, 82], [146, 62], [80, 40]].forEach(([y, w], i) => poly(x, [[110 - w, y], [110, y - 110], [110 + w, y]], i % 2 ? "#3aa060" : "#2a8a50", OL, 6));
		save("pine", c);
	}
	{
		// 岩 200x130
		const [c, x] = mk(200, 130);
		poly(x, [[8, 126], [30, 50], [90, 10], [160, 30], [194, 126]], "#9a90a8", OL, 6);
		poly(x, [[30, 50], [90, 10], [100, 60], [50, 90]], "rgba(255,255,255,0.3)");
		save("rock", c);
	}
	{
		// ガードレール 320x110
		const [c, x] = mk(320, 110);
		[30, 160, 290].forEach((px) => rr(x, px - 8, 40, 16, 70, 3, "#c8c8d8", OL, 4));
		rr(x, 4, 24, 312, 40, 8, "#f0f0f8", OL, 5);
		x.fillStyle = "#c0c0d0"; x.fillRect(8, 40, 304, 6);
		save("rail", c);
	}
	{
		// 「峠」の看板 160x260
		const [c, x] = mk(160, 260);
		rr(x, 72, 120, 16, 140, 4, "#e0e0f0", OL, 4);
		rr(x, 8, 10, 144, 120, 14, "#3a7ae8", OL, 6);
		x.font = "bold 80px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#ffffff"; x.fillText("峠", 80, 72);
		save("touge", c);
	}

	// ======== 遠くの景色(よこにつながる 2400x320、下が地平線) ========
	const wrap = (W, fn) => { [-W, 0, W].forEach((o) => fn(o)); };
	{
		// サーキット: 遠くの山と雲
		const [c, x] = mk(2400, 320);
		wrap(2400, (o) => {
			[[200, 160], [700, 120], [1200, 180], [1700, 110], [2150, 150]].forEach(([px, h]) => ell(x, px + o, 320, 380, h, "#9ad8a8"));
			[[400, 120], [1000, 90], [1500, 140], [2000, 100]].forEach(([px, h]) => ell(x, px + o, 320, 320, h, "#7ac890"));
		});
		// 遠くのビル街
		seed = 99;
		for (let i = 0; i < 40; i++) { const px = 1400 + i * 22, h = 40 + rnd() * 70; x.fillStyle = "#b8c8f0"; x.fillRect(px, 300 - h, 20, h + 20); x.fillStyle = "#e0ecff"; for (let k = 0; k < h / 14; k++) x.fillRect(px + 5, 306 - h + k * 14, 4, 5); }
		save("far_c", c);
	}
	{
		const [c, x] = mk(2400, 200);
		// 雲(空に浮かぶ)
		wrap(2400, (o) => {
			[[150, 60], [800, 100], [1400, 50], [2000, 90]].forEach(([px, py]) => {
				[[0, 0, 60], [55, -14, 50], [100, 4, 44], [-50, 8, 40]].forEach(([dx, dy, r]) => ell(x, px + dx + o, py + dy, r, r * 0.75, "#ffffff"));
			});
		});
		save("cloud_c", c);
	}
	{
		// マグマ城: 火山と大きなお城
		const [c, x] = mk(2400, 320);
		wrap(2400, (o) => {
			[[300, 220], [1800, 260]].forEach(([px, h]) => {
				poly(x, [[px - 380 + o, 320], [px - 60 + o, 320 - h], [px + 60 + o, 320 - h], [px + 380 + o, 320]], "#3a2040");
				poly(x, [[px - 60 + o, 320 - h], [px + 60 + o, 320 - h], [px + 30 + o, 320 - h + 50], [px - 20 + o, 320 - h + 80]], "#ff6a20");
			});
			[[700, 90], [1300, 120], [2200, 80]].forEach(([px, h]) => ell(x, px + o, 320, 420, h, "#4a2a50"));
		});
		// お城(オリジナル: むらさきの塔ととんがり屋根、竜の目のような窓)
		const cx = 1100;
		x.fillStyle = "#5a3a6a"; x.strokeStyle = OL; x.lineWidth = 6;
		rr(x, cx - 260, 160, 520, 160, 0, "#5a3a6a", OL, 6);
		[[-300, 70, 90], [300, 70, 90], [-150, 40, 70], [150, 40, 70], [0, 0, 110]].forEach(([dx, top, w]) => {
			rr(x, cx + dx - w / 2, top + 60, w, 320 - top - 60, 0, "#6a4a7a", OL, 6);
			poly(x, [[cx + dx - w / 2 - 14, top + 64], [cx + dx, top - 40], [cx + dx + w / 2 + 14, top + 64]], "#c03a5a", OL, 6);
			ell(x, cx + dx, top + 120, w * 0.18, w * 0.24, "#ffd040", OL, 4);
		});
		poly(x, [[cx - 60, 320], [cx - 60, 250], [cx, 214], [cx + 60, 250], [cx + 60, 320]], "#2a1030", OL, 6);
		save("far_k", c);
	}
	{
		const [c, x] = mk(2400, 200);
		// 黒い雲と火の粉
		wrap(2400, (o) => {
			[[300, 70], [1000, 110], [1600, 60], [2200, 100]].forEach(([px, py]) => {
				[[0, 0, 70], [60, -16, 54], [110, 6, 48], [-60, 8, 44]].forEach(([dx, dy, r]) => ell(x, px + dx + o, py + dy, r, r * 0.6, "rgba(40,20,50,0.75)"));
			});
		});
		seed = 7;
		for (let i = 0; i < 60; i++) ell(x, rnd() * 2400, 40 + rnd() * 160, 3, 3, "rgba(255,160,60,0.9)");
		save("cloud_k", c);
	}
	{
		// 山道: 雪の山と森
		const [c, x] = mk(2400, 320);
		wrap(2400, (o) => {
			[[250, 300], [900, 250], [1500, 310], [2100, 260]].forEach(([px, h]) => {
				poly(x, [[px - 420 + o, 320], [px + o, 320 - h], [px + 420 + o, 320]], "#8a78b8");
				poly(x, [[px - 95 + o, 320 - h + 68], [px + o, 320 - h], [px + 95 + o, 320 - h + 68], [px + 40 + o, 320 - h + 56], [px + o, 320 - h + 80], [px - 40 + o, 320 - h + 56]], "#ffffff");
			});
			[[550, 140], [1200, 120], [1850, 150]].forEach(([px, h]) => ell(x, px + o, 320, 480, h, "#5a9a70"));
		});
		seed = 31;
		for (let i = 0; i < 70; i++) { const px = rnd() * 2400, h = 30 + rnd() * 30; poly(x, [[px - 14, 322], [px, 322 - h], [px + 14, 322]], "#3a7a58"); }
		save("far_m", c);
	}
	{
		const [c, x] = mk(2400, 200);
		wrap(2400, (o) => {
			[[300, 80], [1100, 50], [1800, 100]].forEach(([px, py]) => {
				[[0, 0, 80], [70, -8, 60], [-70, 6, 50]].forEach(([dx, dy, r]) => ell(x, px + dx + o, py + dy, r * 1.2, r * 0.4, "rgba(255,220,230,0.85)"));
			});
		});
		save("cloud_m", c);
	}
	{
		// カーブの出口のゲートの横断幕 1200x170 (ここで指をはなす)
		const [c, x] = mk(1200, 170);
		rr(x, 6, 6, 1188, 158, 20, "#ffffff", OL, 8);
		x.save(); x.beginPath(); x.roundRect(14, 14, 1172, 142, 14); x.clip();
		for (let i = 0; i < 60; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? "#2a1840" : "#ffffff"; x.fillRect(14 + i * 20, 14 + j * 20, 20, 20); x.fillRect(14 + i * 20, 116 + j * 20, 20, 20); }
		x.fillStyle = "#ff4a8a"; x.fillRect(14, 54, 1172, 62);
		x.restore();
		x.font = "bold 56px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
		x.lineWidth = 12; x.strokeStyle = OL; x.strokeText("★ ここで はなす！ ★", 600, 87); x.fillStyle = "#ffffff"; x.fillText("★ ここで はなす！ ★", 600, 87);
		save("gate", c);
	}
	// ======== 道ばたの観客・モンスター(2コマ) ========
	// 立って応援する動物のファン 150x240 (足もとが下はし)
	const fan = (name, fur, shirt, kind, item, frame) => {
		const [c, x] = mk(170, 266);
		x.translate(10, 26);
		const cx = 75, hy = 92, r = 34;
		// 足
		[-1, 1].forEach((s) => rr(x, cx + s * 14 - 9, 196, 18, 40, 8, shade(shirt, -0.45), OL, 4));
		// うで(frame0: 両手を上げる / frame1: 片手をふる)
		const up = frame === 0;
		const hand = (s, hx, hy2) => {
			x.strokeStyle = OL; x.lineWidth = 15; x.beginPath(); x.moveTo(cx + s * 26, 150); x.lineTo(hx, hy2); x.stroke();
			x.strokeStyle = shirt; x.lineWidth = 9; x.stroke();
			ell(x, hx, hy2, 9, 9, fur, OL, 3);
		};
		const lh = up ? [cx - 56, 60] : [cx - 46, 178];
		const rh = up ? [cx + 56, 60] : [cx + 58, 84];
		// 持ち物(うしろに描く)
		const hx = rh[0], hyy = rh[1];
		if (item === "flag") {
			x.strokeStyle = OL; x.lineWidth = 5; x.beginPath(); x.moveTo(hx, hyy + 10); x.lineTo(hx + 4, hyy - 70); x.stroke();
			poly(x, [[hx + 4, hyy - 70], [hx + 60, hyy - 56 + frame * 10], [hx + 4, hyy - 36]], shade(shirt, 0.2), OL, 4);
		}
		if (item === "towel" && up) {
			rr(x, lh[0] - 4, lh[1] - 20, rh[0] - lh[0] + 8, 26, 6, "#ffffff", OL, 4);
			x.fillStyle = shirt; x.fillRect(lh[0] + 10, lh[1] - 14, rh[0] - lh[0] - 20, 12);
		}
		if (item === "sign") {
			const bx = up ? cx : cx + 20, by = up ? 30 : 34;
			rr(x, bx - 46, by - 26, 92, 52, 8, "#ffffff", OL, 5);
			x.font = "bold 30px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = shirt; x.fillText(frame ? "GO!" : "★♥", bx, by + 2);
		}
		if (item === "stick") [lh, rh].forEach((h) => { x.strokeStyle = shirt; x.lineWidth = 9; x.beginPath(); x.moveTo(h[0], h[1]); x.lineTo(h[0] + (h === lh ? -8 : 8), h[1] - 44); x.stroke(); ell(x, h[0] + (h === lh ? -8 : 8), h[1] - 46, 7, 7, "#ffffff"); });
		hand(-1, lh[0], lh[1]);
		hand(1, rh[0], rh[1]);
		// からだ(Tシャツ)
		ell(x, cx, 168, 34, 38, shirt, OL, 5);
		star(x, cx, 166, 12, "#ffffff");
		// 頭(上下にはずむ)
		crowdHead(x, cx, hy + (up ? -4 : 2), r, fur, false, kind);
		save(name + frame, c);
	};
	const FAN_SET = [
		["fan_a", "#ffb050", "#ff5a7a", "cat", "flag"], ["fan_b", "#ffffff", "#4aa8ff", "bunny", "towel"],
		["fan_c", "#a8743e", "#ffd030", "bear", "sign"], ["fan_d", "#ffb4c4", "#9a6aff", "round", "stick"],
		["fan_e", "#e0a868", "#40c870", "bear", "flag"], ["fan_f", "#9ad0ff", "#ff8a30", "cat", "sign"],
		["fan_g", "#70d060", "#ff5ab0", "round", "towel"], ["fan_h", "#ffe050", "#3a7ae8", "bunny", "stick"]
	];
	FAN_SET.forEach((f) => [0, 1].forEach((fr) => fan(f[0], f[1], f[2], f[3], f[4], fr)));
	// マグマ城のモンスター 160x220
	const monster = (name, frame) => {
		const [c, x] = mk(160, 220);
		const b = frame ? -6 : 0;
		if (name === "mon_ghost") {
			x.save(); x.translate(0, -24 + b * 2);
			x.beginPath(); x.arc(80, 110, 52, Math.PI, 0); x.lineTo(132, 190);
			for (let k = 0; k < 4; k++) x.quadraticCurveTo(132 - (k + 0.5) * 26, 172, 132 - (k + 1) * 26, 190);
			x.closePath(); x.fillStyle = "#f4f0ff"; x.fill(); x.lineWidth = 5; x.strokeStyle = OL; x.stroke();
			ell(x, 62, 104, 7, 10, OL); ell(x, 98, 104, 7, 10, OL); ell(x, 80, 130, 10, frame ? 12 : 6, "#ff7a9a", OL, 3);
			ell(x, 50, 122, 9, 5, "rgba(255,120,160,0.6)"); ell(x, 110, 122, 9, 5, "rgba(255,120,160,0.6)");
			[-1, 1].forEach((s) => ell(x, 80 + s * 58, 132 + (frame ? -20 : 0) * s, 14, 9, "#f4f0ff", OL, 4, s * 0.6));
			x.restore();
		}
		if (name === "mon_imp") {
			[-1, 1].forEach((s) => poly(x, [[80 + s * 30, 120], [80 + s * (78 + frame * 6), 92 - frame * 14], [80 + s * 62, 140]], "#6a3a8a", OL, 4));
			[-1, 1].forEach((s) => rr(x, 80 + s * 14 - 8, 180, 16, 36, 6, "#8a4ab0", OL, 4));
			ell(x, 80, 160, 34, 34, "#9a5ad0", OL, 5);
			ell(x, 80, 168, 20, 16, "#c8a0f0");
			// 旗(三つ又じゃなくて応援の旗)
			x.strokeStyle = OL; x.lineWidth = 5; x.beginPath(); x.moveTo(126, 176); x.lineTo(134, 40 + b); x.stroke();
			poly(x, [[134, 40 + b], [158, 56 + b + frame * 6], [134, 74 + b]], "#ff8a20", OL, 3);
			crowdHead(x, 80, 96 + b, 40, "#b07ae0", frame === 1, "imp");
		}
		if (name === "mon_slime") {
			const sq = frame ? 1.15 : 1, h = frame ? 0.85 : 1;
			x.beginPath(); x.ellipse(80, 216 - 60 * h, 62 * sq, 60 * h, 0, Math.PI, 0); x.lineTo(80 + 66 * sq, 216); x.lineTo(80 - 66 * sq, 216); x.closePath();
			x.fillStyle = "#6ad8a0"; x.fill(); x.lineWidth = 5; x.strokeStyle = OL; x.stroke();
			ell(x, 54, 216 - 92 * h, 14, 8, "rgba(255,255,255,0.7)", null, 0, -0.5);
			ell(x, 64, 216 - 50 * h, 7, 10, OL); ell(x, 96, 216 - 50 * h, 7, 10, OL);
			x.strokeStyle = OL; x.lineWidth = 4; x.beginPath(); x.arc(80, 216 - 36 * h, 10, 0.2, Math.PI - 0.2); x.stroke();
		}
		if (name === "mon_pump") {
			[-1, 1].forEach((s) => rr(x, 80 + s * 16 - 8, 184, 16, 34, 6, "#3a2a4a", OL, 4));
			ell(x, 80, 168, 30, 26, "#3a2a4a", OL, 5);
			[-1, 1].forEach((s) => { x.strokeStyle = OL; x.lineWidth = 12; x.beginPath(); x.moveTo(80 + s * 24, 160); x.lineTo(80 + s * 54, frame ? 100 : 130); x.stroke(); });
			ell(x, 80, 100 + b, 56, 46, "#ff8a20", OL, 5);
			[-30, 0, 30].forEach((o) => { x.strokeStyle = "rgba(160,60,0,0.6)"; x.lineWidth = 4; x.beginPath(); x.ellipse(80 + o, 100 + b, 14, 44, 0, 0, Math.PI * 2); x.stroke(); });
			rr(x, 74, 46 + b, 12, 18, 4, "#4a8a3a", OL, 3);
			poly(x, [[56, 92 + b], [68, 78 + b], [74, 96 + b]], "#ffe060", OL, 3); poly(x, [[104, 92 + b], [92, 78 + b], [86, 96 + b]], "#ffe060", OL, 3);
			poly(x, [[60, 112 + b], [100, 112 + b], [80, 128 + b]], "#ffe060", OL, 3);
		}
		save(name + frame, c);
	};
	["mon_ghost", "mon_imp", "mon_slime", "mon_pump"].forEach((m) => [0, 1].forEach((fr) => monster(m, fr)));
	// こうもり(空をとぶ) 160x100
	[0, 1].forEach((frame) => {
		const [c, x] = mk(160, 100);
		[-1, 1].forEach((s) => {
			const wy = frame ? 70 : 18;
			poly(x, [[80 + s * 18, 50], [80 + s * 76, wy], [80 + s * 60, 60], [80 + s * 46, wy + 14 - frame * 20], [80 + s * 30, 62]], "#5a3a7a", OL, 4);
		});
		ell(x, 80, 52, 24, 22, "#6a4a8a", OL, 5);
		[-1, 1].forEach((s) => poly(x, [[80 + s * 8, 34], [80 + s * 18, 18], [80 + s * 20, 38]], "#6a4a8a", OL, 3));
		ell(x, 72, 50, 5, 6, "#ffe060"); ell(x, 88, 50, 5, 6, "#ffe060");
		save("bat" + frame, c);
	});
	// 鳥(山道の空) 120x80
	[0, 1].forEach((frame) => {
		const [c, x] = mk(120, 80);
		[-1, 1].forEach((s) => poly(x, [[60 + s * 10, 44], [60 + s * 56, frame ? 62 : 14], [60 + s * 30, 48]], "#ffffff", OL, 4));
		ell(x, 60, 46, 20, 14, "#ffffff", OL, 4); poly(x, [[76, 44], [92, 48], [76, 52]], "#ffa020", OL, 2);
		ell(x, 68, 42, 3, 3, OL);
		save("bird" + frame, c);
	});
	// ======== 道ばたの小物(ふやす) ========
	{
		// 風船のたば 160x320
		const [c, x] = mk(160, 320);
		x.strokeStyle = "#ffffff"; x.lineWidth = 3;
		[[40, 70], [80, 40], [120, 76], [60, 120], [104, 126]].forEach(([bx, by]) => { x.beginPath(); x.moveTo(bx, by + 30); x.lineTo(80, 316); x.stroke(); });
		[[40, 70, "#ff5a7a"], [80, 40, "#ffe040"], [120, 76, "#4ab0ff"], [60, 120, "#70e070"], [104, 126, "#b070ff"]].forEach(([bx, by, col]) => {
			ell(x, bx, by, 30, 36, col, OL, 4); ell(x, bx - 10, by - 12, 8, 12, "rgba(255,255,255,0.6)");
		});
		rr(x, 66, 296, 28, 22, 4, "#e0e0f0", OL, 4);
		save("balloons", c);
	}
	{
		// 花だん 260x110
		const [c, x] = mk(260, 110);
		rr(x, 6, 60, 248, 46, 10, "#c8865a", OL, 5);
		seed = 5;
		for (let i = 0; i < 9; i++) {
			const fx = 26 + i * 26, fy = 44 + (i % 2) * 10, col = ["#ff5a8a", "#ffe040", "#ffffff", "#ff8a30", "#b070ff"][i % 5];
			ell(x, fx, fy + 16, 6, 14, "#4aa04a");
			for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ell(x, fx + Math.cos(a) * 10, fy + Math.sin(a) * 10, 8, 8, col, OL, 2); }
			ell(x, fx, fy, 6, 6, "#ffd020", OL, 2);
		}
		save("flowers", c);
	}
	{
		// 照明のやぐら 140x460
		const [c, x] = mk(140, 460);
		x.strokeStyle = "#a0a8c8"; x.lineWidth = 6;
		x.beginPath(); x.moveTo(40, 460); x.lineTo(62, 120); x.moveTo(100, 460); x.lineTo(78, 120); x.stroke();
		for (let y = 160; y < 460; y += 50) { x.beginPath(); x.moveTo(44 + (460 - y) * 0.05, y); x.lineTo(96 - (460 - y) * 0.05, y + 40); x.stroke(); }
		rr(x, 10, 30, 120, 96, 10, "#4a4a6a", OL, 6);
		for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ell(x, 34 + i * 36, 58 + j * 40, 14, 14, "#fff8c0", OL, 3);
		save("lights", c);
	}
	{
		// ろうそく台 100x240
		const [c, x] = mk(100, 240);
		rr(x, 30, 200, 40, 36, 6, "#5a4a6a", OL, 4);
		rr(x, 44, 120, 12, 84, 4, "#7a6a8a", OL, 4);
		[24, 50, 76].forEach((cx2, i) => {
			rr(x, cx2 - 8, 70 + (i === 1 ? -16 : 0), 16, 52, 4, "#f4ecd8", OL, 3);
			ell(x, cx2, 60 + (i === 1 ? -16 : 0), 8, 14, "#ffb020"); ell(x, cx2, 64 + (i === 1 ? -16 : 0), 4, 7, "#fff4a0");
		});
		x.strokeStyle = OL; x.lineWidth = 6; x.beginPath(); x.moveTo(24, 124); x.quadraticCurveTo(50, 140, 76, 124); x.stroke();
		save("candles", c);
	}
	{
		// 大なべ 200x170
		const [c, x] = mk(200, 170);
		ell(x, 100, 50, 60, 20, "#7aff8a"); ell(x, 70, 30, 12, 12, "#9aff9a", OL, 3); ell(x, 120, 20, 8, 8, "#9aff9a", OL, 3); ell(x, 100, 40, 6, 6, "#c8ffc8");
		x.beginPath(); x.moveTo(30, 60); x.quadraticCurveTo(20, 150, 100, 152); x.quadraticCurveTo(180, 150, 170, 60); x.closePath();
		x.fillStyle = "#3a3448"; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
		ell(x, 100, 60, 72, 14, "#2a2436", OL, 5);
		[[60, 166], [140, 166]].forEach(([lx, ly]) => rr(x, lx - 8, 140, 16, ly - 140, 4, "#2a2436", OL, 3));
		poly(x, [[70, 168], [100, 150], [130, 168]], "#ff6a20");
		save("cauldron", c);
	}
	{
		// 光るクリスタル 160x220
		const [c, x] = mk(160, 220);
		[[80, 216, 30, 200, "#c08aff"], [44, 216, 20, 130, "#9ad0ff"], [118, 216, 22, 150, "#ff8ad0"]].forEach(([bx, by, w, h, col]) => {
			poly(x, [[bx - w, by], [bx - w * 0.8, by - h * 0.75], [bx, by - h], [bx + w * 0.8, by - h * 0.75], [bx + w, by]], col, OL, 5);
			poly(x, [[bx - w * 0.3, by - 10], [bx - w * 0.4, by - h * 0.7], [bx, by - h * 0.92], [bx, by - 10]], "rgba(255,255,255,0.35)");
		});
		save("crystal", c);
	}
	{
		// ちょうちんの柱 110x300
		const [c, x] = mk(110, 300);
		rr(x, 48, 60, 14, 240, 4, "#8a5a3a", OL, 4);
		rr(x, 20, 56, 90, 10, 3, "#8a5a3a", OL, 3);
		[[40, 112], [86, 112]].forEach(([lx, ly]) => {
			x.strokeStyle = OL; x.lineWidth = 3; x.beginPath(); x.moveTo(lx, 66); x.lineTo(lx, ly - 34); x.stroke();
			ell(x, lx, ly, 22, 32, "#ff5a4a", OL, 4); rr(x, lx - 14, ly - 36, 28, 8, 3, "#2a1840"); rr(x, lx - 14, ly + 28, 28, 8, 3, "#2a1840");
			[-14, 0, 14].forEach((o) => { x.strokeStyle = "rgba(120,20,20,0.5)"; x.lineWidth = 2; x.beginPath(); x.moveTo(lx - 20, ly + o); x.lineTo(lx + 20, ly + o); x.stroke(); });
		});
		save("chochin", c);
	}
	{
		// 木のさく 300x110
		const [c, x] = mk(300, 110);
		[20, 110, 200, 280].forEach((px) => rr(x, px - 9, 14, 18, 96, 4, "#b07a4a", OL, 4));
		rr(x, 4, 34, 292, 16, 4, "#c8905a", OL, 4); rr(x, 4, 68, 292, 16, 4, "#c8905a", OL, 4);
		save("fence", c);
	}
	{
		// きのこ 140x130
		const [c, x] = mk(140, 130);
		rr(x, 54, 64, 32, 62, 10, "#fff0d8", OL, 5);
		x.beginPath(); x.ellipse(70, 66, 62, 52, 0, Math.PI, 0); x.closePath(); x.fillStyle = "#ff5a5a"; x.fill(); x.lineWidth = 5; x.strokeStyle = OL; x.stroke();
		[[44, 40, 10], [86, 30, 12], [100, 56, 7], [56, 60, 6]].forEach(([mx, my, r]) => ell(x, mx, my, r, r, "#ffffff"));
		save("mushroom", c);
	}
	{
		// わらの山 180x130
		const [c, x] = mk(180, 130);
		x.beginPath(); x.moveTo(10, 126); x.quadraticCurveTo(20, 10, 90, 8); x.quadraticCurveTo(160, 10, 170, 126); x.closePath();
		x.fillStyle = "#f0c860"; x.fill(); x.lineWidth = 5; x.strokeStyle = OL; x.stroke();
		x.strokeStyle = "#c89a30"; x.lineWidth = 3; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(30 + i * 16, 120); x.lineTo(40 + i * 14, 40 + (i % 3) * 10); x.stroke(); }
		save("hay", c);
	}
	// ======== 道ぞいの観客の列(さくのうしろに大ぜい) 680x250 ========
	const row = (name, fence, kinds, cols, frame) => {
		const [c, x] = mk(680, 250);
		const list = crowd(x, [
			{ x0: 10, w: 660, n: 10, y: 92, r: 30 },
			{ x0: 0, w: 680, n: 9, y: 140, r: 34 }
		], cols, kinds);
		// からだ
		list.forEach((p) => ell(x, p.x, p.y + p.r * 1.3, p.r * 0.85, p.r * 0.9, shade(p.col, -0.25), OL, 3));
		drawCrowd(x, list, frame);
		if (fence === "barrier") {
			rr(x, 0, 186, 680, 64, 6, "#ffffff", OL, 5);
			for (let i = 0; i < 17; i++) { x.fillStyle = i % 2 ? "#ff4a5a" : "#ffffff"; x.fillRect(4 + i * 40, 190, 40, 56); }
			x.lineWidth = 5; x.strokeStyle = OL; x.strokeRect(2, 186, 676, 64);
		} else if (fence === "iron") {
			x.fillStyle = "#2a2436"; x.fillRect(0, 196, 680, 12); x.fillRect(0, 236, 680, 12);
			for (let i = 0; i < 28; i++) { rr(x, 6 + i * 24, 180, 8, 70, 2, "#2a2436"); poly(x, [[4 + i * 24, 182], [10 + i * 24, 166], [16 + i * 24, 182]], "#ffb020", OL, 2); }
		} else {
			[10, 230, 450, 670].forEach((px) => rr(x, px - 9, 180, 18, 70, 4, "#b07a4a", OL, 4));
			rr(x, 0, 196, 680, 16, 4, "#c8905a", OL, 4); rr(x, 0, 228, 680, 16, 4, "#c8905a", OL, 4);
		}
		save(name + frame, c);
	};
	[0, 1].forEach((fr) => {
		row("row_c", "barrier", ["cat", "bear", "bunny", "round"], FURS, fr);
		row("row_k", "iron", ["ghost", "imp", "ghost", "round"], ["#e8e0ff", "#c8b0ff", "#ff9ab0", "#a0e0c0", "#ffd080", "#b8c0d0"], fr);
		row("row_m", "wood", ["cat", "bear", "bunny", "round"], FURS, fr);
	});
	return out;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build);
	// ロゴ(正方形 480x480): 上に「ドリフト」、まん中に虹の光をまとってドリフトするカート、下に「いっぽん」
	res.logo = await p.evaluate(async (src) => {
		const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
		const kart = await load(src.kart), smoke = await load(src.smoke);
		const N = 480;
		const c = document.createElement("canvas"); c.width = N; c.height = N; const x = c.getContext("2d");
		const OL = "#2a1840";
		x.lineJoin = "round"; x.lineCap = "round";
		// カーブする道(両はしはふわっと消す)
		{
			const rc = document.createElement("canvas"); rc.width = N; rc.height = N; const q = rc.getContext("2d");
			const path = (o) => { q.beginPath(); q.moveTo(-10, 330 + o); q.quadraticCurveTo(250, 380 + o, 490, 270 + o); };
			[[70, OL], [62, "#ffffff"], [52, "#6c6c80"]].forEach(([w, col]) => { q.strokeStyle = col; q.lineWidth = w; path(0); q.stroke(); });
			q.setLineDash([16, 16]); q.strokeStyle = "#ff4a5a"; q.lineWidth = 6; path(-29); q.stroke(); path(29); q.stroke();
			q.globalCompositeOperation = "destination-out";
			const fade = q.createLinearGradient(0, 0, N, 0);
			fade.addColorStop(0, "rgba(0,0,0,1)"); fade.addColorStop(0.14, "rgba(0,0,0,0)"); fade.addColorStop(0.86, "rgba(0,0,0,0)"); fade.addColorStop(1, "rgba(0,0,0,1)");
			q.fillStyle = fade; q.fillRect(0, 0, N, N);
			x.drawImage(rc, 0, 0);
		}
		// タイヤのあと(虹)
		["#ff4040", "#ff9a30", "#ffe040", "#50e070", "#40b0ff", "#9a60ff"].forEach((col, i) => {
			x.strokeStyle = col; x.lineWidth = 5; x.beginPath();
			x.moveTo(40, 334 - i * 5); x.quadraticCurveTo(170, 362 - i * 5, 270, 330 - i * 4); x.stroke();
		});
		// 白い風
		x.strokeStyle = "#ffffff"; x.lineWidth = 5;
		[[22, 200, 100], [8, 236, 80], [30, 272, 90]].forEach(([sx, sy, len]) => { x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + len, sy - 3); x.stroke(); });
		// 虹色の光の輪
		const cx = 286, cy = 246;
		for (let i = 0; i < 18; i++) {
			const t = i / 18 * Math.PI * 2, ax = cx + Math.cos(t) * 112, ay = cy + Math.sin(t) * 72;
			const g = x.createRadialGradient(ax, ay, 3, ax, ay, 52);
			g.addColorStop(0, "hsla(" + Math.round(i * 20) + ",95%,65%,0.75)"); g.addColorStop(1, "hsla(" + Math.round(i * 20) + ",95%,65%,0)");
			x.fillStyle = g; x.beginPath(); x.arc(ax, ay, 52, 0, Math.PI * 2); x.fill();
		}
		{
			const g = x.createRadialGradient(cx, cy, 8, cx, cy, 112);
			g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
			x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 112, 0, Math.PI * 2); x.fill();
		}
		[[180, 318, 64], [146, 334, 50], [214, 334, 56]].forEach(([sx, sy, r]) => x.drawImage(smoke, sx - r / 2, sy - r / 2, r, r));
		x.save(); x.translate(cx, cy + 10); x.rotate(-0.12); x.drawImage(kart, -112, -102, 224, 203); x.restore();
		// 文字
		const word = (t, wx, wy, size, c0, c1) => {
			x.save(); x.translate(wx, wy); x.transform(1, -0.05, -0.2, 1, 0, 0);
			x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
			x.lineWidth = size * 0.34; x.strokeStyle = OL; x.strokeText(t, 4, 6); x.strokeText(t, 0, 0);
			x.lineWidth = size * 0.16; x.strokeStyle = "#ffffff"; x.strokeText(t, 0, 0);
			const g = x.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c1);
			x.fillStyle = g; x.fillText(t, 0, 0);
			x.save(); x.beginPath(); x.rect(-size * 3, -size / 2, size * 6, size * 0.34); x.clip();
			x.fillStyle = "rgba(255,255,255,0.35)"; x.fillText(t, 0, 0); x.restore();
			x.restore();
		};
		word("ドリフト", 236, 92, 98, "#fff27a", "#ff8a1a");
		word("いっぽん", 248, 410, 88, "#a6f0ff", "#2f86f0");
		// ドレミの音符
		const note = (nx, ny, col, sz, rot) => {
			x.save(); x.translate(nx, ny); x.rotate(rot);
			x.fillStyle = col; x.strokeStyle = OL; x.lineWidth = 3;
			x.beginPath(); x.ellipse(0, 0, sz * 0.5, sz * 0.38, -0.4, 0, Math.PI * 2); x.fill(); x.stroke();
			x.fillRect(sz * 0.36, -sz * 1.4, sz * 0.14, sz * 1.4); x.strokeRect(sz * 0.36, -sz * 1.4, sz * 0.14, sz * 1.4);
			x.beginPath(); x.moveTo(sz * 0.5, -sz * 1.4); x.quadraticCurveTo(sz * 1.1, -sz * 1.1, sz * 0.9, -sz * 0.6); x.lineWidth = 6; x.strokeStyle = col; x.stroke();
			x.restore();
		};
		note(420, 186, "#ff70c8", 26, 0.2); note(456, 236, "#40e070", 20, 0.25); note(128, 168, "#ffe030", 22, -0.1);
		const st = (sx, sy, r, col) => { x.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, q = k % 2 ? r * 0.42 : r; x.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); } x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 3; x.strokeStyle = OL; x.stroke(); };
		st(36, 30, 20, "#ffe040"); st(450, 36, 14, "#70e8ff"); st(456, 452, 14, "#ff70c8");
		return c.toDataURL("image/png");
	}, { kart: res.kart_cat_side, smoke: res.smoke });
	await b.close();
	Object.keys(res).forEach((k) => fs.writeFileSync(path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64")));
	console.log("wrote", Object.keys(res).length, "images");
})();
