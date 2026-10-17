import { GameMainParameterObject } from "./parameterObject";

const WIDTH = 1280;
const HEIGHT = 720;
const INTRO_SECONDS = 6;
const END_MARGIN_SECONDS = 3;
const DISH_COUNT = 6;
const MAX_ORDER_COUNT = 5;

const DISH_NAMES = ["オムライス", "スープ", "ケーキ", "紅茶", "サンド", "パスタ"];
const DISH_PRICES = [500, 600, 700, 400, 650, 550];

export function main(param: GameMainParameterObject): void {
	const imageIds = [
		"restaurant", "check", "coin", "dish_panel", "order_board", "tray",
		"logo", "emblem", "intro_panel", "hud_panel",
		"customer0", "customer1", "customer2",
		"dish0", "dish1", "dish2", "dish3", "dish4", "dish5"
	];
	const audioIds = ["bgm", "tap", "serve", "cash", "miss", "count", "finish"];
	const scene = new g.Scene({ game: g.game, assetIds: imageIds.concat(audioIds) });
	let totalTime = 60;
	if (param.sessionParameter.totalTimeLimit) {
		totalTime = param.sessionParameter.totalTimeLimit;
	}
	g.game.vars.gameState = { score: 0 };

	scene.onLoad.add(() => {
		const random = (): number => param.random.generate();
		const image = (id: string): ReturnType<typeof scene.asset.getImageById> => {
			return scene.asset.getImageById(id);
		};
		const sound = (id: string, volume: number): void => {
			scene.asset.getAudioById(id).play().changeVolume(volume);
		};
		const makeFont = (size: number, color: string, stroke: string): g.DynamicFont => {
			return new g.DynamicFont({
				game: g.game,
				fontFamily: "sans-serif",
				fontWeight: "bold",
				size: size,
				fontColor: color,
				strokeColor: stroke,
				strokeWidth: 7
			});
		};
		const mainFont = makeFont(64, "#fff4cf", "#352a2d");
		const goldFont = makeFont(64, "#ffd86a", "#352a2d");
		const redFont = makeFont(64, "#ffb39c", "#54252c");
		const label = (
			text: string,
			font: g.DynamicFont,
			size: number,
			x: number,
			y: number,
			parent: g.E,
			anchorX: number = 0
		): g.Label => {
			const entity = new g.Label({
				scene: scene,
				text: text,
				font: font,
				fontSize: size,
				x: x,
				y: y,
				anchorX: anchorX
			});
			parent.append(entity);
			return entity;
		};
		const setText = (target: g.Label, text: string): void => {
			if (target.text === text) return;
			target.text = text;
			target.invalidate();
		};

		scene.append(new g.Sprite({ scene: scene, src: image("restaurant") }));
		scene.append(new g.FilledRect({
			scene: scene,
			cssColor: "rgba(29,22,24,0.20)",
			width: WIDTH,
			height: HEIGHT
		}));

		const hud = new g.E({ scene: scene });
		scene.append(hud);
		hud.append(new g.Sprite({
			scene: scene,
			src: image("hud_panel"),
			x: 210,
			y: 133
		}));
		hud.append(new g.Sprite({
			scene: scene,
			src: image("hud_panel"),
			x: 710,
			y: 133
		}));
		hud.append(new g.Sprite({
			scene: scene,
			src: image("coin"),
			x: 219,
			y: 132,
			scaleX: 0.8,
			scaleY: 0.8
		}));
		const scoreLabel = label("合計 0円", goldFont, 42, 285, 142, hud);
		const timeLabel = label("のこり 60秒", mainFont, 42, 1050, 142, hud, 1);

		const customerLayer = new g.E({ scene: scene });
		scene.append(customerLayer);
		const frontCustomers: g.Sprite[] = [];
		const nextCustomers: g.Sprite[] = [];
		const farCustomers: g.Sprite[] = [];
		for (let customerIndex = 0; customerIndex < 3; customerIndex++) {
			const far = new g.Sprite({
				scene: scene,
				src: image("customer" + customerIndex),
				x: 118,
				y: 275,
				scaleX: 0.46,
				scaleY: 0.46
			});
			far.hide();
			customerLayer.append(far);
			farCustomers.push(far);
		}
		for (let customerIndex = 0; customerIndex < 3; customerIndex++) {
			const next = new g.Sprite({
				scene: scene,
				src: image("customer" + customerIndex),
				x: 172,
				y: 248,
				scaleX: 0.62,
				scaleY: 0.62
			});
			next.hide();
			customerLayer.append(next);
			nextCustomers.push(next);
		}
		for (let customerIndex = 0; customerIndex < 3; customerIndex++) {
			const front = new g.Sprite({
				scene: scene,
				src: image("customer" + customerIndex),
				x: 250,
				y: 211,
				scaleX: 0.82,
				scaleY: 0.82
			});
			front.hide();
			customerLayer.append(front);
			frontCustomers.push(front);
		}

		const orderLayer = new g.E({ scene: scene });
		scene.append(orderLayer);
		orderLayer.append(new g.Sprite({
			scene: scene,
			src: image("order_board"),
			x: 430,
			y: 205
		}));
		const orderDishEntities: g.Sprite[][] = [];
		for (let slot = 0; slot < MAX_ORDER_COUNT; slot++) {
			const slotEntities: g.Sprite[] = [];
			for (let dishIndex = 0; dishIndex < DISH_COUNT; dishIndex++) {
				const dish = new g.Sprite({
					scene: scene,
					src: image("dish" + dishIndex),
					x: 447 + slot * 108,
					y: 258,
					scaleX: 0.53,
					scaleY: 0.53
				});
				dish.hide();
				orderLayer.append(dish);
				slotEntities.push(dish);
			}
			orderDishEntities.push(slotEntities);
		}
		const orderCountLabel = label("1品のご注文", goldFont, 27, 1010, 213, orderLayer, 1);
		const orderCheck = new g.Sprite({
			scene: scene,
			src: image("check"),
			x: 934,
			y: 246
		});
		orderCheck.hide();
		orderLayer.append(orderCheck);

		const trayLayer = new g.E({ scene: scene });
		scene.append(trayLayer);
		trayLayer.append(new g.Sprite({
			scene: scene,
			src: image("tray"),
			x: 430,
			y: 350
		}));
		const trayDishEntities: g.Sprite[][] = [];
		for (let slot = 0; slot < MAX_ORDER_COUNT; slot++) {
			const slotEntities: g.Sprite[] = [];
			for (let dishIndex = 0; dishIndex < DISH_COUNT; dishIndex++) {
				const dish = new g.Sprite({
					scene: scene,
					src: image("dish" + dishIndex),
					x: 440 + slot * 110,
					y: 351,
					scaleX: 0.46,
					scaleY: 0.46
				});
				dish.hide();
				trayLayer.append(dish);
				slotEntities.push(dish);
			}
			trayDishEntities.push(slotEntities);
		}
		const trayLabel = label("トレー 0/1", mainFont, 24, 730, 374, trayLayer, 0.5);

		const dishLayer = new g.E({ scene: scene });
		scene.append(dishLayer);
		const buttonEntities: g.Sprite[] = [];
		for (let dishIndex = 0; dishIndex < DISH_COUNT; dishIndex++) {
			const buttonX = 385 + dishIndex % 3 * 190;
			const buttonY = 426 + Math.floor(dishIndex / 3) * 122;
			const panel = new g.Sprite({
				scene: scene,
				src: image("dish_panel"),
				x: buttonX,
				y: buttonY,
				scaleX: 0.73,
				scaleY: 0.73,
				touchable: true
			});
			dishLayer.append(panel);
			buttonEntities.push(panel);
			dishLayer.append(new g.Sprite({
				scene: scene,
				src: image("dish" + dishIndex),
				x: buttonX + 7,
				y: buttonY,
				scaleX: 0.72,
				scaleY: 0.72
			}));
			label(DISH_NAMES[dishIndex], mainFont, 20, buttonX + 65, buttonY + 91, dishLayer, 0.5);
			label(DISH_PRICES[dishIndex] + "円", goldFont, 18, buttonX + 65, buttonY + 67, dishLayer, 0.5);
		}

		const effectLayer = new g.E({ scene: scene });
		scene.append(effectLayer);
		const orderIds: number[] = [];
		const selected: boolean[] = [];
		const trayIds: number[] = [];
		let score = 0;
		let customerNumber = 0;
		let combo = 0;
		let phase = "intro";
		let timeLeft = totalTime;
		let introElapsed = 0;
		let nextCustomerDelay = 0;
		let lastCount = -1;

		// 良い知らせは上、まちがいは下に出して、重ならないようにする
		const popText = (text: string, good: boolean): void => {
			const baseY = good ? 400 : 480;
			const box = new g.E({ scene: scene, x: 0, y: baseY });
			effectLayer.append(box);
			const pop = label(text, good ? goldFont : redFont, 48, WIDTH / 2, 0, box, 0.5);
			// 文字の後ろに暗い帯を敷いて、トレーや料理と重なっても読めるようにする
			const bw = pop.width + 48;
			box.insertBefore(new g.FilledRect({
				scene: scene, cssColor: "rgba(40,20,10,0.78)", x: WIDTH / 2 - bw / 2, y: -6, width: bw, height: 62
			}), pop);
			let life = 0;
			box.onUpdate.add(() => {
				life += 1 / g.game.fps;
				box.y = baseY - life * 40;
				box.opacity = Math.max(0, 1 - Math.max(0, life - 0.5) / 0.6);
				box.modified();
				if (life >= 1.1) box.destroy();
			});
		};

		const changeScore = (delta: number): void => {
			score = Math.max(0, score + delta);
			g.game.vars.gameState.score = score;
			setText(scoreLabel, "合計 " + score + "円");
		};

		const hideAllOrderAndTrayDishes = (): void => {
			for (let slot = 0; slot < MAX_ORDER_COUNT; slot++) {
				for (let dishIndex = 0; dishIndex < DISH_COUNT; dishIndex++) {
					orderDishEntities[slot][dishIndex].hide();
					orderDishEntities[slot][dishIndex].opacity = 1;
					orderDishEntities[slot][dishIndex].modified();
					trayDishEntities[slot][dishIndex].hide();
				}
			}
		};

		const showCustomerLine = (frontIndex: number): void => {
			for (let i = 0; i < 3; i++) {
				frontCustomers[i].hide();
				nextCustomers[i].hide();
				farCustomers[i].hide();
			}
			frontCustomers[frontIndex].show();
			nextCustomers[(frontIndex + 1) % 3].show();
			farCustomers[(frontIndex + 2) % 3].show();
		};

		const startCustomer = (): void => {
			customerNumber++;
			showCustomerLine((customerNumber - 1) % 3);
			orderIds.length = 0;
			selected.length = 0;
			trayIds.length = 0;
			hideAllOrderAndTrayDishes();
			orderCheck.hide();
			const used: boolean[] = [false, false, false, false, false, false];
			const orderCount = 1 + Math.floor(random() * MAX_ORDER_COUNT);
			for (let slot = 0; slot < orderCount; slot++) {
				let dishIndex = Math.floor(random() * DISH_COUNT);
				while (used[dishIndex]) dishIndex = Math.floor(random() * DISH_COUNT);
				used[dishIndex] = true;
				orderIds.push(dishIndex);
				selected.push(false);
				orderDishEntities[slot][dishIndex].show();
			}
			setText(orderCountLabel, orderCount + "品のご注文");
			setText(trayLabel, "トレー 0/" + orderCount);
			nextCustomerDelay = 0;
		};

		const completeOrder = (): void => {
			let subtotal = 0;
			for (let i = 0; i < orderIds.length; i++) subtotal += DISH_PRICES[orderIds[i]];
			combo++;
			const bonus = Math.min(1000, Math.max(0, combo - 1) * 100);
			const total = subtotal + bonus;
			changeScore(total);
			orderCheck.show();
			sound("cash", 0.65);
			if (bonus > 0) {
				popText("お会計 +" + total + "円  連続ボーナス!", true);
			} else {
				popText("お会計 +" + total + "円!", true);
			}
			nextCustomerDelay = 1.2;
		};

		const serveDish = (dishIndex: number): void => {
			if (phase !== "play" || nextCustomerDelay > 0) return;
			sound("tap", 0.35);
			let target = -1;
			for (let i = 0; i < orderIds.length; i++) {
				if (!selected[i] && orderIds[i] === dishIndex) {
					target = i;
					break;
				}
			}
			if (target < 0) {
				combo = 0;
				changeScore(-100);
				sound("miss", 0.5);
				popText("注文にない料理! -100円", false);
				return;
			}
			selected[target] = true;
			orderDishEntities[target][dishIndex].opacity = 0.25;
			orderDishEntities[target][dishIndex].modified();
			const traySlot = trayIds.length;
			trayIds.push(dishIndex);
			trayDishEntities[traySlot][dishIndex].show();
			setText(trayLabel, "トレー " + trayIds.length + "/" + orderIds.length);
			sound("serve", 0.55);
			if (trayIds.length === orderIds.length) completeOrder();
		};

		for (let dishIndex = 0; dishIndex < buttonEntities.length; dishIndex++) {
			const index = dishIndex;
			buttonEntities[dishIndex].onPointDown.add(() => serveDish(index));
		}

		const intro = new g.E({ scene: scene });
		scene.append(intro);
		intro.append(new g.Sprite({
			scene: scene,
			src: image("intro_panel"),
			x: 140,
			y: 120
		}));
		const logo = new g.Sprite({
			scene: scene,
			src: image("logo"),
			x: 190,
			y: 128,
			scaleX: 0.9,
			scaleY: 0.9,
			anchorX: 0,
			anchorY: 0
		});
		intro.append(logo);
		// 遊び方: 見る → タップ → お会計
		label("① お客さんの「ご注文」を見る", mainFont, 34, 230, 372, intro);
		label("② 同じ料理をタップしてトレーへ", mainFont, 34, 230, 420, intro);
		label("③ 全部そろえばお会計！料理代が入る", mainFont, 34, 230, 468, intro);
		label("続けてお会計するとボーナス！　まちがえると -100円", redFont, 28, WIDTH / 2, 530, intro, 0.5);
		const countLabel = label("", goldFont, 96, 1030, 400, intro, 0.5);

		const bgmPlayer = scene.asset.getAudioById("bgm").play();
		bgmPlayer.changeVolume(0.24);
		startCustomer();

		const finishGame = (): void => {
			phase = "finish";
			bgmPlayer.stop();
			sound("finish", 0.6);
			const finish = new g.E({ scene: scene });
			scene.append(finish);
			finish.append(new g.Sprite({
				scene: scene,
				src: image("intro_panel"),
				x: 250,
				y: 200,
				scaleX: 0.78,
				scaleY: 0.56
			}));
			label("おしまい！", goldFont, 76, WIDTH / 2, 245, finish, 0.5);
			label("ご来店ありがとうございました", mainFont, 38, WIDTH / 2, 345, finish, 0.5);
		};

		scene.onUpdate.add(() => {
			const delta = 1 / g.game.fps;
			timeLeft = Math.max(0, timeLeft - delta);
			setText(timeLabel, "のこり " + Math.ceil(timeLeft) + "秒");
			if (phase === "intro") {
				introElapsed += delta;
				if (introElapsed >= 3) {
					const count = Math.max(1, Math.ceil(INTRO_SECONDS - introElapsed));
					setText(countLabel, String(count));
					if (count !== lastCount) {
						lastCount = count;
						sound("count", 0.45);
					}
				}
				if (introElapsed >= INTRO_SECONDS) {
					phase = "play";
					intro.destroy();
				}
				return;
			}
			if (phase === "play") {
				if (nextCustomerDelay > 0) {
					nextCustomerDelay = Math.max(0, nextCustomerDelay - delta);
					if (nextCustomerDelay === 0) startCustomer();
				}
				if (timeLeft <= END_MARGIN_SECONDS) finishGame();
			}
		});
	});
	g.game.pushScene(scene);
}
