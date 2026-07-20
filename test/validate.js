/* Content validator — every content rule as an executable check, not a
   convention. Validates every chapter bundle in the registry. Exits non-zero
   on any violation. Run: node test/validate.js */
"use strict";
var registry = require("../src/content.js");

var METERS = ["revenue", "order", "prestige", "contentment", "health"];
var SEASON_KEYS = ["cold", "hot", "monsoon"];
var KINDS = ["desk", "tour", "club", "personal", "crisis", "interlude"];
var OPS = [">", ">=", "<", "<=", "==", "!="];
var ECON_KEYS = ["treasury", "debt"];
// Endings every chapter must carry regardless of its honours ladder: the
// collapses and the neutral verdicts are engine-structural.
var STRUCTURAL_ENDINGS = ["breakdown", "riot", "scandal", "bankrupt", "gonenative", "transfer"];
var MAX_METER_DELTA = 25;  // sanity band on a single effect
var FORBIDDEN = [/\bTODO\b/, /\blorem\b/i, /claude-[a-z0-9-]*\d/i];

var errors = [];
var totals = { chapters: 0, events: 0, endings: 0, flags: 0 };

function validateChapter(content, chapterKey) {
  totals.chapters++;
  function check(cond, msg) { if (!cond) errors.push("[" + chapterKey + "] " + msg); }
  function scanText(s, where) { FORBIDDEN.forEach(function (re) { check(!re.test(s), where + ": forbidden pattern " + re + " in text"); }); }

  /* ---- config ---- */
  var cfg = content.config;
  var SEASON_FLOOR = typeof cfg.seasonFloor === "number" ? cfg.seasonFloor : 6;
  check(typeof cfg.maxTurns === "number" && cfg.maxTurns > 0, "config.maxTurns missing/invalid");
  METERS.forEach(function (m) { check(typeof cfg.start[m] === "number", "config.start missing meter " + m); });

  // Chapter meta: rank identity and the endings that promote.
  check(cfg.chapter && cfg.chapter.key === chapterKey, "config.chapter.key must equal registry key '" + chapterKey + "'");
  if (cfg.chapter) {
    check(cfg.chapter.rank && cfg.chapter.posting, "config.chapter missing rank/posting");
    // The start screen's career ladder speaks each rank's stake.
    check(typeof cfg.chapter.plays === "string" && cfg.chapter.plays.length > 0, "config.chapter.plays missing (what the rank plays for)");
    if (cfg.chapter.plays) scanText(cfg.chapter.plays, "chapter.plays");
    // A rank that promotes must also say what a failed year means (the ending
    // card's disposition strip) — no verdict may leave the next step ambiguous.
    if (cfg.chapter.promotesTo) {
      check(typeof cfg.chapter.repeatNote === "string" && cfg.chapter.repeatNote.length > 0,
        "config.chapter.repeatNote missing (what a non-promoting ending means)");
      if (cfg.chapter.repeatNote) scanText(cfg.chapter.repeatNote, "chapter.repeatNote");
    }
    check(Array.isArray(cfg.chapter.promotionTiers), "config.chapter.promotionTiers must be an array");
    (cfg.chapter.promotionTiers || []).forEach(function (k) {
      check(!!content.endings[k], "config.chapter.promotionTiers references unknown ending '" + k + "'");
    });
    // carryOut: what a promoting run hands the next rank. Each entry names one
    // source (a flag held / any debt / the ending earned) and the flag it
    // becomes downstream, plus an optional meter dowry.
    if (cfg.chapter.carryOut !== undefined) {
      check(Array.isArray(cfg.chapter.carryOut) && cfg.chapter.carryOut.length > 0, "chapter.carryOut must be a non-empty array when present");
      check(!!cfg.chapter.promotesTo, "chapter.carryOut is meaningless without promotesTo");
      (cfg.chapter.carryOut || []).forEach(function (d, i) {
        var w = "chapter.carryOut[" + i + "]";
        check(typeof d.as === "string" && d.as.length > 0, w + ": needs 'as' (the downstream flag name)");
        var srcs = ["flag", "debt", "ending"].filter(function (k) { return k in d; });
        check(srcs.length === 1, w + ": needs exactly one source (flag | debt | ending), got " + srcs.length);
        if ("debt" in d) check(d.debt === true, w + ": debt source must be true");
        if ("ending" in d) check(!!content.endings[d.ending], w + ": unknown ending '" + d.ending + "'");
        Object.keys(d.meters || {}).forEach(function (mk) {
          check(METERS.indexOf(mk) !== -1, w + ": dowry key not a meter: " + mk);
          check(typeof d.meters[mk] === "number" && d.meters[mk] !== 0 && Math.abs(d.meters[mk]) <= MAX_METER_DELTA,
            w + ": dowry " + mk + " must be non-zero within ±" + MAX_METER_DELTA);
        });
      });
    }
    // carriesIn: the inbound carried flags this chapter's content may gate on.
    if (cfg.chapter.carriesIn !== undefined) {
      check(Array.isArray(cfg.chapter.carriesIn) && cfg.chapter.carriesIn.length > 0, "chapter.carriesIn must be a non-empty array when present");
      (cfg.chapter.carriesIn || []).forEach(function (f, i) {
        check(typeof f === "string" && f.length > 0, "chapter.carriesIn[" + i + "] must be a flag name");
      });
    }
  }

  // The recurring cast: the chapter's people, each a relationship expressed as
  // won/wronged flags earlier choices set. A declared standing must be a real
  // relationship — produced by some choice AND paid off somewhere (requires or
  // coda) — so the display can never promise a bond the content never uses.
  var standingFlags = [];
  if (cfg.cast !== undefined) {
    check(Array.isArray(cfg.cast) && cfg.cast.length > 0, "config.cast must be a non-empty array when present");
    var castIds = {};
    (cfg.cast || []).forEach(function (m, i) {
      var w = "config.cast[" + i + "]";
      check(typeof m.id === "string" && m.id.length > 0 && !castIds[m.id], w + ": duplicate or missing id");
      castIds[m.id] = true;
      check(typeof m.name === "string" && m.name.length > 0 && typeof m.who === "string" && m.who.length > 0, w + ": needs name and who");
      if (m.name) scanText(m.name + " " + m.who, w);
      var sides = ["won", "wronged"].filter(function (k) { return m[k] !== undefined; });
      check(sides.length >= 1, w + ": needs at least one of won/wronged");
      sides.forEach(function (side) {
        var s = m[side], sw = w + "." + side;
        check(s && typeof s.flag === "string" && s.flag.length > 0, sw + ": needs a flag");
        check(typeof s.note === "string" && s.note.length > 0, sw + ": needs a note (the standing line)");
        if (s.note) scanText(s.note, sw);
        if (s && s.flag) standingFlags.push({ flag: s.flag, where: sw });
      });
    });
  }

  // Honours ladder: blend weights over public meters + ordered tiers.
  check(cfg.honours && cfg.honours.weights && Array.isArray(cfg.honours.ladder) && cfg.honours.ladder.length >= 1,
    "config.honours must carry weights and a non-empty ladder");
  // The legend's honours gloss: the standing line stays terse because this
  // explains what a "showing" is.
  check(cfg.honours && typeof cfg.honours.desc === "string" && cfg.honours.desc.length > 0,
    "config.honours.desc missing (the legend's honours gloss)");
  if (cfg.honours && cfg.honours.desc) scanText(cfg.honours.desc, "honours.desc");
  var ladderKeys = [];
  if (cfg.honours) {
    var wsum = 0;
    Object.keys(cfg.honours.weights || {}).forEach(function (k) {
      check(METERS.indexOf(k) !== -1, "honours.weights key not a meter: " + k);
      wsum += cfg.honours.weights[k];
    });
    check(Math.abs(wsum - 1) < 0.01, "honours.weights must sum to 1 (got " + wsum.toFixed(2) + ")");
    var lastScore = Infinity;
    (cfg.honours.ladder || []).forEach(function (t, i) {
      var w = "honours.ladder[" + i + "]";
      check(t.key && typeof t.score === "number" && typeof t.prestige === "number", w + ": needs key/score/prestige");
      check(typeof t.name === "string" && t.name.length > 0, w + ": needs a display name (the standing line speaks it)");
      if (t.name) scanText(t.name, w);
      check(typeof t.reach === "string" && t.reach.length > 0, w + ": needs a standing line (reach)");
      if (t.reach) scanText(t.reach, w);
      check(t.score < lastScore, w + ": ladder must descend by score");
      lastScore = t.score;
      check(!!content.endings[t.key], w + ": no ending '" + t.key + "' in this chapter");
      if (t.barredByDebt !== undefined) check(t.barredByDebt === true, w + ": barredByDebt must be true when present");
      ladderKeys.push(t.key);
    });
  }

  // Meter display + legend (names and one-line glosses shown to the player).
  check(Array.isArray(cfg.meters) && cfg.meters.length === METERS.length, "config.meters must list every meter");
  var meterKeys = {};
  (cfg.meters || []).forEach(function (m) {
    check(METERS.indexOf(m.key) !== -1, "config.meters bad key " + m.key);
    meterKeys[m.key] = true;
    check(m.name && m.desc, "config.meters[" + m.key + "] missing name/desc");
    if (m.name) scanText(m.name + " " + m.desc, "config.meters[" + m.key + "]");
  });
  METERS.forEach(function (m) { check(meterKeys[m], "config.meters missing " + m); });

  // Audio (synthesised sitar/tanpura): tonic, master gain, and a raga (a set of
  // semitone degrees) per season. Presentation, but data-driven, so checked.
  if (cfg.audio) {
    var au = cfg.audio;
    check(typeof au.tonic === "number" && au.tonic > 0, "config.audio.tonic must be a positive number");
    check(typeof au.master === "number" && au.master > 0 && au.master <= 1, "config.audio.master must be in (0,1]");
    SEASON_KEYS.forEach(function (sk) {
      var scale = au.ragas && au.ragas[sk];
      check(Array.isArray(scale) && scale.length >= 3, "config.audio.ragas." + sk + " needs a scale of >=3 degrees");
      (scale || []).forEach(function (d) { check(typeof d === "number" && d >= 0 && d <= 24, "config.audio.ragas." + sk + " degree out of range: " + d); });
    });
  }

  var cal = cfg.calendar;
  check(Array.isArray(cal.months) && cal.months.length >= 1, "calendar.months missing");
  check(Array.isArray(cal.seasons) && cal.seasons.length >= 1, "calendar.seasons missing");
  // seasons must contiguously cover 1..maxTurns
  var covered = [];
  cal.seasons.forEach(function (s) {
    check(SEASON_KEYS.indexOf(s.key) !== -1, "season key invalid: " + s.key);
    check(s.glyph && s.name && s.tagline, "season " + s.key + " missing display fields");
    // intro variants rotate by fortnight; each season needs at least two so the
    // posture card never reads identical twice running
    check(Array.isArray(s.intros) && s.intros.length >= 2, "season " + s.key + " needs >=2 intro variants");
    (s.intros || []).forEach(function (t, i) {
      check(typeof t === "string" && t.length > 0, "season " + s.key + " intros[" + i + "] empty");
      scanText(t, "season " + s.key + " intros[" + i + "]");
    });
    for (var t = s.from; t <= s.to; t++) covered[t] = (covered[t] || 0) + 1;
  });
  for (var t = 1; t <= cfg.maxTurns; t++) check(covered[t] === 1, "turn " + t + " covered by " + (covered[t] || 0) + " seasons (want exactly 1)");
  var chapterSeasons = cal.seasons.map(function (s) { return s.key; });

  ["tour", "desk"].forEach(function (k) {
    check(cfg.postures && cfg.postures[k] && cfg.postures[k].base, "posture " + k + " missing base");
    if (cfg.postures[k]) {
      Object.keys(cfg.postures[k].base).forEach(function (mk) { check(METERS.indexOf(mk) !== -1, "posture " + k + " base has non-meter key " + mk); });
      // seasonal action labels — one per season, plain enough to need no context
      var labels = cfg.postures[k].labels;
      check(labels && typeof labels === "object", "posture " + k + " missing labels");
      chapterSeasons.forEach(function (sk) {
        check(labels && typeof labels[sk] === "string" && labels[sk].length > 0, "posture " + k + " missing label for season " + sk);
        if (labels && labels[sk]) scanText(labels[sk], "posture " + k + " labels." + sk);
      });
      // per-season note variants, rotated by fortnight — every season covered,
      // at least two variants each so the cue never reads identical twice running
      var notes = cfg.postures[k].notes;
      check(notes && typeof notes === "object", "posture " + k + " missing notes");
      chapterSeasons.forEach(function (sk) {
        var arr = notes && notes[sk];
        check(Array.isArray(arr) && arr.length >= 2, "posture " + k + " needs >=2 note variants for season " + sk);
        (arr || []).forEach(function (t, i) {
          check(typeof t === "string" && t.length > 0, "posture " + k + " notes." + sk + "[" + i + "] empty");
          scanText(t, "posture " + k + " notes." + sk + "[" + i + "]");
        });
      });
    }
  });

  // Seasonal retreats: a once-per-season recovery posture. Each references a
  // season, carries a flag + display fields, and effects within the meter band.
  var retreats = cfg.retreats || {};
  Object.keys(retreats).forEach(function (sk) {
    var rt = retreats[sk];
    var w = "retreat[" + sk + "]";
    check(SEASON_KEYS.indexOf(sk) !== -1, w + ": bad season key");
    check(rt.key && rt.flag && rt.label && rt.note && rt.title && rt.body, w + ": missing display/flag fields");
    if (rt.art !== undefined) check(typeof rt.art === "string" && rt.art.length > 0, w + ": art must be a non-empty banner key");
    check(rt.effects && Object.keys(rt.effects).length > 0, w + ": retreat needs effects");
    Object.keys(rt.effects || {}).forEach(function (mk) {
      check(METERS.indexOf(mk) !== -1, w + ": effect key not a meter: " + mk);
      check(typeof rt.effects[mk] === "number" && rt.effects[mk] !== 0, w + ": effect " + mk + " must be non-zero");
      check(Math.abs(rt.effects[mk]) <= MAX_METER_DELTA, w + ": effect " + mk + " exceeds ±" + MAX_METER_DELTA);
    });
  });

  // The seasonal wire from the next man up the chain: banded one-liners keyed
  // to the honours blend, plus a clause per weak meter. Text lives here.
  if (cfg.review) {
    var rv = cfg.review;
    check(typeof rv.from === "string" && rv.from.length > 0, "review.from missing");
    check(Array.isArray(rv.bands) && rv.bands.length >= 2, "review.bands needs >=2 bands");
    var lastMin = Infinity;
    (rv.bands || []).forEach(function (b, i) {
      check(typeof b.min === "number" && typeof b.text === "string" && b.text.length > 0, "review.bands[" + i + "] malformed");
      check(b.min < lastMin, "review.bands must descend by min (band " + i + ")");
      lastMin = b.min;
      scanText(b.text, "review.bands[" + i + "]");
    });
    check((rv.bands || []).length && rv.bands[rv.bands.length - 1].min === 0, "review.bands must end at min 0 (no silent gap)");
    Object.keys(rv.weak || {}).forEach(function (m) {
      check(METERS.indexOf(m) !== -1, "review.weak key not a meter: " + m);
      scanText(rv.weak[m], "review.weak." + m);
    });
  }

  var ec = cfg.economy;
  ["startTreasury", "settlementTurns", "settlementBase", "interestRate", "debtCeiling", "debtWarn"].forEach(function (k) {
    check(ec && ec[k] !== undefined, "economy." + k + " missing");
  });
  // The money's rules are invisible until they bite, so every chapter glosses
  // them (the legend's sixth entry): interest, settlement, bar, ceiling.
  check(ec && typeof ec.desc === "string" && ec.desc.length > 0, "economy.desc missing (the legend's treasury & debt gloss)");
  if (ec && ec.desc) scanText(ec.desc, "economy.desc");
  if (ec) {
    check(Array.isArray(ec.settlementTurns) && ec.settlementTurns.length >= 1, "economy.settlementTurns empty");
    ec.settlementTurns.forEach(function (st) { check(st >= 1 && st <= cfg.maxTurns, "settlementTurn out of range: " + st); });
    check(ec.debtWarn < ec.debtCeiling, "debtWarn must be below debtCeiling");
  }

  /* ---- endings: the structural set plus every ladder tier ---- */
  STRUCTURAL_ENDINGS.concat(ladderKeys).forEach(function (k) {
    check(content.endings[k] && content.endings[k].title && content.endings[k].text, "ending '" + k + "' missing title/text");
  });
  Object.keys(content.endings).forEach(function (k) {
    var e = content.endings[k];
    if (e.medal !== undefined) check(typeof e.medal === "string" && e.medal.length > 0, "ending '" + k + "' medal must be a non-empty art key");
    scanText((e.title || "") + " " + (e.text || ""), "ending[" + k + "]");
  });

  /* ---- events ---- */
  var ids = {};
  var flagsProduced = {};
  var flagsRequired = [];

  // Conditions may also read the economy's debt scalar (the Lala warning),
  // the fortnight ("turn"), and the honours blend ("showing") — the late-year
  // report warnings fire on the blend, not any single meter.
  var COND_METERS = METERS.concat(["debt", "turn", "showing"]);

  function checkCondition(c, where) {
    if (!c) return;
    if ("flag" in c) { flagsRequired.push({ flag: c.flag, where: where }); return; }
    if ("meter" in c) {
      check(COND_METERS.indexOf(c.meter) !== -1, where + ": condition meter invalid " + c.meter);
      check(OPS.indexOf(c.op) !== -1, where + ": condition op invalid " + c.op);
      check(typeof c.value === "number", where + ": condition value not numeric");
      return;
    }
    if (c.allOf) { check(Array.isArray(c.allOf), where + " allOf not array"); c.allOf.forEach(function (x) { checkCondition(x, where); }); return; }
    if (c.anyOf) { check(Array.isArray(c.anyOf), where + " anyOf not array"); c.anyOf.forEach(function (x) { checkCondition(x, where); }); return; }
    if (c.not) { checkCondition(c.not, where); return; }
    errors.push("[" + chapterKey + "] " + where + ": unrecognised condition shape");
  }

  function checkEffects(eff, where) {
    Object.keys(eff || {}).forEach(function (k) {
      check(METERS.indexOf(k) !== -1, where + ": effect key not a meter: " + k);
      check(typeof eff[k] === "number" && eff[k] !== 0, where + ": effect " + k + " must be non-zero number");
      check(Math.abs(eff[k]) <= MAX_METER_DELTA, where + ": effect " + k + "=" + eff[k] + " exceeds ±" + MAX_METER_DELTA);
    });
  }
  function checkEcon(econ, where) {
    if (!econ) return;
    Object.keys(econ).forEach(function (k) {
      check(ECON_KEYS.indexOf(k) !== -1, where + ": econ key invalid: " + k);
      check(typeof econ[k] === "number" && econ[k] !== 0, where + ": econ " + k + " must be non-zero number");
    });
  }

  function checkBranch(b, where) {
    check(typeof b.outcome === "string" && b.outcome.length > 0, where + ": outcome missing");
    if (b.outcome) scanText(b.outcome, where);
    checkEffects(b.effects, where);
    checkEcon(b.econ, where);
    // A gamble: rare (chance capped at a coin-flip's shy side), catastrophic,
    // and always avoidable by taking another choice — never nested.
    if (b.risk !== undefined) {
      var rw = where + ".risk";
      check(typeof b.risk.chance === "number" && b.risk.chance > 0 && b.risk.chance <= 0.35,
        rw + ": chance must be in (0, 0.35]");
      check(!b.risk.risk, rw + ": risks do not nest");
      check(typeof b.risk.outcome === "string" && b.risk.outcome.length > 0, rw + ": outcome missing");
      if (b.risk.outcome) scanText(b.risk.outcome, rw);
      checkEffects(b.risk.effects, rw);
      checkEcon(b.risk.econ, rw);
      (b.risk.setFlags || []).forEach(function (f) { flagsProduced[f] = true; });
    }
  }

  function checkChoices(list, w, allowThen) {
    if (allowThen === undefined) allowThen = true;
    check(Array.isArray(list) && list.length >= 2 && list.length <= 4, w + ": needs 2–4 choices");
    (list || []).forEach(function (ch, i) {
      var cw = w + ".choice[" + i + "]";
      check(ch.label && ch.label.length > 0, cw + ": label missing");
      if (ch.stampWord !== undefined) {
        check(typeof ch.stampWord === "string" && ch.stampWord.length > 0 && ch.stampWord.length <= 16,
          cw + ": stampWord must be a short string (<=16 chars)");
        if (ch.stampWord) scanText(ch.stampWord, cw);
      }
      (ch.setFlags || []).forEach(function (f) { flagsProduced[f] = true; });
      if (ch.condition) {
        checkCondition(ch.condition, cw);
        check(ch.ifTrue && ch.ifFalse, cw + ": branching choice needs ifTrue and ifFalse");
        if (ch.ifTrue) checkBranch(ch.ifTrue, cw + ".ifTrue");
        if (ch.ifFalse) checkBranch(ch.ifFalse, cw + ".ifFalse");
        (ch.ifTrue && ch.ifTrue.setFlags || []).forEach(function (f) { flagsProduced[f] = true; });
        (ch.ifFalse && ch.ifFalse.setFlags || []).forEach(function (f) { flagsProduced[f] = true; });
      } else {
        checkBranch(ch, cw);
      }
      // Two-step: a choice may open a follow-up decision. The setup is a plain
      // choice (its outcome the follow-up's lead), so it may not also branch or
      // gamble, and follow-ups never nest another step.
      if (ch.then !== undefined) {
        var tw = cw + ".then";
        check(allowThen, cw + ": two-step events do not nest (a follow-up choice cannot open another)");
        check(!ch.condition, cw + ": a two-step setup choice cannot also branch on a condition");
        check(!ch.risk, cw + ": a two-step setup choice cannot also be a gamble");
        check(typeof ch.outcome === "string" && ch.outcome.length > 0, cw + ": a two-step setup needs an outcome (the follow-up's lead)");
        check(ch.then && typeof ch.then === "object" && !Array.isArray(ch.then), tw + ": must be an object");
        if (ch.then && typeof ch.then === "object") {
          check(typeof ch.then.body === "string" && ch.then.body.length > 0, tw + ": body missing");
          if (ch.then.body) scanText(ch.then.body, tw);
          if (ch.then.tag !== undefined) check(typeof ch.then.tag === "string" && ch.then.tag.length > 0, tw + ": tag must be non-empty when present");
          if (ch.then.title !== undefined) { check(typeof ch.then.title === "string" && ch.then.title.length > 0, tw + ": title must be non-empty when present"); if (ch.then.title) scanText(ch.then.title, tw); }
          if (ch.then.art !== undefined) check(typeof ch.then.art === "string" && ch.then.art.length > 0, tw + ": art must be a non-empty key");
          checkChoices(ch.then.choices, tw, false); // one level only
        }
      }
    });
  }

  // Consultation: an optional in-voice opinion offered before the choice. It
  // never gates a choice, so it is pure enrichment — but its nudge is small
  // (an adviser tilts you; he does not swing the year), and it can set a flag
  // (the Club remembers being asked).
  var CONSULT_MAX = 6;
  function checkConsult(co, w) {
    if (co === undefined) return;
    check(co && typeof co === "object" && !Array.isArray(co), w + ".consult must be an object");
    if (!co || typeof co !== "object" || Array.isArray(co)) return;
    check(typeof co.who === "string" && co.who.length > 0, w + ".consult.who missing (the adviser)");
    if (co.who) scanText(co.who, w + ".consult.who");
    if (co.tag !== undefined) check(typeof co.tag === "string" && co.tag.length > 0, w + ".consult.tag must be non-empty when present");
    check(typeof co.opinion === "string" && co.opinion.length > 0, w + ".consult.opinion missing");
    if (co.opinion) {
      scanText(co.opinion, w + ".consult.opinion");
      check(co.opinion.length <= 420, w + ".consult.opinion too long (a note in the ear, not an essay: <=420 chars)");
    }
    Object.keys(co.effects || {}).forEach(function (k) {
      check(METERS.indexOf(k) !== -1, w + ".consult: effect key not a meter: " + k);
      check(typeof co.effects[k] === "number" && co.effects[k] !== 0, w + ".consult: effect " + k + " must be non-zero");
      check(Math.abs(co.effects[k]) <= CONSULT_MAX, w + ".consult: effect " + k + "=" + co.effects[k] + " exceeds ±" + CONSULT_MAX + " (a nudge, not a swing)");
    });
    checkEcon(co.econ, w + ".consult");
    (co.setFlags || []).forEach(function (f) { check(typeof f === "string" && f.length > 0, w + ".consult.setFlags bad entry"); flagsProduced[f] = true; });
  }

  content.events.forEach(function (e) {
    var w = "event[" + e.id + "]";
    check(e.id && !ids[e.id], w + ": duplicate or missing id");
    ids[e.id] = true;
    check(typeof e.tag === "string" && e.tag.length > 0, w + ": tag missing");
    check(Array.isArray(e.season) && e.season.length > 0, w + ": season missing");
    (e.season || []).forEach(function (s) { check(s === "any" || SEASON_KEYS.indexOf(s) !== -1, w + ": bad season " + s); });
    check(KINDS.indexOf(e.kind) !== -1, w + ": kind invalid " + e.kind);
    check(typeof e.once === "boolean", w + ": once must be boolean");
    check(e.title && e.body, w + ": title/body missing");
    scanText(e.title + " " + e.body, w);
    if (e.once) flagsProduced[e.id] = true; // once-events set flags[id]
    if (e.requires) checkCondition(e.requires, w + ".requires");
    if (e.art !== undefined) check(typeof e.art === "string" && e.art.length > 0, w + ": art must be a non-empty banner key");
    if (e.priority !== undefined) {
      // A priority event is a crisis warning: it preempts the draw while its
      // requires holds, so it must be gated and must not repeat.
      check(e.priority === true, w + ": priority must be true when present");
      check(e.once === true, w + ": priority events must be once");
      check(!!e.requires, w + ": priority events need a requires gate");
      check(!e.interlude, w + ": priority events cannot be interludes");
    }
    if (e.interlude) {
      // A no-choice occurrence: no choices, optional event-level effect/econ/outcome.
      check(e.kind === "interlude", w + ": interlude events must have kind 'interlude'");
      check(!e.choices || e.choices.length === 0, w + ": interlude must have no choices");
      check(!e.consult, w + ": interludes cannot carry a consult (there is no choice to weigh)");
      checkEffects(e.effects, w);
      checkEcon(e.econ, w);
      if (e.outcome) scanText(e.outcome, w);
      return;
    }
    check(e.kind !== "interlude", w + ": kind 'interlude' requires interlude:true");
    checkChoices(e.choices, w);
    checkConsult(e.consult, w);
  });

  /* ---- occasions: the fixed calendar of the year ---- */
  // Keyed to a specific turn, outside the drawn deck. With choices they play as
  // events; without, as unalterable results. One per turn at most; never turn 1
  // (the game must open by teaching the posture loop).
  var occTurns = {};
  (content.occasions || []).forEach(function (o) {
    var w = "occasion[" + o.id + "]";
    check(o.id && !ids[o.id], w + ": duplicate or missing id (also vs events)");
    ids[o.id] = true;
    check(typeof o.turn === "number" && o.turn >= 2 && o.turn <= cfg.maxTurns, w + ": turn must be 2.." + cfg.maxTurns);
    check(!occTurns[o.turn], w + ": turn " + o.turn + " already has an occasion");
    occTurns[o.turn] = true;
    check(typeof o.tag === "string" && o.tag.length > 0, w + ": tag missing");
    check(o.title && o.body, w + ": title/body missing");
    scanText(o.title + " " + o.body, w);
    if (o.art !== undefined) check(typeof o.art === "string" && o.art.length > 0, w + ": art must be a non-empty banner key");
    if (o.choices && o.choices.length) {
      checkChoices(o.choices, w);
      checkConsult(o.consult, w);
    } else {
      checkEffects(o.effects, w);
      checkEcon(o.econ, w);
      if (o.outcome) scanText(o.outcome, w);
    }
  });

  /* ---- district works (config.projects) ---- */
  // Each spends the treasury now and matures into an interlude whose fate is
  // read from the district. The commission flag is the project id; both
  // maturation branches may set flags.
  var projectIds = {};
  (cfg.projects || []).forEach(function (p, i) {
    var w = "config.projects[" + i + "]";
    check(typeof p.id === "string" && p.id.length > 0 && !projectIds[p.id], w + ": duplicate or missing id");
    projectIds[p.id] = true;
    check(!ids[p.id], w + ": id collides with an event/occasion id");
    flagsProduced[p.id] = true; // the commission flag
    check(typeof p.cost === "number" && p.cost > 0, w + ": cost must be a positive number");
    check(typeof p.matures === "number" && p.matures >= 1 && p.matures <= cfg.maxTurns, w + ": matures must be 1.." + cfg.maxTurns);
    check(p.tag && p.label && p.note && p.title, w + ": needs tag/label/note/title");
    if (p.label) scanText(p.label + " " + p.note + " " + p.title, w);
    var cm = p.commission || {};
    check(typeof cm.title === "string" && cm.title.length > 0 && typeof cm.body === "string" && cm.body.length > 0, w + ": commission needs title and body");
    if (cm.title) scanText(cm.title + " " + cm.body + " " + (cm.outcome || ""), w + ".commission");
    ["thrived", "languished"].forEach(function (side) {
      var o = p[side], sw = w + "." + side;
      check(o && typeof o === "object", sw + ": missing");
      if (!o || typeof o !== "object") return;
      check(typeof o.body === "string" && o.body.length > 0, sw + ": body missing");
      if (o.body) scanText(o.body + " " + (o.outcome || ""), sw);
      check(o.effects && Object.keys(o.effects).length > 0, sw + ": needs effects");
      checkEffects(o.effects, sw);
      checkEcon(o.econ, sw);
      (o.setFlags || []).forEach(function (f) { flagsProduced[f] = true; });
    });
    if (p.thrived && p.thrived.requires) checkCondition(p.thrived.requires, w + ".thrived.requires");
  });

  /* ---- codas: arc-conditional sentences appended to the verdict ---- */
  (content.codas || []).forEach(function (cd, i) {
    var w = "coda[" + i + "]";
    check(typeof cd.head === "string" && cd.head.length > 0, w + ": head (bold headline) missing");
    check(typeof cd.text === "string" && cd.text.length > 0, w + ": text missing");
    if (cd.head) scanText(cd.head, w);
    if (cd.text) scanText(cd.text, w);
    check(cd.requires, w + ": coda needs a requires condition");
    if (cd.requires) checkCondition(cd.requires, w + ".requires"); // flags cross-referenced below
    if (cd.endings !== undefined) {
      check(Array.isArray(cd.endings) && cd.endings.length > 0, w + ": endings must be a non-empty array when present");
      (cd.endings || []).forEach(function (k) { check(!!content.endings[k], w + ": unknown ending scope '" + k + "'"); });
    }
  });

  /* ---- cross-references: every required flag is produced somewhere ---- */
  // Declared inbound carries count as produced: the previous chapter sets them.
  ((cfg.chapter && cfg.chapter.carriesIn) || []).forEach(function (f) { flagsProduced[f] = true; });
  // And every carried-out source flag must be producible in THIS chapter.
  ((cfg.chapter && cfg.chapter.carryOut) || []).forEach(function (d, i) {
    if ("flag" in d) check(flagsProduced[d.flag], "chapter.carryOut[" + i + "]: source flag '" + d.flag + "' that nothing sets");
  });
  flagsRequired.forEach(function (r) {
    check(flagsProduced[r.flag], r.where + ": requires flag '" + r.flag + "' that nothing sets");
  });

  // A declared cast standing must be a live relationship: some choice sets its
  // flag, and something later reads it (a gated event or a coda) — no figure on
  // the standing strip whose bond the game never earns or never pays off.
  var flagsConsumed = {};
  flagsRequired.forEach(function (r) { flagsConsumed[r.flag] = true; });
  (content.codas || []).forEach(function (cd) {
    (function walk(c) {
      if (!c) return;
      if ("flag" in c) flagsConsumed[c.flag] = true;
      (c.allOf || []).forEach(walk); (c.anyOf || []).forEach(walk); if (c.not) walk(c.not);
    })(cd.requires);
  });
  standingFlags.forEach(function (sf) {
    check(flagsProduced[sf.flag], sf.where + ": standing flag '" + sf.flag + "' that no choice sets");
    check(flagsConsumed[sf.flag], sf.where + ": standing flag '" + sf.flag + "' is never paid off (no event/coda reads it)");
  });

  /* ---- the whole year must be servable without repeats ---- */
  // A fresh run draws an event most fortnights; gated events may never become
  // eligible, so the ungated non-interlude deck alone must cover the year.
  var ungated = content.events.filter(function (e) { return !e.interlude && !e.requires && !e.priority; }).length;
  var drawsNeeded = cfg.maxTurns - (content.occasions || []).length;
  check(ungated >= drawsNeeded,
    "only " + ungated + " ungated events for " + drawsNeeded + " drawn fortnights — a fresh year runs the deck dry");

  /* ---- pool floors per season (deck can't run dry) ---- */
  chapterSeasons.forEach(function (sk) {
    var n = content.events.filter(function (e) {
      var ss = e.season || ["any"];
      return ss.indexOf("any") !== -1 || ss.indexOf(sk) !== -1;
    }).length;
    check(n >= SEASON_FLOOR, "season '" + sk + "' has only " + n + " eligible events (floor " + SEASON_FLOOR + ")");
  });
  // the monsoon keeps at least one crisis so its stakes read
  if (chapterSeasons.indexOf("monsoon") !== -1) {
    var crises = content.events.filter(function (e) { return e.kind === "crisis" && (e.season || []).indexOf("monsoon") !== -1; });
    check(crises.length >= 1, "monsoon has no crisis event");
  }

  totals.events += content.events.length;
  totals.endings += Object.keys(content.endings).length;
  totals.flags += Object.keys(flagsProduced).length;
}

/* ---- registry shape, then each chapter ---- */
if (!registry.chapters || !Array.isArray(registry.order) || !registry.order.length) {
  errors.push("content registry must export { chapters, order }");
} else {
  // planned: the unwritten ranks the start-screen ladder previews.
  (registry.planned || []).forEach(function (pl, i) {
    if (!pl || typeof pl.rank !== "string" || !pl.rank.length || typeof pl.plays !== "string" || !pl.plays.length)
      errors.push("registry.planned[" + i + "] needs rank and plays");
  });
  registry.order.forEach(function (k) {
    if (!registry.chapters[k]) errors.push("order lists unknown chapter '" + k + "'");
  });
  Object.keys(registry.chapters).forEach(function (k) {
    validateChapter(registry.chapters[k], k);
  });
  // The carry handshake between chapters: everything a chapter hands out must
  // be declared inbound by the chapter it promotes to, and everything declared
  // inbound must be handed out by some chapter promoting there — a typo on
  // either side would silently orphan the gated content.
  Object.keys(registry.chapters).forEach(function (k) {
    var ch = (registry.chapters[k].config || {}).chapter || {};
    var to = ch.promotesTo;
    if (!to) return;
    if (!registry.chapters[to]) { errors.push("[" + k + "] chapter.promotesTo unknown chapter '" + to + "'"); return; }
    var accepted = ((registry.chapters[to].config || {}).chapter || {}).carriesIn || [];
    (ch.carryOut || []).forEach(function (d) {
      if (accepted.indexOf(d.as) === -1)
        errors.push("[" + k + "] carryOut '" + d.as + "' is not in chapter '" + to + "' carriesIn");
    });
  });
  Object.keys(registry.chapters).forEach(function (k) {
    var accepted = ((registry.chapters[k].config || {}).chapter || {}).carriesIn || [];
    accepted.forEach(function (f) {
      var handed = Object.keys(registry.chapters).some(function (j) {
        var ch = (registry.chapters[j].config || {}).chapter || {};
        return ch.promotesTo === k && (ch.carryOut || []).some(function (d) { return d.as === f; });
      });
      if (!handed) errors.push("[" + k + "] carriesIn '" + f + "' is handed out by no chapter promoting here");
    });
  });
}

if (errors.length) {
  console.error("CONTENT INVALID — " + errors.length + " problem(s):");
  errors.forEach(function (e) { console.error("  ✗ " + e); });
  process.exit(1);
}
console.log("Content valid ✓  (" + totals.chapters + " chapter(s): " + totals.events + " events, " +
  totals.endings + " endings, " + totals.flags + " flags)");
