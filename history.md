# Project History

A chronological log of what's been done and why. Each phase from `roadmap.md` appends
one entry here when it's finished — this file is a record, not a plan (that's
`roadmap.md`) and not a how-to (that's `README.md` / `CLAUDE.md` / `.claude/dev_notes.md`).

**Entry format:**

```
## [Phase N or "Pre-roadmap"] — Title — YYYY-MM-DD

**Goal:** one or two sentences.

**What changed:** the actual changes, in prose or a short list — enough that someone
reading only this file understands what's different afterward, without needing to
diff the code.

**Decisions made / judgment calls:** anything decided along the way that wasn't
fully specified upfront, and why.

**Known follow-ups:** anything deliberately left for later, and where (which future
phase, or "not scheduled").
```

---

## Pre-roadmap — Initial development — 2026-07-27

Everything from the first prototype through to the point this roadmap/history/dev-notes
setup was introduced, condensed into one entry since it happened as a continuous session
rather than discrete planned phases.

**What changed, roughly in order:**

- **Initial prototype:** core loop (find key, inspect, match, unlock, discover reward)
  built as a single HTML file — procedural room, Three.js scene, seeded puzzle
  generation, Web Audio synthesized sound, save via a host-provided storage API.
- **Physical keys & scale-up:** keys became real carried/dropped 3D objects instead of
  UI-driven pickups; all clue-describing HUD text removed (matching became purely
  visual); the vault expanded from ~9–14 boxes to 60–100 wall boxes plus 10–20 scattered
  containers (jewelry boxes, suitcases, safes, filing drawers, standing vaults, display
  cases), each with its own physical open animation; lighting significantly reworked
  for brightness and evenness.
- **Bug-fix pass:** fixed keys not rendering while held (camera wasn't in the scene
  graph — see `.claude/dev_notes.md` #1), key-pile clipping through the sorting table,
  floating light fixtures with no visible source, and uneven/over-reflective wall
  lighting (dedicated wash lights added, sconces moved away from the box wall, brass
  roughness tuned down).
- **Art/detail pass:** ornate Persian-style rug (replacing a flat placeholder), reduced
  box-wall reflectivity further with per-box frame variation, a distinct leather-inset
  key table, architectural trim (baseboard/wainscot/chair rail/crown molding), and full
  rebuilds of the window (multi-pane + curtains + window seat), fireplace (marble
  surround, mantel details, tools, art), bookshelf (taller, more varied), and memento
  shelf, plus two new furniture pieces (reading nook, curio cabinet) to use the room's
  wall space.
- **Project structure:** split from one HTML file into `index.html` / `css/style.css`
  / ten `js/*.js` files loaded in dependency order, with a README documenting the
  architecture.
- **Settings system & button fixes:** replaced `window.confirm()`-based reset (see
  `.claude/dev_notes.md` #3) with an in-page, schema-driven settings modal (deposit
  box count, extra container count, pattern difficulty), wired into the reset button,
  the initial start flow, and the win-screen "new vault" flow; hardened the mute
  button's audio gain handling.
- **Door-animation bug fix, sorting table, key placement rework:** fixed box-opening
  animations silently never running (see `.claude/dev_notes.md` #2 — this was the
  single most impactful bug found in the project); added a second, empty sorting table
  with shallow trays; reworked key-dropping into a two-stage aim-then-place flow
  (press once to aim via raycast against the room, press again to set down) so the
  sorting table is actually usable for organizing keys.
- **This setup:** added `CLAUDE.md`, `.claude/dev_notes.md`, `roadmap.md`, this file,
  and an offline `tests/` suite (`three_stub.js` + `logic_test.js` +
  `integration_test.js`) covering puzzle solvability, world construction, the full
  interaction state machine, save/restore, and the settings/reset flow.

**Decisions made / judgment calls:**

- No visual rendering was ever available during development — every geometric and
  lighting decision was reasoned through mathematically, never screenshot-verified.
  See `.claude/dev_notes.md`'s "reasoned through but never confirmed" section before
  assuming anything visual is a known-good baseline.
- Save compatibility across schema changes was explicitly *not* solved — see the
  "save/seed determinism" section of `.claude/dev_notes.md`.
- Three.js was pinned to r128 (predates its color-management overhaul) specifically so
  material colors behave predictably as plain hex values; revisiting this is possible
  but should be its own deliberate decision, not incidental to another phase.

**Known follow-ups:** everything in `roadmap.md`.
