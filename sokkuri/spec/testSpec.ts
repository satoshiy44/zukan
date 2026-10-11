import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("そっくり絵合わせ", () => {
	it("おてほんどおりに置くと高得点、3枚目まで進み、スコアが整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(4500);
		const scores: number[] = [];
		const secs = [25, 30, 35];
		for (let round = 0; round < 3; round++) {
			const scene = game.scene()! as any;
			const uiLayer = scene.children[2];
			const ref = uiLayer.children.find((e: any) => e.scaleX === 0.5);
			const refParts = ref.children[1].children;
			const partLayer = scene.children[4];
			// 1つ目は、わざと置き場に残しておく
			const sprites = partLayer.children.slice();
			for (let i = 1; i < sprites.length; i++) {
				const s = sprites[i];
				const target = refParts.find((r: any) => r.src === s.src);
				client.sendPointDown(s.x, s.y, 1);
				await context.advance(34);
				for (let k = 1; k <= 5; k++) {
					client.sendPointMove(s.x + (30 + target.x - s.x) * k / 5, s.y + (120 + target.y - s.y) * k / 5, 1);
					await context.advance(34);
				}
				client.sendPointUp(30 + target.x, 120 + target.y, 1);
				await context.advance(100);
			}
			await context.advance(secs[round] * 1000 + 9200 - (34 * 6 + 100) * (sprites.length - 1));
			scores.push(game.vars.gameState.score);
		}
		console.log("scores", scores.join(","));
		expect(Number.isInteger(scores[1])).toBe(true);
				// 1枚目は5〜7個、2枚目は6〜8個、3枚目は7〜9個。1個は置かずに、残りをピッタリ置いた
		expect(scores[0]).toBeGreaterThanOrEqual(4 * 1500);
		expect(scores[1] - scores[0]).toBeGreaterThanOrEqual(5 * 1500);
		expect(scores[2] - scores[1]).toBeGreaterThanOrEqual(6 * 1500);
		await context.destroy();
	}, 300000);
});
