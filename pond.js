/* Tank 01: a monsoon pond, told as a short story with two endings.
   Shared opening: dry basin → monsoon rain → spadefoots amplex and lay eggs → fairy shrimp hatch and algae grows
   → tadpoles hatch; shrimp-eaters become carnivores, algae-eaters become omnivores.
   Ending A (fast-drying pond): carnivores develop faster, metamorphose and escape; omnivores are stranded.
   Ending B (second rain, shrimp gone): carnivores starve; omnivores keep grazing and make it out. */
(function () {
  const wrap = document.getElementById('pond');
  if (!wrap) return;
  const cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
  const root = wrap.closest('.pond-sec') || wrap, $ = (s) => root.querySelector(s);
  const capEl = $('.pond-cap'), stepEl = $('.pond-step');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t), win = (t, a, b) => ease((t - a) / (b - a));
  const mix = (h1, h2, t) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const ch = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, clamp(t, 0, 1))).toString(16).padStart(2, '0'); return '#' + ch(16) + ch(8) + ch(0); };

  let W = 0, H = 0, SC = 1, S0 = 0, depth = 0, dark = false, P = {};
  let running = false, visible = false, paused = false, userStarted = false;
  let scen = 'dry', autoAlt = true, T = 0, clock = 0;
  let level = 0, algae = 0, tads = [], shrimp = [], eggs = [], cysts = [], tufts = [], props = [], drops = [], specks = [], pair = null, fx = [];

  const STAGES = {
    common: [[0, 'Dry season: fairy shrimp eggs and spadefoot toads wait under the dry pond bed.'],
             [5, 'A monsoon storm rolls in and fills the pond.'],
             [13, 'Spadefoots dig out, pair up in amplexus and lay eggs.'],
             [21, 'Fairy shrimp hatch from the mud, and algae coats the rocks, sticks and bottom.'],
             [28, 'Tadpoles hatch: the same clutch, the same pond.'],
             [33, 'Tadpoles that eat shrimp become carnivores; those that graze algae become omnivores.']],
    dry: [[46, 'No more rain. The pond starts drying fast.'],
          [52, 'Carnivores develop faster: legs, then out of the water as the tail is reabsorbed.'],
          [62, 'The pond is gone. Slower omnivores are stranded; the carnivores made it out.'],
          [70, 'Fast-drying ponds favor carnivores.']],
    wet: [[46, 'A second storm tops the pond back up, but the shrimp are gone.'],
          [53, 'With no shrimp, the carnivores starve. Omnivores keep grazing.'],
          [61, 'In a long-lasting pond, the omnivores develop and walk out.'],
          [70, 'Long-lasting ponds favor omnivores.']]
  };
  const END = 76;

  function palette() {
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [236, 238, 231];
    dark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) < 110;
    P = dark ? { waterTop: 'rgba(52,86,96,0.80)', waterBot: 'rgba(24,44,44,0.95)', surface: 'rgba(160,200,210,0.55)', mud1: '#3B2F22', mud2: '#2E251B', mud3: '#251E16', land: '#4A3B2A', algae: '#5E8F3E', cloud: '#3A4248', rain: 'rgba(170,200,220,0.5)', rock: '#5B5A55', stick: '#5A4632', crack: 'rgba(0,0,0,0.35)', speck: 'rgba(210,220,200,0.18)' }
      : { waterTop: 'rgba(150,192,196,0.62)', waterBot: 'rgba(96,132,118,0.78)', surface: 'rgba(255,255,255,0.85)', mud1: '#C9A878', mud2: '#B38F60', mud3: '#9C794E', land: '#D8BD8E', algae: '#4F8A35', cloud: '#6F7780', rain: 'rgba(70,100,130,0.45)', rock: '#8E8A80', stick: '#7A5C3E', crack: 'rgba(90,60,30,0.45)', speck: 'rgba(60,70,50,0.22)' };
  }

  /* ---------- geometry: a basin with shallow beaches; the water level moves ---------- */
  function floorY(x) {
    const u = Math.min(1, Math.abs((x - W / 2) / (W / 2))), lip = 22 * SC;
    if (u < 0.5) return S0 + lip + (depth - lip) * (1 - Math.pow(u / 0.5, 2.2));
    if (u < 0.8) return S0 + lip * (1 - (u - 0.5) / 0.3);
    return S0 - ((u - 0.8) / 0.2) * H * 0.16;
  }
  const wy = () => S0 + (1 - level) * (depth + 4);
  const wet = (x, pad = 0) => floorY(x) > wy() + pad;
  const edgeX = (side, d = 0) => { let x = W / 2; while (floorY(x) > wy() + d && x > 2 && x < W - 2) x += side * 2; return x; };

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(cv.getBoundingClientRect().height);
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    SC = W < 600 ? 0.75 : clamp(W / 1150, 0.72, 1.1);
    S0 = H * 0.32; depth = H * 0.58;
    cysts = Array.from({ length: 26 }, (_, i) => ({ x: W * (0.28 + 0.44 * i / 25) + rnd(-6, 6), d: rnd(6, 26) }));
    tufts = []; for (let x = W * 0.27; x < W * 0.73; x += 16 * SC) tufts.push({ x: x + rnd(-4, 4), sway: rnd(0, TAU) });
    props = [{ k: 'rock', x: W * 0.36, r: 18 * SC }, { k: 'rock', x: W * 0.61, r: 14 * SC }, { k: 'stick', x: W * 0.47, len: 70 * SC, a: -0.35 }, { k: 'stick', x: W * 0.69, len: 50 * SC, a: 0.5 }];
    specks = Array.from({ length: Math.round(W / 16) }, () => ({ x: rnd(W * 0.2, W * 0.8), y: rnd(S0, H), r: rnd(0.5, 1.5) }));
  }

  function reset() {
    T = 0; level = 0; algae = 0; tads = []; shrimp = []; eggs = []; drops = []; fx = []; pair = null;
    for (let i = 0; i < 8; i++) tads.push({ i, role: i % 2 ? 'omni' : 'carn', born: false, x: 0, y: 0, vx: 0, vy: 0, heading: rnd(0, TAU), face: 1, pitch: 0, phase: rnd(0, TAU), c: 0.45, dev: 0, tail: 1, k: 0, state: 'egg', fade: 1, health: 1, wp: null, t: 0, gape: 0 });
    lastStage = -1; setCaption();
  }

  const cloudX = () => {
    if (T < 13) return lerp(-W * 0.2, W * 0.5, win(T, 3, 7)) + (T > 11 ? (T - 11) * W * 0.25 : 0);
    if (scen !== 'dry' && T > 44 && T < 55) return lerp(-W * 0.2, W * 0.5, win(T, 44, 47)) + (T > 51 ? (T - 51) * W * 0.25 : 0);
    return -9999;
  };

  /* ---------- the script ---------- */
  function script(dt) {
    T += dt; clock += dt;
    const D = scen === 'dry';
    if (T < 5) level = 0; else if (T < 13) level = win(T, 5, 12); else if (T < 46) level = 1;
    else if (D) level = 1 - win(T, 46, 64); else level = T < 50 ? 1 - 0.08 * win(T, 46, 48) : 1;
    const raining = (T > 5 && T < 12) || (!D && T > 46 && T < 52);
    if (raining) for (let i = 0; i < 6; i++) drops.push({ x: cloudX() + rnd(-110, 110) * SC, y: H * 0.12 + rnd(0, 10), v: rnd(380, 460) });
    drops.forEach(d => d.y += d.v * dt); drops = drops.filter(d => d.y < Math.min(floorY(d.x), wet(d.x) ? wy() : 1e9));
    // amplexus pair
    if (T > 13 && T < 22) {
      const k = T - 13, tx = W * 0.44, ty = floorY(tx) - 16 * SC;
      if (!pair) pair = { x: W * 0.15, y: floorY(W * 0.15), dir: 1 };
      if (k < 3) { pair.x = lerp(W * 0.15, edgeX(-1, 4), k / 3); pair.y = floorY(pair.x) - 12 * SC - Math.abs(Math.sin(k * 4)) * 12 * SC; pair.dir = 1; }
      else if (k < 5) { pair.x = lerp(edgeX(-1, 4), tx, (k - 3) / 2); pair.y = lerp(wy() + 10, ty, (k - 3) / 2); }
      else if (k < 7.5) { const n = Math.floor((k - 5) / 0.3); while (eggs.length < Math.min(8, n)) { const j = eggs.length; eggs.push({ x: tx - (j * 5 + 8) * SC, y: floorY(tx - j * 5 * SC) - rnd(5, 10) * SC, p: 0, spin: rnd(0, TAU) }); } }
      else { pair.dir = -1; pair.x = lerp(tx, W * 0.2, (k - 7.5) / 1.5); pair.y = lerp(ty, wy() - 6, (k - 7.5) / 1.5); }
    } else pair = null;
    eggs.forEach(e => { e.p = clamp((T - 18) / 10, 0, 1); e.spin += dt; });
    if (T > 21 && T < 27 && shrimp.length < 14 && Math.random() < dt * 4) { const c = cysts[(Math.random() * cysts.length) | 0]; shrimp.push(mkShrimp(c.x, floorY(c.x) - 4)); fx.push({ kind: 'puff', x: c.x, y: floorY(c.x) - 3, t: 0 }); }
    algae = T < 21 ? 0 : D ? clamp(win(T, 21, 30) - 0.6 * win(T, 52, 64), 0, 1) : win(T, 21, 30);
    if (T > 28) tads.forEach((t, j) => { const e = eggs[j]; if (!t.born && e && T > 28 + j * 0.3) { t.born = true; t.state = 'swim'; t.x = e.x; t.y = e.y - 4; t.vy = -15; e.done = true; } });
    if (!D && T > 47) shrimp.forEach(s => s.dying = true);
    shrimp.forEach(s => moveShrimp(s, dt)); shrimp = shrimp.filter(s => s.alive);
    tads.forEach(t => t.born && tad(t, dt, D));
    fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < 0.8);
    if (T > END) { if (autoAlt) scen = D ? 'wet' : 'dry'; syncButtons(); reset(); }
    setCaption();
  }

  let lastStage = -1;
  function setCaption() {
    const list = STAGES.common.concat(STAGES[scen === 'dry' ? 'dry' : 'wet']);
    let idx = 0; list.forEach((s, i) => { if (T >= s[0]) idx = i; });
    if (idx !== lastStage) { lastStage = idx; if (capEl) capEl.textContent = list[idx][1]; if (stepEl) stepEl.textContent = `${scen === 'dry' ? 'Fast-drying pond' : 'Long-lasting pond'} · ${idx + 1}/${list.length}`; }
  }

  /* ---------- shrimp ---------- */
  function mkShrimp(x, y) { return { x, y, vx: 0, vy: -20, heading: -Math.PI / 2, turn: 0, phase: rnd(0, TAU), face: 1, pitch: 0, grow: 0, alive: true, a: 1 }; }
  function moveShrimp(s, dt) {
    s.phase += dt * 14; s.grow = Math.min(1, s.grow + dt / 8);
    if (s.dying) { s.a -= dt * 0.35; s.y += 8 * dt; if (s.a <= 0) s.alive = false; return; }
    if (!wet(s.x, 6)) { s.a -= dt; if (s.a <= 0) s.alive = false; }
    s.turn = clamp(s.turn + rnd(-3, 3) * dt, -1.2, 1.2); s.heading += s.turn * dt;
    const sp = lerp(10, 30, s.grow) * SC;
    s.vx = lerp(s.vx, Math.cos(s.heading) * sp, 1 - Math.exp(-2 * dt)); s.vy = lerp(s.vy, Math.sin(s.heading) * sp * 0.6, 1 - Math.exp(-2 * dt));
    s.x += s.vx * dt; s.y += s.vy * dt;
    const top = wy() + 8, bot = floorY(s.x) - 6;
    if (s.y < top) { s.y = top; s.heading = Math.abs(s.heading); } if (s.y > bot) { s.y = bot; s.heading = -Math.abs(s.heading); }
    if (!wet(s.x, 20)) { s.x += s.x < W / 2 ? 3 : -3; s.heading = Math.PI - s.heading; s.vx *= -1; }
    if (Math.abs(s.vx) > 1) s.face = s.vx >= 0 ? 1 : -1;
    s.pitch = lerp(s.pitch, clamp(Math.atan2(s.vy, Math.abs(s.vx) + 1e-3), -0.6, 0.6), 1 - Math.exp(-4 * dt));
  }

  /* ---------- tadpoles ---------- */
  const sizeOf = (t) => (5 + 10 * clamp((T - 28) / 18, 0, 1)) * (0.82 + 0.4 * t.c) * SC * (t.role === 'carn' ? lerp(0.85, 1, t.health) : 1);
  const mouthOf = (t) => { const s = sizeOf(t); return { x: t.x + t.face * Math.cos(t.pitch) * s, y: t.y + Math.sin(t.pitch) * s + s * lerp(0.45, 0.22, t.c) }; };
  function steer(t, tx, ty, sp, dt) {
    const want = Math.atan2(ty - t.y, tx - t.x); let d = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI; t.heading += clamp(d, -2.4 * dt, 2.4 * dt);
    t.vx = lerp(t.vx, Math.cos(t.heading) * sp, 1 - Math.exp(-3 * dt)); t.vy = lerp(t.vy, Math.sin(t.heading) * sp, 1 - Math.exp(-3 * dt));
  }
  function swimIn(t, dt) {
    t.x += t.vx * dt; t.y += t.vy * dt;
    const s = sizeOf(t), top = wy() + s, bot = floorY(t.x) - s * 0.8;
    if (t.y < top) t.y = top; if (t.y > bot) t.y = bot;
    let n = 0; while (!wet(t.x, s * 1.4) && n++ < 200) t.x += t.x < W / 2 ? 2 : -2;
    if (Math.abs(t.vx) > 2) t.face = t.vx >= 0 ? 1 : -1;
    t.pitch = lerp(t.pitch, clamp(Math.atan2(t.vy, Math.abs(t.vx) + 1e-3), -0.7, 0.7), 1 - Math.exp(-5 * dt));
  }
  function tad(t, dt, D) {
    t.phase += dt * (t.state === 'swim' ? 8 : 4);
    const s = sizeOf(t), diverge = win(T, 33, 45);
    t.c = t.role === 'carn' ? lerp(0.45, 1, diverge) : lerp(0.45, 0.05, diverge);
    if (D) t.dev = t.role === 'carn' ? win(T, 40, 54) : 0.5 * win(T, 40, 62);
    else t.dev = t.role === 'carn' ? 0.45 * win(T, 40, 52) : win(T, 44, 62);
    if (!D && t.role === 'carn') t.health = 1 - win(T, 52, 60);

    if (t.state === 'swim') {
      t.gape = 0;
      if (T > 33 && t.role === 'carn' && shrimp.some(x => !x.dying) && t.health > 0.6) {
        if (!t.prey || !t.prey.alive || t.prey.dying) t.prey = shrimp.filter(x => !x.dying).reduce((a, b) => Math.hypot(b.x - t.x, b.y - t.y) < Math.hypot(a.x - t.x, a.y - t.y) ? b : a);
        steer(t, t.prey.x, t.prey.y, 34 * SC, dt);
        const m = mouthOf(t), d = Math.hypot(t.prey.x - m.x, t.prey.y - m.y);
        if (d < s * 2) { t.gape = clamp(1 - d / (s * 2), 0, 1); t.prey.x = lerp(t.prey.x, m.x, 0.25); t.prey.y = lerp(t.prey.y, m.y, 0.25); }
        if (d < s * 0.5) { t.prey.alive = false; t.prey = null; fx.push({ kind: 'gulp', x: m.x, y: m.y, t: 0 }); }
      } else if (T > 33 && t.role === 'omni') {
        if (!t.spot || Math.random() < dt * 0.15) { const p = Math.random() < 0.5 ? props[(Math.random() * props.length) | 0] : { x: rnd(W * 0.3, W * 0.7) }; t.spot = { x: p.x + rnd(-10, 10) * SC, y: floorY(p.x) - (p.k === 'rock' ? p.r * 1.2 : 8 * SC) }; }
        const d = Math.hypot(t.spot.x - t.x, t.spot.y - t.y);
        if (d > s * 1.2) steer(t, t.spot.x, t.spot.y, 20 * SC, dt);
        else { t.vx *= 0.9; t.vy *= 0.9; t.gape = 0.5 + 0.5 * Math.sin(clock * 30); if (Math.random() < dt * 4) fx.push({ kind: 'bit', x: t.x + t.face * s, y: t.y + s * 0.5, t: 0 }); }
      } else {
        t.t -= dt; if (t.t <= 0 || !t.wp) { t.t = rnd(2, 4); const x = rnd(W * 0.32, W * 0.68); t.wp = { x, y: lerp(wy() + 20, floorY(x) - 15, Math.random()) }; }
        steer(t, t.wp.x, t.health < 0.5 ? floorY(t.x) : t.wp.y, (t.health < 1 ? 6 + 14 * t.health : 18) * SC, dt);
      }
      if (t.health <= 0.02) t.state = 'dead';
      else if (t.dev > 0.9) { t.state = 'meta'; t.side = t.x < W / 2 ? -1 : 1; }
      else if (level < 0.05) t.state = 'stranded';
      swimIn(t, dt);
    } else if (t.state === 'meta') {
      const tx = edgeX(t.side, s * 1.4), ty = wy() + s * 0.6; steer(t, tx, ty, 30 * SC, dt); swimIn(t, dt);
      if (Math.hypot(t.x - tx, t.y - ty) < s * 1.2 || level < 0.08) { t.state = 'emerge'; t.k = 0; t.face = t.side; }
    } else if (t.state === 'emerge') {
      t.k = Math.min(1, t.k + dt / 6); const stop = edgeX(t.side, -6 * SC);
      if (Math.abs(t.x - stop) > 2) t.x += Math.sign(stop - t.x) * 6 * SC * dt;
      t.y = floorY(t.x) - s * 0.55; t.tail = 1 - t.k; if (t.k >= 1) { t.state = 'hop'; t.t = 0; }
    } else if (t.state === 'hop') {
      t.t += dt; t.x += t.side * 32 * SC * dt; t.y = floorY(clamp(t.x, 0, W)) - s * 0.45 - Math.abs(Math.sin(t.t * 4)) * 12 * SC;
      if (t.x < -30 || t.x > W + 30) t.fade = 0;
    } else if (t.state === 'stranded') {
      t.y = lerp(t.y, floorY(t.x) - s * 0.5, 0.1); t.pitch = lerp(t.pitch, 0, 0.1); t.fade = Math.max(0.7, t.fade - dt * 0.08);
    } else if (t.state === 'dead') {
      t.y = lerp(t.y, floorY(t.x) - s * 0.4, 0.05); t.fade = Math.max(0, t.fade - dt * 0.12);
    }
  }

  /* ---------- drawing ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const y0 = wy();
    if (level > 0.005) {
      const g = ctx.createLinearGradient(0, y0, 0, S0 + depth); g.addColorStop(0, P.waterTop); g.addColorStop(1, P.waterBot);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, y0); for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y0 + Math.sin(x * 0.03 + clock * 1.4) * 1.2); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      ctx.fillStyle = P.speck; specks.forEach(p => { if (p.y > y0 + 2 && p.y < floorY(p.x)) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); } });
    }
    [[0, P.mud1], [14, P.mud2], [38, P.mud3]].forEach(([off, col]) => { ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, floorY(x) + off * SC + (off ? Math.sin(x * 0.02 + off) * 3 : 0)); ctx.lineTo(W, H); ctx.fillStyle = col; ctx.fill(); });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, y0 + 1); ctx.clip(); ctx.fillStyle = P.land; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, floorY(x)); ctx.lineTo(W, H); ctx.fill(); ctx.restore();
    if (level < 0.3) { ctx.strokeStyle = P.crack; ctx.lineWidth = 1; ctx.globalAlpha = 1 - level / 0.3; for (let x = W * 0.3; x < W * 0.7; x += 26 * SC) { const y = floorY(x); ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + 6 * SC, y + 8 * SC); ctx.lineTo(x + 2 * SC, y + 15 * SC); ctx.stroke(); } ctx.globalAlpha = 1; }
    ctx.fillStyle = dark ? 'rgba(230,200,160,0.5)' : 'rgba(120,80,40,0.55)'; if (T < 24) cysts.forEach(c => { ctx.beginPath(); ctx.arc(c.x, floorY(c.x) + c.d * SC, 1.6 * SC, 0, TAU); ctx.fill(); });
    if (T < 13) { drawToad(W * 0.15, floorY(W * 0.15) + 28 * SC, 18 * SC, 1); drawToad(W * 0.2, floorY(W * 0.2) + 34 * SC, 15 * SC, 1); }
    props.forEach(p => {
      const y = floorY(p.x);
      if (p.k === 'rock') { ctx.fillStyle = P.rock; ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.3, p.r, 0, Math.PI, TAU); ctx.fill(); if (algae > 0) { ctx.strokeStyle = P.algae; ctx.globalAlpha = algae; ctx.lineWidth = 4 * SC; ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.3, p.r, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.globalAlpha = 1; } }
      else { ctx.save(); ctx.translate(p.x, y - 4); ctx.rotate(p.a); ctx.fillStyle = P.stick; ctx.fillRect(-p.len / 2, -3 * SC, p.len, 6 * SC); if (algae > 0) { ctx.fillStyle = P.algae; ctx.globalAlpha = algae; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-p.len / 2 + (i + 0.5) * p.len / 6, -4 * SC, 3 * SC, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; } ctx.restore(); }
    });
    if (algae > 0) { ctx.strokeStyle = P.algae; ctx.lineWidth = 1.4 * SC; ctx.lineCap = 'round'; tufts.forEach(f => { const y = floorY(f.x), h = 12 * SC * algae; for (let i = -1; i <= 1; i++) { const sw = Math.sin(clock * 1.3 + f.sway + i) * 2 * SC; ctx.beginPath(); ctx.moveTo(f.x + i * 2.5 * SC, y + 1); ctx.quadraticCurveTo(f.x + i * 3 * SC + sw * 0.5, y - h * 0.5, f.x + i * 3.5 * SC + sw, y - h * (i ? 0.8 : 1)); ctx.stroke(); } }); }
    eggs.forEach(e => { if (!e.done) drawEgg(e); });
    tads.filter(t => t.born && t.c < 0.5).forEach(drawTad); shrimp.forEach(drawShrimp); tads.filter(t => t.born && t.c >= 0.5).forEach(drawTad);
    if (pair) { const d = pair.dir; drawToad(pair.x, pair.y, 24 * SC, d); drawToad(pair.x - d * 5 * SC, pair.y - 16 * SC, 18 * SC, d); }
    fx.forEach(f => { const k = f.t / 0.8; if (f.kind === 'gulp') { ctx.strokeStyle = `rgba(217,112,63,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, 4 + k * 14, 0, TAU); ctx.stroke(); } else if (f.kind === 'bit') { ctx.fillStyle = `rgba(79,138,53,${1 - k})`; ctx.beginPath(); ctx.arc(f.x, f.y - k * 10, 1.6, 0, TAU); ctx.fill(); } else { ctx.fillStyle = `rgba(150,110,70,${0.4 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x, f.y, 3 + k * 10, 0, TAU); ctx.fill(); } });
    if (level > 0.005) { ctx.strokeStyle = P.surface; ctx.lineWidth = 1.5; ctx.beginPath(); let st = false; for (let x = 0; x <= W; x += 6) { const y = y0 + Math.sin(x * 0.03 + clock * 1.4) * 1.2; if (floorY(x) > y) { st ? ctx.lineTo(x, y) : ctx.moveTo(x, y); st = true; } } ctx.stroke(); }
    ctx.strokeStyle = P.rain; ctx.lineWidth = 1; drops.forEach(d => { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + 9); ctx.stroke(); });
    const cx = cloudX(); if (cx > -9000) { ctx.fillStyle = P.cloud; [[0, 0, 60], [-55, 10, 42], [55, 8, 46], [-100, 22, 30], [100, 22, 32], [0, 24, 50]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx * SC, H * 0.08 + dy * SC, r * SC, 0, TAU); ctx.fill(); }); }
  }

  function drawEgg(e) {
    const r = 6 * SC; ctx.fillStyle = dark ? 'rgba(200,220,230,0.25)' : 'rgba(255,255,255,0.55)'; ctx.strokeStyle = dark ? 'rgba(200,220,230,0.5)' : 'rgba(90,110,130,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.spin * 0.6); ctx.fillStyle = '#3a3a3a';
    if (e.p < 0.35) { ctx.beginPath(); ctx.arc(0, 0, r * (0.35 + e.p), 0, TAU); ctx.fill(); }
    else { const k = (e.p - 0.35) / 0.65; ctx.beginPath(); ctx.arc(r * 0.15, 0, r * 0.42, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0.3, 0.3 + 1.2 + 2.4 * k); ctx.stroke(); }
    ctx.restore();
  }

  function drawTad(t) {
    if (t.fade <= 0) return;
    if (t.state === 'emerge' || t.state === 'hop') return drawFroglet(t);
    const s = sizeOf(t), c = t.c, sick = t.role === 'carn' ? 1 - t.health : 0;
    ctx.save(); ctx.globalAlpha = t.fade; ctx.translate(t.x, t.y); ctx.scale(t.face, 1); ctx.rotate(t.pitch + (t.state === 'dead' ? 0.4 : 0));
    let body = mix(mix('#8D8A4E', '#D9703F', c), '#9A9488', sick * 0.8);
    if (t.state === 'stranded') body = mix(body, '#9A9488', 0.5);
    const line = c > 0.5 ? '#7A3A1E' : '#4C4A2A';
    const N = 12, L = s * lerp(2.6, 2.2, c), amp = s * (t.state === 'swim' || t.state === 'meta' ? 0.4 : 0.05), pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([-s * 0.7 - L * u, Math.sin(t.phase - u * 5.5) * amp * Math.pow(u, 1.3)]); }
    ctx.fillStyle = c > 0.5 ? 'rgba(235,165,122,0.55)' : 'rgba(190,185,140,0.55)'; ctx.beginPath();
    pts.forEach(([x, y], i) => { const fin = s * 0.46 * Math.sin(Math.PI * Math.pow(i / N, 0.7)) + 0.01; i ? ctx.lineTo(x, y - fin) : ctx.moveTo(x, y - fin); });
    for (let i = N; i >= 0; i--) { const fin = s * 0.4 * Math.sin(Math.PI * Math.pow(i / N, 0.7)) + 0.01; ctx.lineTo(pts[i][0], pts[i][1] + fin); } ctx.fill();
    ctx.fillStyle = body; ctx.beginPath();
    pts.forEach(([x, y], i) => { const th = s * 0.2 * (1 - i / N) + s * 0.03; i ? ctx.lineTo(x, y - th) : ctx.moveTo(x, y - th); });
    for (let i = N; i >= 0; i--) { const th = s * 0.2 * (1 - i / N) + s * 0.03; ctx.lineTo(pts[i][0], pts[i][1] + th); } ctx.fill();
    const hind = clamp((t.dev - 0.55) / 0.25, 0, 1), fore = clamp((t.dev - 0.8) / 0.1, 0, 1);
    ctx.strokeStyle = body; ctx.lineCap = 'round';
    if (hind > 0) { ctx.lineWidth = s * 0.16; ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.35); ctx.lineTo(-s * (0.6 + 0.5 * hind), s * (0.35 + 0.45 * hind)); ctx.lineTo(-s * (0.3 + 0.6 * hind), s * (0.4 + 0.6 * hind)); ctx.stroke(); }
    if (fore > 0) { ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(s * 0.35, s * 0.45); ctx.lineTo(s * (0.4 + 0.15 * fore), s * (0.45 + 0.45 * fore)); ctx.stroke(); }
    const ry = s * lerp(0.84, 0.7, c) * (1 - 0.15 * sick);
    ctx.fillStyle = body; ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, s, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(-s * 0.1, ry * 0.42, s * 0.7, ry * 0.42, 0, 0, Math.PI); ctx.fill();
    if (c > 0.15) { ctx.fillStyle = `rgba(160,50,30,${(0.25 + 0.4 * c) * (1 - sick * 0.7)})`; ctx.beginPath(); ctx.ellipse(s * 0.28, s * 0.12, s * (0.12 + 0.28 * c), s * (0.1 + 0.2 * c), 0.3, 0, TAU); ctx.fill(); }
    if (c < 0.6) { ctx.strokeStyle = 'rgba(60,55,30,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-s * 0.15, s * 0.2, s * 0.24 * (1 - c), 0, 5.2); ctx.stroke(); }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.3, s * 0.12, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.48, -s * 0.34, s * 0.04, 0, TAU); ctx.fill();
    const mx = s * lerp(0.8, 0.97, c), my = s * lerp(0.55, 0.22, c), g = t.gape;
    ctx.fillStyle = '#2A0F08'; ctx.beginPath(); ctx.ellipse(mx, my, s * (0.08 + 0.14 * g * (0.4 + c)), s * (0.04 + 0.16 * g * (0.4 + c)), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#151515'; ctx.lineWidth = 1 + 1.2 * c; ctx.beginPath(); const bw = s * (0.12 + 0.06 * c), notch = s * 0.1 * c, by = my - s * (0.05 + 0.14 * g);
    ctx.moveTo(mx - bw, by); ctx.lineTo(mx, by + notch); ctx.lineTo(mx + bw * 0.8, by - notch * 0.6); ctx.stroke();
    const rows = Math.round(lerp(5, 1, c)); ctx.strokeStyle = 'rgba(30,25,15,0.7)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < rows; i++) { ctx.beginPath(); ctx.moveTo(mx - s * 0.2, my + s * (0.1 + i * 0.055)); ctx.lineTo(mx + s * 0.1, my + s * (0.14 + i * 0.055)); ctx.stroke(); }
    ctx.restore();
  }

  function drawFroglet(t) {
    const k = t.state === 'hop' ? 1 : t.k, s = sizeOf(t) * lerp(1, 0.72, k), body = mix(mix('#8D8A4E', '#D9703F', t.c), '#7B8A55', k);
    const slope = Math.atan2(floorY(t.x + t.side * 6) - floorY(t.x - t.side * 6), 12) * t.side;
    ctx.save(); ctx.globalAlpha = t.fade; ctx.translate(t.x, t.y); ctx.scale(t.side, 1); ctx.rotate(slope);
    if (k < 1) { const L = s * 2.4 * (1 - k); ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.18); ctx.quadraticCurveTo(-s * 0.7 - L * 0.6, -s * 0.1, -s * 0.7 - L, 0); ctx.quadraticCurveTo(-s * 0.7 - L * 0.6, s * 0.12, -s * 0.7, s * 0.2); ctx.fill(); }
    ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1; ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-s * 0.35, s * 0.3, s * 0.55, s * 0.28, 0.35, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = body; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.05, s * 0.5); ctx.lineTo(-s * 0.55, s * 0.62); ctx.lineTo(-s * 0.15, s * 0.66); ctx.stroke();
    ctx.lineWidth = s * 0.11; ctx.beginPath(); ctx.moveTo(s * 0.45, s * 0.25); ctx.lineTo(s * 0.6, s * 0.62); ctx.stroke();
    ctx.fillStyle = body; ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, s * lerp(0.95, 1.05, k), s * lerp(0.75, 0.6, k), 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C9A227'; ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.48, s * 0.19, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.fillRect(s * 0.44, -s * 0.5, s * 0.22, Math.max(1.2, s * 0.06));
    ctx.restore();
  }

  function drawShrimp(s) {
    const L = lerp(7, 22, s.grow) * SC, col = '#E59A6C';
    ctx.save(); ctx.globalAlpha = s.a; ctx.translate(s.x, s.y); ctx.scale(s.face, 1); ctx.rotate(s.pitch);
    if (s.grow < 0.35) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, L * 0.55, L * 0.38, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.38, 0, L * 0.08, 0, TAU); ctx.fill(); ctx.restore(); return; }
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = L * 0.11; ctx.beginPath(); ctx.moveTo(-L * 0.1, 0); ctx.quadraticCurveTo(-L * 0.55, Math.sin(s.phase * 0.5) * 2, -L * 0.85, Math.sin(s.phase * 0.5) * 3); ctx.stroke();
    ctx.strokeStyle = '#C2462B'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, -L * 0.1); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, L * 0.08); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(L * 0.18, 0, L * 0.34, L * 0.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark ? 'rgba(255,200,170,0.85)' : 'rgba(200,110,70,0.9)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { const x = L * (0.44 - i * 0.065), a = -Math.PI / 2 + Math.sin(s.phase - i * 0.65) * 0.55 - 0.25; ctx.beginPath(); ctx.moveTo(x, -L * 0.06); ctx.lineTo(x + Math.cos(a) * L * 0.17, -L * 0.06 + Math.sin(a) * L * 0.17); ctx.stroke(); }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.64, L * 0.09, L * 0.055, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawToad(x, y, s, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.fillStyle = '#7B8A55'; ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.75, 0, Math.PI, TAU); ctx.lineTo(s * 1.2, 0); ctx.quadraticCurveTo(0, s * 0.35, -s * 1.2, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5F6E40'; ctx.beginPath(); ctx.ellipse(-s * 0.3, s * 0.05, s * 0.55, s * 0.35, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#C9A227'; ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.45, s * 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillRect(s * 0.56, -s * 0.47, s * 0.28, Math.max(1.2, s * 0.06));
    ctx.restore();
  }

  /* ---------- loop + controls ---------- */
  let last = 0, raf = 0;
  function frame(now) { raf = 0; const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; if (!paused) script(dt); draw(); if (running) raf = requestAnimationFrame(frame); }
  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() { (visible && !document.hidden && (!reduce || userStarted)) ? start() : stop(); }
  function syncButtons() { root.querySelectorAll('[data-scen]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scen === scen))); }
  const pb = $('[data-act="pause"]');
  root.querySelectorAll('[data-scen]').forEach(b => b.addEventListener('click', () => { scen = b.dataset.scen; autoAlt = false; syncButtons(); reset(); userStarted = true; paused = false; if (pb) { pb.textContent = 'Pause'; pb.setAttribute('aria-pressed', 'false'); } sync(); }));
  if (pb) pb.addEventListener('click', () => { if (reduce && !userStarted) { userStarted = true; paused = false; } else paused = !paused; pb.textContent = paused ? 'Play' : 'Pause'; pb.setAttribute('aria-pressed', String(paused)); sync(); });

  palette(); resize(); reset(); draw(); syncButtons();
  if (reduce && pb) { pb.textContent = 'Play'; pb.setAttribute('aria-pressed', 'true'); }
  new ResizeObserver(() => { resize(); if (!running) draw(); }).observe(wrap);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(wrap);
  document.addEventListener('visibilitychange', sync);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette(); if (!running) draw(); });
  window.__pond = { jump(t, sc) { if (sc) { scen = sc; autoAlt = false; } reset(); while (T < t) script(1 / 30); draw(); } };
})();
