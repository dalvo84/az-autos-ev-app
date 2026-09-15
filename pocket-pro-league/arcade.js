/* Pocket Pro League — real-time top-down match engine (canvas) */
(function (root) {
  'use strict';
  const SP = root.PPL_SPRITES, CT = root.PPL_CONTROLS;
  const W = 600, H = 900, GOAL_W = 150, GX0 = (W - GOAL_W) / 2, GX1 = (W + GOAL_W) / 2;
  const SLOTS = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'ST', 'LW'];
  const FORM = [[.5, .05], [.84, .27], [.63, .2], [.37, .2], [.16, .27], [.5, .42], [.31, .54], [.69, .57], [.85, .74], [.5, .8], [.15, .74]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rnd = () => Math.random();
  const speedOf = p => (92 + p.attrs.pac * 1.25) * (p.isUser ? 1 : 0.86);

  function start(opts) {
    const host = opts.host; host.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'arc-stage';
    stage.innerHTML = `<div class="arc-hud"><span class="arc-score" id="arc-score"></span><span class="arc-clock" id="arc-clock"></span><span class="arc-rating" id="arc-rating"></span></div>
      <div class="arc-ticker" id="arc-ticker"></div><canvas id="arc-canvas"></canvas><div class="arc-banner" id="arc-banner" hidden></div>`;
    host.appendChild(stage);
    const canvas = stage.querySelector('#arc-canvas'), ctx = canvas.getContext('2d');
    const hud = { score: stage.querySelector('#arc-score'), clock: stage.querySelector('#arc-clock'), rating: stage.querySelector('#arc-rating'), ticker: stage.querySelector('#arc-ticker'), banner: stage.querySelector('#arc-banner') };
    const isGKUser = opts.user.pos === 'GK';
    const ctl = CT.create(stage, { buttons: [
      { id: 'shoot', label: isGKUser ? 'KICK' : 'SHOOT', hint: 'hold = power' }, { id: 'pass', label: isGKUser ? 'THROW' : 'PASS', hint: 'to teammate' }, { id: 'skill', label: isGKUser ? 'DIVE' : 'SPRINT', hint: '' } ] });

    // ---- teams ----
    const kits = SP.kitsFor(opts.isHome ? opts.club.name : opts.opp.name, opts.isHome ? opts.opp.name : opts.club.name);
    const myKit = opts.isHome ? kits.home : kits.away, oppKit = opts.isHome ? kits.away : kits.home;
    const players = [];
    function mk(team, slot, attrs, look, extra) {
      const p = Object.assign({ team, slot, pos: SLOTS[slot], attrs, look, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: -1, step: 0, cool: 0, stun: 0, slide: 0, sprint: 0, stamina: 100,
        isGK: slot === 0, isUser: false, number: slot === 0 ? 1 : slot + 1, kit: team === 0 ? myKit : oppKit, name: '', last: '', decide: rnd() * 0.2, contest: 0, benched: false }, extra || {});
      players.push(p); return p;
    }
    const userSlot = Math.max(0, SLOTS.indexOf(opts.user.pos));
    const mates = opts.teammates.slice();
    for (let s = 0; s < 11; s++) {
      if (s === userSlot) {
        const u = mk(0, s, opts.user.attrs, opts.user.look, { isUser: true, name: opts.user.name, last: opts.user.last, number: opts.user.number || (s === 0 ? 1 : 10) });
        if (!opts.starts) { u.benched = true; mk(0, s, genAttrs(opts.club.str - 4), SP.randomLook(), { name: 'Sub', last: 'the sub', isSub: true, number: 14 }); }
        continue;
      }
      let mi = mates.findIndex(m => m.pos === SLOTS[s]); if (mi < 0) mi = 0;
      const m = mates.splice(mi, 1)[0] || { attrs: genAttrs(opts.club.str), look: SP.randomLook(), name: 'Player', last: 'Player' };
      mk(0, s, m.attrs, m.look || SP.randomLook(), { name: m.name, last: m.last, pron: m.pron });
    }
    for (let s = 0; s < 11; s++) mk(1, s, genAttrs(opts.opp.str), SP.randomLook(), { name: opts.opp.name + ' ' + (s + 1), last: '#' + (s === 0 ? 1 : s + 1) });
    function genAttrs(str) { const a = {}; for (const k of ['pac', 'sho', 'pas', 'dri', 'def', 'phy']) a[k] = clamp(Math.round(str + (rnd() * 12 - 6)), 30, 95); return a; }
    const user = players.find(p => p.isUser);
    const onPitch = () => players.filter(p => !p.benched);
    const teamOf = t => onPitch().filter(p => p.team === t);

    // ---- state ----
    const ball = { x: W / 2, y: H / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTeam: 0, lastKicker: null, passTarget: null, assist: null, assistT: 0, freeze: 0 };
    const st = { half: 1, t: 0, phase: 'kickoff', phaseT: 0, score: [0, 0], dir: [-1, 1], secondsPerHalf: opts.secondsPerHalf || 150, timeScale: opts.timeScale || 1,
      user: { goals: 0, assists: 0, saves: 0, keys: 0, shots: 0, onTarget: 0, passes: 0, passesOk: 0, tackles: 0, lost: 0, rating: 6.0, touches: 0 }, subbed: false, ended: false, cam: { x: W / 2, y: H / 2 }, shake: 0 };
    const goalY = team => st.dir[team] < 0 ? 0 : H; // the goal this team attacks
    const ownGoalY = team => st.dir[team] < 0 ? H : 0;
    function homePos(p) {
      const [fx, fy] = FORM[p.slot]; const attackUp = st.dir[p.team] < 0;
      return { x: attackUp ? W * fx : W * (1 - fx), y: attackUp ? H * (1 - fy) : H * fy };
    }
    function reset(kickTeam) {
      for (const p of onPitch()) { const h = homePos(p); p.x = h.x; p.y = h.y; if (p.slot >= 9) { p.y = h.y + (st.dir[p.team] > 0 ? -1 : 1) * 60; } p.vx = p.vy = 0; p.stun = 0; p.slide = 0; p.fy = st.dir[p.team]; p.fx = 0; }
      const taker = teamOf(kickTeam).find(p => p.slot === 9) || teamOf(kickTeam)[9];
      taker.x = W / 2; taker.y = H / 2 + st.dir[kickTeam] * -8;
      ball.x = W / 2; ball.y = H / 2; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; ball.owner = taker; ball.lastTeam = kickTeam; ball.passTarget = null; ball.assist = null;
      st.cam.x = W / 2; st.cam.y = H / 2;
    }
    function rate(d) { st.user.rating = clamp(st.user.rating + d, 2, 10); }
    function emit(type, data) { if (opts.onEvent) opts.onEvent(type, data || {}); }
    function ticker(txt) { hud.ticker.textContent = txt; hud.ticker.classList.remove('flash'); void hud.ticker.offsetWidth; hud.ticker.classList.add('flash'); }
    function banner(txt, ms) { hud.banner.textContent = txt; hud.banner.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => { hud.banner.hidden = true; }, ms || 1500); }

    // ---- kicking ----
    function kick(p, dx, dy, power, lift, target) {
      const d = Math.hypot(dx, dy) || 1;
      ball.owner = null; ball.vx = dx / d * power; ball.vy = dy / d * power; ball.vz = lift || 0; ball.z = Math.max(ball.z, 1);
      ball.x = p.x + dx / d * 12; ball.y = p.y + dy / d * 12;
      ball.lastKicker = p; ball.lastTeam = p.team; ball.passTarget = target || null; p.cool = 0.35;
    }
    function shoot(p, power, aim) {
      const gy = goalY(p.team); const gx = W / 2 + clamp(aim || 0, -1, 1) * 55;
      const spread = ((100 - p.attrs.sho) * 1.3 + 30) * (rnd() - 0.5) * (p.isUser ? 0.9 : 1.9) * (1 + power * 0.4);
      const tx = gx + spread, ty = gy;
      const v = (p.isUser ? 330 : 300) + power * 240 + p.attrs.sho * 1.2;
      kick(p, tx - p.x, ty - p.y, v, 40 + power * 90 + rnd() * 40);
      const onT = Math.abs(tx - W / 2) < GOAL_W / 2 - 4;
      if (p.isUser) { st.user.shots++; if (onT) st.user.onTarget++; rate(onT ? 0.15 : -0.05); }
      emit('shot', { p, onTarget: onT });
    }
    function bestPassTarget(p, aimx, aimy, useAim) {
      const gy = goalY(p.team); let best = null, bestS = -1e9;
      for (const q of teamOf(p.team)) {
        if (q === p) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy); if (d < 25 || d > 330) continue;
        let s = 0;
        if (useAim) s += (dx * aimx + dy * aimy) / d * 220; // alignment with joystick
        s -= d * 0.25;
        s += (Math.abs(p.y - gy) - Math.abs(q.y - gy)) * 0.5; // progression
        let minOpp = 999; for (const o of teamOf(1 - p.team)) minOpp = Math.min(minOpp, dist(o, q)); s += Math.min(minOpp, 80) * 1.2; // openness
        // lane check
        for (const o of teamOf(1 - p.team)) { const t = ((o.x - p.x) * dx + (o.y - p.y) * dy) / (d * d); if (t > 0.1 && t < 0.9) { const lx = p.x + dx * t, ly = p.y + dy * t; if (Math.hypot(o.x - lx, o.y - ly) < 18) s -= 150; } }
        if (q.isGK) s -= 200;
        if (q.isUser && !p.isUser) s += 60 * (opts.chem / 100) * 2; // chemistry: teammates look for you up to 3x
        if (s > bestS) { bestS = s; best = q; }
      }
      return best;
    }
    function pass(p, aimx, aimy, useAim) {
      const q = bestPassTarget(p, aimx, aimy, useAim);
      if (!q) { kick(p, aimx || p.fx, aimy || p.fy, 300, 0); return; }
      const lead = 0.35; const tx = q.x + q.vx * lead, ty = q.y + q.vy * lead;
      const d = Math.hypot(tx - p.x, ty - p.y);
      const err = (100 - p.attrs.pas) * 0.5; const ex = (rnd() - 0.5) * err, ey = (rnd() - 0.5) * err;
      kick(p, tx - p.x + ex, ty - p.y + ey, clamp(d * 2.1, 220, 520), d > 220 ? 60 : 0, q);
      ball.assist = p; ball.assistT = 0;
      if (p.isUser) st.user.passes++;
      emit('pass', { p, q });
    }

    // ---- AI ----
    function aiTarget(p) {
      const ownerTeam = ball.owner ? ball.owner.team : -1;
      const h = homePos(p);
      let tx = h.x + (ball.x - W / 2) * 0.3, ty = h.y + (ball.y - H / 2) * 0.35;
      const push = ownerTeam === p.team ? 70 : ownerTeam === 1 - p.team ? -60 : 0;
      ty += st.dir[p.team] * push;
      if (p.isGK) return gkTarget(p);
      const mates = teamOf(p.team).filter(q => !q.isGK && !q.isUser);
      const byDist = mates.slice().sort((a, b) => dist(a, ball) - dist(b, ball));
      const rank = byDist.indexOf(p);
      if (ownerTeam !== p.team) { // chase / press
        const og = ownGoalY(p.team); const danger = Math.abs(ball.y - og) < H * 0.36;
        if (rank === 0 || (rank <= (danger ? 2 : 1) && ownerTeam === 1 - p.team)) { const o = ball.owner || ball; return { x: o.x, y: o.y, chase: true }; }
        if (danger && p.slot >= 1 && p.slot <= 5) { const o = ball.owner || ball; return { x: (o.x + tx) / 2, y: (o.y + ty) / 2, chase: true }; }
      } else if (ball.passTarget === p) return { x: ball.x + ball.vx * 0.3, y: ball.y + ball.vy * 0.3, chase: true };
      // make a run when your team attacks
      if (ownerTeam === p.team && p.slot >= 8 && rnd() < 0.5) ty += st.dir[p.team] * 40;
      return { x: clamp(tx, 20, W - 20), y: clamp(ty, 20, H - 20) };
    }
    function gkTarget(p) {
      const gy = ownGoalY(p.team); const lineY = gy + (gy === 0 ? 16 : -16);
      const toward = ball.owner ? false : (gy === 0 ? ball.vy < -60 : ball.vy > 60);
      if (toward && Math.abs(ball.y - gy) < 320) {
        const t = Math.abs((lineY - ball.y) / (ball.vy || 1)); const px = clamp(ball.x + ball.vx * t, GX0 - 10, GX1 + 10);
        return { x: px, y: lineY, dive: true };
      }
      const bx = clamp(W / 2 + (ball.x - W / 2) * 0.6, GX0 + 10, GX1 - 10);
      const out = ball.owner && ball.owner.team !== p.team && Math.abs(ball.y - gy) < 110 ? 38 : 0;
      return { x: bx, y: lineY + (gy === 0 ? out : -out) };
    }
    function aiDecide(p, dt) {
      p.decide -= dt; if (p.decide > 0) return; p.decide = 0.18 + rnd() * 0.12;
      if (ball.owner !== p) return;
      const gy = goalY(p.team); const dG = Math.hypot(W / 2 - p.x, gy - p.y);
      if (p.isGK) { if (p.hold === undefined) p.hold = 0.7; p.hold -= 0.25; if (p.hold <= 0) { p.hold = undefined; const q = bestPassTarget(p, 0, st.dir[p.team], true); if (q && dist(q, p) < 260) pass(p, 0, 0, false); else kick(p, (rnd() - 0.5) * 0.6, st.dir[p.team], 520, 150); } return; }
      let minOpp = 999, nearest = null; for (const o of teamOf(1 - p.team)) { const d = dist(o, p); if (d < minOpp) { minOpp = d; nearest = o; } }
      const central = Math.abs(p.x - W / 2) < 170;
      if (dG < 210 && central) {
        let lane = true; for (const o of teamOf(1 - p.team)) { if (o.isGK) continue; const t = ((o.x - p.x) * (W / 2 - p.x) + (o.y - p.y) * (gy - p.y)) / (dG * dG); if (t > 0.05 && t < 0.9) { const lx = p.x + (W / 2 - p.x) * t, ly = p.y + (gy - p.y) * t; if (Math.hypot(o.x - lx, o.y - ly) < 14) lane = false; } }
        if (rnd() < (lane ? 0.05 : 0.02) + (210 - dG) / 210 * 0.15 + (minOpp < 25 ? 0.08 : 0)) { shoot(p, 0.5 + rnd() * 0.5, (rnd() - 0.5) * 1.2); return; }
      }
      if (minOpp < 48 && rnd() < 0.75) { const q = bestPassTarget(p, 0, st.dir[p.team], false); if (q) { pass(p, 0, 0, false); return; } }
      if (rnd() < 0.12) { const q = bestPassTarget(p, 0, st.dir[p.team], false); if (q && Math.abs(q.y - gy) < Math.abs(p.y - gy) - 60) { pass(p, 0, 0, false); return; } }
      // dribble: toward goal, sidestep the nearest defender
      let dx = (W / 2 + (p.x - W / 2) * 0.3) - p.x, dy = gy - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      if (nearest && minOpp < 70) { const ax = p.x - nearest.x, ay = p.y - nearest.y; const ad = Math.hypot(ax, ay) || 1; dx += ax / ad * 0.9; dy += ay / ad * 0.9; }
      p.dribble = { x: dx, y: dy };
    }

    // ---- controls ----
    let charge = 0, charging = false;
    ctl.onDown(id => { if (st.phase !== 'play' || user.benched) return; if (id === 'shoot' && ball.owner === user) { charging = true; charge = 0; } });
    ctl.onUp((id, held) => {
      if (st.phase !== 'play' || user.benched) return;
      const s = ctl.state; const aimx = s.active ? s.x : user.fx, aimy = s.active ? s.y : user.fy;
      if (id === 'shoot') {
        charging = false;
        if (ball.owner === user) { const power = clamp(held / 0.8, 0.25, 1); if (isGKUser) kick(user, aimx, aimy || st.dir[0], 480 + power * 200, 160); else shoot(user, power, s.active ? s.x * (st.dir[0] < 0 ? 1 : -1) : 0); }
        else if (!isGKUser) rate(0); // nothing
      }
      if (id === 'pass') { if (ball.owner === user) pass(user, aimx, aimy, s.active); else { user.calling = 1.5; } }
      if (id === 'skill') {
        if (ball.owner === user && !isGKUser) { if (user.stamina > 20) { user.sprint = 0.9; user.stamina -= 20; } }
        else if (user.slide <= 0 && user.stun <= 0) { user.slide = isGKUser ? 0.5 : 0.45; user.sx = aimx; user.sy = aimy; if (!s.active) { user.sx = user.fx; user.sy = user.fy; } }
      }
    });

    // ---- physics ----
    function movePlayer(p, tx, ty, dt, speedMul) {
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d < 2) { p.vx = p.vy = 0; return; }
      const sp = speedOf(p) * (speedMul || 1) * (p.stun > 0 ? 0 : 1);
      const step = Math.min(d, sp * dt);
      p.vx = dx / d * sp; p.vy = dy / d * sp; p.x += dx / d * step; p.y += dy / d * step; p.fx = dx / d; p.fy = dy / d; p.step += dt * 14;
    }
    function update(dt) {
      st.phaseT += dt;
      if (st.phase === 'kickoff') { if (st.phaseT > 1.1) { st.phase = 'play'; } return; }
      if (st.phase === 'goal') { if (st.phaseT > 2.2) { reset(1 - st.lastGoalTeam); st.phase = 'kickoff'; st.phaseT = 0; } return; }
      if (st.phase === 'halftime') { if (st.phaseT > 2.5) { st.half = 2; st.dir = [1, -1]; st.t = 0; reset(1); st.phase = 'kickoff'; st.phaseT = 0; emit('secondhalf'); } return; }
      if (st.phase !== 'play') return;
      st.t += dt;
      if (st.t >= st.secondsPerHalf) {
        if (st.half === 1) { st.phase = 'halftime'; st.phaseT = 0; banner('HALF TIME', 2400); emit('halftime', { score: st.score }); return; }
        st.phase = 'end'; finish(); return;
      }
      // substitution
      if (user.benched && !st.subbed && (st.half === 2 && st.t >= st.secondsPerHalf * 0.33)) {
        const sub = players.find(p => p.isSub); user.benched = false; user.x = sub.x; user.y = sub.y; sub.benched = true; if (ball.owner === sub) ball.owner = user; st.subbed = true; banner('SUBSTITUTION: ' + (opts.user.last || 'you').toUpperCase() + ' ON', 2000); emit('sub');
      }
      ball.assistT += dt;
      // players
      for (const p of onPitch()) {
        p.cool = Math.max(0, p.cool - dt); p.stun = Math.max(0, p.stun - dt); p.calling = Math.max(0, (p.calling || 0) - dt);
        if (p.slide > 0) { p.slide -= dt; p.x += (p.sx || p.fx) * speedOf(p) * 1.6 * dt; p.y += (p.sy || p.fy) * speedOf(p) * 1.6 * dt; p.step += dt * 8; if (p.slide <= 0) p.stun = 0.45; }
        else if (p.isUser) {
          const s = ctl.state; p.sprint = Math.max(0, p.sprint - dt);
          if (p.stamina < 100) p.stamina += dt * (ball.owner === p ? 5 : 9);
          if (s.active && p.stun <= 0) { const mul = (p.sprint > 0 ? 1.35 : 1) * (ball.owner === p ? 0.9 : 1); const sp = speedOf(p) * mul; p.vx = s.x * sp; p.vy = s.y * sp; p.x += p.vx * dt; p.y += p.vy * dt; p.fx = s.x / (Math.hypot(s.x, s.y) || 1); p.fy = s.y / (Math.hypot(s.x, s.y) || 1); p.step += dt * 14 * mul; }
          else { p.vx = p.vy = 0; }
        } else {
          aiDecide(p, dt);
          if (ball.owner === p) { const d = p.dribble || { x: 0, y: st.dir[p.team] }; movePlayer(p, p.x + d.x * 60, p.y + d.y * 60, dt, 0.88); }
          else { const t = aiTarget(p); movePlayer(p, t.x, t.y, dt, t.dive ? 2.2 : t.chase ? 1.05 : 0.85); }
        }
        p.x = clamp(p.x, 6, W - 6); p.y = clamp(p.y, p.isGK ? 4 : -10, p.isGK ? H - 4 : H + 10);
      }
      // separation
      const ps = onPitch();
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const a = ps[i], b = ps[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < 13 && d > 0.01) { const push = (13 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; } }
      // ball
      if (ball.owner) {
        const o = ball.owner; ball.x = o.x + o.fx * 12; ball.y = o.y + o.fy * 12; ball.z = 0; ball.vx = o.vx; ball.vy = o.vy;
        // tackles
        for (const d of teamOf(1 - o.team)) {
          const dd = dist(d, o); if (dd > 17 && !(d.slide > 0 && dd < 24)) continue;
          if (d.stun > 0 || d.isGK && !d.isUser) continue;
          d.contest += dt; const interval = d.slide > 0 ? 0 : 0.3;
          if (d.contest >= interval) {
            d.contest = 0;
            let pr = 0.28 + (d.attrs.def - o.attrs.dri) * 0.006 + (d.slide > 0 ? 0.32 : 0) + (d.isUser ? 0.05 : 0) - (o.isUser ? 0.04 : 0);
            if (rnd() < clamp(pr, 0.05, 0.9)) {
              o.stun = 0.5; ball.owner = d; d.cool = 0.15; ball.lastTeam = d.team; ball.passTarget = null; ball.assist = null;
              if (d.isUser) { st.user.tackles++; st.user.keys++; rate(0.3); emit('tackle', { p: d }); }
              if (o.isUser) { st.user.lost++; rate(-0.07); }
              d.slide = Math.min(d.slide, 0.1);
            } else if (d.slide > 0) { d.slide = 0; d.stun = 0.6; }
          }
        }
      } else {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; ball.vz -= 420 * dt;
        if (ball.z <= 0) { ball.z = 0; if (ball.vz < -60) ball.vz = -ball.vz * 0.45; else ball.vz = 0; }
        const f = ball.z > 0 ? 0.25 : 1.7; ball.vx -= ball.vx * f * dt; ball.vy -= ball.vy * f * dt;
        const sp = Math.hypot(ball.vx, ball.vy);
        // goal?
        if ((ball.y < 0 || ball.y > H) && ball.x > GX0 && ball.x < GX1 && ball.z < 60) { goal(ball.y < 0 ? (st.dir[0] < 0 ? 0 : 1) : (st.dir[0] > 0 ? 0 : 1)); return; }
        // out of play
        if (ball.x < -4 || ball.x > W + 4 || ball.y < -4 || ball.y > H + 4) { restart(); return; }
        // pickups / saves
        let taker = null, best = 99;
        for (const p of onPitch()) {
          if (p.cool > 0 || p.stun > 0) continue;
          const reach = (p.isGK ? 28 + p.attrs.def * 0.15 : 13) + (ball.passTarget === p ? 8 : 0) + (p.slide > 0 ? 8 : 0) + (p.isUser ? 2 : 0);
          const d = dist(p, ball); if (d > reach || d >= best) continue;
          if (ball.z > (p.isGK || p.slide > 0 ? 70 : 28) && !(ball.z < 45 && p.attrs.phy > 60)) continue;
          if (sp > (p.isGK ? 900 : ball.passTarget === p ? 560 : 400)) continue;
          taker = p; best = d;
        }
        if (taker) {
          if (taker.isGK && sp > 300 && ball.lastTeam !== taker.team) {
            const pr = clamp(0.9 + (taker.attrs.def - 55) * 0.006 - (sp - 300) * 0.0004 - (ball.z > 30 ? 0.1 : 0), 0.3, 0.97);
            if (rnd() < pr) { ball.owner = taker; taker.cool = 0.1; if (taker.isUser) { st.user.saves++; rate(0.5); } emit('save', { p: taker, big: sp > 520 }); ball.vx = ball.vy = 0; ball.passTarget = null; ball.assist = null; taker.hold = 0.8; }
            else { taker.cool = 0.4; ball.vy = -ball.vy * 0.45; ball.vx = ball.vx * 0.3 + (rnd() - 0.5) * 320; ball.vz = 140; emit('save', { p: taker, big: true, parry: true }); } // parried away
            return;
          }
          const wasTeam = ball.lastTeam; ball.owner = taker; taker.cool = 0.12; ball.vx = ball.vy = 0;
          if (taker.team !== wasTeam) { ball.assist = null; if (ball.lastKicker && ball.lastKicker.isUser && ball.passTarget) { rate(-0.1); } if (taker.isUser) { st.user.keys++; rate(0.15); } }
          else if (ball.passTarget === taker && ball.lastKicker && ball.lastKicker.isUser) { st.user.passesOk++; rate(0.05); }
          if (taker.isUser) st.user.touches++;
          ball.lastTeam = taker.team; ball.passTarget = null;
        }
      }
      st.shake = Math.max(0, st.shake - dt);
    }
    function goal(team) {
      st.score[team]++; st.lastGoalTeam = team; st.phase = 'goal'; st.phaseT = 0; st.shake = 0.6;
      const scorer = ball.lastKicker && ball.lastKicker.team === team ? ball.lastKicker : null;
      const assist = ball.assist && ball.assist.team === team && ball.assist !== scorer && ball.assistT < 7 ? ball.assist : null;
      if (scorer && scorer.isUser) { st.user.goals++; rate(1.2); }
      if (assist && assist.isUser) { st.user.assists++; rate(0.9); }
      if (team !== 0 && isGKUser && !user.benched) rate(-0.2);
      banner(team === 0 ? 'GOAL!' : 'GOAL ' + opts.opp.name.toUpperCase(), 2000);
      emit('goal', { team, scorer, assist, score: st.score.slice() });
      ball.owner = null; ball.vx = ball.vy = 0;
    }
    function restart() {
      const toTeam = 1 - ball.lastTeam;
      const px = clamp(ball.x, 8, W - 8), py = clamp(ball.y, 8, H - 8);
      const goalLine = ball.y < 0 || ball.y > H;
      const gy = ball.y < 0 ? 0 : H;
      const defendsThatGoal = ownGoalY(0) === gy ? 0 : 1;
      let taker, bx = px, by = py;
      if (goalLine && toTeam === defendsThatGoal) { taker = teamOf(toTeam).find(p => p.isGK); bx = W / 2; by = gy === 0 ? 60 : H - 60; }
      else if (goalLine) { taker = teamOf(toTeam).filter(p => !p.isGK).sort((a, b) => dist(a, ball) - dist(b, ball))[0]; bx = ball.x < W / 2 ? 8 : W - 8; by = gy === 0 ? 8 : H - 8; }
      else taker = teamOf(toTeam).filter(p => !p.isGK).sort((a, b) => dist(a, ball) - dist(b, ball))[0];
      taker.x = bx; taker.y = by; ball.x = bx; ball.y = by; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; ball.owner = taker; ball.lastTeam = toTeam; ball.passTarget = null; ball.assist = null; taker.cool = 0.2; taker.hold = 0.6;
      for (const o of teamOf(1 - toTeam)) if (dist(o, taker) < 40) { o.x += (o.x - taker.x) > 0 ? 40 : -40; }
    }

    // ---- render ----
    let zoom = 1, cw = 0, ch = 0;
    function resize() {
      const w = Math.min(stage.clientWidth, 760); const h = Math.max(360, Math.min(Math.round(window.innerHeight * 0.62), Math.round(w * 1.25)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      cw = w; ch = h; zoom = w / 330 * dpr; ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    window.addEventListener('resize', resize); resize();
    function draw() {
      const dpr = canvas.width / cw;
      const focus = user.benched ? ball : { x: user.x * 0.6 + ball.x * 0.4, y: user.y * 0.6 + ball.y * 0.4 };
      st.cam.x += (focus.x - st.cam.x) * 0.12; st.cam.y += (focus.y - st.cam.y) * 0.12;
      const vw = canvas.width / zoom, vh = canvas.height / zoom;
      const camx = clamp(st.cam.x, vw / 2 - 40, W - vw / 2 + 40), camy = clamp(st.cam.y, vh / 2 - 50, H - vh / 2 + 50);
      const sx = st.shake > 0 ? (rnd() - 0.5) * 6 : 0, sy = st.shake > 0 ? (rnd() - 0.5) * 6 : 0;
      ctx.setTransform(zoom, 0, 0, zoom, canvas.width / 2 - camx * zoom + sx, canvas.height / 2 - camy * zoom + sy);
      ctx.imageSmoothingEnabled = false;
      // grass
      ctx.fillStyle = '#2f8f45'; ctx.fillRect(camx - vw, camy - vh, vw * 2, vh * 2);
      for (let y = -60; y < H + 60; y += 60) { ctx.fillStyle = (y / 60) % 2 ? '#2e8a42' : '#33984b'; ctx.fillRect(-60, y, W + 120, 60); }
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, W, H); ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2); ctx.stroke();
      for (const gy of [0, H]) {
        const s = gy === 0 ? 1 : -1;
        ctx.strokeRect(W / 2 - 170, gy === 0 ? 0 : H - 135, 340, 135); ctx.strokeRect(W / 2 - 95, gy === 0 ? 0 : H - 48, 190, 48);
        ctx.beginPath(); ctx.arc(W / 2, gy + s * 90, 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        // goal & net
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(GX0, gy === 0 ? -22 : H, GOAL_W, 22);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; for (let x = GX0; x <= GX1; x += 10) { ctx.beginPath(); ctx.moveTo(x, gy === 0 ? -22 : H); ctx.lineTo(x, gy === 0 ? 0 : H + 22); ctx.stroke(); }
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(GX0, gy === 0 ? -22 : H + 22); ctx.lineTo(GX0, gy); ctx.moveTo(GX1, gy === 0 ? -22 : H + 22); ctx.lineTo(GX1, gy); ctx.moveTo(GX0, gy === 0 ? -22 : H + 22); ctx.lineTo(GX1, gy === 0 ? -22 : H + 22); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)';
      }
      // user ring
      if (!user.benched) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(user.x, user.y + 1, 9, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (ball.passTarget && !ball.owner) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.ellipse(ball.passTarget.x, ball.passTarget.y + 1, 8, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      // players + ball sorted by y
      const items = onPitch().map(p => ({ y: p.y, p })); items.push({ y: ball.y, ball: true });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        if (it.ball) {
          ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(ball.x, ball.y + 1, 3.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ball.x, ball.y - ball.z * 0.25 - 2, 4.6 + ball.z * 0.01, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y - ball.z * 0.25 - 2, 3.6 + ball.z * 0.01, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#222'; ctx.fillRect(ball.x - 1, ball.y - ball.z * 0.25 - 3, 1.5, 1.5);
          continue;
        }
        const p = it.p; const moving = Math.hypot(p.vx, p.vy) > 5 || p.slide > 0;
        SP.drawFigure(ctx, p.x, p.y, 1.05, p.look, p.kit, { step: moving ? p.step : 0, slide: p.slide > 0, gloves: p.isGK, number: p.number });
        if (p.isUser) { ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(p.x - 4, p.y - 30); ctx.lineTo(p.x + 4, p.y - 30); ctx.lineTo(p.x, p.y - 25); ctx.closePath(); ctx.fill(); }
        if (p.calling > 0) { ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText('HERE!', p.x, p.y - 33); }
      }
      // charge meter
      if (charging && ball.owner === user) { const c = clamp((performance.now() - ctl.state.pressed.shoot) / 800, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(user.x - 12, user.y + 6, 24, 4); ctx.fillStyle = c > 0.8 ? '#ff5a5a' : '#ffe14d'; ctx.fillRect(user.x - 12, user.y + 6, 24 * c, 4); }
      // HUD
      const min = Math.min(45, Math.floor(st.t / st.secondsPerHalf * 45)) + (st.half === 2 ? 45 : 0);
      hud.score.textContent = `${opts.club.name} ${st.score[0]} – ${st.score[1]} ${opts.opp.name}`;
      hud.clock.textContent = `${min}'`; hud.rating.textContent = user.benched && !st.subbed ? 'BENCH' : st.user.rating.toFixed(1);
      ctl.setLabel('skill', isGKUser ? 'DIVE' : ball.owner === user ? 'SPRINT' : 'SLIDE', isGKUser ? '' : ball.owner === user ? `stamina ${Math.round(user.stamina)}` : 'tackle');
    }

    // ---- loop ----
    let last = performance.now(), raf = 0, alive = true;
    function frame(now) {
      if (!alive) return;
      let dt = Math.min(0.033, (now - last) / 1000) * st.timeScale; last = now;
      const steps = Math.max(1, Math.ceil(dt / 0.033));
      for (let i = 0; i < steps; i++) update(dt / steps);
      draw(); raf = requestAnimationFrame(frame);
    }
    function finish() {
      if (st.ended) return; st.ended = true; alive = false; cancelAnimationFrame(raf);
      banner('FULL TIME', 2500);
      const u = st.user; const res = { score: st.score.slice(), rating: u.rating, goals: u.goals, assists: u.assists, saves: u.saves, keys: u.keys, shots: u.shots, onTarget: u.onTarget, passes: u.passes, passesOk: u.passesOk, tackles: u.tackles, touches: u.touches, played: !user.benched || st.subbed };
      emit('fulltime', res);
      setTimeout(() => { if (opts.onEnd) opts.onEnd(res); }, 900);
    }
    reset(rnd() < 0.5 ? 0 : 1);
    banner('KICK OFF', 1200); emit('kickoff');
    raf = requestAnimationFrame(frame);
    return { destroy() { alive = false; cancelAnimationFrame(raf); ctl.destroy(); window.removeEventListener('resize', resize); host.innerHTML = ''; }, state: st, players, ball, endNow() { st.phase = 'end'; finish(); } };
  }
  root.PPL_ARCADE = { start, W, H };
})(typeof window !== 'undefined' ? window : globalThis);
