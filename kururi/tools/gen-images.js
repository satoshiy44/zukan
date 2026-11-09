// シックな柄のタイル・背景・盤のわく・ボタン・エフェクトを作る
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "image");

function build() {
	const out = {};
	const GOLD = "#c9a45c", GOLD_L = "#ecd59a", INK = "#141218";
	const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
	const rr = (x, l, t, w, h, r) => {
		x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
		x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
	};
	// ======== タイル(128x128 で描いて、ゲームでは64pxで使う) ========
	const S = 128;
	const tile = (name, draw) => {
		const [c, x] = mk(S, S);
		x.save(); rr(x, 4, 4, S - 8, S - 8, 14); x.clip();
		draw(x);
		// うすい光と影で、布を張ったボタンのような立体感
		const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, "rgba(255,255,255,0.18)"); g.addColorStop(0.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,0.25)");
		x.fillStyle = g; x.fillRect(0, 0, S, S);
		x.restore();
		rr(x, 4, 4, S - 8, S - 8, 14); x.lineWidth = 5; x.strokeStyle = GOLD; x.stroke();
		rr(x, 9, 9, S - 18, S - 18, 10); x.lineWidth = 1.5; x.strokeStyle = "rgba(236,213,154,0.6)"; x.stroke();
		out[name] = c.toDataURL("image/png");
	};
	// 千鳥格子(黒と白)
	tile("t0", (x) => {
		x.fillStyle = "#efe9dc"; x.fillRect(0, 0, S, S);
		x.fillStyle = "#1c1b20";
		const u = 16;
		for (let r = -1; r < S / u + 1; r++) for (let c = -1; c < S / u + 1; c++) {
			if ((r + c) % 2) continue;
			const ox = c * u, oy = r * u;
			x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + u, oy); x.lineTo(ox + u, oy + u * 0.5); x.lineTo(ox + u * 1.5, oy + u);
			x.lineTo(ox + u, oy + u); x.lineTo(ox + u * 0.5, oy + u * 1.5); x.lineTo(ox, oy + u); x.lineTo(ox + u * 0.5, oy + u * 0.5); x.closePath(); x.fill();
		}
	});
	// ネイビーのストライプ(ななめ)
	tile("t1", (x) => {
		x.fillStyle = "#1f2d4e"; x.fillRect(0, 0, S, S);
		x.save(); x.translate(S / 2, S / 2); x.rotate(-Math.PI / 4);
		for (let k = -S; k < S; k += 22) { x.fillStyle = "#e7dcc4"; x.fillRect(k, -S, 5, S * 2); x.fillStyle = "#c9a45c"; x.fillRect(k + 10, -S, 2, S * 2); }
		x.restore();
	});
	// ボルドーのドット
	tile("t2", (x) => {
		x.fillStyle = "#6e1f2e"; x.fillRect(0, 0, S, S);
		x.fillStyle = "#f0e3c8";
		for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { x.beginPath(); x.arc(c * 24 + (r % 2 ? 12 : 0), r * 24 + 4, 5.5, 0, Math.PI * 2); x.fill(); }
	});
	// アーガイル(深い緑とからし色)
	tile("t3", (x) => {
		x.fillStyle = "#1f4a3a"; x.fillRect(0, 0, S, S);
		const d = (cx, cy, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy - 32); x.lineTo(cx + 22, cy); x.lineTo(cx, cy + 32); x.lineTo(cx - 22, cy); x.closePath(); x.fill(); };
		d(64, 64, "#c99a2e"); d(20, 0, "#2f6a52"); d(108, 0, "#2f6a52"); d(20, 128, "#2f6a52"); d(108, 128, "#2f6a52");
		x.strokeStyle = "#f0e3c8"; x.lineWidth = 1.6; x.setLineDash([5, 4]);
		for (let k = -128; k < 256; k += 44) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 128 * 0.69, 128); x.stroke(); x.beginPath(); x.moveTo(k + 88, 0); x.lineTo(k + 88 - 128 * 0.69, 128); x.stroke(); }
		x.setLineDash([]);
	});
	// ヘリンボーン(キャメル)
	tile("t4", (x) => {
		x.fillStyle = "#8a6440"; x.fillRect(0, 0, S, S);
		for (let c = 0; c < 8; c++) for (let r = -1; r < 10; r++) {
			const ox = c * 16, oy = r * 16 + (c % 2 ? 8 : 0);
			x.strokeStyle = c % 2 ? "#d6b88a" : "#4e3420"; x.lineWidth = 4;
			x.beginPath(); if (c % 2) { x.moveTo(ox, oy); x.lineTo(ox + 16, oy + 16); } else { x.moveTo(ox, oy + 16); x.lineTo(ox + 16, oy); } x.stroke();
		}
	});
	// ローズのギンガム
	tile("t5", (x) => {
		x.fillStyle = "#f3e1e4"; x.fillRect(0, 0, S, S);
		x.fillStyle = "rgba(150,62,88,0.5)";
		for (let k = 0; k < S; k += 32) { x.fillRect(k, 0, 16, S); x.fillRect(0, k, S, 16); }
	});
	// ゴールドのジョーカー(どの柄とも合う)
	tile("tj", (x) => {
		const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, "#f6e3a8"); g.addColorStop(0.5, "#c9a45c"); g.addColorStop(1, "#8a6a2e");
		x.fillStyle = g; x.fillRect(0, 0, S, S);
		x.fillStyle = "#1c1b20"; x.font = "bold 76px Inter"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("★", 64, 68);
	});

	// ======== 背景(1280x720) ========
	{
		const [c, x] = mk(1280, 720);
		const g = x.createRadialGradient(640, 380, 100, 640, 380, 820); g.addColorStop(0, "#2a2630"); g.addColorStop(1, "#0c0b10");
		x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
		// ピンストライプ
		for (let k = 0; k < 1280; k += 18) { x.fillStyle = "rgba(201,164,92,0.06)"; x.fillRect(k, 0, 1, 720); }
		// 角のアールデコ風の飾り
		const deco = (cx, cy, sx, sy) => {
			x.save(); x.translate(cx, cy); x.scale(sx, sy);
			x.strokeStyle = "rgba(201,164,92,0.55)"; x.lineWidth = 2;
			for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(0, 30 + k * 18); x.lineTo(30 + k * 18, 0); x.stroke(); }
			x.beginPath(); x.moveTo(12, 0); x.lineTo(12, 130); x.moveTo(0, 12); x.lineTo(130, 12); x.stroke();
			x.restore();
		};
		deco(20, 20, 1, 1); deco(1260, 20, -1, 1); deco(20, 700, 1, -1); deco(1260, 700, -1, -1);
		out.bg = c.toDataURL("image/png");
	}
	// ======== 盤のわく(8x8, 1マス64px → 512px + ふち) ========
	{
		const B = 512, P = 22;
		const [c, x] = mk(B + P * 2, B + P * 2);
		rr(x, 0, 0, B + P * 2, B + P * 2, 18); x.fillStyle = INK; x.fill();
		rr(x, 4, 4, B + P * 2 - 8, B + P * 2 - 8, 15); x.lineWidth = 3; x.strokeStyle = GOLD; x.stroke();
		rr(x, 10, 10, B + P * 2 - 20, B + P * 2 - 20, 11); x.lineWidth = 1; x.strokeStyle = "rgba(236,213,154,0.5)"; x.stroke();
		x.fillStyle = "#1d1b22"; x.fillRect(P, P, B, B);
		x.strokeStyle = "rgba(201,164,92,0.12)"; x.lineWidth = 1;
		for (let k = 1; k < 8; k++) { x.beginPath(); x.moveTo(P + k * 64 + 0.5, P); x.lineTo(P + k * 64 + 0.5, P + B); x.stroke(); x.beginPath(); x.moveTo(P, P + k * 64 + 0.5); x.lineTo(P + B, P + k * 64 + 0.5); x.stroke(); }
		out.board = c.toDataURL("image/png");
	}
	// ======== 回転ボタン(170x170) ========
	const btn = (name, dir) => {
		const [c, x] = mk(170, 170);
		x.beginPath(); x.arc(85, 85, 80, 0, Math.PI * 2); x.fillStyle = INK; x.fill();
		x.lineWidth = 4; x.strokeStyle = GOLD; x.stroke();
		x.beginPath(); x.arc(85, 85, 70, 0, Math.PI * 2); x.lineWidth = 1.5; x.strokeStyle = "rgba(236,213,154,0.5)"; x.stroke();
		// 回る矢印
		x.save(); x.translate(85, 85); if (dir < 0) x.scale(-1, 1);
		x.lineWidth = 10; x.strokeStyle = GOLD_L; x.lineCap = "round";
		x.beginPath(); x.arc(0, 0, 40, -Math.PI * 0.85, Math.PI * 0.35); x.stroke();
		const a = Math.PI * 0.35, ex = Math.cos(a) * 40, ey = Math.sin(a) * 40;
		x.fillStyle = GOLD_L; x.beginPath(); x.moveTo(ex + 18, ey - 6); x.lineTo(ex - 8, ey + 22); x.lineTo(ex - 14, ey - 12); x.closePath(); x.fill();
		x.restore();
		out[name] = c.toDataURL("image/png");
	};
	btn("btn_cw", 1); btn("btn_ccw", -1);
	// ======== エフェクト ========
	{
		let [c, x] = mk(24, 24); x.fillStyle = GOLD_L; x.fillRect(4, 4, 16, 16); out.fx_sq = c.toDataURL("image/png");
		[c, x] = mk(48, 48);
		x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, r = k % 2 ? 6 : 22; x.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); } x.closePath();
		x.fillStyle = "#fff4d0"; x.fill(); out.fx_star = c.toDataURL("image/png");
		[c, x] = mk(128, 128); rr(x, 6, 6, 116, 116, 16); x.lineWidth = 8; x.strokeStyle = "#fff4d0"; x.stroke(); out.fx_frame = c.toDataURL("image/png");
		[c, x] = mk(64, 64); rr(x, 2, 2, 60, 60, 8); x.fillStyle = "rgba(236,213,154,0.18)"; x.fill(); x.lineWidth = 2; x.strokeStyle = "rgba(236,213,154,0.7)"; x.stroke(); out.lane = c.toDataURL("image/png");
	}
	// ======== ロゴ(900x300) ========
	{
		const [c, x] = mk(1000, 300);
		// 回る四角のマーク
		x.save(); x.translate(130, 150); x.rotate(Math.PI / 4);
		rr(x, -70, -70, 140, 140, 16); x.fillStyle = INK; x.fill(); x.lineWidth = 6; x.strokeStyle = GOLD; x.stroke();
		rr(x, -52, -52, 104, 104, 10); x.lineWidth = 2; x.strokeStyle = GOLD_L; x.stroke();
		x.restore();
		x.lineWidth = 9; x.strokeStyle = GOLD_L; x.lineCap = "round";
		x.beginPath(); x.arc(130, 150, 46, -Math.PI * 0.9, Math.PI * 0.4); x.stroke();
		x.fillStyle = GOLD_L; x.beginPath(); x.moveTo(130 + 46 * Math.cos(Math.PI * 0.4) + 16, 150 + 46 * Math.sin(Math.PI * 0.4) - 6);
		x.lineTo(130 + 46 * Math.cos(Math.PI * 0.4) - 8, 150 + 46 * Math.sin(Math.PI * 0.4) + 20); x.lineTo(130 + 46 * Math.cos(Math.PI * 0.4) - 12, 150 + 46 * Math.sin(Math.PI * 0.4) - 12); x.fill();
		// 題字
		const g = x.createLinearGradient(0, 70, 0, 190); g.addColorStop(0, "#fff1c8"); g.addColorStop(0.5, "#ecd59a"); g.addColorStop(1, "#b08840");
		x.font = "bold 84px IPAGothic"; x.textAlign = "left"; x.textBaseline = "middle"; x.lineJoin = "round";
		x.lineWidth = 12; x.strokeStyle = INK; x.strokeText("くるりグラビティ", 240, 130);
		x.fillStyle = g; x.fillText("くるりグラビティ", 240, 130);
		x.fillStyle = GOLD; x.fillRect(244, 196, 700, 3);
		x.font = "600 30px Inter"; x.fillStyle = GOLD_L; x.fillText("G R A V I T Y   T U R N   P U Z Z L E", 246, 236);
		out.logo = c.toDataURL("image/png");
	}
	return out;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build);
	await b.close();
	Object.keys(res).forEach((k) => fs.writeFileSync(path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64")));
	console.log("wrote", Object.keys(res).length, "images");
})();
