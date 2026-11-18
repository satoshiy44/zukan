// アイコン(320x320)と紹介画像(1280x720)を作る
// 使い方: node tools/gen-brand.js のあと、アイコンを256色・透過なしにする(README 参照)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const data = (p) => "data:image/png;base64," + fs.readFileSync(path.join(ROOT, p)).toString("base64");

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const imgs = {
		logo: data("image/logo.png"), tsuki: data("image/note_tsuki.png"), te: data("image/note_te.png"),
		hero: data("tools/promo-shot/hero.png"), ouch: data("tools/promo-shot/ouch.png"), made: data("tools/promo-shot/made.png"),
		rush: data("tools/promo-shot/rush.png"), end: data("tools/promo-shot/end.png"),
		mochis: ["m_kin", "m_ichigo", "m_kinako", "m_anko", "m_kusa"].map((m) => data("image/" + m + ".png"))
	};
	const res = await p.evaluate(async (I) => {
		const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
		const im = {};
		for (const k of Object.keys(I)) im[k] = Array.isArray(I[k]) ? await Promise.all(I[k].map(load)) : await load(I[k]);
		const OL = "#3a1e2a";
		// ---- アイコン: 正方形のロゴを、紅白のおめでたい背景にのせる ----
		const ic = document.createElement("canvas"); ic.width = 320; ic.height = 320; const x = ic.getContext("2d");
		const g = x.createRadialGradient(160, 160, 20, 160, 160, 240); g.addColorStop(0, "#fff4d8"); g.addColorStop(1, "#ffc890");
		x.fillStyle = g; x.fillRect(0, 0, 320, 320);
		x.lineWidth = 14; x.strokeStyle = "#e8402a"; x.strokeRect(7, 7, 306, 306);
		x.drawImage(im.logo, -4, -4, 328, 328);
		const icon = ic.toDataURL("image/png");
		// ---- 紹介画像 ----
		const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const y = c.getContext("2d");
		y.lineJoin = "round"; y.lineCap = "round";
		y.fillStyle = "#3a1e2a"; y.fillRect(0, 0, 1280, 720);
		// 右がわに、コンボ中の画面を大きく(上のスコア表示は切る)
		const hk = im.hero.width / 1280;
		y.drawImage(im.hero, 290 * hk, 105 * hk, 990 * hk, 490 * hk, 462, 0, 909, 450);
		let gl = y.createLinearGradient(440, 0, 700, 0); gl.addColorStop(0, "rgba(58,30,42,1)"); gl.addColorStop(1, "rgba(58,30,42,0)");
		y.fillStyle = gl; y.fillRect(440, 0, 260, 460);
		gl = y.createLinearGradient(0, 380, 0, 470); gl.addColorStop(0, "rgba(58,30,42,0)"); gl.addColorStop(1, "rgba(58,30,42,1)");
		y.fillStyle = gl; y.fillRect(0, 380, 1280, 90);
		const txt = (t, tx, ty, size, col, align) => {
			y.font = "bold " + size + "px IPAGothic"; y.textAlign = align || "left"; y.textBaseline = "middle";
			y.lineWidth = size * 0.3; y.strokeStyle = OL; y.strokeText(t, tx, ty); y.fillStyle = col; y.fillText(t, tx, ty);
		};
		// 紅白のふち
		for (let i = 0; i < 32; i++) { y.fillStyle = i % 2 ? "#e8402a" : "#ffffff"; y.fillRect(i * 40, 0, 40, 10); y.fillRect(i * 40, 710, 40, 10); }
		y.drawImage(im.logo, 14, 14, 250, 250);
		txt("お正月の", 280, 70, 32, "#ffffff");
		txt("もちつき", 280, 116, 44, "#ffd8e8");
		txt("リズムゲーム！", 280, 166, 36, "#ffe860");
		// 遊び方
		const row = (ty, icn, head, sub, col) => {
			y.fillStyle = "rgba(255,255,255,0.1)"; y.beginPath(); y.roundRect(20, ty - 36, 470, 72, 36); y.fill();
			y.drawImage(icn, 30, ty - 30, 60, 60);
			txt(head, 104, ty - 12, 28, col);
			txt(sub, 104, ty + 20, 20, "#ffffff");
		};
		row(306, im.tsuki, "おもちの印でタップ！", "輪にかさなったらペッタン！", "#ffe860");
		row(388, im.te, "たぬきの手は押さない！", "押すと手をついて「いたーっ！」", "#70e8ff");
		// 下の4枚
		const thumbs = [[im.made, "16回つくとおもち完成", "#ffe860"], [im.ouch, "手をつくと減点…", "#70e8ff"], [im.rush, "最後は点数2ばいラッシュ", "#ff8ad8"], [im.end, "おもちを積み上げよう", "#ffffff"]];
		thumbs.forEach(([shot, cap, col], i) => {
			const tx = 22 + i * 312, ty = 470, w = 300, h = 169;
			y.fillStyle = "#ffd040"; y.beginPath(); y.roundRect(tx - 6, ty - 6, w + 12, h + 12, 16); y.fill();
			y.save(); y.beginPath(); y.roundRect(tx, ty, w, h, 11); y.clip(); y.drawImage(shot, tx, ty, w, h); y.restore();
			txt(cap, tx + w / 2, ty + h + 32, 24, col, "center");
		});
		// 完成するおもち
		y.fillStyle = "#ffffff"; y.beginPath(); y.roundRect(840, 22, 420, 96, 22); y.fill(); y.lineWidth = 5; y.strokeStyle = OL; y.stroke();
		txt("ぴったりが多いほど豪華に！", 1050, 44, 22, "#e8402a", "center");
		im.mochis.forEach((m, i) => y.drawImage(m, 856 + i * 80, 58, 72, 60));
		return { icon, promo: c.toDataURL("image/png") };
	}, imgs);
	await b.close();
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(res.icon.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "promo.png"), Buffer.from(res.promo.split(",")[1], "base64"));
	console.log("wrote icon.png promo.png");
})();
