import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("おいもチキン", () => {
	it("前半でいもを集め、後半の屋台で売ると点が増え、最後までスコアが整数で残る", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		expect(game.width).toBe(1280);
		expect(game.height).toBe(720);
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		expect(game.vars.gameState.score).toBe(0);

		// イントロ(5秒)を抜ける
		await context.advance(5500);

		// 前半: 0.9秒引っぱって離す → いもがかごに入って少し点が入る
		client.sendPointDown(640, 360, 1);
		await context.advance(900);
		client.sendPointUp(640, 360, 1);
		await context.advance(300);
		expect(game.vars.gameState.score).toBeGreaterThan(0);

		// 前半の残り(合計約35秒)を、引く・離すを繰り返して遊ぶ
		for (let i = 0; i < 20; i++) {
			client.sendPointDown(640, 360, 1);
			await context.advance(1000);
			client.sendPointUp(640, 360, 1);
			await context.advance(700);
		}
		// 切りかえ(4秒)を待って後半へ
		await context.advance(4500);
		const beforeStall = game.vars.gameState.score;

		// 後半: しばらく焼いてからタップして売る(お客さんごとに焼ける速さはちがう)
		for (let i = 0; i < 8; i++) {
			await context.advance(800);
			client.sendPointDown(640, 360, 1);
			client.sendPointUp(640, 360, 1);
			await context.advance(400);
		}
		const afterSales = game.vars.gameState.score;
		expect(afterSales).toBeGreaterThan(beforeStall);

		await context.advance(40000);
		const finalScore = game.vars.gameState.score;
		expect(Number.isInteger(finalScore)).toBe(true);
		expect(finalScore).toBeGreaterThanOrEqual(afterSales);
		await context.destroy();
	}, 60000);
});
