// サンドボックスでランダムな方向に玉を撃ち続けて、スクリーンショットを撮る
// 使い方: npx akashic sandbox . -p 3302 を起動した状態で node tools/playtest.js <出力先ディレクトリ>
const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2] || ".";
const shots = [2, 6, 8, 15, 30, 50, 60, 66, 72];

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
	page.on("pageerror", (e) => console.log("page error:", e.message));
	await page.goto("http://localhost:3302/");
	const canvas = await page.waitForSelector("canvas");
	const box = await canvas.boundingBox();
	const sx = box.width / 1280, sy = box.height / 720;
	const start = Date.now();
	const sec = () => (Date.now() - start) / 1000;
	let shotIdx = 0;
	while (sec() < 80) {
		// 押してねらいを動かし、はなして発射
		const x = 200 + Math.random() * 880, y = 250 + Math.random() * 300;
		await page.mouse.move(box.x + 640 * sx, box.y + 400 * sy);
		await page.mouse.down();
		await page.mouse.move(box.x + x * sx, box.y + y * sy, { steps: 5 });
		await page.waitForTimeout(200);
		while (shotIdx < shots.length && sec() >= shots[shotIdx]) {
			await canvas.screenshot({ path: path.join(outDir, "shot_" + String(shots[shotIdx]).padStart(2, "0") + ".png") });
			shotIdx++;
		}
		await page.mouse.up();
		await page.waitForTimeout(700);
	}
	await browser.close();
})();
