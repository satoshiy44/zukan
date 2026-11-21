import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("100万円カード爆買い！", () => {
	it("何も選ばずに最後まで進めても、自動で選んで開封し、買取総額が整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(82000);
		const score = game.vars.gameState.score;
		console.log("score", score);
		expect(Number.isInteger(score)).toBe(true);
		expect(score).toBeGreaterThan(0);
		await context.destroy();
	}, 300000);
});
