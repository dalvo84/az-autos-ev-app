// Game state: stats, XP, levels, flags, log, save/load.

import { MAX_AGE } from './content/timeline.js';

export const STATS = [
  { key: 'ATH', name: 'Athleticism', colour: '#4ade80', start: 8,  talent: 1.8 },
  { key: 'BIZ', name: 'Business',    colour: '#fbbf24', start: 3,  talent: 2.2 },
  { key: 'CRE', name: 'Creativity',  colour: '#f472b6', start: 10, talent: 2.2 },
  { key: 'MUS', name: 'Music',       colour: '#a78bfa', start: 6,  talent: 1.9 },
  { key: 'COD', name: 'Code',        colour: '#38bdf8', start: 0,  talent: 1.7 },
  { key: 'SMR', name: 'Smarts',      colour: '#60a5fa', start: 5,  talent: 1.1 },
  { key: 'CHA', name: 'Charisma',    colour: '#fb923c', start: 12, talent: 1.2 },
  { key: 'HLT', name: 'Health',      colour: '#34d399', start: 90, talent: 1.1 },
  { key: 'HAP', name: 'Happiness',   colour: '#facc15', start: 88, talent: 1.4 },
  { key: 'NAU', name: 'Naughtiness', colour: '#ef4444', start: 30, talent: 1.5 },
];

export const STAT_KEYS = STATS.map((s) => s.key);
const STAT_BY_KEY = Object.fromEntries(STATS.map((s) => [s.key, s]));

export const SAVE_KEY = 'lifesim.save.v1';

export const MAX_LEVEL = 200;

export function xpForLevel(level) {
  // Cumulative XP needed to *reach* `level`. Tuned so a full 110 years of
  // decisions lands somewhere around level 100-140 rather than off the scale.
  if (level <= 1) return 0;
  return Math.round(105 * Math.pow(level - 1, 1.9));
}

export function levelFromXp(xp) {
  let lv = 1;
  while (lv < MAX_LEVEL && xp >= xpForLevel(lv + 1)) lv++;
  return lv;
}

export function newGame(seed) {
  return {
    version: 1,
    seed: seed || `life-${Date.now()}`,
    age: 0,
    qIndex: 0,          // 0..2 within the current year
    decisions: 0,       // total decisions taken == current 3D level number
    xp: 0,
    level: 1,
    money: 0,
    fame: 0,
    stats: Object.fromEntries(STATS.map((s) => [s.key, s.start])),
    talent: Object.fromEntries(STATS.map((s) => [s.key, s.talent])),
    flags: {},          // storyline switches
    counters: {},       // numeric tallies (goals, tracks, businesses...)
    achievements: [],   // ids earned
    perks: [],          // ids of active perks
    seenQuestions: [],  // ids already used, to stop repeats
    log: [],            // { age, text, kind }
    relationships: {},  // personId -> 0..100
    finished: false,
    obituary: null,
    startedAt: new Date().toISOString(),
  };
}

export function statMeta(key) { return STAT_BY_KEY[key]; }

export function clampStat(key, value) {
  // Kept to one decimal so slow drift (ageing) is not lost to rounding.
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

// Applies a stat delta with the character's talent multiplier on gains and any
// perk multipliers stacked on top. Gains shrink as a stat approaches 100, so
// the last ten points cost far more than the first ten. Losses apply flat.
export function applyStat(state, key, delta, perkMult = 1) {
  if (!(key in state.stats)) return 0;
  const before = state.stats[key];
  let scaled = delta;
  if (delta > 0) {
    const headroom = Math.max(0, (100 - before) / 100);
    scaled = delta * (state.talent[key] || 1) * perkMult * Math.pow(headroom, 1.15);
  }
  state.stats[key] = clampStat(key, before + scaled);
  return state.stats[key] - before;
}

export function addXp(state, amount) {
  const before = state.level;
  state.xp = Math.max(0, Math.round(state.xp + amount));
  state.level = levelFromXp(state.xp);
  return state.level - before;
}

export function levelProgress(state) {
  const cur = xpForLevel(state.level);
  const next = xpForLevel(state.level + 1);
  const span = Math.max(1, next - cur);
  return {
    current: state.xp - cur,
    needed: span,
    pct: Math.max(0, Math.min(1, (state.xp - cur) / span)),
    nextAt: next,
  };
}

export function bump(state, counter, by = 1) {
  state.counters[counter] = (state.counters[counter] || 0) + by;
  return state.counters[counter];
}

export function setFlag(state, flag, value = true) { state.flags[flag] = value; }
export function hasFlag(state, flag) { return !!state.flags[flag]; }
export function count(state, counter) { return state.counters[counter] || 0; }

export function logEvent(state, text, kind = 'note') {
  state.log.push({ age: state.age, text, kind });
  if (state.log.length > 2000) state.log.splice(0, state.log.length - 2000);
}

export function relationship(state, id) {
  return state.relationships[id] ?? 50;
}

export function nudgeRelationship(state, id, by) {
  const v = relationship(state, id);
  state.relationships[id] = Math.max(0, Math.min(100, v + by));
  return state.relationships[id];
}

export function statTotal(state) {
  return STAT_KEYS.reduce((n, k) => n + state.stats[k], 0);
}

export function isAlive(state) {
  return !state.finished && state.age <= MAX_AGE;
}

export function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn('Could not save:', err);
    return false;
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
}
