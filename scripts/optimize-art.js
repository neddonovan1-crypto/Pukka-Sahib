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
  { in: "season-cold.png", out: "season-cold.jpg", w: 1200, q: 74 },
  { in: "season-hot.png", out: "season-hot.jpg", w: 1200, q: 74 },
  { in: "season-monsoon.png", out: "season-monsoon.jpg", w: 1200, q: 74 },
  { in: "cover.png", out: "cover.jpg", w: 1400, q: 78 }
];

(async function () {
  var total = 0;
  for (var i = 0; i < JOBS.length; i++) {
    var j = JOBS[i];
    var src = path.join(ART, j.in);
    if (!fs.existsSync(src)) { console.log("skip (missing):", j.in); continue; }
    await sharp(src).resize({ width: j.w }).jpeg({ quality: j.q, mozjpeg: true }).toFile(path.join(OUT, j.out));
    var kb = fs.statSync(path.join(OUT, j.out)).size / 1024;
    total += kb;
    console.log(j.out.padEnd(22), kb.toFixed(0) + " KB");
  }
  console.log("total web art:", total.toFixed(0) + " KB");
})();
