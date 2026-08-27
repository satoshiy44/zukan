/* さぼこしゅーてぃんぐ — 前へ走りながら、迫るさぼこを撃ち倒す疑似3Dシューティング
 *
 * 3Dライブラリは使わず Canvas 2D だけで奥行きを出している。
 * 世界の座標は (x, z) の2つだけ。x が左右、z が奥行き。描くときに
 *   縮尺 s = FOCAL / (FOCAL + z)
 * を掛けると、位置も大きさもまとめて遠近に変換できる。
 * z の大きい順（奥から手前）に描けば重なりも正しくなる。
 *
 * 進行はゲート方式。左右に分かれた強化パネルのどちらを通ったかで
 * 火力が変わっていく。ここで手を止めさせないのがこのジャンルの肝なので、
 * 選択のたびに画面を止めるようなことはしない。 */
(() => {
  'use strict';

  // ---------------------------------------------------------------- 盤面
  const W = 400;
  const H = 640;
  const HORIZON = 186;    // 地平線の画面 y
  // FOCAL が小さいと遠近が効きすぎて、奥の敵が地平線近くの細い帯に固まってしまう。
  // 大きめに取り、そのぶん湧く距離を近くすると、迫ってくる感じが出る。
  const FOCAL = 430;
  const ZFAR = 720;       // ここから湧く
  const LANE = 178;       // 手前(z=0)での左右の広さ
  const PLAYER_LIMIT = 152;
  const RUN_SPEED = 190;  // 自分が前に進む速さ。敵はこれに自分の足を足して迫る。
  const MAX_ENEMIES = 170;

  // ゴールまでの距離。world の1単位を何メートルとみなすかで所要時間が決まる。
  // RUN_SPEED 190 / UNITS_PER_METER 14 = 約13.6m/s なので、2000m はおよそ2分半。
  const GOAL_METERS = 2000;
  const UNITS_PER_METER = 14;
  const CALM_METERS = 70;            // 残りこの距離を切ったら新しく湧かせない
  const BOSS_AT_METERS = [1500, 1050, 600, 220];  // 残り距離で出るボス
  const GOAL_FALLBACK_SPRITE = 1;    // goal.png が無いときに出す画像
  const TAU = Math.PI * 2;

  const scaleAt = (z) => FOCAL / (FOCAL + Math.max(0, z));
  const screenX = (x, s) => W / 2 + x * s;
  const screenY = (s) => HORIZON + (H - HORIZON) * s;

  // ---------------------------------------------------------------- 敵
  // sprite: assets/sprites.js の何番目か / h: 手前に来たときの高さ(px)
  // 強さと見た目を揃える。弱い敵は小さくて足が速く、強い敵は大きくて鈍い。
  // speed は RUN_SPEED への上乗せ分なので、負の値ほど「こちらの前進より遅い」。
  const KINDS = {
    walkerA: { sprite: 0,  h: 118, hp: 4,  speed: 14,  score: 10 },
    walkerB: { sprite: 1,  h: 116, hp: 4,  speed: 12,  score: 10 },
    walkerC: { sprite: 8,  h: 126, hp: 5,  speed: 10,  score: 12 },
    hood:    { sprite: 2,  h: 112, hp: 4,  speed: 22,  score: 12 },
    runner:  { sprite: 4,  h: 96,  hp: 3,  speed: 68,  score: 18 },
    tank:    { sprite: 3,  h: 170, hp: 22, speed: -55, score: 30 },
    wall:    { sprite: 5,  h: 205, hp: 38, speed: -85, score: 45 },
    omurice: { sprite: 6,  h: 105, hp: 3,  speed: 0,   score: 0, heal: true },
    boss1:   { sprite: 7,  h: 285, hp: 110, speed: -70,  score: 300,  boss: true, name: 'さぼこ（自撮り）' },
    boss2:   { sprite: 9,  h: 300, hp: 180, speed: -80,  score: 500,  boss: true, name: 'さぼこ（夜ふかし）' },
    boss3:   { sprite: 10, h: 275, hp: 260, speed: -85,  score: 800,  boss: true, name: 'さぼこ（就寝）' },
    dog:     { sprite: 11, h: 355, hp: 420, speed: -105, score: 1500, boss: true, name: 'ラスボス犬' },
  };

  const BOSS_ORDER = ['boss1', 'boss2', 'boss3', 'dog'];

  const WAVES = [
    { at: 0,  pool: ['walkerA', 'walkerB'] },
    { at: 9,  pool: ['walkerA', 'walkerB', 'walkerC', 'hood'] },
    { at: 20, pool: ['walkerA', 'walkerB', 'walkerC', 'hood', 'runner'] },
    { at: 32, pool: ['walkerA', 'walkerC', 'hood', 'runner', 'runner', 'tank'] },
    { at: 50, pool: ['walkerA', 'walkerC', 'hood', 'runner', 'runner', 'tank', 'tank', 'wall'] },
    { at: 75, pool: ['walkerC', 'hood', 'runner', 'runner', 'tank', 'tank', 'wall', 'wall'] },
    { at: 110, pool: ['hood', 'runner', 'runner', 'tank', 'tank', 'tank', 'wall', 'wall', 'wall'] },
  ];

  // ---------------------------------------------------------------- ゲート
  // 左右で必ず内容が違うようにして、毎回選ぶ意味を持たせる。
  // 悪い効果も混ぜないと「とりあえずどちらか通ればいい」になってしまう。
  const GATE_OPTIONS = [
    { label: '連射 +',   good: 2, apply: (p) => { p.fireInterval *= 0.86; } },
    { label: '連射 ++',  good: 3, apply: (p) => { p.fireInterval *= 0.74; } },
    { label: '威力 +1',  good: 2, apply: (p) => { p.damage += 1; } },
    { label: '威力 +2',  good: 3, apply: (p) => { p.damage += 2; } },
    { label: '弾数 +1',  good: 3, apply: (p) => { p.bullets += 1; } },
    { label: '弾数 ×2',  good: 4, apply: (p) => { p.bullets = Math.min(11, p.bullets * 2); } },
    { label: '貫通 +1',  good: 3, apply: (p) => { p.pierce += 1; } },
    { label: '弾速 +',   good: 1, apply: (p) => { p.bulletSpeed *= 1.18; } },
    { label: '回復 +2',  good: 2, apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + 2); } },
    { label: '体力 +1',  good: 2, apply: (p) => { p.maxHp += 1; p.hp += 1; } },
    { label: '弾数 −1',  good: -2, bad: true, apply: (p) => { p.bullets = Math.max(1, p.bullets - 1); } },
    { label: '威力 −1',  good: -2, bad: true, apply: (p) => { p.damage = Math.max(1, p.damage - 1); } },
    { label: '連射 −',   good: -2, bad: true, apply: (p) => { p.fireInterval = Math.min(0.6, p.fireInterval * 1.25); } },
  ];

  // ---------------------------------------------------------------- DOM
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overEl = document.getElementById('gameover');
  const clearEl = document.getElementById('clear');
  // 名前を変える前からの保存値。変えるとベストスコアが消えるので据え置き。
  const BEST_KEY = 'saboko-wave-best';

  // ---------------------------------------------------------------- 状態
  const sprites = [];
  let player, enemies, bullets, barrels, gates, effects, numbers;
  let elapsed, score, kills, distance, metersLeft;
  let nextSpawn, nextHorde, nextGate, nextBarrel, bossIndex;
  let activeBoss = null;
  let state = 'play';
  let shake = 0;
  let groanTimer = 2;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let pointerX = null;
  const keys = { left: false, right: false };

  function loadSprites() {
    (window.WAVE_SPRITES || []).forEach((raw, i) => {
      if (!raw) return;
      const img = new Image();
      img.src = raw.src;
      sprites[i] = { img, w: raw.w, h: raw.h };
    });
  }

  function reset() {
    player = {
      x: 0, hp: 8, maxHp: 8,
      fireInterval: 0.2, fireTimer: 0,
      damage: 1, bullets: 3, pierce: 0,
      moveSpeed: 320, bulletSpeed: 950,
      flash: 0, muzzle: 0, stride: 0,
    };
    enemies = []; bullets = []; barrels = []; gates = []; effects = []; numbers = [];
    elapsed = 0; score = 0; kills = 0; distance = 0;
    metersLeft = GOAL_METERS;
    nextSpawn = 0.4; nextHorde = 9; nextGate = 5; nextBarrel = 13;
    bossIndex = 0;
    activeBoss = null;
    groanTimer = 2;
    shake = 0;
    state = 'play';
    scoreEl.textContent = '0';
    overEl.classList.add('hidden');
    clearEl.classList.add('hidden');
  }

  // ---------------------------------------------------------------- 湧き
  function currentPool() {
    let pool = WAVES[0].pool;
    for (const w of WAVES) if (elapsed >= w.at) pool = w.pool;
    return pool;
  }

  function spawnEnemy(kindName, x, z) {
    const kind = KINDS[kindName];
    const sprite = sprites[kind.sprite];
    if (!sprite) return null;
    const tough = kind.boss ? 1 + bossIndex * 0.15 : 1 + elapsed / 150;
    const h = kind.h;
    const w = h * (sprite.w / sprite.h);
    const e = {
      kind, sprite,
      x: x === undefined ? (Math.random() * 2 - 1) * LANE : x,
      z: z === undefined ? ZFAR : z,
      w, h,
      halfHit: w * 0.4,
      hp: Math.ceil(kind.hp * tough),
      maxHp: Math.ceil(kind.hp * tough),
      flash: 0,
      sway: Math.random() * TAU,
    };
    enemies.push(e);
    if (kind.boss) { activeBoss = e; WaveAudio.boss(); }
    return e;
  }

  function spawnGate() {
    // 左右が必ず違う内容になるよう、2つ引くまで選び直す
    const a = GATE_OPTIONS[Math.floor(Math.random() * GATE_OPTIONS.length)];
    let b = a;
    while (b === a) b = GATE_OPTIONS[Math.floor(Math.random() * GATE_OPTIONS.length)];
    // 両方とも悪い、では選ぶ意味がないので片方は必ず良い効果にする
    const pair = (a.bad && b.bad) ? [a, GATE_OPTIONS[Math.floor(Math.random() * 10)]] : [a, b];
    if (Math.random() < 0.5) pair.reverse();
    gates.push({ z: ZFAR, left: pair[0], right: pair[1], taken: false });
  }

  function spawnBarrel() {
    const hp = Math.round(5 + elapsed * 0.22 + Math.random() * 6);
    barrels.push({
      x: (Math.random() * 2 - 1) * (LANE - 45),
      z: ZFAR, hp, maxHp: hp, flash: 0,
    });
  }

  function spawnTick(dt) {
    // ボスは時間ではなく残り距離で出す。走った距離が進行そのものなので、
    // ここを距離基準にしておくと「どこまで来たか」と手応えが一致する。
    while (bossIndex < BOSS_AT_METERS.length && metersLeft <= BOSS_AT_METERS[bossIndex]) {
      spawnEnemy(BOSS_ORDER[Math.min(bossIndex, BOSS_ORDER.length - 1)], 0);
      bossIndex++;
    }

    // ゴール手前は湧かせない。最後の数秒を駆け抜ける時間にする。
    if (metersLeft <= CALM_METERS) return;

    // ぱらぱらと湧く分
    nextSpawn -= dt;
    if (nextSpawn <= 0) {
      nextSpawn = Math.max(0.1, 0.5 - elapsed * 0.0035) * (0.7 + Math.random() * 0.6);
      if (enemies.length < MAX_ENEMIES) {
        const pool = currentPool();
        spawnEnemy(pool[Math.floor(Math.random() * pool.length)]);
      }
    }

    // 群れ。横に広がった塊でまとめて来る。
    nextHorde -= dt;
    if (nextHorde <= 0) {
      nextHorde = Math.max(5.5, 12 - elapsed * 0.04);
      const pool = currentPool();
      const count = Math.min(52, 12 + Math.floor(elapsed / 5));
      for (let i = 0; i < count && enemies.length < MAX_ENEMIES; i++) {
        spawnEnemy(
          pool[Math.floor(Math.random() * pool.length)],
          (Math.random() * 2 - 1) * LANE,
          ZFAR + Math.random() * 420
        );
      }
      WaveAudio.horde();
    }

    nextGate -= dt;
    if (nextGate <= 0) { nextGate = 7.5 + Math.random() * 2.5; spawnGate(); }

    nextBarrel -= dt;
    if (nextBarrel <= 0) { nextBarrel = 8 + Math.random() * 6; spawnBarrel(); }

    if (player.hp < player.maxHp && Math.random() < dt * 0.05 && !enemies.some((e) => e.kind.heal)) {
      spawnEnemy('omurice');
    }

  }

  // ---------------------------------------------------------------- 更新
  function fire() {
    const n = player.bullets;
    const spread = 24;
    for (let i = 0; i < n; i++) {
      const offset = (i - (n - 1) / 2) * spread;
      bullets.push({
        x: player.x + offset * 0.3,
        vx: offset * 0.85,
        z: 12, pz: 0,
        damage: player.damage,
        pierce: player.pierce,
        hits: [],
      });
    }
    player.muzzle = 0.06;
    WaveAudio.shoot();
  }

  function addScore(n) {
    score += n;
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function damageEnemy(e, amount) {
    e.hp -= amount;
    e.flash = 0.09;
    numbers.push({ x: e.x, z: e.z, val: amount, life: 0.55 });
    if (e.hp > 0) { WaveAudio.hit(); return; }

    enemies.splice(enemies.indexOf(e), 1);
    effects.push({ x: e.x, z: e.z, r: e.w * 0.4, life: 1, boss: !!e.kind.boss });
    if (e === activeBoss) activeBoss = null;

    if (e.kind.heal) {
      player.hp = Math.min(player.maxHp, player.hp + 1);
      WaveAudio.heal();
      return;
    }
    kills++;
    addScore(e.kind.score);
    WaveAudio.kill(e.x / LANE);
    if (e.kind.boss) shake = 0.5;
  }

  function damageBarrel(b, amount) {
    b.hp -= amount;
    b.flash = 0.08;
    if (b.hp > 0) { WaveAudio.hit(); return; }
    barrels.splice(barrels.indexOf(b), 1);
    effects.push({ x: b.x, z: b.z, r: 46, life: 1, boss: true });
    addScore(20);
    WaveAudio.kill(b.x / LANE);
  }

  function hurt(amount) {
    player.hp -= amount;
    player.flash = 0.35;
    shake = 0.4;
    WaveAudio.hurt();
    if (player.hp <= 0) gameOver();
  }

  function update(dt) {
    elapsed += dt;
    distance += RUN_SPEED * dt;
    metersLeft = Math.max(0, GOAL_METERS - distance / UNITS_PER_METER);
    if (metersLeft <= 0) return reachGoal();
    spawnTick(dt);

    // 自機
    let target = player.x;
    if (pointerX !== null) target = pointerX;
    if (keys.left) target = player.x - 999;
    if (keys.right) target = player.x + 999;
    const dx = target - player.x;
    const step = player.moveSpeed * dt;
    player.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    player.x = Math.max(-PLAYER_LIMIT, Math.min(PLAYER_LIMIT, player.x));
    player.flash = Math.max(0, player.flash - dt);
    player.muzzle = Math.max(0, player.muzzle - dt);
    player.stride += dt * 11;

    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      player.fireTimer = player.fireInterval;
      fire();
    }

    // 弾。速いので前フレームからの区間で当たりを判定する。
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.pz = b.z;
      b.z += player.bulletSpeed * dt;
      b.x += b.vx * dt;
      if (b.z > ZFAR + 300) { bullets.splice(i, 1); continue; }

      let gone = false;
      for (const bar of barrels) {
        if (b.hits.includes(bar)) continue;
        if (bar.z < b.pz || bar.z > b.z) continue;
        if (Math.abs(b.x - bar.x) > 42) continue;
        b.hits.push(bar);
        damageBarrel(bar, b.damage);
        // バレルは貫通しない（壁として機能させる）
        bullets.splice(i, 1);
        gone = true;
        break;
      }
      if (gone) continue;

      for (const e of enemies) {
        if (b.hits.includes(e)) continue;
        if (e.z < b.pz || e.z > b.z) continue;
        if (Math.abs(b.x - e.x) > e.halfHit) continue;
        b.hits.push(e);
        damageEnemy(e, b.damage);
        if (b.hits.length > b.pierce) { bullets.splice(i, 1); break; }
      }
    }

    // 敵。自分が前進しているぶん RUN_SPEED を足す。
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.z -= (RUN_SPEED + e.kind.speed) * dt;
      e.sway += dt * 3;
      e.flash = Math.max(0, e.flash - dt);
      e.x += Math.sign(player.x - e.x) * Math.min(Math.abs(player.x - e.x), 12 * dt);
      if (e.z <= 0) {
        enemies.splice(i, 1);
        if (e === activeBoss) activeBoss = null;
        if (e.kind.heal) continue;
        // 横にずれていれば脇を通り抜けるだけ。避ける操作に意味を持たせる。
        if (Math.abs(e.x - player.x) < e.halfHit + 26) {
          hurt(e.kind.boss ? 3 : 1);
          if (state === 'over') return;
        }
      }
    }

    // バレル。壊し損ねるとぶつかる。
    for (let i = barrels.length - 1; i >= 0; i--) {
      const b = barrels[i];
      b.z -= RUN_SPEED * dt;
      b.flash = Math.max(0, b.flash - dt);
      if (b.z <= 0) {
        barrels.splice(i, 1);
        if (Math.abs(b.x - player.x) < 52) {
          hurt(1);
          if (state === 'over') return;
        }
      }
    }

    // ゲート。通り抜けた瞬間に、そのとき居た側の効果が乗る。
    for (let i = gates.length - 1; i >= 0; i--) {
      const g = gates[i];
      g.z -= RUN_SPEED * dt;
      if (!g.taken && g.z <= 0) {
        g.taken = true;
        const pick = player.x < 0 ? g.left : g.right;
        pick.apply(player);
        player.fireInterval = Math.max(0.05, player.fireInterval);
        effects.push({ x: player.x, z: 30, r: 60, life: 1, boss: !pick.bad });
        numbers.push({ x: player.x, z: 40, val: pick.label, life: 1.1, big: true });
        if (pick.bad) WaveAudio.hurt(); else WaveAudio.levelUp();
      }
      if (g.z < -160) gates.splice(i, 1);
    }

    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt / 0.45;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }
    for (let i = numbers.length - 1; i >= 0; i--) {
      numbers[i].life -= dt;
      if (numbers[i].life <= 0) numbers.splice(i, 1);
    }
    shake = Math.max(0, shake - dt);

    groanTimer -= dt;
    if (groanTimer <= 0) {
      groanTimer = 1.3 + Math.random() * 2.4;
      if (enemies.length) {
        let near = enemies[0];
        for (const e of enemies) if (e.z < near.z) near = e;
        WaveAudio.groan(1 - Math.min(1, near.z / ZFAR), near.x / LANE);
      }
    }
  }

  // ---------------------------------------------------------------- 描画
  function drawGround() {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#241f1b');
    sky.addColorStop(1, '#6b573f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON);

    const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
    ground.addColorStop(0, '#5b4a38');
    ground.addColorStop(1, '#2b2621');
    ctx.fillStyle = ground;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    // 奥へ流れる横線。走っている感じはこれで出す。
    ctx.strokeStyle = 'rgba(255,240,220,.07)';
    ctx.lineWidth = 1;
    const spacing = 150;
    const offset = distance % spacing;
    for (let n = 0; n < 12; n++) {
      const z = n * spacing - offset;
      if (z < 0) continue;
      const y = screenY(scaleAt(z));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(224,138,91,.28)';
    ctx.lineWidth = 2;
    const sFar = scaleAt(ZFAR);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(screenX(side * LANE * 1.15, sFar), screenY(sFar));
      ctx.lineTo(screenX(side * LANE * 1.15, 1), screenY(1));
      ctx.stroke();
    }
  }

  function drawGate(g) {
    const s = scaleAt(g.z);
    const y = screenY(s);
    const half = LANE * 1.15 * s;
    const height = 190 * s;
    const chosen = player.x < 0 ? 'left' : 'right';

    for (const side of ['left', 'right']) {
      const opt = g[side];
      const x0 = side === 'left' ? screenX(-LANE * 1.15, s) : W / 2;
      const w = half;
      const near = g.z < 200;
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = opt.bad ? 'rgba(150,60,58,.75)' : 'rgba(70,130,150,.72)';
      ctx.fillRect(x0, y - height, w, height);
      ctx.globalAlpha = 1;
      // 今そちらに居る側を明るく縁取る
      ctx.strokeStyle = near && chosen === side ? 'rgba(255,225,180,.95)' : 'rgba(255,245,232,.35)';
      ctx.lineWidth = near && chosen === side ? 3 : 1.5;
      ctx.strokeRect(x0, y - height, w, height);
      ctx.fillStyle = '#fff8ec';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.max(10, Math.round(26 * s))}px system-ui, sans-serif`;
      ctx.fillText(opt.label, x0 + w / 2, y - height / 2);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic';
  }

  function drawBarrel(b) {
    const s = scaleAt(b.z);
    const x = screenX(b.x, s);
    const y = screenY(s);
    const w = 84 * s, h = 96 * s;

    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.45, h * 0.09, 0, 0, TAU);
    ctx.fill();

    const body = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    body.addColorStop(0, '#4c5340');
    body.addColorStop(0.4, '#7d8663');
    body.addColorStop(1, '#3f4536');
    ctx.fillStyle = b.flash > 0 ? '#fff' : body;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h, w, h, 6 * s);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.lineWidth = Math.max(1, 3 * s);
    for (const t of [0.28, 0.72]) {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h + h * t);
      ctx.lineTo(x + w / 2, y - h + h * t);
      ctx.stroke();
    }

    ctx.fillStyle = '#fff3e0';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.max(10, Math.round(38 * s))}px system-ui, sans-serif`;
    ctx.fillText(String(b.hp), x, y - h / 2 + 13 * s);
  }

  function drawEnemy(e) {
    const s = scaleAt(e.z);
    const x = screenX(e.x, s);
    const y = screenY(s);
    const w = e.w * s;
    const h = e.h * s;
    const bob = Math.sin(e.sway) * h * 0.02;

    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.36, h * 0.07, 0, 0, TAU);
    ctx.fill();

    ctx.drawImage(e.sprite.img, x - w / 2, y - h + bob, w, h);

    if (e.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = e.flash / 0.09 * 0.55;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - w / 2, y - h + bob, w, h);
      ctx.restore();
    }

    if (!e.kind.boss && e.maxHp > 5 && e.hp < e.maxHp) {
      const bw = w * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(x - bw / 2, y - h + bob - 7 * s - 3, bw, 3.5);
      ctx.fillStyle = '#e08a5b';
      ctx.fillRect(x - bw / 2, y - h + bob - 7 * s - 3, bw * (e.hp / e.maxHp), 3.5);
    }
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      const s = scaleAt(b.z);
      const x = screenX(b.x, s);
      const y = screenY(s) - 60 * s;
      const r = Math.max(1.2, 5 * s);
      ctx.fillStyle = 'rgba(255,214,150,.95)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(224,138,91,.3)';
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const x = screenX(player.x, 1);
    const y = H - 6;
    const swing = Math.sin(player.stride) * 9;
    ctx.save();
    ctx.translate(x, y);

    if (player.muzzle > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,220,160,.75)';
      ctx.beginPath();
      ctx.arc(0, -72, 12, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = player.flash > 0 ? '#d4544a' : '#1f1a17';
    // 走っている脚
    ctx.fillRect(-10, -16 + Math.max(0, swing), 8, 18);
    ctx.fillRect(2, -16 + Math.max(0, -swing), 8, 18);
    // 胴と肩
    ctx.beginPath();
    ctx.moveTo(-27, -10);
    ctx.quadraticCurveTo(-24, -38, 0, -40);
    ctx.quadraticCurveTo(24, -38, 27, -10);
    ctx.closePath();
    ctx.fill();
    // 頭
    ctx.beginPath();
    ctx.arc(0, -51, 12.5, 0, TAU);
    ctx.fill();
    // 構えた腕と銃
    ctx.fillRect(-20, -40, 40, 8);
    ctx.fillRect(-3.5, -70, 7, 32);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(-3.5, -70, 7, 8);
    ctx.restore();
  }

  function drawEffects() {
    for (const p of effects) {
      const s = scaleAt(p.z);
      const x = screenX(p.x, s);
      const y = screenY(s) - 40 * s;
      ctx.save();
      ctx.globalAlpha = p.life * 0.8;
      ctx.strokeStyle = p.boss ? '#ffd08a' : '#e08a5b';
      ctx.lineWidth = 3 * s + 1;
      ctx.beginPath();
      ctx.arc(x, y, p.r * s * (1 + (1 - p.life) * 1.6), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = 'center';
    for (const n of numbers) {
      const s = n.big ? 1 : scaleAt(n.z);
      const x = n.big ? screenX(n.x, 1) : screenX(n.x, s);
      const base = n.big ? H - 150 : screenY(s) - 70 * s;
      const y = base - (1 - n.life / (n.big ? 1.1 : 0.55)) * (n.big ? 60 : 24);
      ctx.save();
      ctx.globalAlpha = Math.min(1, n.life / 0.3);
      ctx.fillStyle = n.big ? '#fff3e0' : '#ffe0b8';
      ctx.font = `700 ${n.big ? 22 : Math.round(Math.max(9, 15 * s))}px system-ui, sans-serif`;
      ctx.fillText(String(n.val), x, y);
      ctx.restore();
    }
  }

  function drawHud() {
    ctx.textAlign = 'left';
    for (let i = 0; i < player.maxHp; i++) {
      ctx.fillStyle = i < player.hp ? '#d4544a' : 'rgba(255,255,255,.18)';
      ctx.beginPath();
      ctx.arc(14 + i * 10, 17, 3.6, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,245,232,.75)';
    ctx.textAlign = 'right';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(timeText(elapsed), W - 14, 17);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,245,232,.5)';
    ctx.fillText(`弾 ${player.bullets} × 威力 ${player.damage}`, W - 14, 31);

    // 残り距離。ゴールが近いほど強調する。
    const near = metersLeft <= 300;
    ctx.textAlign = 'center';
    ctx.fillStyle = near ? '#ffd08a' : 'rgba(255,245,232,.9)';
    ctx.font = `700 ${near ? 26 : 22}px system-ui, sans-serif`;
    ctx.fillText(`${Math.ceil(metersLeft)}m`, W / 2, 27);

    // 進み具合のバー
    const done = 1 - metersLeft / GOAL_METERS;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(W / 2 - 70, 33, 140, 3);
    ctx.fillStyle = near ? '#ffd08a' : '#e08a5b';
    ctx.fillRect(W / 2 - 70, 33, 140 * done, 3);

    if (activeBoss) {
      const bw = W - 80;
      ctx.fillStyle = 'rgba(255,245,232,.85)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(activeBoss.kind.name, W / 2, 52);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(40, 60, bw, 7);
      ctx.fillStyle = '#d4544a';
      ctx.fillRect(40, 60, bw * Math.max(0, activeBoss.hp / activeBoss.maxHp), 7);
    }
  }

  function timeText(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (shake > 0) {
      const k = shake * 7;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    drawGround();

    // 奥のものから描く。ゲート・バレル・敵を z でまとめて並べ替える。
    const props = [];
    for (const g of gates) if (!g.taken) props.push({ z: g.z, draw: () => drawGate(g) });
    for (const b of barrels) props.push({ z: b.z, draw: () => drawBarrel(b) });
    for (const e of enemies) props.push({ z: e.z, draw: () => drawEnemy(e) });
    props.sort((a, b) => b.z - a.z);
    for (const p of props) p.draw();

    drawBullets();
    drawEffects();
    drawPlayer();
    drawHud();

    if (player.flash > 0) {
      ctx.fillStyle = `rgba(212,84,74,${player.flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function reachGoal() {
    state = 'clear';
    // 走りきった時点で残っている敵ぶんのボーナス
    addScore(Math.round(200 + kills * 5));
    WaveAudio.levelUp();
    const goal = window.WAVE_GOAL || (window.WAVE_SPRITES || [])[GOAL_FALLBACK_SPRITE];
    if (goal) document.getElementById('goal-image').src = goal.src;
    document.getElementById('clear-score').textContent = score;
    document.getElementById('clear-time').textContent = timeText(elapsed);
    document.getElementById('clear-kills').textContent = kills;
    clearEl.classList.remove('hidden');
  }

  function gameOver() {
    state = 'over';
    WaveAudio.gameOver();
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-time').textContent = timeText(elapsed);
    document.getElementById('final-kills').textContent = kills;
    overEl.classList.remove('hidden');
  }

  // ---------------------------------------------------------------- 入力
  function toWorldX(ev) {
    const rect = canvas.getBoundingClientRect();
    return ((ev.clientX - rect.left) / rect.width * W - W / 2);
  }

  canvas.addEventListener('pointerdown', (ev) => {
    WaveAudio.unlock();
    pointerX = toWorldX(ev);
    canvas.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  canvas.addEventListener('pointermove', (ev) => { if (pointerX !== null) pointerX = toWorldX(ev); });
  canvas.addEventListener('pointerup', () => { pointerX = null; });
  canvas.addEventListener('pointercancel', () => { pointerX = null; });

  window.addEventListener('keydown', (ev) => {
    WaveAudio.unlock();
    if (ev.key === 'ArrowLeft') { keys.left = true; ev.preventDefault(); }
    if (ev.key === 'ArrowRight') { keys.right = true; ev.preventDefault(); }
  });
  window.addEventListener('keyup', (ev) => {
    if (ev.key === 'ArrowLeft') keys.left = false;
    if (ev.key === 'ArrowRight') keys.right = false;
  });

  for (const id of ['retry', 'clear-retry']) {
    document.getElementById(id).addEventListener('click', () => { WaveAudio.unlock(); reset(); });
  }

  const muteBtn = document.getElementById('mute');
  function paintMute() {
    const off = WaveAudio.isMuted();
    muteBtn.textContent = off ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', off ? '音を出す' : '音を消す');
    muteBtn.setAttribute('aria-pressed', String(off));
  }
  muteBtn.addEventListener('click', () => { WaveAudio.unlock(); WaveAudio.toggle(); paintMute(); });

  // ---------------------------------------------------------------- ループ
  let dpr = 1;
  function fitCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') update(dt);
    render();
    requestAnimationFrame(loop);
  }

  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  loadSprites();
  bestEl.textContent = best;
  paintMute();
  reset();
  requestAnimationFrame(loop);
})();
