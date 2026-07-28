# proto/

Prototypes. **Not wired into the build** — `build.js` reads `src/` and
`art/web/` only, so nothing here reaches the shipped game, and the verify chain
does not cover it.

- **`desk/`** — the first fortnight, per `docs/DESIGN-DESK.md`. A cold-weather
  fortnight at Chhota Nagra: fourteen days, eight papers, the stamp rack,
  delegation, the road, and the reckoning at the end. Open `desk/index.html`
  in a browser; `node desk/shot.js` plays it through and writes screenshots.
