/* Find the furniture in a painted room, so the interface can register to it.

   The rooms are generated, and every regeneration moves things. Measuring the
   blotter and the picture frame by hand once was tedious; doing it every time a
   plate is redrawn is a standing chore and a standing source of staleness. So
   read them off the plate instead.

   Writes art/scenes.json — for each room, the rectangles the game lays things
   into, as fractions of the plate:

     blotter  the bare leather the paper comes down on
     frame    the empty picture frame the survey plate hangs in
     rack     where the stamps lift from, taken off the blotter's right

   It PROPOSES; it does not decide. Detection across four very different
   lightings turned out unreliable — a night room is dark everywhere, a bleached
   midday room is dark nowhere, and sky through an arch reads exactly like a pale
   panel on a wall. Twelve rectangles across four plates is not worth a vision
   problem, so art/scenes.json is authored and this prints candidates to check
   it against, or to start from when a plate is regenerated.

   Hand-run:  node scripts/measure-scene.js [id ...]        (prints only)
              node scripts/measure-scene.js --write [id ...] (overwrites) */
"use strict";
var fs = require("fs");
var path = require("path");
var sharp = require("sharp");

var ROOT = path.join(__dirname, "..");
var WEB = path.join(ROOT, "art", "web");
var OUT = path.join(ROOT, "art", "scenes.json");
var SAMPLE = 240;                       // wide enough to find things, small enough to be quick

function load(file) {
  return sharp(path.join(WEB, file))
    .resize({ width: SAMPLE })
    .raw().toBuffer({ resolveWithObject: true });
}

function px(d, C, i) { return [d[i * C], d[i * C + 1], d[i * C + 2]]; }
function lum(p) { return (p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114) / 255; }
function chroma(p) { return (Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])) / 255; }

/* Largest connected run of pixels passing a test, within a band of the image. */
function blob(d, W, H, C, test, y0, y1) {
  var seen = new Uint8Array(W * H), best = null;
  for (var y = Math.floor(H * y0); y < Math.floor(H * y1); y++) {
    for (var x = 0; x < W; x++) {
      var s = y * W + x;
      if (seen[s] || !test(px(d, C, s), x / W, y / H)) continue;
      var stack = [s], n = 0, x1 = W, x2 = -1, yy1 = H, yy2 = -1;
      seen[s] = 1;
      while (stack.length) {
        var p = stack.pop(), pxx = p % W, pyy = (p - pxx) / W;
        n++;
        if (pxx < x1) x1 = pxx; if (pxx > x2) x2 = pxx;
        if (pyy < yy1) yy1 = pyy; if (pyy > yy2) yy2 = pyy;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) {
          var nx = pxx + o[0], ny = pyy + o[1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
          var q = ny * W + nx;
          if (seen[q] || !test(px(d, C, q), nx / W, ny / H)) return;
          seen[q] = 1; stack.push(q);
        });
      }
      if (!best || n > best.n) best = { n: n, x1: x1, x2: x2, y1: yy1, y2: yy2 };
    }
  }
  return best;
}

function rect(b, W, H) {
  return {
    x: +(b.x1 / W).toFixed(4), y: +(b.y1 / H).toFixed(4),
    w: +((b.x2 - b.x1 + 1) / W).toFixed(4), h: +((b.y2 - b.y1 + 1) / H).toFixed(4)
  };
}

function percentile(vals, q) {
  var a = vals.slice().sort(function (x, y) { return x - y; });
  return a[Math.max(0, Math.min(a.length - 1, Math.floor(a.length * q)))];
}

/* The blotter: the dark, nearly colourless slab in the lower half. Absolute
   thresholds fail — a night room is dark everywhere and a bleached midday room
   is not dark anywhere — so cut relative to the desk's own distribution. */
function findBlotter(d, W, H, C) {
  var ls = [], cs = [];
  for (var y = Math.floor(H * 0.55); y < H; y++) {
    for (var x = 0; x < W; x += 2) {
      var q = px(d, C, y * W + x); ls.push(lum(q)); cs.push(chroma(q));
    }
  }
  var medL = percentile(ls, 0.5), medC = percentile(cs, 0.5);
  for (var t = 0; t < 5; t++) {
    var maxL = medL - 0.14 + t * 0.045;
    var maxC = Math.max(0.10, medC * (0.75 + t * 0.12));
    var b = blob(d, W, H, C, function (p) {
      return lum(p) < maxL && chroma(p) < maxC;
    }, 0.5, 1.0);
    if (!b) continue;
    var w = (b.x2 - b.x1 + 1) / W, h = (b.y2 - b.y1 + 1) / H;
    // a blotter is a wide slab, not a sliver and not the whole room
    if (b.n > W * H * 0.02 && w > 0.25 && w < 0.88 && h > 0.09 && h < 0.42) return rect(b, W, H);
  }
  return null;
}

/* The frame: a large pale flat region on the wall that does NOT reach the edge
   of the plate. The sky beyond the arch is pale and flat too, but it always
   runs off the side of the picture; a frame on a wall never does. */
function findFrame(d, W, H, C) {
  // Everything bright and flat in the upper half, largest first, and then the
  // enclosure test: a frame is ringed by its own moulding, so just outside its
  // edges the plate goes markedly darker on every side. Sky through an arch
  // does not — on at least one side it opens out into more sky.
  function ringed(b) {
    var pad = Math.max(3, Math.round(W * 0.012));
    var inner = [], outer = [];
    for (var x = b.x1; x <= b.x2; x += 2) {
      for (var k = 1; k <= pad; k++) {
        if (b.y1 - k > 0) outer.push(lum(px(d, C, (b.y1 - k) * W + x)));
        if (b.y2 + k < H) outer.push(lum(px(d, C, (b.y2 + k) * W + x)));
      }
      inner.push(lum(px(d, C, Math.round((b.y1 + b.y2) / 2) * W + x)));
    }
    for (var y = b.y1; y <= b.y2; y += 2) {
      for (var k2 = 1; k2 <= pad; k2++) {
        if (b.x1 - k2 > 0) outer.push(lum(px(d, C, y * W + b.x1 - k2)));
        if (b.x2 + k2 < W) outer.push(lum(px(d, C, y * W + b.x2 + k2)));
      }
    }
    if (!outer.length || !inner.length) return false;
    return percentile(inner, 0.5) - percentile(outer, 0.5) > 0.12;
  }
  for (var t = 0; t < 5; t++) {
    var minL = 0.68 - t * 0.06;
    var b = blob(d, W, H, C, function (p) {
      return lum(p) > minL && chroma(p) < 0.18;
    }, 0.04, 0.62);
    if (!b) continue;
    var mx = W * 0.02, my = H * 0.02;
    var clear = b.x1 > mx && b.y1 > my && b.x2 < W - 1 - mx && b.y2 < H - 1 - my;
    var aspect = (b.x2 - b.x1 + 1) / (b.y2 - b.y1 + 1);
    if (clear && b.n > W * H * 0.010 && aspect > 0.45 && aspect < 2.8 && ringed(b)) return rect(b, W, H);
  }
  return null;
}

(async function main() {
  var argv = process.argv.slice(2);
  var write = argv.indexOf("--write") !== -1;
  var want = argv.filter(function (a) { return a !== "--write"; });
  var files = fs.readdirSync(WEB).filter(function (f) { return /^desk-.*\.jpg$/.test(f); });
  if (want.length) files = files.filter(function (f) { return want.indexOf(f.replace(/\.jpg$/, "")) !== -1; });

  var prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
  var out = Object.assign({}, prev);

  for (var i = 0; i < files.length; i++) {
    var id = files[i].replace(/\.jpg$/, "");
    var raw = await load(files[i]);
    var d = raw.data, W = raw.info.width, H = raw.info.height, C = raw.info.channels;

    var blotter = findBlotter(d, W, H, C);
    var frame = findFrame(d, W, H, C);
    if (!blotter) { console.log(id.padEnd(15) + "no blotter found — keeping previous"); continue; }

    // The stamps lift from the painted rack, which sits on the desk to the
    // right of the leather in every plate. Derived rather than detected: a small
    // wooden object among wooden objects is not reliably findable, and its
    // relation to the blotter is.
    var rack = {
      x: +Math.min(0.97, blotter.x + blotter.w + 0.01).toFixed(4),
      y: +(blotter.y - 0.03).toFixed(4),
      w: +Math.max(0.10, 0.97 - (blotter.x + blotter.w)).toFixed(4),
      h: +(blotter.h * 0.8).toFixed(4)
    };

    out[id] = { blotter: blotter, frame: frame || (prev[id] && prev[id].frame) || null, rack: rack };
    console.log(id.padEnd(15) +
      "blotter " + JSON.stringify(blotter) +
      (frame ? "\n" + " ".repeat(15) + "frame   " + JSON.stringify(frame)
             : "\n" + " ".repeat(15) + "frame   NOT FOUND"));
  }

  if (!write) {
    console.log("\nproposals only — pass --write to overwrite " + path.relative(ROOT, OUT));
    return;
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log("\nwrote " + path.relative(ROOT, OUT) + " (" + Object.keys(out).length + " rooms)");
})().catch(function (e) { console.error("fatal:", e.message); process.exit(1); });
