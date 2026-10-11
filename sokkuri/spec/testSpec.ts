import * as path from "path";
import { GameContext } from "@akashic/headless-akashic";

describe("そっくり絵合わせ", () => {
	it("おてほんどおりに置くと高得点、2枚目まで進み、スコアが整数で残る", async () => {
		const context = new GameContext<3>({ gameJsonPath: path.join(__dirname, "..", "game.json") });
		const client = await context.getGameClient();
		const game = client.game!;
		await client.advanceUntil(() => game.scene()!.local !== "full-local" && game.scene()!.name !== "_bootstrap");
		await context.advance(4500);
		const scores: number[] = [];
		for (let round = 0; round < 2; round++) {
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
			await context.advance(32000 + 7000 - 34 * 7 * sprites.length);
			scores.push(game.vars.gameState.score);
		}
		console.log("scores", scores.join(","));
		expect(Number.isInteger(scores[1])).toBe(true);
		// 6〜8個のうち1個を置かずに、残りをピッタリ置いたので、1枚あたり 5×1500 点以上
		expect(scores[0]).toBeGreaterThanOrEqual(7500);
		expect(scores[1] - scores[0]).toBeGreaterThanOrEqual(7500);
		await context.destroy();
	}, 180000);
});
