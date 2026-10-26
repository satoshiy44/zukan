// 紹介画像(1280x720)を作る。ロゴ・戦いの画面・遊び方3つ(配置・敵・お城)
// 使い方: node tools/gen-promo.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const uri = (p) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, p)).toString("base64");
const ids = ["logo", "castle", "u_chick", "u_rabbit", "u_penguin", "u_elephant", "u_lion", "e_slime", "e_goblin", "e_devil", "e_witch", "e_ogre"];
const srcs = { battle: uri("tools/promo-shot/battle.png") };
ids.forEach((k) => { srcs[k] = uri("image/" + k + ".png"); });

async function draw(srcs) {
	const im = {};
	await Promise.all(Object.keys(srcs).map((k) => new Promise((ok) => { const i = new Image(); i.onload = () => { im[k] = i; ok(); }; i.src = srcs[k]; })));
	const c = document.createElement("canvas");
	c.width = 1280; c.height = 720;
	const x = c.getContext("2d");
	x.imageSmoothingEnabled = false; // ドット絵をくっきり
	const INK = "#3a2416", F = "IPAGothic";
	const rr = (l, t, w, h, r) => {
		x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
		x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
	};
	const text = (t, tx, ty, size, fill, align, stroke, sw) => {
		x.font = "bold " + size + "px " + F; x.textAlign = align || "left"; x.textBaseline = "middle"; x.lineJoin = "round";
		if (stroke) { x.lineWidth = sw || size * 0.22; x.strokeStyle = stroke; x.strokeText(t, tx, ty); }
		x.fillStyle = fill; x.fillText(t, tx, ty);
	};
	// 背景: やさしい緑に水玉
	const g = x.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, "#c8f0a0"); g.addColorStop(1, "#8ad06a");
	x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
	for (let yy = 0; yy < 720; yy += 40) for (let xx = (yy / 40) % 2 ? 20 : 0; xx < 1280; xx += 40) {
		x.fillStyle = "rgba(255,255,255,0.18)"; x.beginPath(); x.arc(xx, yy, 6, 0, Math.PI * 2); x.fill();
	}
	// 右上: 戦いの画面
	rr(386, 16, 878, 496, 22); x.fillStyle = INK; x.fill();
	rr(392, 22, 866, 484, 18); x.fillStyle = "#ffffff"; x.fill();
	x.save(); rr(400, 30, 850, 468, 14); x.clip(); x.drawImage(im.battle, 0, 0, 1280, 720, 400, 30, 850, 478); x.restore();
	// 左上: ロゴとひとこと
	x.drawImage(im.logo, 14, 6, 364, 364);
	text("かわいい迷彩どうぶつ隊で", 196, 388, 28, "#ffffff", "center", INK, 7);
	text("パンダの王様のお城を", 196, 428, 28, "#ffffff", "center", INK, 7);
	text("敵からまもりぬけ！", 196, 470, 34, "#ffe040", "center", INK, 8);
	// 下: 遊び方3つ
	const card = (l, w, col, n, title) => {
		rr(l, 528, w, 178, 18); x.fillStyle = INK; x.fill();
		rr(l + 5, 533, w - 10, 168, 14); x.fillStyle = "#fff8e8"; x.fill();
		rr(l + 5, 533, w - 10, 44, 14); x.fillStyle = col; x.fill(); x.fillRect(l + 5, 560, w - 10, 17);
		x.fillStyle = "#ffffff"; x.beginPath(); x.arc(l + 32, 555, 17, 0, Math.PI * 2); x.fill();
		text(n, l + 32, 556, 26, col, "center");
		text(title, l + 58, 556, 26, "#ffffff", "left", INK, 6);
	};
	card(16, 520, "#ff7a4a", "1", "100ptで配置・パワーアップ");
	const units = [["u_chick", "2pt"], ["u_rabbit", "5pt"], ["u_penguin", "10pt"], ["u_elephant", "20pt"], ["u_lion", "30pt"]];
	units.forEach((u, i) => {
		x.drawImage(im[u[0]], 26 + i * 100, 572, 100, 100);
		text(u[1], 76 + i * 100, 684, 24, "#e03a4a", "center", "#ffffff", 5);
	});
	card(548, 400, "#8a4ad0", "2", "敵をやっつけてポイント！");
	[["e_slime", 0.95], ["e_goblin", 0.9], ["e_devil", 0.82], ["e_witch", 0.85], ["e_ogre", 0.68]].forEach((e, i) => {
		const a = im[e[0]], s = e[1];
		x.drawImage(a, 590 + i * 74 - a.width * s / 2 + 10, 692 - a.height * s, a.width * s, a.height * s);
	});
	card(960, 304, "#e03a4a", "3", "お城をまもれ！");
	x.drawImage(im.castle, 960, 560, 150, 150);
	text("こうげき", 1188, 612, 26, INK, "center");
	text("されると", 1188, 646, 26, INK, "center");
	text("マイナス！", 1188, 684, 28, "#e03a4a", "center", "#ffffff", 5);
	return c.toDataURL("image/png");
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const url = await p.evaluate(draw, srcs);
	await b.close();
	const buf = Buffer.from(url.split(",")[1], "base64");
	fs.writeFileSync(path.join(ROOT, "promo.png"), buf);
	console.log("wrote promo.png", Math.round(buf.length / 1024) + "KB");
})();
