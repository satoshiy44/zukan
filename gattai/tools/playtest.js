// サンドボックスで、ランダムなマスをタップし続けて、スクリーンショットを撮る
// 使い方: npx akashic sandbox . -p 3305 を起動した状態で node tools/playtest.js <出力先ディレクトリ>
const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2] || ".";
const shots = [3, 8, 15, 25, 40, 55, 70, 78, 84];

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
	page.on("pageerror", (e) => console.log("page error:", e.message));
	await page.goto("http://localhost:3305/");
	const canvas = await page.waitForSelector("canvas");
	const box = await canvas.boundingBox();
	const k = box.width / 1280;
	const start = Date.now();
	const sec = () => (Date.now() - start) / 1000;
	let shotIdx = 0;
	while (sec() < 92) {
		// 端から順にマスを押していく(すでに置いてあるマスは無視されるので、空いているマスに置かれる)
		const start0 = Math.floor(Math.random() * 25);
		if (Math.random() < 0.08) await page.mouse.click(box.x + 1150 * k, box.y + 320 * k);
		for (let j = 0; j < 25; j++) {
			const idx = (start0 + j) % 25, r = Math.floor(idx / 5), c = idx % 5;
			await page.mouse.click(box.x + (80 + c * 112 + 56) * k, box.y + (100 + r * 112 + 56) * k);
		}
		await page.waitForTimeout(500 + Math.random() * 400);
		while (shotIdx < shots.length && sec() >= shots[shotIdx]) {
			await canvas.screenshot({ path: path.join(outDir, "shot_" + String(shots[shotIdx]).padStart(2, "0") + ".png") });
			shotIdx++;
		}
	}
	await browser.close();
})();
