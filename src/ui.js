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
    try {
      var raw = window.localStorage.getItem(CAREER_KEY);
      var c = raw ? JSON.parse(raw) : null;
      if (!c || c.v !== 1) c = null;
      return c || { v: 1, completions: {}, honours: [], history: [] };
    } catch (e) { return { v: 1, completions: {}, honours: [], history: [] }; }
  }
  function saveCareer() { try { window.localStorage.setItem(CAREER_KEY, JSON.stringify(career)); } catch (e) {} }
  var career = loadCareer();

  // The chapter to play: the first rank in the ladder the career has not yet
  // been promoted out of. (With one chapter shipped, that is the district.)
  function currentChapterKey() {
    // A promotion sets a one-shot #go-<chapter> hash before its reload, so the
    // handoff works even where localStorage is unavailable (private browsing).
    try {
      var hm = /^#go-(\w+)$/.exec(window.location.hash || "");
      if (hm && registry.chapters[hm[1]]) {
        try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e2) {}
        return hm[1];
      }
    } catch (e) {}
    // A quick-start override (Begin as a seasoned Collector) jumps straight to
    // the district — offered only once the apprentice year is completed.
    try {
      var qs = window.localStorage.getItem("pukka-sahib-quickstart");
      if (qs === "dm" && registry.chapters.dm && (career.completions.ac || 0) >= 1) return "dm";
      if (qs) window.localStorage.removeItem("pukka-sahib-quickstart");
    } catch (e) {}
    for (var i = 0; i < registry.order.length; i++) {
      var k = registry.order[i];
      var promotedOut = (career.history || []).some(function (h) { return h.chapter === k && h.promoted; });
      if (!promotedOut) return k;
    }
    return registry.order[registry.order.length - 1];
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

  // What the last promotion handed this chapter (career.carry, written by
  // recordCompletion when a promoting run closes): carried flags gate this
  // chapter's echo events and codas, carried meters adjust the start.
  var carryIn = (career.carry && career.carry.into === chapterKey) ? career.carry : null;
  function newRun() { return game.init(carryIn); }

  // Synthesised sitar/tanpura ambience (presentation only). Degrades to a no-op
  // stub when the module or Web Audio is absent.
  var noAudio = { supported: false, enabled: false, setEnabled: function () {}, season: function () {}, stamp: function () {}, ending: function () {} };
  var audio = (typeof PukkaAudio !== "undefined") ? PukkaAudio.create(content.config.audio) : noAudio;

  var el = function (id) { return document.getElementById(id); };

  function meterColour(v) { return v < 25 ? "var(--bad)" : v > 70 ? "var(--good)" : "var(--warn)"; }

  function stripTags(s) { return (s || "").replace(/<[^>]*>/g, ""); }
  function decode(s) {
    // entities → text for the native title tooltip (which shows raw text)
    var t = document.createElement("textarea"); t.innerHTML = s || ""; return t.value;
  }

  function renderMeters(meters, pulse) {
    var box = el("meters"); box.innerHTML = "";
    METERS.forEach(function (m) {
      var v = meters[m.key];
      var d = document.createElement("div");
      d.className = "meter" + (pulse && pulse.indexOf(m.key) !== -1 ? " pulse" : "");
      if (m.desc) d.title = m.name + " — " + decode(stripTags(m.desc)); // desktop hover
      d.innerHTML =
        '<div class="name">' + m.name + '</div>' +
        '<div class="bar"><div class="fill" style="width:' + v + '%;background:' + meterColour(v) + '"></div></div>' +
        '<div class="val">' + v + '</div>';
      box.appendChild(d);
    });
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
      b.className = "choice";
      var chips = deltaChips(o.effects, null);
      b.innerHTML = o.label + '<span class="cue">' + o.note + "</span>" +
        (chips ? '<span class="fore">' + chips + "</span>" : "");
      b.onclick = function () { audio.stamp(); paint(game.choosePosture(o.kind)); };
      box.appendChild(b);
    });
  }

  function renderEvent(s) {
    var e = s.event, c = el("card"); c.className = "card";
    var tag = e.tag || "District business";
    var stampCls = "stamp" + (L.isSecrecyTag(tag) ? " stamp--secret" : "");
    c.innerHTML =
      turnline(s, '<span class="' + stampCls + '">' + tag + "</span>") +
      '<h3 class="cardtitle">' + e.title + "</h3>" +
      '<div class="body">' + e.body + "</div>" +
      '<div class="choices"></div>';
    var box = c.querySelector(".choices");
    e.choices.forEach(function (ch, i) {
      var b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = ch.label;
      b.onclick = function () { audio.stamp(); paint(game.chooseOption(i)); };
      box.appendChild(b);
    });
  }

  function renderResolved(s) {
    var c = el("card");
    c.innerHTML +=
      '<div class="outcome">' + s.result.outcome + "</div>" +
      '<div class="deltas">' + deltaChips(s.result.effects, s.result.econ) + "</div>" +
      '<div class="next"><button class="primary" id="cont">Continue &rarr;</button></div>';
    var btns = c.querySelectorAll(".choice");
    for (var i = 0; i < btns.length; i++) { btns[i].disabled = true; btns[i].style.opacity = 0.5; btns[i].onclick = null; }
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
    // A promoting run hands its carries to the next rank (the logic computes
    // them from config.chapter.carryOut); a re-promotion overwrites the old set.
    if (s.promoted && s.chapter && s.chapter.promotesTo) {
      var co = game.carryOut();
      career.carry = co ? { into: s.chapter.promotesTo, flags: co.flags, meters: co.meters } : null;
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
    var e = s.event, c = el("card"); c.className = "card";
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
    if (s.season && s.season.key) audio.season(s.season.key);
    renderScene(s);
    renderMeters(s.meters, s.pulsed);
    renderStatus(s);
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
  var SAVE_KEY = "pukka-sahib-save", SAVE_VERSION = 2; // v2: chapter-tagged (pre-career saves are dropped)
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function persist() {
    var ls = store(); if (!ls) return;
    try { ls.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, chapter: chapterKey, data: game.serialize() })); } catch (e) {}
  }
  function clearSave() { var ls = store(); if (ls) try { ls.removeItem(SAVE_KEY); } catch (e) {} }
  function loadSave() {
    var ls = store(); if (!ls) return null;
    try {
      var raw = ls.getItem(SAVE_KEY); if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || obj.v !== SAVE_VERSION || !obj.data || !obj.data.S) { ls.removeItem(SAVE_KEY); return null; }
      if (obj.chapter && obj.chapter !== chapterKey) { ls.removeItem(SAVE_KEY); return null; } // a save from another rank
      if (obj.data.endedKey) { ls.removeItem(SAVE_KEY); return null; } // a finished posting is not resumable
      return obj.data;
    } catch (e) { try { ls.removeItem(SAVE_KEY); } catch (e2) {} return null; }
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
    return '<div class="service">' +
      '<div class="record-head">Record of service</div>' +
      '<div class="service-line">' + (meta.rank || "") + (meta.posting ? " &middot; " + meta.posting : "") + "</div>" +
      '<div class="service-line">' + career.history.length + " posting" + (career.history.length === 1 ? "" : "s") + " served" +
      (honours.length ? " &middot; " + honours.join(" &middot; ") : " &middot; no honours yet gazetted") + "</div>" +
      "</div>";
  }

  // The career ladder: the whole shape of the game, on the start screen — the
  // ranks in playing order (from the registry, plus the ranks yet to be
  // written), what each plays for, and where this career stands on it.
  function careerLadderHtml() {
    var roman = ["I", "II", "III", "IV", "V"];
    var rows = registry.order.map(function (k, i) {
      var meta = registry.chapters[k].config.chapter || {};
      var promotedOut = (career.history || []).some(function (h) { return h.chapter === k && h.promoted; });
      var state = k === chapterKey ? "here" : promotedOut ? "done" : "next";
      var mark = state === "here" ? " &mdash; <b>you are here</b>" : state === "done" ? " &mdash; served ✓" : "";
      return '<div class="rung rung--' + state + '">' +
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

  // Quick start: once the career has been through the apprentice year at least
  // once, a seasoned-Collector start is always on offer.
  function quickstartAvailable() {
    return chapterKey !== "dm" && !!registry.chapters.dm && (career.completions.ac || 0) >= 1;
  }

  function showStart(saved) {
    el("game").hidden = true;
    var st = el("start"); st.hidden = false;
    var cover = ART.cover ? '<img src="' + ART.cover + '" alt="A district officer looks out over the plains of his district">' : "";
    var resumeBtn = saved
      ? '<button class="primary" id="resume">Resume the posting &rarr;</button>' +
        '<button class="ghost" id="fresh">Begin a new posting</button>'
      : '<button class="primary" id="begin">Take up your posting &rarr;</button>';
    if (quickstartAvailable()) resumeBtn += '<button class="ghost" id="quickdm">Begin as a seasoned Collector</button>';
    var tagline = (content.config.chapter && content.config.chapter.tagline) ||
      'You are the newly-gazetted District Magistrate &amp; Collector of Chhota Nagra. ' +
      'Keep the peace. Bring in the revenue. And whatever else is lost, keep up appearances. ' +
      'You have a year. Survive the posting.';
    st.innerHTML =
      cover +
      '<div class="tagline">' + tagline + "</div>" +
      careerLadderHtml() +
      serviceRecordHtml() +
      '<div class="start-actions">' + resumeBtn + "</div>";
    if (saved) {
      el("resume").onclick = function () { showGame(); paint(game.restore(saved)); };
      el("fresh").onclick = function () { clearSave(); showGame(); paint(newRun()); };
    } else {
      el("begin").onclick = function () { showGame(); paint(newRun()); };
    }
    var qd = el("quickdm");
    if (qd) qd.onclick = function () {
      try { window.localStorage.setItem("pukka-sahib-quickstart", "dm"); } catch (e) {}
      location.reload();
    };
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
