# The Vault

A cozy, procedurally-generated first-person key-and-lock puzzle game. Built with plain JavaScript and Three.js — no build step, no bundler, no framework.

> **Working on this project?** Start with `CLAUDE.md` — it covers the phase-by-phase
> workflow this project follows, plus pointers to `roadmap.md` (what's next),
> `history.md` (what's already been done), and `.claude/dev_notes.md` (gotchas worth
> knowing before you touch things).

## Running it

Open `index.html` in a browser. That's it.

If your browser restricts local file loading for scripts/stylesheets (rare, but some strict setups do), serve the folder instead of double-clicking it:

```
npx serve .
# or
python3 -m http.server
```

Requires an internet connection on first load (Three.js and two Google Fonts load from CDNs); after that, everything — geometry, textures, sound — is generated at runtime.

## Project structure

```
the-vault/
├── CLAUDE.md            Start here if you're working on this project
├── roadmap.md           Future work, phase by phase
├── history.md           What's been done, in roughly chronological order
├── README.md            This file
├── .claude/
│   └── dev_notes.md     Known gotchas and hard-won lessons
├── index.html          HTML shell + all UI markup (HUD, modals, screens)
├── css/
│   └── style.css       All styling — design tokens, layout, animations
├── js/
│   ├── utils.js         Seeded RNG, easing/math helpers, the shared Tweens runner
│   ├── audio.js         AudioManager — every sound is synthesized, no audio files
│   ├── generator.js     Puzzle generation — clue dimensions, matching logic, rewards, settings schema
│   ├── textures.js       Every material is a canvas-drawn procedural texture
│   ├── world.js          VaultWorld — the room, furniture, box wall, containers
│   ├── player.js         First-person movement + input (desktop & mobile)
│   ├── interaction.js    Raycasting, physical key handling, unlock logic
│   ├── ui.js             HUD, prompts, modals, mobile control bindings
│   ├── save.js           SaveManager — IndexedDB persistence (localStorage fallback)
│   └── game.js           Bootstraps everything and runs the render loop
└── tests/               Offline logic/state tests — see tests/README.md for what they
                         do and don't verify
```

### Load order matters

The scripts are loaded as plain (non-module) `<script>` tags, in dependency order, at the
end of `index.html`:

```
utils → audio → generator → textures → world → player → interaction → ui → save → game
```

Each file declares top-level `const`/`class` values (e.g. `const Utils = …`, `class VaultWorld`)
that later files reference directly — this works because classic `<script>` tags in the same
document share one global scope. There's no module system, no `import`/`export`, and nothing
to build or transpile.

### Where to look for what

- **Want to change the puzzle logic (clue types, matching, rewards)?** → `generator.js`
- **Want to change what something looks like (materials, the rug, the box wall)?** → `textures.js` and `world.js`
- **Want to change controls?** → `player.js` (movement/look) and `interaction.js` (what happens when you click)
- **Want to change the HUD or screens?** → `ui.js` and the markup/styles in `index.html` / `style.css`
- **Want to change sound?** → `audio.js` — everything is synthesized with the Web Audio API
- **Want to change how saving works?** → `save.js`
- **Want to add a new adjustable game setting?** → `generator.js`'s `SETTINGS_SCHEMA` (see below)

## The settings system

Starting a new vault (via **Enter the Vault**, the reset button mid-game, or **New Vault** on
the win screen) opens a settings panel before anything is generated. It currently exposes:

- **Deposit Boxes** — how many safety deposit boxes line the wall (24–100)
- **Extra Containers** — how many scattered containers (jewelry boxes, suitcases, safes, etc.)
  appear around the room (4–20)
- **Pattern Difficulty** — how often a lock is identified by more than one visual detail at once

This panel is entirely schema-driven from `Generator.SETTINGS_SCHEMA` in `generator.js`:

```js
const SETTINGS_SCHEMA = [
  { key:'wallBoxes', label:'Deposit Boxes', type:'range', min:24, max:100, step:2, default:72,
    hint:'How many safety deposit boxes line the wall.' },
  // ...
];
```

`ui.js`'s `renderSettingsFields()` builds the actual controls (range sliders, selects) from
this list automatically. **To add a new adjustable feature, add an entry to `SETTINGS_SCHEMA`
and read `puzzle.settings.<yourKey>` wherever it should take effect** — no UI code to write by
hand. The chosen settings are saved alongside the seed, so a saved-in-progress vault always
regenerates with the settings it was created under, even if you change the defaults later.

## Design notes

- **The puzzle is purely visual.** Matching is done through 9 physical clue dimensions
  (color, symbol, metal, wear/scratches, ribbon, engraving motif, key-teeth/keyhole shape,
  gem inlay, engraved number). `generator.js` guarantees every container's full visual
  "fingerprint" is globally unique, so there's always exactly one honest match — never an
  accidental coincidence.
- **Keys are physical objects**, never UI icons. Picking one up reparents the real mesh to
  the camera; it can be inspected, swayed while walking, and — when it successfully opens
  something — stays visibly plugged into that lock rather than vanishing.
- **Placing a key is two steps, not one.** Press Drop once to start aiming (the key follows
  wherever you're looking, raycasting against the room so it can rest on a tabletop, a tray,
  or the floor); press Drop again to set it down exactly there. This is what makes the sorting
  table actually useful — walk up, aim into a tray, place. There's also a separate empty
  sorting table (distinct from the table the keys start on) with a few shallow trays, purely
  for organizing keys into as you rule them out.
- **No text clues anywhere in the HUD.** Prompts are single verbs (*Pick Up*, *Try Key*,
  *Locked*); the world communicates every clue.
- **No native browser dialogs.** Resetting or starting a new vault goes through the in-page
  settings panel rather than `window.confirm()`, which some embedding contexts can silently
  block — nothing destructive happens until you explicitly click Begin inside it.
