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
			out[name] = c.toDataURL("image/png");
		};
		const ellipse = (ctx, x, y, rx, ry, rot, fill, stroke, lw) => {
			ctx.beginPath();
			ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
			if (fill) { ctx.fillStyle = fill; ctx.fill(); }
			if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
		};
		let seed = 2024;
		const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

		// ---- 背景(夕暮れの竹林) ----
		make("bg", 1280, 720, (ctx, w, h) => {
			const sky = ctx.createLinearGradient(0, 0, 0, h);
			sky.addColorStop(0, "#2a1c4a");
			sky.addColorStop(0.5, "#7a3a5a");
			sky.addColorStop(0.8, "#d8744a");
			sky.addColorStop(1, "#3a2a1a");
			ctx.fillStyle = sky;
			ctx.fillRect(0, 0, w, h);
			// 大きな月
			const moon = ctx.createRadialGradient(640, 300, 40, 640, 300, 260);
			moon.addColorStop(0, "rgba(255,240,200,0.55)");
			moon.addColorStop(1, "rgba(255,240,200,0)");
			ctx.fillStyle = moon;
			ctx.fillRect(0, 0, w, h);
			ellipse(ctx, 640, 300, 210, 210, 0, "rgba(255,236,190,0.35)");
			// 竹(奥と手前)
			const bamboo = (x, wdt, col, dark) => {
				ctx.fillStyle = col;
				ctx.fillRect(x, 0, wdt, h);
				for (let y = 40 + rnd() * 60; y < h; y += 90 + rnd() * 40) {
					ctx.fillStyle = dark;
					ctx.fillRect(x - 2, y, wdt + 4, 6);
				}
				ctx.fillStyle = "rgba(255,255,255,0.12)";
				ctx.fillRect(x + wdt * 0.2, 0, wdt * 0.15, h);
			};
			for (let i = 0; i < 14; i++) {
				const x = rnd() * 1280;
				if (x > 380 && x < 900) continue;
				bamboo(x, 18 + rnd() * 10, "#3a5a3a", "#2a402a");
			}
			for (const x of [40, 150, 1060, 1180]) bamboo(x, 40, "#4f7f3f", "#33552a");
			// 笹の葉
			for (let i = 0; i < 40; i++) {
				const x = rnd() < 0.5 ? rnd() * 330 : 950 + rnd() * 330, y = rnd() * 600;
				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(rnd() * 6);
				ellipse(ctx, 0, 0, 34, 7, 0, rnd() < 0.5 ? "#5a8a3a" : "#3f6f2f");
				ctx.restore();
			}
			// 地面(板の間)
			const floor = ctx.createLinearGradient(0, 600, 0, h);
			floor.addColorStop(0, "#7a5230");
			floor.addColorStop(1, "#4a3018");
			ctx.fillStyle = floor;
			ctx.fillRect(0, 610, w, h - 610);
			ctx.strokeStyle = "rgba(0,0,0,0.25)";
			ctx.lineWidth = 2;
			for (let x = 0; x < w; x += 120) { ctx.beginPath(); ctx.moveTo(x, 610); ctx.lineTo(x - 40, h); ctx.stroke(); }
		});

		// ---- 丸太(切り口) ----
		const log = (ctx, s, boss) => {
			const c = s / 2, R = s * 0.47;
			ellipse(ctx, c, c, R, R, 0, boss ? "#5a2a1a" : "#7a4a24", "#2a1408", 6);
			ellipse(ctx, c, c, R * 0.9, R * 0.9, 0, boss ? "#c86a3a" : "#e0a868");
			ctx.strokeStyle = boss ? "rgba(90,20,10,0.5)" : "rgba(120,70,30,0.45)";
			for (let k = 1; k <= 6; k++) {
				ctx.lineWidth = 2 + (k % 2);
				ctx.beginPath();
				ctx.ellipse(c + Math.sin(k) * 3, c + Math.cos(k) * 2, R * 0.9 * k / 7, R * 0.88 * k / 7, 0, 0, Math.PI * 2);
				ctx.stroke();
			}
			// ひび
			ctx.strokeStyle = "rgba(60,30,10,0.5)";
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + R * 0.5, c - R * 0.3); ctx.lineTo(c + R * 0.8, c - R * 0.25); ctx.stroke();
			if (boss) {
				// 師匠の丸太: 的の印
				ctx.strokeStyle = "#fff";
				ctx.lineWidth = 6;
				ctx.beginPath(); ctx.arc(c, c, R * 0.35, 0, Math.PI * 2); ctx.stroke();
				ctx.fillStyle = "#fff";
				ctx.font = "bold " + Math.round(s * 0.2) + "px IPAGothic";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText("師", c, c + 2);
			}
		};
		make("log", 320, 320, (ctx, s) => log(ctx, s, false));
		make("log_boss", 320, 320, (ctx, s) => log(ctx, s, true));
		// 木くず
		make("chip", 20, 12, (ctx) => {
			ctx.fillStyle = "#c8915a";
			ctx.fillRect(1, 1, 18, 10);
			ctx.strokeStyle = "#6a4020";
			ctx.lineWidth = 2;
			ctx.strokeRect(1, 1, 18, 10);
		});

		// ---- クナイ(刃が上) ----
		make("kunai", 36, 120, (ctx) => {
			// 刃
			ctx.beginPath();
			ctx.moveTo(18, 0); ctx.lineTo(30, 44); ctx.lineTo(18, 54); ctx.lineTo(6, 44); ctx.closePath();
			const g = ctx.createLinearGradient(6, 0, 30, 0);
			g.addColorStop(0, "#9aa4ae");
			g.addColorStop(0.5, "#f4f8fc");
			g.addColorStop(1, "#7a848e");
			ctx.fillStyle = g;
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = "#2a3038";
			ctx.stroke();
			ctx.strokeStyle = "rgba(40,50,60,0.6)";
			ctx.beginPath(); ctx.moveTo(18, 6); ctx.lineTo(18, 50); ctx.stroke();
			// つば
			ctx.fillStyle = "#3a3a44";
			ctx.fillRect(10, 52, 16, 6);
			// 持ち手(赤いひも巻き)
			ctx.fillStyle = "#2a2a30";
			ctx.fillRect(13, 58, 10, 42);
			ctx.strokeStyle = "#c62828";
			ctx.lineWidth = 3;
			for (let y = 61; y < 98; y += 6) { ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(24, y + 3); ctx.stroke(); }
			// 輪っか
			ctx.lineWidth = 4;
			ctx.strokeStyle = "#3a3a44";
			ctx.beginPath(); ctx.arc(18, 108, 8, 0, Math.PI * 2); ctx.stroke();
		});
		// じゃまクナイ(師匠のクナイ・黒)
		make("kunai_dark", 36, 120, (ctx) => {
			ctx.beginPath();
			ctx.moveTo(18, 0); ctx.lineTo(30, 44); ctx.lineTo(18, 54); ctx.lineTo(6, 44); ctx.closePath();
			ctx.fillStyle = "#4a4a58";
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = "#111";
			ctx.stroke();
			ctx.fillStyle = "#222";
			ctx.fillRect(10, 52, 16, 6);
			ctx.fillRect(13, 58, 10, 42);
			ctx.strokeStyle = "#7a2ab8";
			ctx.lineWidth = 3;
			for (let y = 61; y < 98; y += 6) { ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(24, y + 3); ctx.stroke(); }
			ctx.lineWidth = 4;
			ctx.strokeStyle = "#222";
			ctx.beginPath(); ctx.arc(18, 108, 8, 0, Math.PI * 2); ctx.stroke();
		});
		// 小判
		make("koban", 56, 40, (ctx) => {
			const g = ctx.createRadialGradient(22, 14, 2, 28, 20, 28);
			g.addColorStop(0, "#fff7b0");
			g.addColorStop(0.6, "#f4c430");
			g.addColorStop(1, "#b8860b");
			ellipse(ctx, 28, 20, 25, 17, 0, g, "#7a5400", 3);
			ctx.strokeStyle = "rgba(122,84,0,0.6)";
			ctx.lineWidth = 2;
			for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(28 + i * 7, 8); ctx.lineTo(28 + i * 7, 32); ctx.stroke(); }
			ellipse(ctx, 28, 20, 7, 9, 0, "#f9d65a", "#7a5400", 2);
		});
		// 火花
		make("spark", 40, 40, (ctx) => {
			ctx.fillStyle = "#fffbe0";
			ctx.beginPath();
			for (let i = 0; i < 16; i++) {
				const a = i * Math.PI / 8, r = i % 2 === 0 ? 19 : 6;
				ctx.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r);
			}
			ctx.closePath();
			ctx.fill();
		});

		// ---- 忍者たぬき(たぬきの絵に覆面とマフラーを重ねる) ----
		const ninja = (ctx, base) => {
			ctx.drawImage(base, 0, 0);
			// 黒い頭巾(はちまきの上に重ねる)
			ctx.fillStyle = "#1e2a44";
			ctx.beginPath();
			ctx.moveTo(56, 74); ctx.lineTo(164, 74); ctx.lineTo(160, 60); ctx.quadraticCurveTo(110, 40, 60, 60); ctx.closePath();
			ctx.fill();
			// 口元の覆面
			ctx.beginPath();
			ctx.moveTo(64, 112); ctx.quadraticCurveTo(110, 100, 156, 112); ctx.lineTo(150, 136); ctx.quadraticCurveTo(110, 150, 70, 136); ctx.closePath();
			ctx.fill();
			// マフラー
			ctx.fillStyle = "#c62828";
			ctx.fillRect(66, 140, 92, 16);
			ctx.beginPath(); ctx.moveTo(150, 146); ctx.lineTo(206, 132); ctx.lineTo(210, 150); ctx.lineTo(156, 158); ctx.closePath(); ctx.fill();
			// 額の「忍」
			ctx.fillStyle = "#e0e0e0";
			ctx.fillRect(96, 60, 28, 14);
			ctx.fillStyle = "#1e2a44";
			ctx.font = "bold 12px IPAGothic";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("忍", 110, 67);
		};
		make("ninja_idle", 240, 250, (ctx) => ninja(ctx, imgs.idle));
		make("ninja_throw", 240, 250, (ctx) => ninja(ctx, imgs.pull));

		// ---- タイトルロゴ ----
		make("logo", 900, 250, (ctx, w) => {
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.lineJoin = "round";
			ctx.font = "bold 56px IPAGothic";
			ctx.lineWidth = 14;
			ctx.strokeStyle = "#1e2a44";
			ctx.strokeText("回る丸太に刺しまくれ！", w / 2, 52);
			ctx.fillStyle = "#ffffff";
			ctx.fillText("回る丸太に刺しまくれ！", w / 2, 52);
			const g = ctx.createLinearGradient(0, 100, 0, 220);
			g.addColorStop(0, "#f4f8fc");
			g.addColorStop(0.5, "#9aa4ae");
			g.addColorStop(1, "#4a5260");
			ctx.font = "bold 140px IPAGothic";
			ctx.lineWidth = 26;
			ctx.strokeStyle = "#c62828";
			ctx.strokeText("クナイ修行", w / 2, 162);
			ctx.lineWidth = 12;
			ctx.strokeStyle = "#111";
			ctx.strokeText("クナイ修行", w / 2, 162);
			ctx.fillStyle = g;
			ctx.fillText("クナイ修行", w / 2, 162);
		});
		return out;
	})();
}

(async () => {
	const dataUrl = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(drawAll, {
		idle: dataUrl(path.join(TANUKI, "tanuki_idle.png")),
		pull: dataUrl(path.join(TANUKI, "tanuki_pull.png"))
	});
	await browser.close();
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		fs.writeFileSync(path.join(OUT, name + ".png"), buf);
		console.log("wrote", name, buf.length);
	}
})();
