// アイコン(320x320)と紹介画像(1280x720)を作る
// 使い方: node tools/gen-brand.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const data = (p) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, p)).toString("base64");

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const imgs = {
		logo: data("image/logo.png"), kart: data("image/kart_cat_side.png"), aura: data("image/aura7.png"),
		hero: data("tools/promo-shot/hero_c.png"), castle: data("tools/promo-shot/p_castle.png"), mount: data("tools/promo-shot/p_mount.png"),
		wind: data("tools/promo-shot/p_wind.png"), tally: data("tools/promo-shot/p_tally.png"),
		faces: ["dog", "cat", "rabbit", "panda", "bear", "penguin", "fox", "pig", "frog", "chick"].map((a) => data("image/face_" + a + ".png"))
	};
	const res = await p.evaluate(async (I) => {
		const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
		const im = {};
		for (const k of Object.keys(I)) im[k] = Array.isArray(I[k]) ? await Promise.all(I[k].map(load)) : await load(I[k]);
		const OL = "#2a1840";
		const word = (x, t, cx, cy, size, c0, c1, rot) => {
			x.save(); x.translate(cx, cy); x.rotate(rot || 0);
			x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
			x.lineWidth = size * 0.32; x.strokeStyle = OL; x.strokeText(t, 3, 5); x.strokeText(t, 0, 0);
			x.lineWidth = size * 0.14; x.strokeStyle = "#ffffff"; x.strokeText(t, 0, 0);
			const g = x.createLinearGradient(0, -size / 2, 0, size / 2); g.addColorStop(0, c0); g.addColorStop(1, c1);
			x.fillStyle = g; x.fillText(t, 0, 0); x.restore();
		};
		const rainbow = (x, x0, y0, x1, y1, cxp, cyp, w) => {
			["#ff4040", "#ff9a30", "#ffe040", "#50e070", "#40b0ff", "#9a60ff"].forEach((col, i) => {
				x.strokeStyle = col; x.lineWidth = w; x.lineCap = "round"; x.beginPath();
				x.moveTo(x0, y0 - i * w * 0.95); x.quadraticCurveTo(cxp, cyp - i * w * 0.95, x1, y1 - i * w * 0.8); x.stroke();
			});
		};
		// ---- アイコン ----
		const ic = document.createElement("canvas"); ic.width = 320; ic.height = 320; const x = ic.getContext("2d");
		const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, "#3aa8ff"); g.addColorStop(1, "#bfefff"); x.fillStyle = g; x.fillRect(0, 0, 320, 320);
		x.fillStyle = "#6cc860"; x.beginPath(); x.ellipse(160, 360, 260, 120, 0, 0, Math.PI * 2); x.fill();
		rainbow(x, -20, 250, 210, 215, 90, 290, 13);
		x.globalAlpha = 0.85; x.drawImage(im.aura, 60, 80, 280, 200); x.globalAlpha = 1;
		x.save(); x.translate(200, 196); x.rotate(-0.12); x.drawImage(im.kart, -115, -110, 230, 220); x.restore();
		word(x, "ドリフト", 160, 52, 66, "#ffe860", "#ff8a20", -0.05);
		word(x, "いっぽん", 112, 120, 46, "#9ae8ff", "#3a8ae8", -0.05);
		const icon = ic.toDataURL("image/png");
		// ---- 紹介画像: 虹のドリフトの画面を大きく、左に遊び方、下に3コースと見どころ ----
		const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const y = c.getContext("2d");
		y.lineJoin = "round"; y.lineCap = "round";
		// ヒーロー画面は上の表示を切って右へずらし、カートが右がわに来るようにする
		y.fillStyle = "#24103f"; y.fillRect(0, 0, 1280, 720);
		const hk = im.hero.width / 1280;
		y.drawImage(im.hero, 0, 125 * hk, 1280 * hk, 535 * hk, 508, 0, 1088, 455);
		let gl = y.createLinearGradient(0, 0, 820, 0); gl.addColorStop(0, "rgba(36,14,64,1)"); gl.addColorStop(0.64, "rgba(36,14,64,0.95)"); gl.addColorStop(1, "rgba(36,14,64,0)");
		y.fillStyle = gl; y.fillRect(0, 0, 820, 720);
		gl = y.createLinearGradient(0, 380, 0, 720); gl.addColorStop(0, "rgba(36,14,64,0)"); gl.addColorStop(0.25, "rgba(36,14,64,0.9)"); gl.addColorStop(1, "rgba(36,14,64,0.95)");
		y.fillStyle = gl; y.fillRect(0, 380, 1280, 340);
		const txt = (t, tx, ty, size, col, align) => {
			y.font = "bold " + size + "px IPAGothic"; y.textAlign = align || "left"; y.textBaseline = "middle";
			y.lineWidth = size * 0.3; y.strokeStyle = OL; y.strokeText(t, tx, ty); y.fillStyle = col; y.fillText(t, tx, ty);
		};
		y.drawImage(im.logo, 6, 6, 600, 240);
		// 動物ドライバー
		y.fillStyle = "#ffffff"; y.beginPath(); y.roundRect(700, 14, 566, 104, 22); y.fill(); y.lineWidth = 5; y.strokeStyle = OL; y.stroke();
		y.textAlign = "center"; txt("ドライバー10種 × コース3種がランダム！", 983, 38, 24, "#ff5a9a", "center");
		im.faces.forEach((f, i) => y.drawImage(f, 712 + i * 55, 56, 56, 56));
		// 遊び方
		const step = (n, col, ty, draw) => {
			y.fillStyle = "rgba(255,255,255,0.12)"; y.beginPath(); y.roundRect(20, ty - 32, 640, 64, 32); y.fill();
			y.fillStyle = col; y.beginPath(); y.arc(54, ty, 27, 0, Math.PI * 2); y.fill(); y.lineWidth = 5; y.strokeStyle = OL; y.stroke();
			txt(String(n), 54, ty + 2, 34, "#ffffff", "center");
			draw();
		};
		step(1, "#40a8ff", 268, () => { txt("タップ＆長押しで", 96, 268, 30, "#ffffff"); txt("ドリフト！曲がる！", 352, 268, 36, "#70e8ff"); });
		step(2, "#ff70c8", 342, () => {
			txt("カーブで続けると", 96, 342, 30, "#ffffff");
			const COL = ["#ffffff", "#40a8ff", "#ffe030", "#40e070", "#b060ff", "#ff70c8", "#ff3a3a"], NO = ["ド", "レ", "ミ", "ファ", "ソ", "ラ", "シ", "ド"];
			for (let i = 0; i < 8; i++) {
				const bx = 350 + i * 37;
				if (i === 7) { const g = y.createLinearGradient(bx, 0, bx + 34, 0); ["#ff4040", "#ffe040", "#40e070", "#40b0ff", "#b060ff"].forEach((cc, k) => g.addColorStop(k / 4, cc)); y.fillStyle = g; } else y.fillStyle = COL[i];
				y.beginPath(); y.roundRect(bx, 324, 34, 38, 8); y.fill(); y.lineWidth = 4; y.strokeStyle = OL; y.stroke();
				y.font = "bold " + (i === 3 ? 14 : 19) + "px IPAGothic"; y.textAlign = "center"; y.fillStyle = OL; y.fillText(NO[i], bx + 17, 344);
			}
		});
		step(3, "#ffb020", 416, () => { txt("はなすと 白い風で", 96, 416, 30, "#ffffff"); txt("まっすぐ加速！", 364, 416, 36, "#ffe860"); });
		// 下の4枚
		const thumbs = [[im.castle, "マグマ城", "#ff8a40"], [im.mount, "ゆうやけ山道", "#70e070"], [im.wind, "はなして加速！", "#70e8ff"], [im.tally, "最後に きょりボーナス！", "#ffe860"]];
		thumbs.forEach(([shot, cap, col], i) => {
			const tx = 22 + i * 312, ty = 486, w = 300, h = 169;
			y.fillStyle = OL; y.beginPath(); y.roundRect(tx - 6, ty - 6, w + 12, h + 12, 16); y.fill();
			y.save(); y.beginPath(); y.roundRect(tx, ty, w, h, 11); y.clip(); y.drawImage(shot, tx, ty, w, h); y.restore();
			txt(cap, tx + w / 2, ty + h + 30, 26, col, "center");
		});
		// 右上の見出し(ヒーロー画面の上)
		y.save(); y.translate(1060, 196); y.rotate(-0.06);
		y.fillStyle = "#ff4a8a"; y.beginPath(); y.roundRect(-170, -30, 340, 60, 30); y.fill(); y.lineWidth = 5; y.strokeStyle = OL; y.stroke();
		txt("にじいろドリフト！！", 0, 2, 32, "#ffffff", "center");
		y.restore();
		return { icon, promo: c.toDataURL("image/png") };
	}, imgs);
	await b.close();
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(res.icon.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "promo.png"), Buffer.from(res.promo.split(",")[1], "base64"));
	console.log("wrote icon.png promo.png");
})();
