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
		logo: data("image/logo.png"), tsuki: data("image/note_tsuki.png"), te: data("image/note_te.png"), judge: data("image/judge.png"),
		tap: data("tools/promo-shot/tap.png"), ouch: data("tools/promo-shot/ouch.png"), over: data("tools/promo-shot/over.png"),
		glow: data("tools/promo-shot/glow.png"), night: data("tools/promo-shot/night.png"),
		mochis: ["m_kin", "m_kouhaku", "m_kinako", "m_anko", "m_kusa"].map((m) => data("image/" + m + ".png"))
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
		// ---- 紹介画像: 「ここでタップ！」と「押しちゃダメ！」を大きく見せる ----
		const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const y = c.getContext("2d");
		y.lineJoin = "round"; y.lineCap = "round";
		const bgG = y.createLinearGradient(0, 0, 0, 720); bgG.addColorStop(0, "#fff0d8"); bgG.addColorStop(1, "#ffd8b0");
		y.fillStyle = bgG; y.fillRect(0, 0, 1280, 720);
		for (let i = 0; i < 32; i++) { y.fillStyle = i % 2 ? "#e8402a" : "#ffffff"; y.fillRect(i * 40, 0, 40, 12); y.fillRect(i * 40, 708, 40, 12); }
		const txt = (t, tx, ty, size, col, align, stroke) => {
			y.font = "bold " + size + "px IPAGothic"; y.textAlign = align || "left"; y.textBaseline = "middle";
			y.lineWidth = size * 0.3; y.strokeStyle = stroke || OL; y.strokeText(t, tx, ty); y.fillStyle = col; y.fillText(t, tx, ty);
		};
		// 上: ロゴとタイトル
		y.drawImage(im.logo, 16, 14, 170, 170);
		txt("お正月の もちつき リズムゲーム！", 200, 66, 44, "#ffffff");
		txt("上のレーンの印を見て、タップするかしないか！", 200, 130, 30, "#ffe860");
		// 大きなカード
		const card = (cx, col, title, shot, crop, draw, sub1, sub2) => {
			const L = cx - 300, T = 226, Wd = 600, Ht = 396;
			y.fillStyle = "#ffffff"; y.beginPath(); y.roundRect(L, T, Wd, Ht, 30); y.fill();
			y.lineWidth = 12; y.strokeStyle = col; y.stroke(); y.lineWidth = 5; y.strokeStyle = OL; y.stroke();
			// 見出しのリボン
			y.fillStyle = col; y.beginPath(); y.roundRect(L + 40, T - 34, Wd - 80, 72, 36); y.fill(); y.lineWidth = 5; y.strokeStyle = OL; y.stroke();
			txt(title, cx, T + 2, 50, "#ffffff", "center");
			// ゲームの画面(切り抜き)
			y.save(); y.beginPath(); y.roundRect(L + 316, T + 58, 260, 230, 18); y.clip();
			y.drawImage(shot, crop[0], crop[1], crop[2], crop[3], L + 316, T + 58, 260, 230); y.restore();
			y.lineWidth = 5; y.strokeStyle = OL; y.beginPath(); y.roundRect(L + 316, T + 58, 260, 230, 18); y.stroke();
			draw(L + 160, T + 172);
			txt(sub1, cx, T + 318, 34, col, "center", OL);
			txt(sub2, cx, T + 364, 26, "#ffffff", "center", OL);
		};
		card(330, "#ff9a20", "ここでタップ！", im.tap, [300, 120, 620, 548], (x0, y0) => {
			// 判定の輪にかさなったおもちの印(大きく)
			y.drawImage(im.judge, x0 - 130, y0 - 130, 260, 260);
			y.drawImage(im.tsuki, x0 - 100, y0 - 100, 200, 200);
		}, "おもちの印が 輪にかさなったら", "完璧ならS！ A・B…ずれるとF(ミス)");
		card(950, "#3a8ae8", "押しちゃダメ！", im.ouch, [740, 250, 460, 407], (x0, y0) => {
			y.drawImage(im.te, x0 - 100, y0 - 100, 200, 200);
			// 大きな ✕
			y.strokeStyle = "#ff3a3a"; y.lineWidth = 34;
			y.beginPath(); y.moveTo(x0 - 110, y0 - 110); y.lineTo(x0 + 110, y0 + 110); y.moveTo(x0 + 110, y0 - 110); y.lineTo(x0 - 110, y0 + 110); y.stroke();
			y.strokeStyle = "#ffffff"; y.lineWidth = 12;
			y.beginPath(); y.moveTo(x0 - 104, y0 - 104); y.lineTo(x0 + 104, y0 + 104); y.moveTo(x0 + 104, y0 - 104); y.lineTo(x0 - 104, y0 + 104); y.stroke();
		}, "たぬきの手の印のときは", "押すと手をついて -300点…");
		// 下: いろいろ変わる
		const chip = (cx, t, col) => {
			y.font = "bold 24px IPAGothic"; const w = y.measureText(t).width + 40;
			y.fillStyle = col; y.beginPath(); y.roundRect(cx - w / 2, 646, w, 50, 25); y.fill(); y.lineWidth = 4; y.strokeStyle = OL; y.stroke();
			txt(t, cx, 672, 24, "#ffffff", "center");
		};
		chip(200, "黄色い帯は長押しで連打！", "#ff9a20");
		chip(505, "曲10こ×背景5つ", "#e8402a");
		chip(765, "朝→昼→夕方→夜", "#8a5ae8");
		chip(1078, "10秒ごとにカメラ切りかえ", "#2a9a6a");
		return { icon, promo: c.toDataURL("image/png") };
	}, imgs);
	await b.close();
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(res.icon.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "promo.png"), Buffer.from(res.promo.split(",")[1], "base64"));
	console.log("wrote icon.png promo.png");
})();
