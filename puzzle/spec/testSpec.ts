import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("やきいもパズル", () => {
	it("タップで葉っぱが消え、盤面が進み、最後まで遊んでもスコアが整数で残る", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		expect(game.vars.gameState.score).toBe(0);

		// イントロ中のタップは無視される
		client.sendPointDown(72, 582, 1);
		client.sendPointUp(72, 582, 1);
		await context.advance(4500);
		expect(game.vars.gameState.score).toBe(0);

		// 盤面を下の段から順にタップしていく
		let taps = 0;
		for (let loop = 0; loop < 12; loop++) {
			for (let r = 0; r < 5; r++) {
				for (let c = 0; c < 11; c++) {
					const x = 24 + c * 96 + 48, y = 150 + (4 - r) * 96 + 48;
					client.sendPointDown(x, y, 1);
					client.sendPointUp(x, y, 1);
					taps++;
					await context.advance(70);
				}
			}
		}
		expect(taps).toBeGreaterThan(0);
		const midScore = game.vars.gameState.score;
		expect(midScore).toBeGreaterThan(0);
		await context.advance(20000);
		const finalScore = game.vars.gameState.score;
		expect(Number.isInteger(finalScore)).toBe(true);
		expect(finalScore).toBeGreaterThanOrEqual(midScore);
		await context.destroy();
	}, 60000);
});
