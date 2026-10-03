import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("クレーン取り放題", () => {
	it("長押し(右)→長押し(奥)でクレーンが動き、最後までスコアが0以上の整数で残る", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		expect(game.vars.gameState.score).toBe(0);

		// イントロ(4秒)を抜けて、長押し → はなす をくり返す
		await context.advance(4500);
		for (let i = 0; i < 40; i++) {
			client.sendPointDown(640, 400, 1);
			await context.advance(200 + (i % 7) * 230);
			client.sendPointUp(640, 400, 1);
			await context.advance(1600);
		}
		await context.advance(20000);
		const finalScore = game.vars.gameState.score;
		expect(Number.isInteger(finalScore)).toBe(true);
		expect(finalScore).toBeGreaterThan(0);
		expect(finalScore).toBeLessThan(300000);
		await context.destroy();
	}, 120000);
});
