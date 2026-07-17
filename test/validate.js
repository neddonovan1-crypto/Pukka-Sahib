/* Content validator — every content rule as an executable check, not a
   convention. Exits non-zero on any violation. Run: node test/validate.js */
"use strict";
var content = require("../src/content.js");

var METERS = ["revenue", "order", "prestige", "contentment", "health"];
var SEASON_KEYS = ["cold", "hot", "monsoon"];
var KINDS = ["desk", "tour", "club", "personal", "crisis", "interlude"];
var OPS = [">", ">=", "<", "<=", "==", "!="];
var ECON_KEYS = ["treasury", "debt"];
var REQUIRED_ENDINGS = ["breakdown", "riot", "scandal", "bankrupt", "gonenative", "kcsi", "kcie", "cie", "transfer"];
var SEASON_FLOOR = 6;      // eligible events per season must not drop below this
var MAX_METER_DELTA = 25;  // sanity band on a single effect
var FORBIDDEN = [/\bTODO\b/, /\blorem\b/i, /claude-[a-z0-9-]*\d/i];

var errors = [];
function check(cond, msg) { if (!cond) errors.push(msg); }

/* ---- config ---- */
var cfg = content.config;
check(typeof cfg.maxTurns === "number" && cfg.maxTurns > 0, "config.maxTurns missing/invalid");
METERS.forEach(function (m) { check(typeof cfg.start[m] === "number", "config.start missing meter " + m); });

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

var cal = cfg.calendar;
check(Array.isArray(cal.months) && cal.months.length === 12, "calendar.months must be length 12");
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

["tour", "desk"].forEach(function (k) {
  check(cfg.postures && cfg.postures[k] && cfg.postures[k].base, "posture " + k + " missing base");
  if (cfg.postures[k]) {
    Object.keys(cfg.postures[k].base).forEach(function (mk) { check(METERS.indexOf(mk) !== -1, "posture " + k + " base has non-meter key " + mk); });
    // seasonal action labels — one per season, plain enough to need no context
    var labels = cfg.postures[k].labels;
    check(labels && typeof labels === "object", "posture " + k + " missing labels");
    SEASON_KEYS.forEach(function (sk) {
      check(labels && typeof labels[sk] === "string" && labels[sk].length > 0, "posture " + k + " missing label for season " + sk);
      if (labels && labels[sk]) scanText(labels[sk], "posture " + k + " labels." + sk);
    });
    // per-season note variants, rotated by fortnight — every season covered,
    // at least two variants each so the cue never reads identical twice running
    var notes = cfg.postures[k].notes;
    check(notes && typeof notes === "object", "posture " + k + " missing notes");
    SEASON_KEYS.forEach(function (sk) {
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

// The Division's seasonal wire: banded one-liners keyed to the honours blend,
// plus a clause per weak meter. All text lives here, none in code.
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
if (ec) {
  check(Array.isArray(ec.settlementTurns) && ec.settlementTurns.length >= 1, "economy.settlementTurns empty");
  ec.settlementTurns.forEach(function (st) { check(st >= 1 && st <= cfg.maxTurns, "settlementTurn out of range: " + st); });
  check(ec.debtWarn < ec.debtCeiling, "debtWarn must be below debtCeiling");
}

/* ---- endings ---- */
REQUIRED_ENDINGS.forEach(function (k) {
  check(content.endings[k] && content.endings[k].title && content.endings[k].text, "ending '" + k + "' missing title/text");
});

/* ---- events ---- */
var ids = {};
var flagsProduced = {};
var flagsRequired = [];

// Conditions may also read the economy's debt scalar (for the Lala warning).
var COND_METERS = METERS.concat(["debt"]);

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
  errors.push(where + ": unrecognised condition shape");
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
function scanText(s, where) { FORBIDDEN.forEach(function (re) { check(!re.test(s), where + ": forbidden pattern " + re + " in text"); }); }

function checkBranch(b, where) {
  check(typeof b.outcome === "string" && b.outcome.length > 0, where + ": outcome missing");
  if (b.outcome) scanText(b.outcome, where);
  checkEffects(b.effects, where);
  checkEcon(b.econ, where);
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
    checkEffects(e.effects, w);
    checkEcon(e.econ, w);
    if (e.outcome) scanText(e.outcome, w);
    return;
  }
  check(e.kind !== "interlude", w + ": kind 'interlude' requires interlude:true");
  check(Array.isArray(e.choices) && e.choices.length >= 2 && e.choices.length <= 4, w + ": needs 2–4 choices");
  (e.choices || []).forEach(function (ch, i) {
    var cw = w + ".choice[" + i + "]";
    check(ch.label && ch.label.length > 0, cw + ": label missing");
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
  });
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
    check(o.choices.length >= 2 && o.choices.length <= 4, w + ": needs 2–4 choices");
    o.choices.forEach(function (ch, i) {
      var cw = w + ".choice[" + i + "]";
      check(ch.label && ch.label.length > 0, cw + ": label missing");
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
    });
  } else {
    checkEffects(o.effects, w);
    checkEcon(o.econ, w);
    if (o.outcome) scanText(o.outcome, w);
  }
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
    (cd.endings || []).forEach(function (k) { check(REQUIRED_ENDINGS.indexOf(k) !== -1, w + ": unknown ending scope '" + k + "'"); });
  }
});

/* ---- cross-references: every required flag is produced somewhere ---- */
flagsRequired.forEach(function (r) {
  check(flagsProduced[r.flag], r.where + ": requires flag '" + r.flag + "' that nothing sets");
});

/* ---- pool floors per season (deck can't run dry) ---- */
SEASON_KEYS.forEach(function (sk) {
  var n = content.events.filter(function (e) {
    var ss = e.season || ["any"];
    return ss.indexOf("any") !== -1 || ss.indexOf(sk) !== -1;
  }).length;
  check(n >= SEASON_FLOOR, "season '" + sk + "' has only " + n + " eligible events (floor " + SEASON_FLOOR + ")");
});
// every season needs at least one crisis so its stakes read
SEASON_KEYS.forEach(function (sk) {
  var crises = content.events.filter(function (e) { return e.kind === "crisis" && (e.season || []).indexOf(sk) !== -1; });
  if (sk === "monsoon") check(crises.length >= 1, "monsoon has no crisis event");
});

if (errors.length) {
  console.error("CONTENT INVALID — " + errors.length + " problem(s):");
  errors.forEach(function (e) { console.error("  ✗ " + e); });
  process.exit(1);
}
console.log("Content valid ✓  (" + content.events.length + " events, " +
  Object.keys(content.endings).length + " endings, " +
  Object.keys(flagsProduced).length + " flags)");
