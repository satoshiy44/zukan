// 画像アセット生成スクリプト: Chromium の canvas で描画して image/ 以下に PNG を書き出す
// ぬいぐるみの絵は crane/image のものを使う
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");
const PLUSH = path.join(__dirname, "..", "..", "crane", "image");
// 進化の順番(レベル1〜9)
const LEVELS = ["p_hiyoko", "p_buta", "p_penguin", "p_neko", "p_inu", "p_kuma", "p_panda", "p_unicorn", "p_gold"];

function drawAll(srcs) {
	return (async () => {
		const imgs = {};
		await Promise.all(Object.entries(srcs).filter((e) => typeof e[1] === "string").map(([k, s]) => new Promise((ok) => {
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
			out[name] = c.toDataURL("image/png");
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

		// ---- 背景(パステルのおへや) ----
		make("bg", 1280, 720, (ctx, w, h) => {
			const g = ctx.createLinearGradient(0, 0, 0, h);
			g.addColorStop(0, "#ffe6f0");
			g.addColorStop(1, "#e8e0ff");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, w, h);
			// 水玉
			for (let y = 20; y < h; y += 56) {
				for (let x = 20 + ((y / 56) % 2) * 28; x < w; x += 56) ellipse(ctx, x, y, 7, 7, 0, "rgba(255,255,255,0.55)");
			}
			// 盤面の台
			roundRect(ctx, 42, 62, 636, 636, 34, "#ffffff", "#ff9ac0", 8);
			roundRect(ctx, 58, 78, 604, 604, 24, "#fff4f8");
			// 右のパネル
			roundRect(ctx, 712, 62, 540, 636, 34, "rgba(255,255,255,0.85)", "#b8a8ff", 6);
		});
		// マス
		make("cell", 112, 112, (ctx, w, h) => {
			roundRect(ctx, 3, 3, w - 6, h - 6, 18, "#ffe4ef", "#ffc0d8", 3);
			ellipse(ctx, w / 2, h / 2, 10, 10, 0, "rgba(255,255,255,0.8)");
		});
		// おけるマスの光
		make("cell_hi", 112, 112, (ctx, w, h) => {
			roundRect(ctx, 3, 3, w - 6, h - 6, 18, "rgba(255,240,120,0.55)", "#ffb400", 5);
		});
		// ---- 駒(ぬいぐるみ + レベルの色の丸) ----
		const levelColors = ["#fff3a8", "#ffd0e0", "#cfe0ff", "#ffe0c0", "#d8f0ff", "#ead0b0", "#e8e8e8", "#f0d8ff", "#fff0a0"];
		const ringColors = ["#e8c800", "#ff7aa8", "#4a7ad8", "#ff9a3a", "#3a9ae0", "#a0642a", "#555555", "#b060ff", "#e0a000"];
		srcs.levels.forEach((_, i) => {
			make("lv" + (i + 1), 104, 104, (ctx, w, h) => {
				ellipse(ctx, w / 2, h / 2, 49, 49, 0, levelColors[i], ringColors[i], 5);
				const im = imgs["lv" + i];
				const s = Math.min(84 / im.width, 84 / im.height);
				ctx.drawImage(im, w / 2 - im.width * s / 2, h / 2 - im.height * s / 2 + 2, im.width * s, im.height * s);
				// 右下にレベルの数字
				ellipse(ctx, 84, 84, 16, 16, 0, ringColors[i], "#ffffff", 3);
				text(ctx, String(i + 1), 84, 86, 22, "#ffffff");
			});
		});
		// なんでも(虹色の星)
		make("wild", 104, 104, (ctx, w, h) => {
			const g = ctx.createLinearGradient(0, 0, w, h);
			["#ff5a8a", "#ffb43a", "#fff36a", "#5af08a", "#5ad0ff", "#b07aff"].forEach((c, i) => g.addColorStop(i / 5, c));
			ellipse(ctx, w / 2, h / 2, 49, 49, 0, g, "#ffffff", 5);
			ctx.fillStyle = "#ffffff";
			ctx.beginPath();
			for (let i = 0; i < 10; i++) {
				const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 === 0 ? 36 : 15;
				ctx.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
			}
			ctx.closePath();
			ctx.fill();
			ctx.lineWidth = 3;
			ctx.strokeStyle = "#ff7aa8";
			ctx.stroke();
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
			roundRect(ctx, w / 2 - 250, 6, 500, 62, 31, "#8a6aff", "#ffffff", 6);
			text(ctx, "3つそろえて しんか！", w / 2, 38, 40, "#ffffff", "#3a1a7a", 8);
			const chars = "ぬいぐるみ合体";
			const colors = ["#ff6aa0", "#ffb43a", "#5ad0ff", "#7ad04a", "#b07aff"];
			for (let i = 0; i < chars.length; i++) {
				const x = 210 + i * 125, y = 162 + (i % 2 === 0 ? 8 : -8);
				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(i % 2 === 0 ? -0.07 : 0.07);
				ctx.font = "bold " + (i < 5 ? 118 : 132) + "px IPAGothic";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.lineJoin = "round";
				ctx.lineWidth = 30;
				ctx.strokeStyle = "#ffffff";
				ctx.strokeText(chars[i], 0, 0);
				ctx.lineWidth = 13;
				ctx.strokeStyle = "#3a1a5a";
				ctx.strokeText(chars[i], 0, 0);
				let fill;
				if (i < 5) {
					fill = colors[i];
				} else {
					fill = ctx.createLinearGradient(0, -60, 0, 60);
					fill.addColorStop(0, "#fff8a0");
					fill.addColorStop(0.5, "#ffd23a");
					fill.addColorStop(1, "#ff8a1a");
				}
				ctx.fillStyle = fill;
				ctx.fillText(chars[i], 0, 0);
				ctx.restore();
			}
			// 両はしにぬいぐるみ
			const side = (im, x, y, size) => {
				const s = size / Math.max(im.width, im.height);
				ctx.drawImage(im, x, y, im.width * s, im.height * s);
			};
			side(imgs.lv0, 20, 110, 110);
			side(imgs.lv8, 1036, 104, 118);
		});
		return out;
	})();
}

(async () => {
	const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
	const srcs = { levels: LEVELS };
	LEVELS.forEach((id, i) => { srcs["lv" + i] = dataUrl(path.join(PLUSH, id + ".png")); });
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(drawAll, srcs);
	await browser.close();
	fs.mkdirSync(OUT, { recursive: true });
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		fs.writeFileSync(path.join(OUT, name + ".png"), buf);
		console.log("wrote", name, buf.length);
	}
})();
