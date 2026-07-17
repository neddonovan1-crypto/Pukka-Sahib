# Pukka Sahib

A tragicomic district-management game set in a forgotten corner of British
India in the 1920s. You are the District Magistrate & Collector of Chhota
Nagra. Everyone is watching to see whether you are a *pukka sahib*. You are
not, but the job is to pretend.

> *A "pukka sahib" is the proper, unflappable Englishman who keeps up
> appearances no matter what. The whole game is a very long joke about how
> keeping up appearances turns out to be the entire job.*

## Play

- **Hosted:** https://pukka-sahib.neddonovan1.workers.dev (Cloudflare), with a
  GitHub Pages mirror deployed from the same `dist/`.
- **Local:** open the built **`index.html`** in any browser — it is a
  self-contained single file (game, content, and art inlined).

## The game

A year in the district: 24 fortnights across three seasons (cold weather /
hot weather / monsoon). Each fortnight you pick a posture — **out on tour**
or **at the cutcherry desk** — then face an event drawn from the season and
your posture. Five meters — **Revenue, Order, Prestige, Contentment,
Health** — trade against each other on nearly every choice; the hot weather
grinds Health down whatever you do, and once a season you may retreat (the
hills, the Christmas camp, the fever fortnight) to recover it at the
district's expense. Underneath runs a light economy: a treasury, two revenue
settlements a year, and the Lala's compounding interest if you borrow.

Let any meter hit zero and the posting ends early (invalided home, a riot, a
scandal, an empty treasury). Survive the year and the final mix grades you on
the honours ladder — **C.I.E. → K.C.I.E. → K.C.S.I.** — or its consolation
prizes: a quiet transfer, or resigning your place in terms the Commissioner
calls intemperate.

Much of the event deck is mined from Kipling — the Plain Tales, the district
stories, the Jungle Book hill-tales — reworked into playable dilemmas.

## Repository layout

- `src/logic.js` — pure headless game logic (no DOM; runs in browser and Node)
- `src/content/` — all content and tuning as schema'd JSON (config, events,
  interludes); merged by `src/content.js`
- `src/ui.js`, `src/shell.html` — presentation and the dossier visual shell
- `build.js` — builds the single-file `index.html` **and** the multi-file
  `dist/` used by the hosted deploys
- `test/` — the verify chain: `validate` (content invariants), `simulate`
  (500 seeded runs per policy with asserted balance bands), `e2e` (Playwright
  through the real UI, desktop + mobile)
- `art/` — source art (gitignored); `art/web/` — optimized shipped art;
  `scripts/optimize-art.js` regenerates it
- `docs/` — design references: event schema, period vocabulary, Kipling
  sourcing, the district officer's year, art prompts

`index.html` is a **build output** — edit `src/` and run the chain instead.

## Development

```
npm install        # dev deps: playwright, sharp, wrangler
npm run verify     # validate → simulate → build → e2e (all must pass)
```

The working agreement in `CLAUDE.md` governs contributions: nothing lands on
the release branch unverified, content rules are enforced by the validator,
and balance targets are assertions in the simulator, not aspirations.
