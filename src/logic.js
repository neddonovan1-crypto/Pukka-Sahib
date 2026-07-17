/* Pukka Sahib — headless game logic.
   No DOM, no globals beyond the export. Runs in the browser (attaches
   window.PukkaLogic) and in Node (module.exports), so the same code that
   ships is the code the validator and simulator exercise. All randomness
   flows through an injected `rng` so simulations are seeded and deterministic;
   the render layer never consumes rng. */
(function (global) {
  "use strict";

  var METERS = ["revenue", "order", "prestige", "contentment", "health"];
  var SECRECY = ["MOST SECRET", "SECRET", "CONFIDENTIAL", "CYPHER"];

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
    var CAL = CFG.calendar;
    var POSTURES = CFG.postures;
    var ECON = CFG.economy;
    var MAX_TURNS = CFG.maxTurns;
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

    // Open a fortnight: an occasion (the fixed calendar of the year) claims the
    // whole fortnight — no posture choice. With choices it plays as an event;
    // without, it is a fait accompli that resolves like an interlude.
    function beginFortnight() {
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
        var v = S[c.meter];
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

    // Fires on entering a turn: season-boundary interest, then any settlement.
    function enterTurn() {
      notice = null;
      var parts = [];
      if (S.turn > 1 && seasonOf(S.turn).key !== seasonOf(S.turn - 1).key && S.debt > 0) {
        var interest = Math.round(S.debt * ECON.interestRate);
        S.debt += interest;
        if (interest > 0) parts.push("The Lala's interest falls due: debt grows by " + rupees(interest) + ".");
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
          (repaid > 0 ? ", " + rupees(repaid) + " paid to the Lala" : "") + ".");
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

    function finalVerdict() {
      var p = S.prestige, r = S.revenue, o = S.order, c = S.contentment;
      var end;
      // Ladder ascends CIE -> KCIE -> KCSI. The K.C.S.I. (senior star) is the
      // pinnacle: eminent standing, a solvent district, and a contented one.
      if (p < 40 || o < 40) end = ENDINGS.scandal;
      else if (c >= 65 && p < 50) end = ENDINGS.gonenative;
      else if (p >= 78 && r >= 58 && c >= 54) end = ENDINGS.kcsi;
      else if (p >= 74 && r >= 56) end = ENDINGS.kcie;
      else if (p >= 58) end = ENDINGS.cie;
      else end = ENDINGS.transfer;
      // A magistrate who beggared the district into the Lala's books is not knighted.
      if (S.debt > ECON.debtWarn && (end === ENDINGS.kcsi || end === ENDINGS.kcie)) end = ENDINGS.cie;
      return end;
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
      // A small independent chance the fortnight brings only an atmospheric
      // occurrence. Kept out of the posture-weighted draw so it can't starve the
      // business pool or force a repeat.
      var interludes = EVENTS.filter(function (e) { return e.interlude && eligible(e) && inSeason(e); });
      if (interludes.length && rng() < (CFG.interludeChance || 0.16)) {
        current = pick(interludes);
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

    function init() {
      S = { flags: {}, posture: null, turn: 1, treasury: ECON.startTreasury, debt: 0 };
      METERS.forEach(function (k) { S[k] = CFG.start[k]; });
      recent = []; ended = null; current = null; lastResult = null; lastEventId = null;
      enterTurn();
      var pulsed = beginFortnight();
      return snapshot({ pulsed: pulsed });
    }

    function postureOptions() {
      var opts = ["tour", "desk"].map(function (kind) {
        var p = POSTURES[kind];
        var note = p.note;
        if (kind === "tour" && seasonOf(S.turn).key === "monsoon")
          note = "The roads are rivers — to tour now is to risk it.";
        return { kind: kind, label: p.label, note: note };
      });
      var rdef = retreatFor(seasonOf(S.turn).key);
      if (rdef) opts.push({ kind: rdef.key, label: rdef.label, note: rdef.note, retreat: true });
      return opts;
    }

    function choosePosture(kind) {
      if (phase !== "posture") return snapshot();
      // A seasonal retreat: consumes the fortnight as a no-choice recovery, sets
      // its once-per-season flag, and resolves straight to Continue (no event).
      var rdef = retreatByKey(kind);
      if (rdef) {
        if (retreatFor(seasonOf(S.turn).key) !== rdef) return snapshot(); // not on offer
        S.flags[rdef.flag] = true;
        var reff = rdef.effects || {};
        var rpulsed = applyMeters(reff);
        current = { id: rdef.key, tag: rdef.tag, title: rdef.title, body: rdef.body, interlude: true, art: rdef.art };
        lastResult = { outcome: rdef.outcome || "", effects: reff, econ: null };
        ended = collapseCheck();
        phase = ended ? "ended" : "interlude";
        return snapshot({ pulsed: rpulsed });
      }
      S.posture = kind;
      var p = POSTURES[kind];
      var sk = seasonOf(S.turn).key;
      var eff = Object.assign({}, p.base);
      var se = (p.season && p.season[sk]) || {};
      Object.keys(se).forEach(function (k) { eff[k] = (eff[k] || 0) + se[k]; });
      var pulsed = applyMeters(eff);
      ended = collapseCheck();
      if (ended) { phase = "ended"; return snapshot({ pulsed: pulsed }); }
      drawEvent();
      if (current.interlude) {
        // A no-choice occurrence: apply its own small effect and offer only Continue.
        var ieff = current.effects || {};
        var ipulsed = applyMeters(ieff);
        applyEcon(current.econ);
        lastResult = { outcome: current.outcome || "", effects: ieff, econ: current.econ || null };
        ended = collapseCheck();
        phase = ended ? "ended" : "interlude";
        return snapshot({ pulsed: pulsed.concat(ipulsed) });
      }
      phase = "event";
      return snapshot({ pulsed: pulsed });
    }

    function applyMeters(eff) {
      var pulsed = [];
      Object.keys(eff).forEach(function (k) {
        if (eff[k]) { S[k] = clamp(S[k] + eff[k]); pulsed.push(k); }
      });
      return pulsed;
    }

    function chooseOption(i) {
      if (phase !== "event") return snapshot();
      var ch = current.choices[i];
      if (current.once) S.flags[current.id] = true;
      var r = resolveChoice(ch);
      var pulsed = applyMeters(r.effects);
      r.setFlags.forEach(function (f) { S.flags[f] = true; });
      applyEcon(r.econ);
      lastResult = { outcome: r.outcome, effects: r.effects, econ: r.econ };
      ended = collapseCheck();
      phase = ended ? "ended" : "resolved";
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
      var meters = {};
      METERS.forEach(function (k) { meters[k] = S[k]; });
      var snap = {
        phase: phase, turn: S.turn, maxTurns: MAX_TURNS,
        season: seasonOf(S.turn), month: monthOf(S.turn),
        meters: meters, treasury: S.treasury, debt: S.debt,
        posture: S.posture, notice: notice,
        retreat: phase === "posture" ? retreatFor(seasonOf(S.turn).key) : null,
        event: (phase === "event" || phase === "interlude") ? current : null,
        result: (phase === "resolved" || phase === "ended" || phase === "interlude") ? lastResult : null,
        ended: ended, honours: honoursStanding()
      };
      if (extra) Object.assign(snap, extra);
      return snap;
    }

    function honoursStanding() {
      var p = S.prestige, c = S.contentment, r = S.revenue;
      if (S.debt > ECON.debtWarn) return "Honours List &mdash; the district's debts have ruined your name";
      if (p < 40) return "Honours List &mdash; your name appears only in the complaints";
      if (p >= 78 && r >= 58 && c >= 54) return "Honours List &mdash; a <b>K.C.S.I.</b> (a knighthood of the star) is within reach";
      if (p >= 74 && r >= 56) return "Honours List &mdash; a <b>K.C.I.E.</b> (a knighthood) is within reach";
      if (p >= 58) return "Honours List &mdash; a <b>C.I.E.</b> is within reach";
      if (p >= 48) return "Honours List &mdash; not yet on anyone's list";
      return "Honours List &mdash; unlikely, on present form";
    }

    return {
      init: init, postureOptions: postureOptions, choosePosture: choosePosture,
      chooseOption: chooseOption, next: next,
      snapshot: function () { return snapshot(); },
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
    createGame: createGame, seededRng: seededRng, rupees: rupees,
    isSecrecyTag: function (t) { return SECRECY_TAGS.indexOf((t || "").toUpperCase()) !== -1; }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else global.PukkaLogic = API;
})(typeof window !== "undefined" ? window : globalThis);
