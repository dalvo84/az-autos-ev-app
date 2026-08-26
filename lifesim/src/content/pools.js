// Procedural question pools. Each entry is a generator: given the state and a
// seeded RNG it returns a full question. That is what keeps ninety adult years
// from turning into the same three questions on a loop.

import { personById, FRIENDS } from './people.js';

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function livingFriends(state) {
  return FRIENDS.filter((f) => state.age >= f.met);
}

function aFriend(state, rng, personality) {
  let pool = livingFriends(state);
  if (personality) {
    const filtered = pool.filter((f) => f.personality.includes(personality));
    if (filtered.length) pool = filtered;
  }
  return pool.length ? pick(rng, pool) : personById('boyd');
}

// Money roughly tracks life stage so a £400 decision at 14 and a £400,000 one
// at 45 both feel like the same size of choice.
function scaleMoney(state, base) {
  const a = state.age;
  const mult = a < 18 ? 1 : a < 25 ? 8 : a < 40 ? 40 : a < 60 ? 90 : a < 80 ? 50 : 20;
  return Math.round(base * mult);
}

const q = (id, scene, prompt, options, extra = {}) => ({ id, scene, prompt, options, ...extra });

// ---------------------------------------------------------------------------
// LAUNCH — 18 to 24
// ---------------------------------------------------------------------------
const LAUNCH = [
  (s, r) => {
    const f = aFriend(s, r, 'naughty');
    return q('p_launch_partner', 'city',
      `${f.name} wants in on what you are building. He has no money and a lot of energy.`, [
        { id: 'in', label: `Bring ${f.name} in properly, with a real share`,
          fx: { CHA: 8, BIZ: 6, HAP: 6 }, xp: 200, rel: { [f.id]: 16 },
          result: `You give ${f.name} something real instead of a favour. He works harder than anyone you will ever hire.` },
        { id: 'job', label: 'Give him work, not equity',
          fx: { BIZ: 10, SMR: 7 }, xp: 200, rel: { [f.id]: 6 }, money: scaleMoney(s, -60),
          result: `Paid, valued, and not on the cap table. ${f.name} is fine with it. Your future self is extremely fine with it.` },
        { id: 'no', label: 'Keep friendship and business completely separate',
          fx: { SMR: 9, HAP: -3 }, xp: 200, rel: { [f.id]: -6 },
          result: 'A hard conversation in a pub car park. It stays a friendship, which was the point, but it is awkward for a month.' },
      ]);
  },
  (s, r) => q('p_launch_stage', 'stage',
    `A ${pick(r, ['festival side stage', 'sold-out room in Camden', 'support slot on a UK tour', 'late slot at a city club'])} is on offer, and it clashes with everything else.`, [
      { id: 'take', label: 'Take it. Rooms like that do not come round twice.',
        fx: { MUS: 12, CHA: 8, HAP: 7 }, xp: 210, fame: 10, count: { gigs: 1 },
        result: 'You move three things and cancel one. The room is worth all four.' },
      { id: 'record', label: 'Skip it and finish the record instead',
        fx: { MUS: 10, CRE: 11, SMR: 6 }, xp: 210, count: { tracks: 2 },
        result: 'Nobody claps for a finished mix at 4am. It is still the right call and the record is better for it.' },
      { id: 'own', label: 'Turn it down and put on your own night the same week',
        fx: { BIZ: 12, MUS: 8, CHA: 8 }, xp: 220, money: scaleMoney(s, 90), fame: 7, count: { gigs: 1, ventures: 1 },
        result: 'Your room, your door money, your rules. Smaller crowd, twice the profit, and you own the mailing list.' },
    ]),
  (s, r) => q('p_launch_body', 'pitch',
    'A knock that will not clear up. The physio uses the word "manage" rather than "fix".', [
      { id: 'rest', label: 'Rest it properly, however long that takes',
        fx: { HLT: 12, ATH: 4, HAP: -4 }, xp: 200,
        result: 'Eleven weeks out. You hate every day of it and you are still running at thirty-five because of it.' },
      { id: 'through', label: 'Play through it', fx: { ATH: 9, HLT: -12 }, xp: 200, count: { goals: 6 },
        result: 'Six goals and a joint that never quite forgives you. Worth it on the day, expensive by degrees.' },
      { id: 'adapt', label: 'Change how you play so the injury stops mattering',
        fx: { ATH: 7, SMR: 12, HLT: 5 }, xp: 215, flag: 'game_intelligence',
        result: 'You lose half a yard and gain about ten years, because you start playing with your head instead of your hamstrings.' },
    ]),
  (s, r) => q('p_launch_money', 'office',
    `£${scaleMoney(s, 500).toLocaleString()} sat in the account doing nothing.`, [
      { id: 'reinvest', label: 'Straight back into the business',
        fx: { BIZ: 12 }, xp: 205, money: -scaleMoney(s, 500), count: { ventures: 1 },
        result: 'Every penny back in. It is the least fun and most effective thing you can do with money at this age.' },
      { id: 'invest', label: 'Put it somewhere boring that compounds',
        fx: { SMR: 11, BIZ: 6 }, xp: 205, money: -scaleMoney(s, 400), flag: 'investing',
        result: 'Dull, automatic, untouched. In thirty years it is the reason you never have to take a bad deal.' },
      { id: 'spend', label: 'Spend it on something that makes life obviously better',
        fx: { HAP: 12, CHA: 6 }, xp: 200, money: -scaleMoney(s, 500),
        result: 'You are twenty-something with money for the first time. You enjoy it properly and you do not apologise for it.' },
    ]),
  (s, r) => {
    const f = aFriend(s, r, 'smart');
    return q('p_launch_advice', 'city',
      `${f.name} tells you, kindly and directly, that you are spreading yourself too thin.`, [
        { id: 'listen', label: 'Listen. He is usually right.', fx: { SMR: 12, HAP: 5 }, xp: 205, rel: { [f.id]: 10 },
          result: `You cut two things that week. ${f.name} does not mention it again, which is why you listen to him.` },
        { id: 'defend', label: 'Explain exactly why the spread is the strategy',
          fx: { BIZ: 9, CHA: 9 }, xp: 205, rel: { [f.id]: 4 },
          result: 'You lay out how each thing feeds the others. He is not fully convinced. He is a bit convinced.' },
        { id: 'prove', label: 'Say nothing and just go and prove it',
          fx: { BIZ: 8, ATH: 5, MUS: 5, NAU: 4 }, xp: 210, rel: { [f.id]: 6 },
          result: 'Six months later you send him one screenshot with no message. He replies with a single full stop.' },
      ]);
  },
  (s, r) => q('p_launch_home', 'home_modern',
    `Time to move out properly. ${pick(r, ['London', 'Cambridge', 'Manchester', 'Letchworth', 'St Albans'])} is on the table.`, [
      { id: 'city', label: 'Go where the work is, whatever it costs',
        fx: { BIZ: 10, CHA: 8, HAP: -3 }, xp: 205, money: -scaleMoney(s, 300), flag: 'moved_for_work',
        result: 'Smaller flat, bigger rooms to be in. The rent is offensive and the opportunity is not.' },
      { id: 'near', label: 'Stay near home. The network here is worth more than the postcode.',
        fx: { CHA: 9, HAP: 9, BIZ: 5 }, xp: 205, flag: 'stayed_local',
        result: 'Everyone said you had to leave. You did not leave, and the thing you build is more rooted than anything they built.' },
      { id: 'both', label: 'Base here, work there, live on the train',
        fx: { SMR: 8, BIZ: 8, HLT: -6 }, xp: 205,
        result: 'You get extremely good at working on a Thameslink service. It is not glamorous and it absolutely works.' },
    ]),
  (s, r) => q('p_launch_online', 'studio',
    `Something you put out does ${pick(r, ['400,000', '1.2 million', '90,000', '3 million'])} views overnight.`, [
      { id: 'ride', label: 'Ride it — post every day while the wave is up',
        fx: { CRE: 10, CHA: 9, HLT: -5 }, xp: 215, fame: 16, count: { tracks: 1 },
        result: 'Three weeks of relentless output. You gain an audience that is genuinely yours and you are absolutely wrecked.' },
      { id: 'convert', label: 'Convert it — get them off the platform and onto your list',
        fx: { BIZ: 13, SMR: 9 }, xp: 220, fame: 8, money: scaleMoney(s, 200),
        result: 'Views are rented, emails are owned. You take 9,000 of them with you and they are still there four platforms later.' },
      { id: 'ignore', label: 'Ignore it and keep making the thing properly',
        fx: { CRE: 12, MUS: 8, SMR: 6 }, xp: 210, fame: 4,
        result: 'The wave passes. The work does not. You are one of about four people who understood which of those two mattered.' },
    ]),
];

// ---------------------------------------------------------------------------
// BUILD — 25 to 39
// ---------------------------------------------------------------------------
const BUILD = [
  (s, r) => q('p_build_scale', 'office',
    `The business could double this year, but only if you ${pick(r, ['hire eleven people', 'take outside money', 'open a second site', 'sign one very large client'])}.`, [
      { id: 'go', label: 'Do it. Grow.', fx: { BIZ: 13, HLT: -6, CHA: 6 }, xp: 260,
        money: scaleMoney(s, 400), count: { ventures: 1 },
        result: 'Twice the revenue, four times the problems, and a version of you that is now a manager whether you like it or not.' },
      { id: 'hold', label: 'Stay small and keep all of it',
        fx: { BIZ: 9, HAP: 11, SMR: 8 }, xp: 260, money: scaleMoney(s, 220), flag: 'stayed_small',
        result: 'Less headline, more actual money, and you still know everybody\'s name. A lot of people never work out that this is an option.' },
      { id: 'spin', label: 'Spin the growth bit out as a separate thing',
        fx: { BIZ: 12, CRE: 10, SMR: 9 }, xp: 275, money: scaleMoney(s, 300), count: { ventures: 1 },
        result: 'Two entities, one brain. Risk is walled off and both halves move faster. Genuinely clever structuring.' },
    ]),
  (s, r) => q('p_build_offer', 'office',
    `Someone offers £${scaleMoney(s, 3000).toLocaleString()} for the whole thing.`, [
      { id: 'sell', label: 'Sell. Take the money.', fx: { BIZ: 10, HAP: 9, SMR: 7 }, xp: 280,
        money: scaleMoney(s, 3000), count: { exits: 1 }, flag: 'exited', secret: 'the_exit',
        result: 'You sign it on a Tuesday. It does not feel like the films. It feels quiet, and enormous, and slightly sad.' },
      { id: 'refuse', label: 'No. It is worth far more and you know it.',
        fx: { BIZ: 12, SMR: 10 }, xp: 280, flag: 'held_out',
        result: 'You turn down life-changing money because your own numbers say wait. That takes a nerve most people simply do not have.' },
      { id: 'part', label: 'Sell part of it and stay in charge',
        fx: { BIZ: 14, SMR: 11 }, xp: 290, money: scaleMoney(s, 1100), flag: 'part_sale',
        result: 'Money off the table, control still yours, and the pressure that was keeping you up at night is gone. Best of both, expertly done.' },
    ]),
  (s, r) => q('p_build_family', 'home_modern',
    pick(r, ['Kids are on the table.', 'A house with a garden and a proper spare room.', 'A conversation about what the next ten years look like.']), [
      { id: 'yes', label: 'Yes. Build the life as well as the business.',
        fx: { HAP: 15, HLT: 5, BIZ: -4 }, xp: 270, flag: 'family_life', count: { kids: 1 },
        result: 'The work slows down about eleven percent and the life gets about four hundred percent better. Straightforward trade.' },
      { id: 'later', label: 'Not yet. There is a window and it is open now.',
        fx: { BIZ: 12, MUS: 6, HAP: -6 }, xp: 265, flag: 'deferred_family',
        result: 'You are honest about it rather than vague, which is the only decent way to do it. It is still a cost and you feel it.' },
      { id: 'both', label: 'Both, and restructure the work so it is actually possible',
        fx: { BIZ: 8, SMR: 12, HAP: 11 }, xp: 285, flag: 'family_life', count: { kids: 1 }, secret: 'had_it_both_ways',
        result: 'You redesign the entire company around a school run. Everyone said it could not be done. It is done by March.' },
    ]),
  (s, r) => {
    const f = aFriend(s, r);
    return q('p_build_friend_trouble', 'town',
      `${f.name} is in real trouble — ${pick(r, ['money', 'his health', 'a marriage falling apart', 'a business going under'])}.`, [
        { id: 'money', label: 'Write the cheque and never mention it again',
          fx: { CHA: 8, HAP: 6 }, xp: 265, money: -scaleMoney(s, 400), rel: { [f.id]: 22 }, secret: 'never_mentioned_it',
          result: `You send it within the hour and refuse to discuss repayment, ever. ${f.name} tries to bring it up twice and you change the subject twice.` },
        { id: 'time', label: 'Give him time instead of money — turn up, weekly, for as long as it takes',
          fx: { CHA: 11, HAP: 8, BIZ: -4 }, xp: 275, rel: { [f.id]: 26 },
          result: 'Every Thursday for fourteen months. It is far more expensive than money and it is the thing that actually works.' },
        { id: 'fix', label: 'Roll your sleeves up and fix the underlying problem',
          fx: { BIZ: 10, SMR: 10, CHA: 7 }, xp: 275, rel: { [f.id]: 18 },
          result: `You go through it line by line with him. It takes a weekend and it takes ${f.name} about nine years to stop telling people about it.` },
      ]);
  },
  (s, r) => q('p_build_music_return', 'studio',
    'You have not properly written anything in a while. The itch is back.', [
      { id: 'album', label: 'Make the record you have been putting off',
        fx: { MUS: 14, CRE: 13, HAP: 8 }, xp: 285, count: { tracks: 8 }, fame: 12, flag: 'the_album',
        result: 'Eleven tracks made with no deadline and nobody to please. It is the best thing you have ever made and it takes two years.' },
      { id: 'others', label: 'Write for other people instead — you are better at it than they are',
        fx: { MUS: 11, BIZ: 11, CRE: 8 }, xp: 285, money: scaleMoney(s, 500), count: { tracks: 5 },
        result: 'Your name in small print on four things that go a very long way. The royalties arrive quietly for the next thirty years.' },
      { id: 'live', label: 'Skip recording — just play live, small rooms, no fuss',
        fx: { MUS: 10, CHA: 12, HAP: 12 }, xp: 280, count: { gigs: 4 }, fame: 5,
        result: 'Forty people, no phones, no plan. You remember exactly why you started doing this at three years old on a coffee table.' },
    ]),
  (s, r) => q('p_build_health', 'pitch',
    'Your thirties arrive and your body sends a memo about it.', [
      { id: 'train', label: 'Train seriously again. You were an athlete and you still are.',
        fx: { ATH: 12, HLT: 14, HAP: 7 }, xp: 270, flag: 'still_an_athlete',
        result: 'Back in proper shape inside five months. At a five-a-side game somebody twenty-two years old asks if you played professionally.' },
      { id: 'sunday', label: 'Sunday league with the lads and nothing more serious than that',
        fx: { ATH: 7, HLT: 8, HAP: 13, CHA: 8 }, xp: 270, count: { goals: 9 },
        result: 'Nine goals and a pub afterwards. Not a career. Comfortably the best four hours of every week.' },
      { id: 'coach', label: 'Coach instead — give it to the next lot',
        fx: { CHA: 12, SMR: 8, ATH: 4 }, xp: 275, flag: 'coaching', count: { ventures: 1 },
        result: 'An under-11s side on a Saturday morning in the rain. You are extremely good at it and it fills something the business never has.' },
    ]),
  (s, r) => q('p_build_risk', 'workshop',
    `A genuinely mad idea that will cost £${scaleMoney(s, 800).toLocaleString()} and might be enormous.`, [
      { id: 'yes', label: 'Fund it yourself and find out',
        fx: { BIZ: 12, CRE: 14, NAU: 6 }, xp: 285, money: -scaleMoney(s, 800), count: { ventures: 1 },
        result: 'You back your own instinct with your own money, which is the only bet you have never regretted taking.' },
      { id: 'test', label: 'Test it for a tenth of that first',
        fx: { SMR: 14, BIZ: 10 }, xp: 290, money: -scaleMoney(s, 80),
        result: 'Cheap, fast, and it tells you almost everything for almost nothing. This is why you are still solvent and half your peers are not.' },
      { id: 'partner', label: 'Find someone who has done it before and split it',
        fx: { CHA: 11, BIZ: 10, SMR: 7 }, xp: 285, money: -scaleMoney(s, 400), count: { ventures: 1 },
        result: 'Half the upside, a quarter of the risk, and about ten years of somebody else\'s scar tissue for free.' },
    ]),
  (s, r) => q('p_build_tech', 'workshop',
    `The whole thing runs on ${pick(r, ['a spreadsheet held together with tape', 'software somebody else owns', 'you, personally, answering messages'])}.`, [
      { id: 'build', label: 'Build the tool yourself — you have been coding since you were seven',
        fx: { COD: 14, BIZ: 9, SMR: 6 }, xp: 275, count: { scratch_projects: 2 },
        result: 'Six weeks of evenings and the thing that was eating your week is now a button. Nobody else in the industry has this.' },
      { id: 'buy', label: 'Pay for something proper and get on with the actual work',
        fx: { BIZ: 10, SMR: 9 }, xp: 270, money: -scaleMoney(s, 120),
        result: 'Not everything needs building from scratch. Knowing which things do is the skill.' },
      { id: 'sell', label: 'Build it, then sell it to everyone else with the same problem',
        fx: { COD: 12, BIZ: 14, CRE: 8 }, xp: 290, money: scaleMoney(s, 450), count: { ventures: 1 },
        result: 'You solve your own problem and then discover four hundred other people have it too. That is the whole of software, really.' },
    ]),
  (s, r) => q('p_build_club', 'stadium', 'Two clubs folded under you as a kid. There is a chance to do something about that.', [
      { id: 'buy', label: 'Buy a struggling local club and run it properly',
        fx: { BIZ: 12, CHA: 12, HAP: 12 }, xp: 300, money: -scaleMoney(s, 900),
        flag: 'owns_club', secret: 'the_promise_kept', count: { ventures: 1 },
        result: 'You made this decision at twelve in a car park in the rain. Two decades later you sign for a non-league club with a leaking roof and you keep it alive.' },
      { id: 'fund', label: 'Fund the youth setup instead — that is where it actually breaks',
        fx: { CHA: 11, SMR: 10, HAP: 10 }, xp: 295, money: -scaleMoney(s, 300), flag: 'funds_youth',
        result: 'Not your name on the stand. Four age groups that will still exist in fifteen years. You know which one matters.' },
      { id: 'pass', label: 'Leave it. It is a money pit and you know it.',
        fx: { SMR: 10, BIZ: 6, HAP: -5 }, xp: 285,
        result: 'Financially, unarguable. It sits with you for years anyway, in a way profit and loss does not capture.' },
    ]),
];

// ---------------------------------------------------------------------------
// PEAK — 40 to 59
// ---------------------------------------------------------------------------
const PEAK = [
  (s, r) => q('p_peak_legacy', 'office',
    'You have enough. The question is now what it is all for.', [
      { id: 'bigger', label: 'Build something bigger than you',
        fx: { BIZ: 12, CRE: 10, CHA: 8 }, xp: 320, money: scaleMoney(s, 600), count: { ventures: 1 },
        result: 'Something with your fingerprints on it that does not need your hands on it. That is the whole trick and you have finally learned it.' },
      { id: 'give', label: 'Start giving it away, seriously and quietly',
        fx: { CHA: 13, HAP: 14, SMR: 8 }, xp: 330, money: -scaleMoney(s, 800), flag: 'philanthropy', secret: 'quiet_giver',
        result: 'No press release, no naming rights. Two people at the receiving end work out it was you and you ask them not to say.' },
      { id: 'stop', label: 'Stop expanding and start enjoying it',
        fx: { HAP: 16, HLT: 9 }, xp: 315, flag: 'enough',
        result: 'You define "enough", out loud, with a number, and then you actually stop. Almost nobody who gets here manages that.' },
    ]),
  (s, r) => {
    const f = aFriend(s, r);
    return q('p_peak_reunion', 'town',
      `Thirty-odd years of friendship, and ${f.name} is on the phone about the annual thing.`, [
        { id: 'host', label: 'Host it. All of them. Whatever it costs.',
          fx: { CHA: 12, HAP: 15 }, xp: 320, money: -scaleMoney(s, 150),
          rel: { boyd: 8, ollie_b: 6, ollie_c: 6, jack: 6, forrest: 6, ollie_hen: 6, oscar: 8 },
          result: 'Seven middle-aged men and one enormous table. Somebody brings up the building site. Somebody always brings up the building site.' },
        { id: 'trip', label: 'Take the whole lot away somewhere for a week',
          fx: { HAP: 16, CHA: 10, HLT: 5 }, xp: 325, money: -scaleMoney(s, 400), secret: 'the_trip',
          result: 'You pay for the lot without telling them and refuse to discuss it. Boyd works it out at the airport and says nothing, which is his version of thank you.' },
        { id: 'quiet', label: 'Just you and Boyd, like it has always really been',
          fx: { HAP: 13, CHA: 6 }, xp: 315, rel: { boyd: 20 },
          result: 'Two blokes who met before they could talk, in a pub, for six hours. Nothing needs saying and most of it gets said anyway.' },
      ]);
  },
  (s, r) => q('p_peak_body', 'pitch',
    `The knees have opinions now. ${pick(r, ['A half marathon has been suggested.', 'Someone has organised a veterans league.', 'The doctor used the word "excellent" and then the word "however".'])}`, [
      { id: 'compete', label: 'Compete. Age is a number and yours is wrong.',
        fx: { ATH: 11, HLT: 10, HAP: 8 }, xp: 315, flag: 'veteran_athlete',
        result: 'You beat men fifteen years younger and you are insufferable about it for a fortnight. Entirely earned.' },
      { id: 'maintain', label: 'Maintain, sensibly, for the next forty years rather than the next four',
        fx: { HLT: 15, ATH: 6, SMR: 7 }, xp: 320, flag: 'long_game_health',
        result: 'Boring, consistent, unglamorous. It is the reason you are still walking up hills at ninety.' },
      { id: 'teach', label: 'Put it into the kids coming through instead',
        fx: { CHA: 12, HAP: 10, ATH: 4 }, xp: 315, flag: 'coaching',
        result: 'Three of the players you coached go a very long way. One of them mentions you by name in an interview and you have to leave the room.' },
    ]),
  (s, r) => q('p_peak_music', 'stage',
    'The music never went away. There is an audience that grew up with it.', [
      { id: 'tour', label: 'Tour it properly, one last big run',
        fx: { MUS: 12, CHA: 11, HLT: -7, HAP: 12 }, xp: 325, fame: 14, count: { gigs: 12 },
        result: 'Twenty-two dates. Your voice holds. The rooms are full of people who were fifteen when they first heard you and are now forty.' },
      { id: 'mentor', label: 'Produce and mentor the next lot instead',
        fx: { MUS: 10, CHA: 12, CRE: 9 }, xp: 325, money: scaleMoney(s, 200), flag: 'mentor',
        result: 'You are in the back of the studio saying very little and changing everything. Two of them get enormous. Both credit you.' },
      { id: 'family', label: 'Keep it for the kitchen and the people you love',
        fx: { HAP: 15, MUS: 8 }, xp: 315, flag: 'kitchen_singer',
        result: 'Full voice, washing up, nobody recording it. The purest version of the thing you started at three years old.' },
    ]),
  (s, r) => q('p_peak_loss', 'home_modern',
    'A hard year. Someone you have known your whole life is not well.', [
      { id: 'there', label: 'Be there. Everything else waits.',
        fx: { HAP: -6, CHA: 14, SMR: 6 }, xp: 320, flag: 'showed_up', secret: 'showed_up',
        result: 'You cancel a quarter of a year and nobody has to ask you twice. You never once regret a single hour of it.' },
      { id: 'practical', label: 'Take on everything practical so nobody else has to',
        fx: { SMR: 12, CHA: 10, HAP: -4 }, xp: 320,
        result: 'Forms, calls, appointments, logistics. Unglamorous, invisible, and the single most useful thing anyone does that year.' },
      { id: 'record', label: 'Get it all down — the stories, the voices, before they go',
        fx: { CRE: 13, HAP: 6, SMR: 8 }, xp: 330, secret: 'the_archive',
        result: 'Eleven hours of recordings nobody knew you were making. Your grandchildren will hear voices they never met.' },
    ]),
  (s, r) => q('p_peak_tech', 'office',
    'The tools have moved on again. You can either move with them or stop.', [
      { id: 'learn', label: 'Learn it properly, from the bottom, like you are seven again',
        fx: { COD: 13, SMR: 11, CRE: 7 }, xp: 325, flag: 'kept_up',
        result: 'Everyone your age has stopped learning. You sit down with the documentation like a kid with a box-and-blocks editor and you are dangerous again inside a year.' },
      { id: 'hire', label: 'Hire the people who already know it',
        fx: { BIZ: 12, CHA: 10 }, xp: 320, money: -scaleMoney(s, 250),
        result: 'You do not need to be the best in the building. You need the best in the building to want to work for you.' },
      { id: 'stop', label: 'Stay with what you know and get better at that instead',
        fx: { SMR: 9, BIZ: 8, HAP: 7 }, xp: 315,
        result: 'Depth over novelty. It works, for a good while, and you are honest with yourself about the day it stops working.' },
    ]),
  (s, r) => q('p_peak_teach', 'office',
    'People want to know how you did it. There is a version of this that is a business.', [
      { id: 'book', label: 'Write the book, honestly, including the bad bits',
        fx: { CRE: 12, BIZ: 9, SMR: 9 }, xp: 325, money: scaleMoney(s, 250), fame: 10, flag: 'author',
        result: 'The chapter about the two clubs folding is the one people quote back at you for twenty years.' },
      { id: 'invest', label: 'Back other people\'s ideas with money and time',
        fx: { BIZ: 13, CHA: 10 }, xp: 330, money: -scaleMoney(s, 700), flag: 'angel', count: { ventures: 2 },
        result: 'Eleven bets. Seven go nowhere, three are fine, one is absurd. You are on the phone at 11pm to a twenty-three-year-old and you love it.' },
      { id: 'no', label: 'Nothing. You do the work, you do not sell the story.',
        fx: { SMR: 10, HAP: 8, BIZ: 5 }, xp: 315, secret: 'no_guru',
        result: 'You turn down every stage, podcast and course. Some people find that unhelpful. You find it clean.' },
    ]),
];

// ---------------------------------------------------------------------------
// ELDER — 60 to 79
// ---------------------------------------------------------------------------
const ELDER = [
  (s, r) => q('p_elder_handover', 'office', 'Time to hand it over. The only question is how.', [
      { id: 'staff', label: 'To the people who built it with you',
        fx: { CHA: 14, HAP: 13, BIZ: 5 }, xp: 340, money: scaleMoney(s, 400), secret: 'gave_it_to_them',
        result: 'You sell it to your own staff at a price they can actually afford. Your accountant is appalled. You have never been happier signing anything.' },
      { id: 'family', label: 'To the family, if any of them actually want it',
        fx: { HAP: 12, CHA: 9 }, xp: 335, flag: 'family_succession',
        result: 'You ask properly rather than assume, and you accept the answer either way. That is rarer than it sounds.' },
      { id: 'market', label: 'To the highest bidder and walk away clean',
        fx: { BIZ: 10, SMR: 9, HAP: 6 }, xp: 335, money: scaleMoney(s, 1400), count: { exits: 1 },
        result: 'Best price, clean break, no consultancy period. You are out of the building by five and you do not look back at it.' },
    ]),
  (s, r) => q('p_elder_grandkids', 'garden', 'A new generation, and they are extremely loud.', [
      { id: 'music', label: 'Put the speakers on for them, exactly like Dad did for you',
        fx: { MUS: 10, HAP: 18 }, xp: 345, secret: 'full_circle',
        result: 'Linkin Park at a sensible volume in a Letchworth front room, and a very small person going still to listen. Sixty-odd years, straight back round.' },
      { id: 'ball', label: 'A ball in the garden, every visit, no exceptions',
        fx: { ATH: 8, HLT: 8, HAP: 16 }, xp: 340,
        result: 'You are sixty-something and you can still nutmeg all of them. You do it every single time and it never gets old for you.' },
      { id: 'business', label: 'Teach them how money actually works',
        fx: { BIZ: 10, SMR: 10, HAP: 12 }, xp: 340, count: { deals: 2 },
        result: 'A seven-year-old runs a functioning lemonade operation with tiered pricing within a fortnight. The bloodline is intact.' },
    ]),
  (s, r) => q('p_elder_health', 'home_modern', 'The body needs managing now rather than pushing.', [
      { id: 'discipline', label: 'Walk every day, swim twice a week, no arguments',
        fx: { HLT: 16, ATH: 6, HAP: 8 }, xp: 335, flag: 'disciplined_elder',
        result: 'You are back in a swimming pool for the first time since you were nine. It comes straight back, which surprises you and does not surprise your body.' },
      { id: 'enjoy', label: 'Eat well, drink well, live well, take the years you get',
        fx: { HAP: 15, HLT: -4, CHA: 7 }, xp: 330,
        result: 'A very good decade with excellent food in it. You have done the maths and you are comfortable with the trade.' },
      { id: 'both', label: 'Discipline all week, no rules at the weekend',
        fx: { HLT: 10, HAP: 12 }, xp: 340,
        result: 'Sensible Monday to Friday, entirely unsensible Saturday. It works and your doctor grudgingly agrees.' },
    ]),
  (s, r) => q('p_elder_mario', 'loft', 'Clearing the loft. You know what is up there.', [
      { id: 'restore', label: 'Get him properly restored',
        fx: { HAP: 16, CRE: 8 }, xp: 350, money: -scaleMoney(s, 20), secret: 'restored',
        result: 'A specialist in Norfolk spends four months on three foot six of 2017 plush. He comes back looking like the day he arrived. You cry a bit and tell nobody.' },
      { id: 'pass', label: 'Give him to a grandchild', fx: { HAP: 15, CHA: 10 }, xp: 350, secret: 'passed_on',
        result: 'Sixty years, four houses, one loft, and now a bedroom belonging to someone who did not exist for most of that. He is exactly as tall as they are.' },
      { id: 'keep', label: 'He stays with you. He has earned it.',
        fx: { HAP: 14 }, xp: 345, flag: 'mario_forever', secret: 'still_here',
        result: 'The corner of the room, where he has been on and off since you were four. You are old and he is old and neither of you mentions it.' },
    ]),
  (s, r) => {
    const f = aFriend(s, r);
    return q('p_elder_friend', 'town', `Fifty-plus years with ${f.name}. Not many people get that.`, [
        { id: 'weekly', label: 'A standing weekly thing, in the diary, forever',
          fx: { HAP: 15, CHA: 11, HLT: 5 }, xp: 340, rel: { [f.id]: 20 },
          result: `Same day, same place, same two chairs. Neither of you has ever once cancelled and both of you have noticed that.` },
        { id: 'adventure', label: 'Do the mad thing you have both been threatening for forty years',
          fx: { HAP: 17, ATH: 6, NAU: 8 }, xp: 350, secret: 'finally_did_it',
          result: `Two men in their sixties doing something genuinely reckless and being spectacularly pleased with themselves about it.` },
        { id: 'write', label: 'Write it all down while you both still remember it properly',
          fx: { CRE: 12, SMR: 9, HAP: 11 }, xp: 345, secret: 'the_archive',
          result: `The slide, the staff room door, the building site, the field, the car. All of it, in order, finally straight.` },
      ]);
  },
];

// ---------------------------------------------------------------------------
// LEGEND — 80 to 110
// ---------------------------------------------------------------------------
const LEGEND = [
  (s, r) => q('p_legend_stay', 'garden', `Age ${s.age}. Most people do not get this far. You are still here and still sharp.`, [
      { id: 'active', label: 'Keep moving. Every single day.',
        fx: { HLT: 12, ATH: 5, HAP: 10 }, xp: 360, flag: 'still_moving',
        result: 'A walk before breakfast in all weathers. It is not stubbornness, it is a strategy, and it is working.' },
      { id: 'people', label: 'Keep people around you. That is the actual medicine.',
        fx: { HAP: 15, CHA: 12, HLT: 7 }, xp: 360, flag: 'surrounded',
        result: 'The house is never empty. Four generations through the front door in a week. Loneliness is the thing that kills people and it cannot find you.' },
      { id: 'work', label: 'Keep making things. Retirement is for other people.',
        fx: { CRE: 13, SMR: 10, HAP: 11 }, xp: 365, flag: 'never_stopped',
        result: 'A new project at eighty-something. Small, useless, entirely absorbing. Your brain has never once been switched off and it shows.' },
    ]),
  (s, r) => q('p_legend_story', 'home_modern', 'Somebody young asks you what it was actually like.', [
      { id: 'honest', label: 'Tell them the honest version, bad bits included',
        fx: { SMR: 12, CHA: 12, HAP: 9 }, xp: 360, secret: 'told_the_truth',
        result: 'You include the year you burned out, the friend you let down, and the deal you should not have signed. They remember it forever because of that.' },
      { id: 'best', label: 'Tell them the best bits. There were a lot of best bits.',
        fx: { HAP: 15, CHA: 10 }, xp: 355,
        result: 'A halfway line goal, a room going quiet, a loft hatch opening. Three hours. They do not check their phone once.' },
      { id: 'ask', label: 'Ask them about theirs instead',
        fx: { CHA: 14, SMR: 9, HAP: 11 }, xp: 365, secret: 'still_listening',
        result: 'Ninety-odd years old and more interested in their story than your own. It is the single most impressive thing about you.' },
    ]),
  (s, r) => q('p_legend_music', 'stage', 'Your voice is not what it was. It is still yours.', [
      { id: 'sing', label: 'Sing anyway. Loudly. In front of people.',
        fx: { MUS: 10, HAP: 16, CHA: 10 }, xp: 365, count: { gigs: 1 }, secret: 'never_stopped_singing',
        result: 'A room full of family and a voice that has been doing this since before it could talk. Nobody there will forget it.' },
      { id: 'listen', label: 'Put the old stuff on and just sit with it',
        fx: { HAP: 14, SMR: 8 }, xp: 355,
        result: 'Hybrid Theory, Juicy, and a track you made in a bedroom in Hitchin at fourteen. Ninety years in one playlist.' },
      { id: 'teach', label: 'Show a great-grandchild how to write a verse',
        fx: { MUS: 9, CHA: 13, HAP: 14 }, xp: 370, secret: 'full_circle',
        result: 'Sixteen bars, written at a kitchen table by two people born ninety years apart. Theirs is better than yours was at that age and you tell them so.' },
    ]),
  (s, r) => q('p_legend_look_back', 'village', 'Somebody drives you back to Shillington.', [
      { id: 'walk', label: 'Walk the whole village, slowly',
        fx: { HAP: 16, SMR: 9, HLT: 4 }, xp: 365, secret: 'went_back',
        result: 'The church, the field where the Sharks played, the road where you washed cars. All smaller. All exactly the same.' },
      { id: 'pitch', label: 'Go and stand on the pitch',
        fx: { HAP: 15, ATH: 4 }, xp: 365,
        result: 'The Sharks folded when you were ten and the pitch is still there and the goals are still there. You stand on the halfway line for a while.' },
      { id: 'home', label: 'Just look at the house you were born in',
        fx: { HAP: 14, CRE: 7 }, xp: 360,
        result: 'Someone else\'s curtains, someone else\'s car. A front room where a man once put the speakers on for a three-week-old baby.' },
    ]),
];

// ---------------------------------------------------------------------------
// CHALLENGES — can turn up at any age, thrown in at random
// ---------------------------------------------------------------------------
export const CHALLENGES = [
  (s, r) => {
    const f = aFriend(s, r, 'naughty');
    return q('c_dare', 'town', `CHALLENGE — ${f.name} bets you cannot ${pick(r, ['keep it up a hundred times', 'sell something to a total stranger in an hour', 'freestyle for two minutes straight with no repeats', 'run it in under six minutes'])}.`, [
      { id: 'go', label: 'Do it first time and act like it was nothing',
        fx: { ATH: 8, CHA: 8, NAU: 5 }, xp: 160, rel: { [f.id]: 10 }, count: { challenges: 1 },
        result: 'First attempt, clean, and then you carry on the conversation like it did not happen. Devastating.' },
      { id: 'double', label: 'Do it, then double the stakes',
        fx: { NAU: 10, CHA: 9, BIZ: 5 }, xp: 175, rel: { [f.id]: 8 }, count: { challenges: 1 },
        result: 'You win, then immediately offer double or nothing on something harder. This is why nobody bets against you twice.' },
      { id: 'fail', label: 'Have a proper go and miss by a fraction',
        fx: { ATH: 5, HAP: 4, SMR: 5 }, xp: 150, rel: { [f.id]: 6 },
        result: 'So close it is almost worse than losing. You are back the next day and you get it.' },
    ], { challenge: true });
  },
  (s, r) => q('c_quick', 'city', `CHALLENGE — you have ${pick(r, ['one hour', 'one afternoon', 'twenty-four hours'])} and £${scaleMoney(s, 20)}. Turn it into more.`, [
      { id: 'flip', label: 'Buy something underpriced and sell it on',
        fx: { BIZ: 11, SMR: 6 }, xp: 170, money: scaleMoney(s, 45), count: { deals: 2, challenges: 1 },
        result: 'You more than double it and you are slightly annoyed you did not do better.' },
      { id: 'service', label: 'Sell your time — you can do things people will pay for',
        fx: { BIZ: 8, CHA: 9, ATH: 4 }, xp: 165, money: scaleMoney(s, 30), count: { challenges: 1 },
        result: 'Straightforward, honest, effective. No inventory, no risk, all margin.' },
      { id: 'make', label: 'Make something out of it and sell that',
        fx: { CRE: 12, BIZ: 8 }, xp: 180, money: scaleMoney(s, 60), count: { challenges: 1, builds: 1 },
        result: 'You add the one thing nobody else is adding, which is the work. Triple your money.' },
    ], { challenge: true }),
  (s, r) => q('c_pressure', 'stage', 'CHALLENGE — someone hands you a mic with no warning and a room goes quiet.', [
      { id: 'own', label: 'Own it completely', fx: { CHA: 12, MUS: 9, HAP: 6 }, xp: 175, fame: 5, count: { challenges: 1 },
        result: 'Ninety seconds, no notes, and the room is yours by the end of the first line.' },
      { id: 'funny', label: 'Make it funny instead of impressive', fx: { CHA: 11, HAP: 9 }, xp: 170, count: { challenges: 1 },
        result: 'You get a genuine laugh out of a cold room, which is harder than singing at it.' },
      { id: 'short', label: 'Say one good sentence and hand it straight back',
        fx: { SMR: 9, CHA: 8 }, xp: 165, count: { challenges: 1 },
        result: 'Brief, sharp, and everyone remembers it precisely because you did not milk it.' },
    ], { challenge: true }),
  (s, r) => q('c_moral', 'office', 'CHALLENGE — you have spotted a loophole. It is legal. It is not right.', [
      { id: 'no', label: 'Close it and tell them it is there',
        fx: { SMR: 10, CHA: 10, BIZ: 4 }, xp: 185, count: { challenges: 1 }, secret: 'straight_bat',
        result: 'You flag your own advantage and give it up. It costs you money and buys you something you cannot buy.' },
      { id: 'use', label: 'Use it once, quietly, and never again',
        fx: { BIZ: 11, NAU: 8, HAP: -4 }, xp: 175, money: scaleMoney(s, 200), count: { challenges: 1 },
        result: 'It works. You do not feel great. You do not do it twice, which is at least something.' },
      { id: 'sell', label: 'Point it out and get paid for pointing it out',
        fx: { BIZ: 13, SMR: 11 }, xp: 190, money: scaleMoney(s, 120), count: { challenges: 1 },
        result: 'You turn your own integrity into a consultancy fee. Everybody wins, which is the best kind of clever.' },
    ], { challenge: true }),
];

export const POOLS = {
  infant: LAUNCH, lower: LAUNCH, middle: LAUNCH, teen: LAUNCH,
  launch: LAUNCH,
  build: BUILD,
  peak: PEAK,
  elder: ELDER,
  legend: LEGEND,
};

export function poolFor(stageId) {
  return POOLS[stageId] || BUILD;
}
