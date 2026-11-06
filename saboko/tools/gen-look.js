// さぼこの「ふり返り」の絵を作る: 走っている絵の、首から上だけを左右反転する(体は前向きのまま)
// 使い方: node tools/gen-look.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const IMG = path.join(__dirname, "..", "image");
const NECK = 122; // この行より上が頭(えりの少し上)

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	for (const [k, out] of [[0, 0], [2, 1]]) {
		const src = "data:image/png;base64," + fs.readFileSync(path.join(IMG, "hero" + k + ".png")).toString("base64");
		const url = await p.evaluate(async ({ src, NECK }) => {
			const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
			const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
			const x = c.getContext("2d");
			x.drawImage(im, 0, 0);
			// 頭の左右のはしを調べる
			const d = x.getImageData(0, 0, im.width, NECK).data;
			let l = im.width, r = 0;
			for (let yy = 0; yy < NECK; yy++) for (let xx = 0; xx < im.width; xx++) {
				if (d[(yy * im.width + xx) * 4 + 3] > 30) { l = Math.min(l, xx); r = Math.max(r, xx); }
			}
			const head = document.createElement("canvas"); head.width = im.width; head.height = NECK;
			head.getContext("2d").drawImage(im, 0, 0, im.width, NECK, 0, 0, im.width, NECK);
			x.clearRect(0, 0, im.width, NECK);
			// 頭の中心で反転し、首もとを中心に後ろ(左)へかたむけて、ふり返った感じに
			const cx = (l + r) / 2;
			x.save();
			x.translate(cx, NECK); x.rotate(-0.22); x.translate(-cx - 10, -NECK);
			x.translate(l + r, 0); x.scale(-1, 1);
			x.drawImage(head, 0, 0);
			x.restore();
			return c.toDataURL("image/png");
		}, { src, NECK });
		fs.writeFileSync(path.join(IMG, "hero_look" + out + ".png"), Buffer.from(url.split(",")[1], "base64"));
	}
	await b.close();
	console.log("wrote hero_look0/1");
})();
