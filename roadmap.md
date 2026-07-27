# Roadmap

Worked phase by phase, on request — don't start the next phase without being asked to,
and follow the investigate → plan → confirm → implement → docs → history → summary
cycle described in `CLAUDE.md` for each one.

Phases are ordered deliberately: visual foundation first, then a conceptual question
that could ripple into several other systems (the window/vault premise), then content
accuracy, then the bigger creative swings (concept + new mechanics), then a
consolidation checkpoint, finishing with performance/cleanup once everything else has
settled. Don't reorder without a reason — if a phase turns up something that makes a
later phase's assumptions wrong, that's exactly the kind of thing to flag in that
phase's summary and reflect back into this file.

Status key: `[ ]` not started · `[~]` in progress · `[x]` done (see `history.md` for
the entry).

---

## [ ] Phase 1 — Room & furniture realism pass

**Goal:** Move the room and its furniture away from "prototype" and toward something
that could pass for a real, considered space — possibly including real assets rather
than everything being procedural.

**Context:** Every material and most geometry in this project is generated at
runtime (canvas textures, primitive-composed furniture) — see `.claude/dev_notes.md`'s
constraint list. That's been a deliberate limitation, not a permanent one. This phase
is the place to seriously evaluate whether to keep the fully-procedural approach or
introduce real assets (textures, models, or both) for at least the highest-visibility
surfaces (floor, walls, hero furniture pieces).

**Open questions to resolve in the plan, not during implementation:**
- Real assets change the "no build step, opens as a static file" story — CORS/`file://`
  loading of textures/models needs checking, and licensing needs to be genuinely free
  for redistribution. Is this worth the trade-off, or does further procedural
  refinement get most of the way there for less risk?
- If real assets are introduced, where do they live (`assets/`?), and does that change
  `CLAUDE.md`'s "no external assets" constraint note (it should, if so).
- This is also a reasonable point to reassess whether current room proportions and
  furniture scale actually look right — nobody has ever looked at this with real eyes
  (see `.claude/dev_notes.md`). Budget time for that basic sanity check before
  polishing details.

**Likely touches:** `textures.js`, `world.js`, possibly a new `assets/` directory and
loader code if real assets are adopted.

---

## [ ] Phase 2 — Room & furniture collision improvement

**Goal:** Make movement collision against furniture and room geometry solid and
consistent — no clipping through tables, chairs, cabinets, or scattered containers.

**Context:** Collision today is a flat list of axis-aligned bounding boxes
(`this.obstacles`, built via `_addObstacle`) checked against the player's position each
frame in `player.js`. Several obstacle boxes were added with generous, approximate
margins rather than exact footprints (see `world.js` comments near
`_buildScatteredContainers` and `_buildSortingTable`) — reasonable for a prototype,
not for a finished room.

**Open questions:**
- Is a smarter AABB system (per-piece, rotation-aware) sufficient, or does this need a
  more general collider approach? Given performance headroom is already spent on 60–100
  boxes, prefer the simplest approach that's actually correct over a more general
  physics system.
- Should collision update if Phase 1 introduces new/different furniture? (Almost
  certainly yes — do this phase after Phase 1 lands, or coordinate if they overlap.)

**Likely touches:** `world.js` (obstacle definitions), `player.js` (collision
resolution logic).

---

## [ ] Phase 3 — Fireplace redesign

**Goal:** A complete redesign of the fireplace, not an incremental refinement.

**Context:** The current fireplace (marble surround, mantel, tools, andirons, framed
art) was already one full rebuild past the original prototype version — treat it as a
disposable starting point, not a base to preserve. `.claude/dev_notes.md` flags fire-
related geometry as reasoned-through-but-unverified.

**Open questions:**
- Should the fire itself move beyond a billboard sprite (`fireGlowTexture`) toward
  something more convincing? Consider the performance budget already committed
  elsewhere (60–100 boxes, one shadow-casting light) before reaching for anything
  expensive.
- Does this phase's outcome depend on Phase 4's answer about the vault premise (a
  fireplace burning underground has its own quiet lore question, much smaller than the
  window's, but worth a one-line acknowledgment either way)?

**Likely touches:** `world.js` (`_buildFireplace` and related), `textures.js` if new
materials are needed.

---

## [ ] Phase 4 — Window relocation & atmosphere (and the vault premise)

**Goal:** Move the window to the center of the wall it's on, and make it genuinely
transparent with real atmosphere visible outside — not a rain texture on a pane.

**Context:** This phase carries a bigger question than it looks like. The game is
currently framed as an underground vault, which is why the window has only ever shown
a rain-streaked, indistinct exterior rather than a real view — an underground vault
having a window to genuine outside atmosphere doesn't add up. **This needs an explicit
decision, made during the plan step, not discovered halfway through implementation:**

- Option A: keep the underground-vault premise, and justify the window narratively
  (a light well, an old bank building partially below grade, etc.) — constrains what
  "genuine atmosphere outside" can plausibly show.
- Option B: reconsider the setting itself (not necessarily underground at all — a
  grand old bank building above ground, for instance) — frees up the window entirely
  but has knock-on effects on mood, lighting rationale (the "sunlight" skylight,
  currently justified as light through a ceiling grate), and possibly the fireplace's
  smoke/flue logic if that's ever addressed.

Pick one explicitly and say so in the plan. Don't let this get resolved implicitly by
just building something and seeing what it implies.

**Likely touches:** `world.js` (`_buildWindow`, and possibly lighting rationale in
`_buildLighting`), `textures.js`, potentially `history.md`'s framing of what this game
*is* if Option B is chosen.

---

## [ ] Phase 5 — Memento shelf accuracy

**Goal:** Mementos displayed on the shelf should better reflect what was actually found
in the specific boxes the player opened, rather than a generic reward-shape mapping.

**Context:** Today, `world.js`'s `addMemento`/`_buildMementoMesh` maps a reward's
`shape` field (`coin`, `card`, `ring`, etc.) to a generic primitive — it doesn't
distinguish, say, a `pocketWatch` from a `coin` beyond their assigned shape category,
and doesn't reference which specific container (wall box vs. suitcase vs. safe) it
came from. `generator.js`'s `REWARDS_COMMON`/`REWARDS_SPECIAL` already have per-reward
`name`/`desc`/`icon`/`hex` — there's more identity available here than is currently
being used visually.

**Open questions:**
- Should every distinct reward `id` get a bespoke memento mesh, or is a richer-but-
  still-generic shape mapping (more shape categories, better use of existing per-
  reward color/icon) enough?
- Should the memento visually or positionally reference *which container type* it came
  from (a mini safe-shaped memento for a safe reward, say)? Nice-to-have, not required.

**Likely touches:** `world.js` (`_buildMementoMesh`), possibly `generator.js` if reward
data needs new fields to support richer mementos.

---

## [ ] Phase 6 — Improve the general concept of the game

**Goal:** Step back from individual systems and reassess the game's concept as a whole
— is "cozy vault, find keys, match locks, open containers" still the right frame, and
is it being fully realized?

**Context:** This is deliberately the most open-ended phase on this roadmap. Everything
before it has been refinement of the existing concept; this is the point to question
the concept itself before Phase 7 commits to specific new mechanics. Re-read the
original design philosophy embedded in `history.md`'s pre-roadmap entry and
`.claude/dev_notes.md` before proposing changes — understand what's intentional before
changing it.

**Open questions:** Entirely up to whoever plans this phase. Don't presuppose an
answer here — that would defeat the point of an investigate-first phase.

**Likely touches:** Could touch anything. Treat the investigate step seriously.

---

## [ ] Phase 7 — New unique game mechanics

**Goal:** Design and implement new mechanics that suit whatever direction Phase 6
lands on.

**Context:** Depends directly on Phase 6's outcome — don't plan this phase's specifics
until Phase 6 is done. What's stable regardless of direction: the puzzle generator's
non-ambiguity guarantee (`.claude/dev_notes.md`) is load-bearing and should be
preserved or deliberately, explicitly superseded — not accidentally broken by a new
mechanic that introduces a new kind of randomness outside the seeded RNG.

**Likely touches:** Depends entirely on what's proposed.

---

## [ ] Phase 8 — Refinement checkpoint

**Goal:** A consolidation pass. By this point, Phases 1–7 will have added a lot —
new visuals, new furniture, a possibly-revised premise, new mechanics. This phase
exists to make sure all of it actually coheres as one game, rather than reviewing each
phase only in isolation.

**Context:** This is intentionally a floating checkpoint rather than tied to a specific
system. Good candidate questions: does the game still feel cozy and coherent end to
end? Do the new mechanics and the refined room agree with each other tonally? Is
anything left over from earlier phases now redundant or inconsistent (old comments,
now-inaccurate docs, half-updated `README.md` sections)? Treat this phase's
"investigate" step as a full playtest-by-reading (and by the offline tests) of the
whole project, not a single system.

**Likely touches:** Potentially anything; likely more doc/consistency fixes than code.

---

## [ ] Phase 9 — General performance and cleanup

**Goal:** Final pass: performance profiling and cleanup, once content and mechanics
have settled and won't be thrashed by further large changes.

**Context:** Deliberately last — optimizing before Phases 1–8 land would risk wasted
work if those phases change what needs optimizing. Known performance-sensitive areas
already documented in `.claude/dev_notes.md`: shared geometry for the box wall,
emissive-glow instead of per-object lights, single shadow-casting light. Check whether
Phases 1–8 introduced anything that violates those patterns (a new per-object light, a
new expensive material, geometry that stopped being shared) before assuming new
optimization work is needed from scratch.

**Likely touches:** Potentially any file; primarily `world.js` given where the
heaviest content lives.

---

## Adding a new phase

If a phase surfaces work that doesn't fit the current one, don't silently expand scope
— add a new phase entry here (in a sensible position, not necessarily at the end) with
the same structure (Goal / Context / Open questions / Likely touches), and mention it
in that phase's summary so it's clear where the new scope came from.
