/* Optimize source art (art/*.png, large) into web-ready JPEGs (art/web/*.jpg,
   committed). The build consumes the JPEGs, so build.js stays dependency-free
   (the CI Pages workflow runs `node build.js` with no install). Re-run this
   only when new source art lands: node scripts/optimize-art.js
   Requires the sharp devDependency. */
"use strict";
var sharp = require("sharp");
var fs = require("fs");
var path = require("path");

var ART = path.join(__dirname, "..", "art");
var OUT = path.join(ART, "web");
fs.mkdirSync(OUT, { recursive: true });

// Banners render at most ~680px wide; 1200px covers retina without bloating the
// data-URI embed. The cover gets a touch more width/quality (it's the hero).
var JOBS = [
  { in: "season-cold.png", out: "season-cold.jpg", w: 1200, q: 70 },
  { in: "season-cold-alt.png", out: "season-cold-2.jpg", w: 1200, q: 70 }, // second cold-season backdrop, rotated in
  { in: "season-cold-3.png", out: "season-cold-3.jpg", w: 1200, q: 70 },    // third: inspecting an out-station
  { in: "season-hot.png", out: "season-hot.jpg", w: 1200, q: 70 },
  { in: "season-hot-2.png", out: "season-hot-2.jpg", w: 1200, q: 70 },       // second hot-season backdrop
  { in: "season-monsoon.png", out: "season-monsoon.jpg", w: 1200, q: 70 },
  { in: "season-monsoon-2.png", out: "season-monsoon-2.jpg", w: 1200, q: 70 }, // second monsoon backdrop
  { in: "cover.png", out: "cover.jpg", w: 1400, q: 74 },
  // Station backdrops (desk posture) and event scenes, keyed by `art`/posture.
  { in: "scene-cutcherry.png", out: "scene-cutcherry.jpg", w: 1200, q: 69 },
  { in: "scene-club.png", out: "scene-club.jpg", w: 1200, q: 69 },
  { in: "scene-city.png", out: "scene-city.jpg", w: 1200, q: 69 },
  { in: "scene-hills.png", out: "scene-hills.jpg", w: 1200, q: 69 },
  { in: "scene-durbar.png", out: "scene-durbar.jpg", w: 1200, q: 69 },
  // Honours medals for the ending screens. Both end up transparent PNGs so they
  // sit consistently on the buff. The Star of India (KCSI) already has alpha;
  // the Indian Empire badge (CIE/KCIE) is a scan whose cream paper is flood-
  // filled away from the borders (see cutout:true).
  { in: "medal-kcsi-src.png", out: "medal-kcsi.png", w: 560 },
  { in: "medal-cie-src.jpg", out: "medal-cie.png", w: 420, cutout: true },
  // The masthead crest: engraved line-work on white. inkAlpha (not cutout) —
  // every pixel's whiteness becomes transparency, so the paper shows through
  // the hatching like a genuine ink stamp, with no enclosed white disc.
  { in: "seal.png", out: "seal.png", w: 264, inkAlpha: true }
];

// Remove the flat paper background from a scanned badge: 4-connected flood-fill
// from every border pixel, clearing pixels within `tol` of the corner colour
// and stopping at the badge's dark outline. Interior colours are never reached,
// so the gilding survives. Returns a sharp instance with alpha.
async function cutoutBadge(src, tol) {
  var raw = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  var data = raw.data, W = raw.info.width, H = raw.info.height;
  var bg = [data[0], data[1], data[2]];
  function isBg(i) {
    var o = i * 4;
    return Math.abs(data[o] - bg[0]) <= tol && Math.abs(data[o + 1] - bg[1]) <= tol && Math.abs(data[o + 2] - bg[2]) <= tol;
  }
  var seen = new Uint8Array(W * H);
  var stack = [];
  for (var x = 0; x < W; x++) { stack.push(x); stack.push((H - 1) * W + x); }
  for (var y = 0; y < H; y++) { stack.push(y * W); stack.push(y * W + W - 1); }
  while (stack.length) {
    var i = stack.pop();
    if (seen[i]) continue; seen[i] = 1;
    if (!isBg(i)) continue;
    data[i * 4 + 3] = 0;
    var px = i % W, py = (i / W) | 0;
    if (px > 0) stack.push(i - 1);
    if (px < W - 1) stack.push(i + 1);
    if (py > 0) stack.push(i - W);
    if (py < H - 1) stack.push(i + W);
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } });
}

// Ink-on-paper conversion: alpha from inkiness (255 − dimmest channel), RGB
// kept. White vanishes; the coloured inks stay near-opaque (oxblood's dimmest
// channel is ~34 → alpha ~221); anti-aliased edges become partial alpha.
async function inkAlpha(src) {
  var raw = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  var data = raw.data, n = raw.info.width * raw.info.height;
  for (var i = 0; i < n; i++) {
    var o = i * 4;
    // 1.6× ink boost: fine engraved hairlines thin badly at masthead size
    // without it, and full-strength lines clamp unchanged.
    data[o + 3] = Math.min(255, Math.round((255 - Math.min(data[o], data[o + 1], data[o + 2])) * 1.6));
  }
  return sharp(data, { raw: { width: raw.info.width, height: raw.info.height, channels: 4 } });
}

(async function () {
  var total = 0;
  for (var i = 0; i < JOBS.length; i++) {
    var j = JOBS[i];
    var src = path.join(ART, j.in);
    if (!fs.existsSync(src)) { console.log("skip (missing):", j.in); continue; }
    var pipe;
    if (j.inkAlpha) pipe = (await inkAlpha(src)).resize({ width: j.w }).png({ compressionLevel: 9, palette: true, quality: 80, colours: 128 });
    else if (j.cutout) pipe = (await cutoutBadge(src, 46)).resize({ width: j.w }).png({ compressionLevel: 9, palette: true, quality: 68, colours: 64 });
    else if (/\.png$/i.test(j.out)) pipe = sharp(src).resize({ width: j.w }).png({ compressionLevel: 9, palette: true, quality: 90 });
    else pipe = sharp(src).resize({ width: j.w }).jpeg({ quality: j.q, mozjpeg: true });
    await pipe.toFile(path.join(OUT, j.out));
    var kb = fs.statSync(path.join(OUT, j.out)).size / 1024;
    total += kb;
    console.log(j.out.padEnd(22), kb.toFixed(0) + " KB");
  }
  console.log("total web art:", total.toFixed(0) + " KB");
})();
