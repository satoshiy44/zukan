// サンドボックスで、ランダムな長さだけ長押ししてはなすのをくり返し(1回目で右、2回目で奥)、スクリーンショットを撮る
// 使い方: npx akashic sandbox . -p 3304 を起動した状態で node tools/playtest.js <出力先ディレクトリ>
const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2] || ".";
const shots = [6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 25, 30, 40, 50];

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
	page.on("pageerror", (e) => console.log("page error:", e.message));
	page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(m.type(), m.text()); });
	await page.goto("http://localhost:3304/");
	const canvas = await page.waitForSelector("canvas");
	const box = await canvas.boundingBox();
	const start = Date.now();
	const sec = () => (Date.now() - start) / 1000;
	let shotIdx = 0;
	const snap = async () => {
		while (shotIdx < shots.length && sec() >= shots[shotIdx]) {
			await canvas.screenshot({ path: path.join(outDir, "shot_" + String(shots[shotIdx]).padStart(2, "0") + ".png") });
			shotIdx++;
		}
	};
	while (sec() < 76) {
		await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
		await page.mouse.down();
		const hold = 150 + Math.random() * 900;
		const t0 = Date.now();
		while (Date.now() - t0 < hold) { await page.waitForTimeout(100); await snap(); }
		await page.mouse.up();
		for (let k = 0; k < 3; k++) { await page.waitForTimeout(100); await snap(); }
	}
	await browser.close();
})();
