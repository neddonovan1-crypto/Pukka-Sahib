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
  delegating: false,
  stamping: false,
  rodeOut: false           // fourteen days and one of you: one ride a fortnight
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

// Set when a sheet has just landed in the out-tray, so the pile can be seen to
// take it rather than simply have it. Consumed by the next paint.
var fresh = false;

// Pressing a stamp is the act, so it has to land: the die comes out of the
// rack, comes down, the sheet takes the impression, and only then does it go
// to the tray. S.stamping holds the whole act — nothing else on the desk may
// be touched until the die is back in its place.
function dispose(id, stampId, cost, label, btn) {
  if (S.stamping) return;
  var d = doc(id), out = d.outcomes[stampId];

  function finish() {
    S.stamping = false;
    spend(cost);
    applyDeltas(out.d);
    S.done.push({ id: id, stamp: stampId, line: out.line, form: d.form, from: d.from });
    S.inTray = S.inTray.filter(function (x) { return x !== id; });
    S.held = null;
    fresh = true;
    paint();
  }

  var sheet = document.querySelector("#hand .paper");
  if (!sheet || !label || !btn) { finish(); return; }
  S.stamping = true;
  window.MOTION.strike({
    sheet: sheet,
    die: btn,
    pile: document.querySelector(".opile"),
    pad: document.getElementById("inkpad"),
    label: label,
    turn: (((id.length * 7) % 9) - 4) + "deg"
  }, finish);
}

function closeFile(id) {
  if (S.stamping) return;
  var d = doc(id);

  function finish() {
    S.stamping = false;
    spend(1);
    applyDeltas({ contentment: -3 });
    S.done.push({ id: id, stamp: "closed", line: "Closed unread. Whatever it was, it is now settled.", form: d.form, from: d.from });
    S.inTray = S.inTray.filter(function (x) { return x !== id; });
    S.held = null;
    fresh = true;
    paint();
  }

  // unread, but it still has to travel: it goes to the same tray
  var sheet = document.querySelector("#hand .paper");
  if (!sheet) { finish(); return; }
  S.stamping = true;
  window.MOTION.toTray(sheet, document.querySelector(".opile"), finish);
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
  S.rodeOut = true;
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
  var SC = (window.SCENES && window.SCENES["desk-" + F.season]) || F.scene;
  function box(r) {
    return 'left:' + (r.x * 100) + '%; top:' + (r.y * 100) + '%; ' +
           'width:' + (r.w * 100) + '%; height:' + (r.h * 100) + '%';
  }
  root.innerHTML =
    '<div class="room">' +
      '<img class="roomart" src="../../art/web/desk-' + F.season + '.jpg" alt="">' +
      '<div class="weather weather--' + F.season + '"><i></i><i></i><i></i></div>' +
      '<div class="onwall" style="' + box(SC.frame) + '">' +
        '<img class="wallmap" src="../../art/web/map-district.jpg" alt="">' +
        '<button class="wallbtn" id="toRoad" title="The road"></button></div>' +
      '<div class="onblotter" style="' + box(SC.blotter) + '"><div class="hand" id="hand"></div></div>' +
      '<div class="onrack' + (S.held ? " up" : "") + '" style="' + box(SC.rack || SC.blotter) + '">' +
        '<div class="rack" id="rack"></div></div>' +
      '<div class="ontray" style="' + box(SC.tray || SC.rack || SC.blotter) + '">' +
        '<div class="outtray" id="outtray"></div></div>' +
      window.MOTION.padArt(SC.rack) +
    '</div>' +
    '<div class="deskrail">' +
      '<div class="whoami"><b>' + F.station + '</b><span>' + F.rank + '</span>' +
      '<span class="szn">' + F.seasonLabel + ' · Fortnight ' + F.fortnight + ' · ' +
        F.dateFrom + '–' + F.dateTo + ' ' + F.year + '</span></div>' +
      daysHtml() + ledgerHtml() +
      '<div class="seasonnote">' + (F.season === "cold"
        ? "The road is open. The tents go out on the 17th."
        : "The road is shut this season.") + '</div>' +
    '</div>' +
    '<div class="deskmain">' +
      '<div class="tapewrap" id="tapewrap"><div class="tape"></div>' +
        '<div class="hangers" id="hangers"></div></div>' +

      '<div class="gloss" id="gloss"></div>' +
    '</div>';

  // The fortnight strung on red tape. Titles readable without opening anything;
  // what is left is still hanging there when the fortnight closes.
  var hang = $("#hangers");
  S.inTray.forEach(function (id, i) {
    var d = doc(id);
    var t = el("button", "hung hung--" + d.form + (S.held === id ? " down" : ""));
    t.style.setProperty("--lean", (((i * 37) % 5) - 2) * 0.6 + "deg");
    t.style.setProperty("--drop", (6 + ((i * 53) % 5) * 3) + "px");
    var age = d.age || 0;                      // fortnights it has hung there
    if (age) t.classList.add("aged", "aged--" + Math.min(3, age));
    t.setAttribute("data-id", id);
    t.innerHTML = '<i class="tie"></i><span class="ttl">' + d.from + '</span>' +
      (d.urgent ? '<i class="dot" title="Immediate"></i>' : "") +
      (age ? '<i class="age">' + age + '</i>' : "");
    // Taking one down and putting it back are the same journey either way, so
    // both are FLIPped: measure here, repaint, measure there, fly between.
    t.onclick = function () {
      if (S.stamping) return;
      if (S.held === id) putBack(id);
      else takeDown(id, t);
    };
    hang.appendChild(t);
  });
  if (!S.inTray.length) hang.appendChild(el("div", "trayempty", "The tape is empty."));

  var acts = el("div", "trayacts");
  var delg = el("button", "delegate", "Delegate a stack");
  delg.disabled = !S.inTray.length;
  delg.onclick = function () { if (S.stamping) return; S.delegating = true; paint(); };
  acts.appendChild(delg);
  var fin = el("button", "endfn", S.days > 0 ? "Close the fortnight" : "The fortnight is out");
  fin.onclick = function () { if (!S.stamping) endFortnight(); };
  acts.appendChild(fin);
  $("#tapewrap").appendChild(acts);

  // the out-tray, filling
  var out = $("#outtray");
  out.innerHTML = '<span class="olbl">Out-tray</span>';
  var pileEl = el("div", "opile" + (fresh ? " taking" : ""));
  var shown = S.done.slice(-9);
  shown.forEach(function (e, i) {
    var sh = el("div", "osheet osheet--" + e.form +
      (fresh && i === shown.length - 1 ? " fresh" : ""));
    sh.style.setProperty("--i", i);
    sh.title = e.from + " — " + e.stamp;
    pileEl.appendChild(sh);
  });
  fresh = false;         // only the sheet that just arrived is seen to arrive
  out.appendChild(pileEl);
  out.appendChild(el("span", "ocount", S.done.length ? S.done.length + " dispatched" : "empty"));

  // the paper in hand
  var hand = $("#hand"), rack = $("#rack");
  if (!S.held) {
    hand.appendChild(el("div", "nothing", "Take a paper down from the tape."));
    return;
  }
  var d = doc(S.held);
  hand.appendChild(docCard(d, true));

  // the rack: stamps, plus the acts this particular paper allows
  function stampBtn(label, days, cls, fn, means, off, die) {
    var b = el("button", "stamp " + (cls || "") + (off ? " spent" : ""));
    if (means) {
      b.onmouseenter = b.onfocus = function () { showGloss(label, means, days); };
      b.onmouseleave = b.onblur = function () { showGloss(null); };
    }
    var colour = cls === "stamp--act" ? "#2a3550" : cls === "stamp--close" ? "#5f5540" : "#8f2f22";
    // Dies stand in a rack, so they lean; the lean is declared rather than
    // inferred, because the flight out of the rack has to start from it.
    var lean = (rack.children.length % 2 ? 3.2 : -3.6);
    b.setAttribute("data-lean", lean);
    b.style.setProperty("--lean", lean + "deg");
    b.innerHTML = window.FURNITURE.stamp({ w: 92, label: label, colour: colour }) +
      '<em>' + days + 'd</em>';
    b.disabled = S.days < days || off;
    b.onclick = function () { fn(b); };
    rack.appendChild(b);
  }
  function showGloss(label, means, days) {
    var g = $("#gloss");
    if (!g) return;
    g.innerHTML = label
      ? '<b>' + label + '</b><em>' + days + ' day' + (days > 1 ? 's' : '') + '</em><span>' + means + '</span>'
      : "";
    g.className = "gloss" + (label ? " on" : "");
  }
  F.stamps.forEach(function (st) {
    if (!d.outcomes[st.id]) return;
    stampBtn(st.label, st.days, "", function (b) { dispose(d.id, st.id, st.days, st.label, b); }, st.means);
  });
  ["ride", "hear"].forEach(function (k) {
    if (!d[k]) return;
    var spent = k === "ride" && S.rodeOut;
    var means = k === "ride"
      ? (spent ? F.rideNote + " You have already been out." : "You go and see for yourself. " + F.rideNote)
      : "You hear it yourself, and the parties know you did.";
    stampBtn(d[k].label, d[k].days, "stamp--act", function (b) {
      if (k === "ride") S.rodeOut = true;
      dispose(d.id, k, d[k].days, d[k].label, b);
    }, means, spent);
  });
  stampBtn("Close unread", 1, "stamp--close", function () { closeFile(d.id); },
    "Binned without being read. A known small loss instead of an unknown larger one.",
    false, "Closed");
  var back = el("button", "putback", "Put it back on the tape");
  back.onclick = function () { if (!S.stamping) putBack(d.id); };
  rack.appendChild(back);
}

/* ——— the two journeys of a sheet ————————————————————————————————————
   The state change and paint() are handed to MOTION as a callback so the
   repaint still happens exactly where it always did — between the two
   measurements — and paint() remains the only thing that renders. */

function takeDown(id, hungEl) {
  window.MOTION.toBlotter(hungEl, function () {
    S.held = id;
    paint();
    return document.querySelector("#hand .paper");
  });
}

function putBack(id) {
  var sheet = document.querySelector("#hand .paper");
  if (!sheet) { S.held = null; paint(); return; }
  window.MOTION.toTape(sheet, function () {
    S.held = null;
    paint();
    return document.querySelector('.hung[data-id="' + id + '"]');
  });
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

  // The plate is the ground; the game's own marks go over it. Names are set in
  // type because the sheet was generated with every panel deliberately blank.
  var m = $("#mapbig");
  m.innerHTML = '<img class="plate" src="../../art/web/map-district.jpg" alt="">';
  var marks = [];
  F.road.stops.forEach(function (s) {
    var on = S.route.indexOf(s.id) !== -1;
    var pin = el("button", "pin" + (on ? " on" : ""));
    pin.style.left = (s.mx * 100) + "%";
    pin.style.top = (s.my * 100) + "%";
    pin.innerHTML = '<i class="hq"></i><span class="pname">' + s.name + '</span>' +
      '<span class="pdays">' + s.days + ' days</span>' +
      (on ? '<span class="pord">' + (S.route.indexOf(s.id) + 1) + '</span>' : "");
    pin.onclick = function () { toggleStop(s.id); };
    m.appendChild(pin);
    marks.push([s.mx, s.my, on]);
  });
  // the route, drawn between the stops in the order they were chosen
  if (S.route.length > 1) {
    var svg = '<svg class="routeline" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="';
    S.route.forEach(function (id, i) {
      var st = null;
      F.road.stops.forEach(function (s) { if (s.id === id) st = s; });
      svg += (i ? " L " : "M ") + (st.mx * 100) + " " + (st.my * 100);
    });
    svg += '"/></svg>';
    m.insertAdjacentHTML("beforeend", svg);
  }
  var cart = el("div", "cartouche");
  cart.innerHTML = '<b>Chhota Nagra District</b><span>Sonepore Division</span>';
  m.appendChild(cart);

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
  if (b) b.onclick = function () { if (S.stamping) return; S.scene = "road"; paint(); };
}

// The pad arrives after the first paint, if it arrives at all.
window.MOTION.padReady(function () { if (S.scene === "desk" && !S.stamping) paint(); });

paint();
