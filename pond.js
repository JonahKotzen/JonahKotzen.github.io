/* Tank 01: a monsoon pond in cross-section.
   Every tadpole sits somewhere on an omnivore–carnivore scale (c = 0…1) that moves with what it eats:
   algae pushes it toward omnivore (plumper, smaller, more labial tooth rows), fairy shrimp push it toward
   carnivore (bigger, enlarged jaw muscle, sharper notched beak). Carnivores develop faster: they grow legs,
   crawl onto a rock to reabsorb their tails, and hop off as toadlets well before the omnivores do.
   Spadefoots in amplexus swim in now and then to lay eggs. Visitors drop shrimp or algae. */
(function () {
  const wrap = document.getElementById('pond');
  if (!wrap) return;
  const cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
  const root = wrap.closest('.pond-sec') || wrap, $ = (s) => root.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const mix = (h1, h2, t) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const ch = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t)).toString(16).padStart(2, '0'); return '#' + ch(16) + ch(8) + ch(0); };

  let W = 0, H = 0, SC = 1, surfaceY = 0, depth = 0, time = 0, dark = false, mono = 'monospace', P = {};
  let running = false, visible = false, paused = false, userStarted = false, mode = 'shrimp', selected = null;
  let tufts = [], shrimp = [], tads = [], eggs = [], food = [], fx = [], toadlets = [], cysts = [], specks = [], rocks = [];
  let pair = null, pairT = 8;

  function palette() {
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [236, 238, 231];
    dark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) < 110;
    mono = getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace';
    P = dark ? { waterTop: 'rgba(52,86,96,0.80)', waterBot: 'rgba(24,44,44,0.95)', surface: 'rgba(160,200,210,0.55)', mud1: '#3B2F22', mud2: '#2E251B', mud3: '#251E16', land: '#4A3B2A', ink: '#E6EAE3', algae: '#5E8F3E', algaeDim: '#3A5530', ray: 'rgba(200,230,240,0.05)', speck: 'rgba(210,220,200,0.18)', rock: '#5B5A55', rockHi: '#77766F' }
      : { waterTop: 'rgba(150,192,196,0.62)', waterBot: 'rgba(96,132,118,0.78)', surface: 'rgba(255,255,255,0.85)', mud1: '#C9A878', mud2: '#B38F60', mud3: '#9C794E', land: '#D8BD8E', ink: '#18201D', algae: '#4F8A35', algaeDim: '#8BA868', ray: 'rgba(255,255,255,0.10)', speck: 'rgba(60,70,50,0.22)', rock: '#8E8A80', rockHi: '#B3AFA4' };
  }

  /* ---------- geometry ---------- */
  function floorY(x) { const u = Math.abs((x - W / 2) / (W / 2)); return surfaceY + depth * (1 - Math.pow(Math.min(u, 1), 3.2)) - (u > 0.9 ? (u - 0.9) * H * 0.6 : 0); }
  const inWater = (x) => floorY(x) > surfaceY + 24;
  const bounds = (x, pad) => ({ top: surfaceY + 10 + pad, bot: floorY(clamp(x, 0, W)) - pad });
  function shoreX(side) { // x where the bank meets the waterline
    let x = side < 0 ? W * 0.05 : W * 0.95;
    while (floorY(x) < surfaceY + 2 && x > 0 && x < W) x -= side * 2;
    return x;
  }

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(cv.getBoundingClientRect().height);
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    SC = W < 600 ? 0.82 : clamp(W / 1000, 0.8, 1.3);
    surfaceY = H * (W < 600 ? 0.2 : 0.17); depth = H * 0.72;
    tufts = [];
    for (let x = W * 0.08; x < W * 0.92; x += 15 * SC) if (floorY(x) - surfaceY > 50) tufts.push({ x: x + rnd(-4, 4), b: rnd(0.6, 1), sway: rnd(0, TAU) });
    specks = Array.from({ length: Math.round(W / 14) }, () => ({ x: rnd(0, W), y: rnd(surfaceY, H), r: rnd(0.5, 1.6), v: rnd(2, 7) }));
    cysts = Array.from({ length: Math.round(W / 22) }, () => ({ x: rnd(W * 0.12, W * 0.88), d: rnd(6, 34) }));
    rocks = [-1, 1].map(side => { const x = shoreX(side) + side * -14 * SC; return { x, y: surfaceY + 6 * SC, r: 16 * SC, side }; });
  }

  /* ---------- creatures ---------- */
  function makeTad(x, y, c, dev) {
    return { x, y, vx: rnd(-15, 15), vy: rnd(-4, 4), c, dev, age: dev * 40, phase: rnd(0, TAU), heading: rnd(0, TAU), face: 1, pitch: 0,
      state: 'wander', t: 0, cool: rnd(1, 3), target: null, gape: 0, strikeT: 0, tail: 1, fade: 1, wp: null };
  }
  const sizeOf = (t) => (5.5 + 10 * Math.min(1, t.age / 30)) * (0.82 + 0.4 * t.c) * SC;
  function makeShrimp(x, y, adult) { return { x, y, vx: rnd(-20, 20), vy: rnd(-6, 6), heading: rnd(0, TAU), turn: 0, phase: rnd(0, TAU), face: 1, pitch: 0, grow: adult ? 1 : 0, alive: true, sucked: null }; }
  const shrimpL = (s) => lerp(7, 24, s.grow) * SC;

  function populate() {
    tads = [makeTad(W * 0.35, surfaceY + depth * 0.35, 0.85, 0.45), makeTad(W * 0.6, surfaceY + depth * 0.4, 0.75, 0.3),
            makeTad(W * 0.45, surfaceY + depth * 0.6, 0.15, 0.4), makeTad(W * 0.7, surfaceY + depth * 0.55, 0.2, 0.25), makeTad(W * 0.28, surfaceY + depth * 0.6, 0.3, 0.15)];
    shrimp = [];
    for (let i = 0; i < 7; i++) shrimp.push(makeShrimp(rnd(W * 0.15, W * 0.85), rnd(surfaceY + 30, surfaceY + depth * 0.6), i < 4));
    eggs = []; food = []; toadlets = []; pair = null; pairT = 8;
  }

  /* ---------- movement ---------- */
  function steer(o, tx, ty, speed, turn, dt) {
    const want = Math.atan2(ty - o.y, tx - o.x); let d = ((want - o.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    o.heading += clamp(d, -turn * dt, turn * dt);
    o.vx = lerp(o.vx, Math.cos(o.heading) * speed, 1 - Math.exp(-3 * dt)); o.vy = lerp(o.vy, Math.sin(o.heading) * speed, 1 - Math.exp(-3 * dt));
  }
  function wander(o, speed, dt) {
    o.t -= dt;
    if (o.t <= 0 || !o.wp) { o.t = rnd(2, 5); const x = rnd(W * 0.14, W * 0.86), b = bounds(x, 24); o.wp = { x, y: rnd(b.top + 8, Math.max(b.top + 10, b.bot - 8)) }; }
    steer(o, o.wp.x, o.wp.y, speed, 1.6, dt);
  }
  function integrate(o, dt, s) {
    o.x += o.vx * dt; o.y += o.vy * dt;
    const b = bounds(o.x, s * 1.1);
    if (o.y < b.top) { o.y = b.top; o.vy = Math.abs(o.vy) * 0.3; o.heading = Math.abs(o.heading); }
    if (o.y > b.bot) { o.y = b.bot; o.vy = -Math.abs(o.vy) * 0.3; if (o.state !== 'graze') o.heading = -Math.abs(o.heading); }
    if (!inWater(o.x) || o.x < W * 0.06 || o.x > W * 0.94) { o.x = clamp(o.x, W * 0.08, W * 0.92); while (!inWater(o.x)) o.x += o.x < W / 2 ? 3 : -3; o.vx *= -1; o.heading = Math.PI - o.heading; }
    if (Math.abs(o.vx) > 2) o.face = o.vx >= 0 ? 1 : -1;
    o.pitch = lerp(o.pitch, clamp(Math.atan2(o.vy, Math.abs(o.vx) + 1e-3), -0.8, 0.8), 1 - Math.exp(-5 * dt));
  }
  const mouthOf = (t) => { const s = sizeOf(t); return { x: t.x + t.face * Math.cos(t.pitch) * s * 1.02, y: t.y + Math.sin(t.pitch) * s * 1.02 + s * lerp(0.45, 0.22, t.c) }; };

  /* ---------- update ---------- */
  function update(dt) {
    time += dt;

    // shrimp: nauplii hatch from cysts in the mud and grow into adults
    shrimp.forEach(s => {
      if (!s.alive) return;
      s.phase += dt * (s.sucked ? 30 : 14); s.grow = Math.min(1, s.grow + dt / 30);
      if (s.sucked) { const t = s.sucked, m = mouthOf(t); s.x = lerp(s.x, m.x, 1 - Math.exp(-(4 + 16 * t.gape) * dt)); s.y = lerp(s.y, m.y, 1 - Math.exp(-(4 + 16 * t.gape) * dt)); if (Math.hypot(s.x - m.x, s.y - m.y) < sizeOf(t) * 0.4) eatShrimp(t, s); return; }
      s.turn = clamp(s.turn + rnd(-3, 3) * dt, -1.2, 1.2); s.heading += s.turn * dt;
      const sp = lerp(10, 34, s.grow) * SC;
      s.vx = lerp(s.vx, Math.cos(s.heading) * sp, 1 - Math.exp(-2 * dt)); s.vy = lerp(s.vy, Math.sin(s.heading) * sp * 0.6, 1 - Math.exp(-2 * dt));
      s.x += s.vx * dt; s.y += s.vy * dt;
      const b = bounds(s.x, 6);
      if (s.y < b.top) { s.y = b.top; s.heading = Math.abs(s.heading); }
      if (s.y > b.bot) { s.y = b.bot; s.heading = -Math.abs(s.heading); }
      if (!inWater(s.x) || s.x < W * 0.07 || s.x > W * 0.93) { s.x = clamp(s.x, W * 0.08, W * 0.92); s.heading = Math.PI - s.heading; s.vx *= -1; }
      if (Math.abs(s.vx) > 1) s.face = s.vx >= 0 ? 1 : -1;
      s.pitch = lerp(s.pitch, clamp(Math.atan2(s.vy, Math.abs(s.vx) + 1e-3), -0.6, 0.6), 1 - Math.exp(-4 * dt));
    });
    shrimp = shrimp.filter(s => s.alive);
    if (shrimp.length < (W < 600 ? 5 : 8) && Math.random() < dt * 0.5) {
      const c = cysts[(Math.random() * cysts.length) | 0];
      if (c && inWater(c.x)) { const s = makeShrimp(c.x, floorY(c.x) - 5, false); s.heading = -Math.PI / 2; shrimp.push(s); fx.push({ kind: 'puff', x: c.x, y: floorY(c.x) - 4, t: 0 }); }
    }

    // dropped algae sinks
    food.forEach(f => { if (f.y < floorY(f.x) - 4) f.y += 22 * SC * dt; });
    food = food.filter(f => f.left > 0);

    tads.forEach(t => tadpole(t, dt));
    tads = tads.filter(t => t.fade > 0);
    tufts.forEach(f => { f.b = Math.min(1, f.b + dt * 0.015); });

    // spadefoots in amplexus come to lay eggs when the pond thins out
    pairT -= dt;
    if (!pair && pairT <= 0 && tads.length < 8) { const dir = Math.random() < 0.5 ? 1 : -1, ex = dir > 0 ? W * 0.04 : W * 0.96; pair = { x: ex, y: floorY(ex) - 8, dir, state: 'enter', t: 0, tx: dir > 0 ? rnd(W * 0.25, W * 0.42) : rnd(W * 0.58, W * 0.75), laid: 0 }; }
    if (pair) amplex(pair, dt);
    eggs.forEach(e => { if (!e.done) { e.p += dt / 18; e.spin += dt; if (e.p >= 1) { e.done = true; if (tads.length < 11) tads.push(makeTad(e.x, e.y - 4, rnd(0.3, 0.5), 0)); } } else e.pop += dt; });
    eggs = eggs.filter(e => !e.done || e.pop < 1.2);

    toadlets.forEach(k => { k.t += dt; k.x += k.dir * 34 * SC * dt; k.y = floorY(clamp(k.x, 0, W)) - 4 - Math.abs(Math.sin(k.t * 4)) * 12 * SC; if (k.x < -20 || k.x > W + 20) k.gone = true; });
    toadlets = toadlets.filter(k => !k.gone);
    specks.forEach(p => { p.y -= p.v * dt * 0.3; if (p.y < surfaceY) p.y = floorY(p.x) - 2; });
    fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < (f.life || 0.8));
    if (selected && (!tads.includes(selected) || selected.state === 'meta' || selected.state === 'perch')) selected = null;
  }

  function tadpole(t, dt) {
    const s = sizeOf(t);
    t.age += dt;
    // carnivores develop faster: they're the ones racing a drying pond
    if (t.state !== 'perch') t.dev = Math.min(1, t.dev + dt * (0.007 + 0.03 * t.c * t.c));
    t.phase += dt * (t.state === 'strike' ? 22 : t.state === 'graze' ? 6 : 8);

    if (t.dev > 0.9 && t.state !== 'meta' && t.state !== 'perch') { if (t.target) t.target.claim = null; t.state = 'meta'; t.target = null; t.rock = rocks.reduce((a, r) => Math.abs(r.x - t.x) < Math.abs(a.x - t.x) ? r : a); }

    if (t.state === 'wander') {
      t.gape = lerp(t.gape, 0, 1 - Math.exp(-10 * dt));
      wander(t, (16 + 12 * t.c) * SC, dt); t.cool -= dt;
      if (t.cool <= 0) {
        if (Math.random() < 0.15 + 0.75 * t.c) { // hunt: small tadpoles only manage nauplii
          let best = null, bd = 1e9;
          shrimp.forEach(sh => { if (sh.sucked || sh.claim) return; if (shrimpL(sh) > s * 1.4) return; const d = Math.hypot(sh.x - t.x, sh.y - t.y); if (d < bd) { bd = d; best = sh; } });
          if (best && bd < 280 * SC) { t.target = best; best.claim = t; t.state = 'hunt'; } else t.cool = 1.5;
        } else {
          const opts = tufts.filter(f => f.b > 0.4 && !tads.some(o => o.target === f));
          if (opts.length) { t.target = opts.reduce((a, f) => Math.abs(f.x - t.x) < Math.abs(a.x - t.x) ? f : a); t.state = 'descend'; } else t.cool = 2;
        }
      }
    } else if (t.state === 'hunt') {
      const sh = t.target;
      if (!sh || !sh.alive || (sh.sucked && sh.sucked !== t)) { t.state = 'wander'; t.target = null; t.cool = 1; }
      else {
        steer(t, sh.x, sh.y, (24 + 22 * t.c) * SC, 2.6, dt);
        const m = mouthOf(t);
        if (Math.hypot(sh.x - m.x, sh.y - m.y) < s * 2) { t.state = 'strike'; t.strikeT = 0; }
      }
    } else if (t.state === 'strike') {
      t.strikeT += dt / 0.35; const k = t.strikeT;
      t.gape = k < 0.6 ? Math.sin((k / 0.6) * Math.PI / 2) : Math.max(0, 1 - (k - 0.6) / 0.4);
      t.vx = Math.cos(t.heading) * 50 * SC * (k < 0.5 ? 1 : 0.2); t.vy = Math.sin(t.heading) * 50 * SC * (k < 0.5 ? 1 : 0.2);
      const sh = t.target, m = mouthOf(t);
      if (sh && sh.alive && !sh.sucked && t.gape > 0.25 && Math.hypot(sh.x - m.x, sh.y - m.y) < s * 3) sh.sucked = t;
      if (k >= 1) { if (sh && sh.sucked === t && sh.alive) eatShrimp(t, sh); if (sh) sh.claim = null; t.state = 'wander'; t.target = null; t.cool = rnd(2, 4); t.gape = 0; }
    } else if (t.state === 'descend') {
      const f = t.target, fx0 = f.x, fy = (f.y !== undefined ? f.y : floorY(f.x)) - s * 0.7;
      if (f.left !== undefined && f.left <= 0) { t.state = 'wander'; t.target = null; }
      else { steer(t, fx0 - t.face * s * 0.5, fy, (16 + 10 * t.c) * SC, 2.2, dt); if (Math.hypot(t.x - fx0, t.y - fy) < s * 1.3) { t.state = 'graze'; t.t = rnd(3, 5); } }
    } else if (t.state === 'graze') {
      const f = t.target;
      t.vx = lerp(t.vx, 0, 0.1); t.vy = lerp(t.vy, 3, 0.1); t.face = f.x >= t.x ? 1 : -1;
      t.gape = 0.5 + 0.5 * Math.sin(time * 5.5 * TAU); t.pitch = lerp(t.pitch, 0.55, 1 - Math.exp(-4 * dt));
      if (f.left !== undefined) { f.left -= dt * 0.35; t.c = Math.max(0, t.c - dt * 0.05); }
      else { f.b = Math.max(0, f.b - dt * 0.09); t.c = Math.max(0, t.c - dt * 0.012); }
      if (Math.random() < dt * 5) { const m = mouthOf(t); fx.push({ kind: 'bit', x: m.x, y: m.y, vx: rnd(-10, 10), vy: rnd(-18, -6), t: 0 }); }
      t.t -= dt;
      if (t.t <= 0 || (f.left !== undefined ? f.left <= 0 : f.b < 0.1)) { t.state = 'wander'; t.target = null; t.cool = rnd(2, 5); t.gape = 0; t.wp = null; }
    } else if (t.state === 'meta') { // legs out: head for a rock at the shore
      const r = t.rock; steer(t, r.x, r.y + s * 0.2, 26 * SC, 2.4, dt);
      t.gape = 0;
      if (Math.hypot(t.x - r.x, t.y - (r.y + s * 0.2)) < s) { t.state = 'perch'; t.t = 0; t.vx = t.vy = 0; t.face = -r.side; }
    } else if (t.state === 'perch') { // half in, half out, reabsorbing the tail
      t.x = lerp(t.x, t.rock.x, 0.1); t.y = lerp(t.y, t.rock.y - s * 0.15, 0.1); t.pitch = lerp(t.pitch, -0.25, 0.1);
      t.tail = Math.max(0, t.tail - dt / 7); t.dev = 1;
      if (t.tail <= 0) { t.fade = 0; toadlets.push({ x: t.x, y: t.y, dir: t.rock.side, t: 0, s: s * 0.55 }); }
      return;
    }
    if (t.state !== 'perch') integrate(t, dt, s);
  }

  function eatShrimp(t, s) {
    if (!s.alive) return;
    s.alive = false; s.sucked = null; s.claim = null;
    t.c = Math.min(1, t.c + (s.grow > 0.6 ? 0.12 : 0.05));
    const m = mouthOf(t); fx.push({ kind: 'gulp', x: m.x, y: m.y, t: 0, life: 0.9 });
  }

  function amplex(q, dt) {
    q.t += dt;
    if (q.state === 'enter') { q.x += q.dir * 30 * SC * dt; q.y = floorY(q.x) - 10 * SC - Math.abs(Math.sin(q.t * 3.5)) * 14 * SC; if (floorY(q.x) > surfaceY + 30) { q.state = 'swim'; q.y = surfaceY + 10; } }
    else if (q.state === 'swim') { const ty = floorY(q.tx) - 18 * SC; q.x = lerp(q.x, q.tx, 1 - Math.exp(-0.6 * dt)); q.y = lerp(q.y, ty, 1 - Math.exp(-0.8 * dt)); if (Math.abs(q.x - q.tx) < 6 && Math.abs(q.y - ty) < 6) { q.state = 'lay'; q.t = 0; } }
    else if (q.state === 'lay') { if (q.t > q.laid * 0.4 && q.laid < 10) { q.laid++; eggs.push({ x: q.x - q.dir * (q.laid * 4 + rnd(-3, 3)) * SC, y: floorY(q.x) - rnd(5, 12) * SC, p: rnd(0, 0.15), done: false, spin: rnd(0, TAU), pop: 0 }); } if (q.t > 5) q.state = 'leave'; }
    else { q.x -= q.dir * 40 * SC * dt; q.y -= 26 * SC * dt; if (q.y < surfaceY || !inWater(q.x)) { pair = null; pairT = rnd(35, 50); } }
  }

  /* ---------- drawing ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + depth); g.addColorStop(0, P.waterTop); g.addColorStop(1, P.waterBot);
    ctx.beginPath(); ctx.moveTo(0, surfaceY); for (let x = 0; x <= W; x += 6) ctx.lineTo(x, surfaceY + Math.sin(x * 0.03 + time * 1.4) * 1.5); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = P.ray;
    for (let i = 0; i < 6; i++) { const x0 = W * (0.12 + i * 0.15) + Math.sin(time * 0.3 + i) * 30; ctx.beginPath(); ctx.moveTo(x0, surfaceY); ctx.lineTo(x0 + 40, surfaceY); ctx.lineTo(x0 + 120, surfaceY + depth); ctx.lineTo(x0 + 50, surfaceY + depth); ctx.fill(); }
    ctx.fillStyle = P.speck; specks.forEach(p => { if (p.y > surfaceY + 2 && p.y < floorY(p.x)) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); } });
    drawMud(); tufts.forEach(drawTuft); drawRocks(); food.forEach(drawFood); drawEggs();
    tads.filter(t => t.c < 0.5).forEach(drawTad); shrimp.forEach(drawShrimp); tads.filter(t => t.c >= 0.5).forEach(drawTad);
    tads.forEach(t => { if (t.state === 'strike') drawFlow(t); });
    if (pair) { const d = pair.state === 'leave' ? -pair.dir : pair.dir; drawToad(pair.x, pair.y, 24 * SC, d); drawToad(pair.x - d * 5 * SC, pair.y - 16 * SC, 18 * SC, d); }
    toadlets.forEach(k => drawToad(k.x, k.y, k.s, k.dir));
    fx.forEach(drawFx);
    ctx.strokeStyle = P.surface; ctx.lineWidth = 1.5; ctx.beginPath(); let st = false;
    for (let x = 0; x <= W; x += 6) { const y = surfaceY + Math.sin(x * 0.03 + time * 1.4) * 1.5; if (floorY(x) > y) { st ? ctx.lineTo(x, y) : ctx.moveTo(x, y); st = true; } }
    ctx.stroke();
  }

  function drawMud() {
    [[0, P.mud1], [14, P.mud2], [40, P.mud3]].forEach(([off, col]) => { ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, floorY(x) + off * SC + (off ? Math.sin(x * 0.02 + off) * 3 : 0)); ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, surfaceY + 1); ctx.clip(); ctx.fillStyle = P.land; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, floorY(x)); ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = dark ? 'rgba(230,200,160,0.5)' : 'rgba(120,80,40,0.55)';
    cysts.forEach(c => { if (inWater(c.x)) { ctx.beginPath(); ctx.arc(c.x, floorY(c.x) + c.d * SC, 1.6 * SC, 0, TAU); ctx.fill(); } });
  }
  function drawRocks() {
    rocks.forEach(r => { ctx.fillStyle = P.rock; ctx.beginPath(); ctx.ellipse(r.x, r.y + r.r * 0.35, r.r * 1.4, r.r * 0.8, 0, Math.PI, TAU); ctx.lineTo(r.x + r.r * 1.4, r.y + r.r); ctx.lineTo(r.x - r.r * 1.4, r.y + r.r); ctx.fill();
      ctx.fillStyle = P.rockHi; ctx.beginPath(); ctx.ellipse(r.x - r.r * 0.3, r.y - r.r * 0.2, r.r * 0.6, r.r * 0.2, -0.2, 0, TAU); ctx.fill(); });
  }
  function drawTuft(f) {
    const y = floorY(f.x), h = (3 + 11 * f.b) * SC; ctx.strokeStyle = f.b > 0.3 ? P.algae : P.algaeDim; ctx.lineWidth = 1.4 * SC; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { const sw = Math.sin(time * 1.3 + f.sway + i) * 2.5 * SC; ctx.beginPath(); ctx.moveTo(f.x + i * 2.5 * SC, y + 1); ctx.quadraticCurveTo(f.x + i * 3 * SC + sw * 0.5, y - h * 0.5, f.x + i * 3.5 * SC + sw, y - h * (i ? 0.8 : 1)); ctx.stroke(); }
  }
  function drawFood(f) { ctx.fillStyle = P.algae; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(f.x + Math.cos(i * 1.3) * 4 * SC, f.y + Math.sin(i * 1.9) * 3 * SC, (2 + 2 * f.left) * SC, 0, TAU); ctx.fill(); } }

  function drawTad(t) {
    const s = sizeOf(t), c = t.c;
    ctx.save(); ctx.globalAlpha = t.fade; ctx.translate(t.x, t.y); ctx.scale(t.face, 1); ctx.rotate(t.pitch);
    const meta = Math.max(0, (t.dev - 0.9) / 0.1);
    const body = mix(mix('#8D8A4E', '#D9703F', c), '#7B8A55', meta * (1 - t.tail * 0.5));
    const line = c > 0.5 ? '#7A3A1E' : '#4C4A2A';
    if (selected === t) { ctx.strokeStyle = dark ? '#8C9DF0' : '#2B3F9C'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(-s * 0.4, 0, s * 2.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    // tail (shrinks as it's reabsorbed)
    const N = 14, L = s * lerp(2.6, 2.2, c) * t.tail, amp = s * 0.4 * (t.state === 'perch' ? 0.2 : 1), pts = [];
    if (t.tail > 0.02) {
      for (let i = 0; i <= N; i++) { const u = i / N; pts.push([-s * 0.7 - L * u, Math.sin(t.phase - u * 5.5) * amp * Math.pow(u, 1.3)]); }
      ctx.fillStyle = c > 0.5 ? 'rgba(235,165,122,0.55)' : 'rgba(190,185,140,0.55)'; ctx.beginPath();
      pts.forEach(([x, y], i) => { const fin = s * 0.46 * Math.sin(Math.PI * Math.pow(i / N, 0.7)) * t.tail + 0.01; i ? ctx.lineTo(x, y - fin) : ctx.moveTo(x, y - fin); });
      for (let i = N; i >= 0; i--) { const fin = s * 0.4 * Math.sin(Math.PI * Math.pow(i / N, 0.7)) * t.tail + 0.01; ctx.lineTo(pts[i][0], pts[i][1] + fin); } ctx.fill();
      ctx.fillStyle = body; ctx.beginPath();
      pts.forEach(([x, y], i) => { const th = s * 0.2 * (1 - i / N) + s * 0.03; i ? ctx.lineTo(x, y - th) : ctx.moveTo(x, y - th); });
      for (let i = N; i >= 0; i--) { const th = s * 0.2 * (1 - i / N) + s * 0.03; ctx.lineTo(pts[i][0], pts[i][1] + th); } ctx.fill();
    }
    // legs: hind legs first, then forelegs
    const hind = clamp((t.dev - 0.6) / 0.25, 0, 1), fore = clamp((t.dev - 0.82) / 0.1, 0, 1);
    ctx.strokeStyle = body; ctx.lineCap = 'round';
    if (hind > 0) { ctx.lineWidth = s * 0.16; ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.35); ctx.lineTo(-s * (0.6 + 0.5 * hind), s * (0.35 + 0.45 * hind)); ctx.lineTo(-s * (0.3 + 0.6 * hind), s * (0.4 + 0.6 * hind)); ctx.stroke(); }
    if (fore > 0) { ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(s * 0.35, s * 0.45); ctx.lineTo(s * (0.4 + 0.15 * fore), s * (0.45 + 0.45 * fore)); ctx.stroke(); }
    // body: omnivores plumper and rounder, carnivores longer with a big jaw muscle
    const ry = s * lerp(0.84, 0.7, c) + (c > 0.5 ? t.gape * s * 0.15 : 0);
    ctx.fillStyle = body; ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, s, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(-s * 0.1, ry * 0.42, s * 0.7, ry * 0.42, 0, 0, Math.PI); ctx.fill();
    if (c > 0.15) { ctx.fillStyle = `rgba(160,50,30,${0.25 + 0.4 * c})`; ctx.beginPath(); ctx.ellipse(s * 0.28, s * 0.12, s * (0.12 + 0.28 * c), s * (0.1 + 0.2 * c), 0.3, 0, TAU); ctx.fill(); }
    if (c < 0.6) { ctx.strokeStyle = 'rgba(60,55,30,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-s * 0.15, s * 0.2, s * 0.24 * (1 - c), 0, 5.2); ctx.stroke(); } // long coiled gut
    // eye (bulges as it metamorphoses)
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * 0.45, -s * (0.3 + 0.12 * meta), s * (0.12 + 0.06 * meta), 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.48, -s * (0.34 + 0.12 * meta), s * 0.04, 0, TAU); ctx.fill();
    // mouth: terminal + sharp notched beak (carnivore) vs ventral + smooth beak and many tooth rows (omnivore)
    if (meta < 0.8) {
      const mx = s * lerp(0.8, 0.97, c), my = s * lerp(0.55, 0.22, c), g = t.gape;
      ctx.fillStyle = '#2A0F08'; ctx.beginPath(); ctx.ellipse(mx, my, s * (0.08 + 0.14 * g * (0.4 + c)), s * (0.04 + 0.16 * g * (0.4 + c)), 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#151515'; ctx.lineWidth = 1 + 1.2 * c; ctx.beginPath();
      const bw = s * (0.12 + 0.06 * c), notch = s * 0.1 * c, by = my - s * (0.05 + 0.14 * g);
      ctx.moveTo(mx - bw, by); ctx.lineTo(mx, by + notch); ctx.lineTo(mx + bw * 0.8, by - notch * 0.6); ctx.stroke();
      const rows = Math.round(lerp(5, 1, c)); ctx.strokeStyle = 'rgba(30,25,15,0.7)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < rows; i++) { ctx.beginPath(); ctx.moveTo(mx - s * 0.2, my + s * (0.1 + i * 0.055)); ctx.lineTo(mx + s * 0.1, my + s * (0.14 + i * 0.055)); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawShrimp(s) {
    const L = shrimpL(s), col = '#E59A6C';
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.face, 1); ctx.rotate(s.pitch);
    if (s.grow < 0.35) { // nauplius
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, L * 0.55, L * 0.38, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#C9764B'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const a = Math.sin(s.phase - i) * 0.6; ctx.beginPath(); ctx.moveTo(L * 0.2 - i * L * 0.2, 0); ctx.lineTo(L * (0.2 - i * 0.2) + Math.cos(-1.6 + a) * L * 0.7, Math.sin(-1.6 + a) * L * 0.7); ctx.stroke(); }
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.38, 0, L * 0.08, 0, TAU); ctx.fill();
      ctx.restore(); return;
    }
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = L * 0.11;
    ctx.beginPath(); ctx.moveTo(-L * 0.1, 0); ctx.quadraticCurveTo(-L * 0.55, Math.sin(s.phase * 0.5) * 2, -L * 0.85, Math.sin(s.phase * 0.5) * 3); ctx.stroke();
    ctx.strokeStyle = '#C2462B'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, -L * 0.1); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, L * 0.08); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(L * 0.18, 0, L * 0.34, L * 0.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark ? 'rgba(255,200,170,0.85)' : 'rgba(200,110,70,0.9)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { const x = L * (0.44 - i * 0.065), a = -Math.PI / 2 + Math.sin(s.phase - i * 0.65) * 0.55 - 0.25; ctx.beginPath(); ctx.moveTo(x, -L * 0.06); ctx.lineTo(x + Math.cos(a) * L * 0.17, -L * 0.06 + Math.sin(a) * L * 0.17); ctx.stroke(); }
    ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L * 0.48, 0); ctx.lineTo(L * 0.62, L * 0.08); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.64, L * 0.09, L * 0.055, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawFlow(t) {
    const m = mouthOf(t), g = t.gape, s = sizeOf(t); if (g < 0.1) return;
    ctx.save(); ctx.globalAlpha = 0.7 * g; ctx.strokeStyle = dark ? 'rgba(200,225,255,0.8)' : 'rgba(43,63,156,0.7)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -time * 300;
    const dir = Math.atan2(Math.sin(t.pitch), t.face * Math.cos(t.pitch));
    for (let i = -3; i <= 3; i++) { const a = dir + i * 0.17, r = s * (3 + Math.abs(i) * 0.25); ctx.beginPath(); ctx.moveTo(m.x + Math.cos(a) * r, m.y + Math.sin(a) * r); ctx.quadraticCurveTo(m.x + Math.cos(dir) * r * 0.45, m.y + Math.sin(dir) * r * 0.45 + i * 1.5, m.x, m.y); ctx.stroke(); }
    ctx.restore();
  }

  function drawEggs() {
    const r = 6.5 * SC;
    eggs.forEach(e => {
      const a = e.done ? Math.max(0, 1 - e.pop / 1.2) : 1;
      ctx.fillStyle = dark ? `rgba(200,220,230,${0.25 * a})` : `rgba(255,255,255,${0.55 * a})`; ctx.strokeStyle = dark ? `rgba(200,220,230,${0.5 * a})` : `rgba(90,110,130,${0.55 * a})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill(); ctx.stroke();
      if (e.done) return;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spin + Math.sin(time * 3 + e.spin) * 0.2); ctx.fillStyle = '#3a3a3a';
      if (e.p < 0.35) { ctx.beginPath(); ctx.arc(0, 0, r * (0.35 + e.p), 0, TAU); ctx.fill(); }
      else { const k = (e.p - 0.35) / 0.65; ctx.beginPath(); ctx.arc(r * 0.15, 0, r * 0.42, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0.3, 0.3 + 1.2 + 2.4 * k); ctx.stroke(); }
      ctx.restore();
    });
  }

  function drawToad(x, y, s, dir) { // spadefoot, side view
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.fillStyle = '#7B8A55'; ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.75, 0, Math.PI, TAU); ctx.lineTo(s * 1.2, 0); ctx.quadraticCurveTo(0, s * 0.35, -s * 1.2, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5F6E40'; ctx.beginPath(); ctx.ellipse(-s * 0.3, s * 0.05, s * 0.55, s * 0.35, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#C9A227'; ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.45, s * 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(s * 0.56, -s * 0.47, s * 0.28, Math.max(1.2, s * 0.06)); // vertical-slit look from the side
    ctx.restore();
  }

  function drawFx(f) {
    const k = f.t / (f.life || 0.8);
    if (f.kind === 'gulp') { ctx.strokeStyle = `rgba(217,112,63,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, 4 + k * 16, 0, TAU); ctx.stroke(); }
    else if (f.kind === 'bit') { ctx.fillStyle = `rgba(79,138,53,${1 - k})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t, 1.6, 0, TAU); ctx.fill(); }
    else if (f.kind === 'puff') { ctx.fillStyle = dark ? `rgba(200,170,130,${0.4 * (1 - k)})` : `rgba(150,110,70,${0.4 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * 10, 0, TAU); ctx.fill(); }
  }

  /* ---------- loop ---------- */
  let last = 0, raf = 0;
  function frame(now) { raf = 0; const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; if (!paused) update(dt); draw(); if (running) raf = requestAnimationFrame(frame); }
  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() { (visible && !document.hidden && (!reduce || userStarted)) ? start() : stop(); }

  /* ---------- input: drop shrimp or algae; the nearest tadpole goes for it ---------- */
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!inWater(x) || y < surfaceY) return;
    const yy = Math.min(y, floorY(x) - 8);
    const near = tads.filter(t => t.state !== 'meta' && t.state !== 'perch').sort((a, b) => Math.hypot(a.x - x, a.y - yy) - Math.hypot(b.x - x, b.y - yy))[0];
    if (mode === 'shrimp') {
      const s = makeShrimp(x, yy, true); shrimp.push(s);
      if (near && sizeOf(near) * 1.4 >= shrimpL(s)) { if (near.target && near.target.claim) near.target.claim = null; near.target = s; s.claim = near; near.state = 'hunt'; }
      else if (near) { s.grow = 0.2; if (near.target && near.target.claim) near.target.claim = null; near.target = s; s.claim = near; near.state = 'hunt'; }
    } else {
      const f = { x, y: yy, left: 1 }; food.push(f);
      if (near) { if (near.target && near.target.claim) near.target.claim = null; near.target = f; near.state = 'descend'; }
    }
    selected = near || null;
    if (reduce && !userStarted) { userStarted = true; const b = $('[data-act="pause"]'); if (b) { b.textContent = 'Pause'; b.setAttribute('aria-pressed', 'false'); } sync(); }
  });
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; root.querySelectorAll('[data-mode]').forEach(o => o.setAttribute('aria-pressed', o === b)); }));
  const pb = $('[data-act="pause"]');
  if (pb) pb.addEventListener('click', () => {
    if (reduce && !userStarted) { userStarted = true; paused = false; pb.textContent = 'Pause'; pb.setAttribute('aria-pressed', 'false'); sync(); return; }
    paused = !paused; pb.textContent = paused ? 'Play' : 'Pause'; pb.setAttribute('aria-pressed', paused);
  });

  /* ---------- boot ---------- */
  palette(); resize(); populate();
  for (let i = 0; i < 90; i++) update(1 / 30);
  draw();
  if (reduce && pb) { pb.textContent = 'Play'; pb.setAttribute('aria-pressed', 'true'); }
  new ResizeObserver(() => { resize(); if (!running) draw(); }).observe(wrap);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(wrap);
  document.addEventListener('visibilitychange', sync);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette(); if (!running) draw(); });
  window.__pond = { tads: () => tads, step: (n) => { for (let i = 0; i < n; i++) update(1 / 30); draw(); } };
})();
