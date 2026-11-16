import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("ドリフトいっぽん", () => {
	it("タップ・長押し・はなすをくり返して最後まで遊ぶと、点数が整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(5000);
		// 3.5秒ごとに、タップしてそのまま2.5秒押し続けてはなす
		for (let i = 0; i < 19; i++) {
			client.sendPointDown(640, 400, 1);
			await context.advance(2500);
			client.sendPointUp(640, 400, 1);
			await context.advance(1000);
		}
		await context.advance(5000);
		const score = game.vars.gameState.score;
		console.log("score", score);
		expect(Number.isInteger(score)).toBe(true);
		expect(score).toBeGreaterThan(0);
		await context.destroy();
	}, 300000);
});
