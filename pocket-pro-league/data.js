/* Pocket Pro League — static game data */
(function (root) {
  'use strict';

  // ---- Positions & OVR weightings (EA FC style) ----
  // attrs: pac sho pas dri def phy
  const POSITIONS = {
    ST:  { name: 'Striker',              w: { pac: .20, sho: .38, pas: .08, dri: .16, def: .02, phy: .16 }, group: 'ATT' },
    LW:  { name: 'Left Winger',          w: { pac: .26, sho: .20, pas: .14, dri: .28, def: .02, phy: .10 }, group: 'ATT' },
    RW:  { name: 'Right Winger',         w: { pac: .26, sho: .20, pas: .14, dri: .28, def: .02, phy: .10 }, group: 'ATT' },
    CAM: { name: 'Attacking Midfielder', w: { pac: .10, sho: .20, pas: .30, dri: .30, def: .03, phy: .07 }, group: 'ATT' },
    CM:  { name: 'Central Midfielder',   w: { pac: .10, sho: .10, pas: .32, dri: .20, def: .14, phy: .14 }, group: 'MID' },
    CDM: { name: 'Defensive Midfielder', w: { pac: .08, sho: .05, pas: .22, dri: .10, def: .33, phy: .22 }, group: 'MID' },
    LB:  { name: 'Left Back',            w: { pac: .24, sho: .04, pas: .16, dri: .14, def: .27, phy: .15 }, group: 'DEF' },
    RB:  { name: 'Right Back',           w: { pac: .24, sho: .04, pas: .16, dri: .14, def: .27, phy: .15 }, group: 'DEF' },
    CB:  { name: 'Centre Back',          w: { pac: .14, sho: .02, pas: .08, dri: .05, def: .45, phy: .26 }, group: 'DEF' },
    GK:  { name: 'Goalkeeper',           w: { pac: .15, sho: .03, pas: .12, dri: .05, def: .42, phy: .23 }, group: 'GK'  },
  };
  const ATTR_LABELS = { pac: 'PACE', sho: 'SHOOTING', pas: 'PASSING', dri: 'DRIBBLING', def: 'DEFENDING', phy: 'PHYSICAL' };
  const GK_ATTR_LABELS = { pac: 'REFLEXES', sho: 'DISTRIBUTION', pas: 'KICKING', dri: 'FOOTWORK', def: 'HANDLING', phy: 'POSITIONING' };

  // ---- Leagues (tier drives wages & prestige; str is club strength 1-99) ----
  const LEAGUES = [
    { id: 'PL',  name: 'Premier League',   country: 'England', tier: 5, wageMult: 3.2, teams: [
      ['Manchester City', 88], ['Liverpool', 88], ['Arsenal', 87], ['Chelsea', 84], ['Newcastle United', 82], ['Tottenham Hotspur', 81],
      ['Aston Villa', 81], ['Manchester United', 80], ['Brighton', 78], ['Nottingham Forest', 78], ['Crystal Palace', 77], ['Bournemouth', 77],
      ['West Ham United', 76], ['Fulham', 76], ['Brentford', 76], ['Everton', 75], ['Wolves', 74], ['Leeds United', 73], ['Burnley', 72], ['Sunderland', 72] ] },
    { id: 'LL',  name: 'La Liga',          country: 'Spain', tier: 5, wageMult: 2.6, teams: [
      ['Real Madrid', 89], ['Barcelona', 88], ['Atlético Madrid', 85], ['Athletic Club', 80], ['Villarreal', 79], ['Real Betis', 78],
      ['Real Sociedad', 78], ['Sevilla', 75], ['Girona', 75], ['Valencia', 74], ['Celta Vigo', 74], ['Osasuna', 74], ['Rayo Vallecano', 73],
      ['Mallorca', 73], ['Getafe', 72], ['Alavés', 71], ['Espanyol', 71], ['Levante', 69], ['Elche', 69], ['Real Oviedo', 68] ] },
    { id: 'SA',  name: 'Serie A',          country: 'Italy', tier: 4, wageMult: 2.2, teams: [
      ['Inter', 87], ['Napoli', 85], ['Juventus', 84], ['AC Milan', 84], ['Atalanta', 83], ['Roma', 81], ['Lazio', 79], ['Fiorentina', 79],
      ['Bologna', 78], ['Torino', 74], ['Como', 74], ['Udinese', 73], ['Genoa', 72], ['Sassuolo', 71], ['Cagliari', 71], ['Parma', 71],
      ['Lecce', 70], ['Hellas Verona', 69], ['Pisa', 68], ['Cremonese', 68] ] },
    { id: 'BL',  name: 'Bundesliga',       country: 'Germany', tier: 4, wageMult: 2.2, teams: [
      ['Bayern Munich', 89], ['Bayer Leverkusen', 84], ['Borussia Dortmund', 83], ['RB Leipzig', 82], ['Eintracht Frankfurt', 80], ['VfB Stuttgart', 80],
      ['SC Freiburg', 77], ['Mainz 05', 76], ['VfL Wolfsburg', 75], ['Borussia Mönchengladbach', 75], ['TSG Hoffenheim', 74], ['Union Berlin', 74],
      ['FC Augsburg', 73], ['Werder Bremen', 73], ['FC St. Pauli', 71], ['1. FC Köln', 71], ['Hamburger SV', 71], ['1. FC Heidenheim', 70] ] },
    { id: 'L1',  name: 'Ligue 1',          country: 'France', tier: 4, wageMult: 2.0, teams: [
      ['Paris Saint-Germain', 90], ['Marseille', 81], ['Monaco', 81], ['Lille', 79], ['Lyon', 79], ['Nice', 77], ['Lens', 76], ['Rennes', 76],
      ['Strasbourg', 75], ['Toulouse', 73], ['Brest', 73], ['Nantes', 71], ['Auxerre', 70], ['Lorient', 69], ['Paris FC', 69],
      ['Angers', 68], ['Le Havre', 68], ['Metz', 68] ] },
    { id: 'SPL', name: 'Saudi Pro League', country: 'Saudi Arabia', tier: 3, wageMult: 3.0, teams: [
      ['Al Hilal', 82], ['Al Nassr', 80], ['Al Ittihad', 80], ['Al Ahli', 79], ['Al Qadsiah', 74], ['Al Shabab', 72], ['Al Taawoun', 71],
      ['Al Ettifaq', 70], ['NEOM SC', 68], ['Al Fateh', 68], ['Damac', 67], ['Al Khaleej', 67], ['Al Riyadh', 66], ['Al Fayha', 66],
      ['Al Kholood', 65], ['Al Okhdood', 64], ['Al Hazem', 64], ['Al Najma', 63] ] },
    { id: 'MLSE', name: 'MLS (East)',      country: 'USA', tier: 2, wageMult: 1.2, teams: [
      ['Inter Miami', 78], ['FC Cincinnati', 76], ['Columbus Crew', 75], ['Philadelphia Union', 75], ['Orlando City', 74], ['Charlotte FC', 73],
      ['New York City FC', 73], ['Nashville SC', 73], ['New York Red Bulls', 72], ['Atlanta United', 72], ['Chicago Fire', 70], ['New England Revolution', 69],
      ['D.C. United', 68], ['Toronto FC', 68], ['CF Montréal', 68] ] },
    { id: 'MLSW', name: 'MLS (West)',      country: 'USA', tier: 2, wageMult: 1.2, teams: [
      ['LAFC', 77], ['LA Galaxy', 76], ['Seattle Sounders', 75], ['Vancouver Whitecaps', 75], ['San Diego FC', 74], ['Minnesota United', 73],
      ['Portland Timbers', 72], ['Colorado Rapids', 71], ['Real Salt Lake', 71], ['Austin FC', 71], ['Houston Dynamo', 70], ['FC Dallas', 70],
      ['St. Louis City', 69], ['Sporting Kansas City', 69], ['San Jose Earthquakes', 69] ] },
    { id: 'CH',  name: 'Championship',     country: 'England', tier: 2, wageMult: 1.0, teams: [
      ['Southampton', 74], ['Leicester City', 74], ['Ipswich Town', 73], ['Sheffield United', 71], ['Middlesbrough', 71], ['Coventry City', 71],
      ['West Brom', 70], ['Norwich City', 70], ['Watford', 69], ['Bristol City', 69], ['Birmingham City', 69], ['Millwall', 68], ['Blackburn Rovers', 68],
      ['Swansea City', 68], ['Hull City', 67], ['Stoke City', 67], ['QPR', 67], ['Preston North End', 67], ['Wrexham', 67], ['Derby County', 66],
      ['Portsmouth', 66], ['Charlton Athletic', 66], ['Sheffield Wednesday', 65], ['Oxford United', 65] ] },
  ];

  // ---- Name pools with pronunciation guides ----
  const NAME_POOLS = {
    England:   { first: ['Jack', 'Harry', 'Ollie', 'Callum', 'Tyrone', 'Reece', 'Liam', 'Kieran', 'Marcus', 'Archie'],
                 last: [['Whitlock', 'WIT-lok'], ['Ashworth', 'ASH-wurth'], ['Pemberton', 'PEM-bur-tun'], ['Okafor', 'oh-KAH-for'], ['Dyer', 'DYE-er'],
                        ['Hargreaves', 'HAR-greevz'], ['Fenwick', 'FEN-ik'], ['Cattermole', 'KAT-er-mole'], ['Beardsley', 'BEERDZ-lee'], ['Sowerby', 'SOW-er-bee']] },
    Spain:     { first: ['Iker', 'Pablo', 'Álvaro', 'Dani', 'Sergi', 'Unai', 'Mikel', 'Rodri', 'Nico', 'Joan'],
                 last: [['Jiménez', 'hee-MEN-eth'], ['Guerrero', 'geh-REH-roh'], ['Llorente', 'yoh-REN-teh'], ['Vázquez', 'BATH-keth'], ['Iturbe', 'ee-TOOR-beh'],
                        ['Carvajal', 'kar-va-HAL'], ['Ochoa', 'oh-CHOH-ah'], ['Zubizarreta', 'thoo-bee-tha-RREH-ta'], ['Redondo', 'reh-DON-doh'], ['Aguirre', 'ah-GEE-reh']] },
    Italy:     { first: ['Matteo', 'Lorenzo', 'Giacomo', 'Alessio', 'Nicolò', 'Davide', 'Federico', 'Tommaso', 'Riccardo', 'Simone'],
                 last: [['Bianchi', 'bee-AN-kee'], ['Esposito', 'es-POH-zee-toh'], ['Ricci', 'REE-chee'], ['Colombo', 'koh-LOM-boh'], ['Gagliardi', 'gal-YAR-dee'],
                        ['Chiesa', 'kee-EH-za'], ['Scamacca', 'ska-MAK-ka'], ['Zaccagni', 'dzak-KAN-yee'], ['Pellegrini', 'pel-leh-GREE-nee'], ['Locatelli', 'loh-ka-TEL-lee']] },
    Germany:   { first: ['Lukas', 'Jonas', 'Niklas', 'Felix', 'Maximilian', 'Leon', 'Florian', 'Kai', 'Tim', 'Moritz'],
                 last: [['Schröder', 'SHRUR-der'], ['Kimmich', 'KIM-ikh'], ['Hoffmann', 'HOF-man'], ['Weigl', 'VY-gul'], ['Brandt', 'BRANT'],
                        ['Süle', 'ZOO-luh'], ['Tah', 'TAH'], ['Wirtz', 'VEERTS'], ['Gnabry', 'NAH-bree'], ['Reus', 'ROYSS']] },
    France:    { first: ['Théo', 'Kylian', 'Hugo', 'Lucas', 'Mathis', 'Enzo', 'Rayan', 'Adrien', 'Moussa', 'Aurélien'],
                 last: [['Lefèvre', 'luh-FEV-ruh'], ['Camavinga', 'ka-ma-VIN-ga'], ['Thuram', 'too-RAM'], ['Konaté', 'ko-na-TAY'], ['Saliba', 'sa-LEE-ba'],
                        ['Dembélé', 'dem-beh-LAY'], ['Fofana', 'fo-FA-na'], ['Tchouaméni', 'chwa-MEN-ee'], ['Digne', 'DEEN-yuh'], ['Guendouzi', 'gen-DOO-zee']] },
    Brazil:    { first: ['Gabriel', 'Matheus', 'Vinícius', 'Rodrygo', 'Lucas', 'Bruno', 'Thiago', 'Éder', 'Rafael', 'Caio'],
                 last: [['Magalhães', 'ma-ga-LYANGSH'], ['Guimarães', 'gee-ma-RYNGSH'], ['Paquetá', 'pa-keh-TAH'], ['Militão', 'mee-lee-TOWNG'], ['Antony', 'AN-toh-nee'],
                        ['Raphinha', 'ha-FEEN-ya'], ['Casemiro', 'ka-zeh-MEE-roo'], ['Endrick', 'EN-drik'], ['Savinho', 'sa-VEEN-yoo'], ['Estêvão', 'es-teh-VOWNG']] },
    Argentina: { first: ['Julián', 'Enzo', 'Lautaro', 'Alexis', 'Nahuel', 'Facundo', 'Thiago', 'Valentín', 'Nicolás', 'Franco'],
                 last: [['Álvarez', 'AL-va-rez'], ['Garnacho', 'gar-NA-cho'], ['Mac Allister', 'mak AL-is-ter'], ['Molina', 'mo-LEE-na'], ['Romero', 'ro-MEH-ro'],
                        ['Paredes', 'pa-REH-des'], ['Lo Celso', 'lo CHEL-so'], ['Echeverri', 'eh-cheh-VEH-ree'], ['Buonanotte', 'bwoh-na-NOT-teh'], ['Soulé', 'soo-LAY']] },
    Nigeria:   { first: ['Victor', 'Ademola', 'Kelechi', 'Samuel', 'Wilfred', 'Alex', 'Calvin', 'Taiwo', 'Ola', 'Emeka'],
                 last: [['Osimhen', 'OH-sim-hen'], ['Lookman', 'LOOK-man'], ['Iheanacho', 'ee-heh-NA-cho'], ['Chukwueze', 'choo-KWEH-zeh'], ['Ndidi', 'un-DEE-dee'],
                        ['Iwobi', 'ee-WOH-bee'], ['Bassey', 'BASS-ee'], ['Awoniyi', 'ah-woh-NEE-yee'], ['Aina', 'AY-na'], ['Okonkwo', 'oh-KON-kwoh']] },
    Netherlands: { first: ['Daan', 'Sem', 'Jurriën', 'Xavi', 'Tijjani', 'Ryan', 'Cody', 'Micky', 'Jeremie', 'Lutsharel'],
                 last: [['van Dijk', 'van DIKE'], ['de Ligt', 'duh LIKHT'], ['Gakpo', 'GAK-poh'], ['Reijnders', 'RAYN-ders'], ['Simons', 'SEE-mons'],
                        ['Timber', 'TIM-ber'], ['Frimpong', 'FRIM-pong'], ['Gravenberch', 'GRA-ven-berkh'], ['Malen', 'MAH-len'], ['Geertruida', 'khayr-TRAU-da']] },
    Portugal:  { first: ['João', 'Rafael', 'Gonçalo', 'Vitinha', 'Nuno', 'Diogo', 'Rúben', 'Francisco', 'Pedro', 'Bernardo'],
                 last: [['Neves', 'NEH-vesh'], ['Leão', 'leh-OWNG'], ['Ramos', 'RAH-mush'], ['Mendes', 'MEN-desh'], ['Dias', 'DEE-ush'],
                        ['Conceição', 'kon-say-SOWNG'], ['Trincão', 'treen-KOWNG'], ['Semedo', 'seh-MEH-doo'], ['Palhinha', 'pal-YEEN-ya'], ['Inácio', 'ee-NA-syoo']] },
    USA:       { first: ['Christian', 'Weston', 'Gio', 'Tyler', 'Brenden', 'Folarin', 'Ricardo', 'Malik', 'Yunus', 'Chris'],
                 last: [['Pulisic', 'POO-li-sik'], ['McKennie', 'muh-KEN-ee'], ['Reyna', 'RAY-na'], ['Adams', 'AD-ums'], ['Aaronson', 'AIR-un-sun'],
                        ['Balogun', 'BAL-oh-gun'], ['Pepi', 'PEP-ee'], ['Tillman', 'TIL-man'], ['Musah', 'MOO-sah'], ['Richards', 'RICH-erds']] },
    Japan:     { first: ['Takefusa', 'Kaoru', 'Ritsu', 'Wataru', 'Daichi', 'Ao', 'Hiroki', 'Kento', 'Junya', 'Keito'],
                 last: [['Kubo', 'KOO-boh'], ['Mitoma', 'mee-TOH-ma'], ['Doan', 'DOH-an'], ['Endo', 'EN-doh'], ['Kamada', 'ka-MA-da'],
                        ['Tanaka', 'ta-NA-ka'], ['Ito', 'EE-toh'], ['Tomiyasu', 'to-mee-YA-soo'], ['Minamino', 'mee-na-MEE-no'], ['Nakamura', 'na-ka-MOO-ra']] },
    Senegal:   { first: ['Sadio', 'Ismaïla', 'Kalidou', 'Idrissa', 'Nicolas', 'Pape', 'Iliman', 'Boulaye', 'Habib', 'Lamine'],
                 last: [['Mané', 'MAH-nay'], ['Sarr', 'SAR'], ['Koulibaly', 'koo-lee-BAH-lee'], ['Gueye', 'GAY'], ['Jackson', 'JAK-sun'],
                        ['Diallo', 'dee-AL-oh'], ['Ndiaye', 'un-JYE'], ['Dia', 'DEE-ah'], ['Diatta', 'dee-AT-ta'], ['Camara', 'ka-MA-ra']] },
    Saudi_Arabia: { first: ['Salem', 'Saud', 'Firas', 'Abdullah', 'Nasser', 'Turki', 'Musab', 'Saleh', 'Ali', 'Fahad'],
                 last: [['Al-Dawsari', 'al-dow-SAH-ree'], ['Al-Buraikan', 'al-boo-RAY-kan'], ['Al-Shehri', 'al-SHEH-ree'], ['Al-Hamdan', 'al-HAM-dan'], ['Kanno', 'KAN-no'],
                        ['Al-Bulaihi', 'al-boo-LAY-hee'], ['Al-Ghannam', 'al-gan-NAM'], ['Al-Owais', 'al-oh-WAYSS'], ['Al-Malki', 'al-MAL-kee'], ['Bahebri', 'ba-HEB-ree']] },
  };
  const NATIONALITIES = Object.keys(NAME_POOLS).map(k => k.replace('_', ' '));

  // ---- Shop ----
  const SHOP = {
    boots: [
      { id: 'b0', name: 'Battered Academy Boots', price: 0, charm: 0, train: 0, desc: 'Held together with tape and hope.' },
      { id: 'b1', name: 'Velocity Lites', price: 900, charm: 2, train: 4, desc: 'Entry-level speed boot. Slightly sharper training.' },
      { id: 'b2', name: 'Predator Instinct', price: 4500, charm: 5, train: 8, desc: 'Ribbed strike zone. The pros notice.' },
      { id: 'b3', name: 'Mercurial Ghost', price: 18000, charm: 9, train: 12, desc: 'Featherweight carbon plate. Training sessions bite harder.' },
      { id: 'b4', name: 'Signature Gold Edition', price: 80000, charm: 15, train: 16, desc: 'Your initials stitched on the heel. Peak vanity, peak output.' },
    ],
    outfits: [
      { id: 'o0', name: 'Tracksuit & Trainers', price: 0, charm: 0, desc: 'Comfortable. Forgettable.' },
      { id: 'o1', name: 'Smart-Casual Fit', price: 1200, charm: 4, desc: 'Clean lines. Agents return your calls.' },
      { id: 'o2', name: 'Designer Streetwear', price: 7500, charm: 9, desc: 'Limited drop. Photographers linger.' },
      { id: 'o3', name: 'Tailored Suit', price: 25000, charm: 14, desc: 'Boardroom energy. Directors lean in.' },
      { id: 'o4', name: 'Couture Collection', price: 120000, charm: 22, desc: 'Front row material. Elite clubs assume you belong.' },
    ],
    kits: [
      { id: 'k0', name: 'Club Kit', price: 0, charm: 0, desc: 'What the club gives you. Worn around town by default.', club: true },
      { id: 'k1', name: 'Training Bib', price: 200, charm: 1, desc: 'Fluorescent. Nobody looks good in it. Nobody.', shirt: '#c6ff3a', shorts: '#222222', pattern: 'plain' },
      { id: 'k2', name: 'Retro Hoops 1998', price: 1500, charm: 3, desc: 'Baggy, hooped, glorious.', shirt: '#1d5ba4', shirt2: '#ffffff', shorts: '#ffffff', pattern: 'hoops' },
      { id: 'k3', name: 'National Team Kit', price: 4000, charm: 6, desc: 'Your country on your chest. Fans in town notice.', national: true, pattern: 'plain' },
      { id: 'k4', name: 'Candy Stripes', price: 6000, charm: 7, desc: 'Red and white stripes, the classic.', shirt: '#e0202a', shirt2: '#ffffff', shorts: '#222222', pattern: 'stripes' },
      { id: 'k5', name: 'Neon Third Kit', price: 8000, charm: 8, desc: 'Visible from the moon.', shirt: '#ff3cac', shirt2: '#2bffdc', shorts: '#111111', pattern: 'sash' },
      { id: 'k6', name: 'Blackout Kit', price: 15000, charm: 10, desc: 'All black, matte, menacing.', shirt: '#111111', shirt2: '#333333', shorts: '#111111', pattern: 'sash' },
      { id: 'k7', name: 'Legends Gold Kit', price: 40000, charm: 14, desc: 'Gold thread. Worn by people with statues.', shirt: '#f3c34f', shirt2: '#ffffff', shorts: '#ffffff', pattern: 'stripes' },
    ],
    accessories: [
      { id: 'a1', name: 'White Headband', price: 300, charm: 1, slot: 'head', type: 'band', color: '#ffffff', pitch: true, desc: 'Keeps the hair out of your eyes. Allowed on the pitch.' },
      { id: 'a2', name: 'Club Headband', price: 500, charm: 2, slot: 'head', type: 'band', color: 'club', pitch: true, desc: 'In club colours. Allowed on the pitch.' },
      { id: 'a3', name: 'Beanie', price: 600, charm: 2, slot: 'head', type: 'beanie', color: '#2c3e50', pitch: false, desc: 'Town only. Winter energy.' },
      { id: 'a4', name: 'Snapback Cap', price: 900, charm: 3, slot: 'head', type: 'cap', color: '#c0392b', pitch: false, desc: 'Town only. Peak forward, obviously.' },
      { id: 'a5', name: 'Sunglasses', price: 1200, charm: 4, slot: 'face', type: 'shades', color: '#111111', pitch: false, desc: 'Town only. Indoors too. You are a footballer now.' },
      { id: 'a6', name: 'Diamond Earring', price: 8000, charm: 6, slot: 'face', type: 'earring', color: '#e8f4ff', pitch: false, desc: 'Town only. Catches the floodlights.' },
      { id: 'a7', name: 'Silver Chain', price: 3000, charm: 5, slot: 'neck', type: 'chain', color: '#d0d0d0', pitch: false, desc: 'Town only.' },
      { id: 'a8', name: 'Gold Chain', price: 12000, charm: 9, slot: 'neck', type: 'chain', color: '#f3c34f', pitch: false, desc: 'Town only. Heavy.' },
      { id: 'a9', name: 'Wrist Tape', price: 200, charm: 1, slot: 'wrist', type: 'tape', color: '#ffffff', pitch: true, desc: 'Allowed on the pitch. Looks the part.' },
      { id: 'a10', name: 'Luxury Watch', price: 25000, charm: 12, slot: 'wrist', type: 'watch', color: '#f3c34f', pitch: false, desc: 'Town only. Do not wear it to training.' },
      { id: 'a11', name: 'Grip Gloves', price: 400, charm: 1, slot: 'hands', type: 'gloves', color: '#111111', pitch: true, desc: 'Allowed on the pitch. Cold-weather essential.' },
      { id: 'a12', name: 'Tattoo Sleeve', price: 2000, charm: 3, slot: 'arm', type: 'tattoo', color: '#3a4a5a', pitch: true, desc: 'Permanent. Shows on the pitch and in town.' },
    ],
    gear: [
      { id: 'g0', name: 'No Gear', price: 0, energy: 0, train: 0, desc: 'Just you and the cones.' },
      { id: 'g1', name: 'Resistance Bands', price: 600, energy: 5, train: 3, desc: 'Cheap, effective, ugly.' },
      { id: 'g2', name: 'GPS Vest & Tracker', price: 3500, energy: 10, train: 6, desc: 'Data on every sprint. Coaches love it.' },
      { id: 'g3', name: 'Home Gym Setup', price: 15000, energy: 18, train: 10, desc: 'Squat rack in the spare room. More energy every week.' },
      { id: 'g4', name: 'Cryo Chamber & Physio', price: 65000, energy: 30, train: 14, desc: 'Recover like a Champions League squad.' },
    ],
  };

  const CARS = [
    { id: 'c0', name: 'Rusty Sedan', price: 0, charm: 0, art: '  ______\n /|_||_\\`.__\n(   _    _ _\\\n=`-(_)--(_)-\'' },
    { id: 'c1', name: 'City Hatchback', price: 9000, charm: 2, art: '   ____\n __/  |_\\_\n|  _     _`-.\n\'-(_)---(_)--\'' },
    { id: 'c2', name: 'Executive Saloon', price: 32000, charm: 5, art: '   _______\n __/   |   \\__\n|  _        _ |\n`-(_)------(_)-\'' },
    { id: 'c3', name: 'Luxury SUV', price: 75000, charm: 8, art: ' ____________\n|  ____  ____ |\n| |    ||    ||\n`-(_)------(_)\'' },
    { id: 'c4', name: 'Sports Coupé', price: 180000, charm: 13, art: '      _____\n  ___/_____\\___\n /  _         _ \\\n`-(_)-------(_)-\'' },
    { id: 'c5', name: 'Supercar', price: 450000, charm: 20, art: '   ___________\n _/  _______  \\_\n/ _/         \\_ \\\n`(_)=========(_)\'' },
    { id: 'c6', name: 'Hypercar', price: 1500000, charm: 30, art: '  ______________\n_/ ____________ \\_\n(_/            \\_)\n `(_)========(_)\'' },
  ];

  const ESTATES = [
    { id: 'h0', name: 'Academy Digs', price: 0, charm: 0, energy: 0, fame: 0, desc: 'A box room above the club canteen.' },
    { id: 'h1', name: 'City Apartment', price: 45000, charm: 4, energy: 5, fame: 1, desc: 'Ninth floor. You can see the training ground floodlights.' },
    { id: 'h2', name: 'Townhouse', price: 220000, charm: 8, energy: 10, fame: 2, desc: 'Three floors, a garage, and neighbours who pretend not to notice you.' },
    { id: 'h3', name: 'Gated Villa', price: 900000, charm: 14, energy: 15, fame: 4, desc: 'Pool, pitch, and a security guard called Dev.' },
    { id: 'h4', name: 'Coastal Mansion', price: 3500000, charm: 22, energy: 20, fame: 6, desc: 'Helipad optional. Paparazzi not.' },
  ];

  // ---- Commentators ----
  const COMMENTATORS = { play: 'John', color: 'Ally' };

  root.PPL_DATA = { POSITIONS, ATTR_LABELS, GK_ATTR_LABELS, LEAGUES, NAME_POOLS, NATIONALITIES, SHOP, CARS, ESTATES, COMMENTATORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PPL_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
