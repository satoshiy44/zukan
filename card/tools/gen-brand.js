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
		logo: data("image/logo.png"), atm: data("tools/promo-shot/atm.png"), packs: data("tools/promo-shot/packs.png"),
		open: data("tools/promo-shot/open.png"), reveal: data("tools/promo-shot/reveal.png"),
		frames: [19, 18, 17, 16].map((i) => data("image/frame" + i + ".png")), mons: [19, 8, 14, 15].map((i) => data("image/mon" + i + ".png"))
	};
	const res = await p.evaluate(async (I) => {
		const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
		const im = {};
		for (const k of Object.keys(I)) im[k] = Array.isArray(I[k]) ? await Promise.all(I[k].map(load)) : await load(I[k]);
		const OL = "#2a1a30";
		// ---- アイコン ----
		const ic = document.createElement("canvas"); ic.width = 320; ic.height = 320; const x = ic.getContext("2d");
		const g = x.createRadialGradient(160, 160, 20, 160, 160, 240); g.addColorStop(0, "#ff6a4a"); g.addColorStop(1, "#7a1a3a");
		x.fillStyle = g; x.fillRect(0, 0, 320, 320);
		x.drawImage(im.logo, -6, -6, 332, 332);
		const icon = ic.toDataURL("image/png");
		// ---- 紹介画像 ----
		const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const y = c.getContext("2d");
		y.lineJoin = "round";
		const bg = y.createLinearGradient(0, 0, 1280, 720); bg.addColorStop(0, "#2a1050"); bg.addColorStop(1, "#7a1a4a");
		y.fillStyle = bg; y.fillRect(0, 0, 1280, 720);
		for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; y.fillStyle = i % 2 ? "rgba(255,220,80,0.08)" : "rgba(255,255,255,0.04)"; y.beginPath(); y.moveTo(160, 160); y.arc(160, 160, 1500, a, a + Math.PI / 24); y.closePath(); y.fill(); }
		const txt = (t, tx, ty, size, col, align) => {
			y.font = "bold " + size + "px IPAGothic"; y.textAlign = align || "left"; y.textBaseline = "middle";
			y.lineWidth = size * 0.3; y.strokeStyle = OL; y.strokeText(t, tx, ty); y.fillStyle = col; y.fillText(t, tx, ty);
		};
		y.drawImage(im.logo, 10, 6, 300, 300);
		txt("100万円で、カードを爆買い！", 330, 70, 50, "#ffe860");
		txt("100枚いっせい開封 → 買取総額がスコア！", 330, 134, 36, "#ffffff");
		txt("エラーカードは買取8〜12倍!?", 330, 188, 30, "#ff8a8a");
		// 20段階レアリティ
		y.fillStyle = "rgba(255,255,255,0.12)"; y.beginPath(); y.roundRect(330, 222, 920, 78, 16); y.fill();
		txt("レアリティ20段階！ 最高は「シークレットゴッド」", 350, 260, 26, "#ffffff");
		im.frames.forEach((f, i) => { const fx = 1100 - i * 46, fy = 230; y.drawImage(f, fx, fy, 44, 62); y.drawImage(im.mons[i], fx + 4, fy + 10, 36, 36); });
		// 4枚の画面(手順)
		const steps = [[im.atm, "① ATMで100万円おろす"], [im.packs, "② パック5種＋ボックス3個"], [im.open, "③ 100枚いっせい開封！"], [im.reveal, "④ 高レアを大きく査定！"]];
		steps.forEach(([shot, cap], i) => {
			const tx = 22 + i * 312, ty = 340, w = 300, h = 169;
			y.fillStyle = "#ffd040"; y.beginPath(); y.roundRect(tx - 6, ty - 6, w + 12, h + 12, 14); y.fill();
			y.save(); y.beginPath(); y.roundRect(tx, ty, w, h, 9); y.clip(); y.drawImage(shot, tx, ty, w, h); y.restore();
			txt(cap, tx + w / 2, ty + h + 34, 24, "#ffffff", "center");
		});
		// 下の帯
		y.fillStyle = "#ffe040"; y.beginPath(); y.roundRect(140, 600, 1000, 84, 42); y.fill(); y.lineWidth = 6; y.strokeStyle = OL; y.stroke();
		txt("オリパみたいなドキドキ！ シークレットゴッドで大逆転！", 640, 642, 34, "#e8203a", "center");
		return { icon, promo: c.toDataURL("image/png") };
	}, imgs);
	await b.close();
	fs.writeFileSync(path.join(ROOT, "icon.png"), Buffer.from(res.icon.split(",")[1], "base64"));
	fs.writeFileSync(path.join(ROOT, "promo.png"), Buffer.from(res.promo.split(",")[1], "base64"));
	console.log("wrote icon.png promo.png");
})();
