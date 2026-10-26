// ポップでかわいいドット絵を作る(迷彩服のどうぶつ・敵・お城・背景・ロゴ・アイコン)
// 小さなキャンバスに点で描いてから、にじまないように4倍に拡大する
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "image");
const course = JSON.parse(fs.readFileSync(path.join(__dirname, "course.json"), "utf8"));

function build(course) {
	const out = {};
	const S = 4; // 拡大の倍率
	const OL = "#3a2030"; // ふちどり
	let seed = 11;
	const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
	class Art {
		constructor(w, h) {
			this.w = w; this.h = h;
			this.c = document.createElement("canvas"); this.c.width = w; this.c.height = h;
			this.x = this.c.getContext("2d");
		}
		rect(x, y, w, h, col) { this.x.fillStyle = col; this.x.fillRect(x, y, w, h); return this; }
		px(x, y, col) { return this.rect(x, y, 1, 1, col); }
		oval(cx, cy, rx, ry, col, cond) {
			for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
				const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
				if (dx * dx + dy * dy <= 1 && (!cond || cond(x, y))) this.px(x, y, col);
			}
			return this;
		}
		ring(cx, cy, r, th, col) {
			for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
				const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
				if (d <= r && d > r - th) this.px(x, y, col);
			}
			return this;
		}
		alpha() { return this.x.getImageData(0, 0, this.w, this.h).data; }
		outline(col) {
			const a = this.alpha(), w = this.w, h = this.h;
			const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 100;
			this.x.fillStyle = col || OL;
			for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
				if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) this.x.fillRect(x, y, 1, 1);
			}
			return this;
		}
		// アンチエイリアスの線をくっきりさせる
		crisp() {
			const d = this.x.getImageData(0, 0, this.w, this.h);
			for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
			this.x.putImageData(d, 0, 0);
			return this;
		}
		big(s) {
			const c = document.createElement("canvas"); c.width = this.w * s; c.height = this.h * s;
			const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(this.c, 0, 0, c.width, c.height);
			return c;
		}
		save(name, s) { out[name] = this.big(s || S).toDataURL("image/png"); }
	}
	const CAMO = ["#8aaa58", "#5a7a3a", "#b89a60", "#3c4c2a"];
	const camoFill = (a, test) => {
		for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (test(x, y)) a.px(x, y, CAMO[0]);
		for (let i = 0; i < a.w * a.h / 7; i++) {
			const x = Math.floor(rnd() * a.w), y = Math.floor(rnd() * a.h), col = CAMO[1 + (i % 3)];
			[[0, 0], [1, 0], [0, 1]].forEach((d) => { if (test(x + d[0], y + d[1])) a.px(x + d[0], y + d[1], col); });
		}
	};
	const eyes = (a, x1, x2, y) => {
		[x1, x2].forEach((x) => { a.rect(x, y, 2, 2, "#2a1a20"); a.px(x, y, "#ffffff"); });
	};
	const blush = (a, x1, x2, y) => { a.rect(x1, y, 2, 1, "#ff8aa8"); a.rect(x2, y, 2, 1, "#ff8aa8"); };
	// どうぶつの体: 25x25 の下の方。迷彩の服とくつ
	const body = (a) => {
		camoFill(a, (x, y) => y >= 15 && y <= 21 && x >= 7 && x <= 17 && !((y === 15 || y === 21) && (x === 7 || x === 17)));
		a.rect(11, 17, 3, 1, "#f0d040"); // 名札
		a.rect(7, 22, 4, 2, "#6a4a30"); a.rect(14, 22, 4, 2, "#6a4a30");
	};
	const helmet = (a, cx, top, w) => {
		camoFill(a, (x, y) => y >= top && y <= top + 4 && Math.abs(x + 0.5 - cx) <= w - (y === top ? 2 : y === top + 1 ? 1 : 0));
		a.rect(Math.round(cx - w - 1), top + 4, w * 2 + 2, 1, "#4a5a2c");
	};
	const arts = {};
	const unit = (name, draw) => { const a = new Art(25, 25); draw(a); a.outline(); a.save(name); arts[name] = a.c; };

	// ======== みかたのどうぶつ(25x25) ========
	unit("u_chick", (a) => {
		body(a);
		a.oval(12.5, 10, 7.5, 6.5, "#ffe040");
		a.oval(9, 12.5, 2, 1, "#fff6a0");
		eyes(a, 9, 14, 9); blush(a, 7, 16, 12);
		a.rect(11, 11, 3, 1, "#ff9a2a"); a.px(12, 12, "#ff9a2a");
		helmet(a, 12.5, 2, 7);
	});
	unit("u_rabbit", (a) => {
		body(a);
		[8, 15].forEach((x) => { a.rect(x, 0, 3, 7, "#ffffff"); a.rect(x + 1, 1, 1, 5, "#ffb0c8"); });
		a.oval(12.5, 10.5, 7.5, 6.5, "#ffffff");
		eyes(a, 9, 14, 9); blush(a, 7, 16, 12);
		a.px(12, 11, "#ff7a9a");
		// ベレー帽
		camoFill(a, (x, y) => y >= 4 && y <= 5 && x >= 6 && x <= 17);
		a.rect(15, 3, 2, 1, "#3c4c2a");
	});
	unit("u_penguin", (a) => {
		body(a);
		a.oval(12.5, 10, 8, 7, "#2a3a5a");
		a.oval(12.5, 11.5, 5.5, 4.5, "#ffffff");
		eyes(a, 9, 14, 9); blush(a, 7, 16, 12);
		a.rect(11, 12, 3, 1, "#ffa02a");
		helmet(a, 12.5, 2, 7);
		a.px(9, 18, "#7ad8ff"); a.px(8, 18, "#7ad8ff"); a.px(9, 17, "#7ad8ff");
	});
	unit("u_elephant", (a) => {
		body(a);
		[[4, 10], [21, 10]].forEach((q) => { a.oval(q[0], q[1], 3.5, 4.5, "#a8b4cc"); a.oval(q[0], q[1], 2, 3, "#f8b8c8"); });
		a.oval(12.5, 10, 7, 6.5, "#b8c4d8");
		a.rect(11, 12, 3, 4, "#b8c4d8"); a.rect(12, 16, 3, 1, "#b8c4d8");
		eyes(a, 9, 14, 8); blush(a, 7, 16, 11);
		helmet(a, 12.5, 2, 6);
	});
	unit("u_lion", (a) => {
		body(a);
		a.oval(12.5, 10.5, 10, 9, "#e07a2a");
		for (let k = 0; k < 12; k++) { const t = k / 12 * Math.PI * 2; a.px(Math.round(12 + Math.cos(t) * 9), Math.round(10 + Math.sin(t) * 8), "#f09a3a"); }
		a.oval(12.5, 11, 6, 5.5, "#ffd27a");
		eyes(a, 9, 14, 9); blush(a, 8, 15, 12);
		a.rect(12, 12, 1, 1, "#6a3a20"); a.rect(11, 13, 3, 1, "#c86a3a");
		helmet(a, 12.5, 1, 5);
	});

	// ======== 敵 ========
	const enemy = (name, w, h, draw) => { const a = new Art(w, h); draw(a); a.outline(); a.save(name); arts[name] = a.c; };
	enemy("e_slime", 22, 20, (a) => {
		a.oval(11, 12.5, 9.5, 7, "#3aa8f0");
		a.oval(11, 8, 6, 5, "#3aa8f0");
		a.oval(11, 9, 5, 4, "#6ad0ff");
		a.rect(6, 7, 2, 2, "#ffffff");
		eyes(a, 7, 13, 11);
		a.rect(10, 15, 2, 1, "#1a5a9a");
		a.rect(4, 18, 14, 1, "#2a88d0");
	});
	enemy("e_goblin", 24, 25, (a) => {
		a.rect(7, 21, 4, 3, "#6a4a30"); a.rect(13, 21, 4, 3, "#6a4a30");
		a.rect(7, 14, 10, 8, "#a8743a"); a.rect(7, 18, 10, 1, "#7a4a2a");
		// こん棒
		a.rect(18, 8, 2, 12, "#9a6a3a"); a.oval(19, 8, 2.5, 3, "#9a6a3a");
		// 耳
		for (let k = 0; k < 4; k++) { a.rect(2 + k, 6 + k, 1, 2, "#6ac04a"); a.rect(21 - k, 6 + k, 1, 2, "#6ac04a"); }
		a.oval(12, 9, 6.5, 6, "#7ad05a");
		[9, 14].forEach((x) => { a.rect(x, 8, 2, 2, "#fff6a0"); a.px(x + 1, 9, "#2a1a20"); });
		a.rect(10, 12, 4, 1, "#3a2030"); a.px(10, 13, "#ffffff"); a.px(13, 13, "#ffffff");
	});
	enemy("e_devil", 28, 24, (a) => {
		// つばさ
		for (let k = 0; k < 6; k++) { a.rect(1 + k, 6 + k, 1, 7 - k, "#5a3a7a"); a.rect(26 - k, 6 + k, 1, 7 - k, "#5a3a7a"); }
		a.rect(7, 10, 2, 4, "#5a3a7a"); a.rect(19, 10, 2, 4, "#5a3a7a");
		// しっぽ
		a.rect(17, 19, 5, 1, "#3a2050"); a.rect(22, 16, 1, 4, "#3a2050"); a.rect(21, 15, 3, 2, "#e03a6a");
		a.oval(14, 13, 6.5, 7, "#b04ad0");
		a.oval(14, 15, 4, 3.5, "#d08ae8");
		// つの
		a.rect(9, 4, 2, 3, "#fff0b0"); a.rect(17, 4, 2, 3, "#fff0b0"); a.px(9, 3, "#fff0b0"); a.px(18, 3, "#fff0b0");
		[10, 16].forEach((x) => { a.rect(x, 11, 2, 2, "#ffffff"); a.px(x + 1, 12, "#e01a3a"); });
		a.rect(12, 15, 4, 1, "#3a1a4a"); a.px(12, 16, "#ffffff"); a.px(15, 16, "#ffffff");
	});
	enemy("e_witch", 26, 30, (a) => {
		// ほうき
		a.rect(2, 22, 20, 2, "#8a5a2a"); a.rect(20, 20, 5, 6, "#f0c050");
		// ローブ
		for (let y = 14; y < 27; y++) { const w = 4 + Math.floor((y - 14) / 2); a.rect(13 - w, y, w * 2, 1, "#7a40c0"); }
		a.rect(9, 20, 8, 1, "#f0c050");
		// 顔と髪
		a.oval(13, 13, 5, 4.5, "#ffd8b8");
		a.rect(7, 11, 2, 6, "#ff7a3a"); a.rect(17, 11, 2, 6, "#ff7a3a");
		a.rect(10, 12, 2, 2, "#3a1a50"); a.rect(15, 12, 2, 2, "#3a1a50"); a.px(10, 12, "#ffffff"); a.px(15, 12, "#ffffff");
		blush(a, 9, 16, 15);
		// ぼうし
		a.rect(5, 9, 16, 2, "#2a1a3a");
		for (let y = 0; y < 9; y++) { const w = Math.max(1, Math.floor(y / 1.6) + 1); a.rect(14 - w + Math.floor((9 - y) / 3), y, w * 2, 1, "#2a1a3a"); }
		a.rect(9, 8, 8, 1, "#f0c050");
	});
	enemy("e_ogre", 36, 36, (a) => {
		a.rect(9, 31, 6, 4, "#6a3a24"); a.rect(21, 31, 6, 4, "#6a3a24");
		a.oval(18, 24, 12, 9, "#e8603a");
		a.rect(8, 26, 20, 4, "#8a6a3a"); a.rect(8, 26, 20, 1, "#a88a4a");
		// こん棒
		a.rect(30, 8, 4, 20, "#9a6a3a"); a.oval(32, 9, 3.5, 5, "#9a6a3a");
		a.px(31, 7, "#e0e0e8"); a.px(33, 11, "#e0e0e8");
		a.oval(18, 12, 9, 8, "#f07a4a");
		a.rect(10, 1, 2, 5, "#fff0c0"); a.rect(24, 1, 2, 5, "#fff0c0"); a.px(11, 0, "#fff0c0"); a.px(24, 0, "#fff0c0");
		[13, 21].forEach((x) => { a.rect(x, 10, 3, 3, "#ffffff"); a.rect(x + 1, 11, 2, 2, "#2a1a20"); });
		a.rect(12, 9, 4, 1, "#3a2030"); a.rect(20, 9, 4, 1, "#3a2030");
		a.rect(14, 15, 8, 2, "#5a1a1a"); a.px(15, 15, "#ffffff"); a.px(20, 15, "#ffffff");
	});

	// ======== お城とパンダの王様(75x75) ========
	const castleArt = new Art(75, 75);
	{
		const a = castleArt;
		a.oval(37.5, 70, 32, 4, "rgba(0,0,0,0.2)");
		const tower = (l, t, w, h) => {
			a.rect(l, t, w, h, "#fff4e4"); a.rect(l + w - 2, t, 2, h, "#f0d8c8");
			for (let k = 0; k < w; k += 4) a.rect(l + k, t - 2, 2, 2, "#fff4e4");
			for (let y = 0; y < 10; y++) { const ww = Math.max(1, Math.round((w + 4) * (y + 1) / 10 / 2)); a.rect(l + w / 2 - ww, t - 12 + y, ww * 2, 1, "#ff8aaa"); }
			a.rect(l + w / 2 - 2, t + 6, 4, 6, "#7ac8ff");
		};
		tower(6, 36, 16, 32); tower(53, 36, 16, 32);
		a.rect(18, 40, 39, 28, "#fffaf0"); a.rect(53, 40, 2, 28, "#f0d8c8");
		for (let k = 0; k < 39; k += 5) a.rect(18 + k, 37, 3, 3, "#fffaf0");
		a.rect(33, 54, 9, 14, "#b06a3a"); a.oval(37.5, 54, 4.5, 4, "#b06a3a");
		a.rect(37, 54, 1, 14, "#8a4a2a");
		// 旗
		[[14, 13, "#ffd040"], [61, 13, "#5ad0ff"]].forEach((q) => { a.rect(q[0], q[1], 1, 12, OL); a.rect(q[0] + 1, q[1], 6, 2, q[2]); a.rect(q[0] + 1, q[1] + 2, 4, 2, q[2]); });
		// パンダの王様
		a.rect(28, 30, 19, 9, "#e03a4a"); a.rect(28, 30, 19, 1, "#ff6a7a");
		a.oval(37.5, 33, 6, 5, "#ffffff");
		a.oval(29, 15, 3, 3, "#2a2a32"); a.oval(46, 15, 3, 3, "#2a2a32");
		a.oval(37.5, 22, 10, 8.5, "#ffffff");
		a.oval(33, 22, 2.5, 3, "#2a2a32"); a.oval(42, 22, 2.5, 3, "#2a2a32");
		a.px(33, 21, "#ffffff"); a.px(42, 21, "#ffffff");
		a.rect(36, 25, 3, 2, "#2a2a32"); a.rect(30, 25, 2, 1, "#ff9ab0"); a.rect(44, 25, 2, 1, "#ff9ab0");
		// かんむり
		a.rect(31, 11, 13, 4, "#ffd040"); a.rect(31, 8, 2, 3, "#ffd040"); a.rect(36, 7, 3, 4, "#ffd040"); a.rect(42, 8, 2, 3, "#ffd040");
		a.px(37, 12, "#e03a4a"); a.px(33, 12, "#3a8ae0"); a.px(41, 12, "#3ac06a");
		a.outline();
		a.save("castle");
	}

	// ======== 背景(320x180 を4倍) ========
	{
		const a = new Art(320, 180);
		a.rect(0, 0, 320, 180, "#8ad860");
		for (let y = 0; y < 180; y += 2) for (let x = (y / 2) % 2 ? 0 : 2; x < 320; x += 4) if (rnd() < 0.5) a.px(x, y, "#80d058");
		for (let i = 0; i < 160; i++) { const x = Math.floor(rnd() * 320), y = Math.floor(rnd() * 180); a.px(x, y, "#5aa840"); a.px(x + 1, y - 1, "#5aa840"); }
		// 道(線を引いてから、くっきりさせる)
		const road = (w, col) => {
			const r = new Art(320, 180);
			r.x.lineJoin = "round"; r.x.lineCap = "round"; r.x.lineWidth = w; r.x.strokeStyle = col;
			course.paths.forEach((p) => {
				r.x.beginPath(); r.x.moveTo(p[0][0] / 4, p[0][1] / 4);
				for (let k = 1; k < p.length; k++) r.x.lineTo(p[k][0] / 4, p[k][1] / 4);
				r.x.lineTo(course.castle[0] / 4, course.castle[1] / 4); r.x.stroke();
			});
			r.crisp();
			a.x.drawImage(r.c, 0, 0);
		};
		road(18, "#c89058"); road(15, "#f4d898");
		for (let i = 0; i < 400; i++) {
			const x = Math.floor(rnd() * 320), y = Math.floor(rnd() * 180);
			const d = a.x.getImageData(x, y, 1, 1).data;
			if (d[0] === 0xf4 && d[1] === 0xd8) a.px(x, y, "#e0bc78");
		}
		// お城の広場
		a.oval(160, 87, 36, 23, "#c89058"); a.oval(160, 87, 34, 21, "#f4d898");
		for (let k = 0; k < 40; k++) { const t = k / 40 * Math.PI * 2; a.px(Math.round(160 + Math.cos(t) * 26), Math.round(87 + Math.sin(t) * 15), "#e8c888"); }
		const free = (x, y) => { const d = a.x.getImageData(x, y, 1, 1).data; return d[1] > 190 && d[0] < 160; };
		// 花
		for (let i = 0; i < 90; i++) {
			const x = 2 + Math.floor(rnd() * 316), y = 2 + Math.floor(rnd() * 176);
			if (!free(x, y) || !free(x + 2, y + 2) || !free(x - 2, y - 2)) continue;
			const col = ["#ff8aaa", "#ffffff", "#ffd040", "#a8c8ff"][i % 4];
			a.px(x - 1, y, col); a.px(x + 1, y, col); a.px(x, y - 1, col); a.px(x, y + 1, col); a.px(x, y, "#ffe040");
		}
		// 木
		const tree = (x, y) => {
			a.oval(x, y + 9, 7, 2, "rgba(0,0,0,0.18)");
			a.rect(x - 1, y + 2, 3, 7, "#8a5a32");
			a.oval(x + 0.5, y, 7, 6, "#3a9a40"); a.oval(x - 1.5, y - 2, 3, 2.5, "#6ad060");
		};
		[[16, 12], [300, 16], [306, 74], [12, 108], [34, 160], [296, 168], [190, 162], [118, 10], [240, 150], [60, 66]].forEach((q) => {
			if (free(q[0], q[1] + 4) && free(q[0] - 6, q[1]) && free(q[0] + 6, q[1])) tree(q[0], q[1]);
		});
		a.save("bg");
	}

	// ======== たま・こうか ========
	let a = new Art(5, 5); a.oval(2.5, 2.5, 2.5, 2.5, "#7ae04a"); a.px(1, 1, "#ffffff"); a.outline("#2a6a2a"); a.save("p_pea");
	a = new Art(11, 5); a.rect(0, 2, 2, 1, "#ff8a2a"); a.rect(2, 1, 5, 3, "#ff8a2a"); a.px(4, 2, "#e06a1a"); a.rect(7, 1, 2, 3, "#4ac04a"); a.px(9, 0, "#4ac04a"); a.px(9, 4, "#4ac04a"); a.outline(); a.save("p_carrot");
	a = new Art(7, 8); a.oval(3.5, 5, 3, 3, "#5ac8ff"); a.rect(3, 1, 1, 2, "#5ac8ff"); a.px(2, 4, "#ffffff"); a.outline("#1a5a9a"); a.save("p_water");
	a = new Art(7, 7); a.rect(3, 0, 1, 7, "#bff0ff"); a.rect(0, 3, 7, 1, "#bff0ff"); a.px(1, 1, "#bff0ff"); a.px(5, 5, "#bff0ff"); a.px(5, 1, "#bff0ff"); a.px(1, 5, "#bff0ff"); a.outline("#3a8ac0"); a.save("p_ice");
	a = new Art(50, 50); a.oval(25, 25, 24, 24, "rgba(255,255,255,0.2)"); a.ring(25, 25, 24.5, 1.2, "rgba(255,255,255,0.9)"); a.save("ring");
	a = new Art(50, 50); a.oval(25, 25, 24, 24, "rgba(255,80,80,0.18)"); a.ring(25, 25, 24.5, 1.2, "rgba(255,80,80,0.9)"); a.save("ring_ng");
	a = new Art(50, 50); a.ring(25, 25, 24, 2, "#ffd040"); a.ring(25, 25, 21, 1, "#fff0a0"); a.save("roar");
	a = new Art(50, 50); a.oval(25, 25, 22, 22, "rgba(90,200,255,0.3)"); a.ring(25, 25, 23, 2, "rgba(200,240,255,0.9)");
	for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; a.rect(Math.round(25 + Math.cos(t) * 18), Math.round(25 + Math.sin(t) * 18), 2, 2, "#ffffff"); }
	a.save("splash");
	a = new Art(20, 20); [[10, 10, 6], [5, 12, 4], [15, 12, 4], [10, 6, 4]].forEach((q) => a.oval(q[0], q[1], q[2], q[2], "#ffffff")); a.outline("#c0c0d8"); a.save("poof");
	a = new Art(11, 11); a.rect(5, 0, 1, 11, "#ffe040"); a.rect(0, 5, 11, 1, "#ffe040"); a.rect(3, 3, 5, 5, "#ffe040"); a.rect(4, 2, 3, 7, "#ffe040"); a.rect(2, 4, 7, 3, "#ffe040"); a.px(4, 4, "#ffffff"); a.outline("#c88a1a"); a.save("star");
	// 敵のたま: 火の玉・魔法・石
	a = new Art(9, 9); a.oval(4.5, 4.5, 4, 4, "#ff6a2a"); a.oval(4.5, 5, 2.5, 2.5, "#ffd040"); a.px(3, 3, "#ffffff"); a.outline("#a02a10"); a.save("e_fire");
	a = new Art(9, 9); a.oval(4.5, 4.5, 3.5, 3.5, "#c060ff"); a.rect(4, 0, 1, 9, "#f0b0ff"); a.rect(0, 4, 9, 1, "#f0b0ff"); a.px(4, 4, "#ffffff"); a.outline("#5a2090"); a.save("e_magic");
	a = new Art(8, 7); a.oval(4, 3.5, 3.5, 3, "#9a9098"); a.px(3, 2, "#d0c8d0"); a.outline(); a.save("e_rock");
	// パレットのカード 37x26
	const card = (name, fill, line) => {
		const c = new Art(37, 26);
		c.rect(1, 0, 35, 26, line); c.rect(0, 1, 37, 24, line);
		c.rect(2, 1, 33, 24, fill); c.rect(1, 2, 35, 22, fill);
		c.save(name);
	};
	card("card", "#fff8e8", "#6a4030"); card("card_on", "#fff0a0", "#ff6a3a");

	// ======== ロゴ(120x120 を4倍) ========
	{
		const lg = new Art(120, 120);
		lg.x.drawImage(castleArt.c, 22, -5);
		// お城の両わきに、迷彩のひよことライオン
		lg.x.drawImage(arts.u_chick, 1, 37); lg.x.drawImage(arts.u_lion, 94, 37);
		const word = (t, y, size, top, bottom, line, outer, thick) => {
			const w = new Art(120, 40);
			w.x.font = "bold " + size + "px IPAGothic"; w.x.textAlign = "center"; w.x.textBaseline = "middle"; w.x.fillStyle = "#000";
			w.x.fillText(t, 60, 20);
			const d = w.x.getImageData(0, 0, 120, 40);
			for (let yy = 0; yy < 40; yy++) for (let xx = 0; xx < 120; xx++) {
				const i = (yy * 120 + xx) * 4;
				if (d.data[i + 3] > 110) {
					const c = yy < 20 ? top : bottom;
					d.data[i] = parseInt(c.slice(1, 3), 16); d.data[i + 1] = parseInt(c.slice(3, 5), 16); d.data[i + 2] = parseInt(c.slice(5, 7), 16); d.data[i + 3] = 255;
				} else d.data[i + 3] = 0;
			}
			w.x.putImageData(d, 0, 0);
			if (thick) {
				// 文字を1ドット太くする
				const t2 = new Art(120, 40); t2.x.drawImage(w.c, 0, 0);
				[[1, 0], [0, 1], [1, 1]].forEach((o) => w.x.drawImage(t2.c, o[0], o[1]));
			}
			if (line) w.outline(line);
			w.outline(outer || OL);
			lg.x.drawImage(w.c, 0, y - 20);
		};
		// リボン(まもれ！)
		const rb = new Art(120, 120);
		rb.rect(1, 66, 12, 12, "#c03a6a"); rb.rect(107, 66, 12, 12, "#c03a6a");
		rb.rect(1, 70, 3, 4, "rgba(0,0,0,0)"); rb.x.clearRect(1, 70, 3, 4); rb.x.clearRect(116, 70, 3, 4);
		rb.rect(9, 61, 102, 14, "#ff6a9a"); rb.rect(9, 61, 102, 2, "#ff9ab8"); rb.rect(9, 73, 102, 2, "#e04a7a");
		rb.rect(9, 75, 4, 3, "#8a2a4a"); rb.rect(107, 75, 4, 3, "#8a2a4a");
		rb.outline();
		lg.x.drawImage(rb.c, 0, 0);
		word("まもれ！", 68, 15, "#ffffff", "#fff0f6", "", "#8a2a4a");
		word("パンダ城", 98, 28, "#c8ff90", "#4ab84a", "#ffffff", OL, true);
		lg.save("logo");
		// アイコン(80x80 を4倍・透過なし)
		const ic = new Art(80, 80);
		for (let y = 0; y < 80; y++) ic.rect(0, y, 80, 1, y < 40 ? (y % 4 < 2 ? "#a8e0ff" : "#b8e8ff") : (y % 4 < 2 ? "#8ad860" : "#80d058"));
		ic.oval(40, 70, 36, 8, "#f4d898");
		ic.x.drawImage(castleArt.c, 2, -8);
		ic.x.drawImage(arts.u_chick, -3, 20); ic.x.drawImage(arts.u_lion, 58, 20);
		// 下に題字「パンダ城」(太いドット文字)
		const tw = new Art(80, 26);
		tw.x.font = "bold 19px IPAGothic"; tw.x.textAlign = "center"; tw.x.textBaseline = "middle"; tw.x.fillStyle = "#000";
		tw.x.fillText("パンダ城", 40, 13);
		const td2 = tw.x.getImageData(0, 0, 80, 26);
		for (let yy = 0; yy < 26; yy++) for (let xx = 0; xx < 80; xx++) {
			const i = (yy * 80 + xx) * 4;
			if (td2.data[i + 3] > 110) {
				const top = yy < 13;
				td2.data[i] = top ? 0xc8 : 0x4a; td2.data[i + 1] = top ? 0xff : 0xb8; td2.data[i + 2] = top ? 0x90 : 0x4a; td2.data[i + 3] = 255;
			} else td2.data[i + 3] = 0;
		}
		tw.x.putImageData(td2, 0, 0);
		const tw2 = new Art(80, 26); tw2.x.drawImage(tw.c, 0, 0); tw.x.drawImage(tw2.c, 1, 0);
		tw.outline("#ffffff"); tw.outline(OL);
		// リボン「まもれ！」
		const ir = new Art(80, 80);
		// 紫よりのピンク
		ir.rect(1, 45, 8, 9, "#8a3aa8"); ir.rect(71, 45, 8, 9, "#8a3aa8");
		ir.x.clearRect(1, 48, 2, 3); ir.x.clearRect(77, 48, 2, 3);
		ir.rect(6, 41, 68, 12, "#c85ac8"); ir.rect(6, 41, 68, 2, "#e08ae0"); ir.rect(6, 51, 68, 2, "#a040a8");
		ir.outline();
		ic.x.drawImage(ir.c, 0, 0);
		const mw = new Art(80, 16);
		mw.x.font = "bold 12px IPAGothic"; mw.x.textAlign = "center"; mw.x.textBaseline = "middle"; mw.x.fillStyle = "#ffffff";
		mw.x.fillText("まもれ！", 40, 8);
		mw.crisp(); mw.outline("#5a2070");
		ic.x.drawImage(mw.c, 0, 39);
		ic.x.drawImage(tw.c, 0, 56);
		out.icon = ic.big(4).toDataURL("image/png");
	}
	return out;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build, course);
	await b.close();
	Object.keys(res).forEach((k) => fs.writeFileSync(k === "icon" ? path.join(ROOT, "icon.png") : path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64")));
	console.log("wrote", Object.keys(res).length, "images");
})();
