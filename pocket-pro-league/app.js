/* Pocket Pro League — UI & flow */
(function () {
  'use strict';
  const D = window.PPL_DATA, E = window.PPL, A = window.PPL_AUDIO, SP = window.PPL_SPRITES, ARC = window.PPL_ARCADE, TOWN = window.PPL_TOWN;
  const $ = s => document.querySelector(s);
  const SAVE_KEY = 'ppl_save_v1';
  let S = null;             // persistent game state
  let U = { screen: 'menu' }; // transient ui state

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const club = () => E.currentClub(S);
  const lg = () => E.currentLeague(S);
  const P = () => S.player;
  const pname = () => P().nick ? P().nick : P().name.split(' ').slice(-1)[0];
  const mateRef = (m, introduced) => { if (introduced && !introduced.has(m.name)) { introduced.add(m.name); return `${m.last} (${m.pron})`; } return m.last; };
  const dispW = s => [...s].reduce((n, ch) => n + (ch.codePointAt(0) > 0xFFFF || /[\u2600-\u27BF]/.test(ch) ? 2 : 1), 0);
  const fit = (s, w) => { let out = ''; for (const ch of [...s]) { if (dispW(out + ch) > w) break; out += ch; } return out + ' '.repeat(Math.max(0, w - dispW(out))); };
  const save = () => { try { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
  const load = () => { try { const j = localStorage.getItem(SAVE_KEY); return j ? JSON.parse(j) : null; } catch (e) { return null; } };
  const formIcon = () => { const f = P().formHist || []; if (f.length < 2) return '📈'; const last = f.slice(-3), prev = f.slice(-6, -3); const a = arr => arr.reduce((x, y) => x + y, 0) / (arr.length || 1); return prev.length ? (a(last) >= a(prev) ? '📈' : '📉') : (a(last) >= 6.5 ? '📈' : '📉'); };
  const attrLabel = a => (P().pos === 'GK' ? D.GK_ATTR_LABELS : D.ATTR_LABELS)[a];
  const starts = () => P().coach >= 35;

  // ---------- looks ----------
  function ensureLooks() {
    if (!S) return;
    if (!S.player.look) S.player.look = U.look || SP.defaultLook();
    S.teammates.forEach(t => { if (!t.look) t.look = SP.randomLook(); });
  }
  function myKit() { return S && S.clubIdx >= 0 ? SP.baseKit(club().name) : { shirt: '#c8102e', shorts: '#ffffff' }; }
  // Appearance editor: cycles each trait, live pixel preview
  function lookEditor(look, onChange) {
    const traits = [
      ['skin', 'Skin', SP.SKIN.length, i => 'Tone ' + (i + 1)], ['hair', 'Hair', SP.HAIR_STYLES.length, i => SP.HAIR_STYLES[i]],
      ['hairColor', 'Hair colour', SP.HAIR_COLORS.length, i => ['Black', 'Brown', 'Chestnut', 'Blond', 'Grey', 'Red', 'Platinum', 'Blue'][i]],
      ['beard', 'Beard', 2, i => i ? 'Yes' : 'No'], ['boots', 'Boots', SP.BOOTS.length, i => ['Black', 'White', 'Red', 'Green', 'Blue', 'Yellow', 'Pink'][i]], ['build', 'Build', SP.BUILDS.length, i => SP.BUILDS[i]] ];
    const html = `<div class="look"><canvas class="look-canvas" width="120" height="150"></canvas><div class="look-traits">${traits.map(([k, label, n, name]) => `<div class="look-row"><span class="lbl">${label}</span><button type="button" class="sm" data-lk="${k}" data-d="-1">◀</button><span class="look-val" data-lv="${k}">${name(+look[k])}</span><button type="button" class="sm" data-lk="${k}" data-d="1">▶</button></div>`).join('')}<button type="button" class="sm warn" data-lk="random">🎲 Randomise</button></div></div>`;
    const bind = rootEl => {
      const cv = rootEl.querySelector('.look-canvas'); const ctx = cv.getContext('2d');
      const paint = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = false; SP.drawFigure(ctx, 60, 128, 5.2, look, myKit(), { number: 10 }); };
      const refresh = () => { traits.forEach(([k, , , name]) => { const el = rootEl.querySelector(`[data-lv="${k}"]`); if (el) el.textContent = name(+look[k]); }); paint(); onChange && onChange(look); };
      rootEl.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => {
        const k = b.dataset.lk;
        if (k === 'random') Object.assign(look, SP.randomLook());
        else { const t = traits.find(x => x[0] === k); look[k] = (((+look[k]) + (+b.dataset.d)) % t[2] + t[2]) % t[2]; if (k === 'beard') look.beard = !!look.beard; }
        refresh();
      });
      paint();
    };
    return { html, bind };
  }

  // ---------- dashboard ----------
  function dashboard() {
    const p = P(); const W = 56;
    const team = S.clubIdx >= 0 ? club().name : 'Regional Academy';
    const pts = S.clubIdx >= 0 ? lg().table[S.clubIdx].pts : 0;
    const l1 = ` PLAYER: ${p.name} | OVR: ${p.ovr} | TEAM: ${team}`;
    const l2 = ` AGE: ${p.age} | WEEK: ${S.week} | FAME: ${p.fame} | MONEY: ${money(p.money)}`;
    const l3 = ` FANS: ${p.fans} | COACH: ${p.coach} | CHEMISTRY: ${p.chem}`;
    const l4 = ` CHARM: ${p.charm} | FORM: ${formIcon()} | POINTS: ${pts}`;
    const rows = [l1, l2, l3, l4].map(l => '│' + esc(fit(l, W)) + '│');
    return `┌${'─'.repeat(W)}┐\n${rows.join('\n')}\n└${'─'.repeat(W)}┘`;
  }
  function bar(label, val, cls) { return `<div class="bar ${cls || ''}"><span class="lbl">${label}</span><span class="track"><span class="fill" style="width:${E.clamp(val, 0, 100)}%"></span></span><span>${val}</span></div>`; }
  let lineSeq = 0;
  const hashKey = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36); };
  function scriptLine(who, what, cls, key) { const w = who.toLowerCase(); return `<div class="line ${w} ${cls || ''}" data-say="${key || hashKey(w + what)}"><span class="who">${esc(who)}</span><span class="what">${what}</span></div>`; }
  const spoken = new Set();
  function speakNew(rootEl) {
    if (!A) return;
    rootEl.querySelectorAll('.line[data-say]').forEach(el => {
      if (el.hidden || spoken.has(el.dataset.say)) return;
      spoken.add(el.dataset.say);
      if (spoken.size > 2000) spoken.clear();
      A.speak(el.querySelector('.who').textContent, el.querySelector('.what').innerHTML);
    });
  }
  function soundBtn() { const b = $('#snd'); if (!b || !A) return; b.textContent = A.isEnabled() ? '🔊 Sound on' : '🔇 Sound off'; b.setAttribute('aria-pressed', A.isEnabled() ? 'true' : 'false'); }

  // ---------- render root ----------
  function stopScenes() {
    if (U.arcade) { U.arcade.destroy(); U.arcade = null; }
    if (U.town) { U.townPos = U.town.pos(); U.town.destroy(); U.town = null; }
    document.body.classList.remove('has-scene');
    const sr = $('#scene-root'); if (sr) sr.remove();
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
  }
  function fullscreenHost() {
    let host = $('#scene-root');
    if (!host) { host = document.createElement('div'); host.id = 'scene-root'; host.className = 'scene fullscreen'; document.body.appendChild(host); }
    host.innerHTML = ''; document.body.classList.add('has-scene');
    try { const el = document.documentElement; const rq = el.requestFullscreen || el.webkitRequestFullscreen; if (rq && !document.fullscreenElement) rq.call(el, { navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* not allowed here; the fixed overlay still fills the screen */ }
    return host;
  }
  function render() {
    ensureLooks();
    stopScenes();
    const dash = $('#dash'), scr = $('#screen'), act = $('#actions');
    const showDash = S && !['intro', 'roster', 'prologue', 'scout'].includes(S.phase) && U.screen !== 'menu';
    dash.innerHTML = showDash ? dashboard() : '';
    act.innerHTML = '';
    const view = VIEWS[U.screen === 'menu' ? 'menu' : (U.screen || S.phase)];
    const out = view();
    scr.innerHTML = out.html;
    act.innerHTML = (out.actions || []).map((a, i) => `<button id="act${i}" class="${a.cls || ''}" ${a.disabled ? 'disabled' : ''}>${a.label}${a.sub ? `<span class="sub">${a.sub}</span>` : ''}</button>`).join('');
    (out.actions || []).forEach((a, i) => { const b = $('#act' + i); if (b) b.onclick = a.fn; });
    fitDash(dash);
    if (out.after) out.after();
    speakNew(scr);
    soundBtn();
    if (S && U.screen !== 'menu') save();
    window.scrollTo({ top: 0 });
  }
  function fitDash(dash) {
    if (!dash.textContent) return;
    dash.style.fontSize = '';
    const avail = dash.clientWidth - 24, need = dash.scrollWidth - 24;
    if (need > avail && need > 0) {
      const cur = parseFloat(getComputedStyle(dash).fontSize);
      dash.style.fontSize = Math.max(7, Math.floor(cur * avail / need * 100) / 100) + 'px';
    }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitDash($('#dash')));
  window.addEventListener('resize', () => fitDash($('#dash')));
  function go(screen) { if (A && screen !== U.screen) A.stopSpeech(); if (screen === 'hub' && U.screen !== 'hub') U.townMenu = false; U.screen = screen; render(); }
  function setPhase(ph) { if (A) A.stopSpeech(); S.phase = ph; U.screen = ph; render(); }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (A && b) { A.unlock(); if (b.id !== 'snd') A.sfx('click'); } }, true);

  // ---------- VIEWS ----------
  const VIEWS = {};

  VIEWS.menu = () => {
    const saved = load();
    const html = `<pre class="ascii green">
 ____   ___   ____ _  _____ _____   ____  ____   ___
|  _ \\ / _ \\ / ___| |/ / ____|_   _| |  _ \\|  _ \\ / _ \\
| |_) | | | | |   | ' /|  _|   | |   | |_) | |_) | | | |
|  __/| |_| | |___| . \\| |___  | |   |  __/|  _ <| |_| |
|_|    \\___/ \\____|_|\\_\\_____| |_|   |_|   |_| \\_\\\\___/
            L E A G U E   ·   C A R E E R   M O D E</pre>
      <p>A deep-sim football RPG. Start at sixteen in a regional academy final, get scouted, and climb from the Championship to the elite leagues of Europe. Every choice on the pitch feeds your rating, your coach, your fans and your bank balance.</p>
      ${saved ? `<div class="card hl"><h3>Saved career</h3><div>${esc(saved.player.name)} · ${esc(saved.player.pos)} · OVR ${saved.player.ovr} · Week ${saved.week} · ${esc(saved.player.contract.club)}</div></div>` : '<p class="muted">No saved career on this device yet.</p>'}
      <p class="muted">Progress autosaves in this browser after every screen. ${A && A.hasSpeech() ? 'John and Ally speak through your browser\'s voices, with crowd noise and whistles synthesised live. Toggle with the sound button at the top.' : 'This browser has no speech voices, so commentary is text only. Crowd and whistle effects still play.'}</p>`;
    const actions = [];
    if (saved) actions.push({ label: '▶ Continue career', cls: 'primary', fn: () => { S = saved; U = { screen: S.phase }; render(); } });
    actions.push({ label: '✚ New career', cls: saved ? 'warn' : 'primary', fn: () => { S = null; U = { screen: 'intro' }; render(); } });
    return { html, actions };
  };

  // ---- PHASE 1: character creation ----
  VIEWS.intro = () => {
    const posOpts = Object.entries(D.POSITIONS).map(([k, v]) => `<option value="${k}">${k} — ${v.name}</option>`).join('');
    const natOpts = D.NATIONALITIES.map(n => `<option value="${esc(n)}" ${n === 'England' ? 'selected' : ''}>${esc(n)}</option>`).join('');
    const html = `<h2>📺 Live from the gantry · Regional Academy Final</h2>
      <div class="script">
        ${scriptLine('John', '<i>(tapping the mic)</i> Evening all, and welcome to a soaking wet Riverside Park. John Harlow with you, and beside me, as ever, is the one and only...')}
        ${scriptLine('Ally', 'Ally Brennan. Fourteen years in the game, two dodgy knees, and a nose for a wonderkid. John, I think we\'ve got one tonight.')}
        ${scriptLine('John', 'You say that every year.')}
        ${scriptLine('Ally', 'I do. But look at the kid on the touchline, boots half-laced, staring at the penalty spot like it owes them money. Producer\'s just handed me a note. We\'ve got no bio. No name on the team sheet.')}
        ${scriptLine('John', 'That won\'t do. <i>(leaning in)</i> You there? Give us a shout up to the gantry. Name, how to say it, where you play, and who you play for.')}
        ${scriptLine('Ally', 'And a nickname if you\'ve got one. The crowd will need something to chant in about ninety seconds.')}
      </div>
      <div class="form">
        <label>1. Name <input id="f-name" maxlength="28" placeholder="e.g. Kevin De Bruyne" autocomplete="off"></label>
        <label>2. Pronunciation <input id="f-pron" maxlength="40" placeholder="e.g. Duh BROY-nuh" autocomplete="off"></label>
        <label>3. Position <select id="f-pos">${posOpts}</select></label>
        <label>4. Nationality <select id="f-nat">${natOpts}</select></label>
        <label class="wide">Nickname (optional) <input id="f-nick" maxlength="16" placeholder="What the terraces will sing" autocomplete="off"></label>
      </div>
      <h3>5. Appearance</h3>
      ${(U.lookEd = lookEditor(U.look || (U.look = SP.randomLook()))).html}
      <p class="muted">Position sets your OVR weighting. Strikers lean on Shooting and Pace, midfielders on Passing and Dribbling, centre-backs on Defending and Physical. Goalkeepers use their own six.</p>
      <div id="f-err" class="red"></div>`;
    const actions = [{ label: '⚽ Send it up to the gantry', cls: 'primary', fn: () => {
      const name = $('#f-name').value.trim(), pron = $('#f-pron').value.trim(), pos = $('#f-pos').value, nat = $('#f-nat').value, nick = $('#f-nick').value.trim();
      if (name.length < 2) { $('#f-err').textContent = 'John needs a name to read out. Two characters minimum.'; return; }
      const look = U.look;
      S = E.newGame({ name, pron: pron || name, pos, nat, nick });
      S.player.look = look;
      U = { screen: 'roster', look };
      render();
    } }, { label: '← Back to menu', fn: () => go('menu') }];
    return { html, actions, after: () => { U.lookEd.bind($('#screen')); const n = $('#f-name'); if (n && !n.value) n.focus(); } };
  };

  VIEWS.roster = () => {
    const p = P();
    const rows = S.teammates.map(t => `<tr><td>${t.pos}</td><td>${esc(t.name)}</td><td class="muted">(${esc(t.pron)})</td><td>${esc(t.nat)}</td><td class="n">${t.ovr}</td></tr>`).join('');
    const html = `<h2>Team sheet · Riverside Academy</h2>
      <div class="script">
        ${scriptLine('John', `Right. <b>${esc(p.name)}</b>, said <b>${esc(p.pron)}</b>${p.nick ? `, known to the terraces as <b>${esc(p.nick)}</b>` : ''}. ${esc(D.POSITIONS[p.pos].name)}, flying the flag for ${esc(p.nat)}. Sixteen years old.`)}
        ${scriptLine('Ally', 'And here\'s the rest of the academy side, with the pronunciations the producer has kindly scribbled for us. I will be using them. John will be ignoring them.')}
      </div>
      <div class="tablewrap"><table><thead><tr><th>Pos</th><th>Name</th><th>Say it</th><th>Nat</th><th class="n">OVR</th></tr></thead><tbody>
        <tr class="me"><td>${p.pos}</td><td>${esc(p.name)} (you)</td><td class="muted">(${esc(p.pron)})</td><td>${esc(p.nat)}</td><td class="n">${p.ovr}</td></tr>${rows}</tbody></table></div>
      <div class="card"><h3>Your starting attributes</h3>${E.ATTRS.map(a => bar(attrLabel(a), p.attrs[a])).join('')}</div>`;
    return { html, actions: [{ label: '▶ Skip to the 95th minute', cls: 'primary', fn: () => { U.pen = { attempts: 0, log: [] }; setPhase('prologue'); } }] };
  };

  // ---- PHASE 2: prologue penalty ----
  VIEWS.prologue = () => {
    const p = P(); const pen = U.pen || (U.pen = { attempts: 0, log: [] });
    const nm = esc(pname());
    let html = `<h2>Regional Academy Final · 90+5'</h2>
      <div class="score">RIVERSIDE ACADEMY 1 — 1 HARBOUR TOWN U18<small>90+5' · PENALTY TO RIVERSIDE</small></div>
      <div class="script">
        ${scriptLine('John', `Five seconds left on the clock. Level at one apiece. And it is <b>${esc(p.name)}</b> who picks up the ball.`)}
        ${scriptLine('Ally', `Sixteen years old, John. Whole academy watching. Scouts in the main stand with their notebooks out. This is the moment.`)}
        ${pen.log.map(l => l).join('')}
      </div>`;
    const actions = [];
    if (pen.state === 'scored') {
      html += `<div class="notice">GOAL! Riverside win the final ${pen.attempts > 1 ? `(after ${pen.attempts} attempts... the engine is generous, the keeper was not)` : 'at the first time of asking'}.</div>`;
      actions.push({ label: '▶ Continue: the tunnel', cls: 'primary', fn: () => setPhase('scout') });
    } else if (pen.state === 'failed') {
      html += `<div class="notice">⏪ REWIND AVAILABLE — the engine winds the clock back to 90+5.</div>`;
      actions.push({ label: '⏪ Rewind and re-take', cls: 'warn', fn: () => { pen.state = null; if (A) A.sfx('rewind'); pen.log.push(scriptLine('SYS', '<span class="blink">⏪⏪⏪</span> The tape rewinds. The ball is back on the spot. Nobody remembers a thing.', 'event', 'penr' + pen.attempts)); render(); } });
    } else {
      html += `<h3>Pick your spot</h3>`;
      E.PEN_DIRS.forEach(dir => actions.push({ label: dir === 'Panenka' ? '🪶 Panenka' : `🎯 ${dir}`, fn: () => {
        pen.attempts++;
        const r = E.takePenalty(dir, p.attrs.sho);
        pen.log.push(scriptLine('John', `${nm} runs up... goes <b>${esc(dir)}</b>. Keeper goes ${esc(r.keeper.toLowerCase())}...`, 'event', 'pen' + pen.attempts + 'a'));
        if (r.result === 'goal') {
          pen.state = 'scored';
          pen.log.push(scriptLine('Ally', dir === 'Panenka' ? 'A PANENKA! In a final! At SIXTEEN! I need to sit down and I am already sitting down!' : 'GOOOAAAL! In it goes! The academy bench is on the pitch!', 'goal', 'pen' + pen.attempts + 'b'));
          pen.log.push(scriptLine('John', `${esc(p.name)} (${esc(p.pron)}) wins it in the 95th minute! Remember the name.`, 'goal', 'pen' + pen.attempts + 'c'));
          if (A) A.sfx('goal');
          p.fame = 3; p.fans = 10;
        } else {
          pen.state = 'failed';
          pen.log.push(scriptLine('Ally', r.result === 'saved' ? 'SAVED! Oh no. Oh no no no. The keeper guessed right.' : 'OVER THE BAR! Into the car park! Somebody\'s windscreen is done.', 'bad', 'pen' + pen.attempts + 'b'));
          pen.log.push(scriptLine('John', '<i>(groans)</i> That is a heavy, heavy moment for a sixteen-year-old.', 'bad', 'pen' + pen.attempts + 'c'));
          if (A) A.sfx('bad');
        }
        render();
      } }));
    }
    return { html, actions };
  };

  VIEWS.scout = () => {
    if (!U.offers) U.offers = E.startingOffers(S);
    const p = P();
    const cards = U.offers.map((o, i) => `<div class="card ${i === 0 ? 'hl' : ''}"><h3>${esc(o.leagueName)}</h3><div class="gold">${esc(o.clubName)}</div>
      <div class="kv"><span class="k">Club str</span><span>${o.str}</span><span class="k">Wage</span><span>${money(o.wage)}/wk</span><span class="k">Length</span><span>${o.weeks} weeks</span><span class="k">Role</span><span>${esc(o.role)}</span></div>
      <p class="muted">${esc(o.promise)}</p></div>`).join('');
    const html = `<h2>The tunnel · Full time</h2>
      <div class="script">
        ${scriptLine('SYS', 'Mud on your knees, medal round your neck. A man in a grey club raincoat steps out of the shadow by the physio room. Then another. Then a third, holding a phone with a very bad photo of you on it.')}
        ${scriptLine('Scout', `"${esc(pname())}, is it? I saw the penalty. I also saw the forty minutes before it, which is what actually matters. We run the academy at a professional club. Lower tier, honest wages, first-team training. Nobody's promising you the moon."`)}
        ${scriptLine('Ally', '<i>(from the gantry, muffled)</i> Three clubs, John. THREE. I told you.')}
      </div>
      <div class="cards">${cards}</div>`;
    const actions = U.offers.map(o => ({ label: `✍ Sign for ${esc(o.clubName)}`, cls: 'primary', sub: `${esc(o.leagueName)} · ${money(o.wage)}/wk`, fn: () => {
      E.acceptOffer(S, o); U.offers = null; S.phase = 'hub'; U.screen = 'hub'; U.welcome = true; render();
    } }));
    return { html, actions };
  };

  // ---- PHASE 3: hub ----
  function fixtureCard() {
    const fx = E.nextFixtureFor(lg(), S.clubIdx);
    if (!fx) return lg().round < lg().rounds.length ? `<div class="card"><h3>Bye week · Week ${S.week}</h3><p>No fixture for ${esc(club().name)} this round. Train, shop, then rest at the stadium to move the week on.</p></div>` : `<div class="card"><h3>Season complete</h3><p>Head to the stadium to close the season.</p></div>`;
    const opp = lg().clubs[fx.opp];
    const st = E.standings(lg()); const myPos = st.findIndex(r => r.idx === S.clubIdx) + 1, opPos = st.findIndex(r => r.idx === fx.opp) + 1;
    return `<div class="card hl"><h3>Next fixture · Week ${S.week} · Round ${lg().round + 1}/${lg().rounds.length}</h3>
      <div class="row"><span class="gold">${esc(club().name)}</span><span class="muted">(${myPos}${ord(myPos)}, str ${club().str})</span><span>${fx.isHome ? 'vs' : '@'}</span><span class="sky">${esc(opp.name)}</span><span class="muted">(${opPos}${ord(opPos)}, str ${opp.str})</span></div>
      <div>${starts() ? '<span class="pill ok">Starting XI</span>' : P().coach < 15 ? '<span class="pill red">Not in squad</span>' : '<span class="pill gold">On the bench</span>'} <span class="muted">Coach popularity ${P().coach}: ${starts() ? 'you start.' : P().coach < 15 ? 'you are not in the matchday squad. Train and behave.' : 'you come on around the hour mark.'}</span></div></div>`;
  }
  const ord = n => (n % 10 === 1 && n % 100 !== 11) ? 'st' : (n % 10 === 2 && n % 100 !== 12) ? 'nd' : (n % 10 === 3 && n % 100 !== 13) ? 'rd' : 'th';

  function maybeFanEncounter(place) {
    const p = P();
    if (U.forceFan) { U.forceFan = false; }
    else if (p.fame < 50 || S.flags.fanWeek === S.week || Math.random() > 0.4 || place === 'hub') return '';
    S.flags.fanWeek = S.week;
    U.fan = { place };
    return `<div class="card hl" id="fan"><h3>You've been spotted</h3><p>${place === 'shop' ? 'A group of teenagers outside the sportswear shop do a double take. Phones come out. Within thirty seconds there is a small crowd chanting your name at the escalator.' : place === 'home' ? 'Two kids on bikes have been waiting by the gate for an hour. One is wearing your shirt. The name is spelt wrong.' : 'A steward at the training ground asks, sheepishly, if you would sign a programme for his daughter. Then his mate. Then the whole car park.'}</p>
      <div class="choices"><button id="fan-sign" class="primary">✍ Sign autographs <span class="sub">+fans, +charm, costs energy</span></button><button id="fan-skip">🕶 Slip away <span class="sub">keeps energy, fans notice</span></button></div></div>`;
  }
  function bindFan() {
    const a = $('#fan-sign'), b = $('#fan-skip');
    if (a) a.onclick = () => { const p = P(); p.fans = E.clamp(p.fans + 3, 0, 100); p.charm = E.clamp(p.charm + 1, 0, 100); p.energy = Math.max(0, p.energy - 10); p.fame = E.clamp(p.fame + 1, 0, 100); U.toast = 'You sign every last one. Fans +3, Charm +1, Fame +1, Energy −10.'; render(); };
    if (b) b.onclick = () => { const p = P(); p.fans = E.clamp(p.fans - 2, 0, 100); U.toast = 'You duck into a taxi. Fans −2. Someone films it.'; render(); };
  }
  function toast() { if (!U.toast) return ''; const t = U.toast; U.toast = null; return `<div class="notice">${t}</div>`; }

  VIEWS.hub = () => {
    const p = P();
    if (S.flags.seasonEnd) return VIEWS.season();
    if (S.flags.transferWindow) return VIEWS.transfer();
    let welcome = '';
    if (U.welcome) { U.welcome = false; welcome = `<div class="card"><h3>Welcome to ${esc(club().name)}</h3><p>${esc(p.contract.promise)} Wage ${money(p.contract.wage)} a week, ${p.contract.weeksLeft} weeks on the deal. Every week: train, shop, then play. The transfer window opens every 20 weeks.</p></div>`; }
    const html = `${welcome}${toast()}<h2>${esc(club().name)} · ${esc(lg().name)}</h2>
      <p class="muted">The town is full screen: walk to a door and press ENTER. The ☰ MENU button brings you back here.${p.fame >= 50 ? ' Fans in town will run at you.' : ''}</p>
      ${fixtureCard()}
      <div class="card"><h3>Status</h3>${bar('Energy', Math.round(p.energy / E.maxEnergy(S) * 100), 'sky')}${bar('Fame', p.fame, 'gold')}${bar('Fans', p.fans)}${bar('Coach', p.coach)}${bar('Chemistry', p.chem)}${bar('Charm', p.charm, 'gold')}</div>
      ${maybeFanEncounter('hub')}
      ${p.fame >= 50 ? '<p class="muted">Fame 50+: people recognise you in the street now. Expect crowds.</p>' : ''}`;
    const actions = [
      { label: '🗺 Walk the town', cls: 'primary', sub: 'Full-screen open world', fn: () => { U.townMenu = false; render(); } },
      { label: '🏠 Home', sub: 'Contract, garage, estate', fn: () => go('home') },
      { label: '🛍 Shopping Center', sub: 'Boots, outfits, gear', fn: () => go('shop') },
      { label: '🏃 Training Ground', sub: `${Math.floor(p.energy / E.TRAIN_COST)} sessions left`, fn: () => go('training') },
      { label: '🏟 Stadium · Match Day', cls: 'primary', sub: 'Play, sim or quick sim', fn: () => go('stadium') },
      { label: '👥 Squad', fn: () => go('squad') },
      { label: '📊 League Tables', fn: () => go('table') },
      { label: '📈 Career & Attributes', fn: () => go('career') },
      { label: '💾 Menu', fn: () => go('menu') },
    ];
    const after = () => {
      bindFan();
      if (U.townMenu || U.fan || U.forceFan || !TOWN) return;
      const host = fullscreenHost();
      U.town = TOWN.start({ host, look: p.look, kit: myKit(), fame: p.fame, carIdx: D.CARS.findIndex(c => c.id === p.car), spawn: U.townPos, crowded: S.flags.fanWeek === S.week,
        title: `${club().name} · week ${S.week}`, sub: `energy ${Math.round(p.energy)} · $${Math.round(p.money).toLocaleString('en-US')}`,
        onMenu: () => { U.townMenu = true; render(); },
        onEnter: id => go(id === 'stadium' ? 'stadium' : id),
        onCrowd: () => { if (S.flags.fanWeek === S.week) return; S.flags.fanWeek = S.week; U.fan = { place: 'hub' }; U.toast = null; U.townPos = U.town.pos(); U.forceFan = true; render(); } });
    };
    return { html, actions, after };
  };

  VIEWS.home = () => {
    const p = P();
    const car = D.CARS.find(c => c.id === p.car), est = D.ESTATES.find(e => e.id === p.estate);
    const carRows = D.CARS.map(c => { const owned = p.owned.includes(c.id); const cur = c.id === p.car;
      return `<tr class="${cur ? 'me' : ''}"><td>${esc(c.name)}</td><td class="n">${c.price ? money(c.price) : '—'}</td><td class="n">+${c.charm} charm</td><td>${cur ? '<span class="pill ok">Driving</span>' : owned ? `<button class="sm" data-car="${c.id}">Drive</button>` : `<button class="sm ${p.money >= c.price ? 'warn' : ''}" data-buycar="${c.id}" ${p.money < c.price ? 'disabled' : ''}>Buy</button>`}</td></tr>`; }).join('');
    const estRows = D.ESTATES.map(e => { const owned = p.owned.includes(e.id); const cur = e.id === p.estate;
      return `<tr class="${cur ? 'me' : ''}"><td>${esc(e.name)}<br><span class="muted">${esc(e.desc)}</span></td><td class="n">${e.price ? money(e.price) : '—'}</td><td class="n">+${e.charm} charm<br>+${e.energy} energy</td><td>${cur ? '<span class="pill ok">Living</span>' : owned ? `<button class="sm" data-est="${e.id}">Move in</button>` : `<button class="sm ${p.money >= e.price ? 'warn' : ''}" data-buyest="${e.id}" ${p.money < e.price ? 'disabled' : ''}>Buy</button>`}</td></tr>`; }).join('');
    const html = `${toast()}<h2>🏠 Home · ${esc(est.name)}</h2>
      <div class="cards">
        <div class="card"><h3>Contract</h3><div class="kv"><span class="k">Club</span><span>${esc(p.contract.club)}</span><span class="k">League</span><span>${esc(p.contract.leagueName)}</span><span class="k">Wage</span><span>${money(p.contract.wage)} / week</span><span class="k">Remaining</span><span>${p.contract.weeksLeft} weeks</span><span class="k">Role</span><span>${esc(p.contract.role)}</span></div><p class="muted">${esc(p.contract.promise)}</p></div>
        <div class="card garage"><h3>Garage · ${esc(car.name)}</h3><pre>${esc(car.art)}</pre></div>
      </div>
      <h3>Mirror · appearance</h3>${(U.lookEd = lookEditor(p.look)).html}
      <h3>Garage</h3><div class="tablewrap"><table><thead><tr><th>Car</th><th class="n">Price</th><th class="n">Effect</th><th></th></tr></thead><tbody>${carRows}</tbody></table></div>
      <h3>Estate</h3><div class="tablewrap"><table><thead><tr><th>Property</th><th class="n">Price</th><th class="n">Effect</th><th></th></tr></thead><tbody>${estRows}</tbody></table></div>
      ${maybeFanEncounter('home')}`;
    const after = () => {
      bindFan(); U.lookEd.bind($('#screen'));
      document.querySelectorAll('[data-buycar]').forEach(b => b.onclick = () => { const c = D.CARS.find(x => x.id === b.dataset.buycar); p.money -= c.price; p.owned.push(c.id); p.car = c.id; p.charm = E.clamp(p.charm + c.charm, 0, 100); p.fame = E.clamp(p.fame + Math.round(c.charm / 5), 0, 100); U.toast = `Keys to the ${esc(c.name)}. Charm +${c.charm}.`; if (A) A.sfx('cash'); render(); });
      document.querySelectorAll('[data-car]').forEach(b => b.onclick = () => { p.car = b.dataset.car; render(); });
      document.querySelectorAll('[data-buyest]').forEach(b => b.onclick = () => { const e = D.ESTATES.find(x => x.id === b.dataset.buyest); p.money -= e.price; p.owned.push(e.id); p.estate = e.id; p.charm = E.clamp(p.charm + e.charm, 0, 100); p.fame = E.clamp(p.fame + e.fame, 0, 100); U.toast = `You move into the ${esc(e.name)}. Charm +${e.charm}, max energy +${e.energy}.`; if (A) A.sfx('cash'); render(); });
      document.querySelectorAll('[data-est]').forEach(b => b.onclick = () => { p.estate = b.dataset.est; render(); });
    };
    return { html, actions: [{ label: '← Back to hub', fn: () => go('hub') }], after };
  };

  VIEWS.shop = () => {
    const p = P(); const tab = U.shopTab || 'boots';
    const items = D.SHOP[tab];
    const cur = p[tab === 'boots' ? 'boots' : tab === 'outfits' ? 'outfit' : 'gear'];
    const rows = items.map(it => { const owned = p.owned.includes(it.id); const eff = [it.charm ? `+${it.charm} charm` : '', it.train ? `+${it.train} training` : '', it.energy ? `+${it.energy} energy` : ''].filter(Boolean).join(', ') || '—';
      return `<tr class="${it.id === cur ? 'me' : ''}"><td>${esc(it.name)}<br><span class="muted">${esc(it.desc)}</span></td><td class="n">${it.price ? money(it.price) : '—'}</td><td>${eff}</td><td>${it.id === cur ? '<span class="pill ok">Equipped</span>' : owned ? `<button class="sm" data-eq="${it.id}">Equip</button>` : `<button class="sm ${p.money >= it.price ? 'warn' : ''}" data-buy="${it.id}" ${p.money < it.price ? 'disabled' : ''}>Buy</button>`}</td></tr>`; }).join('');
    const html = `${toast()}<h2>🛍 Shopping Center</h2><div class="row"><span>Wallet: <span class="gold">${money(p.money)}</span></span><span class="muted">Boots and gear sharpen training. Outfits raise Charm, which pulls bigger clubs into the transfer window.</span></div>
      <div class="choices"><button class="sm ${tab === 'boots' ? 'primary' : ''}" data-tab="boots">👟 Boots</button><button class="sm ${tab === 'outfits' ? 'primary' : ''}" data-tab="outfits">🧥 Outfits</button><button class="sm ${tab === 'gear' ? 'primary' : ''}" data-tab="gear">🏋 Fitness gear</button></div>
      <div class="tablewrap"><table><thead><tr><th>Item</th><th class="n">Price</th><th>Effect</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${maybeFanEncounter('shop')}`;
    const after = () => {
      bindFan();
      document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { U.shopTab = b.dataset.tab; render(); });
      const key = tab === 'boots' ? 'boots' : tab === 'outfits' ? 'outfit' : 'gear';
      document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const it = items.find(x => x.id === b.dataset.buy); p.money -= it.price; p.owned.push(it.id); p[key] = it.id; if (it.charm) p.charm = E.clamp(p.charm + it.charm, 0, 100); U.toast = `Bought ${esc(it.name)}.${it.charm ? ` Charm +${it.charm}.` : ''}`; if (A) A.sfx('cash'); render(); });
      document.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { p[key] = b.dataset.eq; render(); });
    };
    return { html, actions: [{ label: '← Back to hub', fn: () => go('hub') }], after };
  };

  VIEWS.training = () => {
    const p = P();
    const sessions = Math.floor(p.energy / E.TRAIN_COST);
    const w = D.POSITIONS[p.pos].w;
    const html = `${toast()}<h2>🏃 Training Ground</h2>
      ${bar('Energy', Math.round(p.energy / E.maxEnergy(S) * 100), 'sky')}
      <p class="muted">Each session costs ${E.TRAIN_COST} energy and pleases the coach (+1). Success gives +1 to the attribute. Gains get harder as attributes climb. Skipping a whole week costs coach popularity. Training bonus from kit: +${E.trainBonus(S)}.</p>
      <div class="card"><h3>Attributes · OVR ${p.ovr} (${p.pos})</h3>${E.ATTRS.map(a => bar(`${attrLabel(a)} ${w[a] >= .25 ? '★' : ''}`, p.attrs[a])).join('')}</div>
      <p class="muted">★ marks the attributes your position weights most.</p>`;
    const actions = E.ATTRS.map(a => {
      const chance = Math.round(E.clamp(0.26 + E.trainBonus(S) / 150 - (p.attrs[a] - 50) * 0.006 + (p.age <= 21 ? 0.05 : p.age <= 27 ? 0 : -0.1), 0.05, 0.8) * 100);
      return { label: `${attrLabel(a)} ${p.attrs[a]}`, sub: `${chance}% chance of +1`, disabled: sessions < 1, fn: () => { const r = E.train(S, a); if (A && r.ok && r.gained) A.sfx('ding'); U.toast = r.ok ? (r.gained ? `<span class="green">+1 ${attrLabel(a)}!</span> Now ${p.attrs[a]}. OVR ${p.ovr}.` : `Hard session on ${attrLabel(a)}. No gain this time, but the coach saw you working.`) : r.reason; render(); } };
    });
    actions.push({ label: '← Back to hub', fn: () => go('hub') });
    return { html, actions };
  };

  VIEWS.squad = () => {
    const p = P();
    const rows = S.teammates.map(t => `<tr><td>${t.pos}</td><td>${esc(t.name)}</td><td class="muted">(${esc(t.pron)})</td><td>${esc(t.nat)}</td><td class="n">${t.ovr}</td></tr>`).join('');
    const html = `<h2>👥 ${esc(club().name)} squad</h2><p class="muted">Chemistry ${p.chem}: teammates look for you ${(1 + 2 * p.chem / 100).toFixed(1)}× as often as a stranger.</p>
      <div class="tablewrap"><table><thead><tr><th>Pos</th><th>Name</th><th>Say it</th><th>Nat</th><th class="n">OVR</th></tr></thead><tbody><tr class="me"><td>${p.pos}</td><td>${esc(p.name)} (you)</td><td class="muted">(${esc(p.pron)})</td><td>${esc(p.nat)}</td><td class="n">${p.ovr}</td></tr>${rows}</tbody></table></div>`;
    return { html, actions: [{ label: '← Back to hub', fn: () => go('hub') }] };
  };

  VIEWS.table = () => {
    const id = U.tableLg || lg().id; const L = S.world.find(l => l.id === id);
    const st = E.standings(L);
    const rows = st.map((r, i) => `<tr class="${L.id === lg().id && r.idx === S.clubIdx ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(r.club.name)}</td><td class="n">${r.p}</td><td class="n">${r.w}</td><td class="n">${r.d}</td><td class="n">${r.l}</td><td class="n">${r.gf - r.ga}</td><td class="n"><b>${r.pts}</b></td></tr>`).join('');
    const opts = S.world.map(l => `<option value="${l.id}" ${l.id === id ? 'selected' : ''}>${esc(l.name)} (${esc(l.country)})</option>`).join('');
    const last = (S.lastResults || []).map(r => `<div>${esc(r.h)} <b>${r.gh}–${r.ga}</b> ${esc(r.a)}</div>`).join('');
    const html = `<h2>📊 League tables</h2><label>League <select id="lg-sel">${opts}</select></label>
      <div class="tablewrap"><table><thead><tr><th class="n">#</th><th>Club</th><th class="n">P</th><th class="n">W</th><th class="n">D</th><th class="n">L</th><th class="n">GD</th><th class="n">Pts</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${last && L.id === lg().id ? `<div class="card"><h3>Last round · ${esc(L.name)}</h3>${last}</div>` : ''}`;
    return { html, actions: [{ label: '← Back to hub', fn: () => go('hub') }], after: () => { $('#lg-sel').onchange = e => { U.tableLg = e.target.value; render(); }; } };
  };

  VIEWS.career = () => {
    const p = P();
    const hist = S.history.map(h => `<tr><td>${h.season}</td><td>${esc(h.club)}</td><td>${esc(h.league)}</td><td class="n">${h.finish}${ord(h.finish)}</td><td class="n">${h.apps}</td><td class="n">${h.goals}</td><td class="n">${h.assists}</td><td class="n">${h.motm}</td><td class="n">${h.ovr}</td></tr>`).join('');
    const html = `<h2>📈 Career</h2>
      <div class="cards"><div class="card"><h3>This season</h3><div class="kv"><span class="k">Apps</span><span>${p.apps}</span><span class="k">Goals</span><span>${p.goals}</span><span class="k">Assists</span><span>${p.assists}</span>${p.pos === 'GK' ? `<span class="k">Saves</span><span>${p.saves}</span>` : ''}<span class="k">MOTM</span><span>${p.motm}</span><span class="k">Form (avg)</span><span>${E.formAvg(p).toFixed(2)}</span></div></div>
      <div class="card"><h3>Attributes · OVR ${p.ovr}</h3>${E.ATTRS.map(a => bar(attrLabel(a), p.attrs[a])).join('')}</div></div>
      ${hist ? `<h3>Past seasons</h3><div class="tablewrap"><table><thead><tr><th>S</th><th>Club</th><th>League</th><th class="n">Fin</th><th class="n">Apps</th><th class="n">G</th><th class="n">A</th><th class="n">MOTM</th><th class="n">OVR</th></tr></thead><tbody>${hist}</tbody></table></div>` : '<p class="muted">No completed seasons yet.</p>'}`;
    return { html, actions: [{ label: '← Back to hub', fn: () => go('hub') }] };
  };

  // ---- Stadium / match ----
  VIEWS.stadium = () => {
    const fx = E.nextFixtureFor(lg(), S.clubIdx);
    if (!fx) {
      if (lg().round >= lg().rounds.length) { S.flags.seasonEnd = true; return VIEWS.season(); }
      return { html: `<h2>🏟 Stadium</h2>${fixtureCard()}`, actions: [
        { label: '😴 Rest this week', cls: 'primary', sub: 'Wages paid, leagues play on', fn: () => { E.byeWeek(S); U.toast = 'Bye week. You watched the football from the sofa.'; go('hub'); } },
        { label: '← Back to hub', fn: () => go('hub') } ] };
    }
    S.settings = S.settings || {}; const cur = S.settings.difficulty || 'amateur';
    const diffHtml = `<div class="card"><h3>Difficulty · ${esc(ARC.DIFFICULTY[cur].name)}</h3><div class="choices diff">${ARC.DIFF_ORDER.map(k => `<button type="button" class="sm ${k === cur ? 'primary' : ''} ${k === 'nightmare' ? 'danger' : ''}" data-diff="${k}">${esc(ARC.DIFFICULTY[k].name)}</button>`).join('')}</div><p class="muted">${esc(ARC.DIFFICULTY[cur].blurb)} Rating at full time ${ARC.DIFFICULTY[cur].bonus >= 0 ? '+' : ''}${ARC.DIFFICULTY[cur].bonus.toFixed(1)}.</p></div>`;
    const html = `<h2>🏟 Match Day</h2>${fixtureCard()}${diffHtml}
      <p class="muted">Play Full Match and Highlights put you on the pitch: joystick or WASD to move, Shoot (hold for power), Pass, and Skill for a sprint burst or slide tackle. Text Match is the choice-based commentary version. Sim scrolls the match, Quick Sim jumps to the result. Chemistry ${P().chem}: teammates look for you ${(1 + 2 * P().chem / 100).toFixed(1)}× as often.</p>`;
    const start = mode => () => { U.match = E.buildMatch(S, mode); U.match.introduced = new Set(); U.match.timeline = buildTimeline(U.match); U.match.pos = 0; U.match.shown = [];
      if (mode === 'quick') { advance(U.match, true); finish(); return; }
      go('match'); };
    const unused = P().coach < 15;
    const play = mode => () => { U.arcadeMode = mode; go('arcade'); };
    const actions = [
      { label: '🕹 Play Full Match', cls: 'primary', sub: unused ? 'Not in the squad this week' : 'Two halves, you control your player', disabled: unused, fn: play('full') },
      { label: '⚡ Play Highlights', sub: unused ? 'Not in the squad this week' : 'Short halves, same controls', disabled: unused, fn: play('highlights') },
      { label: '📝 Text Match', sub: 'Choice-based commentary', fn: start('full') },
      { label: '📜 Sim Match', sub: 'Rapid text scroll', fn: start('sim') },
      { label: '⏩ Quick Sim', sub: 'Instant result', fn: start('quick') },
      { label: '← Back to hub', fn: () => go('hub') },
    ];
    return { html, actions, after: () => { document.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { S.settings.difficulty = b.dataset.diff; render(); }); } };
  };

  const FILLER = [
    ['John', '{T} wins a throw-in deep in the {O} half. Patient stuff.'],
    ['Ally', 'The tempo has dropped a touch. Somebody needs to grab this.'],
    ['John', 'Corner to {O}. Cleared at the near post by {T}.'],
    ['Ally', 'Lovely touch from {T} there. Just lovely.'],
    ['John', 'Yellow card for {O}. Late challenge on {T}.'],
    ['Ally', 'The {O} bench are furious with the referee. Can\'t see why myself.'],
    ['John', 'Shot from {O}, well over. The keeper was watching that one all the way.'],
    ['Ally', 'I like the shape. Compact, disciplined, and {P} is finding pockets.'],
    ['John', '{T} with a driven cross. Nobody attacking it.'],
    ['Ally', 'Half-chance for {O} there. Blocked. Bodies on the line.'],
  ];
  function fillText(s, m, mate) {
    return esc(s).replace(/\{T\}/g, `<b>${esc(mateRef(mate || E.pick(S.teammates), m.introduced))}</b>`).replace(/\{O\}/g, esc(m.opp.name)).replace(/\{P\}/g, `<b>${esc(pname())}</b>`);
  }
  function buildTimeline(m) {
    const ev = [];
    if (m.unused) return ev;
    const from = m.starts ? 1 : 61;
    const fillers = m.mode === 'full' ? 4 : m.mode === 'sim' ? 3 : 1;
    for (let i = 0; i < fillers; i++) ev.push({ minute: E.ri(from, 89), kind: 'filler', f: E.pick(FILLER) });
    m.bg.forEach(b => ev.push({ minute: b.minute, kind: 'bg', b }));
    m.moments.forEach(mo => ev.push({ minute: mo.minute, kind: 'moment', mo }));
    ev.push({ minute: 45, kind: 'ht' });
    ev.push({ minute: 91, kind: 'ft' });
    if (!m.starts) ev.push({ minute: 60, kind: 'sub' });
    ev.sort((a, b) => a.minute - b.minute || (a.kind === 'ht' ? -1 : 0));
    return ev;
  }
  function scoreline(m) { const [a, b] = m.score; return m.fx.isHome ? `${esc(m.club.name)} ${a} — ${b} ${esc(m.opp.name)}` : `${esc(m.opp.name)} ${b} — ${a} ${esc(m.club.name)}`; }
  function pushLine(m, who, what, cls) { m.shown.push(scriptLine(who, what, cls, 'm' + S.week + '-' + m.shown.length)); }
  const live = m => A && (m.mode === 'full' || m.mode === 'highlights');
  // Process timeline until a moment needs input (or end). Returns 'moment' | 'end'.
  function advance(m, auto) {
    while (m.pos < m.timeline.length) {
      const e = m.timeline[m.pos];
      if (e.kind === 'filler') pushLine(m, e.f[0], `<span class="muted">${e.minute}'</span> ${fillText(e.f[1], m)}`);
      else if (e.kind === 'bg') {
        if (e.b.side === 'us') { m.score[0]++; pushLine(m, 'John', `<span class="muted">${e.minute}'</span> GOAL! ${esc(mateRef(e.b.scorer, m.introduced))} scores for ${esc(m.club.name)}! ${scoreline(m)}.`, 'goal'); if (live(m)) A.sfx('goal'); }
        else { m.score[1]++; pushLine(m, 'John', `<span class="muted">${e.minute}'</span> Goal for ${esc(m.opp.name)}. ${scoreline(m)}.`, 'bad'); if (live(m)) A.sfx('bad'); }
      }
      else if (e.kind === 'ht') pushLine(m, 'SYS', `HALF TIME · ${scoreline(m)}`, 'event');
      else if (e.kind === 'sub') pushLine(m, 'Ally', `<span class="muted">60'</span> Here comes <b>${esc(pname())}</b> off the bench. Twenty-five minutes to make a point to the coach.`, 'event');
      else if (e.kind === 'ft') { m.pos++; return 'end'; }
      else if (e.kind === 'moment') {
        if (auto) { m.pos++; const idx = E.autoChoice(S, e.mo); pushLine(m, 'Ally', `<span class="muted">${e.minute}'</span> <b>${esc(e.mo.tpl.title)}</b> — ${fillText(e.mo.tpl.setup, m, e.mo.mate)}`, 'event'); resolveAndLog(m, e.mo, idx); continue; }
        return 'moment';
      }
      m.pos++;
    }
    return 'end';
  }
  function resolveAndLog(m, mo, idx) {
    const opt = mo.tpl.opts[idx];
    const r = E.resolveMoment(S, m, mo, idx);
    pushLine(m, 'John', `<b>${esc(pname())}</b> chooses: ${fillText(opt.label, m, mo.mate)}. <span class="muted">(${attrLabel(r.attr)} check, ${Math.round(r.prob * 100)}%)</span>`);
    pushLine(m, 'Ally', fillText(r.txt, m, mo.mate), r.goal || r.assist || r.type === 'save' || r.type === 'key' ? 'goal' : r.ok ? '' : 'bad');
    if (r.goal) pushLine(m, 'John', `${esc(P().name)} (${esc(P().pron)})! ${scoreline(m)}.`, 'goal');
    if (r.assist) pushLine(m, 'John', `Assist ${esc(pname())}. ${scoreline(m)}.`, 'goal');
    if (r.concede) pushLine(m, 'John', `...and it's in. ${esc(m.opp.name)} score. ${scoreline(m)}.`, 'bad');
    pushLine(m, 'SYS', `Rating now <b>${m.rating.toFixed(1)}</b>`, 'min');
    if (live(m)) A.sfx(r.goal || r.assist ? 'goal' : r.concede ? 'bad' : r.type === 'save' || r.type === 'key' ? 'save' : r.ok ? 'click' : 'bad');
  }
  function finish() {
    const m = U.match;
    U.result = E.finishMatch(S, m);
    U.resultMatch = m;
    S.phase = 'hub';
    go('result');
  }

  VIEWS.match = () => {
    const m = U.match; if (!m) return VIEWS.hub();
    if (m.unused && !m.shownUnused) { m.shownUnused = true; pushLine(m, 'SYS', `You are not in the matchday squad. Coach popularity ${P().coach}. You watch from the stands.`, 'bad'); m.state = 'end'; }
    if (!m.state) {
      pushLine(m, 'John', `Welcome to ${m.fx.isHome ? esc(m.club.name) : esc(m.opp.name)}'s ground for ${scoreline(m).replace(/\d+ — \d+/, 'v')}. ${m.starts ? `<b>${esc(P().name)}</b> (${esc(P().pron)}) starts.` : `<b>${esc(pname())}</b> on the bench today.`}`);
      pushLine(m, 'Ally', `${esc(m.club.name)} rated ${m.club.str}, ${esc(m.opp.name)} ${m.opp.str}. ${m.teamDiff > 4 ? 'We should be winning this.' : m.teamDiff < -4 ? 'Big test today.' : 'Nothing between them on paper.'}`);
      m.state = 'run';
      if (A && m.mode !== 'sim') A.sfx('kickoff');
    }
    let actions = [];
    if (m.state === 'run') {
      if (m.mode === 'sim') {
        advance(m, true); m.state = 'end';
      } else {
        const r = advance(m, false);
        m.state = r === 'moment' ? 'choice' : 'end';
      }
    }
    let html = `<div class="score">${scoreline(m)}<small>${m.mode.toUpperCase()} · RATING ${m.rating.toFixed(1)}</small></div><div class="log" id="log">${m.shown.join('')}`;
    if (m.state === 'choice') {
      const e = m.timeline[m.pos]; const mo = e.mo;
      html += scriptLine('Ally', `<span class="muted">${e.minute}'</span> <b>${esc(mo.tpl.title)}</b> — ${fillText(mo.tpl.setup, m, mo.mate)}`, 'event');
      html += `</div><h3>Your call</h3>`;
      actions = mo.tpl.opts.map((o, i) => { const pr = Math.round(E.successProb(P().attrs[o.attr], o.diff, m.teamDiff, E.formAvg(P())) * 100);
        return { label: fillText(o.label, m, mo.mate), sub: `${attrLabel(o.attr)} · ${o.guess ? 'guess' : pr + '%'} · ${o.ok.type.toUpperCase()}`, fn: () => { m.pos++; resolveAndLog(m, mo, i); m.state = 'run'; render(); } }; });
    } else {
      pushLine(m, 'SYS', `FULL TIME · ${scoreline(m)}`, 'event');
      html = `<div class="score">${scoreline(m)}<small>FULL TIME · RATING ${m.unused ? '—' : m.rating.toFixed(1)}</small></div><div class="log" id="log">${m.shown.join('')}</div>`;
      actions = [{ label: '▶ Full-time report', cls: 'primary', fn: finish }];
      m.state = 'done';
      if (A && m.mode !== 'sim') A.sfx('fulltime');
    }
    return { html, actions, after: () => {
      const l = $('#log'); if (!l) return;
      if (m.mode === 'sim' && !m.animated) {
        m.animated = true;
        const lines = [...l.querySelectorAll('.line')]; const act = $('#actions');
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduce && lines.length) {
          lines.forEach(x => { x.hidden = true; }); act.hidden = true;
          let i = 0; const skip = document.createElement('button'); skip.className = 'sm'; skip.textContent = '⏩ Skip to full time'; l.before(skip);
          if (A) A.sfx('kickoff');
          const done = () => { clearInterval(t); lines.forEach(x => { x.hidden = false; }); act.hidden = false; skip.remove(); l.scrollTop = l.scrollHeight; if (A) { A.stopSpeech(); A.sfx('fulltime'); } };
          const t = setInterval(() => { if (i >= lines.length) return done(); const x = lines[i++]; x.hidden = false; l.scrollTop = l.scrollHeight;
            if (A && (x.classList.contains('goal') || x.classList.contains('bad'))) { A.sfx(x.classList.contains('goal') ? 'goal' : 'bad'); spoken.add(x.dataset.say); A.speak(x.querySelector('.who').textContent, x.querySelector('.what').innerHTML, { priority: true }); } }, 160);
          skip.onclick = done;
          return;
        }
      }
      l.scrollTop = l.scrollHeight;
    } };
  };

  VIEWS.arcade = () => {
    const p = P(); const lgx = lg(); const fx = E.nextFixtureFor(lgx, S.clubIdx);
    if (!fx) return VIEWS.stadium();
    const opp = lgx.clubs[fx.opp]; const mode = U.arcadeMode || 'full';
    const html = `<p class="muted">Match in progress in full screen.</p><div class="script" id="arc-log"></div>`;
    const abandon = () => { const m = E.buildMatch(S, 'quick'); m.introduced = new Set(); m.timeline = buildTimeline(m); m.pos = 0; m.shown = []; advance(m, true); U.match = m; finish(); };
    const after = () => {
      const host = fullscreenHost(); const log = document.createElement('div'); log.className = 'script arc-log'; host.appendChild(log);
      const introduced = new Set(); const say = (who, txt, cls, prio) => { const el = document.createElement('div'); el.innerHTML = scriptLine(who, txt, cls, 'arc' + S.week + '-' + (log.childElementCount)); log.prepend(el.firstChild); while (log.childElementCount > 6) log.lastElementChild.remove(); if (A) A.speak(who, txt, prio ? { priority: true } : undefined); };
      const nm = pl => pl ? (pl.isUser ? esc(pname()) : pl.team === 0 ? esc(mateRef({ name: pl.name, last: pl.last, pron: pl.pron || '' }, pl.pron ? introduced : null)) : `${esc(opp.name)}'s number ${pl.number}`) : 'someone';
      const starts = p.coach >= 35;
      U.arcade = ARC.start({ host, difficulty: (S.settings && S.settings.difficulty) || 'amateur', onExit: () => { if (confirm('Abandon the match? It will be quick-simmed instead.')) abandon(); }, user: { name: p.name, last: pname(), pos: p.pos, attrs: p.attrs, look: p.look, number: p.pos === 'GK' ? 1 : 10 }, teammates: S.teammates, club: club(), opp, isHome: fx.isHome, mode, chem: p.chem, starts,
        secondsPerHalf: mode === 'highlights' ? 60 : 150, timeScale: U.testTimeScale || 1,
        onEvent: (type, d) => {
          if (type === 'kickoff') { say('John', `${fx.isHome ? esc(club().name) : esc(opp.name)} get us under way. ${starts ? `<b>${esc(p.name)}</b> (${esc(p.pron)}) starts.` : `<b>${esc(pname())}</b> starts on the bench.`}`); if (A) A.sfx('kickoff'); }
          else if (type === 'goal') { const us = d.team === 0; say(us ? 'Ally' : 'John', us ? `GOAL! ${nm(d.scorer)} scores${d.assist ? `, set up by ${nm(d.assist)}` : ''}! ${esc(club().name)} ${d.score[0]}, ${esc(opp.name)} ${d.score[1]}.` : `Goal for ${esc(opp.name)}. ${esc(club().name)} ${d.score[0]}, ${esc(opp.name)} ${d.score[1]}.`, us ? 'goal' : 'bad', true); if (A) A.sfx(us ? 'goal' : 'bad'); }
          else if (type === 'save' && d.big) { say('Ally', d.p.team === 0 ? `What a save by ${d.p.isUser ? esc(pname()) : 'the keeper'}!` : 'Great save by their keeper. So close.', d.p.team === 0 ? 'goal' : 'bad'); if (A) A.sfx('save'); }
          else if (type === 'shot' && d.p.isUser) { if (!d.onTarget) say('John', `${esc(pname())} lets fly... wide.`, 'bad'); }
          else if (type === 'tackle') { say('John', `Big tackle from ${esc(pname())}!`, 'goal'); }
          else if (type === 'save' && d.claim && d.p.team === 0) { say('Ally', `${d.p.isUser ? esc(pname()) : 'The keeper'} comes out and claims it.`); }
          else if (type === 'out') { say('John', `${d.type === 'THROW-IN' ? 'Throw-in' : d.type === 'CORNER' ? 'Corner' : 'Goal kick'} to ${d.team === 0 ? esc(club().name) : esc(opp.name)}.`, 'min'); }
          else if (type === 'halftime') { say('John', `Half time. ${esc(club().name)} ${d.score[0]}, ${esc(opp.name)} ${d.score[1]}.`, 'event', true); if (A) A.sfx('fulltime'); }
          else if (type === 'sub') { say('Ally', `Here comes <b>${esc(pname())}</b>. Time to make a point to the coach.`, 'event', true); }
          else if (type === 'fulltime') { say('John', `Full time. ${esc(club().name)} ${d.score[0]}, ${esc(opp.name)} ${d.score[1]}. ${esc(pname())} rated ${d.rating.toFixed(1)}.`, 'event', true); if (A) A.sfx('fulltime'); }
        },
        onEnd: res => {
          const m = { fx, opp, club: club(), mode, score: res.score, rating: res.rating, goals: res.goals, assists: res.assists, saves: res.saves, keys: res.keys, unused: !res.played, starts, teamDiff: club().str - opp.str, shown: [], log: [], arcade: res };
          U.arcade = null; U.result = E.finishMatch(S, m); U.resultMatch = m; S.phase = 'hub'; go('result');
        } });
    };
    return { html, actions: [{ label: '⏹ Abandon match', cls: 'danger', sub: 'Counts as a quick sim', fn: abandon }], after };
  };

  VIEWS.result = () => {
    const m = U.resultMatch, ch = U.result, p = P();
    if (!m || !ch) return VIEWS.hub();
    const st = E.standings(lg()); const myPos = st.findIndex(r => r.idx === S.clubIdx) + 1;
    const delta = (k, v) => `<span class="k">${k}</span><span class="${v > 0 ? 'green' : v < 0 ? 'red' : 'muted'}">${v > 0 ? '+' : ''}${v}</span>`;
    const attrs = ch.attrs.map(a => a[0] === '-' ? `<span class="red">−1 ${attrLabel(a.slice(1))}</span>` : `<span class="green">+1 ${attrLabel(a)}</span>`).join(', ');
    const html = `<h2>Full-time report</h2>
      <div class="score">${scoreline(m)}<small>${ch.win ? 'WIN · +3 pts' : ch.draw ? 'DRAW · +1 pt' : 'LOSS'} · ${esc(club().name)} now ${myPos}${ord(myPos)}</small></div>
      <div class="cards">
        <div class="card ${ch.motm ? 'hl' : ''}"><h3>Your match</h3><div class="kv"><span class="k">Rating</span><span class="gold">${ch.rating === null ? 'Unused sub' : ch.rating.toFixed(1)}</span><span class="k">Goals</span><span>${m.goals}</span><span class="k">Assists</span><span>${m.assists}</span>${p.pos === 'GK' ? `<span class="k">Saves</span><span>${m.saves}</span>` : `<span class="k">Key plays</span><span>${m.keys}</span>`}${m.arcade ? `<span class="k">Shots</span><span>${m.arcade.shots} (${m.arcade.onTarget} on target)</span><span class="k">Passes</span><span>${m.arcade.passesOk}/${m.arcade.passes}</span><span class="k">Tackles</span><span>${m.arcade.tackles}</span><span class="k">Touches</span><span>${m.arcade.touches}</span><span class="k">Difficulty</span><span>${esc(m.arcade.difficulty || '')}</span>` : ''}</div>${ch.motm ? '<span class="pill gold">★ Man of the Match</span>' : ''}</div>
        <div class="card"><h3>Changes</h3><div class="kv">${delta('Coach', ch.coach)}${delta('Fans', ch.fans)}${delta('Fame', ch.fame)}${delta('Chemistry', ch.chem)}${delta('Charm', ch.charm)}<span class="k">Bonus</span><span class="gold">${money(ch.money)}</span><span class="k">Wage</span><span class="gold">${money(p.contract.wage)}</span></div>${attrs ? `<div>${attrs} → OVR ${p.ovr}</div>` : ''}</div>
      </div>
      ${ch.motm ? `<div class="script">${scriptLine('Ally', `Player of the match, no argument: <b>${esc(p.name)}</b> (${esc(p.pron)}). Remember the pronunciation, John.`)}${scriptLine('John', 'Noted. Again.')}</div>` : ''}
      <div class="card"><h3>${esc(lg().name)} · top of the table</h3><div class="tablewrap"><table><tbody>${st.slice(0, 5).map((r, i) => `<tr class="${r.idx === S.clubIdx ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(r.club.name)}</td><td class="n">${r.p}</td><td class="n">${r.pts}</td></tr>`).join('')}${myPos > 5 ? `<tr class="me"><td class="n">${myPos}</td><td>${esc(club().name)}</td><td class="n">${lg().table[S.clubIdx].p}</td><td class="n">${lg().table[S.clubIdx].pts}</td></tr>` : ''}</tbody></table></div></div>
      ${S.flags.transferWindow ? '<div class="notice">📋 The transfer window opens this week.</div>' : ''}${S.flags.seasonEnd ? '<div class="notice">🏁 That was the final round of the season.</div>' : ''}`;
    return { html, actions: [{ label: '▶ Continue', cls: 'primary', fn: () => { U.match = null; U.resultMatch = null; U.result = null; go('hub'); } }], after: () => { if (A && ch.motm) A.sfx('chant'); } };
  };

  // ---- PHASE 4: transfer window ----
  VIEWS.transfer = () => {
    const p = P();
    if (!U.offers) U.offers = E.genOffers(S);
    if (!U.offers.length) U.offers = E.startingOffers(S).slice(0, 2);
    const expired = p.contract.weeksLeft <= 0;
    const cards = U.offers.map(o => `<div class="card ${o.kind === 'renewal' ? '' : 'hl'}"><h3>${o.kind === 'renewal' ? 'Contract renewal' : 'Transfer offer'} · ${esc(o.leagueName)}</h3>
      <div class="gold">${esc(o.clubName)} <span class="muted">(str ${o.str}, tier ${o.tier})</span></div>
      <div class="kv"><span class="k">Basic wage</span><span>${money(o.wage)} / wk</span><span class="k">Image rights</span><span>${money(o.imageRights)} / wk</span><span class="k">Signing bonus</span><span>${money(o.bonus)}</span><span class="k">Length</span><span>${o.weeks} weeks</span><span class="k">Squad role</span><span>${esc(o.role)}</span></div>
      <p class="muted">"${esc(o.promise)}"</p></div>`).join('');
    const html = `${toast()}<h2>📋 Transfer window · Week ${S.week}</h2>
      <p>OVR ${p.ovr}, form ${E.formAvg(p).toFixed(1)}, charm ${p.charm}. ${p.charm >= 40 ? 'Your profile is pulling bigger clubs in.' : 'More charm would tempt bigger clubs.'} ${expired ? '<span class="red">Your contract has expired: you must sign somewhere.</span>' : `${p.contract.weeksLeft} weeks left on your current deal.`}</p>
      <div class="cards">${cards}</div>`;
    const actions = U.offers.map(o => ({ label: `✍ ${o.kind === 'renewal' ? 'Renew with' : 'Join'} ${esc(o.clubName)}`, cls: 'primary', sub: `${money(o.wage + o.imageRights)}/wk · ${esc(o.role)}`, fn: () => {
      E.acceptOffer(S, o); p.contract.wage = o.wage + o.imageRights; U.offers = null; S.flags.transferWindow = false; U.welcome = o.kind !== 'renewal'; U.toast = o.kind === 'renewal' ? `New deal signed at ${esc(o.clubName)}.` : null; go('hub'); } }));
    actions.push({ label: '✋ Decline all offers', cls: 'warn', disabled: expired, sub: expired ? 'Contract expired' : 'Stay on current terms', fn: () => { U.offers = null; S.flags.transferWindow = false; U.toast = 'You stay put. The agent sighs audibly.'; go('hub'); } });
    return { html, actions };
  };

  VIEWS.season = () => {
    if (!U.summary) U.summary = E.seasonRollover(S);
    const s = U.summary, p = P();
    const html = `<h2>🏁 Season ${s.season} complete</h2>
      <div class="cards"><div class="card hl"><h3>${esc(s.club)} · ${esc(s.league)}</h3><div class="kv"><span class="k">Finished</span><span class="gold">${s.finish}${ord(s.finish)}</span><span class="k">Points</span><span>${s.pts}</span></div>${s.finish === 1 ? '<span class="pill gold">🏆 Champions</span>' : ''}</div>
      <div class="card"><h3>Your season</h3><div class="kv"><span class="k">Apps</span><span>${s.apps}</span><span class="k">Goals</span><span>${s.goals}</span><span class="k">Assists</span><span>${s.assists}</span><span class="k">MOTM</span><span>${s.motm}</span><span class="k">OVR</span><span>${s.ovr}</span></div></div></div>
      <div class="script">${scriptLine('John', `Another year older. <b>${esc(p.name)}</b> turns ${p.age}.`)}${scriptLine('Ally', s.finish <= 3 ? 'Top-three finish. The phone will be ringing.' : s.finish >= 15 ? 'Rough season. Time to knuckle down on the training ground.' : 'Solid, unspectacular. Next year has to be the step up.')}</div>`;
    return { html, actions: [{ label: '▶ New season', cls: 'primary', fn: () => { U.summary = null; go('hub'); } }] };
  };

  // ---------- boot ----------
  window.PPL_DEBUG = { setTimeScale: v => { U.testTimeScale = v; }, state: () => S, ui: () => U };
  const sndBtn = $('#snd');
  if (sndBtn && A) sndBtn.onclick = () => { A.unlock(); A.setEnabled(!A.isEnabled()); soundBtn(); if (A.isEnabled()) A.sfx('ding'); };
  function start(hot) {
    if (hot && hot.S) { S = hot.S; U = hot.U || { screen: S.phase }; if (U.match && U.match.introduced) U.match.introduced = new Set(U.match.introduced); }
    render();
  }
  try {
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      window.claude.hot.snapshot(() => ({ S, U: Object.assign({}, U, { match: U.match ? Object.assign({}, U.match, { introduced: [...(U.match.introduced || [])] }) : null }) }));
    }
  } catch (e) { /* no hot runtime */ }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
