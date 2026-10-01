// サンドボックスでゲームを自動プレイしてスクリーンショットを撮る
// 使い方: npx akashic sandbox . -p 3300 を起動した状態で node tools/playtest.js <出力先ディレクトリ>
const { chromium } = require("playwright");
const path = require("path");

const outDir = process.argv[2] || ".";
const shots = [3, 10, 25, 40, 46, 52, 58, 66, 74, 80, 88];
const STALL_START = 5 + 39 + 4; // イントロ+前半+切りかえ(秒)

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
	page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text()); });
	page.on("pageerror", (e) => console.log("page error:", e.message));
	await page.goto("http://localhost:3300/");
	const canvas = await page.waitForSelector("canvas");
	const box = await canvas.boundingBox();
	const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
	const start = Date.now();
	const sec = () => (Date.now() - start) / 1000;
	let shotIdx = 0;
	await page.mouse.move(cx, cy);
	const smart = process.argv[3] === "smart";
	const releaseAt = Number(process.argv[4] || 0.85); // この高さでメーターから手をはなす
	// メーター(x=896)の指定の高さに色が入っているかを見る
	const gaugeAt = async (level) => {
		const y = 70 + 200 * (1 - level);
		const buf = await page.screenshot({ clip: { x: box.x + 896 * box.width / 1280, y: box.y + y * box.height / 720, width: 1, height: 1 } });
		return buf;
	};
	const filled = async (level) => {
		const b64 = (await gaugeAt(level)).toString("base64");
		return page.evaluate(async (data) => {
			const img = new Image();
			img.src = "data:image/png;base64," + data;
			await img.decode();
			const c = document.createElement("canvas");
			c.width = c.height = 1;
			const ctx = c.getContext("2d");
			ctx.drawImage(img, 0, 0);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			return !(r > 240 && g > 200 && b > 190);
		}, b64);
	};
	// 焼き加減メーターの「極上」の範囲(x=694〜766)に針(白)が来ているか
	const needleInPerfect = async () => {
		const buf = await page.screenshot({ clip: { x: box.x + 694 * box.width / 1280, y: box.y + 655 * box.height / 720, width: 72 * box.width / 1280, height: 1 } });
		return page.evaluate(async (data) => {
			const img = new Image();
			img.src = "data:image/png;base64," + data;
			await img.decode();
			const c = document.createElement("canvas");
			c.width = img.width; c.height = 1;
			const ctx = c.getContext("2d");
			ctx.drawImage(img, 0, 0);
			const d = ctx.getImageData(0, 0, img.width, 1).data;
			for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 220) return true;
			return false;
		}, buf.toString("base64"));
	};
	let down = false;
	while (sec() < 92) {
		if (smart && sec() > STALL_START) {
			if (down) { await page.mouse.up(); down = false; }
			if (await needleInPerfect()) { await page.mouse.click(cx, cy); await page.waitForTimeout(200); }
		} else if (smart) {
			// メーターが releaseAt まで来たら手をはなし、15%まで下がったらまた引く
			if (down && await filled(releaseAt)) { await page.mouse.up(); down = false; }
			else if (!down && !(await filled(0.15))) { await page.mouse.down(); down = true; }
			await page.waitForTimeout(30);
		} else {
			// 1.3秒引っぱって0.45秒ゆるめる、を繰り返す
			await page.mouse.down();
			await page.waitForTimeout(1300);
			await page.mouse.up();
			await page.waitForTimeout(450);
		}
		while (shotIdx < shots.length && sec() >= shots[shotIdx]) {
			await canvas.screenshot({ path: path.join(outDir, "shot_" + String(shots[shotIdx]).padStart(2, "0") + ".png") });
			shotIdx++;
		}
	}
	await browser.close();
})();
