// 画像アセット生成スクリプト: Chromium の canvas で描画して image/ 以下に PNG を書き出す
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");

function drawAll() {
	const out = {};
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
	const INK = "#3b2616";
	// 絵本のようなこげ茶のふち線と、右下のかげ
	const finish = (c) => {
		const w = c.width, h = c.height, x = c.getContext("2d");
		x.save();
		x.globalCompositeOperation = "source-atop";
		const sh = x.createLinearGradient(0, 0, w, h);
		sh.addColorStop(0, "rgba(255,250,230,0.15)");
		sh.addColorStop(0.55, "rgba(255,250,230,0)");
		sh.addColorStop(1, "rgba(60,30,10,0.22)");
		x.fillStyle = sh; x.fillRect(0, 0, w, h);
		x.restore();
		const sil = document.createElement("canvas");
		sil.width = w; sil.height = h;
		const sx = sil.getContext("2d");
		sx.drawImage(c, 0, 0);
		sx.globalCompositeOperation = "source-in";
		sx.fillStyle = INK; sx.fillRect(0, 0, w, h);
		x.save();
		x.globalCompositeOperation = "destination-over";
		for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; x.drawImage(sil, Math.cos(a) * 2.5, Math.sin(a) * 2.5); }
		x.restore();
	};
	// opt: { crop: false, plain: true, jpeg: true }
	const make = (name, w, h, fn, opt) => {
		opt = opt || {};
		const pad = opt.crop === false ? 0 : 8;
		const c = document.createElement("canvas");
		c.width = w + pad * 2; c.height = h + pad * 2;
		const ctx = c.getContext("2d");
		ctx.translate(pad, pad);
		fn(ctx, w, h);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		if (!opt.plain) finish(c);
		const o = opt.crop === false ? c : crop(c);
		out[name] = opt.jpeg ? o.toDataURL("image/jpeg", 0.88) : o.toDataURL("image/png");
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
	let seed = 9;
	const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

	// ---- 空(1280x340) ----
	make("sky", 1280, 340, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, "#5aa0d8"); g.addColorStop(0.7, "#bfe0f0"); g.addColorStop(1, "#f6e8c8");
		ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
		const cloud = (cx, cy, s) => {
			[[-0.6, 0.15, 0.45], [-0.2, -0.15, 0.55], [0.3, -0.05, 0.5], [0.65, 0.2, 0.38], [0.05, 0.25, 0.5]].forEach((q) =>
				E(ctx, cx + q[0] * s, cy + q[1] * s, q[2] * s, q[2] * s * 0.7, "rgba(255,255,255,0.85)"));
		};
		[[160, 80, 70], [480, 50, 50], [760, 110, 80], [1080, 60, 60], [1240, 150, 40], [330, 170, 40]].forEach((q) => cloud(q[0], q[1], q[2]));
	}, { crop: false, plain: true, jpeg: true });
	// ---- 遠くの山(横につながる) ----
	make("mountains", 1280, 170, (ctx, w, h) => {
		const ridge = (base, amp, color, n, off) => {
			ctx.fillStyle = color;
			ctx.beginPath(); ctx.moveTo(0, h);
			for (let x = 0; x <= w; x += 8) {
				const t = x / w * Math.PI * 2;
				ctx.lineTo(x, base - amp * (0.5 + 0.3 * Math.sin(t * n + off) + 0.2 * Math.sin(t * n * 2.3 + off * 2)));
			}
			ctx.lineTo(w, h); ctx.fill();
		};
		ridge(140, 120, "#9ab4c8", 3, 0.4);
		// 雪の帽子
		ctx.save(); ctx.globalCompositeOperation = "source-atop"; ctx.fillStyle = "rgba(250,250,255,0.9)"; ctx.fillRect(0, 0, w, 52); ctx.restore();
		ridge(170, 90, "#7a9a88", 4, 1.7);
	}, { crop: false, plain: true });
	// ---- 手前の丘と町(横につながる) ----
	make("hills", 1280, 110, (ctx, w, h) => {
		ctx.fillStyle = "#6aa05a";
		ctx.beginPath(); ctx.moveTo(0, h);
		for (let x = 0; x <= w; x += 8) { const t = x / w * Math.PI * 2; ctx.lineTo(x, 60 - 30 * Math.sin(t * 5) - 12 * Math.sin(t * 11 + 1)); }
		ctx.lineTo(w, h); ctx.fill();
		for (let k = 0; k < 14; k++) {
			const x = 40 + k * 90 + (k % 3) * 10, t = x / w * Math.PI * 2, y = 64 - 30 * Math.sin(t * 5) - 12 * Math.sin(t * 11 + 1);
			if (k % 3 === 1) {
				R(ctx, x - 9, y - 16, 18, 16, 0, "#f0e2c4", INK, 1); poly(ctx, [[x - 12, y - 16], [x, y - 28], [x + 12, y - 16]], "#b8583a", INK, 1);
			} else {
				E(ctx, x, y - 12, 9, 14, "#4a7a3a", INK, 1); E(ctx, x + 14, y - 8, 7, 10, "#5a8a42", INK, 1);
			}
		}
	}, { crop: false, plain: true });

	// ---- 自分の車(うしろ姿) ----
	const car = (ctx, lean, body, dark) => {
		ctx.translate(130, 0);
		ctx.transform(1, 0, lean, 1, 0, 0);
		ctx.translate(-130, 0);
		// タイヤ
		R(ctx, 22, 112, 46, 56, 10, "#2a2a2e", INK, 2.5); R(ctx, 192, 112, 46, 56, 10, "#2a2a2e", INK, 2.5);
		// 車体
		R(ctx, 14, 70, 232, 70, 22, body, INK, 3);
		R(ctx, 14, 112, 232, 30, 12, dark, INK, 2.5);
		// 屋根なしの座席と運転手
		poly(ctx, [[60, 74], [80, 30], [180, 30], [200, 74]], "rgba(190,225,240,0.9)", INK, 2.5);
		E(ctx, 130, 52, 22, 22, "#6a4a2a", INK, 2.5);
		R(ctx, 108, 36, 44, 10, 5, "#c8403a", INK, 2);
		// テールランプとナンバー
		R(ctx, 26, 88, 34, 16, 6, "#ff6a4a", INK, 2); R(ctx, 200, 88, 34, 16, 6, "#ff6a4a", INK, 2);
		R(ctx, 100, 116, 60, 20, 3, "#f6eccc", INK, 2);
		ctx.font = "bold 14px sans-serif"; ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.fillText("NICO", 130, 131);
		R(ctx, 40, 140, 30, 8, 3, "#5a5a62", INK, 1.5);
		E(ctx, 60, 76, 30, 4, "rgba(255,255,255,0.35)"); E(ctx, 200, 76, 30, 4, "rgba(255,255,255,0.35)");
	};
	make("car", 260, 170, (ctx) => car(ctx, 0, "#d8403a", "#a82a24"));
	make("car_l", 260, 170, (ctx) => car(ctx, -0.12, "#d8403a", "#a82a24"));
	make("car_r", 260, 170, (ctx) => car(ctx, 0.12, "#d8403a", "#a82a24"));
	// ---- ほかの車 ----
	const rival = (ctx, body, dark, roof) => {
		R(ctx, 20, 108, 40, 46, 8, "#2a2a2e", INK, 2.5); R(ctx, 170, 108, 40, 46, 8, "#2a2a2e", INK, 2.5);
		R(ctx, 30, 20, 170, 60, 18, roof, INK, 3);
		R(ctx, 46, 30, 138, 40, 10, "#a8d0e0", INK, 2);
		R(ctx, 10, 66, 210, 76, 18, body, INK, 3);
		R(ctx, 10, 114, 210, 28, 10, dark, INK, 2.5);
		R(ctx, 22, 82, 34, 14, 5, "#ff8a5a", INK, 2); R(ctx, 174, 82, 34, 14, 5, "#ff8a5a", INK, 2);
		R(ctx, 90, 112, 50, 18, 3, "#f6eccc", INK, 2);
	};
	make("rival_a", 230, 160, (ctx) => rival(ctx, "#4a7ab8", "#335a8a", "#5a8ac8"));
	make("rival_b", 230, 160, (ctx) => rival(ctx, "#e0b030", "#b88a1a", "#ecc040"));
	make("rival_c", 230, 160, (ctx) => rival(ctx, "#5a9a5a", "#3a7a3a", "#6aaa6a"));

	// ---- ひろうもの ----
	make("coin", 80, 80, (ctx) => {
		E(ctx, 40, 40, 36, 36, "#e8b830", INK, 3);
		E(ctx, 40, 40, 27, 27, "#f8d860", "#c8901a", 3);
		const pts = [];
		for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 16; pts.push([40 + Math.cos(a) * r, 41 + Math.sin(a) * r]); }
		poly(ctx, pts, "#fff4b0", "#c8901a", 2);
		E(ctx, 28, 24, 6, 10, "rgba(255,255,255,0.6)", null, 0, 0.6);
	});
	make("gem", 100, 90, (ctx) => {
		poly(ctx, [[20, 30], [36, 8], [64, 8], [80, 30], [50, 84]], "#5ac0e8", INK, 3);
		poly(ctx, [[20, 30], [80, 30], [50, 84]], "#3a9ad0");
		poly(ctx, [[36, 8], [50, 30], [64, 8]], "#a8e4f8");
		line(ctx, [[20, 30], [80, 30]], INK, 2); line(ctx, [[36, 8], [50, 30], [64, 8]], INK, 2); line(ctx, [[50, 30], [50, 84]], "rgba(40,30,20,0.5)", 1.5);
		E(ctx, 40, 20, 5, 8, "rgba(255,255,255,0.7)", null, 0, 0.6);
	});
	// 加速パネル(道にはりついている)
	make("boost", 240, 70, (ctx) => {
		poly(ctx, [[24, 4], [216, 4], [236, 66], [4, 66]], "#f0a030", INK, 3);
		for (let k = 0; k < 3; k++) {
			const y = 54 - k * 18;
			poly(ctx, [[70, y], [120, y - 14], [170, y], [170, y + 8], [120, y - 6], [70, y + 8]], "#fff4c0");
		}
	});
	// ---- じゃまもの ----
	make("cone", 80, 100, (ctx) => {
		R(ctx, 4, 84, 72, 14, 3, "#e86a2a", INK, 2.5);
		poly(ctx, [[40, 4], [64, 86], [16, 86]], "#f07a3a", INK, 3);
		poly(ctx, [[30, 38], [50, 38], [55, 56], [25, 56]], "#f8f4e8");
	});
	make("rock", 160, 110, (ctx) => {
		poly(ctx, [[10, 106], [20, 50], [56, 14], [104, 10], [140, 42], [154, 106]], "#9a948a", INK, 3);
		poly(ctx, [[56, 14], [104, 10], [90, 50], [50, 56]], "#b8b2a6");
		line(ctx, [[90, 50], [120, 106]], "rgba(60,50,40,0.4)", 2);
	});
	make("barrier", 220, 110, (ctx) => {
		R(ctx, 30, 60, 12, 46, 2, "#7a7a82", INK, 2); R(ctx, 178, 60, 12, 46, 2, "#7a7a82", INK, 2);
		R(ctx, 6, 14, 208, 54, 6, "#f8f4e8", INK, 3);
		ctx.save(); ctx.beginPath(); ctx.roundRect(6, 14, 208, 54, 6); ctx.clip();
		for (let k = -2; k < 10; k++) poly(ctx, [[k * 30, 14], [k * 30 + 16, 14], [k * 30 + 46, 68], [k * 30 + 30, 68]], "#d8403a");
		ctx.restore();
		R(ctx, 6, 14, 208, 54, 6, null, INK, 3);
	});

	// ---- 道ばたの景色 ----
	make("tree", 220, 280, (ctx) => {
		R(ctx, 96, 170, 28, 106, 6, "#8a5a32", INK, 3);
		[[110, 80, 80], [60, 130, 56], [160, 130, 56], [110, 150, 64]].forEach((q) => E(ctx, q[0], q[1], q[2], q[2] * 0.82, "#5a9a42", "#3a7a2a", 3));
		for (let k = 0; k < 10; k++) E(ctx, 50 + rnd() * 120, 70 + rnd() * 90, 6, 5, "#7ab85a");
	});
	make("pine", 150, 290, (ctx) => {
		R(ctx, 64, 236, 22, 50, 4, "#7a4a2a", INK, 3);
		[[75, 10, 40, 90], [75, 60, 58, 150], [75, 120, 72, 240]].forEach((q) => poly(ctx, [[q[0], q[1]], [q[0] + q[2], q[3]], [q[0] - q[2], q[3]]], "#3a7a4a", INK, 3));
	});
	make("bush", 170, 100, (ctx) => {
		[[40, 64, 38], [86, 50, 46], [132, 66, 36]].forEach((q) => E(ctx, q[0], q[1], q[2], q[2] * 0.8, "#6aaa4a", "#3a7a2a", 3));
		for (let k = 0; k < 7; k++) E(ctx, 20 + rnd() * 130, 40 + rnd() * 40, 6, 6, ["#f8f0f0", "#f0a0b0", "#f8e070"][k % 3], INK, 1);
	});
	make("house", 240, 220, (ctx) => {
		R(ctx, 30, 90, 180, 126, 2, "#f0e2c4", INK, 3);
		poly(ctx, [[14, 94], [120, 14], [226, 94]], "#c8583a", INK, 3);
		R(ctx, 160, 30, 22, 44, 2, "#a8644a", INK, 2.5);
		R(ctx, 100, 150, 40, 66, 4, "#8a5a32", INK, 2.5);
		[[50, 112], [160, 112]].forEach((q) => { R(ctx, q[0], q[1], 34, 34, 2, "#9ac8e0", INK, 2.5); line(ctx, [[q[0] + 17, q[1]], [q[0] + 17, q[1] + 34]], INK, 2); R(ctx, q[0] - 4, q[1] + 34, 42, 8, 2, "#c8403a", INK, 1.5); });
	});
	make("windmill", 230, 320, (ctx) => {
		poly(ctx, [[86, 120], [144, 120], [160, 316], [70, 316]], "#f0e2c4", INK, 3);
		poly(ctx, [[80, 124], [115, 84], [150, 124]], "#8a5a3a", INK, 3);
		R(ctx, 102, 260, 26, 56, 10, "#8a5a32", INK, 2.5);
		[0.5, 2.07, 3.64, 5.21].forEach((a) => {
			const c = Math.cos(a), s = Math.sin(a);
			poly(ctx, [[115 + c * 14, 104 + s * 14], [115 + c * 100 - s * 18, 104 + s * 100 + c * 18], [115 + c * 100, 104 + s * 100], [115 + c * 14 - s * 6, 104 + s * 14 + c * 6]], "#f8f4e8", INK, 2.5);
		});
		E(ctx, 115, 104, 10, 10, "#c8a050", INK, 2);
	});
	make("flowers", 180, 70, (ctx) => {
		E(ctx, 90, 56, 86, 14, "#6aaa4a");
		for (let k = 0; k < 16; k++) {
			const x = 12 + k * 10.5, y = 46 - (k % 3) * 8;
			line(ctx, [[x, y], [x, 60]], "#4a8a3a", 2);
			E(ctx, x, y, 6, 6, ["#e8505a", "#f8e070", "#f8f0f0", "#c87ad0"][k % 4], INK, 1.2);
		}
	});
	const arrowSign = (ctx, dir) => {
		R(ctx, 70, 90, 14, 130, 3, "#8a8a92", INK, 2.5);
		R(ctx, 6, 6, 142, 96, 10, "#f8e070", INK, 3);
		for (let k = 0; k < 2; k++) {
			const x = 46 + k * 50;
			poly(ctx, dir > 0 ? [[x - 14, 22], [x + 18, 54], [x - 14, 86], [x - 2, 86], [x + 30, 54], [x - 2, 22]] : [[x + 30, 22], [x - 2, 54], [x + 30, 86], [x + 18, 86], [x - 14, 54], [x + 18, 22]], "#3a2a1a");
		}
	};
	make("sign_r", 154, 222, (ctx) => arrowSign(ctx, 1));
	make("sign_l", 154, 222, (ctx) => arrowSign(ctx, -1));
	make("billboard", 300, 230, (ctx) => {
		R(ctx, 60, 130, 16, 96, 3, "#8a6a4a", INK, 2.5); R(ctx, 224, 130, 16, 96, 3, "#8a6a4a", INK, 2.5);
		R(ctx, 6, 6, 288, 136, 10, "#f6eccc", INK, 4);
		R(ctx, 18, 18, 264, 112, 6, null, "#d8403a", 4);
		ctx.font = "bold 46px IPAGothic"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
		ctx.fillStyle = "#d8403a"; ctx.fillText("コインを", 150, 52); ctx.fillStyle = "#3a6aa8"; ctx.fillText("ひろおう!", 150, 102);
	});
	make("gate", 1000, 300, (ctx) => {
		R(ctx, 20, 60, 40, 236, 4, "#8a8a92", INK, 3); R(ctx, 940, 60, 40, 236, 4, "#8a8a92", INK, 3);
		R(ctx, 0, 20, 1000, 90, 10, "#f6eccc", INK, 4);
		for (let k = 0; k < 20; k++) R(ctx, k * 50, 92, 25, 14, 0, k % 2 ? "#2a2a2e" : "#f8f8f8");
		ctx.font = "bold 64px IPAGothic"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#d8403a"; ctx.fillText("START", 500, 58);
	});

	// ---- エフェクト ----
	make("spark", 48, 48, (ctx) => {
		const gr = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
		gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.35, "#fff2b0"); gr.addColorStop(1, "rgba(255,214,90,0)");
		ctx.fillStyle = gr;
		ctx.beginPath();
		for (let k = 0; k < 8; k++) { const r = k % 2 === 0 ? 24 : 5, a = k * Math.PI / 4 - Math.PI / 2; ctx.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r); }
		ctx.closePath(); ctx.fill();
	}, { crop: false, plain: true });
	make("dust", 60, 40, (ctx) => { E(ctx, 30, 20, 28, 18, "rgba(200,180,140,0.7)"); }, { crop: false, plain: true });
	// ---- ロゴ ----
	make("logo", 1160, 250, (ctx, w) => {
		ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
		ctx.font = "bold 42px IPAGothic";
		ctx.lineWidth = 10; ctx.strokeStyle = "#3b2616"; ctx.strokeText("コインを ひろって ひた走れ!", w / 2, 44);
		ctx.fillStyle = "#fff6e0"; ctx.fillText("コインを ひろって ひた走れ!", w / 2, 44);
		ctx.font = "bold 130px IPAGothic";
		ctx.lineWidth = 30; ctx.strokeStyle = "#fff6e0"; ctx.strokeText("ひろってドライブ", w / 2, 160);
		ctx.lineWidth = 12; ctx.strokeStyle = "#8a2a1a"; ctx.strokeText("ひろってドライブ", w / 2, 160);
		const g = ctx.createLinearGradient(0, 100, 0, 220);
		g.addColorStop(0, "#ffd860"); g.addColorStop(1, "#e8603a");
		ctx.fillStyle = g; ctx.fillText("ひろってドライブ", w / 2, 160);
	}, { crop: false, plain: true });
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
