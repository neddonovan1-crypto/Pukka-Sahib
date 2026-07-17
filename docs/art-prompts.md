# Art Prompts — Pukka Sahib

Prompts for generating game art (e.g. via ChatGPT / DALL·E). The **golden rule
is consistency**: every image must share one house style so the set reads as a
single game and sits against the locked dossier palette (`DESIGN.md §7`).

**How to use:** generate the **seal first**, then for each subsequent image tell
the model *"in the exact same two-colour vintage-lithograph style as the
previous image"* and paste the STYLE BLOCK again. Keep images **text-free** —
all lettering is done in CSS. Deliver **PNG** (transparent background for the
seal and medals). Filenames matter for wiring-in — use the ones given.

Aspect ratios: square = 1024×1024; wide = 1792×1024; portrait = 1024×1792.

---

## The STYLE BLOCK (paste into every prompt)

> **STYLE (keep identical across every image):** A vintage 1920s **duotone
> lithographic illustration**, in the manner of an old Government of India
> gazette plate crossed with an Indian State Railways travel poster. Printed
> with just two inks — **oxblood red (#8f2f22)** and **deep indigo-blue
> (#2f3d5c)** — plus their overlaps, on **warm buff dossier paper (#e3d8ba)**
> with faint khaki-sepia tones. Fine **engraved line-work** with delicate
> stipple and cross-hatch shading; subtle halftone; the look of an aged,
> lightly-foxed printed plate with soft ink registration. Elegant, restrained,
> dignified, historically accurate to British India in the 1920s. **Flat and
> printed — not photographic, not 3D, not glossy.** People are drawn with
> period accuracy and **dignity, never as caricatures**. **No lettering, no
> text, no numbers, no signature, no watermark, no border frame.**

**Negative prompt (if supported):** photographic, 3D render, glossy, neon,
modern clothing or objects, cars, phones, cartoon, anime, exaggerated
caricature, text, watermark, oversaturated colours.

---

## Priority set (highest impact — 5 images)

### 1. `seal.png` — the I.C.S. crest *(square, transparent bg)*
> [STYLE BLOCK]
> SUBJECT: A single circular official administrative **seal**, centred, filling
> ~80% of the frame with clear margins. A beaded **double-ring roundel**
> enclosing a radiant many-pointed **star**; at its centre a small **antique oil
> lamp** giving off rays of light (evoking the motto "Heaven's Light Our
> Guide"). Symmetrical, heraldic, emblematic. **Leave the ring band empty — no
> text.** Printed in oxblood on buff with indigo shadow accents.
> COMPOSITION: square 1:1, emblem isolated so it can be cut out; plain flat or
> transparent background.

*Use:* replaces the CSS "I.C.S." roundel in the masthead.

### 2. `cover.png` — title banner *(wide)*
> [STYLE BLOCK]
> SUBJECT: A lone British **district officer** of the 1920s in white cotton
> drill and a **solar topi**, seen from **behind and small** in the frame,
> standing on a low rise and looking out over a vast, hazy North-Indian plain —
> scattered flat-roofed villages, a distant temple tower and a minaret, a
> dust-hazed horizon, a few kites wheeling in a huge sky. At his feet, a black
> **tin dispatch box** and a bundle of **red-taped files** on the dry earth.
> Mood: solitary, dwarfed by the land, quietly ironic. Indigo-dominant sky.
> COMPOSITION: wide landscape; leave the **upper third relatively empty** for a
> title overlay. No text.

*Use:* start-screen / top banner.

### 3. `season-cold.png` — cold weather / touring *(wide)*
> [STYLE BLOCK]
> SUBJECT: A district officer's **cold-weather touring camp at dawn**. Two or
> three white canvas ridge-tents pitched under a spreading **mango grove**; a
> camp table with papers outside a tent; a saddled horse and a couple of pack
> bullocks; a quiet **line of villagers** in dhotis and turbans waiting
> respectfully; thin winter mist, bare fields, long low golden light. Calm,
> orderly, faintly hopeful. Cool indigo shadows, oxblood warmth in the light.
> COMPOSITION: wide landscape, balanced mid-distance view. No text.

### 4. `season-hot.png` — hot weather / station *(wide)*
> [STYLE BLOCK]
> SUBJECT: A colonial **district bungalow in the dead heat**, late morning. A
> long low white bungalow with a deep shaded verandah and drawn chik blinds;
> drooping dusty trees; a wide **bleached empty maidan** shimmering with
> heat-haze; a solitary figure in white on the verandah steps; a pariah dog
> asleep in the only shade; a hard white overhead sun. Mood: oppressive
> stillness, glare, solitude. Oxblood/sepia-dominant, bleached and high-key.
> COMPOSITION: wide landscape, lots of empty baked space. No text.

### 5. `season-monsoon.png` — monsoon / crisis *(wide)*
> [STYLE BLOCK]
> SUBJECT: The **monsoon at its height** in the plains. A swollen brown river
> burst over its banks; a raised **railway embankment** crowded with stranded
> villagers, cattle and bundled belongings under a leaden sky; driving diagonal
> rain; two small **country boats** poling toward rooftops that show above the
> water; dark turbulent monsoon clouds. Mood: danger, urgency, endurance.
> Deep indigo-dominant. COMPOSITION: wide landscape, dynamic. No text.

---

## Honours medals *(optional — square, transparent bg; 3 files)*

For the ending screens. Here you **may add one accent colour** for the ribbon.

- `medal-cie.png` — a **Companion's** badge: a modest star/badge suspended from
  a folded neck-ribbon.
- `medal-csi.png` — a **grander star** on a paler ribbon (the senior order).
- `medal-kcie.png` — a **knight's breast-star**, larger and more radiant.

> [STYLE BLOCK — you may add ONE accent colour for the ribbon]
> SUBJECT: A single period British-Indian **order insignia** shown as an
> engraved medal plate, isolated on a transparent background with margins: a
> heraldic **star/badge suspended from a folded neck-ribbon**, [modest and
> plain / grand and radiant on a pale ribbon / a large radiant knight's
> breast-star]. Antique, finely engraved, symmetrical. No text or lettering on
> the medal. COMPOSITION: square 1:1, isolated.

---

## Extended set *(optional — event vignettes & character portraits)*

Small square images to sit atop event cards / character moments. Reusable
template, then per-subject lines. Generate any you want; ask me to write more.

**Template:**
> [STYLE BLOCK]
> SUBJECT: [scene], a small **square vignette**, single clear focal subject on
> plain buff with margins, engraved-plate look. COMPOSITION: square 1:1. No text.

**Event vignettes**
- `ev-bull.png` — a large white **Brahminy bull** with painted horns standing
  serenely in a trampled marigold flowerbed outside a small police post, a
  flustered Indian sub-inspector gesturing; gently comic but dignified.
- `ev-tiger.png` — a **tiger** emerging from tall grass at dusk, seen at a wary
  distance; tension, no gore.
- `ev-club.png` — the **verandah of a small up-country club** at evening: cane
  chairs, a billiard-room window, two figures in evening dress, a servant with a
  tray; insular, faintly absurd.
- `ev-flood.png` — a country **boat rescuing a family from a rooftop** in brown
  floodwater under rain (a tighter companion to the monsoon banner).
- `ev-mangoes.png` — a **basket of ripe mangoes** on a desk beside a bundle of
  red-taped files; a bribe that dares not speak its name.

**Character portraits** *(square or portrait busts)*
- `ch-ramautar.png` — a composed **elderly Indian head clerk** in a black achkan
  and small cap, spectacles, holding a file; shrewd, unreadable, dignified.
- `ch-commissioner.png` — a stout, **walrus-moustached senior British official**
  in a high collar; self-important, weathered, caricature-free.
- `ch-lala.png` — a prosperous **Indian moneylender-landholder** in a fine kurta
  and gold-rimmed spectacles, watchful and genial.
- `ch-pandit.png` — a lean, intense **Indian pleader** in a Gandhi cap and
  homespun khadi, mid-thought; earnest, dignified.
- `ch-mukherjee.png` — a sharp young **Bengali deputy collector** in a neat
  Western suit and spectacles, a slight knowing smile; abler than he lets on.
- `ch-memsahib.png` — an imperious 1920s **Englishwoman** in a garden-party dress
  and hat, chin raised; formidable empress of the Club.

---

## Integration notes (for me)

- Optimise each to display size and **embed as base64 data URIs** in
  `index.html` (keeps the single-file / CSP-safe constraint). Downscale wide
  banners to ~1200px, compress; target a lean total page weight.
- Wire-in points: `seal.png` → masthead crest; `season-*.png` → behind/above the
  season band per current season; `cover.png` → optional start screen; medals →
  ending screens; vignettes → event card headers (add an optional `art` field to
  events in the JSON schema); portraits → character-arc moments.
- Keep the **core five** as the default visible set; treat the rest as progressive
  enhancement so the file stays light.
