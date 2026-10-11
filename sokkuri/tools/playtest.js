// サンドボックスで、パーツを少しずらして額縁に置いていき、スクリーンショットを撮る
// 使い方: npx akashic sandbox . -p 3307 を起動した状態で node tools/playtest.js <出力先ディレクトリ>
const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2] || ".";

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
	page.on("pageerror", (e) => console.log("page error:", e.message));
	await page.goto("http://localhost:3307/");
	const canvas = await page.waitForSelector("canvas");
	const box = await canvas.boundingBox();
	const k = box.width / 1280;
	const shot = (name) => canvas.screenshot({ path: path.join(outDir, name + ".png") });
	const at = (x, y) => [box.x + x * k, box.y + y * k];
	await page.waitForTimeout(1500);
	await shot("00_intro");
	await page.waitForTimeout(3000);
	for (let round = 0; round < 2; round++) {
		await shot((round + 1) + "_a_start");
		// 置き場のマス(4×2)から、額縁のあちこちへ
		for (let i = 0; i < 8; i++) {
			const sx = 712 + (i % 4) * 140 + 70, sy = 318 + Math.floor(i / 4) * 196 + 98;
			const tx = 120 + Math.random() * 460, ty = 170 + Math.random() * 380;
			let p = at(sx, sy);
			await page.mouse.move(p[0], p[1]);
			await page.mouse.down();
			for (let s = 1; s <= 8; s++) {
				p = at(sx + (tx - sx) * s / 8, sy + (ty - sy) * s / 8);
				await page.mouse.move(p[0], p[1]);
				await page.waitForTimeout(16);
			}
			if (i === 3) await shot((round + 1) + "_b_drag");
			await page.mouse.up();
			await page.waitForTimeout(150);
		}
		await shot((round + 1) + "_c_placed");
		await page.waitForTimeout(round === 0 ? 30000 - 8 * 500 - 500 : 27000);
		await page.waitForTimeout(2600);
		await shot((round + 1) + "_d_review");
		await page.waitForTimeout(round === 0 ? 2200 : 2000);
		if (round === 0) await shot("1_e_next");
		if (round === 0) await page.waitForTimeout(1800);
	}
	await shot("9_end");
	await browser.close();
})();
