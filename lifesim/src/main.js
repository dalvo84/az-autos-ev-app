// Boot, wiring and the loop that ties the engine to the 3D stage.

import { Stage3D } from './stage3d.js';
import { Engine } from './engine.js';
import { newGame, load, save, wipe } from './state.js';
import { peopleAt } from './content/people.js';
import {
  DEFAULT_PROFILE, PEOPLE_FIELDS, PLACE_FIELDS, getProfile, setProfile,
  loadProfile, saveProfile, placeLibrary, rememberPlaces, clampYear,
} from './setup.js';
import { WEALTH_TIERS, wealthTier } from './content/wealth.js';
import { livingTier } from './content/homes.js';
import { money as fmtMoney } from './ui.js';
import {
  $, $$, show, renderHud, renderQuestion, renderOutcome, renderYearBreak,
  renderAchievements, renderPeople, renderLog, renderEnding, markSelected,
  setConfirmVisible, toast,
} from './ui.js';

const stage = new Stage3D($('#stage'));

let state = null;
let engine = null;
let selection = [];
let pendingArrivals = [];

// --------------------------------------------------------------- context
function sceneContext() {
  const c = engine.context();
  const { family, friends } = peopleAt(state.age);
  c.qIndex = state.qIndex;
  c.flags = state.flags;
  c.homeTier = livingTier(state);
  c.people = [...family, ...friends].map((p) => ({
    colour: p.colour,
    height: scaleHeight(p, state.age),
  }));
  return c;
}

// Children in the scene should look like children.
function scaleHeight(person, age) {
  const adult = person.height || 1.72;
  if (person.bornOffset === undefined && person.met === undefined) return adult;
  const theirAge = person.bornOffset !== undefined
    ? Math.max(0, age - person.bornOffset)
    : age;
  if (theirAge >= 18) return adult;
  return Math.max(0.55, adult * (0.42 + (theirAge / 18) * 0.58));
}

// ----------------------------------------------------------------- flow
function startNew(seed) {
  state = newGame(seed || `life-${Math.floor(Math.random() * 1e9)}`);
  engine = new Engine(state);
  save(state);
  show('#start', false);
  show('#hud', true);
  beginYear();
}

function resume(saved) {
  if (saved.profile) setProfile(saved.profile);
  state = saved;
  engine = new Engine(state);
  show('#start', false);
  show('#hud', true);
  if (state.finished) return endGame();
  if (state.qIndex === 0) beginYear();
  else { renderHud(state, engine.context()); askQuestion(); }
}

function beginYear() {
  pendingArrivals = engine.openYear();
  const ctx = sceneContext();
  renderHud(state, ctx);
  renderYearBreak(state, ctx, pendingArrivals);
  stage.setLevel(ctx.stage.theme, ctx, `${state.seed}:${state.age}:opening`);
  hideCards();
  show('#yearbreak', true);
}

function askQuestion() {
  const q = engine.nextQuestion();
  if (!q) return endGame();
  const ctx = sceneContext();
  selection = [];
  stage.setLevel(q.scene, ctx, `${state.seed}:${state.age}:${state.qIndex}`);
  renderQuestion(q, ctx, {
    toggle: (id) => toggleOption(q, id),
    own: () => {
      selection = [];
      markSelected([]);
      setConfirmVisible(false);
      show('#q-custom', true);
      $('#custom-input').focus();
    },
  });
  renderHud(state, ctx);
  show('#outcome', false);
  show('#question', true);
  togglePeek(false);
}

function toggleOption(q, id) {
  show('#q-custom', false);
  const max = q.multi ? 2 : 1;
  if (selection.includes(id)) selection = selection.filter((x) => x !== id);
  else selection = [...selection, id].slice(-max);
  markSelected(selection);
  setConfirmVisible(selection.length > 0);
}

function submit(choice) {
  const outcome = engine.answer(choice);
  if (!outcome) return;
  renderOutcome(outcome, state);
  renderHud(state, sceneContext());
  for (const a of outcome.achievements) {
    toast(`${a.secret ? 'Secret unlocked' : 'Achievement'} — ${a.name}`, !!a.secret);
  }
  if (outcome.levelUps > 0) toast(`Level ${state.level}`, true);
  show('#question', false);
  show('#outcome', true);
  togglePeek(false);
}

function carryOn() {
  show('#outcome', false);
  if (engine.yearComplete()) {
    if (!engine.advanceYear()) return endGame();
    beginYear();
  } else {
    askQuestion();
  }
}

function endGame() {
  hideCards();
  show('#yearbreak', false);
  renderEnding(state);
  show('#ending', true);
}

function hideCards() {
  show('#question', false);
  show('#outcome', false);
}

// ---------------------------------------------------------------- panels
function openPanel(kind) {
  const titles = { achievements: 'Achievements', people: 'People', log: 'The life so far' };
  const bodies = { achievements: renderAchievements, people: renderPeople, log: renderLog };
  $('#side-title').textContent = titles[kind] || '';
  $('#side-body').innerHTML = bodies[kind] ? bodies[kind](state) : '';
  show('#panel', true);
  if (kind === 'log') {
    const body = $('#side-body');
    body.scrollTop = body.scrollHeight;
  }
}

// ------------------------------------------------------------------ wire
// ----------------------------------------------------------------- setup
let draft = null;

function openSetup() {
  draft = JSON.parse(JSON.stringify(getProfile()));
  $('#su-name').value = draft.name;
  $('#su-year').value = draft.birthYear;

  $('#place-library').innerHTML = placeLibrary()
    .map((n) => `<option value="${escapeAttr(n)}"></option>`).join('');

  $('#su-places').innerHTML = PLACE_FIELDS.map((f) => `
    <label class="field">
      <span>${f.label} <em>${f.ages}</em></span>
      <input type="text" list="place-library" maxlength="40" autocomplete="off"
             data-place="${f.index}" value="${escapeAttr(draft.places[f.index] || '')}" />
    </label>`).join('');

  for (const group of ['parents', 'family', 'friends']) {
    $(`#su-${group}`).innerHTML = PEOPLE_FIELDS.filter((f) => f.group === group).map((f) => `
      <label class="field">
        <span>${f.label}</span>
        <input type="text" maxlength="24" autocomplete="off"
               data-person="${f.key}" value="${escapeAttr(draft.people[f.key] || '')}" />
      </label>`).join('');
  }

  renderWealth();
  show('#start', false);
  show('#setup', true);
  $('#setup').scrollTop = 0;
}

function renderWealth() {
  $('#su-wealth').innerHTML = WEALTH_TIERS.map((w) => `
    <button type="button" class="wealth-opt ${w.id === draft.wealth ? 'sel' : ''}" data-wealth="${w.id}">
      ${w.name}<i>${w.id === draft.wealth ? 'chosen' : `x${w.money} money`}</i>
    </button>`).join('');

  const t = wealthTier(draft.wealth);
  const figures = [
    `money x${t.money}`,
    `XP x${t.xp}`,
    t.start ? `${fmtMoney(t.start)} in your name` : 'nothing in your name',
    ...Object.entries(t.stats).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`),
  ];
  $('#su-wealth-detail').innerHTML =
    `<b>${t.name}</b>${t.blurb}<div class="figures">${figures.map((f) => `<span>${f}</span>`).join('')}</div>`;
}

function readSetup() {
  const people = { ...draft.people };
  $$('#setup [data-person]').forEach((el) => {
    const v = el.value.trim();
    people[el.dataset.person] = v || DEFAULT_PROFILE.people[el.dataset.person];
  });
  const places = DEFAULT_PROFILE.places.slice();
  $$('#setup [data-place]').forEach((el) => {
    const v = el.value.trim();
    places[Number(el.dataset.place)] = v || DEFAULT_PROFILE.places[Number(el.dataset.place)];
  });
  return {
    name: $('#su-name').value.trim() || DEFAULT_PROFILE.name,
    birthYear: clampYear($('#su-year').value),
    wealth: draft.wealth,
    places,
    people,
  };
}

function escapeAttr(v) {
  return String(v).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('#su-wealth').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-wealth]');
  if (!btn) return;
  draft.wealth = btn.dataset.wealth;
  renderWealth();
});
$('#su-defaults').addEventListener('click', () => {
  setProfile(JSON.parse(JSON.stringify(DEFAULT_PROFILE)));
  openSetup();
});
$('#su-back').addEventListener('click', () => {
  show('#setup', false);
  show('#start', true);
});
$('#su-begin').addEventListener('click', () => {
  const next = readSetup();
  setProfile(next);
  saveProfile(next);
  rememberPlaces(next.places);
  show('#setup', false);
  startNew($('#seed-input').value.trim());
});

$('#btn-new').addEventListener('click', openSetup);
$('#btn-continue').addEventListener('click', () => {
  const saved = load();
  if (saved) resume(saved);
});
$('#btn-year').addEventListener('click', () => { show('#yearbreak', false); askQuestion(); });
$('#btn-confirm').addEventListener('click', () => { if (selection.length) submit({ optionIds: selection }); });
$('#btn-next').addEventListener('click', carryOn);
$('#custom-go').addEventListener('click', () => {
  const text = $('#custom-input').value.trim();
  if (!text) return;
  submit({ custom: text });
});
$('#custom-cancel').addEventListener('click', () => show('#q-custom', false));
$('#custom-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#custom-go').click();
});
$('#btn-restart').addEventListener('click', () => {
  wipe();
  show('#ending', false);
  show('#hud', false);
  $('#btn-continue').hidden = true;
  openSetup();
});
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Wipe this life and start again from nought?')) return;
  wipe();
  hideCards();
  show('#panel', false);
  show('#yearbreak', false);
  show('#ending', false);
  show('#hud', false);
  show('#start', true);
  $('#btn-continue').hidden = true;
});
$('#btn-peek').addEventListener('click', () => togglePeek());
$('#side-close').addEventListener('click', () => show('#panel', false));

function togglePeek(force) {
  const on = force === undefined ? !document.body.classList.contains('peek') : force;
  document.body.classList.toggle('peek', on);
  stage.setPeek(on);
}
$$('#hud [data-panel]').forEach((b) => {
  b.addEventListener('click', () => openPanel(b.dataset.panel));
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const q = $('#question');
  if (!q.hidden) {
    const idx = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
    if (idx >= 0) {
      const buttons = $$('#q-options .opt');
      if (buttons[idx]) buttons[idx].click();
      return;
    }
    if (e.key === 'Enter' && selection.length) $('#btn-confirm').click();
    return;
  }
  if (!$('#outcome').hidden && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    $('#btn-next').click();
  } else if (!$('#yearbreak').hidden && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    $('#btn-year').click();
  } else if (e.key === 'Escape') {
    show('#panel', false);
    togglePeek(false);
  } else if (e.key.toLowerCase() === 'v') {
    togglePeek();
  }
});

// Your last setup is remembered; the saved life is offered, not forced.
setProfile(loadProfile() || DEFAULT_PROFILE);

const existing = load();
if (existing) {
  const btn = $('#btn-continue');
  btn.hidden = false;
  btn.textContent = existing.finished
    ? 'See how it ended'
    : `Continue — age ${existing.age}, level ${existing.level}`;
}

// Something to look at behind the start screen.
stage.setLevel('village', {
  place: { sky: 0x9ecbf0 },
  flags: {},
  people: [{ colour: 0xe06c3a, height: 1.1 }, { colour: 0x4a7fb5, height: 1.8 }],
}, 'title-screen');
