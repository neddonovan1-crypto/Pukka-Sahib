/* Treat generated art so it belongs on the same desk as everything else.

   Generation gives us a clean digital image. What the game wants is a thing
   that came off a press in 1925. Three processes, per docs/DESIGN-ART.md §9:

     chromolithograph  colour work — posterised to a small ink set, the
                       separations knocked very slightly out of register,
                       stone grain over the top
     engraved plate    line work — warm black on buff, plate mark
     cutout            isolated objects — the white ground keyed out to
                       transparency so a stamp can be gummed onto a document
                       rather than sat in a white box

   Reads art/gen/*.png, writes art/web/*.{jpg,png}. Hand-run, like
   optimize-art.js:  node scripts/treat-art.js [briefId ...]                */
"use strict";
var fs = require("fs");
var path = require("path");
var sharp = require("sharp");

var ROOT = path.join(__dirname, "..");
var GEN = path.join(ROOT, "art", "gen");
var BRIEFS = path.join(ROOT, "art", "briefs");
var OUT = path.join(ROOT, "art", "web");

// Which process each register goes through.
var PROCESS = {
  environment: "scene",
  "painted-object": "pluck",    // painted like the room, lifted straight off the white
  painting: "chromo",
  kalighat: "chromo",
  engraving: "plate",
  "security-print": "cutout",
  isolated: "cutout"
};

// The ink set a cheap chromolithograph could actually hold. Posterising to
// these is what stops a generated image reading as a photograph of a painting.
var INKS = [
  [26, 22, 18],                          // key
  [150, 46, 34], [186, 78, 44],          // earth red, and its lighter pull
  [206, 150, 60], [226, 190, 110],       // ochre, and its tint
  [64, 92, 72], [46, 64, 100],           // malachite, indigo
  [232, 219, 188], [250, 244, 228]       // paper, and the highlight
];

var PAPER = { r: 226, g: 213, b: 180 };
var MAX_EDGE = 1400, SCENE_EDGE = 2000;                       // dist/ has no weight limit, but a
                                           // 4k plate helps nobody at 680px

function briefFor(id) {
  var p = path.join(BRIEFS, id + ".json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function clampNum(v, a, b) { return v < a ? a : v > b ? b : v; }

function nearestInk(r, g, b) {
  var best = 0, bestD = Infinity;
  for (var i = 0; i < INKS.length; i++) {
    var dr = r - INKS[i][0], dg = g - INKS[i][1], db = b - INKS[i][2];
    var d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return INKS[best];
}


/* ——— what colour is the sheet? ————————————————————————————————————————
   The model paints its own paper, and it is never the same cream twice. Keying
   against a fixed white left a halo; loosening the fixed threshold until the
   halo went ate the stamp's own blank panels. So sample the corners, and key
   what matches THAT — the panels inside the design are a different tone and
   are not border-connected, so they survive either way. */
function sheetColour(d, W, H, C) {
  var pts = [], m = 6;
  for (var i = 0; i < m; i++) {
    for (var j = 0; j < m; j++) {
      pts.push([i, j], [W - 1 - i, j], [i, H - 1 - j], [W - 1 - i, H - 1 - j]);
    }
  }
  var rs = [], gs = [], bs = [];
  pts.forEach(function (pt) {
    var k = (pt[1] * W + pt[0]) * C;
    rs.push(d[k]); gs.push(d[k + 1]); bs.push(d[k + 2]);
  });
  function med(a) { a.sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
  return [med(rs), med(gs), med(bs)];
}

/* The box the specimen actually occupies, so a panel coordinate expressed as a
   percentage of the image means something. */
function contentBox(d, W, H, C, bg, tol) {
  var x1 = W, y1 = H, x2 = -1, y2 = -1, t2 = tol * tol;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var k = (y * W + x) * C;
      var dr = d[k] - bg[0], dg = d[k + 1] - bg[1], db = d[k + 2] - bg[2];
      if (dr * dr + dg * dg + db * db > t2) {
        if (x < x1) x1 = x; if (x > x2) x2 = x;
        if (y < y1) y1 = y; if (y > y2) y2 = y;
      }
    }
  }
  if (x2 < 0) return null;
  return { left: x1, top: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
}

/* ——— chromolithograph ————————————————————————————————————————————————
   Posterise to the ink set, then shift the separations a hair apart. Real
   stones were registered by eye and never quite met; that near-miss is most
   of why old colour printing looks like old colour printing. */
async function chromo(buf, w, h) {
  var img = sharp(buf).resize({ width: w, height: h, fit: "inside" });
  var raw = await img.raw().toBuffer({ resolveWithObject: true });
  var d = raw.data, W = raw.info.width, H = raw.info.height, C = raw.info.channels;

  var rgb = Buffer.alloc(W * H * 3);
  for (var i = 0, j = 0; i < d.length; i += C, j += 3) {
    rgb[j] = d[i]; rgb[j + 1] = d[i + 1]; rgb[j + 2] = d[i + 2];
  }

  // Misregistration: nudge two of the three separations a pixel apart. Done on
  // the raw buffer by resampling each channel at its own offset — routing it
  // through sharp's extend/extract meant three round-trips and an off-by-one
  // waiting to happen.
  var shifts = [[0, 0], [1, -1], [-1, 1]];
  var mis = Buffer.alloc(W * H * 3);
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      for (var c = 0; c < 3; c++) {
        var sx = x - shifts[c][0]; if (sx < 0) sx = 0; else if (sx >= W) sx = W - 1;
        var sy = y - shifts[c][1]; if (sy < 0) sy = 0; else if (sy >= H) sy = H - 1;
        mis[(y * W + x) * 3 + c] = rgb[(sy * W + sx) * 3 + c];
      }
    }
  }
  // Posterise last: the stones were shot from the artwork, not the other way
  // round, so the ink set quantises an already-misregistered image.
  for (var q = 0; q < mis.length; q += 3) {
    var ink = nearestInk(mis[q], mis[q + 1], mis[q + 2]);
    mis[q] = ink[0]; mis[q + 1] = ink[1]; mis[q + 2] = ink[2];
  }
  var joined = await sharp(mis, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

  // Stone grain and a breath of the paper underneath.
  var grain = Buffer.alloc(W * H);
  for (var g = 0; g < grain.length; g++) grain[g] = 118 + Math.floor(Math.random() * 26);
  var grainPng = await sharp(grain, { raw: { width: W, height: H, channels: 1 } })
    .png().toBuffer();

  return sharp(joined)
    .composite([
      { input: grainPng, blend: "soft-light" },
      { input: { create: { width: W, height: H, channels: 3, background: PAPER } }, blend: "multiply", opacity: 0.14 }
    ])
    .modulate({ saturation: 0.94 })
    .jpeg({ quality: 78, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/* ——— scene ————————————————————————————————————————————————————————
   The room the player is sitting in. No print process at all: this is not a
   reproduction of anything, it is the place itself, so it only wants sizing,
   a warm grade to match the lamplight, and enough grain to sit with the
   treated art rather than beside it.                                       */
async function scene(buf, w, h) {
  var img = sharp(buf).resize({ width: w, height: h, fit: "inside" });
  var meta = await img.metadata();
  var W = Math.min(w, meta.width), H = Math.min(h, meta.height);
  var grain = Buffer.alloc(W * H);
  for (var g = 0; g < grain.length; g++) grain[g] = 122 + Math.floor(Math.random() * 14);
  var grainPng = await sharp(grain, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  return sharp(buf)
    .resize({ width: W, height: H, fit: "inside" })
    .modulate({ saturation: 0.96, brightness: 0.99 })
    .composite([
      { input: grainPng, blend: "soft-light" },
      // a breath of lamplight over the whole room, laid on rather than tinted:
      // .tint() greyscales first and takes the teak with it
      { input: { create: { width: W, height: H, channels: 3, background: { r: 255, g: 226, b: 176 } } },
        blend: "soft-light", opacity: 0.18 }
    ])
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/* ——— engraved plate: warm black on buff ——— */
async function plate(buf, w, h) {
  var img = sharp(buf).resize({ width: w, height: h, fit: "inside" }).greyscale().normalise();
  var meta = await img.metadata();
  return img
    .linear(1.18, -18)
    .tint({ r: 240, g: 228, b: 198 })
    .composite([{ input: { create: { width: meta.width, height: meta.height, channels: 3, background: PAPER } }, blend: "multiply", opacity: 0.5 }])
    .jpeg({ quality: 82 })
    .toBuffer();
}

/* ——— pluck ————————————————————————————————————————————————————————
   For an object painted on near-pure white, connectivity is the wrong tool: a
   flood has to be told where to start, it stops at any drawn line, and every
   time it has been asked to cross a painted edge it has eaten the subject and
   returned scanlines. Whiteness alone is enough here. Gouache never reaches
   paper-white, so a tight ramp against pure white lifts the ground and leaves
   even the blank paper band — which is cream — completely intact.            */
async function pluck(buf, w, h, trim) {
  // These plates keep drawing themselves a ruled border despite being told not
  // to, and a pale grey line is far enough from white to survive the ramp. Crop
  // inside it first.
  var pre = sharp(buf);
  if (trim) {
    var pm = await pre.metadata();
    var cx = Math.round(pm.width * trim), cy = Math.round(pm.height * trim);
    pre = sharp(buf).extract({ left: cx, top: cy, width: pm.width - cx * 2, height: pm.height - cy * 2 });
  }
  var raw = await pre
    .resize({ width: w, height: h, fit: "inside" })
    .ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  var d = raw.data, W = raw.info.width, H = raw.info.height;
  var CLEAR = 16, SOLID = 40;                 // distance from white, in RGB units
  for (var i = 0; i < W * H; i++) {
    var k = i * 4;
    var dr = 255 - d[k], dg = 255 - d[k + 1], db = 255 - d[k + 2];
    var dist = Math.sqrt(dr * dr + dg * dg + db * db);
    var a = dist <= CLEAR ? 0
          : dist >= SOLID ? 255
          : Math.round(((dist - CLEAR) / (SOLID - CLEAR)) * 255);
    d[k + 3] = a;
  }
  // Trim to what actually survived, so the object is not adrift in a sheet.
  var x1 = W, y1 = H, x2 = -1, y2 = -1;
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 24) {
        if (x < x1) x1 = x; if (x > x2) x2 = x;
        if (y < y1) y1 = y; if (y > y2) y2 = y;
      }
    }
  }
  if (x2 < 0) return null;
  var pad = 2;
  x1 = Math.max(0, x1 - pad); y1 = Math.max(0, y1 - pad);
  x2 = Math.min(W - 1, x2 + pad); y2 = Math.min(H - 1, y2 + pad);
  return sharp(d, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x1, top: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 })
    .png({ compressionLevel: 9, effort: 9 })
    .toBuffer();
}

/* ——— cutout ————————————————————————————————————————————————————————
   Key the near-white ground to transparency, from the edges inwards, so a
   stamp or a seal can be gummed onto a document. Flood-filling from the border
   rather than thresholding globally keeps the pale panels inside the design —
   which are exactly the blank areas we asked for and intend to typeset. */
async function multiply(buf, w, h) {
  var raw = await sharp(buf).resize({ width: w, height: h, fit: "inside" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw().toBuffer({ resolveWithObject: true });
  var d = raw.data, W = raw.info.width, H = raw.info.height, C = raw.info.channels;
  var bg = sheetColour(d, W, H, C);
  var box = contentBox(d, W, H, C, bg, 34);
  var img = sharp(d, { raw: { width: W, height: H, channels: C } });
  if (box) {
    var pad = Math.round(Math.min(W, H) * 0.02);
    var L = Math.max(0, box.left - pad), T = Math.max(0, box.top - pad);
    img = img.extract({
      left: L, top: T,
      width: Math.min(W - L, box.width + pad * 2),
      height: Math.min(H - T, box.height + pad * 2)
    });
  }
  return img.jpeg({ quality: 84, chromaSubsampling: "4:4:4" }).toBuffer();
}

async function cutout(buf, w, h, trim) {
  // Some plates come back with a ruled border drawn round them, and a drawn
  // line is a wall the flood cannot cross — the fill keys the margin outside it
  // and stops, leaving the whole sheet. Cropping a sliver off each edge starts
  // the fill inside the frame instead.
  var pre = sharp(buf);
  if (trim) {
    var pm = await pre.metadata();
    var cx = Math.round(pm.width * trim), cy = Math.round(pm.height * trim);
    pre = sharp(buf).extract({
      left: cx, top: cy, width: pm.width - cx * 2, height: pm.height - cy * 2
    });
  }
  var raw = await pre
    .resize({ width: w, height: h, fit: "inside" })
    .ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  var d = raw.data, W = raw.info.width, H = raw.info.height;

  // The tolerance has to follow the sheet. A clean white ground varies by a
  // point or two; a heavily foxed and creased one varies by thirty, and a fixed
  // tolerance stops dead at the mottling and leaves the paper behind. So
  // measure the ground's own spread and key to that.
  var bg = sheetColour(d, W, H, 4);
  var spread = 0, n = 0;
  for (var sy = 0; sy < H; sy += 7) {
    for (var sx = 0; sx < W; sx += 7) {
      if (sx > W * .12 && sx < W * .88 && sy > H * .12 && sy < H * .88) continue;
      var q = (sy * W + sx) * 4;
      var er = d[q] - bg[0], eg = d[q + 1] - bg[1], eb = d[q + 2] - bg[2];
      spread += Math.sqrt(er * er + eg * eg + eb * eb); n++;
    }
  }
  var TOLR = clampNum(n ? (spread / n) * 3.2 : 24, 22, 78), TOL = TOLR * TOLR;
  var seen = new Uint8Array(W * H);
  var stack = [];
  for (var x = 0; x < W; x++) { stack.push(x); stack.push((H - 1) * W + x); }
  for (var y = 0; y < H; y++) { stack.push(y * W); stack.push(y * W + W - 1); }

  function flood(tol) {
    while (stack.length) {
      var p = stack.pop();
      if (p < 0 || p >= W * H || seen[p]) continue;
      var k = p * 4, er = d[k] - bg[0], eg = d[k + 1] - bg[1], eb = d[k + 2] - bg[2];
      if (er * er + eg * eg + eb * eb > tol) continue;
      seen[p] = 1; d[k + 3] = 0;
      var px = p % W, py = (p - px) / W;
      if (px > 0) stack.push(p - 1);
      if (px < W - 1) stack.push(p + 1);
      if (py > 0) stack.push(p - W);
      if (py < H - 1) stack.push(p + W);
    }
  }
  flood(TOL);

  // Two ways this goes wrong, and they are opposite. On line art the flood
  // walks through every gap in the engraving and eats the design from the
  // inside. On a small object photographed on a big sheet, keying most of the
  // frame is exactly right. So judge by what SURVIVED, not by what went.
  var keyed = 0;
  for (var k = 0; k < W * H; k++) if (seen[k]) keyed++;
  var left = 1 - keyed / (W * H);
  if (left < 0.08) return null;                       // the design went with it
  if (left > 0.94) return null;                       // nothing was keyed at all

  // Soften the key so the cut edge is not a jagged one-pixel step.
  var alpha = Buffer.alloc(W * H);
  for (var a2 = 0; a2 < W * H; a2++) alpha[a2] = d[a2 * 4 + 3];
  var blurred2 = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
    .blur(0.6).raw().toBuffer();
  for (var b2 = 0; b2 < W * H; b2++) d[b2 * 4 + 3] = blurred2[b2];

  // Quantised: these are flat inks and engraved line, not photographs, so a
  // palette costs nothing visible and keeps a keyed stamp from outweighing the
  // painting it sits next to.
  return sharp(d, { raw: { width: W, height: H, channels: 4 } })
    .trim({ threshold: 1 })
    .png({ compressionLevel: 9, effort: 9 })
    .toBuffer();
}

(async function main() {
  if (!fs.existsSync(GEN)) { console.error("no art/gen/ — run the generator first"); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });

  var wanted = process.argv.slice(2);
  var files = fs.readdirSync(GEN).filter(function (f) { return /\.png$/i.test(f); });
  if (wanted.length) files = files.filter(function (f) { return wanted.indexOf(f.replace(/\.png$/i, "")) !== -1; });
  if (!files.length) { console.error("nothing to treat"); process.exit(1); }

  for (var i = 0; i < files.length; i++) {
    var id = files[i].replace(/\.png$/i, "");
    var brief = briefFor(id);
    if (!brief) { console.log(id.padEnd(22) + "— no brief, skipped"); continue; }
    var proc = brief.treat || PROCESS[brief.register];
    if (!proc) { console.log(id.padEnd(22) + "— register '" + brief.register + "' has no process, skipped"); continue; }

    var src = fs.readFileSync(path.join(GEN, files[i]));
    var meta = await sharp(src).metadata();
    var cap = (brief.treat || PROCESS[brief.register]) === "scene" ? SCENE_EDGE : MAX_EDGE;
    var scale = Math.min(1, cap / Math.max(meta.width, meta.height));
    var w = Math.round(meta.width * scale), h = Math.round(meta.height * scale);

    var out, ext;
    if (proc === "pluck") {
      out = await pluck(src, w, h, 0.055); ext = "png";
      if (!out) { console.log(id.padEnd(22) + "nothing survived the pluck, skipped"); continue; }
    }
    else if (proc === "scene") { out = await scene(src, w, h); ext = "jpg"; }
    else if (proc === "chromo") { out = await chromo(src, w, h); ext = "jpg"; }
    else if (proc === "plate") { out = await plate(src, w, h); ext = "jpg"; }
    else if (proc === "multiply") { out = await multiply(src, w, h); ext = "jpg"; }
    else {
      out = await cutout(src, w, h, brief.register === "painted-object" ? 0.045 : 0); ext = "png";
      if (!out) {                       // fill leaked — ship it opaque instead
        console.log(id.padEnd(22) + "cutout leaked, falling back to multiply");
        out = await multiply(src, w, h); ext = "jpg"; proc = "multiply*";
      }
    }

    var dest = path.join(OUT, id + "." + ext);
    fs.writeFileSync(dest, out);
    console.log(id.padEnd(22) + proc.padEnd(9) +
      (src.length / 1024).toFixed(0) + " KB → " + (out.length / 1024).toFixed(0) + " KB  " + w + "×" + h);
  }
})().catch(function (e) { console.error("fatal:", e.message); process.exit(1); });
