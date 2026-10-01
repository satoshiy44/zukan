// 画像アセット生成スクリプト: Chromium の canvas で描画して image/ 以下に PNG を書き出す
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");

function drawAll() {
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
	// 疑似乱数(毎回同じ絵になるように)
	let seed = 12345;
	const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

	const momiji = (ctx, x, y, r, rot, color) => {
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
		ctx.strokeStyle = color;
		ctx.lineWidth = r * 0.08;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(r * 0.1, r * 0.7);
		ctx.stroke();
		ctx.restore();
	};
	const ginkgo = (ctx, x, y, r, rot, color) => {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(0, r * 0.3);
		ctx.arc(0, r * 0.3, r, -Math.PI * 0.85, -Math.PI * 0.15);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = color;
		ctx.lineWidth = r * 0.1;
		ctx.beginPath();
		ctx.moveTo(0, r * 0.3);
		ctx.lineTo(0, r * 0.9);
		ctx.stroke();
		ctx.restore();
	};

	// ---- 背景 ----
	make("bg", 1280, 720, (ctx, w, h) => {
		const GY = 300;
		const sky = ctx.createLinearGradient(0, 0, 0, GY);
		sky.addColorStop(0, "#ffb36b");
		sky.addColorStop(0.55, "#ffd79a");
		sky.addColorStop(1, "#fff1c9");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, w, GY);
		// 夕日
		const sun = ctx.createRadialGradient(1060, 150, 10, 1060, 150, 160);
		sun.addColorStop(0, "rgba(255,255,230,1)");
		sun.addColorStop(0.3, "rgba(255,210,140,0.8)");
		sun.addColorStop(1, "rgba(255,180,100,0)");
		ctx.fillStyle = sun;
		ctx.fillRect(860, 0, 400, GY);
		// 遠くの山
		ctx.fillStyle = "#d9885a";
		ctx.beginPath();
		ctx.moveTo(0, GY);
		for (let x = 0; x <= w; x += 20) ctx.lineTo(x, 190 + Math.sin(x / 140) * 30 + Math.sin(x / 57) * 10);
		ctx.lineTo(w, GY);
		ctx.fill();
		ctx.fillStyle = "#b8643f";
		ctx.beginPath();
		ctx.moveTo(0, GY);
		for (let x = 0; x <= w; x += 20) ctx.lineTo(x, 235 + Math.sin(x / 90 + 1) * 18 + Math.sin(x / 33) * 6);
		ctx.lineTo(w, GY);
		ctx.fill();
		// 紅葉の木
		const tree = (tx, ty, s, cols) => {
			ctx.fillStyle = "#6b3b22";
			ctx.fillRect(tx - 6 * s, ty - 40 * s, 12 * s, 40 * s);
			for (let i = 0; i < 26; i++) {
				const a = rnd() * Math.PI * 2, d = rnd() * 38 * s;
				ellipse(ctx, tx + Math.cos(a) * d, ty - 70 * s + Math.sin(a) * d * 0.8, 20 * s, 17 * s, 0, cols[i % cols.length]);
			}
		};
		tree(70, GY, 1.6, ["#d8412f", "#e8612c", "#c7302a", "#f08a2e"]);
		tree(210, GY, 1.1, ["#f2b632", "#e9a21f", "#f7c948"]);
		tree(1200, GY, 1.4, ["#e8612c", "#d8412f", "#f2b632"]);
		// 地面(断面)
		const soil = ctx.createLinearGradient(0, GY, 0, h);
		soil.addColorStop(0, "#8a5a36");
		soil.addColorStop(0.4, "#6e4427");
		soil.addColorStop(1, "#4a2c18");
		ctx.fillStyle = soil;
		ctx.fillRect(0, GY, w, h - GY);
		// 地層
		for (let i = 0; i < 4; i++) {
			ctx.strokeStyle = "rgba(40,20,5,0.18)";
			ctx.lineWidth = 6;
			ctx.beginPath();
			const by = 380 + i * 90;
			for (let x = 0; x <= w; x += 16) ctx.lineTo(x, by + Math.sin(x / 70 + i) * 8);
			ctx.stroke();
		}
		// 小石・つぶ
		for (let i = 0; i < 260; i++) {
			const x = rnd() * w, y = GY + 12 + rnd() * (h - GY);
			ellipse(ctx, x, y, 2 + rnd() * 5, 1.5 + rnd() * 3, rnd(), rnd() < 0.5 ? "rgba(40,22,10,0.35)" : "rgba(190,140,90,0.25)");
		}
		// 地表の草と落ち葉
		ctx.fillStyle = "#7d5a2a";
		ctx.fillRect(0, GY - 6, w, 12);
		for (let x = 0; x < w; x += 7) {
			ctx.strokeStyle = rnd() < 0.5 ? "#8a8a2a" : "#a39a3a";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(x, GY);
			ctx.lineTo(x + (rnd() - 0.5) * 8, GY - 8 - rnd() * 12);
			ctx.stroke();
		}
		for (let i = 0; i < 40; i++) {
			const x = rnd() * w;
			if (rnd() < 0.5) momiji(ctx, x, GY - 2 + rnd() * 6, 9 + rnd() * 5, rnd() * 6, rnd() < 0.5 ? "#d8412f" : "#e8612c");
			else ginkgo(ctx, x, GY - 2 + rnd() * 6, 8 + rnd() * 4, rnd() * 6, "#f2b632");
		}
	});

	// ---- さつまいも ----
	const imo = (ctx, w, h, body, dark, gold) => {
		ctx.save();
		ctx.translate(w / 2, h / 2);
		ctx.rotate(-0.12);
		const rx = w * 0.44, ry = h * 0.36;
		ctx.beginPath();
		ctx.moveTo(-rx, 0);
		ctx.bezierCurveTo(-rx * 0.9, -ry * 1.1, rx * 0.5, -ry * 1.25, rx, -ry * 0.1);
		ctx.bezierCurveTo(rx * 0.6, ry * 1.2, -rx * 0.8, ry * 1.15, -rx, 0);
		ctx.closePath();
		const g = ctx.createLinearGradient(0, -ry, 0, ry);
		g.addColorStop(0, gold ? "#fff4a8" : "#e0578f");
		g.addColorStop(0.5, body);
		g.addColorStop(1, dark);
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = Math.max(3, w * 0.04);
		ctx.strokeStyle = gold ? "#a8741a" : "#5b1638";
		ctx.stroke();
		// すじ
		ctx.strokeStyle = gold ? "rgba(160,100,10,0.5)" : "rgba(80,10,40,0.45)";
		ctx.lineWidth = Math.max(2, w * 0.02);
		for (let i = -1; i <= 1; i++) {
			ctx.beginPath();
			ctx.moveTo(i * rx * 0.45 - rx * 0.05, -ry * 0.75);
			ctx.quadraticCurveTo(i * rx * 0.45 + rx * 0.08, 0, i * rx * 0.45 - rx * 0.02, ry * 0.7);
			ctx.stroke();
		}
		// ハイライト
		ellipse(ctx, -rx * 0.3, -ry * 0.5, rx * 0.25, ry * 0.15, -0.2, "rgba(255,255,255,0.45)");
		// 顔
		ctx.fillStyle = "#2a0f18";
		ellipse(ctx, -rx * 0.2, -ry * 0.02, w * 0.035, w * 0.05, 0, "#2a0f18");
		ellipse(ctx, rx * 0.2, -ry * 0.08, w * 0.035, w * 0.05, 0, "#2a0f18");
		ellipse(ctx, -rx * 0.21, -ry * 0.1, w * 0.012, w * 0.016, 0, "#fff");
		ellipse(ctx, rx * 0.19, -ry * 0.16, w * 0.012, w * 0.016, 0, "#fff");
		ctx.beginPath();
		ctx.arc(0, ry * 0.15, w * 0.06, 0.15 * Math.PI, 0.85 * Math.PI);
		ctx.lineWidth = Math.max(2, w * 0.025);
		ctx.strokeStyle = "#2a0f18";
		ctx.stroke();
		ellipse(ctx, -rx * 0.45, ry * 0.2, w * 0.05, w * 0.03, 0, "rgba(255,120,150,0.6)");
		ellipse(ctx, rx * 0.42, ry * 0.12, w * 0.05, w * 0.03, 0, "rgba(255,120,150,0.6)");
		ctx.restore();
	};
	make("imo", 96, 64, (ctx, w, h) => imo(ctx, w, h, "#b8316b", "#7c1c48", false));
	make("imo_big", 150, 100, (ctx, w, h) => imo(ctx, w, h, "#a8285f", "#6c1640", false));
	make("imo_gold", 110, 76, (ctx, w, h) => {
		const g = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2);
		g.addColorStop(0, "rgba(255,250,180,0.9)");
		g.addColorStop(1, "rgba(255,240,120,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		imo(ctx, w, h, "#f4c430", "#c98d12", true);
		// きらきら
		const star = (x, y, r) => {
			ctx.fillStyle = "#fffbe0";
			ctx.beginPath();
			ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.25, y - r * 0.25); ctx.lineTo(x + r, y);
			ctx.lineTo(x + r * 0.25, y + r * 0.25); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.25, y + r * 0.25);
			ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.25, y - r * 0.25); ctx.closePath(); ctx.fill();
		};
		star(18, 16, 10);
		star(92, 58, 8);
	});

	// ---- 石(根にからまった) ----
	make("rock", 90, 70, (ctx, w, h) => {
		ctx.beginPath();
		ctx.moveTo(10, 40); ctx.lineTo(20, 14); ctx.lineTo(48, 6); ctx.lineTo(76, 18); ctx.lineTo(84, 46);
		ctx.lineTo(62, 64); ctx.lineTo(26, 62); ctx.closePath();
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, "#b9b3a8");
		g.addColorStop(1, "#6d665c");
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 4;
		ctx.strokeStyle = "#3b352e";
		ctx.stroke();
		ctx.strokeStyle = "rgba(40,30,20,0.5)";
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.moveTo(40, 20); ctx.lineTo(50, 36); ctx.lineTo(44, 50); ctx.stroke();
		// 根がからまっている
		ctx.strokeStyle = "#d9b98a";
		ctx.lineWidth = 5;
		ctx.beginPath(); ctx.moveTo(45, 0); ctx.bezierCurveTo(10, 20, 80, 40, 30, 70); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(45, 0); ctx.bezierCurveTo(85, 25, 5, 45, 60, 70); ctx.stroke();
		// 怒り顔
		ctx.strokeStyle = "#222";
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.moveTo(28, 30); ctx.lineTo(40, 35); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(64, 30); ctx.lineTo(52, 35); ctx.stroke();
		ellipse(ctx, 36, 40, 3.5, 4, 0, "#222");
		ellipse(ctx, 56, 40, 3.5, 4, 0, "#222");
	});

	// ---- 葉っぱ(地上のつる) ----
	make("vine", 200, 150, (ctx, w, h) => {
		const leaf = (x, y, r, rot, c) => {
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(rot);
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.bezierCurveTo(r * 0.8, -r * 0.3, r * 0.7, -r * 1.2, 0, -r * 1.4);
			ctx.bezierCurveTo(-r * 0.7, -r * 1.2, -r * 0.8, -r * 0.3, 0, 0);
			ctx.fillStyle = c;
			ctx.fill();
			ctx.strokeStyle = "#2f5a1a";
			ctx.lineWidth = 3;
			ctx.stroke();
			ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 1.2); ctx.stroke();
			ctx.restore();
		};
		ctx.strokeStyle = "#5c7a24";
		ctx.lineWidth = 8;
		ctx.beginPath(); ctx.moveTo(100, 150); ctx.bezierCurveTo(95, 110, 110, 90, 100, 60); ctx.stroke();
		leaf(100, 70, 42, -0.9, "#7aa83a");
		leaf(100, 70, 42, 0.9, "#6c9a30");
		leaf(100, 90, 36, -1.7, "#8bb84a");
		leaf(100, 95, 36, 1.7, "#7aa83a");
		leaf(100, 62, 40, 0, "#96c455");
		// 紅葉した葉を一枚
		leaf(100, 100, 30, 2.4, "#c9a13a");
	});

	// ---- かご ----
	make("basket", 220, 150, (ctx, w, h) => {
		ctx.strokeStyle = "#7a4a1c";
		ctx.lineWidth = 10;
		ctx.beginPath(); ctx.arc(110, 60, 80, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(14, 56); ctx.lineTo(206, 56); ctx.lineTo(180, 146); ctx.lineTo(40, 146); ctx.closePath();
		const g = ctx.createLinearGradient(0, 56, 0, 146);
		g.addColorStop(0, "#d9a45a");
		g.addColorStop(1, "#a86f2c");
		ctx.fillStyle = g;
		ctx.fill();
		ctx.strokeStyle = "#6b3f14";
		ctx.lineWidth = 4;
		ctx.stroke();
		ctx.strokeStyle = "rgba(107,63,20,0.6)";
		ctx.lineWidth = 3;
		for (let y = 72; y < 146; y += 16) { ctx.beginPath(); ctx.moveTo(20 + (y - 56) * 0.28, y); ctx.lineTo(200 - (y - 56) * 0.28, y); ctx.stroke(); }
		for (let x = 30; x < 200; x += 18) { ctx.beginPath(); ctx.moveTo(x, 58); ctx.lineTo(x + (110 - x) * 0.14, 144); ctx.stroke(); }
		ctx.fillStyle = "#8a5424";
		ctx.fillRect(10, 50, 200, 12);
	});

	// ---- たぬき(主人公) ----
	const tanuki = (ctx, pose) => {
		// pose: 0=待機, 1=引っぱり, 2=しりもち
		ctx.save();
		ctx.translate(110, 120);
		if (pose === 1) ctx.rotate(-0.28);
		if (pose === 2) { ctx.translate(-10, 40); ctx.rotate(-0.55); }
		// しっぽ
		ctx.save();
		ctx.translate(-58, 50);
		ctx.rotate(-0.6);
		ellipse(ctx, 0, 0, 24, 40, 0, "#8a5a36", "#3a2414", 4);
		ellipse(ctx, 0, -8, 18, 6, 0, "#4a2c18");
		ellipse(ctx, 0, 10, 20, 6, 0, "#4a2c18");
		ctx.restore();
		// からだ
		ellipse(ctx, 0, 50, 56, 58, 0, "#a06a3e", "#3a2414", 5);
		ellipse(ctx, 0, 60, 36, 40, 0, "#f3dfb8");
		// はっぴ
		ctx.fillStyle = "#2f5aa8";
		ctx.beginPath(); ctx.moveTo(-54, 30); ctx.lineTo(-20, 12); ctx.lineTo(-8, 90); ctx.lineTo(-48, 88); ctx.closePath(); ctx.fill();
		ctx.beginPath(); ctx.moveTo(54, 30); ctx.lineTo(20, 12); ctx.lineTo(8, 90); ctx.lineTo(48, 88); ctx.closePath(); ctx.fill();
		// 頭
		ellipse(ctx, -34, -50, 16, 16, 0, "#a06a3e", "#3a2414", 4);
		ellipse(ctx, 34, -50, 16, 16, 0, "#a06a3e", "#3a2414", 4);
		ellipse(ctx, 0, -18, 52, 44, 0, "#b77c48", "#3a2414", 5);
		ellipse(ctx, 0, -2, 34, 22, 0, "#f3dfb8");
		// 目のまわり
		ellipse(ctx, -20, -20, 17, 12, -0.3, "#4a2c18");
		ellipse(ctx, 20, -20, 17, 12, 0.3, "#4a2c18");
		if (pose === 2) {
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 3;
			for (const s of [-1, 1]) {
				ctx.beginPath(); ctx.moveTo(20 * s - 6, -26); ctx.lineTo(20 * s + 6, -14); ctx.stroke();
				ctx.beginPath(); ctx.moveTo(20 * s + 6, -26); ctx.lineTo(20 * s - 6, -14); ctx.stroke();
			}
		} else if (pose === 1) {
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 4;
			ctx.beginPath(); ctx.moveTo(-28, -24); ctx.lineTo(-16, -19); ctx.lineTo(-28, -14); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(28, -24); ctx.lineTo(16, -19); ctx.lineTo(28, -14); ctx.stroke();
		} else {
			ellipse(ctx, -18, -20, 6, 7, 0, "#fff");
			ellipse(ctx, 18, -20, 6, 7, 0, "#fff");
			ellipse(ctx, -17, -19, 3.5, 4, 0, "#111");
			ellipse(ctx, 19, -19, 3.5, 4, 0, "#111");
		}
		ellipse(ctx, 0, -6, 8, 6, 0, "#222");
		// くち
		ctx.strokeStyle = "#3a2414";
		ctx.lineWidth = 3;
		if (pose === 1) {
			ctx.fillStyle = "#6a1f1f";
			ctx.fillRect(-10, 4, 20, 8);
			ctx.strokeRect(-10, 4, 20, 8);
		} else if (pose === 2) {
			ellipse(ctx, 0, 10, 7, 9, 0, "#6a1f1f", "#3a2414", 3);
		} else {
			ctx.beginPath(); ctx.arc(-6, 4, 6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
			ctx.beginPath(); ctx.arc(6, 4, 6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
		}
		// はちまき
		ctx.fillStyle = "#e33";
		ctx.fillRect(-50, -46, 100, 10);
		ctx.beginPath(); ctx.moveTo(46, -44); ctx.lineTo(72, -58); ctx.lineTo(66, -38); ctx.closePath(); ctx.fill();
		// うで
		const armAngle = pose === 1 ? 0.2 : pose === 2 ? -1.2 : 0.6;
		ctx.save();
		ctx.translate(40, 30);
		ctx.rotate(armAngle);
		ellipse(ctx, 28, 0, 30, 13, 0, "#a06a3e", "#3a2414", 4);
		ellipse(ctx, 56, 0, 13, 13, 0, "#4a2c18", "#3a2414", 3);
		ctx.restore();
		// あし
		ellipse(ctx, -26, 106, 20, 12, 0, "#4a2c18", "#3a2414", 3);
		ellipse(ctx, 26, 106, 20, 12, 0, "#4a2c18", "#3a2414", 3);
		ctx.restore();
		if (pose === 1) {
			// 汗
			ctx.fillStyle = "#8fd3ff";
			ctx.beginPath(); ctx.moveTo(40, 22); ctx.quadraticCurveTo(52, 40, 40, 44); ctx.quadraticCurveTo(28, 40, 40, 22); ctx.fill();
		}
	};
	make("tanuki_idle", 240, 250, (ctx) => tanuki(ctx, 0));
	make("tanuki_pull", 240, 250, (ctx) => tanuki(ctx, 1));
	make("tanuki_fall", 240, 250, (ctx) => tanuki(ctx, 2));

	// ---- 落ち葉パーティクル ----
	make("leaf_red", 40, 40, (ctx) => momiji(ctx, 20, 22, 17, 0, "#e0452f"));
	make("leaf_yellow", 40, 40, (ctx) => ginkgo(ctx, 20, 18, 16, 0, "#f2b632"));

	// ---- ひび(ブチッ!) ----
	make("snap", 200, 120, (ctx) => {
		ctx.fillStyle = "#fff";
		ctx.strokeStyle = "#c02020";
		ctx.lineWidth = 6;
		ctx.beginPath();
		const cx = 100, cy = 60;
		for (let i = 0; i < 16; i++) {
			const a = (i / 16) * Math.PI * 2;
			const r = i % 2 === 0 ? 58 : 34;
			ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r);
		}
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = "#c02020";
		ctx.font = "bold 44px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("ブチッ!", cx, cy + 2);
	});

	// ======== 後半: やきいも屋台 ========
	const rrect = (ctx, x, y, w, h, r) => {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	};
	make("stall_bg", 1280, 720, (ctx, w, h) => {
		const sky = ctx.createLinearGradient(0, 0, 0, h);
		sky.addColorStop(0, "#2b2050");
		sky.addColorStop(0.45, "#8a3f5a");
		sky.addColorStop(0.7, "#e07a4a");
		sky.addColorStop(1, "#5a3420");
		ctx.fillStyle = sky;
		ctx.fillRect(0, 0, w, h);
		// 星
		for (let i = 0; i < 60; i++) ellipse(ctx, rnd() * w, rnd() * 220, 1.5, 1.5, 0, "rgba(255,250,220," + (0.4 + rnd() * 0.6) + ")");
		// 月
		ellipse(ctx, 1080, 110, 46, 46, 0, "#fff3c4");
		ellipse(ctx, 1100, 100, 40, 40, 0, "#2b2050");
		// 町なみ
		ctx.fillStyle = "#3a2440";
		for (let x = 0; x < w; x += 110) {
			const hh = 140 + rnd() * 80;
			ctx.fillRect(x, 470 - hh, 100, hh);
			ctx.beginPath(); ctx.moveTo(x - 10, 470 - hh); ctx.lineTo(x + 50, 470 - hh - 40); ctx.lineTo(x + 110, 470 - hh); ctx.fill();
			ctx.fillStyle = "rgba(255,210,120,0.7)";
			ctx.fillRect(x + 20, 470 - hh + 30, 18, 22);
			ctx.fillRect(x + 60, 470 - hh + 30, 18, 22);
			ctx.fillStyle = "#3a2440";
		}
		// 道
		const road = ctx.createLinearGradient(0, 470, 0, h);
		road.addColorStop(0, "#7a5236");
		road.addColorStop(1, "#4a2c18");
		ctx.fillStyle = road;
		ctx.fillRect(0, 470, w, h - 470);
		// ちょうちんのひも
		ctx.strokeStyle = "#2a1a10";
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.moveTo(0, 40); ctx.quadraticCurveTo(640, 110, 1280, 40); ctx.stroke();
		for (let i = 1; i < 10; i++) {
			const x = i * 128, y = 40 + Math.sin(i / 10 * Math.PI) * 52;
			const g = ctx.createRadialGradient(x, y + 30, 4, x, y + 30, 60);
			g.addColorStop(0, "rgba(255,200,100,0.5)");
			g.addColorStop(1, "rgba(255,200,100,0)");
			ctx.fillStyle = g;
			ctx.fillRect(x - 60, y - 30, 120, 120);
			ellipse(ctx, x, y + 30, 20, 26, 0, "#e8412f", "#7a1a10", 3);
			ctx.fillStyle = "#2a1a10";
			ctx.fillRect(x - 12, y + 2, 24, 6);
			ctx.fillRect(x - 12, y + 54, 24, 6);
		}
		// 落ち葉
		for (let i = 0; i < 40; i++) {
			const x = rnd() * w, y = 480 + rnd() * 230;
			if (rnd() < 0.5) momiji(ctx, x, y, 8 + rnd() * 5, rnd() * 6, "#d8412f");
			else ginkgo(ctx, x, y, 7 + rnd() * 4, rnd() * 6, "#f2b632");
		}
	});
	// 屋台(石焼き窯つき)
	make("yatai", 560, 470, (ctx, w, h) => {
		// 屋根
		ctx.fillStyle = "#c23a2a";
		ctx.beginPath(); ctx.moveTo(10, 110); ctx.lineTo(60, 20); ctx.lineTo(500, 20); ctx.lineTo(550, 110); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = "#5a140c"; ctx.lineWidth = 5; ctx.stroke();
		ctx.fillStyle = "#fff4dc";
		for (let i = 0; i < 9; i++) {
			ctx.beginPath();
			ctx.moveTo(10 + i * 60, 110); ctx.lineTo(40 + i * 60, 110); ctx.lineTo(25 + i * 60, 135); ctx.closePath();
			ctx.fill();
		}
		// のれん
		ctx.fillStyle = "#2f4a8a";
		for (let i = 0; i < 4; i++) { rrect(ctx, 70 + i * 108, 112, 98, 70, 6); ctx.fill(); }
		ctx.fillStyle = "#fff4dc";
		ctx.font = "bold 46px IPAGothic";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		["や", "き", "い", "も"].forEach((c, i) => ctx.fillText(c, 119 + i * 108, 150));
		// 柱
		ctx.fillStyle = "#6b3f1c";
		ctx.fillRect(40, 110, 22, 330);
		ctx.fillRect(498, 110, 22, 330);
		// 台
		const g = ctx.createLinearGradient(0, 300, 0, 450);
		g.addColorStop(0, "#b07a44");
		g.addColorStop(1, "#7a4a22");
		ctx.fillStyle = g;
		rrect(ctx, 20, 300, 520, 150, 12); ctx.fill();
		ctx.strokeStyle = "#3a1e08"; ctx.lineWidth = 5; ctx.stroke();
		// 窯(石)
		const ox = 280, oy = 290;
		ellipse(ctx, ox, oy, 170, 70, 0, "#4a4038", "#2a2018", 5);
		for (let i = 0; i < 26; i++) {
			const a = rnd() * Math.PI * 2, d = rnd();
			ellipse(ctx, ox + Math.cos(a) * 150 * d, oy + Math.sin(a) * 55 * d, 12 + rnd() * 8, 8 + rnd() * 5, rnd(), rnd() < 0.5 ? "#8a8278" : "#a59d92", "#3a342e", 2);
		}
		// 窯のまわりの赤い光
		const glow = ctx.createRadialGradient(ox, oy, 10, ox, oy, 170);
		glow.addColorStop(0, "rgba(255,140,40,0.55)");
		glow.addColorStop(1, "rgba(255,90,20,0)");
		ctx.fillStyle = glow;
		ctx.fillRect(ox - 170, oy - 80, 340, 160);
		// 車輪
		ellipse(ctx, 110, 445, 30, 30, 0, "#3a2414", "#1a0e06", 4);
		ellipse(ctx, 450, 445, 30, 30, 0, "#3a2414", "#1a0e06", 4);
	});
	// お客さん(きつね・うさぎ・くま)
	const customer = (ctx, kind) => {
		const cols = { kitsune: ["#f08a3a", "#fff4e0"], usagi: ["#f4f0ea", "#ffc8d4"], kuma: ["#8a5a36", "#e8c89a"] }[kind];
		ctx.save();
		ctx.translate(120, 150);
		// 体
		ellipse(ctx, 0, 70, 58, 62, 0, cols[0], "#3a2414", 5);
		ellipse(ctx, 0, 80, 34, 40, 0, cols[1]);
		// 耳
		if (kind === "kitsune") {
			for (const s of [-1, 1]) {
				ctx.beginPath(); ctx.moveTo(s * 20, -60); ctx.lineTo(s * 50, -120); ctx.lineTo(s * 58, -45); ctx.closePath();
				ctx.fillStyle = cols[0]; ctx.fill(); ctx.strokeStyle = "#3a2414"; ctx.lineWidth = 4; ctx.stroke();
			}
		} else if (kind === "usagi") {
			for (const s of [-1, 1]) {
				ellipse(ctx, s * 22, -110, 15, 50, s * 0.15, cols[0], "#3a2414", 4);
				ellipse(ctx, s * 22, -108, 7, 36, s * 0.15, cols[1]);
			}
		} else {
			for (const s of [-1, 1]) {
				ellipse(ctx, s * 40, -58, 18, 18, 0, cols[0], "#3a2414", 4);
				ellipse(ctx, s * 40, -58, 9, 9, 0, cols[1]);
			}
		}
		// 顔
		ellipse(ctx, 0, -20, 56, 48, 0, cols[0], "#3a2414", 5);
		ellipse(ctx, 0, -2, 30, 20, 0, cols[1]);
		ctx.strokeStyle = "#2a1208";
		ctx.lineWidth = 4;
		for (const s of [-1, 1]) {
			ctx.beginPath(); ctx.arc(s * 20, -24, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
		}
		ellipse(ctx, 0, -8, 6, 5, 0, "#2a1208");
		ctx.beginPath(); ctx.arc(0, 2, 9, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
		ellipse(ctx, -34, -4, 9, 6, 0, "rgba(255,120,140,0.6)");
		ellipse(ctx, 34, -4, 9, 6, 0, "rgba(255,120,140,0.6)");
		// 手
		ellipse(ctx, -56, 50, 16, 14, 0, cols[0], "#3a2414", 4);
		ellipse(ctx, 56, 50, 16, 14, 0, cols[0], "#3a2414", 4);
		ctx.restore();
	};
	make("cust_kitsune", 240, 290, (ctx) => customer(ctx, "kitsune"));
	make("cust_usagi", 240, 290, (ctx) => customer(ctx, "usagi"));
	make("cust_kuma", 240, 290, (ctx) => customer(ctx, "kuma"));
	// こげたいも
	make("imo_burnt", 96, 64, (ctx, w, h) => {
		ctx.save();
		ctx.translate(w / 2, h / 2);
		ctx.rotate(-0.12);
		const rx = w * 0.44, ry = h * 0.36;
		ctx.beginPath();
		ctx.moveTo(-rx, 0);
		ctx.bezierCurveTo(-rx * 0.9, -ry * 1.1, rx * 0.5, -ry * 1.25, rx, -ry * 0.1);
		ctx.bezierCurveTo(rx * 0.6, ry * 1.2, -rx * 0.8, ry * 1.15, -rx, 0);
		ctx.closePath();
		ctx.fillStyle = "#2a1a14";
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = "#0a0604";
		ctx.stroke();
		ctx.strokeStyle = "#fff";
		ctx.lineWidth = 2.5;
		for (const s of [-1, 1]) {
			ctx.beginPath(); ctx.moveTo(s * 10 - 4, -6); ctx.lineTo(s * 10 + 4, 2); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(s * 10 + 4, -6); ctx.lineTo(s * 10 - 4, 2); ctx.stroke();
		}
		ctx.restore();
	});
	// 焼けたいも(割れて黄色い中身)
	make("imo_yaki", 110, 76, (ctx, w, h) => {
		const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
		g.addColorStop(0, "rgba(255,240,170,0.9)");
		g.addColorStop(1, "rgba(255,220,120,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		imo(ctx, w, h, "#9a2a58", "#5c1238", false);
		ellipse(ctx, w * 0.58, h * 0.46, w * 0.16, h * 0.2, 0.2, "#ffd23a", "#c98d12", 2);
	});

	// ---- タイトルロゴ ----
	make("logo", 900, 260, (ctx, w, h) => {
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		const outline = (text, x, y, size, fill, stroke, sw) => {
			ctx.font = "bold " + size + "px IPAGothic";
			ctx.lineJoin = "round";
			ctx.lineWidth = sw;
			ctx.strokeStyle = stroke;
			ctx.strokeText(text, x, y);
			ctx.fillStyle = fill;
			ctx.fillText(text, x, y);
		};
		outline("ひっこぬけ！", w / 2, 60, 64, "#fff6d8", "#5b1638", 14);
		const g = ctx.createLinearGradient(0, 110, 0, 230);
		g.addColorStop(0, "#ff8fb8");
		g.addColorStop(0.5, "#c2326f");
		g.addColorStop(1, "#7c1c48");
		ctx.font = "bold 128px IPAGothic";
		ctx.lineJoin = "round";
		ctx.lineWidth = 26;
		ctx.strokeStyle = "#fff6d8";
		ctx.strokeText("おいもチキン", w / 2, 170);
		ctx.lineWidth = 12;
		ctx.strokeStyle = "#3a0c22";
		ctx.strokeText("おいもチキン", w / 2, 170);
		ctx.fillStyle = g;
		ctx.fillText("おいもチキン", w / 2, 170);
	});

	// ---- アイコン(投稿用、320x320) ----
	make("icon", 320, 320, (ctx, w, h) => {
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, "#ffb36b");
		g.addColorStop(0.45, "#ffe0a8");
		g.addColorStop(0.45, "#8a5a36");
		g.addColorStop(1, "#4a2c18");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);
		for (let i = 0; i < 10; i++) momiji(ctx, rnd() * w, rnd() * 130, 12, rnd() * 6, i % 2 ? "#e0452f" : "#f08a2e");
		ctx.strokeStyle = "#e6c79a";
		ctx.lineWidth = 6;
		ctx.beginPath(); ctx.moveTo(160, 140); ctx.lineTo(160, 300); ctx.stroke();
		ctx.save(); ctx.translate(100, 170); imo(ctx, 110, 74, "#b8316b", "#7c1c48", false); ctx.restore();
		ctx.save(); ctx.translate(120, 225); imo(ctx, 90, 60, "#f4c430", "#c98d12", true); ctx.restore();
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = "bold 58px IPAGothic";
		ctx.lineJoin = "round";
		ctx.lineWidth = 12;
		ctx.strokeStyle = "#3a0c22";
		ctx.strokeText("いもチキ", w / 2, 62);
		ctx.fillStyle = "#fff6d8";
		ctx.fillText("いもチキ", w / 2, 62);
	});
	return out;
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	await page.setContent("<html><body></body></html>");
	const images = await page.evaluate(drawAll);
	await browser.close();
	for (const [name, url] of Object.entries(images)) {
		const buf = Buffer.from(url.split(",")[1], "base64");
		const dest = name === "icon" ? path.join(__dirname, "..", "submission", "icon.png") : path.join(OUT, name + ".png");
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.writeFileSync(dest, buf);
		console.log("wrote", path.relative(process.cwd(), dest), buf.length);
	}
})();
