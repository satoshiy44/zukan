// サンドボックスでランダムな間隔でタップし続けて、スクリーンショットを撮る
// 使い方: npx akashic sandbox . -p 3303 を起動した状態で node tools/playtest.js <出力先ディレクトリ>
const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2] || ".";
const shots = [2, 6, 10, 20, 30, 45, 55, 62, 70];

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
	page.on("pageerror", (e) => console.log("page error:", e.message));
	await page.goto("http://localhost:3303/");
	const canvas = await page.waitForSelector("canvas");
	const box = await canvas.boundingBox();
	const start = Date.now();
	const sec = () => (Date.now() - start) / 1000;
	let shotIdx = 0;
	while (sec() < 76) {
		await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.7);
		await page.waitForTimeout(250 + Math.random() * 500);
		while (shotIdx < shots.length && sec() >= shots[shotIdx]) {
			await canvas.screenshot({ path: path.join(outDir, "shot_" + String(shots[shotIdx]).padStart(2, "0") + ".png") });
			shotIdx++;
		}
	}
	await browser.close();
})();
