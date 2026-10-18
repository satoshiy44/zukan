// 紹介画像(1280x720)を作る。プレイ画面にロゴと遊び方をのせる
// 使い方: node tools/gen-promo.js tools/promo-shot/play.png
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const uri = (p) => "data:image/png;base64," + fs.readFileSync(p).toString("base64");
const srcs = { shot: uri(process.argv[2]), logo: uri(path.join(ROOT, "image/logo.png")) };

async function draw(srcs) {
	const im = {};
	await Promise.all(Object.keys(srcs).map((k) => new Promise((ok) => { const i = new Image(); i.onload = () => { im[k] = i; ok(); }; i.src = srcs[k]; })));
	const c = document.createElement("canvas");
	c.width = 1280; c.height = 720;
	const x = c.getContext("2d");
	x.imageSmoothingEnabled = false;
	x.drawImage(im.shot, 0, 0, 1280, 720);
	// 上の点数・時間の帯はロゴでかくす
	const g = x.createLinearGradient(0, 84, 0, 244);
	g.addColorStop(0, "rgba(16,8,40,1)"); g.addColorStop(0.5, "rgba(16,8,40,0.75)"); g.addColorStop(1, "rgba(16,8,40,0)");
	x.fillStyle = "#100828"; x.fillRect(0, 0, 1280, 84);
	x.fillStyle = g; x.fillRect(0, 84, 1280, 160);
	x.drawImage(im.logo, 640 - 489, 6, 979, 202);
	// 下の帯
	x.fillStyle = "rgba(16,8,40,0.88)"; x.fillRect(0, 628, 1280, 92);
	x.fillStyle = "#ffd040"; x.fillRect(0, 628, 1280, 4);
	x.font = "bold 40px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
	const t = "ダンボールの型に合わせて走りぬけろ！";
	x.lineWidth = 9; x.strokeStyle = "#201018"; x.strokeText(t, 640, 660);
	x.fillStyle = "#ffffff"; x.fillText(t, 640, 660);
	x.font = "bold 28px IPAGothic";
	const t2 = "スライドで左右に移動 ／ タップでジャンプ";
	x.lineWidth = 7; x.strokeText(t2, 640, 700);
	x.fillStyle = "#fff040"; x.fillText(t2, 640, 700);
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
