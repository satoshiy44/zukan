import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("にげろさぼこ！", () => {
	it("ランキングゲームが最後まで正常に動作する", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		expect(game.width).toBe(1280);
		expect(game.height).toBe(720);
		expect(game.fps).toBe(30);
		await client.advanceUntil(() => {
			const current = game.scene();
			return !!current && Object.keys(current.assets).length > 20;
		});
		expect(game.scene()).toBeDefined();
		expect(Object.keys(game.scene()!.assets).length).toBeGreaterThan(20);
		await context.advance(8000);
		for (let index = 0; index < 12; index++) {
			client.sendPointDown(640, 420, index);
			await context.advance(1500);
		}
		const state = game.vars.gameState as { score: number; playThreshold: number };
		expect(Math.floor(state.score)).toBe(state.score);
		expect(state.score).toBeGreaterThanOrEqual(0);
		expect(state.playThreshold).toBe(100);
		await context.advance(65000);
		expect(game.scene()).toBeDefined();
		// 白凸男の突進は最低4回、右まで走りぬける
		expect(game.vars.dashCount).toBeGreaterThanOrEqual(4);
		console.log("score", game.vars.gameState.score, "dash", game.vars.dashCount);
		await context.destroy();
	});
});
