# Art

The art working directory. Nothing here is read at runtime: the build consumes
`art/web/` only, and the shipped game calls no API and carries no key.

`docs/DESIGN-ART.md` is the art bible — what the pictures depict, in which
tradition, by which reproduction process, and why. Read it before adding
anything.

## What lives here

- **Source PNGs at the top level** — the large hand-made originals
  (`cover.png`, `season-*.png`, `scene-*.png`, `medal-*-src.*`). Gitignored
  (`art/*.png`, `art/*-src.*`), so they exist only on the machine that made
  them. `art/seal.png` and `art/seal.svg` are the exception: the masthead
  crest is tracked.
- **`art/briefs/`** — one JSON brief per generated subject (register, aspect,
  use, subject), plus `_registers.json`, which carries the style and
  constraint clauses each register shares. Tracked.
- **`art/gen/`** — raw generator output, before treatment. Tracked.
- **`art/web/`** — the shipped set, and the only directory the build reads.
  Tracked.
- **`art/CREDITS.md`** — provenance for everything here; generated assets
  record their model and prompt.

## The scripts

All three are hand-run. None of them runs on push, and nothing dropped into
this directory is picked up automatically.

- `node scripts/generate-art.js` — briefs to `art/gen/`. Needs
  `GEMINI_API_KEY`; normally invoked through the `generate-art.yml` workflow
  (`workflow_dispatch`), where the key is a repository secret.
- `node scripts/treat-art.js [briefId ...]` — `art/gen/` to `art/web/`,
  through the chromolithograph, engraved-plate or cutout process for the
  brief's register.
- `node scripts/optimize-art.js` — the older path: top-level source PNGs to
  `art/web/`, resized and compressed. Re-run when new source art lands.
  Requires the `sharp` devDependency.

`docs/art-prompts.md` is the provenance record for the original set; it is
superseded for new work by `docs/DESIGN-ART.md` and the briefs.
