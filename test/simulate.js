/* Simulation — hundreds of seeded, headless playthroughs with the design's
   balance targets encoded as hard assertions, run for every chapter in the
   registry. A target isn't real until the sim asserts it. Exits non-zero if
   any band is missed. Run: node test/simulate.js */
"use strict";
var L = require("../src/logic.js");
var registry = require("../src/content.js");

var COLLAPSE = ["breakdown", "riot", "scandal", "bankrupt"];

// Debt guards used by the skilled/paragon scorers, scaled per chapter from the
// economy's debtWarn (the district's 1,20,000 and Kotra's 9,000 differ by an
// order of magnitude).
var DEBT_GUARDS = { hi: 140000, lo: 100000 };

// Per-chapter band overrides. Every chapter shares the core bands; what
// differs is the tour-spam signature failure, which endings must appear in
// ordinary pooled play, and which collapses get a dedicated probe. The AC
// year exempts riot — a probationer's disorder ends as Asked to Resign long
// before a sub-division burns — and proves breakdown via the burnout probe
// (a first-year boy CAN be invalided, but not by casual play in six months).
var CHAPTER_BANDS = {
  dm: {
    spamFail: { keys: ["breakdown"], min: 0.30, label: "tour-only should mostly break down (want ≥30% Invalided Home)" },
    pooledReachable: ["breakdown", "scandal", "transfer", "gonenative"],
    probes: { riot: true, bankrupt: true, burnout: false }
  },
  ac: {
    spamFail: { keys: ["transfer", "gonenative", "breakdown", "scandal"], min: 0.40, label: "tour-only should mostly fail the probation (want ≥40% extended/gone-native/collapse)" },
    pooledReachable: ["scandal", "transfer", "gonenative"],
    probes: { riot: false, bankrupt: true, burnout: true }
  }
};

/* ---- policies ---- */
function scoreChoice(ch, s) {
  var e = ch.effects || {};
  // Prestige is the honours currency, so an honours-hunter values it above all;
  // contentment is chased only until it stops earning (past ~60 it merely risks
  // the "gone native" trap), and any meter near the floor is defended hard.
  var contWeight = s.meters.contentment > 60 ? 0.15 : 0.4;
  var sc = (e.prestige || 0) * 1.25 + (e.contentment || 0) * contWeight +
    (e.revenue || 0) * 0.5 + (e.order || 0) * 0.45;
  if (s.meters.health < 45) sc += (e.health || 0) * 2;
  ["order", "revenue", "prestige"].forEach(function (m) {
    if (s.meters[m] < 35) sc += (e[m] || 0) * 1.5; // shore up whatever is about to collapse
  });
  if (ch.econ && ch.econ.debt) {
    sc -= ch.econ.debt / 40000;
    if (s.debt + ch.econ.debt > DEBT_GUARDS.hi) sc -= 50; // a second big borrow is how collectors end
  }
  if (ch.econ && ch.econ.treasury < 0) {
    var shortfall = Math.max(0, -ch.econ.treasury - s.treasury); // spend beyond the chest is a borrow
    sc -= shortfall / 25000;
  }
  return sc;
}
var POLICIES = {
  random: {
    posture: function (s, r) { return r() < 0.5 ? "tour" : "desk"; },
    option: function (s, g, r) { return Math.floor(r() * s.event.choices.length); }
  },
  tourOnly: {
    posture: function () { return "tour"; },
    option: function (s, g, r) { return Math.floor(r() * s.event.choices.length); }
  },
  deskOnly: {
    posture: function () { return "desk"; },
    option: function (s, g, r) { return Math.floor(r() * s.event.choices.length); }
  },
  skilled: {
    posture: function (s) {
      // Spend the once-per-season hill leave when the hot weather has worn health thin.
      if (s.retreat && s.season.key === "hot" && s.meters.health < 40) return s.retreat.key;
      if (s.season.key === "cold") return "tour";
      if (s.meters.contentment < 45 || s.meters.order < 45) return "tour";
      return "desk";
    },
    option: function (s) {
      var best = 0, bestSc = -1e9;
      s.event.choices.forEach(function (ch, i) { var sc = scoreChoice(ch, s); if (sc > bestSc) { bestSc = sc; best = i; } });
      return best;
    }
  },
  // The pinnacle probe: plays for the K.C.S.I. constraints specifically
  // (prestige ≥80, revenue ≥60, contentment ≥54, debt clear), proving the top
  // honour is winnable play and not a dead branch.
  paragon: {
    posture: function (s) {
      if (s.retreat && s.season.key === "hot" && s.meters.health < 42) return s.retreat.key;
      if (s.season.key === "cold") return "tour";
      if (s.meters.contentment < 52 || s.meters.order < 50) return "tour";
      return "desk";
    },
    option: function (s) {
      var best = 0, bs = -1e9;
      s.event.choices.forEach(function (ch, i) {
        var e = ch.effects || {};
        var m = s.meters;
        var sc = (e.prestige || 0) * 2 +
          (e.contentment || 0) * (m.contentment < 56 ? 0.9 : 0.1) +
          (e.revenue || 0) * (m.revenue < 62 ? 0.8 : 0.2) +
          (e.order || 0) * (m.order < 50 ? 0.8 : 0.2) +
          (e.health || 0) * (m.health < 40 ? 1.6 : 0);
        if (ch.econ && ch.econ.debt && s.debt + ch.econ.debt > DEBT_GUARDS.lo) sc -= 50; // the warn line kills the top rung
        if (ch.econ && ch.econ.treasury < 0) sc -= Math.max(0, -ch.econ.treasury - s.treasury) / 25000;
        if (sc > bs) { bs = sc; best = i; }
      });
      return best;
    }
  },
  // Adversarial reachability probes: engineered to drive a specific collapse,
  // proving that tail ending is live content and not unreachable.
  wrecker: {
    // Desk bleeds Order every fortnight; the seasonal leaves bleed it faster
    // (a sahib absent in the flood is how riots start), so take every one.
    posture: function (s) { return s.retreat ? s.retreat.key : "desk"; },
    option: function (s) {
      // Most Order-negative choice, counting a branching choice at its worst
      // branch — the nastiest outcomes hide in ifFalse.
      var worstOrder = function (ch) {
        if (ch.effects) return ch.effects.order || 0;
        var a = (ch.ifTrue && ch.ifTrue.effects && ch.ifTrue.effects.order) || 0;
        var b = (ch.ifFalse && ch.ifFalse.effects && ch.ifFalse.effects.order) || 0;
        return Math.min(a, b);
      };
      var bi = 0, bo = 1e9;
      s.event.choices.forEach(function (ch, i) { var o = worstOrder(ch); if (o < bo) { bo = o; bi = i; } });
      return bi; // → riot
    }
  },
  burnout: {
    // The health-collapse probe: tours through every season and picks the most
    // Health-punishing choice each fortnight (worst branch counted) — the boy
    // who will not be told, driven to the steamer.
    posture: function () { return "tour"; },
    option: function (s) {
      var worstHealth = function (ch) {
        if (ch.effects) return ch.effects.health || 0;
        var a = (ch.ifTrue && ch.ifTrue.effects && ch.ifTrue.effects.health) || 0;
        var b = (ch.ifFalse && ch.ifFalse.effects && ch.ifFalse.effects.health) || 0;
        return Math.min(a, b);
      };
      var bi = 0, bh = 1e9;
      s.event.choices.forEach(function (ch, i) { var h = worstHealth(ch); if (h < bh) { bh = h; bi = i; } });
      return bi; // → invalided
    }
  },
  reckless: {
    // Desk keeps prestige off the floor while the borrowing does its work;
    // the leaves are taken too (each costs revenue and standing).
    posture: function (s) { return s.retreat ? s.retreat.key : "desk"; },
    option: function (s) {
      // Deepest spend/borrow on offer (branch econ counts); failing that, the
      // most Revenue-negative choice — both roads lead to the empty treasury.
      var econOf = function (ch) {
        var es = [ch.econ, ch.ifTrue && ch.ifTrue.econ, ch.ifFalse && ch.ifFalse.econ];
        var worst = 0;
        es.forEach(function (e) {
          if (!e) return;
          var v = (e.debt || 0) - Math.min(0, e.treasury || 0);
          if (v > worst) worst = v;
        });
        return worst;
      };
      var worstRev = function (ch) {
        if (ch.effects) return ch.effects.revenue || 0;
        var a = (ch.ifTrue && ch.ifTrue.effects && ch.ifTrue.effects.revenue) || 0;
        var b = (ch.ifFalse && ch.ifFalse.effects && ch.ifFalse.effects.revenue) || 0;
        return Math.min(a, b);
      };
      var bi = -1, best = 0;
      s.event.choices.forEach(function (ch, i) { var v = econOf(ch); if (v > best) { best = v; bi = i; } });
      if (bi >= 0) return bi;
      var ri = 0, rv = 1e9;
      s.event.choices.forEach(function (ch, i) { var r = worstRev(ch); if (r < rv) { rv = r; ri = i; } });
      return ri;
    }
  }
};

function pct(dist, keys, n) {
  var c = 0; keys.forEach(function (k) { c += dist[k] || 0; }); return c / n;
}

var fails = [];

function simulateChapter(chapterKey, content) {
  var titleToKey = {};
  Object.keys(content.endings).forEach(function (k) { titleToKey[content.endings[k].title] = k; });
  // The honours tiers come from the chapter's ladder (highest first).
  var LADDER = content.config.honours.ladder.map(function (t) { return t.key; });
  var TOP = LADDER[0];
  var warn = content.config.economy.debtWarn;
  DEBT_GUARDS.hi = Math.round(warn * 1.15);
  DEBT_GUARDS.lo = Math.round(warn * 0.85);
  var bands = CHAPTER_BANDS[chapterKey] || CHAPTER_BANDS.dm;

  function assert(cond, msg) { if (!cond) fails.push("[" + chapterKey + "] " + msg); }

  function play(policy, seed) {
    var rng = L.seededRng(seed);
    var game = L.createGame(content, rng);
    var s = game.init();
    var events = [], backToBack = false, prev = null, guard = 0;
    while (s.phase !== "ended" && guard++ < 1000) {
      if (s.phase === "posture") s = game.choosePosture(policy.posture(s, rng));
      else if (s.phase === "event") {
        if (prev === s.event.id) backToBack = true;
        prev = s.event.id; events.push(s.event.id);
        s = game.chooseOption(policy.option(s, game, rng));
      } else if (s.phase === "interlude") s = game.next();
      else if (s.phase === "resolved") s = game.next();
      if (typeof s.treasury !== "number" || isNaN(s.treasury) || isNaN(s.debt)) throw new Error("NaN economy at turn " + s.turn);
    }
    if (s.phase !== "ended") throw new Error("did not terminate (guard hit)");
    return { key: titleToKey[s.ended.title], events: events, backToBack: backToBack, turn: s.turn, debt: s.debt };
  }

  function runBatch(name, n, seedBase) {
    var dist = {}, bb = 0, errs = 0;
    for (var i = 0; i < n; i++) {
      try {
        var r = play(POLICIES[name], seedBase + i * 7919 + 1);
        dist[r.key] = (dist[r.key] || 0) + 1;
        if (r.backToBack) bb++;
      } catch (e) { errs++; if (errs < 4) console.error("  ERR[" + chapterKey + "/" + name + "]", e.message); }
    }
    return { dist: dist, bb: bb, errs: errs, n: n };
  }

  var N = 500;
  var R = {};
  ["random", "tourOnly", "deskOnly", "skilled"].forEach(function (p) { R[p] = runBatch(p, N, p.length * 100003); });
  // smaller engineered batches for tail- and pinnacle-reachability
  R.paragon = runBatch("paragon", 200, 777001);
  if (bands.probes.riot) R.wrecker = runBatch("wrecker", 200, 424242);
  if (bands.probes.bankrupt) R.reckless = runBatch("reckless", 200, 133337);
  if (bands.probes.burnout) R.burnout = runBatch("burnout", 200, 555000);

  console.log("\n=== [" + chapterKey + "] Balance report (n=" + N + " per policy; probes 200) ===");
  Object.keys(R).forEach(function (p) {
    var d = R[p].dist, n = R[p].n;
    console.log(p.padEnd(9), "honours=" + (pct(d, LADDER, n) * 100).toFixed(0) + "%",
      TOP + "=" + (pct(d, [TOP], n) * 100).toFixed(0) + "%",
      "collapse=" + (pct(d, COLLAPSE, n) * 100).toFixed(0) + "%",
      "| " + JSON.stringify(d));
  });

  /* ---- assertions: the design targets ---- */
  // no runtime errors, everything terminates
  Object.keys(R).forEach(function (p) { assert(R[p].errs === 0, p + ": " + R[p].errs + " runtime errors"); });
  // rotation invariant: never the same event twice in a row, in any game
  Object.keys(R).forEach(function (p) { assert(R[p].bb === 0, p + ": " + R[p].bb + " games had back-to-back event repeats"); });

  // neither pure posture can be spammed to victory
  assert(pct(R.tourOnly.dist, LADDER, N) <= 0.10, "tour-only earns honours too often (" + (pct(R.tourOnly.dist, LADDER, N) * 100).toFixed(0) + "%, want ≤10%)");
  assert(pct(R.deskOnly.dist, [TOP], N) <= 0.12, "desk-only reaches the top tier too often (want ≤12%)");
  assert(pct(R.tourOnly.dist, bands.spamFail.keys, N) >= bands.spamFail.min, bands.spamFail.label + " — got " + (pct(R.tourOnly.dist, bands.spamFail.keys, N) * 100).toFixed(0) + "%");

  // skill is rewarded; careless play mostly fails but isn't impossible
  assert(pct(R.skilled.dist, LADDER, N) >= 0.50, "skilled play should earn honours ≥50% (" + (pct(R.skilled.dist, LADDER, N) * 100).toFixed(0) + "%)");
  var rnd = pct(R.random.dist, LADDER, N);
  assert(rnd >= 0.02 && rnd <= 0.50, "random honour-rate out of band [2%,50%]: " + (rnd * 100).toFixed(0) + "%");

  // every ladder tier + the chapter's ordinary endings reachable in pooled play
  var all = {};
  Object.keys(R).forEach(function (p) { Object.keys(R[p].dist).forEach(function (k) { all[k] = (all[k] || 0) + R[p].dist[k]; }); });
  LADDER.concat(bands.pooledReachable).forEach(function (k) {
    assert(all[k] > 0, "ending '" + k + "' never occurred in any policy");
  });
  // the chapter's tail collapses must be reachable via their dedicated probes
  if (bands.probes.riot) assert((R.wrecker.dist.riot || 0) > 0, "riot unreachable — wrecker policy never triggered it");
  if (bands.probes.bankrupt) assert((R.reckless.dist.bankrupt || 0) > 0, "bankrupt unreachable — reckless policy never triggered it");
  if (bands.probes.burnout) assert((R.burnout.dist.breakdown || 0) > 0, "breakdown unreachable — burnout policy never triggered it");
  // and the top rung must be winnable by play engineered for it
  assert((R.paragon.dist[TOP] || 0) > 0, "'" + TOP + "' unreachable — paragon policy never earned it");
}

registry.order.forEach(function (k) { simulateChapter(k, registry.chapters[k]); });

if (fails.length) {
  console.error("\nSIMULATION FAILED — " + fails.length + " band(s) missed:");
  fails.forEach(function (f) { console.error("  ✗ " + f); });
  process.exit(1);
}
console.log("\nAll balance bands hold ✓");
