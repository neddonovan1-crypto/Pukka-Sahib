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
  if (begin) await begin.click();
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
    var legendVisible = await page.$eval("#legend", function (n) { return !n.hasAttribute("hidden") && n.children.length === 5; });
    assert(legendVisible, label + ": legend did not open with 5 glosses");
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
  var hadSave = await page.evaluate(function () { return !!localStorage.getItem("pukka-sahib-save"); });
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
