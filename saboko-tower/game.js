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
  const PLATFORM_W = 132;
  const PLATFORM_TOP = 560;     // 土台の上面（world y）
  const HOLD_GAP = 125;         // 積み上がりの先端から、これだけ上で構える
  const HOLD_MIN_Y = 72;        // ただし画面のこれより上には行かない
  const CAM_PIVOT = 340;        // 積み上がりの先端をこの画面高さに保つ
  const LOST_BELOW = 260;       // 土台の上面からこれだけ下へ行ったら落下
  const PIECE_R = 38;           // 面積をそろえる基準（円の半径に相当）
  const PX_PER_CM = 4;          // 見た目の高さを cm 表記に直す係数
  const DROP_COOLDOWN = 620;
  const START_LIVES = 3;
  const MAX_LIVES = 5;
  const COMBO_FOR_STAR = 4;     // これだけ続けて良い置き方をすると星が1つ戻る
  // 揺れと風は高さで強くなる。高いほど難しい、を素直な形で作る。
  const SWING_START_CM = 25;
  const SWING_MAX = 74;
  const WIND_START_CM = 120;
  const PERFECT_PX = 11;        // 真下の中心からこれだけ以内なら PERFECT
  const GOOD_PX = 26;
  const TAU = Math.PI * 2;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const heightEl = document.getElementById('height');
  const bestEl = document.getElementById('best');
  const overEl = document.getElementById('gameover');
  const BEST_KEY = 'saboko-tower-best';

  const SHAPES = [];            // 段階ごとではなく、積む部品として全種類を使う
  let engine, world, platform;
  let pieces, held, canDrop;
  let camera, cameraTarget, topScreenY, holdY;
  let count, heightCm, lives, state, lastFallAt;
  let craneX, swingPhase, swingAmp, combo, bestCombo;
  let windDir, windTimer, windPower;
  let judgeText = null;   // { text, sub, color, t }
  let starPop = null;   // 消えた星の演出 { index, t }
  let starGain = null;  // 増えた星の演出 { index, t }
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
    restitution: 0.05,   // 積む遊びなので、ほとんど跳ねさせない
    friction: 0.5,       // 高すぎると端に載せても滑らず、傾かなくなる
    frictionStatic: 0.7,
    density: 0.0012,
    slop: 0.02,
  };

  function setupWorld() {
    engine = Engine.create();
    engine.gravity.y = 1;
    engine.positionIterations = 10;
    engine.velocityIterations = 10;
    // 寝かせると微妙な傾きが止まってしまい、バランスの緊張感が消える。
    // 積み木遊びとしてはそこが肝なので、寝かせない。
    engine.enableSleeping = false;
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
    count = 0; heightCm = 0; lives = START_LIVES; lastFallAt = -9999;
    craneX = W / 2; swingPhase = 0; swingAmp = 0;
    combo = 0; bestCombo = 0;
    windDir = 1; windTimer = 3; windPower = 0;
    judgeText = null;
    starPop = null; starGain = null;
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

  // 吊っているさぼこの、いま実際にある位置。craneX を中心に左右へ揺れる。
  function heldXNow() {
    return craneX + Math.sin(swingPhase) * swingAmp;
  }

  function swingSpeed() {
    return 1.5 + Math.min(1.6, heightCm * 0.004);
  }

  // いま一番上にある積み木の中心。置く目標であり、判定の基準にもなる。
  function towerTopX() {
    let top = null;
    for (const b of pieces) {
      if (!b.plugin.landed) continue;
      if (!top || b.bounds.min.y < top.bounds.min.y) top = b;
    }
    return top ? top.position.x : W / 2;
  }

  function drop() {
    if (state !== 'play' || !canDrop || !held) return;
    canDrop = false;
    const shape = held;
    const x = clampX(heldXNow(), shape);
    const body = makeShapeBody(shape.verts, x, holdY - camera, PIECE_OPTS);
    // 揺れの勢いをそのまま横向きの速度として渡す。端で離すほど流れていく。
    Body.setVelocity(body, { x: Math.cos(swingPhase) * swingAmp * swingSpeed() / 60, y: 0 });
    body.plugin = { shape, landed: false, judged: false, targetX: towerTopX(), settle: 0 };
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

  // 止まったところで、真下の中心からどれだけずれたかを見る。
  // ずれの小ささがそのまま評価になり、続けるほど星が戻る。
  function judgePiece(b) {
    const dx = Math.abs(b.position.x - b.plugin.targetX);
    b.plugin.judged = true;

    if (dx < PERFECT_PX) {
      combo++;
      judgeText = { text: 'PERFECT', sub: `${combo} れんぞく`, color: '#f2b134', t: 0 };
      // ごほうびに姿勢を少し起こす。丁寧に置くと塔がまっすぐ育っていく。
      Body.setAngularVelocity(b, 0);
      if (Math.abs(b.angle) < 0.3) Body.setAngle(b, b.angle * 0.35);
      TowerAudio.record();
    } else if (dx < GOOD_PX) {
      combo++;
      judgeText = { text: 'GOOD', sub: `${combo} れんぞく`, color: '#5b93b8', t: 0 };
      Body.setAngularVelocity(b, b.angularVelocity * 0.4);
    } else {
      if (combo >= 2) judgeText = { text: 'ざんねん', sub: 'れんぞく とぎれた', color: '#8a97a0', t: 0 };
      combo = 0;
      return;
    }

    if (combo > bestCombo) bestCombo = combo;
    if (combo % COMBO_FOR_STAR === 0 && lives < MAX_LIVES) {
      lives++;
      starGain = { index: lives - 1, t: 0 };
      judgeText = { text: '星が もどった', sub: `★ ${lives}`, color: '#f2b134', t: 0 };
    }
  }

  function gameOver() {
    state = 'over';
    TowerAudio.over();
    document.getElementById('final-height').textContent = heightCm;
    document.getElementById('final-count').textContent = count;
    document.getElementById('final-combo').textContent = bestCombo;
    overEl.classList.remove('hidden');
  }

  // ---------------------------------------------------------------- 更新
  function update(dt) {
    let target = craneX;
    if (pointerX !== null) target = pointerX;
    if (keys.left) target = craneX - 999;
    if (keys.right) target = craneX + 999;
    const dx = target - craneX;
    const step = 420 * dt;
    craneX += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
    craneX = Math.max(30, Math.min(W - 30, craneX));

    // 高くなるほど大きく揺れる。低いうちは揺れないので序盤は素直に置ける。
    swingAmp = Math.min(SWING_MAX, Math.max(0, heightCm - SWING_START_CM) * 0.3);
    swingPhase += dt * swingSpeed();

    // 高所の風。向きが時々変わり、積み上がった塔を横から押す。
    if (heightCm > WIND_START_CM) {
      windTimer -= dt;
      if (windTimer <= 0) {
        windTimer = 4 + Math.random() * 5;
        windDir = Math.random() < 0.5 ? -1 : 1;
      }
      windPower = Math.min(1, (heightCm - WIND_START_CM) / 260);
      const f = windDir * windPower * 0.00021;
      for (const b of pieces) {
        if (!b.plugin.landed) continue;
        Body.applyForce(b, b.position, { x: f * b.mass, y: 0 });
      }
    } else {
      windPower = 0;
    }

    // 速度が十分落ちた状態がしばらく続いたら「置けた」とみなして判定する。
    for (const b of pieces) {
      if (b.plugin.judged || !b.plugin.landed) continue;
      const still = Math.hypot(b.velocity.x, b.velocity.y) < 0.4 && Math.abs(b.angularVelocity) < 0.02;
      b.plugin.settle = still ? b.plugin.settle + dt : 0;
      if (b.plugin.settle > 0.35) judgePiece(b);
    }

    if (judgeText) {
      judgeText.t += dt / 1.1;
      if (judgeText.t >= 1) judgeText = null;
    }
    if (starGain) {
      starGain.t += dt / 0.55;
      if (starGain.t >= 1) starGain = null;
    }

    // 落ちたものを片付ける。
    // 画面の下端で判定すると、カメラが上がったときに土台付近の積み木まで
    // 「画面外」になって落ちた扱いになってしまう。世界の座標で見る。
    for (let i = pieces.length - 1; i >= 0; i--) {
      const b = pieces[i];
      if (b.position.y < PLATFORM_TOP + LOST_BELOW) continue;
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
    const x = clampX(heldXNow(), held);

    // 吊り具のレールと紐。揺れているのが見て分かるように。
    ctx.strokeStyle = 'rgba(53,65,74,.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 44);
    ctx.lineTo(W, 44);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(craneX, 44);
    ctx.lineTo(x, holdY + held.imgY);
    ctx.stroke();

    // 真下にある積み木の中心。ここに合わせるほど良い判定になる。
    const tx = towerTopX();
    ctx.save();
    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = 'rgba(242,177,52,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, holdY);
    ctx.lineTo(tx, H);
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
    const slots = Math.max(START_LIVES, lives);
    for (let i = 0; i < slots; i++) {
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

    // 増えた星は、小さく飛び出してから収まる
    if (starGain) {
      const x = STAR_X + starGain.index * STAR_GAP;
      ctx.save();
      ctx.globalAlpha = 1 - starGain.t * 0.6;
      ctx.translate(x, STAR_Y);
      ctx.scale(1 + (1 - starGain.t) * 1.1, 1 + (1 - starGain.t) * 1.1);
      starPath(ctx, 0, 0, STAR_R);
      ctx.strokeStyle = '#f2b134';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
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

  function drawWind() {
    if (windPower <= 0) return;
    // 吊り具のレールと重ならないよう、右寄せの一段下に置く
    const y = 70;
    const cx = W - 62;
    ctx.save();
    ctx.globalAlpha = 0.35 + windPower * 0.5;
    ctx.strokeStyle = '#5b93b8';
    ctx.lineWidth = 2;
    const n = 1 + Math.round(windPower * 3);
    for (let i = 0; i < n; i++) {
      const len = 16 + i * 4;
      const ox = cx + windDir * (i * 13 - n * 6);
      ctx.beginPath();
      ctx.moveTo(ox - windDir * len / 2, y);
      ctx.lineTo(ox + windDir * len / 2, y);
      ctx.moveTo(ox + windDir * len / 2, y);
      ctx.lineTo(ox + windDir * (len / 2 - 6), y - 4);
      ctx.moveTo(ox + windDir * len / 2, y);
      ctx.lineTo(ox + windDir * (len / 2 - 6), y + 4);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(91,147,184,.75)';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('かぜ', cx, y + 18);
  }

  function drawJudge() {
    if (!judgeText) return;
    const t = judgeText.t;
    const y = 150 - t * 26;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - t) * 2.2);
    ctx.textAlign = 'center';
    ctx.fillStyle = judgeText.color;
    ctx.font = `700 ${Math.round(30 - t * 4)}px system-ui, sans-serif`;
    ctx.fillText(judgeText.text, W / 2, y);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(53,65,74,.65)';
    ctx.fillText(judgeText.sub, W / 2, y + 18);
    ctx.restore();
  }

  function drawHud() {
    ctx.textAlign = 'left';
    drawStars();
    drawWind();
    drawJudge();
    if (combo >= 2) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f2b134';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.fillText(`${combo} れんぞく`, 16, 70);
    }
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
  bestEl.textContent = best;
  paintMute();
  reset();
  requestAnimationFrame(loop);
})();
