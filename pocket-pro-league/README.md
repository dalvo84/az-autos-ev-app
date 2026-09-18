# Pocket Pro League

A text-based football career RPG in the style of a retro pixel mobile game. Plain HTML, CSS and JavaScript with no build step.

## Run it

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8080 --directory pocket-pro-league
```

Progress autosaves to `localStorage` after every screen.

## Structure

| File | Role |
| --- | --- |
| `data.js` | Positions and OVR weightings, nine real leagues with club strengths, name pools with pronunciation guides, shop, cars, estates |
| `engine.js` | Pure logic: OVR calculator, fixture generation, league simulation, choice-based match engine, training, transfer offers, season rollover |
| `app.js` | Screens and flow: character creation, prologue penalty, hub, home, shop, training, stadium, match modes, transfer window |
| `audio.js` | Commentator voices via the Web Speech API, plus whistle, crowd and chant effects synthesised with Web Audio (no audio files) |
| `sprites.js` | Pixel character models (customisable look for the player, randomised for NPCs) and club kits |
| `controls.js` | Virtual joystick and action buttons for touch, keyboard bindings for desktop |
| `arcade.js` | Real-time top-down match engine: physics ball, 22 players, attribute-driven AI, keepers, halves, camera, HUD |
| `world.js` | Walkable open world: town, house (two floors), Shopping Center (two floors), training ground, stadium tunnel, agent's office, with furniture you use and weekly perks |
| `styles.css` | Retro handheld look |

`engine.js` loads in Node as well, which is how the balance was tuned:

```
node -e "const E=require('./pocket-pro-league/engine.js'); console.log(E.newGame({name:'A',pron:'A',pos:'ST',nat:'England'}).player)"
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

If your coach popularity is under 35 you start on the bench and come on for the last third of the match. Under 15 you are not in the squad and can only sim the match.

## Open world

The town is full screen. Walking into a door takes you inside. Every room has furniture you can walk up to and use with ENTER, and the map you were on is remembered when you come back from a screen.

| Place | What is there |
| --- | --- |
| House, ground floor | TV (league tables), sofa (nap, +10 energy weekly), trophy cabinet (career), fridge (snack, +6 energy weekly), garage door, stairs |
| House, upstairs | Bed (sleep, +15 energy weekly), laptop (contract and estate), mirror (appearance), balcony |
| Shopping Center, ground | Boot wall, outfit rail, kits and accessories, café (coffee, $25 for +6 energy weekly), escalator |
| Shopping Center, upstairs | Fitness gear, car showroom, estate agent, barber (appearance), escalator |
| Training ground | Gym and pitch (training), coach's office (+2 coach weekly), physio (+10 energy weekly), teammates wandering |
| Stadium tunnel | Dressing room (squad), press room (+1 fame, +1 charm weekly once you have some fame), trophy room, tunnel to the pitch (match day) |
| Town | Agent's office, park kickabout (20 energy for a chance of +1 attribute), bus stop to the stadium, fans once Fame passes 50 |

## Kits and accessories

Kits are worn around town in place of the club kit and raise Charm: training bib, retro hoops, a national team kit in your country's colours, candy stripes, a neon third kit, a blackout kit and a gold legends kit. Matches always use club colours.

Accessories fill slots on your model: head, face, neck, wrist, hands and arm. Headbands, wrist tape, gloves and the tattoo sleeve are pitch-legal and show in matches. Beanies, caps, sunglasses, earrings, chains and the watch are town only. Each adds Charm when bought, and you can take any of them off in the shop.

## Sound

John and Ally speak every commentary line through the browser's built-in speech voices. John is pitched low, Ally high, and the game prefers two different British English voices when the device has them. Pronunciation guides are used as the spoken form, so a teammate written as `Dyer (DYE-er)` is said the way the guide reads. Goals, misses, kick-off, full time and Man of the Match each trigger synthesised crowd and whistle effects. Browsers only allow audio after a tap, so sound starts on the first button press. The toggle in the title bar mutes everything and remembers the choice.

## Mechanics worth knowing

- Coach popularity under 35 puts you on the bench, under 15 out of the squad.
- Chemistry scales how often the ball finds you in a match, up to 3× at 100.
- Fame 50+ triggers fan encounters at the hub, shops and home.
- Charm tilts transfer offers toward higher-tier clubs.
