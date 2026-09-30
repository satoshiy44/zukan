// サンドボックスで盤面をランダムにタップし続けて、スクリーンショットを撮る
// 使い方: npx akashic sandbox . -p 3301 を起動した状態で node tools/playtest.js <出力先ディレクトリ>
const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2] || ".";
const shots = [2, 6, 12, 25, 45, 62, 66, 72];

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
	page.on("pageerror", (e) => console.log("page error:", e.message));
	await page.goto("http://localhost:3301/");
	const canvas = await page.waitForSelector("canvas");
	const box = await canvas.boundingBox();
	const sx = box.width / 1280, sy = box.height / 720;
	const start = Date.now();
	const sec = () => (Date.now() - start) / 1000;
	let shotIdx = 0;
	while (sec() < 76) {
		// 盤面(左下寄り)をランダムにタップ
		const x = 36 + Math.random() * 792, y = 150 + 504 - Math.random() * Math.random() * 504;
		await page.mouse.click(box.x + x * sx, box.y + y * sy);
		await page.waitForTimeout(220);
		while (shotIdx < shots.length && sec() >= shots[shotIdx]) {
			await canvas.screenshot({ path: path.join(outDir, "shot_" + String(shots[shotIdx]).padStart(2, "0") + ".png") });
			shotIdx++;
		}
	}
	await browser.close();
})();
