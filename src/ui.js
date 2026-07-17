/* Pukka Sahib — presentation. Reads snapshots from the headless logic and
   paints the DOM; every player action calls a logic transition and repaints.
   No game rules live here, and nothing here consumes rng. */
(function () {
  "use strict";
  var L = (typeof PukkaLogic !== "undefined") ? PukkaLogic : require("./logic.js");
  var content = JSON.parse(document.getElementById("game-data").textContent);
  // Meter names + legend glosses come from content (config.meters); fall back to
  // bare names if an older bundle lacks them.
  var METERS = (content.config.meters && content.config.meters.length)
    ? content.config.meters.map(function (m) { return { key: m.key, name: m.name, desc: m.desc }; })
    : [
        { key: "revenue", name: "Revenue" }, { key: "order", name: "Order" },
        { key: "prestige", name: "Prestige" }, { key: "contentment", name: "Contentment" },
        { key: "health", name: "Health" }
      ];
  var game = L.createGame(content, Math.random);

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

  // The legend: a tap/keyboard-reachable panel glossing the five meters, for
  // players who can't hover. Built once from content, toggled by its button.
  function buildLegend() {
    var btn = el("meterkey"), panel = el("legend");
    if (!btn || !panel) return;
    panel.innerHTML = METERS.map(function (m) {
      return '<li><b>' + m.name + '</b> &mdash; ' + (m.desc || "") + '</li>';
    }).join("");
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
      (s.debt > 0 ? ' &middot; <span class="debt">Debt to the Lala ' + L.rupees(s.debt) + "</span>" : "");
    el("economy").innerHTML = econ;
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
      b.onclick = function () { paint(game.choosePosture(o.kind)); };
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
      b.onclick = function () { paint(game.chooseOption(i)); };
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
    el("cont").onclick = function () { paint(game.next()); };
  }

  // The honours endings show their real insignia. CIE and KCIE are grades of
  // the Order of the Indian Empire (same badge); KCSI is the senior Star of India.
  var MEDAL = { "The C.I.E.": "medal-cie", "The K.C.I.E.": "medal-cie", "The K.C.S.I.": "medal-kcsi" };

  function renderEnding(s) {
    var c = el("card"); c.className = "card ending";
    var medalSrc = ART[MEDAL[s.ended.title]];
    var medalHtml = medalSrc ? '<img class="medal" src="' + medalSrc + '" alt="' + s.ended.title + ' insignia">' : "";
    var codasHtml = (s.codas && s.codas.length)
      ? '<div class="codas">' + s.codas.map(function (t) { return "<p>" + t + "</p>"; }).join("") + "</div>"
      : "";
    var recordHtml = "";
    if (s.record && s.record.length) {
      recordHtml =
        '<div class="record"><div class="record-head">Confidential character report</div><ul>' +
        s.record.map(function (r) {
          return '<li><span class="rec-when">Fortnight ' + r.turn + " &middot; " + r.month + "</span>" +
            '<span class="rec-what">' + r.title + "</span>" +
            '<span class="rec-did">' + r.label + "</span></li>";
        }).join("") + "</ul></div>";
    }
    c.innerHTML =
      '<div class="turnline"><span class="fortnight">The posting ends &mdash; fortnight ' +
      Math.min(s.turn, s.maxTurns) + '</span><span class="stamp">Closed</span></div>' +
      medalHtml +
      '<h2 class="cardtitle">' + s.ended.title + "</h2>" +
      '<div class="verdict">' + s.ended.text + "</div>" +
      codasHtml +
      recordHtml +
      '<div class="next" style="text-align:center"><button class="primary" id="again">Take up a new posting</button></div>';
    el("again").onclick = function () { clearSave(); paint(game.init()); };
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
    el("cont").onclick = function () { paint(game.next()); };
  }

  function paint(s) {
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
  var SAVE_KEY = "pukka-sahib-save", SAVE_VERSION = 1;
  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function persist() {
    var ls = store(); if (!ls) return;
    try { ls.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, data: game.serialize() })); } catch (e) {}
  }
  function clearSave() { var ls = store(); if (ls) try { ls.removeItem(SAVE_KEY); } catch (e) {} }
  function loadSave() {
    var ls = store(); if (!ls) return null;
    try {
      var raw = ls.getItem(SAVE_KEY); if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || obj.v !== SAVE_VERSION || !obj.data || !obj.data.S) { ls.removeItem(SAVE_KEY); return null; }
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
    var cont = el("cont") || el("again");
    if (cont && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); cont.click(); return; }
    if (/^[1-9]$/.test(ev.key)) {
      var choices = card.querySelectorAll(".choice:not([disabled])");
      var idx = parseInt(ev.key, 10) - 1;
      if (choices[idx]) { ev.preventDefault(); choices[idx].click(); }
    }
  });

  function showGame() { el("start").hidden = true; el("game").hidden = false; }

  function showStart(saved) {
    el("game").hidden = true;
    var st = el("start"); st.hidden = false;
    var cover = ART.cover ? '<img src="' + ART.cover + '" alt="A district officer looks out over the plains of his district">' : "";
    var resumeBtn = saved
      ? '<button class="primary" id="resume">Resume the posting &rarr;</button>' +
        '<button class="ghost" id="fresh">Begin a new posting</button>'
      : '<button class="primary" id="begin">Take up your posting &rarr;</button>';
    st.innerHTML =
      cover +
      '<div class="tagline">You are the newly-gazetted District Magistrate &amp; Collector of Chhota Nagra. ' +
      'Keep the peace. Bring in the revenue. And whatever else is lost, keep up appearances. ' +
      'You have a year. Survive the posting.</div>' +
      '<div class="start-actions">' + resumeBtn + "</div>";
    if (saved) {
      el("resume").onclick = function () { showGame(); paint(game.restore(saved)); };
      el("fresh").onclick = function () { clearSave(); showGame(); paint(game.init()); };
    } else {
      el("begin").onclick = function () { showGame(); paint(game.init()); };
    }
  }

  // The masthead crest: the engraved raster seal when the build carries it,
  // else the inline SVG fallback.
  if (ART.seal) {
    var crest = el("crest"), sealFallback = el("seal-fallback");
    if (crest) { crest.src = ART.seal; crest.hidden = false; }
    // style, not the hidden attribute — [hidden] does not reliably hide inline SVG
    if (sealFallback) sealFallback.style.display = "none";
  }

  buildLegend();

  // On load: a resumable save takes you to the start screen with a Resume
  // button; otherwise the cover screen if there's a cover, else straight in.
  var saved = loadSave();
  if (ART.cover || saved) showStart(saved);
  else { showGame(); paint(game.init()); }
})();
