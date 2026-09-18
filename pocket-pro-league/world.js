/* Pocket Pro League — walkable open world: town, house (two floors), shopping centre (two floors), training ground, stadium */
(function (root) {
  'use strict';
  const SP = root.PPL_SPRITES, CT = root.PPL_CONTROLS;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const R = (x, y, w, h, c) => ({ x, y, w, h, c });

  // ---- map definitions ----
  // door: walk in to travel. hot: walk up and press ENTER. solid furniture blocks movement.
  const MAPS = {
    town: { w: 980, h: 560, view: 300, floor: 'grass', outside: true, npcs: 7,
      walls: [], solids: [R(60, 60, 150, 110), R(300, 40, 200, 120), R(40, 320, 220, 150), R(420, 280, 260, 200), R(740, 60, 180, 100)],
      decor: m => m.town(),
      doors: [
        { x: 120, y: 168, w: 30, h: 14, to: 'house1', spawn: { x: 170, y: 250 }, label: 'HOME' },
        { x: 385, y: 158, w: 30, h: 14, to: 'shop1', spawn: { x: 200, y: 270 }, label: 'SHOPPING CENTER' },
        { x: 135, y: 308, w: 30, h: 14, to: 'training', spawn: { x: 200, y: 60 }, label: 'TRAINING GROUND' },
        { x: 535, y: 268, w: 30, h: 14, to: 'stadium', spawn: { x: 180, y: 60 }, label: 'STADIUM' },
        { x: 815, y: 158, w: 30, h: 14, to: 'agent', spawn: { x: 150, y: 220 }, label: "AGENT'S OFFICE" } ],
      hots: [ { x: 720, y: 330, w: 200, h: 150, label: 'Park kickabout', action: 'kickabout', hint: 'costs 20 energy, chance of +1 attribute' },
              { x: 610, y: 190, w: 40, h: 40, label: 'Bus stop', action: 'bus', hint: 'ride to the stadium' } ] },
    house1: { w: 360, h: 300, view: 230, floor: 'wood', title: 'Home · ground floor',
      walls: [R(0, 0, 360, 14), R(0, 0, 10, 300), R(350, 0, 10, 300), R(0, 286, 360, 14), R(180, 14, 10, 120)],
      solids: [R(30, 30, 80, 40), R(30, 200, 60, 30), R(230, 30, 100, 26), R(300, 100, 40, 70), R(230, 200, 60, 60)],
      furniture: [
        { r: R(30, 30, 80, 40), c: '#3a3f58', label: 'TV', hot: { label: 'Watch the football on TV', action: 'open:table', hint: 'league tables and results' } },
        { r: R(30, 90, 80, 30), c: '#7c5cff', label: 'SOFA', hot: { label: 'Sofa', action: 'perk:nap', hint: 'nap: +10 energy, once a week' } },
        { r: R(30, 200, 60, 30), c: '#c9a86a', label: 'TROPHIES', hot: { label: 'Trophy cabinet', action: 'open:career', hint: 'career and attributes' } },
        { r: R(230, 30, 100, 26), c: '#dfe4ea', label: 'KITCHEN', hot: { label: 'Fridge', action: 'perk:snack', hint: 'snack: +6 energy, once a week' } },
        { r: R(300, 100, 40, 70), c: '#8a6d3b', label: 'STAIRS', hot: { label: 'Go upstairs', action: 'map:house2:60:250' } },
        { r: R(230, 200, 60, 60), c: '#5a5a5a', label: 'GARAGE', hot: { label: 'Garage door', action: 'open:garage', hint: 'your cars' } },
        { r: R(120, 240, 40, 12), c: '#6b4a2b', label: '', hot: null } ],
      doors: [ { x: 150, y: 286, w: 40, h: 14, to: 'town', spawn: { x: 135, y: 200 }, label: 'FRONT DOOR' } ] },
    house2: { w: 360, h: 300, view: 230, floor: 'carpet', title: 'Home · upstairs',
      walls: [R(0, 0, 360, 14), R(0, 0, 10, 300), R(350, 0, 10, 300), R(0, 286, 360, 14), R(170, 120, 10, 180)],
      solids: [R(30, 30, 90, 60), R(200, 30, 60, 40), R(280, 30, 60, 60), R(40, 220, 60, 40), R(40, 230, 40, 60)],
      furniture: [
        { r: R(30, 30, 90, 60), c: '#4c6ef5', label: 'BED', hot: { label: 'Bed', action: 'perk:sleep', hint: 'sleep: +15 energy, once a week' } },
        { r: R(200, 30, 60, 40), c: '#c9a86a', label: 'DESK', hot: { label: 'Laptop', action: 'open:contract', hint: 'contract and estate' } },
        { r: R(280, 30, 60, 60), c: '#e9edf7', label: 'MIRROR', hot: { label: 'Mirror', action: 'open:mirror', hint: 'change your appearance' } },
        { r: R(40, 220, 60, 40), c: '#8a6d3b', label: 'STAIRS', hot: { label: 'Go downstairs', action: 'map:house1:300:180' } },
        { r: R(220, 200, 100, 70), c: '#2d6fb5', label: 'BALCONY', hot: { label: 'Balcony', action: 'perk:balcony', hint: 'look out over the stadium' } } ],
      doors: [] },
    shop1: { w: 420, h: 320, view: 240, floor: 'tile', title: 'Shopping Center · ground floor', npcs: 3,
      walls: [R(0, 0, 420, 14), R(0, 0, 10, 320), R(410, 0, 10, 320), R(0, 306, 420, 14)],
      solids: [R(30, 30, 110, 40), R(280, 30, 110, 40), R(30, 200, 90, 50), R(340, 180, 50, 90)],
      furniture: [
        { r: R(30, 30, 110, 40), c: '#ff8a5c', label: 'BOOTS', hot: { label: 'Boot wall', action: 'open:shop:boots', hint: 'buy boots' } },
        { r: R(280, 30, 110, 40), c: '#d9603a', label: 'OUTFITS', hot: { label: 'Outfit rail', action: 'open:shop:outfits', hint: 'raise your charm' } },
        { r: R(30, 200, 90, 50), c: '#6b4a2b', label: 'CAFÉ', hot: { label: 'Café counter', action: 'perk:coffee', hint: 'coffee: $25 for +6 energy' } },
        { r: R(340, 180, 50, 90), c: '#8f8f8f', label: 'ESCALATOR', hot: { label: 'Escalator up', action: 'map:shop2:330:250' } } ],
      doors: [ { x: 180, y: 306, w: 50, h: 14, to: 'town', spawn: { x: 400, y: 190 }, label: 'EXIT' } ] },
    shop2: { w: 420, h: 320, view: 240, floor: 'tile', title: 'Shopping Center · upstairs', npcs: 2,
      walls: [R(0, 0, 420, 14), R(0, 0, 10, 320), R(410, 0, 10, 320), R(0, 306, 420, 14)],
      solids: [R(30, 30, 120, 40), R(240, 30, 150, 60), R(30, 200, 100, 50), R(340, 180, 50, 90), R(180, 220, 60, 40)],
      furniture: [
        { r: R(30, 30, 120, 40), c: '#3fbf6b', label: 'FITNESS', hot: { label: 'Fitness gear', action: 'open:shop:gear', hint: 'training and energy boosts' } },
        { r: R(240, 30, 150, 60), c: '#63b3ff', label: 'SHOWROOM', hot: { label: 'Car showroom', action: 'open:garage', hint: 'buy a car' } },
        { r: R(30, 200, 100, 50), c: '#f3c34f', label: 'ESTATE AGENT', hot: { label: 'Estate agent', action: 'open:estate', hint: 'buy a property' } },
        { r: R(180, 220, 60, 40), c: '#c0392b', label: 'BARBER', hot: { label: 'Barber', action: 'open:mirror', hint: 'new look' } },
        { r: R(340, 180, 50, 90), c: '#8f8f8f', label: 'ESCALATOR', hot: { label: 'Escalator down', action: 'map:shop1:300:250' } } ],
      doors: [] },
    training: { w: 520, h: 420, view: 260, floor: 'grass', title: 'Training Ground', npcs: 0, mates: true,
      walls: [R(0, 0, 520, 12), R(0, 0, 10, 420), R(510, 0, 10, 420), R(0, 408, 520, 12)],
      solids: [R(30, 40, 120, 70), R(360, 40, 130, 70), R(360, 300, 130, 80)],
      furniture: [
        { r: R(30, 40, 120, 70), c: '#3a3f58', label: 'GYM', hot: { label: 'Gym', action: 'open:training', hint: 'spend energy on attributes' } },
        { r: R(360, 40, 130, 70), c: '#c9a86a', label: "COACH'S OFFICE", hot: { label: "Coach's office", action: 'perk:coach', hint: 'a word with the coach, once a week' } },
        { r: R(360, 300, 130, 80), c: '#dfe4ea', label: 'PHYSIO', hot: { label: 'Physio room', action: 'perk:physio', hint: 'treatment: +10 energy, once a week' } },
        { r: R(60, 180, 240, 200), c: '#2f8f45', label: 'PITCH', pitch: true, hot: { label: 'Training pitch', action: 'open:training', hint: 'drills with the squad' } } ],
      doors: [ { x: 180, y: 12, w: 40, h: 12, to: 'town', spawn: { x: 150, y: 296 }, label: 'GATE' } ] },
    stadium: { w: 480, h: 360, view: 250, floor: 'concrete', title: 'Stadium · tunnel', mates: true,
      walls: [R(0, 0, 480, 12), R(0, 0, 10, 360), R(470, 0, 10, 360), R(0, 348, 480, 12), R(240, 120, 10, 130)],
      solids: [R(30, 200, 180, 40), R(300, 40, 150, 60), R(300, 260, 150, 60)],
      furniture: [
        { r: R(30, 200, 180, 40), c: '#7c5cff', label: 'DRESSING ROOM', hot: { label: 'Dressing room', action: 'open:squad', hint: 'the squad' } },
        { r: R(300, 40, 150, 60), c: '#f3c34f', label: 'PRESS ROOM', hot: { label: 'Press conference', action: 'perk:press', hint: 'talk to the media, once a week' } },
        { r: R(300, 260, 150, 60), c: '#c9a86a', label: 'TROPHY ROOM', hot: { label: 'Trophy room', action: 'open:career' } },
        { r: R(30, 300, 180, 40), c: '#2f8f45', label: 'TUNNEL → PITCH', hot: { label: 'Walk out to the pitch', action: 'open:stadium', hint: 'match day' } } ],
      doors: [ { x: 160, y: 12, w: 50, h: 12, to: 'town', spawn: { x: 550, y: 256 }, label: 'EXIT' } ] },
    agent: { w: 300, h: 260, view: 220, floor: 'carpet', title: "Agent's office",
      walls: [R(0, 0, 300, 14), R(0, 0, 10, 260), R(290, 0, 10, 260), R(0, 246, 300, 14)],
      solids: [R(90, 40, 120, 50)],
      furniture: [ { r: R(90, 40, 120, 50), c: '#c9a86a', label: 'DESK', hot: { label: 'Talk to your agent', action: 'open:contract', hint: 'contract, transfer window timing' } } ],
      doors: [ { x: 130, y: 246, w: 40, h: 14, to: 'town', spawn: { x: 830, y: 190 }, label: 'EXIT' } ] },
  };

  function start(opts) {
    const host = opts.host; host.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'town-stage';
    stage.innerHTML = `<canvas id="town-canvas"></canvas><div class="arc-hud town-hud"><span id="town-title">${opts.title || ''}</span><span class="arc-clock">${opts.sub || ''}</span><button type="button" class="arc-exit" id="town-menu">☰ MENU</button></div><div class="town-prompt" id="town-prompt" hidden></div><div class="arc-banner town-note" id="town-note" hidden></div>`;
    host.appendChild(stage);
    const noteEl = stage.querySelector('#town-note'); let noteT = 0;
    function note(txt, ms) { noteEl.textContent = txt; noteEl.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { noteEl.hidden = true; }, ms || 2600); }
    const canvas = stage.querySelector('#town-canvas'), ctx = canvas.getContext('2d'), prompt = stage.querySelector('#town-prompt'), titleEl = stage.querySelector('#town-title');
    stage.querySelector('#town-menu').onclick = () => { if (opts.onMenu) opts.onMenu(); };
    const ctl = CT.create(stage, { buttons: [{ id: 'shoot', label: 'ENTER', hint: 'use / go' }] });
    let map = MAPS[opts.spawn && opts.spawn.map] || MAPS.town;
    const me = { x: opts.spawn ? opts.spawn.x : 260, y: opts.spawn ? opts.spawn.y : 240, fx: 0, fy: 1, step: 0, moving: false };
    const cam = { x: me.x, y: me.y };
    let npcs = [], near = null, alive = true, raf = 0, last = performance.now(), crowdT = 0, transition = 0, doorLock = true;
    const carColor = ['#8a8a8a', '#c0392b', '#2c3e50', '#111', '#f1c40f', '#e67e22', '#9b59b6'][opts.carIdx || 0];
    function spawnNpcs() {
      npcs = [];
      const n = (map.npcs || 0) + (map.outside && opts.fame >= 50 ? 5 : 0);
      for (let i = 0; i < n; i++) npcs.push({ x: 40 + Math.random() * (map.w - 80), y: map.outside ? 190 + Math.random() * 120 : 40 + Math.random() * (map.h - 80), look: SP.randomLook(), kit: { shirt: `hsl(${Math.floor(Math.random() * 360)} 45% 45%)`, shorts: '#2b2b2b' }, tx: 0, ty: 0, wait: Math.random() * 2, step: 0, fan: map.outside && opts.fame >= 50 && i >= (map.npcs || 0), done: false });
      if (map.mates && opts.teammates) opts.teammates.slice(0, 6).forEach((t, i) => npcs.push({ x: 60 + i * 60, y: map.id === 'training' ? 250 : 160, look: t.look || SP.randomLook(), kit: opts.kit, tx: 0, ty: 0, wait: 1 + Math.random() * 3, step: 0, mate: true, name: t.last }));
    }
    function setMap(id, x, y) { map = MAPS[id]; map.id = id; me.x = x; me.y = y; cam.x = x; cam.y = y; spawnNpcs(); transition = 0.35; doorLock = true; titleEl.textContent = map.title || opts.title || ''; if (opts.onMap) opts.onMap(id); }
    map.id = Object.keys(MAPS).find(k => MAPS[k] === map); spawnNpcs(); titleEl.textContent = map.title || opts.title || '';
    function resize() { const w = stage.clientWidth || window.innerWidth; const h = stage.clientHeight || window.innerHeight; const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
    window.addEventListener('resize', resize); resize();
    const inRect = (x, y, r, pad) => x > r.x - (pad || 0) && x < r.x + r.w + (pad || 0) && y > r.y - (pad || 0) && y < r.y + r.h + (pad || 0);
    function blocked(x, y) { return (map.walls || []).some(r => inRect(x, y, r, 4)) || (map.solids || []).some(r => inRect(x, y, r, 5)); }
    function act() {
      if (!near) return;
      if (near.door) { const d = near.door; if (d.to) { setMap(d.to, d.spawn.x, d.spawn.y); } return; }
      const a = near.hot.action;
      if (a.startsWith('map:')) { const [, id, x, y] = a.split(':'); setMap(id, +x, +y); return; }
      opts.onAction && opts.onAction(a, near.hot);
    }
    ctl.onUp(id => { if (id === 'shoot') act(); });
    prompt.onclick = act;
    function update(dt) {
      transition = Math.max(0, transition - dt);
      const s = ctl.state; const sp = 95;
      if (s.active && transition <= 0) { const mag = Math.hypot(s.x, s.y) || 1; const k = Math.min(1, mag / 0.55); const nx = me.x + s.x / mag * k * sp * dt, ny = me.y + s.y / mag * k * sp * dt; const stuck = blocked(me.x, me.y); if (stuck || !blocked(nx, me.y)) me.x = nx; if (stuck || !blocked(me.x, ny)) me.y = ny; me.fx = s.x; me.fy = s.y; me.step += dt * 14; me.moving = true; } else me.moving = false;
      me.x = clamp(me.x, 8, map.w - 8); me.y = clamp(me.y, 16, map.h - 6);
      // doors: walking in travels
      near = null;
      let onDoor = false;
      for (const d of map.doors || []) { if (inRect(me.x, me.y, d, 10)) { onDoor = true; if (d.to && me.moving && !doorLock) { setMap(d.to, d.spawn.x, d.spawn.y); return; } near = { door: d, label: d.label }; } }
      if (!onDoor) doorLock = false;
      if (!near) for (const f of map.furniture || []) { if (f.hot && inRect(me.x, me.y, f.r, 16)) { near = { hot: f.hot, label: f.hot.label }; break; } }
      if (!near) for (const h of map.hots || []) { if (inRect(me.x, me.y, h, 6)) { near = { hot: h, label: h.label }; break; } }
      prompt.hidden = !near; if (near) prompt.textContent = `ENTER · ${near.label}${near.hot && near.hot.hint ? ' — ' + near.hot.hint : ''}`;
      for (const p of npcs) {
        if (p.fan && !p.done && opts.fame >= 50) {
          const d = Math.hypot(me.x - p.x, me.y - p.y);
          if (d < 200) { p.tx = me.x + (p.x > me.x ? 18 : -18); p.ty = me.y + 8; if (d < 26) { crowdT += dt; if (crowdT > 1.2 && !opts.crowded) { opts.crowded = true; npcs.forEach(q => { q.done = true; }); opts.onCrowd && opts.onCrowd(); } } }
        }
        p.wait -= dt;
        if (p.wait <= 0 && !(p.fan && !p.done && Math.hypot(me.x - p.x, me.y - p.y) < 200)) { for (let t = 0; t < 6; t++) { const tx = 30 + Math.random() * (map.w - 60), ty = map.outside ? 180 + Math.random() * 130 : 30 + Math.random() * (map.h - 60); if (!blocked(tx, ty)) { p.tx = tx; p.ty = ty; break; } } p.wait = 2 + Math.random() * 4; }
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        if (d > 3) { const v = (p.fan && !p.done ? 110 : 40) * dt; const nx = p.x + dx / d * Math.min(v, d), ny = p.y + dy / d * Math.min(v, d); if (!blocked(nx, ny)) { p.x = nx; p.y = ny; p.step += dt * 12; p.moving = true; } else { p.wait = 0; p.moving = false; } } else p.moving = false;
      }
    }
    // ---- drawing helpers ----
    const label = (t, x, y, c) => { ctx.fillStyle = c || '#111'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText(t, x, y); };
    const drawFloor = (cx, cy, vw, vh) => {
      const x0 = cx - vw / 2 - 4, y0 = cy - vh / 2 - 4;
      if (map.floor === 'grass') { ctx.fillStyle = '#4d9a52'; ctx.fillRect(x0, y0, vw + 8, vh + 8); }
      else if (map.floor === 'wood') { ctx.fillStyle = '#b98b5a'; ctx.fillRect(0, 0, map.w, map.h); ctx.fillStyle = '#a97a4b'; for (let y = 0; y < map.h; y += 16) ctx.fillRect(0, y, map.w, 2); }
      else if (map.floor === 'carpet') { ctx.fillStyle = '#6d5a8e'; ctx.fillRect(0, 0, map.w, map.h); ctx.fillStyle = '#63527f'; for (let y = 0; y < map.h; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < map.w; x += 12) ctx.fillRect(x, y, 6, 6); }
      else if (map.floor === 'tile') { ctx.fillStyle = '#d9dde3'; ctx.fillRect(0, 0, map.w, map.h); ctx.fillStyle = '#c4c9d1'; for (let y = 0; y < map.h; y += 24) for (let x = (y / 24) % 2 ? 24 : 0; x < map.w; x += 48) ctx.fillRect(x, y, 24, 24); }
      else { ctx.fillStyle = '#7d8590'; ctx.fillRect(0, 0, map.w, map.h); ctx.fillStyle = '#6e7580'; for (let x = 0; x < map.w; x += 30) ctx.fillRect(x, 0, 2, map.h); }
      if (!map.outside) { ctx.fillStyle = '#0a0a12'; ctx.fillRect(x0, y0, vw + 8, vh + 8); if (map.floor === 'wood') { ctx.fillStyle = '#b98b5a'; ctx.fillRect(0, 0, map.w, map.h); ctx.fillStyle = '#a97a4b'; for (let y = 0; y < map.h; y += 16) ctx.fillRect(0, y, map.w, 2); } else if (map.floor === 'carpet') { ctx.fillStyle = '#6d5a8e'; ctx.fillRect(0, 0, map.w, map.h); ctx.fillStyle = '#63527f'; for (let y = 0; y < map.h; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < map.w; x += 12) ctx.fillRect(x, y, 6, 6); } else if (map.floor === 'tile') { ctx.fillStyle = '#d9dde3'; ctx.fillRect(0, 0, map.w, map.h); ctx.fillStyle = '#c4c9d1'; for (let y = 0; y < map.h; y += 24) for (let x = (y / 24) % 2 ? 24 : 0; x < map.w; x += 48) ctx.fillRect(x, y, 24, 24); } else if (map.floor === 'grass') { ctx.fillStyle = '#4d9a52'; ctx.fillRect(0, 0, map.w, map.h); } else { ctx.fillStyle = '#7d8590'; ctx.fillRect(0, 0, map.w, map.h); ctx.fillStyle = '#6e7580'; for (let x = 0; x < map.w; x += 30) ctx.fillRect(x, 0, 2, map.h); } }
    };
    const helpers = { town() {
      const W = map.w;
      ctx.fillStyle = '#6b6b6b'; ctx.fillRect(0, 180, W, 120); ctx.fillStyle = '#f2d16b'; for (let x = 0; x < W; x += 40) ctx.fillRect(x, 238, 22, 4);
      ctx.fillStyle = '#8f8f8f'; ctx.fillRect(0, 176, W, 4); ctx.fillRect(0, 300, W, 4);
      ctx.fillStyle = '#3b7d3f'; for (let i = 0; i < 60; i++) { const tx = ((i * 173) % (W + 400)) - 200, ty = ((i * 97) % (map.h + 500)) - 250; if (tx > -60 && tx < W + 60 && ty > -60 && ty < map.h + 60 && !(ty > 170 && ty < 310)) continue; ctx.beginPath(); ctx.arc(tx, ty, 14, 0, Math.PI * 2); ctx.fill(); }
      const B = [ { label: 'HOME', x: 60, y: 60, w: 150, h: 110, color: '#7c5cff', roof: '#5b3fd6' }, { label: 'SHOPPING CENTER', x: 300, y: 40, w: 200, h: 120, color: '#ff8a5c', roof: '#d9603a' },
        { label: 'TRAINING GROUND', x: 40, y: 320, w: 220, h: 150, color: '#3fbf6b', roof: '#2a8a4a' }, { label: 'STADIUM', x: 420, y: 280, w: 260, h: 200, color: '#63b3ff', roof: '#2d6fb5' }, { label: "AGENT'S OFFICE", x: 740, y: 60, w: 180, h: 100, color: '#c9a86a', roof: '#8a6d3b' } ];
      ctx.fillStyle = '#b9a77a'; for (const d of map.doors) { const dy = d.y < 200 ? [d.y + 12, 176] : [304, d.y]; ctx.fillRect(d.x + d.w / 2 - 12, Math.min(dy[0], dy[1]), 24, Math.abs(dy[1] - dy[0])); }
      for (const b of B) {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h); ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = b.roof; ctx.fillRect(b.x - 6, b.y - 14, b.w + 12, 20);
        ctx.fillStyle = '#ffe9a8'; for (let wx = b.x + 14; wx < b.x + b.w - 20; wx += 30) for (let wy = b.y + 18; wy < b.y + b.h - 30; wy += 30) ctx.fillRect(wx, wy, 14, 14);
        label(b.label, b.x + b.w / 2, b.y - 20);
        if (b.label === 'STADIUM') { ctx.fillStyle = '#2f8f45'; ctx.fillRect(b.x + 30, b.y + 30, b.w - 60, b.h - 60); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 36, b.y + 36, b.w - 72, b.h - 72); }
        if (b.label === 'HOME') { ctx.fillStyle = carColor; ctx.fillRect(b.x + b.w + 14, b.y + 70, 44, 22); ctx.fillStyle = '#9ad'; ctx.fillRect(b.x + b.w + 22, b.y + 74, 24, 8); ctx.fillStyle = '#111'; ctx.fillRect(b.x + b.w + 18, b.y + 90, 8, 6); ctx.fillRect(b.x + b.w + 46, b.y + 90, 8, 6); }
        if (b.label === 'TRAINING GROUND') { ctx.fillStyle = '#ff7f27'; for (let i = 0; i < 5; i++) ctx.fillRect(b.x + 30 + i * 35, b.y + 100, 6, 10); }
      }
      for (const d of map.doors) { ctx.fillStyle = '#2b1d0e'; ctx.fillRect(d.x, d.y < 200 ? d.y - 14 : d.y, d.w, 26); }
      // park with a small pitch, bus stop
      const p = map.hots[0]; ctx.fillStyle = '#3f9f4a'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.strokeRect(p.x + 10, p.y + 10, p.w - 20, p.h - 20); ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, p.y + 10); ctx.lineTo(p.x + p.w / 2, p.y + p.h - 10); ctx.stroke(); label('PARK', p.x + p.w / 2, p.y - 6);
      const bs = map.hots[1]; ctx.fillStyle = '#2c3e50'; ctx.fillRect(bs.x, bs.y - 30, bs.w, 8); ctx.fillRect(bs.x + 4, bs.y - 30, 4, 40); ctx.fillRect(bs.x + bs.w - 8, bs.y - 30, 4, 40); ctx.fillStyle = '#f3c34f'; ctx.fillRect(bs.x + 10, bs.y - 22, 20, 12); label('BUS', bs.x + 20, bs.y - 34);
    } };
    function draw() {
      // outside: fit the view width. Inside: zoom so the room fills the screen height, capped so figures stay sane
      const z = map.outside ? Math.min(canvas.width / map.view, canvas.height / (map.view * 1.05)) : Math.min(canvas.width / 170, Math.max(canvas.width / map.view, canvas.height / (map.h + 24)));
      const vw = canvas.width / z, vh = canvas.height / z;
      cam.x += (me.x - cam.x) * 0.15; cam.y += (me.y - cam.y) * 0.15;
      const cx = vw >= map.w ? map.w / 2 : clamp(cam.x, vw / 2, map.w - vw / 2), cy = vh >= map.h ? map.h / 2 : clamp(cam.y, vh / 2, map.h - vh / 2);
      ctx.setTransform(z, 0, 0, z, canvas.width / 2 - cx * z, canvas.height / 2 - cy * z); ctx.imageSmoothingEnabled = false;
      drawFloor(cx, cy, vw, vh);
      if (map.decor) map.decor(helpers);
      for (const w of map.walls || []) { ctx.fillStyle = '#2b2f45'; ctx.fillRect(w.x, w.y, w.w, w.h); }
      for (const f of map.furniture || []) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(f.r.x + 3, f.r.y + 3, f.r.w, f.r.h); ctx.fillStyle = f.c; ctx.fillRect(f.r.x, f.r.y, f.r.w, f.r.h); if (f.pitch) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(f.r.x + 8, f.r.y + 8, f.r.w - 16, f.r.h - 16); } if (f.label) label(f.label, f.r.x + f.r.w / 2, f.r.y + f.r.h / 2 + 3, f.c === '#e9edf7' || f.c === '#dfe4ea' ? '#333' : '#fff'); }
      for (const d of map.doors || []) { if (!map.outside) { ctx.fillStyle = '#2b1d0e'; ctx.fillRect(d.x, d.y, d.w, d.h); label(d.label, d.x + d.w / 2, d.y - 4, '#fff'); } }
      if (near) { const r = near.door || (near.hot && (near.hot.x !== undefined ? near.hot : null)); const f = !r && (map.furniture || []).find(f => f.hot === near.hot); const rr = r || (f && f.r); if (rr) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.strokeRect(rr.x - 3, rr.y - 3, rr.w + 6, rr.h + 6); } }
      const items = npcs.map(p => ({ y: p.y, f: () => { SP.drawFigure(ctx, p.x, p.y, 1.1, p.look, p.kit, { step: p.moving ? p.step : 0 }); if (p.mate) label(p.name, p.x, p.y - 30, '#fff'); } }));
      items.push({ y: me.y, f: () => { SP.drawFigure(ctx, me.x, me.y, 1.15, opts.look, opts.kit, { step: me.moving ? me.step : 0, acc: opts.acc }); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(me.x - 4, me.y - 30); ctx.lineTo(me.x + 4, me.y - 30); ctx.lineTo(me.x, me.y - 25); ctx.closePath(); ctx.fill(); } });
      items.sort((a, b) => a.y - b.y).forEach(i => i.f());
      if (map.outside && opts.fame >= 50) { ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; npcs.filter(p => p.fan && !p.done && Math.hypot(me.x - p.x, me.y - p.y) < 200).forEach(p => ctx.fillText('!', p.x, p.y - 30)); }
      if (transition > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(0,0,0,${transition / 0.35})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    }
    function frame(now) { if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); if (alive) draw(); raf = requestAnimationFrame(frame); }
    raf = requestAnimationFrame(frame);
    return { destroy() { alive = false; cancelAnimationFrame(raf); ctl.destroy(); window.removeEventListener('resize', resize); host.innerHTML = ''; }, pos: () => ({ map: map.id, x: me.x, y: me.y }), goto: (id, x, y) => setMap(id, x, y), note, setSub: t => { stage.querySelector('.town-hud .arc-clock').textContent = t; } };
  }
  root.PPL_TOWN = { start, MAPS };
})(typeof window !== 'undefined' ? window : globalThis);
