import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("ご注文をどうぞ", () => {
	it("料理をタップし続けると口コミの星がたまり、終わったあとは増えない", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		expect(game.width).toBe(1280);
		expect(game.height).toBe(720);

		await client.advanceUntil(() => {
			return game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap";
		});
		expect(game.vars.gameState.score).toBe(0);

		await context.advance(6500);
		// 6つの料理ボタンを順番に押し続ける(まちがいも混ざる)
		for (let repeat = 0; repeat < 60; repeat++) {
			const dish = repeat % 6;
			client.sendPointDown(266 + dish * 150, 598, repeat);
			await context.advance(150);
		}
		const score = game.vars.gameState.score;
		expect(score % 1).toBe(0);
		expect(score).toBeGreaterThan(0);

		await context.advance(60000);
		const finished = game.vars.gameState.score;
		client.sendPointDown(266, 598, 999);
		await context.advance(500);
		expect(game.vars.gameState.score).toBe(finished);
		await context.destroy();
	}, 120000);
});
