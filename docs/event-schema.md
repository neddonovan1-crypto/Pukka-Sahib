# Authoring Guide — the Event Schema

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

## Conditions

Used by `requires` (event-level) and `condition` (choice-level). Recursive.

```json
{ "flag": "ramautar_trust" }                          // a flag is set
{ "meter": "prestige", "op": ">=", "value": 60 }      // op: > >= < <= == !=
{ "allOf": [ <cond>, <cond> ] }                        // every sub-condition
{ "anyOf": [ <cond>, <cond> ] }                        // any sub-condition
{ "not":   <cond> }                                    // negation
```

Example — an event that only appears once the player is both indebted to the
Lala *and* short of composure:

```json
"requires": { "allOf": [ { "flag": "indebted" },
                         { "meter": "composure", "op": "<", "value": 45 } ] }
```

## Endings

Keyed objects with `title` and `text`. Which ending fires is engine logic
(`collapseCheck` for early collapse; `finalVerdict` for the turn-24 grading on
the honours ladder). To add a *new* ending you add the data here **and** a
branch in the engine's `finalVerdict`. Editing existing ending text is
data-only.

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
