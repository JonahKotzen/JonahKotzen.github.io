/* Tank 01: a monsoon pond in cross-section.
   Carnivores stalk and suction-feed on fairy shrimp (with a high-speed slow-mo on every strike),
   omnivores scrape algae off the bottom, and a clutch of embryos reads shrimp cues and hatches early.
   Your cursor is a fairy shrimp. No libraries. Pauses off-screen; respects reduced motion. */
(function () {
  const wrap = document.getElementById('pond');
  if (!wrap) return;
  const cv = wrap.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const root = wrap.closest('.pond-sec') || wrap, $ = (s) => root.querySelector(s);
  const hudFps = $('.pond-fps'), hudMs = $('.pond-ms'), toast = $('.pond-toast');
  const nEaten = $('[data-count="eaten"]'), nAlgae = $('[data-count="algae"]'), nHatch = $('[data-count="hatched"]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  let W = 0, H = 0, DPR = 1, SC = 1, surfaceY = 0, depth = 0;
  let mono = 'monospace', dark = false, P = {};
  let time = 0, timeScale = 1, targetScale = 1, running = false, visible = false, paused = false;
  let manualSlow = false, labelsOn = false, introT = 0, focus = null; // focus: 'carn'|'omni'|'egg'|null
  let slowMoUntil = 0, lastAutoSlow = -99, strikeHud = null;
  const stats = { eaten: 0, algae: 0, hatched: 0 };

  /* ---------- palette (follows light/dark) ---------- */
  function palette() {
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [236, 238, 231];
    dark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) < 110;
    mono = getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace';
    P = dark ? {
      waterTop: 'rgba(52,86,96,0.80)', waterBot: 'rgba(24,44,44,0.95)', surface: 'rgba(160,200,210,0.55)',
      mud1: '#3B2F22', mud2: '#2E251B', mud3: '#251E16', land: '#4A3B2A', ink: '#E6EAE3', muted: 'rgba(230,234,227,0.55)',
      algae: '#5E8F3E', algaeDim: '#3A5530', ray: 'rgba(200,230,240,0.05)', speck: 'rgba(210,220,200,0.18)', accent: '#8C9DF0'
    } : {
      waterTop: 'rgba(150,192,196,0.62)', waterBot: 'rgba(96,132,118,0.78)', surface: 'rgba(255,255,255,0.85)',
      mud1: '#C9A878', mud2: '#B38F60', mud3: '#9C794E', land: '#D8BD8E', ink: '#18201D', muted: 'rgba(24,32,29,0.55)',
      algae: '#4F8A35', algaeDim: '#8BA868', ray: 'rgba(255,255,255,0.10)', speck: 'rgba(60,70,50,0.22)', accent: '#2B3F9C'
    };
  }

  /* ---------- pond geometry ---------- */
  function floorY(x) {
    const u = Math.abs((x - W / 2) / (W / 2));
    return surfaceY + depth * (1 - Math.pow(Math.min(u, 1), 3.2)) - (u > 0.9 ? (u - 0.9) * H * 0.6 : 0);
  }
  const inWater = (x) => floorY(x) > surfaceY + 24;
  function bounds(x, pad) {
    const fy = floorY(clamp(x, 0, W));
    return { top: surfaceY + 10 + pad, bot: fy - pad };
  }

  /* ---------- world ---------- */
  let tufts = [], shrimp = [], tads = [], eggs = [], rings = [], specks = [], fx = [], toadlets = [], cysts = [];
  let cursor = { on: false, x: 0, y: 0, sh: null, respawnAt: 0 };
  let clutchX = 0, cue = 0, clutchResetAt = 0, pair = null, pairT = 6;

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(cv.getBoundingClientRect().height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    SC = W < 600 ? 0.82 : clamp(W / 1000, 0.8, 1.3);
    surfaceY = H * (W < 600 ? 0.2 : 0.17); depth = H * 0.72;
    clutchX = W * 0.22;
    tufts = [];
    for (let x = W * 0.08; x < W * 0.92; x += 15 * SC) if (floorY(x) - surfaceY > 50) tufts.push({ x: x + rnd(-4, 4), b: rnd(0.6, 1), sway: rnd(0, TAU) });
    specks = Array.from({ length: Math.round(W / 14) }, () => ({ x: rnd(0, W), y: rnd(surfaceY, H), r: rnd(0.5, 1.6), v: rnd(2, 7) }));
    cysts = Array.from({ length: Math.round(W / 22) }, () => { const x = rnd(W * 0.1, W * 0.9); return { x, d: rnd(6, 34) }; });
    tads.forEach(t => keepIn(t)); shrimp.forEach(s => keepIn(s));
  }

  function populate() {
    const nC = W < 600 ? 2 : 3, nO = W < 600 ? 3 : 4, nS = W < 600 ? 4 : 7;
    tads = []; shrimp = [];
    for (let i = 0; i < nC; i++) tads.push(makeTad('carn', rnd(W * 0.3, W * 0.85), rnd(surfaceY + 50, surfaceY + depth * 0.6)));
    for (let i = 0; i < nO; i++) tads.push(makeTad('omni', rnd(W * 0.25, W * 0.8), rnd(surfaceY + 60, surfaceY + depth * 0.7)));
    for (let i = 0; i < nS; i++) shrimp.push(makeShrimp(rnd(W * 0.15, W * 0.85), rnd(surfaceY + 30, surfaceY + depth * 0.7)));
    eggs = [];
  }

  function makeTad(type, x, y) {
    const s = (type === 'carn' ? rnd(18, 21) : type === 'omni' ? rnd(13, 15) : 5.5) * SC;
    return { type, x, y, vx: rnd(-20, 20), vy: rnd(-5, 5), s, phase: rnd(0, TAU), heading: rnd(0, TAU), state: 'wander',
      t: 0, target: null, gape: 0, strikeT: 0, cool: rnd(1, 3), tuft: null, rasp: 0, grow: 0, born: time, fade: 1, pitch: 0, face: 1 };
  }
  function makeShrimp(x, y, isCursor) {
    return { x, y, vx: rnd(-30, 30), vy: rnd(-8, 8), heading: rnd(0, TAU), phase: rnd(0, TAU), turn: 0, alive: true,
      sucked: null, cueT: rnd(0, 1.4), isCursor: !!isCursor, L: 24 * SC, born: time, face: 1, pitch: 0 };
  }
  function newClutch() {
    eggs = [];
    const fy = floorY(clutchX);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rnd(-0.3, 0.3), rr = i === 0 ? 0 : rnd(7, 15) * SC;
      eggs.push({ x: clutchX + Math.cos(a) * rr * 1.5, y: fy - 12 * SC - Math.abs(Math.sin(a)) * rr * 0.7, p: rnd(0.25, 0.6), done: false, spin: rnd(0, TAU), pop: 0 });
    }
    clutchResetAt = 0;
  }
  function keepIn(o) {
    const pad = (o.s || 8) * 1.2;
    o.x = clamp(o.x, W * 0.06, W * 0.94);
    while (!inWater(o.x)) o.x += (o.x < W / 2 ? 4 : -4);
    const b = bounds(o.x, pad); o.y = clamp(o.y, b.top, Math.max(b.top, b.bot));
  }

  /* ---------- steering ---------- */
  function steer(o, tx, ty, speed, turnRate, dt) {
    const want = Math.atan2(ty - o.y, tx - o.x);
    let d = ((want - o.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    o.heading += clamp(d, -turnRate * dt, turnRate * dt);
    o.vx = lerp(o.vx, Math.cos(o.heading) * speed, 1 - Math.exp(-3 * dt));
    o.vy = lerp(o.vy, Math.sin(o.heading) * speed, 1 - Math.exp(-3 * dt));
  }
  function wander(o, speed, dt) {
    o.t -= dt;
    if (o.t <= 0 || !o.wp) {
      o.t = rnd(2, 5);
      const x = rnd(W * 0.12, W * 0.88), b = bounds(x, 26);
      o.wp = { x, y: rnd(b.top + 10, Math.max(b.top + 12, b.bot - 10)) };
    }
    steer(o, o.wp.x, o.wp.y, speed, 1.6, dt);
  }
  function integrate(o, dt) {
    o.x += o.vx * dt; o.y += o.vy * dt;
    const pad = (o.s || 8) * 1.1, b = bounds(o.x, pad);
    if (o.y < b.top) { o.y = b.top; o.vy = Math.abs(o.vy) * 0.3; o.heading = -o.heading; }
    if (o.y > b.bot) { o.y = b.bot; o.vy = -Math.abs(o.vy) * 0.3; if (o.state !== 'graze') o.heading = -Math.abs(o.heading); }
    if (!inWater(o.x) || o.x < W * 0.05 || o.x > W * 0.95) { o.x -= o.vx * dt * 2; o.vx *= -1; o.heading = Math.PI - o.heading; }
    // facing & pitch for side-view drawing
    if (Math.abs(o.vx) > 2) o.face = o.vx >= 0 ? 1 : -1;
    const pt = clamp(Math.atan2(o.vy, Math.abs(o.vx) + 1e-3), -0.8, 0.8);
    o.pitch = lerp(o.pitch, pt, 1 - Math.exp(-5 * dt));
  }
  const mouthOf = (t) => ({ x: t.x + t.face * Math.cos(t.pitch) * t.s * 1.05, y: t.y + Math.sin(t.pitch) * t.s * 1.05 + t.s * 0.22 });

  /* ---------- update ---------- */
  function update(dt) {
    time += dt;
    if (introT > 0) introT -= dt / Math.max(timeScale, 0.05);

    if (false) {
      if (!cursor.sh && time > cursor.respawnAt) { cursor.sh = makeShrimp(cursor.x, cursor.y, true); shrimp.push(cursor.sh); }
      const s = cursor.sh;
      if (s && s.alive && !s.sucked) {
        const tx = cursor.x, ty = clamp(cursor.y, surfaceY + 8, floorY(cursor.x) - 8);
        s.vx = lerp(s.vx, (tx - s.x) * 4, 1 - Math.exp(-6 * dt)); s.vy = lerp(s.vy, (ty - s.y) * 4, 1 - Math.exp(-6 * dt));
      }
    }

    // shrimp
    shrimp.forEach(s => {
      if (!s.alive) return;
      s.phase += dt * (s.sucked ? 30 : 14);
      if (s.sucked) {
        const t = s.sucked, m = mouthOf(t), k = 2 + 14 * t.gape;
        s.x = lerp(s.x, m.x, 1 - Math.exp(-k * dt)); s.y = lerp(s.y, m.y, 1 - Math.exp(-k * dt));
        if (Math.hypot(s.x - m.x, s.y - m.y) < t.s * 0.4) eat(t, s);
        return;
      }
      if (!s.isCursor) {
        s.turn += rnd(-3, 3) * dt; s.turn = clamp(s.turn, -1.2, 1.2); s.heading += s.turn * dt;
        // mild flee from a stalking carnivore
        tads.forEach(t => { if (t.type === 'carn' && t.target === s && t.state === 'stalk') {
          const d = Math.hypot(t.x - s.x, t.y - s.y); if (d < 70 * SC) s.heading = lerp(s.heading, Math.atan2(s.y - t.y, s.x - t.x), 0.05); } });
        const sp = 34 * SC + Math.sin(s.phase * 0.3) * 8;
        s.vx = lerp(s.vx, Math.cos(s.heading) * sp, 1 - Math.exp(-2 * dt)); s.vy = lerp(s.vy, Math.sin(s.heading) * sp * 0.6, 1 - Math.exp(-2 * dt));
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      const b = bounds(s.x, 6);
      if (s.y < b.top) { s.y = b.top; s.heading = Math.abs(s.heading); }
      if (s.y > b.bot) { s.y = b.bot; s.heading = -Math.abs(s.heading); }
      if (!inWater(s.x) || s.x < W * 0.06 || s.x > W * 0.94) { s.x = clamp(s.x, W * 0.07, W * 0.93); s.heading = Math.PI - s.heading; s.vx *= -1; }
      if (Math.abs(s.vx) > 1) s.face = s.vx >= 0 ? 1 : -1;
      s.pitch = lerp(s.pitch, clamp(Math.atan2(s.vy, Math.abs(s.vx) + 1e-3), -0.6, 0.6), 1 - Math.exp(-4 * dt));
      // chemical cue rings
      s.cueT -= dt;

    });
    shrimp = shrimp.filter(s => s.alive);
    if (cursor.sh && !cursor.sh.alive) cursor.sh = null;

    // keep the pond stocked: shrimp hatch out of cysts in the mud
    const wild = shrimp.filter(s => !s.isCursor).length, want = W < 600 ? 4 : 7;
    if (wild < want && Math.random() < dt * 0.6) {
      const c = cysts[(Math.random() * cysts.length) | 0];
      if (c && inWater(c.x)) { const s = makeShrimp(c.x, floorY(c.x) - 6, false); s.heading = -Math.PI / 2 + rnd(-0.6, 0.6); shrimp.push(s); fx.push({ kind: 'puff', x: c.x, y: floorY(c.x) - 4, t: 0, col: P.mud1 }); }
    }

    rings.forEach(r => { r.r += 38 * dt; r.a -= dt * 0.55; });
    rings = rings.filter(r => r.a > 0);

    // tadpoles
    tads.forEach(t => {
      t.phase += dt * (t.state === 'stalk' ? 11 : t.state === 'strike' ? 22 : t.state === 'graze' ? 6 : 8);
      if (t.type === 'carn') carnivore(t, dt);
      else if (t.type === 'omni') omnivore(t, dt);
      else hatchling(t, dt);
      if (t.state !== 'strike' || t.strikeT > 0.9) integrate(t, dt);
      else { t.x += t.vx * dt; t.y += t.vy * dt; keepIn(t); }
    });
    tads = tads.filter(t => t.fade > 0);

    // algae regrows slowly
    tufts.forEach(f => { f.b = Math.min(1, f.b + dt * 0.012); });

    // now and then a pair of spadefoots in amplexus swims in and lays eggs
    pairT -= dt;
    if (pairT <= 0 && !pair) { const dir = Math.random() < 0.5 ? 1 : -1, ex = dir > 0 ? W * 0.07 : W * 0.93;
      pair = { x: ex, y: floorY(ex) - 6, dir, state: 'enter', t: 0, tx: dir > 0 ? rnd(W * 0.22, W * 0.4) : rnd(W * 0.6, W * 0.78), laid: 0 }; }
    if (pair) amplex(pair, dt);
    eggs.forEach(e => {
      if (e.done) { e.pop += dt; return; }
      e.p += dt / 28; e.spin += dt * 0.8;
      if (e.p >= 1) hatch(e);
    });
    eggs = eggs.filter(e => !e.done || e.pop < 1.5);

    // toadlets hop away
    tads.forEach(t => { if (t.leaving) t.fade = Math.max(0, t.fade - dt * 0.4); });

    specks.forEach(p => { p.y -= p.v * dt * 0.3; p.x += Math.sin(time * 0.5 + p.y * 0.02) * dt * 3; if (p.y < surfaceY) { p.y = floorY(p.x) - 2; } });
    fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < (f.life || 0.8));

    // time control: slow-mo during strikes (like the 1000 fps camera), or when toggled
    const striking = tads.find(t => t.state === 'strike');
    strikeHud = striking || null;
    if (striking && time < slowMoUntil) targetScale = 0.09; else targetScale = manualSlow ? 0.12 : 1;
    timeScale = lerp(timeScale, targetScale, 1 - Math.exp(-(targetScale < timeScale ? 18 : 3) * (dt / Math.max(timeScale, 0.05))));
  }

  function carnivore(t, dt) {
    t.cool -= dt;
    if (t.state === 'wander') {
      t.gape = lerp(t.gape, 0, 1 - Math.exp(-10 * dt));
      wander(t, 26 * SC, dt);
      if (t.cool <= 0) {
        let best = null, bd = 1e9;
        shrimp.forEach(s => { if (!s.alive || s.sucked) return; const d = Math.hypot(s.x - t.x, s.y - t.y) - (s.isCursor ? 120 : 0); if (d < bd) { bd = d; best = s; } });
        if (best && bd < 230 * SC && !tads.some(o => o !== t && o.target === best)) { t.target = best; t.state = 'stalk'; }
      }
    } else if (t.state === 'stalk') {
      const s = t.target;
      if (!s || !s.alive || s.sucked) { t.state = 'wander'; t.target = null; return; }
      const d = Math.hypot(s.x - t.x, s.y - t.y);
      steer(t, s.x + s.vx * 0.3, s.y + s.vy * 0.3, (d > 120 * SC ? 46 : 30) * SC, 2.4, dt);
      if (d > 320 * SC) { t.state = 'wander'; t.target = null; t.cool = 1; }
      const m = mouthOf(t);
      if (Math.hypot(s.x - m.x, s.y - m.y) < t.s * 2.2 && Math.cos(Math.atan2(s.y - t.y, s.x - t.x) - t.heading) > 0.5) {
        t.state = 'strike'; t.strikeT = 0;
        if (!manualSlow && visible && time - lastAutoSlow > 5) { slowMoUntil = time + 0.45; lastAutoSlow = time; }
      }
    } else if (t.state === 'strike') {
      t.strikeT += dt / 0.32;                                  // whole strike ~0.32 s of pond time
      const k = t.strikeT;
      t.gape = k < 0.63 ? Math.sin((k / 0.63) * Math.PI / 2) : Math.max(0, 1 - (k - 0.63) / 0.37); // peak gape at "19 ms"
      const lunge = 70 * SC * (k < 0.5 ? 1 : 0.2);
      t.vx = Math.cos(t.heading) * lunge; t.vy = Math.sin(t.heading) * lunge;
      const s = t.target, m = mouthOf(t);
      if (s && s.alive && !s.sucked && t.gape > 0.25 && Math.hypot(s.x - m.x, s.y - m.y) < t.s * 3.2) s.sucked = t;
      if (k >= 1) {
        if (s && s.sucked === t && s.alive) eat(t, s);
        t.state = 'wander'; t.target = null; t.cool = rnd(2.5, 5); t.gape = 0;
      }
    }
  }

  function eat(t, s) {
    if (!s.alive) return;
    s.alive = false; s.sucked = null;
    stats.eaten++; if (nEaten) nEaten.textContent = stats.eaten;
    const m = mouthOf(t);
    fx.push({ kind: 'gulp', x: m.x, y: m.y, t: 0, life: 0.9 });
    if (s.isCursor) { cursor.respawnAt = time + 1.2; say('Gulp. Caught in about 19 milliseconds.'); }
    if (t.type === 'hatch') t.ate = (t.ate || 0) + 1;
  }

  function omnivore(t, dt) {
    if (t.state === 'wander') {
      wander(t, 20 * SC, dt);
      t.cool -= dt;
      if (t.cool <= 0) {
        const opts = tufts.filter(f => f.b > 0.45 && !tads.some(o => o.tuft === f));
        if (opts.length) { t.tuft = opts[(Math.random() * opts.length) | 0]; t.state = 'descend'; }
        else t.cool = 2;
      }
    } else if (t.state === 'descend') {
      const f = t.tuft, ty = floorY(f.x) - t.s * 0.9;
      steer(t, f.x - t.face * t.s * 0.6, ty, 26 * SC, 2.2, dt);
      if (Math.hypot(t.x - f.x, t.y - ty) < t.s * 1.2) { t.state = 'graze'; t.t = rnd(4, 7); }
    } else if (t.state === 'graze') {
      const f = t.tuft;
      t.vx = lerp(t.vx, Math.sin(time * 3 + t.phase) * 3, 0.1); t.vy = lerp(t.vy, 4, 0.1);
      t.rasp += dt * 5.5;
      t.gape = 0.5 + 0.5 * Math.sin(t.rasp * TAU);
      t.pitch = lerp(t.pitch, 0.55, 1 - Math.exp(-4 * dt));
      t.face = f.x >= t.x ? 1 : -1;
      const before = f.b; f.b = Math.max(0, f.b - dt * 0.09); stats.algae += (before - f.b);
      if (Math.random() < dt * 6) { const m = mouthOf(t); fx.push({ kind: 'bit', x: m.x, y: m.y, vx: rnd(-12, 12), vy: rnd(-20, -6), t: 0, life: 0.9 }); }
      t.t -= dt;
      if (t.t <= 0 || f.b < 0.1) { t.state = 'wander'; t.tuft = null; t.cool = rnd(3, 7); t.gape = 0; t.wp = null; }
      if (nAlgae) nAlgae.textContent = Math.round(stats.algae * 10);
    }
  }

  function hatchling(t, dt) {
    t.grow = Math.min(1, t.grow + dt / 22);
    t.s = lerp(5.5 * SC, (t.morph === 'carn' ? 19 : 14) * SC, t.grow);
    wander(t, 16 * SC, dt);
    if (t.grow >= 1) {
      t.type = t.morph; t.state = 'wander'; t.cool = 2;
      const same = tads.filter(o => o.type === t.type && o !== t && !o.leaving), cap = t.type === 'carn' ? (W < 600 ? 2 : 3) : (W < 600 ? 3 : 4);
      if (same.length >= cap) { const old = same.sort((a, b) => a.born - b.born)[0]; metamorphose(old); }
    }
  }

  function amplex(q, dt) {
    q.t += dt;
    if (q.state === 'enter') {            // hop down the bank to the water
      q.x += q.dir * 30 * SC * dt; q.y = floorY(q.x) - 6 - Math.abs(Math.sin(q.t * 4)) * 10 * SC;
      if (floorY(q.x) > surfaceY + 30) { q.state = 'swim'; q.y = surfaceY + 8; }
    } else if (q.state === 'swim') {      // dive to the bottom
      const ty = floorY(q.tx) - 12 * SC; q.x = lerp(q.x, q.tx, 1 - Math.exp(-0.6 * dt)); q.y = lerp(q.y, ty, 1 - Math.exp(-0.8 * dt));
      if (Math.abs(q.x - q.tx) < 6 && Math.abs(q.y - ty) < 6) { q.state = 'lay'; q.t = 0; }
    } else if (q.state === 'lay') {       // a string of eggs, one at a time
      if (q.t > q.laid * 0.45 && q.laid < 9) { q.laid++; eggs.push({ x: q.x - q.dir * (q.laid * 4 + rnd(-3, 3)) * SC, y: floorY(q.x) - rnd(5, 12) * SC, p: 0, done: false, spin: rnd(0, TAU), pop: 0 }); }
      if (q.t > 5) { q.state = 'leave'; }
    } else {                              // swim back up and away
      q.x -= q.dir * 40 * SC * dt; q.y -= 28 * SC * dt;
      if (q.y < surfaceY || !inWater(q.x)) { pair = null; pairT = rnd(30, 45); }
    }
  }
  function drawPair(q) {
    const sw = q.state === 'swim' || q.state === 'leave' ? Math.sin(time * 6) * 1.5 : 0;
    drawToad(q.x, q.y, 11 * SC, q.state === 'leave' ? -q.dir : q.dir, false);
    drawToad(q.x - q.dir * 3 * SC, q.y - 8 * SC + sw, 8.5 * SC, q.state === 'leave' ? -q.dir : q.dir, false);
  }

  function hatch(e) {
    e.done = true; e.pop = 0;
    stats.hatched++; if (nHatch) nHatch.textContent = stats.hatched;
    if (Math.random() < 0.4) { const h = makeTad('hatch', e.x, e.y - 4); h.vy = -20; h.morph = Math.random() < 0.4 ? 'carn' : 'omni'; tads.push(h); }
  }

  function metamorphose(t) { t.leaving = true; }

  /* ---------- drawing ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // water body
    const g = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + depth);
    g.addColorStop(0, P.waterTop); g.addColorStop(1, P.waterBot);
    ctx.beginPath(); ctx.moveTo(0, surfaceY);
    for (let x = 0; x <= W; x += 6) ctx.lineTo(x, surfaceY + Math.sin(x * 0.03 + time * 1.4) * 1.5);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    // light rays
    ctx.save(); ctx.fillStyle = P.ray;
    for (let i = 0; i < 6; i++) {
      const x0 = W * (0.12 + i * 0.15) + Math.sin(time * 0.3 + i) * 30;
      ctx.beginPath(); ctx.moveTo(x0, surfaceY); ctx.lineTo(x0 + 40, surfaceY); ctx.lineTo(x0 + 120, surfaceY + depth); ctx.lineTo(x0 + 50, surfaceY + depth); ctx.fill();
    }
    ctx.restore();
    // specks
    ctx.fillStyle = P.speck; specks.forEach(p => { if (p.y > surfaceY + 2 && p.y < floorY(p.x)) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); } });
    // cue rings
    if (0) rings.forEach(r => { ctx.strokeStyle = `rgba(226,128,70,${0.22 * r.a * (focus === 'egg' || labelsShown() ? 1.6 : 1)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); });

    drawMud();
    tufts.forEach(drawTuft);
    drawEggs();
    tads.filter(t => t.type !== 'carn').forEach(drawTad);
    shrimp.forEach(drawShrimp);
    tads.filter(t => t.type === 'carn').forEach(drawTad);
    tads.forEach(t => { if (t.state === 'strike') drawFlow(t); });
    fx.forEach(drawFx);
    if (pair) drawPair(pair);
    drawSurfaceLine();

    // HUD
    const slow = timeScale < 0.5;
    if (hudFps) hudFps.classList.toggle('on', slow);
    if (hudMs) hudMs.textContent = strikeHud ? `t = ${String(Math.min(30, Math.round(strikeHud.strikeT * 30))).padStart(2, '0')} ms` : manualSlow ? 'slow-mo' : '';
  }

  function drawSurfaceLine() {
    ctx.strokeStyle = P.surface; ctx.lineWidth = 1.5; ctx.beginPath();
    let started = false;
    for (let x = 0; x <= W; x += 6) {
      const y = surfaceY + Math.sin(x * 0.03 + time * 1.4) * 1.5;
      if (floorY(x) > y) { if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }

  function drawMud() {
    // strata
    const layers = [[0, P.mud1], [14, P.mud2], [40, P.mud3]];
    layers.forEach(([off, col]) => {
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) ctx.lineTo(x, floorY(x) + off * SC + (off ? Math.sin(x * 0.02 + off) * 3 : 0));
      ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    });
    // dry banks above the waterline get a sun-baked top colour
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, surfaceY + 1); ctx.clip();
    ctx.fillStyle = P.land; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, floorY(x));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); ctx.restore();
    // shrimp cysts waiting in the mud
    ctx.fillStyle = dark ? 'rgba(230,200,160,0.5)' : 'rgba(120,80,40,0.55)';
    cysts.forEach(c => { if (inWater(c.x)) { ctx.beginPath(); ctx.arc(c.x, floorY(c.x) + c.d * SC, 1.6 * SC, 0, TAU); ctx.fill(); } });
    // desert bank props: ocotillo + the SHRIMP AHEAD sign
    drawOcotillo(W * 0.965, floorY(W * 0.965));

  }

  function drawTuft(f) {
    const y = floorY(f.x), h = (3 + 11 * f.b) * SC;
    ctx.strokeStyle = f.b > 0.3 ? P.algae : P.algaeDim; ctx.lineWidth = 1.4 * SC; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const sw = Math.sin(time * 1.3 + f.sway + i) * 2.5 * SC;
      ctx.beginPath(); ctx.moveTo(f.x + i * 2.5 * SC, y + 1); ctx.quadraticCurveTo(f.x + i * 3 * SC + sw * 0.5, y - h * 0.5, f.x + i * 3.5 * SC + sw, y - h * (i ? 0.8 : 1)); ctx.stroke();
    }
  }

  function dim(kind) { return focus && focus !== kind ? 0.22 : 1; }

  function drawTad(t) {
    const s = t.s, kind = t.type === 'hatch' ? 'egg' : t.type;
    ctx.save(); ctx.globalAlpha = dim(kind) * t.fade;
    ctx.translate(t.x, t.y); ctx.scale(t.face, 1); ctx.rotate(t.pitch);
    const carn = t.type === 'carn' || (t.type === 'hatch' && t.morph === 'carn' && t.grow > 0.5);
    const body = carn ? '#D9703F' : t.type === 'hatch' ? '#8C826C' : '#8D8A4E';
    const belly = carn ? '#EBA57A' : t.type === 'hatch' ? '#B5AC98' : '#B9B37A';
    const line = carn ? '#7A3A1E' : '#4C4A2A';
    // tail
    const N = 14, L = s * (carn ? 2.3 : 2.6), amp = s * (t.state === 'strike' ? 0.55 : 0.4);
    const pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([-s * 0.7 - L * u, Math.sin(t.phase - u * 5.5) * amp * Math.pow(u, 1.3)]); }
    ctx.fillStyle = carn ? 'rgba(235,165,122,0.55)' : 'rgba(190,185,140,0.55)';
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const u = i / N, fin = s * 0.48 * Math.sin(Math.PI * Math.pow(u, 0.7)) + 0.01; i ? ctx.lineTo(x, y - fin) : ctx.moveTo(x, y - fin); });
    for (let i = N; i >= 0; i--) { const u = i / N, fin = s * 0.42 * Math.sin(Math.PI * Math.pow(u, 0.7)) + 0.01; ctx.lineTo(pts[i][0], pts[i][1] + fin); }
    ctx.fill();
    ctx.fillStyle = body; ctx.beginPath();
    pts.forEach(([x, y], i) => { const th = s * 0.2 * (1 - i / N) + s * 0.03; i ? ctx.lineTo(x, y - th) : ctx.moveTo(x, y - th); });
    for (let i = N; i >= 0; i--) { const th = s * 0.2 * (1 - i / N) + s * 0.03; ctx.lineTo(pts[i][0], pts[i][1] + th); }
    ctx.fill();
    // body (buccal floor drops as the mouth opens: that's the suction)
    const ry = s * (carn ? 0.74 : 0.7) + (carn ? t.gape * s * 0.16 : 0);
    ctx.fillStyle = body; ctx.strokeStyle = line; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, s, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = belly; ctx.beginPath(); ctx.ellipse(-s * 0.1, ry * 0.42, s * 0.7, ry * 0.42, 0, 0, Math.PI); ctx.fill();
    if (carn) { // enlarged jaw muscle (orbitohyoideus)
      ctx.fillStyle = 'rgba(160,50,30,0.55)'; ctx.beginPath(); ctx.ellipse(s * 0.3, s * 0.12, s * 0.34, s * 0.26, 0.3, 0, TAU); ctx.fill();
    } else if (t.type === 'omni') { // speckles + long coiled gut hint
      ctx.strokeStyle = 'rgba(60,55,30,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-s * 0.15, s * 0.18, s * 0.22, 0, 5.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(-s * 0.15, s * 0.18, s * 0.1, 0, 4.6); ctx.stroke();
    }
    // eye
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.3, s * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.48, -s * 0.34, s * 0.04, 0, TAU); ctx.fill();
    // mouth
    const mx = s * 0.97, my = s * 0.22, g = t.gape;
    if (carn) {
      ctx.fillStyle = '#2A0F08'; ctx.beginPath(); ctx.ellipse(mx, my, s * (0.07 + 0.16 * g), s * (0.04 + 0.2 * g), 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.4; ctx.beginPath(); // notched beak
      ctx.moveTo(mx - s * 0.08, my - s * (0.06 + 0.2 * g)); ctx.lineTo(mx + s * 0.02, my - s * (0.02 + 0.2 * g)); ctx.lineTo(mx + s * 0.08, my - s * (0.08 + 0.2 * g)); ctx.stroke();
    } else {
      const ox = s * 0.78, oy = s * 0.58;
      ctx.fillStyle = '#2b2416'; ctx.beginPath(); ctx.ellipse(ox, oy, s * 0.16, s * (0.04 + 0.08 * g), 0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(30,25,15,0.7)'; ctx.lineWidth = 0.8; // labial tooth rows
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ox - s * 0.2, oy + s * (0.1 + i * 0.06)); ctx.lineTo(ox + s * 0.12, oy + s * (0.16 + i * 0.06)); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawShrimp(s) {
    const L = s.L;
    ctx.save(); ctx.globalAlpha = focus && focus !== 'carn' && focus !== 'egg' ? 0.25 : 1;
    ctx.translate(s.x, s.y); ctx.scale(s.face, 1); ctx.rotate(s.pitch);
    const col = s.isCursor ? (dark ? '#FFB38A' : '#E2733E') : '#E59A6C';
    // abdomen + tail (cercopods)
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    ctx.lineWidth = L * 0.11; ctx.beginPath(); ctx.moveTo(-L * 0.1, 0); ctx.quadraticCurveTo(-L * 0.55, Math.sin(s.phase * 0.5) * 2, -L * 0.85, Math.sin(s.phase * 0.5) * 3); ctx.stroke();
    ctx.strokeStyle = '#C2462B'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, -L * 0.1); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, L * 0.08); ctx.stroke();
    // thorax
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(L * 0.18, 0, L * 0.34, L * 0.1, 0, 0, TAU); ctx.fill();
    // phyllopods beating in a wave (fairy shrimp swim upside-down, legs up)
    ctx.strokeStyle = dark ? 'rgba(255,200,170,0.85)' : 'rgba(200,110,70,0.9)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const x = L * (0.44 - i * 0.065), a = -Math.PI / 2 + Math.sin(s.phase - i * 0.65) * 0.55 - 0.25;
      ctx.beginPath(); ctx.moveTo(x, -L * 0.06); ctx.lineTo(x + Math.cos(a) * L * 0.17, -L * 0.06 + Math.sin(a) * L * 0.17); ctx.stroke();
    }
    // stalked eyes
    ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(L * 0.48, 0); ctx.lineTo(L * 0.62, L * 0.08); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.64, L * 0.09, L * 0.055, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawFlow(t) {
    // converging streamlines into the open mouth
    const m = mouthOf(t), g = t.gape; if (g < 0.1) return;
    ctx.save(); ctx.globalAlpha = 0.75 * g;
    ctx.strokeStyle = dark ? 'rgba(200,225,255,0.8)' : 'rgba(43,63,156,0.75)'; ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 5]); ctx.lineDashOffset = -time * 400;
    const dir = Math.atan2(Math.sin(t.pitch), t.face * Math.cos(t.pitch));
    for (let i = -3; i <= 3; i++) {
      const a = dir + i * 0.17, r = t.s * (3 + Math.abs(i) * 0.25);
      const sx = m.x + Math.cos(a) * r, sy = m.y + Math.sin(a) * r;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(m.x + Math.cos(dir) * r * 0.45, m.y + Math.sin(dir) * r * 0.45 + i * 1.5, m.x, m.y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawEggs() {
    ctx.save(); ctx.globalAlpha = dim('egg');
    const r = 6.5 * SC;
    // jelly mass
    eggs.forEach(e => {
      if (e.done && e.pop > 1.5) return;
      const a = e.done ? Math.max(0, 1 - e.pop / 1.5) : 1;
      ctx.fillStyle = dark ? `rgba(200,220,230,${0.25 * a})` : `rgba(255,255,255,${0.55 * a})`;
      ctx.strokeStyle = dark ? `rgba(200,220,230,${0.5 * a})` : `rgba(90,110,130,${0.55 * a})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * (e.done ? 1 + e.pop * 0.3 : 1), 0, TAU); ctx.fill(); ctx.stroke();
      if (e.done) return;
      // embryo: a dot that grows into a curled tadpole, twitching faster with stronger shrimp cues
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spin + Math.sin(time * (3 + 14 * cue) + e.spin) * (0.15 + 0.5 * cue));
      ctx.fillStyle = '#3a3a3a';
      if (e.p < 0.35) { ctx.beginPath(); ctx.arc(0, 0, r * (0.35 + e.p), 0, TAU); ctx.fill(); }
      else {
        const k = (e.p - 0.35) / 0.65;
        ctx.beginPath(); ctx.arc(r * 0.15, 0, r * 0.42, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0.3, 0.3 + 1.2 + 2.4 * k); ctx.stroke();
      }
      ctx.restore();
    });
    ctx.restore();
  }

  function drawToad(x, y, s, dir, asleep) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    ctx.fillStyle = '#7B8A55'; ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.75, 0, Math.PI, TAU); ctx.lineTo(s * 1.2, 0); ctx.quadraticCurveTo(0, s * 0.35, -s * 1.2, 0); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-s * 0.3, s * 0.05, s * 0.55, s * 0.35, 0.4, 0, TAU); ctx.fill(); // leg
    ctx.fillStyle = asleep ? '#3E4A2A' : '#C9A227';
    if (asleep) { ctx.fillRect(s * 0.55, -s * 0.5, s * 0.35, 1.4); }
    else { ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.45, s * 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillRect(s * 0.6, -s * 0.47, s * 0.2, 1.2); }
    ctx.restore();
  }

  function drawOcotillo(x, y) {
    if (W < 500) return;
    ctx.save(); ctx.strokeStyle = dark ? '#6F7A4A' : '#5E6B3A'; ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) {
      ctx.lineWidth = 2;
      const tipX = x + i * 9 + Math.sin(time * 0.8 + i) * 2, tipY = y - 70 * SC - Math.abs(i) * -4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + i * 6, y - 40 * SC, tipX, tipY); ctx.stroke();
      ctx.fillStyle = '#D9533A'; ctx.beginPath(); ctx.arc(tipX, tipY, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawSign(x, y) {
    if (W < 500) return;
    const s = 15 * SC, top = y - 62 * SC;
    ctx.save();
    ctx.strokeStyle = dark ? '#999' : '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top + s); ctx.stroke();
    ctx.translate(x, top); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#F2C230'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5;
    ctx.fillRect(-s * 0.72, -s * 0.72, s * 1.44, s * 1.44); ctx.strokeRect(-s * 0.72, -s * 0.72, s * 1.44, s * 1.44);
    ctx.rotate(-Math.PI / 4);
    // tiny shrimp glyph
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-s * 0.5, 0); ctx.quadraticCurveTo(0, -s * 0.2, s * 0.45, 0); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.1 + i * s * 0.13, -s * 0.08); ctx.lineTo(-s * 0.1 + i * s * 0.13, -s * 0.3); ctx.stroke(); }
    ctx.fillStyle = '#F2C230'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
    ctx.fillRect(-s * 1.1, s * 1.2, s * 2.2, s * 0.62); ctx.strokeRect(-s * 1.1, s * 1.2, s * 2.2, s * 0.62);
    ctx.fillStyle = '#1a1a1a'; ctx.font = `700 ${Math.round(6.5 * Math.max(SC, 0.9))}px ${mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SHRIMP AHEAD', 0, s * 1.52);
    ctx.restore();
  }

  function drawFx(f) {
    const k = f.t / (f.life || 0.8);
    if (f.kind === 'gulp') {
      ctx.strokeStyle = `rgba(217,112,63,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, 4 + k * 18, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(217,112,63,${1 - k})`; ctx.font = `600 ${Math.round(11 * Math.max(SC, 0.9))}px ${mono}`; ctx.textAlign = 'center'; ctx.fillText('gulp', f.x, f.y - 14 - k * 12);
    } else if (f.kind === 'bit') {
      ctx.fillStyle = `rgba(79,138,53,${1 - k})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t, 1.6, 0, TAU); ctx.fill();
    } else if (f.kind === 'puff') {
      ctx.fillStyle = dark ? `rgba(200,170,130,${0.4 * (1 - k)})` : `rgba(150,110,70,${0.4 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * 10, 0, TAU); ctx.fill();
    } else if (f.kind === 'tag') {
      ctx.globalAlpha = Math.min(1, (1 - k) * 2);
      ctx.font = `${Math.round(10 * Math.max(SC, 0.95))}px ${mono}`; ctx.textAlign = 'center';
      const w = ctx.measureText(f.text).width + 12;
      ctx.fillStyle = dark ? 'rgba(23,29,26,0.92)' : 'rgba(246,247,242,0.95)'; ctx.fillRect(f.x - w / 2, f.y - 26 - k * 10, w, 17);
      ctx.fillStyle = '#E2733E'; ctx.fillText(f.text, f.x, f.y - 14 - k * 10); ctx.globalAlpha = 1;
    }
  }

  const labelsShown = () => labelsOn || introT > 0;
  function drawLabels() {
    if (!labelsShown() && !focus) return;
    const a = labelsOn || focus ? 1 : Math.min(1, introT / 1.5);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `${Math.round(10.5 * Math.max(SC, 0.95))}px ${mono}`; ctx.textAlign = 'left';
    const tag = (x, y, text, col, dy = -34) => {
      const w = ctx.measureText(text).width + 12, lx = clamp(x + 18, 6, W - w - 6), ly = clamp(y + dy, surfaceY + 6, H - 24);
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly + 8); ctx.stroke();
      ctx.fillStyle = dark ? 'rgba(23,29,26,0.92)' : 'rgba(246,247,242,0.95)'; ctx.fillRect(lx, ly, w, 17);
      ctx.strokeRect(lx, ly, w, 17); ctx.fillStyle = col; ctx.fillText(text, lx + 6, ly + 12);
    };
    const want = (k) => !focus || focus === k;
    const c = tads.find(t => t.type === 'carn'), o = tads.find(t => t.type === 'omni' && t.state === 'graze') || tads.find(t => t.type === 'omni');
    if (c && want('carn')) tag(c.x, c.y - c.s * 0.6, 'carnivore · suction feeding', '#C25A2C');
    if (o && want('omni')) tag(o.x, o.y + o.s * 0.4, 'omnivore · scraping algae', dark ? '#A9B86A' : '#5B6A2A', 26);
    if (want('egg') && eggs.some(e => !e.done)) tag(clutchX + 14 * SC, floorY(clutchX) - 20 * SC, 'embryos · reading shrimp cues', '#E2733E', -78 * SC);
    const s = shrimp.find(x => !x.isCursor && x.x > W * 0.45 && x.y < surfaceY + depth * 0.5);
    if (s && want('carn') && !focus && W > 700) tag(s.x, s.y, 'fairy shrimp', dark ? '#FFB38A' : '#B5532A');
    ctx.restore();
  }

  function drawCursorHints() {
    const s = cursor.sh; if (!s || !s.alive) return;
    ctx.save(); ctx.font = `${Math.round(10 * Math.max(SC, 0.95))}px ${mono}`; ctx.textAlign = 'center';
    const hunter = tads.find(t => t.target === s && (t.state === 'stalk' || t.state === 'strike'));
    if (hunter) { // the Jaws bit
      const d = Math.hypot(hunter.x - s.x, hunter.y - s.y), beat = clamp(d / 160, 0.18, 0.9);
      const on = (time / (beat * Math.max(timeScale, 0.2))) % 1 < 0.5;
      ctx.fillStyle = '#C25A2C'; ctx.globalAlpha = on ? 1 : 0.35;
      ctx.font = `700 ${Math.round((10 + (1 - beat) * 6) * Math.max(SC, 0.95))}px ${mono}`;
      ctx.fillText(on ? 'dun dun…' : 'dun', s.x, s.y - 16);
    } else { ctx.fillStyle = P.ink; ctx.globalAlpha = 0.7; ctx.fillText('you', s.x, s.y - 14); }
    ctx.restore();
  }

  /* ---------- loop ---------- */
  let last = 0, raf = 0;
  function frame(now) {
    raf = 0;
    const real = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (!paused) update(real * timeScale);
    draw();
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (running || paused && reduce) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() { (visible && !document.hidden && (!reduce || userStarted)) ? start() : stop(); }
  let userStarted = false;

  function say(msg) {
    if (!toast) return; toast.textContent = msg; toast.classList.add('on');
    clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('on'), 2600);
  }

  /* ---------- input ---------- */
  function local(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  if (0) cv.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const p = local(e); cursor.x = p.x; cursor.y = p.y; cursor.on = p.y > surfaceY - 10 && inWater(p.x); if (!cursor.on && cursor.sh) { cursor.sh.isCursor = false; cursor.sh = null; } });
  cv.addEventListener('pointerleave', () => { cursor.on = false; if (cursor.sh) { cursor.sh.isCursor = false; cursor.sh = null; } });
  cv.addEventListener('pointerdown', e => {
    const p = local(e); if (!inWater(p.x) || p.y < surfaceY) return;
    if (shrimp.length < 14) { const s = makeShrimp(p.x, Math.min(p.y, floorY(p.x) - 8)); shrimp.push(s); rings.push({ x: p.x, y: p.y, r: 2, a: 1 }); }
    if (reduce && !userStarted) { userStarted = true; sync(); }
  });
  root.querySelectorAll('[data-focus]').forEach(b => {
    const k = b.dataset.focus;
    b.addEventListener('mouseenter', () => { focus = k; if (!running) draw(); });
    b.addEventListener('focus', () => { focus = k; if (!running) draw(); });
    b.addEventListener('mouseleave', () => { focus = null; if (!running) draw(); });
    b.addEventListener('blur', () => { focus = null; if (!running) draw(); });
  });
  const btn = (sel, fn) => { const b = $(sel); if (b) b.addEventListener('click', () => fn(b)); };
  btn('[data-act="slow"]', b => { manualSlow = !manualSlow; b.setAttribute('aria-pressed', manualSlow); });
  btn('[data-act="labels"]', b => { labelsOn = !labelsOn; b.setAttribute('aria-pressed', labelsOn); if (!running) draw(); });
  btn('[data-act="pause"]', b => {
    if (reduce && !userStarted) { userStarted = true; paused = false; b.textContent = 'Pause'; b.setAttribute('aria-pressed', 'false'); sync(); return; }
    paused = !paused; b.textContent = paused ? 'Play' : 'Pause'; b.setAttribute('aria-pressed', paused);
  });

  /* ---------- boot ---------- */
  palette(); resize(); populate();
  for (let i = 0; i < 120; i++) update(1 / 30);
  introT = 0; draw();
  if (reduce) { const b = $('[data-act="pause"]'); if (b) { b.textContent = 'Play'; b.setAttribute('aria-pressed', 'true'); } draw(); }
  new ResizeObserver(() => { resize(); if (!running) draw(); }).observe(wrap);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(wrap);
  document.addEventListener('visibilitychange', sync);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette(); if (!running) draw(); });
  window.__pond = { forceStrike() { const t = tads.find(x => x.type === 'carn'), s = shrimp.find(x => x.alive); if (t && s) { s.x = t.x + t.face * t.s * 2.2; s.y = t.y + t.s * 0.2; t.target = s; t.heading = t.face > 0 ? 0 : Math.PI; t.state = 'stalk'; t.cool = 0; } }, stats };
})();
