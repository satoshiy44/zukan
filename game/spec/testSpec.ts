import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("おいもチキン", () => {
	it("長押しでいもが取れ、最後まで遊んでもスコアが整数で残る", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		expect(game.width).toBe(1280);
		expect(game.height).toBe(720);

		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		expect(game.vars.gameState.score).toBe(0);

		// イントロ(4秒)を抜ける
		await context.advance(4500);
		expect(game.vars.gameState.score).toBe(0);

		// 0.9秒引っぱる → 最初のいもが取れる
		client.sendPointDown(640, 360, 1);
		await context.advance(900);
		client.sendPointUp(640, 360, 1);
		await context.advance(300);
		const afterPull = game.vars.gameState.score;
		expect(afterPull).toBeGreaterThan(0);

		// 引っぱりっぱなしにするとブチッと切れても落ちずに動き続ける
		client.sendPointDown(640, 360, 1);
		await context.advance(5000);
		client.sendPointUp(640, 360, 1);

		// 引く・ゆるめるを繰り返して最後まで遊ぶ
		for (let i = 0; i < 40; i++) {
			client.sendPointDown(640, 360, 1);
			await context.advance(1000);
			client.sendPointUp(640, 360, 1);
			await context.advance(600);
		}
		await context.advance(15000);
		const finalScore = game.vars.gameState.score;
		expect(Number.isInteger(finalScore)).toBe(true);
		expect(finalScore).toBeGreaterThanOrEqual(afterPull);
		expect(finalScore).toBeLessThan(100000);
		await context.destroy();
	}, 60000);
});
