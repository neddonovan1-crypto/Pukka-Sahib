/* The first fortnight — prototype.

   Not wired into the build. `build.js` reads src/ and art/web/ only, so nothing
   here reaches the shipped game; this exists to be played and judged before any
   of it is committed to in logic.js.

   The loop, per docs/DESIGN-DESK.md: fourteen days, six to eight papers, and
   fourteen days will not clear them. You dispose by pressing a stamp, by
   pushing a stack onto somebody, or by closing a file unread. What you never
   reach stays on the desk and rots.                                        */
"use strict";

var F = window.FORTNIGHT;

var S = {
  days: F.days,
  inTray: F.docs.map(function (d) { return d.id; }),
  held: null,            // the paper in hand
  done: [],              // {id, stamp, line}
  rotted: [],            // never reached
  meters: { revenue: 52, order: 58, prestige: 46, contentment: 50, health: 64 },
  scene: "desk",         // desk | road | reckoning
  route: [],
  diary: [],
  delegating: false
};

function doc(id) {
  for (var i = 0; i < F.docs.length; i++) if (F.docs[i].id === id) return F.docs[i];
  return null;
}
function $(sel) { return document.querySelector(sel); }
function el(tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
function clamp(v) { return v < 0 ? 0 : v > 100 ? 100 : v; }

function spend(n) { S.days = Math.max(0, S.days - n); }

function applyDeltas(d) {
  if (!d) return;
  for (var k in d) if (S.meters[k] != null) S.meters[k] = clamp(S.meters[k] + d[k]);
}

/* ——— disposal ————————————————————————————————————————————————————— */

function dispose(id, stampId, cost) {
  var d = doc(id), out = d.outcomes[stampId];
  spend(cost);
  applyDeltas(out.d);
  S.done.push({ id: id, stamp: stampId, line: out.line, form: d.form, from: d.from });
  S.inTray = S.inTray.filter(function (x) { return x !== id; });
  S.held = null;
  paint();
}

function closeFile(id) {
  var d = doc(id);
  spend(1);
  applyDeltas({ contentment: -3 });
  S.done.push({ id: id, stamp: "closed", line: "Closed unread. Whatever it was, it is now settled.", form: d.form, from: d.from });
  S.inTray = S.inTray.filter(function (x) { return x !== id; });
  S.held = null;
  paint();
}

// Delegation costs no days at all. What it costs instead is control: the man
// you hand it to decides what comes back, and his standing decides how much of
// it is true.
function delegateTo(clerkId) {
  var clerk = null;
  F.clerks.forEach(function (c) { if (c.id === clerkId) clerk = c; });
  var take = S.inTray.slice(0, Math.min(3, S.inTray.length));
  take.forEach(function (id) {
    var d = doc(id), line, deltas;
    if (clerk.standing === "good") {
      line = clerk.name + " disposed of it properly, and told you so.";
      deltas = { order: 2, contentment: 1 };
    } else if (clerk.standing === "fair") {
      line = clerk.name + " disposed of it. You are not told how.";
      deltas = { order: 1, contentment: -1 };
    } else {
      line = clerk.name + " disposed of it. The figures that come back are very tidy.";
      deltas = { revenue: 3, contentment: -5, order: -2 };
    }
    applyDeltas(deltas);
    S.done.push({ id: id, stamp: "delegated", line: line, form: d.form, from: d.from });
  });
  S.inTray = S.inTray.slice(take.length);
  S.held = null;
  S.delegating = false;
  paint();
}

function endFortnight() {
  S.rotted = S.inTray.slice();
  // What rots costs you, and comes back worse. Here it only costs.
  S.rotted.forEach(function () { applyDeltas({ order: -2, contentment: -2, prestige: -1 }); });
  S.scene = "reckoning";
  paint();
}

/* ——— the road ————————————————————————————————————————————————————— */

function routeDays() {
  var n = 0;
  S.route.forEach(function (id) {
    F.road.stops.forEach(function (s) { if (s.id === id) n += s.days; });
  });
  return n;
}
function toggleStop(id) {
  if (S.route.indexOf(id) !== -1) S.route = S.route.filter(function (x) { return x !== id; });
  else S.route.push(id);
  paint();
}
function setOut() {
  var cost = routeDays();
  if (!cost || cost > S.days) return;
  spend(cost);
  S.route.forEach(function (id) {
    F.road.stops.forEach(function (s) {
      if (s.id === id) S.diary.push({ name: s.name, text: s.diary, art: s.art });
    });
  });
  // Going and seeing corrects what you believe, and costs you in the saddle.
  applyDeltas({ contentment: 6, prestige: 3, health: -4 });
  S.route = [];
  S.scene = "road-diary";
  paint();
}

/* ——— painting ————————————————————————————————————————————————————— */

var METERS = [
  ["revenue", "Revenue"], ["order", "Order"], ["prestige", "Prestige"],
  ["contentment", "Contentment"], ["health", "Health"]
];

function ledgerHtml() {
  return '<div class="ledger">' + METERS.map(function (m) {
    var v = S.meters[m[0]];
    return '<div class="gauge"><span class="gname">' + m[1] + '</span>' +
      '<span class="gbar"><i style="width:' + v + '%"></i></span>' +
      '<span class="gval">' + v + '</span></div>';
  }).join("") + '</div>';
}

function daysHtml() {
  var marks = "";
  for (var i = 0; i < F.days; i++) marks += '<i class="' + (i < S.days ? "" : "spent") + '"></i>';
  return '<div class="daybox"><div class="dlabel">Days remaining</div>' +
    '<div class="dmarks">' + marks + '</div>' +
    '<div class="dnum">' + S.days + ' <span>of ' + F.days + '</span></div></div>';
}

function docCard(d, inHand) {
  var cls = "paper paper--" + d.form + (inHand ? " inhand" : "");
  var n = el("div", cls);
  var stampFee = d.stampFee
    ? '<span class="feestamp"><img src="../../art/web/stamp-courtfee.png" alt="">' +
      '<b>Court Fee</b><em>' + d.stampFee + '</em></span>' : "";
  n.innerHTML =
    '<div class="phead"><span class="pfrom">' + d.from + '</span>' +
    '<span class="pref">' + d.ref + '</span></div>' +
    (d.urgent ? '<span class="urgent">Immediate</span>' : "") +
    (d.secret ? '<span class="secret">Confidential</span>' : "") +
    stampFee +
    '<div class="pbody">' + d.body + '</div>';
  return n;
}

function paintDesk() {
  var root = $("#app");
  root.className = "scene-desk season-" + F.season;
  root.innerHTML =
    '<div class="deskrail">' +
      '<div class="whoami"><b>' + F.station + '</b><span>' + F.rank + '</span>' +
      '<span class="szn">' + F.seasonLabel + ' · Fortnight ' + F.fortnight + ' · ' +
        F.dateFrom + '–' + F.dateTo + ' ' + F.year + '</span></div>' +
      daysHtml() + ledgerHtml() +
      '<button class="mapbtn" id="toRoad">' +
        '<span class="mlbl">The road</span>' +
        '<canvas id="minimap"></canvas>' +
        '<span class="mnote">' + (F.season === "cold" ? "Open" : "Shut") + '</span>' +
      '</button>' +
    '</div>' +
    '<div class="deskmain">' +
      '<div class="intray" id="intray"></div>' +
      '<div class="hand" id="hand"></div>' +
      '<div class="rack" id="rack"></div>' +
    '</div>';

  // the in-tray, as a pile of edges
  var tray = $("#intray");
  tray.appendChild(el("div", "traylbl", "In-tray &middot; " + S.inTray.length + " unread"));
  var stack = el("div", "stack");
  S.inTray.forEach(function (id, i) {
    var d = doc(id);
    var edge = el("button", "edge edge--" + d.form + (S.held === id ? " picked" : ""));
    edge.style.transform = "translateY(" + (i * -2) + "px) rotate(" + ((i % 3) - 1) * 0.5 + "deg)";
    edge.innerHTML = '<span>' + d.from + '</span>' + (d.urgent ? '<i class="dot"></i>' : "");
    edge.onclick = function () { S.held = id; paint(); };
    stack.appendChild(edge);
  });
  if (!S.inTray.length) stack.appendChild(el("div", "trayempty", "Cleared."));
  tray.appendChild(stack);

  var delg = el("button", "delegate", S.inTray.length ? "Delegate a stack" : "&mdash;");
  delg.disabled = !S.inTray.length;
  delg.onclick = function () { S.delegating = true; paint(); };
  tray.appendChild(delg);

  var fin = el("button", "endfn", S.days > 0 ? "Close the fortnight" : "The fortnight is out");
  fin.onclick = endFortnight;
  tray.appendChild(fin);

  var mini = $("#minimap");
  if (mini) {
    var mw = 232, mh = 150;
    mini.width = mw * 2; mini.height = mh * 2;
    mini.style.width = mw + "px"; mini.style.height = mh + "px";
    window.drawDistrict(mini, {
      seed: 20251115, compact: true,
      tehsils: F.road.stops.map(function (s) {
        return { id: s.id, name: s.name, days: s.days, x: s.mx, y: s.my, cond: s.cond };
      }),
      selected: []
    });
  }

  // the paper in hand
  var hand = $("#hand"), rack = $("#rack");
  if (!S.held) {
    hand.appendChild(el("div", "nothing", "Take a paper from the tray."));
    return;
  }
  var d = doc(S.held);
  hand.appendChild(docCard(d, true));

  // the rack: stamps, plus the acts this particular paper allows
  F.stamps.forEach(function (st) {
    if (!d.outcomes[st.id]) return;
    var b = el("button", "stamp", st.label + '<em>' + st.days + 'd</em>');
    b.disabled = S.days < st.days;
    b.onclick = function () { dispose(d.id, st.id, st.days); };
    rack.appendChild(b);
  });
  ["ride", "hear"].forEach(function (k) {
    if (!d[k]) return;
    var a = d[k];
    var b = el("button", "stamp stamp--act", a.label + '<em>' + a.days + 'd</em>');
    b.disabled = S.days < a.days;
    b.onclick = function () { dispose(d.id, k, a.days); };
    rack.appendChild(b);
  });
  var c = el("button", "stamp stamp--close", 'Close unread<em>1d</em>');
  c.disabled = S.days < 1;
  c.onclick = function () { closeFile(d.id); };
  rack.appendChild(c);
}

function paintDelegating() {
  var wrap = el("div", "modal");
  var box = el("div", "modalbox");
  box.appendChild(el("h3", null, "Hand it to whom?"));
  box.appendChild(el("p", "modalnote",
    "The top three papers. It costs you no days at all &mdash; only the knowing what became of them."));
  F.clerks.forEach(function (c) {
    var b = el("button", "clerk clerk--" + c.standing);
    b.innerHTML = '<b>' + c.name + '</b><span>' + c.post + '</span><em>' + c.note + '</em>';
    b.onclick = function () { delegateTo(c.id); };
    box.appendChild(b);
  });
  var x = el("button", "cancel", "Keep them");
  x.onclick = function () { S.delegating = false; paint(); };
  box.appendChild(x);
  wrap.appendChild(box);
  $("#app").appendChild(wrap);
}

function paintRoad() {
  var root = $("#app");
  root.className = "scene-road season-" + F.season;
  var cost = routeDays();
  root.innerHTML =
    '<div class="sky"></div><div class="land"></div>' +
    '<div class="roadwrap">' +
      '<div class="roadhead"><b>The cold weather tour</b><span>' + F.road.intro + '</span></div>' +
      '<div class="mapbig" id="mapbig"></div>' +
      '<div class="roadfoot">' +
        '<span class="cost">' + (cost ? cost + ' days of ' + S.days : 'Choose where to go') + '</span>' +
        '<button id="setout" class="setout"' + (!cost || cost > S.days ? " disabled" : "") + '>Set out</button>' +
        '<button id="backdesk" class="backdesk">Back to the desk</button>' +
      '</div>' +
    '</div>';

  var m = $("#mapbig");
  var cv = document.createElement("canvas");
  var wpx = Math.min(760, window.innerWidth - 60), hpx = Math.round(wpx * 0.60);
  cv.width = wpx * 2; cv.height = hpx * 2;
  cv.style.width = wpx + "px"; cv.style.height = hpx + "px";
  m.appendChild(cv);
  var marks = window.drawDistrict(cv, {
    seed: 20251115,
    tehsils: F.road.stops.map(function (s) {
      return { id: s.id, name: s.name, days: s.days, x: s.mx, y: s.my, cond: s.cond };
    }),
    selected: S.route,
    title: "CHHOTA NAGRA DISTRICT",
    sub: "SONEPORE DIVISION"
  });
  // hit targets over the plate, placed from the same coordinates it drew at
  marks.forEach(function (mk) {
    var b = document.createElement("button");
    b.className = "stophit" + (S.route.indexOf(mk.id) !== -1 ? " on" : "");
    b.style.left = mk.x + "px"; b.style.top = mk.y + "px";
    b.title = mk.id;
    b.onclick = function () { toggleStop(mk.id); };
    m.appendChild(b);
  });

  $("#setout").onclick = setOut;
  $("#backdesk").onclick = function () { S.scene = "desk"; paint(); };
}

function paintDiary() {
  var root = $("#app");
  root.className = "scene-road scene-diary season-" + F.season;
  var pages = S.diary.map(function (e) {
    return '<figure class="page">' +
      '<img src="../../art/web/' + e.art + '.jpg" alt="">' +
      '<figcaption><b>' + e.name + '</b><span class="penned">' + e.text + '</span></figcaption>' +
      '</figure>';
  }).join("");
  root.innerHTML =
    '<div class="sky"></div><div class="land"></div>' +
    '<div class="diarywrap">' +
      '<div class="diaryhead">Camp diary &mdash; ' + F.dateFrom + '–' + F.dateTo + ' ' + F.year + '</div>' +
      pages +
      '<button id="backdesk2" class="backdesk">Back to the desk</button>' +
    '</div>';
  $("#backdesk2").onclick = function () { S.scene = "desk"; paint(); };
}

function paintReckoning() {
  var root = $("#app");
  root.className = "scene-reck season-" + F.season;
  var rot = S.rotted.map(function (id) {
    var d = doc(id);
    return '<li><b>' + d.from + '</b> &mdash; ' + d.ref + '</li>';
  }).join("");
  var did = S.done.map(function (e) {
    return '<li><span class="st st--' + e.stamp + '">' + e.stamp + '</span> ' +
      '<b>' + e.from + '</b><br><span class="oline">' + e.line + '</span></li>';
  }).join("");
  root.innerHTML =
    '<div class="reck">' +
      '<h2>The fortnight is out</h2>' +
      '<div class="reckcols">' +
        '<div><h3>Disposed of &mdash; ' + S.done.length + '</h3><ul class="dlist">' + did + '</ul></div>' +
        '<div><h3>Left on the desk &mdash; ' + S.rotted.length + '</h3>' +
          (rot ? '<ul class="rlist">' + rot + '</ul>' +
            '<p class="rotnote">These do not go away. They will come back, and worse.</p>'
               : '<p class="rotnote">Nothing left. It will not happen again.</p>') +
        '</div>' +
      '</div>' +
      ledgerHtml() +
      '<button id="again" class="again">Begin the fortnight again</button>' +
    '</div>';
  $("#again").onclick = function () { location.reload(); };
}

function paint() {
  if (S.scene === "desk") { paintDesk(); if (S.delegating) paintDelegating(); }
  else if (S.scene === "road") paintRoad();
  else if (S.scene === "road-diary") paintDiary();
  else paintReckoning();
  var b = document.getElementById("toRoad");
  if (b) b.onclick = function () { S.scene = "road"; paint(); };
}

paint();
