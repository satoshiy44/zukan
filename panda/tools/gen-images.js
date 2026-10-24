// ポップな絵を作る(迷彩服のどうぶつ・敵・お城・背景・ロゴ・アイコン)
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "image");
const course = JSON.parse(fs.readFileSync(path.join(__dirname, "course.json"), "utf8"));

function build(course) {
	const out = {};
	const INK = "#3a2416";
	const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
	const save = (name, c) => { out[name] = c.toDataURL("image/png"); };
	// 乱数(毎回同じ絵になるように)
	let seed = 7;
	const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
	const ell = (x, cx, cy, rx, ry, fill, line, lw) => {
		x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
		if (fill) { x.fillStyle = fill; x.fill(); }
		if (line) { x.lineWidth = lw || 4; x.strokeStyle = line; x.stroke(); }
	};
	const rr = (x, l, t, w, h, r) => {
		x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
		x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
	};
	// 迷彩もよう: いまのパスの中に、色のかたまりをちらす
	const camo = (x, l, t, w, h, cols) => {
		x.save(); x.clip();
		x.fillStyle = cols[0]; x.fillRect(l, t, w, h);
		for (let i = 0; i < 26; i++) {
			const cx = l + rnd() * w, cy = t + rnd() * h, r = 5 + rnd() * 9;
			x.fillStyle = cols[1 + (i % (cols.length - 1))];
			x.beginPath();
			for (let k = 0; k < 7; k++) {
				const a = k / 7 * Math.PI * 2, rr2 = r * (0.6 + rnd() * 0.6);
				x.lineTo(cx + Math.cos(a) * rr2 * 1.3, cy + Math.sin(a) * rr2);
			}
			x.fill();
		}
		x.restore();
	};
	const CAMO = ["#8aa65a", "#56703a", "#b39a62", "#3c4a2a"];
	const eyes = (x, cx, cy, gap, r) => {
		[-1, 1].forEach((s) => {
			ell(x, cx + s * gap, cy, r, r * 1.15, "#2a1a10");
			ell(x, cx + s * gap - r * 0.3, cy - r * 0.4, r * 0.38, r * 0.38, "#ffffff");
		});
	};
	const blush = (x, cx, cy, gap) => { [-1, 1].forEach((s) => ell(x, cx + s * gap, cy, 7, 4.5, "rgba(255,120,140,0.55)")); };
	// どうぶつの体(迷彩の服)。足もとが (50, 92)
	const body = (x) => {
		ell(x, 50, 94, 26, 6, "rgba(0,0,0,0.22)");
		ell(x, 38, 88, 8, 6, "#5a3a24", INK, 3); ell(x, 62, 88, 8, 6, "#5a3a24", INK, 3);
		rr(x, 30, 58, 40, 32, 14); camo(x, 30, 58, 40, 32, CAMO);
		rr(x, 30, 58, 40, 32, 14); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		x.fillStyle = "#e8c040"; x.fillRect(46, 64, 8, 5); // 名札
	};
	// 迷彩のヘルメット(頭の上)
	const helmet = (x, cx, cy, w, h) => {
		x.beginPath(); x.ellipse(cx, cy, w, h, 0, Math.PI, Math.PI * 2); x.closePath();
		camo(x, cx - w, cy - h, w * 2, h, CAMO);
		x.beginPath(); x.ellipse(cx, cy, w, h, 0, Math.PI, Math.PI * 2); x.closePath();
		x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		rr(x, cx - w - 4, cy - 3, w * 2 + 8, 7, 3); x.fillStyle = "#4a5a2c"; x.fill(); x.lineWidth = 3; x.stroke();
	};
	const unit = (name, draw) => { const [c, x] = mk(100, 100); x.lineJoin = "round"; draw(x); save(name, c); };

	// ======== みかたのどうぶつ ========
	unit("u_chick", (x) => {
		body(x);
		ell(x, 50, 44, 26, 24, "#ffe04a", INK, 4);
		eyes(x, 50, 44, 10, 4); blush(x, 50, 52, 17);
		x.beginPath(); x.moveTo(44, 51); x.lineTo(56, 51); x.lineTo(50, 59); x.closePath(); x.fillStyle = "#ff9a2a"; x.fill(); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
		helmet(x, 50, 32, 22, 15);
	});
	unit("u_rabbit", (x) => {
		body(x);
		[-1, 1].forEach((s) => {
			x.save(); x.translate(50 + s * 11, 22); x.rotate(s * 0.18);
			ell(x, 0, -12, 8, 20, "#ffffff", INK, 4); ell(x, 0, -12, 4, 14, "#ffb0c4");
			x.restore();
		});
		ell(x, 50, 46, 25, 22, "#ffffff", INK, 4);
		eyes(x, 50, 46, 10, 4); blush(x, 50, 54, 16);
		ell(x, 50, 53, 3, 2.5, "#ff7a9a");
		// ベレー帽
		ell(x, 46, 28, 20, 8, "#56703a", INK, 4); ell(x, 60, 26, 4, 4, "#3c4a2a");
	});
	unit("u_penguin", (x) => {
		body(x);
		ell(x, 50, 45, 27, 25, "#2a3446", INK, 4);
		ell(x, 50, 49, 19, 17, "#ffffff");
		eyes(x, 50, 45, 9, 4); blush(x, 50, 54, 15);
		x.beginPath(); x.moveTo(44, 52); x.lineTo(56, 52); x.lineTo(50, 58); x.closePath(); x.fillStyle = "#ffa22a"; x.fill(); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
		helmet(x, 50, 31, 23, 15);
		// 雪の結晶バッジ
		x.strokeStyle = "#7ad8ff"; x.lineWidth = 2;
		for (let k = 0; k < 3; k++) { x.beginPath(); const a = k * Math.PI / 3; x.moveTo(40 - Math.cos(a) * 5, 76 - Math.sin(a) * 5); x.lineTo(40 + Math.cos(a) * 5, 76 + Math.sin(a) * 5); x.stroke(); }
	});
	unit("u_elephant", (x) => {
		body(x);
		[-1, 1].forEach((s) => ell(x, 50 + s * 25, 46, 15, 18, "#a8b4c8", INK, 4));
		[-1, 1].forEach((s) => ell(x, 50 + s * 25, 46, 9, 12, "#f0b4c0"));
		ell(x, 50, 45, 23, 22, "#b8c4d6", INK, 4);
		// 鼻
		x.beginPath(); x.moveTo(45, 50); x.quadraticCurveTo(44, 66, 54, 70); x.lineTo(57, 64); x.quadraticCurveTo(52, 60, 55, 50); x.closePath();
		x.fillStyle = "#b8c4d6"; x.fill(); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		eyes(x, 50, 42, 10, 3.8); blush(x, 50, 51, 16);
		helmet(x, 50, 30, 21, 14);
	});
	unit("u_lion", (x) => {
		body(x);
		for (let k = 0; k < 14; k++) {
			const a = k / 14 * Math.PI * 2;
			ell(x, 50 + Math.cos(a) * 24, 44 + Math.sin(a) * 22, 10, 10, k % 2 ? "#d8742a" : "#e8902e");
		}
		x.beginPath(); x.ellipse(50, 44, 33, 31, 0, 0, Math.PI * 2); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		ell(x, 50, 45, 21, 20, "#ffd27a", INK, 4);
		eyes(x, 50, 42, 9, 3.8); blush(x, 50, 51, 14);
		ell(x, 50, 51, 4, 3, "#6a3a20");
		x.beginPath(); x.moveTo(50, 54); x.lineTo(50, 57); x.moveTo(45, 58); x.quadraticCurveTo(50, 61, 55, 58); x.lineWidth = 2.5; x.strokeStyle = INK; x.stroke();
		helmet(x, 50, 27, 19, 12);
	});

	// ======== 敵 ========
	const shadow = (x, cx, cy, w) => ell(x, cx, cy, w, w * 0.25, "rgba(0,0,0,0.22)");
	const enemy = (name, w, h, draw) => { const [c, x] = mk(w, h); x.lineJoin = "round"; draw(x); save(name, c); };
	enemy("e_slime", 90, 80, (x) => {
		shadow(x, 45, 72, 30);
		x.beginPath(); x.moveTo(10, 66); x.quadraticCurveTo(10, 14, 45, 10); x.quadraticCurveTo(80, 14, 80, 66); x.quadraticCurveTo(45, 76, 10, 66); x.closePath();
		const gr = x.createLinearGradient(0, 10, 0, 70); gr.addColorStop(0, "#7ae0ff"); gr.addColorStop(1, "#2a8ae0");
		x.fillStyle = gr; x.fill(); x.lineWidth = 4; x.strokeStyle = "#163a6a"; x.stroke();
		ell(x, 30, 28, 8, 5, "rgba(255,255,255,0.8)");
		eyes(x, 45, 44, 11, 5);
		x.beginPath(); x.arc(45, 54, 6, 0.1 * Math.PI, 0.9 * Math.PI); x.lineWidth = 3; x.strokeStyle = "#163a6a"; x.stroke();
	});
	enemy("e_goblin", 90, 96, (x) => {
		shadow(x, 45, 88, 26);
		ell(x, 34, 82, 7, 6, "#5a3a24", INK, 3); ell(x, 56, 82, 7, 6, "#5a3a24", INK, 3);
		rr(x, 28, 54, 34, 28, 10); x.fillStyle = "#8a5a32"; x.fill(); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		x.fillStyle = "#c89048"; x.fillRect(30, 68, 30, 5);
		// こん棒
		x.save(); x.translate(70, 62); x.rotate(0.5);
		rr(x, -5, -30, 12, 38, 6); x.fillStyle = "#a8743a"; x.fill(); x.lineWidth = 3.5; x.stroke();
		ell(x, 1, -28, 9, 9, "#a8743a", INK, 3.5);
		x.restore();
		// 頭と耳
		[-1, 1].forEach((s) => {
			x.beginPath(); x.moveTo(45 + s * 16, 36); x.lineTo(45 + s * 34, 26); x.lineTo(45 + s * 18, 46); x.closePath();
			x.fillStyle = "#6ac04a"; x.fill(); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		});
		ell(x, 45, 38, 21, 19, "#7ad05a", INK, 4);
		[-1, 1].forEach((s) => { ell(x, 45 + s * 8, 36, 5, 5, "#fff6a0", INK, 2); ell(x, 45 + s * 8, 37, 2.2, 2.6, "#2a1a10"); });
		x.beginPath(); x.moveTo(37, 47); x.quadraticCurveTo(45, 52, 53, 47); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
		x.fillStyle = "#ffffff"; x.fillRect(40, 47, 3, 3); x.fillRect(48, 47, 3, 3);
	});
	enemy("e_devil", 110, 96, (x) => {
		shadow(x, 55, 90, 22);
		// つばさ
		[-1, 1].forEach((s) => {
			x.beginPath(); x.moveTo(55 + s * 12, 50); x.lineTo(55 + s * 48, 26); x.lineTo(55 + s * 42, 46); x.lineTo(55 + s * 50, 54);
			x.lineTo(55 + s * 38, 58); x.lineTo(55 + s * 40, 68); x.closePath();
			x.fillStyle = "#4a2a6a"; x.fill(); x.lineWidth = 3.5; x.strokeStyle = "#1e0e2e"; x.stroke();
		});
		// しっぽ
		x.beginPath(); x.moveTo(62, 76); x.quadraticCurveTo(84, 86, 82, 70); x.lineWidth = 4; x.strokeStyle = "#1e0e2e"; x.stroke();
		x.beginPath(); x.moveTo(82, 62); x.lineTo(88, 72); x.lineTo(77, 71); x.closePath(); x.fillStyle = "#d03a6a"; x.fill();
		ell(x, 55, 58, 20, 22, "#b04ad0", "#1e0e2e", 4);
		// つの
		[-1, 1].forEach((s) => {
			x.beginPath(); x.moveTo(55 + s * 10, 42); x.quadraticCurveTo(55 + s * 20, 26, 55 + s * 14, 18); x.quadraticCurveTo(55 + s * 12, 30, 55 + s * 4, 38); x.closePath();
			x.fillStyle = "#ffe0a0"; x.fill(); x.lineWidth = 3; x.strokeStyle = "#1e0e2e"; x.stroke();
		});
		[-1, 1].forEach((s) => { ell(x, 55 + s * 8, 54, 5, 6, "#fff0f0"); ell(x, 55 + s * 8, 55, 2.4, 3, "#d01a3a"); });
		x.beginPath(); x.moveTo(47, 66); x.lineTo(51, 70); x.lineTo(55, 66); x.lineTo(59, 70); x.lineTo(63, 66); x.lineWidth = 3; x.strokeStyle = "#1e0e2e"; x.stroke();
	});
	enemy("e_witch", 100, 110, (x) => {
		shadow(x, 50, 104, 26);
		// ほうき
		x.save(); x.translate(50, 86); x.rotate(-0.25);
		x.fillStyle = "#8a5a2a"; x.fillRect(-40, -3, 70, 6);
		x.beginPath(); x.moveTo(26, -10); x.lineTo(44, -14); x.lineTo(46, 14); x.lineTo(26, 10); x.closePath(); x.fillStyle = "#e8b84a"; x.fill(); x.lineWidth = 3; x.strokeStyle = INK; x.stroke();
		x.restore();
		// ローブ
		x.beginPath(); x.moveTo(30, 96); x.lineTo(36, 58); x.lineTo(64, 58); x.lineTo(70, 96); x.closePath();
		x.fillStyle = "#6a3aa8"; x.fill(); x.lineWidth = 4; x.strokeStyle = "#241040"; x.stroke();
		// 顔と髪
		ell(x, 50, 52, 17, 16, "#ffd8b8", INK, 4);
		x.fillStyle = "#ff7a3a"; x.fillRect(32, 46, 6, 18); x.fillRect(62, 46, 6, 18);
		[-1, 1].forEach((s) => ell(x, 50 + s * 6, 53, 2.6, 3.2, "#3a1a50"));
		x.beginPath(); x.moveTo(45, 60); x.quadraticCurveTo(50, 64, 55, 60); x.lineWidth = 2.5; x.strokeStyle = INK; x.stroke();
		// ぼうし
		ell(x, 50, 40, 28, 7, "#2a1a3a", "#120818", 3.5);
		x.beginPath(); x.moveTo(36, 40); x.lineTo(56, 2); x.lineTo(64, 40); x.closePath(); x.fillStyle = "#2a1a3a"; x.fill(); x.lineWidth = 3.5; x.strokeStyle = "#120818"; x.stroke();
		x.fillStyle = "#e8c040"; x.fillRect(39, 33, 23, 5);
	});
	enemy("e_ogre", 140, 140, (x) => {
		shadow(x, 70, 130, 44);
		ell(x, 52, 122, 13, 9, "#6a3a24", INK, 4); ell(x, 88, 122, 13, 9, "#6a3a24", INK, 4);
		ell(x, 70, 92, 42, 34, "#e8603a", INK, 5);
		x.fillStyle = "#8a6a3a"; x.fillRect(32, 100, 76, 14); x.strokeStyle = INK; x.lineWidth = 4; x.strokeRect(32, 100, 76, 14);
		// こん棒
		x.save(); x.translate(118, 86); x.rotate(0.4);
		rr(x, -8, -50, 18, 62, 8); x.fillStyle = "#9a6a3a"; x.fill(); x.lineWidth = 4; x.stroke();
		[[-6, -40], [6, -30], [-4, -20]].forEach((q) => ell(x, q[0], q[1], 3, 3, "#d0d0d8"));
		x.restore();
		ell(x, 70, 48, 30, 27, "#f07a4a", INK, 5);
		[-1, 1].forEach((s) => {
			x.beginPath(); x.moveTo(70 + s * 14, 26); x.lineTo(70 + s * 22, 4); x.lineTo(70 + s * 26, 30); x.closePath();
			x.fillStyle = "#fff0c0"; x.fill(); x.lineWidth = 3.5; x.strokeStyle = INK; x.stroke();
		});
		[-1, 1].forEach((s) => { ell(x, 70 + s * 11, 46, 6, 6, "#ffffff", INK, 2.5); ell(x, 70 + s * 11, 47, 3, 3, "#2a1a10"); });
		x.beginPath(); x.moveTo(56, 36); x.lineTo(66, 40); x.moveTo(84, 36); x.lineTo(74, 40); x.lineWidth = 4; x.strokeStyle = INK; x.stroke();
		rr(x, 56, 58, 28, 10, 4); x.fillStyle = "#5a1a1a"; x.fill(); x.lineWidth = 3; x.stroke();
		x.fillStyle = "#ffffff"; x.fillRect(60, 58, 5, 5); x.fillRect(75, 58, 5, 5);
	});

	// ======== お城とパンダの王様 ========
	{
		const [c, x] = mk(300, 300);
		x.lineJoin = "round";
		ell(x, 150, 270, 120, 22, "rgba(0,0,0,0.22)");
		// 城壁
		const tower = (l, t, w, h, roof) => {
			rr(x, l, t, w, h, 6); x.fillStyle = "#fff4e0"; x.fill(); x.lineWidth = 5; x.strokeStyle = INK; x.stroke();
			for (let k = 0; k < 3; k++) { x.fillStyle = "#fff4e0"; x.fillRect(l + 4 + k * (w - 8) / 3, t - 10, (w - 8) / 3 - 6, 12); x.strokeRect(l + 4 + k * (w - 8) / 3, t - 10, (w - 8) / 3 - 6, 12); }
			x.beginPath(); x.moveTo(l - 6, t - 8); x.lineTo(l + w / 2, t - 8 - roof); x.lineTo(l + w + 6, t - 8); x.closePath();
			x.fillStyle = "#ff8aa8"; x.fill(); x.stroke();
			x.fillStyle = "#7ac8ff"; rr(x, l + w / 2 - 8, t + 18, 16, 22, 8); x.fill(); x.stroke();
		};
		tower(28, 140, 64, 120, 46); tower(208, 140, 64, 120, 46);
		rr(x, 70, 150, 160, 110, 10); x.fillStyle = "#fff8ec"; x.fill(); x.lineWidth = 5; x.strokeStyle = INK; x.stroke();
		for (let k = 0; k < 6; k++) { x.fillStyle = "#fff8ec"; x.fillRect(74 + k * 26, 138, 18, 14); x.strokeRect(74 + k * 26, 138, 18, 14); }
		// 門
		x.beginPath(); x.moveTo(126, 260); x.lineTo(126, 220); x.arc(150, 220, 24, Math.PI, 0); x.lineTo(174, 260); x.closePath();
		x.fillStyle = "#a8643a"; x.fill(); x.stroke();
		// 旗
		[[60, 46], [240, 46]].forEach((q) => {
			x.beginPath(); x.moveTo(q[0], q[1] + 40); x.lineTo(q[0], q[1]); x.lineWidth = 4; x.stroke();
			x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(q[0] + 26, q[1] + 8); x.lineTo(q[0], q[1] + 16); x.closePath(); x.fillStyle = "#ffd040"; x.fill(); x.lineWidth = 3; x.stroke();
		});
		// てっぺんのパンダの王様
		const px = 150, py = 92;
		rr(x, px - 28, py + 20, 56, 40, 16); x.fillStyle = "#e03a4a"; x.fill(); x.lineWidth = 4.5; x.stroke(); // マント
		ell(x, px, py + 36, 22, 20, "#ffffff", INK, 4.5);
		[-1, 1].forEach((s) => ell(x, px + s * 24, py - 22, 11, 11, "#2a2a32", INK, 4));
		ell(x, px, py, 34, 30, "#ffffff", INK, 5);
		[-1, 1].forEach((s) => {
			x.save(); x.translate(px + s * 13, py + 2); x.rotate(s * -0.5); ell(x, 0, 0, 9, 12, "#2a2a32"); x.restore();
			ell(x, px + s * 12, py + 1, 4, 4.5, "#ffffff"); ell(x, px + s * 12, py + 2, 2.2, 2.6, "#2a1a10");
		});
		ell(x, px, py + 12, 5, 3.5, "#2a2a32");
		x.beginPath(); x.moveTo(px - 6, py + 18); x.quadraticCurveTo(px, py + 23, px + 6, py + 18); x.lineWidth = 3; x.stroke();
		[-1, 1].forEach((s) => ell(x, px + s * 22, py + 12, 6, 4, "rgba(255,120,140,0.5)"));
		// かんむり
		x.beginPath(); x.moveTo(px - 20, py - 22); x.lineTo(px - 22, py - 46); x.lineTo(px - 10, py - 34); x.lineTo(px, py - 52); x.lineTo(px + 10, py - 34);
		x.lineTo(px + 22, py - 46); x.lineTo(px + 20, py - 22); x.closePath();
		x.fillStyle = "#ffd040"; x.fill(); x.lineWidth = 4; x.stroke();
		[[px, py - 30, "#e03a4a"], [px - 13, py - 28, "#3a8ae0"], [px + 13, py - 28, "#3ac06a"]].forEach((q) => ell(x, q[0], q[1], 4, 4, q[2]));
		save("castle", c);
	}

	// ======== 背景(草原と道) ========
	{
		const [c, x] = mk(1280, 720);
		const g = x.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, "#9ad86a"); g.addColorStop(1, "#7cc456");
		x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
		// 草のもよう
		for (let i = 0; i < 260; i++) {
			const cx = rnd() * 1280, cy = rnd() * 720;
			x.strokeStyle = "rgba(60,130,50,0.45)"; x.lineWidth = 3; x.lineCap = "round";
			x.beginPath(); x.moveTo(cx - 4, cy); x.lineTo(cx - 6, cy - 7); x.moveTo(cx, cy); x.lineTo(cx, cy - 9); x.moveTo(cx + 4, cy); x.lineTo(cx + 6, cy - 7); x.stroke();
		}
		// 道
		const road = (w, col) => {
			x.lineJoin = "round"; x.lineCap = "round"; x.lineWidth = w; x.strokeStyle = col;
			course.paths.forEach((p) => {
				x.beginPath(); x.moveTo(p[0][0], p[0][1]);
				for (let k = 1; k < p.length; k++) x.lineTo(p[k][0], p[k][1]);
				x.lineTo(course.castle[0], course.castle[1]); x.stroke();
			});
		};
		road(70, "#c89a5a"); road(58, "#f0d49a");
		// 道の小石
		course.paths.forEach((p) => {
			for (let k = 0; k < p.length - 1; k++) {
				for (let t = 0; t < 1; t += 0.12) {
					const cx = p[k][0] + (p[k + 1][0] - p[k][0]) * t + (rnd() - 0.5) * 30, cy = p[k][1] + (p[k + 1][1] - p[k][1]) * t + (rnd() - 0.5) * 30;
					ell(x, cx, cy, 3, 2, "rgba(170,120,70,0.5)");
				}
			}
		});
		// お城の広場
		ell(x, course.castle[0], course.castle[1] + 20, 140, 90, "#c89a5a"); ell(x, course.castle[0], course.castle[1] + 20, 132, 83, "#f6dca8");
		// 花と木
		const flower = (cx, cy, col) => { for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ell(x, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 4, 4, col); } ell(x, cx, cy, 3, 3, "#ffe04a"); };
		const tree = (cx, cy, s) => {
			ell(x, cx, cy + 26 * s, 26 * s, 8 * s, "rgba(0,0,0,0.2)");
			x.fillStyle = "#8a5a32"; x.fillRect(cx - 5 * s, cy, 10 * s, 26 * s);
			ell(x, cx, cy - 10 * s, 30 * s, 26 * s, "#4aa848", "#2a6a2a", 4); ell(x, cx - 10 * s, cy - 18 * s, 10 * s, 8 * s, "#7ad06a");
		};
		const nearRoad = (px, py, d) => course.paths.some((p) => {
			const pts = p.concat([course.castle]);
			for (let k = 0; k < pts.length - 1; k++) {
				const ax = pts[k][0], ay = pts[k][1], bx = pts[k + 1][0], by = pts[k + 1][1];
				const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
				if (Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay)) < d) return true;
			}
			return false;
		});
		for (let i = 0; i < 70; i++) {
			const cx = rnd() * 1280, cy = rnd() * 720;
			if (!nearRoad(cx, cy, 45) && Math.hypot(cx - course.castle[0], cy - course.castle[1]) > 170) flower(cx, cy, ["#ff8aa8", "#ffffff", "#ffb0e0", "#a0c8ff"][i % 4]);
		}
		[[60, 40], [1200, 60], [1230, 300], [40, 420], [130, 640], [1180, 680], [760, 650], [470, 40]].forEach((q, i) => {
			if (!nearRoad(q[0], q[1], 60)) tree(q[0], q[1], 0.9 + (i % 3) * 0.15);
		});
		save("bg", c);
	}

	// ======== たま・こうか ========
	{
		let [c, x] = mk(20, 20); ell(x, 10, 10, 7, 7, "#7ae04a", "#2a6a2a", 3); ell(x, 8, 8, 2, 2, "#ffffff"); save("p_pea", c);
		[c, x] = mk(40, 20);
		x.beginPath(); x.moveTo(4, 10); x.lineTo(30, 4); x.lineTo(30, 16); x.closePath(); x.fillStyle = "#ff8a2a"; x.fill(); x.lineWidth = 2.5; x.strokeStyle = INK; x.stroke();
		x.fillStyle = "#4ac04a"; x.beginPath(); x.moveTo(30, 6); x.lineTo(38, 2); x.lineTo(36, 10); x.lineTo(38, 18); x.lineTo(30, 14); x.closePath(); x.fill(); x.stroke();
		save("p_carrot", c);
		[c, x] = mk(28, 28); x.beginPath(); x.moveTo(14, 2); x.quadraticCurveTo(26, 16, 14, 26); x.quadraticCurveTo(2, 16, 14, 2); x.fillStyle = "#5ac8ff"; x.fill(); x.lineWidth = 2.5; x.strokeStyle = "#1a5a9a"; x.stroke(); ell(x, 11, 16, 3, 4, "rgba(255,255,255,0.8)"); save("p_water", c);
		[c, x] = mk(26, 26);
		x.strokeStyle = "#bff0ff"; x.lineWidth = 4; x.lineCap = "round";
		for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; x.beginPath(); x.moveTo(13 - Math.cos(a) * 10, 13 - Math.sin(a) * 10); x.lineTo(13 + Math.cos(a) * 10, 13 + Math.sin(a) * 10); x.stroke(); }
		save("p_ice", c);
		// 輪(はんい・ほえる・水しぶき)
		[c, x] = mk(200, 200); ell(x, 100, 100, 96, 96, "rgba(255,255,255,0.18)", "rgba(255,255,255,0.85)", 4); save("ring", c);
		[c, x] = mk(200, 200); ell(x, 100, 100, 94, 94, null, "#ffd040", 8); save("roar", c);
		[c, x] = mk(200, 200); ell(x, 100, 100, 90, 90, "rgba(90,200,255,0.35)", "rgba(200,240,255,0.9)", 6); save("splash", c);
		[c, x] = mk(200, 200); ell(x, 100, 100, 96, 96, "rgba(255,90,90,0.15)", "rgba(255,90,90,0.8)", 4); save("ring_ng", c);
		// けむり
		[c, x] = mk(80, 80); [[40, 40, 22], [24, 46, 14], [56, 46, 14], [40, 26, 14]].forEach((q) => ell(x, q[0], q[1], q[2], q[2], "#ffffff", "#c8c8d8", 3)); save("poof", c);
		// 星
		[c, x] = mk(40, 40); x.beginPath();
		for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 8 : 18; x.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); }
		x.closePath(); x.fillStyle = "#ffe04a"; x.fill(); x.lineWidth = 3; x.strokeStyle = "#c88a1a"; x.stroke(); save("star", c);
	}
	// ======== パレットのカード ========
	{
		const [c, x] = mk(150, 104);
		rr(x, 3, 3, 144, 98, 16); x.fillStyle = "#fff8e8"; x.fill(); x.lineWidth = 5; x.strokeStyle = INK; x.stroke();
		save("card", c);
		const [c2, x2] = mk(150, 104);
		rr(x2, 3, 3, 144, 98, 16); x2.fillStyle = "#fff0a0"; x2.fill(); x2.lineWidth = 7; x2.strokeStyle = "#ff6a3a"; x2.stroke();
		save("card_on", c2);
	}
	// ======== ロゴ(正方形) ========
	{
		const [c, x] = mk(480, 480);
		x.lineJoin = "round";
		const img = new Image();
		const t = (s, cx, cy, size, fill, col2) => {
			x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle";
			x.lineWidth = size * 0.32; x.strokeStyle = INK; x.strokeText(s, cx, cy + 5);
			x.lineWidth = size * 0.26; x.strokeStyle = "#ffffff"; x.strokeText(s, cx, cy);
			const gr = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2); gr.addColorStop(0, fill); gr.addColorStop(1, col2);
			x.fillStyle = gr; x.fillText(s, cx, cy);
		};
		out._logoDraw = true;
		t("まもれ！", 240, 300, 82, "#ffb0c8", "#ff5a8a");
		t("パンダ城", 240, 400, 104, "#a8f070", "#3aa84a");
		save("logo_text", c);
	}
	return out;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build, course);
	// ロゴ: 文字の上にお城を合成
	const logo = await p.evaluate(async (res) => {
		const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
		const castle = await load(res.castle), text = await load(res.logo_text), chick = await load(res.u_chick), slime = await load(res.e_slime);
		const c = document.createElement("canvas"); c.width = 480; c.height = 480;
		const x = c.getContext("2d");
		x.drawImage(castle, 90, -20, 300, 300);
		x.drawImage(chick, 20, 150, 110, 110);
		x.drawImage(slime, 370, 180, 90, 80);
		x.drawImage(text, 0, 0);
		return c.toDataURL("image/png");
	}, res);
	res.logo = logo;
	// アイコン(320x320・透過なし): 草原にお城とパンダの王様、迷彩のひよことライオン
	res.icon = await p.evaluate(async (res) => {
		const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
		const castle = await load(res.castle), chick = await load(res.u_chick), lion = await load(res.u_lion), slime = await load(res.e_slime);
		const c = document.createElement("canvas"); c.width = 320; c.height = 320;
		const x = c.getContext("2d");
		const g = x.createRadialGradient(160, 120, 20, 160, 160, 230); g.addColorStop(0, "#c8f0ff"); g.addColorStop(0.55, "#9ad86a"); g.addColorStop(1, "#5aa83a");
		x.fillStyle = g; x.fillRect(0, 0, 320, 320);
		x.fillStyle = "#f0d49a"; x.beginPath(); x.ellipse(160, 280, 150, 40, 0, 0, Math.PI * 2); x.fill();
		x.drawImage(castle, 15, -8, 290, 290);
		x.drawImage(chick, -6, 196, 120, 120);
		x.drawImage(lion, 206, 196, 120, 120);
		x.drawImage(slime, 120, 250, 76, 68);
		return c.toDataURL("image/png");
	}, res);
	delete res.logo_text; delete res._logoDraw;
	await b.close();
	Object.keys(res).forEach((k) => fs.writeFileSync(k === "icon" ? path.join(ROOT, "icon.png") : path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64")));
	console.log("wrote", Object.keys(res).length, "images");
})();
