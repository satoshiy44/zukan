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
	const make = (name, w, h, fn, noCrop) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		fn(c.getContext("2d"), w, h);
		out[name] = (noCrop ? c : crop(c)).toDataURL("image/png");
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
	const INK = "#5a4632";
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
	// ---- 背景(640x480) ----
	const meadow = (name, sky1, sky2, hill1, hill2, ground, extra) => make(name, 640, 480, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, 300);
		g.addColorStop(0, sky1); g.addColorStop(1, sky2);
		ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
		ctx.fillStyle = hill1;
		ctx.beginPath(); ctx.moveTo(0, 270); ctx.quadraticCurveTo(160, 200, 340, 255); ctx.quadraticCurveTo(500, 210, 640, 250); ctx.lineTo(640, 480); ctx.lineTo(0, 480); ctx.fill();
		ctx.fillStyle = hill2;
		ctx.beginPath(); ctx.moveTo(0, 300); ctx.quadraticCurveTo(220, 260, 420, 295); ctx.quadraticCurveTo(540, 280, 640, 300); ctx.lineTo(640, 480); ctx.lineTo(0, 480); ctx.fill();
		ctx.fillStyle = ground; ctx.fillRect(0, 330, w, 150);
		if (extra) extra(ctx, w, h);
	}, true);
	let seed = 5;
	const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
	meadow("bg_spring", "#bfe4ff", "#eaf7ff", "#a8dc8a", "#8cd070", "#9ad67a", (ctx) => {
		for (let i = 0; i < 40; i++) E(ctx, rnd() * 640, 340 + rnd() * 130, 3, 3, ["#fff", "#ffd0e0", "#fff3a0"][i % 3]);
	});
	meadow("bg_summer", "#5ab8ff", "#bfe8ff", "#5ab04a", "#4aa03a", "#6ac050", (ctx) => {
		for (let i = 0; i < 50; i++) line(ctx, [[i * 13, 480], [i * 13 + 4, 466 - rnd() * 14]], "#3a8a2a", 3);
	});
	meadow("bg_autumn", "#2a3260", "#6a5a8a", "#8a7a4a", "#a08a50", "#b49a5a", (ctx) => {
		for (let i = 0; i < 60; i++) E(ctx, rnd() * 640, rnd() * 220, 1.4, 1.4, "rgba(255,255,230,0.8)");
	});
	meadow("bg_winter", "#a8bcd8", "#e4ecf6", "#f4f8ff", "#e8f0fa", "#f8fbff", (ctx) => {
		for (let i = 0; i < 70; i++) E(ctx, rnd() * 640, rnd() * 470, 2.5, 2.5, "rgba(255,255,255,0.9)");
	});
	make("bg_room", 640, 480, (ctx, w, h) => {
		ctx.fillStyle = "#f4e6cc"; ctx.fillRect(0, 0, w, 300);
		for (let x = 0; x < w; x += 40) { ctx.fillStyle = "rgba(200,170,120,0.18)"; ctx.fillRect(x, 0, 20, 300); }
		ctx.fillStyle = "#b07a48"; ctx.fillRect(0, 300, w, 180);
		for (let y = 300; y < h; y += 30) { ctx.fillStyle = "rgba(90,50,20,0.25)"; ctx.fillRect(0, y, w, 2); }
		ctx.fillStyle = "#8a5a32"; ctx.fillRect(0, 290, w, 14);
	}, true);
	// ---- 額縁 ----
	make("frame", 680, 520, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, w, h);
		g.addColorStop(0, "#d8b468"); g.addColorStop(0.5, "#a8803a"); g.addColorStop(1, "#d8b468");
		ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
		ctx.clearRect(20, 20, w - 40, h - 40);
		ctx.strokeStyle = "#6e4e1e"; ctx.lineWidth = 3;
		ctx.strokeRect(1.5, 1.5, w - 3, h - 3); ctx.strokeRect(18.5, 18.5, w - 37, h - 37);
		ctx.strokeStyle = "rgba(255,240,200,0.6)"; ctx.lineWidth = 2; ctx.strokeRect(8, 8, w - 16, h - 16);
	}, true);
	make("frame_s", 340, 260, (ctx, w, h) => {
		ctx.fillStyle = "#a8803a"; ctx.fillRect(0, 0, w, h);
		ctx.clearRect(10, 10, w - 20, h - 20);
		ctx.strokeStyle = "#6e4e1e"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2); ctx.strokeRect(9, 9, w - 18, h - 18);
	}, true);
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
	make("bg_circus", 640, 480, (ctx, w, h) => {
		ctx.fillStyle = "#2a1a3a"; ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 12; i++) poly(ctx, [[320, -40], [i * 58 - 20, 150], [(i + 1) * 58 - 20, 150]], i % 2 ? "#f4ece0" : "#c8303a");
		for (let i = 0; i < 12; i++) E(ctx, i * 58 + 9, 150, 30, 14, i % 2 ? "#f4ece0" : "#c8303a");
		poly(ctx, [[120, 0], [60, 480], [260, 480]], "rgba(255,240,180,0.10)");
		poly(ctx, [[520, 0], [380, 480], [580, 480]], "rgba(255,240,180,0.10)");
		E(ctx, 320, 420, 330, 90, "#b8402a");
		E(ctx, 320, 410, 310, 80, "#e8c070", "#8a5a1a", 4);
		E(ctx, 320, 410, 220, 54, null, "rgba(138,90,26,0.5)", 3);
		for (let i = 0; i < 16; i++) poly(ctx, [[i * 42, 176], [i * 42 + 42, 176], [i * 42 + 21, 200]], ["#ffd23a", "#3a8aff", "#5ab04a", "#ff7aa8"][i % 4]);
		line(ctx, [[0, 176], [640, 176]], "#f4ece0", 2);
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
		fs.writeFileSync(path.join(OUT, name + ".png"), buf);
	}
	console.log("wrote", Object.keys(images).length, "images");
})();
