/* さぼこ落としゲーム — プロトタイプ
 * 物理演算は Matter.js（vendor/matter.min.js）に任せ、描画は Canvas 2D で自前に行う。
 * 画像素材が assets/ に無い場合は、プレースホルダの丸を描いて動くようにしてある。 */
(() => {
  'use strict';

  const { Engine, Bodies, Body, Composite, Events } = Matter;

  // ---- 盤面の定数（canvas の論理サイズ） ----
  const W = 400;            // プレイエリアの内寸（幅）
  const H = 600;            // プレイエリアの内寸（高さ）
  const WALL = 40;          // 壁の厚み（画面外に置く）
  const DROP_Y = 62;        // 手持ちのさぼこの中心 y
  const DEATH_Y = 132;      // このラインより上に居座るとゲームオーバー
  const DROP_COOLDOWN = 420;// 落としてから次が出るまで(ms)
  const OVER_GRACE = 1100;  // 生成直後この間はゲームオーバー判定の対象外(ms)
  const OVER_LIMIT = 2000;  // ラインを超え続けて何msで終了か
  const TAU = Math.PI * 2;

  // ---- 8段階のさぼこ ----
  // r: 半径 / color: プレースホルダの色 / image: assets から読めたら入る
  const TIERS = [
    { name: 'たねさぼこ',       r: 16,  color: '#f4aec2', image: null },
    { name: 'ちびさぼこ',       r: 22,  color: '#f6c99a', image: null },
    { name: 'こさぼこ',         r: 29,  color: '#e8d98b', image: null },
    { name: 'さぼこ',           r: 38,  color: '#b6db94', image: null },
    { name: 'おおさぼこ',       r: 49,  color: '#8fd0cd', image: null },
    { name: 'だいさぼこ',       r: 63,  color: '#9db8e6', image: null },
    { name: 'キングさぼこ',     r: 81,  color: '#c3a5e2', image: null },
    { name: 'でんせつのさぼこ', r: 104, color: '#ef8f8f', image: null },
  ];
  const MAX_TIER = TIERS.length - 1;
  const POINTS = [1, 3, 6, 10, 15, 21, 28, 36]; // 合体でもらえる点
  const CLEAR_BONUS = 100;                      // 最大サイズ同士を合体させたとき
  const SPAWN_TIERS = 4;                        // 落ちてくるのは上位から4種類まで

  // ---- DOM ----
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const finalEl = document.getElementById('final-score');
  const overlay = document.getElementById('overlay');
  const chainEl = document.getElementById('chain');
  const BEST_KEY = 'saboko-drop-best';

  // ---- 状態 ----
  let engine, world;
  let heldTier = 0, nextTier = 0, heldX = W / 2;
  let canDrop = true;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let overSince = null;   // ラインを超え始めた時刻
  let playing = true;
  const mergeQueue = [];
  const pops = [];        // 合体エフェクト

  // ---------------------------------------------------------------- 素材読み込み
  // assets/saboko_1.png 〜 saboko_8.png があれば自動で使う。無ければ丸を描く。
  TIERS.forEach((tier, i) => {
    const img = new Image();
    img.addEventListener('load', () => { tier.image = img; renderChain(); });
    img.addEventListener('error', () => { /* 素材未配置。プレースホルダのまま */ });
    img.src = `assets/saboko_${i + 1}.png`;
  });

  // ---------------------------------------------------------------- 物理まわり
  function setupWorld() {
    engine = Engine.create();
    engine.gravity.y = 1;
    engine.positionIterations = 8;
    engine.velocityIterations = 8;
    world = engine.world;

    const wallOpts = { isStatic: true, friction: 0.4, restitution: 0.05 };
    Composite.add(world, [
      Bodies.rectangle(-WALL / 2, H / 2, WALL, H * 3, wallOpts),        // 左
      Bodies.rectangle(W + WALL / 2, H / 2, WALL, H * 3, wallOpts),     // 右
      Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, wallOpts), // 床
    ]);

    Events.on(engine, 'collisionStart', onCollisionStart);
    Events.on(engine, 'afterUpdate', onAfterUpdate);
  }

  function makeBall(tier, x, y) {
    const body = Bodies.circle(x, y, TIERS[tier].r, {
      label: 'saboko',
      restitution: 0.16,
      friction: 0.35,
      frictionStatic: 0.5,
      density: 0.0012,
      slop: 0.02,
    });
    body.plugin = { tier, bornAt: performance.now(), merged: false };
    return body;
  }

  // 同じサイズ同士が触れたら合体候補に積む。
  // merged フラグを即座に立てて、1フレームで3個以上が連鎖合体するのを防ぐ。
  function onCollisionStart(ev) {
    if (!playing) return;
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      if (a.label !== 'saboko' || b.label !== 'saboko') continue;
      if (a.plugin.merged || b.plugin.merged) continue;
      if (a.plugin.tier !== b.plugin.tier) continue;
      a.plugin.merged = true;
      b.plugin.merged = true;
      mergeQueue.push([a, b]);
    }
  }

  // 物理ステップの外で world を触りたいので、合体の実処理は afterUpdate に回す。
  function onAfterUpdate() {
    while (mergeQueue.length) {
      const [a, b] = mergeQueue.pop();
      const tier = a.plugin.tier;
      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;
      Composite.remove(world, a);
      Composite.remove(world, b);
      addScore(POINTS[tier]);

      if (tier === MAX_TIER) {
        // 最大同士は消滅してボーナス
        addScore(CLEAR_BONUS);
        pops.push({ x, y, r: TIERS[tier].r * 1.5, color: '#ffffff', life: 1 });
      } else {
        const grown = makeBall(tier + 1, x, y);
        Body.setVelocity(grown, { x: 0, y: -1.2 }); // ぽこっと持ち上がる感じ
        Composite.add(world, grown);
        pops.push({ x, y, r: TIERS[tier + 1].r, color: TIERS[tier + 1].color, life: 1 });
      }
    }

    if (!playing) return;

    // ゲームオーバー判定：落下直後の玉は無視し、ラインを超え続けた時間で判定する
    const now = performance.now();
    let over = false;
    for (const body of Composite.allBodies(world)) {
      if (body.label !== 'saboko') continue;
      if (now - body.plugin.bornAt < OVER_GRACE) continue;
      if (body.position.y - body.circleRadius < DEATH_Y) { over = true; break; }
    }
    if (over) {
      if (overSince === null) overSince = now;
      else if (now - overSince > OVER_LIMIT) endGame();
    } else {
      overSince = null;
    }
  }

  // ---------------------------------------------------------------- ゲーム進行
  function addScore(n) {
    score += n;
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function randomTier() {
    return Math.floor(Math.random() * SPAWN_TIERS);
  }

  function clampX(x, tier) {
    const r = TIERS[tier].r;
    return Math.min(W - r, Math.max(r, x));
  }

  function drop() {
    if (!playing || !canDrop) return;
    canDrop = false;
    const body = makeBall(heldTier, clampX(heldX, heldTier), DROP_Y);
    Composite.add(world, body);
    heldTier = nextTier;
    nextTier = randomTier();
    renderChain();
    setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);
  }

  function endGame() {
    playing = false;
    finalEl.textContent = score;
    overlay.classList.remove('hidden');
  }

  function reset() {
    for (const body of Composite.allBodies(world)) {
      if (body.label === 'saboko') Composite.remove(world, body);
    }
    mergeQueue.length = 0;
    pops.length = 0;
    score = 0;
    scoreEl.textContent = '0';
    overSince = null;
    canDrop = true;
    playing = true;
    heldTier = randomTier();
    nextTier = randomTier();
    overlay.classList.add('hidden');
    renderChain();
  }

  // ---------------------------------------------------------------- 入力
  function pointerX(ev) {
    const rect = canvas.getBoundingClientRect();
    return (ev.clientX - rect.left) / rect.width * W;
  }

  canvas.addEventListener('pointermove', (ev) => { heldX = pointerX(ev); });
  canvas.addEventListener('pointerdown', (ev) => {
    heldX = pointerX(ev);
    ev.preventDefault();
  });
  canvas.addEventListener('pointerup', (ev) => {
    heldX = pointerX(ev);
    drop();
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft') { heldX -= 12; ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { heldX += 12; ev.preventDefault(); }
    else if (ev.key === ' ' || ev.key === 'ArrowDown' || ev.key === 'Enter') { drop(); ev.preventDefault(); }
  });

  document.getElementById('retry').addEventListener('click', reset);

  // ---------------------------------------------------------------- 描画
  function drawSaboko(tier, x, y, angle, alpha) {
    const t = TIERS[tier];
    const r = t.r;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (t.image) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.clip();
      ctx.drawImage(t.image, -r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, r - 0.75, 0, TAU);
      ctx.strokeStyle = 'rgba(74,63,53,.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // 素材が無いときの仮の顔
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, t.color);
      grad.addColorStop(1, shade(t.color, -0.18));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(74,63,53,.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#4a3f35';
      const eye = Math.max(1.3, r * 0.085);
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.08, eye, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.08, eye, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.arc(0, r * 0.02, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = '#4a3f35';
      ctx.lineWidth = Math.max(1, r * 0.055);
      ctx.stroke();
      if (r >= 26) {
        ctx.fillStyle = 'rgba(74,63,53,.45)';
        ctx.font = `${Math.round(r * 0.3)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(tier + 1), 0, r * 0.72);
      }
    }
    ctx.restore();
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const out = amount < 0 ? v * (1 + amount) : v + (255 - v) * amount;
      return Math.max(0, Math.min(255, Math.round(out)));
    });
    return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
  }

  function drawField() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, W, H);

    // 手持ちゾーンの薄い帯
    ctx.fillStyle = 'rgba(217,203,181,.18)';
    ctx.fillRect(0, 0, W, DEATH_Y);

    // ゲームオーバーライン（近づくと赤くなる）
    const danger = overSince === null ? 0 : Math.min(1, (performance.now() - overSince) / OVER_LIMIT);
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = danger > 0
      ? `rgba(${Math.round(224 + 20 * danger)},${Math.round(138 - 90 * danger)},${Math.round(91 - 60 * danger)},${0.5 + 0.5 * danger})`
      : 'rgba(217,203,181,.9)';
    ctx.beginPath();
    ctx.moveTo(0, DEATH_Y);
    ctx.lineTo(W, DEATH_Y);
    ctx.stroke();
    ctx.restore();

    // 枠線
    ctx.strokeStyle = 'rgba(217,203,181,.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  }

  function drawHeld() {
    if (!playing) return;
    const x = clampX(heldX, heldTier);
    if (canDrop) {
      // 落下位置のガイド
      ctx.save();
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = 'rgba(74,63,53,.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, DROP_Y + TIERS[heldTier].r);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();
      drawSaboko(heldTier, x, DROP_Y, 0);
    } else {
      drawSaboko(heldTier, x, DROP_Y, 0, 0.25);
    }
  }

  function drawNext() {
    const boxX = W - 62, boxY = 10, boxW = 52, boxH = 58;
    ctx.save();
    ctx.fillStyle = 'rgba(255,253,248,.9)';
    ctx.strokeStyle = 'rgba(217,203,181,.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(74,63,53,.5)';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', boxX + boxW / 2, boxY + 13);
    ctx.restore();

    // NEXT 枠に収まるように縮小して描く
    const scale = Math.min(1, 17 / TIERS[nextTier].r);
    ctx.save();
    ctx.translate(boxX + boxW / 2, boxY + 36);
    ctx.scale(scale, scale);
    drawSaboko(nextTier, 0, 0, 0);
    ctx.restore();
  }

  function drawPops(dt) {
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.life -= dt / 380;
      if (p.life <= 0) { pops.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = p.life * 0.7;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + (1 - p.life) * 0.7), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 下の「1 → 2 → …」の進化表
  function renderChain() {
    chainEl.innerHTML = '';
    TIERS.forEach((t, i) => {
      if (i > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = '▶';
        chainEl.appendChild(arrow);
      }
      const dot = document.createElement('span');
      dot.className = 'dot';
      const size = Math.round(12 + i * 3);
      dot.style.width = dot.style.height = `${size}px`;
      if (t.image) dot.style.backgroundImage = `url(${t.image.src})`;
      else dot.style.background = t.color;
      dot.title = t.name;
      chainEl.appendChild(dot);
    });
  }

  // ---------------------------------------------------------------- ループ
  function fitCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const STEP = 1000 / 60;
  let lastTime = performance.now();
  let acc = 0;
  function loop(now) {
    const dt = Math.min(50, now - lastTime);
    lastTime = now;

    // モニタのリフレッシュレートに関係なく物理は 60fps 固定で回す
    if (playing) {
      acc = Math.min(acc + dt, STEP * 3);
      while (acc >= STEP) {
        Engine.update(engine, STEP);
        acc -= STEP;
      }
    } else {
      acc = 0;
    }

    drawField();
    for (const body of Composite.allBodies(world)) {
      if (body.label !== 'saboko') continue;
      drawSaboko(body.plugin.tier, body.position.x, body.position.y, body.angle);
    }
    drawPops(dt);
    drawHeld();
    drawNext();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- 起動
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  setupWorld();
  bestEl.textContent = best;
  heldTier = randomTier();
  nextTier = randomTier();
  renderChain();
  requestAnimationFrame(loop);
})();
