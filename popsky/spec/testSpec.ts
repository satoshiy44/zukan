import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("ぽっぷんスカイ", () => {
	it("ドラッグで動かしながら最後まで遊ぶと、点数が整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(4500);
		let x = 640;
		client.sendPointDown(x, 500, 1);
		for (let i = 0; i < 640; i++) {
			const nx = 640 + Math.sin(i / 14) * 420;
			client.sendPointMove(nx, 500 + Math.sin(i / 9) * 60, 1);
			x = nx;
			await context.advance(100);
		}
		client.sendPointUp(x, 500, 1);
		await context.advance(5000);
		const score = game.vars.gameState.score;
		console.log("score", score);
		expect(Number.isInteger(score)).toBe(true);
		expect(score).toBeGreaterThan(0);
		await context.destroy();
	}, 300000);
});
