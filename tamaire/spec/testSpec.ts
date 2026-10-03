import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("ころころ玉入れ", () => {
	it("ねらって玉を撃つと点が入り、最後までスコアが整数で残る", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		expect(game.vars.gameState.score).toBe(0);

		// イントロ中のタップでは撃てない
		client.sendPointDown(640, 400, 1);
		client.sendPointUp(640, 400, 1);
		await context.advance(4500);
		expect(game.vars.gameState.score).toBe(0);

		// いろいろな方向へ撃つ(1投ごとに玉が落ちきるまで待つ)
		const targets = [400, 640, 880, 520, 760, 300, 980, 600];
		for (const x of targets) {
			client.sendPointDown(x, 450, 1);
			client.sendPointUp(x, 450, 1);
			await context.advance(5000);
		}
		const mid = game.vars.gameState.score;
		expect(mid).toBeGreaterThan(0);

		await context.advance(60000);
		const finalScore = game.vars.gameState.score;
		expect(Number.isInteger(finalScore)).toBe(true);
		expect(finalScore).toBeGreaterThanOrEqual(mid);
		expect(finalScore).toBeLessThan(100000);
		await context.destroy();
	}, 60000);
});
