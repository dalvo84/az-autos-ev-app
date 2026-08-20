// Who you are before the game starts: your name, the year, where you live,
// who your family and friends are, and what your family had.
//
// The written content uses the default names throughout. Rather than tokenise
// three thousand lines of prose, everything that reaches the screen goes
// through personalise(), which swaps the defaults for your choices in a single
// pass so a rename can never be re-matched by a later rule.

export const SETUP_KEY = 'lifesim.setup.v1';
export const PLACES_KEY = 'lifesim.places.v1';

export const DEFAULT_PROFILE = {
  name: 'You',
  birthYear: 2013,
  wealth: 'middle',
  places: ['Shillington', 'Hitchin', 'Meppershall', 'Letchworth'],
  people: {
    mum: 'Alex',
    dad: 'David',
    sister: 'Elowen',
    cousin_older: 'Ollie',
    cousin_blake: 'Blake',
    cousin_willa: 'Willa',
    cousin_preston: 'Preston',
    boyd: 'Boyd',
    ollie_b: 'Ollie B',
    ollie_c: 'Ollie C',
    jack: 'Jack',
    forrest: 'Forrest',
    ollie_hen: 'Ollie (Hen)',
    oscar: 'Oscar',
  },
};

// Which profile key each person in people.js takes its name from.
export const PERSON_KEYS = {
  alex: 'mum',
  david: 'dad',
  elowen: 'sister',
  ollie_a: 'cousin_older',
  blake: 'cousin_blake',
  willa: 'cousin_willa',
  preston: 'cousin_preston',
  boyd: 'boyd',
  ollie_b: 'ollie_b',
  ollie_c: 'ollie_c',
  jack: 'jack',
  forrest: 'forrest',
  ollie_hen: 'ollie_hen',
  oscar: 'oscar',
};

export const PEOPLE_FIELDS = [
  { key: 'mum', label: 'Mum', group: 'parents' },
  { key: 'dad', label: 'Dad', group: 'parents' },
  { key: 'sister', label: 'Sister (born when you are 2)', group: 'family' },
  { key: 'cousin_older', label: 'Cousin, two years older', group: 'family' },
  { key: 'cousin_blake', label: 'Cousin (born when you are 5)', group: 'family' },
  { key: 'cousin_willa', label: 'Cousin (born when you are 8)', group: 'family' },
  { key: 'cousin_preston', label: 'Cousin (born when you are 10)', group: 'family' },
  { key: 'boyd', label: 'Best friend, from birth', group: 'friends' },
  { key: 'ollie_b', label: 'Lower school — naughty', group: 'friends' },
  { key: 'ollie_c', label: 'Year 6 — reckless', group: 'friends' },
  { key: 'jack', label: 'Year 6 — smart, funny, popular', group: 'friends' },
  { key: 'forrest', label: 'Year 6 — smart, funny, popular', group: 'friends' },
  { key: 'ollie_hen', label: 'Year 6 — smart, funny', group: 'friends' },
  { key: 'oscar', label: 'Year 6 — born the same day as you', group: 'friends' },
];

export const PLACE_FIELDS = [
  { index: 0, label: 'Born here', ages: 'ages 0–8' },
  { index: 1, label: 'Then', ages: 'ages 8–10' },
  { index: 2, label: 'Then', ages: 'ages 10–13' },
  { index: 3, label: 'And from 13', ages: 'ages 13 onwards' },
];

let profile = clone(DEFAULT_PROFILE);
let replacer = null;

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export function getProfile() { return profile; }

export function setProfile(next) {
  profile = {
    ...clone(DEFAULT_PROFILE),
    ...next,
    people: { ...DEFAULT_PROFILE.people, ...(next && next.people) },
    places: (next && next.places && next.places.length === 4)
      ? next.places.slice()
      : DEFAULT_PROFILE.places.slice(),
  };
  profile.birthYear = clampYear(profile.birthYear);
  replacer = null;
  return profile;
}

export function clampYear(y) {
  const n = Math.round(Number(y));
  if (!Number.isFinite(n)) return DEFAULT_PROFILE.birthYear;
  return Math.max(1900, Math.min(2400, n));
}

export function personName(personId) {
  const key = PERSON_KEYS[personId];
  return (key && profile.people[key]) || personId;
}

export function placeName(index) {
  return profile.places[index] || DEFAULT_PROFILE.places[index];
}

// ------------------------------------------------------------------ saving
export function saveProfile(p) {
  try { localStorage.setItem(SETUP_KEY, JSON.stringify(p || profile)); } catch (err) { /* ignore */ }
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) { return null; }
}

// Every location you have ever typed, kept so it is one tap next time.
export function placeLibrary() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(PLACES_KEY) || '[]');
  } catch (err) { saved = []; }
  const all = [...DEFAULT_PROFILE.places, ...(Array.isArray(saved) ? saved : [])];
  return [...new Set(all.filter((s) => typeof s === 'string' && s.trim()))];
}

export function rememberPlaces(names) {
  const known = new Set(DEFAULT_PROFILE.places);
  let saved;
  try { saved = JSON.parse(localStorage.getItem(PLACES_KEY) || '[]'); } catch (err) { saved = []; }
  if (!Array.isArray(saved)) saved = [];
  for (const n of names) {
    const name = String(n || '').trim();
    if (name && !known.has(name) && !saved.includes(name)) saved.push(name);
  }
  try { localStorage.setItem(PLACES_KEY, JSON.stringify(saved.slice(-60))); } catch (err) { /* ignore */ }
  return saved;
}

// ----------------------------------------------------------- personalising
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildReplacer() {
  // Every default name goes in, including the ones you did not change. An
  // unchanged "Ollie C" still has to be in the pattern, or the shorter
  // "Ollie" would match inside it and rename half of somebody else.
  const map = {};
  let changed = false;
  for (const [key, def] of Object.entries(DEFAULT_PROFILE.people)) {
    const now = profile.people[key] || def;
    map[def] = now;
    if (now !== def) changed = true;
  }
  DEFAULT_PROFILE.places.forEach((def, i) => {
    const now = profile.places[i] || def;
    map[def] = now;
    if (now !== def) changed = true;
  });

  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  if (!changed || !keys.length) return { re: null, map };
  // One pass, longest key first, so renaming "Ollie" can never chew into an
  // already-replaced "Ollie B".
  const re = new RegExp(`(^|[^A-Za-z])(${keys.map(escapeRe).join('|')})(?![A-Za-z])`, 'g');
  return { re, map };
}

export function personalise(text) {
  if (!text) return text;
  if (!replacer) replacer = buildReplacer();
  if (!replacer.re) return text;
  return String(text).replace(replacer.re, (m, pre, key) => pre + (replacer.map[key] || key));
}
