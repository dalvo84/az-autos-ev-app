/* Pocket Pro League — real-time top-down match engine (canvas) */
(function (root) {
  'use strict';
  const SP = root.PPL_SPRITES, CT = root.PPL_CONTROLS;
  const W = 600, H = 900, GOAL_W = 150, GX0 = (W - GOAL_W) / 2, GX1 = (W + GOAL_W) / 2;
  const SLOTS = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'ST', 'LW'];
  const FORM = [[.5, .05], [.84, .27], [.63, .2], [.37, .2], [.16, .27], [.5, .42], [.31, .54], [.69, .57], [.85, .68], [.5, .72], [.15, .68]];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Difficulty: how the opposition plays against you. aiSpeed/aiTackle/aiShot/aiAcc/gk scale the other team,
  // userTackle scales your slide and stand-up tackles, mateQ scales your AI teammates, bonus is added to your rating at full time.
  const DIFFICULTY = {
    beginner:     { name: 'Beginner',     aiSpeed: 0.72, aiTackle: 0.35, aiShot: 0.6,  aiAcc: 0.6,  gk: 0.75, userTackle: 1.4, mateQ: 1.1,  bonus: -0.2, blurb: 'Opponents jog, rarely tackle and shoot wildly.' },
    amateur:      { name: 'Amateur',      aiSpeed: 0.82, aiTackle: 0.5,  aiShot: 0.75, aiAcc: 0.75, gk: 0.85, userTackle: 1.25, mateQ: 1.05, bonus: 0,    blurb: 'A gentle Sunday league. Good for learning the controls.' },
    semipro:      { name: 'Semi-Pro',     aiSpeed: 0.9,  aiTackle: 0.7,  aiShot: 0.9,  aiAcc: 0.9,  gk: 0.95, userTackle: 1.1,  mateQ: 1.0,  bonus: 0.1,  blurb: 'Fair fight. Opponents press but you can beat them.' },
    professional: { name: 'Professional', aiSpeed: 1.0,  aiTackle: 0.9,  aiShot: 1.0,  aiAcc: 1.0,  gk: 1.0,  userTackle: 1.0,  mateQ: 1.0,  bonus: 0.2,  blurb: 'Opponents play to their attributes. Mistakes get punished.' },
    legendary:    { name: 'Legendary',    aiSpeed: 1.08, aiTackle: 1.1,  aiShot: 1.15, aiAcc: 1.1,  gk: 1.08, userTackle: 0.9,  mateQ: 0.95, bonus: 0.35, blurb: 'Faster, sharper, tighter. Keepers are a wall.' },
    ultimate:     { name: 'Ultimate',     aiSpeed: 1.1,  aiTackle: 1.3,  aiShot: 1.15, aiAcc: 1.1,  gk: 1.15, userTackle: 0.8,  mateQ: 0.9,  bonus: 0.5,  blurb: 'Every duel is uphill. Bring your best form.' },
    nightmare:    { name: 'NIGHTMARE',    aiSpeed: 1.18, aiTackle: 1.5,  aiShot: 1.3,  aiAcc: 1.2,  gk: 1.25, userTackle: 0.7,  mateQ: 0.85, bonus: 0.7,  blurb: 'They are faster than you, they never miss, and they want blood.' },
  };
  const DIFF_ORDER = ['beginner', 'amateur', 'semipro', 'professional', 'legendary', 'ultimate', 'nightmare'];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rnd = () => Math.random();
  let DF = DIFFICULTY.amateur;
  // Your player is quicker than the raw number: a controlled player needs headroom to feel responsive
  const speedOf = p => p.isUser ? (66 + p.attrs.pac * 0.72) * 1.12 : (52 + p.attrs.pac * 0.72) * (p.team === 1 ? 0.9 * DF.aiSpeed : 0.9 * DF.mateQ);

  function start(opts) {
    DF = DIFFICULTY[opts.difficulty] || DIFFICULTY.amateur;
    const host = opts.host; host.innerHTML = '';
    const stage = document.createElement('div'); stage.className = 'arc-stage';
    stage.innerHTML = `<canvas id="arc-canvas"></canvas><div class="arc-hud"><span class="arc-score" id="arc-score"></span><span class="arc-clock" id="arc-clock"></span><span class="arc-rating" id="arc-rating"></span><button type="button" class="arc-exit" id="arc-exit">✕</button></div>
      <div class="arc-ticker" id="arc-ticker"></div><div class="arc-banner" id="arc-banner" hidden></div>`;
    host.appendChild(stage);
    const canvas = stage.querySelector('#arc-canvas'), ctx = canvas.getContext('2d');
    stage.querySelector('#arc-exit').onclick = () => { if (opts.onExit) opts.onExit(); };
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
      user: { goals: 0, assists: 0, saves: 0, keys: 0, shots: 0, onTarget: 0, passes: 0, passesOk: 0, tackles: 0, lost: 0, rating: 6.0, touches: 0 }, subbed: false,
      teamShots: [0, 0], teamPasses: [0, 0], passesToUser: 0, gkSaves: [0, 0], ended: false, cam: { x: W / 2, y: H / 2 }, shake: 0 };
    const goalY = team => st.dir[team] < 0 ? 0 : H; // the goal this team attacks
    const ownGoalY = team => st.dir[team] < 0 ? H : 0;
    function homePos(p, kickoff) {
      const [fx, f0] = FORM[p.slot]; const attackUp = st.dir[p.team] < 0;
      const fy = kickoff ? f0 * 0.48 : f0; // at kick-off the whole team stands inside its own half
      return { x: attackUp ? W * fx : W * (1 - fx), y: attackUp ? H * (1 - fy) : H * fy };
    }
    function reset(kickTeam) {
      for (const p of onPitch()) { const h = homePos(p, true); p.x = h.x; p.y = h.y; p.vx = p.vy = 0; p.stun = 0; p.slide = 0; p.fy = st.dir[p.team]; p.fx = 0; }
      const taker = teamOf(kickTeam).find(p => p.slot === 9) || teamOf(kickTeam)[9];
      taker.x = W / 2; taker.y = H / 2 + st.dir[kickTeam] * -10;
      const helper = teamOf(kickTeam).find(p => p.slot === 10 && !p.benched); if (helper) { helper.x = W / 2 - 40; helper.y = H / 2 + st.dir[kickTeam] * -28; }
      ball.x = W / 2; ball.y = H / 2; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; ball.owner = taker; ball.lastTeam = kickTeam; ball.passTarget = null; ball.assist = null;
      st.cam.x = W / 2; st.cam.y = H / 2;
    }
    function rate(d) { const r = st.user.rating; if (d > 0 && r > 7) d *= Math.max(0.15, (10 - r) / 3); st.user.rating = clamp(r + d, 2, 10); }
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
      const spread = ((100 - p.attrs.sho) * 1.3 + 30) * (rnd() - 0.5) * (p.isUser ? 0.85 : 1.9 / (p.team === 1 ? DF.aiAcc : DF.mateQ)) * (1 + power * 0.4);
      const tx = gx + spread, ty = gy;
      const v = (p.isUser ? 250 : 210) + power * (p.isUser ? 190 : 150) + p.attrs.sho * 0.8;
      kick(p, tx - p.x, ty - p.y, v, 30 + power * 70 + rnd() * 30);
      ball.shotT = 0; ball.shotPower = power; ball.shotDist = Math.hypot(W / 2 - p.x, gy - p.y); st.teamShots[p.team]++;
      const onT = Math.abs(tx - W / 2) < GOAL_W / 2 - 4;
      if (p.isUser) { st.user.shots++; if (onT) st.user.onTarget++; rate(onT ? 0.1 : -0.06); }
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
        if (q.isUser && !p.isUser) s += 90 + opts.chem * 1.3 + (q.calling > 0 ? 160 : 0); // teammates look for you, more with chemistry, much more when you call
        if (s > bestS) { bestS = s; best = q; }
      }
      return best;
    }
    function keeperDistribute(p) {
      const gy = ownGoalY(p.team); const opps = teamOf(1 - p.team);
      const mates = teamOf(p.team).filter(q => q !== p);
      const space = q => { let m = 999; for (const o of opps) m = Math.min(m, dist(o, q)); return m; };
      // short options: teammates within 260 with room around them
      const shortOpts = mates.filter(q => dist(q, p) < 260 && space(q) > 45).sort((x, y) => space(y) - space(x));
      if (shortOpts.length) { passTo(p, shortOpts[0], 1.0); return; }
      // otherwise a long ball to the most open teammate up the pitch, dropped in front of them
      const longOpts = mates.filter(q => Math.abs(q.y - gy) > 300).sort((x, y) => space(y) - space(x));
      const q = longOpts[0] || mates.sort((x, y) => Math.abs(y.y - gy) - Math.abs(x.y - gy))[0];
      passTo(p, q, 0.9, true);
    }
    function passTo(p, q, scale, long) {
      const lead = 0.35; const tx = q.x + q.vx * lead, ty = q.y + q.vy * lead;
      const d = Math.hypot(tx - p.x, ty - p.y);
      const err = (100 - p.attrs.pas) * (long ? 0.6 : 0.4);
      kick(p, tx - p.x + (rnd() - 0.5) * err, ty - p.y + (rnd() - 0.5) * err, clamp(d * 1.5 * scale, 150, long ? 360 : 320), long ? 150 : d > 220 ? 50 : 0, q);
      ball.assist = p; ball.assistT = 0; st.teamPasses[p.team]++; if (q.isUser && !p.isUser) st.passesToUser++;
      emit('pass', { p, q });
    }
    function pass(p, aimx, aimy, useAim) {
      const q = bestPassTarget(p, aimx, aimy, useAim);
      if (!q) { kick(p, aimx || p.fx, aimy || p.fy, 220, 0); return; }
      const lead = 0.35; const tx = q.x + q.vx * lead, ty = q.y + q.vy * lead;
      const d = Math.hypot(tx - p.x, ty - p.y);
      const err = (100 - p.attrs.pas) * 0.5 / (p.isUser ? 1 : p.team === 1 ? DF.aiAcc : DF.mateQ); const ex = (rnd() - 0.5) * err, ey = (rnd() - 0.5) * err;
      kick(p, tx - p.x + ex, ty - p.y + ey, clamp(d * 1.5, 150, 340), d > 220 ? 50 : 0, q);
      ball.assist = p; ball.assistT = 0; st.teamPasses[p.team]++; if (q.isUser && !p.isUser) st.passesToUser++;
      if (p.isUser) st.user.passes++;
      emit('pass', { p, q });
    }

    // ---- AI ----
    function aiTarget(p) {
      const ownerTeam = ball.owner ? ball.owner.team : -1;
      const h = homePos(p);
      let tx = h.x + (ball.x - W / 2) * 0.3, ty = h.y + (ball.y - H / 2) * 0.35;
      const push = ownerTeam === p.team ? 55 : ownerTeam === 1 - p.team ? -60 : 0;
      ty += st.dir[p.team] * push;
      // offside line: never stand beyond the last outfield defender (or the ball) when attacking
      if (p.slot >= 6 && ownerTeam !== 1 - p.team) {
        const gy = goalY(p.team); const defs = teamOf(1 - p.team).filter(o => !o.isGK).map(o => o.y);
        const line = st.dir[p.team] < 0 ? Math.min(...defs) : Math.max(...defs);
        // a run may go 25 units past the line (the AI cannot time runs, so it gets a margin), never closer than 85 to goal
        if (st.dir[p.team] < 0) ty = Math.max(ty, Math.min(line, ball.y) - 25); else ty = Math.min(ty, Math.max(line, ball.y) + 25);
        if (Math.abs(ty - gy) < 85) ty = gy + (gy === 0 ? 85 : -85);
      }
      if (p.isGK) return gkTarget(p);
      const mates = teamOf(p.team).filter(q => !q.isGK && !q.isUser);
      const byDist = mates.slice().sort((a, b) => dist(a, ball) - dist(b, ball));
      const rank = byDist.indexOf(p);
      if (ownerTeam !== p.team) { // chase / press
        const og = ownGoalY(p.team); const danger = Math.abs(ball.y - og) < H * 0.36;
        if (rank === 0 || (rank === 1 && ownerTeam === 1 - p.team)) {
          const o = ball.owner || ball;
          if (ball.owner && ball.owner.isGK) { const gy = ownGoalY(ball.owner.team); const standY = gy + (gy === 0 ? 150 : -150); return { x: clamp(o.x + (p.x < o.x ? -60 : 60), 40, W - 40), y: standY }; }
          return { x: o.x, y: o.y, chase: true };
        }
        if (danger && p.slot >= 1 && p.slot <= 4) { const o = ball.owner || ball; return { x: tx * 0.7 + o.x * 0.3, y: ty * 0.7 + o.y * 0.3 }; }
      } else if (ball.passTarget === p) return { x: ball.x + ball.vx * 0.3, y: ball.y + ball.vy * 0.3, chase: true };
      // make a run when your team attacks
      if (ownerTeam === p.team && p.slot >= 8 && rnd() < 0.5) ty += st.dir[p.team] * 25;
      return { x: clamp(tx, 20, W - 20), y: clamp(ty, 20, H - 20) };
    }
    function gkTarget(p) {
      const gy = ownGoalY(p.team); const lineY = gy + (gy === 0 ? 16 : -16);
      const toward = ball.owner ? false : (gy === 0 ? ball.vy < -40 : ball.vy > 40);
      const lineY0 = lineY;
      // reaction time on the user's shots: the keeper does not move until the ball is on its way
      if (toward && ball.lastKicker && ball.lastKicker.isUser && (ball.shotT || 0) < 0.12) return { x: clamp(p.x, GX0 + 10, GX1 - 10), y: lineY0 };
      if (toward && Math.abs(ball.y - gy) < 320) {
        const t = Math.abs((lineY - ball.y) / (ball.vy || 1)); const px = clamp(ball.x + ball.vx * t, GX0 - 10, GX1 + 10);
        return { x: px, y: lineY, dive: true };
      }
      // an opponent dribbling into the box: come off the line and claim it
      if (ball.owner && ball.owner.team !== p.team && Math.abs(ball.y - gy) < 140 && Math.abs(ball.x - W / 2) < 170) return { x: ball.owner.x, y: ball.owner.y, chase: true, rush: true };
      const bx = clamp(W / 2 + (ball.x - W / 2) * 0.6, GX0 + 10, GX1 - 10);
      const out = ball.owner && ball.owner.team !== p.team && Math.abs(ball.y - gy) < 220 ? 30 : 0;
      return { x: bx, y: lineY + (gy === 0 ? out : -out) };
    }
    function aiDecide(p, dt) {
      p.decide -= dt; if (p.decide > 0) return; p.decide = 0.18 + rnd() * 0.12;
      if (ball.owner !== p) return;
      const gy = goalY(p.team); const dG = Math.hypot(W / 2 - p.x, gy - p.y);
      if (p.isGK) { if (p.hold === undefined) p.hold = 0.7; p.hold -= 0.25; if (p.hold <= 0) { p.hold = undefined; keeperDistribute(p); } return; }
      let minOpp = 999, nearest = null; for (const o of teamOf(1 - p.team)) { const d = dist(o, p); if (d < minOpp) { minOpp = d; nearest = o; } }
      const central = Math.abs(p.x - W / 2) < 170;
      const shotMul = p.team === 1 ? DF.aiShot : 0.75;
      if (dG < 95 && rnd() < 0.9) { shoot(p, 0.4 + rnd() * 0.5, (rnd() - 0.5) * 1.8); return; }
      if (p.fresh && dG < 200 && Math.abs(p.x - W / 2) < 190 && rnd() < 0.45 * shotMul) { p.fresh = false; shoot(p, 0.6 + rnd() * 0.4, (rnd() - 0.5) * 1.2); return; }
      p.fresh = false;
      if (minOpp < 26 && dG < 230 && Math.abs(p.x - W / 2) < 190 && rnd() < 0.35 * shotMul) { shoot(p, 0.5 + rnd() * 0.5, (rnd() - 0.5) * 1.3); return; }
      if (dG < 210 && central) {
        let lane = true; for (const o of teamOf(1 - p.team)) { if (o.isGK) continue; const t = ((o.x - p.x) * (W / 2 - p.x) + (o.y - p.y) * (gy - p.y)) / (dG * dG); if (t > 0.05 && t < 0.9) { const lx = p.x + (W / 2 - p.x) * t, ly = p.y + (gy - p.y) * t; if (Math.hypot(o.x - lx, o.y - ly) < 14) lane = false; } }
        if (rnd() < ((lane ? 0.12 : 0.04) + (210 - dG) / 210 * 0.3 + (minOpp < 25 ? 0.1 : 0)) * shotMul) { shoot(p, 0.5 + rnd() * 0.5, (rnd() - 0.5) * 1.2); return; }
      }
      if (minOpp < 48 && rnd() < 0.75) { const q = bestPassTarget(p, 0, st.dir[p.team], false); if (q) { pass(p, 0, 0, false); return; } }
      { const q = bestPassTarget(p, 0, st.dir[p.team], false); const ahead = q && Math.abs(q.y - gy) < Math.abs(p.y - gy) - 40;
        if (q && rnd() < (q.isUser ? (q.calling > 0 ? 0.6 : 0.3) : ahead ? 0.2 : 0.06)) { pass(p, 0, 0, false); return; } }
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
        if (ball.owner === user) { const power = clamp(held / 0.8, 0.25, 1); if (isGKUser) kick(user, aimx, aimy || st.dir[0], 330 + power * 150, 130); else shoot(user, power, s.active ? s.x * (st.dir[0] < 0 ? 1 : -1) : 0); }
        else if (!isGKUser) rate(0); // nothing
      }
      if (id === 'pass') { if (ball.owner === user) { if (isGKUser && !s.active) keeperDistribute(user); else pass(user, aimx, aimy, s.active); } else { user.calling = 1.5; } }
      if (id === 'skill') {
        if (ball.owner === user && !isGKUser) { if (user.stamina > 20) { user.sprint = 0.9; user.stamina -= 20; } }
        else if (user.slide <= 0 && user.stun <= 0) { user.slide = isGKUser ? 0.4 : 0.45; user.sx = aimx; user.sy = aimy;
          if (!s.active) { if (isGKUser && !ball.owner) { const dx = ball.x - user.x, dy = ball.y - user.y, d = Math.hypot(dx, dy) || 1; user.sx = dx / d; user.sy = dy / d; } else { user.sx = user.fx; user.sy = user.fy; } } }
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
      if (st.phase === 'goal') {
        const c = st.celebration;
        if (c) {
          const sc = c.scorer; const arrive = dist(sc, c) < 14;
          if (!arrive && st.phaseT < 2.2) movePlayer(sc, c.cx, c.cy, dt, 1.15); else { sc.vx = sc.vy = 0; sc.pose = c.big && st.phaseT > 1.2 ? 'kneel' : 'cheer'; }
          c.mates.forEach((m, i) => { const tx = sc.x + Math.cos(i * 1.1) * 22, ty = sc.y + Math.sin(i * 1.1) * 14; if (dist(m, { x: tx, y: ty }) > 6 && st.phaseT < 3.2) movePlayer(m, tx, ty, dt, 1.0); else { m.vx = m.vy = 0; m.pose = 'cheer'; } });
          if (c.big && st.phaseT < 4 && rnd() < 0.5) { burst(sc.x + (rnd() - 0.5) * 120, sc.y - 60 - rnd() * 80, 10, 'firework'); }
          if (c.big && st.phaseT < 2 && rnd() < 0.6) burst(sc.x + (rnd() - 0.5) * 200, sc.y - 120, 4, 'confetti');
          if (!c.big && st.phaseT < 0.3) burst(sc.x, sc.y - 30, 10, 'confetti');
        }
        if (st.phaseT > (st.goalDur || 2.2)) { onPitch().forEach(p => { p.pose = null; }); st.celebration = null; reset(1 - st.lastGoalTeam); st.phase = 'kickoff'; st.phaseT = 0; }
        return;
      }
      if (st.phase === 'restart') { if (st.phaseT > 1.2) { applyRestart(); st.phase = 'play'; } return; }
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
      ball.assistT += dt; ball.shotT = (ball.shotT || 0) + dt;
      // players
      for (const p of onPitch()) {
        p.cool = Math.max(0, p.cool - dt); p.stun = Math.max(0, p.stun - dt); p.calling = Math.max(0, (p.calling || 0) - dt);
        if (p.slide > 0) { p.slide -= dt; p.x += (p.sx || p.fx) * speedOf(p) * 1.7 * dt; p.y += (p.sy || p.fy) * speedOf(p) * 1.7 * dt; p.step += dt * 8; if (p.slide <= 0) p.stun = 0.45; }
        else if (p.isUser) {
          const s = ctl.state; p.sprint = Math.max(0, p.sprint - dt);
          if (p.stamina < 100) p.stamina += dt * (ball.owner === p ? 5 : 9);
          if (s.active && p.stun <= 0) { const mul = (p.sprint > 0 ? 1.35 : 1) * (ball.owner === p ? 0.95 : 1); const mag = Math.hypot(s.x, s.y) || 1; const k = Math.min(1, mag / 0.55); const sp = speedOf(p) * mul * k; p.vx = s.x / mag * sp; p.vy = s.y / mag * sp; p.x += p.vx * dt; p.y += p.vy * dt; p.fx = s.x / (Math.hypot(s.x, s.y) || 1); p.fy = s.y / (Math.hypot(s.x, s.y) || 1); p.step += dt * 14 * mul; }
          else if (isGKUser && ball.owner !== p) { const t = gkTarget(p); movePlayer(p, t.x, t.y, dt, t.dive ? 1.4 : 0.7); } // keeper assist when the stick is idle
          else { p.vx = p.vy = 0; }
        } else {
          aiDecide(p, dt);
          if (ball.owner === p) { const d = p.dribble || { x: 0, y: st.dir[p.team] }; movePlayer(p, p.x + d.x * 60, p.y + d.y * 60, dt, 0.88); }
          else { const t = aiTarget(p); movePlayer(p, t.x, t.y, dt, t.dive ? 2.2 : t.rush ? 1.4 : t.chase ? 1.05 : 0.85); }
        }
        p.x = clamp(p.x, -8, W + 8); p.y = clamp(p.y, p.isGK ? 4 : -10, p.isGK ? H - 4 : H + 10);
      }
      // separation
      const ps = onPitch();
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const a = ps[i], b = ps[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d < 13 && d > 0.01) { const push = (13 - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push; } }
      // ball
      if (ball.owner) {
        const o = ball.owner; ball.x = o.x + o.fx * 12; ball.y = o.y + o.fy * 12; ball.z = 0; ball.vx = o.vx; ball.vy = o.vy;
        if ((ball.y < 0 || ball.y > H) && ball.x > GX0 && ball.x < GX1) { ball.lastKicker = o; ball.lastTeam = o.team; ball.owner = null; goal(ball.y < 0 ? (st.dir[0] < 0 ? 0 : 1) : (st.dir[0] > 0 ? 0 : 1)); return; }
        if (ball.x < 0 || ball.x > W || ball.y < 0 || ball.y > H) { ball.lastTeam = o.team; ball.owner = null; restart(); return; }
        // tackles
        for (const d of teamOf(1 - o.team)) {
          const dd = dist(d, o); if (dd > (o.isUser ? 14 : 17) && !(d.slide > 0 && dd < 24)) continue;
          const gkClaim = d.isGK && Math.abs(o.y - ownGoalY(d.team)) < 150;
          if (d.stun > 0 || (d.isGK && !d.isUser && !gkClaim)) continue;
          d.contest += dt; const interval = d.slide > 0 ? 0 : o.isUser ? 0.5 : 0.3;
          if (d.contest >= interval) {
            d.contest = 0;
            let pr = 0.28 + (d.attrs.def - o.attrs.dri) * 0.006 + (d.slide > 0 ? 0.32 : 0) + (gkClaim ? 0.35 : 0);
            if (d.isUser) pr = (pr + 0.05) * DF.userTackle;
            if (o.isUser) { pr = (pr - 0.06) * DF.aiTackle; if (o.sprint > 0) pr *= 0.55; }
            else if (d.team === 1) pr *= 0.7 + DF.aiTackle * 0.3;
            if (rnd() < clamp(pr, 0.05, 0.9)) {
              o.stun = 0.5; ball.owner = d; d.cool = 0.15; ball.lastTeam = d.team; ball.passTarget = null; ball.assist = null; if (d.isGK) { d.hold = 0.9; emit('save', { p: d, big: false, claim: true }); }
              if (d.isUser) { st.user.tackles++; st.user.keys++; rate(0.2); emit('tackle', { p: d }); }
              if (o.isUser) { st.user.lost++; rate(-0.07); }
              d.slide = Math.min(d.slide, 0.1);
            } else if (d.slide > 0) { d.slide = 0; d.stun = 0.6; }
          }
        }
      } else {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; ball.vz -= 420 * dt;
        if (ball.z <= 0) { ball.z = 0; if (ball.vz < -60) ball.vz = -ball.vz * 0.45; else ball.vz = 0; }
        const f = ball.z > 0 ? 0.25 : 1.5; ball.vx -= ball.vx * f * dt; ball.vy -= ball.vy * f * dt;
        const sp = Math.hypot(ball.vx, ball.vy);
        // goal?
        if ((ball.y < 0 || ball.y > H) && ball.x > GX0 && ball.x < GX1 && ball.z < 60) { goal(ball.y < 0 ? (st.dir[0] < 0 ? 0 : 1) : (st.dir[0] > 0 ? 0 : 1)); return; }
        // out of play
        if (ball.x < -4 || ball.x > W + 4 || ball.y < -4 || ball.y > H + 4) { restart(); return; }
        // pickups / saves
        let taker = null, best = 99;
        for (const p of onPitch()) {
          if (p.cool > 0 || p.stun > 0) continue;
          const userShot = ball.lastKicker && ball.lastKicker.isUser && ball.lastTeam !== p.team;
          const reach = (p.isGK ? (userShot ? 22 + p.attrs.def * 0.1 : 32 + p.attrs.def * 0.18) : 13) + (ball.passTarget === p ? 8 : 0) + (p.slide > 0 ? (p.isGK ? 16 : 8) : 0) + (p.isUser ? 2 : 0);
          const d = dist(p, ball); if (d > reach || d >= best) continue;
          if (ball.z > (p.isGK || p.slide > 0 ? 70 : 28) && !(ball.z < 45 && p.attrs.phy > 60)) continue;
          if (sp > (p.isGK ? 900 : ball.passTarget === p ? 420 : 300)) continue;
          taker = p; best = d;
        }
        if (taker) {
          if (taker.isGK && sp > 200 && ball.lastTeam !== taker.team) {
            let pr = clamp(0.9 + (taker.attrs.def - 55) * 0.006 - (sp - 200) * 0.0006 - (ball.z > 30 ? 0.1 : 0), 0.3, 0.97);
            if (ball.lastKicker && ball.lastKicker.isUser) { // your shots: power and placement beat the keeper
              const nearPost = Math.abs(ball.x - W / 2) > 42 ? 0.18 : 0;
              const far = ball.shotDist > 190 ? 0.14 : ball.shotDist > 150 ? 0.05 : 0; // long-range shots are the keeper's friend
              pr = clamp(0.57 + (taker.attrs.def - 55) * 0.005 - (sp - 350) * 0.0007 - nearPost - (ball.z > 30 ? 0.05 : 0) + far, 0.12, 0.85);
            }
            if (taker.team === 1 && ball.lastKicker && ball.lastKicker.isUser) pr = clamp(pr * DF.gk, 0.08, 0.98);
            else if (taker.team === 1) pr = clamp(pr * (0.85 + DF.gk * 0.15), 0.3, 0.98);
            if (taker.isUser && taker.slide > 0) pr = clamp(pr + 0.2, 0, 0.97);
            if (rnd() < pr) { ball.owner = taker; taker.cool = 0.1; st.gkSaves[taker.team]++; if (taker.isUser) { st.user.saves++; rate(0.5); } emit('save', { p: taker, big: sp > 520 }); ball.vx = ball.vy = 0; ball.passTarget = null; ball.assist = null; taker.hold = 0.8; }
            else { taker.cool = 0.4; ball.vy = -ball.vy * 0.45; ball.vx = ball.vx * 0.3 + (rnd() - 0.5) * 220; ball.vz = 110; emit('save', { p: taker, big: true, parry: true }); } // parried away
            return;
          }
          const wasTeam = ball.lastTeam; ball.owner = taker; taker.cool = 0.12; ball.vx = ball.vy = 0; taker.fresh = true; taker.decide = Math.min(taker.decide, 0.08);
          if (taker.team !== wasTeam) { ball.assist = null; if (ball.lastKicker && ball.lastKicker.isUser && ball.passTarget) { rate(-0.1); } if (taker.isUser) { st.user.keys++; rate(0.15); } }
          else if (ball.passTarget === taker && ball.lastKicker && ball.lastKicker.isUser) { st.user.passesOk++; rate(0.05); }
          if (taker.isUser) st.user.touches++;
          ball.lastTeam = taker.team; ball.passTarget = null;
        }
      }
      st.shake = Math.max(0, st.shake - dt);
    }
    const particles = [];
    function burst(x, y, n, kind) { for (let i = 0; i < n; i++) { const ang = rnd() * Math.PI * 2, sp = 40 + rnd() * (kind === 'firework' ? 160 : 90); particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (kind === 'confetti' ? 60 : 20), life: 1.2 + rnd() * 1.4, c: ['#f3c34f', '#ff5a5a', '#63b3ff', '#4fd37f', '#ffffff', '#ff3cac'][i % 6], s: kind === 'firework' ? 2 : 3, kind }); } }
    function goal(team) {
      st.score[team]++; st.lastGoalTeam = team; st.phase = 'goal'; st.phaseT = 0; st.shake = 0.6;
      const scorer = ball.lastKicker && ball.lastKicker.team === team ? ball.lastKicker : null;
      const assist = ball.assist && ball.assist.team === team && ball.assist !== scorer && ball.assistT < 7 ? ball.assist : null;
      const minute = Math.min(45, Math.floor(st.t / st.secondsPerHalf * 45)) + (st.half === 2 ? 45 : 0);
      const late = minute >= 85, hattrick = scorer && scorer.isUser && st.user.goals + 1 === 3;
      if (scorer && scorer.isUser) { st.user.goals++; rate(0.9); }
      if (assist && assist.isUser) { st.user.assists++; rate(0.6); }
      if (team !== 0 && isGKUser && !user.benched) rate(-0.2);
      // celebration: the scorer runs to the corner, teammates mob him; late goals get the knee slide and the fireworks
      const ourGoal = team === 0 && scorer;
      const big = ourGoal && (late || hattrick);
      st.goalDur = ourGoal ? (big ? 5.2 : 3.4) : 2.2;
      if (ourGoal) {
        const gy = goalY(team); const cx = scorer.x < W / 2 ? 40 : W - 40, cy = gy === 0 ? 70 : H - 70;
        st.celebration = { scorer, late, hattrick, big, cx, cy, mates: teamOf(team).filter(p => p !== scorer && !p.isGK).sort((a, b) => dist(a, scorer) - dist(b, scorer)).slice(0, big ? 9 : 4) };
        if (big) st.shake = 1.4;
      } else st.celebration = null;
      banner(team === 0 ? (hattrick ? 'HAT-TRICK!' : late ? `LATE DRAMA! ${minute}'` : 'GOAL!') : 'GOAL ' + opts.opp.name.toUpperCase(), big ? 4500 : 2000);
      emit('goal', { team, scorer, assist, score: st.score.slice(), minute, late, hattrick, big });
      ball.owner = null; ball.vx = ball.vy = 0;
    }
    function restart() {
      const toTeam = 1 - ball.lastTeam;
      const goalLine = ball.y < 0 || ball.y > H;
      const gy = ball.y < 0 ? 0 : H;
      const defendsThatGoal = ownGoalY(0) === gy ? 0 : 1;
      let type, taker, bx = clamp(ball.x, 8, W - 8), by = clamp(ball.y, 8, H - 8);
      if (goalLine && toTeam === defendsThatGoal) { type = 'GOAL KICK'; taker = teamOf(toTeam).find(p => p.isGK); bx = W / 2; by = gy === 0 ? 60 : H - 60; }
      else if (goalLine) { type = 'CORNER'; taker = teamOf(toTeam).filter(p => !p.isGK).sort((a, b) => dist(a, ball) - dist(b, ball))[0]; bx = ball.x < W / 2 ? 8 : W - 8; by = gy === 0 ? 8 : H - 8; }
      else { type = 'THROW-IN'; taker = teamOf(toTeam).filter(p => !p.isGK).sort((a, b) => dist(a, ball) - dist(b, ball))[0]; bx = ball.x < W / 2 ? 4 : W - 4; }
      ball.owner = null; ball.vx = ball.vy = ball.vz = 0; ball.z = 0; ball.x = clamp(ball.x, -3, W + 3); ball.y = clamp(ball.y, -3, H + 3); ball.passTarget = null; ball.assist = null;
      st.restart = { type, taker, bx, by, toTeam }; st.phase = 'restart'; st.phaseT = 0;
      banner(type + (toTeam === 0 ? ' · ' + opts.club.name.toUpperCase() : ' · ' + opts.opp.name.toUpperCase()), 1400);
      emit('out', { type, team: toTeam });
    }
    function applyRestart() {
      const r = st.restart; if (!r) return; const taker = r.taker;
      taker.x = r.bx; taker.y = r.by; taker.vx = taker.vy = 0; taker.fx = r.bx < W / 2 ? 1 : -1; taker.fy = 0;
      ball.x = r.bx; ball.y = r.by; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; ball.owner = taker; ball.lastTeam = r.toTeam; ball.passTarget = null; ball.assist = null; taker.cool = 0.2; taker.hold = 0.6;
      for (const o of teamOf(1 - r.toTeam)) { const d = dist(o, taker); if (d < 45) { const ang = Math.atan2(o.y - taker.y, o.x - taker.x); o.x = clamp(taker.x + Math.cos(ang) * 50, 6, W - 6); o.y = clamp(taker.y + Math.sin(ang) * 50, 6, H - 6); } }
      if (r.type === 'GOAL KICK') { const gy = ownGoalY(r.toTeam); for (const o of teamOf(1 - r.toTeam)) { if (Math.abs(o.y - gy) < 200) o.y = gy + (gy === 0 ? 200 + rnd() * 40 : -200 - rnd() * 40); } }
      st.restart = null;
    }

    // ---- render ----
    let zoom = 1, cw = 0, ch = 0;
    function resize() {
      const w = stage.clientWidth || window.innerWidth; const h = stage.clientHeight || window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      cw = w; ch = h; zoom = Math.min(w / 210, h / 330) * dpr; ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    window.addEventListener('resize', resize); resize();
    function draw() {
      const dpr = canvas.width / cw;
      const focus = user.benched ? ball : isGKUser ? { x: user.x * 0.3 + ball.x * 0.7, y: user.y * 0.3 + ball.y * 0.7 } : { x: user.x * 0.6 + ball.x * 0.4, y: user.y * 0.6 + ball.y * 0.4 };
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
        SP.drawFigure(ctx, p.x, p.y, 1.0, p.look, p.kit, { step: moving ? p.step : (p.pose === 'cheer' ? performance.now() / 90 : 0), slide: p.slide > 0, gloves: p.isGK, number: p.number, acc: p.isUser ? opts.user.acc : undefined, pose: p.pose });
        if (p.isUser) { ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(p.x - 4, p.y - 30); ctx.lineTo(p.x + 4, p.y - 30); ctx.lineTo(p.x, p.y - 25); ctx.closePath(); ctx.fill(); }
        if (p.calling > 0) { ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText('HERE!', p.x, p.y - 33); }
      }
      for (const q of particles) { ctx.fillStyle = q.c; ctx.globalAlpha = Math.min(1, q.life); ctx.fillRect(q.x, q.y, q.s, q.s); } ctx.globalAlpha = 1;
      // charge meter
      if (charging && ball.owner === user) { const c = clamp((performance.now() - ctl.state.pressed.shoot) / 800, 0, 1); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(user.x - 12, user.y + 6, 24, 4); ctx.fillStyle = c > 0.8 ? '#ff5a5a' : '#ffe14d'; ctx.fillRect(user.x - 12, user.y + 6, 24 * c, 4); }
      // HUD
      const min = Math.min(45, Math.floor(st.t / st.secondsPerHalf * 45)) + (st.half === 2 ? 45 : 0);
      hud.score.textContent = `${opts.club.name} ${st.score[0]} – ${st.score[1]} ${opts.opp.name}`;
      hud.clock.textContent = `${min}' · ${DF.name}`; hud.rating.textContent = user.benched && !st.subbed ? 'BENCH' : st.user.rating.toFixed(1);
      ctl.setLabel('skill', isGKUser ? 'DIVE' : ball.owner === user ? 'SPRINT' : 'SLIDE', isGKUser ? '' : ball.owner === user ? `stamina ${Math.round(user.stamina)}` : 'tackle');
    }

    // ---- loop ----
    let last = performance.now(), raf = 0, alive = true;
    function updateParticles(dt) { for (let i = particles.length - 1; i >= 0; i--) { const q = particles[i]; q.life -= dt; if (q.life <= 0) { particles.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 'confetti' ? 60 : 30) * dt; q.vx *= 0.98; } }
    function frame(now) {
      if (!alive) return;
      let dt = Math.min(0.033, (now - last) / 1000) * st.timeScale; last = now;
      updateParticles(dt);
      const steps = Math.max(1, Math.ceil(dt / 0.033));
      for (let i = 0; i < steps; i++) update(dt / steps);
      draw(); raf = requestAnimationFrame(frame);
    }
    function finish() {
      if (st.ended) return; st.ended = true; alive = false; cancelAnimationFrame(raf);
      banner('FULL TIME', 2500);
      const u = st.user; if (!user.benched || st.subbed) u.rating = clamp(u.rating + DF.bonus, 2, 10);
      const res = { difficulty: DF.name, score: st.score.slice(), teamShots: st.teamShots.slice(), teamPasses: st.teamPasses.slice(), passesToUser: st.passesToUser, gkSaves: st.gkSaves.slice(), rating: u.rating, goals: u.goals, assists: u.assists, saves: u.saves, keys: u.keys, shots: u.shots, onTarget: u.onTarget, passes: u.passes, passesOk: u.passesOk, tackles: u.tackles, touches: u.touches, played: !user.benched || st.subbed };
      emit('fulltime', res);
      setTimeout(() => { if (opts.onEnd) opts.onEnd(res); }, 900);
    }
    reset(rnd() < 0.5 ? 0 : 1);
    banner('KICK OFF', 1200); emit('kickoff');
    raf = requestAnimationFrame(frame);
    return { destroy() { alive = false; cancelAnimationFrame(raf); ctl.destroy(); window.removeEventListener('resize', resize); host.innerHTML = ''; }, state: st, players, ball, user, endNow() { st.phase = 'end'; finish(); },
      debugShot(power, aim, x, y) { user.x = x; user.y = y; user.fy = st.dir[0]; user.fx = 0; ball.owner = user; user.cool = 0; shoot(user, power, aim); } };
  }
  root.PPL_ARCADE = { start, W, H, DIFFICULTY, DIFF_ORDER };
})(typeof window !== 'undefined' ? window : globalThis);
