// The 92 clubs of the English league, with rough average first-team wages in
// pounds per week. These are public ballpark estimates, not payroll data —
// they exist to make the four divisions feel properly far apart.

const C = (name, wage) => ({ name, wage });

export const DIVISIONS = [
  {
    id: 'premier', name: 'Premier League', short: 'PL',
    clubs: [
      C('Manchester City', 200000), C('Manchester United', 175000),
      C('Liverpool', 160000), C('Arsenal', 150000), C('Chelsea', 145000),
      C('Tottenham Hotspur', 120000), C('Newcastle United', 95000),
      C('Aston Villa', 90000), C('West Ham United', 85000), C('Everton', 65000),
      C('Wolverhampton Wanderers', 60000), C('Brighton & Hove Albion', 55000),
      C('Fulham', 55000), C('Crystal Palace', 55000), C('Nottingham Forest', 55000),
      C('AFC Bournemouth', 45000), C('Brentford', 45000), C('Leicester City', 45000),
      C('Southampton', 35000), C('Ipswich Town', 30000),
    ],
  },
  {
    id: 'championship', name: 'Championship', short: 'CH',
    clubs: [
      C('Leeds United', 45000), C('Burnley', 40000), C('Sheffield United', 32000),
      C('Norwich City', 28000), C('Middlesbrough', 26000), C('West Bromwich Albion', 25000),
      C('Watford', 24000), C('Sunderland', 22000), C('Stoke City', 22000),
      C('Hull City', 20000), C('Coventry City', 20000), C('Blackburn Rovers', 18000),
      C('Bristol City', 18000), C('Cardiff City', 18000), C('Swansea City', 17000),
      C('Millwall', 16000), C('Preston North End', 16000), C('Queens Park Rangers', 16000),
      C('Derby County', 15000), C('Luton Town', 15000), C('Sheffield Wednesday', 15000),
      C('Portsmouth', 12000), C('Plymouth Argyle', 12000), C('Oxford United', 10000),
    ],
  },
  {
    id: 'league_one', name: 'League One', short: 'L1',
    clubs: [
      C('Birmingham City', 18000), C('Huddersfield Town', 12000), C('Reading', 10000),
      C('Wrexham', 9000), C('Bolton Wanderers', 8000), C('Barnsley', 7000),
      C('Blackpool', 7000), C('Charlton Athletic', 7000), C('Peterborough United', 6000),
      C('Wigan Athletic', 6000), C('Rotherham United', 6000), C('Stockport County', 5000),
      C('Lincoln City', 5000), C('Bristol Rovers', 5000), C('Northampton Town', 4500),
      C('Leyton Orient', 4500), C('Wycombe Wanderers', 4000), C('Shrewsbury Town', 4000),
      C('Cambridge United', 4000), C('Exeter City', 4000), C('Mansfield Town', 4000),
      C('Stevenage', 4000), C('Burton Albion', 3500), C('Crawley Town', 3000),
    ],
  },
  {
    id: 'league_two', name: 'League Two', short: 'L2',
    clubs: [
      C('Milton Keynes Dons', 3500), C('Bradford City', 3500), C('Notts County', 3000),
      C('Port Vale', 3000), C('Doncaster Rovers', 3000), C('Gillingham', 3000),
      C('Walsall', 2800), C('Chesterfield', 2800), C('AFC Wimbledon', 2500),
      C('Swindon Town', 2500), C('Grimsby Town', 2500), C('Salford City', 2500),
      C('Tranmere Rovers', 2500), C('Crewe Alexandra', 2200), C('Colchester United', 2200),
      C('Cheltenham Town', 2200), C('Fleetwood Town', 2200), C('Newport County', 2000),
      C('Barrow', 2000), C('Morecambe', 2000), C('Harrogate Town', 2000),
      C('Carlisle United', 2000), C('Accrington Stanley', 1800), C('Bromley', 1800),
    ],
  },
];

// Flat list for the picker, each carrying its division.
export const ALL_CLUBS = DIVISIONS.flatMap((div) =>
  div.clubs.map((c) => ({
    id: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name: c.name,
    wage: c.wage,
    division: div.id,
    divisionName: div.name,
    short: div.short,
  })));

export function clubById(id) {
  return ALL_CLUBS.find((c) => c.id === id) || null;
}

// How hard it is to hold a place there. Used to decide whether a season goes
// well, and whether you get moved on.
export const DIVISION_DIFFICULTY = {
  premier: 92, championship: 72, league_one: 55, league_two: 42,
};
