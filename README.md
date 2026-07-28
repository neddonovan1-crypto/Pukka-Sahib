# Pukka Sahib

A tragicomic career game set in a forgotten corner of British India in the
1920s. You rise — or fail to — through the Indian Civil Service, from a
probationer's sub-division to a province. Everyone is watching to see whether
you are a *pukka sahib*. You are not, but the job is to pretend.

> *A "pukka sahib" is the proper, unflappable Englishman who keeps up
> appearances no matter what. The whole game is a very long joke about how
> keeping up appearances turns out to be the entire job.*

## Play

- **Hosted:** https://adventuresahib.com (Cloudflare Workers), with a
  GitHub Pages mirror deployed from the same `dist/`.
- **Local:** open the built **`index.html`** in any browser — it is a
  self-contained single file (game, content, and art inlined).

## The game

A career in four **chapters**, played in order — each a self-contained
posting, each unlocked by completing the one before:

| # | Rank | Station | Length | Plays for |
|---|------|---------|--------|-----------|
| I | Assistant Commissioner | Kotra sub-division | 12 fortnights, two seasons | Confirmation — with a Despatch, if the Collector is impressed |
| II | District Magistrate & Collector | Chhota Nagra | 24 fortnights, three seasons | the C.I.E. — and a Division, if the year is remarkable |
| III | Commissioner | the Sonepore Division | 24 fortnights, three seasons | the K.C.I.E. — and the K.C.S.I., in an exceptional year |
| IV | Lieutenant-Governor | Government House, Barhampur | 24 fortnights, three seasons | the G.C.I.E. — and the G.C.S.I., if the term makes history |

Honours are **rank-bound**: a district year cannot win a knighthood, however
well it goes. Its pinnacle is advancement — the Division — and the C.I.E. is
the most the List will give it. The knighthoods belong to the Commissioner,
the Grand Commanders to the Lieutenant-Governor. Choices, debts and
attachments carry forward between chapters: a sweetheart, a tahsildar's
respect, a moneylender's paper, an old sin.

Each fortnight you pick a posture — **out on tour** or **at the desk**,
labelled for the season and the rank — then face an event drawn from that
season and posture. Five meters — **Revenue, Order, Prestige, Contentment,
Health** — trade against each other on nearly every choice; the hot weather
grinds Health down whatever you do, and once a season you may retreat (the
hills, the Christmas camp, the fever fortnight) to recover it at the
station's expense. Underneath runs a light economy: a treasury, revenue
settlements, and compounding interest if you borrow.

Let any meter hit zero and the posting ends early (invalided home, a riot, a
scandal, an empty treasury). Survive the term and the final mix is graded
against that chapter's ladder — or against its consolation prizes: a quiet
transfer, or resigning your place in terms the Commissioner calls
intemperate.

Much of the event deck is mined from Kipling — the Plain Tales, the district
stories, the Jungle Book hill-tales — reworked into playable dilemmas.

## Repository layout

- `src/logic.js` — pure headless game logic (no DOM; runs in browser and Node)
- `src/content/` — all content and tuning as schema'd JSON (config, events,
  interludes), one bundle per chapter (`ac/`, the district year at the top
  level, `comm/`, `lg/`); merged into the chapter registry by `src/content.js`
- `src/ui.js`, `src/shell.html` — presentation and the dossier visual shell
- `build.js` — builds the single-file `index.html` **and** the multi-file
  `dist/` used by the hosted deploys
- `test/` — the verify chain: `validate` (content invariants), `simulate`
  (500 seeded runs per policy with asserted balance bands), `e2e` (Playwright
  through the real UI, desktop + mobile)
- `art/` — the art working directory. Large source PNGs at the top level are
  gitignored (`art/*.png`, `art/*-src.*`); `art/briefs/`, `art/gen/`,
  `art/web/`, `art/CREDITS.md` and the `art/seal.*` masthead are tracked.
  `art/web/` is what the build consumes. See `art/README.md`.
- `docs/` — design references: event schema, period vocabulary, Kipling
  sourcing, the district officer's year, art prompts, plus:
  - `docs/DESIGN-ART.md` — the art bible: what the pictures depict, in which
    tradition, by which reproduction process, and how they are produced
  - `docs/DESIGN-NOTES.md` — design notes and session handoff: the reasoning
    and conventions behind the newer mechanics that the commit log and the
    issues don't capture

`index.html` is a **build output** — edit `src/` and run the chain instead.

## Art

The pictures are authored at build time and shipped as ordinary files. The
game itself calls no API and carries no key.

- **`art/briefs/`** — one JSON brief per subject: its register, aspect ratio,
  use, and the subject description. `art/briefs/_registers.json` holds the
  style and constraint clauses for each register (painting, kalighat,
  engraving, security-print, isolated), so the house style lives in one place
  rather than being retyped per brief. `docs/DESIGN-ART.md` explains what each
  register is and why.
- **`scripts/generate-art.js`** — resolves briefs against their register,
  asks the API which image models the key can actually reach, generates into
  `art/gen/`, and records model and prompt in `art/CREDITS.md`. Hand-run via
  the `generate-art.yml` workflow (`workflow_dispatch`), where the key lives
  as a repository secret; it has a hard per-run image cap and a `DRY_RUN` mode
  that resolves briefs without generating.
- **`scripts/treat-art.js`** — takes `art/gen/` to `art/web/` by putting each
  register through the process it would have come off a press by:
  **chromolithograph** (colour work posterised to a small ink set, the
  separations knocked slightly out of register, stone grain over the top),
  **engraved plate** (line work in warm black on buff, with a plate mark), or
  **cutout** (the white ground keyed out to transparency, so a stamp can be
  gummed onto a document rather than sit in a white box). Hand-run.
- **`scripts/optimize-art.js`** — the older path: resizes and compresses the
  hand-made source PNGs at the top of `art/` into `art/web/`. Hand-run, when
  new source art lands.

## Development

```
npm install        # dev deps: playwright, sharp, wrangler
npm run verify     # validate → simulate → build → e2e (all must pass)
```

The working agreement in `CLAUDE.md` governs contributions: nothing lands on
the release branch unverified, content rules are enforced by the validator,
and balance targets are assertions in the simulator, not aspirations.
