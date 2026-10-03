import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("ぬいぐるみ合体パズル", () => {
	it("マスをタップして置き続けると点が入り、最後までスコアが0以上の整数で残る", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		expect(game.vars.gameState.score).toBe(0);

		// イントロ(4秒)を抜けて、いろいろなマスをタップする(置けないマスは無視される)
		await context.advance(4500);
		for (let i = 0; i < 160; i++) {
			const r = (i * 3) % 5, c = (i * 7 + Math.floor(i / 5)) % 5;
			const x = 80 + c * 112 + 56, y = 100 + r * 112 + 56;
			client.sendPointDown(x, y, 1);
			client.sendPointUp(x, y, 1);
			if (i % 9 === 0) {
				client.sendPointDown(1150, 320, 1);
				client.sendPointUp(1150, 320, 1);
			}
			await context.advance(450);
		}
		await context.advance(15000);
		const finalScore = game.vars.gameState.score;
		expect(Number.isInteger(finalScore)).toBe(true);
		expect(finalScore).toBeGreaterThan(0);
		expect(finalScore).toBeLessThan(10000000);
		await context.destroy();
	}, 120000);
});
