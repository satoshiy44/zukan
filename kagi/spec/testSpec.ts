import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("一万枚の中の鍵", () => {
	it("丸く囲むと判定され、最後までスコアが0以上の整数で残る", async () => {
		const context = new GameContext<3>({
			gameJsonPath: path.join(__dirname, "..", "game.json")
		});
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(4500);
		// 盤の真ん中あたりを、いろいろな大きさの円で囲む
		for (let k = 0; k < 12; k++) {
			const cx = 360 + ((k * 97) % 200) - 100, cy = 360 + ((k * 61) % 200) - 100, r = 120 + (k % 3) * 70;
			client.sendPointDown(cx + r, cy, 1);
			for (let a = 1; a <= 24; a++) {
				const t = a / 24 * Math.PI * 2;
				client.sendPointMove(cx + Math.cos(t) * r, cy + Math.sin(t) * r, 1);
				await context.advance(20);
			}
			client.sendPointUp(cx + r, cy, 1);
			await context.advance(1200);
		}
		await context.advance(20000);
		const finalScore = game.vars.gameState.score;
		expect(Number.isInteger(finalScore)).toBe(true);
		expect(finalScore).toBeGreaterThanOrEqual(10);
		expect(finalScore).toBeLessThanOrEqual(130000);
		console.log("score", finalScore);
		await context.destroy();
	}, 120000);
});
