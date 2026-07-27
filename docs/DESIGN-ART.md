# The art bible

How Pukka Sahib looks, and why. Read alongside **`DESIGN.md §7`**, which remains
authoritative for the interface chrome — palette tokens, typography roles,
focus rings, meter semantics. This document governs the *pictures*: what they
depict, in which tradition, by which reproduction process, and how they are
produced.

Written after the engraving spike proved the procedural approach, and after the
decision to admit colour and a second visual tradition.

---

## 1. The argument

The player never meets the district. They meet **representations** of it.

That is the game's whole mechanism, and the art carries it. So the visual system
divides in two:

- **The paper is real.** You hold it. Fibre, perforations, ribbon fade, ink that
  sat too long on the pad. Realism here means *you are actually at this desk*.
- **The picture is always someone's rendering.** Never the event — an account of
  the event, made by somebody, in their own tradition, for their own reasons.

And there is more than one tradition in the room.

**Engraving is the Government's way of seeing.** Line, monochrome, single-point
perspective, documentary neutrality. It says: *this is objective fact.* It is
the language of the survey sheet, the district manual, the Illustrated London
News.

**Painting is the district's way of seeing.** Flat ground, high viewpoint,
opaque colour, profile figures, hierarchical scale, a ruled border. It says:
*this is what mattered.*

**Kalighat is the bazaar's way of seeing.** Four colours, no background, a brush
moving fast, and a joke at the sahib's expense.

Only one of the three is admissible as evidence in your file. That is the
tragedy, drawn rather than narrated.

### It is historically true

The 1920s is precisely when Indian artists were reclaiming the miniature
tradition as an explicitly nationalist project — Abanindranath Tagore, Nandalal
Bose and the Bengal School, setting Mughal and Ajanta idioms against Royal
Academy naturalism. A petition illustrated in that register, arriving on a
magistrate's desk in 1925, is not an invention. The argument this art system
makes was being made at the time, by real painters, as politics. Name the
tradition in the prose the way the game names swaraj and non-co-operation.

---

## 2. The rule of process authenticity

**Everything on screen must look as though it was produced by a reproduction
process available in 1925.** Not "period-themed" — actually letterpress,
engraved plate, chromolithograph, halftone screen, rubber stamp, or brush on
paper.

This is the rule that lets procedurally-drawn maps, generated paintings and
typeset documents share a desk without looking like a mood board. They are not
the same subject or even the same tradition; they are the same *press*.

It also makes source quality largely irrelevant, which is what makes generated
art viable: whatever comes back goes through the same process and comes out
belonging.

---

## 3. Register I — the paper *(realistic)*

The only register that chases literal fidelity. If a document does not look like
an object you could pick up, it has failed.

### Stocks

| Stock | Used for | Character |
|---|---|---|
| Buff foolscap | Official file notes, orders | Ruled endorsement column, punch holes, red tape |
| Telegram flimsy | Wires from the Division, crises | Thin, faintly tinted, gummed teleprinter strips |
| Cream laid | Private letters, Club notices | Watermark, deckle, a good hand |
| Newsprint | The Gazette, the press | Coarse, grey, columns and rules |
| Handmade rag | Petitions | Irregular edge, absorbent, court-fee stamp, thumbprint |
| Card | Service records, invitations | Rigid, ruled, double border |

### Furniture

Rubber stamps (over-inked on one edge, never perfectly straight), wax seals and
embossing, King George V definitives with **SERVICE** overprints for official
mail, court-fee and revenue stamps, perforations and their tearing, docket
numbers, file references, initials in the margin, a signature in a different
ink from the body.

### Wear

Foxing, creases, pin rust, punch holes, tape, a ring where a glass stood,
a struck-through line still legible beneath the strike. **Sparse and
deliberate** — procedural wear applied evenly reads as noise within seconds.

---

## 4. Register II — engraving *(the machinery and the land)*

**Subject:** maps and survey sheets, architecture and elevations, seals, medals,
dies, instruments, the land itself. The world of things and of Government.

**Technique:** tone is hatch density; texture is hatch angle; form is the
direction the lines follow. Fine, close, calm lines — the engraver's stroke is
thin and confident, not a sketcher's scribble. Three crossing families at most;
past roughly 80% darkness lay solid ink beneath the hatch or heavy passages read
as wire mesh. Hills in hachure follow ridges, never radiate from a centre.

**Palette:** one warm black on buff. No colour, ever.

**Sources:** the Daniells' *Oriental Scenery*; Survey of India sheets and the
district gazetteers; the *Illustrated London News* and *The Graphic*; Bewick for
texture; Piranesi for architectural drama.

**Produced:** procedurally, by the hatching engine. This register needs no
generation at all.

---

## 5. Register III — painting *(people and events)*

**Subject:** people, ceremonies, festivals, work, weather, the life of the
district. Anything with a human being at its centre.

**Technique:** flat opaque colour, no cast shadow, high or absent horizon,
figures in profile or three-quarter, hierarchical scale, architecture shown in
plan and elevation at once, fine brush stipple for modelling, a ruled border
(*hashiya*) that the composition may deliberately break.

**Palette:** lapis and ultramarine, vermilion, orpiment yellow, malachite green,
white lead, gold. Saturated and unmixed.

**Sources:** Mughal — the *Akbarnama*, the *Padshahnama*. Pahari — Nainsukh.
Company School — Sita Ram, Ghulam Ali Khan, the Impey album. Bengal School
(period-exact) — Abanindranath Tagore, Nandalal Bose, Asit Kumar Haldar.

**Produced:** generated to brief, then treated as chromolithograph.

---

## 6. Register IV — Kalighat *(the verdict)*

**Subject:** rumour, satire, the bazaar's opinion, the comic beat. What is being
said about you when you are not in the room.

**Technique:** swift brush, bold sweeping contour, three or four colours, no
background whatsoever, a single figure or pair filling the sheet, exaggerated
where it is funniest.

**Palette:** deliberately narrow — earth red, yellow ochre, blue-grey, black,
and the paper.

**Sources:** the Kalighat pats of Calcutta, which existed in large part to mock
babus, officials and the newly rich.

**Produced:** generated to brief. The cheapest register to make and the one most
likely to land, so use it.

---

## 7. Choosing a register

**Register follows subject, and is authored per event** — a `register` field on
the content, not a rule derived from the document's source. Conventions:

- Land, buildings, instruments, Government's own account → **engraving**
- People, events, the district's life → **painting**
- Rumour, satire, reputation → **Kalighat**
- Anything that is a document → **paper**, always, regardless of what is on it

Where two would serve, prefer the one that is *not* the Government's. The
engraving register is the one the player already has too much of.

---

## 8. Colour

Colour is **frequent but contained**. The discipline is not scarcity; it is
never letting pigment loose in the interface.

- The chrome — paper, type, rules, stamps, meters, buttons — stays on the
  `DESIGN.md §7` tokens: khaki neutrals, oxblood seal accent, official indigo.
- Pigment colour appears **only inside a picture's border**. It never tints a
  control, a meter, a heading, or a background.
- Semantic meter colours remain separate from both systems.

The existing indigo token is a cousin of Mughal lapis, so the two palettes
rhyme at the join rather than clash.

---

## 9. Reproduction processes

Three treatments, applied to unify everything regardless of origin:

| Process | Applied to | Character |
|---|---|---|
| **Engraved plate** | Line work, procedural art | Hatch tone, plate mark, warm black on buff |
| **Chromolithograph** | All colour art | Limited flat separations, slight misregistration, stone grain |
| **Halftone screen** | Any photograph, if ever used | Coarse dot, ~65–85 lpi, single warm ink |

Chromolithography is period-correct and not a stylisation: it is how Ravi Varma
prints and bazaar art actually reached people in this era. Generated colour art
goes through it and stops looking generated.

---

## 10. Typography

- **Prose:** an old-style serif of the kind Government of India printing
  actually used — Caslon or Baskerville by preference.
- **Bureaucratic furniture:** a real typewriter face with key irregularity and
  ribbon fade, not Courier New. This carries every file note and telegram and is
  the most-seen face in the game.
- **Gazette headings:** Clarendon or a period slab.
- **Manuscript:** an engrosser's hand for signatures and endorsements; a looser
  hand for petitions.
- **Indic:** a Devanagari and a Nastaliq face. Required, not optional — the
  district must be able to address the player in its own script.

---

## 11. Framing

- Engravings carry a **plate mark** — the impression of the copper in damp paper.
- Paintings carry a **ruled border**, which the composition may break.
- Kalighat sheets carry **no border at all**; they are cheap prints.
- Pictures sit *within* documents as enclosures, pinned or pasted, never as
  full-bleed backdrops behind text.
- Running prose stays near 52–65 characters.

---

## 12. Rules of the house

1. **Never make the Raj charming.** The paper is handsome; what is recorded on
   it is not. The whole point is that atrocity arrives as a well-set form with a
   tidy endorsement column. Never soften the second to enjoy the first.
2. **Name the tradition, don't blend it.** Mughal, Pahari, Company School,
   Bengal School and Kalighat are distinct traditions with distinct politics.
   Treating them as one generic "Indian style" is both bad art direction and
   disrespectful. Briefs specify which.
3. **The district's way of seeing is not decoration.** It carries as much
   authority as the engraving; the game's argument is that only one of them
   counts as evidence, not that only one is true.
4. **No number without a source and a date.** Every figure the player sees is on
   a document, attributable and possibly wrong.
5. **No full-bleed art.** Everything is an object on a desk.
6. **Deliberate imperfection only.** Wear, misregistration and broken lines are
   authored, never sprayed uniformly.

---

## 13. Production

| Register | How made | Needs generation? |
|---|---|---|
| Paper | Typography, CSS, procedural stock and wear | No |
| Engraving | Hatching engine, from geometry or a tone map | No |
| Painting | Generated to brief → chromolithograph treatment | Yes |
| Kalighat | Generated to brief → chromolithograph treatment | Yes |

Generation is **build-time and hand-invoked**. Assets are produced once,
treated, committed and shipped as ordinary files. The game never calls an image
API, carries no key, and works offline. The only art that runs live is
procedural, because state-driven surfaces must redraw from state.

Briefs live as data in `art/briefs/`, so prompts are versioned, reviewable and
reproducible. Provenance — model, prompt, date — is recorded per asset in
`art/CREDITS.md`, following the `audio/CREDITS.md` convention.

---

## 14. Open

- The **portrait problem**: procedural engraving could not do faces. The profile
  conventions of the painting register should solve it, since character is
  carried by posture, dress and colour rather than anatomy. Unproven.
- **Consistency of the cast** across chapters will need seeds or
  reference-image conditioning.
- Hachured hills and foliage in the engraving register are still the weakest
  procedural subjects.
- Real typefaces are unchosen; the spike ran on system fallbacks.
