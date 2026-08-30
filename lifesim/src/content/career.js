// What you actually do for a living, and what it pays.
//
// Three paths, each with its own identity you name yourself, its own follow-up
// questions and its own way of making money:
//   football  — a real club, paid that club's average wage
//   music     — an artist name, and songs that go viral, do fine, or die
//   business  — a name and a product, and income that is genuinely a gamble

import { ALL_CLUBS, DIVISIONS, DIVISION_DIFFICULTY, clubById } from './clubs.js';

export const PATHS = {
  football: { id: 'football', name: 'Football', scene: 'pitch' },
  music: { id: 'music', name: 'Music', scene: 'studio' },
  business: { id: 'business', name: 'Business', scene: 'office' },
};

// You can genuinely be doing more than one of these — the fork at sixteen lets
// you pick two, and this character is built to stack them. Every active path
// gets its own identity, its own questions and its own pay.
export function activePaths(state) {
  const out = [];
  if (state.flags.path_football || state.flags.bet_football) out.push('football');
  if (state.flags.path_music || state.flags.bet_music) out.push('music');
  if (state.flags.path_business || state.flags.bet_business) out.push('business');
  return out;
}

export function pathOf(state) {
  return activePaths(state)[0] || null;
}

const money = (n) => `£${Math.round(n).toLocaleString('en-GB')}`;

// ---------------------------------------------------------------------------
// Setting the path up: the questions that ask who you actually are
// ---------------------------------------------------------------------------

export function setupQuestion(state, rng) {
  const paths = activePaths(state);
  const c = state.career;

  if (paths.includes('football') && !c.club) {
    return {
      id: 'career_club', scene: 'pitch', kind: 'pick',
      intro: 'The paperwork is real. Ninety-two clubs play league football in England and one of them is about to be yours.',
      prompt: 'Who do you sign for?',
      groups: DIVISIONS.map((div) => ({
        name: div.name,
        items: div.clubs.map((club) => ({
          id: club.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          name: club.name,
          meta: `${money(club.wage)}/wk`,
        })),
      })),
      onPick: (s, itemId) => {
        const club = clubById(itemId);
        if (!club) return null;
        s.career.club = club;
        s.career.seasons = 0;
        const hard = DIVISION_DIFFICULTY[club.division];
        const gap = hard - s.stats.ATH;
        return {
          fx: gap > 20 ? { ATH: 6, SMR: 5, HAP: -3 } : { ATH: 8, CHA: 4, HAP: 5 },
          xp: 220,
          flag: 'signed_pro',
          result: gap > 20
            ? `You sign for ${club.name}. On the training ground it is instantly obvious you are the weakest one there, and that is exactly the education you needed.`
            : `You sign for ${club.name}, ${club.divisionName}. ${money(club.wage)} a week, and the first time you see your name on a squad list you have to sit down.`,
        };
      },
    };
  }

  if (paths.includes('music') && !c.artist) {
    return {
      id: 'career_artist', scene: 'studio', kind: 'text',
      intro: 'Everything from here goes out under one name. Choose it carefully — it is going on every release you ever make.',
      prompt: 'What do you call yourself?',
      fields: [{ key: 'artist', label: 'Artist name', placeholder: 'the name on the poster', maxLength: 28 }],
      onSubmit: (s, values) => {
        s.career.artist = values.artist;
        return {
          fx: { MUS: 8, CRE: 7, CHA: 5 }, xp: 220, fame: 6, flag: 'named_artist',
          result: `${values.artist}. You write it out about forty times to see how it looks, and then you stop being someone who makes music and start being an artist with a name.`,
        };
      },
    };
  }

  if (paths.includes('business') && !c.business) {
    return {
      id: 'career_business', scene: 'office', kind: 'text',
      intro: 'A name, and a thing to sell. Everything else is detail.',
      prompt: 'What are you building, and what does it sell?',
      fields: [
        { key: 'name', label: 'Business name', placeholder: 'what it is called', maxLength: 28 },
        { key: 'product', label: 'What it sells', placeholder: 'trainers, software, coffee…', maxLength: 40 },
      ],
      onSubmit: (s, values) => {
        s.career.business = { name: values.name, product: values.product };
        return {
          fx: { BIZ: 10, CRE: 6, SMR: 4 }, xp: 220, flag: 'founded',
          count: { ventures: 1 },
          result: `${values.name}. You sell ${values.product}. It is registered, it has a bank account, and from today every pound it makes or loses is yours.`,
        };
      },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

const SONG_OUTCOMES = [
  {
    id: 'viral', label: 'goes properly viral',
    streams: [4000000, 60000000], fame: [30, 90], mult: [3.5, 9],
    line: (n, s) => `"${n}" gets away from you completely. ${s} streams. Your phone does not stop for a fortnight and people who ignored you for years suddenly remember your number.`,
  },
  {
    id: 'hit', label: 'does really well',
    streams: [400000, 4000000], fame: [10, 30], mult: [1.2, 3],
    line: (n, s) => `"${n}" does the thing you hoped for. ${s} streams, playlisted properly, and a couple of promoters get in touch off the back of it.`,
  },
  {
    id: 'normal', label: 'does fine',
    streams: [20000, 400000], fame: [2, 9], mult: [0.4, 1.1],
    line: (n, s) => `"${n}" does what most songs do. ${s} streams, the people who like you like it, and nothing changes overnight.`,
  },
  {
    id: 'flop', label: 'goes nowhere',
    streams: [400, 20000], fame: [0, 2], mult: [0.05, 0.3],
    line: (n, s) => `"${n}" lands with a thud. ${s} streams. You are fairly sure it is better than that and the numbers do not care what you think.`,
  },
];

// Talent and reputation move the odds; they never guarantee anything.
export function rollSong(state, rng, name) {
  const skill = (state.stats.MUS + state.stats.CRE * 0.5) / 150;
  const pull = Math.min(0.4, (state.fame || 0) / 320);
  const weights = {
    viral: 0.03 + skill * 0.07 + pull * 0.09,
    hit: 0.1 + skill * 0.22 + pull * 0.16,
    normal: 0.42,
    flop: 0.45 - skill * 0.22 - pull * 0.14,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  let picked = SONG_OUTCOMES[SONG_OUTCOMES.length - 1];
  for (const outcome of SONG_OUTCOMES) {
    roll -= weights[outcome.id];
    if (roll <= 0) { picked = outcome; break; }
  }

  const streams = Math.round(picked.streams[0] + rng() * (picked.streams[1] - picked.streams[0]));
  // Roughly what streaming actually pays, plus everything a song drags along
  // with it — shows, sync, merch.
  const earned = Math.round(streams * 0.0032 * (picked.mult[0] + rng() * (picked.mult[1] - picked.mult[0])));
  const fame = Math.round(picked.fame[0] + rng() * (picked.fame[1] - picked.fame[0]));

  return {
    id: picked.id,
    name,
    streams,
    money: earned,
    fame,
    label: picked.label,
    line: picked.line(name, streams.toLocaleString('en-GB')),
  };
}

export function songQuestion(state, rng) {
  const artist = state.career.artist || 'you';
  return {
    id: `career_song_${state.career.songs.length}`, scene: 'studio', kind: 'text',
    intro: `${artist} has studio time booked and nothing written yet.`,
    prompt: 'Name the track and put it out.',
    fields: [{ key: 'song', label: 'Track title', placeholder: 'what is it called?', maxLength: 40 }],
    onSubmit: (s, values, r) => {
      const roll = rollSong(s, r, values.song);
      s.career.songs.push({ name: roll.name, outcome: roll.id, streams: roll.streams, money: roll.money });
      return {
        fx: roll.id === 'viral' ? { MUS: 10, CHA: 9, HAP: 12 }
          : roll.id === 'hit' ? { MUS: 8, CHA: 5, HAP: 7 }
            : roll.id === 'normal' ? { MUS: 6, CRE: 4 }
              : { MUS: 5, SMR: 4, HAP: -4 },
        xp: roll.id === 'viral' ? 320 : roll.id === 'hit' ? 250 : 200,
        money: roll.money,
        fame: roll.fame,
        count: { tracks: 1 },
        secret: roll.id === 'viral' ? 'gone_viral' : null,
        result: roll.line,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// What a year of work pays
// ---------------------------------------------------------------------------

// Sums every path you are actually working, so stacking three careers pays
// like stacking three careers.
export function yearlyIncome(state, rng) {
  const paths = activePaths(state);
  if (!paths.length || state.age < 18) return null;
  const parts = [];
  let total = 0;
  for (const path of paths) {
    const one = incomeFor(state, rng, path);
    if (!one || !one.amount) continue;
    total += one.amount;
    parts.push(one.note);
  }
  if (!parts.length) return null;
  return { amount: total, note: parts.join(' ') };
}

function incomeFor(state, rng, path) {
  const c = state.career;

  if (path === 'football' && c.club) {
    const retired = state.age > (c.retireAge || 35);
    if (retired) {
      const after = Math.round((c.club.wage * 52) * 0.06 * (0.6 + rng() * 0.9));
      return { amount: after, note: `Coaching and media work after ${c.club.name}.` };
    }
    // Appearances depend on how you compare to the level you play at.
    const level = DIVISION_DIFFICULTY[c.club.division] || 60;
    const edge = (state.stats.ATH - level) / 40;
    const share = Math.max(0.35, Math.min(1.15, 0.75 + edge + (rng() - 0.5) * 0.25));
    const amount = Math.round(c.club.wage * 52 * share);
    const pct = Math.round(Math.min(1, share) * 100);
    return {
      amount,
      note: share > 1
        ? `${c.club.name} — ${money(c.club.wage)} a week, a full season plus bonuses.`
        : `${c.club.name} — ${money(c.club.wage)} a week, ${pct}% of a full season.`,
    };
  }

  if (path === 'music' && c.artist) {
    const base = Math.round((state.stats.MUS * 45 + (state.fame || 0) * 260) * (0.5 + rng()));
    const back = c.songs.reduce((n, s) => n + s.money, 0);
    const royalties = Math.round(back * 0.06 * rng());
    return {
      amount: base + royalties,
      note: royalties > 0
        ? `Shows and royalties, including ${money(royalties)} from the back catalogue.`
        : 'Shows, session work and whatever the small rooms pay.',
    };
  }

  if (path === 'business' && c.business) {
    // Absolutely random, as asked. Skill nudges the ceiling; it does not
    // protect the floor, so a bad year is a genuinely bad year.
    const scale = 4000 + state.stats.BIZ * 900 + Math.max(0, state.age - 18) * 700;
    const swing = rng();
    let factor;
    if (swing < 0.16) factor = -(0.3 + rng() * 1.4);
    else if (swing < 0.55) factor = 0.1 + rng() * 0.9;
    else if (swing < 0.88) factor = 1 + rng() * 3.5;
    else factor = 4 + rng() * 22;
    const amount = Math.round(scale * factor);
    return {
      amount,
      note: amount < 0
        ? `${c.business.name} has a bad year. ${c.business.product} does not move.`
        : factor > 4
          ? `${c.business.name} has the year everyone hopes for. ${c.business.product}, everywhere.`
          : `${c.business.name} trades on. ${c.business.product} pays its way.`,
    };
  }

  return null;
}

// Football careers end, and the game should say so rather than paying you a
// striker's wage at seventy.
export function checkRetirement(state, rng) {
  const c = state.career;
  if (!activePaths(state).includes('football') || !c.club || c.retireAge) return null;
  if (state.age < 30) return null;
  const decline = state.age - 30 + Math.max(0, (DIVISION_DIFFICULTY[c.club.division] - state.stats.ATH) / 8);
  if (state.age >= 38 || rng() * 14 < decline) {
    c.retireAge = state.age;
    return `You play your last game for ${c.club.name} at ${state.age}. Somebody hands you a shirt in a frame and you are, suddenly, a former footballer.`;
  }
  return null;
}
