// もちつきペッタンの絵を作る(神社の背景・観客・臼ともち・うさぎ・たぬき・レーンの印・完成したもち・ロゴ)
// 使い方: node tools/gen-images.js のあと python3 tools/shrink.py
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "image");

function build() {
	const out = {};
	const OL = "#3a1e2a";
	const mk = (w, h) => {
		const c = document.createElement("canvas"); c.width = w; c.height = h;
		const x = c.getContext("2d"); x.lineJoin = "round"; x.lineCap = "round"; return [c, x];
	};
	const save = (n, c) => { out[n] = c.toDataURL("image/png"); };
	let seed = 4321;
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
	const eyes = (x, cx, cy, gap, r) => [-1, 1].forEach((s) => { ell(x, cx + s * gap, cy, r, r * 1.25, OL); ell(x, cx + s * gap - r * 0.3, cy - r * 0.45, r * 0.42, r * 0.42, "#ffffff"); });
	const cheeks = (x, cx, cy, gap, r) => [-1, 1].forEach((s) => ell(x, cx + s * gap, cy, r, r * 0.6, "rgba(255,110,150,0.6)"));

	// ======== 背景(1280x720): 初日の出の神社 ========
	{
		const [c, x] = mk(1280, 720);
		const g = x.createLinearGradient(0, 0, 0, 420);
		g.addColorStop(0, "#5a7ae8"); g.addColorStop(0.55, "#ffb0a0"); g.addColorStop(1, "#ffe6a0");
		x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
		// 初日の出
		const sg = x.createRadialGradient(905, 300, 30, 905, 300, 360);
		sg.addColorStop(0, "rgba(255,240,180,0.9)"); sg.addColorStop(1, "rgba(255,200,120,0)");
		x.fillStyle = sg; x.fillRect(0, 0, 1280, 720);
		ell(x, 905, 300, 96, 96, "#ff7a4a");
		ell(x, 905, 300, 120, 120, null, "rgba(255,200,120,0.5)", 14);
		// 富士山
		poly(x, [[300, 420], [560, 200], [720, 200], [980, 420]], "#6a7ac8");
		poly(x, [[520, 236], [560, 200], [720, 200], [760, 236], [700, 226], [660, 250], [620, 228], [580, 246]], "#ffffff");
		// 雲
		[[180, 160], [1090, 120], [930, 230], [300, 260]].forEach(([cx, cy]) => {
			[[0, 0, 50], [46, -12, 40], [86, 4, 34], [-40, 6, 32]].forEach(([dx, dy, r]) => ell(x, cx + dx, cy + dy, r, r * 0.6, "rgba(255,255,255,0.9)"));
		});
		// 遠くの山なみ
		x.fillStyle = "#8a6ab0"; x.beginPath(); x.moveTo(0, 430);
		for (let i = 0; i <= 16; i++) x.lineTo(i * 80, 400 + Math.sin(i * 1.7) * 20);
		x.lineTo(1280, 430); x.fill();
		// 神社の地面(石だたみ)
		x.fillStyle = "#e8d8c0"; x.fillRect(0, 420, 1280, 300);
		for (let r = 0; r < 8; r++) for (let k = 0; k < 18; k++) {
			const y = 430 + r * 38, w = 90 + r * 8, ox = (r % 2) * w / 2;
			rr(x, ((k * w + ox) % 1400) - 60, y, w - 4, 34, 6, r % 2 ? "#e0cdb2" : "#ead9c0");
		}
		// 鳥居
		const tr = (cx, w, h, y0) => {
			rr(x, cx - w / 2 + 20, y0, 26, h, 4, "#e8402a", OL, 5); rr(x, cx + w / 2 - 46, y0, 26, h, 4, "#e8402a", OL, 5);
			rr(x, cx - w / 2 - 20, y0 - 34, w + 40, 26, 8, "#2a1820", OL, 5);
			rr(x, cx - w / 2 - 6, y0 - 8, w + 12, 20, 4, "#e8402a", OL, 5);
			rr(x, cx - w / 2 + 6, y0 + 34, w - 12, 16, 4, "#e8402a", OL, 4);
			rr(x, cx - 28, y0 + 6, 56, 30, 4, "#2a1820", "#ffd040", 3);
		};
		tr(640, 520, 260, 170);
		// ちょうちんの列
		x.strokeStyle = OL; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 120); x.quadraticCurveTo(640, 200, 1280, 120); x.stroke();
		for (let i = 0; i < 14; i++) {
			const lx = 40 + i * 92, ly = 120 + Math.sin(i / 13 * Math.PI) * 58 + 22;
			ell(x, lx, ly, 22, 28, i % 2 ? "#ff5a4a" : "#ffffff", OL, 3);
			rr(x, lx - 12, ly - 32, 24, 7, 2, OL); rr(x, lx - 12, ly + 25, 24, 7, 2, OL);
		}
		// 紅白の幕
		for (let i = 0; i < 32; i++) { x.fillStyle = i % 2 ? "#ff4a5a" : "#ffffff"; x.fillRect(i * 40, 392, 40, 40); }
		x.strokeStyle = OL; x.lineWidth = 4; x.strokeRect(-2, 392, 1284, 40);
		// 門松
		const kado = (cx) => {
			rr(x, cx - 54, 560, 108, 120, 14, "#c89a50", OL, 5);
			for (let k = 0; k < 5; k++) { x.strokeStyle = "#a0783a"; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - 54, 580 + k * 20); x.lineTo(cx + 54, 580 + k * 20); x.stroke(); }
			[[-24, 380], [0, 340], [24, 400]].forEach(([dx, top]) => {
				poly(x, [[cx + dx - 16, 570], [cx + dx - 16, top + 26], [cx + dx + 16, top], [cx + dx + 16, 570]], "#5ab84a", OL, 5);
				ell(x, cx + dx, top + 14, 14, 6, "#d8f0b0", null, 0, -0.6);
			});
			[[-50, 540], [50, 540], [-20, 520], [30, 530]].forEach(([dx, dy]) => { for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ell(x, cx + dx + Math.cos(a) * 14, dy + Math.sin(a) * 14, 9, 9, "#2a7a3a"); } });
			ell(x, cx - 30, 548, 10, 10, "#ff4a4a", OL, 2); ell(x, cx + 34, 538, 10, 10, "#ff4a4a", OL, 2);
		};
		kado(90); kado(1190);
		save("bg", c);
	}

	// ======== 観客(1280x230, 2コマ) ========
	const head = (x, cx, cy, r, col, kind, up) => {
		if (up) [-1, 1].forEach((s) => { x.strokeStyle = OL; x.lineWidth = r * 0.5 + 2; x.beginPath(); x.moveTo(cx + s * r * 0.7, cy + r * 0.6); x.lineTo(cx + s * r * 1.15, cy - r * 0.9); x.stroke(); x.strokeStyle = col; x.lineWidth = r * 0.5 - 2; x.stroke(); });
		if (kind === "cat") [-1, 1].forEach((s) => poly(x, [[cx + s * r * 0.9, cy - r * 0.2], [cx + s * r * 0.75, cy - r * 1.1], [cx + s * r * 0.2, cy - r * 0.8]], col, OL, 3));
		if (kind === "bear") [-1, 1].forEach((s) => ell(x, cx + s * r * 0.72, cy - r * 0.72, r * 0.36, r * 0.36, col, OL, 3));
		if (kind === "bunny") [-1, 1].forEach((s) => ell(x, cx + s * r * 0.4, cy - r * 1.2, r * 0.24, r * 0.65, col, OL, 3));
		ell(x, cx, cy, r, r * 0.92, col, OL, 3);
		ell(x, cx - r * 0.35, cy - r * 0.05, r * 0.13, r * 0.17, OL); ell(x, cx + r * 0.35, cy - r * 0.05, r * 0.13, r * 0.17, OL);
		x.strokeStyle = OL; x.lineWidth = 2.5; x.beginPath(); x.arc(cx, cy + r * 0.2, r * (up ? 0.28 : 0.18), 0.1, Math.PI - 0.1); x.stroke();
		ell(x, cx - r * 0.62, cy + r * 0.25, r * 0.16, r * 0.1, "rgba(255,100,140,0.6)"); ell(x, cx + r * 0.62, cy + r * 0.25, r * 0.16, r * 0.1, "rgba(255,100,140,0.6)");
	};
	const FURS = ["#ffb050", "#ffffff", "#a8743e", "#ffb4c4", "#e0a868", "#70d060", "#ffe050", "#9ad0ff", "#c8a0ff"];
	const KIMONO = ["#ff5a7a", "#4aa8ff", "#ffb020", "#9a6aff", "#40c870", "#ff8a30"];
	seed = 99;
	const people = [];
	[[118, 30, 22], [168, 34, 20]].forEach(([y, r, n]) => {
		for (let i = 0; i < n; i++) people.push({ x: (i + 0.5) * 1280 / n + (rnd() - 0.5) * 20, y, r, col: FURS[Math.floor(rnd() * FURS.length)], k: ["cat", "bear", "bunny", "round"][Math.floor(rnd() * 4)], kc: KIMONO[Math.floor(rnd() * KIMONO.length)], ph: rnd() });
	});
	[0, 1].forEach((frame) => {
		const [c, x] = mk(1280, 230);
		people.forEach((p) => {
			const up = (p.ph < 0.5) === (frame === 1);
			ell(x, p.x, p.y + p.r * 1.3, p.r * 0.9, p.r * 0.95, p.kc, OL, 3);
			x.strokeStyle = "#ffffff"; x.lineWidth = 3; x.beginPath(); x.moveTo(p.x - p.r * 0.4, p.y + p.r * 0.6); x.lineTo(p.x, p.y + p.r * 1.2); x.lineTo(p.x + p.r * 0.4, p.y + p.r * 0.6); x.stroke();
			head(x, p.x, p.y - (up ? p.r * 0.3 : 0), p.r, p.col, p.k, up);
		});
		save("crowd" + frame, c);
	});

	// ======== 臼(440x260)と、手前のふち ========
	{
		const [c, x] = mk(460, 280);
		x.beginPath(); x.moveTo(30, 60); x.quadraticCurveTo(10, 200, 70, 270); x.lineTo(390, 270); x.quadraticCurveTo(450, 200, 430, 60); x.closePath();
		const g = x.createLinearGradient(0, 0, 460, 0); g.addColorStop(0, "#9a5a2a"); g.addColorStop(0.45, "#d0904a"); g.addColorStop(1, "#8a4a20");
		x.fillStyle = g; x.fill(); x.lineWidth = 7; x.strokeStyle = OL; x.stroke();
		for (let k = 0; k < 4; k++) { x.strokeStyle = "rgba(90,40,10,0.35)"; x.lineWidth = 4; x.beginPath(); x.moveTo(40 + k * 4, 110 + k * 40); x.quadraticCurveTo(230, 130 + k * 40, 420 - k * 4, 110 + k * 40); x.stroke(); }
		ell(x, 230, 60, 202, 50, "#c8884a", OL, 7);
		ell(x, 230, 64, 170, 36, "#5a2a14");
		save("usu", c);
	}
	{
		// 手前のふち(もちの下はしをかくす)
		const [c, x] = mk(460, 80);
		x.beginPath(); x.ellipse(230, 0, 202, 50, 0, 0, Math.PI); x.lineTo(28, 0); x.closePath();
		x.save(); x.clip();
		x.fillStyle = "#c8884a"; x.fillRect(0, 0, 460, 80);
		x.restore();
		x.beginPath(); x.ellipse(230, 0, 170, 36, 0, 0, Math.PI); x.closePath(); x.fillStyle = "#c8884a"; x.fill();
		x.beginPath(); x.ellipse(230, 0, 202, 50, 0, 0, Math.PI); x.lineWidth = 7; x.strokeStyle = OL; x.stroke();
		x.beginPath(); x.ellipse(230, 0, 170, 36, 0, 0, Math.PI); x.lineWidth = 4; x.strokeStyle = "rgba(60,25,10,0.6)"; x.stroke();
		save("usu_front", c);
	}
	{
		// もち(280x160): 下がたいら
		const [c, x] = mk(300, 170);
		x.beginPath(); x.moveTo(20, 150); x.quadraticCurveTo(10, 30, 150, 22); x.quadraticCurveTo(290, 30, 280, 150); x.closePath();
		x.fillStyle = "#fffaf0"; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
		ell(x, 110, 58, 46, 16, "rgba(255,255,255,0.95)", null, 0, -0.2);
		ell(x, 200, 110, 70, 26, "rgba(230,220,210,0.5)");
		save("mochi", c);
	}

	// ======== うさぎ(つき手) 420x520: 杵の頭は「down」でキャンバスの (370, 380) ========
	const kine = (x, px, py, ang) => {
		x.save(); x.translate(px, py); x.rotate(ang);
		rr(x, -10, -8, 150, 18, 8, "#d8a868", OL, 5); // 柄
		x.save(); x.translate(160, 0);
		rr(x, -24, -46, 48, 92, 16, "#c8884a", OL, 6); // 頭
		rr(x, -24, -34, 48, 10, 3, "#9a5a2a"); rr(x, -24, 24, 48, 10, 3, "#9a5a2a");
		x.restore();
		x.restore();
	};
	const rabbit = (name, ang, armUp) => {
		const [c, x] = mk(420, 520);
		const bx = 160;
		// 足
		[-1, 1].forEach((s) => rr(x, bx + s * 24 - 16, 440, 32, 80, 12, "#ffffff", OL, 5));
		// はっぴ
		x.beginPath(); x.moveTo(bx - 70, 450); x.lineTo(bx - 56, 300); x.quadraticCurveTo(bx, 280, bx + 56, 300); x.lineTo(bx + 70, 450); x.closePath();
		x.fillStyle = "#3a6ae8"; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
		x.strokeStyle = "#ffffff"; x.lineWidth = 8; x.beginPath(); x.moveTo(bx - 30, 300); x.lineTo(bx - 8, 450); x.moveTo(bx + 30, 300); x.lineTo(bx + 8, 450); x.stroke();
		x.font = "bold 40px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#ffffff"; x.fillText("祭", bx, 400);
		// 頭
		[-1, 1].forEach((s) => { ell(x, bx + s * 26, 120, 22, 62, "#ffffff", OL, 5, s * 0.15); ell(x, bx + s * 26, 124, 10, 44, "#ffb0c8", null, 0, s * 0.15); });
		ell(x, bx, 220, 74, 66, "#ffffff", OL, 6);
		// はちまき
		rr(x, bx - 76, 172, 152, 20, 8, "#ffffff", "#ff4a5a", 6);
		poly(x, [[bx - 76, 180], [bx - 110, 160 + (armUp ? -10 : 10)], [bx - 104, 196]], "#ff4a5a", OL, 3);
		eyes(x, bx, 222, 26, 8); cheeks(x, bx, 244, 46, 12);
		ell(x, bx, 244, 7, 5, "#ff7090");
		x.strokeStyle = OL; x.lineWidth = 4; x.beginPath(); x.arc(bx, 252, 12, 0.2, Math.PI - 0.2); x.stroke();
		// 杵と腕
		const pivot = [bx + 70, 330];
		kine(x, pivot[0], pivot[1], ang);
		[-1, 1].forEach((s) => {
			const hx = pivot[0] + Math.cos(ang) * (s < 0 ? 10 : 40), hy = pivot[1] + Math.sin(ang) * (s < 0 ? 10 : 40);
			x.strokeStyle = OL; x.lineWidth = 22; x.beginPath(); x.moveTo(bx + s * 40, 320); x.lineTo(hx, hy); x.stroke();
			x.strokeStyle = "#3a6ae8"; x.lineWidth = 14; x.stroke();
			ell(x, hx, hy, 14, 14, "#ffffff", OL, 4);
		});
		save(name, c);
	};
	rabbit("usagi_up", -1.3, true);
	rabbit("usagi_mid", -0.4, true);
	rabbit("usagi_down", 0.5, false);

	// ======== たぬき(返し手) 420x520: 手を入れると手先がキャンバスの (60, 390) ========
	const tanuki = (name, mode) => {
		const [c, x] = mk(420, 520);
		const bx = 270;
		[-1, 1].forEach((s) => rr(x, bx + s * 26 - 18, 440, 36, 80, 14, "#7a5236", OL, 5));
		// おなか
		ell(x, bx, 380, 84, 90, "#9a6a46", OL, 6);
		ell(x, bx, 396, 56, 62, "#f0dcc0");
		// しっぽ
		ell(x, bx + 90, 440, 36, 24, "#7a5236", OL, 5, -0.5);
		// 腕
		const hand = mode === "hand" ? [60, 390] : mode === "ouch" ? [bx - 40, 200] : [bx - 90, 400];
		x.strokeStyle = OL; x.lineWidth = 26; x.beginPath(); x.moveTo(bx - 50, 330); x.lineTo(hand[0], hand[1]); x.stroke();
		x.strokeStyle = "#9a6a46"; x.lineWidth = 18; x.stroke();
		ell(x, hand[0], hand[1], 22, 18, mode === "ouch" ? "#ff8a8a" : "#f0dcc0", OL, 4);
		if (mode === "hand") { [0, 1, 2].forEach((k) => ell(x, hand[0] - 14 + k * 10, hand[1] + 16 + (k % 2) * 4, 4, 6, "#9adcff", OL, 2)); }
		if (mode === "ouch") { x.strokeStyle = "#ff4a4a"; x.lineWidth = 4; [[-30, -20], [0, -34], [30, -20]].forEach(([dx, dy]) => { x.beginPath(); x.moveTo(hand[0] + dx * 0.7, hand[1] + dy * 0.7); x.lineTo(hand[0] + dx * 1.3, hand[1] + dy * 1.3); x.stroke(); }); }
		x.strokeStyle = OL; x.lineWidth = 26; x.beginPath(); x.moveTo(bx + 60, 330); x.lineTo(bx + 90, 400); x.stroke();
		x.strokeStyle = "#9a6a46"; x.lineWidth = 18; x.stroke();
		// 頭
		[-1, 1].forEach((s) => ell(x, bx + s * 56, 152, 24, 22, "#7a5236", OL, 5));
		ell(x, bx, 210, 80, 70, "#9a6a46", OL, 6);
		// 目のまわりの黒
		[-1, 1].forEach((s) => ell(x, bx + s * 30, 206, 26, 20, "#4a3020", null, 0, s * 0.3));
		ell(x, bx, 244, 36, 26, "#f0dcc0");
		if (mode === "ouch") {
			[-1, 1].forEach((s) => { x.strokeStyle = "#ffffff"; x.lineWidth = 5; x.beginPath(); x.moveTo(bx + s * 30 - 10, 198); x.lineTo(bx + s * 30 + 10, 212); x.moveTo(bx + s * 30 + 10, 198); x.lineTo(bx + s * 30 - 10, 212); x.stroke(); });
			ell(x, bx, 256, 14, 16, OL);
		} else {
			eyes(x, bx, 206, 30, 8);
			x.strokeStyle = OL; x.lineWidth = 4; x.beginPath(); x.arc(bx, 250, 12, 0.2, Math.PI - 0.2); x.stroke();
		}
		ell(x, bx, 236, 10, 7, OL);
		cheeks(x, bx, 238, 56, 12);
		// はちまき
		rr(x, bx - 82, 160, 164, 20, 8, "#ffffff", "#ff4a5a", 6);
		save(name, c);
	};
	tanuki("tanuki_idle", "idle");
	tanuki("tanuki_hand", "hand");
	tanuki("tanuki_ouch", "ouch");

	// ======== レーンの印 ========
	{
		// つく(白いおもちに赤いふち) 100x100
		const [c, x] = mk(100, 100);
		ell(x, 50, 50, 44, 44, "#ff4a5a", OL, 5);
		ell(x, 50, 50, 32, 32, "#fffaf0", OL, 3);
		ell(x, 42, 42, 10, 6, "rgba(255,255,255,0.9)", null, 0, -0.4);
		save("note_tsuki", c);
	}
	{
		// 手(たぬきの手。押しちゃだめ) 100x100
		const [c, x] = mk(100, 100);
		ell(x, 50, 50, 44, 44, "#4a8ae8", OL, 5);
		ell(x, 50, 56, 22, 18, "#f0dcc0", OL, 3);
		[[-16, -18], [-6, -26], [6, -26], [16, -18]].forEach(([dx, dy]) => ell(x, 50 + dx, 56 + dy, 7, 8, "#f0dcc0", OL, 3));
		save("note_te", c);
	}
	{
		// 判定の輪 120x120
		const [c, x] = mk(120, 120);
		ell(x, 60, 60, 52, 52, "rgba(255,255,255,0.25)", "#ffffff", 7);
		ell(x, 60, 60, 52, 52, null, OL, 2);
		save("judge", c);
	}
	{
		// タイミングの輪(もちの上で小さくなる) 300x300
		const [c, x] = mk(300, 300);
		ell(x, 150, 150, 140, 140, null, "#ffffff", 10);
		ell(x, 150, 150, 140, 140, null, "rgba(255,90,120,0.8)", 4);
		save("ring", c);
	}
	// ======== 完成したもち 120x100 ========
	const done = (name, fn) => { const [c, x] = mk(120, 100); fn(x); save(name, c); };
	const base = (x, col) => { x.beginPath(); x.moveTo(12, 86); x.quadraticCurveTo(8, 22, 60, 18); x.quadraticCurveTo(112, 22, 108, 86); x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 5; x.strokeStyle = OL; x.stroke(); ell(x, 44, 36, 14, 6, "rgba(255,255,255,0.7)", null, 0, -0.3); };
	done("m_kin", (x) => { base(x, "#fffaf0"); [[40, 50], [72, 40], [60, 66], [84, 64]].forEach(([a, b]) => star(x, a, b, 8, "#ffd030", OL, 2)); });
	done("m_ichigo", (x) => { base(x, "#ffe8f0"); poly(x, [[46, 30], [60, 4], [76, 30]], "#ff4a5a", OL, 4); poly(x, [[50, 12], [60, 2], [70, 12], [60, 8]], "#4ab84a"); });
	done("m_kinako", (x) => { base(x, "#e8c070"); for (let i = 0; i < 18; i++) ell(x, 24 + (i * 37) % 76, 34 + (i * 23) % 46, 2, 2, "#c89a40"); });
	done("m_anko", (x) => { base(x, "#fffaf0"); x.beginPath(); x.moveTo(16, 60); x.quadraticCurveTo(60, 20, 104, 60); x.lineTo(104, 74); x.quadraticCurveTo(60, 50, 16, 74); x.closePath(); x.fillStyle = "#6a2a3a"; x.fill(); });
	done("m_kusa", (x) => { base(x, "#8ac870"); });
	{
		// おぼん 260x60
		const [c, x] = mk(260, 60);
		rr(x, 6, 10, 248, 40, 18, "#d84a3a", OL, 5); rr(x, 20, 18, 220, 14, 6, "#ff7a5a");
		save("tray", c);
	}
	// ======== エフェクト ========
	{
		const [c, x] = mk(48, 48);
		x.fillStyle = "#ffffff"; x.beginPath(); x.moveTo(24, 0); x.quadraticCurveTo(27, 21, 48, 24); x.quadraticCurveTo(27, 27, 24, 48); x.quadraticCurveTo(21, 27, 0, 24); x.quadraticCurveTo(21, 21, 24, 0); x.fill();
		save("spark", c);
	}
	{
		const [c, x] = mk(56, 56); star(x, 28, 28, 24, "#ffe040", OL, 4); save("star", c);
	}
	{
		// ペッタンの白いしぶき 220x120
		const [c, x] = mk(220, 120);
		for (let i = 0; i < 9; i++) { const a = Math.PI + i / 8 * Math.PI; ell(x, 110 + Math.cos(a) * 80, 100 + Math.sin(a) * 70, 14, 9, "#ffffff", OL, 3, a); }
		save("splash", c);
	}
	return out;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build);
	// ロゴ(正方形 480x480): 上に「もちつき」、まん中に杵と臼ともち、下に「ペッタン」
	res.logo = await p.evaluate(async (src) => {
		const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
		const usu = await load(src.usu), mochi = await load(src.mochi), front = await load(src.front), usagi = await load(src.usagi), tanuki = await load(src.tanuki);
		const N = 480;
		const c = document.createElement("canvas"); c.width = N; c.height = N; const x = c.getContext("2d");
		const OL = "#3a1e2a";
		x.lineJoin = "round"; x.lineCap = "round";
		// 後ろの日の丸と光
		for (let i = 0; i < 16; i++) {
			const a = i / 16 * Math.PI * 2;
			x.fillStyle = i % 2 ? "rgba(255,210,120,0.55)" : "rgba(255,240,190,0.55)";
			x.beginPath(); x.moveTo(240, 250); x.arc(240, 250, 240, a, a + Math.PI / 16); x.closePath(); x.fill();
		}
		x.beginPath(); x.arc(240, 250, 150, 0, Math.PI * 2); x.fillStyle = "#ff6a4a"; x.fill(); x.lineWidth = 7; x.strokeStyle = OL; x.stroke();
		// うさぎ・たぬき・臼
		x.drawImage(usagi, -10, 120, 210, 260);
		x.drawImage(tanuki, 280, 130, 210, 260);
		x.drawImage(usu, 125, 270, 230, 140);
		x.drawImage(mochi, 160, 238, 160, 90);
		x.drawImage(front, 125, 300, 230, 40);
		const word = (t, wx, wy, size, c0, c1, rot) => {
			x.save(); x.translate(wx, wy); x.rotate(rot || 0);
			x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
			x.lineWidth = size * 0.34; x.strokeStyle = OL; x.strokeText(t, 4, 6); x.strokeText(t, 0, 0);
			x.lineWidth = size * 0.16; x.strokeStyle = "#ffffff"; x.strokeText(t, 0, 0);
			const g = x.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, c0); g.addColorStop(1, c1);
			x.fillStyle = g; x.fillText(t, 0, 0);
			x.restore();
		};
		word("もちつき", 240, 82, 92, "#ffffff", "#ffd8e8", -0.04);
		word("ペッタン！", 246, 418, 96, "#fff27a", "#ff6a1a", -0.04);
		// 「ぺたっ」の線と星
		const st = (sx, sy, r, col) => { x.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, q = k % 2 ? r * 0.42 : r; x.lineTo(sx + Math.cos(a) * q, sy + Math.sin(a) * q); } x.closePath(); x.fillStyle = col; x.fill(); x.lineWidth = 3; x.strokeStyle = OL; x.stroke(); };
		st(40, 36, 20, "#ffe040"); st(446, 40, 16, "#ff70a0"); st(440, 330, 14, "#ffe040"); st(36, 330, 12, "#70d0ff");
		return c.toDataURL("image/png");
	}, { usu: res.usu, mochi: res.mochi, front: res.usu_front, usagi: res.usagi_down, tanuki: res.tanuki_hand });
	await b.close();
	Object.keys(res).forEach((k) => fs.writeFileSync(path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64")));
	console.log("wrote", Object.keys(res).length, "images");
})();
