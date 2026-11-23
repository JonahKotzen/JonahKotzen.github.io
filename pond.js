/* Tank 01: a monsoon pond, told as a short scripted story with two endings.
   Everything is driven by the story clock (no random wandering), so it plays the same way every time.
   Opening: dry basin → storm fills the pond → a male calls, a female picks him, they amplex in the rain and
   lay lots of eggs → shrimp hatch and algae grows → tadpoles hatch; shrimp-eaters turn carnivore, algae-eaters omnivore.
   Fast-drying pond: carnivores metamorphose and get out; omnivores die as the pond dries.
   Long-lasting pond: few shrimp, pond shrinks then floods; carnivores starve; omnivores make it out. */
(function () {
  const wrap = document.getElementById('pond');
  if (!wrap) return;
  const cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
  const root = wrap.closest('.pond-sec') || wrap, $ = (s) => root.querySelector(s);
  const capEl = $('.pond-cap'), stepEl = $('.pond-step');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t), win = (t, a, b) => ease((t - a) / (b - a));
  const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
  const mix = (h1, h2, t) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const ch = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, clamp(t, 0, 1))).toString(16).padStart(2, '0'); return '#' + ch(16) + ch(8) + ch(0); };
  // fixed pseudo-random numbers so every run looks the same
  const R = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  let W = 0, H = 0, SC = 1, S0 = 0, depth = 0, dark = false, P = {};
  let running = false, visible = false, paused = false, userStarted = false, speed = 1;
  let scen = 'dry', autoAlt = true, T = 0, clock = 0, lastW = -1;
  let cysts = [], tufts = [], props = [], specks = [], drops = [], eggs = [], tads = [], shrimp = [], fx = [];
  const END = 80;

  const STAGES = {
    common: [[0, 'Dry season: fairy shrimp eggs and spadefoot toads wait under the dry pond bed.'],
             [5, 'A monsoon storm rolls in and fills the pond.'],
             [9, 'A male spadefoot swims out and calls.'],
             [13, 'A female picks him, and he clasps her in amplexus.'],
             [18, 'In the rain, she lays a big clutch of eggs on sticks and the pond bottom.'],
             [24, 'Fairy shrimp hatch out of the mud, and algae coats the rocks, sticks and bottom.'],
             [30, 'The eggs hatch. Same clutch, same pond.'],
             [35, 'Tadpoles that eat shrimp become carnivores; those that graze algae become omnivores.']],
    dry: [[47, 'No more rain. The pond dries fast.'],
          [53, 'Carnivores develop faster: legs, then out of the water as the tail is reabsorbed.'],
          [64, 'The pond is gone. The slower omnivores die; the carnivores made it out.'],
          [73, 'Fast-drying ponds favor carnivores.']],
    wet: [[45, 'This pond had fewer shrimp, and they are running out as the water shrinks.'],
          [49, 'A second storm floods the pond even higher.'],
          [54, 'With no shrimp left, the carnivores starve. Omnivores keep grazing.'],
          [63, 'In a long-lasting pond, the omnivores develop and walk out.'],
          [73, 'Long-lasting ponds favor omnivores.']]
  };

  function palette() {
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [236, 238, 231];
    dark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) < 110;
    P = dark ? { waterTop: 'rgba(52,86,96,0.80)', waterBot: 'rgba(24,44,44,0.95)', surface: 'rgba(160,200,210,0.55)', mud1: '#3B2F22', mud2: '#2E251B', mud3: '#251E16', land: '#4A3B2A', algae: '#5E8F3E', cloud: '#3A4248', rain: 'rgba(170,200,220,0.45)', rock: '#5B5A55', stick: '#5A4632', crack: 'rgba(0,0,0,0.35)', speck: 'rgba(210,220,200,0.15)', ink: '#E6EAE3' }
      : { waterTop: 'rgba(150,192,196,0.62)', waterBot: 'rgba(96,132,118,0.78)', surface: 'rgba(255,255,255,0.85)', mud1: '#C9A878', mud2: '#B38F60', mud3: '#9C794E', land: '#D8BD8E', algae: '#4F8A35', cloud: '#6F7780', rain: 'rgba(70,100,130,0.4)', rock: '#8E8A80', stick: '#7A5C3E', crack: 'rgba(90,60,30,0.45)', speck: 'rgba(60,70,50,0.2)', ink: '#18201D' };
  }

  /* ---------- geometry ---------- */
  function floorY(x) {
    const u = Math.min(1, Math.abs((x - W / 2) / (W / 2))), lip = 22 * SC;
    if (u < 0.5) return S0 + lip + (depth - lip) * (1 - Math.pow(u / 0.5, 2.2));
    if (u < 0.8) return S0 + lip * (1 - (u - 0.5) / 0.3);
    return S0 - ((u - 0.8) / 0.2) * H * 0.16;
  }
  let level = 0;
  const wy = () => S0 + (1 - level) * (depth + 4);
  const edgeX = (side, d = 0) => { let x = W / 2; while (floorY(x) > wy() + d && x > 2 && x < W - 2) x += side * 2; return x; };

  function resize() {
    const r = wrap.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(cv.getBoundingClientRect().height);
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    SC = W < 600 ? 0.75 : clamp(W / 1150, 0.72, 1.1);
    S0 = H * 0.32; depth = H * 0.58;
    if (W === lastW) return; lastW = W;
    cysts = Array.from({ length: 24 }, (_, i) => ({ x: W * (0.28 + 0.44 * i / 23), d: 6 + 20 * R(i) }));
    tufts = []; for (let i = 0, x = W * 0.27; x < W * 0.73; x += 16 * SC, i++) tufts.push({ x, sway: R(i + 50) * TAU });
    props = [{ k: 'rock', x: W * 0.36, r: 18 * SC }, { k: 'rock', x: W * 0.62, r: 14 * SC }, { k: 'stick', x: W * 0.46, len: 70 * SC, a: -0.3 }, { k: 'stick', x: W * 0.55, len: 46 * SC, a: 0.35 }];
    specks = Array.from({ length: Math.round(W / 16) }, (_, i) => ({ x: W * (0.2 + 0.6 * R(i + 90)), y: S0 + (H - S0) * R(i + 190), r: 0.6 + R(i + 290) }));
  }

  /* ---------- cast ---------- */
  function reset() {
    T = 0; drops = []; fx = []; eggs = [];
    // eggs: a big clutch in clumps on the sticks and bottom
    for (let i = 0; i < 46; i++) { const cl = i % 4, cx = W * [0.42, 0.47, 0.52, 0.56][cl] + (R(i) - 0.5) * 26 * SC, t = 19 + i * 0.1; eggs.push({ x: cx, dy: 6 + R(i + 7) * 14, t, done: false }); }
    // 8 tadpoles with fixed lanes: carnivores mid-water, omnivores near the bottom
    tads = Array.from({ length: 8 }, (_, i) => {
      const carn = i % 2 === 0, j = Math.floor(i / 2);
      return { i, role: carn ? 'carn' : 'omni', home: W * [0.37, 0.45, 0.53, 0.61][j] + (carn ? 0 : 12 * SC), band: carn ? 0.38 + 0.12 * (j % 2) : 0.8,
        ph: R(i + 400) * TAU, x: 0, y: 0, fs: 1, pitch: 0, c: 0.45, dev: 0, state: 'egg', k: 0, fade: 1, dead: 0, gape: 0, side: j < 2 ? -1 : 1, mx: 0 };
    });
    shrimp = Array.from({ length: 12 }, (_, i) => ({ i, ph: R(i + 600) * TAU, hx: W * (0.34 + 0.32 * R(i + 700)), hy: 0.15 + 0.5 * R(i + 800), born: 24 + i * 0.35, eatenAt: 1e9, alive: true, x: 0, y: 0, fs: 1 }));
    // feeding schedule: each carnivore gets shrimp in turn; the long-lasting pond only has 5
    const carns = tads.filter(t => t.role === 'carn'), n = scen === 'dry' ? 12 : 5;
    shrimp.forEach((s, i) => { if (i >= n) s.never = true; else { s.by = carns[i % 4]; s.eatAt = 37 + Math.floor(i / 4) * 4 + (i % 4) * 0.9; } });
    lastStage = -1; setCaption();
  }

  /* ---------- the story clock ---------- */
  const D = () => scen === 'dry';
  function script(dt) {
    T += dt; clock += dt;
    // water
    if (T < 5) level = 0; else if (T < 13) level = win(T, 5, 12);
    else if (D()) level = 1 - win(T, 47, 65);
    else level = 1 - 0.3 * win(T, 40, 48) + 0.42 * win(T, 48, 55);
    // rain (first storm lasts through the amplexus)
    const storm = T > 5 && T < 23 ? 1 : !D() && T > 48 && T < 55 ? 1 : 0;
    if (storm) for (let i = 0; i < Math.round(5 * speed); i++) drops.push({ x: cloudX() + (Math.random() - 0.5) * 230 * SC, y: H * 0.13, v: 420 });
    drops.forEach(d => d.y += d.v * dt); drops = drops.filter(d => d.y < Math.min(floorY(d.x), wy()));
    // shrimp
    shrimp.forEach(s => {
      if (s.never || !s.alive) return;
      const top = wy() + 10, bot = (y) => floorY(y) - 8;
      const tx = s.hx + Math.sin(clock * 0.35 + s.ph) * 40 * SC, depthFrac = s.hy + Math.sin(clock * 0.5 + s.ph) * 0.06;
      let x = tx, y = lerp(top, bot(tx), depthFrac);
      if (T < s.born + 1.5) y = lerp(floorY(x) - 4, y, win(T, s.born, s.born + 1.5));
      if (s.by && T > s.eatAt - 1.3 && s.by.state === 'swim') { const m = mouthOf(s.by), u = win(T, s.eatAt - 1.3, s.eatAt); x = lerp(x, m.x, u); y = lerp(y, m.y, u); }
      const vx = x - s.x; if (Math.abs(vx) > 0.05) s.face = vx > 0 ? 1 : -1; s.fs = damp(s.fs, s.face || 1, 6, dt);
      s.x = x; s.y = y;
      if (s.by && T >= s.eatAt && s.by.state === 'swim') { s.alive = false; fx.push({ x, y, t: 0 }); }
      if (!D() && T > 48 && s.alive) s.fadeOut = (s.fadeOut || 1) - dt * 0.4; if (s.fadeOut <= 0) s.alive = false;
    });
    tads.forEach(t => tad(t, dt));
    fx.forEach(f => f.t += dt); fx = fx.filter(f => f.t < 0.8);
    if (T > END) { if (autoAlt) scen = D() ? 'wet' : 'dry'; syncButtons(); reset(); }
    setCaption();
  }
  function cloudX() {
    if (T < 25) return lerp(-W * 0.25, W * 0.5, win(T, 3, 7)) + W * 0.9 * win(T, 22, 25);
    if (!D() && T > 45 && T < 58) return lerp(-W * 0.25, W * 0.5, win(T, 45, 48.5)) + W * 0.9 * win(T, 54, 57);
    return -9999;
  }

  /* ---------- the frogs: call, choose, amplex, lay, leave ---------- */
  function frogs() {
    if (T < 8 || T > 27) return null;
    const male = { s: 18 * SC }, fem = { s: 24 * SC }, mxs = W * 0.36, top = wy() + 6 * SC;
    // male: hops from the left bank into the water and floats at the surface, calling
    if (T < 10) { const u = win(T, 8, 10), x0 = W * 0.05; male.x = lerp(x0, mxs, u); male.y = Math.min(floorY(male.x) - 10 * SC, top) - Math.sin(u * Math.PI) * 26 * SC; male.d = 1; }
    else { male.x = mxs; male.y = top; male.d = 1; }
    male.call = T > 10 && T < 16 ? 0.5 + 0.5 * Math.sin(clock * 9) : 0;
    // female: hops in from the right and swims over to him
    if (T < 13) { fem.x = W * 1.1; fem.y = top; }
    else if (T < 16) { const u = win(T, 13, 16), x0 = W * 0.95; fem.x = lerp(x0, mxs + 8 * SC, u); fem.y = Math.min(floorY(fem.x) - 12 * SC, top + 4 * SC) - (u < 0.3 ? Math.sin(u / 0.3 * Math.PI) * 26 * SC : 0); }
    else fem.x = mxs + 8 * SC;
    fem.d = -1;
    // amplexus: he climbs on; they swim down to the sticks, lay, and swim off to the left
    let px = fem.x, py = top + 4 * SC, d = -1;
    if (T >= 16) {
      if (T < 19) { const u = win(T, 16.5, 19); px = lerp(mxs + 8 * SC, W * 0.47, u); py = lerp(top + 4 * SC, floorY(W * 0.47) - 30 * SC, u); d = 1; }
      else if (T < 23.6) { const u = (T - 19) / 4.6; px = lerp(W * 0.42, W * 0.57, u); py = floorY(px) - 30 * SC; d = 1; }
      else { const u = win(T, 23.6, 27); px = lerp(W * 0.57, W * 0.05, u); py = Math.min(floorY(px) - 14 * SC, lerp(floorY(W * 0.57) - 30 * SC, top, Math.min(1, u * 2))); d = -1; }
      return { pair: true, x: px, y: py, d, a: 1 - win(T, 26, 27), call: 0 };
    }
    return { pair: false, male, fem };
  }

  /* ---------- tadpoles: scripted lanes, no collisions ---------- */
  const sizeOf = (t) => (5 + 10 * win(T, 30, 46)) * (0.82 + 0.4 * t.c) * SC;
  const mouthOf = (t) => { const s = sizeOf(t); return { x: t.x + Math.sign(t.fs || 1) * s * 1.0, y: t.y + s * lerp(0.45, 0.22, t.c) }; };
  function laneY(t) { const top = wy() + sizeOf(t) * 1.2, bot = floorY(t.x) - sizeOf(t) * 0.9; return Math.max(top, Math.min(bot, lerp(top, bot, t.band))); }
  function tad(t, dt) {
    const dry = D(), s = sizeOf(t);
    if (t.state === 'egg') { if (T > 30 + t.i * 0.2) { const e = eggs[t.i * 5]; t.state = 'swim'; t.x = e.x; t.y = floorY(e.x) - e.dy * SC; t.ex = t.x; t.ey = t.y; } else return; }
    const diverge = win(T, 35, 46);
    t.c = t.role === 'carn' ? lerp(0.45, 1, diverge) : lerp(0.45, 0.05, diverge);
    t.dev = dry ? (t.role === 'carn' ? win(T, 42, 55) : 0.5 * win(T, 42, 64)) : (t.role === 'carn' ? 0.4 * win(T, 42, 52) : win(T, 46, 63));
    const starving = !dry && t.role === 'carn' ? win(T, 54, 61) : 0;

    if (t.state === 'swim') {
      // patrol back and forth in its own lane
      const sweep = 0.035 * W, w = 0.32 + 0.04 * (t.i % 3), arg = clock * w + t.ph;
      let x = t.home + Math.sin(arg) * sweep * (1 - 0.7 * starving);
      let y = laneY({ ...t, x }) + Math.sin(clock * 0.9 + t.ph) * 4 * SC;
      if (t.role === 'carn' && starving > 0) y = lerp(y, floorY(x) - s * 0.9, starving);
      const intro = win(T, 30 + t.i * 0.2, 34 + t.i * 0.2); x = lerp(t.ex, x, intro); y = lerp(t.ey, y, intro);
      const vx = x - t.x; if (Math.abs(vx) > 0.02) t.face = vx > 0 ? 1 : -1;
      t.fs = damp(t.fs, t.face || 1, 5, dt); t.pitch = damp(t.pitch, t.role === 'omni' && diverge > 0.3 ? 0.35 : clamp((y - t.y) / Math.max(1e-3, Math.abs(vx) + 0.5), -0.4, 0.4), 4, dt);
      t.x = x; t.y = y;
      t.gape = 0;
      if (t.role === 'omni' && diverge > 0.2) t.gape = 0.5 + 0.5 * Math.sin(clock * 28 + t.ph);
      if (t.role === 'carn') shrimp.forEach(sh => { if (sh.by === t && sh.alive && T > sh.eatAt - 1.3) t.gape = Math.max(t.gape, win(T, sh.eatAt - 1.3, sh.eatAt - 0.2)); });
      if (starving >= 1) { t.state = 'dead'; t.dead = 0; }
      else if (t.dev > 0.9) { t.state = 'meta'; t.k0 = T; t.mx0 = t.x; t.my0 = t.y; }
      else if (dry && level < 0.04) { t.state = 'dead'; t.dead = 0; t.onMud = true; }
    } else if (t.state === 'meta') { // swim to the shallows on its side of the pond
      const u = win(T, t.k0, t.k0 + 3), ex = edgeX(t.side, s * 1.2);
      t.x = lerp(t.mx0, ex, u); t.y = lerp(t.my0, wy() + s * 0.6, u); t.face = t.side; t.fs = damp(t.fs, t.side, 5, dt); t.pitch = damp(t.pitch, 0, 4, dt);
      if (u >= 1) { t.state = 'emerge'; t.k0 = T; t.ex0 = t.x; }
    } else if (t.state === 'emerge') { // crawl up the beach while the tail is reabsorbed
      t.k = win(T, t.k0, t.k0 + 6); t.x = lerp(t.ex0, edgeX(t.side, -8 * SC), ease(t.k)); t.y = floorY(t.x) - s * 0.55;
      if (t.k >= 1) { t.state = 'hop'; t.k0 = T; t.hx0 = t.x; }
    } else if (t.state === 'hop') {
      const u = (T - t.k0) / 3; t.x = t.hx0 + t.side * u * W * 0.25; t.y = floorY(clamp(t.x, 0, W)) - s * 0.45 - Math.abs(Math.sin(u * Math.PI * 4)) * 12 * SC;
      if (u > 1) t.fade = 0;
    } else if (t.state === 'dead') { // belly up, sinking or lying on the mud, then fading
      t.dead += dt; t.y = damp(t.y, floorY(t.x) - s * 0.5, 1.2, dt); t.pitch = damp(t.pitch, 0, 2, dt);
      t.fade = Math.max(0, 1 - Math.max(0, t.dead - 6) / 3);
    }
  }

  let lastStage = -1;
  function setCaption() {
    const list = STAGES.common.concat(STAGES[D() ? 'dry' : 'wet']); let idx = 0; list.forEach((s, i) => { if (T >= s[0]) idx = i; });
    if (idx !== lastStage) { lastStage = idx; if (capEl) capEl.textContent = list[idx][1]; if (stepEl) stepEl.textContent = `${D() ? 'Fast-drying pond' : 'Long-lasting pond'} · ${idx + 1}/${list.length}`; }
  }

  /* ---------- drawing ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const y0 = wy();
    if (level > 0.005) {
      const g = ctx.createLinearGradient(0, y0, 0, S0 + depth); g.addColorStop(0, P.waterTop); g.addColorStop(1, P.waterBot);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, y0); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y0 + Math.sin(x * 0.03 + clock * 1.2) * 1.2); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
      ctx.fillStyle = P.speck; specks.forEach(p => { if (p.y > y0 + 2 && p.y < floorY(p.x)) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); } });
    }
    [[0, P.mud1], [14, P.mud2], [38, P.mud3]].forEach(([off, col]) => { ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, floorY(x) + off * SC + (off ? Math.sin(x * 0.02 + off) * 3 : 0)); ctx.lineTo(W, H); ctx.fillStyle = col; ctx.fill(); });
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, y0 + 1); ctx.clip(); ctx.fillStyle = P.land; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, floorY(x)); ctx.lineTo(W, H); ctx.fill(); ctx.restore();
    if (level < 0.3) { ctx.strokeStyle = P.crack; ctx.lineWidth = 1; ctx.globalAlpha = 1 - level / 0.3; for (let x = W * 0.3; x < W * 0.7; x += 26 * SC) { const y = floorY(x); ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + 6 * SC, y + 8 * SC); ctx.lineTo(x + 2 * SC, y + 15 * SC); ctx.stroke(); } ctx.globalAlpha = 1; }
    // waiting underground in the dry season
    if (T < 10) {
      ctx.fillStyle = dark ? 'rgba(230,200,160,0.5)' : 'rgba(120,80,40,0.55)'; cysts.forEach(c => { ctx.beginPath(); ctx.arc(c.x, floorY(c.x) + c.d * SC, 1.6 * SC, 0, TAU); ctx.fill(); });
      ctx.globalAlpha = 1 - win(T, 7, 8.5);
      [[0.05, 28, 18], [0.93, 30, 24]].forEach(([fx, d, r], i) => { const x = W * fx, y = floorY(x) + d * SC; ctx.fillStyle = dark ? 'rgba(0,0,0,0.3)' : 'rgba(90,60,30,0.3)'; ctx.beginPath(); ctx.ellipse(x, y - 3 * SC, r * SC * 1.5, r * SC * 0.9, 0, 0, TAU); ctx.fill(); drawToad(x, y, r * SC, i ? -1 : 1, 0); });
      ctx.globalAlpha = 1;
    } else if (T < 26) { ctx.fillStyle = dark ? 'rgba(230,200,160,0.5)' : 'rgba(120,80,40,0.55)'; ctx.globalAlpha = 1 - win(T, 24, 26); cysts.forEach(c => { ctx.beginPath(); ctx.arc(c.x, floorY(c.x) + c.d * SC, 1.6 * SC, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1; }
    // rocks, sticks, algae
    const algae = T < 24 ? 0 : D() ? clamp(win(T, 24, 32) - 0.6 * win(T, 53, 65), 0, 1) : win(T, 24, 32);
    props.forEach(p => {
      const y = floorY(p.x);
      if (p.k === 'rock') { ctx.fillStyle = P.rock; ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.3, p.r, 0, Math.PI, TAU); ctx.fill(); if (algae > 0) { ctx.strokeStyle = P.algae; ctx.globalAlpha = algae; ctx.lineWidth = 4 * SC; ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.3, p.r, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.globalAlpha = 1; } }
      else { ctx.save(); ctx.translate(p.x, y - 4); ctx.rotate(p.a); ctx.fillStyle = P.stick; ctx.fillRect(-p.len / 2, -3 * SC, p.len, 6 * SC); if (algae > 0) { ctx.fillStyle = P.algae; ctx.globalAlpha = algae; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-p.len / 2 + (i + 0.5) * p.len / 6, -4 * SC, 3 * SC, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; } ctx.restore(); }
    });
    if (algae > 0) { ctx.strokeStyle = P.algae; ctx.lineWidth = 1.4 * SC; ctx.lineCap = 'round'; tufts.forEach(f => { const y = floorY(f.x), h = 12 * SC * algae; for (let i = -1; i <= 1; i++) { const sw = Math.sin(clock * 1.2 + f.sway + i) * 2 * SC; ctx.beginPath(); ctx.moveTo(f.x + i * 2.5 * SC, y + 1); ctx.quadraticCurveTo(f.x + i * 3 * SC + sw * 0.5, y - h * 0.5, f.x + i * 3.5 * SC + sw, y - h * (i ? 0.8 : 1)); ctx.stroke(); } }); }
    // eggs
    eggs.forEach(e => { if (T >= e.t) { const a = win(T, e.t, e.t + 0.4) * (1 - win(T, 30, 32)); if (a > 0) drawEgg(e, a); } });
    // animals
    tads.filter(t => t.state !== 'egg' && t.c < 0.5).forEach(drawTad);
    shrimp.forEach(s => { if (!s.never && s.alive && T > s.born) drawShrimp(s); });
    tads.filter(t => t.state !== 'egg' && t.c >= 0.5).forEach(drawTad);
    const f = frogs();
    if (f) { ctx.globalAlpha = f.a === undefined ? 1 : f.a;
      if (f.pair) { drawToad(f.x, f.y, 24 * SC, f.d, 0); drawToad(f.x - f.d * 5 * SC, f.y - 16 * SC, 18 * SC, f.d, 0); }
      else { drawToad(f.male.x, f.male.y, f.male.s, f.male.d, f.male.call); if (f.fem.x < W) drawToad(f.fem.x, f.fem.y, f.fem.s, f.fem.d, 0); }
      ctx.globalAlpha = 1; }
    fx.forEach(e => { const k = e.t / 0.8; ctx.strokeStyle = `rgba(217,112,63,${1 - k})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, 4 + k * 14, 0, TAU); ctx.stroke(); });
    if (level > 0.005) { ctx.strokeStyle = P.surface; ctx.lineWidth = 1.5; ctx.beginPath(); let st = false; for (let x = 0; x <= W; x += 8) { const y = y0 + Math.sin(x * 0.03 + clock * 1.2) * 1.2; if (floorY(x) > y) { st ? ctx.lineTo(x, y) : ctx.moveTo(x, y); st = true; } } ctx.stroke(); }
    ctx.strokeStyle = P.rain; ctx.lineWidth = 1; drops.forEach(d => { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + 9); ctx.stroke(); });
    const cx = cloudX(); if (cx > -9000) { ctx.fillStyle = P.cloud; [[0, 0, 60], [-55, 10, 42], [55, 8, 46], [-100, 22, 30], [100, 22, 32], [0, 24, 50]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx * SC, H * 0.08 + dy * SC, r * SC, 0, TAU); ctx.fill(); }); }
  }

  function drawEgg(e, a) {
    const r = 5 * SC * a, y = floorY(e.x) - e.dy * SC; if (r <= 0.2) return;
    ctx.fillStyle = dark ? 'rgba(200,220,230,0.25)' : 'rgba(255,255,255,0.6)'; ctx.strokeStyle = dark ? 'rgba(200,220,230,0.5)' : 'rgba(90,110,130,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(e.x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(e.x, y, r * (0.35 + 0.25 * win(T, 22, 29)), 0, TAU); ctx.fill();
  }

  function xEye(x, y, r) { ctx.strokeStyle = '#D22B2B'; ctx.lineWidth = Math.max(1.5, r * 0.5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); }

  function drawTad(t) {
    if (t.fade <= 0) return;
    if (t.state === 'emerge' || t.state === 'hop') return drawFroglet(t);
    const s = sizeOf(t), c = t.c, dead = t.state === 'dead', starve = !D() && t.role === 'carn' ? win(T, 54, 61) : 0;
    ctx.save(); ctx.globalAlpha = t.fade; ctx.translate(t.x, t.y);
    const f = t.fs; ctx.scale(Math.abs(f) < 0.15 ? Math.sign(f || 1) * 0.15 : f, dead ? -1 : 1); ctx.rotate(t.pitch);
    let body = mix(mix('#8D8A4E', '#D9703F', c), '#A39E92', Math.max(starve * 0.8, dead ? 0.6 : 0));
    const line = c > 0.5 ? '#7A3A1E' : '#4C4A2A', swim = dead ? 0 : 1;
    const N = 12, L = s * lerp(2.6, 2.2, c), amp = s * 0.38 * swim, pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([-s * 0.7 - L * u, Math.sin(clock * 8 + t.ph - u * 5.5) * amp * Math.pow(u, 1.3)]); }
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
    if (dead) xEye(s * 0.45, -s * 0.3, Math.max(3, s * 0.24));
    else { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.3, s * 0.12, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.48, -s * 0.34, s * 0.04, 0, TAU); ctx.fill(); }
    const mx = s * lerp(0.8, 0.97, c), my = s * lerp(0.55, 0.22, c), g = t.gape;
    ctx.fillStyle = '#2A0F08'; ctx.beginPath(); ctx.ellipse(mx, my, s * (0.08 + 0.14 * g * (0.4 + c)), s * (0.04 + 0.16 * g * (0.4 + c)), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#151515'; ctx.lineWidth = 1 + 1.2 * c; ctx.beginPath(); const bw = s * (0.12 + 0.06 * c), notch = s * 0.1 * c, by = my - s * (0.05 + 0.14 * g);
    ctx.moveTo(mx - bw, by); ctx.lineTo(mx, by + notch); ctx.lineTo(mx + bw * 0.8, by - notch * 0.6); ctx.stroke();
    const rows = Math.round(lerp(5, 1, c)); ctx.strokeStyle = 'rgba(30,25,15,0.7)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < rows; i++) { ctx.beginPath(); ctx.moveTo(mx - s * 0.2, my + s * (0.1 + i * 0.055)); ctx.lineTo(mx + s * 0.1, my + s * (0.14 + i * 0.055)); ctx.stroke(); }
    ctx.restore();
  }

  function drawFroglet(t) { // the same animal, tail shrinking, body turning into a toad; kept level on the beach
    const k = t.state === 'hop' ? 1 : t.k, s = sizeOf(t) * lerp(1, 0.72, k), body = mix(mix('#8D8A4E', '#D9703F', t.c), '#7B8A55', k);
    ctx.save(); ctx.globalAlpha = t.fade; ctx.translate(t.x, t.y); ctx.scale(t.side, 1);
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
    const L = lerp(8, 22, win(T, s.born, s.born + 6)) * SC, col = '#E59A6C', ph = clock * 14 + s.ph;
    ctx.save(); ctx.globalAlpha = s.fadeOut === undefined ? 1 : Math.max(0, s.fadeOut); ctx.translate(s.x, s.y); ctx.scale(Math.abs(s.fs) < 0.15 ? Math.sign(s.fs || 1) * 0.15 : s.fs, 1);
    ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = L * 0.11; ctx.beginPath(); ctx.moveTo(-L * 0.1, 0); ctx.quadraticCurveTo(-L * 0.55, Math.sin(ph * 0.5) * 2, -L * 0.85, Math.sin(ph * 0.5) * 3); ctx.stroke();
    ctx.strokeStyle = '#C2462B'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, -L * 0.1); ctx.moveTo(-L * 0.85, 0); ctx.lineTo(-L * 1.05, L * 0.08); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(L * 0.18, 0, L * 0.34, L * 0.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = dark ? 'rgba(255,200,170,0.85)' : 'rgba(200,110,70,0.9)'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) { const x = L * (0.44 - i * 0.065), a = -Math.PI / 2 + Math.sin(ph - i * 0.65) * 0.55 - 0.25; ctx.beginPath(); ctx.moveTo(x, -L * 0.06); ctx.lineTo(x + Math.cos(a) * L * 0.17, -L * 0.06 + Math.sin(a) * L * 0.17); ctx.stroke(); }
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.64, L * 0.09, L * 0.055, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawToad(x, y, s, dir, call) {
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
    if (call > 0) { // inflated vocal sac + call arcs
      ctx.fillStyle = 'rgba(235,225,190,0.9)'; ctx.beginPath(); ctx.arc(s * 0.85, s * 0.15, s * (0.2 + 0.35 * call), 0, TAU); ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(230,234,227,0.6)' : 'rgba(24,32,29,0.5)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) { const r = s * (1.3 + i * 0.45 + call * 0.3); ctx.globalAlpha = 0.7 - i * 0.2; ctx.beginPath(); ctx.arc(s * 0.85, -s * 0.1, r, -0.6, 0.4); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#7B8A55'; ctx.strokeStyle = '#3E4A2A'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 1.2, s * 0.75, 0, Math.PI, TAU); ctx.lineTo(s * 1.2, 0); ctx.quadraticCurveTo(0, s * 0.35, -s * 1.2, 0); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5F6E40'; ctx.beginPath(); ctx.ellipse(-s * 0.3, s * 0.05, s * 0.55, s * 0.35, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#C9A227'; ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.45, s * 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.fillRect(s * 0.56, -s * 0.47, s * 0.28, Math.max(1.2, s * 0.06));
    ctx.restore();
  }

  /* ---------- loop + controls ---------- */
  let last = 0, raf = 0;
  function frame(now) { raf = 0; const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; if (!paused) script(dt * speed); draw(); if (running) raf = requestAnimationFrame(frame); }
  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync() { (visible && !document.hidden && (!reduce || userStarted)) ? start() : stop(); }
  function syncButtons() { root.querySelectorAll('[data-scen]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scen === scen))); }
  const pb = $('[data-act="pause"]'), ff = $('[data-act="ff"]');
  root.querySelectorAll('[data-scen]').forEach(b => b.addEventListener('click', () => { scen = b.dataset.scen; autoAlt = false; syncButtons(); reset(); userStarted = true; paused = false; if (pb) { pb.textContent = 'Pause'; pb.setAttribute('aria-pressed', 'false'); } sync(); }));
  if (pb) pb.addEventListener('click', () => { if (reduce && !userStarted) { userStarted = true; paused = false; } else paused = !paused; pb.textContent = paused ? 'Play' : 'Pause'; pb.setAttribute('aria-pressed', String(paused)); sync(); });
  if (ff) ff.addEventListener('click', () => { speed = speed === 1 ? 3 : 1; ff.setAttribute('aria-pressed', String(speed > 1)); ff.textContent = speed > 1 ? 'Fast-forward 3×' : 'Fast-forward'; });

  palette(); resize(); reset(); draw(); syncButtons();
  if (reduce && pb) { pb.textContent = 'Play'; pb.setAttribute('aria-pressed', 'true'); }
  new ResizeObserver(() => { resize(); if (!running) draw(); }).observe(wrap);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(wrap);
  document.addEventListener('visibilitychange', sync);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { palette(); if (!running) draw(); });
  window.__pond = { jump(t, sc) { if (sc) { scen = sc; autoAlt = false; } reset(); while (T < t) script(1 / 30); draw(); } };
})();
