// DOM rendering helpers. Nothing in here knows about the game rules.

import { STATS, levelProgress } from './state.js';
import { ACHIEVEMENTS, BY_ID } from './content/achievements.js';
import { ALL_PEOPLE } from './content/people.js';
import { personalise as P, getProfile } from './setup.js';
import { wealthTier } from './content/wealth.js';

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export function show(el, on = true) {
  if (typeof el === 'string') el = $(el);
  if (el) el.hidden = !on;
}

export function money(n) {
  const v = Math.round(n);
  if (Math.abs(v) >= 1000000) return `£${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1)}m`;
  return `£${v.toLocaleString('en-GB')}`;
}

// ------------------------------------------------------------------- HUD
export function renderHud(state, ctx) {
  $('#hud-age').textContent = state.age;
  $('#hud-year').textContent = ctx.year;
  $('#hud-place').textContent = ctx.school ? `${ctx.place.name} · ${ctx.school.short}` : ctx.place.name;
  $('#hud-level').textContent = `LV ${state.level}`;

  const p = levelProgress(state);
  $('#hud-xp').style.width = `${Math.round(p.pct * 100)}%`;
  $('#hud-xptext').textContent = `${p.current} / ${p.needed} XP`;

  $('#hud-money').textContent = money(state.money);
  $('#hud-fame').textContent = `${state.fame} fame`;

  const wrap = $('#hud-stats');
  wrap.innerHTML = '';
  for (const s of STATS) {
    const v = Math.round(state.stats[s.key]);
    const el = document.createElement('div');
    el.className = 'stat';
    el.innerHTML = `<span>${s.key}</span><span class="track"><i></i></span><b>${v}</b>`;
    const bar = el.querySelector('i');
    bar.style.width = `${v}%`;
    bar.style.background = s.colour;
    el.title = `${s.name} — talent x${(state.talent[s.key] || 1).toFixed(2)}`;
    wrap.appendChild(el);
  }
}

// -------------------------------------------------------------- QUESTION
const KEYS = ['A', 'B', 'C', 'D'];

export function renderQuestion(q, ctx, handlers) {
  $('#q-level').textContent = `LEVEL ${ctx.level}`;
  $('#q-count').textContent = `Age ${ctx.age} · question ${ctx.qIndex + 1} of 3`;
  $('#q-scene').textContent = q.scene.replace(/_/g, ' ');

  const intro = $('#q-intro');
  if (q.intro) { intro.textContent = P(q.intro); intro.hidden = false; } else { intro.hidden = true; }
  $('#q-prompt').textContent = P(q.prompt);
  show('#q-multi', !!(q.multi && !q.kind));

  // Pick-from-a-list and type-it-in prompts replace the four buttons entirely.
  show('#q-options', !q.kind);
  show('#q-pick', q.kind === 'pick');
  show('#q-text', q.kind === 'text');
  if (q.kind === 'pick') { renderPick(q, handlers); return; }
  if (q.kind === 'text') { renderTextFields(q, handlers); return; }

  const box = $('#q-options');
  box.innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.dataset.id = opt.id;
    b.innerHTML = `<span class="key">${KEYS[i]}</span><span>${escapeHtml(P(opt.label))}</span>`;
    b.addEventListener('click', () => handlers.toggle(opt.id, b));
    box.appendChild(b);
  });

  const own = document.createElement('button');
  own.className = 'opt own';
  own.innerHTML = `<span class="key">${KEYS[3]}</span><span>Make your own — do something else entirely</span>`;
  own.addEventListener('click', handlers.own);
  box.appendChild(own);

  show('#q-custom', false);
  show('#q-confirm', false);
  $('#custom-input').value = '';
}

// ------------------------------------------------------------- pick prompt
function renderPick(q, handlers) {
  const filter = $('#pick-filter');
  filter.value = '';
  filter.placeholder = q.filterHint || 'Type to narrow it down';

  const draw = (term) => {
    const needle = term.trim().toLowerCase();
    const list = $('#pick-list');
    let html = '';
    let shown = 0;
    for (const group of q.groups) {
      const items = group.items.filter((it) => !needle || it.name.toLowerCase().includes(needle));
      if (!items.length) continue;
      html += `<div class="pick-group">${escapeHtml(group.name)}</div>`;
      for (const it of items) {
        shown++;
        html += `<button class="pick-item" data-pick="${escapeHtml(it.id)}">`
          + `<span>${escapeHtml(it.name)}</span>`
          + (it.meta ? `<i>${escapeHtml(it.meta)}</i>` : '') + '</button>';
      }
    }
    list.innerHTML = html || '<div class="pick-empty">Nothing matches that.</div>';
    return shown;
  };

  draw('');
  filter.oninput = () => draw(filter.value);
  $('#pick-list').onclick = (e) => {
    const btn = e.target.closest('[data-pick]');
    if (!btn) return;
    $$('#pick-list .pick-item').forEach((b) => b.classList.remove('sel'));
    btn.classList.add('sel');
    handlers.pick(btn.dataset.pick);
  };
  setTimeout(() => filter.focus(), 60);
}

// ------------------------------------------------------------- text prompt
function renderTextFields(q, handlers) {
  $('#text-fields').innerHTML = q.fields.map((f) => `
    <label class="field">
      <span>${escapeHtml(f.label)}</span>
      <input type="text" data-field="${escapeHtml(f.key)}"
             maxlength="${f.maxLength || 40}"
             placeholder="${escapeHtml(f.placeholder || '')}" autocomplete="off" />
    </label>`).join('');

  const inputs = $$('#text-fields [data-field]');
  const submit = () => {
    const values = {};
    for (const input of inputs) {
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      values[input.dataset.field] = v;
    }
    handlers.text(values);
  };
  $('#text-go').onclick = submit;
  inputs.forEach((input) => {
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
  });
  setTimeout(() => inputs[0] && inputs[0].focus(), 60);
}

export function setConfirmVisible(on) { show('#q-confirm', on); }

export function markSelected(ids) {
  $$('#q-options .opt').forEach((b) => {
    b.classList.toggle('sel', ids.includes(b.dataset.id));
  });
}

// --------------------------------------------------------------- OUTCOME
export function renderOutcome(outcome, state) {
  $('#o-level').textContent = `LEVEL ${outcome.level} CLEARED`;

  const lines = $('#o-lines');
  lines.innerHTML = '';
  for (const line of outcome.lines) {
    const p = document.createElement('p');
    p.textContent = P(line);
    lines.appendChild(p);
  }
  if (outcome.custom) {
    const p = document.createElement('p');
    p.className = 'custom-line';
    p.textContent = P(outcome.custom.result);
    lines.appendChild(p);
  }

  const deltas = $('#o-deltas');
  deltas.innerHTML = '';
  const add = (text, cls) => {
    const s = document.createElement('span');
    s.className = `delta ${cls || ''}`;
    s.textContent = text;
    deltas.appendChild(s);
  };
  add(`+${outcome.xp} XP`, 'xp');
  if (outcome.money) add(`${outcome.money > 0 ? '+' : ''}${money(outcome.money)}`, 'cash');
  for (const [k, v] of Object.entries(outcome.statChanges)) {
    if (Math.abs(v) < 1) continue;
    add(`${v > 0 ? '+' : ''}${Math.round(v)} ${k}`, v > 0 ? '' : 'down');
  }
  if (outcome.levelUps > 0) add(`LEVEL UP → ${state.level}`, 'xp');

  const awards = $('#o-awards');
  awards.innerHTML = '';
  for (const a of outcome.achievements) {
    const el = document.createElement('div');
    el.className = `award ${a.secret ? 'secret' : ''}`;
    el.innerHTML = `<span class="ico">${a.secret ? '🔒' : '🏆'}</span>
      <span><b>${a.secret ? 'Secret: ' : ''}${escapeHtml(a.name)}</b>
      <small>${escapeHtml(P(a.desc))}</small>
      <em>Perk — ${escapeHtml(a.perk.note)}</em></span>`;
    awards.appendChild(el);
  }
}

// ------------------------------------------------------------ YEAR BREAK
export function renderYearBreak(state, ctx, arrivals) {
  $('#yb-kicker').textContent = ctx.stage.name;
  const who = getProfile().name;
  $('#yb-age').textContent = who && who !== 'You' ? `${who}, age ${ctx.age}` : `Age ${ctx.age}`;
  const bits = [ctx.place.name, ctx.year];
  if (ctx.school) bits.push(ctx.school.short);
  const clubs = ctx.clubs.map((c) => c.name);
  if (clubs.length) bits.push(clubs.join(' · '));
  $('#yb-place').textContent = bits.join('  ·  ');

  const head = $('#yb-headline');
  head.textContent = P(ctx.headline || ctx.place.blurb);

  const arr = $('#yb-arrivals');
  arr.innerHTML = '';
  for (const a of arrivals) {
    const el = document.createElement('div');
    if (a.kind === 'income') {
      el.className = `arrival ${a.amount < 0 ? 'loss' : 'pay'}`;
      el.innerHTML = `<b>${a.amount < 0 ? '' : '+'}${money(a.amount)}</b> this year
        <small>${escapeHtml(P(a.note))}</small>`;
      arr.appendChild(el);
      continue;
    }
    el.className = 'arrival';
    const p = a.person;
    el.innerHTML = `<b>${escapeHtml(P(p.name))}</b> — ${a.kind === 'family' ? escapeHtml(p.rel || 'family') : 'new friend'}
      <small>${escapeHtml(P(p.note || ''))}${p.hook ? ' ' + escapeHtml(P(p.hook)) : ''}</small>`;
    arr.appendChild(el);
  }

  $('#yb-summary').textContent =
    `Level ${state.level} · ${state.decisions} decisions taken · ${state.achievements.length} achievements · `
    + `${money(state.money)} · ${wealthTier(state.wealth).short.toLowerCase()} family`;
}

// ---------------------------------------------------------------- PANELS
export function renderAchievements(state) {
  const got = new Set(state.achievements);
  const normal = ACHIEVEMENTS.filter((a) => !a.secret);
  const secret = ACHIEVEMENTS.filter((a) => a.secret);
  const rows = (list, hideUnearned) => list.map((a) => {
    const has = got.has(a.id);
    if (hideUnearned && !has) {
      return `<div class="ach-row"><span class="ico">🔒</span><span><b>? ? ?</b>
        <small>Not found yet.</small></span></div>`;
    }
    return `<div class="ach-row ${has ? 'got' : ''}"><span class="ico">${a.secret ? '🔒' : '🏆'}</span>
      <span><b>${escapeHtml(a.name)}</b><small>${escapeHtml(P(a.desc))}</small>
      <em>${escapeHtml(a.perk.note)}</em></span></div>`;
  }).join('');

  const gotNormal = normal.filter((a) => got.has(a.id)).length;
  const gotSecret = secret.filter((a) => got.has(a.id)).length;
  return `<div class="ach-group">Achievements — ${gotNormal}/${normal.length}</div>${rows(normal, false)}
    <div class="ach-group">Secret — ${gotSecret}/${secret.length} found</div>${rows(secret, true)}`;
}

export function renderPeople(state) {
  const known = ALL_PEOPLE.filter((p) => state.relationships[p.id] !== undefined
    || (p.rel && state.age >= (p.from ?? 0)));
  if (!known.length) return '<p class="log-line">Nobody yet. Give it a year.</p>';
  return known.map((p) => {
    const bond = state.relationships[p.id] ?? 60;
    return `<div class="person-row">
      <span class="dot" style="background:#${p.colour.toString(16).padStart(6, '0')}"></span>
      <span><b>${escapeHtml(P(p.name))}</b><small>${escapeHtml(p.rel || (p.personality || []).join(', '))}${p.note ? ' — ' + escapeHtml(P(p.note)) : ''}</small></span>
      <span class="bond">${bond}<i><b style="width:${bond}%"></b></i></span>
    </div>`;
  }).join('');
}

export function renderLog(state) {
  if (!state.log.length) return '<p class="log-line">Nothing has happened yet.</p>';
  let out = '';
  let lastAge = -1;
  for (const entry of state.log) {
    if (entry.age !== lastAge) {
      out += `<div class="log-year">Age ${entry.age}</div>`;
      lastAge = entry.age;
    }
    out += `<div class="log-line ${entry.kind === 'headline' ? 'headline' : ''}">${escapeHtml(P(entry.text))}</div>`;
  }
  return out;
}

// ---------------------------------------------------------------- ENDING
export function renderEnding(state) {
  $('#end-obit').textContent = P(state.obituary || '');
  const cells = [
    ['Level', state.level],
    ['Decisions', state.decisions],
    ['Achievements', `${state.achievements.length}/${ACHIEVEMENTS.length}`],
    ['Money', money(state.money)],
    ['Fame', state.fame],
    ['Goals', state.counters.goals || 0],
    ['Tracks', state.counters.tracks || 0],
    ['Ventures', state.counters.ventures || 0],
  ];
  $('#end-grid').innerHTML = cells
    .map(([label, v]) => `<div class="end-cell"><b>${v}</b><small>${label}</small></div>`)
    .join('');
  $('#end-ach').innerHTML = state.achievements
    .map((id) => BY_ID[id])
    .filter(Boolean)
    .map((a) => `<span>${a.secret ? '🔒 ' : ''}${escapeHtml(a.name)}</span>`)
    .join('');
}

// ---------------------------------------------------------------- TOASTS
export function toast(text, purple = false) {
  const el = document.createElement('div');
  el.className = `toast ${purple ? 'purple' : ''}`;
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
