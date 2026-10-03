// 画像アセット生成スクリプト: Chromium の canvas で描画して image/ 以下に PNG を書き出す
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");
const TANUKI = path.join(__dirname, "..", "..", "game", "image");

function drawAll(srcs) {
	return (async () => {
		const imgs = {};
		await Promise.all(Object.entries(srcs).map(([k, s]) => new Promise((ok) => {
			const im = new Image();
			im.onload = () => { imgs[k] = im; ok(); };
			im.src = s;
		})));
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

		// ---- 背景(クレーンゲームの中) ----
		make("bg", 1280, 720, (ctx, w, h) => {
			// 外枠(ゲームセンターの機械)
			ctx.fillStyle = "#e8407a";
			ctx.fillRect(0, 0, w, h);
			// 中の奥のかべ
			const back = ctx.createLinearGradient(0, 0, 0, 640);
			back.addColorStop(0, "#3b2a7a");
			back.addColorStop(1, "#6a4ac0");
			ctx.fillStyle = back;
			ctx.fillRect(110, 0, 1060, 640);
			// 水玉もよう
			ctx.fillStyle = "rgba(255,255,255,0.07)";
			for (let y = 30; y < 640; y += 60) {
				for (let x = 130 + ((y / 60) % 2) * 30; x < 1170; x += 60) ellipse(ctx, x, y, 12, 12, 0, "rgba(255,255,255,0.07)");
			}
			// 左右の柱とネオン
			const pillar = (x) => {
				const g = ctx.createLinearGradient(x, 0, x + 110, 0);
				g.addColorStop(0, "#c2245e");
				g.addColorStop(0.5, "#ff6aa0");
				g.addColorStop(1, "#c2245e");
				ctx.fillStyle = g;
				ctx.fillRect(x, 0, 110, h);
				for (let y = 40; y < h; y += 46) {
					const c = ["#fff36a", "#6af0ff", "#ffffff"][Math.floor(y / 46) % 3];
					ellipse(ctx, x + 55, y, 9, 9, 0, c);
					ellipse(ctx, x + 55, y, 16, 16, 0, "rgba(255,255,255,0.18)");
				}
			};
			pillar(0);
			pillar(1170);
			// レール
			ctx.fillStyle = "#c9ced6";
			ctx.fillRect(110, 52, 1060, 16);
			ctx.fillStyle = "#7d8592";
			ctx.fillRect(110, 66, 1060, 5);
			// 床(景品が乗る台)
			const floor = ctx.createLinearGradient(0, 640, 0, h);
			floor.addColorStop(0, "#ffd84a");
			floor.addColorStop(1, "#d89a1a");
			ctx.fillStyle = floor;
			ctx.fillRect(110, 640, 1060, 80);
			ctx.fillStyle = "#ffeaa0";
			ctx.fillRect(110, 640, 1060, 6);
			// とりだし口(穴)
			const hole = ctx.createLinearGradient(0, 600, 0, h);
			hole.addColorStop(0, "#1a0f2a");
			hole.addColorStop(1, "#000000");
			ctx.fillStyle = hole;
			ctx.fillRect(116, 600, 186, 120);
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 6;
			ctx.setLineDash([18, 12]);
			ctx.strokeRect(119, 603, 180, 114);
			ctx.setLineDash([]);
		});

		// とりだし口の手前のふた(落ちた景品を隠す)
		make("chute_front", 200, 90, (ctx, w, h) => {
			const g = ctx.createLinearGradient(0, 0, 0, h);
			g.addColorStop(0, "#ff7aa8");
			g.addColorStop(1, "#c2245e");
			roundRect(ctx, 4, 4, w - 8, h - 8, 14, g, "#7a0a3a", 6);
			text(ctx, "とりだし口", w / 2, h / 2 + 2, 34, "#ffffff", "#7a0a3a", 9);
		});
		// 仕切りのアクリル板
		make("barrier", 16, 130, (ctx, w, h) => {
			ctx.fillStyle = "rgba(200,240,255,0.55)";
			ctx.fillRect(0, 0, w, h);
			ctx.fillStyle = "rgba(255,255,255,0.8)";
			ctx.fillRect(2, 0, 4, h);
			ctx.strokeStyle = "rgba(80,140,180,0.9)";
			ctx.lineWidth = 3;
			ctx.strokeRect(1, 1, w - 2, h - 2);
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

		// ---- 景品 ----
		// あめ
		make("p_candy", 72, 44, (ctx, w, h) => {
			const wrap = (x, dir) => {
				ctx.beginPath();
				ctx.moveTo(x, h / 2);
				ctx.lineTo(x + dir * 18, 6);
				ctx.lineTo(x + dir * 18, h - 6);
				ctx.closePath();
				ctx.fillStyle = "#ff9ac0";
				ctx.fill();
				ctx.lineWidth = 3;
				ctx.strokeStyle = "#b02a62";
				ctx.stroke();
			};
			wrap(22, -1);
			wrap(50, 1);
			ellipse(ctx, 36, 22, 18, 17, 0, "#ff5a8a", "#b02a62", 3);
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.arc(36, 22, 9, 0.5, 4);
			ctx.stroke();
		});
		// おかしの箱
		make("p_box", 90, 74, (ctx, w, h) => {
			const g = ctx.createLinearGradient(0, 0, 0, h);
			g.addColorStop(0, "#5ad0ff");
			g.addColorStop(1, "#1e88e5");
			roundRect(ctx, 3, 3, w - 6, h - 6, 8, g, "#0a3a7a", 5);
			ctx.fillStyle = "#ffe14a";
			ctx.fillRect(6, 40, w - 12, 14);
			text(ctx, "おかし", w / 2, 24, 24, "#ffffff", "#0a3a7a", 6);
			ellipse(ctx, 24, 62, 6, 6, 0, "#ff7a3a");
			ellipse(ctx, 66, 62, 6, 6, 0, "#ff7a3a");
		});
		// たぬきのぬいぐるみ
		make("p_plush", 150, 150, (ctx, w, h) => {
			ctx.drawImage(imgs.idle, 0, 0, 140, 146);
			// タグ
			roundRect(ctx, 100, 96, 30, 24, 4, "#ffffff", "#e8407a", 3);
			ctx.fillStyle = "#e8407a";
			ctx.font = "bold 14px IPAGothic";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("♥", 115, 109);
		});
		// 大きなくまのぬいぐるみ
		make("p_big", 156, 140, (ctx, w, h) => {
			const fur = "#c8844a", dark = "#6a3a14";
			ellipse(ctx, 34, 28, 22, 22, 0, fur, dark, 5);
			ellipse(ctx, 122, 28, 22, 22, 0, fur, dark, 5);
			ellipse(ctx, 34, 28, 11, 11, 0, "#f2c08a");
			ellipse(ctx, 122, 28, 11, 11, 0, "#f2c08a");
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
			// リボン
			ctx.fillStyle = "#e83a5a";
			ctx.beginPath();
			ctx.moveTo(78, 108); ctx.lineTo(54, 96); ctx.lineTo(54, 122); ctx.closePath();
			ctx.moveTo(78, 108); ctx.lineTo(102, 96); ctx.lineTo(102, 122); ctx.closePath();
			ctx.fill();
			ellipse(ctx, 78, 108, 8, 8, 0, "#ff6a8a", "#8a0a2a", 2);
		});
		// 金のたぬき
		make("p_gold", 100, 100, (ctx, w, h) => {
			ctx.drawImage(imgs.idle, 0, 0, 92, 96);
			ctx.globalCompositeOperation = "source-atop";
			const g = ctx.createLinearGradient(0, 0, w, h);
			g.addColorStop(0, "#fff27a");
			g.addColorStop(0.5, "#ffc400");
			g.addColorStop(1, "#c88a00");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
			// 元の絵の線を少し戻して、金色でも顔が見えるようにする
			ctx.globalCompositeOperation = "multiply";
			ctx.globalAlpha = 0.35;
			ctx.drawImage(imgs.idle, 0, 0, 92, 96);
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "destination-in";
			ctx.drawImage(imgs.idle, 0, 0, 92, 96);
			ctx.globalCompositeOperation = "source-over";
			ctx.fillStyle = "rgba(255,255,255,0.9)";
			ctx.beginPath();
			ctx.moveTo(18, 14); ctx.lineTo(21, 22); ctx.lineTo(29, 25); ctx.lineTo(21, 28);
			ctx.lineTo(18, 36); ctx.lineTo(15, 28); ctx.lineTo(7, 25); ctx.lineTo(15, 22);
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
	const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(drawAll, {
		idle: dataUrl(path.join(TANUKI, "tanuki_idle.png"))
	});
	await browser.close();
	fs.mkdirSync(OUT, { recursive: true });
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		fs.writeFileSync(path.join(OUT, name + ".png"), buf);
		console.log("wrote", name, buf.length);
	}
})();
