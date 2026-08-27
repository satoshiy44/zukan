/* さぼこ落としゲーム — プロトタイプ
 *
 * 当たり判定は「画像のシルエットそのまま」。丸ではないので、転がり方も
 * 積み上がり方も素材ごとに変わる。形のデータ（多角形）と画像本体は
 * tools/build-assets.mjs が assets/shapes.js に書き出したものを使う。
 * shapes.js が無い段階では、仮の丸を描いて遊べる状態を保つ。 */
(() => {
  'use strict';

  const { Engine, Bodies, Body, Composite, Common, Events } = Matter;

  // 凹んだ形を凸パーツに分割するのに poly-decomp が要る
  if (typeof decomp !== 'undefined' && Common.setDecomp) Common.setDecomp(decomp);

  // ---- 盤面の定数（canvas の論理サイズ） ----
  const W = 400;             // プレイエリアの内寸（幅）
  const H = 600;             // プレイエリアの内寸（高さ）
  const WALL = 40;           // 壁の厚み（画面外に置く）
  const DROP_Y = 62;         // 手持ちのさぼこの中心 y
  const DEATH_Y = 132;       // このラインより上に居座るとゲームオーバー
  const DROP_COOLDOWN = 420; // 落としてから次が出るまで(ms)
  const OVER_GRACE = 1100;   // 生成直後この間はゲームオーバー判定の対象外(ms)
  const OVER_LIMIT = 2000;   // ラインを超え続けて何msで終了か
  const TAU = Math.PI * 2;

  // ---- 12段階のさぼこ ----
  // r: その段階の「大きさの基準」となる半径。絵の面積が円 πr² と釣り合うように拡縮する。
  // color: 素材がまだ無いときに描く仮の丸の色
  // scale: 自動計算の結果を手で微調整したいときの倍率（省略=1）
  const TIERS = [
    { name: 'たねさぼこ',       r: 13,  color: '#f4aec2' },
    { name: 'ちびさぼこ',       r: 17,  color: '#f6c99a' },
    { name: 'こさぼこ',         r: 21,  color: '#e8d98b' },
    { name: 'さぼこ',           r: 26,  color: '#b6db94' },
    { name: 'おおさぼこ',       r: 32,  color: '#8fd0cd' },
    { name: 'どあっぷさぼこ',   r: 40,  color: '#9db8e6' },
    { name: 'オムライスさぼこ', r: 49,  color: '#e8b98b' },
    { name: 'だいさぼこ',       r: 60,  color: '#c3a5e2' },
    { name: 'スーパーさぼこ',   r: 73,  color: '#8fb8a0' },
    { name: 'キングさぼこ',     r: 89,  color: '#e6a2b8' },
    { name: 'でんせつのさぼこ', r: 108, color: '#ef8f8f' },
    { name: 'ラスボス犬',       r: 140, color: '#e8d5b7' },
  ];

  // 「大きさ」の体感は長辺ではなく面積で決まる。長辺をそろえる方式だと、
  // 横長で隙間の多い絵（4番のギター）は幅こそ広いのに小さく見えてしまう。
  // なので面積を πr² にそろえる。ただし1枚が盤面を埋め尽くさないよう上限だけ設ける。
  const MAX_SPAN = 320;    // 1個の絵が取れる長辺の上限(px)

  const MAX_TIER = TIERS.length - 1;
  const POINTS = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78]; // 合体でもらえる点
  const CLEAR_BONUS = 100;                      // 最大サイズ同士を合体させたとき
  const SPAWN_TIERS = 5;                        // 落ちてくるのは小さいほうから5種類

  // ---- DOM ----
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const finalEl = document.getElementById('final-score');
  const overlay = document.getElementById('overlay');
  const BEST_KEY = 'saboko-drop-best';

  // index.html?debug を付けると当たり判定の形を重ねて表示する（素材の調整用）
  const DEBUG = new URLSearchParams(location.search).has('debug');

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

  // ---------------------------------------------------------------- 形の準備
  function polyArea(v) {
    let a = 0;
    for (let i = 0; i < v.length; i++) {
      const p = v[i], q = v[(i + 1) % v.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  }

  // shapes.js の多角形（0〜1に正規化済み）を段階ごとの実寸に直し、
  // 物理ボディを1個試作して「重心から見た画像の位置」を測っておく。
  // 重心の位置は凸分割の結果で決まるので、計算で出すより実測が確実。
  function prepareTiers() {
    const shapes = window.SABOKO_SHAPES || [];
    TIERS.forEach((t, i) => {
      // 素材が無い段階は丸で代用する
      t.verts = null;
      t.image = null;
      t.ox = -t.r; t.oy = -t.r; t.dw = t.r * 2; t.dh = t.r * 2;

      const raw = shapes[i];
      if (!raw) return;

      const unit = raw.poly.map(([px, py]) => ({ x: px * raw.w, y: py * raw.h }));
      const xs = unit.map((p) => p.x), ys = unit.map((p) => p.y);
      const maxDim = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));

      const kArea = Math.sqrt(Math.PI * t.r * t.r / polyArea(unit));
      const k = Math.min(kArea, MAX_SPAN / maxDim) * (t.scale || 1);

      const verts = unit.map((p) => ({ x: p.x * k, y: p.y * k }));
      const probe = makeShapeBody(verts, 0, 0, {});
      if (!probe || !probe.parts.length) return;  // 分割に失敗したら丸のまま

      t.verts = verts;
      t.ox = probe.bounds.min.x;
      t.oy = probe.bounds.min.y;
      t.dw = probe.bounds.max.x - probe.bounds.min.x;
      t.dh = probe.bounds.max.y - probe.bounds.min.y;

      const img = new Image();
      img.addEventListener('load', () => { t.image = img; });
      img.src = raw.src;
    });
  }

  // Bodies.fromVertices は、凹形状の分割結果がちょうど1個になったときだけ
  // 指定座標を無視してポリゴン自身の重心にボディを置いてしまう。
  // 生成後に必ず座標を入れ直して、どの形でも同じ意味になるようにする。
  function makeShapeBody(verts, x, y, options) {
    const body = Bodies.fromVertices(x, y, [verts], options, true, true, 0.01, 0.01);
    if (body) Body.setPosition(body, { x, y });
    return body;
  }

  // ---------------------------------------------------------------- 物理まわり
  function setupWorld() {
    engine = Engine.create();
    engine.gravity.y = 1;
    engine.positionIterations = 8;
    engine.velocityIterations = 8;
    world = engine.world;

    const wallOpts = { isStatic: true, label: 'wall', friction: 0.4, restitution: 0.05 };
    Composite.add(world, [
      Bodies.rectangle(-WALL / 2, H / 2, WALL, H * 3, wallOpts),           // 左
      Bodies.rectangle(W + WALL / 2, H / 2, WALL, H * 3, wallOpts),        // 右
      Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, wallOpts), // 床
    ]);

    Events.on(engine, 'collisionStart', onCollisionStart);
    Events.on(engine, 'afterUpdate', onAfterUpdate);
  }

  const BALL_OPTS = {
    label: 'saboko',
    restitution: 0.14,
    friction: 0.42,
    frictionStatic: 0.6,
    density: 0.0012,
    slop: 0.02,
  };

  function makeBall(tier, x, y) {
    const t = TIERS[tier];
    const body = t.verts
      ? makeShapeBody(t.verts, x, y, BALL_OPTS)
      : Bodies.circle(x, y, t.r, BALL_OPTS);
    body.plugin = { tier, bornAt: performance.now(), merged: false };
    return body;
  }

  // 同じ段階同士が触れたら合体候補に積む。
  // 複合ボディの衝突は「パーツ」で飛んでくるので parent を見る。
  // merged フラグを即座に立てて、1フレームで3個以上が連鎖合体するのを防ぐ。
  function onCollisionStart(ev) {
    if (!playing) return;
    for (const pair of ev.pairs) {
      const a = pair.bodyA.parent, b = pair.bodyB.parent;
      if (a === b) continue;
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
        SabokoAudio.clear();
        pops.push({ x, y, r: TIERS[tier].r * 1.5, color: '#e08a5b', life: 1 });
      } else {
        SabokoAudio.merge(tier + 1);
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
      if (body.bounds.min.y < DEATH_Y) { over = true; break; }
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

  // 手持ちの絵が壁からはみ出さない範囲に収める
  function clampX(x, tier) {
    const t = TIERS[tier];
    return Math.min(W - t.ox - t.dw, Math.max(-t.ox, x));
  }

  function drop() {
    if (!playing || !canDrop) return;
    canDrop = false;
    Composite.add(world, makeBall(heldTier, clampX(heldX, heldTier), DROP_Y));
    SabokoAudio.drop();
    heldTier = nextTier;
    nextTier = randomTier();
    setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);
  }

  function endGame() {
    playing = false;
    SabokoAudio.gameOver();
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
  }

  // ---------------------------------------------------------------- 入力
  function pointerX(ev) {
    const rect = canvas.getBoundingClientRect();
    return (ev.clientX - rect.left) / rect.width * W;
  }

  canvas.addEventListener('pointermove', (ev) => { heldX = pointerX(ev); });
  canvas.addEventListener('pointerdown', (ev) => {
    SabokoAudio.unlock();
    heldX = pointerX(ev);
    ev.preventDefault();
  });
  canvas.addEventListener('pointerup', (ev) => { heldX = pointerX(ev); drop(); });

  window.addEventListener('keydown', (ev) => {
    SabokoAudio.unlock();
    if (ev.key === 'ArrowLeft') { heldX -= 12; ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { heldX += 12; ev.preventDefault(); }
    else if (ev.key === ' ' || ev.key === 'ArrowDown' || ev.key === 'Enter') { drop(); ev.preventDefault(); }
  });

  document.getElementById('retry').addEventListener('click', reset);

  const muteBtn = document.getElementById('mute');
  function paintMute() {
    const off = SabokoAudio.isMuted();
    muteBtn.textContent = off ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', off ? '音を出す' : '音を消す');
    muteBtn.setAttribute('aria-pressed', String(off));
  }
  muteBtn.addEventListener('click', () => {
    SabokoAudio.unlock();
    SabokoAudio.toggle();
    paintMute();
  });
  paintMute();

  // ---------------------------------------------------------------- 描画
  // g を引数に取るので、盤面にも進化表の小さい canvas にも同じ絵を描ける
  function paintSaboko(g, tier, x, y, angle, scale, alpha) {
    const t = TIERS[tier];
    g.save();
    g.globalAlpha = alpha === undefined ? 1 : alpha;
    g.translate(x, y);
    g.rotate(angle);
    if (scale !== 1) g.scale(scale, scale);

    if (t.image) {
      g.drawImage(t.image, t.ox, t.oy, t.dw, t.dh);
    } else {
      // 素材が無いときの仮の顔
      const r = t.r;
      const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, t.color);
      grad.addColorStop(1, shade(t.color, -0.18));
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(74,63,53,.4)';
      g.lineWidth = 1.5;
      g.stroke();

      g.fillStyle = '#4a3f35';
      const eye = Math.max(1.3, r * 0.085);
      g.beginPath(); g.arc(-r * 0.3, -r * 0.08, eye, 0, TAU); g.fill();
      g.beginPath(); g.arc(r * 0.3, -r * 0.08, eye, 0, TAU); g.fill();
      g.beginPath();
      g.arc(0, r * 0.02, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
      g.strokeStyle = '#4a3f35';
      g.lineWidth = Math.max(1, r * 0.055);
      g.stroke();
      if (r >= 26) {
        g.fillStyle = 'rgba(74,63,53,.45)';
        g.font = `${Math.round(r * 0.3)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText(String(tier + 1), 0, r * 0.72);
      }
    }
    g.restore();
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

    ctx.strokeStyle = 'rgba(217,203,181,.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  }

  function drawHeld() {
    if (!playing) return;
    const t = TIERS[heldTier];
    const x = clampX(heldX, heldTier);
    if (canDrop) {
      ctx.save();
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = 'rgba(74,63,53,.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, DROP_Y + t.oy + t.dh);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();
      paintSaboko(ctx, heldTier, x, DROP_Y, 0, 1);
    } else {
      paintSaboko(ctx, heldTier, x, DROP_Y, 0, 1, 0.22);
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

    const t = TIERS[nextTier];
    const scale = Math.min(1, 34 / Math.max(t.dw, t.dh));
    paintSaboko(ctx, nextTier, boxX + boxW / 2, boxY + 36, 0, scale);
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
      paintSaboko(ctx, body.plugin.tier, body.position.x, body.position.y, body.angle, 1);
    }
    if (DEBUG) drawHitboxes();
    drawPops(dt);
    drawHeld();
    drawNext();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- 起動
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  setupWorld();
  prepareTiers();
  bestEl.textContent = best;
  heldTier = randomTier();
  nextTier = randomTier();
  requestAnimationFrame(loop);
})();
