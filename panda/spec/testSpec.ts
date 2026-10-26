import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("まもれ！パンダ城", () => {
	it("動物を置いて最後まで守ると、点数が整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(500);
		const tap = async (x: number, y: number): Promise<void> => {
			client.sendPointDown(x, y, 1);
			await context.advance(50);
			client.sendPointUp(x, y, 1);
			await context.advance(100);
		};
		await tap(640, 300); // 説明をとじる
		// ライオン・ゾウ・ペンギンを道のそばに置く
		const plan: number[][] = [[4, 520, 240], [4, 770, 440], [3, 420, 430], [2, 830, 230], [1, 220, 260], [0, 1050, 430], [0, 380, 560]];
		for (const p of plan) {
			await tap(385 + p[0] * 160, 660);
			await tap(p[1], p[2]);
		}
		await tap(1150, 100); // じゅんびOK
		// 戦い中: ポイントがたまったら、動物を足したりパワーアップしたりする
		const more: number[][] = [[3, 640, 140], [3, 560, 520], [2, 1000, 300], [4, 420, 140], [3, 860, 600], [4, 200, 420], [3, 1120, 440], [2, 720, 560]];
		const ups: number[][] = [[520, 240], [770, 440], [420, 430], [830, 230]];
		for (let t = 0; t < 80; t++) {
			if (t % 2 === 0 && more.length > 0) {
				const p = more[0];
				await tap(385 + p[0] * 160, 660);
				await tap(p[1], p[2]);
				if (t % 6 === 0) more.shift();
			} else {
				const u = ups[t % ups.length];
				await tap(u[0], u[1] - 10);
			}
			await context.advance(700);
		}
		await context.advance(10000);
		const score = game.vars.gameState.score;
		console.log("score", score, JSON.stringify(game.vars.detail));
		expect(Number.isInteger(score)).toBe(true);
		expect(score).toBeGreaterThan(0);
		await context.destroy();
	}, 300000);
});
