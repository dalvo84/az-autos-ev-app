/* Pocket Pro League — game engine (pure logic, no DOM) */
(function (root) {
  'use strict';
  const D = root.PPL_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);

  // ---------- RNG ----------
  const rnd = () => Math.random();
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const E_clamp = clamp;
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const poisson = lambda => { const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };

  // ---------- OVR ----------
  const ATTRS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
  function calcOVR(attrs, pos) {
    const w = D.POSITIONS[pos].w;
    let s = 0; for (const a of ATTRS) s += attrs[a] * w[a];
    return Math.round(s);
  }
  // Generate attributes near a target OVR for a position
  function genAttrs(pos, target) {
    const w = D.POSITIONS[pos].w;
    const attrs = {};
    for (const a of ATTRS) {
      const emphasis = (w[a] - 0.1667) * 60; // + for key attrs, - for weak
      attrs[a] = clamp(Math.round(target + emphasis + ri(-6, 6)), 20, 95);
    }
    // nudge to hit target
    for (let i = 0; i < 30; i++) {
      const o = calcOVR(attrs, pos);
      if (o === target) break;
      const a = pick(ATTRS);
      attrs[a] = clamp(attrs[a] + (o < target ? 1 : -1), 20, 95);
    }
    return attrs;
  }
  function weightedAttr(pos) {
    const w = D.POSITIONS[pos].w; let r = rnd();
    for (const a of ATTRS) { r -= w[a]; if (r <= 0) return a; }
    return 'phy';
  }

  // ---------- Names ----------
  function poolFor(nat) {
    const key = nat.replace(' ', '_');
    return D.NAME_POOLS[key] || D.NAME_POOLS.England;
  }
  function genPerson(nat, used) {
    const pool = poolFor(nat);
    for (let tries = 0; tries < 40; tries++) {
      const f = pick(pool.first), l = pick(pool.last);
      const name = f + ' ' + l[0];
      if (!used.has(name)) { used.add(name); return { first: f, last: l[0], name, pron: l[1], nat }; }
    }
    const f = pick(pool.first), l = pick(pool.last);
    return { first: f, last: l[0] + ' II', name: f + ' ' + l[0] + ' II', pron: l[1], nat };
  }
  const FORMATION = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'ST', 'LW'];
  function genTeammates(playerPos, playerNat, clubStr, clubCountry) {
    const slots = FORMATION.slice();
    const idx = slots.indexOf(playerPos);
    if (idx >= 0) slots.splice(idx, 1); else slots.pop();
    const used = new Set();
    const nats = D.NATIONALITIES;
    return slots.map(pos => {
      let nat = clubCountry && rnd() < 0.5 ? clubCountry : (rnd() < 0.3 ? playerNat : pick(nats));
      if (!poolFor(nat)) nat = 'England';
      const p = genPerson(nat, used);
      const attrs = genAttrs(pos, clamp(clubStr + ri(-7, 4), 40, 92));
      return Object.assign(p, { pos, attrs, ovr: calcOVR(attrs, pos) });
    });
  }

  // ---------- Fixtures & tables ----------
  function roundRobin(n) {
    const ids = []; for (let i = 0; i < n; i++) ids.push(i);
    if (n % 2) ids.push(-1);
    const m = ids.length, rounds = [];
    for (let r = 0; r < m - 1; r++) {
      const pairs = [];
      for (let i = 0; i < m / 2; i++) {
        const a = ids[i], b = ids[m - 1 - i];
        if (a >= 0 && b >= 0) pairs.push(r % 2 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      ids.splice(1, 0, ids.pop());
    }
    const second = rounds.map(ps => ps.map(([h, a]) => [a, h]));
    return shuffle(rounds).concat(shuffle(second));
  }
  function freshLeague(def) {
    const clubs = def.teams.map(([name, str], i) => ({ id: def.id + i, name, str, league: def.id }));
    return { id: def.id, name: def.name, country: def.country, tier: def.tier, wageMult: def.wageMult,
      clubs, rounds: roundRobin(clubs.length), round: 0,
      table: clubs.map(() => ({ p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })) };
  }
  function newWorld() { return D.LEAGUES.map(freshLeague); }
  function resetSeason(world) { world.forEach(lg => { const f = freshLeague(D.LEAGUES.find(d => d.id === lg.id)); lg.rounds = f.rounds; lg.round = 0; lg.table = f.table; }); }
  function xgFor(strH, strA) {
    const diff = strH - strA;
    return [1.25 * Math.exp(diff * 0.022) + 0.15, 1.25 * Math.exp(-diff * 0.022)];
  }
  function simScore(strH, strA) { const [xh, xa] = xgFor(strH, strA); return [poisson(xh), poisson(xa)]; }
  function applyResult(lg, h, a, gh, ga) {
    const H = lg.table[h], A = lg.table[a];
    H.p++; A.p++; H.gf += gh; H.ga += ga; A.gf += ga; A.ga += gh;
    if (gh > ga) { H.w++; A.l++; H.pts += 3; } else if (gh < ga) { A.w++; H.l++; A.pts += 3; } else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  function standings(lg) {
    return lg.clubs.map((c, i) => Object.assign({ club: c, idx: i }, lg.table[i]))
      .sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.club.name.localeCompare(y.club.name));
  }
  function nextFixtureFor(lg, clubIdx) {
    if (lg.round >= lg.rounds.length) return null;
    const pair = lg.rounds[lg.round].find(([h, a]) => h === clubIdx || a === clubIdx);
    if (!pair) return null;
    return { home: pair[0], away: pair[1], isHome: pair[0] === clubIdx, opp: pair[0] === clubIdx ? pair[1] : pair[0] };
  }
  // Advance every league one round; the player's fixture uses the supplied score
  function advanceWeek(world, playerLeagueId, playerClubIdx, playerScore) {
    const results = [];
    for (const lg of world) {
      if (lg.round >= lg.rounds.length) continue;
      for (const [h, a] of lg.rounds[lg.round]) {
        let gh, ga;
        if (lg.id === playerLeagueId && (h === playerClubIdx || a === playerClubIdx) && playerScore) {
          [gh, ga] = playerScore;
        } else [gh, ga] = simScore(lg.clubs[h].str, lg.clubs[a].str);
        applyResult(lg, h, a, gh, ga);
        if (lg.id === playerLeagueId) results.push({ h: lg.clubs[h].name, a: lg.clubs[a].name, gh, ga });
      }
      lg.round++;
    }
    return results;
  }

  // ---------- Match moments ----------
  // Each option: label, attr, diff (attr value giving ~50%), ok:{type,r,txt}, bad:{type,r,txt,concede}
  const T = {
    ATT: [
      { title: 'ONE ON ONE', setup: '{T} slides a ball through the middle. {P} is clean through, keeper rushing out!', opts: [
        { label: 'Low finish', attr: 'sho', diff: 73, ok: { type: 'goal', r: 1.2, txt: 'Low and hard into the corner. Keeper had no chance!' }, bad: { type: 'miss', r: -0.4, txt: 'Dragged wide of the near post. Head in hands.' } },
        { label: 'Chip the keeper', attr: 'dri', diff: 87, ok: { type: 'goal', r: 1.5, txt: 'Oh, that is OUTRAGEOUS. Dinked over the keeper. The place erupts!' }, bad: { type: 'miss', r: -0.6, txt: 'Tried the chip and the keeper just... caught it. Awkward.' } },
        { label: 'Round the keeper', attr: 'dri', diff: 81, ok: { type: 'goal', r: 1.3, txt: 'Takes it round the keeper and rolls it into the empty net. Cool as you like.' }, bad: { type: 'miss', r: -0.5, txt: 'Took it too wide, angle gone, and it trickles across the face of goal.' } },
        { label: 'Square it to {T}', attr: 'pas', diff: 53, ok: { type: 'assist', r: 0.8, txt: 'Unselfish. Squares it and {T} taps in. {P} with the assist.' }, bad: { type: 'lost', r: -0.4, txt: 'Tried to square it and a defender read it. Should have shot.' } } ] },
      { title: 'EDGE OF THE BOX', setup: 'Ball drops to {P} twenty yards out. Half a yard of space.', opts: [
        { label: 'Shoot', attr: 'sho', diff: 79, ok: { type: 'goal', r: 1.2, txt: 'Leathered it! Top corner from twenty yards!' }, bad: { type: 'miss', r: -0.3, txt: 'Sliced it into row Z. The crowd groans.' } },
        { label: 'Lay it off to {T}', attr: 'pas', diff: 38, ok: { type: 'good', r: 0.4, txt: 'Clever lay-off to {T}, whose shot is blocked. Good link play.' }, bad: { type: 'lost', r: -0.3, txt: 'Lazy pass, intercepted. They break.' , concede: 0.15 } },
        { label: 'Take on the defender', attr: 'dri', diff: 75, ok: { type: 'goal', r: 1.3, txt: 'Drops a shoulder, defender sits down, and slots it! Brilliant individual goal!' }, bad: { type: 'lost', r: -0.4, txt: 'Tried one trick too many and got dispossessed.' } } ] },
      { title: 'CROSS INCOMING', setup: '{T} whips one in from the right. {P} attacks the space at the far post.', opts: [
        { label: 'Header', attr: 'phy', diff: 75, ok: { type: 'goal', r: 1.2, txt: 'Rises highest and THUMPS a header past the keeper!' }, bad: { type: 'miss', r: -0.3, txt: 'Header looped over the bar. Good delivery from {T} wasted.' } },
        { label: 'Volley', attr: 'sho', diff: 85, ok: { type: 'goal', r: 1.3, txt: 'ON THE VOLLEY! That is a GOAL OF THE SEASON contender!' }, bad: { type: 'miss', r: -0.5, txt: 'Ambitious volley scuffed into the ground. Hard to do.' } },
        { label: 'Let it run to {T}', attr: 'pas', diff: 51, ok: { type: 'assist', r: 0.8, txt: 'Dummies it! Runs through to {T} who finishes. Cheeky assist for {P}.' }, bad: { type: 'miss', r: -0.3, txt: 'Dummied it and nobody was there. Awkward silence.' } } ] },
      { title: 'COUNTER ATTACK', setup: 'Turnover! {P} has grass in front and one defender back.', opts: [
        { label: 'Sprint at goal', attr: 'pac', diff: 73, ok: { type: 'goal', r: 1.2, txt: 'Burns the defender for pace and finishes! Pure speed!' }, bad: { type: 'miss', r: -0.3, txt: 'Caught by the recovering defender. Chance gone.' } },
        { label: 'Hold up, wait for {T}', attr: 'phy', diff: 61, ok: { type: 'assist', r: 0.8, txt: 'Holds off the defender, waits, slips in {T}. Goal! Textbook.' }, bad: { type: 'lost', r: -0.3, txt: 'Held it too long and the cavalry arrived. Tackled.' } },
        { label: 'Early shot from range', attr: 'sho', diff: 87, ok: { type: 'goal', r: 1.5, txt: 'From THIRTY yards! The keeper was off his line! Genius!' }, bad: { type: 'miss', r: -0.4, txt: 'Tried it from range and it went nowhere near.' } } ] },
      { title: 'PRESSING TRIGGER', setup: 'Their centre-back dawdles on the ball. {P} smells blood.', opts: [
        { label: 'Press hard', attr: 'phy', diff: 68, ok: { type: 'goal', r: 1.1, txt: 'Robs the defender and slots home! Pressing pays off!' }, bad: { type: 'miss', r: -0.2, txt: 'Defender cleared it just in time. Good energy though.' } },
        { label: 'Drop and hold shape', attr: 'pas', diff: 30, ok: { type: 'good', r: 0.2, txt: 'Disciplined. Holds the shape. Coach nods.' }, bad: { type: 'miss', r: -0.1, txt: 'Nothing comes of it.' } } ] },
    ],
    MID: [
      { title: 'BALL AT FEET, MIDFIELD', setup: '{P} receives on the half-turn. Options everywhere.', opts: [
        { label: 'Through ball to {T}', attr: 'pas', diff: 71, ok: { type: 'assist', r: 0.8, txt: 'Threads the eye of a needle! {T} finishes. What a pass from {P}!' }, bad: { type: 'lost', r: -0.4, txt: 'Overhit. Rolls through to the keeper.' } },
        { label: 'Switch play', attr: 'pas', diff: 44, ok: { type: 'good', r: 0.4, txt: 'Fifty-yard switch, inch perfect. Tempo controlled.' }, bad: { type: 'lost', r: -0.3, txt: 'Sliced the switch out of play.' } },
        { label: 'Drive forward', attr: 'dri', diff: 75, ok: { type: 'goal', r: 1.2, txt: 'Drives through two challenges and buries it! What a run!' }, bad: { type: 'lost', r: -0.4, txt: 'Ran into traffic and lost it.', concede: 0.2 } },
        { label: 'Shoot from range', attr: 'sho', diff: 85, ok: { type: 'goal', r: 1.5, txt: 'FROM DISTANCE! Postage stamp! Unstoppable!' }, bad: { type: 'miss', r: -0.3, txt: 'High and wide. Ambitious.' } } ] },
      { title: 'OPPONENT BREAKS', setup: 'They counter three on two. {P} is the last midfielder back.', opts: [
        { label: 'Tackle', attr: 'def', diff: 56, ok: { type: 'key', r: 0.8, txt: 'Crunching, clean tackle. Danger snuffed out.' }, bad: { type: 'lost', r: -0.7, txt: 'Mistimed it. They go through...', concede: 0.5 } },
        { label: 'Intercept', attr: 'def', diff: 52, ok: { type: 'key', r: 0.7, txt: 'Reads the pass and steps in. Smart defending.' }, bad: { type: 'lost', r: -0.5, txt: 'Committed to the wrong pass and got bypassed.', concede: 0.4 } },
        { label: 'Jockey and delay', attr: 'phy', diff: 40, ok: { type: 'good', r: 0.3, txt: 'Delays them long enough for the defence to recover.' }, bad: { type: 'lost', r: -0.3, txt: 'Too passive. They get the shot away.', concede: 0.25 } } ] },
      { title: 'SET PIECE', setup: 'Free kick on the edge of the box. {P} stands over it.', opts: [
        { label: 'Whip it in for {T}', attr: 'pas', diff: 67, ok: { type: 'assist', r: 0.8, txt: 'Perfect delivery and {T} heads it home! Assist!' }, bad: { type: 'miss', r: -0.2, txt: 'Cleared at the near post.' } },
        { label: 'Short routine', attr: 'pas', diff: 38, ok: { type: 'good', r: 0.3, txt: 'Short corner routine keeps possession in a good area.' }, bad: { type: 'lost', r: -0.2, txt: 'The routine fell apart.' } },
        { label: 'Shoot direct', attr: 'sho', diff: 83, ok: { type: 'goal', r: 1.5, txt: 'OVER THE WALL AND IN! Free kick special!' }, bad: { type: 'miss', r: -0.3, txt: 'Into the wall.' } } ] },
      { title: 'LATE RUN INTO THE BOX', setup: '{T} has it wide. {P} arrives late, unmarked at the penalty spot.', opts: [
        { label: 'First-time finish', attr: 'sho', diff: 75, ok: { type: 'goal', r: 1.2, txt: 'Arrives on cue and finishes first time! Lovely goal!' }, bad: { type: 'miss', r: -0.3, txt: 'Snatched at it. Wide.' } },
        { label: 'Take a touch, pass to {T}', attr: 'pas', diff: 59, ok: { type: 'assist', r: 0.8, txt: 'Composed. Takes a touch, squares to {T}, tap-in. Assist!' }, bad: { type: 'lost', r: -0.3, txt: 'Took too long. Tackled.' } } ] },
      { title: 'PRESSED IN OWN HALF', setup: 'Two pressers converge on {P} near the box.', opts: [
        { label: 'Turn out of pressure', attr: 'dri', diff: 58, ok: { type: 'good', r: 0.6, txt: 'Cruyff turn! Both pressers beaten, crowd applauds.' }, bad: { type: 'lost', r: -0.8, txt: 'Robbed in a dangerous area!', concede: 0.5 } },
        { label: 'Safe pass back', attr: 'pas', diff: 30, ok: { type: 'good', r: 0.2, txt: 'Sensible. Back to the keeper. Reset.' }, bad: { type: 'lost', r: -0.5, txt: 'Underhit back-pass! Their striker pounces!', concede: 0.6 } } ] },
    ],
    DEF: [
      { title: 'STRIKER RUNNING AT YOU', setup: 'Their striker drives at {P} at full tilt.', opts: [
        { label: 'Stand up, stay on feet', attr: 'def', diff: 55, ok: { type: 'key', r: 0.8, txt: 'Patient, forces him wide, nicks the ball. Superb defending.' }, bad: { type: 'lost', r: -0.6, txt: 'Beaten by a stepover. Shot on goal...', concede: 0.4 } },
        { label: 'Slide tackle', attr: 'def', diff: 64, ok: { type: 'key', r: 1.0, txt: 'PERFECT slide tackle! Ball and nothing else! Crowd roars!' }, bad: { type: 'lost', r: -1.0, txt: 'Dived in and missed. Wide open...', concede: 0.6 } },
        { label: 'Shepherd wide', attr: 'pac', diff: 50, ok: { type: 'good', r: 0.4, txt: 'Uses pace to guide him away from goal. Cleared.' }, bad: { type: 'lost', r: -0.4, txt: 'Cuts inside and gets a shot away.', concede: 0.3 } } ] },
      { title: 'CORNER AGAINST', setup: 'Corner swings in. Bodies everywhere. {P} tracks the big centre-forward.', opts: [
        { label: 'Attack the ball', attr: 'phy', diff: 56, ok: { type: 'key', r: 0.6, txt: 'Towering clearance. Wins it clean.' }, bad: { type: 'lost', r: -0.6, txt: 'Out-jumped. Header on target...', concede: 0.45 } },
        { label: 'Mark tight', attr: 'def', diff: 50, ok: { type: 'good', r: 0.4, txt: 'Glued to his man. Nothing doing.' }, bad: { type: 'lost', r: -0.5, txt: 'Lost him at the back post.', concede: 0.4 } } ] },
      { title: 'LONG BALL OVER THE TOP', setup: 'Their keeper launches one over the top. Striker on the shoulder of {P}.', opts: [
        { label: 'Recover with pace', attr: 'pac', diff: 58, ok: { type: 'good', r: 0.5, txt: 'Recovers, shields it back to the keeper. Composed.' }, bad: { type: 'lost', r: -0.6, txt: 'Beaten for pace. Striker clean through...', concede: 0.5 } },
        { label: 'Step up, play offside', attr: 'def', diff: 60, ok: { type: 'key', r: 0.8, txt: 'Steps up in unison. Flag goes up! Textbook offside trap.' }, bad: { type: 'lost', r: -0.9, txt: 'Stepped up alone! Striker played onside...', concede: 0.6 } },
        { label: 'Take the foul', attr: 'phy', diff: 40, ok: { type: 'good', r: 0.1, txt: 'Cynical. Takes the yellow. Professional foul.' }, bad: { type: 'lost', r: -0.4, txt: 'Fouled him in the box! Penalty!', concede: 0.75 } } ] },
      { title: 'ATTACKING SET PIECE', setup: '{P} goes up for the corner. {T} delivers.', opts: [
        { label: 'Attack the near post', attr: 'phy', diff: 75, ok: { type: 'goal', r: 1.2, txt: 'Bullet header at the near post! GOAL! A defender scores!' }, bad: { type: 'miss', r: -0.2, txt: 'Flicked it over the bar.' } },
        { label: 'Block for {T}', attr: 'def', diff: 51, ok: { type: 'assist', r: 0.8, txt: 'Blocks the marker and {T} nods it in! Credited with the assist.' }, bad: { type: 'miss', r: -0.1, txt: 'Referee spots the block. Free kick.' } } ] },
      { title: 'BUILD FROM THE BACK', setup: 'Keeper rolls it to {P}. Two pressers arrive.', opts: [
        { label: 'Play through the press', attr: 'pas', diff: 54, ok: { type: 'good', r: 0.5, txt: 'Splits the press with a line-breaking pass. Lovely.' }, bad: { type: 'lost', r: -0.8, txt: 'Gave it away on the edge of the box!', concede: 0.5 } },
        { label: 'Clear it long', attr: 'phy', diff: 36, ok: { type: 'good', r: 0.2, txt: 'Row Z. No risk.' }, bad: { type: 'lost', r: -0.2, txt: 'Sliced clearance goes for a corner.' } },
        { label: 'Overlap and cross', attr: 'pas', diff: 69, ok: { type: 'assist', r: 0.8, txt: 'Bombs forward, whips in a cross, {T} scores! Assist!' }, bad: { type: 'lost', r: -0.5, txt: 'Caught upfield. They counter into the space.', concede: 0.3 } } ] },
    ],
    GK: [
      { title: 'SHOT FROM DISTANCE', setup: 'Struck from twenty-five yards, swerving. {P} sets.', opts: [
        { label: 'Catch it', attr: 'def', diff: 58, ok: { type: 'save', r: 1.0, txt: 'Plucks it out of the air. Comfortable.' }, bad: { type: 'lost', r: -1.0, txt: 'Spills it! Rebound tapped in...', concede: 0.6 } },
        { label: 'Parry wide', attr: 'def', diff: 46, ok: { type: 'save', r: 0.8, txt: 'Strong hands, pushes it around the post.' }, bad: { type: 'lost', r: -0.7, txt: 'Parried it into the danger zone...', concede: 0.4 } },
        { label: 'Punch clear', attr: 'phy', diff: 40, ok: { type: 'good', r: 0.4, txt: 'Punches it forty yards. Safe.' }, bad: { type: 'lost', r: -0.6, txt: 'Weak punch, drops to their striker...', concede: 0.4 } } ] },
      { title: 'ONE ON ONE', setup: 'Striker clean through on {P}. Nobody else back.', opts: [
        { label: 'Stay big', attr: 'phy', diff: 60, ok: { type: 'save', r: 1.4, txt: 'Stands tall, spreads himself, MASSIVE save with the legs!' }, bad: { type: 'lost', r: -0.8, txt: 'Slotted past him. Nothing he could do.', concede: 0.9 } },
        { label: 'Rush out', attr: 'pac', diff: 62, ok: { type: 'save', r: 1.5, txt: 'Off his line like a bullet, smothers it at his feet! Brave!' }, bad: { type: 'lost', r: -1.0, txt: 'Rushed out and got chipped. Ouch.', concede: 0.9 } },
        { label: 'Go down early', attr: 'def', diff: 72, ok: { type: 'save', r: 1.6, txt: 'Guessed it! Went down early and saved it! Unbelievable!' }, bad: { type: 'lost', r: -1.0, txt: 'Went down too early. Rolled past him.', concede: 0.95 } } ] },
      { title: 'PENALTY AGAINST', setup: 'Penalty to them. {P} on the line, arms out wide.', opts: [
        { label: 'Dive left', attr: 'def', diff: 60, ok: { type: 'save', r: 1.7, txt: 'SAVED! Full stretch to the left! The stadium shakes!' }, bad: { type: 'lost', r: -0.3, txt: 'Went the wrong way. Goal.', concede: 1.0 }, guess: true },
        { label: 'Dive right', attr: 'def', diff: 60, ok: { type: 'save', r: 1.7, txt: 'SAVED! Strong right hand! Hero!' }, bad: { type: 'lost', r: -0.3, txt: 'Sent the wrong way. Goal.', concede: 1.0 }, guess: true },
        { label: 'Stay central', attr: 'def', diff: 55, ok: { type: 'save', r: 1.8, txt: 'STAYS PUT and the taker goes down the middle! Cheeky and brilliant!' }, bad: { type: 'lost', r: -0.3, txt: 'Stood still. Slotted into the corner.', concede: 1.0 }, guess: true } ] },
      { title: 'CROSS INTO THE BOX', setup: 'Hanging cross to the penalty spot. Crowded. {P} decides.', opts: [
        { label: 'Come and claim', attr: 'def', diff: 58, ok: { type: 'save', r: 1.0, txt: 'Commands the box, claims it cleanly. Authority.' }, bad: { type: 'lost', r: -1.0, txt: 'Came and missed it! Empty net...', concede: 0.7 } },
        { label: 'Punch', attr: 'phy', diff: 50, ok: { type: 'good', r: 0.5, txt: 'Solid punch to the edge of the box.' }, bad: { type: 'lost', r: -0.6, txt: 'Weak punch straight to an attacker...', concede: 0.4 } },
        { label: 'Stay on the line', attr: 'def', diff: 40, ok: { type: 'good', r: 0.2, txt: 'Stays home. Defender heads it clear.' }, bad: { type: 'lost', r: -0.5, txt: 'Header looped over him.', concede: 0.4 } } ] },
      { title: 'DISTRIBUTION', setup: 'Ball in hand, their whole team pushed up. {P} looks long.', opts: [
        { label: 'Launch it to {T}', attr: 'pas', diff: 71, ok: { type: 'assist', r: 0.8, txt: 'Seventy-yard kick, {T} runs on and scores! Keeper ASSIST!' }, bad: { type: 'miss', r: -0.1, txt: 'Long kick sails out of play.' } },
        { label: 'Roll it short', attr: 'pas', diff: 32, ok: { type: 'good', r: 0.2, txt: 'Tidy. Keeps it.' }, bad: { type: 'lost', r: -0.4, txt: 'Short roll intercepted!', concede: 0.4 } } ] },
    ],
  };

  function successProb(attrVal, diff, teamDiff, formAvg) {
    let p = 0.5 + (attrVal - diff) * 0.010 + teamDiff * 0.006 + ((formAvg || 6) - 6) * 0.03;
    return clamp(p, 0.08, 0.92);
  }

  // Build the moments for a match: how often the ball finds the player scales with chemistry (up to 3x)
  function buildMatch(state, mode) {
    const p = state.player, club = currentClub(state), lg = currentLeague(state);
    const fx = nextFixtureFor(lg, state.clubIdx);
    const opp = lg.clubs[fx.opp];
    const group = D.POSITIONS[p.pos].group;
    const starts = p.coach >= 35;
    const unused = p.coach < 15;
    let n = mode === 'highlights' ? 1 + Math.floor(p.chem / 50) : 2 + Math.floor(p.chem / 34);
    if (!starts) n = Math.max(1, Math.round(n / 2));
    if (unused) n = 0;
    const templates = shuffle(T[group]);
    const moments = [];
    const from = starts ? 3 : 62;
    for (let i = 0; i < n; i++) {
      const tpl = templates[i % templates.length];
      const minute = clamp(Math.round(from + (i + 0.5) * (88 - from) / n + ri(-4, 4)), from, 90);
      moments.push({ minute, tpl, mate: pick(state.teammates) });
    }
    moments.sort((a, b) => a.minute - b.minute);
    // background goals
    const myStr = club.str + (p.ovr - club.str) * 0.06;
    let [xh, xa] = fx.isHome ? xgFor(myStr, opp.str) : xgFor(opp.str, myStr);
    let xMine = fx.isHome ? xh : xa, xTheirs = fx.isHome ? xa : xh;
    if (group === 'ATT') xMine = Math.max(0.3, xMine - 0.22 * n);
    if (group === 'MID') xMine = Math.max(0.4, xMine - 0.08 * n);
    if (group === 'DEF') xTheirs = Math.max(0.3, xTheirs - 0.12 * n);
    if (group === 'GK') xTheirs = Math.max(0.3, xTheirs - 0.16 * n);
    const bg = [];
    for (let i = 0; i < poisson(xMine); i++) bg.push({ minute: ri(2, 90), side: 'us', scorer: pick(state.teammates) });
    for (let i = 0; i < poisson(xTheirs); i++) bg.push({ minute: ri(2, 90), side: 'them' });
    bg.sort((a, b) => a.minute - b.minute);
    return { fx, opp, club, moments, bg, starts, unused, teamDiff: myStr - opp.str, mode,
      score: [0, 0], rating: 6.0, goals: 0, assists: 0, saves: 0, keys: 0, log: [], done: false, i: 0 };
  }

  function resolveMoment(state, m, moment, optIdx) {
    const p = state.player;
    const opt = moment.tpl.opts[optIdx];
    let pr = successProb(p.attrs[opt.attr], opt.diff, m.teamDiff, formAvg(p));
    if (opt.guess) pr = 0.34 + (p.attrs[opt.attr] - 50) * 0.003; // penalty guessing
    const ok = rnd() < pr;
    const out = ok ? opt.ok : opt.bad;
    const res = { ok, type: out.type, txt: out.txt, r: out.r, concede: false, goal: false, assist: false, attr: opt.attr, prob: pr };
    m.rating = clamp(m.rating + out.r, 2, 10);
    if (ok) {
      if (out.type === 'goal') { m.goals++; m.score[0]++; res.goal = true; }
      if (out.type === 'assist') { m.assists++; m.score[0]++; res.assist = true; }
      if (out.type === 'save') m.saves++;
      if (out.type === 'key') m.keys++;
    } else if (out.concede && rnd() < out.concede) { m.score[1]++; res.concede = true; }
    return res;
  }
  function autoChoice(state, moment) {
    // sim picks the option with best expected value (prob-weighted rating)
    const p = state.player; let best = 0, bestV = -Infinity;
    moment.tpl.opts.forEach((o, i) => {
      const pr = o.guess ? 0.34 : successProb(p.attrs[o.attr], o.diff, 0, formAvg(p));
      const v = pr * o.ok.r + (1 - pr) * o.bad.r + rnd() * 0.3;
      if (v > bestV) { bestV = v; best = i; }
    });
    return best;
  }

  function formAvg(p) { const f = p.formHist || []; if (!f.length) return 6; return f.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, f.length); }

  // Finalise: apply result to player stats. Returns summary of changes.
  function finishMatch(state, m) {
    const p = state.player, lg = currentLeague(state);
    const [gf, ga] = m.score;
    const win = gf > ga, draw = gf === ga;
    const group = D.POSITIONS[p.pos].group;
    if (!m.unused) {
      m.rating = clamp(m.rating + (win ? 0.3 : draw ? 0 : -0.3), 2, 10);
      if (group === 'GK' && ga === 0) m.rating = clamp(m.rating + 0.8, 2, 10);
      if (group === 'DEF' && ga === 0) m.rating = clamp(m.rating + 0.4, 2, 10);
    }
    const r = m.unused ? null : Math.round(m.rating * 10) / 10;
    const motm = r !== null && r >= 8.3;
    const ch = { coach: 0, fans: 0, fame: 0, chem: 0, charm: 0, money: 0, attrs: [], rating: r, motm, win, draw };
    if (r === null) { ch.coach = -1; ch.fans = -1; }
    else {
      ch.coach = Math.round(E_clamp((r - 6) * 2.2, -3, 5));
      ch.fans = Math.round((r - 6) * 1.2 + m.goals * 0.5);
      ch.fame = Math.round((m.goals * 2 + m.assists + (motm ? 3 : 0) + (win ? 1 : 0)) * (lg.tier / 4));
      ch.chem = 1 + m.assists + (m.keys > 0 ? 1 : 0);
      ch.charm = motm ? 1 : 0;
      ch.money = Math.round(p.contract.wage * (win ? 0.5 : draw ? 0.2 : 0) + m.goals * p.contract.wage * 0.25 + m.assists * p.contract.wage * 0.15);
      if (r >= 9.3) ch.attrs.push(weightedAttr(p.pos));
      else if (r >= 8.5 && rnd() < 0.5) ch.attrs.push(weightedAttr(p.pos));
      else if (r <= 4.5 && rnd() < 0.25) ch.attrs.push('-' + weightedAttr(p.pos));
      p.formHist = (p.formHist || []).concat([r]).slice(-10);
      p.apps++; p.goals += m.goals; p.assists += m.assists; p.saves += m.saves; if (motm) p.motm++;
    }
    p.coach = clamp(p.coach + ch.coach, 0, 100);
    p.fans = clamp(p.fans + ch.fans, 0, 100);
    p.fame = clamp(p.fame + ch.fame, 0, 100);
    p.chem = clamp(p.chem + ch.chem, 0, 100);
    p.charm = clamp(p.charm + ch.charm, 0, 100);
    p.money += ch.money;
    for (const a of ch.attrs) {
      if (a[0] === '-') p.attrs[a.slice(1)] = clamp(p.attrs[a.slice(1)] - 1, 20, 99);
      else p.attrs[a] = clamp(p.attrs[a] + 1, 20, 99);
    }
    p.ovr = calcOVR(p.attrs, p.pos);
    // league week for everyone
    const results = advanceWeek(state.world, lg.id, state.clubIdx, m.fx.isHome ? [gf, ga] : [ga, gf]);
    state.lastResults = results;
    endWeek(state);
    return ch;
  }

  // No fixture this round (odd-sized league): the world still plays, the player rests
  function byeWeek(state) {
    const lg = currentLeague(state);
    state.lastResults = advanceWeek(state.world, lg.id, state.clubIdx, null);
    endWeek(state);
  }
  function endWeek(state) {
    const p = state.player;
    state.week++;
    p.money += p.contract.wage;
    p.contract.weeksLeft--;
    if (!state.trainedThisWeek) p.coach = clamp(p.coach - 2, 0, 100);
    state.trainedThisWeek = false;
    p.energy = maxEnergy(state);
    p.energyUsed = 0;
    const lg = currentLeague(state);
    state.flags = state.flags || {};
    if (lg.round >= lg.rounds.length) state.flags.seasonEnd = true;
    if (state.week > 1 && (state.week - 1) % 20 === 0) state.flags.transferWindow = true;
  }

  function maxEnergy(state) {
    const p = state.player;
    const gear = D.SHOP.gear.find(g => g.id === p.gear) || D.SHOP.gear[0];
    const est = D.ESTATES.find(e => e.id === p.estate) || D.ESTATES[0];
    return 100 + gear.energy + est.energy;
  }
  function trainBonus(state) {
    const p = state.player;
    const boots = D.SHOP.boots.find(b => b.id === p.boots) || D.SHOP.boots[0];
    const gear = D.SHOP.gear.find(g => g.id === p.gear) || D.SHOP.gear[0];
    return boots.train + gear.train;
  }
  const TRAIN_COST = 34;
  function train(state, attr) {
    const p = state.player;
    if (p.energy < TRAIN_COST) return { ok: false, reason: 'Not enough energy this week.' };
    p.energy -= TRAIN_COST;
    state.trainedThisWeek = true;
    p.coach = clamp(p.coach + 1, 0, 100);
    const ageMod = p.age <= 21 ? 0.05 : p.age <= 27 ? 0 : -0.1;
    const chance = clamp(0.26 + trainBonus(state) / 150 - (p.attrs[attr] - 50) * 0.006 + ageMod, 0.05, 0.8);
    const gained = rnd() < chance;
    if (gained) { p.attrs[attr] = clamp(p.attrs[attr] + 1, 20, 99); p.ovr = calcOVR(p.attrs, p.pos); }
    return { ok: true, gained, chance, attr };
  }

  // ---------- Clubs, contracts, transfers ----------
  function currentLeague(state) { return state.world.find(l => l.id === state.leagueId); }
  function currentClub(state) { return currentLeague(state).clubs[state.clubIdx]; }
  function leagueOf(world, clubId) { return world.find(l => l.clubs.some(c => c.id === clubId)); }
  function wageFor(ovr, lg, roleMult) { return Math.round(((ovr - 40) * (ovr - 40) * 6 * lg.wageMult + 300) * roleMult / 10) * 10; }
  function roleFor(ovr, str) {
    if (ovr >= str + 2) return { role: 'Key Player', mult: 1.3, promise: 'Guaranteed starter. Built around you.' };
    if (ovr >= str - 4) return { role: 'First-Team Regular', mult: 1.0, promise: 'Starts most weeks when fit.' };
    if (ovr >= str - 10) return { role: 'Rotation / Prospect', mult: 0.75, promise: 'Cup games and sub appearances. Earn your place.' };
    return { role: 'Squad Player', mult: 0.55, promise: 'Bench to begin with. Loan possible.' };
  }
  function makeOffer(state, lg, club, kind) {
    const p = state.player;
    const r = roleFor(p.ovr, club.str);
    let wage = wageFor(p.ovr, lg, r.mult);
    if (kind === 'renewal') wage = Math.max(wage, Math.round(p.contract.wage * 1.15 / 10) * 10);
    const weeks = pick([40, 60, 80]);
    return { kind, leagueId: lg.id, leagueName: lg.name, clubId: club.id, clubName: club.name, str: club.str, tier: lg.tier,
      wage, weeks, bonus: wage * 8, role: r.role, promise: r.promise, imageRights: Math.round(wage * 0.1) };
  }
  function genOffers(state) {
    const p = state.player, cur = currentClub(state), curLg = currentLeague(state);
    const fa = formAvg(p);
    const reach = p.ovr + 3 + p.charm * 0.1 + (fa - 6) * 3;
    const cands = [];
    for (const lg of state.world) for (const c of lg.clubs) {
      if (c.id === cur.id) continue;
      if (c.str <= reach + ri(0, 5) && c.str >= p.ovr - 12) cands.push({ lg, c });
    }
    if (cands.length < 2) {
      const low = [];
      for (const lg of state.world) if (lg.tier <= 2) for (const c of lg.clubs) if (c.id !== cur.id) low.push({ lg, c });
      low.sort((a, b) => a.c.str - b.c.str);
      for (const x of low.slice(0, 6)) if (!cands.some(y => y.c.id === x.c.id)) cands.push(x);
    }
    const offers = [];
    if (p.coach >= 25) offers.push(makeOffer(state, curLg, cur, 'renewal'));
    // charm tilts the sample toward prestige
    const sorted = cands.sort((a, b) => (b.c.str + b.lg.tier * 2 + rnd() * (30 - p.charm * 0.25)) - (a.c.str + a.lg.tier * 2 + rnd() * (30 - p.charm * 0.25)));
    const seenLg = new Set([curLg.id]);
    for (const x of sorted) {
      if (offers.length >= 3) break;
      if (seenLg.has(x.lg.id) && rnd() < 0.7) continue;
      seenLg.add(x.lg.id);
      offers.push(makeOffer(state, x.lg, x.c, 'transfer'));
    }
    let guard = 0;
    while (offers.length < 3 && sorted.length && guard++ < 10) { const x = pick(sorted); if (!offers.some(o => o.clubId === x.c.id)) offers.push(makeOffer(state, x.lg, x.c, 'transfer')); }
    return offers;
  }
  function startingOffers(state) {
    const nat = state.player.nat;
    const prefs = nat === 'USA' ? ['MLSE', 'MLSW', 'CH'] : nat === 'France' ? ['L1', 'CH', 'MLSE'] : nat === 'Saudi Arabia' ? ['SPL', 'CH', 'MLSW'] : ['CH', 'CH', 'MLSE'];
    const offers = [], used = new Set();
    for (const id of prefs) {
      const lg = state.world.find(l => l.id === id);
      const pool = lg.clubs.filter(c => c.str <= 69 && !used.has(c.id));
      const c = pick(pool); used.add(c.id);
      offers.push({ kind: 'academy', leagueId: lg.id, leagueName: lg.name, clubId: c.id, clubName: c.name, str: c.str, tier: lg.tier,
        wage: ri(40, 70) * 10, weeks: 60, bonus: 500, role: 'Academy Prospect', promise: 'Train with the first team. Impress the coach to start.', imageRights: 0 });
    }
    return offers;
  }
  function acceptOffer(state, offer) {
    const p = state.player;
    const lg = state.world.find(l => l.id === offer.leagueId);
    const idx = lg.clubs.findIndex(c => c.id === offer.clubId);
    const moving = state.leagueId !== offer.leagueId || state.clubIdx !== idx;
    state.leagueId = offer.leagueId; state.clubIdx = idx;
    p.contract = { club: offer.clubName, wage: offer.wage, weeksLeft: offer.weeks, role: offer.role, promise: offer.promise, leagueName: offer.leagueName };
    p.money += offer.bonus;
    if (moving) {
      state.teammates = genTeammates(p.pos, p.nat, lg.clubs[idx].str, lg.country);
      p.chem = 30; p.coach = 45; p.fans = clamp(Math.round(p.fans * 0.6), 0, 100);
      p.fame = clamp(p.fame + lg.tier, 0, 100);
    } else { p.coach = clamp(p.coach + 5, 0, 100); }
  }

  // ---------- Prologue penalty ----------
  const PEN_DIRS = ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right', 'Panenka'];
  function takePenalty(choice, sho) {
    const keeper = pick(['Left', 'Right', 'Middle']);
    const side = choice.includes('Left') ? 'Left' : choice.includes('Right') ? 'Right' : 'Middle';
    const top = choice.startsWith('Top');
    let p;
    if (choice === 'Panenka') p = keeper === 'Middle' ? 0.05 : 0.7;
    else if (keeper !== side) p = top ? 0.78 : 0.92;
    else p = top ? 0.55 : 0.25;
    p += (sho - 50) * 0.003;
    const roll = rnd();
    if (roll < p) return { result: 'goal', keeper };
    if (top && rnd() < 0.5) return { result: 'miss', keeper };
    if (choice === 'Panenka' && keeper === 'Middle') return { result: 'saved', keeper };
    return { result: keeper === side || choice === 'Panenka' ? 'saved' : 'miss', keeper };
  }

  // ---------- New game ----------
  function newGame(profile) {
    const pos = profile.pos;
    const attrs = genAttrs(pos, 52);
    const world = newWorld();
    const player = {
      name: profile.name, pron: profile.pron, nick: profile.nick || '', pos, nat: profile.nat,
      attrs, ovr: calcOVR(attrs, pos), age: 16,
      fame: 0, money: 250, fans: 5, coach: 45, chem: 30, charm: 10,
      energy: 100, energyUsed: 0, formHist: [],
      apps: 0, goals: 0, assists: 0, saves: 0, motm: 0, seasons: 0,
      boots: 'b0', outfit: 'o0', gear: 'g0', car: 'c0', estate: 'h0', owned: ['b0', 'o0', 'g0', 'c0', 'h0'],
      contract: { club: 'Regional Academy', wage: 0, weeksLeft: 0, role: 'Academy', promise: '', leagueName: '' },
    };
    const state = { version: 1, phase: 'roster', week: 1, world, leagueId: null, clubIdx: -1, player,
      teammates: genTeammates(pos, profile.nat, 48, profile.nat), trainedThisWeek: false, flags: {}, lastResults: [], history: [] };
    return state;
  }

  function seasonRollover(state) {
    const p = state.player, lg = currentLeague(state);
    const st = standings(lg); const pos = st.findIndex(r => r.idx === state.clubIdx) + 1;
    const summary = { season: p.seasons + 1, club: currentClub(state).name, league: lg.name, finish: pos, pts: lg.table[state.clubIdx].pts,
      apps: p.apps, goals: p.goals, assists: p.assists, motm: p.motm, ovr: p.ovr, age: p.age };
    state.history.push(summary);
    p.seasons++; p.age++;
    p.apps = 0; p.goals = 0; p.assists = 0; p.saves = 0; p.motm = 0;
    if (pos === 1) { p.fame = clamp(p.fame + 8, 0, 100); p.fans = clamp(p.fans + 10, 0, 100); }
    resetSeason(state.world);
    state.flags.seasonEnd = false;
    return summary;
  }

  root.PPL = { ATTRS, calcOVR, genAttrs, genTeammates, genPerson, newWorld, standings, nextFixtureFor, buildMatch, resolveMoment, autoChoice,
    finishMatch, train, TRAIN_COST, maxEnergy, trainBonus, currentLeague, currentClub, genOffers, startingOffers, acceptOffer, takePenalty,
    PEN_DIRS, newGame, seasonRollover, byeWeek, formAvg, successProb, clamp, ri, pick, endWeek, roleFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PPL;
})(typeof window !== 'undefined' ? window : globalThis);
