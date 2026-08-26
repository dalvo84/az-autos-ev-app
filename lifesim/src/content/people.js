// Everyone who matters. `met` is the age you first know them; `from` on family
// is the age they arrive in your life (birth of siblings/cousins).
// `bornOffset` is their age difference from you, so the whole cast shifts with
// whatever birth year you pick.

export const FAMILY = [
  {
    id: 'alex', name: 'Alex', rel: 'Mum', from: 0,
    colour: 0xd98cb3, height: 1.68,
    traits: ['steady', 'warm'],
    note: 'Knows when you are lying before you have finished the sentence.',
  },
  {
    id: 'david', name: 'David', rel: 'Dad', from: 0,
    colour: 0x4a7fb5, height: 1.82,
    traits: ['music', 'graft'],
    note: 'The one who put the speakers on when you were nought.',
  },
  {
    id: 'elowen', name: 'Elowen', rel: 'Sister', from: 2, bornOffset: 2,
    colour: 0xe2b04a, height: 1.55,
    traits: ['sharp', 'loud'],
    note: 'Arrived when you were 2 and never gave the spotlight back.',
  },
  {
    id: 'ollie_a', name: 'Ollie', rel: 'Cousin', from: 0, bornOffset: -2,
    colour: 0x5fb37a, height: 1.78,
    traits: ['older', 'daring'],
    note: 'Two years up on you. Every bad idea you ever had, he had first.',
  },
  {
    id: 'blake', name: 'Blake', rel: 'Cousin', from: 5, bornOffset: 5,
    colour: 0xc76b8a, height: 1.6,
    traits: ['bold'],
    note: 'Born when you were 5. Fearless from about ten minutes old.',
  },
  {
    id: 'willa', name: 'Willa', rel: 'Cousin', from: 8, bornOffset: 8,
    colour: 0xb98ccc, height: 1.58,
    traits: ['quiet', 'clever'],
    note: 'Born when you were 8. Watches everything, says little, misses nothing.',
  },
  {
    id: 'preston', name: 'Preston', rel: 'Cousin', from: 10, bornOffset: 10,
    colour: 0x6aa9d6, height: 1.74,
    traits: ['copycat'],
    note: 'Born when you were 10. Wants to be you when he grows up.',
  },
];

export const FRIENDS = [
  {
    id: 'boyd', name: 'Boyd', met: 0, where: 'Shillington, from the pram',
    personality: ['naughty', 'reckless'], bestFriend: true,
    colour: 0xe06c3a, height: 1.79,
    note: 'Best friend. Known him longer than you have known words.',
    hook: 'If Boyd says "watch this", something is about to get broken.',
  },
  {
    id: 'ollie_b', name: 'Ollie B', met: 4, where: 'Shillington Lower',
    personality: ['naughty', 'reckless'],
    colour: 0x4fae9b, height: 1.76,
    note: 'Met on the infant playground. Bonded over a banned climbing frame.',
    hook: 'Ollie B does not know what a rule is. Genuinely.',
  },
  {
    id: 'ollie_c', name: 'Ollie C', met: 10, where: 'Year 6',
    personality: ['naughty', 'reckless'],
    colour: 0x9b6bd6, height: 1.81,
    note: 'Year 6 arrival. Chaos with a haircut.',
    hook: 'Ollie C will take any dare, twice, for free.',
  },
  {
    id: 'jack', name: 'Jack', met: 10, where: 'Year 6',
    personality: ['smart', 'funny', 'popular'],
    colour: 0x3f8fd0, height: 1.83,
    note: 'Clever and funny and somehow liked by absolutely everyone.',
    hook: 'Jack can get a room laughing and still finish top of the test.',
  },
  {
    id: 'forrest', name: 'Forrest', met: 10, where: 'Year 6',
    personality: ['smart', 'funny', 'popular'],
    colour: 0x63b551, height: 1.8,
    note: 'The other half of the popular double act.',
    hook: 'Forrest walks into a room and the room rearranges around him.',
  },
  {
    id: 'ollie_hen', name: 'Ollie (Hen)', met: 10, where: 'Year 6',
    personality: ['smart', 'funny'],
    colour: 0xd6b13f, height: 1.75,
    note: 'The third Ollie. Nicknamed to stop absolute confusion.',
    hook: 'Hen is the funniest person in any room he is not trying to be funny in.',
  },
  {
    id: 'oscar', name: 'Oscar', met: 10, where: 'Year 6',
    personality: ['funny'], sameBirthday: true,
    colour: 0xe0554f, height: 1.77,
    note: 'Born the same day as you, in the room next door. Neither of you knew for ten years.',
    hook: 'Same birthday, same hospital, same night. You just had not been introduced.',
  },
];

export const ALL_PEOPLE = [...FAMILY, ...FRIENDS];

export function peopleAt(age) {
  return {
    family: FAMILY.filter((p) => age >= p.from),
    friends: FRIENDS.filter((p) => age >= p.met),
  };
}

export function personById(id) {
  return ALL_PEOPLE.find((p) => p.id === id) || null;
}

export function friendsMetAt(age) {
  return FRIENDS.filter((p) => p.met === age);
}

export function familyArrivingAt(age) {
  return FAMILY.filter((p) => p.from === age && p.from > 0);
}

// Named groups the writing leans on a lot.
export const CREW = {
  naughty: ['boyd', 'ollie_b', 'ollie_c'],
  smart: ['jack', 'ollie_hen', 'forrest'],
  popular: ['jack', 'forrest'],
};
