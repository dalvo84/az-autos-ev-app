# FC1 — Football Civilian, Volume 1

A football career RPG in the style of a retro pixel mobile game: real-time matches, a walkable town, and a career with a life around it. Plain HTML, CSS and JavaScript with no build step.

## Run it

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8080 --directory fc1
```

Progress autosaves to `localStorage` after every screen.

## Structure

| File | Role |
| --- | --- |
| `data.js` | Positions and OVR weightings, nine real leagues with club strengths, name pools with pronunciation guides, shop, cars, estates |
| `engine.js` | Pure logic: OVR calculator, fixture generation, league simulation, choice-based match engine, training, transfer offers, season rollover |
| `app.js` | Screens and flow: character creation, prologue penalty, hub, home, shop, training, stadium, match modes, transfer window, manager talks, agent, internationals, phone, dating and family, retirement |
| `audio.js` | Commentator voices via the Web Speech API, plus whistle, crowd and chant effects synthesised with Web Audio (no audio files) |
| `sprites.js` | Pixel character models (customisable look for the player, randomised for NPCs) and club kits |
| `controls.js` | Virtual joystick and action buttons for touch, keyboard bindings for desktop |
| `arcade.js` | Real-time top-down match engine: physics ball, 22 players, attribute-driven AI, keepers, fouls and set pieces, stamina, weather, replays, celebrations, camera, HUD |
| `world.js` | Walkable open world: town, house (two floors), Shopping Center (two floors), training ground, stadium tunnel, agent's office, with furniture you use, weekly perks, timing mini games, and your partner and children at home |
| `cutscene.js` | Cutscene engine and scenes: contract signing, trophy lift, awards gala, debut, man of the match, season highlights reel, wedding, new baby, retirement lap of honour |
| `styles.css` | Retro handheld look |

`engine.js` loads in Node as well, which is how the balance was tuned:

```
node -e "const E=require('./fc1/engine.js'); console.log(E.newGame({name:'A',pron:'A',pos:'ST',nat:'England'}).player)"
```

## Game loop

1. **Phase 1** — John and Ally ask for name, pronunciation, position and nationality. Ten academy teammates are generated with pronunciation guides the commentators reuse.
2. **Phase 2** — 90+5 penalty in the Regional Academy Final. Miss and the engine rewinds until you score. Then three lower-tier clubs offer academy deals.
3. **Phase 3** — Weekly loop: Home (contract, garage, estate), Shopping Center (boots, outfits, kits, accessories, fitness gear), Training Ground (energy for +1 attribute rolls), Stadium (Full Match, Highlights, Sim, Quick Sim). Every league in the database plays its round each week.
4. **Phase 4** — Every 20 weeks the transfer window opens with up to three offers driven by OVR, form and charm.

## Playing a match

Play Full Match (two halves of 150 seconds) and Play Highlights (two halves of 60 seconds) put you on the pitch controlling your own player. Teammates and opponents are AI driven by their attributes, and chemistry makes your teammates look for you more often. Your rating comes from goals, assists, shots on target, completed passes, tackles won and, for keepers, saves. The score and rating feed the same career engine as the text modes.

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move | Joystick (drag anywhere on the left of the pitch) | WASD or arrow keys |
| Shoot / kick (hold for power) | SHOOT | Space |
| Pass / throw | PASS | P |
| Sprint with the ball, slide tackle without it, dive as a keeper | SKILL | Z |

Touch controls appear only on touch devices. On a computer a key legend shows instead, with a toggle to bring the touch controls back.

### Difficulty

Chosen at the stadium before a match and remembered. It scales the opposition only: their running speed, how often their tackles succeed against you, how often and how accurately they shoot and pass, and how good their keeper is against your shots. Harder levels add a small bonus to your full-time rating.

| Level | Feel |
| --- | --- |
| Beginner | Opponents jog, rarely tackle and shoot wildly |
| Amateur (default) | Gentle Sunday league, good for learning the controls |
| Semi-Pro | Fair fight |
| Professional | Opponents play to their attributes |
| Legendary | Faster, sharper, keepers are a wall |
| Ultimate | Every duel is uphill |
| NIGHTMARE | They are faster than you and they never miss |

Your player always runs a little quicker than the raw Pace number suggests, and the joystick reaches full speed at just over half deflection, so a controlled player feels responsive against AI at every level.

Keepers have a reaction delay on your shots, and hard or well-placed strikes beat them more often, so around a third of shots from the edge of the box go in at Amateur. Attackers hold an offside line and cannot camp on the goal. Everyone kicks off in their own half. Teammates weight you heavily as a pass target, far more when you press PASS without the ball to call for it. As a goalkeeper you auto-position when the stick is idle, the camera follows play, and SKILL is a directional dive.

If your coach popularity is under 35 you start on the bench and come on for the last third of the match. Under 15 you are not in the squad and can only sim the match.

## Open world

The town is full screen. Walking into a door takes you inside. Every room has furniture you can walk up to and use with ENTER, and the map you were on is remembered when you come back from a screen.

| Place | What is there |
| --- | --- |
| House, ground floor | TV (league tables), sofa (nap, or a movie night with a partner who lives with you), trophy cabinet (career), fridge (snack, +6 energy weekly), garage door, stairs |
| House, upstairs | Bed (sleep, +15 energy weekly), phone (social media, dating, family), mirror (appearance), balcony |
| Shopping Center, ground | Boot wall, outfit rail, kits, accessories and gifts, café (coffee, $25 for +6 energy weekly), date table (dinner with your partner, $60 weekly), escalator |
| Shopping Center, upstairs | Fitness gear, car showroom, estate agent, barber (appearance), escalator |
| Training ground | Gym (timing mini game, better odds than menu training), pitch (training menu), coach's office (manager talks), physio (+10 energy weekly, or a week off an injury), teammates wandering |
| Stadium tunnel | Dressing room (squad and your rival), press room (+1 fame, +1 charm weekly once you have some fame), trophy room, megastore (buy your own shirt once Fame passes 30), tunnel to the pitch (match day) |
| City Hall | Registrar (marry your partner with Charm 40, Fame 25 and $500, no ring needed), the queue (three people a week with their details, ask one out at 50/50), notice board, bench |
| Town | Agent's office (quests and sponsors), park keepy-uppies (timing mini game, 20 energy for a chance of +1 attribute), bus stop to the stadium, fans once Fame passes 50 |

## Kits and accessories

Kits are worn around town in place of the club kit and raise Charm: training bib, retro hoops, a national team kit in your country's colours, candy stripes, a neon third kit, a blackout kit and a gold legends kit. Matches always use club colours.

Accessories fill slots on your model: head, face, neck, wrist, hands and arm. Headbands, wrist tape, gloves and the tattoo sleeve are pitch-legal and show in matches. Beanies, caps, sunglasses, earrings, chains and the watch are town only. Each adds Charm when bought, and you can take any of them off in the shop.

## Cutscenes and celebrations

- **Goal celebrations** in the match: the scorer runs to the corner and teammates mob him. From the 85th minute, or for a hat-trick, it becomes a knee slide, the whole team piles in, confetti and fireworks, a LATE DRAMA banner and the commentators lose it.
- **Contract signing** on every deal: boardroom, chairman, agent, flashbulbs, and you in a suit.
- **Trophy lift** when your club wins the league: night stadium, the squad on the podium, fireworks and ticker tape.
- **Awards gala** at season end: Golden Boot, Young Player of the Year (21 and under), League Player of the Year, and the Ballon d'Or for a top-tier league, a top-three finish and an outstanding season. Awards add Fame and fans and appear under Honours on the career screen.
- **Man of the Match** presentation after any match you dominate, and a **debut** walk out of the tunnel before your first professional match.

Every cutscene has a SKIP button.

## Match depth

- **Fouls and set pieces.** Mistimed slides are fouls. A free kick or penalty stops play: aim with the stick, hold SHOOT for power, or PASS for a short one. Fouls in the box are penalties and the keeper picks a side.
- **Cards, bans and injuries.** A yellow costs coach popularity, a red costs more and bans you for the next match. A bad tackle can injure you for a few weeks, during which you can only sim; the physio takes a week off.
- **Stamina.** Sprinting drains it and tired players slow down. Fitness gear raises the ceiling. With no stamina left you get substituted.
- **Weather.** Rain makes the ball skid and slides travel further. Night games play under floodlights.
- **Derbies.** Real rivalries (Manchester, Merseyside, El Clásico and the rest) get a louder crowd and a fame bonus for winning.
- **Replays and highlights.** Every goal gets a slow-motion replay you can tap through. Your own goals are saved as clips and cut into a season highlights reel at the end of the year.
- **Crowd and commentary.** Stands fill with your club's colours, chants rise on big moments, and John and Ally remember what happened last time you met an opponent.

## Career

- **Manager talks** in the coach's office: minutes, a position change, press conferences, a transfer request, or a check-in. Each has a cost and a cooldown.
- **Agent quests and sponsors.** The agent offers goal, assist, clean sheet, rating and win targets over a run of matches, and brand deals that pay weekly.
- **A rival for your shirt.** A teammate in your position competes for the starting place. Outperform him or lose your spot.
- **Internationals.** Reach the call-up threshold for your nation and you play friendlies in the international breaks. Every fourth season is a World Cup you can play through stage by stage, or sim.
- **Ageing and retirement.** From 31 pace and physical drop each season. Retire from 34, or earlier once the numbers fall away, for a lap of honour and a place in the Hall of Fame on the menu.

## Life

The phone upstairs has two tabs.

- **Social.** Post once a week for fans and fame, with a small backlash risk. Brands approach you at Fame 25, 45, 65 and 85 with weekly deals.
- **Dating and family.** Three people a week to ask out; Charm and Fame set the odds. Messages, gifts from the shop's gifts tab, café dates and movie nights build love. Love falls if you ignore them for two weeks and they leave under 10. After eight weeks and a real home you can ask them to move in, which gives energy every week and puts them in your house. With a ring from the shop and love at 85 you can propose, which plays the wedding. City Hall is the other route: with Charm 40, Fame 25 and $500 the registrar marries you the same day, as long as love is at least 40. The queue at City Hall is another way to meet someone: you see their age, job, nationality and what they like, pick one, and it is a straight 50/50. Married couples can start a family; the baby arrives eight weeks later with its own cutscene, and the children wander the house.

## Sound

John and Ally speak every commentary line through the browser's built-in speech voices. John is pitched low, Ally high, and the game prefers two different British English voices when the device has them. Pronunciation guides are used as the spoken form, so a teammate written as `Dyer (DYE-er)` is said the way the guide reads. Goals, misses, kick-off, full time and Man of the Match each trigger synthesised crowd and whistle effects. Browsers only allow audio after a tap, so sound starts on the first button press. The toggle in the title bar mutes everything and remembers the choice.

## Mechanics worth knowing

- Coach popularity under 35 puts you on the bench, under 15 out of the squad.
- Chemistry scales how often the ball finds you in a match, up to 3× at 100.
- Fame 50+ triggers fan encounters at the hub, shops and home.
- Charm tilts transfer offers toward higher-tier clubs.
