# Design notes & session handoff

What the commit log, the GitHub issues, and `CLAUDE.md` don't capture: the
reasoning, the conventions, and the feel-of-the-game context needed to continue
the work. Read alongside **`CLAUDE.md`** (the working agreement — authoritative,
edited only on the human's explicit instruction) and **`docs/event-schema.md`**
(the authoring guide). This file is agent-maintained scratch; keep it current.

## Where the newer mechanics live (data field · logic · guardrails)

Everything below is data-driven. For each: the schema, and the validator/sim
rules that keep it honest.

- **Consultation** — event field `consult: {who, tag?, opinion, effects?, econ?, setFlags?}`.
  `consult()` transition is pure (no rng — advice is authored, not rolled);
  snapshot exposes `s.consult`; reset per fortnight in `enterTurn`. Validator:
  opinion ≤ 420 chars, any meter nudge ≤ ±6, interludes may carry none. Sim: a
  `skilledConsult` batch on the skilled seeds asserts consulting can't swing the
  honours rate > 12 points. ~42 of 258 events carry one (about 1 in 6).
- **Persistent cast** — chapter `config.cast: [{id, name, who, won?/wronged?: {flag, note}}]`.
  A pure read of relationship flags earlier choices already set → snapshot
  `s.standings` → the "The district remembers" strip. Validator: every declared
  standing flag must be **produced** by a choice AND **consumed** (a gated event
  or coda). Sim: both sides of each bond asserted reachable.
- **The Gazette** — start-screen view reading the persistent career record
  (honours cabinet, fates witnessed, codas discovered). Career gained a
  `codasSeen` ledger (append-only, backward-compatible). Pure presentation.
- **Two-step events** — a top-level choice carries `then: {tag?, title?, body, choices}`.
  The setup choice may NOT branch (`condition`) or gamble (`risk`) and must have
  an `outcome` (it becomes the follow-up's lead-in). The synthetic follow-up
  card is serialized so a run resumes mid-step. One level only. ~10 events.
- **Danger-aware meters** — `L.METER_FLOORS` (Prestige/Order = 40, the scandal
  floor; Health/Revenue = 25, the warning band; Contentment has none). Snapshot
  `s.deltas` = per-fortnight move. UI shows a red **danger ZONE** at the foot of
  each bar (the fill hides it while healthy, so red appears only as a meter
  falls into peril — deliberately NOT an always-on mark, which read as a mystery
  tick) plus a ▲/▼ trend.
- **Year strip / season wash / document theatre / choice stamp / sticky mobile
  meters** — pure UI in `ui.js` + `shell.html`, off the snapshot, no rules impact.
- **Economy · projects** — chapter `config.projects: [{id, cost, matures, tag,
  label, note, commission:{title,body,outcome?}, title, thrived:{requires,body,effects,setFlags?}, languished:{...}}]`.
  Commissioned via a posture-screen option (`worksOnOffer`); queued in
  `S.projects`; matures in `beginFortnight` as an interlude whose fate
  (`thrived`/`languished`) is READ from the district state, not chosen. Only
  dm/comm/lg have projects — the probation AC has none by design. Sim: `builder`
  (keeps the district well) + `builderCareless` (neglects it) probes prove each
  work is commissionable and both fates reachable. **Existing graded policies
  never commission**, so the main bands are untouched.
- **Economy · debt teeth** — the creditor already "calls in person" at `debtWarn`
  (the pre-existing `warn-debt` / `comm-warn-debt` / `lg-warn-debt` events, with
  pay-down/renegotiate/defy choices). Added a deeper `*-debt-called` priority
  event per dm/comm/lg, gated on a band between `debtWarn` and the ceiling (the
  Government audits the accounts). Sim asserts it fires in borrow-heavy play.
- **Push-your-luck touring** — chapter `config.tourPress: {chanceBase, chanceRamp,
  chanceCap, max, press:{effects}, risk:{title,body,effects,setFlags?,outcome},
  bank:{title,body,outcome?}, tag, intro, label, note, campLabel, campNote,
  postureLabel, postureNote}`. A DISTINCT posture option (`kind: "tourpress"`,
  cold weather only) → the `press` phase → `pressOn()`/`makeCamp()`. Only ac/dm
  (the ranks that genuinely camp). The posture option shows NO fixed-reward chips
  (its gain depends how far you press) and wears the dashed gamble border.
  `greedyTourer` probe proves the tour can turn.
- **Start-screen ladder** — each rung shows `config.chapter.premise` (a one-line
  mission description), not the honour it plays for.

## Conventions & gotchas (learned this cycle — read before adding mechanics)

- **rng-safety.** Any new `rng()` call in the posture/draw path shifts the whole
  seeded sim and can break bands. Safe pattern: gate new branches on
  DETERMINISTIC conditions (season, flags), and make the default/no-op path
  consume rng IDENTICALLY to before. (Push-your-luck is its own posture kind so
  plain `tour` is byte-identical to the old tour.)
- **New optional actions don't touch the graded bands.** The graded policies
  (skilled/tour-only/desk-only/random/paragon) never commission works or press
  the luck, so those features shipped without re-tuning the core bands; dedicated
  probes exercise them. Keep this property when adding player-optional systems.
- **Tail reachability is fragile.** `bankrupt`/`riot`/the top rung are marginal
  (a few hits per 200-run probe). Adding content re-seeds the draws and can flip
  a tail to 0. Real fixes seen: the reckless probe was taking the seasonal
  hill-leave and *healing* off the road to ruin (now desk-only, no retreat); a
  marginal random-honours floor was restored by giving two hard new crises' sane
  options their due prestige. **After any content change, re-run the sim and
  expect to re-check the tails.**
- **Two-step events shift balance** (they add decisions with effects). Keep
  PRESTIGE gains modest — prestige is the honours currency; a big swing
  unbalances the game. The first AC crowd event had to be trimmed to hold
  tour-only honours under its 10% cap.
- **Balance philosophy.** Guaranteed fiscal beats live in **occasions** (forced
  set-pieces, ~40–60% of the debt ceiling) so the bankruptcy tail never depends
  on draw luck. The pinnacle honour may fairly require the previous rank's
  carried inheritance (see the sim's `paragonCarried` batch). Settlements must
  not sit immediately after a big-borrow window — they auto-rescue the probe.
- **Content authoring at scale.** Parallel background agents, ONE PER CHAPTER
  (each owns its chapter's files exclusively → no edit conflicts), briefed with
  the schema + voice bible + hard rules. Then integrate here: `json.load` +
  double-escape grep + spot-read voice + full verify + tune tails. This worked
  well for the +24 consults / +8 two-step batch.
- **Voice.** Kipling's Anglo-Indian narrator. Kill the LLM tics: the appended
  "— which is X" clause, "It is A. It is also B." parallelism, a closing aphorism
  on every outcome, precisely/entirely as filler, rhythm-triads, abstract nouns
  as agents, "some/certain" vagueness. Use direct speech in `&lsquo;…&rsquo;`.
  Name the independence movement (swaraj / non-co-operation / Congress) at first
  mention, never bare "the movement". Entities not raw double-quotes; NEVER
  double-escape (`&amp;mdash;` is a bug). The validator can't see *thematic*
  duplication (e.g. two chapters both adapting the same Kipling story) — audit
  for it manually each content pass.

## Art & audio — pipelines ready, files needed from the human

- **Art build-split.** The single-file `index.html` embeds only essential chrome
  (cover, seal, season banners, medals); station scenes and any NEW art ship in
  **`dist/` only** (external files, no weight limit — `dist/` is what
  adventuresahib.com serves). So new art never touches the portable build's
  weight. `build.js` `isEssentialArt()` decides embed-vs-external. Pipeline: drop
  source into `art/`, run `node scripts/optimize-art.js` (sharp → ~1200px JPEG
  q70), rebuild. Budgets: single-file 2600 KB, embedded art 1400 KB.
- **Art gaps** (worth an issue when files arrive): chapter-distinct backdrops for
  comm/lg (they currently reuse dm-era scenes); the missing medals
  (K.C.I.E./G.C.I.E./G.C.S.I./despatch/division); set-piece event art
  (famine/flood/riot/durbar, via an event's `art` key); more season variants.
  Public-domain sources: British Library (Flickr Commons), Wikimedia Commons,
  NYPL Digital Collections, Internet Archive pre-1929.
- **Audio (issue #25).** Ambience is synthesised live (`audio.js`, zero page
  weight; retuned this cycle away from the "mosquito" whine). Real recordings:
  drop CC0/public-domain `ambience-cold|hot|monsoon.mp3` into `audio/` (see
  `audio/README.md`); the build ships them on `dist/` as season-crossfaded loops,
  synthesis as the fallback. This environment can't fetch them — the human adds
  the files.

## What the human has reacted to (design priorities)

- Wants mechanics **felt, not glimpsed** — consultation and two-step were too
  rare and got tripled/5×'d. The same instinct applies to any new mechanic: seed
  enough instances that a career runs into it.
- Cares most that the **economy is real** (money as an expression of intent, not
  a scoreboard) — that drove projects + debt-teeth.
- Sensitive to **UI clarity**: the danger marks were "unclear" → danger zone; the
  push-on tour looked identical to the quiet tour → no chips + gamble border;
  start-screen subtitles should describe the mission, not the honour → premise.
- Wants **smoothness** (image crossfades, no scroll-slam on a new fortnight) and
  no jarring audio cuts (mission-switch fades the ambience down first).
- Prefers plain, discoverable presentation over cleverness.

## Open / next steps

- **#25 audio** and **art files** — both blocked on the human supplying files;
  the pipelines are ready and waiting.
- More two-step events and consults for comm/lg; more projects (one per chapter
  so far); extend the cast to ranks lacking a full set.
- The **full budget game** (Revenue feeding the treasury, seasonal allocation)
  was explicitly DEFERRED — only projects + debt-teeth were in scope for #36.
- If the portable single-file's dropped station scenes ever matter, revisit the
  art split (portable backdrops are currently season banners only).
