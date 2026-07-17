/* Simulation — hundreds of seeded, headless playthroughs with the design's
   balance targets encoded as hard assertions. A target isn't real until the
   sim asserts it. Exits non-zero if any band is missed. Run: node test/simulate.js */
"use strict";
var L = require("../src/logic.js");
var content = require("../src/content.js");

var titleToKey = {};
Object.keys(content.endings).forEach(function (k) { titleToKey[content.endings[k].title] = k; });
var HONOURS = ["kcsi", "kcie", "cie"];
var COLLAPSE = ["breakdown", "riot", "scandal", "bankrupt"];

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
  if (ch.econ && ch.econ.debt) sc -= ch.econ.debt / 40000;
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
  // Adversarial reachability probes: engineered to drive a specific collapse,
  // proving that tail ending is live content and not unreachable.
  wrecker: {
    posture: function () { return "desk"; }, // desk bleeds Order every fortnight
    option: function (s) {
      var bi = 0, bo = 1e9;
      s.event.choices.forEach(function (ch, i) { var o = (ch.effects && ch.effects.order) || 0; if (o < bo) { bo = o; bi = i; } });
      return bi; // always the most Order-negative choice → riot
    }
  },
  reckless: {
    posture: function () { return "desk"; },
    option: function (s) {
      var idx = -1;
      s.event.choices.forEach(function (ch, i) {
        if (ch.econ && (ch.econ.debt || (ch.econ.treasury && ch.econ.treasury < 0))) idx = i;
      });
      return idx >= 0 ? idx : 0; // pile on debt wherever offered → bankruptcy
    }
  }
};

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
    } catch (e) { errs++; if (errs < 4) console.error("  ERR[" + name + "]", e.message); }
  }
  return { dist: dist, bb: bb, errs: errs, n: n };
}

function pct(dist, keys, n) {
  var c = 0; keys.forEach(function (k) { c += dist[k] || 0; }); return c / n;
}

var N = 500;
var R = {};
["random", "tourOnly", "deskOnly", "skilled"].forEach(function (p) { R[p] = runBatch(p, N, p.length * 100003); });
// smaller adversarial batches for tail-ending reachability
R.wrecker = runBatch("wrecker", 200, 424242);
R.reckless = runBatch("reckless", 200, 133337);

console.log("\n=== Balance report (n=" + N + " per policy) ===");
Object.keys(R).forEach(function (p) {
  var d = R[p].dist;
  console.log(p.padEnd(9), "honours=" + (pct(d, HONOURS, N) * 100).toFixed(0) + "%",
    "kcie=" + (pct(d, ["kcie"], N) * 100).toFixed(0) + "%",
    "collapse=" + (pct(d, COLLAPSE, N) * 100).toFixed(0) + "%",
    "| " + JSON.stringify(d));
});

/* ---- assertions: the design targets ---- */
var fails = [];
function assert(cond, msg) { if (!cond) fails.push(msg); }

// no runtime errors, everything terminates
Object.keys(R).forEach(function (p) { assert(R[p].errs === 0, p + ": " + R[p].errs + " runtime errors"); });
// rotation invariant: never the same event twice in a row, in any game
Object.keys(R).forEach(function (p) { assert(R[p].bb === 0, p + ": " + R[p].bb + " games had back-to-back event repeats"); });

// neither pure posture can be spammed to victory
assert(pct(R.tourOnly.dist, HONOURS, N) <= 0.10, "tour-only earns honours too often (" + (pct(R.tourOnly.dist, HONOURS, N) * 100).toFixed(0) + "%, want ≤10%)");
assert(pct(R.deskOnly.dist, ["kcie"], N) <= 0.12, "desk-only reaches KCIE too often (want ≤12%)");
assert(pct(R.tourOnly.dist, ["breakdown"], N) >= 0.30, "tour-only should mostly break down (want ≥30% Invalided Home)");

// skill is rewarded; careless play mostly fails but isn't impossible
assert(pct(R.skilled.dist, HONOURS, N) >= 0.50, "skilled play should earn honours ≥50% (" + (pct(R.skilled.dist, HONOURS, N) * 100).toFixed(0) + "%)");
var rnd = pct(R.random.dist, HONOURS, N);
assert(rnd >= 0.02 && rnd <= 0.50, "random honour-rate out of band [2%,50%]: " + (rnd * 100).toFixed(0) + "%");

// every honour tier + the common collapses are reachable across the pooled runs
var all = {};
Object.keys(R).forEach(function (p) { Object.keys(R[p].dist).forEach(function (k) { all[k] = (all[k] || 0) + R[p].dist[k]; }); });
HONOURS.concat(["breakdown", "scandal", "transfer", "gonenative"]).forEach(function (k) {
  assert(all[k] > 0, "ending '" + k + "' never occurred in any policy");
});
// the two tail collapses must be reachable via their adversarial probe
assert((R.wrecker.dist.riot || 0) > 0, "riot unreachable — wrecker policy never triggered it");
assert((R.reckless.dist.bankrupt || 0) > 0, "bankrupt unreachable — reckless policy never triggered it");

if (fails.length) {
  console.error("\nSIMULATION FAILED — " + fails.length + " band(s) missed:");
  fails.forEach(function (f) { console.error("  ✗ " + f); });
  process.exit(1);
}
console.log("\nAll balance bands hold ✓");
