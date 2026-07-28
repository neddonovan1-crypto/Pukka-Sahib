/* motion.js — the choreography of the desk.

   Everything here only decorates a transition that has already been decided.
   The state changes and paint() repaints exactly as they did before; these
   routines fly a *copy* of the object over the top of the room while that
   happens, so the room can be rebuilt underneath without the player seeing a
   cut. Nothing in here may become the source of truth: if a step is skipped —
   reduced motion, a missing element, art that does not exist yet — the same
   end state must arrive immediately.

   The rule the whole file is tuned against: weight comes from asymmetric
   easing, not from duration. Slow out of the rack, fast down onto the paper,
   a hard stop on contact, a slower return.                                 */
"use strict";
window.MOTION = (function () {

  /* The pad is art that has not been drawn yet. A file:// page cannot be asked
     whether a plate exists without logging a failed request, so the plate is
     named here and only fetched once it is actually on disk — put the path
     back the day obj-inkpad.png lands, and everything below wakes up. The load
     is still verified: a named but missing plate disables the pad and the
     detour with it, in silence. */
  var PAD_SRC = window.DESK_INKPAD || "";   /* "../../art/web/obj-inkpad.png" */
  var padOk = false, padWait = null;
  if (PAD_SRC) {
    var im = new Image();
    im.onload = function () {
      padOk = im.naturalWidth > 0;
      if (padOk && padWait) padWait();
    };
    im.onerror = function () { padOk = false; };
    im.src = PAD_SRC;
  }
  function padReady(cb) { padWait = cb; }

  var mq = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(mq && mq.matches); }

  function rect(n) { return n && n.getBoundingClientRect ? n.getBoundingClientRect() : null; }
  function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : d; }

  /* ——— copies in the air ———————————————————————————————————————————
     A fixed-position clone laid exactly over where the real thing sits now.
     Only one is ever in the air; a second request removes the first rather
     than leaving a stray sheet hanging over the room. */
  var inAir = null;
  function ghost(node, r, cls) {
    if (inAir && inAir.parentNode) inAir.parentNode.removeChild(inAir);
    var g = document.createElement("div");
    g.className = "flier" + (cls ? " " + cls : "");
    g.style.left = r.left + "px";
    g.style.top = r.top + "px";
    g.style.width = r.width + "px";
    g.style.height = r.height + "px";
    g.appendChild(node.cloneNode(true));
    document.body.appendChild(g);
    inAir = g;
    return g;
  }
  function drop(g) {
    if (g && g.parentNode) g.parentNode.removeChild(g);
    if (inAir === g) inAir = null;
  }

  /* ——— easings ——————————————————————————————————————————————————————
     Named so the sequences below read as description rather than numbers. */
  var LIFT   = "cubic-bezier(.42,0,.32,1)";     // reluctant, then away
  var CARRY  = "cubic-bezier(.4,.02,.28,1)";    // a hand crossing the desk
  var FALL   = "cubic-bezier(.6,0,.95,.4)";     // accelerating onto the paper
  var STOP   = "cubic-bezier(.25,0,.45,1)";     // the squash, all front
  var AWAY   = "cubic-bezier(.16,.78,.34,1)";   // peels off quickly, eases out
  var HOME   = "cubic-bezier(.38,.04,.24,1)";   // slower going back
  var SETTLE = "cubic-bezier(.22,1.28,.36,1)";  // arrives past its mark

  /* ——— a paper coming down off the tape ————————————————————————————
     FLIP: measure the tab where it hangs, let the caller change state and
     repaint, measure the sheet where it landed, animate between the two. The
     room is responsive, so nothing here may be a hard-coded coordinate. */
  function toBlotter(hungEl, commit) {
    var from = rect(hungEl);
    var g = (reduced() || !from) ? null : ghost(hungEl, from, "tab");
    var paper = commit();
    if (!g) return;
    var to = rect(paper);
    if (!to || !to.width) { drop(g); return; }

    // the tie lets go first — everything else follows from that
    var tie = g.querySelector(".tie");
    if (tie) {
      tie.style.transformOrigin = "0% 50%";
      tie.animate([{ transform: "scaleX(1)", opacity: 1 },
                   { transform: "scaleX(.1)", opacity: 0 }],
                  { duration: 120, easing: "cubic-bezier(.5,0,1,.55)", fill: "forwards" });
    }

    var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    var s = Math.max(1.1, Math.min(2.2, to.width * 0.42 / from.width));
    var TRAVEL = 340;

    var a = g.animate([
      { offset: 0, opacity: 1, easing: "cubic-bezier(.5,0,.7,.6)",
        transform: "translate(0,0) rotate(0deg) scale(1)" },
      // it drops off the tape and swings out before it goes anywhere
      { offset: .18, opacity: 1, easing: CARRY,
        transform: "translate(" + (dx * .04) + "px," + (dy * .07 + 9) + "px) rotate(-4deg) scale(1.03)" },
      // bowed above the straight line: carried over the desk, not dragged
      { offset: .62, opacity: 1, easing: "cubic-bezier(.3,0,.3,1)",
        transform: "translate(" + (dx * .62) + "px," + (dy * .5 - 22) + "px) rotate(-1.5deg) scale(" + (1 + (s - 1) * .55) + ")" },
      { offset: 1, opacity: 0,
        transform: "translate(" + dx + "px," + dy + "px) rotate(1.4deg) scale(" + s + ")" }
    ], { duration: TRAVEL, fill: "forwards" });
    a.onfinish = function () { drop(g); };

    // the sheet itself takes over before the copy is gone, so the two read as
    // one object arriving rather than a hand-off
    paper.classList.add("flown");
    paper.style.opacity = "0";
    window.setTimeout(function () {
      if (!paper.parentNode) return;
      paper.style.opacity = "";
      paper.animate([
        { transform: "translate(" + (-dx * .16) + "px," + (-dy * .13) + "px) rotate(3deg) scale(.9)" },
        { transform: "translate(0,0) rotate(-.4deg) scale(1)" }
      ], { duration: 300, easing: SETTLE, fill: "backwards" });
      paper.animate([{ opacity: 0 }, { opacity: 1 }],
                    { duration: 130, easing: "linear", fill: "backwards" });
    }, TRAVEL * .58);
  }

  /* ——— and going back onto it ————————————————————————————————————— */
  function toTape(paper, commit) {
    var from = rect(paper);
    var g = (reduced() || !from) ? null : ghost(paper, from, "sheet");
    var hungEl = commit();
    if (!g) return;
    var to = rect(hungEl);
    if (!to || !to.width) { drop(g); return; }

    var dx = (to.left + to.width / 2) - (from.left + from.width / 2);
    var dy = (to.top + to.height / 2) - (from.top + from.height / 2);
    var s = Math.max(.12, to.width / from.width);

    var a = g.animate([
      { offset: 0, opacity: 1, easing: "cubic-bezier(.4,0,.3,1)",
        transform: "translate(0,0) rotate(-.4deg) scale(1)" },
      { offset: .55, opacity: 1, easing: CARRY,
        transform: "translate(" + (dx * .55) + "px," + (dy * .48 - 18) + "px) rotate(-3deg) scale(" + (s + (1 - s) * .42) + ")" },
      { offset: 1, opacity: 0,
        transform: "translate(" + dx + "px," + dy + "px) rotate(1deg) scale(" + s + ")" }
    ], { duration: 300, fill: "forwards" });
    a.onfinish = function () { drop(g); };

    // the tab swings back onto the tape and the tie draws taut again
    hungEl.style.opacity = "0";
    window.setTimeout(function () {
      if (!hungEl.parentNode) return;
      hungEl.style.opacity = "";
      hungEl.animate([
        { transform: "translate(" + (-dx * .1) + "px," + (-dy * .08) + "px) rotate(-7deg) scale(1.06)", opacity: 0 },
        { transform: "none", opacity: 1 }
      ], { duration: 260, easing: SETTLE, fill: "backwards" });
      var tie = hungEl.querySelector(".tie");
      if (tie) {
        tie.style.transformOrigin = "0% 50%";
        tie.animate([{ transform: "scaleX(.1)", opacity: 0 }, { transform: "scaleX(1)", opacity: 1 }],
                    { duration: 200, easing: SETTLE, fill: "backwards" });
      }
    }, 175);
  }

  /* ——— the sheet leaving for the out-tray ————————————————————————— */
  function toTray(paper, pile, done) {
    var from = rect(paper), to = rect(pile);
    if (reduced() || !from || !from.width) { done(); return; }
    var dx, dy, s;
    if (to && to.width) {
      dx = (to.left + to.width / 2) - (from.left + from.width / 2);
      dy = (to.top + 10) - (from.top + from.height / 2);
      s = Math.max(.12, Math.min(.6, to.width / from.width));
    } else {                                   // no tray on screen: shove it off
      dx = from.width * .38; dy = from.height * .3; s = .7;
    }
    paper.classList.add("flown");
    var a = paper.animate([
      { offset: 0, opacity: 1, easing: "cubic-bezier(.5,0,.5,1)",
        transform: "translate(0,0) rotate(-.4deg) scale(1)" },
      { offset: .42, opacity: 1, easing: "cubic-bezier(.35,0,.2,1)",
        transform: "translate(" + (dx * .44) + "px," + (dy * .36 - 16) + "px) rotate(3deg) scale(" + (1 - (1 - s) * .4) + ")" },
      { offset: .8, opacity: .92, easing: "linear",
        transform: "translate(" + (dx * .9) + "px," + (dy * .88) + "px) rotate(-1.5deg) scale(" + (s + (1 - s) * .12) + ")" },
      { offset: 1, opacity: 0,
        transform: "translate(" + dx + "px," + dy + "px) rotate(-3.4deg) scale(" + s + ")" }
    ], { duration: 330, fill: "forwards" });
    a.onfinish = done;
    a.oncancel = done;
  }

  var strikes = 0;
  function bumps() { return ++strikes; }

  /* ——— pressing a stamp ————————————————————————————————————————————
     One act: the die comes out of the rack, crosses to the sheet, lands, and
     goes back. The mark is appended at the instant of contact and not before,
     and the sheet starts for the tray while the die is still on its way home
     — two hands, one job.                                                  */
  function strike(o, done) {
    var sheet = o.sheet, die = o.die;

    function mark() {
      if (!sheet || !sheet.parentNode) return;
      var m = document.createElement("span");
      m.className = "struckmark";
      m.textContent = o.label;
      if (o.turn) m.style.setProperty("--turn", o.turn);
      sheet.appendChild(m);
    }

    if (reduced() || !sheet || !die) { mark(); done(); return; }

    /* Where the rubber actually is inside the button: the die face sits at the
       foot of the drawing, and it is the face — not the box — that must land
       on the paper and stay put under rotation and scale. */
    var dr = rect(die);
    var art = die.querySelector("svg");
    var ar = art ? rect(art) : dr;
    var fx = ar.left + ar.width / 2 - dr.left;
    var fy = ar.top + ar.height * .94 - dr.top;
    // it leaves from — and returns to — the lean it is actually standing at,
    // which a hovering pointer has already half corrected
    var hovered = die.matches && die.matches(":hover");
    var lean = num(parseFloat(die.getAttribute("data-lean")), 0) * (hovered ? .35 : 1);

    var pr = rect(sheet);
    var hit = { x: pr.left + pr.width * .5, y: pr.top + pr.height * .52 };
    var pad = padOk ? o.pad : null;
    var padr = pad ? rect(pad) : null;
    var charge = padr && (bumps() % 3 === 0);

    function T(x, y, rot, sx, sy) {
      return "translate(" + (x - dr.left - fx).toFixed(1) + "px," +
             (y - dr.top - fy).toFixed(1) + "px) rotate(" + rot + "deg) scale(" +
             sx + "," + (sy == null ? sx : sy) + ")";
    }
    var rest = { x: dr.left + fx, y: dr.top + fy };
    function sh(y, blur, a) {
      return "drop-shadow(0 " + y + "px " + blur + "px rgba(0,0,0," + a + "))";
    }

    /* the sequence, in milliseconds — the easing on each step governs the
       interval that follows it */
    /* The die grows as it comes forward: the rack sits back on the desk and
       the sheet is under the player's nose, and a die that made a mark this
       size would be a good deal bigger than the one standing in the rack. */
    var UP = 1.55, ON = 2.9;

    var k = [];
    k.push([0, T(rest.x, rest.y, lean, 1), sh(3, 4, .55), LIFT]);
    k.push([150, T(rest.x, rest.y - 44, lean * .2, UP), sh(19, 14, .45), CARRY]);
    if (charge) {
      var px = padr.left + padr.width * .5, py = padr.top + padr.height * .46;
      k.push([275, T(px, py - 40, -2, 2.3), sh(22, 16, .4), FALL]);
      k.push([330, T(px, py, 0, 2.3), sh(5, 6, .6), STOP]);
      k.push([356, T(px, py + 3, 0, 2.3, 2.24), sh(4, 5, .62), AWAY]);
      k.push([410, T(px, py - 48, 2.4, 2.35), sh(20, 15, .42), CARRY]);
      k.push([560, T(hit.x, hit.y - 92, -1.6, ON), sh(26, 18, .4), FALL]);
      k.push([625, T(hit.x, hit.y, 0, ON), sh(5, 7, .62), STOP]);
      k.push([652, T(hit.x, hit.y + 3, 0, ON, ON * .975), sh(4, 5, .64), AWAY]);
      k.push([700, T(hit.x, hit.y, 0, ON), sh(6, 8, .6), AWAY]);
      k.push([805, T(hit.x, hit.y - 104, 3.5, ON * .97), sh(24, 17, .42), HOME]);
      k.push([940, T(rest.x, rest.y, lean, 1), sh(3, 4, .55), null]);
    } else {
      k.push([400, T(hit.x, hit.y - 96, -1.6, ON), sh(28, 19, .4), FALL]);
      k.push([470, T(hit.x, hit.y, 0, ON), sh(5, 7, .62), STOP]);
      k.push([498, T(hit.x, hit.y + 3, 0, ON, ON * .975), sh(4, 5, .64), AWAY]);
      k.push([545, T(hit.x, hit.y, 0, ON), sh(6, 8, .6), AWAY]);
      k.push([660, T(hit.x, hit.y - 104, 3.5, ON * .97), sh(24, 17, .42), HOME]);
      k.push([780, T(rest.x, rest.y, lean, 1), sh(3, 4, .55), null]);
    }
    var total = k[k.length - 1][0];
    var contact = charge ? 625 : 470;

    var g = ghost(die, dr, "die");
    g.style.transformOrigin = fx + "px " + fy + "px";
    var em = g.querySelector("em");            // the day-count is chrome, not object
    if (em && em.parentNode) em.parentNode.removeChild(em);
    die.style.visibility = "hidden";           // it is in the hand, not the rack

    var a = g.animate(k.map(function (f) {
      var kf = { offset: f[0] / total, transform: f[1], filter: f[2] };
      if (f[3]) kf.easing = f[3];
      return kf;
    }), { duration: total, fill: "forwards" });

    // The die is back in the rack before the sheet has finished leaving, so
    // the real one must be shown again at once — otherwise the rack stands
    // with a hole in it until the sheet lands.
    var pending = 2;
    function step() { if (--pending === 0) done(); }
    a.onfinish = function () { die.style.visibility = ""; drop(g); step(); };
    a.oncancel = a.onfinish;

    // contact: the paper takes the impression and compresses under the die
    window.setTimeout(function () {
      mark();
      if (sheet.parentNode) {
        sheet.animate([
          { transform: "rotate(-.4deg) translateY(0) scaleY(1)", easing: "cubic-bezier(.3,0,.4,1)" },
          { offset: .26, transform: "rotate(-.4deg) translateY(2.5px) scaleY(.9915)", easing: AWAY },
          { transform: "rotate(-.4deg) translateY(0) scaleY(1)" }
        ], { duration: 190 });
      }
    }, contact);

    // the other hand is already sliding the sheet away
    window.setTimeout(function () {
      toTray(sheet, o.pile, step);
    }, contact + 170);
  }

  /* Where the pad sits, if it exists: on the near edge of the desk in front of
     the rack, which is the one part of the timber the sheet never covers. This
     is derived from the rack rather than measured, and should become a scene
     rect of its own the day the plate is actually painted. */
  function padArt(r) {
    if (!padOk || !r) return "";
    return '<img id="inkpad" class="inkpad" src="' + PAD_SRC + '" alt="" style="' +
      'left:' + ((r.x + r.w * 0.45) * 100) + '%; top:' + ((r.y + r.h + 0.05) * 100) + '%; ' +
      'width:' + (0.085 * 100) + '%">';
  }

  return {
    reduced: reduced,
    rect: rect,
    toBlotter: toBlotter,
    toTape: toTape,
    toTray: toTray,
    strike: strike,
    padArt: padArt,
    padReady: padReady
  };
}());
