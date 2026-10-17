import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("ご注文をどうぞ", () => {
	it("ランキング用の注文ゲームが最後まで動作する", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		expect(client.type).toBe("active");
		expect(game.width).toBe(1280);
		expect(game.height).toBe(720);
		expect(game.fps).toBe(30);

		await client.advanceUntil(() => {
			return game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap";
		});
		expect(game.vars.gameState.score).toBe(0);

		await context.advance(6200);
		for (let repeat = 0; repeat < 3; repeat++) {
			for (let dish = 0; dish < 6; dish++) {
				const x = 390 + dish % 3 * 190;
				const y = 431 + Math.floor(dish / 3) * 122;
				client.sendPointDown(x, y, repeat * 6 + dish);
				await context.step();
			}
		}
		expect(game.vars.gameState.score % 1).toBe(0);
		expect(game.vars.gameState.score).toBeGreaterThan(0);

		await context.advance(52000);
		const finishedScore = game.vars.gameState.score;
		client.sendPointDown(60, 510, 100);
		await context.step();
		expect(game.vars.gameState.score).toBe(finishedScore);
		await context.destroy();
	});
});
