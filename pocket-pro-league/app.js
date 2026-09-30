/* Pocket Pro League — UI & flow */
(function () {
  'use strict';
  const D = window.PPL_DATA, E = window.PPL, A = window.PPL_AUDIO, SP = window.PPL_SPRITES, ARC = window.PPL_ARCADE, TOWN = window.PPL_TOWN, CUT = window.PPL_CUT;
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
  // ---------- saving: this browser (localStorage) plus the artifact's per-user cloud store when available ----------
  const cloud = { ref: null, status: 'checking', lastSync: 0, busy: false, dirty: false, remote: null, error: null };
  const saveLocal = () => { try { if (S) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
  const load = () => { try { const j = localStorage.getItem(SAVE_KEY); return j ? JSON.parse(j) : null; } catch (e) { return null; } };
  const save = () => { if (!S) return; S.savedAt = Date.now(); saveLocal(); cloudSave(); };
  async function cloudSave() {
    if (!cloud.ref || !S) return;
    if (cloud.busy) { cloud.dirty = true; return; }
    cloud.busy = true; cloud.dirty = false;
    try {
      const body = JSON.parse(JSON.stringify(S));
      if (JSON.stringify(body).length > 240000) throw new Error('save too large for cloud');
      await cloud.ref.set(body);
      cloud.status = 'on'; cloud.lastSync = Date.now(); cloud.error = null;
    } catch (e) { cloud.status = 'error'; cloud.error = e && (e.code || e.message) || 'unknown'; }
    cloud.busy = false;
    if (cloud.dirty) { cloud.dirty = false; setTimeout(cloudSave, 400); }
    else if (U.screen === 'menu') render();
  }
  async function cloudInit() {
    try {
      if (!(window.claude && typeof window.claude.use === 'function')) { cloud.status = 'off'; return; }
      const [user, db] = await Promise.all([window.claude.use('user'), window.claude.use('db')]);
      const uid = user && await user.id();
      if (!db || !uid) { cloud.status = 'off'; return; }
      cloud.ref = db.doc('data/users/' + uid + '/career');
      const snap = await cloud.ref.get();
      if (snap.exists) {
        const remote = snap.data();
        const local = load();
        // the newer of the two wins; the cloud copy is what follows you between devices
        if (!local || (remote.savedAt || 0) >= (local.savedAt || 0)) { cloud.remote = remote; try { localStorage.setItem(SAVE_KEY, JSON.stringify(remote)); } catch (e) { /* ignore */ } }
        cloud.lastSync = remote.savedAt || Date.now();
      }
      cloud.status = 'on';
      if (S && !cloud.remote) cloudSave(); // a career started before the cloud answered gets backed up now
    } catch (e) { cloud.status = 'error'; cloud.error = e && (e.code || e.message) || 'unknown'; }
    if (U.screen === 'menu') render();
  }
  cloudInit();
  function cloudLine() {
    const ago = cloud.lastSync ? Math.max(0, Math.round((Date.now() - cloud.lastSync) / 60000)) : null;
    if (cloud.status === 'on') return `<span class="green">☁ Cloud save on</span>${ago !== null ? ` · synced ${ago < 1 ? 'just now' : ago + ' min ago'}` : ''}. Your career follows your account across devices.`;
    if (cloud.status === 'checking') return '☁ Checking cloud save…';
    if (cloud.status === 'error') return `<span class="red">☁ Cloud save failed (${esc(String(cloud.error))})</span>. Progress is still kept in this browser.`;
    return '☁ Cloud save unavailable here. Progress is kept in this browser only.';
  }
  const formIcon = () => { const f = P().formHist || []; if (f.length < 2) return '📈'; const last = f.slice(-3), prev = f.slice(-6, -3); const a = arr => arr.reduce((x, y) => x + y, 0) / (arr.length || 1); return prev.length ? (a(last) >= a(prev) ? '📈' : '📉') : (a(last) >= 6.5 ? '📈' : '📉'); };
  const attrLabel = a => (P().pos === 'GK' ? D.GK_ATTR_LABELS : D.ATTR_LABELS)[a];
  const starts = () => P().coach >= 35;

  // ---------- looks ----------
  function ensureLooks() {
    if (!S) return;
    if (!S.player.look) S.player.look = U.look || SP.defaultLook();
    if (!S.player.kit) S.player.kit = 'k0';
    if (!S.player.acc) S.player.acc = {};
    if (!S.player.owned.includes('k0')) S.player.owned.push('k0');
    S.teammates.forEach(t => { if (!t.look) t.look = SP.randomLook(); });
  }
  function clubKit() { return S && S.clubIdx >= 0 ? SP.baseKit(club().name) : { shirt: '#c8102e', shorts: '#ffffff' }; }
  const NAT_KIT = { England: ['#ffffff', '#1d3a8a'], Spain: ['#c60b1e', '#1d3a8a'], Italy: ['#0b5fbf', '#ffffff'], Germany: ['#ffffff', '#111111'], France: ['#1d3a8a', '#ffffff'], Brazil: ['#f5d800', '#1d3a8a'], Argentina: ['#75aadb', '#111111'], Nigeria: ['#2ecc71', '#ffffff'], Netherlands: ['#ff7f00', '#ffffff'], Portugal: ['#c8102e', '#1e7a3e'], USA: ['#ffffff', '#1d3a8a'], Japan: ['#1a2f8a', '#ffffff'], Senegal: ['#ffffff', '#1e7a3e'], 'Saudi Arabia': ['#1e7a3e', '#ffffff'] };
  // The kit worn around town: the equipped shop kit, or the club kit
  function myKit() {
    const p = S && S.player; const k = p && D.SHOP.kits.find(x => x.id === p.kit);
    if (!k || k.club) return clubKit();
    if (k.national) { const c = NAT_KIT[p.nat] || ['#ffffff', '#222222']; return { shirt: c[0], shorts: c[1], pattern: 'plain' }; }
    return { shirt: k.shirt, shirt2: k.shirt2, shorts: k.shorts, pattern: k.pattern };
  }
  // Equipped accessories as {slot: item}; pitchOnly keeps the ones allowed in a match
  function myAcc(pitchOnly) { const p = S && S.player; const out = {}; if (!p) return out; for (const [slot, id] of Object.entries(p.acc || {})) { const it = D.SHOP.accessories.find(x => x.id === id); if (it && (!pitchOnly || it.pitch)) out[slot] = it; } return out; }
  // Appearance editor: cycles each trait, live pixel preview
  function lookEditor(look, onChange) {
    const traits = [
      ['skin', 'Skin', SP.SKIN.length, i => 'Tone ' + (i + 1)], ['hair', 'Hair', SP.HAIR_STYLES.length, i => SP.HAIR_STYLES[i]],
      ['hairColor', 'Hair colour', SP.HAIR_COLORS.length, i => ['Black', 'Brown', 'Chestnut', 'Blond', 'Grey', 'Red', 'Platinum', 'Blue'][i]],
      ['beard', 'Beard', 2, i => i ? 'Yes' : 'No'], ['boots', 'Boots', SP.BOOTS.length, i => ['Black', 'White', 'Red', 'Green', 'Blue', 'Yellow', 'Pink'][i]], ['build', 'Build', SP.BUILDS.length, i => SP.BUILDS[i]] ];
    const html = `<div class="look"><canvas class="look-canvas" width="120" height="150"></canvas><div class="look-traits">${traits.map(([k, label, n, name]) => `<div class="look-row"><span class="lbl">${label}</span><button type="button" class="sm" data-lk="${k}" data-d="-1">◀</button><span class="look-val" data-lv="${k}">${name(+look[k])}</span><button type="button" class="sm" data-lk="${k}" data-d="1">▶</button></div>`).join('')}<button type="button" class="sm warn" data-lk="random">🎲 Randomise</button></div></div>`;
    const bind = rootEl => {
      const cv = rootEl.querySelector('.look-canvas'); const ctx = cv.getContext('2d');
      const paint = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.imageSmoothingEnabled = false; SP.drawFigure(ctx, 60, 128, 5.2, look, myKit(), { number: 10, acc: myAcc(false) }); };
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

  // ---------- purchasable item card (garage, estate, shop) ----------
  // state: 'cur' | 'owned' | 'buy'. Buttons are full width so they read on a phone.
  function itemCard(it, o) {
    const p = P(); const short = Math.max(0, Math.round(it.price - p.money));
    const fx = (o.effects || []).filter(Boolean).join(' · ') || 'No effect';
    let btn;
    if (o.state === 'cur') btn = `<span class="pill ok">${esc(o.curLabel)}</span>${o.unequip ? ` <button type="button" class="sm" data-uneq="${o.unequip}">Take off</button>` : ''}`;
    else if (o.state === 'owned') btn = `<button type="button" class="sm" data-${o.key || 'eq'}="${it.id}">${esc(o.useLabel)}</button>`;
    else if (short > 0) btn = `<button type="button" class="sm" disabled>Buy · ${money(it.price)}<span class="sub">${money(short)} short</span></button>`;
    else btn = `<button type="button" class="sm warn" data-buy${o.key}="${it.id}">Buy · ${money(it.price)}</button>`;
    return `<div class="item ${o.state === 'cur' ? 'cur' : ''}"><div class="item-main"><b>${esc(it.name)}</b>${it.desc ? `<span class="muted">${esc(it.desc)}</span>` : ''}<span class="fx">${fx}${it.price ? ` · <span class="gold">${money(it.price)}</span>` : ''}</span></div><div class="item-act">${btn}</div></div>`;
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
    if (U.cut) { const c = U.cut; U.cut = null; c.end(); }
    document.body.classList.remove('has-scene');
    const sr = $('#scene-root'); if (sr) sr.remove();
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
  }
  // ---------- derbies, weather, discipline ----------
  function rivalOf(name) { const r = D.RIVALS[name]; if (r) return r; const L = lg(); const i = L.clubs.findIndex(c => c.name === name); const rev = Object.keys(D.RIVALS).find(k => D.RIVALS[k] === name); if (rev && L.clubs.some(c => c.name === rev)) return rev; return L.clubs[(i + 1) % L.clubs.length].name; }
  function isDerby(oppName) { return rivalOf(club().name) === oppName || rivalOf(oppName) === club().name; }
  function pickWeather() { const r = Math.random(); return r < 0.22 ? 'rain' : r < 0.5 ? 'night' : 'clear'; }
  const WEATHER_TXT = { rain: 'Rain lashing down. The ball will skid and the slide tackles will be long.', night: 'Under the floodlights tonight.', clear: 'Perfect conditions.' };
  // ---------- Batch C: life — phone, dating, family ----------
  const TRAITS = [['foodie', 'loves a long dinner'], ['homebody', 'happiest on the sofa'], ['adventurer', 'wants weekends away'], ['fan', 'never misses a match'], ['private', 'hates the spotlight'], ['ambitious', 'runs a business of their own']];
  const FIRST_NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Riley', 'Casey', 'Jamie', 'Robin', 'Charlie', 'Elena', 'Maya', 'Sofia', 'Zara', 'Noor', 'Aisha', 'Leo', 'Mateo', 'Kai', 'Theo'];
  function life() { S.life = S.life || { status: 'single', partner: null, love: 0, since: 0, lastContact: 0, livesTogether: false, children: [], ring: false, posts: 0, weekPosted: 0, brandTier: 0, cands: null, expecting: 0, married: 0 }; return S.life; }
  function followers() { const p = P(); return Math.round(p.fans * 1400 + p.fame * 6500 + (life().posts * 300)); }
  function makeCandidate() { const t = E.pick(TRAITS); const nat = E.pick([lg().country, P().nat, E.pick(D.NATIONALITIES)]); const per = E.genPerson(nat, new Set()); return { name: E.pick(FIRST_NAMES) + ' ' + per.last, nat, trait: t[0], traitText: t[1], look: SP.randomLook(), kit: { shirt: `hsl(${Math.floor(Math.random() * 360)} 50% 45%)`, shorts: '#2b2b2b' } }; }
  function lifeTick() {
    const L = life(); const p = P();
    if (L.status !== 'single' && L.partner) {
      const gap = S.week - L.lastContact; if (gap >= 2) L.love = E.clamp(L.love - (gap >= 4 ? 6 : 3), 0, 100);
      if (L.love < 10) { U.lifeNote = `${L.partner.name} has ended things. "You were never there."`; L.status = 'single'; L.partner = null; L.livesTogether = false; L.love = 0; p.fans = E.clamp(p.fans - 2, 0, 100); }
      else if (L.livesTogether) p.energy = Math.min(E.maxEnergy(S), p.energy + 6);
      if (L.expecting && S.week >= L.expecting) { L.expecting = 0; const child = { name: E.pick(FIRST_NAMES), look: Object.assign(SP.randomLook(), { skin: Math.random() < 0.5 ? p.look.skin : L.partner.look.skin, beard: false, hair: 1 }), born: S.week }; L.children.push(child); p.fame = E.clamp(p.fame + 3, 0, 100); p.fans = E.clamp(p.fans + 3, 0, 100); L.love = E.clamp(L.love + 10, 0, 100); U.pendingCut = { type: 'baby', data: cutData({ partner: L.partner, child }) }; }
      if (L.children.length && S.week % 10 === 0) p.fans = E.clamp(p.fans + 1, 0, 100);
    }
    // brand approaches at fame thresholds
    const tiers = [[25, 'Local Gym Chain', 150, 20], [45, 'Sports Drink', 500, 24], [65, 'Global Sportswear', 1400, 30], [85, 'Luxury Watchmaker', 3000, 40]];
    const next = tiers[L.brandTier]; if (next && p.fame >= next[0] && !L.brandOffer) L.brandOffer = { name: next[1], weekly: next[2], weeks: next[3], tier: L.brandTier };
  }
  function familyOpts() { const L = life(); return { partner: L.partner, livesTogether: L.livesTogether, children: L.children }; }
  const lifeView = () => {
    const p = P(); const L = life(); const tab = U.lifeTab || 'social'; const canPost = L.weekPosted !== S.week;
    let body = '';
    if (tab === 'social') {
      body = `<div class="card"><h3>@${esc(pname().toLowerCase().replace(/\s+/g, ''))}</h3><div class="kv"><span class="k">Followers</span><span class="gold">${followers().toLocaleString('en-US')}</span><span class="k">Posts</span><span>${L.posts}</span></div></div>
        ${L.brandOffer ? `<div class="card hl"><h3>Brand approach</h3><p><b>${esc(L.brandOffer.name)}</b> want you: ${money(L.brandOffer.weekly)} a week for ${L.brandOffer.weeks} weeks.</p><div class="choices"><button type="button" class="sm primary" data-brand="yes">Sign the deal</button><button type="button" class="sm" data-brand="no">Decline</button></div></div>` : ''}
        <div class="choices"><button type="button" class="sm warn" data-post="match" ${canPost ? '' : 'disabled'}>📸 Post a match update<span class="sub">fans +2, fame +1, small backlash risk</span></button><button type="button" class="sm" data-post="flex" ${canPost ? '' : 'disabled'}>🚗 Post the car and the house<span class="sub">charm +1, fans −1 if it looks like showing off</span></button>${L.status !== 'single' ? `<button type="button" class="sm" data-post="couple" ${canPost ? '' : 'disabled'}>❤ Post with ${esc(L.partner.name)}<span class="sub">love +4, fans +1</span></button>` : ''}</div>
        ${canPost ? '' : '<p class="muted">You have posted this week. Once a week keeps the followers keen.</p>'}`;
    } else if (tab === 'dating') {
      if (L.status === 'single') {
        if (!L.cands || L.cands.week !== S.week) L.cands = { week: S.week, list: [makeCandidate(), makeCandidate(), makeCandidate()] };
        body = `<p class="muted">Charm ${p.charm}. Higher charm, better odds. Fame helps too.</p><div class="items">${L.cands.list.map((c, i) => `<div class="item"><div class="item-main"><b>${esc(c.name)}</b><span class="muted">${esc(c.nat)} · ${esc(c.traitText)}</span></div><div class="item-act"><button type="button" class="sm warn" data-ask="${i}">Ask out</button></div></div>`).join('')}</div>${U.lifeNote ? `<div class="notice">${U.lifeNote}</div>` : ''}`;
      } else {
        const weeks = S.week - L.since; const canMoveIn = L.love >= 60 && weeks >= 8 && p.estate !== 'h0' && !L.livesTogether; const canPropose = L.love >= 85 && weeks >= 20 && L.ring && L.status !== 'married' && L.status !== 'engaged';
        body = `<div class="card hl"><h3>${esc(L.partner.name)} · ${esc(L.status)}</h3><div class="muted">${esc(L.partner.traitText)} · together ${weeks} weeks${L.livesTogether ? ' · living together' : ''}</div>${bar('Love', L.love, 'gold')}</div>
          <div class="choices"><button type="button" class="sm" data-life="msg" ${L.lastContact === S.week ? 'disabled' : ''}>💬 Send a message<span class="sub">love +3, once a week</span></button><button type="button" class="sm" data-life="gifts">🎁 Buy a gift<span class="sub">shop, gifts tab</span></button>
          ${canMoveIn ? '<button type="button" class="sm primary" data-life="movein">🏠 Ask them to move in<span class="sub">needs love 60+, 8 weeks, a real home</span></button>' : ''}
          ${canPropose ? '<button type="button" class="sm primary" data-life="propose">💍 Propose<span class="sub">you bought the ring</span></button>' : (L.status === 'together' || L.status === 'dating') && L.status !== 'engaged' ? `<button type="button" class="sm" disabled>💍 Propose<span class="sub">love 85+, 20 weeks, and a ring from the shop</span></button>` : ''}
          ${L.status === 'married' && !L.expecting && L.children.length < 3 && (!L.children.length || S.week - L.children[L.children.length - 1].born >= 20) ? '<button type="button" class="sm primary" data-life="family">👶 Start a family<span class="sub">a new arrival in about 8 weeks</span></button>' : ''}
          ${L.expecting ? `<button type="button" class="sm" disabled>👶 Baby due in ${Math.max(0, L.expecting - S.week)} weeks</button>` : ''}
          <button type="button" class="sm danger" data-life="breakup">💔 End it</button></div>
          ${L.children.length ? `<div class="card"><h3>Family</h3>${L.children.map(c => `<div>👶 ${esc(c.name)} · ${Math.floor((S.week - c.born) / 40)} years</div>`).join('')}</div>` : ''}${U.lifeNote ? `<div class="notice">${U.lifeNote}</div>` : ''}`;
      }
    }
    const html = `${toast()}<h2>📱 Phone</h2><div class="choices"><button type="button" class="sm ${tab === 'social' ? 'primary' : ''}" data-ltab="social">Social</button><button type="button" class="sm ${tab === 'dating' ? 'primary' : ''}" data-ltab="dating">${L.status === 'single' ? 'Dating' : 'Partner & family'}</button></div>${body}`;
    const after = () => {
      document.querySelectorAll('[data-ltab]').forEach(b => b.onclick = () => { U.lifeTab = b.dataset.ltab; U.lifeNote = null; render(); });
      document.querySelectorAll('[data-post]').forEach(b => b.onclick = () => { const k = b.dataset.post; L.weekPosted = S.week; L.posts++; p.energy = Math.max(0, p.energy - 3);
        if (k === 'match') { if (Math.random() < 0.1) { p.fans = E.clamp(p.fans - 3, 0, 100); U.toast = 'The comments turned on you. Fans −3. Maybe not after a defeat next time.'; } else { p.fans = E.clamp(p.fans + 2, 0, 100); if (p.fame < 60) p.fame = E.clamp(p.fame + 1, 0, 100); U.toast = 'Post is doing numbers. Fans +2, Fame +1.'; } }
        if (k === 'flex') { if (Math.random() < 0.35) { p.fans = E.clamp(p.fans - 1, 0, 100); p.charm = E.clamp(p.charm + 1, 0, 100); U.toast = 'Charm +1, but the fans think you are showing off. Fans −1.'; } else { p.charm = E.clamp(p.charm + 1, 0, 100); U.toast = 'Tasteful. Charm +1.'; } }
        if (k === 'couple') { L.love = E.clamp(L.love + 4, 0, 100); L.lastContact = S.week; p.fans = E.clamp(p.fans + 1, 0, 100); U.toast = `${esc(L.partner.name)} liked it. Love +4, Fans +1.`; }
        save(); render(); });
      document.querySelectorAll('[data-brand]').forEach(b => b.onclick = () => { const o = L.brandOffer; L.brandOffer = null; if (b.dataset.brand === 'yes') { p.sponsors = p.sponsors || []; p.sponsors.push({ name: o.name, weekly: o.weekly, weeksLeft: o.weeks }); L.brandTier = o.tier + 1; U.toast = `Signed with ${esc(o.name)}: ${money(o.weekly)} a week.`; } else { L.brandTier = o.tier + 1; U.toast = 'Declined. Bigger brands will come with more fame.'; } save(); render(); });
      document.querySelectorAll('[data-ask]').forEach(b => b.onclick = () => { const c = L.cands.list[+b.dataset.ask]; const pr = 0.35 + p.charm / 150 + (p.fame >= 30 ? 0.2 : 0);
        if (Math.random() < pr) { L.status = 'dating'; L.partner = c; L.love = 25; L.since = S.week; L.lastContact = S.week; L.cands = null; U.lifeNote = `${esc(c.name)} said yes. First date at the café is on you.`; }
        else { L.cands.list.splice(+b.dataset.ask, 1); U.lifeNote = `${esc(c.name)} is not interested. Charm helps.`; }
        save(); render(); });
      document.querySelectorAll('[data-life]').forEach(b => b.onclick = () => { const k = b.dataset.life;
        if (k === 'msg') { L.love = E.clamp(L.love + 3, 0, 100); L.lastContact = S.week; U.lifeNote = 'A long message and a longer reply. Love +3.'; }
        if (k === 'gifts') { U.shopTab = 'gifts'; go('shop'); return; }
        if (k === 'movein') { L.livesTogether = true; L.love = E.clamp(L.love + 10, 0, 100); L.status = 'together'; U.lifeNote = `${esc(L.partner.name)} moved in. They are in the house now, and you sleep better. Energy +6 a week.`; }
        if (k === 'propose') { L.status = 'engaged'; L.ring = false; L.love = 100; save(); playCut('wedding', cutData({ partner: L.partner }), () => { L.status = 'married'; L.married = S.week; L.livesTogether = true; p.fame = E.clamp(p.fame + 5, 0, 100); p.charm = E.clamp(p.charm + 5, 0, 100); U.lifeNote = 'Married. Fame +5, Charm +5.'; save(); render(); }); return; }
        if (k === 'family') { L.expecting = S.week + 8; U.lifeNote = 'A new arrival in about eight weeks. Play the weeks through.'; }
        if (k === 'breakup') { if (!confirm(`End things with ${L.partner.name}?`)) return; L.status = 'single'; L.partner = null; L.livesTogether = false; L.love = 0; p.charm = E.clamp(p.charm - 1, 0, 100); U.lifeNote = 'Single again. The house is quiet.'; }
        save(); render(); });
    };
    return { html, actions: [{ label: '← Back to town', fn: () => { U.lifeNote = null; go('hub'); } }], after };
  };
  // ---------- Batch B: career ----------
  const NATIONS = { England: 86, Spain: 87, Italy: 84, Germany: 85, France: 88, Brazil: 88, Argentina: 87, Nigeria: 76, Netherlands: 84, Portugal: 85, USA: 76, Japan: 78, Senegal: 78, 'Saudi Arabia': 70,
    Croatia: 80, Belgium: 82, Uruguay: 81, Colombia: 79, Mexico: 77, Morocco: 80, Switzerland: 79, Denmark: 78, Sweden: 74, Poland: 76, Turkey: 77, Australia: 72, 'South Korea': 76, Ghana: 74, Egypt: 75, Serbia: 76 };
  const NAT_KIT2 = { Croatia: ['#ffffff', '#1d3a8a'], Belgium: ['#c8102e', '#111111'], Uruguay: ['#63b3ff', '#111111'], Colombia: ['#f5d800', '#1d3a8a'], Mexico: ['#1e7a3e', '#ffffff'], Morocco: ['#c8102e', '#1e7a3e'], Switzerland: ['#c8102e', '#ffffff'], Denmark: ['#c8102e', '#ffffff'], Sweden: ['#f5d800', '#1d3a8a'], Poland: ['#ffffff', '#c8102e'], Turkey: ['#c8102e', '#ffffff'], Australia: ['#f5d800', '#1e7a3e'], 'South Korea': ['#c8102e', '#111111'], Ghana: ['#ffffff', '#111111'], Egypt: ['#c8102e', '#ffffff'], Serbia: ['#c8102e', '#1d3a8a'] };
  function natKit(n) { const c = NAT_KIT[n] || NAT_KIT2[n] || ['#ffffff', '#222222']; return { shirt: c[0], shorts: c[1], pattern: 'plain' }; }
  function callUpThreshold() { return (NATIONS[P().nat] || 78) - 18; }
  function calledUp() { const p = P(); return p.ovr >= callUpThreshold() && p.fame >= 12 && !(p.injury > 0); }
  function worldCupSeason() { return (P().seasons + 1) % 4 === 0; }
  // International breaks at weeks 10 and 30 of the global week count; World Cup at week 30 of a World Cup season
  function pendingInternational() {
    const p = P(); const wk = S.week % 40; if (S.flags.intlWeek === S.week) return null;
    if (wk === 30 && worldCupSeason() && !S.flags.wcDone) return { kind: 'wc' };
    if ((wk === 10 || wk === 30) && calledUp()) return { kind: 'friendly' };
    return null;
  }
  function randomOpponentNation() { const pool = Object.keys(NATIONS).filter(n => n !== P().nat); return pool[Math.floor(Math.random() * pool.length)]; }
  function nationTeammates(nat, str) { return E.genTeammates(P().pos, nat, str - 2, nat).map(t => Object.assign(t, { look: SP.randomLook() })); }
  // Special (non-league) match consequences: no league week is consumed
  function finishSpecial(m, res) {
    const p = P(); const r = res.played ? E.clamp(res.rating, 2, 10) : null; const win = res.score[0] > res.score[1], draw = res.score[0] === res.score[1];
    p.caps = (p.caps || 0) + 1; p.intGoals = (p.intGoals || 0) + res.goals;
    const fame = Math.round((res.goals * 3 + res.assists * 1.5 + (r && r >= 8.3 ? 4 : 0) + (win ? 3 : draw ? 1 : 0)) * (m.wc ? 1.6 : 1));
    p.fame = E.clamp(p.fame + fame, 0, 100); p.fans = E.clamp(p.fans + Math.round(fame * 0.6), 0, 100); p.charm = E.clamp(p.charm + (win ? 1 : 0), 0, 100);
    if (r !== null) p.formHist = (p.formHist || []).concat([r]).slice(-10);
    return { rating: r, motm: r !== null && r >= 8.3, win, draw, fame, fans: Math.round(fame * 0.6), coach: 0, chem: 0, charm: win ? 1 : 0, money: 0, attrs: [] };
  }
  function startSpecial(kind, stage) {
    const p = P(); const nat = p.nat; const str = NATIONS[nat] || 78;
    const oppNat = randomOpponentNation(); const oppStr = (NATIONS[oppNat] || 78) + (stage === 'final' ? 4 : stage === 'semi' ? 2 : 0);
    U.special = { kind, stage, nat, str, opp: { name: oppNat, str: oppStr }, teammates: nationTeammates(nat, str), kits: { home: natKit(nat), away: natKit(oppNat) } };
    U.arcadeMode = 'highlights'; go('arcade');
  }
  function wcNextStage(stage, win, draw) {
    if (stage === 'group1') return 'group2';
    if (stage === 'group2') return (win || draw) ? 'semi' : null;
    if (stage === 'semi') return win ? 'final' : null;
    return null;
  }
  function afterSpecial(res, m) {
    const sp = U.special; U.special = null; S.flags.intlWeek = S.week;
    const ch = finishSpecial(m, res); U.result = ch; U.resultMatch = m; m.special = sp;
    if (sp.kind === 'wc') {
      const next = wcNextStage(sp.stage, ch.win, ch.draw);
      if (sp.stage === 'final' && ch.win) { S.flags.wcDone = true; S.honours = S.honours || []; S.honours.push({ season: P().seasons + 1, name: 'World Cup winner', club: sp.nat }); P().fame = E.clamp(P().fame + 20, 0, 100); P().fans = E.clamp(P().fans + 15, 0, 100); U.afterResult = () => playCut('trophy', cutData({ league: 'World Cup', club: sp.nat, kit: natKit(sp.nat), mates: sp.teammates }), () => go('hub')); }
      else if (next) { U.afterResult = () => startSpecial('wc', next); }
      else { S.flags.wcDone = true; U.toast = `${sp.nat} are out of the World Cup at the ${sp.stage === 'group2' ? 'group stage' : sp.stage === 'semi' ? 'semi-final' : 'final'}.`; }
    }
    save();
  }
  // Manager talk
  const TALKS = {
    minutes: { label: 'Ask for more minutes', fn: () => { const p = P(); if (p.coach >= 50) { p.coach = E.clamp(p.coach + 3, 0, 100); return { who: 'Coach', text: 'You have earned it. Keep this up and the shirt is yours. (Coach +3)' }; } p.coach = E.clamp(p.coach - 3, 0, 100); return { who: 'Coach', text: 'Minutes are earned on the training pitch, not in my office. (Coach −3)' }; } },
    position: { label: 'Ask to play a different position', fn: () => { U.talkPos = true; return { who: 'Coach', text: 'Go on then. Where do you see yourself?' }; } },
    press: { label: 'Back the manager in the press', fn: () => { const p = P(); p.coach = E.clamp(p.coach + 5, 0, 100); p.fame = E.clamp(p.fame + 2, 0, 100); p.fans = E.clamp(p.fans - 1, 0, 100); return { who: 'Coach', text: 'I saw the interview. Loyalty gets remembered here. (Coach +5, Fame +2, Fans −1)' }; } },
    transfer: { label: 'Request a transfer', fn: () => { const p = P(); p.coach = E.clamp(p.coach - 10, 0, 100); p.fans = E.clamp(p.fans - 5, 0, 100); S.flags.transferRequest = true; return { who: 'Coach', text: 'Noted. You will not be first name on the sheet while you are looking at the door. (Coach −10, Fans −5, better offers next window)' }; } },
    checkin: { label: 'Just check in', fn: () => { const p = P(); p.coach = E.clamp(p.coach + 1, 0, 100); return { who: 'Coach', text: `Fine. Coach popularity ${p.coach}. ${p.coach >= 35 ? 'You start.' : 'You sit until that number moves.'} (Coach +1)` }; } },
  };
  const talkView = () => {
    const p = P(); const cool = S.flags.talkWeek && S.week - S.flags.talkWeek < 4;
    const html = `<h2>🗣 Coach's office</h2><div class="script">${scriptLine('Coach', cool ? `We spoke ${S.week - S.flags.talkWeek} week${S.week - S.flags.talkWeek === 1 ? '' : 's'} ago. Come back after a few games.` : `Sit down. What is on your mind, ${esc(pname())}?`)}${U.talkReply ? scriptLine(U.talkReply.who, U.talkReply.text, 'event') : ''}</div>
      ${U.talkPos ? `<h3>Pick a position</h3><div class="choices">${Object.keys(D.POSITIONS).filter(k => k !== p.pos).map(k => `<button type="button" class="sm" data-pos="${k}">${k} · ${esc(D.POSITIONS[k].name)} · OVR ${E.calcOVR(p.attrs, k)}</button>`).join('')}</div>` : ''}`;
    const actions = cool || U.talkReply ? [] : Object.entries(TALKS).map(([k, t]) => ({ label: t.label, fn: () => { S.flags.talkWeek = S.week; U.talkReply = t.fn(); save(); render(); } }));
    actions.push({ label: '← Back to the training ground', fn: () => { U.talkReply = null; U.talkPos = false; go('hub'); } });
    return { html, actions, after: () => { document.querySelectorAll('[data-pos]').forEach(b => b.onclick = () => { const k = b.dataset.pos; p.pos = k; p.ovr = E.calcOVR(p.attrs, k); p.coach = E.clamp(p.coach - 2, 0, 100); U.talkPos = false; U.talkReply = { who: 'Coach', text: `${k} it is. Prove it in training. (OVR now ${p.ovr}, Coach −2)` }; makeRival(); save(); render(); }); } };
  };
  // Positional rival: a named teammate who wants your shirt
  function makeRival() {
    const p = P(); const t = E.genPerson(lg().country, new Set([p.name]));
    const attrs = E.genAttrs(p.pos, E.clamp(club().str - 3 + E.ri(-3, 4), 40, 92));
    S.rival = { name: t.name, last: t.last, pron: t.pron, nat: t.nat, look: SP.randomLook(), pos: p.pos, attrs, ovr: E.calcOVR(attrs, p.pos), form: 50, week: S.week };
  }
  function rivalEff() { const r = S.rival; return r ? r.ovr + (r.form - 50) / 5 : -99; }
  function userEff() { const p = P(); return p.ovr + (E.formAvg(p) - 6) * 4 + p.coach * 0.08; }
  function rivalTick() { const r = S.rival; if (!r) return; r.form = E.clamp(r.form + E.ri(-8, 8), 10, 95); if ((S.week - r.week) % 8 === 0) { r.ovr = Math.min(90, r.ovr + 1); } }
  function benchedByRival() { const p = P(); return S.rival && p.coach < 60 && rivalEff() > userEff() + 3; }
  // Agent: quests and sponsors
  const QUESTS = [
    { id: 'goals3', text: 'Score 3 goals in the next 4 matches', type: 'goals', n: 3, within: 4, reward: { money: 4000, sponsor: { name: 'Velocity Boots', weekly: 250, weeks: 20 } } },
    { id: 'assists3', text: 'Make 3 assists in the next 5 matches', type: 'assists', n: 3, within: 5, reward: { money: 3500, charm: 2 } },
    { id: 'wins2', text: 'Win 2 of the next 3 matches', type: 'wins', n: 2, within: 3, reward: { money: 3000, sponsor: { name: 'Local Car Dealer', weekly: 200, weeks: 12 } } },
    { id: 'motm1', text: 'Be man of the match in the next 4 matches', type: 'motm', n: 1, within: 4, reward: { money: 6000, charm: 3, sponsor: { name: 'Energy Drink', weekly: 400, weeks: 16 } } },
    { id: 'rating7', text: 'Rate 7.0 or better in 3 of the next 4 matches', type: 'rating7', n: 3, within: 4, reward: { money: 5000, sponsor: { name: 'Sportswear Brand', weekly: 600, weeks: 24 } } },
    { id: 'clean', text: 'Keep 2 clean sheets in the next 4 matches', type: 'clean', n: 2, within: 4, reward: { money: 4500, sponsor: { name: 'Gloves Co.', weekly: 300, weeks: 20 } }, def: true },
  ];
  function offeredQuests() { const p = P(); if (!S.questOffers || S.questOffers.week !== S.week) { const pool = QUESTS.filter(q => !q.def || ['GK', 'CB', 'LB', 'RB', 'CDM'].includes(p.pos)).filter(q => !(S.quests || []).some(x => x.id === q.id)); S.questOffers = { week: S.week, ids: E.pick([pool.slice(0, 3), pool.slice(-3), [pool[0], pool[2], pool[pool.length - 1]]]).filter(Boolean).map(q => q.id) }; } return S.questOffers.ids.map(id => QUESTS.find(q => q.id === id)).filter(Boolean); }
  function questProgress(m, ch) {
    const p = P(); S.quests = S.quests || []; const done = [];
    for (const q of S.quests) {
      q.left--; const won = ch.win, r = ch.rating;
      if (q.type === 'goals') q.prog += m.goals; if (q.type === 'assists') q.prog += m.assists; if (q.type === 'wins' && won) q.prog++; if (q.type === 'motm' && ch.motm) q.prog++; if (q.type === 'rating7' && r !== null && r >= 7) q.prog++; if (q.type === 'clean' && m.score[1] === 0 && m.unused !== true) q.prog++;
      if (q.prog >= q.n) { done.push(q); const rw = QUESTS.find(x => x.id === q.id).reward; p.money += rw.money || 0; if (rw.charm) p.charm = E.clamp(p.charm + rw.charm, 0, 100); if (rw.sponsor) { p.sponsors = p.sponsors || []; p.sponsors.push(Object.assign({}, rw.sponsor, { weeksLeft: rw.sponsor.weeks })); } q.state = 'done'; }
      else if (q.left <= 0) { q.state = 'failed'; }
    }
    S.questLog = (S.questLog || []).concat(S.quests.filter(q => q.state).map(q => ({ id: q.id, state: q.state, week: S.week }))).slice(-10);
    S.quests = S.quests.filter(q => !q.state);
    if (done.length) ch.questDone = done.map(q => QUESTS.find(x => x.id === q.id).text);
  }
  function paySponsors(ch) { const p = P(); let total = 0; (p.sponsors || []).forEach(s => { total += s.weekly; s.weeksLeft--; }); p.sponsors = (p.sponsors || []).filter(s => s.weeksLeft > 0); p.money += total; if (ch) ch.sponsorPay = total; }
  const agentView = () => {
    const p = P(); const active = S.quests || []; const offers = offeredQuests();
    const html = `${toast()}<h2>🕴 Agent's office</h2>
      <div class="cards"><div class="card"><h3>Contract</h3><div class="kv"><span class="k">Club</span><span>${esc(p.contract.club)}</span><span class="k">Wage</span><span>${money(p.contract.wage)} / wk</span><span class="k">Left</span><span>${p.contract.weeksLeft} weeks</span><span class="k">Next window</span><span>week ${Math.ceil(S.week / 20) * 20 + 1}</span></div>${S.flags.transferRequest ? '<span class="pill gold">Transfer requested</span>' : ''}</div>
      <div class="card"><h3>Sponsors</h3>${(p.sponsors || []).length ? (p.sponsors || []).map(s => `<div>${esc(s.name)} · <span class="gold">${money(s.weekly)}/wk</span> · ${s.weeksLeft} wks</div>`).join('') : '<p class="muted">No deals yet. Complete a quest or grow your fame.</p>'}</div></div>
      <h3>Active quests</h3>${active.length ? active.map(q => `<div class="card"><b>${esc(QUESTS.find(x => x.id === q.id).text)}</b><div class="muted">Progress ${q.prog}/${q.n} · ${q.left} match${q.left === 1 ? '' : 'es'} left</div></div>`).join('') : '<p class="muted">None. Take one below (max two).</p>'}
      <h3>On offer this week</h3><div class="items">${offers.map(q => `<div class="item"><div class="item-main"><b>${esc(q.text)}</b><span class="fx">Reward: ${money(q.reward.money || 0)}${q.reward.sponsor ? ` + ${esc(q.reward.sponsor.name)} ${money(q.reward.sponsor.weekly)}/wk for ${q.reward.sponsor.weeks} wks` : ''}${q.reward.charm ? ` + ${q.reward.charm} charm` : ''}</span></div><div class="item-act"><button type="button" class="sm warn" data-quest="${q.id}" ${active.length >= 2 || active.some(a => a.id === q.id) ? 'disabled' : ''}>Accept</button></div></div>`).join('')}</div>`;
    return { html, actions: [{ label: '← Back to town', fn: () => go('hub') }], after: () => { document.querySelectorAll('[data-quest]').forEach(b => b.onclick = () => { const q = QUESTS.find(x => x.id === b.dataset.quest); S.quests = (S.quests || []).concat([{ id: q.id, n: q.n, prog: 0, left: q.within }]); U.toast = `Quest accepted: ${esc(q.text)}.`; save(); render(); }); } };
  };
  // Retirement and legacy
  function retirementDue() { const p = P(); return p.age >= 34 || (p.age >= 32 && p.ovr < 60) || p.age >= 38; }
  function legacyCard() {
    const p = P(); const h = S.history || []; const clubs = new Set(h.map(x => x.club)); clubs.add(p.contract.club);
    return { seasons: p.seasons, clubs: clubs.size, goals: h.reduce((s, x) => s + x.goals, 0) + p.goals, assists: h.reduce((s, x) => s + x.assists, 0) + p.assists, apps: h.reduce((s, x) => s + x.apps, 0) + p.apps, honours: (S.honours || []).length, caps: p.caps || 0, intGoals: p.intGoals || 0, peak: Math.max(p.ovr, ...h.map(x => x.ovr)), name: p.name, pos: p.pos, nat: p.nat };
  }
  const legacyView = () => {
    const L = legacyCard(); const p = P();
    const html = `<h2>🏁 Career over</h2><div class="card hl"><h3>${esc(p.name)} · ${esc(p.pos)} · ${esc(p.nat)}</h3><div class="kv"><span class="k">Seasons</span><span>${L.seasons}</span><span class="k">Clubs</span><span>${L.clubs}</span><span class="k">Apps</span><span>${L.apps}</span><span class="k">Goals</span><span>${L.goals}</span><span class="k">Assists</span><span>${L.assists}</span><span class="k">Caps</span><span>${L.caps} (${L.intGoals} goals)</span><span class="k">Peak OVR</span><span>${L.peak}</span><span class="k">Honours</span><span>${L.honours}</span></div></div>
      ${(S.honours || []).length ? `<div class="card"><h3>Honours</h3>${S.honours.map(h => `<div>🏆 ${esc(h.name)} <span class="muted">· ${esc(h.club)}</span></div>`).join('')}</div>` : ''}
      <p class="muted">This card is kept in the Hall of Fame on the menu. Start a new career whenever you like.</p>`;
    return { html, actions: [{ label: '🏛 Save to Hall of Fame and start a new career', cls: 'primary', fn: () => { try { const hof = JSON.parse(localStorage.getItem('ppl_hof') || '[]'); hof.unshift(Object.assign(L, { honoursList: (S.honours || []).map(h => h.name) })); localStorage.setItem('ppl_hof', JSON.stringify(hof.slice(0, 10))); } catch (e) { /* ignore */ } S = null; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } if (cloud.ref) { cloud.ref.delete().catch(() => {}); } U = { screen: 'intro' }; render(); } }] };
  };
  // ---------- cutscenes ----------
  function cutData(extra) { const p = P(); return Object.assign({ look: p.look, kit: clubKit(), acc: myAcc(false), name: pname(), club: S.clubIdx >= 0 ? club().name : 'Riverside Academy', mates: S.teammates }, extra || {}); }
  // Plays a cutscene full screen, then calls done. Skippable. Falls through if the module is missing.
  function playCut(type, data, done) {
    if (!CUT || !CUT.SCENES[type]) { done && done(); return; }
    stopScenes();
    const host = fullscreenHost(); host.classList.add('cut-host');
    let finished = false;
    const finish = () => { if (finished) return; finished = true; U.cut = null; if (A) A.stopSpeech(); const sr = $('#scene-root'); if (sr) sr.remove(); document.body.classList.remove('has-scene'); done && done(); };
    U.cut = CUT.play(host, CUT.SCENES[type](data), { onDone: finish, speak: (who, text) => { if (A && (who === 'John' || who === 'Ally')) A.speak(who, esc(text), { priority: true }); }, sfx: n => { if (A) A.sfx(n); } });
  }
  function playCuts(list, done) { const next = () => { const c = list.shift(); if (!c) { done && done(); return; } playCut(c.type, c.data, next); }; next(); }
  // Season awards: computed from the season just finished
  function computeAwards(s) {
    const p = P(); const avg = E.formAvg(p); const ga = s.goals + s.assists; const tier = lg().tier; const att = ['ST', 'LW', 'RW', 'CAM'].includes(p.pos);
    const out = [];
    if (s.apps >= 15 && s.goals >= Math.max(12, Math.round(s.apps * 0.4))) out.push({ kind: 'goldenboot', name: 'Golden Boot', fame: 5, fans: 4, line: `${s.goals} goals in ${s.apps} games. Nobody else came close.`, stats: `${s.goals} goals, ${s.assists} assists.` });
    if (s.apps >= 15 && s.age <= 21 && avg >= 6.9) out.push({ kind: 'ypoty', name: 'Young Player of the Year', fame: 6, fans: 5, line: `${s.age} years old and already the best young player in the ${lg().name}.`, stats: `Average rating ${avg.toFixed(1)} across ${s.apps} games.` });
    if (s.apps >= 15 && (avg >= 7.4 || (avg >= 7.1 && ga >= 12))) out.push({ kind: 'poty', name: `${lg().name} Player of the Year`, fame: 8, fans: 6, line: 'The best player in the league this season. Nobody argued.', stats: `Average rating ${avg.toFixed(1)}, ${s.goals} goals, ${s.assists} assists, ${s.motm} player of the match awards.` });
    if (s.apps >= 20 && tier >= 4 && s.finish <= 3 && (att ? (avg >= 7.6 && ga >= 20) : avg >= 7.8)) out.push({ kind: 'ballondor', name: "Ballon d'Or", fame: 15, fans: 10, charm: 5, line: 'The best footballer on the planet. From a regional academy final to this.', stats: `${s.goals} goals, ${s.assists} assists, ${s.finish === 1 ? 'a league title' : 'a top-three finish'}, rating ${avg.toFixed(1)}.` });
    return out;
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
  VIEWS.talk = talkView; VIEWS.agent = agentView; VIEWS.legacy = legacyView; VIEWS.life = lifeView;

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
      ${saved ? `<div class="card hl"><h3>Saved career</h3><div>${esc(saved.player.name)} · ${esc(saved.player.pos)} · OVR ${saved.player.ovr} · Week ${saved.week} · ${esc(saved.player.contract.club)}</div><div class="muted">${saved.savedAt ? 'Last saved ' + new Date(saved.savedAt).toLocaleString() : ''}</div></div>` : '<p class="muted">No saved career yet.</p>'}
      ${(() => { try { const hof = JSON.parse(localStorage.getItem('ppl_hof') || '[]'); return hof.length ? `<div class="card"><h3>🏛 Hall of Fame</h3>${hof.map(h => `<div>${esc(h.name)} · ${esc(h.pos)} · ${h.seasons} seasons · ${h.goals} goals · ${h.honours} honours · peak OVR ${h.peak}</div>`).join('')}</div>` : ''; } catch (e) { return ''; } })()}
      <p class="muted">${cloudLine()}</p>
      <p class="muted">Progress autosaves after every screen. ${A && A.hasSpeech() ? 'John and Ally speak through your browser\'s voices, with crowd noise and whistles synthesised live. Toggle with the sound button at the top.' : 'This browser has no speech voices, so commentary is text only. Crowd and whistle effects still play.'}</p>`;
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
      E.acceptOffer(S, o); U.offers = null; S.phase = 'hub'; U.welcome = true; save();
      playCut('contract', cutData({ money: money(o.wage), weeks: o.weeks, role: o.role }), () => { U.screen = 'hub'; render(); });
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

  // ---------- open-world actions and weekly perks ----------
  const energySub = () => `energy ${Math.round(P().energy)}/${E.maxEnergy(S)} · $${Math.round(P().money).toLocaleString('en-US')}`;
  function perkOnce(id) { S.flags.perks = S.flags.perks && S.flags.perks.week === S.week ? S.flags.perks : { week: S.week, used: {} }; if (S.flags.perks.used[id]) return false; S.flags.perks.used[id] = true; return true; }
  function gainEnergy(n) { const p = P(); const before = p.energy; p.energy = Math.min(E.maxEnergy(S), p.energy + n); return Math.round(p.energy - before); }
  const PERKS = {
    nap: () => perkOnce('nap') ? `Twenty minutes on the sofa. Energy +${gainEnergy(10)}.` : 'You already napped this week. The sofa judges you.',
    sofa: () => { const L = life(); if (L.partner && L.livesTogether) { if (!perkOnce('sofa')) return 'You have had your evening in this week.'; L.love = E.clamp(L.love + 8, 0, 100); L.lastContact = S.week; return `Movie night with ${L.partner.name}. Love +8, Energy +${gainEnergy(10)}.`; } return PERKS.nap(); },
    date: () => { const L = life(); const p = P(); if (!L.partner) return 'Nobody to take. Check the dating tab on your phone.'; if (p.money < 60) return 'Dinner is $60. You are short.'; if (!perkOnce('date')) return 'One date night a week. Keep them keen.'; p.money -= 60; const bonus = L.partner.trait === 'foodie' ? 5 : 0; L.love = E.clamp(L.love + 10 + bonus, 0, 100); L.lastContact = S.week; return `Dinner with ${L.partner.name}. Love +${10 + bonus}.${bonus ? ' They loved the food.' : ''}`; },
    megastore: () => { const p = P(); if (p.fame < 30) return `Your shirt is not on sale yet. Fame 30 needed (you have ${p.fame}).`; if (S.flags.megaSeason === p.seasons) return 'You already bought your own shirt this season. That is enough.'; if (p.money < 80) return 'Replica shirt: $80. You are short.'; S.flags.megaSeason = p.seasons; p.money -= 80; p.fans = E.clamp(p.fans + 5, 0, 100); p.charm = E.clamp(p.charm + 1, 0, 100); return 'You bought your own shirt. A kid asked you to sign it. Fans +5, Charm +1.'; },
    sleep: () => perkOnce('sleep') ? `A proper night's sleep. Energy +${gainEnergy(15)}.` : 'You have slept enough this week. Go and train.',
    snack: () => perkOnce('snack') ? `Leftover pasta, cold, standing up. Energy +${gainEnergy(6)}.` : 'The fridge is empty. Shopping Center is across the road.',
    coffee: () => { const p = P(); if (p.money < 25) return 'Coffee is $25. You are $' + (25 - Math.round(p.money)) + ' short.'; if (!perkOnce('coffee')) return 'The barista cuts you off. One a week, athlete.'; p.money -= 25; return `Flat white. $25. Energy +${gainEnergy(6)}.`; },
    physio: () => { const p = P(); if (p.injury > 0) { if (!perkOnce('physio')) return 'Treatment done for this week. Rest.'; p.injury--; return p.injury > 0 ? `Treatment. ${p.injury} week${p.injury > 1 ? 's' : ''} of the injury left.` : 'Treatment. You are cleared to play.'; } return perkOnce('physio') ? `Ice bath and a rub down. Energy +${gainEnergy(10)}.` : 'Physio has seen you already this week.'; },
    coach: () => { const p = P(); if (!perkOnce('coach')) return 'The coach waves you out. "Show me on the pitch."'; p.coach = E.clamp(p.coach + 2, 0, 100); return p.coach >= 60 ? '"Keep doing what you are doing." Coach +2.' : p.coach >= 35 ? '"Work harder in training and you will start." Coach +2.' : '"You are not close to the team yet. Train." Coach +2.'; },
    press: () => { const p = P(); if (p.fame < 10) return 'Two journalists and a work-experience kid. Nobody asks a question.'; if (!perkOnce('press')) return 'The press officer says you have done enough talking this week.'; p.fame = E.clamp(p.fame + 1, 0, 100); p.charm = E.clamp(p.charm + 1, 0, 100); return 'You handle the questions well. Fame +1, Charm +1.'; },
    balcony: () => { const p = P(); const st = E.standings(lg()); const pos = st.findIndex(r => r.idx === S.clubIdx) + 1; return `Floodlights on the horizon. ${club().name} sit ${pos}${ord(pos)}. Fame ${p.fame}, fans ${p.fans}.`; },
  };
  function worldAction(action) {
    const p = P();
    if (action.startsWith('open:')) {
      const [, screen, tab] = action.split(':');
      if (screen === 'shop') { U.shopTab = tab || 'boots'; go('shop'); }
      else if (screen === 'talk') { U.talkReply = null; U.talkPos = false; go('talk'); }
      else if (screen === 'life') { U.lifeTab = 'social'; go('life'); }
      else if (screen === 'agent') go('agent');
      else if (screen === 'garage' || screen === 'contract' || screen === 'estate' || screen === 'mirror') { U.homeFocus = screen; go('home'); }
      else go(screen);
      return;
    }
    if (action.startsWith('perk:')) { const f = PERKS[action.slice(5)]; if (f) { U.town.note(f()); U.town.setSub(energySub()); save(); } return; }
    if (action.startsWith('mini:')) {
      const kind = action.slice(5); const cost = kind === 'gym' ? E.TRAIN_COST : 20;
      if (p.injury > 0) { U.town.note('Injured. See the physio first.'); return; }
      if (p.energy < cost) { U.town.note(`Not enough energy (${cost} needed).`); return; }
      U.town.startMini({ title: kind === 'gym' ? 'Gym session' : 'Keepy-uppies', reps: 5, speed: kind === 'gym' ? 1.5 : 1.9 }, (hits, reps) => {
        p.energy -= cost; if (kind === 'gym') S.trainedThisWeek = true;
        const chance = (kind === 'gym' ? 0.3 : 0.15) + (hits / reps) * (kind === 'gym' ? 0.5 : 0.35) + E.trainBonus(S) / 150;
        if (Math.random() < chance) { const at = kind === 'gym' ? E.weightedAttr(p.pos) : E.pick(E.ATTRS); p.attrs[at] = E.clamp(p.attrs[at] + 1, 20, 99); p.ovr = E.calcOVR(p.attrs, p.pos); U.town.note(`${hits}/${reps} clean. +1 ${attrLabel(at)}! OVR ${p.ovr}.`); }
        else U.town.note(`${hits}/${reps} clean. No gain this time (${Math.round(chance * 100)}% chance).`);
        if (kind === 'gym') p.coach = E.clamp(p.coach + 1, 0, 100);
        U.town.setSub(energySub()); save(); });
      return;
    }
    if (action === 'bus') { U.town.note('The number 9 to the stadium. Free with a season ticket.'); U.town.goto('stadium', 180, 60); return; }
    if (action === 'kickabout') {
      if (p.energy < 20) { U.town.note('Too tired for a kickabout. Energy 20 needed.'); return; }
      p.energy -= 20; let msg = 'Jumpers for goalposts. A kid nutmegs you. No gain today.';
      if (Math.random() < 0.3) { const at = E.pick(E.ATTRS); p.attrs[at] = E.clamp(p.attrs[at] + 1, 20, 99); p.ovr = E.calcOVR(p.attrs, p.pos); msg = `Jumpers for goalposts. +1 ${attrLabel(at)}! OVR ${p.ovr}.`; }
      U.town.note(msg); U.town.setSub(energySub()); save(); return;
    }
  }

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
      <p class="muted">The town is full screen. Walk into a door to go inside: your house has two floors, the Shopping Center has two floors, and the training ground, stadium tunnel and agent's office are all open. Walk up to furniture and press ENTER to use it. ☰ MENU brings you back here.${p.fame >= 50 ? ' Fans in town will run at you.' : ''}</p>
      ${fixtureCard()}
      <div class="card"><h3>Status</h3>${bar('Energy', Math.round(p.energy / E.maxEnergy(S) * 100), 'sky')}${bar('Fame', p.fame, 'gold')}${bar('Fans', p.fans)}${bar('Coach', p.coach)}${bar('Chemistry', p.chem)}${bar('Charm', p.charm, 'gold')}</div>
      ${maybeFanEncounter('hub')}
      ${pendingInternational() ? `<div class="notice">🌍 ${pendingInternational().kind === 'wc' ? 'WORLD CUP! ' + esc(p.nat) + ' need you. Four matches: two group games, a semi-final and the final.' : 'International call-up! ' + esc(p.nat) + ' friendly this week.'} Play it from the Stadium.</div>` : ''}
      ${benchedByRival() ? `<div class="notice">👀 ${esc(S.rival.name)} is in form (${S.rival.ovr}) and keeps the ${esc(p.pos)} shirt this week. Beat their form or win the coach over (60+).</div>` : ''}
      ${U.lifeNote && U.screen === 'hub' ? `<div class="notice">${U.lifeNote}</div>` : ''}${life().brandOffer ? '<div class="notice">📱 A brand wants to talk. Check your phone upstairs.</div>' : ''}
      ${p.injury > 0 ? `<div class="notice">🩹 Injured: ${p.injury} week${p.injury > 1 ? 's' : ''} left. The physio at the training ground knocks a week off.</div>` : ''}${p.banned > 0 ? '<div class="notice">🟥 Suspended for the next match.</div>' : ''}
      ${p.fame >= 50 ? '<p class="muted">Fame 50+: people recognise you in the street now. Expect crowds.</p>' : ''}`;
    const actions = [
      { label: '🗺 Walk the town', cls: 'primary', sub: 'Full-screen open world', fn: () => { U.townMenu = false; render(); } },
      { label: '🏠 Home', sub: 'Contract, garage, estate', fn: () => go('home') },
      { label: '🛍 Shopping Center', sub: 'Boots, outfits, gear', fn: () => go('shop') },
      { label: '🏃 Training Ground', sub: `${Math.floor(p.energy / E.TRAIN_COST)} sessions left`, fn: () => go('training') },
      { label: '🏟 Stadium · Match Day', cls: 'primary', sub: pendingInternational() ? 'International duty this week' : 'Play, sim or quick sim', fn: () => go('stadium') },
      { label: '📱 Phone', sub: life().status === 'single' ? 'Social, dating' : `Social · ${life().partner.name}`, fn: () => { U.lifeTab = 'social'; go('life'); } },
      { label: '👥 Squad', fn: () => go('squad') },
      { label: '📊 League Tables', fn: () => go('table') },
      { label: '📈 Career & Attributes', fn: () => go('career') },
      { label: '💾 Menu', fn: () => go('menu') },
    ];
    const after = () => {
      bindFan();
      if (U.pendingCut) { const c = U.pendingCut; U.pendingCut = null; playCut(c.type, c.data, () => render()); return; }
      if (U.townMenu || U.fan || U.forceFan || !TOWN) return;
      const host = fullscreenHost();
      U.town = TOWN.start({ host, look: p.look, kit: myKit(), acc: myAcc(false), fame: p.fame, family: familyOpts(), carIdx: D.CARS.findIndex(c => c.id === p.car), spawn: U.townPos, crowded: S.flags.fanWeek === S.week, teammates: S.teammates,
        title: `${club().name} · week ${S.week}`, sub: energySub(),
        onMenu: () => { U.townMenu = true; render(); },
        onAction: worldAction,
        onCrowd: () => { if (S.flags.fanWeek === S.week) return; S.flags.fanWeek = S.week; U.fan = { place: 'hub' }; U.toast = null; U.townPos = U.town.pos(); U.forceFan = true; render(); } });
    };
    return { html, actions, after };
  };

  VIEWS.home = () => {
    const p = P();
    const car = D.CARS.find(c => c.id === p.car), est = D.ESTATES.find(e => e.id === p.estate);
    const carRows = D.CARS.map(c => itemCard(c, { key: 'car', state: c.id === p.car ? 'cur' : p.owned.includes(c.id) ? 'owned' : 'buy', curLabel: 'Driving', useLabel: 'Drive this', effects: [`+${c.charm} charm`] })).join('');
    const estRows = D.ESTATES.map(e => itemCard(e, { key: 'est', state: e.id === p.estate ? 'cur' : p.owned.includes(e.id) ? 'owned' : 'buy', curLabel: 'Living here', useLabel: 'Move in', effects: [`+${e.charm} charm`, `+${e.energy} max energy`] })).join('');
    const html = `${toast()}<h2>🏠 Home · ${esc(est.name)}</h2>
      <div class="cards">
        <div class="card"><h3>Contract</h3><div class="kv"><span class="k">Club</span><span>${esc(p.contract.club)}</span><span class="k">League</span><span>${esc(p.contract.leagueName)}</span><span class="k">Wage</span><span>${money(p.contract.wage)} / week</span><span class="k">Remaining</span><span>${p.contract.weeksLeft} weeks</span><span class="k">Role</span><span>${esc(p.contract.role)}</span></div><p class="muted">${esc(p.contract.promise)}</p></div>
        <div class="card garage"><h3>Garage · ${esc(car.name)}</h3><pre>${esc(car.art)}</pre></div>
      </div>
      <h3 id="h-mirror">Mirror · appearance</h3>${(U.lookEd = lookEditor(p.look)).html}
      <div class="row"><span>Wallet: <span class="gold">${money(p.money)}</span></span><span class="muted">Wages land every week after the match. Win and goal bonuses on top.</span></div>
      <h3 id="h-garage">Garage</h3><div class="items">${carRows}</div>
      <h3 id="h-estate">Estate</h3><div class="items">${estRows}</div>
      ${maybeFanEncounter('home')}`;
    const after = () => {
      bindFan(); U.lookEd.bind($('#screen'));
      document.querySelectorAll('[data-buycar]').forEach(b => b.onclick = () => { const c = D.CARS.find(x => x.id === b.dataset.buycar); p.money -= c.price; p.owned.push(c.id); p.car = c.id; p.charm = E.clamp(p.charm + c.charm, 0, 100); p.fame = E.clamp(p.fame + Math.round(c.charm / 5), 0, 100); U.toast = `Keys to the ${esc(c.name)}. Charm +${c.charm}.`; if (A) A.sfx('cash'); render(); });
      document.querySelectorAll('[data-car]').forEach(b => b.onclick = () => { p.car = b.dataset.car; render(); });
      document.querySelectorAll('[data-buyest]').forEach(b => b.onclick = () => { const e = D.ESTATES.find(x => x.id === b.dataset.buyest); p.money -= e.price; p.owned.push(e.id); p.estate = e.id; p.charm = E.clamp(p.charm + e.charm, 0, 100); p.fame = E.clamp(p.fame + e.fame, 0, 100); U.toast = `You move into the ${esc(e.name)}. Charm +${e.charm}, max energy +${e.energy}.`; if (A) A.sfx('cash'); render(); });
      document.querySelectorAll('[data-est]').forEach(b => b.onclick = () => { p.estate = b.dataset.est; render(); });
    };
    const afterHome = () => { after(); const f = U.homeFocus; U.homeFocus = null; const sel = f === 'garage' ? '#h-garage' : f === 'estate' ? '#h-estate' : f === 'mirror' ? '#h-mirror' : null; if (sel && $(sel)) $(sel).scrollIntoView({ block: 'start' }); };
    return { html, actions: [{ label: '← Back to hub', fn: () => go('hub') }], after: afterHome };
  };

  VIEWS.shop = () => {
    const p = P(); const tab = U.shopTab || 'boots';
    const items = D.SHOP[tab];
    const isAcc = tab === 'accessories'; const isGift = tab === 'gifts'; const L = life();
    const cur = tab === 'kits' ? p.kit : isAcc ? null : p[tab === 'boots' ? 'boots' : tab === 'outfits' ? 'outfit' : 'gear'];
    const rows = isGift ? items.map(it => `<div class="item"><div class="item-main"><b>${esc(it.name)}</b><span class="muted">${esc(it.desc)}</span><span class="fx">${it.ring ? (L.ring ? 'You have the ring' : 'Needed to propose') : `love +${it.love}`} · <span class="gold">${money(it.price)}</span></span></div><div class="item-act">${!L.partner ? '<span class="pill">No partner</span>' : it.ring && L.ring ? '<span class="pill ok">Bought</span>' : p.money < it.price ? `<button type="button" class="sm" disabled>Buy<span class="sub">${money(it.price - p.money)} short</span></button>` : `<button type="button" class="sm warn" data-gift="${it.id}">${it.ring ? 'Buy the ring' : 'Give'}</button>`}</div></div>`).join('') : items.map(it => { const equipped = isAcc ? p.acc[it.slot] === it.id : it.id === cur;
      return itemCard(it, { key: '', state: equipped ? 'cur' : p.owned.includes(it.id) ? 'owned' : 'buy', curLabel: isAcc ? 'Wearing' : 'Equipped', useLabel: isAcc ? 'Wear' : 'Equip', unequip: isAcc && equipped ? it.id : null,
        effects: [it.charm ? `+${it.charm} charm` : '', it.train ? `+${it.train} training` : '', it.energy ? `+${it.energy} max energy` : '', isAcc ? `${it.slot}${it.pitch ? ' · pitch OK' : ' · town only'}` : '', tab === 'kits' && !it.club ? 'worn in town' : ''] }); }).join('');
    const preview = `<div class="look"><canvas class="look-canvas" id="shop-preview" width="120" height="150"></canvas><div class="muted">This is how you look in town right now: kit, boots and accessories. Pitch-legal accessories show in matches too.</div></div>`;
    const html = `${toast()}<h2>🛍 Shopping Center</h2><div class="row"><span>Wallet: <span class="gold">${money(p.money)}</span></span><span class="muted">Boots and gear sharpen training. Outfits raise Charm, which pulls bigger clubs into the transfer window.</span></div>
      ${preview}
      <div class="choices shoptabs"><button class="sm ${tab === 'boots' ? 'primary' : ''}" data-tab="boots">👟 Boots</button><button class="sm ${tab === 'outfits' ? 'primary' : ''}" data-tab="outfits">🧥 Outfits</button><button class="sm ${tab === 'kits' ? 'primary' : ''}" data-tab="kits">👕 Kits</button><button class="sm ${tab === 'accessories' ? 'primary' : ''}" data-tab="accessories">💍 Accessories</button><button class="sm ${tab === 'gear' ? 'primary' : ''}" data-tab="gear">🏋 Fitness gear</button><button class="sm ${tab === 'gifts' ? 'primary' : ''}" data-tab="gifts">🎁 Gifts</button></div>
      <div class="items">${rows}</div>
      ${maybeFanEncounter('shop')}`;
    const after = () => {
      bindFan();
      document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { U.shopTab = b.dataset.tab; render(); });
      const pv = $('#shop-preview'); if (pv) { const c = pv.getContext('2d'); c.imageSmoothingEnabled = false; SP.drawFigure(c, 60, 128, 5.2, p.look, myKit(), { number: 10, acc: myAcc(false) }); }
      const key = tab === 'boots' ? 'boots' : tab === 'outfits' ? 'outfit' : tab === 'kits' ? 'kit' : 'gear';
      const equip = it => { if (isAcc) p.acc[it.slot] = it.id; else p[key] = it.id; };
      document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const it = items.find(x => x.id === b.dataset.buy); p.money -= it.price; p.owned.push(it.id); equip(it); if (it.charm) p.charm = E.clamp(p.charm + it.charm, 0, 100); U.toast = `Bought ${esc(it.name)}.${it.charm ? ` Charm +${it.charm}.` : ''}`; if (A) A.sfx('cash'); render(); });
      document.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { equip(items.find(x => x.id === b.dataset.eq)); render(); });
      document.querySelectorAll('[data-uneq]').forEach(b => b.onclick = () => { const it = items.find(x => x.id === b.dataset.uneq); delete p.acc[it.slot]; render(); });
      document.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => { const it = D.SHOP.gifts.find(x => x.id === b.dataset.gift); p.money -= it.price; if (it.ring) { L.ring = true; U.toast = 'The ring is in your pocket. Propose from your phone when the moment is right.'; } else { L.love = E.clamp(L.love + it.love, 0, 100); L.lastContact = S.week; U.toast = `${esc(L.partner.name)} loved the ${esc(it.name.toLowerCase())}. Love +${it.love}.`; } if (A) A.sfx('cash'); save(); render(); });
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
      return { label: `${attrLabel(a)} ${p.attrs[a]}`, sub: p.injury > 0 ? 'Injured: see the physio' : `${chance}% chance of +1`, disabled: sessions < 1 || p.injury > 0, fn: () => { const r = E.train(S, a); if (A && r.ok && r.gained) A.sfx('ding'); U.toast = r.ok ? (r.gained ? `<span class="green">+1 ${attrLabel(a)}!</span> Now ${p.attrs[a]}. OVR ${p.ovr}.` : `Hard session on ${attrLabel(a)}. No gain this time, but the coach saw you working.`) : r.reason; render(); } };
    });
    actions.push({ label: '← Back to hub', fn: () => go('hub') });
    return { html, actions };
  };

  VIEWS.squad = () => {
    const p = P();
    const rows = S.teammates.map(t => `<tr><td>${t.pos}</td><td>${esc(t.name)}</td><td class="muted">(${esc(t.pron)})</td><td>${esc(t.nat)}</td><td class="n">${t.ovr}</td></tr>`).join('');
    const html = `<h2>👥 ${esc(club().name)} squad</h2><p class="muted">Chemistry ${p.chem}: teammates look for you ${(1 + 2 * p.chem / 100).toFixed(1)}× as often as a stranger.</p>
      ${S.rival ? `<div class="card ${benchedByRival() ? 'hl' : ''}"><h3>Your rival for the ${esc(p.pos)} shirt</h3><div><b>${esc(S.rival.name)}</b> <span class="muted">(${esc(S.rival.pron)})</span> · OVR ${S.rival.ovr}</div>${bar('Rival form', S.rival.form, 'gold')}<p class="muted">${benchedByRival() ? 'Currently ahead of you. Improve your form or coach popularity.' : 'You are ahead. Keep it that way.'}</p></div>` : ''}
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
      <div class="cards"><div class="card"><h3>This season</h3><div class="kv"><span class="k">Apps</span><span>${p.apps}</span><span class="k">Goals</span><span>${p.goals}</span><span class="k">Assists</span><span>${p.assists}</span>${p.pos === 'GK' ? `<span class="k">Saves</span><span>${p.saves}</span>` : ''}<span class="k">MOTM</span><span>${p.motm}</span><span class="k">Form (avg)</span><span>${E.formAvg(p).toFixed(2)}</span><span class="k">Caps</span><span>${p.caps || 0} (${p.intGoals || 0} goals)</span><span class="k">Call-up needs</span><span>OVR ${callUpThreshold()}, fame 12</span></div></div>
      <div class="card"><h3>Attributes · OVR ${p.ovr}</h3>${E.ATTRS.map(a => bar(attrLabel(a), p.attrs[a])).join('')}</div></div>
      ${S.honours && S.honours.length ? `<div class="card hl"><h3>Honours</h3>${S.honours.map(h => `<div>🏆 ${esc(h.name)} <span class="muted">· season ${h.season} · ${esc(h.club)}</span></div>`).join('')}</div>` : ''}
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
    const intl = pendingInternational();
    const html = `<h2>🏟 Match Day</h2>${intl ? `<div class="card hl"><h3>🌍 ${intl.kind === 'wc' ? 'World Cup' : 'International friendly'}</h3><p>${esc(P().nat)} have called you up${intl.kind === 'wc' ? ' for the World Cup squad' : ''}. Played on top of the league week, no fixture is skipped.</p></div>` : ''}${fixtureCard()}${diffHtml}
      <p class="muted">Play Full Match and Highlights put you on the pitch: joystick or WASD to move, Shoot (hold for power), Pass, and Skill for a sprint burst or slide tackle. Text Match is the choice-based commentary version. Sim scrolls the match, Quick Sim jumps to the result. Chemistry ${P().chem}: teammates look for you ${(1 + 2 * P().chem / 100).toFixed(1)}× as often.</p>`;
    const start = mode => () => { U.match = E.buildMatch(S, mode); U.match.introduced = new Set(); U.match.timeline = buildTimeline(U.match); U.match.pos = 0; U.match.shown = [];
      if (mode === 'quick') { advance(U.match, true); finish(); return; }
      go('match'); };
    const unused = P().coach < 15 || (P().injury || 0) > 0 || (P().banned || 0) > 0;
    const whyOut = (P().injury || 0) > 0 ? `Injured: ${P().injury} week${P().injury > 1 ? 's' : ''} to go` : (P().banned || 0) > 0 ? 'Suspended this match' : 'Not in the squad this week';
    const play = mode => () => { U.arcadeMode = mode; go('arcade'); };
    const actions = [];
    if (intl) actions.push({ label: `🌍 Play for ${esc(P().nat)}`, cls: 'warn', sub: intl.kind === 'wc' ? 'World Cup group game 1' : 'Friendly, highlights length', fn: () => startSpecial(intl.kind, 'group1') }, { label: '🌍 Sim the international', sub: intl.kind === 'wc' ? 'Sim the whole tournament' : 'Skip playing it', fn: () => {
        let stage = 'group1'; const log = []; let trophy = false;
        for (let guard = 0; guard < 5; guard++) {
          const sp0 = { kind: intl.kind, stage, nat: P().nat, str: NATIONS[P().nat] || 78, opp: { name: randomOpponentNation(), str: 78 + (stage === 'final' ? 4 : stage === 'semi' ? 2 : 0) }, teammates: [] };
          U.special = sp0; const sc = E.simScore(sp0.str, sp0.opp.str); const goals = Math.random() < 0.35 ? 1 : 0;
          const res = { score: sc, rating: 6 + (sc[0] > sc[1] ? 0.8 : 0) + goals * 0.9, goals, assists: 0, saves: 0, keys: 0, played: true };
          const m = { fx: { isHome: true }, opp: sp0.opp, club: { name: sp0.nat }, mode: 'sim', score: sc, goals, assists: 0, unused: false, wc: intl.kind === 'wc' };
          afterSpecial(res, m); log.push(`${intl.kind === 'wc' ? stage + ': ' : ''}${sc[0]}-${sc[1]} v ${sp0.opp.name}`);
          const win = sc[0] > sc[1], draw = sc[0] === sc[1];
          if (intl.kind !== 'wc') break;
          if (stage === 'final' && win) { trophy = true; break; }
          const next = wcNextStage(stage, win, draw); if (!next) break; stage = next;
        }
        const f = U.afterResult; U.afterResult = null; U.result = null; U.resultMatch = null; S.flags.wcDone = intl.kind === 'wc' ? true : S.flags.wcDone;
        U.toast = (intl.kind === 'wc' ? 'World Cup: ' : 'Friendly: ') + log.join(' · ') + (trophy ? ' · WORLD CHAMPIONS!' : '');
        if (trophy && f) f(); else go('hub'); } });
    actions.push(
      { label: '🕹 Play Full Match', cls: 'primary', sub: unused ? whyOut : benchedByRival() ? `${esc(S.rival.last)} starts ahead of you` : 'Two halves, you control your player', disabled: unused, fn: play('full') },
      { label: '⚡ Play Highlights', sub: unused ? whyOut : 'Short halves, same controls', disabled: unused, fn: play('highlights') },
      { label: '📝 Text Match', sub: 'Choice-based commentary', fn: start('full') },
      { label: '📜 Sim Match', sub: 'Rapid text scroll', fn: start('sim') },
      { label: '⏩ Quick Sim', sub: 'Instant result', fn: start('quick') },
      { label: '← Back to hub', fn: () => go('hub') });
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
  function tickAbsences() { const p = P(); if (p.injury > 0) p.injury--; if (p.banned > 0) p.banned--; }
  function postMatch(m, ch) { questProgress(m, ch); paySponsors(ch); rivalTick(); if (!S.rival || S.rival.pos !== P().pos) makeRival(); lifeTick(); }
  function finish() {
    const m = U.match;
    if ((P().injury || 0) > 0 || (P().banned || 0) > 0) m.unused = true;
    U.result = E.finishMatch(S, m); postMatch(m, U.result); tickAbsences();
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
    const p = P(); const lgx = lg(); const sp = U.special;
    const fx = sp ? { isHome: true, opp: -1 } : E.nextFixtureFor(lgx, S.clubIdx);
    if (!fx) return VIEWS.stadium();
    const opp = sp ? sp.opp : lgx.clubs[fx.opp]; const mode = U.arcadeMode || 'full';
    const myClub = sp ? { name: sp.nat, str: sp.str } : club();
    const myMates = sp ? sp.teammates : S.teammates;
    const html = `<p class="muted">Match in progress in full screen.</p><div class="script" id="arc-log"></div>`;
    const abandon = () => { const m = E.buildMatch(S, 'quick'); m.introduced = new Set(); m.timeline = buildTimeline(m); m.pos = 0; m.shown = []; advance(m, true); U.match = m; finish(); };
    const after = () => {
      const host = fullscreenHost(); let logEl = document.createElement('div'); logEl.className = 'script arc-log'; host.appendChild(logEl);
      const introduced = new Set(); const say = (who, txt, cls, prio) => { const log = logEl; const el = document.createElement('div'); el.innerHTML = scriptLine(who, txt, cls, 'arc' + S.week + '-' + (log.childElementCount)); log.prepend(el.firstChild); while (log.childElementCount > 6) log.lastElementChild.remove(); if (A) A.speak(who, txt, prio ? { priority: true } : undefined); };
      const nm = pl => pl ? (pl.isUser ? esc(pname()) : pl.team === 0 ? esc(mateRef({ name: pl.name, last: pl.last, pron: pl.pron || '' }, pl.pron ? introduced : null)) : `${esc(opp.name)}'s number ${pl.number}`) : 'someone';
      const starts = sp ? true : (p.coach >= 35 && !benchedByRival());
      const startMatch = () => { U.arcade = ARC.start(arcOpts); };
      const derby = sp ? false : isDerby(opp.name); const weather = pickWeather(); const gearItem = D.SHOP.gear.find(g => g.id === p.gear) || D.SHOP.gear[0];
      const arcOpts = { host, difficulty: (S.settings && S.settings.difficulty) || 'amateur', derby, weather, staminaMax: 100 + gearItem.energy * 1.5, kits: sp ? sp.kits : undefined, onExit: () => { if (confirm('Abandon the match? It will be quick-simmed instead.')) abandon(); }, user: { name: p.name, last: pname(), pos: p.pos, attrs: p.attrs, look: p.look, acc: myAcc(true), number: p.pos === 'GK' ? 1 : 10 }, teammates: myMates, club: myClub, opp, isHome: fx.isHome, mode, chem: sp ? 55 : p.chem, starts,
        secondsPerHalf: mode === 'highlights' ? 60 : 150, timeScale: U.testTimeScale || 1,
        onEvent: (type, d) => {
          if (type === 'kickoff') { say('John', `${sp ? (sp.kind === 'wc' ? `WORLD CUP ${esc(sp.stage.replace(/\d/, ' game ')).toUpperCase()}: ` : 'International friendly: ') + esc(sp.nat) + ' against ' + esc(opp.name) + '. ' : ''}${d.derby ? 'DERBY DAY. ' + esc(club().name) + ' against ' + esc(opp.name) + ', and the noise is something else. ' : ''}${fx.isHome ? esc(myClub.name) : esc(opp.name)} get us under way. ${starts ? `<b>${esc(p.name)}</b> (${esc(p.pron)}) starts.` : `<b>${esc(pname())}</b> starts on the bench.`}`); say('Ally', memoryLine(opp) + ' ' + WEATHER_TXT[d.weather || 'clear']); if (A) { A.sfx('kickoff'); if (d.derby) setTimeout(() => A.sfx('chant'), 700); } }
          else if (type === 'foul') { const by = d.by.isUser ? esc(pname()) : d.by.team === 0 ? nm(d.by) : `${esc(opp.name)}'s number ${d.by.number}`; const on = d.on.isUser ? esc(pname()) : d.on.team === 0 ? nm(d.on) : `${esc(opp.name)}'s number ${d.on.number}`;
            say('John', d.injury ? `${on} is down and not getting up. That is a bad one from ${by}.` : d.card === 'red' ? `${by} is OFF! Second yellow. ${d.inBox ? 'And it is a penalty.' : ''}` : d.card ? `Yellow card for ${by}. ${d.inBox ? 'Penalty!' : 'Free kick.'}` : `Foul by ${by} on ${on}. ${d.inBox ? 'PENALTY!' : 'Free kick.'}`, d.on.team === 0 ? 'event' : 'bad', true); if (A) A.sfx(d.card ? 'bad' : 'click'); }
          else if (type === 'injured') { say('Ally', `${esc(pname())} cannot continue. That looks like ${d.weeks} week${d.weeks > 1 ? 's' : ''} out.`, 'bad', true); }
          else if (type === 'setpiece' && d.taker.isUser) { say('Ally', d.type === 'pen' ? `${esc(pname())} places the ball on the spot. Pick a corner.` : `${esc(pname())} over the free kick. Wall lined up.`, 'event'); }
          else if (type === 'goal') { const us = d.team === 0;
            if (us && d.hattrick) say('Ally', `HAT-TRICK! ${nm(d.scorer)} has three! ${esc(club().name)} ${d.score[0]}, ${esc(opp.name)} ${d.score[1]}. Take the match ball home!`, 'goal', true);
            else if (us && d.late) say('Ally', `${d.minute} minutes gone and ${nm(d.scorer)} SCORES! ${esc(club().name)} ${d.score[0]}, ${esc(opp.name)} ${d.score[1]}! The place has gone absolutely wild!`, 'goal', true);
            else say(us ? 'Ally' : 'John', us ? `GOAL! ${nm(d.scorer)} scores${d.assist ? `, set up by ${nm(d.assist)}` : ''}! ${esc(club().name)} ${d.score[0]}, ${esc(opp.name)} ${d.score[1]}.` : `Goal for ${esc(opp.name)}. ${esc(club().name)} ${d.score[0]}, ${esc(opp.name)} ${d.score[1]}.`, us ? 'goal' : 'bad', true);
            if (A) { A.sfx(us ? 'goal' : 'bad'); if (us && d.big) setTimeout(() => A.sfx('chant'), 900); } }
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
          const m = { fx, opp, club: myClub, mode, score: res.score, rating: res.rating, goals: res.goals, assists: res.assists, saves: res.saves, keys: res.keys, unused: !res.played, starts, teamDiff: myClub.str - opp.str, shown: [], log: [], arcade: res, derby, wc: sp && sp.kind === 'wc' };
          U.arcade = null; S.phase = 'hub';
          if (sp) { afterSpecial(res, m); go('result'); return; }
          U.result = E.finishMatch(S, m); U.resultMatch = m;
          afterArcade(res, m); postMatch(m, U.result); tickAbsences(); go('result');
        } };
      if (p.apps === 0 && !S.flags.debutShown) { S.flags.debutShown = true; save(); playCut('debut', cutData({ club: club().name }), () => { const h = fullscreenHost(); arcOpts.host = h; const lg2 = document.createElement('div'); lg2.className = 'script arc-log'; h.appendChild(lg2); logEl = lg2; startMatch(); }); }
      else startMatch();
    };
    return { html, actions: [{ label: '⏹ Abandon match', cls: 'danger', sub: 'Counts as a quick sim', fn: abandon }], after };
  };

  // Consequences the text engine does not know about: derby glory, cards, bans, injuries, highlight clips
  function afterArcade(res, m) {
    const p = P(); const ch = U.result;
    if (m.derby && ch.rating !== null) { const extra = Math.round(ch.fame * 1.0) + (ch.win ? 3 : 0); p.fame = E.clamp(p.fame + extra, 0, 100); p.fans = E.clamp(p.fans + (ch.win ? 4 : ch.draw ? 1 : -2), 0, 100); ch.derbyBonus = extra; }
    if (res.cards) { if (res.cards.yellow) p.coach = E.clamp(p.coach - 2 * res.cards.yellow, 0, 100); if (res.cards.red) { p.coach = E.clamp(p.coach - 6, 0, 100); p.banned = 1; ch.banned = true; } }
    if (res.injury) { p.injury = res.injury; ch.injury = res.injury; }
    if (res.clips && res.clips.length) { S.highlights = (S.highlights || []).concat(res.clips.map(c => Object.assign({ week: S.week }, c))); S.highlights.sort((x, y) => ((y.hattrick ? 3 : 0) + (y.late ? 2 : 0)) - ((x.hattrick ? 3 : 0) + (x.late ? 2 : 0))); S.highlights = S.highlights.slice(0, 5); }
    if (S.lastArcade = { opp: m.opp.name, score: res.score.slice(), goals: res.goals, week: S.week, derby: m.derby, motm: ch.motm, red: !!(res.cards && res.cards.red) }) { /* remembered for the commentators */ }
  }
  // John and Ally remember things
  function memoryLine(opp) {
    const p = P(); const l = S.lastArcade; const h = S.history || [];
    if (p.injury) return `${esc(pname())} back from injury, and everyone will be watching that first tackle.`;
    if (l && l.opp === opp.name) return `Last time these two met it finished ${l.score[0]}-${l.score[1]}.`;
    if (l && l.goals >= 3) return `A hat-trick last week for ${esc(pname())}. Can there be a repeat?`;
    if (l && l.red) return `${esc(pname())} back after that red card. Head down, feet clean today.`;
    if (l && l.motm) return `Player of the match last time out for ${esc(pname())}.`;
    if (p.apps === 0 && h.length) return `New club, new season for ${esc(pname())}. ${h[h.length - 1].goals} goals last year.`;
    if (life().partner && S.week % 3 === 0) return `${esc(life().partner.name)} in the stands tonight. No pressure.`;
    if (p.fame >= 60) return `The whole ground is here for one player, and they know it.`;
    return ['Big one, this.', 'Three points would settle a few nerves.', 'Plenty of scouts in the stand tonight.', 'You can feel the expectation.'][S.week % 4];
  }
  VIEWS.result = () => {
    const m = U.resultMatch, ch = U.result, p = P();
    if (!m || !ch) return VIEWS.hub();
    const st = E.standings(lg()); const myPos = st.findIndex(r => r.idx === S.clubIdx) + 1;
    if (m.special) { const spx = m.special; const html = `<h2>${spx.kind === 'wc' ? 'World Cup' : 'International friendly'}</h2><div class="score">${esc(spx.nat)} ${m.score[0]} — ${m.score[1]} ${esc(spx.opp.name)}<small>${ch.win ? 'WIN' : ch.draw ? 'DRAW' : 'LOSS'} · ${spx.kind === 'wc' ? esc(spx.stage) : 'friendly'}</small></div><div class="card"><div class="kv"><span class="k">Rating</span><span class="gold">${ch.rating === null ? '—' : ch.rating.toFixed(1)}</span><span class="k">Goals</span><span>${m.goals}</span><span class="k">Assists</span><span>${m.assists}</span><span class="k">Caps</span><span>${p.caps}</span><span class="k">Fame</span><span class="green">+${ch.fame}</span></div>${ch.motm ? '<span class="pill gold">★ Man of the Match</span>' : ''}</div>`;
      return { html, actions: [{ label: '▶ Continue', cls: 'primary', fn: () => { const f = U.afterResult; U.afterResult = null; U.resultMatch = null; U.result = null; if (f) f(); else go('hub'); } }] }; }
    const delta = (k, v) => `<span class="k">${k}</span><span class="${v > 0 ? 'green' : v < 0 ? 'red' : 'muted'}">${v > 0 ? '+' : ''}${v}</span>`;
    const attrs = ch.attrs.map(a => a[0] === '-' ? `<span class="red">−1 ${attrLabel(a.slice(1))}</span>` : `<span class="green">+1 ${attrLabel(a)}</span>`).join(', ');
    const html = `<h2>Full-time report</h2>
      <div class="score">${scoreline(m)}<small>${ch.win ? 'WIN · +3 pts' : ch.draw ? 'DRAW · +1 pt' : 'LOSS'} · ${esc(club().name)} now ${myPos}${ord(myPos)}</small></div>
      <div class="cards">
        <div class="card ${ch.motm ? 'hl' : ''}"><h3>Your match</h3><div class="kv"><span class="k">Rating</span><span class="gold">${ch.rating === null ? 'Unused sub' : ch.rating.toFixed(1)}</span><span class="k">Goals</span><span>${m.goals}</span><span class="k">Assists</span><span>${m.assists}</span>${p.pos === 'GK' ? `<span class="k">Saves</span><span>${m.saves}</span>` : `<span class="k">Key plays</span><span>${m.keys}</span>`}${m.arcade ? `<span class="k">Shots</span><span>${m.arcade.shots} (${m.arcade.onTarget} on target)</span><span class="k">Passes</span><span>${m.arcade.passesOk}/${m.arcade.passes}</span><span class="k">Tackles</span><span>${m.arcade.tackles}</span><span class="k">Touches</span><span>${m.arcade.touches}</span><span class="k">Difficulty</span><span>${esc(m.arcade.difficulty || '')}</span>${m.arcade.weather && m.arcade.weather !== 'clear' ? `<span class="k">Conditions</span><span>${m.arcade.weather}</span>` : ''}${m.derby ? `<span class="k">Derby</span><span class="gold">Yes · fame +${ch.derbyBonus || 0}</span>` : ''}${m.arcade.cards && (m.arcade.cards.yellow || m.arcade.cards.red) ? `<span class="k">Cards</span><span class="red">${m.arcade.cards.red ? 'RED · banned next match' : m.arcade.cards.yellow + ' yellow'}</span>` : ''}${ch.injury ? `<span class="k">Injury</span><span class="red">${ch.injury} week${ch.injury > 1 ? 's' : ''} out</span>` : ''}` : ''}</div>${ch.motm ? '<span class="pill gold">★ Man of the Match</span>' : ''}</div>
        <div class="card"><h3>Changes</h3><div class="kv">${delta('Coach', ch.coach)}${delta('Fans', ch.fans)}${delta('Fame', ch.fame)}${delta('Chemistry', ch.chem)}${delta('Charm', ch.charm)}<span class="k">Bonus</span><span class="gold">${money(ch.money)}</span><span class="k">Wage</span><span class="gold">${money(p.contract.wage)}</span></div>${attrs ? `<div>${attrs} → OVR ${p.ovr}</div>` : ''}${ch.sponsorPay ? `<div class="gold">Sponsors paid ${money(ch.sponsorPay)}</div>` : ''}${ch.questDone ? ch.questDone.map(t => `<div class="green">✔ Quest complete: ${esc(t)}</div>`).join('') : ''}</div>
      </div>
      ${ch.motm ? `<div class="script">${scriptLine('Ally', `Player of the match, no argument: <b>${esc(p.name)}</b> (${esc(p.pron)}). Remember the pronunciation, John.`)}${scriptLine('John', 'Noted. Again.')}</div>` : ''}
      <div class="card"><h3>${esc(lg().name)} · top of the table</h3><div class="tablewrap"><table><tbody>${st.slice(0, 5).map((r, i) => `<tr class="${r.idx === S.clubIdx ? 'me' : ''}"><td class="n">${i + 1}</td><td>${esc(r.club.name)}</td><td class="n">${r.p}</td><td class="n">${r.pts}</td></tr>`).join('')}${myPos > 5 ? `<tr class="me"><td class="n">${myPos}</td><td>${esc(club().name)}</td><td class="n">${lg().table[S.clubIdx].p}</td><td class="n">${lg().table[S.clubIdx].pts}</td></tr>` : ''}</tbody></table></div></div>
      ${S.flags.transferWindow ? '<div class="notice">📋 The transfer window opens this week.</div>' : ''}${S.flags.seasonEnd ? '<div class="notice">🏁 That was the final round of the season.</div>' : ''}`;
    return { html, actions: [{ label: '▶ Continue', cls: 'primary', fn: () => { U.match = null; U.resultMatch = null; U.result = null; U.motmCut = false; go('hub'); } }], after: () => {
      if (ch.motm && !U.motmCut) { U.motmCut = true; playCut('award', cutData({ kind: 'motm', club: club().name, stats: `${m.goals} goals, ${m.assists} assists, rated ${ch.rating.toFixed(1)} against ${m.opp.name}.` }), () => { if (A) A.sfx('chant'); }); }
      else if (A && ch.motm) A.sfx('chant');
    } };
  };

  // ---- PHASE 4: transfer window ----
  VIEWS.transfer = () => {
    const p = P();
    if (!U.offers) { if (S.flags.transferRequest) { const p = P(); p.charm += 15; U.offers = E.genOffers(S).filter(o => o.kind !== 'renewal'); p.charm -= 15; S.flags.transferRequest = false; } else U.offers = E.genOffers(S); }
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
      E.acceptOffer(S, o); p.contract.wage = o.wage + o.imageRights; U.offers = null; S.flags.transferWindow = false; U.welcome = o.kind !== 'renewal'; if (o.kind !== 'renewal') makeRival(); U.toast = o.kind === 'renewal' ? `New deal signed at ${esc(o.clubName)}.` : null; save();
      playCut('contract', cutData({ money: money(o.wage + o.imageRights), weeks: o.weeks, role: o.role }), () => go('hub')); } }));
    actions.push({ label: '✋ Decline all offers', cls: 'warn', disabled: expired, sub: expired ? 'Contract expired' : 'Stay on current terms', fn: () => { U.offers = null; S.flags.transferWindow = false; U.toast = 'You stay put. The agent sighs audibly.'; go('hub'); } });
    return { html, actions };
  };

  VIEWS.season = () => {
    if (!U.summary) {
      const lgName = lg().name; const awards = computeAwards({ age: P().age, apps: P().apps, goals: P().goals, assists: P().assists, motm: P().motm, finish: E.standings(lg()).findIndex(r => r.idx === S.clubIdx) + 1 });
      U.summary = E.seasonRollover(S);
      U.summary.awards = awards; U.summary.leagueName = lgName;
      S.honours = S.honours || [];
      if (U.summary.finish === 1) S.honours.push({ season: U.summary.season, name: `${lgName} champion`, club: U.summary.club });
      awards.forEach(w => { const p = P(); p.fame = E.clamp(p.fame + w.fame, 0, 100); p.fans = E.clamp(p.fans + w.fans, 0, 100); if (w.charm) p.charm = E.clamp(p.charm + w.charm, 0, 100); S.honours.push({ season: U.summary.season, name: w.name, club: U.summary.club }); });
      const cuts = [];
      if (S.highlights && S.highlights.length) cuts.push({ type: 'reel', data: cutData({ clips: S.highlights.slice(0, 5) }) });
      S.highlights = [];
      if (U.summary.finish === 1) cuts.push({ type: 'trophy', data: cutData({ league: lgName, club: U.summary.club }) });
      awards.forEach(w => cuts.push({ type: 'award', data: cutData({ kind: w.kind, club: U.summary.club, line: w.line, stats: w.stats }) }));
      U.seasonCuts = cuts; save();
    }
    const s = U.summary, p = P();
    const html = `<h2>🏁 Season ${s.season} complete</h2>
      <div class="cards"><div class="card hl"><h3>${esc(s.club)} · ${esc(s.league)}</h3><div class="kv"><span class="k">Finished</span><span class="gold">${s.finish}${ord(s.finish)}</span><span class="k">Points</span><span>${s.pts}</span></div>${s.finish === 1 ? '<span class="pill gold">🏆 Champions</span>' : ''}</div>
      <div class="card"><h3>Your season</h3><div class="kv"><span class="k">Apps</span><span>${s.apps}</span><span class="k">Goals</span><span>${s.goals}</span><span class="k">Assists</span><span>${s.assists}</span><span class="k">MOTM</span><span>${s.motm}</span><span class="k">OVR</span><span>${s.ovr}</span></div></div></div>
      ${s.awards && s.awards.length ? `<div class="card hl"><h3>Honours</h3>${s.awards.map(w => `<div>🏆 ${esc(w.name)}</div>`).join('')}</div>` : ''}
      <div class="script">${scriptLine('John', `Another year older. <b>${esc(p.name)}</b> turns ${p.age}.`)}${scriptLine('Ally', s.finish <= 3 ? 'Top-three finish. The phone will be ringing.' : s.finish >= 15 ? 'Rough season. Time to knuckle down on the training ground.' : 'Solid, unspectacular. Next year has to be the step up.')}</div>`;
    const acts = [{ label: '▶ New season', cls: 'primary', fn: () => { U.summary = null; S.flags.wcDone = false; go('hub'); } }];
    if (retirementDue()) acts.unshift({ label: '🏁 Retire', cls: 'warn', sub: `Age ${p.age}, OVR ${p.ovr}. Lap of honour and a legacy card.`, fn: () => { const L = legacyCard(); playCut('legacy', cutData({ seasons: L.seasons, clubs: L.clubs, goals: L.goals, honours: L.honours, caps: L.caps }), () => go('legacy')); } });
    return { html: html + (retirementDue() ? '<div class="notice">Your body is telling you something. Retire now, or go one more season.</div>' : '') + (s.declined ? '<p class="muted">Age has taken a little pace and power this year.</p>' : ''), actions: acts, after: () => { if (U.seasonCuts && U.seasonCuts.length) { const cuts = U.seasonCuts; U.seasonCuts = null; playCuts(cuts, () => render()); } } };
  };

  // ---------- boot ----------
  window.PPL_DEBUG = { setTimeScale: v => { U.testTimeScale = v; }, state: () => S, ui: () => U, cut: (type, extra, done) => playCut(type, cutData(extra || {}), done) };
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
