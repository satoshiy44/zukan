// 紹介画像(1280x720)を作る。プレイ画面の上に新しいロゴと一言をのせる
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
	x.drawImage(im.shot, 0, 0, 1280, 720);
	// 上の得点・時間の帯はロゴでかくす
	const g = x.createLinearGradient(0, 0, 0, 250);
	g.addColorStop(0, "rgba(40,16,10,0.95)"); g.addColorStop(0.75, "rgba(40,16,10,0.92)"); g.addColorStop(1, "rgba(40,16,10,0)");
	x.fillStyle = g; x.fillRect(0, 0, 1280, 250);
	x.drawImage(im.logo, 640 - 380, 2, 760, 211);
	x.fillStyle = "rgba(40,16,10,0.85)"; x.fillRect(0, 640, 1280, 80);
	x.font = "bold 44px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
	x.lineWidth = 10; x.strokeStyle = "#3a1810"; x.strokeText("注文どおりの料理をそろえて、売上No.1をめざせ！", 640, 680);
	x.fillStyle = "#fff4d8"; x.fillText("注文どおりの料理をそろえて、売上No.1をめざせ！", 640, 680);
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
