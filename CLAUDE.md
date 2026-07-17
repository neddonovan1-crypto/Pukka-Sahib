# CLAUDE.md — working agreement for Pukka Sahib

*This file is the human's. Agents follow it; only the human edits it.*

Pukka Sahib is a tragicomic district-management game set in 1920s British
India. You are the District Magistrate & Collector, balancing five meters and a
light economy across a year of seasons, working toward an honour (CIE / CSI /
KCIE) or one of several failures.

## The deploy branch is a release

`claude/pukka-sahib-game-design-b8b0du` is a release branch: **nothing lands
there unverified.** Run the whole verify chain green before every push.

## Architecture

Concerns are separated so the logic can run headless and be simulated:

- `src/logic.js` — **pure game logic**, no DOM. Runs in the browser and in Node
  (the validator/simulator load it directly). All randomness flows through an
  injected `rng`; the render layer never consumes rng.
- `src/content.json` — **all content & tuning** (config, calendar, postures,
  economy, endings, events) as schema'd data. Never inline content in code.
  Authoring guide: `docs/event-schema.md`.
- `src/ui.js` — **presentation** only. Reads snapshots from logic, paints the
  DOM, calls transitions. No rules here.
- `src/shell.html` — minimal HTML + CSS shell (the visual system; see
  `DESIGN.md §7`).
- `build.js` — assembles the shipped **single-file `index.html`** by inlining
  the above (CSP-safe: the Artifact host blocks external fetches). Strips
  comments from shipped JS; sources keep them.

`index.html` at the repo root is a **build output** — never hand-edit it; edit
`src/` and rebuild. Cross-session state (saves) will go in `localStorage` with
explicit versioning when added.

## The verify chain — run all of it before every push

`npm run verify` runs, in order:

1. **`npm run validate`** (`test/validate.js`) — every content invariant as an
   executable check: shapes, meter/econ effect keys, numeric ranges, condition
   schema, flag references resolve, per-season pool floors, forbidden patterns.
2. **`npm run simulate`** (`test/simulate.js`) — 500 seeded headless
   playthroughs per policy with balance targets as **assertions**: no runtime
   errors, guaranteed termination, no back-to-back event repeats, and the
   difficulty bands below. Adversarial probe policies assert the tail collapses
   are reachable.
3. **`npm run build`** (`build.js`) — produce `index.html`.
4. **`npm run e2e`** (`test/e2e.js`) — Playwright clicks a full session through
   the real UI on **desktop + mobile**: zero console errors, guaranteed
   termination, no mobile horizontal overflow, screenshot evidence (animations
   on). Uses the pre-installed Chromium (`/opt/pw-browsers/...`, build 1194) via
   explicit `executablePath` — do not run `playwright install`.

A red that means nothing is a priority bug: fix flakes, don't ignore them. Seeds
are fixed, so the sim is deterministic.

### Balance targets (asserted in the sim — state new numbers in the commit)

- tour-only earns honours ≤ 10 % and breaks down ≥ 30 % (can't be spammed).
- desk-only reaches KCIE ≤ 12 % (the district ferments into unrest instead).
- skilled seasonal play earns honours ≥ 50 %.
- random play honour-rate within [2 %, 50 %].
- every honour tier + common collapse reachable; `riot`/`bankrupt` reachable via
  their adversarial probes.

## Content rules

- Effects reference only the five meters; `econ` only `treasury`/`debt`; no
  zero-value deltas; single meter delta within ±25.
- Every `requires`/`condition` flag must be produced by some `setFlags` (or be a
  once-event id). Each season keeps ≥ 6 eligible events; the monsoon keeps ≥ 1
  crisis. Pools rotate — nothing repeats back-to-back.
- Tags use authentic ICS markings (`docs/period-reference.md`); secrecy grades
  render as solid stamps.

## Process & conventions

- **Backlog = GitHub issues** (`bug` / `enhancement`). Plan non-trivial work in
  the issue before building; don't build speculatively.
- **Code review loop** after tests pass: high/medium findings fixed before
  hand-off, low findings filed as issues.
- Commit messages are descriptive, in the product's dry voice. **Model
  identifiers never appear** in commits, code, or shipped assets.
- Temp files and scratch experiments stay in the scratchpad, out of the repo.
  Durable harnesses live in `test/`.
- Regression check added for every fixed bug; screenshot evidence for
  user-visible changes; balance numbers stated when the sim's outputs move.

## Deploy

- The shipped game is the single-file `index.html` (built).
- The playable **Artifact** is published from the wrapper-free copy `build.js`
  emits when `PUKKA_ARTIFACT_DIR` is set; it keeps a stable URL across redeploys.
