// The fixed scaffolding of the life: where you live, where you learn, what you
// play for, and what the world looks like around each age.

import { BIRTH_YEAR } from './people.js';

export const MAX_AGE = 110;
export const QUESTIONS_PER_YEAR = 3;

export const PLACES = [
  {
    id: 'shillington', name: 'Shillington', from: 0, to: 8,
    kind: 'village', sky: 0x9ecbf0, ground: 0x6fa858,
    blurb: 'Bedfordshire village. Church on the hill, fields in every direction.',
  },
  {
    id: 'hitchin', name: 'Hitchin', from: 8, to: 10,
    kind: 'town', sky: 0x9dc0e0, ground: 0x7a9e63,
    blurb: 'Market town. Proper shops, a skate spot, and a lot more people.',
  },
  {
    id: 'meppershall', name: 'Meppershall', from: 10, to: 13,
    kind: 'village', sky: 0xa8cfee, ground: 0x74ab5c,
    blurb: 'Back to village life, but taller and louder than last time.',
  },
  {
    id: 'letchworth', name: 'Letchworth', from: 13, to: MAX_AGE,
    kind: 'garden_city', sky: 0xa6c8e8, ground: 0x6d9f59,
    blurb: 'The first garden city. Wide greens, tree-lined roads, room to build something.',
  },
];

export const SCHOOLS = [
  { id: 'shillington_lower', name: 'Shillington Lower School', short: 'Shillington Lower', from: 4, to: 9, kind: 'lower' },
  { id: 'rba', name: 'Robert Bloomfield Academy', short: 'RBA', from: 9, to: 13, kind: 'middle' },
  { id: 'saint_chris', name: 'St Christopher School', short: 'Saint Chris', from: 13, to: 18, kind: 'upper' },
];

export const CLUBS = [
  { id: 'little_kickers', name: 'Little Kickers', sport: 'football', from: 1, to: 2, status: 'best', kind: 'pitch' },
  { id: 'sharks', name: 'Shillington Sharks', sport: 'football', from: 2, to: 10, status: 'core', folds: 10, kind: 'pitch' },
  { id: 'swimming', name: 'Swimming club', sport: 'swimming', from: 2, to: 9, status: 'core', kind: 'pool' },
  { id: 'knights', name: 'Baldock Knights', sport: 'football', from: 11, to: 99, status: 'core', kind: 'pitch' },
  { id: 'arlesey', name: 'Arlesey Town', sport: 'football', from: 11, to: 11, status: 'best', folds: 11, kind: 'pitch' },
];

export const STAGES = [
  { id: 'infant',   name: 'Infancy',        from: 0,  to: 3,   theme: 'home' },
  { id: 'lower',    name: 'Lower School',   from: 4,  to: 8,   theme: 'school_lower' },
  { id: 'middle',   name: 'Middle School',  from: 9,  to: 12,  theme: 'school_mid' },
  { id: 'teen',     name: 'Teenage Years',  from: 13, to: 17,  theme: 'school_high' },
  { id: 'launch',   name: 'The Launch',     from: 18, to: 24,  theme: 'city' },
  { id: 'build',    name: 'Building It',    from: 25, to: 39,  theme: 'studio' },
  { id: 'peak',     name: 'The Peak',       from: 40, to: 59,  theme: 'office' },
  { id: 'elder',    name: 'The Long View',  from: 60, to: 79,  theme: 'home_modern' },
  { id: 'legend',   name: 'Legend Years',   from: 80, to: MAX_AGE, theme: 'garden' },
];

export function yearOf(age) { return BIRTH_YEAR + age; }

export function placeAt(age) {
  return PLACES.find((p) => age >= p.from && age <= p.to) || PLACES[PLACES.length - 1];
}

export function schoolAt(age) {
  return SCHOOLS.find((s) => age >= s.from && age < s.to) || null;
}

export function clubsAt(age) {
  return CLUBS.filter((c) => age >= c.from && age <= c.to);
}

export function stageAt(age) {
  return STAGES.find((s) => age >= s.from && age <= s.to) || STAGES[STAGES.length - 1];
}

// Life admin that happens to you rather than because of you.
export const YEAR_HEADLINES = {
  0: 'Born in Shillington. Dad puts the speakers on before you can hold your own head up.',
  1: 'Little Kickers. You are the smallest one there and already the best one there.',
  2: 'Elowen arrives. You start at Shillington Sharks and in the pool the same year.',
  4: 'Shillington Lower School. And a Mario nearly as tall as the door.',
  5: 'Blake is born. You are officially somebody\'s older cousin.',
  8: 'The family moves to Hitchin. Willa is born.',
  9: 'Robert Bloomfield Academy. Swimming ends. WWE begins.',
  10: 'Preston is born. The Sharks fold. Year 6 hands you five new friends at once.',
  11: 'Baldock Knights, and one strange brilliant season at Arlesey Town.',
  13: 'St Christopher School, Letchworth.',
  18: 'School ends. Everything after this is your call.',
};

export function headlineFor(age) {
  return YEAR_HEADLINES[age] || null;
}
