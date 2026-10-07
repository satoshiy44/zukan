// サンドボックスで、盤の上にいろいろな大きさの円を描き続けて、スクリーンショットを撮る
// 使い方: npx akashic sandbox . -p 3306 を起動した状態で node tools/playtest.js <出力先ディレクトリ>
const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2] || ".";
const shots = [2, 6, 8, 12, 16, 20, 26, 34, 40];

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
	page.on("pageerror", (e) => console.log("page error:", e.message));
	await page.goto("http://localhost:3306/");
	const canvas = await page.waitForSelector("canvas");
	const box = await canvas.boundingBox();
	const k = box.width / 1280;
	const start = Date.now();
	const sec = () => (Date.now() - start) / 1000;
	let shotIdx = 0;
	const snap = async () => {
		while (shotIdx < shots.length && sec() >= shots[shotIdx]) {
			await canvas.screenshot({ path: path.join(outDir, "shot_" + String(shots[shotIdx]).padStart(2, "0") + ".png") });
			shotIdx++;
		}
	};
	while (sec() < 42) {
		const cx = 200 + Math.random() * 320, cy = 200 + Math.random() * 320, r = 90 + Math.random() * 160;
		await page.mouse.move(box.x + (cx + r) * k, box.y + cy * k);
		await page.mouse.down();
		for (let a = 1; a <= 28; a++) {
			const t = a / 28 * Math.PI * 2;
			await page.mouse.move(box.x + (cx + Math.cos(t) * r) * k, box.y + (cy + Math.sin(t) * r * 0.9) * k);
			await page.waitForTimeout(12);
			await snap();
		}
		await page.mouse.up();
		for (let w = 0; w < 4; w++) { await page.waitForTimeout(200); await snap(); }
	}
	await browser.close();
})();
