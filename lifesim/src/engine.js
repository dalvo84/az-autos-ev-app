// The year loop. Three questions a year, one at a time, ages 0 to 110.

import { makeRng } from './rng.js';
import {
  MAX_AGE, QUESTIONS_PER_YEAR, stageAt, placeAt, schoolAt, clubsAt,
  headlineFor, yearOf,
} from './content/timeline.js';
import { EARLY } from './content/story_early.js';
import { TEEN } from './content/story_teen.js';
import { poolFor, careerPool, CHALLENGES } from './content/pools.js';
import { checkAchievements, awardSecret, perkBundle } from './content/achievements.js';
import { wealthTier } from './content/wealth.js';
import {
  activePaths, setupQuestion, songQuestion, yearlyIncome, checkRetirement,
} from './content/career.js';
import { friendsMetAt, familyArrivingAt, FRIENDS } from './content/people.js';
import {
  applyStat, addXp, bump, logEvent, nudgeRelationship, save, statMeta,
} from './state.js';
import { scoreCustom } from './custom.js';

const SCRIPTED = [...EARLY, ...TEEN];
const SCRIPTED_BY_AGE = SCRIPTED.reduce((acc, q) => {
  (acc[q.age] = acc[q.age] || []).push(q);
  return acc;
}, {});

export class Engine {
  constructor(state) {
    this.state = state;
    this.current = null;
  }

  rngFor(tag) {
    return makeRng(`${this.state.seed}:${this.state.age}:${this.state.qIndex}:${tag}`);
  }

  context() {
    const s = this.state;
    return {
      age: s.age,
      year: yearOf(s.age),
      stage: stageAt(s.age),
      place: placeAt(s.age),
      school: schoolAt(s.age),
      clubs: clubsAt(s.age),
      headline: headlineFor(s.age),
      level: s.decisions + 1,
    };
  }

  // Called once when a new year starts, before its first question.
  openYear() {
    const s = this.state;
    const arrivals = [];

    for (const f of friendsMetAt(s.age)) {
      if (s.relationships[f.id] === undefined) {
        s.relationships[f.id] = 55;
        arrivals.push({ kind: 'friend', person: f });
      }
    }
    for (const p of familyArrivingAt(s.age)) {
      if (s.relationships[p.id] === undefined) {
        s.relationships[p.id] = 65;
        arrivals.push({ kind: 'family', person: p });
      }
    }

    const head = headlineFor(s.age);
    if (head) logEvent(s, head, 'headline');
    if (s.age === 0) logEvent(s, wealthTier(s.wealth).headline, 'headline');

    // A year of work pays out before you make this year's decisions.
    const yearRng = makeRng(`${s.seed}:${s.age}:income`);
    const retired = checkRetirement(s, yearRng);
    if (retired) logEvent(s, retired, 'headline');
    const earned = yearlyIncome(s, yearRng);
    if (earned && earned.amount) {
      s.money = Math.round(s.money + earned.amount);
      s.income.push({ age: s.age, amount: earned.amount, note: earned.note });
      if (s.income.length > 140) s.income.shift();
      const sign = earned.amount < 0 ? '' : '+';
      logEvent(s, `${earned.note} ${sign}${formatMoney(earned.amount)} this year.`, 'income');
      arrivals.push({ kind: 'income', amount: earned.amount, note: earned.note });
    }

    // Ageing: the body starts asking questions after fifty-five. Habits you
    // built earlier genuinely slow it down.
    if (s.age >= 55) {
      let rate = 0.22 + (s.age - 55) * 0.035;
      if (s.flags.disciplined_elder || s.flags.long_game_health || s.flags.still_moving) rate *= 0.55;
      if (s.flags.pro_habits || s.flags.still_an_athlete || s.flags.veteran_athlete) rate *= 0.78;
      s.stats.HLT = Math.max(20, Math.round((s.stats.HLT - rate) * 10) / 10);
      if (s.age >= 68) {
        s.stats.ATH = Math.max(16, Math.round((s.stats.ATH - rate * 0.85) * 10) / 10);
      }
    }

    return arrivals;
  }

  // ------------------------------------------------------------- questions
  nextQuestion() {
    const s = this.state;
    if (s.finished || s.age > MAX_AGE) return null;
    if (this.current) return this.current;

    const rng = this.rngFor('pick');
    const scripted = (SCRIPTED_BY_AGE[s.age] || [])
      .filter((q) => !s.seenQuestions.includes(q.id))
      .filter((q) => !q.requires || safeTest(q.requires, s));

    let question = null;

    // Naming your club, your artist name or your business jumps the queue —
    // nothing else makes sense until the game knows who you are.
    const setup = setupQuestion(s, rng);
    if (setup) {
      this.current = setup;
      return this.current;
    }

    // Then the work itself. A release is an event, not a weekly chore: one a
    // year at most, and mostly in the years you are actually recording.
    const c = s.career;
    if (activePaths(s).includes('music') && c.artist
        && s.age >= 15 && s.age <= 62
        && s.age > (c.lastSongAge ?? -1)
        && rng() < 0.45) {
      c.lastSongAge = s.age;
      this.current = songQuestion(s, this.rngFor('song'));
      return this.current;
    }

    // A random challenge sometimes gatecrashes the year.
    const challengeChance = s.qIndex === 1 ? 0.22 : 0.1;
    if (s.age >= 4 && rng() < challengeChance) {
      question = this.fromPool(CHALLENGES, rng, 'challenge');
    } else if (scripted.length) {
      question = scripted[0];
    } else {
      // Once you have a career, its own questions sit alongside the life ones.
      const own = s.age >= 16
        ? activePaths(s).flatMap((path) => careerPool(path))
        : [];
      const pool = own.length && rng() < 0.5
        ? own
        : [...poolFor(stageAt(s.age).id), ...own];
      question = this.fromPool(pool, rng, 'pool');
    }

    this.current = normalise(question, s, this.rngFor('shuffle'));
    return this.current;
  }

  // Generates from a pool, preferring an entry that has not come up recently
  // so a fifteen-year life stage does not read like the same four questions.
  fromPool(pool, rng, tag) {
    const s = this.state;
    const recent = s.seenQuestions.slice(-14);
    let chosen = null;
    let anyAgeOk = null;
    const order = rng.shuffle(pool);
    for (const gen of order) {
      const candidate = gen(s, this.rngFor(tag));
      const okAge = (candidate.minAge === undefined || s.age >= candidate.minAge)
        && (candidate.maxAge === undefined || s.age <= candidate.maxAge);
      if (!okAge) continue;
      if (candidate.requires && !safeTest(candidate.requires, s)) continue;
      if (!anyAgeOk) anyAgeOk = candidate;
      if (!recent.includes(baseId(candidate.id))) { chosen = candidate; break; }
    }
    chosen = chosen || anyAgeOk;
    if (!chosen) {
      // Nothing in this pool suits the age — fall back to the life pool.
      const life = poolFor(stageAt(s.age).id);
      chosen = rng.pick(life)(s, this.rngFor(tag));
    }
    chosen.id = `${chosen.id}@${s.age}.${s.qIndex}`;
    return chosen;
  }

  // -------------------------------------------------------------- answering
  answer(choice) {
    const s = this.state;
    const q = this.current;
    if (!q) return null;

    const perks = perkBundle(s);
    const outcome = {
      level: s.decisions + 1,
      lines: [],
      statChanges: {},
      xp: 0,
      money: 0,
      levelUps: 0,
      achievements: [],
      custom: null,
    };

    const applyOne = (payload) => {
      for (const [k, v] of Object.entries(payload.fx || {})) {
        const delta = applyStat(s, k, v, perks.stat[k] || 1);
        if (delta) outcome.statChanges[k] = (outcome.statChanges[k] || 0) + delta;
      }
      if (payload.money) {
        // Family money makes every pound you touch go further.
        const wealth = s.wealthMoney || 1;
        const m = payload.money > 0
          ? Math.round(payload.money * perks.money * wealth)
          : Math.round(payload.money * Math.max(1, wealth * 0.6));
        s.money = Math.max(-50000, Math.round(s.money + m));
        outcome.money += m;
      }
      if (payload.fame) s.fame = Math.max(0, Math.round(s.fame + payload.fame));
      if (payload.flag) s.flags[payload.flag] = true;
      for (const [c, n] of Object.entries(payload.count || {})) bump(s, c, n);
      for (const [id, n] of Object.entries(payload.rel || {})) nudgeRelationship(s, id, n);
      if (payload.xp) outcome.xp += payload.xp;
      if (payload.result) outcome.lines.push(payload.result);
      if (payload.secret) {
        const a = awardSecret(s, payload.secret);
        if (a) outcome.achievements.push(a);
      }
    };

    if (choice.pick && q.onPick) {
      const payload = q.onPick(s, choice.pick, this.rngFor('pick'));
      if (payload) applyOne(payload);
      outcome.picked = choice.pick;
    } else if (choice.text && (q.onSubmit || q.onPick)) {
      const payload = q.onSubmit(s, choice.text, this.rngFor('text'));
      if (payload) applyOne(payload);
      outcome.typed = choice.text;
    } else if (choice.custom) {
      const scored = scoreCustom(choice.custom, s);
      if (scored) {
        applyOne(scored);
        bump(s, 'custom');
        outcome.custom = scored;
      }
    } else {
      for (const id of choice.optionIds || []) {
        const opt = q.options.find((o) => o.id === id);
        if (!opt) continue;
        // Picking two splits the benefit — you cannot have all of both.
        const share = (choice.optionIds.length > 1) ? 0.65 : 1;
        applyOne(scaleOption(opt, share));
      }
    }

    // Talent perks are permanent additions to the growth multipliers.
    for (const [k, v] of Object.entries(perks.talent)) {
      s.talent[k] = Math.max(s.talent[k] || 1, (statMeta(k)?.talent || 1) + v);
    }

    // Low health drags on everything you do.
    const healthFactor = s.stats.HLT < 30 ? 0.75 : s.stats.HLT < 55 ? 0.9 : 1;
    const gainedXp = Math.round(outcome.xp * perks.xp * healthFactor * (s.wealthXp || 1));
    outcome.xp = gainedXp;
    outcome.levelUps = addXp(s, gainedXp);

    s.decisions += 1;
    if (!choice.custom && choice.optionIds && choice.optionIds.length) {
      const chosen = q.options.filter((o) => choice.optionIds.includes(o.id));
      for (const opt of chosen) {
        s.history.push({ age: s.age, q: baseId(q.id), id: opt.id, label: opt.label });
      }
    } else if (choice.custom) {
      s.history.push({ age: s.age, q: baseId(q.id), id: 'own', label: choice.custom });
    }
    if (s.history.length > 200) s.history.splice(0, s.history.length - 200);
    s.seenQuestions.push(baseId(q.id));
    if (s.seenQuestions.length > 600) s.seenQuestions.splice(0, 200);

    for (const line of outcome.lines) logEvent(s, line, 'choice');
    if (outcome.custom) logEvent(s, outcome.custom.result, 'custom');

    outcome.achievements.push(...checkAchievements(s));

    this.current = null;
    s.qIndex += 1;
    save(s);
    return outcome;
  }

  yearComplete() {
    return this.state.qIndex >= QUESTIONS_PER_YEAR;
  }

  advanceYear() {
    const s = this.state;
    if (s.age >= MAX_AGE) {
      s.finished = true;
      s.obituary = buildObituary(s);
      save(s);
      return false;
    }
    s.age += 1;
    s.qIndex = 0;
    this.current = null;
    save(s);
    return true;
  }
}

// ---------------------------------------------------------------- helpers

function safeTest(fn, state) {
  try { return !!fn(state); } catch (err) { return false; }
}

function baseId(id) { return String(id).split('@')[0]; }

function formatMoney(n) {
  const v = Math.round(n);
  if (Math.abs(v) >= 1000000) return `£${(v / 1000000).toFixed(1)}m`;
  return `£${v.toLocaleString('en-GB')}`;
}

function scaleOption(opt, share) {
  if (share === 1) return opt;
  const out = { ...opt };
  out.fx = Object.fromEntries(Object.entries(opt.fx || {}).map(([k, v]) => [k, v * share]));
  out.xp = Math.round((opt.xp || 0) * share);
  if (opt.money) out.money = Math.round(opt.money * share);
  if (opt.fame) out.fame = Math.round(opt.fame * share);
  return out;
}

// Guarantees every question has exactly three written options plus the custom
// slot, and that the options are not always in the same order.
function normalise(q, state, rng) {
  if (!q.options) return { ...q, scene: q.scene || stageAt(state.age).theme };
  const copy = { ...q, options: rng.shuffle(q.options).slice(0, 3) };
  copy.scene = copy.scene || stageAt(state.age).theme;
  copy.multi = !!copy.multi;
  return copy;
}

function buildObituary(s) {
  const top = Object.entries(s.stats)
    .filter(([k]) => !['HLT', 'HAP', 'NAU'].includes(k))
    .sort((a, b) => b[1] - a[1])[0];
  const bits = [];
  bits.push(`110 years. ${s.decisions} decisions. Level ${s.level}.`);
  const tier = wealthTier(s.wealth);
  bits.push(`Started ${tier.short.toLowerCase()}.`);
  const c = s.career || {};
  if (c.club) bits.push(`Played for ${c.club.name}${c.retireAge ? `, retired at ${c.retireAge}` : ''}.`);
  if (c.artist) {
    const viral = c.songs.filter((x) => x.outcome === 'viral').length;
    bits.push(`Released ${c.songs.length} tracks as ${c.artist}${viral ? `, ${viral} of them enormous` : ''}.`);
  }
  if (c.business) bits.push(`Built ${c.business.name}, selling ${c.business.product}.`);
  if (s.money >= 1000000) bits.push(`Left £${Math.round(s.money).toLocaleString()} behind.`);
  if ((s.counters.goals || 0) > 40) bits.push(`${s.counters.goals} goals, most of them on pitches nobody filmed.`);
  if ((s.counters.tracks || 0) > 10) bits.push(`${s.counters.tracks} tracks, and the first one was recorded under a duvet.`);
  if ((s.counters.ventures || 0) > 5) bits.push(`${s.counters.ventures} things started from nothing.`);
  if (s.flags.owns_club) bits.push('Bought a football club so it would not fold, because two of them folded on him when he was small.');
  if (s.flags.mario_forever || s.flags.mario_moves_in) bits.push('Still had the Mario.');
  bits.push(`Best at: ${statMeta(top[0]).name.toLowerCase()}.`);
  bits.push(`Happiness at the end: ${Math.round(s.stats.HAP)}/100.`);
  const kept = FRIENDS.filter((f) => (s.relationships[f.id] ?? 0) >= 70).map((f) => f.name);
  if (kept.length) bits.push(`Still had ${kept.join(', ')}.`);
  return bits.join(' ');
}

export { buildObituary };
