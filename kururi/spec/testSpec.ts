import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("くるりグラビティ", () => {
	it("タイルを落としたり盤を回したりしながら最後まで遊ぶと、点数が整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(4500);
		const tap = async (x: number, y: number): Promise<void> => {
			client.sendPointDown(x, y, 1);
			await context.advance(40);
			client.sendPointUp(x, y, 1);
			await context.advance(260);
		};
		for (let i = 0; i < 150; i++) {
			if (i % 7 === 6) await tap(i % 2 ? 1090 : 190, 500);
			else await tap(384 + 32 + ((i * 3) % 8) * 64, 400);
		}
		await context.advance(20000);
		const score = game.vars.gameState.score;
		console.log("score", score);
		expect(Number.isInteger(score)).toBe(true);
		expect(score).toBeGreaterThan(0);
		await context.destroy();
	}, 300000);
});
