# Tests

These are offline Node.js tests for logic/state correctness. They do **not** render
anything — there's no browser, no GPU, no WebGL here. What they verify is everything
that can go wrong *without* a screen: puzzle solvability, state machines, save/restore,
and (critically) that visual state actually changes when it's supposed to, even though
the tests can't see the result.

## Running

```
cd tests
node logic_test.js
node integration_test.js
```

Both exit non-zero-ish only via console output — check for `ERRORS: 0` in the output.
Both call `process.exit(0)` at the end on purpose: the game's ambient audio scheduler
uses recursive `setTimeout` chains that are meant to run forever during real play, which
would otherwise keep Node's event loop alive indefinitely in a test run.

## What `three_stub.js` is

A deliberately minimal stand-in for the subset of the Three.js r128 API this project
touches (`Object3D`/`Group`/`Mesh` with real parent/child tracking, the various
geometries and materials as inert data-holders, a `Raycaster` you can feed fake hits
into, etc). It's just enough to actually **execute** the game's scene-graph
construction and state machines — reparenting keys between camera/table/lock,
running tweens forward, checking emissive intensities — without ever drawing a pixel.

If a future phase adds a new Three.js feature (a new geometry type, a material
property, a Camera/Object3D method), the stub needs a matching addition or that
code path will throw in tests with a "not a function" style error. This is a good
thing — it's usually the fastest way to notice a typo before it reaches a browser.

## What these tests catch (and don't)

**Do catch:**
- Puzzle generation producing an ambiguous or unsolvable vault (this is the most
  heavily-tested path — see `logic_test.js`'s fingerprint-uniqueness checks)
- A state transition being skipped, set in the wrong order, or guarded incorrectly
  (this is exactly the class of bug that caused the box-opening animation to
  silently never run — see `dev_notes.md` for the full story)
- A key vanishing instead of being reparented somewhere real
- Crashes during world construction, environment effects, or the full Game
  bootstrap (renderer/scene/camera/UI wiring)
- Regressions in save/restore and the settings flow

**Don't catch:**
- Anything about how something actually *looks* — proportions, materials, lighting
  balance, whether geometry is inside-out, texture UV mapping, camera feel. There is
  no way to verify this without a real browser and a person looking at it. When a
  phase changes visuals, say so plainly in the summary rather than implying it's been
  verified — it hasn't, only its *absence of crashes* has.
- Timing/feel (mouse sensitivity, animation easing "feeling right", audio balance)

## Extending these tests

Follow the existing pattern: `check(condition, 'message')` pushes to an `errors` array,
printed at the end. When you fix a bug, add a regression test for the *actual visible
symptom* (state that would be wrong), not just that the code path executed without
throwing — a test that only checks "didn't crash" would have passed even with the
box-animation bug present.
