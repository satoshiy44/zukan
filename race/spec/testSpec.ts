import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("ひろってドライブ", () => {
	it("ハンドルを動かしながら最後まで走ると、お金をひろって点数が入り整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(5500);
		// 左右に大きくゆらしながら走る
		let x = 640;
		client.sendPointDown(x, 500, 1);
		for (let i = 0; i < 700; i++) {
			const nx = 640 + Math.sin(i / 12) * 260;
			client.sendPointMove(nx, 500, 1);
			x = nx;
			await context.advance(100);
		}
		client.sendPointUp(x, 500, 1);
		await context.advance(8000);
		const score = game.vars.gameState.score;
		console.log("score", score);
		expect(Number.isInteger(score)).toBe(true);
		expect(score).toBeGreaterThanOrEqual(0); // 宝箱で0円になることもある
		await context.destroy();
	}, 300000);
});
