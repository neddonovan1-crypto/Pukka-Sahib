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

## 5. The road

A separate screen. Plan a route across the tehsils, spend the days, see what
you find. Expensive in exactly the right way: days riding are days the pile
grows. Touring is the **only** thing that corrects what you believe —
everything else you know arrives on paper, written by somebody with reasons.

**Travelling must not look like the desk.** Every register inverts:

| | The desk | The road |
|---|---|---|
| Ground | Timber and blotter; close, orthogonal, enclosed | Open country; the workspace gives way to landscape |
| Light | Interior lamplight, the punkah's shadow | Daylight and weather, graded by season |
| Register | Paper and print — engraving, monochrome | **Painting, in colour.** You are looking at the district, not reading about it |
| Type | Typewriter and letterpress | Your own hand |
| Layout | Fixed; nothing scrolls | The map, and a route advancing camp to camp |
| Sound | Punkah, clock, the scratch of a pen | Cartwheels, birds, village noise, weather |

And the inversion that matters most: **at the desk you read what other people
wrote; on the road you write.** The tour screen is the officer's camp diary —
dated entries in his own hand, with what he saw pasted or sketched in. It is
the only place in the game where the player's own voice appears, which is why
returning to the desk should feel like a door closing.

## 6. The three seasons

Not weather. The season decides what the game *is* that month.

| Season | The district | The game |
|---|---|---|
| **Cold weather** | The touring season | The road is cheap and expected. Long routes, the camp diary, the map filled in. |
| **Hot weather** | Station-bound | The desk, the courts, tempers rising. Touring costly and faintly absurd. |
| **Monsoon** | Immobile | Crisis arrives and you cannot go to it. The pile grows fastest. |

Historically exact — officers toured in the cold weather and were held at the
station through the heat and the rains. Mechanically it gives the year a
three-act rhythm and stops the loop from flattening: the same desk feels
different in November and in July because the alternative to it has changed.

The season governs the palette and light across the whole screen, which pool of
documents surfaces, the cost of a day, and whether the road is open at all.

## 7. The district underneath

Each tehsil carries a small hidden state — **arrears, unrest, sickness,
harvest** — never shown directly. It decides:

1. **Which documents surface**, and how often.
2. **Who writes them** — and therefore how much they distort.
3. **What you find** when you go there.

Small enough to balance, big enough to make the gap between the record and the
place real. The simulation **selects and frames; it never writes.** All prose
stays authored; the validator keeps its teeth.

## 8. The meters

The five meters become **Simla's opinion of you**, not the district's
condition. Revenue is what you remitted. Order is what the police reported.
Prestige is what the Club says.

This costs almost nothing — the honours ladder, endings, codas and the balance
bands all survive — and it makes the game's irony mechanical rather than
narrated: you can be honoured for a district you ruined, and broken for one you
saved.

## 9. The desk

The room is a painting and the interface must not bury it. Everything the player
is not using should be **out of the way or out of sight**. An early build put a
rail of panels down one side, a row of tabs across the ceiling and a permanent
rack of stamps along the front edge, and the room disappeared behind its own
chrome.

### The papers hang from tape

The fortnight's papers hang on a length of **red tape** across the top of the
screen — the way a file was actually strung. Each hangs by its title, so you can
read the whole fortnight at a glance without opening anything.

- **Take one down** and it is untied and comes to the blotter.
- **Put it back** and it goes onto the tape again, unread and unspent.
- **Dispose of it** and it goes to the **out-tray**, which fills through the
  fortnight. A full tray is the only reward the game gives for a good one.

The tape is the pile. It shrinks as you work and it is still hanging there at the
end of the fortnight, which is what makes what you left legible.

### The stamps stay put away

The rack is **not on the desk** until it is needed. A paper comes down on the
blotter, the stamps come forward under your hand; the paper leaves, they go back.
The rack should feel picked up rather than displayed.

### Some papers arrive without warning

Most business hangs on the tape and waits its turn. A **telegram does not**. It
arrives mid-fortnight, interrupts whatever is on the blotter, and will not go
back on the tape — it is answered now, on what you know now. That is the form's
whole character: it is the one document that costs you the initiative.

Used sparingly, one or two a fortnight, this is where the pressure lives.

### Some papers want actual work

Not every paper is a judgement. A few ask the officer to *do* something:

- a column of figures that does not add up, and the error to be found;
- an account of expenditure with a sum quietly hidden in it;
- two reports of the same night that cannot both be true.

**The guard rails matter here** (§13, rule 1). The work must be genuine — real
arithmetic, a real inconsistency — but finding it must never *settle* the
question. You find the error; whether it is fraud, incompetence, or a clerk
copying badly is still yours to judge, and the paper will not tell you. Find the
discrepancy, and you have earned a better guess, not an answer. That is the line
between this game and a verification puzzle, and it is thin enough to be worth
restating in every brief.

### What is always visible

Only what every decision is weighed against, and quietly:

- **The days remaining**, as the fortnight burning down.
- **The tape**, with the papers still on it.
- **The out-tray**, filling.
- **The map**, hanging in its frame on the wall — which is also how you take the
  road.

The **ledger of five meters** is *not* always visible. They are Simla's opinion,
which arrives by post and not by the minute; read them when the fortnight closes,
or on demand. Watching them tick is a spreadsheet, not a desk.

## 10. Content

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

## 11. What survives from the current build

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

## 12. Build order

1. **One fortnight, in full fidelity** — documents arriving, days spent, stamps
   struck, the pile growing. Playable and judgeable before any balance work.
2. **The chapter end to end** — decay, delegation, the seasons, an ending.
3. **The tour and the map.**
4. **The hidden tehsils**, wired to selection and to distortion.
5. **The cast**, wired to delegation quality.
6. The other three chapters as content.

## 13. How this differs from Papers, Please

Some resemblance is unavoidable; that game defined the form. What matters is
the centre of gravity, and three rules protect it. They are cheap to hold now
and expensive to retrofit once documents are being authored.

1. **No findable discrepancy.** Papers, Please is a verification game: an
   inconsistency exists in the documents and the skill is spotting it. Ours is
   a judgement game: the document never contains enough to be sure. The moment
   a paper hides a mismatch the player is rewarded for catching, we have built
   the other game.
2. **At least half the rack is never yes-or-no.** If the stamps read as
   approve/deny we are finished. `REFERRED` and `CALLED FOR REPORT` are onward
   moves — they pass the thing along or buy information at the cost of days.
3. **The same stamp can be right or wrong on evidence never shown.** `NO
   ACTION` on a quiet report is correct nine times and catastrophic the tenth,
   decided by tehsil state the player was never given. Unfalsifiable in the
   moment, which is the opposite of a puzzle.

And one target rather than a rule: **about a third of a career spent off the
desk.** If the desk is ninety per cent of the game we are in its shadow whatever
else we do. The road, and the seasons that govern it, are the answer.

Beyond that, the useful lineage is not that game at all: the Dennis Wheatley
crime dossiers, where a case is a box of real documents, and the manage-a-season
shape of a club or an institution you can never see directly and know only
through reports from people with opinions.

## 14. Open

- The exact stamp added at each rank.
- Whether the ledger is watched continuously or read once a season — the
  reframe argues for the latter.
- How a fortnight ends: automatically at day fourteen, or by the player
  declaring it done and forfeiting the remainder.
- Whether the pile has a hard ceiling, and what happens at it.
