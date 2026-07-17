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

    // Fires on entering a turn: the Division's seasonal wire, season-boundary
    // interest, then any settlement.
    function enterTurn() {
      notice = null;
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
      if (c >= 65 && p < 50) return ENDINGS.gonenative;
      if (p < 40 || o < 40) return ENDINGS.scandal;
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
      S = { flags: {}, posture: null, turn: 1, treasury: ECON.startTreasury, debt: 0, log: [] };
      METERS.forEach(function (k) { S[k] = CFG.start[k]; });
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
      var opts = ["tour", "desk"].map(function (kind) {
        var p = POSTURES[kind];
        var note = p.notes ? variantOf(p.notes[sk]) : (p.note || "");
        var label = p.labels ? p.labels[sk] : p.label; // labels are seasonal: the action reads like the season
        return { kind: kind, label: label, note: note, effects: postureEffects(kind) };
      });
      var rdef = retreatFor(sk);
      if (rdef) opts.push({ kind: rdef.key, label: rdef.label, note: rdef.note, retreat: true, effects: rdef.effects || {} });
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
        logDecision(rdef.title, rdef.label, rdef.outcome, reff, null, 1);
        current = { id: rdef.key, tag: rdef.tag, title: rdef.title, body: rdef.body, interlude: true, art: rdef.art };
        lastResult = { outcome: rdef.outcome || "", effects: reff, econ: null };
        ended = collapseCheck();
        phase = ended ? "ended" : "interlude";
        return snapshot({ pulsed: rpulsed });
      }
      S.posture = kind;
      var pulsed = applyMeters(postureEffects(kind)); // same net the preview showed
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

    function chooseOption(i) {
      if (phase !== "event") return snapshot();
      var ch = current.choices[i];
      if (current.once) S.flags[current.id] = true;
      var r = resolveChoice(ch);
      var pulsed = applyMeters(r.effects);
      r.setFlags.forEach(function (f) { S.flags[f] = true; });
      applyEcon(r.econ);
      logDecision(current.title, ch.label, r.outcome, r.effects, r.econ, r.setFlags.length);
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
      var season = seasonOf(S.turn);
      var snap = {
        phase: phase, turn: S.turn, maxTurns: MAX_TURNS,
        season: season, month: monthOf(S.turn),
        seasonIntro: variantOf(season.intros) || season.intro || "",
        meters: meters, treasury: S.treasury, debt: S.debt,
        posture: S.posture, notice: notice,
        retreat: phase === "posture" ? retreatFor(seasonOf(S.turn).key) : null,
        event: (phase === "event" || phase === "interlude") ? current : null,
        result: (phase === "resolved" || phase === "ended" || phase === "interlude") ? lastResult : null,
        ended: ended, endedKey: (phase === "ended" && ended) ? endKeyOf(ended) : null,
        promoted: (phase === "ended" && ended && CFG.chapter)
          ? (CFG.chapter.promotionTiers || []).indexOf(endKeyOf(ended)) !== -1 : false,
        chapter: CFG.chapter || null,
        honours: honoursStanding(),
        codas: (phase === "ended" && ended) ? endingCodas(ended) : null,
        record: (phase === "ended") ? serviceRecord(5) : null
      };
      if (extra) Object.assign(snap, extra);
      return snap;
    }

    // The standing line is the player's honours tutor: it names the rung in
    // reach (from the chapter's ladder data) and says plainly what the next
    // rung wants — a stronger showing (any public meter) or a bigger name
    // (only prestige will do) — plus the Lala's bar while it applies.
    function honoursStanding() {
      var p = S.prestige, c = S.contentment, h = honoursScore();
      var lead = HONOURS.lead || "Honours List &mdash; ";
      var debtBar = S.debt > ECON.debtWarn;
      function want(t) {
        var needsScore = h < t.score, needsName = p < t.prestige;
        if (needsScore && needsName) return "a stronger year all round, and a name to hang it on";
        if (needsScore) return "a stronger showing &mdash; order, revenue and contentment all count";
        return "more prestige; the Service must be able to picture you at the durbar";
      }
      var tier = ladderTier(false);
      if (tier) {
        var idx = HONOURS.ladder.indexOf(tier);
        if (debtBar && tier.barredByDebt)
          return lead + "the year has earned it and " + CREDITOR + " holds your paper; <b>nothing above a plain ribbon</b> until the debt is down";
        var line = lead + tier.reach;
        if (idx > 0) {
          var above = HONOURS.ladder[idx - 1];
          line += (debtBar && above.barredByDebt)
            ? "; nothing higher while " + CREDITOR + " holds your paper"
            : "; the next rung wants " + want(above);
        } else if (debtBar) line += " &mdash; with " + CREDITOR + " paid off";
        return line;
      }
      var bottom = HONOURS.ladder[HONOURS.ladder.length - 1];
      if (h >= 48 || p >= 48)
        return lead + "not yet on anyone's list; it wants " + want(bottom);
      if (c >= 65 && p < 50) return lead + "the district is content and Simla is not; the List rewards the seen, not the good";
      if (p >= 40) return lead + "unlikely on present form; the year reads thin in every column Simla audits";
      return lead + "your name appears only in the complaints";
    }

    function endKeyOf(obj) {
      var key = null;
      Object.keys(ENDINGS).forEach(function (k) { if (ENDINGS[k] === obj) key = k; });
      return key;
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
      current = resolveCurrent(data.currentId);
      return snapshot();
    }

    return {
      init: init, postureOptions: postureOptions, choosePosture: choosePosture,
      chooseOption: chooseOption, next: next,
      snapshot: function () { return snapshot(); },
      serialize: serialize, restore: restore,
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
