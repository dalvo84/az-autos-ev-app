// What the place you live in actually looks like at each level of wealth.
//
// Childhood scenes use your family's tier. From eighteen the house tracks your
// own money instead, so getting rich visibly changes where you wake up.

export const HOME_STYLES = {
  very_poor: {
    label: 'A damp flat on the fourth floor',
    room: { w: 6.5, d: 5.5, h: 2.4 },
    floor: 0x6a635c, wall: 0x9a958a,
    seat: { kind: 'mattress', colour: 0x8a8175 },
    tv: null,
    table: { kind: 'crate', colour: 0xa8895c },
    extras: ['damp', 'clutter', 'clutter', 'bulb', 'bucket'],
    ambient: { hemi: 0.62, sun: 0.7 },
    outside: { kind: 'tower', w: 9, d: 8, h: 16, wall: 0x8d8579, roof: 0x55504a, pitched: false, fence: 'broken' },
  },
  poor: {
    label: 'A small rented house',
    room: { w: 7.5, d: 6.5, h: 2.6 },
    floor: 0x8a7358, wall: 0xbdb4a4,
    seat: { kind: 'sofa', w: 1.9, colour: 0x6b6255, worn: true },
    tv: null,
    table: { kind: 'table', w: 1.1, colour: 0x7a6244 },
    extras: ['clutter', 'shade'],
    ambient: { hemi: 0.8, sun: 0.95 },
    outside: { kind: 'terrace', w: 5.5, d: 5, h: 5, wall: 0xb5a894, roof: 0x6d4a3c, pitched: true, fence: 'low' },
  },
  lower_middle: {
    label: 'A tidy little semi',
    room: { w: 8.5, d: 7.5, h: 2.8 },
    floor: 0x9a7a55, wall: 0xd6cec0,
    seat: { kind: 'sofa', w: 2.4, colour: 0x5c6b7a },
    tv: { w: 1.1 },
    table: { kind: 'table', w: 1.3, colour: 0x7a5a38 },
    extras: ['rug', 'shade', 'picture'],
    ambient: { hemi: 0.95, sun: 1.2 },
    outside: { kind: 'semi', w: 6.5, d: 5.5, h: 5.4, wall: 0xc9b89d, roof: 0x7d4235, pitched: true, fence: 'low' },
  },
  middle: {
    label: 'An ordinary family house',
    room: { w: 10, d: 9, h: 3.1 },
    floor: 0xa87c52, wall: 0xece5d9,
    seat: { kind: 'sofa', w: 2.8, colour: 0x5c6b7a },
    tv: { w: 1.6 },
    table: { kind: 'table', w: 1.5, colour: 0x7a5a38 },
    extras: ['rug', 'speaker', 'picture', 'plant'],
    ambient: { hemi: 1.1, sun: 1.5 },
    outside: { kind: 'detached', w: 7, d: 6, h: 5.6, wall: 0xd9cdb8, roof: 0x8c4a3b, pitched: true },
  },
  upper_middle: {
    label: 'Four bedrooms and a driveway',
    room: { w: 12, d: 10.5, h: 3.4 },
    floor: 0xb08a5f, wall: 0xf0ebe1,
    seat: { kind: 'sofa', w: 3.3, colour: 0x4e5f70, armchair: true },
    tv: { w: 2 },
    table: { kind: 'table', w: 1.8, colour: 0x6b4a2f },
    extras: ['rug', 'speaker', 'picture', 'plant', 'plant', 'bookshelf'],
    ambient: { hemi: 1.15, sun: 1.55 },
    outside: { kind: 'detached', w: 9.5, d: 7.5, h: 6.4, wall: 0xe4dccb, roof: 0x6b4038, pitched: true, drive: true },
  },
  rich: {
    label: 'A house with a name, not a number',
    room: { w: 15, d: 12.5, h: 4.2 },
    floor: 0x8a5f38, wall: 0xf6f2ea,
    seat: { kind: 'sectional', w: 4.4, colour: 0x3f4a58, armchair: true },
    tv: { w: 2.8 },
    table: { kind: 'table', w: 2.2, colour: 0x4a3524 },
    extras: ['rug', 'art', 'art', 'plant', 'plant', 'fireplace', 'piano', 'floorlamp'],
    ambient: { hemi: 1.2, sun: 1.6, warm: 60 },
    outside: { kind: 'mansion', w: 14, d: 10, h: 8, wall: 0xefe7d6, roof: 0x5a4b42, pitched: true, drive: true, pool: true },
  },
  extremely_rich: {
    label: 'The house people slow down to look at',
    room: { w: 19, d: 15, h: 5 },
    floor: 0xd8d2c8, wall: 0xfaf7f1,
    seat: { kind: 'sectional', w: 5.6, colour: 0x35404d, armchair: true },
    tv: { w: 3.6 },
    table: { kind: 'table', w: 2.8, colour: 0x2f2620 },
    extras: ['rug', 'art', 'art', 'art', 'plant', 'plant', 'fireplace', 'piano', 'chandelier', 'stairs', 'glass'],
    ambient: { hemi: 1.25, sun: 1.6, warm: 110 },
    outside: { kind: 'estate', w: 20, d: 13, h: 9.5, wall: 0xf4efe4, roof: 0x4e433c, pitched: false, drive: true, pool: true },
  },
  centibillionaire: {
    label: 'Not really a house any more',
    room: { w: 26, d: 19, h: 6.5 },
    floor: 0xe6e2da, wall: 0xfdfbf6,
    seat: { kind: 'sectional', w: 7, colour: 0x2b3440, armchair: true, second: true },
    tv: { w: 5.5 },
    table: { kind: 'table', w: 3.6, colour: 0x241d18 },
    extras: ['rug', 'art', 'art', 'art', 'plant', 'plant', 'tree', 'fireplace', 'piano',
      'chandelier', 'chandelier', 'stairs', 'glass', 'sculpture'],
    ambient: { hemi: 1.3, sun: 1.65, warm: 190 },
    outside: { kind: 'estate', w: 30, d: 18, h: 12, wall: 0xffffff, roof: 0x3f3833, pitched: false, drive: true, pool: true, gate: true },
  },
};

export const DEFAULT_STYLE = 'middle';

export function homeStyle(id) {
  return HOME_STYLES[id] || HOME_STYLES[DEFAULT_STYLE];
}

// Once you are grown the house follows your own money, not your parents'.
const MONEY_BANDS = [
  [0, 'very_poor'],
  [5000, 'poor'],
  [30000, 'lower_middle'],
  [150000, 'middle'],
  [600000, 'upper_middle'],
  [5000000, 'rich'],
  [100000000, 'extremely_rich'],
  [Infinity, 'centibillionaire'],
];

export function tierFromMoney(money) {
  for (const [ceiling, id] of MONEY_BANDS) {
    if (money < ceiling) return id;
  }
  return 'centibillionaire';
}

// Childhood is your family's standing; adulthood is your own.
export function livingTier(state) {
  if (!state) return DEFAULT_STYLE;
  if (state.age < 18) return state.wealth || DEFAULT_STYLE;
  return tierFromMoney(state.money || 0);
}
