/* Pukka Sahib — presentation. Reads snapshots from the headless logic and
   paints the DOM; every player action calls a logic transition and repaints.
   No game rules live here, and nothing here consumes rng. */
(function () {
  "use strict";
  var L = (typeof PukkaLogic !== "undefined") ? PukkaLogic : require("./logic.js");
  var content = JSON.parse(document.getElementById("game-data").textContent);
  var METERS = [
    { key: "revenue", name: "Revenue" }, { key: "order", name: "Order" },
    { key: "prestige", name: "Prestige" }, { key: "contentment", name: "Contentment" },
    { key: "composure", name: "Composure" }
  ];
  var game = L.createGame(content, Math.random);

  var el = function (id) { return document.getElementById(id); };

  function meterColour(v) { return v < 25 ? "var(--bad)" : v > 70 ? "var(--good)" : "var(--warn)"; }

  function renderMeters(meters, pulse) {
    var box = el("meters"); box.innerHTML = "";
    METERS.forEach(function (m) {
      var v = meters[m.key];
      var d = document.createElement("div");
      d.className = "meter" + (pulse && pulse.indexOf(m.key) !== -1 ? " pulse" : "");
      d.innerHTML =
        '<div class="name">' + m.name + '</div>' +
        '<div class="bar"><div class="fill" style="width:' + v + '%;background:' + meterColour(v) + '"></div></div>' +
        '<div class="val">' + v + '</div>';
      box.appendChild(d);
    });
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
      turnline(s, '<span class="stamp">' + s.season.glyph + " " + s.season.name + "</span>") +
      '<h3 class="cardtitle">How will you spend the fortnight?</h3>' +
      '<div class="body">' + s.season.intro + "</div>" +
      '<div class="choices"></div>';
    var box = c.querySelector(".choices");
    game.postureOptions().forEach(function (o) {
      var b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = o.label + '<span class="cue">' + o.note + "</span>";
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

  function renderEnding(s) {
    var c = el("card"); c.className = "card ending";
    c.innerHTML =
      '<div class="turnline"><span class="fortnight">The posting ends &mdash; fortnight ' +
      Math.min(s.turn, s.maxTurns) + '</span><span class="stamp">Closed</span></div>' +
      '<h2 class="cardtitle">' + s.ended.title + "</h2>" +
      '<div class="verdict">' + s.ended.text + "</div>" +
      '<div class="next" style="text-align:center"><button class="primary" id="again">Take up a new posting</button></div>';
    el("again").onclick = function () { paint(game.init()); };
  }

  function paint(s) {
    renderMeters(s.meters, s.pulsed);
    renderStatus(s);
    renderNotice(s);
    if (s.phase === "posture") renderPosture(s);
    else if (s.phase === "event") renderEvent(s);
    else if (s.phase === "resolved") renderResolved(s);
    else if (s.phase === "ended") renderEnding(s);
  }

  paint(game.init());
})();
