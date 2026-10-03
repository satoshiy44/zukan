// 画像アセット生成スクリプト: Chromium の canvas で描画して image/ 以下に PNG を書き出す
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");

function drawAll() {
	return (async () => {
		const out = {};
		const make = (name, w, h, fn) => {
			const c = document.createElement("canvas");
			c.width = w;
			c.height = h;
			fn(c.getContext("2d"), w, h);
			out[name] = (name.startsWith("p_") ? crop(c) : c).toDataURL("image/png");
		};
		// 景品は透明なふちを切り落として、絵の大きさ = 当たり判定にする
		const crop = (c) => {
			const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
			let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
			for (let y = 0; y < c.height; y++) {
				for (let x = 0; x < c.width; x++) {
					if (d[(y * c.width + x) * 4 + 3] > 40) {
						x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
					}
				}
			}
			const o = document.createElement("canvas");
			o.width = x1 - x0 + 1;
			o.height = y1 - y0 + 1;
			o.getContext("2d").drawImage(c, -x0, -y0);
			return o;
		};
		const ellipse = (ctx, x, y, rx, ry, rot, fill, stroke, lw) => {
			ctx.beginPath();
			ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
			if (fill) { ctx.fillStyle = fill; ctx.fill(); }
			if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
		};
		const roundRect = (ctx, x, y, w, h, r, fill, stroke, lw) => {
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, r);
			if (fill) { ctx.fillStyle = fill; ctx.fill(); }
			if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
		};
		const text = (ctx, t, x, y, size, fill, stroke, lw) => {
			ctx.font = "bold " + size + "px IPAGothic";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.lineJoin = "round";
			if (stroke) { ctx.lineWidth = lw || size * 0.25; ctx.strokeStyle = stroke; ctx.strokeText(t, x, y); }
			ctx.fillStyle = fill;
			ctx.fillText(t, x, y);
		};
		let seed = 77;
		const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

		// ---- 背景(クレーンゲームの中を奥行きつきで描く) ----
		// src/main.ts の project() と同じ計算で、3Dの点を画面の点にする
		const F = 520, Z0 = 420, CAM_H = 430, HY = 117;
		const P = (x, y, z) => {
			const k = F / (z + Z0);
			return [640 + x * k, HY + (CAM_H - y) * k];
		};
		const quad = (ctx, pts, fill, stroke, lw) => {
			ctx.beginPath();
			pts.forEach((q, i) => {
				const v = P(q[0], q[1], q[2]);
				if (i === 0) ctx.moveTo(v[0], v[1]); else ctx.lineTo(v[0], v[1]);
			});
			ctx.closePath();
			if (fill) { ctx.fillStyle = fill; ctx.fill(); }
			if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
		};
		const XL = -400, XR = 400, ZB = 500, TOP = 900, CHX = -230, CHZ = 170, BH = 80;
		make("bg", 1280, 720, (ctx, w, h) => {
			// 外枠(ゲームセンターの機械)
			const cab = ctx.createLinearGradient(0, 0, w, 0);
			cab.addColorStop(0, "#c2245e");
			cab.addColorStop(0.5, "#ff6aa0");
			cab.addColorStop(1, "#c2245e");
			ctx.fillStyle = cab;
			ctx.fillRect(0, 0, w, h);
			// 奥のかべ
			const back = ctx.createLinearGradient(0, 40, 0, 380);
			back.addColorStop(0, "#3b2a7a");
			back.addColorStop(1, "#6a4ac0");
			quad(ctx, [[XL, 0, ZB], [XR, 0, ZB], [XR, TOP, ZB], [XL, TOP, ZB]], back);
			for (let y = 40; y < TOP; y += 70) {
				for (let x = XL + 40 + ((y / 70) % 2) * 35; x < XR; x += 70) {
					const v = P(x, y, ZB);
					ellipse(ctx, v[0], v[1], 7, 7, 0, "rgba(255,255,255,0.08)");
				}
			}
			// 左右のかべ
			quad(ctx, [[XL, 0, 0], [XL, 0, ZB], [XL, TOP, ZB], [XL, TOP, 0]], "#7a5ad0");
			quad(ctx, [[XR, 0, 0], [XR, 0, ZB], [XR, TOP, ZB], [XR, TOP, 0]], "#7a5ad0");
			// かべの光
			for (let z = 40; z < ZB; z += 70) {
				[XL, XR].forEach((x) => {
					const v = P(x, 330, z);
					ellipse(ctx, v[0], v[1], 9 * F / (z + Z0), 9 * F / (z + Z0), 0, ["#fff36a", "#6af0ff", "#ffffff"][Math.floor(z / 70) % 3]);
				});
			}
			// 床(景品が乗る台)。奥行きが分かるように格子を描く
			const floor = ctx.createLinearGradient(0, 380, 0, 650);
			floor.addColorStop(0, "#e8b830");
			floor.addColorStop(1, "#ffd84a");
			quad(ctx, [[XL, 0, 0], [XR, 0, 0], [XR, 0, ZB], [XL, 0, ZB]], floor);
			ctx.strokeStyle = "rgba(160,100,0,0.35)";
			ctx.lineWidth = 2;
			for (let x = XL; x <= XR; x += 100) {
				const a = P(x, 0, 0), b = P(x, 0, ZB);
				ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
			}
			for (let z = 0; z <= ZB; z += 100) {
				const a = P(XL, 0, z), b = P(XR, 0, z);
				ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
			}
			// とりだし口の穴
			quad(ctx, [[XL, 0, 0], [CHX, 0, 0], [CHX, 0, CHZ], [XL, 0, CHZ]], "#120a20");
			// 仕切りのアクリル板(奥と右)
			quad(ctx, [[XL, 0, CHZ], [CHX, 0, CHZ], [CHX, BH, CHZ], [XL, BH, CHZ]], "rgba(200,240,255,0.45)", "rgba(255,255,255,0.9)", 3);
			quad(ctx, [[CHX, 0, 0], [CHX, 0, CHZ], [CHX, BH, CHZ], [CHX, BH, 0]], "rgba(200,240,255,0.45)", "rgba(255,255,255,0.9)", 3);
			// 天井のレール
			ctx.fillStyle = "#c9ced6";
			ctx.fillRect(0, 0, w, 14);
		});
		// 手前のパネル(とりだし口に落ちた景品を隠す)
		make("front_panel", 1280, 74, (ctx, w, h) => {
			const g = ctx.createLinearGradient(0, 0, 0, h);
			g.addColorStop(0, "#ff7aa8");
			g.addColorStop(1, "#c2245e");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
			ctx.fillStyle = "#ffeaa0";
			ctx.fillRect(0, 0, w, 5);
			for (let x = 30; x < w; x += 50) ellipse(ctx, x, 60, 6, 6, 0, ["#fff36a", "#6af0ff", "#ffffff"][Math.floor(x / 50) % 3]);
			roundRect(ctx, 196, 8, 210, 46, 12, "#5a0a3a", "#ffffff", 4);
			text(ctx, "とりだし口", 301, 32, 32, "#ffffff", "#5a0a3a", 6);
		});
		// アームの下りる場所の目印
		make("marker", 120, 48, (ctx, w, h) => {
			ellipse(ctx, w / 2, h / 2, 54, 18, 0, "rgba(255,40,120,0.18)", "rgba(255,40,120,0.95)", 5);
			ellipse(ctx, w / 2, h / 2, 10, 4, 0, "rgba(255,40,120,0.95)");
		});

		// ---- クレーン ----
		make("claw_head", 110, 70, (ctx, w, h) => {
			const g = ctx.createLinearGradient(0, 0, w, 0);
			g.addColorStop(0, "#8a93a0");
			g.addColorStop(0.45, "#f2f5f8");
			g.addColorStop(1, "#7a828e");
			roundRect(ctx, 8, 6, w - 16, h - 14, 16, g, "#3a404a", 5);
			ellipse(ctx, w / 2, 32, 16, 16, 0, "#ff4a7a", "#3a404a", 4);
			ellipse(ctx, w / 2 - 5, 27, 5, 5, 0, "rgba(255,255,255,0.8)");
		});
		make("claw_arm", 40, 110, (ctx, w, h) => {
			// 上が支点。左のアーム(先が内側=右へ曲がる)
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			ctx.strokeStyle = "#3a404a";
			ctx.lineWidth = 16;
			ctx.beginPath();
			ctx.moveTo(14, 8);
			ctx.lineTo(10, 74);
			ctx.quadraticCurveTo(10, 100, 34, 100);
			ctx.stroke();
			ctx.strokeStyle = "#cfd5dd";
			ctx.lineWidth = 9;
			ctx.stroke();
			ellipse(ctx, 14, 8, 8, 8, 0, "#6a7280", "#3a404a", 3);
		});

		// ---- 景品(大小いろいろなぬいぐるみ) ----
		const face = (ctx, x, y, sc, cheek) => {
			ellipse(ctx, x - 14 * sc, y, 5 * sc, 6 * sc, 0, "#2a1408");
			ellipse(ctx, x + 14 * sc, y, 5 * sc, 6 * sc, 0, "#2a1408");
			ellipse(ctx, x - 15.5 * sc, y - 2 * sc, 1.8 * sc, 1.8 * sc, 0, "#ffffff");
			ellipse(ctx, x + 12.5 * sc, y - 2 * sc, 1.8 * sc, 1.8 * sc, 0, "#ffffff");
			ellipse(ctx, x - 24 * sc, y + 10 * sc, 7 * sc, 4.5 * sc, 0, cheek);
			ellipse(ctx, x + 24 * sc, y + 10 * sc, 7 * sc, 4.5 * sc, 0, cheek);
			ctx.strokeStyle = "#2a1408";
			ctx.lineWidth = 2.5 * sc;
			ctx.beginPath();
			ctx.arc(x - 4 * sc, y + 8 * sc, 4 * sc, 0.2, Math.PI - 0.2);
			ctx.arc(x + 4 * sc, y + 8 * sc, 4 * sc, 0.2, Math.PI - 0.2);
			ctx.stroke();
		};
		const drawHiyoko = (ctx) => {
			ellipse(ctx, 45, 52, 36, 33, 0, "#ffe14a", "#c89a00", 4);
			ellipse(ctx, 20, 56, 12, 8, -0.6, "#ffd000", "#c89a00", 3);
			ellipse(ctx, 70, 56, 12, 8, 0.6, "#ffd000", "#c89a00", 3);
			ctx.fillStyle = "#ffe14a";
			ctx.beginPath(); ctx.moveTo(40, 22); ctx.lineTo(45, 8); ctx.lineTo(50, 22); ctx.fill();
			face(ctx, 45, 44, 0.8, "rgba(255,120,120,0.55)");
			ctx.fillStyle = "#ff8a1a";
			ctx.beginPath(); ctx.moveTo(39, 52); ctx.lineTo(51, 52); ctx.lineTo(45, 60); ctx.closePath(); ctx.fill();
			ellipse(ctx, 33, 85, 9, 4, 0, "#ff8a1a");
			ellipse(ctx, 57, 85, 9, 4, 0, "#ff8a1a");
		};
		const drawButa = (ctx) => {
			const pink = "#ffb0c8", line = "#c8507a";
			ctx.fillStyle = pink;
			ctx.strokeStyle = line;
			ctx.lineWidth = 4;
			ctx.beginPath(); ctx.moveTo(18, 30); ctx.lineTo(24, 8); ctx.lineTo(42, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(82, 30); ctx.lineTo(76, 8); ctx.lineTo(58, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
			ellipse(ctx, 50, 54, 44, 38, 0, pink, line, 4);
			face(ctx, 50, 46, 0.85, "rgba(255,80,120,0.5)");
			ellipse(ctx, 50, 64, 14, 9, 0, "#ff8aaa", line, 3);
			ellipse(ctx, 45, 64, 2.5, 3.5, 0, line);
			ellipse(ctx, 55, 64, 2.5, 3.5, 0, line);
		};
		const drawUsagi = (ctx) => {
			const pink = "#ffc8dc", line = "#d0507a";
			ellipse(ctx, 36, 38, 13, 34, -0.15, "#ffffff", line, 4);
			ellipse(ctx, 74, 38, 13, 34, 0.15, "#ffffff", line, 4);
			ellipse(ctx, 36, 40, 6, 24, -0.15, pink);
			ellipse(ctx, 74, 40, 6, 24, 0.15, pink);
			ellipse(ctx, 55, 112, 38, 26, 0, "#ffffff", line, 4);
			ellipse(ctx, 55, 82, 42, 34, 0, "#ffffff", line, 4);
			face(ctx, 55, 80, 0.9, "rgba(255,110,150,0.6)");
			ctx.fillStyle = "#ff4a8a";
			ctx.beginPath(); ctx.moveTo(55, 52); ctx.lineTo(40, 42); ctx.lineTo(40, 62); ctx.closePath();
			ctx.moveTo(55, 52); ctx.lineTo(70, 42); ctx.lineTo(70, 62); ctx.closePath(); ctx.fill();
			ellipse(ctx, 55, 52, 6, 6, 0, "#ff7aa8");
		};
		const drawNeko = (ctx) => {
			const line = "#8a4a1a", body = "#ffb45a";
			ctx.fillStyle = body;
			ctx.strokeStyle = line;
			ctx.lineWidth = 4;
			ctx.beginPath(); ctx.moveTo(18, 40); ctx.lineTo(26, 6); ctx.lineTo(50, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(102, 40); ctx.lineTo(94, 6); ctx.lineTo(70, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
			ellipse(ctx, 60, 92, 40, 22, 0, body, line, 4);
			ellipse(ctx, 60, 54, 48, 38, 0, body, line, 4);
			ctx.fillStyle = "rgba(200,100,20,0.6)";
			ctx.fillRect(54, 17, 4, 14); ctx.fillRect(62, 17, 4, 14);
			ellipse(ctx, 60, 70, 20, 12, 0, "#fff3e0");
			face(ctx, 60, 56, 0.9, "rgba(255,110,110,0.55)");
			ctx.strokeStyle = line;
			ctx.lineWidth = 2;
			[[-1, 0], [-1, 6], [1, 0], [1, 6]].forEach((q) => {
				ctx.beginPath(); ctx.moveTo(60 + q[0] * 26, 66 + q[1]); ctx.lineTo(60 + q[0] * 46, 62 + q[1] * 1.6); ctx.stroke();
			});
			ellipse(ctx, 40, 108, 11, 6, 0, "#fff3e0", line, 3);
			ellipse(ctx, 80, 108, 11, 6, 0, "#fff3e0", line, 3);
		};
		const drawInu = (ctx) => {
			const line = "#5a3a1a", body = "#fff4e0";
			ellipse(ctx, 22, 50, 16, 30, 0.3, "#b07a4a", line, 4);
			ellipse(ctx, 98, 50, 16, 30, -0.3, "#b07a4a", line, 4);
			ellipse(ctx, 60, 94, 38, 22, 0, body, line, 4);
			ellipse(ctx, 60, 54, 46, 40, 0, body, line, 4);
			ellipse(ctx, 82, 44, 14, 12, 0, "#e0b080");
			face(ctx, 60, 54, 0.9, "rgba(255,110,110,0.5)");
			ellipse(ctx, 60, 64, 7, 5, 0, "#2a1408");
			ctx.fillStyle = "#3a8aff";
			ctx.fillRect(28, 84, 64, 9);
			ellipse(ctx, 60, 98, 7, 7, 0, "#ffd23a", "#a07a00", 2);
		};
		const drawKuma = (ctx, fur, dark, inner) => {
			ellipse(ctx, 34, 28, 22, 22, 0, fur, dark, 5);
			ellipse(ctx, 122, 28, 22, 22, 0, fur, dark, 5);
			ellipse(ctx, 34, 28, 11, 11, 0, inner);
			ellipse(ctx, 122, 28, 11, 11, 0, inner);
			ellipse(ctx, 78, 96, 66, 42, 0, fur, dark, 5);
			ellipse(ctx, 78, 62, 56, 48, 0, fur, dark, 5);
			ellipse(ctx, 78, 78, 24, 17, 0, "#f2d0a8", dark, 3);
			ellipse(ctx, 78, 72, 8, 6, 0, "#2a1408");
			ellipse(ctx, 56, 54, 7, 8, 0, "#2a1408");
			ellipse(ctx, 100, 54, 7, 8, 0, "#2a1408");
			ellipse(ctx, 54, 51, 2.5, 2.5, 0, "#ffffff");
			ellipse(ctx, 98, 51, 2.5, 2.5, 0, "#ffffff");
			ellipse(ctx, 44, 74, 9, 6, 0, "rgba(255,120,140,0.5)");
			ellipse(ctx, 112, 74, 9, 6, 0, "rgba(255,120,140,0.5)");
			ctx.fillStyle = "#e83a5a";
			ctx.beginPath();
			ctx.moveTo(78, 108); ctx.lineTo(54, 96); ctx.lineTo(54, 122); ctx.closePath();
			ctx.moveTo(78, 108); ctx.lineTo(102, 96); ctx.lineTo(102, 122); ctx.closePath();
			ctx.fill();
			ellipse(ctx, 78, 108, 8, 8, 0, "#ff6a8a", "#8a0a2a", 2);
		};
		const drawPanda = (ctx) => {
			const line = "#1a1a1a";
			ellipse(ctx, 34, 28, 22, 22, 0, "#2a2a2a", line, 5);
			ellipse(ctx, 122, 28, 22, 22, 0, "#2a2a2a", line, 5);
			ellipse(ctx, 78, 98, 66, 40, 0, "#ffffff", line, 5);
			ellipse(ctx, 30, 104, 18, 24, 0.4, "#2a2a2a");
			ellipse(ctx, 126, 104, 18, 24, -0.4, "#2a2a2a");
			ellipse(ctx, 78, 62, 58, 48, 0, "#ffffff", line, 5);
			ellipse(ctx, 56, 58, 14, 18, -0.5, "#2a2a2a");
			ellipse(ctx, 100, 58, 14, 18, 0.5, "#2a2a2a");
			ellipse(ctx, 58, 56, 4.5, 5, 0, "#ffffff");
			ellipse(ctx, 98, 56, 4.5, 5, 0, "#ffffff");
			ellipse(ctx, 78, 78, 9, 6, 0, "#2a2a2a");
			ellipse(ctx, 46, 82, 9, 6, 0, "rgba(255,120,140,0.6)");
			ellipse(ctx, 110, 82, 9, 6, 0, "rgba(255,120,140,0.6)");
			ctx.strokeStyle = line;
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(72, 86, 6, 0.2, Math.PI - 0.2); ctx.arc(84, 86, 6, 0.2, Math.PI - 0.2); ctx.stroke();
		};
		const sized = (name, w, h, sc, fn) => make(name, Math.ceil(w * sc) + 4, Math.ceil(h * sc) + 4, (ctx) => {
			ctx.translate(2, 2);
			ctx.scale(sc, sc);
			fn(ctx);
		});
		sized("p_hiyoko", 90, 90, 0.8, drawHiyoko);
		sized("p_buta", 100, 96, 0.78, drawButa);
		sized("p_usagi", 110, 140, 0.88, drawUsagi);
		sized("p_neko", 120, 116, 0.9, drawNeko);
		sized("p_inu", 120, 120, 0.9, drawInu);
		sized("p_kuma", 156, 140, 1.0, (ctx) => drawKuma(ctx, "#c8844a", "#6a3a14", "#f2c08a"));
		sized("p_panda", 156, 140, 1.4, drawPanda);
		sized("p_gold", 156, 140, 0.72, (ctx) => {
			const g = ctx.createLinearGradient(0, 0, 156, 140);
			g.addColorStop(0, "#fff27a");
			g.addColorStop(0.5, "#ffc400");
			g.addColorStop(1, "#d89000");
			drawKuma(ctx, g, "#8a5a00", "#fff6c0");
			ctx.fillStyle = "rgba(255,255,255,0.95)";
			ctx.beginPath();
			ctx.moveTo(30, 60); ctx.lineTo(34, 72); ctx.lineTo(46, 76); ctx.lineTo(34, 80);
			ctx.lineTo(30, 92); ctx.lineTo(26, 80); ctx.lineTo(14, 76); ctx.lineTo(26, 72);
			ctx.closePath();
			ctx.fill();
		});
		// キラキラ
		make("sparkle", 40, 40, (ctx) => {
			ctx.fillStyle = "#fffbd0";
			ctx.beginPath();
			for (let i = 0; i < 8; i++) {
				const a = i * Math.PI / 4, r = i % 2 === 0 ? 19 : 5;
				ctx.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r);
			}
			ctx.closePath();
			ctx.fill();
		});

		// ---- タイトルロゴ ----
		make("logo", 1160, 250, (ctx, w) => {
			text(ctx, "何回やってもタダ！", w / 2, 50, 56, "#ffffff", "#7a0a3a", 14);
			const g = ctx.createLinearGradient(0, 100, 0, 220);
			g.addColorStop(0, "#fff8a0");
			g.addColorStop(0.5, "#ffd23a");
			g.addColorStop(1, "#ff8a1a");
			ctx.font = "bold 128px IPAGothic";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.lineJoin = "round";
			ctx.lineWidth = 30;
			ctx.strokeStyle = "#ffffff";
			ctx.strokeText("クレーン取り放題", w / 2, 160);
			ctx.lineWidth = 14;
			ctx.strokeStyle = "#c2245e";
			ctx.strokeText("クレーン取り放題", w / 2, 160);
			ctx.fillStyle = g;
			ctx.fillText("クレーン取り放題", w / 2, 160);
		});
		void rnd;
		return out;
	})();
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(drawAll, {});
	await browser.close();
	fs.mkdirSync(OUT, { recursive: true });
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		fs.writeFileSync(path.join(OUT, name + ".png"), buf);
		console.log("wrote", name, buf.length);
	}
})();
