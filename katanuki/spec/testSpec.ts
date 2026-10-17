import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("かたぬきダッシュ", () => {
	it("左右に動いたりジャンプしたりしながら最後まで走ると、点数が整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(5500);
		for (let i = 0; i < 300; i++) {
			if (i % 3 === 0) {
				// タップでジャンプ
				client.sendPointDown(640, 500, 1);
				await context.advance(50);
				client.sendPointUp(640, 500, 1);
			} else {
				// 左右にスライド
				const x = 640 + Math.sin(i / 5) * 200;
				client.sendPointDown(640, 500, 2);
				client.sendPointMove(x, 500, 2);
				await context.advance(50);
				client.sendPointUp(x, 500, 2);
			}
			await context.advance(150);
		}
		await context.advance(10000);
		const score = game.vars.gameState.score;
		console.log("score", score);
		expect(Number.isInteger(score)).toBe(true);
		expect(score).toBeGreaterThanOrEqual(0);
		await context.destroy();
	}, 300000);
});
