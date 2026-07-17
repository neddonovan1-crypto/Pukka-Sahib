# CLAUDE.md — working agreement for Pukka Sahib

*This file is the human's. Agents follow it, and edit it only on the human's
explicit instruction (as here).*

Pukka Sahib is a tragicomic career game set in 1920s British India, live at
**adventuresahib.com**. You rise (or fail to) through the Indian Civil Service
across **chapters** — the Assistant Commissioner's probation, the District
Magistrate & Collector's year, and beyond — balancing five meters (Revenue,
Order, Prestige, Contentment, Health) and a light economy across a calendar of
seasons. Honours are rank-bound: the district year earns the **C.I.E.** at
most (its pinnacle is advancement — the Division); the Commissioner plays for
the **K.C.I.E.**, and the **K.C.S.I.** exceptionally; the Lieutenant-Governor
for the Knight Grand Commanders (G.C.I.E. / G.C.S.I.).

## The deploy branch is a release

`claude/pukka-sahib-game-design-b8b0du` is a release branch: **nothing lands
there unverified.** Run the whole verify chain green before every push. Pushes
auto-deploy (Cloudflare Workers → adventuresahib.com; GitHub Pages).

## Architecture

Concerns are separated so the logic can run headless and be simulated:

- `src/logic.js` — **pure game logic**, no DOM, chapter-agnostic:
  `createGame(bundle)` plays any chapter. All randomness flows through an
  injected `rng`; the render layer never consumes rng.
- `src/content.js` + `src/content/` — **all content & tuning** as schema'd
  data, merged into a **chapter registry** `{ chapters, order }`. Each chapter
  bundle is a complete game: config (calendar, postures, occasions, economy,
  honours ladder, chapter meta), endings, events, codas. Never inline content
  in code. Authoring guide: `docs/event-schema.md`.
- `src/ui.js` — **presentation** only. Reads snapshots from logic, paints the
  DOM, calls transitions; owns localStorage (run save + career record). No
  rules here.
- `src/audio.js` — synthesised sitar/tanpura ambience (Web Audio, zero page
  weight; ragas per season in config). Presentation only; can never throw into
  the game.
- `src/shell.html` — minimal HTML + CSS shell (the visual system; see
  `DESIGN.md §7`).
- `build.js` — assembles the shipped **single-file `index.html`** (inline,
  CSP-safe) and the multi-file `dist/` for hosted deploys. Strips comments
  from shipped JS; sources keep them. Enforces a page-weight budget.

`index.html` at the repo root is a **build output** — never hand-edit it; edit
`src/` and rebuild. Saves and the career record live in `localStorage` with
explicit versioning; corrupt or old versions fail safe to a new game.

## The verify chain — run all of it before every push

`npm run verify` runs, in order:

1. **`npm run validate`** (`test/validate.js`) — every content invariant as an
   executable check, **per chapter**: shapes, meter/econ effect keys, numeric
   ranges, condition schema, flag references resolve, honours-ladder schema,
   per-season pool floors, forbidden patterns.
2. **`npm run simulate`** (`test/simulate.js`) — 500 seeded headless
   playthroughs per policy **per chapter** with balance targets as
   **assertions**: no runtime errors, guaranteed termination, no back-to-back
   event repeats, and the difficulty bands below. Engineered probes assert the
   tail collapses and the top honours rung are reachable.
3. **`npm run build`** (`build.js`) — produce `index.html` + `dist/`.
4. **`npm run e2e`** (`test/e2e.js`) — Playwright clicks a full session through
   the real UI on **desktop + mobile**, plus a save/resume round-trip, the
   restart flow, the meter legend, keyboard selection, and the sound toggle:
   zero console errors, guaranteed termination, no mobile horizontal overflow,
   screenshot evidence (animations on). Uses the pre-installed Chromium
   (`/opt/pw-browsers/...`) via explicit `executablePath` — do not run
   `playwright install`.

A red that means nothing is a priority bug: fix flakes, don't ignore them. Seeds
are fixed, so the sim is deterministic.

### Balance targets (asserted in the sim — state new numbers in the commit)

Per chapter, against that chapter's honours ladder:

- tour-only earns honours ≤ 10 % and its signature failure holds (in the
  district year: breaks down ≥ 30 %) — postures can't be spammed.
- desk-only reaches the chapter's **top tier** ≤ 12 %.
- skilled seasonal play earns honours ≥ 50 %.
- random play honour-rate within [2 %, 50 %].
- every ladder tier + common collapse reachable; `riot`/`bankrupt` reachable
  via their adversarial probes; the top rung reachable via the paragon probe.

## Content rules

- Effects reference only the five meters; `econ` only `treasury`/`debt`; no
  zero-value deltas; single meter delta within ±25.
- Every `requires`/`condition` flag must be produced by some `setFlags` (or be
  a once-event id). Each season keeps ≥ the chapter's pool floor (default 6)
  of eligible events; a chapter with a monsoon keeps ≥ 1 monsoon crisis. Pools
  rotate — nothing repeats back-to-back.
- Season intros and posture cues are variant arrays (≥ 2 per season) rotated
  by fortnight; posture labels are seasonal and plain enough to need no
  context.
- Crisis warnings are `priority` events: once-only, gated by a danger-band
  `requires`, so no collapse arrives unannounced.
- Tags use authentic ICS markings (`docs/period-reference.md`); secrecy grades
  render as solid stamps.

## Process & conventions

- **Backlog = GitHub issues** (`bug` / `enhancement`). Plan non-trivial work in
  the issue before building; don't build speculatively. Log what was done even
  when resolved immediately.
- **Code review loop** after tests pass: high/medium findings fixed before
  hand-off, low findings filed as issues.
- Commit messages are descriptive, in the product's dry voice. **Model
  identifiers never appear** in commits, code, or shipped assets.
- Temp files and scratch experiments stay in the scratchpad, out of the repo.
  Durable harnesses live in `test/`.
- Regression check added for every fixed bug; screenshot evidence for
  user-visible changes; balance numbers stated when the sim's outputs move.

## Deploy

- The shipped game is `dist/` on **Cloudflare Workers** at
  **adventuresahib.com** (and GitHub Pages), deployed automatically on push.
- The single-file `index.html` remains the portable build; Artifact publishing
  is retired.
