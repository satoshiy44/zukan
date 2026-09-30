// 画像アセット生成スクリプト: Chromium の canvas で描画して image/ 以下に PNG を書き出す
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");
const CELL = 72;

function drawAll(CELL) {
	const out = {};
	const make = (name, w, h, fn) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		const ctx = c.getContext("2d");
		fn(ctx, w, h);
		out[name] = c.toDataURL("image/png");
	};
	const ellipse = (ctx, x, y, rx, ry, rot, fill, stroke, lw) => {
		ctx.beginPath();
		ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
		if (fill) { ctx.fillStyle = fill; ctx.fill(); }
		if (stroke) { ctx.lineWidth = lw || 4; ctx.strokeStyle = stroke; ctx.stroke(); }
	};
	let seed = 4242;
	const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
	const roundRect = (ctx, x, y, w, h, r) => {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	};
	const face = (ctx, x, y, s) => {
		ellipse(ctx, x - 7 * s, y, 3.2 * s, 4 * s, 0, "#2a1208");
		ellipse(ctx, x + 7 * s, y, 3.2 * s, 4 * s, 0, "#2a1208");
		ellipse(ctx, x - 7.6 * s, y - 1.4 * s, 1.1 * s, 1.3 * s, 0, "#fff");
		ellipse(ctx, x + 6.4 * s, y - 1.4 * s, 1.1 * s, 1.3 * s, 0, "#fff");
		ctx.beginPath();
		ctx.arc(x, y + 3 * s, 3.2 * s, 0.15 * Math.PI, 0.85 * Math.PI);
		ctx.lineWidth = 1.8 * s;
		ctx.strokeStyle = "#2a1208";
		ctx.stroke();
		ellipse(ctx, x - 12 * s, y + 4 * s, 3 * s, 2 * s, 0, "rgba(255,120,120,0.55)");
		ellipse(ctx, x + 12 * s, y + 4 * s, 3 * s, 2 * s, 0, "rgba(255,120,120,0.55)");
	};
	// マスの背景(タイル)
	const tile = (ctx, w, h, c1, c2) => {
		roundRect(ctx, 3, 3, w - 6, h - 6, 14);
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, c1);
		g.addColorStop(1, c2);
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = "rgba(60,30,10,0.55)";
		ctx.stroke();
		roundRect(ctx, 8, 7, w - 16, h * 0.32, 10);
		ctx.fillStyle = "rgba(255,255,255,0.28)";
		ctx.fill();
	};
	const momiji = (ctx, x, y, r, rot, color, stroke) => {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillStyle = color;
		ctx.beginPath();
		for (let i = 0; i < 5; i++) {
			const a = -Math.PI / 2 + (i - 2) * 0.62;
			const a1 = a - 0.22, a2 = a + 0.22;
			if (i === 0) ctx.moveTo(Math.cos(a1) * r * 0.35, Math.sin(a1) * r * 0.35);
			ctx.lineTo(Math.cos(a1) * r * 0.7, Math.sin(a1) * r * 0.7);
			ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
			ctx.lineTo(Math.cos(a2) * r * 0.7, Math.sin(a2) * r * 0.7);
			ctx.lineTo(Math.cos(a2 + 0.2) * r * 0.35, Math.sin(a2 + 0.2) * r * 0.35);
		}
		ctx.lineTo(r * 0.12, r * 0.3);
		ctx.closePath();
		ctx.fill();
		if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke(); }
		ctx.strokeStyle = stroke || color;
		ctx.lineWidth = r * 0.09;
		ctx.beginPath();
		ctx.moveTo(0, r * 0.1);
		ctx.lineTo(r * 0.12, r * 0.75);
		ctx.stroke();
		ctx.restore();
	};
	const ginkgo = (ctx, x, y, r, rot, color, stroke) => {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(0, r * 0.35);
		ctx.arc(0, r * 0.35, r, -Math.PI * 0.86, -Math.PI * 0.14);
		ctx.closePath();
		ctx.fill();
		if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke(); }
		// 真ん中の切れこみ
		ctx.strokeStyle = stroke || "#b07a10";
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.moveTo(0, -r * 0.62); ctx.lineTo(0, -r * 0.2); ctx.stroke();
		ctx.lineWidth = r * 0.12;
		ctx.beginPath(); ctx.moveTo(0, r * 0.35); ctx.lineTo(0, r * 0.95); ctx.stroke();
		ctx.restore();
	};

	// ---- ピース ----
	const S = CELL;
	make("p_momiji", S, S, (ctx) => {
		tile(ctx, S, S, "#ffd9cf", "#f4a797");
		momiji(ctx, S / 2, S / 2 - 1, S * 0.4, 0.1, "#d8322a", "#7a1410");
		face(ctx, S / 2, S / 2 + 1, 0.9);
	});
	make("p_ichou", S, S, (ctx) => {
		tile(ctx, S, S, "#fff4c4", "#f3d774");
		ginkgo(ctx, S / 2, S / 2 + 2, S * 0.38, 0, "#f2b820", "#8a5a08");
		face(ctx, S / 2, S / 2 - 2, 0.8);
	});
	make("p_donguri", S, S, (ctx) => {
		tile(ctx, S, S, "#f0e0c8", "#d4b48c");
		// どんぐり
		const cx = S / 2, cy = S / 2 + 4;
		ctx.beginPath();
		ctx.moveTo(cx - 17, cy - 8);
		ctx.bezierCurveTo(cx - 20, cy + 16, cx - 6, cy + 25, cx, cy + 26);
		ctx.bezierCurveTo(cx + 6, cy + 25, cx + 20, cy + 16, cx + 17, cy - 8);
		ctx.closePath();
		const g = ctx.createLinearGradient(cx - 18, 0, cx + 18, 0);
		g.addColorStop(0, "#b8702c");
		g.addColorStop(1, "#7a4214");
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = "#3e1e06";
		ctx.stroke();
		// ぼうし
		ctx.beginPath();
		ctx.ellipse(cx, cy - 10, 21, 12, 0, Math.PI, 0);
		ctx.lineTo(cx + 21, cy - 7);
		ctx.lineTo(cx - 21, cy - 7);
		ctx.closePath();
		ctx.fillStyle = "#8a6a3a";
		ctx.fill();
		ctx.stroke();
		ctx.strokeStyle = "rgba(60,30,10,0.6)";
		ctx.lineWidth = 2;
		for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 7 - 3, cy - 19); ctx.lineTo(cx + i * 7 + 3, cy - 8); ctx.stroke(); }
		ctx.fillStyle = "#5a3a1a";
		ctx.fillRect(cx - 2, cy - 27, 4, 7);
		face(ctx, cx, cy + 6, 0.75);
	});
	make("p_budou", S, S, (ctx) => {
		tile(ctx, S, S, "#eadcff", "#c7a8f0");
		const cx = S / 2, cy = S / 2 + 2;
		const berries = [[-12, -12], [0, -14], [12, -12], [-7, -1], [7, -1], [-13, 2], [13, 2], [0, 10], [-6, 19], [6, 19], [0, 0]];
		for (const [dx, dy] of berries) {
			ellipse(ctx, cx + dx, cy + dy, 8.5, 8.5, 0, "#6a2ca0", "#2e0c4e", 2.5);
			ellipse(ctx, cx + dx - 2.5, cy + dy - 3, 2.5, 2, 0, "rgba(255,255,255,0.6)");
		}
		ctx.strokeStyle = "#4a7a1a";
		ctx.lineWidth = 4;
		ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx + 4, cy - 30); ctx.stroke();
		ellipse(ctx, cx + 12, cy - 26, 9, 5, -0.4, "#6aa83a", "#2f5a1a", 2);
		face(ctx, cx, cy + 1, 0.7);
	});
	// やきいも(ピース)
	make("p_imo", S, S, (ctx) => {
		const g = ctx.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
		g.addColorStop(0, "rgba(255,240,170,0.95)");
		g.addColorStop(1, "rgba(255,220,120,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, S, S);
		ctx.save();
		ctx.translate(S / 2, S / 2);
		ctx.rotate(-0.35);
		const rx = S * 0.42, ry = S * 0.24;
		ctx.beginPath();
		ctx.moveTo(-rx, 0);
		ctx.bezierCurveTo(-rx * 0.9, -ry * 1.2, rx * 0.5, -ry * 1.3, rx, -ry * 0.1);
		ctx.bezierCurveTo(rx * 0.6, ry * 1.25, -rx * 0.8, ry * 1.2, -rx, 0);
		ctx.closePath();
		const b = ctx.createLinearGradient(0, -ry, 0, ry);
		b.addColorStop(0, "#e0578f");
		b.addColorStop(1, "#7c1c48");
		ctx.fillStyle = b;
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = "#4a0e2a";
		ctx.stroke();
		// 割れて黄色い中身
		ctx.beginPath();
		ctx.ellipse(rx * 0.25, -ry * 0.1, rx * 0.35, ry * 0.55, 0.1, 0, Math.PI * 2);
		ctx.fillStyle = "#ffd23a";
		ctx.fill();
		ctx.strokeStyle = "#c98d12";
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.restore();
		// ゆげ
		ctx.strokeStyle = "rgba(255,255,255,0.9)";
		ctx.lineWidth = 3;
		for (const dx of [-8, 6]) {
			ctx.beginPath();
			ctx.moveTo(S / 2 + dx, 20);
			ctx.bezierCurveTo(S / 2 + dx - 6, 14, S / 2 + dx + 6, 10, S / 2 + dx, 3);
			ctx.stroke();
		}
		face(ctx, S / 2 - 6, S / 2 + 4, 0.7);
	});

	// ---- 背景 ----
	make("bg", 1280, 720, (ctx, w, h) => {
		const sky = ctx.createLinearGradient(0, 0, 0, h);
		sky.addColorStop(0, "#ffb870");
		sky.addColorStop(0.5, "#ffdca0");
		sky.addColorStop(1, "#f6c27a");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, w, h);
		// 遠くの山
		ctx.fillStyle = "#e0976a";
		ctx.beginPath();
		ctx.moveTo(0, h);
		for (let x = 0; x <= w; x += 20) ctx.lineTo(x, 330 + Math.sin(x / 150) * 40 + Math.sin(x / 61) * 12);
		ctx.lineTo(w, h);
		ctx.fill();
		// 紅葉の木
		const tree = (tx, ty, s, cols) => {
			ctx.fillStyle = "#6b3b22";
			ctx.fillRect(tx - 7 * s, ty - 50 * s, 14 * s, 50 * s);
			for (let i = 0; i < 28; i++) {
				const a = rnd() * Math.PI * 2, d = rnd() * 40 * s;
				ellipse(ctx, tx + Math.cos(a) * d, ty - 85 * s + Math.sin(a) * d * 0.8, 22 * s, 18 * s, 0, cols[i % cols.length]);
			}
		};
		tree(1000, 470, 1.6, ["#d8412f", "#e8612c", "#c7302a", "#f08a2e"]);
		tree(1230, 460, 1.3, ["#f2b632", "#e9a21f", "#f7c948"]);
		// 地面
		const gr = ctx.createLinearGradient(0, 520, 0, h);
		gr.addColorStop(0, "#b98a52");
		gr.addColorStop(1, "#8a5e32");
		ctx.fillStyle = gr;
		ctx.beginPath();
		ctx.moveTo(0, 540);
		ctx.bezierCurveTo(400, 500, 900, 520, 1280, 500);
		ctx.lineTo(1280, h);
		ctx.lineTo(0, h);
		ctx.fill();
		for (let i = 0; i < 60; i++) {
			const x = rnd() * w, y = 540 + rnd() * 170;
			if (rnd() < 0.5) momiji(ctx, x, y, 8 + rnd() * 6, rnd() * 6, rnd() < 0.5 ? "#d8412f" : "#e8612c");
			else ginkgo(ctx, x, y, 7 + rnd() * 5, rnd() * 6, "#f2b632");
		}
		// 盤面のわく(左側)
		const BX = 36, BY = 150, BW = 11 * CELL, BH = 7 * CELL;
		roundRect(ctx, BX - 16, BY - 16, BW + 32, BH + 32, 24);
		ctx.fillStyle = "#6b3f1c";
		ctx.fill();
		roundRect(ctx, BX - 8, BY - 8, BW + 16, BH + 16, 18);
		ctx.fillStyle = "#3a2210";
		ctx.fill();
		// 木目
		ctx.strokeStyle = "rgba(255,220,170,0.08)";
		ctx.lineWidth = 2;
		for (let y = BY; y < BY + BH; y += 12) {
			ctx.beginPath();
			for (let x = BX; x <= BX + BW; x += 20) ctx.lineTo(x, y + Math.sin(x / 40 + y) * 3);
			ctx.stroke();
		}
		// 盤の下からたき火への矢印
		ctx.fillStyle = "rgba(255,240,200,0.9)";
		ctx.font = "bold 22px IPAGothic";
		ctx.textAlign = "center";
		ctx.fillText("いもを いちばん下まで落とすと たき火へ →", BX + BW / 2, BY + BH + 48);
	});

	// ---- たき火 ----
	const bonfire = (ctx, w, h, t) => {
		// 石のかこい
		for (let i = 0; i < 9; i++) {
			const x = 30 + i * ((w - 60) / 8);
			ellipse(ctx, x, h - 26, 20, 14, 0, i % 2 ? "#9a948a" : "#b5ada2", "#4a4540", 3);
		}
		// まき
		ctx.save();
		ctx.translate(w / 2, h - 44);
		for (const a of [-0.35, 0.35, 0]) {
			ctx.save();
			ctx.rotate(a);
			roundRect(ctx, -70, -9, 140, 18, 8);
			ctx.fillStyle = "#7a4a22";
			ctx.fill();
			ctx.strokeStyle = "#3a1e08";
			ctx.lineWidth = 3;
			ctx.stroke();
			ctx.restore();
		}
		ctx.restore();
		// 炎
		const flame = (fx, fy, fw, fh, c1, c2) => {
			ctx.beginPath();
			ctx.moveTo(fx - fw, fy);
			ctx.bezierCurveTo(fx - fw * 1.1, fy - fh * 0.5, fx - fw * 0.2 + t * 6, fy - fh * 0.6, fx + t * 8, fy - fh);
			ctx.bezierCurveTo(fx + fw * 0.3 + t * 4, fy - fh * 0.6, fx + fw * 1.1, fy - fh * 0.5, fx + fw, fy);
			ctx.closePath();
			const g = ctx.createLinearGradient(0, fy - fh, 0, fy);
			g.addColorStop(0, c1);
			g.addColorStop(1, c2);
			ctx.fillStyle = g;
			ctx.fill();
		};
		const base = h - 50;
		flame(w / 2 - 45, base, 38, 110 - t * 12, "rgba(255,120,30,0.9)", "#e83a1a");
		flame(w / 2 + 45, base, 38, 100 + t * 12, "rgba(255,120,30,0.9)", "#e83a1a");
		flame(w / 2, base, 60, 175 + t * 14, "rgba(255,150,40,0.95)", "#ff5a1a");
		flame(w / 2 - 5, base, 38, 120 - t * 10, "#ffd84a", "#ff9a1a");
		flame(w / 2 + 5, base, 20, 70 + t * 8, "#fff7c0", "#ffd84a");
	};
	make("fire1", 300, 260, (ctx, w, h) => bonfire(ctx, w, h, 0));
	make("fire2", 300, 260, (ctx, w, h) => bonfire(ctx, w, h, 1));

	// 火の粉
	make("spark", 16, 16, (ctx) => {
		const g = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
		g.addColorStop(0, "rgba(255,250,200,1)");
		g.addColorStop(0.5, "rgba(255,170,40,0.9)");
		g.addColorStop(1, "rgba(255,90,20,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 16, 16);
	});

	// ---- タイトルロゴ ----
	make("logo", 900, 250, (ctx, w) => {
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		ctx.font = "bold 62px IPAGothic";
		ctx.lineWidth = 14;
		ctx.strokeStyle = "#5a1a08";
		ctx.strokeText("たきびでポン！", w / 2, 58);
		ctx.fillStyle = "#fff4d0";
		ctx.fillText("たきびでポン！", w / 2, 58);
		const g = ctx.createLinearGradient(0, 110, 0, 230);
		g.addColorStop(0, "#ffe25a");
		g.addColorStop(0.5, "#ff8a1a");
		g.addColorStop(1, "#c8321a");
		ctx.font = "bold 120px IPAGothic";
		ctx.lineWidth = 26;
		ctx.strokeStyle = "#fff4d0";
		ctx.strokeText("やきいもパズル", w / 2, 165);
		ctx.lineWidth = 12;
		ctx.strokeStyle = "#5a1a08";
		ctx.strokeText("やきいもパズル", w / 2, 165);
		ctx.fillStyle = g;
		ctx.fillText("やきいもパズル", w / 2, 165);
	});

	// ---- アイコン(投稿用) ----
	make("icon", 320, 320, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, "#ffb870");
		g.addColorStop(1, "#f6c27a");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		ctx.save(); ctx.translate(10, 90); bonfire(ctx, 300, 230, 0.5); ctx.restore();
		for (let i = 0; i < 4; i++) {
			const x = 20 + i * 72;
			ctx.save(); ctx.translate(x, 96);
			roundRect(ctx, 3, 3, 66, 66, 12);
			ctx.fillStyle = ["#f4a797", "#f3d774", "#d4b48c", "#c7a8f0"][i];
			ctx.fill();
			ctx.restore();
		}
		momiji(ctx, 56, 130, 26, 0.1, "#d8322a", "#7a1410");
		ginkgo(ctx, 128, 134, 25, 0, "#f2b820", "#8a5a08");
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.lineJoin = "round";
		ctx.font = "bold 52px IPAGothic";
		ctx.lineWidth = 12;
		ctx.strokeStyle = "#5a1a08";
		ctx.strokeText("やきいも", w / 2, 40);
		ctx.fillStyle = "#fff4d0";
		ctx.fillText("やきいも", w / 2, 40);
		ctx.font = "bold 40px IPAGothic";
		ctx.strokeText("パズル", 250, 285);
		ctx.fillStyle = "#ffd84a";
		ctx.fillText("パズル", 250, 285);
	});
	return out;
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(drawAll, CELL);
	await browser.close();
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		const dest = name === "icon" ? path.join(__dirname, "..", "submission", "icon.png") : path.join(OUT, name + ".png");
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.writeFileSync(dest, buf);
		console.log("wrote", path.relative(process.cwd(), dest), buf.length);
	}
})();
