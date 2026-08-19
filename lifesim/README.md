# ONE LIFE — 0 to 110

A 3D life simulation. Born in Shillington, three decisions a year, every year,
from nought to a hundred and ten. **Every single decision is its own 3D level.**

## Running it

Three ways, easiest first.

**1. One file, double-click it.** `dist/one-life.html` is the whole game —
markup, styles, three.js and all — in a single self-contained file. Open it
straight off the disk, email it, put it on a USB stick. No server, no install.

**2. Published as a link.** The same build published as an Artifact, so it
opens on any device including a phone. Rebuild and republish with
`node build.mjs --artifact`.

**3. From source, with a server.** ES modules need a real origin, so opening
`index.html` off the disk will *not* work:

```bash
cd lifesim
python3 -m http.server 8777
# then open http://localhost:8777
```

No install and no internet needed — three.js is vendored in
`vendor/three.module.js`. Fonts come from Google Fonts and fall back cleanly
to system faces when offline.

### Rebuilding the single file

```bash
npm i esbuild
node build.mjs              # dist/one-life.html      — standalone
node build.mjs --artifact   # dist/one-life.artifact.html — body-only
```

## How it plays

- **111 years, 3 questions a year, 333 decisions** — one question at a time.
- **4 choices per question.** Three written ones plus "make your own", where you
  type whatever you want and the game reads it and works out what it did to you.
- **Some questions let you pick two.** Picking two splits the benefit — you get
  most of both, not all of both.
- **Every decision is a level.** Level 1 is a nursery in Shillington with the
  speakers on. Level 333 is somewhere a very long way from there.
- **Random challenges** gatecrash the year without warning.
- **Achievements and secret achievements**, and every one of them carries a perk
  — permanent multipliers on XP, earnings, stat growth or raw talent.

Keyboard: `A` `B` `C` `D` to choose, `Enter` to lock it in and to carry on.
Drag the scene to look round it, scroll to zoom.

## The character

Starts naughty, very happy, ambivert, and with the talent multipliers stacked:

| Stat | Talent | Why |
| --- | --- | --- |
| Business | ×2.2 | Business-minded creativity, massive |
| Creativity | ×2.2 | Same |
| Music | ×1.9 | Very good at rapping and singing |
| Athleticism | ×1.8 | Extra athleticism |
| Code | ×1.7 | Very good at Scratch |
| Naughtiness | ×1.5 | 👿 |
| Happiness | ×1.4 | Very happy |

Talent multiplies every gain, so a +5 to Business is really a +11. Perks from
achievements stack on top of that.

## What is scripted

Ages 0–21 are hand-written year by year. After that the stage pools take over,
generating questions from your actual state — who you know, what you own, what
you have already done.

Fixed storylines that always happen or always can:

- **The music, age 0.** Dad puts the speakers on. Linkin Park, Eminem, 2Pac,
  Biggie — clean versions.
- **Mario, age 4.** Three foot six of him. Played with for two years, goes in the
  loft at 6, forgotten completely, and found again at **age 10** with a torch.
  He can then follow you the rest of your life, or not.
- **Oscar.** Born the same day as you, in the room next door, and neither of you
  finds out until you are eleven.
- **Football.** Little Kickers 1–2 (best there), Shillington Sharks 2–10 (folds),
  Baldock Knights 11 onwards, Arlesey Town for exactly one season at 11 (best
  player they ever had, folds a year later). Two clubs folding under you sets up
  a promise you can keep forty years later.
- **Swimming** 2–9. **Scratch** from 7. **WWE** from 9.
- **Places.** Shillington → Hitchin → Meppershall → Letchworth.
  **Schools.** Shillington Lower → RBA → Saint Chris.
- **People.** Mum Alex, Dad David, sister Elowen (arrives when you are 2),
  cousins Ollie (b. 2011), Blake (5), Willa (8), Preston (10). Friends: Boyd from
  birth, Ollie B at lower school, and Ollie C, Jack, Forrest, Ollie (Hen) and
  Oscar all in Year 6.

## Layout

```
lifesim/
├── index.html            shell + HUD + cards
├── build.mjs             bundles everything into dist/one-life.html
├── dist/one-life.html    the whole game in one double-clickable file
├── css/style.css
├── vendor/three.module.js
└── src/
    ├── main.js           boot and the year loop wiring
    ├── engine.js         question selection, effects, achievements, obituary
    ├── state.js          stats, XP, levels, save/load
    ├── ui.js             all DOM rendering
    ├── custom.js         reads your typed answers and scores them
    ├── stage3d.js        renderer, camera, level swap
    ├── world.js          21 environment builders
    ├── actors.js         low-poly people, the toy, props
    ├── rng.js            seeded RNG — same seed, same life
    └── content/
        ├── people.js        family and the seven friends
        ├── timeline.js      places, schools, clubs, stages
        ├── story_early.js   scripted ages 0-12
        ├── story_teen.js    scripted ages 13-21
        ├── pools.js         generated questions, 22-110, plus challenges
        └── achievements.js  achievements, secrets and their perks
```

Saves to `localStorage` after every decision. Seeds are deterministic — the same
seed gives the same questions and the same-looking levels.
