import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("クナイ修行", () => {
	it("タップでクナイが刺さって点が入り、最後までスコアが0以上の整数で残る", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		expect(game.vars.gameState.score).toBe(0);

		// イントロ(4秒)を抜けて、最初の1本を投げる
		await context.advance(4500);
		client.sendPointDown(640, 500, 1);
		client.sendPointUp(640, 500, 1);
		await context.advance(400);
		expect(game.vars.gameState.score).toBeGreaterThan(0);

		// 間をあけて投げ続ける
		for (let i = 0; i < 80; i++) {
			client.sendPointDown(640, 500, 1);
			client.sendPointUp(640, 500, 1);
			await context.advance(450 + (i % 5) * 60);
		}
		await context.advance(30000);
		const finalScore = game.vars.gameState.score;
		expect(Number.isInteger(finalScore)).toBe(true);
		expect(finalScore).toBeGreaterThanOrEqual(0);
		expect(finalScore).toBeLessThan(100000);
		await context.destroy();
	}, 60000);
});
