// アイコン(320x320・透過なし)と紹介画像(1280x720)を作る
// 使い方: node tools/gen-brand.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const uri = (p) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, p)).toString("base64");
const srcs = { boss_shot: uri("tools/promo-shot/boss.png") };
["logo", "bg", "ship0", "e_puff", "e_ufo", "e_bird", "e_jelly", "boss", "cloud", "bell_y", "bell_b", "bell_w", "bell_r", "shot", "island", "fx_star"]
	.forEach((k) => { srcs[k] = uri("image/" + k + ".png"); });

async function draw(srcs) {
	const im = {};
	await Promise.all(Object.keys(srcs).map((k) => new Promise((ok) => { const i = new Image(); i.onload = () => { im[k] = i; ok(); }; i.src = srcs[k]; })));
	const OL = "#3a2050";
	const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
	const rr = (x, l, t, w, h, r) => { x.beginPath(); x.roundRect(l, t, w, h, r); };
	const text = (x, t, tx, ty, size, fill, align) => {
		x.font = "bold " + size + "px IPAGothic"; x.textAlign = align || "left"; x.textBaseline = "middle"; x.lineJoin = "round";
		x.lineWidth = size * 0.26; x.strokeStyle = OL; x.strokeText(t, tx, ty);
		x.fillStyle = fill; x.fillText(t, tx, ty);
	};
	const out = {};
	// ======== アイコン ========
	{
		const [c, x] = mk(320, 320);
		x.drawImage(im.bg, 0, 0, 320, 320, 0, 0, 320, 320);
		x.drawImage(im.island, 150, 150, 200, 127);
		x.drawImage(im.bell_y, 22, 30, 70, 74); x.drawImage(im.bell_b, 230, 36, 58, 61); x.drawImage(im.bell_r, 34, 128, 46, 48);
		x.drawImage(im.shot, 152, 40, 16, 32); x.drawImage(im.shot, 172, 28, 16, 32);
		x.drawImage(im.ship0, 82, 62, 160, 173);
		rr(x, 8, 232, 304, 80, 22); x.fillStyle = "#ffffff"; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
		const word = (t, cx, cy, size, c1, c2) => {
			x.font = "bold " + size + "px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
			x.lineWidth = size * 0.3; x.strokeStyle = OL; x.strokeText(t, cx, cy);
			const g = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2); g.addColorStop(0, c1); g.addColorStop(1, c2);
			x.fillStyle = g; x.fillText(t, cx, cy);
		};
		word("ぽっぷん", 96, 272, 36, "#ffb0d8", "#ff4a8a");
		word("スカイ", 240, 272, 44, "#a8eaff", "#3a9ae8");
		out.icon = c.toDataURL("image/png");
	}
	// ======== 紹介画像 ========
	{
		const [c, x] = mk(1280, 720);
		x.drawImage(im.bg, 0, 0);
		x.globalAlpha = 0.7; x.drawImage(im.island, 40, 480, 220, 140); x.drawImage(im.island, 980, 600, 160, 102); x.globalAlpha = 1;
		// 右: プレイ画面
		rr(x, 540, 24, 716, 420, 22); x.fillStyle = OL; x.fill();
		rr(x, 548, 32, 700, 404, 16); x.fillStyle = "#ffffff"; x.fill();
		x.save(); rr(x, 556, 40, 684, 388, 12); x.clip(); x.drawImage(im.boss_shot, 0, 0, 1280, 726, 556, 40, 684, 388); x.restore();
		// 左上: ロゴ
		x.drawImage(im.logo, -20, 0, 580, 174);
		text(x, "ベルを撃って、色をかえて", 270, 214, 32, "#ffffff", "center");
		text(x, "パワーアップ！", 270, 262, 42, "#ffe04a", "center");
		text(x, "ポップな空のシューティング", 270, 316, 28, "#ffffff", "center");
		x.drawImage(im.ship0, 200, 330, 120, 130);
		// 下: ベル4色の説明
		rr(x, 24, 470, 1232, 232, 22); x.fillStyle = "rgba(255,255,255,0.92)"; x.fill(); x.lineWidth = 6; x.strokeStyle = OL; x.stroke();
		text(x, "雲を撃つとベルが出る！ベルを撃つと色がかわる", 640, 506, 30, "#ff6aa8", "center");
		const bells = [["bell_y", "黄", "高得点！", "続けて取ると 500→10000"], ["bell_b", "青", "ボム", "画面の敵をぜんぶやっつけ"],
			["bell_w", "白", "3WAY", "ななめにも撃てる"], ["bell_r", "赤", "バリア", "1回だけまもってくれる"]];
		bells.forEach((b, i) => {
			const l = 50 + i * 300;
			x.drawImage(im[b[0]], l, 548, 90, 94);
			text(x, b[1] + "ベル", l + 100, 574, 30, "#ffffff", "left");
			text(x, b[2], l + 100, 620, 34, ["#ffe04a", "#6ac8ff", "#ffffff", "#ff6a7a"][i], "left");
			x.font = "bold 20px IPAGothic"; x.fillStyle = OL; x.textAlign = "left"; x.fillText(b[3], l + 4, 676);
		});
		out.promo = c.toDataURL("image/png");
	}
	return out;
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(draw, srcs);
	await b.close();
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(res.icon.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "promo.png"), Buffer.from(res.promo.split(",")[1], "base64"));
	console.log("wrote icon, promo");
})();
