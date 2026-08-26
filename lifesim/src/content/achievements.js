// Achievements. Normal ones are visible from the start and tell you what to
// chase. Secret ones only ever appear once you have already done the thing.
//
// Every achievement carries a perk:
//   xp        multiplier on all future XP
//   money     multiplier on all future earnings
//   stat      per-stat multiplier on future gains
//   talent    permanent additive boost to a talent multiplier
//   note      what the perk actually does, in words

const A = (id, name, desc, perk, test, secret = false) =>
  ({ id, name, desc, perk, test, secret });

export const ACHIEVEMENTS = [
  // ------------------------------------------------------------ NORMAL
  A('first_steps', 'First Steps', 'Take your first decision.',
    { xp: 1.02, note: '+2% XP forever' },
    (s) => s.decisions >= 1),
  A('the_ear', 'The Ear', 'Get rap or rock into your bones before you can walk.',
    { talent: { MUS: 0.15 }, note: 'Music talent +0.15' },
    (s) => s.flags.music_rock || s.flags.music_rap || s.flags.music_hiphop),
  A('best_in_the_hall', 'Best in the Hall', 'Be the standout at Little Kickers.',
    { talent: { ATH: 0.1 }, note: 'Athleticism talent +0.10' },
    (s) => s.flags.kickers_star || s.flags.kickers_captain),
  A('first_deal', 'First Deal', 'Trade something before you are four.',
    { talent: { BIZ: 0.2 }, note: 'Business talent +0.20' },
    (s) => (s.counters.deals || 0) >= 1),
  A('big_brother', 'Big Brother', 'Be there for Elowen from day one.',
    { stat: { HAP: 1.1 }, note: 'Happiness gains +10%' },
    (s) => (s.relationships.elowen ?? 0) >= 60),
  A('sharks_kid', 'Sharks Kid', 'Pull on the Shillington Sharks shirt.',
    { stat: { ATH: 1.06 }, note: 'Athleticism gains +6%' },
    (s) => (s.counters.sharks_years || 0) >= 1),
  A('in_the_pool', 'In the Pool', 'Start seven years of swimming.',
    { stat: { HLT: 1.1 }, note: 'Health gains +10%' },
    (s) => (s.counters.swim_years || 0) >= 1),
  A('the_plumber', 'The Plumber', 'Take delivery of three foot six of Mario.',
    { stat: { CRE: 1.08 }, note: 'Creativity gains +8%' },
    (s) => s.flags.mario_friend || s.flags.mario_teammate || s.flags.mario_audience),
  A('trouble', 'Trouble', 'Rack up five separate incidents.',
    { stat: { NAU: 1.15, CHA: 1.05 }, note: 'Naughtiness +15%, Charisma +5%' },
    (s) => (s.counters.trouble || 0) >= 5),
  A('block_by_block', 'Block by Block', 'Build your first thing in Scratch.',
    { talent: { COD: 0.2 }, note: 'Code talent +0.20' },
    (s) => (s.counters.scratch_projects || 0) >= 1),
  A('scratch_master', 'Scratch Master', 'Ship six Scratch projects.',
    { stat: { COD: 1.2, CRE: 1.1 }, note: 'Code +20%, Creativity +10%' },
    (s) => (s.counters.scratch_projects || 0) >= 6),
  A('the_crew', 'The Crew', 'Meet all seven of them.',
    { xp: 1.06, note: '+6% XP forever' },
    (s) => s.age >= 10 && Object.keys(s.relationships).length >= 7),
  A('goalscorer', 'Goalscorer', 'Score twenty-five in your career.',
    { stat: { ATH: 1.12 }, note: 'Athleticism gains +12%' },
    (s) => (s.counters.goals || 0) >= 25),
  A('hat_full', 'Full Boots', 'Score sixty.',
    { stat: { ATH: 1.2, CHA: 1.05 }, note: 'Athleticism +20%, Charisma +5%' },
    (s) => (s.counters.goals || 0) >= 60),
  A('knight', 'Knight', 'Sign for Baldock Knights.',
    { xp: 1.05, note: '+5% XP forever' },
    (s) => !!s.flags.knights_signed),
  A('on_the_mic', 'On the Mic', 'Play your first gig.',
    { stat: { MUS: 1.1, CHA: 1.08 }, note: 'Music +10%, Charisma +8%' },
    (s) => (s.counters.gigs || 0) >= 1),
  A('recording_artist', 'Recording Artist', 'Put out five tracks.',
    { stat: { MUS: 1.15 }, money: 1.05, note: 'Music +15%, earnings +5%' },
    (s) => (s.counters.tracks || 0) >= 5),
  A('the_catalogue', 'The Catalogue', 'Put out twenty tracks.',
    { stat: { MUS: 1.25, CRE: 1.1 }, money: 1.1, note: 'Music +25%, Creativity +10%, earnings +10%' },
    (s) => (s.counters.tracks || 0) >= 20),
  A('founder', 'Founder', 'Start three ventures.',
    { talent: { BIZ: 0.15 }, note: 'Business talent +0.15' },
    (s) => (s.counters.ventures || 0) >= 3),
  A('serial', 'Serial', 'Start ten ventures.',
    { stat: { BIZ: 1.2 }, money: 1.15, note: 'Business +20%, earnings +15%' },
    (s) => (s.counters.ventures || 0) >= 10),
  A('first_thousand', 'First Thousand', 'Bank £1,000.',
    { money: 1.08, note: 'Earnings +8%' },
    (s) => s.money >= 1000),
  A('six_figures', 'Six Figures', 'Bank £100,000.',
    { money: 1.15, stat: { BIZ: 1.1 }, note: 'Earnings +15%, Business +10%' },
    (s) => s.money >= 100000),
  A('seven_figures', 'Seven Figures', 'Bank £1,000,000.',
    { money: 1.25, xp: 1.1, note: 'Earnings +25%, XP +10%' },
    (s) => s.money >= 1000000),
  A('known', 'Known', 'Reach 50 fame.',
    { stat: { CHA: 1.12 }, note: 'Charisma gains +12%' },
    (s) => s.fame >= 50),
  A('household_name', 'Household Name', 'Reach 150 fame.',
    { stat: { CHA: 1.2, MUS: 1.1 }, money: 1.1, note: 'Charisma +20%, Music +10%, earnings +10%' },
    (s) => s.fame >= 150),
  A('all_rounder', 'All-Rounder', 'Get four different stats past 70.',
    { xp: 1.1, note: '+10% XP forever' },
    (s) => ['ATH', 'BIZ', 'CRE', 'MUS', 'COD', 'SMR', 'CHA'].filter((k) => s.stats[k] >= 70).length >= 4),
  A('the_triple', 'The Triple', 'Athleticism, Business and Music all past 80.',
    { xp: 1.15, money: 1.1, note: '+15% XP, +10% earnings' },
    (s) => s.stats.ATH >= 80 && s.stats.BIZ >= 80 && s.stats.MUS >= 80),
  A('maxed', 'Maxed', 'Take any stat to 100.',
    { xp: 1.12, note: '+12% XP forever' },
    (s) => Object.values(s.stats).some((v) => v >= 100)),
  A('level_ten', 'Level Ten', 'Reach level 10.',
    { xp: 1.05, note: '+5% XP forever' },
    (s) => s.level >= 10),
  A('level_twentyfive', 'Level Twenty-Five', 'Reach level 25.',
    { xp: 1.08, money: 1.05, note: '+8% XP, +5% earnings' },
    (s) => s.level >= 25),
  A('level_fifty', 'Level Fifty', 'Reach level 50.',
    { xp: 1.12, money: 1.1, note: '+12% XP, +10% earnings' },
    (s) => s.level >= 50),
  A('half_century', 'Half a Century', 'Reach fifty years old.',
    { stat: { HLT: 1.1, SMR: 1.1 }, note: 'Health +10%, Smarts +10%' },
    (s) => s.age >= 50),
  A('the_ton', 'The Ton', 'Reach one hundred years old.',
    { xp: 1.2, stat: { HAP: 1.2 }, note: '+20% XP, Happiness +20%' },
    (s) => s.age >= 100),
  A('challenger', 'Challenger', 'Take on five random challenges.',
    { xp: 1.06, stat: { NAU: 1.1 }, note: '+6% XP, Naughtiness +10%' },
    (s) => (s.counters.challenges || 0) >= 5),
  A('improviser', 'Improviser', 'Write your own answer ten times.',
    { xp: 1.1, stat: { CRE: 1.15 }, note: '+10% XP, Creativity +15%' },
    (s) => (s.counters.custom || 0) >= 10),
  A('deal_maker', 'Deal Maker', 'Do twenty-five deals.',
    { money: 1.12, stat: { BIZ: 1.1 }, note: 'Earnings +12%, Business +10%' },
    (s) => (s.counters.deals || 0) >= 25),
  A('good_friend', 'Good Friend', 'Get any friendship to 90.',
    { stat: { HAP: 1.12, CHA: 1.08 }, note: 'Happiness +12%, Charisma +8%' },
    (s) => Object.values(s.relationships).some((v) => v >= 90)),
  A('the_seven_strong', 'Seven Strong', 'Keep every one of the seven above 70.',
    { xp: 1.12, stat: { HAP: 1.15 }, note: '+12% XP, Happiness +15%' },
    (s) => ['boyd', 'ollie_b', 'ollie_c', 'jack', 'forrest', 'ollie_hen', 'oscar']
      .every((id) => (s.relationships[id] ?? 0) >= 70)),
  A('happy_life', 'Happy Life', 'Hold Happiness above 90 at fifty.',
    { xp: 1.1, stat: { HLT: 1.1 }, note: '+10% XP, Health +10%' },
    (s) => s.age >= 50 && s.stats.HAP >= 90),

  A('self_made', 'Self-Made', 'Start poor or worse and bank £1,000,000.',
    { money: 1.2, xp: 1.12, note: 'Earnings +20%, XP +12%' },
    (s) => (s.wealthRank ?? 3) <= 1 && s.money >= 1000000),
  A('out_earned', 'Out-Earned Them', 'Start rich or better and make ten times what you were handed.',
    { money: 1.15, stat: { BIZ: 1.12 }, note: 'Earnings +15%, Business +12%' },
    (s) => (s.wealthRank ?? 3) >= 5 && s.startMoney > 0 && s.money >= s.startMoney * 10),

  // ------------------------------------------------------------ SECRET
  A('mario_goodbye', 'See You Later', 'Say goodbye to a soft toy and mean it.',
    { stat: { CRE: 1.12, HAP: 1.08 }, note: 'Creativity +12%, Happiness +8%' }, null, true),
  A('mario_reunion', 'The Loft', 'Find him again after four years.',
    { xp: 1.12, stat: { HAP: 1.15, CRE: 1.1 }, note: '+12% XP, Happiness +15%, Creativity +10%' }, null, true),
  A('still_here', 'Still Here', 'Never let him go up in the loft again.',
    { stat: { HAP: 1.2 }, note: 'Happiness gains +20%' }, null, true),
  A('passed_on', 'Passed On', 'Hand him to somebody who needs him more.',
    { stat: { HAP: 1.15, CHA: 1.1 }, note: 'Happiness +15%, Charisma +10%' }, null, true),
  A('restored', 'Restored', 'Bring him back to how he was.',
    { stat: { HAP: 1.18, CRE: 1.1 }, note: 'Happiness +18%, Creativity +10%' }, null, true),
  A('room_next_door', 'The Room Next Door', 'Find out about Oscar.',
    { xp: 1.1, stat: { CHA: 1.12 }, note: '+10% XP, Charisma +12%' }, null, true),
  A('the_core', 'The Core', 'Choose the seven over the three hundred.',
    { stat: { HAP: 1.15, CHA: 1.1 }, note: 'Happiness +15%, Charisma +10%' }, null, true),
  A('the_glue', 'The Glue', 'Be the reason the group survives.',
    { xp: 1.12, stat: { CHA: 1.18 }, note: '+12% XP, Charisma +18%' }, null, true),
  A('the_promise', 'The Promise', 'Decide, at twelve, to build one that does not fold.',
    { talent: { BIZ: 0.25 }, note: 'Business talent +0.25' }, null, true),
  A('the_promise_kept', 'Kept It', 'Actually buy the club.',
    { xp: 1.2, money: 1.1, stat: { HAP: 1.2 }, note: '+20% XP, +10% earnings, Happiness +20%' }, null, true),
  A('never_folds', 'Never Folds', 'Try to save a dying club at ten years old.',
    { stat: { CHA: 1.12, BIZ: 1.08 }, note: 'Charisma +12%, Business +8%' }, null, true),
  A('one_season_legend', 'One Season', 'Be the best player a club ever had, right before it dies.',
    { stat: { ATH: 1.18 }, note: 'Athleticism gains +18%' }, null, true),
  A('no_fuss', 'No Fuss', 'Be the best on the pitch without telling anyone.',
    { stat: { ATH: 1.12, SMR: 1.08 }, note: 'Athleticism +12%, Smarts +8%' }, null, true),
  A('double_threat', 'Double Threat', 'Rap it and sing it on the same first record.',
    { stat: { MUS: 1.2, CRE: 1.1 }, note: 'Music +20%, Creativity +10%' }, null, true),
  A('off_the_top', 'Off the Top', 'Freestyle a room and get away with it.',
    { stat: { MUS: 1.15, CHA: 1.15 }, note: 'Music +15%, Charisma +15%' }, null, true),
  A('mic_skills', 'Mic Skills', 'Learn to talk from watching wrestling.',
    { stat: { CHA: 1.15 }, note: 'Charisma gains +15%' }, null, true),
  A('own_the_masters', 'Own the Masters', 'Turn down a real deal to keep your own work.',
    { money: 1.2, stat: { BIZ: 1.1 }, note: 'Earnings +20%, Business +10%' }, null, true),
  A('read_the_contract', 'Read the Contract', 'Redline a record deal at seventeen.',
    { money: 1.15, stat: { SMR: 1.15, BIZ: 1.1 }, note: 'Earnings +15%, Smarts +15%, Business +10%' }, null, true),
  A('first_paid_code', 'Paid in Pounds', 'Get paid for software before you are nine.',
    { talent: { COD: 0.25 }, money: 1.05, note: 'Code talent +0.25, earnings +5%' }, null, true),
  A('first_flip', 'The First Flip', 'Buy low and sell high on something with wheels.',
    { money: 1.12, note: 'Earnings +12%' }, null, true),
  A('the_trade', 'The Trade', 'Turn cars into a business at seventeen.',
    { money: 1.18, stat: { BIZ: 1.12 }, note: 'Earnings +18%, Business +12%' }, null, true),
  A('operator', 'Operator', 'Run your own life like a business.',
    { xp: 1.15, stat: { SMR: 1.15 }, note: '+15% XP, Smarts +15%' }, null, true),
  A('wont_be_one_thing', 'Will Not Be One Thing', 'Refuse to narrow down when everyone tells you to.',
    { xp: 1.15, stat: { CRE: 1.12, BIZ: 1.08 }, note: '+15% XP, Creativity +12%, Business +8%' }, null, true),
  A('the_one_who_said_no', 'The One Who Said No', 'Be the naughtiest one and still take the keys.',
    { stat: { SMR: 1.15, CHA: 1.12 }, note: 'Smarts +15%, Charisma +12%' }, null, true),
  A('always_an_exit', 'Always an Exit', 'Find the way out before you go in.',
    { stat: { SMR: 1.15, NAU: 1.1 }, note: 'Smarts +15%, Naughtiness +10%' }, null, true),
  A('quiet_promise', 'The Quiet Promise', 'Promise something nobody heard you promise.',
    { stat: { HAP: 1.12, CHA: 1.1 }, note: 'Happiness +12%, Charisma +10%' }, null, true),
  A('first_exit', 'Cashed Out', 'Sell your first business.',
    { money: 1.2, note: 'Earnings +20%' }, null, true),
  A('the_exit', 'The Big One', 'Sell the whole thing.',
    { money: 1.25, xp: 1.1, note: 'Earnings +25%, XP +10%' }, null, true),
  A('never_mentioned_it', 'Never Mentioned It', 'Bail a friend out and refuse to discuss it.',
    { stat: { HAP: 1.15, CHA: 1.15 }, note: 'Happiness +15%, Charisma +15%' }, null, true),
  A('showed_up', 'Showed Up', 'Cancel everything for someone who needed you.',
    { xp: 1.15, stat: { HAP: 1.12 }, note: '+15% XP, Happiness +12%' }, null, true),
  A('the_archive', 'The Archive', 'Record the voices before they go.',
    { xp: 1.12, stat: { CRE: 1.15 }, note: '+12% XP, Creativity +15%' }, null, true),
  A('quiet_giver', 'Quiet Giver', 'Give a lot away and let nobody know.',
    { xp: 1.15, stat: { HAP: 1.18 }, note: '+15% XP, Happiness +18%' }, null, true),
  A('gave_it_to_them', 'Gave It to Them', 'Sell the company to the people who built it.',
    { xp: 1.18, stat: { HAP: 1.2, CHA: 1.12 }, note: '+18% XP, Happiness +20%, Charisma +12%' }, null, true),
  A('had_it_both_ways', 'Both Ways', 'Refuse to choose between the work and the life.',
    { xp: 1.15, stat: { HAP: 1.15, BIZ: 1.08 }, note: '+15% XP, Happiness +15%, Business +8%' }, null, true),
  A('straight_bat', 'Straight Bat', 'Give up an unfair advantage on purpose.',
    { stat: { SMR: 1.12, CHA: 1.15 }, note: 'Smarts +12%, Charisma +15%' }, null, true),
  A('no_guru', 'No Guru', 'Refuse to sell the story of how you did it.',
    { stat: { SMR: 1.15, HAP: 1.1 }, note: 'Smarts +15%, Happiness +10%' }, null, true),
  A('full_circle', 'Full Circle', 'Put the speakers on for the next one.',
    { xp: 1.2, stat: { HAP: 1.2, MUS: 1.1 }, note: '+20% XP, Happiness +20%, Music +10%' }, null, true),
  A('the_trip', 'The Trip', 'Take all of them away and never mention the bill.',
    { stat: { HAP: 1.18, CHA: 1.12 }, note: 'Happiness +18%, Charisma +12%' }, null, true),
  A('finally_did_it', 'Finally Did It', 'Do the mad thing forty years late.',
    { stat: { HAP: 1.2, NAU: 1.15 }, note: 'Happiness +20%, Naughtiness +15%' }, null, true),
  A('went_back', 'Went Back', 'Walk Shillington one more time.',
    { xp: 1.15, stat: { HAP: 1.15 }, note: '+15% XP, Happiness +15%' }, null, true),
  A('told_the_truth', 'Told the Truth', 'Include the bad bits when you tell it.',
    { xp: 1.15, stat: { SMR: 1.15 }, note: '+15% XP, Smarts +15%' }, null, true),
  A('still_listening', 'Still Listening', 'Be more interested in their story than yours.',
    { xp: 1.18, stat: { CHA: 1.18, HAP: 1.1 }, note: '+18% XP, Charisma +18%, Happiness +10%' }, null, true),
  A('never_stopped_singing', 'Never Stopped', 'Still singing in front of people at ninety.',
    { xp: 1.2, stat: { MUS: 1.2, HAP: 1.15 }, note: '+20% XP, Music +20%, Happiness +15%' }, null, true),
  A('the_full_life', 'The Full Life', 'Reach 110 with Happiness above 80.',
    { xp: 1.5, note: 'The last one. +50% XP, for whatever good it does you now.' },
    (s) => s.age >= 110 && s.stats.HAP >= 80, true),
];

export const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// Aggregate every earned perk into one set of multipliers.
export function perkBundle(state) {
  const out = { xp: 1, money: 1, stat: {}, talent: {} };
  for (const id of state.achievements) {
    const a = BY_ID[id];
    if (!a || !a.perk) continue;
    if (a.perk.xp) out.xp *= a.perk.xp;
    if (a.perk.money) out.money *= a.perk.money;
    for (const [k, v] of Object.entries(a.perk.stat || {})) out.stat[k] = (out.stat[k] || 1) * v;
    for (const [k, v] of Object.entries(a.perk.talent || {})) out.talent[k] = (out.talent[k] || 0) + v;
  }
  return out;
}

// Condition-based achievements only. Option-triggered secrets are awarded
// directly by the engine via the option's `secret` field.
export function checkAchievements(state) {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (!a.test) continue;
    if (state.achievements.includes(a.id)) continue;
    let ok = false;
    try { ok = !!a.test(state); } catch (err) { ok = false; }
    if (ok) { state.achievements.push(a.id); earned.push(a); }
  }
  return earned;
}

export function awardSecret(state, id) {
  if (!id || state.achievements.includes(id)) return null;
  const a = BY_ID[id];
  if (!a) return null;
  state.achievements.push(id);
  return a;
}
