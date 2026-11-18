import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("もちつきペッタン", () => {
	it("タップしながら最後まで遊ぶと、点数が整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(5000);
		for (let i = 0; i < 200; i++) {
			client.sendPointDown(640, 400, 1);
			await context.advance(100);
			client.sendPointUp(640, 400, 1);
			await context.advance(220);
		}
		await context.advance(5000);
		const score = game.vars.gameState.score;
		console.log("score", score);
		expect(Number.isInteger(score)).toBe(true);
		await context.destroy();
	}, 300000);
});
