# CLAUDE.md

Read this first. It's short on purpose — everything else is linked, not duplicated.

## What this is

**The Vault** — a cozy, procedurally-generated first-person key-and-lock puzzle game.
Plain JavaScript + Three.js (r128, via CDN). No build step, no bundler, no framework,
no package.json. Opening `index.html` in a browser *is* the whole deployment story.

The core loop: find a key somewhere in the room, carry it around, recognize which
lock it visually matches (by color, symbol, metal, engraving, scratches, a gem, a
keyhole/teeth shape, or a stamped number — never by text), walk over, try it, watch
the container physically open.

## Read these, in this order, before changing anything

1. **`roadmap.md`** — the current phase and what's queued up next. This project is
   worked phase by phase; don't jump ahead.
2. **`history.md`** — what's already been done, and why, in roughly chronological order.
3. **`.claude/dev_notes.md`** — known quirks, gotchas, and hard-won lessons. Several
   real bugs were found and fixed during development; the notes explain the *class*
   of bug, not just the specific fix, so it doesn't recur in a new form.
4. **`README.md`** — architecture, file layout, load order, the settings system.
5. **`tests/README.md`** — what the offline test suite can and can't verify for you.

## How work happens here

Every phase in `roadmap.md` follows the same cycle:

1. **Investigate.** Read the relevant code. Understand current behavior. Don't change
   anything yet.
2. **Propose a plan.** Post a concise plan — what will change, what won't, and any open
   questions or judgment calls worth flagging — and wait for it to be confirmed before
   writing code. Don't skip this step even when a phase looks obvious; several items on
   the roadmap are deliberately open-ended (see `roadmap.md`'s notes on each phase) and
   need a decision made explicit before implementation.
3. **Implement** the confirmed plan.
4. **Verify.** Run the tests in `tests/` (see below — read what they do and don't cover
   before trusting a green run). If the phase touched anything visual, say so plainly in
   the summary rather than implying it's been checked, since there's no way to render a
   screenshot from this environment.
5. **Update docs:**
   - `README.md` if the architecture, file layout, or a system's behavior changed.
   - `roadmap.md` — mark the phase done, and adjust later phases if this one changed
     assumptions they were relying on.
   - `.claude/dev_notes.md` if you hit a non-obvious gotcha worth remembering.
6. **Append to `history.md`** (its header explains the expected entry format).
7. **Present a summary** of what changed, any decisions made along the way, and confirm
   the project is in a clean, working state — ready to hand off to the next phase.

Stop after the summary. Don't start the next phase in the same turn unless explicitly
asked to.

## Running & testing

Open `index.html` directly in a browser to play it. There's no dev server requirement,
though if local file-loading restrictions ever get in the way, any static file server
works (`npx serve .`, `python3 -m http.server`).

For logic/state verification without a browser:

```
cd tests
node logic_test.js
node integration_test.js
```

These run the actual game code (not a reimplementation of it) against a lightweight
Three.js stand-in. Read `tests/README.md` before trusting a green run — it explains
exactly what this can and can't catch, most importantly that **nothing about visual
appearance is verified**, only state and logic.

## Hard constraints — don't casually change these

- **No build step.** Files load as plain `<script src="...">` tags, in dependency
  order, sharing one global scope. Don't introduce `import`/`export`, a bundler, or
  `type="module"` without a very good reason and an explicit call-out in the plan —
  it would break the load-order model the whole project relies on.
- **Three.js stays pinned to r128** loaded from cdnjs. This predates Three.js's later
  color-management overhaul, which is why material colors behave predictably as plain
  hex values throughout the codebase. Upgrading is possible but would require
  revisiting color handling project-wide — flag it as its own decision if it comes up,
  don't fold it into an unrelated phase.
- **No external image or audio assets currently exist** — every texture is canvas-drawn
  at runtime (`textures.js`) and every sound is synthesized (`audio.js`). The roadmap's
  first phase explicitly opens the door to reconsidering this; until that phase, assume
  the no-assets constraint still holds.
- **Persistence is IndexedDB (localStorage fallback), not any host-specific API.** The
  game needs to work as a fully standalone set of files, opened from anywhere.

## Project structure

See `README.md` for the full breakdown. Short version: `index.html` (markup only),
`css/style.css` (all styling), `js/*.js` (ten files, one per system, loaded in
dependency order), `tests/` (offline verification).
