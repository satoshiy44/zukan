// 紹介画像(1280x720)を作る。ロゴ・大きなプレイ画面・遊び方4コマを、ドット絵っぽい枠で1枚にまとめる
// 使い方: node tools/gen-promo.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const uri = (p) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, p)).toString("base64");
const srcs = {
	logo: uri("image/logo.png"), hero: uri("tools/promo-shot/hero.png"), align: uri("tools/promo-shot/align.png"),
	jump: uri("tools/promo-shot/jump.png"), kid: uri("tools/promo-shot/kid.png"), fall: uri("tools/promo-shot/fall.png")
};

async function draw(srcs) {
	const im = {};
	await Promise.all(Object.keys(srcs).map((k) => new Promise((ok) => { const i = new Image(); i.onload = () => { im[k] = i; ok(); }; i.src = srcs[k]; })));
	const c = document.createElement("canvas");
	c.width = 1280; c.height = 720;
	const x = c.getContext("2d");
	x.imageSmoothingEnabled = false;
	const F = "IPAGothic";
	// 背景: 夜空色に、ドットの星と斜めのしま
	x.fillStyle = "#16123a"; x.fillRect(0, 0, 1280, 720);
	for (let i = -720; i < 1280; i += 48) {
		x.fillStyle = "rgba(255,255,255,0.035)";
		x.beginPath(); x.moveTo(i, 720); x.lineTo(i + 24, 720); x.lineTo(i + 744, 0); x.lineTo(i + 720, 0); x.fill();
	}
	for (let i = 0; i < 70; i++) {
		x.fillStyle = i % 4 ? "rgba(255,248,200,0.5)" : "rgba(140,200,255,0.6)";
		const s = i % 5 ? 4 : 8;
		x.fillRect((i * 197) % 1280, (i * 113) % 720, s, s);
	}
	// ドットっぽい角の枠
	const frame = (l, t, w, h, col, th) => {
		x.fillStyle = "#0a0820"; x.fillRect(l - th * 2 + 6, t - th * 2 + 6, w + th * 4, h + th * 4);
		x.fillStyle = col;
		x.fillRect(l - th * 2, t - th, w + th * 4, h + th * 2);
		x.fillRect(l - th, t - th * 2, w + th * 2, h + th * 4);
		x.fillStyle = "#201018";
		x.fillRect(l - th, t - th / 2, w + th * 2, h + th);
		x.fillRect(l - th / 2, t - th, w + th, h + th * 2);
	};
	const shot = (img, sx, sy, sw, sh, l, t, w, h) => {
		x.drawImage(img, sx, sy, sw, sh, l, t, w, h);
	};
	const text = (t, tx, ty, size, fill, align, stroke, sw) => {
		x.font = "bold " + size + "px " + F; x.textAlign = align || "left"; x.textBaseline = "middle"; x.lineJoin = "round";
		if (stroke) { x.lineWidth = sw || size * 0.22; x.strokeStyle = stroke; x.strokeText(t, tx, ty); }
		x.fillStyle = fill; x.fillText(t, tx, ty);
	};
	// 左上: ロゴ
	x.drawImage(im.logo, 14, 0, 380, 380);
	// 右上: 大きなプレイ画面(ピッタリの瞬間)
	frame(436, 22, 816, 459, "#ffd040", 8);
	shot(im.hero, 0, 0, 1280, 720, 436, 22, 816, 459);
	// ロゴの下: ひとこと
	text("ダンボールの型に", 210, 400, 33, "#ffffff", "center", "#201018", 8);
	text("頭を通して走りぬけろ！", 210, 446, 33, "#ffe040", "center", "#201018", 8);
	// 下: 遊び方4コマ
	const cards = [
		{ img: im.align, s: [300, 220, 820, 470], n: "1", t1: "スライドで", t2: "型に合わせる", col: "#ff6040" },
		{ img: im.jump, s: [130, 110, 760, 437], n: "2", t1: "高い型は", t2: "タップでジャンプ", col: "#40b8ff" },
		{ img: im.kid, s: [330, 230, 760, 437], n: "3", t1: "小さい型は", t2: "子ども用のダミー", col: "#60d060" },
		{ img: im.fall, s: [440, 320, 720, 414], n: "4", t1: "石やねこに", t2: "つまずくとズデーン", col: "#ffb030" }
	];
	const CW = 292, CH = 160, Y = 520;
	cards.forEach((cd, i) => {
		const l = 22 + i * (CW + 24);
		frame(l, Y, CW, CH, cd.col, 6);
		shot(cd.img, cd.s[0], cd.s[1], cd.s[2], cd.s[3], l, Y, CW, CH);
		// 下に説明の帯
		x.fillStyle = "rgba(16,10,40,0.82)"; x.fillRect(l, Y + CH - 58, CW, 58);
		text(cd.t1, l + 64, Y + CH - 42, 22, "#fff4c0", "left", "#201018", 5);
		text(cd.t2, l + 64, Y + CH - 16, 25, "#ffffff", "left", "#201018", 6);
		// 番号のマーク
		x.fillStyle = "#201018"; x.fillRect(l + 6, Y + CH - 52, 48, 46);
		x.fillStyle = cd.col; x.fillRect(l + 9, Y + CH - 49, 42, 40);
		text(cd.n, l + 30, Y + CH - 28, 34, "#ffffff", "center", "#201018", 6);
	});
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
