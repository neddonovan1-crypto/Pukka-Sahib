# Authoring Guide — the Event Schema

## Chapters (the career)

Content ships as a **chapter registry** — `src/content.js` exports
`{ chapters: {key: bundle}, order: [...] }`, and each bundle is a complete
game: config, endings, events, occasions, codas. `createGame(bundle)` is
chapter-agnostic; the UI plays the first chapter in `order` the career has not
been promoted out of. Two bundle fields drive the career:

- `config.chapter` — `{ key, rank, posting, promotionTiers, promotesTo }`.
  `promotionTiers` lists the ending keys that count as promotion;
  `promotesTo` names the next chapter (or `null` at the current summit).
- `config.honours` — `{ weights, ladder }`. `weights` blends the four public
  meters into the honours score (must sum to 1). `ladder` is ordered highest
  first: `{ key, score, prestige, reach, barredByDebt? }` — `key` must be an
  ending in this chapter, `reach` is the standing line shown while that rung
  is in hand, and `barredByDebt` rungs are skipped while debt exceeds
  `economy.debtWarn`. Honours by chapter (design): the district year earns the
  **C.I.E.** at most (its top tier is advancement — the Division); the
  Commissioner plays for the **K.C.I.E.**, and the **K.C.S.I.** exceptionally;
  the Lieutenant-Governor for the Knight Grand Commanders (G.C.I.E./G.C.S.I.).

Endings may carry a `medal` art key. The player's career (rank, completions,
honours, history) persists in localStorage separately from the run save; the
"Begin as a seasoned Collector" quick-start unlocks once the apprentice year
has been completed at least once.

## The cast (recurring people)

`config.cast` (optional) names the chapter's recurring figures and turns the
relationship flags choices already set into a visible **standing**. Each member
is `{ id, name, who, won?, wronged? }`, where `won`/`wronged` are
`{ flag, note }` — the flag an earlier choice sets, and the one-line standing
shown when it holds. At least one side is required; enmity wins a doubled
standing. Example:

```json
"cast": [
  { "id": "ramautar", "name": "Ram Autar", "who": "the tahsildar",
    "won":     { "flag": "ramautar_trust", "note": "trusts you, and covers for you" },
    "wronged": { "flag": "ramautar_gone",  "note": "reported, broken, and gone" } }
]
```

The standing strip under the money shows only the relationships actually made
(green = won, oxblood = crossed). It is a **pure read of flags** — no new game
state, nothing to save. The validator requires every declared standing flag to
be both *produced* by some choice and *paid off* somewhere (a gated event or a
coda), so the strip can never promise a bond the content never earns or uses;
the simulator asserts both sides of every bond are reachable in play.

All game content lives as **JSON** inside `index.html`, in
`<script type="application/json" id="game-data">`. The engine (`<script>` below
it) is logic only and interprets this data. To add or change content you edit
the JSON — no JavaScript required. This keeps content authorable by hand or a
tool, and lets us move it to an external file later without touching the engine.

## Top-level shape

```json
{
  "config":  { "maxTurns": 24,
               "start": { "revenue":50, "order":55, "prestige":50,
                          "contentment":45, "composure":60 } },
  "endings": { "kcie": { "title": "…", "text": "…" }, "…": {} },
  "events":  [ /* event objects */ ]
}
```

## An event

```json
{
  "id": "bull",                 // unique; also the once-only flag key
  "tag": "PETITION",            // the rubber-stamp marking on the card
  "season": ["any"],            // ["cold"|"hot"|"monsoon"|"any"] — deck weighting (inert for now)
  "kind": "desk",               // desk | tour | club | personal | crisis
  "once": false,                // true = appears at most once per game
  "requires": null,             // optional condition gating eligibility
  "title": "The Matter of the Sacred Bull",
  "body":  "Sub-Inspector Diwan Chand petitions…",   // may contain HTML entities & tags
  "choices": [ /* 2–4 choice objects */ ]
}
```

**Tags & secrecy.** Any tag in `MOST SECRET / SECRET / CONFIDENTIAL / CYPHER`
renders as a solid oxblood stamp (the secrecy look); all other tags render as an
outlined stamp. Use real markings (`PETITION, TELEGRAM, D.O., MEMORANDUM,
CUTCHERRY, DEPUTATION, IMMEDIATE, URGENT, PRIVATE, MINUTE`) — see
`docs/period-reference.md`.

**Prose.** `title`, `body`, `label`, `outcome`, and ending `text` are inserted
as HTML, so use entities (`&mdash; &lsquo; &rsquo; &amp;`) and inline tags
(`<b> <i>`) freely. Do **not** use raw double-quotes inside a JSON string —
prefer `&lsquo;…&rsquo;` for quotation, which also reads better in period.

## A choice — two forms

**Flat** (most choices): fixed effects and outcome.

```json
{
  "label": "Solemnly issue a written order…",
  "effects": { "prestige": -1, "contentment": 3, "composure": -2 },
  "outcome": "The order is framed and hung in the police lines…",
  "setFlags": ["some_flag"]      // optional; sets state flags for later events
}
```

**Branching** (outcome depends on state): evaluate a condition, then apply one
of two sub-results. Used e.g. for the tiger shoot, which depends on Composure.

```json
{
  "label": "Go out and shoot it yourself…",
  "condition": { "meter": "composure", "op": ">", "value": 40 },
  "ifTrue":  { "effects": { "prestige": 8,  "contentment": 5, "composure": -6 },
               "outcome": "By a miracle… the tiger falls." },
  "ifFalse": { "effects": { "prestige": -6, "order": -3,     "composure": -8 },
               "outcome": "Your nerves betray you…" }
}
```

`effects` deltas are added to the meters and clamped to 0–100. Only the meters
named change; a delta may be positive or negative. Every named delta is shown to
the player as a coloured chip, so keep them meaningful.

## Interludes (no-choice occurrences)

An **interlude** is an atmospheric card with no decision — the rains breaking,
the *loo* wind, the English mail. Set `"interlude": true` and `"kind":
"interlude"`, give it **no `choices`**, and optionally a small event-level
`effects` and/or `econ` that applies automatically, plus an optional `outcome`
line. Keep them `"once": true` — they're rare punctuation, not filler.

```json
{
  "id": "rains-break", "tag": "THE RAINS", "season": ["monsoon"],
  "kind": "interlude", "interlude": true, "once": true,
  "title": "The Rains Break",
  "body": "After the long white weeks of waiting…",
  "effects": { "composure": 3, "contentment": 2 }
}
```

The engine draws an interlude with a small independent chance
(`config.interludeChance`, default 0.16) instead of ordinary business, so they
never starve the event pool. The card shows the body, any effect chips, and a
single **Continue**.

## Occasions (the fixed calendar of the year)

An **occasion** is a set-piece keyed to a specific fortnight — Christmas Week,
the Commissioner's inspection, the Breach in the Bund. Occasions live in
`src/content/occasions.json` (own top-level array, **outside** the drawn deck)
and claim their whole fortnight: **no posture choice that turn**. Two forms:

- **With `choices` (2–4):** plays exactly like an event (branching, `econ`,
  `setFlags` all work) — a decision the calendar forces on you.
- **Without choices:** a fait accompli — optional `effects`/`econ` apply
  automatically and the card offers only Continue, like an interlude. Use for
  results that cannot be changed (the fever week, the Gazette without your
  name in it).

```json
{ "id": "christmas-week", "turn": 4, "tag": "PROGRAMME",
  "title": "Christmas Week", "body": "…", "outcome": "…",
  "effects": { "health": 3, "contentment": 2 } }
```

Rules (enforced by the validator): unique `id` (shared namespace with events),
`turn` in `2..maxTurns` (never 1 — the game opens by teaching the posture
loop), at most one occasion per turn, `tag`/`title`/`body` required, optional
`art`. No `season` field — the turn *is* the season. Because the fortnight is
forced, occasions are where guaranteed beats live: the year's fixed fiscal
crisis (the bund) is an occasion so the bankruptcy tail never depends on draw
luck.

## Scene art

The banner above the meters shows the season. Seasons rotate through any variant
art keys present (`season-cold`, `season-cold-2`, …) by the fortnight, so the
backdrop changes through a run. Any event may set `"art": "<key>"` to override
the banner with a specific scene while its card is up (the key must exist in the
build's `window.PUKKA_ART` manifest — see `build.js` / `scripts/optimize-art.js`).
Art is optional: an unknown or absent key just falls back to the season banner
(or no image).

## Conditions

Used by `requires` (event-level) and `condition` (choice-level). Recursive.

```json
{ "flag": "ramautar_trust" }                          // a flag is set
{ "meter": "prestige", "op": ">=", "value": 60 }      // op: > >= < <= == !=
{ "allOf": [ <cond>, <cond> ] }                        // every sub-condition
{ "anyOf": [ <cond>, <cond> ] }                        // any sub-condition
{ "not":   <cond> }                                    // negation
```

Besides the five meters, `meter` may name three pseudo-meters: `debt` (the
creditor's scalar), `turn` (the fortnight number), and `showing` (the live
honours blend) — the late-year report warnings gate on `turn` + `showing`, so
a year quietly falling short of its ladder is warned, not surprised.

## Gambles (`risk`)

A choice (or an `ifTrue`/`ifFalse` branch) may carry a rare catastrophe:

```json
{ "label": "Ford the nullah tonight, papers and all.",
  "effects": { "prestige": 3, "order": 2, "health": -2 },
  "risk": { "chance": 0.2,
            "effects": { "health": -14, "prestige": -6 },
            "econ": { "treasury": -800 },
            "setFlags": ["lost_the_dak"],
            "outcome": "The ford was deeper than the guide swore…" } }
```

At `chance` (validator caps it at 0.35), the risk branch replaces the ordinary
result entirely — effects, econ, flags, outcome. Resolved through the injected
rng, so seeded simulations stay deterministic. House rules: the catastrophe
must always be *avoidable* (another choice without a gamble exists), the label
should read risky, and risks never nest.

Example — an event that only appears once the player is both indebted to the
Lala *and* short of composure:

```json
"requires": { "allOf": [ { "flag": "indebted" },
                         { "meter": "composure", "op": "<", "value": 45 } ] }
```

## Two-step choices (`then`)

A top-level choice may, instead of resolving, open a **follow-up decision**.
Give the choice a `then` object; its own `effects`/`econ`/`setFlags` apply as the
setup, its `outcome` becomes the follow-up card's lead, and then the follow-up
is presented:

```json
{ "label": "Clear the lane with the reserve, at once.",
  "effects": { "order": 2, "health": -1 },
  "outcome": "The constables go in — and the lane does not clear…",
  "then": {
    "tag": "IMMEDIATE", "title": "The Lane Will Not Clear",
    "body": "Twenty men against three hundred…",
    "choices": [ /* 2–4 ordinary choices — these resolve normally */ ]
  } }
```

`then` carries a required `body`, an optional `tag`/`title`/`art` (defaulting to
the parent's), and 2–4 `choices`. House rules (enforced): **one level only** — a
follow-up choice may not carry its own `then`; a two-step setup choice may not
also `condition`-branch or carry a `risk` gamble (keep the setup deterministic),
and it must have an `outcome`. Follow-up choices are ordinary — they may branch
and gamble. If the setup's own effects collapse the run, the follow-up never
arrives (the setup is the ending). The mid-step state is saved, so a run resumes
between the two beats.

## Endings

Keyed objects with `title` and `text`. Which ending fires is engine logic
(`collapseCheck` for early collapse; `finalVerdict` for the turn-24 grading on
the honours ladder). To add a *new* ending you add the data here **and** a
branch in the engine's `finalVerdict`. Editing existing ending text is
data-only.

## Codas (the year remembered)

Codas are arc-conditional sentences appended to the verdict, in
`src/content/codas.json`. Each is `{ requires, text, endings? }`: when
`requires` (a normal condition — usually a `{"flag": …}` an earlier choice
set) holds, the sentence is added to the ending screen. Optional `endings`
scopes a coda to specific ending keys, so one flag can read differently under a
knighthood and a disgrace. Keep them one sentence, in the verdict's dry italic
voice. The validator cross-references every `requires` flag like any other, so
a coda can't depend on a flag nothing sets.

## Service record

Automatic — no authoring. Every decision the player makes is logged
(`logDecision`) with a weight (meter movement + money moved + a heavy bonus for
setting an arc flag). The ending shows the five heaviest as a "Confidential
character report," in the order they happened. Write choice `label`s so they
read as a terse record of *what you did*, not just a verb.

## Meter legend

`config.meters` is `[{key, name, desc}]` for all five meters — the display
names and the one-line glosses shown in the legend panel and the meter
tooltips. Data-only; the validator requires a name and desc per meter.

## Audio (synthesised sitar/tanpura)

`config.audio` tunes the ambience `src/audio.js` synthesises at runtime (no
samples — a CSP-safe Artifact can't fetch them): `tonic` (Sa, in Hz),
`master` (overall gain, 0–1), and `ragas` — a set of semitone degrees per
season that the sparse plucked phrases are drawn from (dawn **Bhairav** for the
cold weather, a spare midday **Sarang** for the hot, a **Malhar** for the
rains). Change a season's mood by changing its scale. Default off; the masthead
toggle starts it in a gesture. Validator checks the tonic, master, and a
≥3-degree scale per season.

## Checklist for a new event

1. Unique `id`; a real `tag`; sensible `season` + `kind`.
2. `once: true` for set-pieces (a famine, an inspection) that shouldn't repeat.
3. 2–4 choices, each trading meters against each other — no free lunch.
4. Outcomes that editorialise dryly; the humour is in the consequence.
5. If it belongs to a character arc, gate it with `requires` on a flag an
   earlier choice sets via `setFlags`.
6. Validate: the JSON must parse. Quick check —
   `node -e 'JSON.parse(require("fs").readFileSync("index.html","utf8").match(/id="game-data">([\s\S]*?)<\/script>/)[1])'`
   exits silently if valid.
