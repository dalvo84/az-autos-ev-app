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
| `styles.css` | Retro handheld look |

`engine.js` loads in Node as well, which is how the balance was tuned:

```
node -e "const E=require('./pocket-pro-league/engine.js'); console.log(E.newGame({name:'A',pron:'A',pos:'ST',nat:'England'}).player)"
```

## Game loop

1. **Phase 1** — John and Ally ask for name, pronunciation, position and nationality. Ten academy teammates are generated with pronunciation guides the commentators reuse.
2. **Phase 2** — 90+5 penalty in the Regional Academy Final. Miss and the engine rewinds until you score. Then three lower-tier clubs offer academy deals.
3. **Phase 3** — Weekly loop: Home (contract, garage, estate), Shopping Center (boots, outfits, fitness gear), Training Ground (energy for +1 attribute rolls), Stadium (Full Match, Highlights, Sim, Quick Sim). Every league in the database plays its round each week.
4. **Phase 4** — Every 20 weeks the transfer window opens with up to three offers driven by OVR, form and charm.

## Sound

John and Ally speak every commentary line through the browser's built-in speech voices. John is pitched low, Ally high, and the game prefers two different British English voices when the device has them. Pronunciation guides are used as the spoken form, so a teammate written as `Dyer (DYE-er)` is said the way the guide reads. Goals, misses, kick-off, full time and Man of the Match each trigger synthesised crowd and whistle effects. Browsers only allow audio after a tap, so sound starts on the first button press. The toggle in the title bar mutes everything and remembers the choice.

## Mechanics worth knowing

- Coach popularity under 35 puts you on the bench, under 15 out of the squad.
- Chemistry scales how often the ball finds you in a match, up to 3× at 100.
- Fame 50+ triggers fan encounters at the hub, shops and home.
- Charm tilts transfer offers toward higher-tier clubs.
