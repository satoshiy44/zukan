/* さぼこタワー — さぼこを積み上げて高さを競うゲーム
 *
 * 当たり判定はスイカゲームと同じ「絵のシルエットそのまま」。形データ
 * （assets/shapes.js）をそのまま共用しているので、丸ではない不揃いな形が
 * 積み重なる。うまく噛み合う置き方を探すのがそのまま面白さになる。
 *
 * 高さが伸びたらカメラを上へずらす。世界の座標は動かさず、描くときに
 * camera ぶん下へずらすだけなので、物理側は何も気にしなくていい。 */
(() => {
  'use strict';

  const { Engine, Bodies, Body, Composite, Common, Events } = Matter;
  if (typeof decomp !== 'undefined' && Common.setDecomp) Common.setDecomp(decomp);

  const W = 400;
  const H = 640;
  const PLATFORM_W = 170;
  const PLATFORM_TOP = 560;     // 土台の上面（world y）
  const HOLD_GAP = 125;         // 積み上がりの先端から、これだけ上で構える
  const HOLD_MIN_Y = 72;        // ただし画面のこれより上には行かない
  const CAM_PIVOT = 340;        // 積み上がりの先端をこの画面高さに保つ
  const LOST_BELOW = 220;       // 画面下からこれだけ落ちたら失敗
  const PIECE_R = 38;           // 面積をそろえる基準（円の半径に相当）
  const PX_PER_CM = 4;          // 見た目の高さを cm 表記に直す係数
  const DROP_COOLDOWN = 620;
  const LIVES = 3;
  const TAU = Math.PI * 2;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const heightEl = document.getElementById('height');
  const bestEl = document.getElementById('best');
  const overEl = document.getElementById('gameover');
  const BEST_KEY = 'saboko-tower-best';

  const SHAPES = [];            // 段階ごとではなく、積む部品として全種類を使う
  let engine, world, platform;
  let pieces, held, heldX, canDrop;
  let camera, cameraTarget, topScreenY, holdY;
  let count, heightCm, lives, state, lastFallAt;
  let starPop = null;   // 消えた星の演出 { index, t }
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let pointerX = null;
  const keys = { left: false, right: false };
  const puffs = [];

  // ---------------------------------------------------------------- 形の準備
  function polyArea(v) {
    let a = 0;
    for (let i = 0; i < v.length; i++) {
      const p = v[i], q = v[(i + 1) % v.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  }

  // Bodies.fromVertices は、凹形状の分割結果がちょうど1個になったときだけ
  // 指定座標を無視してポリゴン自身の重心にボディを置く。座標を入れ直して揃える。
  function makeShapeBody(verts, x, y, options) {
    const body = Bodies.fromVertices(x, y, [verts], options, true, true, 0.01, 0.01);
    if (body) Body.setPosition(body, { x, y });
    return body;
  }

  // 高さ y のところで、輪郭が左右どこまで広がっているかを測る。
  // 多角形の辺と水平線の交点を全部見るので、頂点が無い高さでも正しく出る。
  function widthAtY(poly, y) {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a.y - y) * (b.y - y) > 0) continue;   // 同じ側なら交差しない
      if (a.y === b.y) continue;
      const x = a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
      if (x < min) min = x;
      if (x > max) max = x;
    }
    return min === Infinity ? null : [min, max];
  }

  // シルエットそのままだと凸凹が噛み合わず、いくら置いても積み上がらない。
  // 上下が平行な台形に置き換えると、接する面が必ず水平になって積める。
  // 幅は絵の実際の輪郭から測るので、見た目と当たり判定の差は小さい。
  const TOP_SAMPLE = 0.18, BOTTOM_SAMPLE = 0.86;
  const MIN_EDGE_RATIO = 0.55;   // 上下の辺が細くなりすぎると乗せる場所が無くなる

  function trapezoidFor(poly, w, h) {
    const full = [0, w];
    const top = widthAtY(poly, h * TOP_SAMPLE) || full;
    const bottom = widthAtY(poly, h * BOTTOM_SAMPLE) || full;

    const widen = (edge) => {
      const width = edge[1] - edge[0];
      const need = w * MIN_EDGE_RATIO;
      if (width >= need) return edge;
      const c = (edge[0] + edge[1]) / 2;
      return [c - need / 2, c + need / 2];
    };
    const t = widen(top), b = widen(bottom);

    return [
      { x: t[0], y: 0 },
      { x: t[1], y: 0 },
      { x: b[1], y: h },
      { x: b[0], y: h },
    ];
  }

  function prepareShapes() {
    (window.SABOKO_SHAPES || []).forEach((raw) => {
      if (!raw) return;
      const unit = raw.poly.map(([px, py]) => ({ x: px * raw.w, y: py * raw.h }));
      const trap = trapezoidFor(unit, raw.w, raw.h);

      // 面積をそろえる。どれを引いても積みやすさが極端に変わらないように。
      const k = Math.sqrt(Math.PI * PIECE_R * PIECE_R / polyArea(trap));
      const verts = trap.map((p) => ({ x: p.x * k, y: p.y * k }));
      const probe = makeShapeBody(verts, 0, 0, {});
      if (!probe || !probe.parts.length) return;

      // 絵は台形ではなく元の外接矩形いっぱいに描く。台形の左上が
      // ボディ座標のどこに来たかを測って、そこから逆算する。
      const trapMinX = Math.min(...trap.map((p) => p.x)) * k;
      const shape = {
        verts,
        imgX: probe.bounds.min.x - trapMinX,
        imgY: probe.bounds.min.y,
        imgW: raw.w * k,
        imgH: raw.h * k,
        ox: probe.bounds.min.x,
        oy: probe.bounds.min.y,
        dw: probe.bounds.max.x - probe.bounds.min.x,
        dh: probe.bounds.max.y - probe.bounds.min.y,
        image: null,
      };
      const img = new Image();
      img.addEventListener('load', () => { shape.image = img; });
      img.src = raw.src;
      SHAPES.push(shape);
    });
  }

  // ---------------------------------------------------------------- 物理
  const PIECE_OPTS = {
    label: 'piece',
    restitution: 0.02,   // 積む遊びなので、ほとんど跳ねさせない
    friction: 0.75,      // 滑って崩れるより、噛み合って止まってほしい
    frictionStatic: 1.1,
    density: 0.0012,
    slop: 0.02,
  };

  function setupWorld() {
    engine = Engine.create();
    engine.gravity.y = 1;
    engine.positionIterations = 10;
    engine.velocityIterations = 10;
    // 積み上がりが増えるので、止まったものは寝かせて安定させる
    engine.enableSleeping = true;
    world = engine.world;
    Events.on(engine, 'collisionStart', onCollisionStart);
  }

  function onCollisionStart(ev) {
    if (state !== 'play') return;
    for (const pair of ev.pairs) {
      for (const body of [pair.bodyA.parent, pair.bodyB.parent]) {
        if (body.label !== 'piece' || body.plugin.landed) continue;
        body.plugin.landed = true;
        count++;
        TowerAudio.land(count);
        puffs.push({ x: body.position.x, y: body.bounds.max.y, life: 1 });
      }
    }
  }

  function reset() {
    if (world) Composite.clear(world, false);
    platform = Bodies.rectangle(W / 2, PLATFORM_TOP + 60, PLATFORM_W, 120, {
      isStatic: true, label: 'platform', friction: 0.9,
    });
    Composite.add(world, platform);
    pieces = [];
    puffs.length = 0;
    camera = 0; cameraTarget = 0;
    topScreenY = PLATFORM_TOP; holdY = HOLD_MIN_Y;
    count = 0; heightCm = 0; lives = LIVES; lastFallAt = -9999;
    starPop = null;
    canDrop = true;
    state = 'play';
    heightEl.textContent = '0';
    overEl.classList.add('hidden');
    nextPiece();
  }

  function nextPiece() {
    held = SHAPES.length ? SHAPES[Math.floor(Math.random() * SHAPES.length)] : null;
  }

  function clampX(x, shape) {
    if (!shape) return x;
    return Math.min(W - shape.imgX - shape.imgW, Math.max(-shape.imgX, x));
  }

  function drop() {
    if (state !== 'play' || !canDrop || !held) return;
    canDrop = false;
    const shape = held;
    const body = makeShapeBody(shape.verts, clampX(heldX, shape), holdY - camera, PIECE_OPTS);
    body.plugin = { shape, landed: false };
    Composite.add(world, body);
    pieces.push(body);
    TowerAudio.drop();
    nextPiece();
    setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);
  }

  // 崩れると何個もまとめて落ちる。それで残機が一気に尽きると理不尽なので、
  // 短い間に続けて落ちたぶんは「1回の崩壊」として数える。
  function loseLife() {
    const now = performance.now();
    TowerAudio.fall();
    if (now - lastFallAt < 1200) return;
    lastFallAt = now;
    lives--;
    starPop = { index: lives, t: 0 };
    if (lives <= 0) gameOver();
  }

  function gameOver() {
    state = 'over';
    TowerAudio.over();
    document.getElementById('final-height').textContent = heightCm;
    document.getElementById('final-count').textContent = count;
    overEl.classList.remove('hidden');
  }

  // ---------------------------------------------------------------- 更新
  function update(dt) {
    let target = heldX;
    if (pointerX !== null) target = pointerX;
    if (keys.left) target = heldX - 999;
    if (keys.right) target = heldX + 999;
    const dx = target - heldX;
    const step = 420 * dt;
    heldX += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    heldX = Math.max(10, Math.min(W - 10, heldX));

    // 落ちたものを片付ける
    for (let i = pieces.length - 1; i >= 0; i--) {
      const b = pieces[i];
      if (b.position.y + camera < H + LOST_BELOW) continue;
      Composite.remove(world, b);
      pieces.splice(i, 1);
      if (b.plugin.landed) count = Math.max(0, count - 1);
      loseLife();
      if (state === 'over') return;
    }

    // 積み上がりの先端。落下中のものは数えない。
    let top = PLATFORM_TOP;
    for (const b of pieces) {
      if (!b.plugin.landed) continue;
      if (b.bounds.min.y < top) top = b.bounds.min.y;
    }
    const cm = Math.max(0, Math.round((PLATFORM_TOP - top) / PX_PER_CM));
    if (cm !== heightCm) {
      const wasRecord = heightCm >= best;
      heightCm = cm;
      heightEl.textContent = heightCm;
      if (heightCm > best) {
        best = heightCm;
        bestEl.textContent = best;
        localStorage.setItem(BEST_KEY, String(best));
        if (!wasRecord) TowerAudio.record();
      }
    }

    cameraTarget = Math.max(0, CAM_PIVOT - top);
    camera += (cameraTarget - camera) * Math.min(1, dt * 4);

    // 構える高さは積み上がりに追従させる。固定にすると、序盤は高い位置から
    // 落とすことになり、その衝撃だけで土台が崩れてしまう。
    topScreenY = top + camera;
    holdY = Math.max(HOLD_MIN_Y, Math.min(topScreenY - HOLD_GAP, H * 0.42));

    if (starPop) {
      starPop.t += dt / 0.55;
      if (starPop.t >= 1) starPop = null;
    }

    for (let i = puffs.length - 1; i >= 0; i--) {
      puffs[i].life -= dt / 0.4;
      if (puffs[i].life <= 0) puffs.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- 描画
  function paint(g, shape, x, y, angle, alpha) {
    g.save();
    g.globalAlpha = alpha === undefined ? 1 : alpha;
    g.translate(x, y);
    g.rotate(angle);
    if (shape.image) {
      g.drawImage(shape.image, shape.imgX, shape.imgY, shape.imgW, shape.imgH);
    } else {
      g.fillStyle = '#9fb8c6';
      g.beginPath();
      g.arc(0, 0, PIECE_R, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#bcd8e8');
    sky.addColorStop(1, '#eaf2f6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 雲は世界の座標に置いてカメラで動かす。上に伸びている実感を出すため。
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 14; i++) {
      const wy = PLATFORM_TOP - 180 - i * 210 - (i % 3) * 60;
      const y = wy + camera;
      if (y < -60 || y > H + 60) continue;
      const x = ((i * 137) % (W + 120)) - 60;
      const r = 22 + (i % 3) * 9;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.arc(x + r * 0.9, y + 5, r * 0.75, 0, TAU);
      ctx.arc(x - r * 0.9, y + 6, r * 0.65, 0, TAU);
      ctx.fill();
    }

    // 100cm ごとの目盛り
    ctx.strokeStyle = 'rgba(53,65,74,.12)';
    ctx.fillStyle = 'rgba(53,65,74,.3)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.lineWidth = 1;
    for (let cm = 100; cm <= heightCm + 400; cm += 100) {
      const y = PLATFORM_TOP - cm * PX_PER_CM + camera;
      if (y < -20 || y > H) continue;
      ctx.beginPath();
      ctx.setLineDash([4, 6]);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(`${cm}cm`, 6, y - 4);
    }
  }

  function drawGround() {
    const y = PLATFORM_TOP + camera;
    ctx.fillStyle = '#7d9aab';
    ctx.fillRect(W / 2 - PLATFORM_W / 2, y, PLATFORM_W, H - y + 200);
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(W / 2 - PLATFORM_W / 2, y, PLATFORM_W, 5);
  }

  function drawHeld() {
    if (state !== 'play' || !held) return;
    const x = clampX(heldX, held);
    ctx.save();
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = 'rgba(53,65,74,.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, holdY + held.imgY + held.imgH);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.restore();
    paint(ctx, held, x, holdY, 0, canDrop ? 1 : 0.25);
  }

  function starPath(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.closePath();
  }

  const STAR_X = 26, STAR_Y = 27, STAR_R = 13, STAR_GAP = 31;

  function drawStars() {
    for (let i = 0; i < LIVES; i++) {
      const x = STAR_X + i * STAR_GAP;
      starPath(ctx, x, STAR_Y, STAR_R);
      if (i < lives) {
        ctx.fillStyle = '#f2b134';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,80,10,.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(53,65,74,.28)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 失った星は、その場で大きくなりながら消える
    if (starPop) {
      const x = STAR_X + starPop.index * STAR_GAP;
      ctx.save();
      ctx.globalAlpha = 1 - starPop.t;
      ctx.translate(x, STAR_Y);
      ctx.scale(1 + starPop.t * 1.4, 1 + starPop.t * 1.4);
      ctx.rotate(starPop.t * 0.9);
      starPath(ctx, 0, 0, STAR_R);
      ctx.fillStyle = '#f2b134';
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHud() {
    ctx.textAlign = 'left';
    drawStars();
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(53,65,74,.75)';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(`${heightCm} cm`, W - 14, 24);
    if (best > 0) {
      // 自己最高の高さに線を引いて、目標を見えるようにする
      const y = PLATFORM_TOP - best * PX_PER_CM + camera;
      if (y > 0 && y < H) {
        ctx.save();
        ctx.setLineDash([7, 5]);
        ctx.strokeStyle = 'rgba(212,105,90,.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(212,105,90,.85)';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText('BEST', W - 8, y - 5);
      }
    }
  }

  const DEBUG = new URLSearchParams(location.search).has('debug');

  function drawHitboxes() {
    ctx.save();
    ctx.strokeStyle = 'rgba(212,105,90,.9)';
    ctx.lineWidth = 1;
    for (const b of pieces) {
      for (const part of b.parts.length > 1 ? b.parts.slice(1) : b.parts) {
        ctx.beginPath();
        part.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y + camera) : ctx.moveTo(v.x, v.y + camera)));
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky();
    drawGround();
    for (const b of pieces) {
      paint(ctx, b.plugin.shape, b.position.x, b.position.y + camera, b.angle);
    }
    if (DEBUG) drawHitboxes();
    for (const p of puffs) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.5;
      ctx.strokeStyle = '#5b93b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y + camera, 18 * (1 + (1 - p.life)), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    drawHeld();
    drawHud();
  }

  // ---------------------------------------------------------------- 入力
  function toX(ev) {
    const rect = canvas.getBoundingClientRect();
    return (ev.clientX - rect.left) / rect.width * W;
  }

  canvas.addEventListener('pointerdown', (ev) => {
    TowerAudio.unlock();
    pointerX = toX(ev);
    ev.preventDefault();
  });
  canvas.addEventListener('pointermove', (ev) => { if (pointerX !== null) pointerX = toX(ev); });
  canvas.addEventListener('pointerup', (ev) => { pointerX = toX(ev); drop(); pointerX = null; });
  canvas.addEventListener('pointercancel', () => { pointerX = null; });

  window.addEventListener('keydown', (ev) => {
    TowerAudio.unlock();
    if (ev.key === 'ArrowLeft') { keys.left = true; ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { keys.right = true; ev.preventDefault(); }
    else if (ev.key === ' ' || ev.key === 'ArrowDown' || ev.key === 'Enter') { drop(); ev.preventDefault(); }
  });
  window.addEventListener('keyup', (ev) => {
    if (ev.key === 'ArrowLeft') keys.left = false;
    if (ev.key === 'ArrowRight') keys.right = false;
  });

  document.getElementById('retry').addEventListener('click', () => { TowerAudio.unlock(); reset(); });

  const muteBtn = document.getElementById('mute');
  function paintMute() {
    const off = TowerAudio.isMuted();
    muteBtn.textContent = off ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', off ? '音を出す' : '音を消す');
    muteBtn.setAttribute('aria-pressed', String(off));
  }
  muteBtn.addEventListener('click', () => { TowerAudio.unlock(); TowerAudio.toggle(); paintMute(); });

  // ---------------------------------------------------------------- ループ
  let dpr = 1;
  function fitCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const STEP = 1000 / 60;
  let last = performance.now();
  let acc = 0;
  function loop(now) {
    const dtMs = Math.min(50, now - last);
    last = now;
    if (state === 'play') {
      acc = Math.min(acc + dtMs, STEP * 3);
      while (acc >= STEP) {
        Engine.update(engine, STEP);
        acc -= STEP;
      }
      update(dtMs / 1000);
    } else {
      acc = 0;
    }
    render();
    requestAnimationFrame(loop);
  }

  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  setupWorld();
  prepareShapes();
  heldX = W / 2;
  bestEl.textContent = best;
  paintMute();
  reset();
  requestAnimationFrame(loop);
})();
