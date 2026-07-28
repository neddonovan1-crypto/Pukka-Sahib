# The desk — game design

The redesign, settled. Read alongside **`CLAUDE.md`** (the working agreement),
**`docs/DESIGN-ART.md`** (how it looks) and **`DESIGN.md §7`** (the interface
chrome). This supersedes the posture-and-event loop for the new front end.

The old game is a column of cards: read a paragraph, pick one of three, the
meters move. It models *deliberation*. This one models what the job actually
was — **triage**: far more arriving than one man can attend to, and the things
you never got to going wrong quietly.

---

## 1. The shape

- A career is **two to three hours**, across sittings. Save and resume must be
  solid.
- **One chapter is built end to end first** — the district year. Everything
  learned applies to the other three, which then become content rather than
  engineering.
- The four ranks and the honours ladder survive unchanged.

## 2. The fortnight

**Fourteen days.** They are the only currency, and they are gone when spent.

| Act | Days |
|---|---|
| Read a file and dispose of it | 1 |
| Hear a case, receive a deputation | 2 |
| Ride out to a village | 4 |
| Close a file unread | 1 |
| Delegate a stack | 0 |
| Tour (planned, on the map) | as routed — most of a fortnight |

Six to eight documents arrive each fortnight; fourteen days will not clear
them. That gap is the game.

## 3. Disposal — the rack

Decisions are made by **pressing a stamp**. The stamp is the act, it leaves a
mark on the paper, and the paper goes to the out-tray.

A **fixed core, extended by rank**. The core four are learnt in the first
fortnight and never change:

> **SANCTIONED** · **REFERRED** · **NO ACTION** · **CALLED FOR REPORT**

Each promotion adds one or two of its own — orders the rank is newly competent
to give — so advancement is felt in the hand rather than announced. The exact
list per rank is authored in chapter config, not hard-coded.

Two further disposals exist for when the desk gets away from you:

- **Delegate a stack** — costs nothing. What comes back depends entirely on
  **who** you gave it to: a subordinate you backed handles it properly; one you
  wronged buries it, or returns figures that are shaded. This is what finally
  makes the cast mechanically load-bearing.
- **Close a file** — one day, binned unread. The consequence lands at once and
  is known, rather than festering. A certain small loss instead of an uncertain
  larger one.

## 4. The pile

Papers you do not reach **stay on the desk and decay**. Both: the pile is
visible and it rots.

Decay is the story engine. A petition set aside in the hot weather returns in
the monsoon as a telegram from the Division asking why nothing was done. The
player can trace the chain back to their own neglect, which is the difference
between a consequence and a punishment.

**Balance risk, named up front.** Visible pile + decay + a three-hour career is
the combination most likely to produce a death spiral decided by fortnight four
and tedious for the twenty after it. Delegation and closing are the valves, and
the sim must assert that a run behind at the end of the hot weather can still
recover — a `dugOut` probe, alongside the existing collapse probes.

## 5. Touring

A separate screen. Plan a route across the tehsils, spend the days, see what
you find. Expensive in exactly the right way: days riding are days the pile
grows.

Touring is the **only** thing that corrects what you believe. Everything else
you know arrives on paper, written by somebody with reasons.

## 6. The district underneath

Each tehsil carries a small hidden state — **arrears, unrest, sickness,
harvest** — never shown directly. It decides:

1. **Which documents surface**, and how often.
2. **Who writes them** — and therefore how much they distort.
3. **What you find** when you go there.

Small enough to balance, big enough to make the gap between the record and the
place real. The simulation **selects and frames; it never writes.** All prose
stays authored; the validator keeps its teeth.

## 7. The meters

The five meters become **Simla's opinion of you**, not the district's
condition. Revenue is what you remitted. Order is what the police reported.
Prestige is what the Club says.

This costs almost nothing — the honours ladder, endings, codas and the balance
bands all survive — and it makes the game's irony mechanical rather than
narrated: you can be honoured for a district you ruined, and broken for one you
saved.

## 8. The desk

Fixed workspace. Nothing scrolls; documents arrive, are stamped, and leave.
Besides the paper in hand, four things are always present:

- **The in-tray** — what you have not touched, as a pile.
- **The days remaining** — the fortnight burning down.
- **The ledger** — the five meters ruled along the desk edge.
- **The map, small, at your elbow** — your own annotated survey sheet, going
  stale where you have not been. Keeps the district present on desk-only
  fortnights and makes the decision to tour feel like yours.

(No out-tray in the first version.)

## 9. Content

The 258 events are **mined for situations, not ported.** Each is a record of
something that can happen to a district officer; the documents are written
fresh, fitted to the stamp vocabulary and the word budgets.

That means the balance work restarts. Accepted deliberately: the old prose was
written for a menu, and the new documents are a different object.

**Word budgets, enforced by the validator:**

| Form | Budget |
|---|---|
| Telegram | ≤ 25 words, capitals |
| File note | ≤ 40 words |
| Petition | ≤ 35 words in translation |
| Report | ≤ 50 words |
| Interlude, coda | 80–150 words |

**Terse in the loop, lyrical at the turns.** The narrator voice does not
disappear; it concentrates where it earns its place — interludes, codas,
endings. Voice in the loop lives instead in *polyphony*: the Sub-Inspector, the
petitioner, the Club and your own endorsement describing the same night
differently, and in what a report omits.

## 10. What survives from the current build

- **`src/logic.js`** — extended, not replaced. Turn structure, rng discipline,
  flags, serialisation and the chapter registry all hold. New: the day budget,
  the pile with decay, delegation, tehsil state.
- **`test/validate.js`** — keeps every invariant, gains the word budgets, the
  stamp vocabulary per rank, and the tehsil schema.
- **`test/simulate.js`** — the harness carries over; every number in it does
  not. New policies: a triage-competent player, a hoarder, a delegator, and the
  `dugOut` recovery probe.
- **`src/ui.js` and `src/shell.html`** — replaced.
- **The art pipeline** — `art/briefs/`, `scripts/generate-art.js`,
  `scripts/treat-art.js` — unchanged and already producing.

## 11. Build order

1. **One fortnight, in full fidelity** — documents arriving, days spent, stamps
   struck, the pile growing. Playable and judgeable before any balance work.
2. **The chapter end to end** — decay, delegation, the seasons, an ending.
3. **The tour and the map.**
4. **The hidden tehsils**, wired to selection and to distortion.
5. **The cast**, wired to delegation quality.
6. The other three chapters as content.

## 12. Open

- The exact stamp added at each rank.
- Whether the ledger is watched continuously or read once a season — the
  reframe argues for the latter.
- How a fortnight ends: automatically at day fourteen, or by the player
  declaring it done and forfeiting the remainder.
- Whether the pile has a hard ceiling, and what happens at it.
