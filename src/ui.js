/* Pukka Sahib — presentation. Reads snapshots from the headless logic and
   paints the DOM; every player action calls a logic transition and repaints.
   No game rules live here, and nothing here consumes rng. */
(function () {
  "use strict";
  var L = (typeof PukkaLogic !== "undefined") ? PukkaLogic : require("./logic.js");
  // The inlined data is the chapter registry: { chapters: {key: bundle}, order }.
  var registry = JSON.parse(document.getElementById("game-data").textContent);

  /* ---------- the career record (versioned localStorage) ---------- */
  var CAREER_KEY = "pukka-sahib-career";
  function loadCareer() {
    var blank = { v: 1, completions: {}, honours: [], history: [], carries: {}, codasSeen: {} };
    try {
      var raw = window.localStorage.getItem(CAREER_KEY);
      var c = raw ? JSON.parse(raw) : null;
      if (!c || c.v !== 1) c = null;
      if (!c) return blank;
      // Migrate the single carry slot to per-target carries, so replaying an
      // earlier rank can never clobber a later chapter's inheritance.
      if (!c.carries) c.carries = {};
      if (!c.codasSeen) c.codasSeen = {}; // the Gazette's coda ledger (added later)
      if (c.carry && c.carry.into) {
        if (!c.carries[c.carry.into]) c.carries[c.carry.into] = { flags: c.carry.flags || [], meters: c.carry.meters || {} };
        delete c.carry;
      }
      return c;
    } catch (e) { return blank; }
  }
  function saveCareer() { try { window.localStorage.setItem(CAREER_KEY, JSON.stringify(career)); } catch (e) {} }
  var career = loadCareer();

  // The rank the career has reached: the first rung not yet promoted out of.
  function naturalChapterKey() {
    for (var i = 0; i < registry.order.length; i++) {
      var k = registry.order[i];
      var promotedOut = (career.history || []).some(function (h) { return h.chapter === k && h.promoted; });
      if (!promotedOut) return k;
    }
    return registry.order[registry.order.length - 1];
  }
  // A rank is playable from the start screen if it is the career's current
  // rung, has been served at least once, or sits directly above a served rank
  // (the old seasoned-Collector jump, generalised).
  function chapterPlayable(k) {
    if (!registry.chapters[k]) return false;
    if (k === naturalChapterKey()) return true;
    if ((career.completions[k] || 0) >= 1) return true;
    var i = registry.order.indexOf(k);
    return i > 0 && (career.completions[registry.order[i - 1]] || 0) >= 1;
  }
  // The chapter to play: a promotion hash wins (one-shot, works without
  // storage), then a picked rung from the start screen, then the career.
  function currentChapterKey() {
    try {
      var hm = /^#go-(\w+)$/.exec(window.location.hash || "");
      if (hm && registry.chapters[hm[1]]) {
        try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e2) {}
        try { window.localStorage.removeItem("pukka-sahib-quickstart"); } catch (e3) {} // the promotion outranks any picked rung
        return hm[1];
      }
    } catch (e) {}
    try {
      var qs = window.localStorage.getItem("pukka-sahib-quickstart");
      if (qs && chapterPlayable(qs)) return qs;
      if (qs) window.localStorage.removeItem("pukka-sahib-quickstart");
    } catch (e) {}
    return naturalChapterKey();
  }
  var chapterKey = currentChapterKey();
  var content = registry.chapters[chapterKey];

  // Meter names + legend glosses come from the chapter (config.meters).
  var METERS = (content.config.meters && content.config.meters.length)
    ? content.config.meters.map(function (m) { return { key: m.key, name: m.name, desc: m.desc }; })
    : [
        { key: "revenue", name: "Revenue" }, { key: "order", name: "Order" },
        { key: "prestige", name: "Prestige" }, { key: "contentment", name: "Contentment" },
        { key: "health", name: "Health" }
      ];
  var game = L.createGame(content, Math.random);

  // What the last promotion handed this chapter (career.carries[chapter],
  // written by recordCompletion when a promoting run closes): carried flags
  // gate this chapter's echo events and codas, carried meters adjust the start.
  var carryIn = career.carries[chapterKey] || null;
  function newRun() { return game.init(carryIn); }

  // Synthesised sitar/tanpura ambience (presentation only). Degrades to a no-op
  // stub when the module or Web Audio is absent.
  var noAudio = { supported: false, enabled: false, setEnabled: function () {}, season: function () {}, stamp: function () {}, ending: function () {} };
  var audio = (typeof PukkaAudio !== "undefined") ? PukkaAudio.create(content.config.audio) : noAudio;

  var el = function (id) { return document.getElementById(id); };

  function meterColour(v) { return v < 25 ? "var(--bad)" : v > 70 ? "var(--good)" : "var(--warn)"; }
  var METER_FLOORS = L.METER_FLOORS || {};

  function stripTags(s) { return (s || "").replace(/<[^>]*>/g, ""); }
  function decode(s) {
    // entities → text for the native title tooltip (which shows raw text)
    var t = document.createElement("textarea"); t.innerHTML = s || ""; return t.value;
  }

  function renderMeters(meters, pulse, deltas) {
    var box = el("meters"); box.innerHTML = "";
    METERS.forEach(function (m) {
      var v = meters[m.key];
      var floor = METER_FLOORS[m.key];
      var hasFloor = typeof floor === "number";
      var danger = hasFloor && v <= floor;
      var dl = deltas ? (deltas[m.key] || 0) : 0;
      var d = document.createElement("div");
      d.className = "meter" + (pulse && pulse.indexOf(m.key) !== -1 ? " pulse" : "") + (danger ? " danger" : "");
      if (m.desc) d.title = m.name + " — " + decode(stripTags(m.desc)); // desktop hover
      var floorMark = hasFloor ? '<div class="floor" style="left:' + floor + '%"></div>' : "";
      var trend = dl ? '<span class="trend">' + (dl > 0 ? "▲" : "▼") + Math.abs(dl) + "</span>" : "";
      d.innerHTML =
        '<div class="name">' + m.name + '</div>' +
        '<div class="bar">' + floorMark + '<div class="fill" style="width:' + v + '%;background:' + (danger ? "var(--bad)" : meterColour(v)) + '"></div></div>' +
        '<div class="val">' + v + trend + '</div>';
      box.appendChild(d);
    });
  }

  // The sticky mobile strip: the five meters in compact form (danger-aware),
  // pinned at the top of the phone view while the full panel scrolls away.
  function renderMeterStrip(meters) {
    var box = el("meterstrip"); if (!box) return;
    box.innerHTML = METERS.map(function (m) {
      var v = meters[m.key];
      var floor = METER_FLOORS[m.key];
      var danger = (typeof floor === "number") && v <= floor;
      return '<div class="ms-cell' + (danger ? " danger" : "") + '">' +
        '<div class="ms-name">' + m.name.slice(0, 3) + "</div>" +
        '<div class="ms-val">' + v + "</div></div>";
    }).join("");
  }

  // The legend: a tap/keyboard-reachable panel glossing the five meters — and
  // the money, whose rules (interest, the settlement, the honours bar, the
  // ceiling) are otherwise invisible until they bite. Built once from content.
  function buildLegend() {
    var btn = el("meterkey"), panel = el("legend");
    if (!btn || !panel) return;
    panel.innerHTML = METERS.map(function (m) {
      return '<li><b>' + m.name + '</b> &mdash; ' + (m.desc || "") + '</li>';
    }).join("");
    var ec = content.config.economy;
    if (ec && ec.desc) panel.innerHTML += '<li><b>Treasury &amp; debt</b> &mdash; ' + ec.desc + "</li>";
    // The honours gloss states the exact bars, generated from the ladder data
    // itself so a retune can never leave this stale — plus the year-end
    // verdict floors, read from the same constants the engine judges by.
    var ho = content.config.honours;
    if (ho && ho.desc) {
      var bars = (ho.ladder || []).slice().reverse().map(function (t) {
        return "<b>" + (t.name || t.key) + "</b> wants a showing of " + t.score + " and Prestige " + t.prestige +
          (t.barredByDebt && content.config.economy ? " (debt under " + L.rupees(content.config.economy.debtWarn) + ")" : "");
      });
      var V = L.VERDICT || { floor: 40, nativeContentment: 65, nativePrestige: 50 };
      panel.innerHTML += '<li><b>The honours line</b> &mdash; ' + ho.desc +
        " The bars: " + bars.join("; ") + ". Short of every bar, the year ends in a transfer. " +
        "And whatever the showing: finish with Prestige or Order under " + V.floor +
        " and the year is a scandal; Contentment at " + V.nativeContentment +
        " or more with Prestige under " + V.nativePrestige + " reads as gone native.</li>";
    }
    btn.setAttribute("aria-expanded", "false");
    btn.onclick = function () {
      var open = panel.hasAttribute("hidden") ? false : true;
      if (open) { panel.setAttribute("hidden", "hidden"); btn.setAttribute("aria-expanded", "false"); }
      else { panel.removeAttribute("hidden"); btn.setAttribute("aria-expanded", "true"); }
    };
  }

  function renderStatus(s) {
    el("honours").innerHTML = s.honours;
    var econ = "Treasury " + L.rupees(s.treasury) +
      (s.debt > 0 ? ' &middot; <span class="debt">Debt to ' + ((content.config.economy && content.config.economy.creditor) || "the Lala") + ' ' + L.rupees(s.debt) + "</span>" : "");
    el("economy").innerHTML = econ;
    if (content.config.economy && content.config.economy.desc)
      el("economy").title = decode(stripTags(content.config.economy.desc)); // hover gloss; the legend has it too
    var se = s.season;
    el("seasonband").innerHTML =
      '<span class="glyph">' + se.glyph + "</span> <b>" + se.name + "</b> &middot; " + s.month + " &mdash; " + se.tagline;
  }

  // Where you stand with the chapter's recurring people. Hidden until at least
  // one relationship is made; each figure reads green (won) or oxblood (crossed).
  function renderStandings(s) {
    var box = el("standings"); if (!box) return;
    var list = s.standings || [];
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = '<div class="standings-head">The district remembers</div>' +
      list.map(function (m) {
        return '<div class="standing ' + m.state + '">' +
          '<span class="nm">' + m.name + "</span> " +
          '<span class="who">' + m.who + "</span> &mdash; " +
          '<span class="st">' + m.note + "</span></div>";
      }).join("");
  }

  // The year strip: the whole posting laid out as a calendar above the card —
  // a tick per fortnight washed in its season's colour, the cursor on the
  // current fortnight, and the fixed occasions ahead as little seals. Read from
  // the chapter's calendar and occasions; only the cursor comes from the run.
  var CAL_SEASONS = (content.config.calendar && content.config.calendar.seasons) || [];
  function seasonAt(t) {
    for (var i = 0; i < CAL_SEASONS.length; i++) if (t >= CAL_SEASONS[i].from && t <= CAL_SEASONS[i].to) return CAL_SEASONS[i];
    return CAL_SEASONS[CAL_SEASONS.length - 1] || { key: "cold" };
  }
  var OCC_BY_TURN = {};
  (content.occasions || []).forEach(function (o) { OCC_BY_TURN[o.turn] = o; });
  function renderYearStrip(s) {
    var box = el("yearstrip"); if (!box) return;
    if (!CAL_SEASONS.length || s.phase === "ended") { box.hidden = true; return; }
    var ticks = [];
    for (var t = 1; t <= s.maxTurns; t++) {
      var se = seasonAt(t) || {};
      var o = OCC_BY_TURN[t];
      var cls = "yr-tick season-" + (se.key || "cold") + (t < s.turn ? " past" : "") + (t === s.turn ? " now" : "");
      var seal = o ? '<span class="yr-seal' + (t < s.turn ? " past" : "") + '" title="' + decode(stripTags(o.title)) + ' (' + o.tag + ')"></span>' : "";
      ticks.push('<span class="' + cls + '">' + seal + "</span>");
    }
    box.innerHTML = '<div class="yr-track">' + ticks.join("") + "</div>";
    box.hidden = false;
  }

  function renderNotice(s) {
    var n = el("notice");
    if (s.notice) { n.innerHTML = s.notice; n.hidden = false; }
    else { n.innerHTML = ""; n.hidden = true; }
  }

  function turnline(s, stampHtml) {
    return '<div class="turnline">' +
      '<span class="fortnight">Fortnight ' + s.turn + " of " + s.maxTurns + " &middot; " + s.month + "</span>" +
      stampHtml + "</div>";
  }

  function deltaChips(effects, econ) {
    var chips = Object.keys(effects || {}).map(function (k) {
      var nm = METERS.filter(function (m) { return m.key === k; })[0].name;
      var v = effects[k];
      return '<span class="delta ' + (v >= 0 ? "up" : "down") + '">' + nm + " " + (v > 0 ? "+" : "") + v + "</span>";
    });
    if (econ && econ.treasury) chips.push('<span class="delta ' + (econ.treasury >= 0 ? "up" : "down") + '">Treasury ' + (econ.treasury > 0 ? "+" : "") + L.rupees(econ.treasury) + "</span>");
    if (econ && econ.debt) chips.push('<span class="delta down">Debt +' + L.rupees(econ.debt) + "</span>");
    return chips.join("");
  }

  function renderPosture(s) {
    var c = el("card"); c.className = "card";
    c.innerHTML =
      turnline(s, '<span class="seasontag">' + s.season.glyph + " " + s.season.name + "</span>") +
      '<h3 class="cardtitle">How will you spend the fortnight?</h3>' +
      '<div class="body">' + s.seasonIntro + "</div>" +
      '<div class="choices"></div>';
    var box = c.querySelector(".choices");
    game.postureOptions().forEach(function (o) {
      var b = document.createElement("button");
      b.className = "choice" + (o.project ? " choice--works" : "");
      var chips = deltaChips(o.effects, o.econ); // works carry a cost chip, not meter chips
      b.innerHTML = o.label + '<span class="cue">' + o.note + "</span>" +
        (chips ? '<span class="fore">' + chips + "</span>" : "");
      b.onclick = function () { audio.stamp(); paint(game.choosePosture(o.kind)); };
      box.appendChild(b);
    });
  }

  // Document theatre: dress the card as the paper it is. Secrecy tags get the
  // confidential-file treatment (the stamp already reads); wires get the
  // telegraph form. Unknown tags keep the plain despatch card.
  var TELEGRAM_TAGS = { "TELEGRAM": 1, "IMMEDIATE": 1, "URGENT": 1 };
  function docClass(tag) {
    var t = (tag || "").toUpperCase();
    if (L.isSecrecyTag(t)) return " card--secret";
    if (TELEGRAM_TAGS[t]) return " card--telegram";
    return "";
  }

  function renderEvent(s) {
    var e = s.event, c = el("card"); c.className = "card" + docClass(e.tag);
    var tag = e.tag || "District business";
    var stampCls = "stamp" + (L.isSecrecyTag(tag) ? " stamp--secret" : "");
    c.innerHTML =
      turnline(s, '<span class="' + stampCls + '">' + tag + "</span>") +
      '<h3 class="cardtitle">' + e.title + "</h3>" +
      (s.step && s.stepLead ? '<div class="steplead">' + s.stepLead + "</div>" : "") +
      '<div class="body">' + e.body + "</div>" +
      (s.consult ? '<div class="consult" id="consult"></div>' : "") +
      '<div class="choices"></div>';
    if (s.consult) renderConsult(s.consult);
    var box = c.querySelector(".choices");
    e.choices.forEach(function (ch, i) {
      var b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = ch.label;
      b.onclick = function () {
        chosenIdx = i; chosenStamp = ch.stampWord || "Ordered"; // the verdict stamped on the file
        audio.stamp(); paint(game.chooseOption(i));
      };
      box.appendChild(b);
    });
  }
  // Which option was just chosen, and the word stamped across it (set at click,
  // read when the resolved card paints — the snapshot has no event by then).
  var chosenIdx = null, chosenStamp = "Ordered";

  // The consult affordance: before consulting, a quiet "Ask …" control; after,
  // the adviser's opinion as a marginal note with any small cost it carried.
  function renderConsult(co) {
    var box = el("consult"); if (!box) return;
    if (co.available) {
      var b = document.createElement("button");
      b.className = "consult-ask"; b.type = "button";
      b.innerHTML = "Ask " + co.who + "&hellip;";
      b.onclick = function () { audio.stamp(); paint(game.consult()); };
      box.appendChild(b);
    } else {
      var chips = deltaChips(co.effects, co.econ);
      box.innerHTML =
        '<div class="consult-note">' +
        '<div class="consult-who">' + co.who + (co.tag ? " &middot; " + co.tag : "") + "</div>" +
        '<div class="consult-op">' + co.opinion + "</div>" +
        (chips ? '<div class="deltas">' + chips + "</div>" : "") +
        "</div>";
    }
  }

  function renderResolved(s) {
    var c = el("card");
    c.innerHTML +=
      '<div class="outcome slidein">' + s.result.outcome + "</div>" +
      '<div class="deltas">' + deltaChips(s.result.effects, s.result.econ) + "</div>" +
      '<div class="next"><button class="primary" id="cont">Continue &rarr;</button></div>';
    var btns = c.querySelectorAll(".choice");
    for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; btns[i].style.opacity = 0.5; btns[i].onclick = null; }
    // Stamp the chosen option with its inked verdict — the decision made an act
    // of government, not a button press.
    if (chosenIdx != null && btns[chosenIdx]) {
      btns[chosenIdx].style.opacity = 1;
      var st = document.createElement("span");
      st.className = "verdict-stamp"; st.textContent = chosenStamp;
      btns[chosenIdx].appendChild(st);
      btns[chosenIdx].classList.add("stamped");
    }
    var ask = c.querySelector(".consult-ask"); // the fortnight is decided; no asking now
    if (ask) { ask.disabled = true; ask.onclick = null; }
    el("cont").onclick = function () { audio.stamp(); paint(game.next()); };
  }

  // Close the run into the career record: the posting, its verdict, any honour
  // (a ladder-tier ending), and whether it promoted.
  function recordCompletion(s) {
    career.completions[chapterKey] = (career.completions[chapterKey] || 0) + 1;
    career.history.push({ chapter: chapterKey, ending: s.endedKey, title: s.ended.title, promoted: !!s.promoted });
    var ladder = (content.config.honours && content.config.honours.ladder) || [];
    if (ladder.some(function (t) { return t.key === s.endedKey; }))
      career.honours.push({ chapter: chapterKey, key: s.endedKey, title: s.ended.title });
    // The Gazette's coda ledger: every arc-sentence this year turned up is
    // recorded (by its headline) so the collection persists across postings.
    if (s.codas && s.codas.length) {
      if (!career.codasSeen[chapterKey]) career.codasSeen[chapterKey] = {};
      s.codas.forEach(function (c) { career.codasSeen[chapterKey][c.head] = true; });
    }
    // A promoting run hands its carries to the next rank (the logic computes
    // them from config.chapter.carryOut); a re-promotion overwrites that
    // target's set and no other's.
    if (s.promoted && s.chapter && s.chapter.promotesTo) {
      var co = game.carryOut();
      if (co) career.carries[s.chapter.promotesTo] = { flags: co.flags, meters: co.meters };
      else delete career.carries[s.chapter.promotesTo];
    }
    saveCareer();
  }

  function renderEnding(s) {
    var c = el("card"); c.className = "card ending";
    recordCompletion(s);
    var medalSrc = s.ended.medal ? ART[s.ended.medal] : null;
    var medalHtml = medalSrc ? '<img class="medal" src="' + medalSrc + '" alt="' + s.ended.title + ' insignia">' : "";
    var codasHtml = (s.codas && s.codas.length)
      ? '<div class="record"><div class="record-head">The year, off the record</div>' +
        s.codas.map(function (c) {
          return '<details class="rec"><summary><span class="rec-what">' + c.head + "</span></summary>" +
            '<div class="rec-body"><div class="rec-out">' + c.text + "</div></div></details>";
        }).join("") + "</div>"
      : "";
    var recordHtml = "";
    if (s.record && s.record.length) {
      recordHtml =
        '<div class="record"><div class="record-head">Confidential character report</div>' +
        s.record.map(function (r) {
          return '<details class="rec"><summary>' +
            '<span class="rec-when">Fortnight ' + r.turn + " &middot; " + r.month + "</span>" +
            '<span class="rec-what">' + r.title + "</span></summary>" +
            '<div class="rec-body"><div class="rec-did">' + r.label + "</div>" +
            (r.outcome ? '<div class="rec-out">' + r.outcome + "</div>" : "") +
            "</div></details>";
        }).join("") + "</div>";
    }
    // The disposition strip: no ending may leave the career's next step
    // ambiguous. Promotion names the next rank; anything else says plainly
    // that the year must be served again.
    var nextKey = s.chapter && s.chapter.promotesTo;
    var nextMeta = nextKey && registry.chapters[nextKey] && registry.chapters[nextKey].config.chapter;
    var dispositionHtml = "";
    if (nextMeta) {
      dispositionHtml = '<div class="disposition ' + (s.promoted ? "disposition--up" : "disposition--again") + '">' +
        (s.promoted
          ? "<b>Promoted.</b> Your next despatches are written as " + nextMeta.rank + (nextMeta.posting ? ", " + nextMeta.posting : "") + "."
          : (s.chapter.repeatNote || "The year must be served again.")) +
        "</div>";
    }
    c.innerHTML =
      '<div class="turnline"><span class="fortnight">The posting ends &mdash; fortnight ' +
      Math.min(s.turn, s.maxTurns) + '</span><span class="stamp">Closed</span></div>' +
      medalHtml +
      '<h2 class="cardtitle">' + s.ended.title + "</h2>" +
      dispositionHtml +
      '<div class="verdict">' + s.ended.text + "</div>" +
      codasHtml +
      recordHtml +
      '<div class="next" style="text-align:center"><button class="primary" id="again">' +
      (s.promoted && s.chapter && s.chapter.promotesTo && registry.chapters[s.chapter.promotesTo]
        ? "Take up your promotion &rarr;" : "Take up a new posting") +
      "</button></div>";
    var tiers = (content.config.honours && content.config.honours.ladder) || [];
    audio.ending(s.endedKey, s.promoted || tiers.some(function (t) { return t.key === s.endedKey; }));
    el("again").onclick = function () {
      clearSave();
      // A promotion moves the career to the next chapter's bundle; reload so the
      // module re-derives its chapter from the record. The URL hash carries the
      // promotion too, so it survives even where localStorage does not (private
      // browsing). Otherwise, same posting again.
      if (s.promoted && s.chapter && s.chapter.promotesTo && registry.chapters[s.chapter.promotesTo]) {
        try { location.hash = "go-" + s.chapter.promotesTo; } catch (e) {}
        location.reload();
      } else paint(newRun());
    };
  }

  // Art manifest (data URIs in the single-file build, paths on Pages, absent if
  // no art). The UI degrades cleanly to no imagery when a key is missing.
  var ART = (typeof window !== "undefined" && window.PUKKA_ART) || {};

  // Station backdrops shown when the sahib holds the cutcherry (desk posture).
  var DESK_SCENES = ["scene-cutcherry", "scene-club", "scene-city"];

  // Pick the banner: an event's explicit `art` wins. Otherwise the backdrop
  // follows where you are for the fortnight — out in camp on tour (the season
  // banners: camp, station, flood), or about the station on desk (cutcherry,
  // club, city). The posture-choice screen keeps the season view. Each set
  // rotates by the fortnight so the scene changes through a run; unknown keys
  // fall back to the season banner (or no image).
  function bannerKey(s) {
    if (s.event && s.event.art && ART[s.event.art]) return s.event.art;
    var chosen = (s.phase === "event" || s.phase === "interlude" || s.phase === "resolved");
    if (chosen && s.posture === "desk") {
      var desk = DESK_SCENES.filter(function (k) { return ART[k]; });
      if (desk.length) return desk[(s.turn - 1) % desk.length];
    }
    var base = "season-" + s.season.key;
    var variants = Object.keys(ART).filter(function (k) { return k === base || k.indexOf(base + "-") === 0; }).sort();
    if (!variants.length) return base;
    return variants[(s.turn - 1) % variants.length];
  }
  function renderScene(s) {
    var img = el("scene");
    if (!img) return;
    var key = bannerKey(s);
    var src = ART[key];
    if (src) {
      if (img.getAttribute("data-key") !== key) { img.src = src; img.setAttribute("data-key", key); }
      img.hidden = false;
    } else {
      img.hidden = true;
    }
  }

  // A no-choice occurrence: flavour, any small effect already applied, and Continue.
  function renderInterlude(s) {
    var e = s.event, c = el("card"); c.className = "card" + docClass(e.tag);
    var tag = e.tag || "District business";
    var stampCls = "stamp" + (L.isSecrecyTag(tag) ? " stamp--secret" : "");
    var deltas = deltaChips(s.result.effects, s.result.econ);
    c.innerHTML =
      turnline(s, '<span class="' + stampCls + '">' + tag + "</span>") +
      '<h3 class="cardtitle">' + e.title + "</h3>" +
      '<div class="body">' + e.body + "</div>" +
      (s.result.outcome ? '<div class="outcome">' + s.result.outcome + "</div>" : "") +
      (deltas ? '<div class="deltas">' + deltas + "</div>" : "") +
      '<div class="next"><button class="primary" id="cont">Continue &rarr;</button></div>';
    el("cont").onclick = function () { audio.stamp(); paint(game.next()); };
  }

  function paint(s) {
    if (s.season && s.season.key) {
      audio.season(s.season.key);
      try { document.documentElement.setAttribute("data-season", s.season.key); } catch (e) {} // the season washes the whole page
    }
    renderScene(s);
    renderMeters(s.meters, s.pulsed, s.deltas);
    renderMeterStrip(s.meters);
    renderStatus(s);
    renderStandings(s);
    renderYearStrip(s);
    renderNotice(s);
    if (s.phase === "posture") renderPosture(s);
    else if (s.phase === "event") renderEvent(s);
    else if (s.phase === "interlude") renderInterlude(s);
    else if (s.phase === "resolved") renderResolved(s);
    else if (s.phase === "ended") renderEnding(s);
    // Persist at clean, fully-repaintable phases; a finished run clears its save.
    // "resolved" is skipped (it appends to the event card and can't stand alone
    // on a cold load), so a save there keeps the pre-choice event to resume to.
    if (s.phase === "ended") clearSave();
    else if (s.phase !== "resolved") persist();
  }

  /* ---------- save / resume (versioned localStorage) ---------- */
  // One save slot per chapter, so picking another rung from the start screen
  // never touches a posting in progress elsewhere on the ladder.
  var SAVE_PREFIX = "pukka-sahib-save", SAVE_VERSION = 2; // v2: chapter-tagged (pre-career saves are dropped)
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function saveSlot(k) { return SAVE_PREFIX + "-" + k; }
  // Migrate the legacy single slot into its chapter's slot.
  (function () {
    var ls = store(); if (!ls) return;
    try {
      var raw = ls.getItem(SAVE_PREFIX); if (!raw) return;
      var obj = JSON.parse(raw);
      if (obj && obj.v === SAVE_VERSION && obj.chapter && obj.data && !ls.getItem(saveSlot(obj.chapter)))
        ls.setItem(saveSlot(obj.chapter), raw);
      ls.removeItem(SAVE_PREFIX);
    } catch (e) { try { ls.removeItem(SAVE_PREFIX); } catch (e2) {} }
  })();
  function persist() {
    var ls = store(); if (!ls) return;
    try { ls.setItem(saveSlot(chapterKey), JSON.stringify({ v: SAVE_VERSION, chapter: chapterKey, data: game.serialize() })); } catch (e) {}
  }
  function clearSave() { var ls = store(); if (ls) try { ls.removeItem(saveSlot(chapterKey)); } catch (e) {} }
  function loadSave() {
    var ls = store(); if (!ls) return null;
    var key = saveSlot(chapterKey);
    try {
      var raw = ls.getItem(key); if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || obj.v !== SAVE_VERSION || !obj.data || !obj.data.S) { ls.removeItem(key); return null; }
      if (obj.chapter && obj.chapter !== chapterKey) { ls.removeItem(key); return null; } // a save from another rank
      if (obj.data.endedKey) { ls.removeItem(key); return null; } // a finished posting is not resumable
      return obj.data;
    } catch (e) { try { ls.removeItem(key); } catch (e2) {} return null; }
  }
  // Whether another rung holds a resumable posting (for the ladder's notes).
  function saveExistsFor(k) {
    var ls = store(); if (!ls) return false;
    try {
      var obj = JSON.parse(ls.getItem(saveSlot(k)) || "null");
      return !!(obj && obj.v === SAVE_VERSION && obj.data && obj.data.S && !obj.data.endedKey);
    } catch (e) { return false; }
  }

  // Keyboard: number keys pick the visible choices; Enter/Space advance a
  // Continue or the ending's "new posting". Ignored on the start screen.
  document.addEventListener("keydown", function (ev) {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var g = el("game"); if (!g || g.hidden) return;
    var card = el("card"); if (!card) return;
    // Let a focused report row toggle itself — don't steal its Enter/Space.
    if (ev.target && ev.target.tagName === "SUMMARY") return;
    var cont = el("cont") || el("again");
    if (cont && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); cont.click(); return; }
    if (ev.key === "0") { // 0 asks the adviser, when one is on offer
      var ask = card.querySelector(".consult-ask:not([disabled])");
      if (ask) { ev.preventDefault(); ask.click(); }
      return;
    }
    if (/^[1-9]$/.test(ev.key)) {
      var choices = card.querySelectorAll(".choice:not([disabled])");
      var idx = parseInt(ev.key, 10) - 1;
      if (choices[idx]) { ev.preventDefault(); choices[idx].click(); }
    }
  });

  function showGame() { el("start").hidden = true; el("game").hidden = false; }

  // The service record: the career so far, shown on the start screen once
  // there is one — rank held, postings served, honours gazetted.
  function serviceRecordHtml() {
    if (!career.history.length) return "";
    var honours = career.honours.map(function (h) { return h.title; });
    var meta = content.config.chapter || {};
    // The latest verdicts, most recent first — so "what did I just get?"
    // is always answerable from the start screen.
    var lately = career.history.slice(-3).reverse().map(function (h) { return h.title; });
    return '<div class="service">' +
      '<div class="record-head">Record of service</div>' +
      '<div class="service-line">' + (meta.rank || "") + (meta.posting ? " &middot; " + meta.posting : "") + "</div>" +
      '<div class="service-line">' + career.history.length + " posting" + (career.history.length === 1 ? "" : "s") + " served" +
      (honours.length ? " &middot; " + honours.join(" &middot; ") : " &middot; no honours yet gazetted") + "</div>" +
      '<div class="service-line">Lately: ' + lately.join(" &middot; ") + "</div>" +
      "</div>";
  }

  // The career ladder: the whole shape of the game, on the start screen — the
  // ranks in playing order (from the registry, plus the ranks yet to be
  // written), what each plays for, and where this career stands on it. Every
  // playable rung is a picker: served ranks can be taken up again, and the
  // rank above a served one is open (the seasoned-Collector jump, generalised).
  function careerLadderHtml() {
    var roman = ["I", "II", "III", "IV", "V"];
    var rows = registry.order.map(function (k, i) {
      var meta = registry.chapters[k].config.chapter || {};
      var promotedOut = (career.history || []).some(function (h) { return h.chapter === k && h.promoted; });
      var served = promotedOut || (career.completions[k] || 0) >= 1;
      var pickable = k !== chapterKey && chapterPlayable(k);
      var state = k === chapterKey ? "here" : served ? "done" : "next";
      var mark = state === "here" ? " &mdash; <b>you are here</b>"
        : served ? " &mdash; served ✓" + (pickable ? " &middot; <u>take it up again</u>" : "")
        : pickable ? " &mdash; <u>open to you</u>" : "";
      if (pickable && saveExistsFor(k)) mark += " &middot; a posting in progress";
      return '<div class="rung rung--' + state + (pickable ? " rung--pick" : "") + '"' +
        (pickable ? ' data-go="' + k + '" role="button" tabindex="0"' : "") + ">" +
        '<span class="rung-rank">' + roman[i] + ". " + (meta.rank || k) + "</span>" +
        (meta.plays ? '<span class="rung-plays">plays for ' + meta.plays + mark + "</span>" : "") +
        "</div>";
    });
    (registry.planned || []).forEach(function (pl, j) {
      rows.push('<div class="rung rung--planned">' +
        '<span class="rung-rank">' + roman[registry.order.length + j] + ". " + pl.rank + "</span>" +
        '<span class="rung-plays">plays for ' + pl.plays + " &mdash; to come</span></div>");
    });
    return '<div class="ladder"><div class="record-head">The career</div>' + rows.join("") + "</div>";
  }

  // Picking a rung: remember the choice and reload — the module re-derives its
  // chapter on boot. Each chapter keeps its own save slot, so nothing is lost.
  function wireLadderPicker(root) {
    var rungs = root.querySelectorAll(".rung[data-go]");
    for (var i = 0; i < rungs.length; i++) {
      (function (node) {
        function go() {
          try { window.localStorage.setItem("pukka-sahib-quickstart", node.getAttribute("data-go")); } catch (e) {}
          location.reload();
        }
        node.onclick = go;
        node.onkeydown = function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } };
      })(rungs[i]);
    }
  }

  // The Gazette: the career's collection — honours won, fates witnessed, and
  // the codas discovered — read from the persistent career record. A pure view;
  // no game state. Undiscovered codas show as ruled blanks: the sheet to fill.
  function gazetteHtml() {
    var romans = ["I", "II", "III", "IV", "V"];
    var anySeen = (career.history || []).length > 0;
    var sections = registry.order.map(function (k, i) {
      var ch = registry.chapters[k];
      var meta = ch.config.chapter || {};
      var endings = ch.endings || {};
      var totalFates = Object.keys(endings).length;
      var seenFates = {};
      (career.history || []).forEach(function (h) {
        if (h.chapter === k && h.ending && endings[h.ending]) seenFates[h.ending] = endings[h.ending].title;
      });
      var honours = (career.honours || []).filter(function (h) { return h.chapter === k; });
      var allCodas = ch.codas || [];
      var seenC = (career.codasSeen && career.codasSeen[k]) || {};
      var nCodas = allCodas.filter(function (c) { return seenC[c.head]; }).length;

      var honHtml = honours.length
        ? honours.map(function (h) { return '<span class="gz-medal">' + h.title + "</span>"; }).join("")
        : '<span class="gz-none">no honours yet gazetted</span>';
      var fateKeys = Object.keys(seenFates);
      var fatesHtml = fateKeys.length
        ? fateKeys.map(function (ek) { return "<li>" + seenFates[ek] + "</li>"; }).join("")
        : '<li class="gz-none">no fate yet recorded</li>';
      var codaHtml = allCodas.map(function (c) {
        return seenC[c.head]
          ? '<details class="rec"><summary><span class="rec-what">' + c.head + "</span></summary>" +
            '<div class="rec-body"><div class="rec-out">' + c.text + "</div></div></details>"
          : '<div class="gz-blank" aria-hidden="true"></div>';
      }).join("");

      return '<section class="gz-rank">' +
        '<div class="gz-rank-head">' + romans[i] + ". " + (meta.rank || k) + "</div>" +
        '<div class="gz-cabinet">' + honHtml + "</div>" +
        '<div class="gz-sub">Fates witnessed &mdash; ' + fateKeys.length + " of " + totalFates + "</div>" +
        '<ul class="gz-fates">' + fatesHtml + "</ul>" +
        '<div class="gz-sub">The year remembered &mdash; ' + nCodas + " of " + allCodas.length + " recorded</div>" +
        '<div class="gz-codas">' + codaHtml + "</div>" +
        "</section>";
    });
    return '<div class="gazette">' +
      '<div class="gz-masthead"><div class="record-head">The Gazette of India</div>' +
      '<div class="gz-strap">Honours, fates, and the years remembered</div></div>' +
      (anySeen ? "" : '<div class="gz-empty">The sheet is blank. Serve a posting to its close, and the Gazette begins to fill.</div>') +
      sections.join("") +
      '<div class="start-actions"><button class="ghost" id="gz-back">&larr; Back</button></div></div>';
  }
  function showGazette(saved) {
    el("game").hidden = true;
    var st = el("start"); st.hidden = false;
    st.innerHTML = gazetteHtml();
    var back = el("gz-back");
    if (back) back.onclick = function () { showStart(saved); };
  }

  function showStart(saved) {
    el("game").hidden = true;
    var st = el("start"); st.hidden = false;
    var cover = ART.cover ? '<img src="' + ART.cover + '" alt="A district officer looks out over the plains of his district">' : "";
    var resumeBtn = saved
      ? '<button class="primary" id="resume">Resume the posting &rarr;</button>' +
        '<button class="ghost" id="fresh">Begin a new posting</button>'
      : '<button class="primary" id="begin">Take up your posting &rarr;</button>';
    var tagline = (content.config.chapter && content.config.chapter.tagline) ||
      'You are the newly-gazetted District Magistrate &amp; Collector of Chhota Nagra. ' +
      'Keep the peace. Bring in the revenue. And whatever else is lost, keep up appearances. ' +
      'You have a year. Survive the posting.';
    st.innerHTML =
      cover +
      '<div class="tagline">' + tagline + "</div>" +
      careerLadderHtml() +
      serviceRecordHtml() +
      '<div class="start-actions">' + resumeBtn +
      '<button class="ghost" id="gazette-open">The Gazette &rarr;</button></div>';
    if (saved) {
      el("resume").onclick = function () { showGame(); paint(game.restore(saved)); };
      el("fresh").onclick = function () { clearSave(); showGame(); paint(newRun()); };
    } else {
      el("begin").onclick = function () { showGame(); paint(newRun()); };
    }
    var gz = el("gazette-open");
    if (gz) gz.onclick = function () { showGazette(saved); };
    wireLadderPicker(st);
  }

  // The masthead subtitle follows the chapter: whose despatches these are.
  (function () {
    var sub = el("mastsub"), meta = content.config.chapter;
    if (sub && meta && meta.rank) sub.innerHTML = "Private despatches of the " + meta.rank + ", " + (meta.posting || "");
  })();

  // The masthead crest: the engraved raster seal when the build carries it,
  // else the inline SVG fallback.
  if (ART.seal) {
    var crest = el("crest"), sealFallback = el("seal-fallback");
    if (crest) { crest.src = ART.seal; crest.hidden = false; }
    // style, not the hidden attribute — [hidden] does not reliably hide inline SVG
    if (sealFallback) sealFallback.style.display = "none";
  }

  // Audio toggle: a speaker button in the masthead. Preference persists; the
  // browser only lets sound start inside a gesture, so a remembered "on" starts
  // at the first tap/keypress rather than on load.
  var AUDIO_KEY = "pukka-sahib-audio";
  function loadAudioPref() { try { return window.localStorage.getItem(AUDIO_KEY) === "on"; } catch (e) { return false; } }
  function saveAudioPref(on) { try { window.localStorage.setItem(AUDIO_KEY, on ? "on" : "off"); } catch (e) {} }
  function wireAudio() {
    var b = el("audiotoggle"); if (!b) return;
    if (!audio.supported) { b.hidden = true; return; }
    var want = loadAudioPref();
    function sync() {
      var on = audio.enabled || want;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("aria-label", on ? "Sound on" : "Sound off");
      b.title = on ? "Sound on" : "Sound off";
      b.classList.toggle("off", !on);
    }
    sync();
    if (want) { // satisfy autoplay: start at the first genuine gesture
      var once = function () {
        if (want && !audio.enabled) audio.setEnabled(true);
        document.removeEventListener("pointerdown", once); document.removeEventListener("keydown", once);
        sync();
      };
      document.addEventListener("pointerdown", once, { passive: true });
      document.addEventListener("keydown", once);
    }
    b.onclick = function () {
      want = !(audio.enabled || want);
      audio.setEnabled(want); // the click is the gesture
      saveAudioPref(want);
      sync();
    };
  }

  buildLegend();
  wireAudio();

  // On load: a resumable save takes you to the start screen with a Resume
  // button; otherwise the cover screen if there's a cover, else straight in.
  var saved = loadSave();
  if (ART.cover || saved) showStart(saved);
  else { showGame(); paint(newRun()); }
})();
