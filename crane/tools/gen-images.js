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

		// ---- 景品(カプセル) ----
		// つやのある球。half: "top" / "bottom" / undefined(まるごと)
		const capsule = (ctx, cx, cy, R, gold, half) => {
			ctx.save();
			if (half) {
				ctx.beginPath();
				if (half === "top") ctx.rect(cx - R - 4, cy - R - 4, R * 2 + 8, R + 4);
				else ctx.rect(cx - R - 4, cy, R * 2 + 8, R + 4);
				ctx.clip();
			}
			const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
			if (gold) {
				g.addColorStop(0, "#fffbd0");
				g.addColorStop(0.35, "#ffd23a");
				g.addColorStop(0.8, "#d89a00");
				g.addColorStop(1, "#8a5a00");
			} else {
				g.addColorStop(0, "#8a8a9a");
				g.addColorStop(0.3, "#3a3a46");
				g.addColorStop(0.8, "#121218");
				g.addColorStop(1, "#000000");
			}
			ellipse(ctx, cx, cy, R, R, 0, g, gold ? "#6a4000" : "#000000", 3);
			// 合わせ目
			ctx.fillStyle = gold ? "#b07a00" : "#2a2a34";
			ctx.fillRect(cx - R, cy - 3, R * 2, 6);
			ctx.fillStyle = gold ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.18)";
			ctx.fillRect(cx - R, cy - 3, R * 2, 2);
			// 光
			ellipse(ctx, cx - R * 0.38, cy - R * 0.45, R * 0.28, R * 0.16, -0.6, "rgba(255,255,255,0.85)");
			ellipse(ctx, cx + R * 0.45, cy + R * 0.5, R * 0.1, R * 0.06, -0.6, "rgba(255,255,255,0.4)");
			ctx.restore();
		};
		make("p_black", 80, 80, (ctx) => capsule(ctx, 40, 40, 36, false));
		make("p_gold", 80, 80, (ctx) => capsule(ctx, 40, 40, 36, true));
		[["black", false], ["gold", true]].forEach((c) => {
			make("cap_" + c[0] + "_top", 120, 64, (ctx) => capsule(ctx, 60, 62, 56, c[1], "top"));
			make("cap_" + c[0] + "_bottom", 120, 64, (ctx) => capsule(ctx, 60, 2, 56, c[1], "bottom"));
		});
		// 三角くじ(閉じている)
		make("kuji", 170, 150, (ctx) => {
			ctx.beginPath();
			ctx.moveTo(85, 8); ctx.lineTo(162, 142); ctx.lineTo(8, 142); ctx.closePath();
			const g = ctx.createLinearGradient(0, 8, 0, 142);
			g.addColorStop(0, "#ff6a8a");
			g.addColorStop(1, "#e8205a");
			ctx.fillStyle = g;
			ctx.fill();
			ctx.lineJoin = "round";
			ctx.lineWidth = 5;
			ctx.strokeStyle = "#ffffff";
			ctx.stroke();
			// 折り目と、ミシン目
			ctx.strokeStyle = "rgba(255,255,255,0.7)";
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.moveTo(85, 8); ctx.lineTo(85, 142); ctx.stroke();
			ctx.setLineDash([6, 5]);
			ctx.beginPath(); ctx.moveTo(30, 104); ctx.lineTo(140, 104); ctx.stroke();
			ctx.setLineDash([]);
			text(ctx, "くじ", 85, 82, 30, "#ffffff", "#a0103a", 7);
		});
		// 三角くじ(開いた紙)
		make("kuji_open", 260, 170, (ctx, w, h) => {
			roundRect(ctx, 6, 6, w - 12, h - 12, 10, "#fffdf4", "#e8205a", 6);
			ctx.strokeStyle = "rgba(232,32,90,0.35)";
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 5]);
			ctx.strokeRect(18, 18, w - 36, h - 36);
			ctx.setLineDash([]);
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
