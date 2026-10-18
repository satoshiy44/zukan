// ドット絵の画像を作る。小さなキャンバスに点で描いてから、にじまないように整数倍で拡大する
// 使い方: node tools/gen-images.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");

function build() {
	const out = {};
	const OL = "#201018"; // ふちどりの色
	class Art {
		constructor(w, h) {
			this.w = w; this.h = h;
			this.c = document.createElement("canvas"); this.c.width = w; this.c.height = h;
			this.x = this.c.getContext("2d");
		}
		rect(x, y, w, h, col) { this.x.fillStyle = col; this.x.fillRect(x, y, w, h); return this; }
		px(x, y, col) { return this.rect(x, y, 1, 1, col); }
		// 楕円(ドットでくっきり)
		oval(cx, cy, rx, ry, col) {
			for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
				for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
					const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
					if (dx * dx + dy * dy <= 1) this.px(x, y, col);
				}
			}
			return this;
		}
		alpha() { return this.x.getImageData(0, 0, this.w, this.h).data; }
		// まわりに1ドットのふちどりをつける
		outline(col) {
			const a = this.alpha(), w = this.w, h = this.h;
			const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 100;
			this.x.fillStyle = col || OL;
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) this.x.fillRect(x, y, 1, 1);
				}
			}
			return this;
		}
		// 不透明な部分の形(0/1)を返す
		mask() {
			const a = this.alpha();
			const m = [];
			for (let i = 0; i < this.w * this.h; i++) m.push(a[i * 4 + 3] > 100 ? 1 : 0);
			return m;
		}
		save(name, s) {
			const c = document.createElement("canvas");
			c.width = this.w * s; c.height = this.h * s;
			const x = c.getContext("2d");
			x.imageSmoothingEnabled = false;
			x.drawImage(this.c, 0, 0, c.width, c.height);
			out[name] = c.toDataURL("image/png");
		}
	}
	const P = 4; // 1ドット = 画面4px(いちばん手前で)

	// ======== 角刈りの男(うしろ姿) 38x82 ========
	const SKIN = "#f4b888", SKIN_D = "#d88c60", HAIR = "#202028", HAIR_L = "#4a4a5a";
	const SHIRT = "#e83828", SHIRT_D = "#a81c18", PANTS = "#2850d0", PANTS_D = "#1a3490";
	const SOCK = "#ffffff", SHOE = "#f0e040", SHOE_D = "#c8a020";
	const man = (pose) => {
		const a = new Art(38, 82);
		const o = 1;
		const R = (x, y, w, h, c) => a.rect(x + o, y + o, w, h, c);
		// 腕
		const arm = (x, y, len, up) => {
			if (up) { R(x, y - len, 5, len + 4, SKIN); R(x + 3, y - len, 2, len + 4, SKIN_D); R(x - 1, y - 2, 6, 6, SHIRT); }
			else { R(x, y, 5, len, SKIN); R(x + 3, y, 2, len, SKIN_D); R(x - 1, y - 1, 6, 8, SHIRT); R(x + 3, y - 1, 2, 8, SHIRT_D); }
		};
		const swing = pose === "run0" ? 3 : pose === "run1" ? -3 : 0;
		if (pose === "jump") { arm(3, 20, 18, true); arm(30, 20, 18, true); }
		else { arm(3, 20 + swing, 21, false); arm(30, 20 - swing, 21, false); }
		// 足
		const leg = (x, top, len) => {
			R(x, top, 6, len, SKIN); R(x + 4, top, 2, len, SKIN_D);
			R(x, top + len, 6, 4, SOCK);
			R(x - 1, top + len + 4, 8, 5, SHOE); R(x - 1, top + len + 7, 8, 2, SHOE_D);
		};
		if (pose === "jump") { leg(10, 53, 9); leg(21, 53, 9); }
		else if (pose === "run0") { leg(10, 53, 18); leg(21, 53, 11); }
		else if (pose === "run1") { leg(10, 53, 11); leg(21, 53, 18); }
		else { leg(10, 53, 16); leg(21, 53, 16); }
		// 胴(赤いシャツ)と短パン
		R(7, 18, 23, 27, SHIRT); R(6, 20, 25, 20, SHIRT); R(24, 18, 6, 27, SHIRT_D); R(25, 20, 6, 20, SHIRT_D);
		R(12, 24, 1, 14, SHIRT_D); // 背中のしわ
		R(8, 44, 21, 11, PANTS); R(23, 44, 6, 11, PANTS_D); R(18, 49, 1, 6, PANTS_D);
		// 首と頭(うしろから: 角刈りの四角い頭)
		R(14, 14, 9, 6, SKIN); R(19, 14, 4, 6, SKIN_D);
		R(9, 6, 2, 6, SKIN); R(26, 6, 2, 6, SKIN); // 耳
		R(11, 0, 15, 16, HAIR); R(12, 0, 13, 2, HAIR_L); R(11, 13, 15, 3, "#2c2c36");
		R(13, 3, 1, 9, HAIR_L); R(17, 3, 1, 10, HAIR_L); R(21, 3, 1, 9, HAIR_L);
		a.outline();
		return a;
	};
	const poses = { run0: man("run0"), run1: man("run1"), jump: man("jump"), stand: man("stand") };
	Object.keys(poses).forEach((k) => poses[k].save("man_" + k, P));
	// 前にころんだ男(うしろから: くつの裏が手前、頭は奥) 38x82 の下の方だけ使う
	const fall = new Art(38, 82);
	const FR = (x, y, w, h, c) => fall.rect(x + 1, y + 1, w, h, c);
	FR(13, 40, 11, 6, HAIR); FR(14, 40, 9, 1, HAIR_L); // 頭(奥)
	FR(4, 44, 6, 10, SKIN); FR(27, 44, 6, 10, SKIN_D); // バンザイの腕
	FR(8, 45, 21, 15, SHIRT); FR(23, 45, 6, 15, SHIRT_D);
	FR(9, 59, 19, 7, PANTS); FR(23, 59, 5, 7, PANTS_D);
	FR(10, 66, 6, 6, SKIN); FR(21, 66, 6, 6, SKIN_D);
	FR(8, 72, 9, 8, SHOE_D); FR(20, 72, 9, 8, SHOE_D); FR(9, 73, 7, 6, "#9a8a70"); FR(21, 73, 7, 6, "#9a8a70"); // くつの裏
	fall.outline(); fall.save("man_fall", P);

	// ======== ダンボールの板(型ぬき) ========
	// 横 4u(=320ドット)、縦 1.9u(=152ドット)。1u=80ドット
	const PW = 320, PH = 152, U = 80;
	const dilate = (m, w, h, r) => {
		const o = new Array(w * h).fill(0);
		for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
			if (!m[y * w + x]) continue;
			for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
				const X = x + dx, Y = y + dy;
				if (X >= 0 && Y >= 0 && X < w && Y < h && dx * dx + dy * dy <= r * r + 1) o[Y * w + X] = 1;
			}
		}
		return o;
	};
	// 型は首から上だけ(頭と首。高い型はバンザイの腕も)
	const NECK = 18; // 絵の上から何ドット目までが首か(その下は肩)
	const shape = (list, shrink, arms) => {
		const w = 38, h = 82;
		let m = new Array(w * h).fill(0);
		// 腕(肩)は入れない。バンザイの型だけ腕も入れる
		const ok = (i) => Math.floor(i / w) <= NECK && (arms || (i % w >= 9 && i % w <= 29));
		list.forEach((p) => { p.mask().forEach((v, i) => { if (v && ok(i)) m[i] = 1; }); });
		if (shrink) {
			// 子ども用: 首もとを中心に小さく縮める
			const s = new Array(w * h).fill(0);
			for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
				const sx = Math.round(19 + (x - 19) / shrink), sy = Math.round(NECK - (NECK - y) / shrink);
				if (sx >= 0 && sy >= 0 && sx < w && sy < h && sy <= NECK && m[sy * w + sx]) s[y * w + x] = 1;
			}
			m = s;
		}
		return { m: dilate(m, w, h, 1), w, h };
	};
	const groundShape = shape([poses.run0, poses.run1, poses.stand]);
	const jumpShape = shape([poses.jump], 0, true);
	const kidShape = shape([poses.stand], 0.65);
	// 頭の高さにだけある横長のダンボール(top〜bottom の行)
	const BOARD_UP = 12; // 頭のてっぺんより上の余白(ドット)
	const board = (top, bottom) => {
		const a = new Art(PW, PH);
		const hh = bottom - top;
		a.rect(0, top, PW, hh, "#d29a5c");
		for (let x = 0; x < PW; x += 4) a.rect(x, top, 1, hh, "#c48c50");
		for (let x = 2; x < PW; x += 4) a.rect(x, top, 1, hh, "#daa468");
		[[30, 6], [250, 20], [140, 4], [70, 24], [290, 10]].forEach((p) => a.oval(p[0], top + p[1], 9, 4, "rgba(150,96,50,0.35)"));
		// ガムテープ
		a.rect(0, top + 5, PW, 6, "#e8c890"); a.rect(0, top + 5, PW, 1, "#f8e0b0"); a.rect(0, top + 10, PW, 1, "#b88a50");
		// 天地無用の矢印
		const arrow = (x, y) => {
			a.rect(x + 3, y + 4, 3, 10, "#d02828"); a.rect(x + 1, y + 4, 7, 1, "#d02828");
			a.rect(x + 2, y + 3, 5, 1, "#d02828"); a.rect(x + 3, y + 2, 3, 1, "#d02828"); a.rect(x + 4, y + 1, 1, 1, "#d02828");
		};
		[[8, top + 14], [298, top + 14]].forEach((p) => { arrow(p[0], p[1]); arrow(p[0] + 7, p[1]); });
		// ふち
		a.rect(0, top, PW, 2, "#9a6a38"); a.rect(0, bottom - 2, PW, 2, "#8a5a30");
		return a;
	};
	// 形を板からくりぬく(cx = 型の真ん中のドット位置、bottom = 男の足もとの高さ)
	const cut = (a, s, cx, bottom) => {
		const ox = cx - 19, oy = PH - bottom - 82;
		const inside = (x, y) => {
			const X = x - ox, Y = y - oy;
			return X >= 0 && Y >= 0 && X < s.w && Y < s.h && s.m[Y * s.w + X] === 1;
		};
		const d = a.x.getImageData(0, 0, PW, PH);
		const H = (x, y) => x >= 0 && y >= 0 && x < PW && y < PH && inside(x, y);
		for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
			const i = (y * PW + x) * 4;
			if (d.data[i + 3] === 0) continue;
			if (H(x, y)) { d.data[i + 3] = 0; continue; }
			// 切り口: 左上は明るく、右下は暗く
			if (H(x + 1, y) || H(x, y + 1)) { d.data[i] = 0xf4; d.data[i + 1] = 0xd8; d.data[i + 2] = 0xa8; }
			else if (H(x - 1, y) || H(x, y - 1)) { d.data[i] = 0x7a; d.data[i + 1] = 0x4a; d.data[i + 2] = 0x22; }
		}
		a.x.putImageData(d, 0, 0);
	};
	const HIGH = 36; // 高い型のときの男の足もとの高さ(ドット) = 0.45u
	const boardFor = (bottom) => { const oy = PH - bottom - 82; return board(oy - BOARD_UP, oy + NECK + 1); };
	let a = boardFor(0); cut(a, groundShape, PW / 2, 0); a.save("panel_ground", P);
	a = boardFor(HIGH); cut(a, jumpShape, PW / 2, HIGH); a.save("panel_high", P);
	// 2つ穴: 片方は子ども用の小さな型(通れない)
	a = boardFor(0); cut(a, groundShape, PW / 2 - 32, 0); cut(a, kidShape, PW / 2 + 32, 0); a.save("panel_kid_r", P);
	a = boardFor(0); cut(a, groundShape, PW / 2 + 32, 0); cut(a, kidShape, PW / 2 - 32, 0); a.save("panel_kid_l", P);

	// 道に落ちている石 28x16 と、寝ているねこ 32x18(1u=80ドット)
	const rock = new Art(28, 16);
	rock.oval(14, 10, 12, 6, "#8a8a92"); rock.oval(11, 8, 7, 4, "#a8a8b0"); rock.oval(18, 12, 6, 3, "#6a6a72"); rock.px(9, 7, "#d0d0d8");
	rock.outline(); rock.save("rock", P);
	const cat = new Art(34, 20);
	cat.oval(16, 13, 13, 6, "#f0a040"); cat.oval(27, 11, 6, 5, "#f0a040"); // からだと頭
	cat.rect(23, 5, 2, 3, "#f0a040"); cat.rect(29, 5, 2, 3, "#f0a040"); // 耳
	for (let k = 0; k < 4; k++) cat.rect(8 + k * 5, 8, 2, 4, "#c87828"); // しましま
	cat.rect(25, 11, 2, 1, "#402010"); cat.rect(29, 11, 2, 1, "#402010"); // とじた目
	cat.oval(6, 16, 5, 2, "#f0a040"); // しっぽ
	cat.oval(16, 16, 8, 2, "#f8d8a0");
	cat.outline();
	cat.rect(30, 0, 3, 1, "#ffffff"); cat.rect(32, 1, 1, 1, "#ffffff"); cat.rect(30, 2, 3, 1, "#ffffff"); // Z
	cat.save("cat", P);
	// ダンボールのかけら
	a = new Art(14, 12);
	a.rect(1, 2, 11, 8, "#d29a5c"); a.rect(3, 1, 7, 1, "#d29a5c"); a.rect(2, 10, 6, 1, "#d29a5c");
	a.rect(4, 2, 1, 8, "#c48c50"); a.rect(8, 2, 1, 8, "#c48c50"); a.outline("#6a4220"); a.save("piece", 4);
	// 影
	a = new Art(30, 8); a.oval(15, 4, 15, 4, "rgba(0,0,0,0.35)"); a.save("shadow", P);
	// キラキラ
	a = new Art(13, 13);
	a.rect(6, 0, 1, 13, "#fff8a0"); a.rect(0, 6, 13, 1, "#fff8a0"); a.rect(5, 3, 3, 7, "#ffe040"); a.rect(3, 5, 7, 3, "#ffe040");
	a.rect(6, 5, 1, 3, "#ffffff"); a.rect(5, 6, 3, 1, "#ffffff"); a.save("spark", 4);
	// ぴよぴよの星
	a = new Art(9, 9);
	a.rect(4, 0, 1, 9, "#ffe040"); a.rect(0, 4, 9, 1, "#ffe040"); a.rect(3, 3, 3, 3, "#ffe040"); a.outline(); a.save("star", 4);

	// ======== 背景(320x80ドットを4倍) ========
	const BW = 320, BH = 80;
	const bands = (b, cols, y0, y1) => {
		const n = cols.length, step = (y1 - y0) / n;
		for (let i = 0; i < n; i++) {
			const ys = Math.round(y0 + i * step);
			b.rect(0, ys, BW, Math.ceil(step) + 1, cols[i]);
			if (i > 0) for (let x = (i % 2); x < BW; x += 2) b.px(x, ys, cols[i - 1]); // ディザ
		}
	};
	const cloud = (b, x, y, s, col, shade) => {
		b.oval(x, y, 7 * s, 4 * s, col); b.oval(x - 6 * s, y + 1 * s, 5 * s, 3 * s, col); b.oval(x + 7 * s, y + 1 * s, 5 * s, 3 * s, col);
		b.rect(Math.round(x - 10 * s), Math.round(y + 2 * s), Math.round(21 * s), 1, shade);
	};
	const hills = (b, y, col, amp, freq, ph) => {
		for (let x = 0; x < BW; x++) {
			const h = Math.round(y - amp * (0.6 + 0.4 * Math.sin(x * freq + ph)) - amp * 0.3 * Math.sin(x * freq * 2.7 + ph * 2));
			b.rect(x, h, 1, BH - h, col);
		}
	};
	const house = (b, x, y, w, h, wall, roof) => {
		b.rect(x, y, w, h, wall); b.rect(x + w - 2, y, 2, h, "rgba(0,0,0,0.15)");
		for (let i = 0; i < 4; i++) b.rect(x - 2 + i, y - 1 - i, w + 4 - i * 2, 1, roof);
		b.rect(x - 2, y - 1, w + 4, 1, roof);
		b.rect(x + 2, y + 2, 3, 3, "#80c8f0"); if (w > 12) b.rect(x + w - 6, y + 2, 3, 3, "#80c8f0");
	};
	// 昼の住宅街
	let b = new Art(BW, BH);
	bands(b, ["#3878e8", "#4890f0", "#60a8f8", "#80c0f8", "#a8d8f8"], 0, 64);
	cloud(b, 50, 16, 1.4, "#ffffff", "#c8e0f8"); cloud(b, 170, 10, 1.0, "#ffffff", "#c8e0f8"); cloud(b, 265, 22, 1.6, "#ffffff", "#c8e0f8");
	hills(b, 62, "#58b048", 10, 0.035, 1); hills(b, 70, "#3c9038", 6, 0.05, 3);
	[[8, 64, 16, 9, "#f8f0d8", "#e04040"], [40, 66, 20, 8, "#f8e8b8", "#3060d0"], [84, 63, 14, 10, "#fff8e8", "#30a050"],
		[132, 66, 18, 8, "#f0d8c0", "#e08030"], [178, 64, 16, 9, "#f8f0d8", "#7050c0"], [222, 66, 20, 8, "#f8e8b8", "#e04040"],
		[268, 63, 16, 10, "#fff8e8", "#3060d0"], [300, 66, 18, 8, "#f0d8c0", "#30a050"]].forEach((h) => house(b, h[0], h[1], h[2], h[3], h[4], h[5]));
	b.rect(0, 74, BW, 6, "#4a9a40");
	b.save("bg_day", 4);
	// 夕焼けの河原
	b = new Art(BW, BH);
	bands(b, ["#583890", "#a04890", "#e06070", "#f89058", "#f8c060", "#f8e090"], 0, 66);
	b.oval(240, 52, 12, 12, "#fff0a0"); b.oval(240, 52, 9, 9, "#fff8d0");
	cloud(b, 70, 18, 1.3, "#f8a8a0", "#c86880"); cloud(b, 180, 12, 1.0, "#f8b8a0", "#c86880");
	hills(b, 64, "#6a4878", 8, 0.03, 2);
	// 鉄橋
	b.rect(0, 52, BW, 3, "#402838");
	for (let x = 0; x < BW; x += 16) { b.rect(x, 44, 2, 11, "#402838"); for (let k = 0; k < 8; k++) b.px(x + 2 + k * 2, 44 + k, "#402838"); }
	b.rect(0, 44, BW, 2, "#402838");
	b.rect(0, 66, BW, 5, "#5890c8"); for (let x = 0; x < BW; x += 7) b.rect(x, 67 + (x % 3), 3, 1, "#f8c080");
	b.rect(0, 71, BW, 9, "#6a9a40");
	b.save("bg_river", 4);
	// 夜の商店街
	b = new Art(BW, BH);
	bands(b, ["#101838", "#182450", "#20306a", "#2c3c80"], 0, 60);
	for (let i = 0; i < 40; i++) b.px((i * 83) % BW, (i * 37) % 40, i % 3 ? "#f8f8c0" : "#a0c0ff");
	b.oval(60, 14, 7, 7, "#fff8c0"); b.oval(63, 12, 6, 6, "#182450");
	let bx = 0;
	const shopCols = ["#784878", "#486898", "#986848", "#487868", "#885058", "#586088"];
	for (let i = 0; bx < BW; i++) {
		const w = 22 + (i * 7) % 12, h = 22 + (i * 11) % 18, col = shopCols[i % shopCols.length];
		b.rect(bx, 74 - h, w, h, col); b.rect(bx + w - 2, 74 - h, 2, h, "rgba(0,0,0,0.25)");
		for (let wy = 74 - h + 3; wy < 64; wy += 6) for (let wx = bx + 3; wx < bx + w - 4; wx += 6) b.rect(wx, wy, 3, 3, (wx + wy) % 4 ? "#f8e070" : "#f8a040");
		b.rect(bx + 2, 66, w - 4, 3, ["#e04040", "#40a0e0", "#f0c040"][i % 3]); // 看板
		bx += w;
	}
	b.rect(0, 74, BW, 6, "#383050");
	b.save("bg_night", 4);

	// ======== 道ばたの物(手前ほど大きく描くので、1u=80ドットの4倍) ========
	const prop = (name, w, h, draw, s) => { const p = new Art(w, h); draw(p); p.outline(); p.save(name, s || P); };
	// 電柱 3u
	prop("pole", 18, 240, (p) => {
		p.rect(6, 0, 6, 240, "#9a9088"); p.rect(10, 0, 2, 240, "#7a706a");
		p.rect(0, 18, 18, 3, "#6a605a"); p.rect(2, 34, 14, 3, "#6a605a");
		p.rect(5, 90, 8, 20, "#f0f0f0"); p.rect(5, 90, 8, 4, "#e03030"); p.rect(5, 104, 8, 6, "#e03030");
	});
	// ブロック塀 1.2u
	prop("wall", 120, 70, (p) => {
		p.rect(0, 4, 120, 66, "#b8b8b0");
		for (let y = 4; y < 70; y += 8) { p.rect(0, y, 120, 1, "#8a8a84"); for (let x = (y / 8) % 2 ? 0 : 10; x < 120; x += 20) p.rect(x, y, 1, 8, "#8a8a84"); }
		p.rect(0, 0, 120, 5, "#d8d8d0");
		p.rect(20, 30, 14, 10, "#8a8a84"); p.rect(80, 30, 14, 10, "#8a8a84");
	});
	// 家 2.2u
	prop("house", 150, 176, (p) => {
		p.rect(10, 70, 130, 106, "#f8f0d8"); p.rect(118, 70, 22, 106, "#e0d4b8");
		for (let i = 0; i < 40; i++) p.rect(i * 2 - 4, 70 - i, 158 - i * 4, 2, i % 6 < 3 ? "#e04848" : "#c83838");
		p.rect(28, 96, 30, 26, "#80c8f0"); p.rect(28, 108, 30, 2, "#ffffff"); p.rect(42, 96, 2, 26, "#ffffff");
		p.rect(84, 112, 28, 64, "#a06838"); p.rect(106, 140, 3, 4, "#f0d040");
	});
	// 木 1.8u
	prop("tree", 110, 150, (p) => {
		p.rect(48, 90, 14, 60, "#8a5a30"); p.rect(56, 90, 6, 60, "#6a4220");
		p.oval(55, 50, 50, 45, "#3c9a3c"); p.oval(40, 38, 26, 22, "#58b84c"); p.oval(75, 62, 24, 20, "#2c7a30");
	});
	// ススキ 0.8u
	prop("susuki", 70, 64, (p) => {
		for (let i = 0; i < 9; i++) {
			const x = 6 + i * 7, h = 40 + (i * 13) % 20;
			p.rect(x, 64 - h, 2, h, "#9a8a40");
			p.oval(x + 1 + (i % 2 ? 3 : -3), 64 - h + 4, 3, 7, "#f0e0b0");
		}
	});
	// 看板 1.4u
	prop("sign", 90, 112, (p) => {
		p.rect(14, 40, 6, 72, "#7a706a"); p.rect(70, 40, 6, 72, "#7a706a");
		p.rect(0, 0, 90, 50, "#f8f8f0"); p.rect(4, 4, 82, 42, "#40a060");
		p.rect(14, 14, 62, 6, "#ffffff"); p.rect(14, 28, 44, 6, "#ffffff");
	});
	// 提灯の柱 2.6u
	prop("lantern", 50, 208, (p) => {
		p.rect(22, 20, 6, 188, "#5a5050");
		p.rect(4, 20, 42, 3, "#5a5050");
		[[10, 24], [40, 24]].forEach((c) => {
			p.rect(c[0] - 1, c[1], 2, 6, "#5a5050");
			p.oval(c[0], c[1] + 18, 9, 13, "#f04030"); p.oval(c[0] - 2, c[1] + 15, 4, 7, "#f88060");
			p.rect(c[0] - 6, c[1] + 6, 12, 2, "#202020"); p.rect(c[0] - 6, c[1] + 30, 12, 2, "#202020");
		});
	});
	// 自販機 1.4u
	prop("vending", 64, 112, (p) => {
		p.rect(0, 0, 64, 112, "#e03838"); p.rect(52, 0, 12, 112, "#b82828");
		p.rect(5, 6, 44, 46, "#d8f0f8");
		const cans = ["#f0c040", "#40a0e0", "#f06090", "#60c060"];
		for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) p.rect(8 + c * 8, 9 + r * 15, 6, 11, cans[(r + c) % 4]);
		p.rect(5, 60, 44, 8, "#f8f8f8"); p.rect(10, 88, 34, 14, "#202020");
	});
	// お店 2.4u
	prop("shop", 160, 192, (p) => {
		p.rect(0, 30, 160, 162, "#c89868"); p.rect(140, 30, 20, 162, "#a07850");
		for (let i = 0; i < 8; i++) p.rect(i * 20, 0, 20, 36, i % 2 ? "#f8f8f8" : "#e04848");
		p.rect(0, 34, 160, 4, "#802020");
		p.rect(14, 70, 130, 90, "#f8e070"); p.rect(14, 70, 130, 4, "#ffffff");
		for (let i = 0; i < 6; i++) p.rect(22 + i * 20, 120, 14, 40, ["#e04848", "#40a0e0", "#60c060"][i % 3]);
		p.rect(40, 44, 80, 20, "#2a2050"); p.rect(48, 50, 64, 8, "#f8e070");
	});

	// ======== ロゴ用の顔(前から) 40x44 ========
	const face = new Art(44, 50);
	const F = (x, y, w, h, c) => face.rect(x + 2, y + 2, w, h, c);
	F(2, 36, 36, 12, SHIRT); F(28, 36, 10, 12, SHIRT_D); F(14, 34, 12, 6, SKIN);
	F(5, 8, 30, 28, SKIN); F(29, 8, 6, 28, SKIN_D); F(3, 16, 3, 9, SKIN); F(34, 16, 3, 9, SKIN_D);
	F(5, 0, 30, 10, HAIR); F(6, 0, 28, 2, HAIR_L); F(5, 10, 3, 6, HAIR); F(32, 10, 3, 6, HAIR);
	F(9, 13, 9, 3, HAIR); F(22, 13, 9, 3, HAIR); // 太い眉
	F(11, 18, 5, 2, "#202020"); F(24, 18, 5, 2, "#202020"); // 細い目
	F(18, 20, 4, 5, SKIN_D);
	F(11, 27, 18, 5, "#a02020"); F(12, 27, 16, 2, "#ffffff"); // にっこり口
	F(8, 23, 4, 2, "#f88870"); F(28, 23, 4, 2, "#f88870");
	face.outline(); face.save("face", 8);

	// ======== タイトルロゴ(正方形) 120x120 を4倍。上に顔、下に2行の題字 ========
	const LS = 120;
	const lg = new Art(LS, LS);
	lg.x.font = "bold 28px IPAGothic"; lg.x.textAlign = "center"; lg.x.textBaseline = "middle"; lg.x.fillStyle = "#000";
	lg.x.fillText("かたぬき", LS / 2, 72);
	lg.x.fillText("ダッシュ", LS / 2, 102);
	// 文字をくっきりさせて色をぬる(各行の上は黄色、下はオレンジ)
	const td = lg.x.getImageData(0, 0, LS, LS);
	for (let y = 0; y < LS; y++) for (let x = 0; x < LS; x++) {
		const i = (y * LS + x) * 4;
		if (td.data[i + 3] > 110) {
			const top = (y < 87 ? y - 58 : y - 88) < 14;
			td.data[i] = 0xff; td.data[i + 1] = top ? 0xf0 : 0xa0; td.data[i + 2] = top ? 0x40 : 0x20; td.data[i + 3] = 255;
		} else td.data[i + 3] = 0;
	}
	lg.x.putImageData(td, 0, 0);
	lg.outline("#e02828"); lg.outline("#e02828"); lg.outline("#201018");
	lg.x.drawImage(face.c, (LS - 44) / 2, 6, 44, 50);
	// 頭の高さに横長のダンボール。頭の形にくりぬいた型から顔が出ている
	const FX = (LS - 44) / 2, FY = 6, CHIN = 38; // 顔の絵の CHIN 行目までが頭
	const fm = new Art(LS, LS);
	fm.x.drawImage(face.c, FX, FY, 44, 50);
	const fmk = fm.mask().map((v, i) => (v && Math.floor(i / LS) <= FY + CHIN ? 1 : 0));
	const hole = dilate(fmk, LS, LS, 1);
	const bTop = 0, bBot = FY + CHIN + 1;
	const bd = new Art(LS, LS);
	bd.rect(0, bTop, LS, bBot - bTop, "#d29a5c");
	for (let x = 0; x < LS; x += 4) bd.rect(x, bTop, 1, bBot - bTop, "#c48c50");
	bd.rect(0, bTop + 4, LS, 5, "#e8c890"); bd.rect(0, bTop + 4, LS, 1, "#f8e0b0"); bd.rect(0, bTop + 8, LS, 1, "#b88a50");
	[[4, bTop + 13], [105, bTop + 13]].forEach((q) => {
		for (let k = 0; k < 2; k++) {
			const ax = q[0] + k * 5;
			bd.rect(ax + 1, q[1] + 3, 2, 9, "#d02828"); bd.rect(ax, q[1] + 3, 4, 1, "#d02828"); bd.rect(ax + 1, q[1] + 2, 2, 1, "#d02828");
		}
	});
	bd.rect(0, bTop, LS, 2, "#9a6a38"); bd.rect(0, bBot - 2, LS, 2, "#8a5a30");
	const bdd = bd.x.getImageData(0, 0, LS, LS);
	const inH = (x, y) => x >= 0 && y >= 0 && x < LS && y < LS && hole[y * LS + x] === 1;
	for (let y = bTop; y < bBot; y++) for (let x = 0; x < LS; x++) {
		const i = (y * LS + x) * 4;
		if (inH(x, y)) { bdd.data[i + 3] = 0; continue; }
		if (inH(x + 1, y) || inH(x, y + 1)) { bdd.data[i] = 0xf4; bdd.data[i + 1] = 0xd8; bdd.data[i + 2] = 0xa8; }
		else if (inH(x - 1, y) || inH(x, y - 1)) { bdd.data[i] = 0x7a; bdd.data[i + 1] = 0x4a; bdd.data[i + 2] = 0x22; }
	}
	bd.x.putImageData(bdd, 0, 0);
	// 型の内側の上と左に影を落として、人が板の奥にいるように見せる
	for (let y = bTop; y < bBot; y++) for (let x = 0; x < LS; x++) {
		if (!inH(x, y)) continue;
		if (!inH(x - 1, y) || !inH(x, y - 1)) bd.px(x, y, "rgba(40,16,8,0.55)");
		else if (!inH(x - 2, y) || !inH(x, y - 2)) bd.px(x, y, "rgba(40,16,8,0.3)");
	}
	bd.outline();
	lg.x.drawImage(bd.c, 0, 0);
	lg.save("logo", 4);

	// ======== アイコン 80x80 を4倍 ========
	const ic = new Art(80, 80);
	for (let i = 0; i < 16; i++) {
		// 集中線っぽい放射
		const a0 = i / 16 * Math.PI * 2, a1 = a0 + Math.PI / 16;
		ic.x.fillStyle = i % 2 ? "#ffd040" : "#ff9830";
		ic.x.beginPath(); ic.x.moveTo(40, 34); ic.x.lineTo(40 + Math.cos(a0) * 80, 34 + Math.sin(a0) * 80);
		ic.x.lineTo(40 + Math.cos(a1) * 80, 34 + Math.sin(a1) * 80); ic.x.fill();
	}
	// ダンボールのふち(下)
	ic.rect(0, 58, 80, 22, "#d29a5c"); for (let x = 0; x < 80; x += 4) ic.rect(x, 58, 1, 22, "#c48c50");
	ic.rect(0, 58, 80, 2, "#9a6a38");
	ic.x.drawImage(face.c, 18, 6, 44, 50);
	const tx = new Art(80, 24);
	tx.x.font = "bold 17px IPAGothic"; tx.x.textAlign = "center"; tx.x.textBaseline = "middle"; tx.x.fillStyle = "#000";
	tx.x.fillText("かたぬき", 40, 12);
	const tdd = tx.x.getImageData(0, 0, 80, 24);
	for (let i = 0; i < 80 * 24; i++) {
		if (tdd.data[i * 4 + 3] > 110) { tdd.data[i * 4] = 255; tdd.data[i * 4 + 1] = 255; tdd.data[i * 4 + 2] = 255; tdd.data[i * 4 + 3] = 255; }
		else tdd.data[i * 4 + 3] = 0;
	}
	tx.x.putImageData(tdd, 0, 0); tx.outline("#e02828"); tx.outline("#201018");
	ic.x.drawImage(tx.c, 0, 56);
	ic.save("icon", 4);
	return out;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build);
	await b.close();
	Object.keys(res).forEach((k) => {
		fs.writeFileSync(k === "icon" ? path.join(OUT, "..", "icon.png") : path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64"));
	});
	console.log("wrote", Object.keys(res).length, "images");
})();
