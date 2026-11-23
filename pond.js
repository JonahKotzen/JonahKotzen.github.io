/* Tank 01: a monsoon pond in one fixed scene (1200 × 440 world units, scaled to fit), driven by a single story clock.
   Opening: dry basin → storm fills the pond → in the water a male calls, a female chooses him, they amplex and
   lay a big clutch → shrimp hatch, algae grows → tadpoles hatch and split by diet.
   Fast-drying pond: carnivores metamorphose and leave; omnivores are stranded and die.
   Long-lasting pond: few shrimp, pond shrinks then floods; carnivores starve; omnivores metamorphose and leave. */
(function () {
  const wrap = document.getElementById('pond');
  if (!wrap) return;
  const cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
  const root = wrap.closest('.pond-sec') || wrap, $ = (s) => root.querySelector(s);
  const capEl = $('.pond-cap'), stepEl = $('.pond-step'), barEl = $('.pond-progress i');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const VW = 1200, VH = 440, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t), win = (t, a, b) => ease((t - a) / (b - a));
  const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
  const R = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const mix = (h1, h2, t) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const ch = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, clamp(t, 0, 1))).toString(16).padStart(2, '0'); return '#' + ch(16) + ch(8) + ch(0); };

  /* ---------- the scene ---------- */
  const FULL = 185, DRY = 412, FLOOD = 166;      // water-surface heights (y grows downward)
  function floor(x) {
    const u = Math.min(1, Math.abs(x - 600) / 600);
    if (u < 0.42) return 205 + 195 * (1 - Math.pow(u / 0.42, 2));   // basin, bottom at y = 400
    if (u < 0.72) return 205 - (u - 0.42) / 0.30 * 35;              // gentle beach
    return 170 - (u - 0.72) / 0.28 * 70;                            // dry bank
  }
  let wl = DRY;                                                      // current water level
  const wet = (x) => floor(x) > wl + 2;
  const edge = (side) => { let x = 600; while (floor(x) > wl && Math.abs(x - 600) < 598) x += side * 2; return x; };

  const STAGES = {
    common: [[0, 'Dry season: fairy shrimp eggs and spadefoot toads wait in the dry ground.'],
             [4, 'A monsoon storm rolls in and fills the pond.'],
             [8, 'A male spadefoot swims out and calls.'],
             [12, 'A female swims over and picks him; he clasps her in amplexus.'],
             [18, 'Still in the rain, she lays a big clutch of eggs on sticks and the bottom.'],
             [23, 'Fairy shrimp hatch from the mud, and algae coats the rocks, sticks and bottom.'],
             [29, 'The eggs hatch. Same clutch, same pond.'],
             [33, 'Tadpoles that eat shrimp turn carnivore; tadpoles that graze algae turn omnivore.']],
    dry: [[46, 'No more rain. The pond dries fast.'],
          [48.5, 'Carnivores develop faster: legs, then out onto the shore as the tail is reabsorbed.'],
          [52, 'The slower omnivores are still tadpoles, and they get stranded as the water disappears.'],
          [63, 'The pond is gone. Only the carnivores made it out.'],
          [69, 'Fast-drying ponds favor carnivores.']],
    wet: [[40, 'This pond had few shrimp, and they are gone as the water shrinks.'],
          [46, 'A second storm floods the pond even higher.'],
          [50, 'With no shrimp left, the carnivores starve. The omnivores keep grazing.'],
          [61, 'In a long-lasting pond, the omnivores develop and walk out.'],
          [71, 'Long-lasting ponds favor omnivores.']]
  };
  const ENDT = { dry: 74, wet: 76 };

  let k = 1, W = 0, dark = false, P = {}, running = false, visible = false, paused = false, userStarted = false, speed = 1;
  let scen = 'dry', autoAlt = true, T = 0, clock = 0, tads = [], shrimp = [], eggs = [], drops = [], bits = [], gulps = [];

  function palette() {
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [236, 238, 231];
    dark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) < 110;
    P = dark ? { wTop: 'rgba(52,86,96,0.85)', wBot: 'rgba(24,44,44,0.95)', surf: 'rgba(160,200,210,0.6)', m1: '#3B2F22', m2: '#2E251B', m3: '#251E16', land: '#4A3B2A', algae: '#5E8F3E', cloud: '#3A4248', rain: 'rgba(170,200,220,0.45)', rock: '#5B5A55', stick: '#5A4632', crack: 'rgba(0,0,0,0.35)', speck: 'rgba(210,220,200,0.15)', egg: 'rgba(200,220,230,0.3)', eggLine: 'rgba(200,220,230,0.55)' }
      : { wTop: 'rgba(150,192,196,0.65)', wBot: 'rgba(96,132,118,0.8)', surf: 'rgba(255,255,255,0.85)', m1: '#C9A878', m2: '#B38F60', m3: '#9C794E', land: '#D8BD8E', algae: '#4F8A35', cloud: '#6F7780', rain: 'rgba(70,100,130,0.4)', rock: '#8E8A80', stick: '#7A5C3E', crack: 'rgba(90,60,30,0.45)', speck: 'rgba(60,70,50,0.2)', egg: 'rgba(255,255,255,0.65)', eggLine: 'rgba(90,110,130,0.5)' };
  }
  let bg = null;
  function buildBg() {
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height; const g = bg.getContext('2d'); g.setTransform(cv.width / VW, 0, 0, cv.height / VH, 0, 0);
    [[0, P.m1], [16, P.m2], [42, P.m3]].forEach(([o, c]) => { g.beginPath(); g.moveTo(0, VH); for (let x = 0; x <= VW; x += 6) g.lineTo(x, floor(x) + o + (o ? Math.sin(x * 0.02 + o) * 3 : 0)); g.lineTo(VW, VH); g.fillStyle = c; g.fill(); });
  }
  function resize() {
    W = wrap.getBoundingClientRect().width; k = W / VW;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.style.height = (W * VH / VW) + 'px';
    cv.width = Math.round(W * DPR); cv.height = Math.round(W * VH / VW * DPR);
    ctx.setTransform(DPR * k, 0, 0, DPR * k, 0, 0); buildBg();
  }
  const PROPS = [{ t: 'rock', x: 455, r: 20 }, { t: 'rock', x: 745, r: 16 }, { t: 'stick', x: 560, len: 80, a: -0.25 }, { t: 'stick', x: 655, len: 56, a: 0.3 }];
  const TUFTS = Array.from({ length: 40 }, (_, i) => ({ x: 360 + i * 12, s: R(i) * TAU }));
  const CYSTS = Array.from({ length: 26 }, (_, i) => ({ x: 380 + i * 17, d: 8 + R(i + 9) * 22 }));
  const SPECKS = Array.from({ length: 70 }, (_, i) => ({ x: 120 + R(i + 30) * 960, y: 170 + R(i + 130) * 230, r: 0.6 + R(i + 230) }));

  /* ---------- cast ---------- */
  function reset() {
    T = 0; clock = 0; drops = []; bits = []; gulps = [];
    eggs = Array.from({ length: 48 }, (_, i) => { const c = i % 4, x = [535, 575, 625, 665][c] + (R(i) - 0.5) * 30; return { x, dy: 7 + R(i + 5) * 14, t: 18.3 + i * 0.095 }; });
    tads = Array.from({ length: 8 }, (_, i) => ({ i, role: i % 2 ? 'omni' : 'carn', state: 'egg', x: 0, y: 0, fs: 1, face: 1, pitch: 0, c: 0.45, dev: 0, gape: 0, dead: 0, fade: 1, ph: R(i + 40) * TAU, side: i < 4 ? -1 : 1 }));  // left half of the pond exits left, right half exits right
    const nS = scen === 'dry' ? 12 : 4, carns = tads.filter(t => t.role === 'carn');
    shrimp = Array.from({ length: nS }, (_, i) => ({ i, ph: R(i + 60) * TAU, cx: 470 + R(i + 70) * 260, born: 23 + i * 0.3, by: carns[i % 4], eatAt: 35 + Math.floor(i / 4) * 3.4 + (i % 4) * 0.8, alive: true, x: 0, y: 0, fs: 1, face: 1 }));
    lastStage = -1; caption();
  }

  /* ---------- story clock ---------- */
  function step(dt) {
    T += dt; clock += dt;
    const dry = scen === 'dry';
    // water level
    if (T < 4) wl = DRY;
    else if (T < 40) wl = lerp(DRY, FULL, win(T, 4, 11));
    else if (dry) wl = lerp(FULL, DRY, win(T, 46, 64));
    else wl = T < 46 ? lerp(FULL, 250, win(T, 40, 46)) : lerp(250, FLOOD, win(T, 46, 53));
    // rain
    if (raining()) for (let i = 0; i < 6; i++) drops.push({ x: cloudX() + (R(clock * 97 + i) - 0.5) * 250, y: 70, v: 430 });
    drops.forEach(d => d.y += d.v * dt); drops = drops.filter(d => d.y < Math.min(floor(d.x), wl));
    // shrimp: smooth figure-eights in their own band; scheduled to be sucked into a carnivore's mouth
    shrimp.forEach(s => {
      if (!s.alive || T < s.born) return;
      const lo = wl + 14, hi = Math.min(330, floor(s.cx) - 30);
      let x = s.cx + Math.sin(clock * 0.45 + s.ph) * 45, y = lerp(lo, hi, 0.35 + 0.2 * Math.sin(clock * 0.9 + s.ph));
      if (T < s.born + 2) y = lerp(floor(x) - 4, y, win(T, s.born, s.born + 2));
      const eater = s.by;
      if (T > s.eatAt - 1.4 && eater.state === 'swim') { const m = mouth(eater), u = win(T, s.eatAt - 1.4, s.eatAt); x = lerp(x, m.x, u); y = lerp(y, m.y, u); }
      if (Math.abs(x - s.x) > 0.05) s.face = x > s.x ? 1 : -1; s.fs = damp(s.fs, s.face, 6, dt); s.x = x; s.y = y;
      if (T >= s.eatAt && eater.state === 'swim') { s.alive = false; gulps.push({ x, y, t: 0 }); }
    });
    // tadpoles
    const live = tads.filter(t => t.state === 'swim').sort((a, b) => a.i - b.i);
    tads.forEach(t => tadpole(t, dt, dry, live));
    bits.forEach(b => b.t += dt); bits = bits.filter(b => b.t < 0.9);
    gulps.forEach(g => g.t += dt); gulps = gulps.filter(g => g.t < 0.7);
    if (T > ENDT[scen]) { if (autoAlt) scen = dry ? 'wet' : 'dry'; syncButtons(); reset(); }
    caption();
  }
  const raining = () => (T > 4 && T < 22.5) || (scen === 'wet' && T > 45.5 && T < 53);
  function cloudX() {
    if (T < 25) return lerp(-250, 600, win(T, 2, 5.5)) + 1000 * win(T, 22, 25);
    if (scen === 'wet' && T > 43 && T < 57) return lerp(-250, 600, win(T, 43, 46)) + 1000 * win(T, 53, 56);
    return null;
  }

  function room() { const q = (sd) => tads.filter(o => o.side === sd && (o.state === 'meta' || o.state === 'emerge')).length;
    return Math.min(edge(1) - 70 - 52 * q(1), 840) - Math.max(edge(-1) + 70 + 52 * q(-1), 360); }
  function slot(t, list) { // every swimming tadpole gets its own evenly spaced x across the water that's left
    const n = list.length, idx = list.indexOf(t);
    const q = (sd) => tads.filter(o => o.side === sd && (o.state === 'meta' || o.state === 'emerge')).length; // leave room for metamorphs queuing at each shore
    const xl = Math.max(edge(-1) + 70 + 52 * q(-1), 360), xr = Math.min(edge(1) - 70 - 52 * q(1), 840), x = n ? lerp(xl, Math.max(xl, xr), (idx + 0.5) / n) : 600;
    const y = t.role === 'carn' ? lerp(wl + 26, floor(x) - 30, 0.3) : floor(x) - 20;
    return { x, y: Math.max(wl + 18, y) };
  }
  const size = (t) => (8 + 12 * win(T, 29, 44)) * (0.85 + 0.35 * t.c);
  const mouth = (t) => { const s = size(t); return { x: t.x + Math.sign(t.fs) * s, y: t.y + s * lerp(0.45, 0.22, t.c) }; };

  function tadpole(t, dt, dry, row) {
    const s = size(t);
    if (t.state === 'egg') { if (T > 29 + t.i * 0.25) { const e = eggs[t.i * 6]; t.state = 'swim'; t.x = e.x; t.y = floor(e.x) - e.dy; } else return; }
    t.c = t.role === 'carn' ? lerp(0.45, 1, win(T, 33, 44)) : lerp(0.45, 0.05, win(T, 33, 44));
    const rank = t.i < 4 ? Math.floor(t.i / 2) : 3 - Math.floor(t.i / 2), o = rank * (t.role === 'carn' ? 2.2 : 3); // animals nearest the shore go first // each animal on its own schedule
    t.dev = dry ? (t.role === 'carn' ? win(T, 40 + o, 50 + o) : 0.5 * win(T, 41, 64)) : (t.role === 'carn' ? 0.4 * win(T, 41, 51) : win(T, 48 + o, 59 + o));
    const starve = !dry && t.role === 'carn' ? win(T, 50, 56) : 0;
    const px = t.x, py = t.y;
    if (t.state === 'swim') {
      const sl = slot(t, row), gap = (edge(1) - edge(-1) - 110) / Math.max(1, row.length), sweep = Math.min(16, gap * 0.15) * (1 - starve);
      let tx = sl.x + Math.sin(clock * 0.55 + t.ph) * sweep, ty = sl.y + Math.sin(clock * 1.1 + t.ph) * 3;
      if (starve) ty = lerp(ty, floor(tx) - 70, starve); // weakening carnivores sag; they sink the rest of the way once dead
      const nx = damp(t.x, tx, 1.6, dt), ny = damp(t.y, ty, 1.6, dt), vx = nx - t.x;
      if (Math.abs(vx) > 0.04 * 60 * dt) t.face = vx > 0 ? 1 : -1;
      t.gape = 0;
      if (t.role === 'carn') shrimp.forEach(sh => { if (sh.by === t && sh.alive && T > sh.eatAt - 1.4) { t.face = sh.x > t.x ? 1 : -1; t.gape = Math.max(t.gape, win(T, sh.eatAt - 1.4, sh.eatAt - 0.3)); } });
      if (t.role === 'omni' && T > 33) { t.gape = 0.5 + 0.5 * Math.sin(clock * 26 + t.ph); if (R(clock * 31 + t.i) < dt * 3) bits.push({ x: t.x + Math.sign(t.fs) * s * 0.9, y: t.y + s * 0.6, t: 0 }); }
      t.fs = damp(t.fs, t.face, 5, dt);
      t.pitch = damp(t.pitch, t.role === 'omni' && T > 33 ? 0.3 : 0, 3, dt);
      t.x = nx; t.y = ny;
      if (starve >= 1) { t.state = 'dead'; t.dead = 0; }
      else if (t.dev > 0.9) { t.state = 'meta'; t.m = 0; t.mx = t.x; t.my = t.y; t.ord = tads.filter(o => o !== t && o.side === t.side && (o.state === 'meta' || o.state === 'emerge')).length; }
      else if (dry && t.role === 'omni' && (wl > 395 || (room() < 56 * row.filter(o => o.role === 'omni').length))) { t.state = 'dead'; t.dead = 0; }
    } else if (t.state === 'meta') {      // eased swim to its own waiting spot in the shallows (queued by arrival)
      t.m = Math.min(1, t.m + dt / 4);
      const tx = edge(t.side) - t.side * (18 + 52 * t.ord), ty = wl + 9;
      const up = ease(Math.min(1, t.m / 0.35)), along = ease(clamp((t.m - 0.25) / 0.75, 0, 1)); // rise to the surface, then travel along it
      if (t.role === 'omni') { t.x = lerp(t.mx, tx, ease(t.m)); t.y = Math.max(ty, Math.min(lerp(t.my, ty, ease(t.m)), floor(t.x) - 50)); } // swim low over the bottom toward shore
      else { t.x = lerp(t.mx, tx, along); t.y = lerp(t.my, ty, up); }
      t.face = t.side; t.fs = damp(t.fs, t.side, 5, dt); t.pitch = damp(t.pitch, 0, 4, dt);
      const busy = tads.some(o => o !== t && o.side === t.side && o.state === 'emerge');
      if (t.m >= 1 && !busy && !tads.some(o => o !== t && o.side === t.side && o.state === 'meta' && o.ord < t.ord)) {
        t.state = 'emerge'; t.k = 0; t.x0 = t.x; t.y0 = t.y; t.spot = edge(t.side) + t.side * 34;
      }
    } else if (t.state === 'emerge') {    // crawl out to a fixed spot on the beach while the tail shrinks
      t.k = Math.min(1, t.k + dt / 5); const u = ease(t.k);
      t.x = lerp(t.x0, t.spot, u); t.y = lerp(t.y0, floor(t.x) - s * 0.6, ease(Math.min(1, t.k * 1.6)));
      if (t.k >= 1) { t.state = 'hop'; t.h = 0; t.x0 = t.x; }
    } else if (t.state === 'hop') {       // toadlet hops away over the bank
      t.h += dt / 3.2; t.x = t.x0 + t.side * ease(t.h) * 240; t.y = floor(clamp(t.x, 0, VW)) - s * 0.6 - Math.abs(Math.sin(t.h * Math.PI * 4)) * 14;
      t.fade = 1 - win(t.h, 0.75, 1); if (t.h >= 1) t.fade = 0;
    } else if (t.state === 'dead') {      // belly up, sinking or lying on the mud, then fading
      t.dead += dt; t.y = damp(t.y, floor(t.x) - s * 0.5, 1.2, dt); t.pitch = damp(t.pitch, 0, 2, dt);
      t.fade = 1 - win(t.dead, 11, 14);
    }
    const v = Math.hypot(t.x - px, t.y - py) / Math.max(dt, 1e-4); t.tp = (t.tp || 0) + dt * (t.state === 'dead' ? 0 : 4 + Math.min(9, v * 0.35));
  }

  /* ---------- the frogs (all of the courtship happens in the water) ---------- */
  function frogs() {
    if (T < 5.5 || T > 28) return null;
    const S = wl + 9, out = [];
    const hopIn = (x0, x1, a, b) => { const u = win(T, a, b), x = lerp(x0, x1, u); return { x, y: Math.min(floor(x) - 12, S) - Math.abs(Math.sin(u * Math.PI * 3)) * 16 * (wet(x) ? 0 : 1) }; };
    let m, f;
    // male: hops down the left bank into the water, swims to the middle, calls
    if (T < 8) m = hopIn(40, 420, 5.5, 8); else m = { x: lerp(420, 520, win(T, 8, 9.5)), y: S };
    m.d = 1; m.call = T > 9 && T < 15.5 ? 0.5 + 0.5 * Math.sin(clock * 9) : 0;
    // female: arrives from the right while he calls
    if (T < 11) f = { x: 2000, y: S }; else if (T < 13) f = hopIn(1160, 800, 11, 13); else f = { x: lerp(800, 545, win(T, 13, 15.5)), y: S + 2 };
    f.d = -1;
    if (T < 15.5) { out.push({ ...f, s: 24 }); out.push({ ...m, s: 18 }); return out; }
    // amplexus: he climbs on, they dive to the sticks, she lays, then they part and swim off
    if (T < 23) {
      let x, y, d = 1;
      if (T < 16.5) { x = 545; y = S + 2; d = -1; const u = win(T, 15.5, 16.5); out.push({ x, y, d, s: 24 }); out.push({ x: lerp(520, 545 + 5, u), y: lerp(S, S - 16, u) - Math.sin(u * Math.PI) * 10, d: lerp(1, -1, u), s: 18 }); return out; }
      if (T < 18.3) { const u = win(T, 16.5, 18.3); x = lerp(545, 520, u); y = lerp(S + 2, floor(520) - 30, u); }
      else { const u = (T - 18.3) / 4.7; x = lerp(520, 680, u); y = floor(x) - 30; }
      out.push({ x, y, d, s: 24 }); out.push({ x: x - d * 5, y: y - 16, d, s: 18 }); return out;
    }
    const u = win(T, 23, 28), a = 1 - win(T, 26.5, 28);
    out.push({ x: lerp(680, edge(1) - 20, u), y: lerp(floor(680) - 30, S, u), d: 1, s: 24, a });
    out.push({ x: lerp(675, edge(-1) + 20, u), y: lerp(floor(675) - 46, S, u), d: -1, s: 18, a });
    return out;
  }

  let lastStage = -1, tickFor = '';
  function ticks(list) {
    const bar = $('.pond-progress'); if (!bar || tickFor === scen) return; tickFor = scen;
    bar.querySelectorAll('b').forEach(b => b.remove());
    list.forEach(([t]) => { if (!t) return; const b = document.createElement('b'); b.style.left = (100 * t / ENDT[scen]) + '%'; bar.appendChild(b); });
  }
  function caption() {
    const list = STAGES.common.concat(STAGES[scen]); let idx = 0; list.forEach((s, i) => { if (T >= s[0]) idx = i; });
    if (barEl) barEl.style.width = (100 * clamp(T / ENDT[scen], 0, 1)).toFixed(2) + '%';
    if (idx !== lastStage) { lastStage = idx; if (capEl) { const txt = list[idx][1]; capEl.style.opacity = 0; clearTimeout(caption.t); caption.t = setTimeout(() => { capEl.textContent = txt; capEl.style.opacity = 1; }, 220); } ticks(list); if (stepEl) stepEl.textContent = `${scen === 'dry' ? 'Fast-drying pond' : 'Long-lasting pond'} · ${idx + 1}/${list.length}`; }
  }

  /* ---------- drawing ---------- */
  function draw() {
    ctx.clearRect(0, 0, VW, VH);
    // water
    if (wl < DRY - 2) {
      const g = ctx.createLinearGradient(0, wl, 0, 400); g.addColorStop(0, P.wTop); g.addColorStop(1, P.wBot);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, wl); for (let x = 0; x <= VW; x += 10) ctx.lineTo(x, wl + Math.sin(x * 0.03 + clock * 1.2) * 1.2); ctx.lineTo(VW, VH); ctx.lineTo(0, VH); ctx.fill();
      ctx.fillStyle = P.speck; SPECKS.forEach(p => { if (p.y > wl + 3 && p.y < floor(p.x)) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); } });
    }
    // ground
    if (bg) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bg, 0, 0); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VW, wl + 1); ctx.clip(); ctx.fillStyle = P.land; ctx.beginPath(); ctx.moveTo(0, VH); for (let x = 0; x <= VW; x += 10) ctx.lineTo(x, floor(x)); ctx.lineTo(VW, VH); ctx.fill(); ctx.restore();
    const crack = 1 - win(DRY - wl, 0, 60);
    if (crack > 0) { ctx.strokeStyle = P.crack; ctx.lineWidth = 1; ctx.globalAlpha = crack; for (let x = 380; x < 820; x += 28) { const y = floor(x); ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + 7, y + 9); ctx.lineTo(x + 2, y + 16); ctx.stroke(); } ctx.globalAlpha = 1; }
    // waiting underground
    const under = 1 - win(T, 23, 25);
    if (under > 0) { ctx.globalAlpha = under; ctx.fillStyle = dark ? 'rgba(230,200,160,0.5)' : 'rgba(120,80,40,0.55)'; CYSTS.forEach(c => { ctx.beginPath(); ctx.arc(c.x, floor(c.x) + c.d, 1.8, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1; }
    const bur = 1 - win(T, 4.5, 6);
    if (bur > 0) { ctx.globalAlpha = bur; [[60, 18, 1], [1140, 24, -1]].forEach(([x, s, d]) => { const y = floor(x) + 30; ctx.fillStyle = dark ? 'rgba(0,0,0,0.3)' : 'rgba(90,60,30,0.3)'; ctx.beginPath(); ctx.ellipse(x, y - 4, s * 1.5, s * 0.9, 0, 0, TAU); ctx.fill(); toad(x, y, s, d, 0); }); ctx.globalAlpha = 1; }
    // rocks, sticks, algae
    const algae = T < 23 ? 0 : scen === 'dry' ? clamp(win(T, 23, 31) - 0.6 * win(T, 52, 64), 0, 1) : win(T, 23, 31);
    PROPS.forEach(p => {
      const y = floor(p.x);
      if (p.t === 'rock') { ctx.fillStyle = P.rock; ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.3, p.r, 0, Math.PI, TAU); ctx.fill(); if (algae) { ctx.strokeStyle = P.algae; ctx.globalAlpha = algae; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.3, p.r, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.globalAlpha = 1; } }
      else { ctx.save(); ctx.translate(p.x, y - 4); ctx.rotate(p.a); ctx.fillStyle = P.stick; ctx.fillRect(-p.len / 2, -3, p.len, 6); if (algae) { ctx.fillStyle = P.algae; ctx.globalAlpha = algae; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-p.len / 2 + (i + 0.5) * p.len / 6, -4, 3, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; } ctx.restore(); }
    });
    if (algae) { ctx.strokeStyle = P.algae; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; TUFTS.forEach(f => { const y = floor(f.x), h = 12 * algae; for (let i = -1; i <= 1; i++) { const sw = Math.sin(clock * 1.2 + f.s + i) * 2; ctx.beginPath(); ctx.moveTo(f.x + i * 2.5, y + 1); ctx.quadraticCurveTo(f.x + i * 3 + sw * 0.5, y - h * 0.5, f.x + i * 3.5 + sw, y - h * (i ? 0.8 : 1)); ctx.stroke(); } }); }
    // eggs
    eggs.forEach(e => { if (T < e.t) return; const a = win(T, e.t, e.t + 0.4) * (1 - win(T, 29, 31)); if (a <= 0) return; const y = floor(e.x) - e.dy, r = 5 * a;
      ctx.fillStyle = P.egg; ctx.strokeStyle = P.eggLine; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(e.x, y, r * (0.35 + 0.25 * win(T, 21, 28)), 0, TAU); ctx.fill(); });
    // animals: omnivores, shrimp, carnivores, frogs
    tads.filter(t => t.state !== 'egg' && t.c < 0.5).forEach(drawTad);
    shrimp.forEach(s => { if (s.alive && T > s.born) drawShrimp(s); });
    tads.filter(t => t.state !== 'egg' && t.c >= 0.5).forEach(drawTad);
    const fr = frogs(); if (fr) fr.forEach(f => { ctx.globalAlpha = f.a === undefined ? 1 : f.a; toad(f.x, f.y, f.s, f.d, f.call || 0); ctx.globalAlpha = 1; });
    bits.forEach(b => { ctx.fillStyle = `rgba(79,138,53,${1 - b.t / 0.9})`; ctx.beginPath(); ctx.arc(b.x, b.y - b.t * 12, 1.8, 0, TAU); ctx.fill(); });
    gulps.forEach(g => { ctx.strokeStyle = `rgba(217,112,63,${1 - g.t / 0.7})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(g.x, g.y, 4 + g.t * 20, 0, TAU); ctx.stroke(); });
    // surface line, rain, cloud
    if (wl < DRY - 2) { ctx.strokeStyle = P.surf; ctx.lineWidth = 1.5; ctx.beginPath(); let st = false; for (let x = 0; x <= VW; x += 8) { const y = wl + Math.sin(x * 0.03 + clock * 1.2) * 1.2; if (floor(x) > y) { st ? ctx.lineTo(x, y) : ctx.moveTo(x, y); st = true; } else st = false; } ctx.stroke(); }
    ctx.strokeStyle = P.rain; ctx.lineWidth = 1; drops.forEach(d => { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + 10); ctx.stroke(); });
    const cx = cloudX(); if (cx !== null) { ctx.fillStyle = P.cloud; [[0, 0, 62], [-58, 12, 44], [58, 10, 48], [-105, 24, 32], [105, 24, 34], [0, 26, 52]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx, 34 + dy, r, 0, TAU); ctx.fill(); }); }
    // fast-forward badge
    if (speed > 1) { ctx.fillStyle = dark ? 'rgba(230,234,227,0.9)' : 'rgba(24,32,29,0.85)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(1100, 14, 82, 30, 6) : ctx.rect(1100, 14, 82, 30); ctx.fill();
      ctx.fillStyle = dark ? '#111613' : '#F6F7F2'; [0, 14].forEach(o => { ctx.beginPath(); ctx.moveTo(1112 + o, 21); ctx.lineTo(1126 + o, 29); ctx.lineTo(1112 + o, 37); ctx.fill(); }); ctx.font = '600 15px ui-monospace, monospace'; ctx.fillText(speed + '×', 1146, 35); }
  }

  function drawTad(t) {
    if (t.fade <= 0) return;
    if (t.state === 'emerge' || t.state === 'hop') return drawFroglet(t);
    const s = size(t), c = t.c, dead = t.state === 'dead', starve = scen === 'wet' && t.role === 'carn' ? win(T, 50, 56) : 0;
    ctx.save(); ctx.globalAlpha = t.fade; ctx.translate(t.x, t.y);
    ctx.scale(Math.abs(t.fs) < 0.15 ? Math.sign(t.fs || 1) * 0.15 : t.fs, dead ? -1 : 1); ctx.rotate(t.pitch);
    const body = mix(mix('#8D8A4E', '#D9703F', c), '#A39E92', Math.max(starve * 0.8, dead ? 0.6 : 0)), line = c > 0.5 ? '#7A3A1E' : '#4C4A2A';
    const N = 12, L = s * lerp(2.6, 2.2, c), amp = dead ? 0 : s * 0.36, pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([-s * 0.7 - L * u, Math.sin((t.tp || 0) + t.ph - u * 5.5) * amp * Math.pow(u, 1.3)]); }
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
    const ry = s * lerp(0.84, 0.7, c) * (1 - 0.15 * starve);
    ctx.fillStyle = body; ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, s, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,220,0.35)'; ctx.beginPath(); ctx.ellipse(-s * 0.1, ry * 0.42, s * 0.7, ry * 0.42, 0, 0, Math.PI); ctx.fill();
    if (c > 0.15) { ctx.fillStyle = `rgba(160,50,30,${(0.25 + 0.4 * c) * (1 - starve * 0.7)})`; ctx.beginPath(); ctx.ellipse(s * 0.28, s * 0.12, s * (0.12 + 0.28 * c), s * (0.1 + 0.2 * c), 0.3, 0, TAU); ctx.fill(); }
    if (c < 0.6) { ctx.strokeStyle = 'rgba(60,55,30,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-s * 0.15, s * 0.2, s * 0.24 * (1 - c), 0, 5.2); ctx.stroke(); }
    if (dead) { const r = Math.max(3.5, s * 0.24); ctx.strokeStyle = '#D22B2B'; ctx.lineWidth = Math.max(2, r * 0.5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s * 0.45 - r, -s * 0.3 - r); ctx.lineTo(s * 0.45 + r, -s * 0.3 + r); ctx.moveTo(s * 0.45 + r, -s * 0.3 - r); ctx.lineTo(s * 0.45 - r, -s * 0.3 + r); ctx.stroke(); }
    else { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.3, s * 0.12, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.48, -s * 0.34, s * 0.04, 0, TAU); ctx.fill(); }
    const mx = s * lerp(0.8, 0.97, c), my = s * lerp(0.55, 0.22, c), g = t.gape;
    ctx.fillStyle = '#2A0F08'; ctx.beginPath(); ctx.ellipse(mx, my, s * (0.08 + 0.14 * g * (0.4 + c)), s * (0.04 + 0.16 * g * (0.4 + c)), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#151515'; ctx.lineWidth = 1 + 1.2 * c; ctx.beginPath(); const bw = s * (0.12 + 0.06 * c), notch = s * 0.1 * c, by = my - s * (0.05 + 0.14 * g);
    ctx.moveTo(mx - bw, by); ctx.lineTo(mx, by + notch); ctx.lineTo(mx + bw * 0.8, by - notch * 0.6); ctx.stroke();
    const rows = Math.round(lerp(5, 1, c)); ctx.strokeStyle = 'rgba(30,25,15,0.7)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < rows; i++) { ctx.beginPath(); ctx.moveTo(mx - s * 0.2, my + s * (0.1 + i * 0.055)); ctx.lineTo(mx + s * 0.1, my + s * (0.14 + i * 0.055)); ctx.stroke(); }
    ctx.restore();
  }

  function drawFroglet(t) { // same animal: tail shrinks, body becomes a toad. Always drawn level.
    const kk = t.state === 'hop' ? 1 : t.k, s = size(t) * lerp(1, 0.75, kk), body = mix(mix('#8D8A4E', '#D9703F', t.c), '#7B8A55', kk);
    ctx.save(); ctx.globalAlpha = t.fade; ctx.translate(t.x, t.y); ctx.scale(t.side, 1);
    if (kk < 1) { const L = s * 2.4 * (1 - kk); ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.18); ctx.quadraticCurveTo(-s * 0.7 - L * 0.6, -s * 0.1, -s * 0.7 - L, 0); ctx.quadraticCurveTo(-s * 0.7 - L * 0.6, s * 0.12, -s * 0.7, s * 0.2); ctx.fill(); }
    ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1; ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-s * 0.35, s * 0.3, s * 0.55, s * 0.28, 0.35, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = body; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * 0.05, s * 0.5); ctx.lineTo(-s * 0.55, s * 0.62); ctx.lineTo(-s * 0.15, s * 0.66); ctx.stroke();
    ctx.lineWidth = s * 0.11; ctx.beginPath(); ctx.moveTo(s * 0.45, s * 0.25); ctx.lineTo(s * 0.6, s * 0.62); ctx.stroke();
    ctx.fillStyle = body; ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, s * lerp(0.95, 1.05, kk), s * lerp(0.75, 0.6, kk), 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C9A227'; ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.48, s * 0.19, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.fillRect(s * 0.44, -s * 0.5, s * 0.22, Math.max(1.2, s * 0.06));
    ctx.restore();
  }

  function drawShrimp(s) {
    const L = lerp(9, 24, win(T, s.born, s.born + 6)), col = '#E59A6C', ph = clock * 14 + s.ph;
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(Math.abs(s.fs) < 0.15 ? Math.sign(s.fs || 1) * 0.15 : s.fs, 1);
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = L * 0.11; ctx.beginPath(); ctx.moveTo(-L * 0.1, 0); ctx.quadraticCurveTo(-L * 0.55, Math.sin(ph * 0.5) * 2, -L * 0.85, Math.sin(ph * 0.5) * 3); ctx.stroke();
    ctx.strokeStyle = '#C2462B'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, -L * 0.1); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, L * 0.08); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(L * 0.18, 0, L * 0.34, L * 0.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark ? 'rgba(255,200,170,0.85)' : 'rgba(200,110,70,0.9)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { const x = L * (0.44 - i * 0.065), a = -Math.PI / 2 + Math.sin(ph - i * 0.65) * 0.55 - 0.25; ctx.beginPath(); ctx.moveTo(x, -L * 0.06); ctx.lineTo(x + Math.cos(a) * L * 0.17, -L * 0.06 + Math.sin(a) * L * 0.17); ctx.stroke(); }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.64, L * 0.09, L * 0.055, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function toad(x, y, s, dir, call) {
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.abs(dir) < 0.15 ? Math.sign(dir || 1) * 0.15 : dir, 1);
    if (call > 0) {
      ctx.fillStyle = 'rgba(235,225,190,0.95)'; ctx.beginPath(); ctx.arc(s * 0.85, s * 0.15, s * (0.2 + 0.35 * call), 0, TAU); ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(230,234,227,0.6)' : 'rgba(24,32,29,0.5)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.7 - i * 0.2; ctx.beginPath(); ctx.arc(s * 0.85, -s * 0.1, s * (1.3 + i * 0.45 + call * 0.3), -0.7, 0.3); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#7B8A55'; ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.75, 0, Math.PI, TAU); ctx.lineTo(s * 1.2, 0); ctx.quadraticCurveTo(0, s * 0.35, -s * 1.2, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5F6E40'; ctx.beginPath(); ctx.ellipse(-s * 0.3, s * 0.05, s * 0.55, s * 0.35, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#C9A227'; ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.45, s * 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillRect(s * 0.56, -s * 0.47, s * 0.28, Math.max(1.2, s * 0.06));
    ctx.restore();
  }

  /* ---------- loop + controls ---------- */
  let last = 0, raf = 0, acc = 0; const FIX = 1 / 120;
  function frame(now) {
    raf = 0; const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (!paused) { acc += dt * speed; let n = 0; while (acc >= FIX && n++ < 40) { step(FIX); acc -= FIX; } }   // fixed 120 Hz story ticks
    draw(); if (running) raf = requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() { (visible && !document.hidden && (!reduce || userStarted)) ? start() : stop(); }
  function syncButtons() { root.querySelectorAll('[data-scen]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scen === scen))); }
  const pb = $('[data-act="pause"]'), ff = $('[data-act="ff"]');
  const setPause = (p) => { paused = p; if (pb) { pb.textContent = p ? '▶ Play' : '❚❚ Pause'; pb.setAttribute('aria-pressed', String(p)); } };
  root.querySelectorAll('[data-scen]').forEach(b => b.addEventListener('click', () => { scen = b.dataset.scen; autoAlt = false; syncButtons(); reset(); userStarted = true; setPause(false); sync(); }));
  if (pb) pb.addEventListener('click', () => { userStarted = true; setPause(!paused); sync(); });
  if (ff) ff.addEventListener('click', () => { speed = speed === 1 ? 4 : 1; ff.setAttribute('aria-pressed', String(speed > 1)); ff.textContent = speed > 1 ? '⏩ 4× on' : '⏩ Fast-forward'; if (!running) draw(); });

  palette(); resize(); reset(); draw(); syncButtons(); setPause(false);
  if (ff) ff.textContent = '⏩ Fast-forward';
  if (reduce) setPause(true);
  new ResizeObserver(() => { resize(); draw(); }).observe(wrap);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(wrap);
  document.addEventListener('visibilitychange', sync);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette(); buildBg(); draw(); });
  window.__pond = { jump(t, sc) { if (sc) { scen = sc; autoAlt = false; } reset(); while (T < t) step(1 / 30); draw(); }, state: () => tads.map(t => [t.role, t.state, Math.round(t.x), Math.round(t.y)]),
    minSep(sc) { scen = sc; autoAlt = false; reset(); let m = 1e9, at = ''; while (T < ENDT[sc] - 0.1) { step(1 / 30); const sw = T < 32 ? [] : tads.filter(t => !["egg", "dead"].includes(t.state) && t.fade > 0.05); for (let i = 0; i < sw.length; i++) for (let j = i + 1; j < sw.length; j++) { const d = Math.hypot(sw[i].x - sw[j].x, sw[i].y - sw[j].y); if (d < m) { m = d; at = T + ' ' + sw[i].role + sw[i].state + '/' + sw[j].role + sw[j].state; } } } return [Math.round(m), at]; } };
})();
