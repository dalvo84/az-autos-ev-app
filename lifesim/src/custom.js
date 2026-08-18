// The fourth choice is always "make your own". This turns whatever you type
// into stat changes, XP and a line of narration, by reading what you wrote.

const LEXICON = [
  { key: 'ATH', weight: 9, words: ['run', 'ran', 'sprint', 'football', 'footy', 'goal', 'score', 'train', 'training', 'gym', 'swim', 'race', 'match', 'pitch', 'tackle', 'fit', 'fitness', 'sport', 'athletic', 'kick', 'ball', 'boxing', 'climb', 'cycle', 'bike', 'weights', 'muscle'] },
  { key: 'BIZ', weight: 10, words: ['sell', 'sold', 'buy', 'bought', 'business', 'money', 'profit', 'deal', 'trade', 'market', 'client', 'customer', 'invoice', 'price', 'invest', 'company', 'startup', 'launch', 'brand', 'shop', 'venture', 'negotiate', 'flip', 'earn', 'hustle', 'contract', 'revenue'] },
  { key: 'CRE', weight: 9, words: ['make', 'build', 'built', 'design', 'draw', 'create', 'invent', 'idea', 'art', 'paint', 'write', 'story', 'film', 'video', 'edit', 'craft', 'imagine', 'creative', 'style', 'sketch'] },
  { key: 'MUS', weight: 9, words: ['rap', 'sing', 'song', 'track', 'beat', 'bars', 'lyrics', 'verse', 'hook', 'chorus', 'mic', 'studio', 'record', 'perform', 'gig', 'stage', 'freestyle', 'melody', 'produce', 'music', 'album', 'guitar', 'piano'] },
  { key: 'COD', weight: 9, words: ['code', 'coding', 'program', 'scratch', 'game', 'app', 'website', 'script', 'software', 'computer', 'bug', 'debug', 'algorithm', 'build a game', 'python', 'javascript', 'server', 'database'] },
  { key: 'SMR', weight: 7, words: ['think', 'plan', 'study', 'learn', 'read', 'research', 'work out', 'figure', 'solve', 'strategy', 'revise', 'school', 'exam', 'book', 'question', 'analyse', 'analyze', 'calculate', 'careful', 'patient'] },
  { key: 'CHA', weight: 8, words: ['talk', 'speak', 'friend', 'friends', 'party', 'people', 'help', 'team', 'lead', 'organise', 'organize', 'host', 'invite', 'together', 'group', 'meet', 'charm', 'persuade', 'convince', 'apologise', 'apologize', 'kind', 'share'] },
  { key: 'NAU', weight: 8, words: ['sneak', 'steal', 'prank', 'break', 'trouble', 'rule', 'dare', 'mischief', 'naughty', 'lie', 'cheat', 'wind up', 'annoy', 'chaos', 'reckless', 'risk', 'ignore', 'refuse', 'run away', 'graffiti'] },
  { key: 'HAP', weight: 7, words: ['laugh', 'fun', 'happy', 'enjoy', 'love', 'family', 'holiday', 'rest', 'relax', 'celebrate', 'smile', 'joy', 'grateful', 'chill'] },
  { key: 'HLT', weight: 6, words: ['sleep', 'eat', 'healthy', 'recover', 'rest', 'stretch', 'doctor', 'heal', 'water', 'walk', 'hospital', 'diet'] },
];

const MONEY_WORDS = ['sell', 'sold', 'business', 'profit', 'earn', 'money', 'client', 'invoice', 'flip', 'trade'];
const NEGATIVE = ['quit', 'stop', 'give up', 'nothing', 'do nothing', 'ignore it', 'refuse', 'skip', 'avoid', 'hide'];

const OPENERS = [
  'You do not take any of the three. You do your own thing.',
  'Nobody offered you that option. You take it anyway.',
  'Off-script, as usual.',
  'You go a fourth way entirely.',
  'That was not on the list. It is now.',
];

const CLOSERS = {
  ATH: 'It costs you something physically and it is worth it.',
  BIZ: 'Somebody older watches you do it and quietly recalculates what you are.',
  CRE: 'It is not the obvious move and that is exactly why it works.',
  MUS: 'The room reacts before you have finished.',
  COD: 'You build the thing rather than talk about the thing.',
  SMR: 'You have thought about this more than anyone realised.',
  CHA: 'People go with it because you are the one saying it.',
  NAU: 'There are consequences. You have decided they are acceptable.',
  HAP: 'It makes life better, which is not a small thing.',
  HLT: 'Boring, sensible, and the correct call.',
};

export function scoreCustom(text, state) {
  const raw = (text || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return null;

  const hits = {};
  let total = 0;
  for (const entry of LEXICON) {
    for (const w of entry.words) {
      if (lower.includes(w)) {
        hits[entry.key] = (hits[entry.key] || 0) + entry.weight;
        total += entry.weight;
        break; // one hit per category per word-list keeps it from snowballing
      }
    }
  }

  const negative = NEGATIVE.some((w) => lower.includes(w));
  const effort = Math.min(1.6, 0.55 + raw.split(/\s+/).length / 26);
  const fx = {};

  if (total === 0) {
    // Nothing recognised — still reward the fact you made something up.
    fx.CRE = Math.round(4 * effort);
    fx.NAU = 2;
    fx.HAP = 2;
  } else {
    const ordered = Object.entries(hits).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [key, weight] of ordered) {
      fx[key] = Math.max(2, Math.round((weight / 9) * 6 * effort));
    }
    // Improvising is itself creative.
    fx.CRE = (fx.CRE || 0) + 3;
  }

  if (negative) {
    fx.HAP = (fx.HAP || 0) - 3;
    fx.SMR = (fx.SMR || 0) + 2;
  }

  const moneyish = MONEY_WORDS.some((w) => lower.includes(w));
  const ageMult = state.age < 10 ? 1 : state.age < 18 ? 12 : state.age < 30 ? 90 : state.age < 60 ? 240 : 100;
  const money = moneyish ? Math.round(ageMult * (1 + Object.keys(hits).length * 0.4)) : 0;

  const lead = Object.keys(fx).sort((a, b) => (fx[b] || 0) - (fx[a] || 0))[0] || 'CRE';
  const xp = Math.round((70 + state.age * 3.4) * effort);

  return {
    fx,
    xp,
    money,
    lead,
    text: raw,
    result: `${pickFrom(OPENERS, raw.length)} "${raw}" — ${CLOSERS[lead] || CLOSERS.CRE}`,
  };
}

function pickFrom(arr, n) {
  return arr[n % arr.length];
}
