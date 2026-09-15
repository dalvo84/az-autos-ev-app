/* Pocket Pro League — walkable town hub (open world) */
(function (root) {
  'use strict';
  const SP = root.PPL_SPRITES, CT = root.PPL_CONTROLS;
  const W = 720, H = 520;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BUILDINGS = [
    { id: 'home', label: 'HOME', x: 60, y: 60, w: 150, h: 110, color: '#7c5cff', roof: '#5b3fd6', door: { x: 135, y: 170 } },
    { id: 'shop', label: 'SHOPPING CENTER', x: 300, y: 40, w: 200, h: 120, color: '#ff8a5c', roof: '#d9603a', door: { x: 400, y: 160 } },
    { id: 'training', label: 'TRAINING GROUND', x: 40, y: 320, w: 220, h: 150, color: '#3fbf6b', roof: '#2a8a4a', door: { x: 150, y: 320 } },
    { id: 'stadium', label: 'STADIUM', x: 420, y: 280, w: 260, h: 200, color: '#63b3ff', roof: '#2d6fb5', door: { x: 550, y: 280 } },
  ];
  function start(opts) {
    const host = opts.host; host.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'town-stage';
    stage.innerHTML = `<canvas id="town-canvas"></canvas><div class="town-prompt" id="town-prompt" hidden></div>`;
    host.appendChild(stage);
    const canvas = stage.querySelector('#town-canvas'), ctx = canvas.getContext('2d'), prompt = stage.querySelector('#town-prompt');
    const ctl = CT.create(stage, { buttons: [{ id: 'shoot', label: 'ENTER', hint: 'at a door' }] });
    const me = { x: opts.spawn ? opts.spawn.x : 260, y: opts.spawn ? opts.spawn.y : 240, fx: 0, fy: 1, step: 0, vx: 0, vy: 0 };
    const npcs = [];
    const n = 6 + (opts.fame >= 50 ? 5 : 0);
    for (let i = 0; i < n; i++) npcs.push({ x: 120 + Math.random() * 480, y: 190 + Math.random() * 120, look: SP.randomLook(), kit: { shirt: `hsl(${Math.floor(Math.random() * 360)} 45% 45%)`, shorts: '#2b2b2b' }, tx: 0, ty: 0, wait: Math.random() * 2, step: 0, fan: opts.fame >= 50 && i >= 6, done: false });
    let near = null, alive = true, raf = 0, last = performance.now(), crowdT = 0;
    const carColor = ['#8a8a8a', '#c0392b', '#2c3e50', '#111', '#f1c40f', '#e67e22', '#9b59b6'][opts.carIdx || 0];
    function resize() { const w = Math.min(stage.clientWidth, 760); const h = Math.round(w * H / W); const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
    window.addEventListener('resize', resize); resize();
    ctl.onUp(id => { if (id === 'shoot' && near) opts.onEnter(near.id); });
    prompt.onclick = () => { if (near) opts.onEnter(near.id); };
    function blocked(x, y) { return BUILDINGS.some(b => x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 2); }
    function update(dt) {
      const s = ctl.state; const sp = 150;
      if (s.active) { const nx = me.x + s.x * sp * dt, ny = me.y + s.y * sp * dt; if (!blocked(nx, me.y)) me.x = nx; if (!blocked(me.x, ny)) me.y = ny; me.fx = s.x; me.fy = s.y; me.step += dt * 14; me.vx = s.x; } else me.vx = 0;
      me.x = clamp(me.x, 10, W - 10); me.y = clamp(me.y, 20, H - 10);
      near = BUILDINGS.find(b => Math.hypot(me.x - b.door.x, me.y - b.door.y) < 34) || null;
      prompt.hidden = !near; if (near) prompt.textContent = `Enter ${near.label.toLowerCase()}`;
      for (const p of npcs) {
        if (p.fan && !p.done && opts.fame >= 50) {
          const d = Math.hypot(me.x - p.x, me.y - p.y);
          if (d < 200) { p.tx = me.x + (p.x > me.x ? 18 : -18); p.ty = me.y + 8; if (d < 26) { crowdT += dt; if (crowdT > 1.2 && !opts.crowded) { opts.crowded = true; npcs.forEach(q => { q.done = true; }); opts.onCrowd && opts.onCrowd(); } } }
        }
        p.wait -= dt;
        if (p.wait <= 0 && !(p.fan && !p.done && Math.hypot(me.x - p.x, me.y - p.y) < 200)) { p.tx = 100 + Math.random() * 520; p.ty = 180 + Math.random() * 130; p.wait = 2 + Math.random() * 4; }
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        if (d > 3) { const v = (p.fan && !p.done ? 150 : 60) * dt; const nx = p.x + dx / d * Math.min(v, d), ny = p.y + dy / d * Math.min(v, d); if (!blocked(nx, ny)) { p.x = nx; p.y = ny; p.step += dt * 12; p.moving = true; } } else p.moving = false;
      }
    }
    function draw() {
      const z = canvas.width / W; ctx.setTransform(z, 0, 0, z, 0, 0); ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#4d9a52'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#6b6b6b'; ctx.fillRect(0, 180, W, 120); ctx.fillStyle = '#f2d16b'; for (let x = 0; x < W; x += 40) ctx.fillRect(x, 238, 22, 4);
      ctx.fillStyle = '#8f8f8f'; ctx.fillRect(0, 176, W, 4); ctx.fillRect(0, 300, W, 4);
      // paths to doors
      ctx.fillStyle = '#b9a77a'; for (const b of BUILDINGS) { const dy = b.door.y < 200 ? [b.door.y, 176] : [304, b.door.y]; ctx.fillRect(b.door.x - 12, Math.min(dy[0], dy[1]), 24, Math.abs(dy[1] - dy[0])); }
      for (const b of BUILDINGS) {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);
        ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = b.roof; ctx.fillRect(b.x - 6, b.y - 14, b.w + 12, 20);
        ctx.fillStyle = '#ffe9a8'; for (let wx = b.x + 14; wx < b.x + b.w - 20; wx += 30) for (let wy = b.y + 18; wy < b.y + b.h - 30; wy += 30) ctx.fillRect(wx, wy, 14, 14);
        ctx.fillStyle = '#2b1d0e'; ctx.fillRect(b.door.x - 10, b.door.y - (b.door.y < 200 ? 26 : 0), 20, 26);
        ctx.fillStyle = '#111'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(b.label, b.x + b.w / 2, b.y - 20);
        if (b.id === 'stadium') { ctx.fillStyle = '#2f8f45'; ctx.fillRect(b.x + 30, b.y + 30, b.w - 60, b.h - 60); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 36, b.y + 36, b.w - 72, b.h - 72); }
        if (b.id === 'home') { ctx.fillStyle = carColor; ctx.fillRect(b.x + b.w + 14, b.y + 70, 44, 22); ctx.fillStyle = '#9ad'; ctx.fillRect(b.x + b.w + 22, b.y + 74, 24, 8); ctx.fillStyle = '#111'; ctx.fillRect(b.x + b.w + 18, b.y + 90, 8, 6); ctx.fillRect(b.x + b.w + 46, b.y + 90, 8, 6); }
        if (b.id === 'training') { ctx.fillStyle = '#ff7f27'; for (let i = 0; i < 5; i++) ctx.fillRect(b.x + 30 + i * 35, b.y + 100, 6, 10); }
      }
      if (near) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(near.door.x, near.door.y, 20 + Math.sin(performance.now() / 200) * 3, 0, Math.PI * 2); ctx.stroke(); }
      const items = npcs.map(p => ({ y: p.y, f: () => SP.drawFigure(ctx, p.x, p.y, 1.1, p.look, p.kit, { step: p.moving ? p.step : 0 }) }));
      items.push({ y: me.y, f: () => { SP.drawFigure(ctx, me.x, me.y, 1.15, opts.look, opts.kit, { step: me.vx || ctl.state.active ? me.step : 0 }); ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(me.x - 4, me.y - 30); ctx.lineTo(me.x + 4, me.y - 30); ctx.lineTo(me.x, me.y - 25); ctx.closePath(); ctx.fill(); } });
      items.sort((a, b) => a.y - b.y).forEach(i => i.f());
      if (opts.fame >= 50) { ctx.fillStyle = '#fff'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; npcs.filter(p => p.fan && !p.done && Math.hypot(me.x - p.x, me.y - p.y) < 200).forEach(p => ctx.fillText('!', p.x, p.y - 30)); }
    }
    function frame(now) { if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(); raf = requestAnimationFrame(frame); }
    raf = requestAnimationFrame(frame);
    return { destroy() { alive = false; cancelAnimationFrame(raf); ctl.destroy(); window.removeEventListener('resize', resize); host.innerHTML = ''; }, pos: () => ({ x: me.x, y: me.y }) };
  }
  root.PPL_TOWN = { start, BUILDINGS };
})(typeof window !== 'undefined' ? window : globalThis);
