/* Pukka Sahib — headless game logic.
   No DOM, no globals beyond the export. Runs in the browser (attaches
   window.PukkaLogic) and in Node (module.exports), so the same code that
   ships is the code the validator and simulator exercise. All randomness
   flows through an injected `rng` so simulations are seeded and deterministic;
   the render layer never consumes rng. */
(function (global) {
  "use strict";

  var DEFAULT_METERS = ["revenue", "order", "prestige", "contentment", "health"];
  var SECRECY = ["MOST SECRET", "SECRET", "CONFIDENTIAL", "CYPHER"];

  // The year-end verdict floors, exported so the UI legend can print the same
  // numbers the engine judges by: finish with Prestige or Order under `floor`
  // and the year is a scandal; Contentment at `nativeContentment` with
  // Prestige under `nativePrestige` reads as gone native.
  var VERDICT = { floor: 40, nativeContentment: 65, nativePrestige: 50 };

  // Danger floors the meter bars draw a hairline at: below the scandal floor
  // prestige/order fail the year's verdict; health/revenue approaching the
  // collapse at 0 are in the warning band. Contentment has no low-side danger
  // (its trap is the high side, gone native), so it draws no floor.
  var METER_FLOORS = { prestige: VERDICT.floor, order: VERDICT.floor, health: 25, revenue: 25 };

  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }

  // mulberry32 — small seeded PRNG for deterministic simulation.
  function seededRng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createGame(content, rng) {
    var CFG = content.config;
    var ENDINGS = content.endings;
    var EVENTS = content.events;
    var OCCASIONS = content.occasions || [];
    var CODAS = content.codas || [];
    var CAL = CFG.calendar;
    var POSTURES = CFG.postures;
    var ECON = CFG.economy;
    var MAX_TURNS = CFG.maxTurns;
    var CREDITOR = ECON.creditor || "the Lala"; // who holds the district's paper
    var PROJECTS = CFG.projects || []; // district works you may commission (see below)
    var TOURPRESS = CFG.tourPress || null; // push-your-luck touring (see choosePosture)
    // Meter keys come from the chapter's config so a rank can re-skin its five
    // columns; the default list keeps older bundles working.
    var METERS = (CFG.meters && CFG.meters.length)
      ? CFG.meters.map(function (m) { return m.key; })
      : DEFAULT_METERS;
    rng = rng || Math.random;

    var S, phase, current, lastResult, recent, ended, notice, lastEventId;

    function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

    function seasonOf(t) {
      for (var i = 0; i < CAL.seasons.length; i++) {
        var s = CAL.seasons[i];
        if (t >= s.from && t <= s.to) return s;
      }
      return CAL.seasons[CAL.seasons.length - 1];
    }
    function monthOf(t) { return CAL.months[Math.min(CAL.months.length - 1, Math.floor((t - 1) / 2))]; }

    // A once-per-season "retreat": a deliberate fortnight spent recovering health
    // at the cost of the district's standing. Offered as a third posture while
    // its season is on and its flag is unspent.
    function retreatFor(sk) {
      var def = (CFG.retreats || {})[sk];
      if (!def || S.flags[def.flag]) return null;
      return def;
    }
    function retreatByKey(key) {
      var rs = CFG.retreats || {};
      for (var k in rs) if (rs.hasOwnProperty(k) && rs[k].key === key) return rs[k];
      return null;
    }

    function occasionFor(t) {
      for (var i = 0; i < OCCASIONS.length; i++) if (OCCASIONS[i].turn === t) return OCCASIONS[i];
      return null;
    }

    // District works (config.projects): a slow, deliberate use for a healthy
    // treasury. Commissioning one spends the fortnight and its cost and queues
    // it to mature some fortnights on into an interlude whose quality turns on
    // how the district was kept meanwhile — money as an expression of intent.
    function projectById(id) {
      for (var i = 0; i < PROJECTS.length; i++) if (PROJECTS[i].id === id) return PROJECTS[i];
      return null;
    }
    function projectQueued(id) { return (S.projects || []).some(function (p) { return p.id === id; }); }
    // On offer when the cost is in hand, and it is neither built (its flag) nor
    // already building (in the queue).
    function projectOffered(p) { return S.treasury >= p.cost && !S.flags[p.id] && !projectQueued(p.id); }
    function worksOnOffer() {
      return PROJECTS.filter(projectOffered).map(function (p) {
        return { kind: p.id, label: p.label, note: p.note, project: true, cost: p.cost, econ: { treasury: -p.cost } };
      });
    }
    // A work maturing this fortnight claims it (like an occasion). Its fate is
    // read, not chosen: a well-kept district (thrived.requires) makes the works
    // good; a neglected one leaves a white elephant.
    function matureProject() {
      if (occasionFor(S.turn)) return null; // an occasion owns this fortnight; the works wait
      for (var i = 0; i < (S.projects || []).length; i++) {
        if (S.projects[i].due <= S.turn) {
          var p = projectById(S.projects[i].id);
          S.projects.splice(i, 1);
          if (!p) return { pulsed: [] };
          var out = evalCondition(p.thrived.requires) ? p.thrived : p.languished;
          var eff = out.effects || {};
          var pulsed = applyMeters(eff);
          (out.setFlags || []).forEach(function (f) { S.flags[f] = true; });
          applyEcon(out.econ);
          current = { id: p.id + "#matured", tag: p.tag, title: p.title, body: out.body, interlude: true };
          lastResult = { outcome: out.outcome || "", effects: eff, econ: out.econ || null };
          logDecision(p.title, "the works come to term", out.outcome, eff, out.econ, (out.setFlags || []).length);
          ended = collapseCheck();
          return { pulsed: pulsed };
        }
      }
      return null;
    }

    // Open a fortnight: a maturing work, then an occasion (the fixed calendar of
    // the year) claim the whole fortnight — no posture choice. With choices an
    // occasion plays as an event; without, it is a fait accompli like an interlude.
    function beginFortnight() {
      var mat = matureProject();
      if (mat) { phase = ended ? "ended" : "interlude"; return mat.pulsed; }
      var occ = occasionFor(S.turn);
      if (!occ) { phase = "posture"; return []; }
      S.posture = null; // the fortnight is spoken for; banner falls back to season
      current = occ;
      if (occ.choices && occ.choices.length) { phase = "event"; return []; }
      var eff = occ.effects || {};
      var pulsed = applyMeters(eff);
      applyEcon(occ.econ);
      lastResult = { outcome: occ.outcome || "", effects: eff, econ: occ.econ || null };
      ended = collapseCheck();
      phase = ended ? "ended" : "interlude";
      return pulsed;
    }

    function evalCondition(c) {
      if (!c) return true;
      if ("flag" in c) return !!S.flags[c.flag];
      if ("meter" in c) {
        // Besides the five meters, conditions may read debt, the fortnight
        // ("turn"), and the honours blend ("showing") — so warnings can fire
        // on a year that is quietly falling short, not only on a single dial.
        var v = c.meter === "showing" ? honoursScore() : S[c.meter];
        switch (c.op) {
          case ">": return v > c.value;
          case ">=": return v >= c.value;
          case "<": return v < c.value;
          case "<=": return v <= c.value;
          case "==": return v === c.value;
          case "!=": return v !== c.value;
        }
        return false;
      }
      if (c.allOf) return c.allOf.every(evalCondition);
      if (c.anyOf) return c.anyOf.some(evalCondition);
      if (c.not) return !evalCondition(c.not);
      return true;
    }

    function resolveChoice(ch) {
      var b = ch.condition ? (evalCondition(ch.condition) ? ch.ifTrue : ch.ifFalse) : ch;
      // A gamble: a branch may carry a rare disaster (risk) resolved by the
      // injected rng — take the risky-reading option and, at risk.chance, the
      // catastrophe branch replaces the ordinary result entirely.
      if (b.risk && rng() < b.risk.chance) b = b.risk;
      return {
        effects: b.effects || {},
        outcome: b.outcome || "",
        setFlags: b.setFlags || ch.setFlags || [],
        econ: b.econ || ch.econ || null
      };
    }

    // Treasury spend borrows from the Lala on a shortfall; that is the whole
    // point of the relief "budget you can overspend".
    function applyEcon(econ) {
      if (!econ) return;
      if (econ.treasury) {
        S.treasury += econ.treasury;
        if (S.treasury < 0) { S.debt += -S.treasury; S.treasury = 0; }
      }
      if (econ.debt) { S.debt += econ.debt; if (S.debt < 0) S.debt = 0; } // arcs can forgive debt
    }

    // Fires on entering a turn: the Division's seasonal wire, season-boundary
    // interest, then any settlement.
    function enterTurn() {
      notice = null;
      S.consulted = false; // a fresh fortnight; any advice must be asked afresh
      // Remember the fortnight's opening meters, so the bars can show the net
      // move each fortnight made (the trend arrows).
      S.turnStart = {};
      METERS.forEach(function (k) { S.turnStart[k] = S[k]; });
      var parts = [];
      var boundary = S.turn > 1 && seasonOf(S.turn).key !== seasonOf(S.turn - 1).key;
      if (boundary && CFG.review) {
        // One line from the next man up the chain, telegraphic and unsigned:
        // tone by the honours blend, plus the weakest column if it reads badly.
        var rv = CFG.review, h = honoursScore();
        var band = rv.bands.filter(function (b) { return h >= b.min; })[0] || rv.bands[rv.bands.length - 1];
        var worst = null;
        METERS.forEach(function (m) {
          if (S[m] < (rv.weakBelow || 0) && rv.weak[m] && (!worst || S[m] < S[worst])) worst = m;
        });
        parts.push(rv.from + (worst ? rv.weak[worst] + " " : "") + band.text + (rv.close || ""));
      }
      if (boundary && S.debt > 0) {
        var interest = Math.round(S.debt * ECON.interestRate);
        S.debt += interest;
        if (interest > 0) parts.push(CREDITOR + "'s interest falls due: debt grows by " + rupees(interest) + ".");
      }
      if (ECON.settlementTurns.indexOf(S.turn) !== -1) {
        var collected = Math.round(
          ECON.settlementBase *
          (0.4 + 0.6 * S.revenue / 100) *
          (0.7 + 0.3 * ((S.contentment + S.order) / 200))
        );
        S.treasury += collected;
        // The chest services debt at settlement, but only up to half the
        // collection — so a district run deep into the Lala's books can still
        // slide toward bankruptcy rather than being auto-rescued.
        var repaid = 0;
        if (S.debt > 0) { repaid = Math.min(S.treasury, S.debt, Math.round(collected * 0.5)); S.treasury -= repaid; S.debt -= repaid; }
        parts.push("The revenue settlement: " + rupees(collected) + " collected" +
          (repaid > 0 ? ", " + rupees(repaid) + " paid to " + CREDITOR : "") + ".");
      }
      if (parts.length) notice = parts.join(" ");
    }

    function collapseCheck() {
      if (S.health <= 0) return ENDINGS.breakdown;
      if (S.order <= 0) return ENDINGS.riot;
      if (S.prestige <= 0) return ENDINGS.scandal;
      if (S.revenue <= 0) return ENDINGS.bankrupt;
      if (S.debt > ECON.debtCeiling) return ENDINGS.bankrupt;
      return null;
    }

    // The honours ladder is chapter data (config.honours): blend weights over
    // the four public meters, and an ordered ladder of tiers, highest first,
    // each wanting a showing (the blended score) AND a name (a prestige floor).
    // A tier with barredByDebt is skipped while the Lala holds your paper.
    var HONOURS = CFG.honours || {
      weights: { prestige: 0.45, revenue: 0.2, order: 0.2, contentment: 0.15 },
      ladder: [{ key: "cie", score: 55, prestige: 52, reach: "a <b>C.I.E.</b> is within reach" }]
    };
    function honoursScore() {
      var w = HONOURS.weights, h = 0;
      Object.keys(w).forEach(function (k) { h += (S[k] || 0) * w[k]; });
      return Math.round(h);
    }
    // The highest rung the year clears (ignoring or applying the debt bar).
    function ladderTier(applyDebtBar) {
      var p = S.prestige, h = honoursScore();
      var debtBar = S.debt > ECON.debtWarn;
      for (var i = 0; i < HONOURS.ladder.length; i++) {
        var t = HONOURS.ladder[i];
        if (applyDebtBar && debtBar && t.barredByDebt) continue;
        if (h >= t.score && p >= t.prestige) return t;
      }
      return null;
    }

    function finalVerdict() {
      var p = S.prestige, o = S.order, c = S.contentment;
      // Gone-native outranks scandal: a magistrate the district loves and the
      // Service has written off resigns his own way — not a disgrace story.
      if (c >= VERDICT.nativeContentment && p < VERDICT.nativePrestige) return ENDINGS.gonenative;
      if (p < VERDICT.floor || o < VERDICT.floor) return ENDINGS.scandal;
      var tier = ladderTier(true); // the debt bar demotes past barred rungs
      return tier ? ENDINGS[tier.key] : ENDINGS.transfer;
    }

    function eligible(e) {
      if (e.once && S.flags[e.id]) return false;
      if (e.requires && !evalCondition(e.requires)) return false;
      return true;
    }

    // Seasonally- and posture-weighted draw. Crises fire in-season regardless of
    // posture; otherwise posture biases tour vs. desk material. Avoids the last
    // few draws so nothing repeats back-to-back.
    function drawEvent() {
      var sk = seasonOf(S.turn).key;
      var inSeason = function (e) {
        var ss = e.season || ["any"];
        return ss.indexOf("any") !== -1 || ss.indexOf(sk) !== -1;
      };
      // Crisis warnings preempt everything, atmosphere included: priority
      // events whose `requires` puts a meter in its danger band fire at the
      // next drawn fortnight (once each per game), so no collapse arrives
      // unannounced.
      var urgent = EVENTS.filter(function (e) { return e.priority && !e.interlude && eligible(e); });
      if (urgent.length) {
        current = pick(urgent);
        recent.push(current.id); if (recent.length > 4) recent.shift();
        lastEventId = current.id;
        return;
      }
      // A small independent chance the fortnight brings only an atmospheric
      // occurrence. Kept out of the posture-weighted draw so it can't starve the
      // business pool or force a repeat.
      var interludes = EVENTS.filter(function (e) { return e.interlude && eligible(e) && inSeason(e); });
      var freshInterludes = interludes.filter(function (e) { return recent.indexOf(e.id) === -1; });
      if (freshInterludes.length && rng() < (CFG.interludeChance || 0.16)) {
        current = pick(freshInterludes);
        recent.push(current.id); if (recent.length > 4) recent.shift();
        return;
      }
      // Ordinary district business, weighted by posture. Bias only when it offers
      // real variety; otherwise draw the whole in-season pool so nothing repeats.
      var prefer = S.posture === "tour" ? ["tour", "crisis"] : ["desk", "club", "personal", "crisis"];
      var pool = EVENTS.filter(function (e) { return !e.interlude && eligible(e) && inSeason(e); });
      var biased = pool.filter(function (e) { return prefer.indexOf(e.kind) !== -1 || e.kind === "crisis"; });
      var cand = biased.length >= 2 ? biased : pool;
      if (!cand.length) cand = EVENTS.filter(function (e) { return !e.interlude && eligible(e); });
      if (!cand.length) {
        // Dry-pool failsafe: rather than crash, the year re-presents settled
        // business — once-flags are ignored, but gates are still respected.
        cand = EVENTS.filter(function (e) {
          return !e.interlude && !e.priority && (!e.requires || evalCondition(e.requires));
        });
      }
      var fresh = cand.filter(function (e) { return recent.indexOf(e.id) === -1; });
      if (fresh.length) cand = fresh;
      else if (cand.length > 1) {
        var last = recent[recent.length - 1];
        cand = cand.filter(function (e) { return e.id !== last; });
      }
      if (cand.length > 1 && lastEventId) { // never the same business twice running, even across an interlude
        var c2 = cand.filter(function (e) { return e.id !== lastEventId; });
        if (c2.length) cand = c2;
      }
      current = pick(cand);
      recent.push(current.id); if (recent.length > 4) recent.shift();
      lastEventId = current.id;
    }

    /* ---------- public transitions ---------- */

    // `carry` is what the previous posting handed on: { flags: [...], meters:
    // {k: delta} }. Carried flags gate this chapter's echo events and codas;
    // carried meter deltas (a despatch's dowry) adjust the start.
    function init(carry) {
      S = { flags: {}, posture: null, turn: 1, treasury: ECON.startTreasury, debt: 0, log: [], projects: [] };
      METERS.forEach(function (k) { S[k] = CFG.start[k]; });
      if (carry) {
        (carry.flags || []).forEach(function (f) { S.flags[f] = true; });
        Object.keys(carry.meters || {}).forEach(function (k) {
          if (METERS.indexOf(k) !== -1) S[k] = clamp(S[k] + carry.meters[k]);
        });
      }
      recent = []; ended = null; current = null; lastResult = null; lastEventId = null;
      enterTurn();
      var pulsed = beginFortnight();
      return snapshot({ pulsed: pulsed });
    }

    // Net meter swing of a posture for the current season (base + season mods).
    function postureEffects(kind) {
      var p = POSTURES[kind];
      var sk = seasonOf(S.turn).key;
      var eff = Object.assign({}, p.base);
      var se = (p.season && p.season[sk]) || {};
      Object.keys(se).forEach(function (k) { eff[k] = (eff[k] || 0) + se[k]; });
      Object.keys(eff).forEach(function (k) { if (!eff[k]) delete eff[k]; }); // drop zeroed-out nets
      return eff;
    }

    // Rotate through authored variants deterministically by fortnight — the
    // render layer never consumes rng, and consecutive turns never repeat.
    function variantOf(arr) {
      if (!arr || !arr.length) return "";
      return arr[(S.turn - 1) % arr.length];
    }

    function postureOptions() {
      var sk = seasonOf(S.turn).key;
      function postureOpt(kind) {
        var p = POSTURES[kind];
        var note = p.notes ? variantOf(p.notes[sk]) : (p.note || "");
        var label = p.labels ? p.labels[sk] : p.label; // labels are seasonal: the action reads like the season
        return { kind: kind, label: label, note: note, effects: postureEffects(kind) };
      }
      var opts = [postureOpt("tour")];
      // Pressing the luck is a posture in its own right — offered beside the
      // quiet tour in the cold weather (the marching season), not sprung after it.
      // The push-your-luck tour: the reward is not fixed (it depends how far you
      // press), so it carries no effect-chip preview — showing the base tour
      // chips made it read as identical to the quiet tour. `press` flags it.
      if (TOURPRESS && sk === "cold")
        opts.push({ kind: "tourpress", label: TOURPRESS.postureLabel, note: TOURPRESS.postureNote, press: true });
      opts.push(postureOpt("desk"));
      var rdef = retreatFor(sk);
      if (rdef) opts.push({ kind: rdef.key, label: rdef.label, note: rdef.note, retreat: true, effects: rdef.effects || {} });
      worksOnOffer().forEach(function (w) { opts.push(w); });
      return opts;
    }

    function choosePosture(kind) {
      if (phase !== "posture") return snapshot();
      // Commission a district work: spend the fortnight and the money, queue the
      // maturation, and resolve to a "works begin" interlude.
      var pdef = projectById(kind);
      if (pdef) {
        if (!projectOffered(pdef)) return snapshot(); // not on offer (unaffordable/built/building)
        S.flags[pdef.id] = true;
        S.projects.push({ id: pdef.id, due: S.turn + pdef.matures });
        applyEcon({ treasury: -pdef.cost });
        var cm = pdef.commission || {};
        logDecision(cm.title || pdef.title, pdef.label, cm.outcome || "", {}, { treasury: -pdef.cost }, 1);
        current = { id: pdef.id + "#works", tag: pdef.tag, title: cm.title || pdef.title, body: cm.body || "", interlude: true };
        lastResult = { outcome: cm.outcome || "", effects: {}, econ: { treasury: -pdef.cost } };
        ended = collapseCheck();
        phase = ended ? "ended" : "interlude";
        return snapshot({ pulsed: [] });
      }
      // A seasonal retreat: consumes the fortnight as a no-choice recovery, sets
      // its once-per-season flag, and resolves straight to Continue (no event).
      var rdef = retreatByKey(kind);
      if (rdef) {
        if (retreatFor(seasonOf(S.turn).key) !== rdef) return snapshot(); // not on offer
        S.flags[rdef.flag] = true;
        var reff = rdef.effects || {};
        var rpulsed = applyMeters(reff);
        logDecision(rdef.title, rdef.label, rdef.outcome, reff, null, 1);
        current = { id: rdef.key, tag: rdef.tag, title: rdef.title, body: rdef.body, interlude: true, art: rdef.art };
        lastResult = { outcome: rdef.outcome || "", effects: reff, econ: null };
        ended = collapseCheck();
        phase = ended ? "ended" : "interlude";
        return snapshot({ pulsed: rpulsed });
      }
      // Push-your-luck touring is its own posture (offered beside the quiet
      // tour in the cold weather). It takes the tour's effects, then opens the
      // press loop — press on for more at rising risk, or make camp. Plain
      // "tour" never enters it, so the seeded sim stream is exactly as before.
      if (kind === "tourpress") {
        if (!TOURPRESS || seasonOf(S.turn).key !== "cold") return snapshot(); // not on offer
        S.posture = "tour"; // it is a tour, for the banner and the art
        var tpPulsed = applyMeters(postureEffects("tour"));
        ended = collapseCheck();
        if (ended) { phase = "ended"; return snapshot({ pulsed: tpPulsed }); }
        S.pressCount = 0;
        phase = "press";
        return snapshot({ pulsed: tpPulsed });
      }
      S.posture = kind;
      var pulsed = applyMeters(postureEffects(kind)); // same net the preview showed
      ended = collapseCheck();
      if (ended) { phase = "ended"; return snapshot({ pulsed: pulsed }); }
      return presentDraw(pulsed);
    }

    // Draw the fortnight's ordinary business and present it: an interlude
    // resolves here (once-flag spent, small effect applied); anything else
    // becomes the event to choose. Shared by desk, camp, and making camp.
    function presentDraw(pulsed) {
      drawEvent();
      if (current.interlude) {
        if (current.once) S.flags[current.id] = true;
        var ieff = current.effects || {};
        var ipulsed = applyMeters(ieff);
        applyEcon(current.econ);
        lastResult = { outcome: current.outcome || "", effects: ieff, econ: current.econ || null };
        ended = collapseCheck();
        phase = ended ? "ended" : "interlude";
        return snapshot({ pulsed: (pulsed || []).concat(ipulsed) });
      }
      phase = "event";
      return snapshot({ pulsed: pulsed || [] });
    }

    // The chance the tour turns on the next push — rising with each village
    // already taken, capped so it is never a certainty.
    function pressChance() {
      if (!TOURPRESS) return 0;
      var c = TOURPRESS.chanceBase + TOURPRESS.chanceRamp * (S.pressCount || 0);
      return Math.min(TOURPRESS.chanceCap != null ? TOURPRESS.chanceCap : 0.6, c);
    }

    // Press on to one more village: bank the reward, then roll for the turn. A
    // bad roll ends the tour on a loss (resolved as an interlude); a good roll
    // offers the choice again, until the country runs out (max presses).
    function pressOn() {
      if (phase !== "press" || !TOURPRESS || S.pressCount >= TOURPRESS.max) return snapshot();
      var chance = pressChance();
      S.pressCount += 1;
      var gain = TOURPRESS.press.effects || {};
      var pulsed = applyMeters(gain);
      applyEcon(TOURPRESS.press.econ);
      if (rng() < chance) {
        var rk = TOURPRESS.risk;
        var reff = rk.effects || {};
        var rpulsed = applyMeters(reff);
        applyEcon(rk.econ);
        (rk.setFlags || []).forEach(function (f) { S.flags[f] = true; });
        logDecision(rk.title || "The tour turns", "pressed the luck", rk.outcome, reff, rk.econ, (rk.setFlags || []).length);
        current = { id: "tour-press#lost", tag: TOURPRESS.tag, title: rk.title, body: rk.body, interlude: true };
        lastResult = { outcome: rk.outcome || "", effects: reff, econ: rk.econ || null };
        ended = collapseCheck();
        phase = ended ? "ended" : "interlude";
        return snapshot({ pulsed: pulsed.concat(rpulsed) });
      }
      if (S.pressCount >= TOURPRESS.max) return bankTour(pulsed); // the country runs out
      phase = "press";
      return snapshot({ pulsed: pulsed });
    }

    // Make camp: stop the tour and take what it has earned. With no village yet
    // pressed, it is an ordinary tour fortnight (draw the business); after a
    // press or more, the banked tour resolves as its own interlude.
    function makeCamp() {
      if (phase !== "press") return snapshot();
      if ((S.pressCount || 0) === 0) return presentDraw(applyMeters({})); // ordinary tour: the fortnight's business
      return bankTour([]);
    }
    function bankTour(pulsed) {
      var bk = TOURPRESS.bank || {};
      logDecision(bk.title || "The tour comes in", "made camp with the country behind you", bk.outcome, {}, null, 0);
      current = { id: "tour-press#camp", tag: TOURPRESS.tag, title: bk.title, body: bk.body, interlude: true };
      lastResult = { outcome: bk.outcome || "", effects: {}, econ: null };
      ended = collapseCheck();
      phase = ended ? "ended" : "interlude";
      return snapshot({ pulsed: pulsed || [] });
    }

    function applyMeters(eff) {
      var pulsed = [];
      Object.keys(eff).forEach(function (k) {
        if (eff[k]) { S[k] = clamp(S[k] + eff[k]); pulsed.push(k); }
      });
      return pulsed;
    }

    // Record a decision for the year-end service record. Weight ranks turning
    // points: the sum of meter movement, a little for money moved, and a heavy
    // bonus for a choice that set an arc flag (those define the year even when
    // their numbers are small).
    function logDecision(title, label, outcome, effects, econ, flagCount) {
      var w = 0;
      Object.keys(effects || {}).forEach(function (k) { w += Math.abs(effects[k]); });
      if (econ) w += Math.min(8, Math.round((Math.abs(econ.treasury || 0) + Math.abs(econ.debt || 0)) / 4000));
      w += (flagCount || 0) * 6;
      S.log.push({ turn: S.turn, month: monthOf(S.turn), title: title, label: label, outcome: outcome || "", weight: w });
    }

    // Build the follow-up card of a two-step choice from its `then`: a synthetic
    // event carrying the escalation and the real decision. Never itself two-step
    // (the validator forbids nesting), so it resolves like an ordinary event.
    function buildThen(parent, thenDef, idx) {
      return {
        id: parent.id + "#then" + idx, tag: thenDef.tag || parent.tag,
        title: thenDef.title || parent.title, body: thenDef.body,
        choices: thenDef.choices, once: false, thenSynthetic: true,
        art: thenDef.art || parent.art
      };
    }

    function chooseOption(i) {
      if (phase !== "event") return snapshot();
      var ch = current.choices[i];
      if (current.once && !current.thenSynthetic) S.flags[current.id] = true;
      var r = resolveChoice(ch);
      var pulsed = applyMeters(r.effects);
      r.setFlags.forEach(function (f) { S.flags[f] = true; });
      applyEcon(r.econ);
      logDecision(current.title, ch.label, r.outcome, r.effects, r.econ, r.setFlags.length);
      lastResult = { outcome: r.outcome, effects: r.effects, econ: r.econ };
      ended = collapseCheck();
      // Two-step: a top-level choice may open a follow-up decision instead of
      // resolving. Its own effects apply as the setup (and can still collapse
      // the run); if they don't, the escalation's card is presented, its lead
      // the setup outcome. A synthetic follow-up never branches again.
      if (!ended && ch.then && !current.thenSynthetic) {
        current = buildThen(current, ch.then, i);
        phase = "event";
        return snapshot({ pulsed: pulsed });
      }
      phase = ended ? "ended" : "resolved";
      return snapshot({ pulsed: pulsed });
    }

    // Ask the man who would know before you decide. Optional per event: reveals
    // an in-voice opinion (with the adviser's own bias, and sometimes wrong),
    // and may cost a small meter/econ nudge — never required, never a gate, and
    // it does not spend the fortnight. Consulting consumes no rng, so the
    // deterministic sim is unaffected; the advice is authored, not rolled.
    function consult() {
      if (phase !== "event" || !current || !current.consult || S.consulted) return snapshot();
      var co = current.consult;
      S.consulted = true;
      var pulsed = applyMeters(co.effects || {});
      (co.setFlags || []).forEach(function (f) { S.flags[f] = true; });
      applyEcon(co.econ);
      // Deliberation cannot itself end the year: any meter it moves is settled
      // by the choice you go on to make (which runs the collapse check).
      return snapshot({ pulsed: pulsed });
    }

    function next() {
      if (phase !== "resolved" && phase !== "interlude") return snapshot();
      S.turn += 1;
      if (S.turn > MAX_TURNS) { ended = finalVerdict(); phase = "ended"; return snapshot(); }
      enterTurn();
      ended = collapseCheck();
      if (ended) { phase = "ended"; return snapshot(); }
      var pulsed = beginFortnight();
      return snapshot({ pulsed: pulsed });
    }

    function snapshot(extra) {
      var meters = {}, deltas = {};
      METERS.forEach(function (k) {
        meters[k] = S[k];
        deltas[k] = (S.turnStart && typeof S.turnStart[k] === "number") ? S[k] - S.turnStart[k] : 0;
      });
      var season = seasonOf(S.turn);
      var snap = {
        phase: phase, turn: S.turn, maxTurns: MAX_TURNS,
        season: season, month: monthOf(S.turn),
        seasonIntro: variantOf(season.intros) || season.intro || "",
        meters: meters, deltas: deltas, treasury: S.treasury, debt: S.debt,
        posture: S.posture, notice: notice,
        retreat: phase === "posture" ? retreatFor(seasonOf(S.turn).key) : null,
        works: phase === "posture" ? worksOnOffer() : [],
        pendingWorks: (S.projects || []).length,
        press: (phase === "press" && TOURPRESS) ? {
          count: S.pressCount || 0,
          canPress: (S.pressCount || 0) < TOURPRESS.max,
          chance: pressChance(),
          gain: TOURPRESS.press.effects || {},
          intro: TOURPRESS.intro || "",
          label: TOURPRESS.label, note: TOURPRESS.note,
          campLabel: TOURPRESS.campLabel, campNote: TOURPRESS.campNote
        } : null,
        event: (phase === "event" || phase === "interlude") ? current : null,
        step: (phase === "event" && current && current.thenSynthetic) || false,
        stepLead: (phase === "event" && current && current.thenSynthetic && lastResult) ? lastResult.outcome : null,
        consult: (phase === "event" && current && current.consult) ? {
          who: current.consult.who,
          tag: current.consult.tag || null,
          available: !S.consulted,
          opinion: S.consulted ? current.consult.opinion : null,
          effects: S.consulted ? (current.consult.effects || null) : null,
          econ: S.consulted ? (current.consult.econ || null) : null
        } : null,
        result: (phase === "resolved" || phase === "ended" || phase === "interlude") ? lastResult : null,
        ended: ended, endedKey: (phase === "ended" && ended) ? endKeyOf(ended) : null,
        promoted: (phase === "ended" && ended && CFG.chapter)
          ? (CFG.chapter.promotionTiers || []).indexOf(endKeyOf(ended)) !== -1 : false,
        chapter: CFG.chapter || null,
        standings: standings(),
        honours: honoursStanding(),
        codas: (phase === "ended" && ended) ? endingCodas(ended) : null,
        record: (phase === "ended") ? serviceRecord(5) : null
      };
      if (extra) Object.assign(snap, extra);
      return snap;
    }

    // The standing line is a glance, not a ledger: it says whether the year is
    // lacking, on track, or exceeding, and names what falls short — never a
    // figure. The exact bars live in the legend (honours.desc + ladder data).
    function honoursStanding() {
      var p = S.prestige, c = S.contentment, h = honoursScore();
      var lead = HONOURS.lead || "Honours List &mdash; ";
      var debtBar = S.debt > ECON.debtWarn;
      function tname(t) { return t.name || t.key; }
      // What a rung lacks, named but not numbered.
      function shortOf(t) {
        var needsShowing = h < t.score, needsName = p < t.prestige;
        if (needsShowing && needsName) return "both the showing and Prestige";
        if (needsShowing) return "the showing &mdash; every public column counts";
        return "Prestige &mdash; be seen";
      }
      var tier = ladderTier(false);
      if (tier) {
        var idx = HONOURS.ladder.indexOf(tier);
        if (debtBar && tier.barredByDebt)
          return lead + "exceeding on the year's work &mdash; and barred: bring " + CREDITOR + "'s debt down";
        if (idx === 0)
          return lead + "<b>exceeding</b>: " + tier.reach + " &mdash; hold it to the close";
        var above = HONOURS.ladder[idx - 1];
        return lead + "<b>on track</b>: " + tier.reach +
          ((debtBar && above.barredByDebt)
            ? "; nothing higher while " + CREDITOR + " holds your paper"
            : ". " + tname(above) + " would want more: " + shortOf(above));
      }
      var bottom = HONOURS.ladder[HONOURS.ladder.length - 1];
      var base = lead + "<b>lacking</b> for " + tname(bottom) + ": short on " + shortOf(bottom);
      if (c >= 65 && p < 50) base += " &mdash; the List reads Prestige, not Contentment";
      return base;
    }

    function endKeyOf(obj) {
      var key = null;
      Object.keys(ENDINGS).forEach(function (k) { if (ENDINGS[k] === obj) key = k; });
      return key;
    }

    // Where the player stands with the chapter's recurring people (config.cast).
    // A relationship is a pair of flags earlier choices set — Ram Autar trusts
    // you or is broken and gone; the Lala holds your paper or has your defiance.
    // Enmity dominates a doubled standing. Pure read of flags — no new state.
    function standings() {
      var cast = CFG.cast || [];
      var out = [];
      cast.forEach(function (m) {
        var st = null, note = null;
        if (m.wronged && S.flags[m.wronged.flag]) { st = "wronged"; note = m.wronged.note; }
        else if (m.won && S.flags[m.won.flag]) { st = "won"; note = m.won.note; }
        if (st) out.push({ id: m.id, name: m.name, who: m.who, state: st,
          note: note || (st === "won" ? "in your good books" : "crossed") });
      });
      return out;
    }

    // Arc codas: data-driven sentences appended to the verdict when their
    // condition holds — the year, remembered. A coda may be scoped to specific
    // endings so the same flag reads differently under a knighthood and a
    // disgrace.
    function endingCodas(endObj) {
      var key = endKeyOf(endObj);
      return CODAS.filter(function (cd) {
        if (cd.endings && cd.endings.indexOf(key) === -1) return false;
        return evalCondition(cd.requires);
      }).map(function (cd) { return { head: cd.head, text: cd.text }; });
    }

    // What the finished posting hands the next rank, declared in
    // config.chapter.carryOut: each entry names a source — a flag held, any
    // debt still owed, or the ending earned — and the flag it becomes in the
    // next chapter (plus an optional meter dowry). Null when nothing carries.
    function carryOut() {
      var defs = (CFG.chapter && CFG.chapter.carryOut) || [];
      if (!defs.length || phase !== "ended") return null;
      var ek = endKeyOf(ended);
      var out = { flags: [], meters: {} };
      defs.forEach(function (d) {
        var hit = ("flag" in d) ? !!S.flags[d.flag]
          : ("debt" in d) ? S.debt > 0
          : ("ending" in d) ? ek === d.ending
          : false;
        if (!hit) return;
        out.flags.push(d.as);
        Object.keys(d.meters || {}).forEach(function (k) { out.meters[k] = (out.meters[k] || 0) + d.meters[k]; });
      });
      return out.flags.length ? out : null;
    }

    // The service record: the year's most consequential decisions, ranked by
    // weight, then shown in the order they happened.
    function serviceRecord(limit) {
      var log = (S.log || []).slice();
      log.sort(function (a, b) { return b.weight - a.weight || a.turn - b.turn; });
      var top = log.slice(0, limit || 5);
      top.sort(function (a, b) { return a.turn - b.turn; });
      return top;
    }

    /* ---------- persistence (pure; the UI owns localStorage) ---------- */

    function resolveCurrent(id) {
      if (!id) return null;
      for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].id === id) return EVENTS[i];
      for (i = 0; i < OCCASIONS.length; i++) if (OCCASIONS[i].id === id) return OCCASIONS[i];
      var rdef = retreatByKey(id); // synthetic retreat card
      if (rdef) return { id: rdef.key, tag: rdef.tag, title: rdef.title, body: rdef.body, interlude: true, art: rdef.art };
      return null;
    }
    function serialize() {
      return {
        S: JSON.parse(JSON.stringify(S)),
        phase: phase, currentId: current ? current.id : null,
        // A follow-up card is synthetic (not in the deck), so store it whole to
        // resume mid two-step.
        currentThen: (current && current.thenSynthetic) ? JSON.parse(JSON.stringify(current)) : null,
        lastResult: lastResult ? JSON.parse(JSON.stringify(lastResult)) : null,
        recent: recent.slice(), notice: notice, lastEventId: lastEventId,
        endedKey: endKeyOf(ended)
      };
    }
    function restore(data) {
      if (!data || !data.S) return init();
      S = data.S; if (!S.log) S.log = [];
      phase = data.phase || "posture";
      recent = data.recent || [];
      notice = data.notice || null;
      lastEventId = data.lastEventId || null;
      lastResult = data.lastResult || null;
      ended = data.endedKey ? ENDINGS[data.endedKey] : null;
      current = data.currentThen ? data.currentThen : resolveCurrent(data.currentId);
      return snapshot();
    }

    return {
      init: init, postureOptions: postureOptions, choosePosture: choosePosture,
      chooseOption: chooseOption, consult: consult, next: next,
      pressOn: pressOn, makeCamp: makeCamp,
      snapshot: function () { return snapshot(); },
      serialize: serialize, restore: restore, carryOut: carryOut,
      seasonOf: seasonOf, monthOf: monthOf,
      isSecrecyTag: function (t) { return SECRECY.indexOf((t || "").toUpperCase()) !== -1; },
      rupees: rupees,
      get raw() { return S; }
    };
  }

  // Indian digit grouping: 1,20,000 not 120,000. Period-correct and legible.
  function rupees(n) {
    var neg = n < 0; n = Math.abs(Math.round(n));
    var s = String(n);
    if (s.length > 3) {
      var last3 = s.slice(-3), rest = s.slice(0, -3);
      rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
      s = rest + "," + last3;
    }
    return (neg ? "-" : "") + "₹" + s;
  }

  var SECRECY_TAGS = ["MOST SECRET", "SECRET", "CONFIDENTIAL", "CYPHER"];
  var API = {
    createGame: createGame, seededRng: seededRng, rupees: rupees, VERDICT: VERDICT, METER_FLOORS: METER_FLOORS,
    isSecrecyTag: function (t) { return SECRECY_TAGS.indexOf((t || "").toUpperCase()) !== -1; }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.PukkaLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
