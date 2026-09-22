/* Pocket Pro League — cutscenes: contract signing, trophy lift, awards gala, debut, man of the match */
(function (root) {
  'use strict';
  const SP = root.PPL_SPRITES;
  const rnd = Math.random;
  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

  // ---- engine ----
  // scene: { w, h, duration, bg(ctx, t, ctxInfo), actors: [{look, kit, opts, keys: [{t, x, y, pose?}], label?}], captions: [{t, who, text}], effects: {confetti, fireworks, flashes, spotlight}, banner: {t, text, sub}, props: [{t0, draw(ctx, t)}] }
  function play(host, scene, hooks) {
    hooks = hooks || {};
    host.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'cut-stage';
    stage.innerHTML = `<canvas id="cut-canvas"></canvas><div class="cut-caption" id="cut-caption" hidden><span class="who"></span><span class="what"></span></div><div class="arc-banner cut-banner" id="cut-banner" hidden></div><button type="button" class="cut-skip" id="cut-skip">SKIP ▶</button>`;
    host.appendChild(stage);
    const canvas = stage.querySelector('#cut-canvas'), ctx = canvas.getContext('2d');
    const cap = stage.querySelector('#cut-caption'), banner = stage.querySelector('#cut-banner');
    let alive = true, raf = 0, t = 0, last = performance.now(), capIdx = -1, bannerShown = false;
    const W = scene.w || 360, H = scene.h || 240, particles = [], flashes = [];
    function resize() { const w = stage.clientWidth || window.innerWidth, h = stage.clientHeight || window.innerHeight; const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
    window.addEventListener('resize', resize); resize();
    function burst(x, y, n, kind) { for (let i = 0; i < n; i++) { const ang = rnd() * Math.PI * 2, sp = 30 + rnd() * (kind === 'firework' ? 120 : 60); particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (kind === 'confetti' ? 40 : 10), life: 1.5 + rnd() * 1.5, c: ['#f3c34f', '#ff5a5a', '#63b3ff', '#4fd37f', '#ffffff', '#ff3cac'][i % 6], s: kind === 'firework' ? 1.6 : 2.4, kind }); } }
    const info = { W, H, burst, flashes };
    function end() { if (!alive) return; alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); host.innerHTML = ''; hooks.onDone && hooks.onDone(); }
    stage.querySelector('#cut-skip').onclick = end;
    function actorPos(a) {
      const keys = a.keys; if (!keys.length) return { x: 0, y: 0 };
      if (t <= keys[0].t) return keys[0];
      for (let i = 1; i < keys.length; i++) { if (t <= keys[i].t) { const k0 = keys[i - 1], k1 = keys[i]; const u = (t - k0.t) / Math.max(0.001, k1.t - k0.t); return { x: lerp(k0.x, k1.x, u), y: lerp(k0.y, k1.y, u), pose: k1.pose !== undefined ? (u > 0.98 ? k1.pose : k0.pose) : k0.pose, moving: k0.x !== k1.x || k0.y !== k1.y }; } }
      return keys[keys.length - 1];
    }
    function frame(now) {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // captions
      const c = scene.captions || [];
      let idx = -1; for (let i = 0; i < c.length; i++) if (t >= c[i].t) idx = i;
      if (idx !== capIdx) { capIdx = idx; if (idx >= 0) { cap.hidden = false; cap.querySelector('.who').textContent = c[idx].who; cap.querySelector('.what').textContent = c[idx].text; hooks.speak && hooks.speak(c[idx].who, c[idx].text); } }
      if (scene.banner && !bannerShown && t >= scene.banner.t) { bannerShown = true; banner.innerHTML = `<div>${scene.banner.text}</div>${scene.banner.sub ? `<small>${scene.banner.sub}</small>` : ''}`; banner.hidden = false; hooks.sfx && scene.banner.sfx && hooks.sfx(scene.banner.sfx); }
      // effects
      const fx = scene.effects || {};
      if (fx.confetti && t > (fx.from || 0) && rnd() < 0.5) burst(rnd() * W, -5, 3, 'confetti');
      if (fx.fireworks && t > (fx.from || 0) && rnd() < 0.08) { burst(40 + rnd() * (W - 80), 20 + rnd() * 60, 24, 'firework'); hooks.sfx && rnd() < 0.5 && hooks.sfx('ding'); }
      if (fx.flashes && t > (fx.from || 0) && rnd() < 0.12) flashes.push({ x: 20 + rnd() * (W - 40), y: 20 + rnd() * (H * 0.5), life: 0.12 });
      for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i]; q.life -= dt; if (q.life <= 0) { particles.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 'confetti' ? 40 : 25) * dt; q.vx *= 0.98; }
      for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].life -= dt; if (flashes[i].life <= 0) flashes.splice(i, 1); }
      // draw
      const portrait = canvas.height > canvas.width; const z = Math.min(canvas.width / (W * (portrait ? 0.76 : 1)), canvas.height / H); const ox = (canvas.width - W * z) / 2, oy = (canvas.height - H * z) / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(z, 0, 0, z, ox, oy); ctx.imageSmoothingEnabled = false;
      scene.bg(ctx, t, info);
      (scene.props || []).forEach(p => { if (t >= (p.t0 || 0)) p.draw(ctx, t); });
      const drawn = (scene.actors || []).map(a => ({ a, p: actorPos(a) })).sort((x, y) => x.p.y - y.p.y);
      for (const { a, p } of drawn) { SP.drawFigure(ctx, p.x, p.y, a.scale || 1.6, a.look, a.kit, Object.assign({}, a.opts || {}, { pose: p.pose || (a.opts && a.opts.pose), step: p.moving ? t * 14 : (p.pose === 'cheer' ? t * 12 : 0) })); if (a.label) { ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText(a.label, p.x, p.y - 34 * (a.scale || 1.6) / 1.6); } }
      (scene.front || []).forEach(p => { if (t >= (p.t0 || 0)) p.draw(ctx, t); });
      for (const q of particles) { ctx.fillStyle = q.c; ctx.globalAlpha = Math.min(1, q.life); ctx.fillRect(q.x, q.y, q.s, q.s); } ctx.globalAlpha = 1;
      for (const f of flashes) { ctx.fillStyle = `rgba(255,255,255,${f.life / 0.12 * 0.9})`; ctx.beginPath(); ctx.arc(f.x, f.y, 4, 0, Math.PI * 2); ctx.fill(); }
      if (fx.flashes && flashes.length > 2) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, 0, W, H); }
      if (t < 0.5) { ctx.fillStyle = `rgba(0,0,0,${1 - t * 2})`; ctx.fillRect(0, 0, W, H); }
      if (t > scene.duration - 0.6) { ctx.fillStyle = `rgba(0,0,0,${(t - scene.duration + 0.6) / 0.6})`; ctx.fillRect(0, 0, W, H); }
      if (t >= scene.duration) { end(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return { end };
  }

  // ---- backdrops ----
  const BG = {
    stadiumNight(ctx, t, i) {
      const { W, H } = i; ctx.fillStyle = '#0b1230'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; for (let k = 0; k < 40; k++) ctx.fillRect((k * 89) % W, (k * 53) % 70, 1, 1);
      // stand with crowd
      ctx.fillStyle = '#1c2340'; ctx.fillRect(0, 70, W, 70);
      for (let y = 78; y < 136; y += 8) for (let x = 4; x < W; x += 6) { ctx.fillStyle = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#2ecc71'][((x / 6 + y / 8) | 0) % 5]; if (((x * 7 + y * 3 + (t * 8 | 0)) % 11) < 8) ctx.fillRect(x, y + ((x + y) % 2 ? 0 : 1), 3, 4); }
      // floodlights
      for (const lx of [30, W - 30]) { ctx.fillStyle = '#9aa3b8'; ctx.fillRect(lx - 1, 20, 2, 50); ctx.fillStyle = '#ffe9a8'; ctx.fillRect(lx - 8, 14, 16, 7); }
      ctx.fillStyle = 'rgba(255,240,200,.05)'; ctx.beginPath(); ctx.moveTo(30, 20); ctx.lineTo(120, H); ctx.lineTo(-20, H); ctx.fill(); ctx.beginPath(); ctx.moveTo(W - 30, 20); ctx.lineTo(W + 20, H); ctx.lineTo(W - 120, H); ctx.fill();
      // pitch
      ctx.fillStyle = '#2f8f45'; ctx.fillRect(0, 140, W, H - 140); ctx.fillStyle = '#33984b'; for (let x = 0; x < W; x += 40) ctx.fillRect(x, 140, 20, H - 140);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.strokeRect(-10, 150, W + 20, H); ctx.beginPath(); ctx.moveTo(W / 2, 150); ctx.lineTo(W / 2, H); ctx.stroke();
    },
    boardroom(ctx, t, i) {
      const { W, H } = i; ctx.fillStyle = '#2b2f45'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#242838'; for (let x = 0; x < W; x += 24) ctx.fillRect(x, 0, 12, H * 0.62);
      ctx.fillStyle = '#4b3826'; ctx.fillRect(0, H * 0.62, W, H * 0.38); ctx.fillStyle = '#3f2f20'; for (let y = H * 0.62; y < H; y += 10) ctx.fillRect(0, y, W, 2);
      // crest, sponsor board
      ctx.fillStyle = '#1b1f2e'; ctx.fillRect(W / 2 - 90, 16, 180, 60);
      ctx.fillStyle = i.crest || '#c8102e'; ctx.fillRect(W / 2 - 16, 24, 32, 32); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText(i.initials || 'FC', W / 2, 46);
      ctx.fillStyle = '#9aa3b8'; ctx.font = '7px monospace'; ctx.fillText((i.clubName || 'CLUB').toUpperCase(), W / 2, 68);
      // table
      ctx.fillStyle = '#5a4634'; ctx.fillRect(W / 2 - 100, 150, 200, 40); ctx.fillStyle = '#6b5340'; ctx.fillRect(W / 2 - 100, 150, 200, 6);
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(W / 2 - 24, 156, 48, 30); ctx.fillStyle = '#333'; for (let y = 162; y < 182; y += 4) ctx.fillRect(W / 2 - 18, y, 36, 1);
      ctx.fillStyle = '#111'; ctx.fillRect(W / 2 + 28, 160, 3, 18); ctx.fillStyle = '#f3c34f'; ctx.fillRect(W / 2 + 28, 176, 3, 3);
    },
    gala(ctx, t, i) {
      const { W, H } = i; ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, W, H);
      // audience silhouettes
      ctx.fillStyle = '#12121e'; for (let y = H - 60; y < H; y += 12) for (let x = 0; x < W; x += 14) { ctx.beginPath(); ctx.arc(x + ((y / 12) % 2 ? 7 : 0), y + 6, 5, 0, Math.PI * 2); ctx.fill(); }
      // stage and steps
      ctx.fillStyle = '#2a1f3d'; ctx.fillRect(0, 120, W, 60); ctx.fillStyle = '#3b2b56'; ctx.fillRect(0, 120, W, 4);
      ctx.fillStyle = '#8e1f2f'; ctx.fillRect(W / 2 - 60, 124, 120, 56); // red carpet
      // curtain
      ctx.fillStyle = '#5a1020'; ctx.fillRect(0, 0, W, 120); ctx.fillStyle = '#6e1428'; for (let x = 0; x < W; x += 16) ctx.fillRect(x, 0, 8, 120);
      // spotlight
      const sx = W / 2 + Math.sin(t * 0.8) * 10;
      ctx.fillStyle = 'rgba(255,240,200,.16)'; ctx.beginPath(); ctx.moveTo(sx - 6, 0); ctx.lineTo(sx + 6, 0); ctx.lineTo(sx + 70, 180); ctx.lineTo(sx - 70, 180); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,.12)'; ctx.beginPath(); ctx.ellipse(sx, 176, 70, 8, 0, 0, Math.PI * 2); ctx.fill();
      // podium
      ctx.fillStyle = '#1d1d2e'; ctx.fillRect(W / 2 - 22, 130, 44, 44); ctx.fillStyle = '#f3c34f'; ctx.fillRect(W / 2 - 22, 130, 44, 3);
      ctx.fillStyle = '#f3c34f'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText(i.title || 'AWARDS', W / 2, 100);
    },
    tunnel(ctx, t, i) {
      const { W, H } = i; ctx.fillStyle = '#0d1018'; ctx.fillRect(0, 0, W, H);
      // corridor walls converging to light
      const g = ctx.createLinearGradient(0, 0, 0, H); ctx.fillStyle = '#1a2030'; ctx.fillRect(0, 0, W, 60); ctx.fillStyle = '#242c40'; ctx.fillRect(0, 60, W, H - 60);
      ctx.fillStyle = '#2f8f45'; ctx.fillRect(W / 2 - 60, 0, 120, 60); ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 60, 58, 120, 2);
      ctx.fillStyle = `rgba(255,255,220,${0.15 + Math.min(0.5, t * 0.05)})`; ctx.fillRect(W / 2 - 60, 0, 120, 60);
      ctx.fillStyle = '#9aa3b8'; for (let y = 70; y < H; y += 30) { ctx.fillRect(0, y, 30, 2); ctx.fillRect(W - 30, y, 30, 2); }
      ctx.fillStyle = '#f3c34f'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('PLAYERS TUNNEL', W / 2, 80);
    },
  };

  // ---- scene builders (all take data: {look, kit, acc, name, club, opp, mates, ...}) ----
  const suitKit = { shirt: '#23233a', shorts: '#1c1c24' };
  function ensureMates(d, n) { const out = []; for (let i = 0; i < n; i++) { const m = d.mates && d.mates[i]; out.push({ look: m && m.look ? m.look : SP.randomLook(), kit: d.kit }); } return out; }

  const SCENES = {
    contract(d) {
      const W = 360, H = 240;
      const chair = { look: SP.randomLook(), kit: suitKit }; chair.look.hair = 1; chair.look.beard = true;
      return { w: W, h: H, duration: 12, bg: (c, t, i) => BG.boardroom(c, t, Object.assign(i, { crest: d.kit.shirt, initials: (d.club || 'FC').split(' ').map(s => s[0]).join('').slice(0, 3).toUpperCase(), clubName: d.club })),
        actors: [
          { look: d.look, kit: d.kit, opts: { suit: true, tie: d.kit.shirt, acc: d.acc }, keys: [{ t: 0, x: -30, y: 175 }, { t: 2.5, x: W / 2 - 40, y: 175 }, { t: 6, x: W / 2 - 40, y: 175 }, { t: 7.5, x: W / 2 - 40, y: 175, pose: 'cheer' }, { t: 12, x: W / 2 - 40, y: 175, pose: 'cheer' }] },
          { look: chair.look, kit: suitKit, opts: { suit: true, tie: '#f3c34f' }, keys: [{ t: 0, x: W / 2 + 50, y: 178 }, { t: 12, x: W / 2 + 50, y: 178 }] },
          { look: SP.randomLook(), kit: { shirt: '#111', shorts: '#111' }, opts: { suit: true, tie: '#63b3ff' }, keys: [{ t: 0, x: 70, y: 215 }, { t: 12, x: 70, y: 215 }] } ],
        props: [ { t0: 0, draw: (c, t) => { c.fillStyle = '#e9edf7'; c.fillRect(W / 2 - 60, 200, 120, 14); c.fillStyle = '#111'; c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.fillText(`${(d.name || '').toUpperCase()} · ${d.role || ''}`.slice(0, 32), W / 2, 210); } } ],
        captions: [
          { t: 0.4, who: 'Chairman', text: `Welcome to ${d.club}. We have been watching you for a while.` },
          { t: 3.2, who: 'Agent', text: `${d.money} a week, ${d.weeks} weeks. ${d.role}. Read it, then sign it.` },
          { t: 6.2, who: d.name || 'You', text: 'Where do I sign?' },
          { t: 8, who: 'Ally', text: `Official, John. ${d.name} is a ${d.club} player.` },
          { t: 10, who: 'John', text: 'Now the hard part: earning the shirt.' } ],
        effects: { flashes: true, from: 6 },
        banner: { t: 7.6, text: 'SIGNED', sub: `${d.club} · ${d.money}/wk`, sfx: 'cash' } };
    },
    trophy(d) {
      const W = 360, H = 240; const mates = ensureMates(d, 8);
      const actors = mates.map((m, i) => ({ look: m.look, kit: d.kit, keys: [{ t: 0, x: 62 + i * 34, y: 215 }, { t: 5, x: 62 + i * 34, y: 215 }, { t: 6, x: 62 + i * 34, y: 215, pose: 'cheer' }, { t: 14, x: 62 + i * 34, y: 215, pose: 'cheer' }] }));
      actors.push({ look: d.look, kit: d.kit, opts: { acc: d.acc, number: 10 }, scale: 1.9, keys: [{ t: 0, x: W / 2, y: 260 }, { t: 3, x: W / 2, y: 190 }, { t: 5.5, x: W / 2, y: 190 }, { t: 6, x: W / 2, y: 190, pose: 'cheer' }, { t: 14, x: W / 2, y: 190, pose: 'cheer' }] });
      return { w: W, h: H, duration: 14, bg: BG.stadiumNight, actors,
        props: [ { t0: 0, draw: (c, t) => { c.fillStyle = '#1d1d2e'; c.fillRect(W / 2 - 60, 172, 120, 22); c.fillStyle = '#f3c34f'; c.fillRect(W / 2 - 60, 172, 120, 3); c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.fillStyle = '#f3c34f'; c.fillText((d.league || 'CHAMPIONS').toUpperCase(), W / 2, 186); } } ],
        front: [ { t0: 3.2, draw: (c, t) => { const lift = t < 6 ? 0 : Math.min(1, (t - 6) / 0.6); SP.drawTrophy(c, W / 2, 190 - 18 - lift * 30, 1.6, 'cup'); } } ],
        captions: [
          { t: 0.5, who: 'John', text: `${d.club} are champions. And the captain is handing the trophy to ${d.name}.` },
          { t: 3.4, who: 'Ally', text: 'Look at the face. Sixteen when we first saw the penalty. Look at it now.' },
          { t: 6.2, who: 'John', text: `UP IT GOES! ${d.club}, champions of the ${d.league}!` },
          { t: 9.5, who: 'Ally', text: 'Fireworks, ticker tape, the lot. Nobody is going home tonight.' } ],
        effects: { confetti: true, fireworks: true, from: 6 },
        banner: { t: 6.1, text: 'CHAMPIONS', sub: `${d.club} · ${d.league}`, sfx: 'chant' } };
    },
    award(d) {
      const W = 360, H = 240; const kind = d.kind || 'poty';
      const titles = { ballondor: "BALLON D'OR", poty: 'PLAYER OF THE YEAR', ypoty: 'YOUNG PLAYER OF THE YEAR', goldenboot: 'GOLDEN BOOT', motm: 'MAN OF THE MATCH' };
      const trophyKind = kind === 'ballondor' ? 'ball' : kind === 'goldenboot' ? 'boot' : kind === 'motm' ? 'plaque' : 'cup';
      const host = { look: SP.randomLook(), kit: suitKit };
      const long = kind !== 'motm';
      return { w: W, h: H, duration: long ? 13 : 7, bg: (c, t, i) => BG.gala(c, t, Object.assign(i, { title: titles[kind] })),
        actors: [
          { look: host.look, kit: suitKit, opts: { suit: true, tie: '#111' }, keys: [{ t: 0, x: W / 2 + 60, y: 170 }, { t: 30, x: W / 2 + 60, y: 170 }] },
          { look: d.look, kit: kind === 'motm' ? d.kit : suitKit, opts: kind === 'motm' ? { acc: d.acc, number: 10 } : { suit: true, tie: d.kit.shirt, acc: d.acc }, scale: 1.8, keys: [{ t: 0, x: -30, y: 176 }, { t: long ? 3 : 1.5, x: W / 2 - 20, y: 176 }, { t: long ? 5.5 : 3, x: W / 2 - 20, y: 176 }, { t: long ? 6 : 3.4, x: W / 2 - 20, y: 176, pose: 'cheer' }, { t: 30, x: W / 2 - 20, y: 176, pose: 'cheer' }] } ],
        front: [ { t0: long ? 5.5 : 3, draw: (c, t) => { const lift = Math.min(1, (t - (long ? 5.5 : 3)) / 0.6); SP.drawTrophy(c, W / 2 - 20, 176 - 20 - lift * 28, 1.4, trophyKind); } } ],
        captions: long ? [
          { t: 0.4, who: 'Host', text: `And the ${titles[kind].toLowerCase().replace("'", '’')} goes to...` },
          { t: 3.2, who: 'Host', text: `${d.name}, of ${d.club}!` },
          { t: 5.8, who: 'Ally', text: d.line || 'Deserved. Every single week.' },
          { t: 9, who: 'John', text: d.stats || '' } ] : [
          { t: 0.3, who: 'Ally', text: `Player of the match, no argument: ${d.name}.` },
          { t: 3.3, who: 'John', text: d.stats || 'A performance to remember.' } ],
        effects: { flashes: true, confetti: kind === 'ballondor', from: long ? 3 : 1.5 },
        banner: { t: long ? 5.6 : 3.2, text: titles[kind], sub: d.name, sfx: kind === 'ballondor' ? 'chant' : 'ding' } };
    },
    debut(d) {
      const W = 360, H = 240; const mates = ensureMates(d, 5);
      const actors = mates.map((m, i) => ({ look: m.look, kit: d.kit, keys: [{ t: 0, x: W / 2 - 10 + (i % 2 ? 22 : -22), y: 230 + i * 26 }, { t: 6, x: W / 2 - 10 + (i % 2 ? 22 : -22), y: 100 + i * 26 }, { t: 9, x: W / 2 - 10 + (i % 2 ? 22 : -22), y: 40 + i * 26 }] }));
      actors.push({ look: d.look, kit: d.kit, opts: { acc: d.acc, number: 10 }, scale: 1.8, label: 'YOU', keys: [{ t: 0, x: W / 2, y: 300 }, { t: 6, x: W / 2, y: 190 }, { t: 9, x: W / 2, y: 80 }] });
      return { w: W, h: H, duration: 9.5, bg: BG.tunnel, actors,
        captions: [
          { t: 0.5, who: 'John', text: `Here they come. And there, near the back, a debutant: ${d.name}.` },
          { t: 3.5, who: 'Ally', text: `First professional appearance for ${d.club}. Deep breath.` },
          { t: 6.5, who: 'John', text: 'Out into the light. The rest is up to you.' } ],
        effects: { flashes: true, from: 5 } };
    },
  };

  root.PPL_CUT = { play, SCENES, BG };
})(typeof window !== 'undefined' ? window : globalThis);
