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

async function playSession(browser, label, viewport) {
  var ctx = await browser.newContext({ viewport: viewport });
  var page = await ctx.newPage();
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("pageerror: " + e.message); });

  await page.goto(INDEX, { waitUntil: "load" });
  await page.waitForSelector("#card .choice", { timeout: 5000 });

  // user-visible invariants present on first paint
  assert(await page.$("#seasonband"), label + ": no season band");
  var econ = (await page.textContent("#economy")) || "";
  assert(/₹/.test(econ), label + ": economy line missing rupee figure (\"" + econ.trim() + "\")");

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
  if (ended) await page.screenshot({ path: path.join(SHOT_DIR, "e2e-" + label + "-ending.png") });
  assert(errors.length === 0, label + ": " + errors.length + " console error(s): " + errors.slice(0, 3).join(" | "));
  assert(maxOverflow <= 1, label + ": horizontal overflow of " + maxOverflow + "px");

  await ctx.close();
  return { errors: errors.length, overflow: maxOverflow, ended: ended };
}

(async function () {
  var exe = findChrome();
  var browser = await chromium.launch({ executablePath: exe, headless: true });
  try {
    var d = await playSession(browser, "desktop", { width: 900, height: 820 });
    console.log("desktop:", JSON.stringify(d));
    var m = await playSession(browser, "mobile", { width: 375, height: 667 });
    console.log("mobile: ", JSON.stringify(m));
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
