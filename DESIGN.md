# Pukka Sahib — Design Document

> *"It is the condition of his rule that he shall spend his life in trying to
> impress the 'natives', and so in every crisis he has got to do what the
> 'natives' expect of him."* — George Orwell, *Shooting an Elephant*

## 1. Premise

You are the newly-gazetted **District Magistrate & Collector** of **Chhota
Nagra**, a fly-blown district in the north-west of British India, in the
mid-1920s. You are twenty-nine, alone, several hundred miles from anyone who
matters, and personally responsible for the peace, prosperity and revenue of
roughly nine hundred thousand people you do not understand.

Your job is to be a **pukka sahib** — the proper, unflappable Englishman who
keeps up appearances no matter what. The joke, which the game never says out
loud, is that keeping up appearances is the *entire* job, and everyone —
your clerk, your servants, the moneylender, the Congress pleader, the
Commissioner — knows it better than you do.

## 2. Tone

**Tragicomic.** Somewhere between *Yes Minister*, Orwell's Burma essays, and
*Papers, Please*. The petitions that land on your desk are absurd — a holy
bull with a taste for the sub-inspector's marigolds; the Club committee's
war over the billiards subscription — but the stakes underneath are real:
a famine, a lathi-charge, a career, a life. The humour is dry, the
consequences are not. We never wink at the player about the moral rot; we
let the machinery run and let the player feel it.

**What we avoid:** nostalgia for empire, and its mirror image, the smug
lecture. Present the apparatus honestly, make the trade-offs bite, and trust
the player.

## 3. Core Loop

The game is a turn-based balancing act. One **turn = a fortnight**. A posting
lasts **24 turns (roughly one year)** in the prototype; the full game targets
two-to-three years with seasonal structure.

Each turn:

1. **An event arrives** — a petition, a telegram, a crisis, a social
   obligation. Drawn from a weighted deck so no two playthroughs match.
2. **You choose** one of 2–4 responses. Each shifts your meters and may set
   flags that unlock later events.
3. **Consequences resolve** — immediate stat changes plus flavour text.
4. **Periodic reckonings** interrupt the deck: the monsoon, the Commissioner's
   inspection, the annual revenue settlement, a Congress meeting.

## 4. The Five Meters

Everything you do trades one against another. You can never max them all.

| Meter | What it is | Who cares |
|-------|-----------|-----------|
| **Revenue** (₹) | The district treasury and land-revenue collection | Simla. Always Simla. |
| **Order** | How quiet the district is | You, at 3 a.m. |
| **Prestige** | Your standing in the Raj hierarchy — the "pukka sahib" meter | The Commissioner, the Club |
| **Contentment** | The mood of the district's people | Them. Occasionally your conscience. |
| **Composure** | Your own nerves, health and sobriety | Nobody, until it's gone |

The design constraint: **the obvious move on one meter usually costs
another.** Squeeze the revenue and Contentment falls. Crack down on unrest and
Order rises but a scandal can gut Prestige. Grant relief and Simla frowns.
Everything, always, costs a little Composure.

Any meter hitting **0** (or Composure/Order collapsing) ends the posting early
with a distinct failure ending.

## 5. Endings

Determined by final meter mix at turn 24 (or early collapse). Success is
graded on the real **honours ladder** — the player works towards a ribbon, and
which one they get says what kind of officer they became:

- **The K.C.I.E.** — very high Prestige + Revenue. A *knighthood* (Knight
  Commander of the Order of the Indian Empire); "Sir" at last. The careerist's
  pinnacle, and the hardest to reach. Promoted to Commissioner; has learned
  nothing; will go far.
- **The C.S.I.** — high Prestige + high Contentment. Companion of the senior
  Order of the Star of India (*"Heaven's Light Our Guide"*) — the rarer, more
  distinguished ribbon, for a district governed firmly *and* decently.
- **The C.I.E.** — solid Prestige. Companion of the Order of the Indian Empire,
  the honest workhorse honour of a competent district man. The realistic reward.
- **The Quiet Transfer** — middling everything, no honour. Shunted to an even
  smaller district. The Service's way of forgetting you.
- **The Scandal** — Prestige collapses. Recalled. The Club stops writing.
- **The Breakdown** — Composure hits zero. Invalided home "on grounds of
  health." The heat, they'll say.
- **Gone Native** — high Contentment, low Prestige. You resign in sympathy
  with the district and are quietly considered a traitor to your race. The
  only ending the game secretly approves of.
- **The Riot** — Order collapses. A lathi-charge goes wrong, a commission of
  enquiry convenes, and your name is in the London papers.

## 6. Recurring Cast

- **Ram Autar**, your head clerk. Runs the district. Knows where every body is
  buried, including several you will help bury. Unfailingly polite.
- **Commissioner Blyth-Curram**, your superior. A walrus of a man who
  communicates exclusively in telegrams and disappointment.
- **Mrs. Fortescue-Vane**, empress of the Club and its unwritten law.
- **Lala Hukum Chand**, the district's moneylender and largest landholder.
  Owns everyone's debts, including, before long, yours.
- **Pandit Girdhari Lal**, the local pleader and Congress man, forever
  organising something you will have to decide whether to ban.
- **Sub-Deputy Collector Mukherjee**, your Indian deputy, visibly more
  competent than you, which everyone tactfully ignores.

## 7. Visual Identity — *locked*

The look is a **1920s Government of India dossier**: the district's business as
official paperwork crossing a magistrate's desk. This is the canonical design
system — new screens derive from these tokens rather than inventing their own.

**Concept.** Buff official file paper by day; the district officer's bungalow by
lamplight at night. Khaki — from Urdu *khāk*, "dust," the actual colour of the
Raj's uniforms and its files — is the neutral, not a generic cream. The accent
is the oxblood of a wax seal and of "red tape." Secondary is official
indigo-ink. Telegrams and forms were typewritten, so a monospace face carries
all the bureaucratic furniture (tags, deltas, labels).

**Palette**

| Token | Light — *"buff dossier"* | Dark — *"bungalow by lamplight"* | Role |
|-------|--------------------------|----------------------------------|------|
| `--bg` | `#ddd0af` | `#181510` | Desk / page ground |
| `--surface` | `#ece3c9` | `#241f18` | The filed document |
| `--surface2` | `#e3d8ba` | `#2b2519` | Gauges, choice buttons |
| `--ink` | `#231f17` | `#e9ddc0` | Body text |
| `--ink-soft` | `#5b5340` | `#a89c7f` | Labels, captions |
| `--line` | `#b9a373` | `#4a4130` | Khaki hairlines |
| `--seal` | `#8f2f22` | `#cf5a45` | Accent — seal / red tape / headings |
| `--indigo` | `#2f3d5c` | `#93a7cd` | Secondary — focus rings, official ink |
| `--good` / `--warn` / `--bad` | `#4a6b3f` / `#977326` / `#8f2f22` | `#82a86f` / `#c9a752` / `#cf5a45` | Meter states (semantic, *not* the accent) |

Neutrals carry a deliberate warm/khaki bias — never a pure grey. The accent is
spent in one place (seals, headings, red-tape rules); everything else stays
quiet. Dark theme is designed, not inverted, and both themes are token-driven so
the viewer's toggle overrides the OS preference.

**Typography**

- **Display & prose:** old-style serif — `"Iowan Old Style", "Palatino Linotype",
  Palatino, "Book Antiqua", Georgia, serif`. Headings in the seal colour.
- **Bureaucratic furniture:** typewriter mono — `"Courier New", Courier,
  monospace` — for event tags (as rubber stamps), stat deltas, meter labels, the
  masthead department line, and buttons. This mono/serif contrast is the period.
- No webfonts (the artifact CSP blocks font CDNs); the system stacks above are
  the commitment, so nothing falls back silently.

**Motifs**

- **Masthead** styled as a GoI file cover: department eyebrow, title, an **I.C.S.
  roundel seal** (double-ruled circle, rotated a touch).
- **Event tag** rendered as a **red rubber stamp** — bordered, uppercase mono,
  slightly rotated ("CRISIS", "RECKONING", "Telegram").
- **Meters** as a ledger gauge-line with tabular-nums.
- Faint paper-grain dot texture; double khaki rule under the masthead.

**Rules of the house:** semantic meter colours are separate from the accent;
keyboard focus is always the indigo ring; `prefers-reduced-motion` disables the
pulse and hover shifts; running prose stays near 52–65 characters wide.

## 8. Build Plan

- **Phase 0 — Vertical slice (this repo, now).** Single-file web prototype:
  five meters, a turn loop, ~15 event cards, six endings. Proves the loop is
  fun. No build step, runs by opening `index.html`.
- **Phase 1 — Content & structure.** Move events to data (JSON), add flags and
  event chains, add the periodic reckonings, expand to ~60 cards and a full
  24-turn arc. Introduce the recurring cast as multi-card storylines.
- **Phase 2 — Systems.** Proper economy (revenue settlement, the moneylender's
  interest), seasonal deck weighting, save/load, a persistent journal.
- **Phase 3 — Presentation.** Deepen the established identity (§7): period
  textures, audio, a writing polish pass. Consider porting to a framework if it
  grows — the token system carries over intact.

## 9. Direction — *decided*

Following the district-officer research (`docs/district-officer-life.md`), the
build direction is set:

1. **Temporal spine — the authentic year + tour/desk choice.** Replace the flat
   deck with the real calendar (cold-weather touring → hot-weather station →
   monsoon crisis); weight the deck by season. Each fortnight the player also
   chooses *where to be* — **in camp** (raises Contentment and grip on the
   district, costs Composure, lets HQ paperwork pile up) or at the **cutcherry**
   desk (clears files, pleases Simla/Prestige, slowly blinds you to the
   district).
2. **A light economy.** Treasury as a real number; an annual revenue
   settlement; the moneylender's interest compounding; a famine relief budget
   you can overspend. Enough machinery for "management" to bite; not a
   spreadsheet.
3. **A light personal thread.** The wife who may go to the hills, the letter
   about the children sent "home," the bottle in the long evening. A handful of
   recurring personal events feeding Composure — so the *pukka sahib* mask costs
   something real.

**Sequencing:** JSON refactor (done) → seasonal + tour/desk spine → light
economy + personal thread → write content into the new structure →
presentation.

## 10. Data model — *the JSON refactor (done)*

Content is now **pure JSON** embedded in `index.html` as
`<script type="application/json" id="game-data">`, interpreted by a logic-only
engine. No code in the content layer, so events can be authored by hand (or a
tool) and later moved to an external file. Full authoring guide:
`docs/event-schema.md`. Shape in brief:

```
{ "config":  { "maxTurns": 24, "start": { …five meters… } },
  "endings": { "<key>": { "title": …, "text": … }, … },
  "events":  [ {
      "id", "tag",                       // stamp marking (e.g. "MOST SECRET")
      "season": ["cold"|"hot"|"monsoon"|"any"],   // for deck weighting (Fork 1)
      "kind":   "desk"|"tour"|"club"|"personal"|"crisis",
      "once":    true|false,
      "requires": <condition|null>,      // e.g. {"flag":"ramautar_trust"}
      "title", "body",
      "choices": [ {
          "label",
          "effects":  { "<meter>": <delta>, … },   // flat form
          "outcome":  "…",
          "setFlags": ["…"],
          // …or branching form:
          "condition": { "meter":"composure", "op":">", "value":40 },
          "ifTrue":  { "effects", "outcome", "setFlags" },
          "ifFalse": { "effects", "outcome", "setFlags" }
      } ] } ] }
```

The `season`/`kind` fields are carried now but inert until the calendar lands.
Conditions support `{flag}`, `{meter,op,value}`, and `{allOf|anyOf|not}`.

## 11. Open Questions

- Two-year arc vs. one-year — how long before the loop wears out?
- How historically specific do we go with real events (Rowlatt, non-cooperation,
  1927 Simon Commission)? Leaning: fictional district, real texture.
- Does the tour/desk choice want a visible **map**, or stay abstract (a mode
  toggle) until Phase 3?
