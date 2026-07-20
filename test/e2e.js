/* End-to-end smoke through the real built UI (desktop + mobile). Clicks a full
   session to an ending, asserts zero console errors, guaranteed termination, no
   mobile horizontal overflow, and captures screenshot evidence (animations on).
   Run: node test/e2e.js  (after build.js) */
"use strict";
var path = require("path");
var fs = require("fs");
var { chromium } = require("playwright");

var INDEX = "file://" + path.join(__dirname, "..", "index.html");
var SHOT_DIR = process.env.PUKKA_SHOT_DIR || path.join(__dirname, "..", "scratch-shots");
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

// Pre-installed browser: use whatever build actually exists on disk.
function findChrome() {
  var candidates = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/pw-browsers/chromium/chrome-linux/chrome"
  ];
  for (var i = 0; i < candidates.length; i++) if (fs.existsSync(candidates[i])) return candidates[i];
  try { var p = chromium.executablePath(); if (fs.existsSync(p)) return p; } catch (e) {}
  return undefined;
}

var fails = [];
function assert(cond, msg) { if (!cond) fails.push(msg); }

async function playSession(browser, label, viewport, opts) {
  var ctx = await browser.newContext({ viewport: viewport });
  var page = await ctx.newPage();
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });

  // Optionally seed a career record before load (e.g. a completed apprentice
  // year, so the session exercises the district chapter).
  if (opts && opts.career) {
    await ctx.addInitScript(function (c) { window.localStorage.setItem("pukka-sahib-career", JSON.stringify(c)); }, opts.career);
  }

  await page.goto(INDEX, { waitUntil: "load" });
  var begin = await page.$("#begin");           // dismiss the cover start screen if present
  if (begin) {
    // the start screen must show the whole career ladder (shipped + planned ranks)
    var rungs = await page.$$eval("#start .ladder .rung", function (ns) { return ns.length; });
    assert(rungs >= 3, label + ": start-screen career ladder missing or short (" + rungs + " rungs)");
    await begin.click();
  }
  await page.waitForSelector("#card .choice", { timeout: 5000 });

  // user-visible invariants present on first paint
  assert(await page.$("#seasonband"), label + ": no season band");
  var econ = (await page.textContent("#economy")) || "";
  assert(/₹/.test(econ), label + ": economy line missing rupee figure (\"" + econ.trim() + "\")");
  var startEcon = econ.trim(); // whatever the chapter starts with — restart must return here

  // Career continuity: a seeded carry must show its meter dowry on first paint
  // (e.g. the despatch's +3 prestige over the chapter's printed start).
  if (opts && opts.expectMeter) {
    var got = await page.$$eval("#meters .meter", function (ns) {
      var out = {};
      ns.forEach(function (n) { out[n.querySelector(".name").textContent] = n.querySelector(".val").textContent; });
      return out;
    });
    assert(got[opts.expectMeter.name] === opts.expectMeter.val,
      label + ": carried start " + opts.expectMeter.name + " should be " + opts.expectMeter.val + ", got " + got[opts.expectMeter.name]);
  }
  // And a carried Kotra debt must surface its priority event at the first
  // drawn fortnight: choose a posture, expect the Lala's call.
  if (opts && opts.expectFirstEvent) {
    await page.click(".choices .choice");
    await page.waitForSelector("#card .cardtitle", { timeout: 5000 });
    var t0 = (await page.textContent("#card .cardtitle")) || "";
    assert(t0.indexOf(opts.expectFirstEvent) !== -1,
      label + ": first drawn event should be \"" + opts.expectFirstEvent + "\", got \"" + t0.trim() + "\"");
  }

  var maxOverflow = 0;
  var ended = false, midShotTaken = false;
  for (var step = 0; step < 200; step++) {
    // widest-content check: the page body must never scroll sideways
    var of = await page.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    if (of > maxOverflow) maxOverflow = of;

    if (await page.$("#again")) { ended = true; break; }
    if (!midShotTaken && step === 3) {
      await page.screenshot({ path: path.join(SHOT_DIR, "e2e-" + label + "-mid.png") });
      midShotTaken = true;
    }
    var cont = await page.$("#cont");
    if (cont) { await cont.click(); }
    else {
      var choice = await page.$(".choices .choice:not([disabled])");
      if (choice) await choice.click();
      else { assert(false, label + ": stuck with no actionable control at step " + step); break; }
    }
    await page.waitForTimeout(70); // let transitions run (animations ON)
  }

  assert(ended, label + ": session did not reach an ending within 200 steps");
  if (ended) {
    await page.screenshot({ path: path.join(SHOT_DIR, "e2e-" + label + "-ending.png") });
    // Restart flow. A promoting verdict reloads into the NEXT chapter's start
    // screen; otherwise "Take up a new posting" repaints the same chapter at
    // fortnight 1 with the treasury back at its start figure.
    var again = await page.$("#again");
    assert(again, label + ": ending screen has no restart button");
    if (again) {
      var promo = (((await page.textContent("#again")) || "").indexOf("promotion") !== -1);
      await again.click();
      if (promo) {
        await page.waitForSelector("#begin", { timeout: 8000 });
        await page.click("#begin");
        await page.waitForSelector("#card .choice", { timeout: 5000 });
        var fnP = (await page.textContent("#card .fortnight")) || "";
        assert(/Fortnight 1 of /.test(fnP), label + ": promotion did not open the next chapter at fortnight 1 (\"" + fnP.trim() + "\")");
      } else {
        await page.waitForSelector("#card .choice", { timeout: 5000 });
        var fortnight = (await page.textContent("#card .fortnight")) || "";
        assert(/Fortnight 1 of /.test(fortnight), label + ": restart did not reset to fortnight 1 (\"" + fortnight.trim() + "\")");
        var econ2 = ((await page.textContent("#economy")) || "").trim();
        assert(econ2 === startEcon, label + ": restart did not reset the treasury (\"" + econ2 + "\" vs \"" + startEcon + "\")");
      }
      // the completed posting must now be in the career record on the start screen
      await page.reload({ waitUntil: "load" });
      var service = await page.$(".service");
      assert(service, label + ": no service record on the start screen after a completed posting");
      if (service) {
        var svc = (await page.textContent(".service")) || "";
        assert(/posting/.test(svc), label + ": service record missing postings line (\"" + svc.trim() + "\")");
      }
    }
  }
  assert(errors.length === 0, label + ": " + errors.length + " console error(s): " + errors.slice(0, 3).join(" | "));
  assert(maxOverflow <= 1, label + ": horizontal overflow of " + maxOverflow + "px");

  await ctx.close();
  return { errors: errors.length, overflow: maxOverflow, ended: ended };
}

// Save/resume: play a few fortnights, reload the page (same origin → same
// localStorage), resume, and assert we land back on the same fortnight; also
// exercises the meter legend and keyboard choice selection.
async function resumeSession(browser, viewport) {
  var label = "resume";
  var ctx = await browser.newContext({ viewport: viewport });
  var page = await ctx.newPage();
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });

  await page.goto(INDEX, { waitUntil: "load" });
  var begin = await page.$("#begin");
  if (begin) await begin.click();
  await page.waitForSelector("#card .choice", { timeout: 5000 });

  // sound toggle: turning it on (a gesture) must construct/resume audio with
  // no console error, and flip the button's pressed state
  var audioBtn = await page.$("#audiotoggle");
  if (audioBtn && !(await page.$eval("#audiotoggle", function (n) { return n.hidden; }))) {
    await audioBtn.click();
    var pressed = await page.$eval("#audiotoggle", function (n) { return n.getAttribute("aria-pressed"); });
    assert(pressed === "true", label + ": sound toggle did not turn on");
    await page.waitForTimeout(60);
    await audioBtn.click(); // back off, leave the run silent
  }

  // legend toggle works
  var key = await page.$("#meterkey");
  assert(key, label + ": no meter legend toggle");
  if (key) {
    await key.click();
    var legendVisible = await page.$eval("#legend", function (n) { return !n.hasAttribute("hidden") && n.children.length === 7; });
    assert(legendVisible, label + ": legend did not open with 7 glosses (five meters + treasury & debt + honours)");
    await key.click();
  }

  // advance several fortnights, using the keyboard for at least one choice
  var usedKey = false;
  for (var step = 0; step < 6; step++) {
    if (await page.$("#again")) break;
    var cont = await page.$("#cont");
    if (cont) { await cont.click(); }
    else if (await page.$("#card .choice:not([disabled])")) {
      if (!usedKey) { await page.keyboard.press("1"); usedKey = true; } // keyboard path
      else { await (await page.$("#card .choice:not([disabled])")).click(); }
    }
    await page.waitForTimeout(70);
  }
  assert(usedKey, label + ": never exercised keyboard selection");
  var beforeFn = (await page.textContent("#card .fortnight")) || (await page.textContent("#seasonband")) || "";
  var hadSave = await page.evaluate(function () { return !!localStorage.getItem("pukka-sahib-save-ac"); }); // per-chapter slot (fresh career = the probation)
  assert(hadSave, label + ": no save was written mid-run");

  // reload — the start screen should now offer Resume
  await page.reload({ waitUntil: "load" });
  var resumeBtn = await page.$("#resume");
  assert(resumeBtn, label + ": no Resume button after reload with a live save");
  if (resumeBtn) {
    await resumeBtn.click();
    await page.waitForSelector("#card", { timeout: 5000 });
    var afterFn = (await page.textContent("#card .fortnight")) || (await page.textContent("#seasonband")) || "";
    assert(afterFn === beforeFn, label + ": resume landed on a different fortnight (\"" + beforeFn.trim() + "\" → \"" + afterFn.trim() + "\")");
  }

  // "Begin a new posting" clears the save and resets
  await page.reload({ waitUntil: "load" });
  var fresh = await page.$("#fresh");
  if (fresh) {
    await fresh.click();
    await page.waitForSelector("#card .choice", { timeout: 5000 });
    var fn = (await page.textContent("#card .fortnight")) || "";
    assert(/Fortnight 1 of /.test(fn), label + ": new posting did not reset to fortnight 1");
  }

  assert(errors.length === 0, label + ": " + errors.length + " console error(s): " + errors.slice(0, 3).join(" | "));
  await ctx.close();
  return { errors: errors.length, resumed: !!resumeBtn };
}

// The promotion handoff, deterministically: seed a save one click from the end
// of a passing probation, finish it, and assert the whole chain — the
// disposition strip names the next rank, the career records the promotion and
// its carry, and the reload opens the district at fortnight 1.
async function promotionSession(browser, viewport, opts) {
  opts = opts || {};
  var label = opts.breakStorage ? "promotion-no-storage" : "promotion";
  var ctx = await browser.newContext({ viewport: viewport });
  var page = await ctx.newPage();
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });
  var save = {
    v: 2, chapter: "ac",
    data: {
      S: { flags: {}, posture: "desk", turn: 12, treasury: 4000, debt: 0, log: [],
           revenue: 55, order: 55, prestige: 60, contentment: 50, health: 50 },
      phase: "resolved", currentId: "ac-first-sitting",
      lastResult: { outcome: "done", effects: {}, econ: null },
      recent: [], notice: null, lastEventId: "ac-first-sitting", endedKey: null
    }
  };
  await ctx.addInitScript(function (s) { window.localStorage.setItem("pukka-sahib-save", JSON.stringify(s)); }, save);
  await page.goto(INDEX, { waitUntil: "load" });
  await page.click("#resume");
  await page.click("#cont");
  await page.waitForSelector("#again", { timeout: 5000 });
  var title = (await page.textContent("#card .cardtitle")) || "";
  assert(/Confirmed/.test(title), label + ": passing meters did not confirm (\"" + title.trim() + "\")");
  var disp = await page.$(".disposition--up");
  assert(disp, label + ": promoting ending has no promotion disposition strip");
  if (disp) {
    var dtext = (await page.textContent(".disposition--up")) || "";
    assert(/District Magistrate/.test(dtext), label + ": disposition does not name the next rank (\"" + dtext.trim() + "\")");
  }
  var btn = (await page.textContent("#again")) || "";
  assert(btn.indexOf("promotion") !== -1, label + ": ending button is not the promotion button (\"" + btn.trim() + "\")");
  if (opts.breakStorage) {
    // A browser whose storage dies mid-session (private mode): the promotion
    // must still hand over, riding the #go-<chapter> hash across the reload.
    await page.evaluate(function () {
      window.localStorage.clear();
      window.localStorage.setItem = function () { throw new Error("QuotaExceededError"); };
    });
  } else {
    var career = await page.evaluate(function () { return JSON.parse(window.localStorage.getItem("pukka-sahib-career") || "null"); });
    assert(career && career.history && career.history.some(function (h) { return h.chapter === "ac" && h.promoted; }),
      label + ": career record missing the promoted apprentice year");
    assert(career && career.carries && career.carries.dm, label + ": promotion recorded no carry for the district");
  }
  await page.click("#again");
  await page.waitForSelector("#begin", { timeout: 8000 });
  var mast = (await page.textContent("#mastsub")) || "";
  assert(/District Magistrate/.test(mast), label + ": after promotion the masthead is not the Collector's (\"" + mast.trim() + "\")");
  var here = (await page.textContent(".rung--here")) || "";
  assert(/District Magistrate/.test(here), label + ": career ladder 'you are here' did not advance (\"" + here.trim() + "\")");
  await page.click("#begin");
  await page.waitForSelector("#card .fortnight", { timeout: 5000 });
  var fn = (await page.textContent("#card .fortnight")) || "";
  assert(/Fortnight 1 of 24/.test(fn), label + ": district year did not open at fortnight 1 of 24 (\"" + fn.trim() + "\")");
  assert(errors.length === 0, label + ": " + errors.length + " console error(s): " + errors.slice(0, 3).join(" | "));
  await ctx.close();
  return { errors: errors.length };
}

// The district-to-Division handoff: a career past the probation, a save one
// click from a Division-tier ending, and the reload must open the Commissioner.
async function promotionDmSession(browser, viewport) {
  var label = "promotion-dm";
  var ctx = await browser.newContext({ viewport: viewport });
  var page = await ctx.newPage();
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });
  var career = {
    v: 1, completions: { ac: 1 }, honours: [],
    history: [{ chapter: "ac", ending: "confirmed", title: "Confirmed in the Service", promoted: true }]
  };
  var save = {
    v: 2, chapter: "dm",
    data: {
      S: { flags: { married: true }, posture: "desk", turn: 24, treasury: 90000, debt: 0, log: [],
           revenue: 62, order: 62, prestige: 80, contentment: 52, health: 50 },
      phase: "resolved", currentId: "pers-seed",
      lastResult: { outcome: "done", effects: {}, econ: null },
      recent: [], notice: null, lastEventId: "pers-seed", endedKey: null
    }
  };
  await ctx.addInitScript(function (seed) {
    window.localStorage.setItem("pukka-sahib-career", JSON.stringify(seed.career));
    window.localStorage.setItem("pukka-sahib-save", JSON.stringify(seed.save));
  }, { career: career, save: save });
  await page.goto(INDEX, { waitUntil: "load" });
  await page.click("#resume");
  await page.click("#cont");
  await page.waitForSelector("#again", { timeout: 5000 });
  var title = (await page.textContent("#card .cardtitle")) || "";
  assert(/C\.I\.E\.|Division/.test(title), label + ": district year with top meters did not reach a promoting tier (\"" + title.trim() + "\")");
  var disp = (await page.textContent(".disposition--up").catch(function () { return ""; })) || "";
  assert(/Commissioner/.test(disp), label + ": disposition does not name the Commissioner (\"" + disp.trim() + "\")");
  var career2 = await page.evaluate(function () { return JSON.parse(window.localStorage.getItem("pukka-sahib-career") || "null"); });
  assert(career2 && career2.carries && career2.carries.comm, label + ": promotion recorded no carry for the Division");
  assert(career2 && career2.carries && career2.carries.comm.flags.indexOf("carry_wife") !== -1, label + ": married year did not carry the wife");
  await page.click("#again");
  await page.waitForSelector("#begin", { timeout: 8000 });
  var mast = (await page.textContent("#mastsub")) || "";
  assert(/Commissioner/.test(mast), label + ": after promotion the masthead is not the Commissioner's (\"" + mast.trim() + "\")");
  await page.click("#begin");
  await page.waitForSelector("#card .fortnight", { timeout: 5000 });
  var fn = (await page.textContent("#card .fortnight")) || "";
  assert(/Fortnight 1 of 24/.test(fn), label + ": the Division did not open at fortnight 1 of 24 (\"" + fn.trim() + "\")");
  assert(errors.length === 0, label + ": " + errors.length + " console error(s): " + errors.slice(0, 3).join(" | "));
  await ctx.close();
  return { errors: errors.length };
}

// The chapter picker: a career past the district must be able to take up an
// earlier rank again from the start-screen ladder — without touching the
// current rank's save slot.
async function chapterPickSession(browser, viewport) {
  var label = "pick";
  var ctx = await browser.newContext({ viewport: viewport });
  var page = await ctx.newPage();
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });
  var career = {
    v: 1, completions: { ac: 1, dm: 1 }, honours: [],
    history: [
      { chapter: "ac", ending: "confirmed", title: "Confirmed in the Service", promoted: true },
      { chapter: "dm", ending: "cie", title: "The C.I.E.", promoted: true }
    ],
    carries: { comm: { flags: ["carry_marked"], meters: { prestige: 3 } } }
  };
  // A Commissioner's posting in progress: picking Kotra must not disturb it.
  var commSave = {
    v: 2, chapter: "comm",
    data: {
      S: { flags: {}, posture: null, turn: 5, treasury: 250000, debt: 0, log: [],
           revenue: 55, order: 55, prestige: 58, contentment: 47, health: 52 },
      phase: "posture", currentId: null, lastResult: null,
      recent: [], notice: null, lastEventId: null, endedKey: null
    }
  };
  await ctx.addInitScript(function (seed) {
    window.localStorage.setItem("pukka-sahib-career", JSON.stringify(seed.career));
    window.localStorage.setItem("pukka-sahib-save-comm", JSON.stringify(seed.save));
  }, { career: career, save: commSave });
  await page.goto(INDEX, { waitUntil: "load" });
  var mast0 = (await page.textContent("#mastsub")) || "";
  assert(/Commissioner/.test(mast0), label + ": career past the district did not open at the Division (\"" + mast0.trim() + "\")");
  var picks = await page.$$eval(".rung[data-go]", function (ns) { return ns.map(function (n) { return n.getAttribute("data-go"); }); });
  assert(picks.indexOf("ac") !== -1 && picks.indexOf("dm") !== -1,
    label + ": served ranks not pickable on the ladder (got " + picks.join(",") + ")");
  await page.click('.rung[data-go="ac"]');
  await page.waitForSelector("#begin", { timeout: 8000 });
  var mast = (await page.textContent("#mastsub")) || "";
  assert(/Assistant Commissioner/.test(mast), label + ": picking rung I did not open Kotra (\"" + mast.trim() + "\")");
  await page.click("#begin");
  await page.waitForSelector("#card .fortnight", { timeout: 5000 });
  var fn = (await page.textContent("#card .fortnight")) || "";
  assert(/Fortnight 1 of 12/.test(fn), label + ": the replayed probation did not open at fortnight 1 of 12 (\"" + fn.trim() + "\")");
  var commSaveAfter = await page.evaluate(function () { return window.localStorage.getItem("pukka-sahib-save-comm"); });
  assert(!!commSaveAfter, label + ": picking Kotra destroyed the Commissioner's save slot");
  // Pick the Division back and resume the posting in progress.
  await page.reload({ waitUntil: "load" });
  await page.click('.rung[data-go="comm"]');
  await page.waitForSelector("#resume", { timeout: 8000 });
  await page.click("#resume");
  await page.waitForSelector("#card", { timeout: 5000 });
  var fn2 = (await page.textContent("#card .fortnight").catch(function () { return ""; })) || (await page.textContent("#seasonband")) || "";
  assert(/Fortnight 5 of 24/.test(fn2), label + ": the Division posting did not resume at fortnight 5 (\"" + fn2.trim() + "\")");
  assert(errors.length === 0, label + ": " + errors.length + " console error(s): " + errors.slice(0, 3).join(" | "));
  await ctx.close();
  return { errors: errors.length };
}

// Consultation, deterministically: seed a save sitting on an event that carries
// a consult, resume onto it, and drive the affordance — the "Ask …" control is
// offered, reveals an opinion, disappears, and the choices still resolve.
async function consultSession(browser, viewport) {
  var label = "consult";
  var ctx = await browser.newContext({ viewport: viewport });
  var page = await ctx.newPage();
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });
  // The save also carries a made relationship (the Thakur obliged), so the same
  // resume exercises the standing strip.
  var save = {
    v: 2, chapter: "ac",
    data: {
      S: { flags: { thakur_obliged: true }, posture: "desk", turn: 4, treasury: 5000, debt: 0, log: [], consulted: false,
           revenue: 50, order: 52, prestige: 48, contentment: 48, health: 55 },
      phase: "event", currentId: "ac-first-sitting",
      lastResult: null, recent: [], notice: null, lastEventId: "ac-first-sitting", endedKey: null
    }
  };
  await ctx.addInitScript(function (s) { window.localStorage.setItem("pukka-sahib-save-ac", JSON.stringify(s)); }, save);
  await page.goto(INDEX, { waitUntil: "load" });
  var resume = await page.$("#resume");
  assert(resume, label + ": no resume for the seeded consult event");
  if (resume) await resume.click();
  await page.waitForSelector("#card .choice", { timeout: 5000 });

  // the standing strip shows the made relationship
  var standingsShown = await page.$eval("#standings", function (n) { return !n.hidden && /Thakur/.test(n.textContent); }).catch(function () { return false; });
  assert(standingsShown, label + ": the standing strip did not surface a made relationship (the Thakur)");

  var ask = await page.$(".consult-ask");
  assert(ask, label + ": an event carrying a consult offered no 'Ask …' control");
  assert(!(await page.$(".consult-note")), label + ": the opinion was shown before asking");
  if (ask) {
    await ask.click();
    await page.waitForSelector(".consult-note", { timeout: 3000 });
    var note = ((await page.textContent(".consult-note")) || "").trim();
    assert(note.length > 0, label + ": the consulted opinion is empty");
    assert(!(await page.$(".consult-ask")), label + ": the 'Ask …' control remained after asking");
  }
  // The fortnight is still undecided: choosing must still resolve to an outcome.
  await page.click("#card .choice:not([disabled])");
  await page.waitForSelector("#cont, #again", { timeout: 5000 });
  assert(await page.$(".outcome"), label + ": no outcome after choosing post-consult");
  assert(errors.length === 0, label + ": " + errors.length + " console error(s): " + errors.slice(0, 3).join(" | "));
  await ctx.close();
  return { errors: errors.length };
}

// The Gazette: a seeded career must render its collection — the honour won, the
// fates witnessed, and a discovered coda — and a blank career its empty state.
async function gazetteSession(browser, viewport) {
  var label = "gazette";
  var ctx = await browser.newContext({ viewport: viewport });
  var page = await ctx.newPage();
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });
  var career = {
    v: 1, completions: { ac: 1, dm: 1 },
    honours: [{ chapter: "dm", key: "cie", title: "The C.I.E." }],
    history: [
      { chapter: "ac", ending: "confirmed", title: "Confirmed in the Service", promoted: true },
      { chapter: "dm", ending: "cie", title: "The C.I.E.", promoted: true }
    ],
    carries: {}, codasSeen: { dm: { "The entry the ribbon does not cover": true } }
  };
  await ctx.addInitScript(function (c) { window.localStorage.setItem("pukka-sahib-career", JSON.stringify(c)); }, career);
  await page.goto(INDEX, { waitUntil: "load" });
  await page.waitForSelector("#gazette-open", { timeout: 8000 });
  await page.click("#gazette-open");
  await page.waitForSelector(".gazette", { timeout: 5000 });
  var gz = (await page.textContent(".gazette")) || "";
  assert(/The C\.I\.E\./.test(gz), label + ": Gazette does not show the earned honour");
  assert(/Fates witnessed/.test(gz), label + ": Gazette missing the fates line");
  assert(/ribbon does not cover/.test(gz), label + ": Gazette did not surface the discovered coda");
  await page.click("#gz-back");
  await page.waitForSelector("#gazette-open", { timeout: 5000 });

  // A blank career shows the empty-state Gazette.
  var ctx2 = await browser.newContext({ viewport: viewport });
  var page2 = await ctx2.newPage();
  page2.on("pageerror", function (e) { errors.push("pageerror(empty): " + e.message); });
  await page2.goto(INDEX, { waitUntil: "load" });
  await page2.waitForSelector("#gazette-open", { timeout: 8000 });
  await page2.click("#gazette-open");
  await page2.waitForSelector(".gz-empty", { timeout: 5000 });
  await ctx2.close();

  assert(errors.length === 0, label + ": " + errors.length + " console error(s): " + errors.slice(0, 3).join(" | "));
  await ctx.close();
  return { errors: errors.length };
}

(async function () {
  var exe = findChrome();
  var browser = await chromium.launch({ executablePath: exe, headless: true });
  try {
    // Desktop plays the career entry (the apprentice year, incl. the promotion
    // flow); mobile is seeded past it and plays the district chapter.
    var d = await playSession(browser, "desktop", { width: 1120, height: 920 });
    console.log("desktop:", JSON.stringify(d));
    // The seeded career carries a full Kotra inheritance: the despatch's +3
    // prestige must show on first paint (50 → 53) and the carried debt must
    // put the Lala's call first in the deck.
    var seasoned = {
      v: 1, completions: { ac: 1 }, honours: [],
      history: [{ chapter: "ac", ending: "distinction", title: "Confirmed &mdash; with a Despatch", promoted: true }],
      carry: {
        into: "dm",
        flags: ["carry_sweetheart", "carry_tahsildar", "carry_vernacular", "carry_kotra_debt", "carry_despatch"],
        meters: { prestige: 3 }
      }
    };
    var m = await playSession(browser, "mobile", { width: 375, height: 667 }, {
      career: seasoned,
      expectMeter: { name: "Prestige", val: "53" },
      expectFirstEvent: "The Lala Reads Old Paper"
    });
    console.log("mobile: ", JSON.stringify(m));
    var r = await resumeSession(browser, { width: 1120, height: 920 });
    console.log("resume: ", JSON.stringify(r));
    var p = await promotionSession(browser, { width: 1120, height: 920 });
    console.log("promo:  ", JSON.stringify(p));
    var p2 = await promotionSession(browser, { width: 1120, height: 920 }, { breakStorage: true });
    console.log("promo2: ", JSON.stringify(p2));
    var p3 = await promotionDmSession(browser, { width: 1120, height: 920 });
    console.log("promo3: ", JSON.stringify(p3));
    var pk = await chapterPickSession(browser, { width: 1120, height: 920 });
    console.log("pick:   ", JSON.stringify(pk));
    var cs = await consultSession(browser, { width: 1120, height: 920 });
    console.log("consult:", JSON.stringify(cs));
    var gz = await gazetteSession(browser, { width: 1120, height: 920 });
    console.log("gazette:", JSON.stringify(gz));
  } finally {
    await browser.close();
  }
  if (fails.length) {
    console.error("\nE2E FAILED — " + fails.length + " problem(s):");
    fails.forEach(function (f) { console.error("  ✗ " + f); });
    process.exit(1);
  }
  console.log("\nE2E green ✓  (screenshots in " + SHOT_DIR + ")");
})().catch(function (e) { console.error("E2E crashed:", e); process.exit(1); });
