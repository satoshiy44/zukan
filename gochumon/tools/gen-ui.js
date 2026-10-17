// 星・吹き出しなど、評価システム用の画像を作る
// 使い方: node tools/gen-ui.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const IMG = path.join(__dirname, "..", "image");

function draw() {
	const out = {};
	const make = (name, w, h, fn) => {
		const c = document.createElement("canvas");
		c.width = w; c.height = h;
		fn(c.getContext("2d"), w, h);
		out[name] = c.toDataURL("image/png");
	};
	const starPath = (x, cx, cy, r) => {
		x.beginPath();
		for (let i = 0; i < 10; i++) {
			const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
			x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
		}
		x.closePath();
	};
	make("star", 52, 52, (x) => {
		starPath(x, 26, 28, 24);
		const g = x.createLinearGradient(0, 4, 0, 50);
		g.addColorStop(0, "#fff2a0"); g.addColorStop(0.5, "#f8c830"); g.addColorStop(1, "#e09a18");
		x.fillStyle = g; x.fill();
		x.lineWidth = 3; x.lineJoin = "round"; x.strokeStyle = "#5a3412"; x.stroke();
		x.fillStyle = "rgba(255,255,255,0.55)"; x.beginPath(); x.ellipse(21, 20, 4, 6, -0.5, 0, Math.PI * 2); x.fill();
	});
	make("star_off", 52, 52, (x) => {
		starPath(x, 26, 28, 24);
		x.fillStyle = "rgba(70,50,40,0.75)"; x.fill();
		x.lineWidth = 3; x.lineJoin = "round"; x.strokeStyle = "#c8a878"; x.stroke();
	});
	// 吹き出し(しっぽは左下、お客さんの頭へ)
	make("speech", 460, 180, (x) => {
		x.fillStyle = "#fffaf0"; x.strokeStyle = "#5a3412"; x.lineWidth = 5; x.lineJoin = "round";
		x.beginPath(); x.roundRect(6, 6, 448, 136, 30);
		x.moveTo(170, 140); x.lineTo(196, 176); x.lineTo(220, 140);
		x.fill(); x.stroke();
		x.fillStyle = "#fffaf0"; x.fillRect(172, 132, 46, 10);
		x.strokeStyle = "rgba(200,150,80,0.6)"; x.lineWidth = 2; x.beginPath(); x.roundRect(16, 16, 428, 116, 22); x.stroke();
	});
	// ---- 深夜メニュー(6品)。今の料理と同じお皿・同じ線の太さで描く ----
	const INK = "#352a2d", TEAL = "#285b5b", GOLD = "#cd9d48";
	const E = (x, cx, cy, rx, ry, fill, stroke, lw) => {
		x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
		if (fill) { x.fillStyle = fill; x.fill(); }
		if (stroke) { x.lineWidth = lw; x.strokeStyle = stroke; x.stroke(); }
	};
	const plate = (x) => {
		E(x, 80, 103, 70, 12, "rgba(28,20,19,0.28)");
		E(x, 80, 76, 71, 33, "#e0d9c4", INK, 4);
		E(x, 80, 75, 61, 26, "#faf4e0", TEAL, 3);
		x.beginPath(); x.ellipse(80, 75, 54, 20, 0, Math.PI * 1.11, Math.PI * 1.89); x.strokeStyle = GOLD; x.lineWidth = 2; x.stroke();
	};
	const dishes = [
		(x) => { // カレー
			E(x, 80, 66, 46, 22, "#f6f0e0", INK, 3);
			x.beginPath(); x.ellipse(92, 66, 34, 18, 0, -Math.PI / 2, Math.PI / 2); x.closePath(); x.fillStyle = "#b8702a"; x.fill();
			E(x, 96, 62, 7, 5, "#e88a3a"); E(x, 104, 72, 6, 4, "#f4d040");
		},
		(x) => { // ハンバーグ
			E(x, 80, 64, 38, 22, "#7a4a2a", INK, 3);
			E(x, 80, 58, 28, 12, "#a8441e");
			E(x, 118, 76, 10, 6, "#6ab04a", INK, 2); E(x, 44, 76, 9, 6, "#f0a040", INK, 2);
		},
		(x) => { // プリン
			x.beginPath(); x.moveTo(56, 86); x.lineTo(66, 40); x.lineTo(94, 40); x.lineTo(104, 86); x.closePath();
			x.fillStyle = "#f2d070"; x.fill(); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
			x.beginPath(); x.moveTo(66, 40); x.lineTo(94, 40); x.lineTo(97, 54); x.lineTo(63, 54); x.closePath(); x.fillStyle = "#8a4a1a"; x.fill();
			E(x, 80, 32, 7, 7, "#c8303a", INK, 2);
		},
		(x) => { // クリームソーダ
			x.beginPath(); x.moveTo(62, 30); x.lineTo(98, 30); x.lineTo(92, 92); x.lineTo(68, 92); x.closePath();
			x.fillStyle = "#6ac88a"; x.fill(); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
			E(x, 80, 28, 20, 12, "#fffaf0", INK, 2); E(x, 90, 18, 6, 6, "#d8303a", INK, 2);
			x.beginPath(); x.moveTo(70, 26); x.lineTo(60, 4); x.lineWidth = 4; x.strokeStyle = "#e85a5a"; x.stroke();
		},
		(x) => { // ホットケーキ
			for (let k = 0; k < 3; k++) E(x, 80, 76 - k * 12, 44, 16, k === 2 ? "#e8b860" : "#c88a3a", INK, 3);
			x.fillStyle = "#fff4c0"; x.fillRect(70, 42, 20, 10); x.strokeStyle = INK; x.lineWidth = 2; x.strokeRect(70, 42, 20, 10);
			x.beginPath(); x.moveTo(100, 50); x.quadraticCurveTo(112, 60, 104, 74); x.strokeStyle = "#a8641e"; x.lineWidth = 5; x.stroke();
		},
		(x) => { // ナポリタン
			for (let k = 0; k < 5; k++) {
				x.beginPath(); x.ellipse(80, 66 + k * 2, 40 - k * 3, 18 - k, 0, Math.PI * 1.05, Math.PI * 1.95);
				x.strokeStyle = "#d8502a"; x.lineWidth = 5; x.stroke();
			}
			E(x, 66, 58, 6, 4, "#5aa04a"); E(x, 94, 60, 6, 4, "#5aa04a"); E(x, 80, 52, 7, 5, "#c8303a");
		}
	];
	// ---- メニューにない料理(クレーマーが頼む) ----
	dishes.push((x) => { // ラーメン
		E(x, 80, 66, 46, 24, "#c8302a", INK, 3);
		E(x, 80, 62, 40, 18, "#e8b860");
		for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(52 + k * 14, 62); x.quadraticCurveTo(58 + k * 14, 54, 64 + k * 14, 62); x.strokeStyle = "#f8e8a0"; x.lineWidth = 3; x.stroke(); }
		E(x, 66, 56, 9, 6, "#f8f0e0", INK, 2); E(x, 96, 58, 8, 5, "#5aa04a");
		x.beginPath(); x.moveTo(104, 30); x.lineTo(84, 64); x.moveTo(114, 32); x.lineTo(92, 64); x.strokeStyle = "#a8783a"; x.lineWidth = 4; x.stroke();
	});
	dishes.push((x) => { // お寿司
		for (let k = 0; k < 3; k++) {
			const cx = 52 + k * 28;
			x.fillStyle = "#fffaf0"; x.strokeStyle = INK; x.lineWidth = 2;
			x.beginPath(); x.roundRect(cx - 12, 58, 24, 18, 6); x.fill(); x.stroke();
			x.fillStyle = ["#f06a4a", "#f8c8b0", "#e8d040"][k]; x.beginPath(); x.roundRect(cx - 14, 48, 28, 13, 5); x.fill(); x.stroke();
		}
	});
	dishes.push((x) => { // かつ丼
		E(x, 80, 66, 44, 22, "#2a2a3a", INK, 3);
		E(x, 80, 60, 38, 15, "#f4e0a0");
		for (let k = 0; k < 4; k++) { x.fillStyle = "#c8843a"; x.strokeStyle = INK; x.lineWidth = 1.5; x.beginPath(); x.roundRect(52 + k * 14, 50, 13, 18, 3); x.fill(); x.stroke(); }
		E(x, 94, 56, 6, 4, "#5aa04a");
	});
	dishes.forEach((fn, k) => make("dish" + (6 + k), 160, 120, (x) => {
		plate(x);
		fn(x);
	}));
	// 「帰れ！」ボタン
	make("kaere", 160, 130, (x) => {
		x.fillStyle = "rgba(0,0,0,0.35)"; x.beginPath(); x.roundRect(8, 14, 148, 112, 18); x.fill();
		const g = x.createLinearGradient(0, 4, 0, 118);
		g.addColorStop(0, "#e8584a"); g.addColorStop(1, "#a8241c");
		x.fillStyle = g; x.strokeStyle = "#3a120e"; x.lineWidth = 5;
		x.beginPath(); x.roundRect(4, 4, 148, 112, 18); x.fill(); x.stroke();
		x.strokeStyle = "rgba(255,230,200,0.7)"; x.lineWidth = 2; x.beginPath(); x.roundRect(12, 12, 132, 96, 12); x.stroke();
		x.font = "bold 46px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
		x.lineWidth = 8; x.strokeStyle = "#3a120e"; x.strokeText("帰れ！", 78, 52);
		x.fillStyle = "#fff4e0"; x.fillText("帰れ！", 78, 52);
		x.font = "bold 18px IPAGothic"; x.fillStyle = "#ffe0c0"; x.fillText("クレーマー撃退", 78, 92);
	});
	return out;
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const imgs = await p.evaluate(draw);
	await b.close();
	for (const k of Object.keys(imgs)) fs.writeFileSync(path.join(IMG, k + ".png"), Buffer.from(imgs[k].split(",")[1], "base64"));
	console.log("wrote", Object.keys(imgs).join(", "));
})();
