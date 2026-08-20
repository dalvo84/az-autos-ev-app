// What your family had. It changes what you start with, how far money goes,
// and how hard the whole thing is.
//
// stats      one-off adjustments to your starting stats
// start      money already in your name on day one
// money      multiplier on everything you ever earn
// xp         multiplier on XP — hardship teaches faster, comfort teaches slower

export const WEALTH_TIERS = [
  {
    id: 'very_poor', name: 'Very poor', short: 'Very poor',
    blurb: 'Nothing spare, ever. You learn the price of everything before you learn to read.',
    stats: { HLT: -12, SMR: -3, HAP: -6, NAU: 10, ATH: 4 },
    start: 0, money: 0.45, xp: 1.35,
    headline: 'There is no spare money in this house and there never has been. You work that out early.',
  },
  {
    id: 'poor', name: 'Poor', short: 'Poor',
    blurb: 'Rent gets paid, just. Everything else is a conversation.',
    stats: { HLT: -6, SMR: -3, HAP: -2, NAU: 6, ATH: 2 },
    start: 0, money: 0.65, xp: 1.22,
    headline: 'Money is tight and talked about. You are good at wanting things quietly.',
  },
  {
    id: 'lower_middle', name: 'Lower middle class', short: 'Lower middle',
    blurb: 'Both parents working, one holiday a year, nothing wasted.',
    stats: { HLT: -2, NAU: 3, BIZ: 2 },
    start: 0, money: 0.85, xp: 1.12,
    headline: 'Comfortable enough, careful with it. One holiday a year and nothing goes in the bin early.',
  },
  {
    id: 'middle', name: 'Middle class', short: 'Middle',
    blurb: 'The ordinary version. Enough, not plenty.',
    stats: {},
    start: 0, money: 1, xp: 1,
    headline: 'Ordinary and fine. Enough of everything and not much spare.',
  },
  {
    id: 'upper_middle', name: 'Upper middle class', short: 'Upper middle',
    blurb: 'Two cars, tutors if you need them, and nobody checks the shopping total.',
    stats: { SMR: 5, CHA: 3, HLT: 3 },
    start: 0, money: 1.3, xp: 0.94,
    headline: 'Two cars on the drive and a tutor the moment anyone falls behind. Money is not a topic.',
  },
  {
    id: 'rich', name: 'Rich', short: 'Rich',
    blurb: 'Private school money. Doors open before you knock.',
    stats: { SMR: 8, CHA: 7, BIZ: 5, HLT: 5, NAU: 4 },
    start: 1000, money: 2.2, xp: 0.86,
    headline: 'Private school money. You will spend a long time working out which doors opened on their own.',
  },
  {
    id: 'extremely_rich', name: 'Extremely rich', short: 'Extremely rich',
    blurb: 'The surname is known. There is staff.',
    stats: { SMR: 10, CHA: 11, BIZ: 9, HLT: 7, HAP: -2 },
    start: 25000, money: 5, xp: 0.78,
    headline: 'People know the surname before they meet you. There is staff, and there is a version of you they expect.',
  },
  {
    id: 'centibillionaire', name: 'Centibillionaires', short: 'Centibillionaire',
    blurb: 'A hundred billion. Nothing in your life is a normal size.',
    stats: { SMR: 12, CHA: 15, BIZ: 14, HLT: 9, HAP: -5, NAU: 6 },
    start: 1000000, money: 40, xp: 0.68,
    headline: 'A hundred billion pounds sits behind your surname. Nothing about your life will ever be a normal size, including the problems.',
  },
];

export const WEALTH_BY_ID = Object.fromEntries(WEALTH_TIERS.map((w) => [w.id, w]));
export const DEFAULT_WEALTH = 'middle';

export function wealthTier(id) {
  return WEALTH_BY_ID[id] || WEALTH_BY_ID[DEFAULT_WEALTH];
}

export function wealthRank(id) {
  const i = WEALTH_TIERS.findIndex((w) => w.id === id);
  return i < 0 ? 3 : i;
}
