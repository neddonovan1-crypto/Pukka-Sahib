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

Determined by final meter mix at turn 24 (or early collapse):

- **The K.C.I.E.** — high Prestige + Revenue. Promoted to Commissioner. You
  have learned nothing and will go far.
- **The Quiet Transfer** — middling everything. Shunted to an even smaller
  district. The Service's way of forgetting you.
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

## 7. Build Plan

- **Phase 0 — Vertical slice (this repo, now).** Single-file web prototype:
  five meters, a turn loop, ~15 event cards, six endings. Proves the loop is
  fun. No build step, runs by opening `index.html`.
- **Phase 1 — Content & structure.** Move events to data (JSON), add flags and
  event chains, add the periodic reckonings, expand to ~60 cards and a full
  24-turn arc. Introduce the recurring cast as multi-card storylines.
- **Phase 2 — Systems.** Proper economy (revenue settlement, the moneylender's
  interest), seasonal deck weighting, save/load, a persistent journal.
- **Phase 3 — Presentation.** Art direction (period ledger / desk aesthetic),
  audio, writing polish pass. Consider porting to a framework if it grows.

## 8. Open Questions

- Two-year arc vs. one-year — how long before the loop wears out?
- Do we want a light resource *economy* (numbers) or keep it meter-nudging
  (qualitative)? The prototype does the latter; it's more legible and funnier.
- How historically specific do we go with real events (Rowlatt, non-cooperation,
  1927 Simon Commission)? Leaning: fictional district, real texture.
