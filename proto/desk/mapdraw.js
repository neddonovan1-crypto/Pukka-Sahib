/* The district, drawn as a Survey of India quarter-inch sheet.

   The hatching engine from the engraving spike, grown up into a survey plate.
   Tone is line spacing, texture is angle, hills are hachured down the flank of
   a ridge and never radiate from a crest. Everything — the river's meander, the
   canal's distributaries, every village and grove and tank — is generated from
   the seed and the tehsil data, so the same district draws identically every
   time and redraws when its condition changes, which is the whole reason this
   is code and not a picture.

   Hierarchy of weight is what keeps a busy sheet readable:
     district boundary  >  river bank & railway  >  metalled road  >
     canal & tehsil boundary  >  cart track  >  symbols  >  stipple.

   drawDistrict(canvas, {seed, tehsils, selected, title, sub, compact})       */
"use strict";

var INK = "#221c12", PAPER = "#efe7ce", SEAL = "#8f2f22";
var SERIF = '"Iowan Old Style", Palatino, Georgia, serif';
var MONO = '"Courier New", monospace';

/* ------------------------------------------------------------------ maths */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function smoothstep(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

// Value noise on a 64² lattice — the only source of smooth irregularity.
function makeNoise(rng) {
  var G = 64, g = new Float32Array(G * G), i;
  for (i = 0; i < G * G; i++) g[i] = rng();
  function sm(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function n2(x, y) {
    var xf = Math.floor(x), yf = Math.floor(y), tx = sm(x - xf), ty = sm(y - yf);
    var x0 = xf & 63, x1 = (xf + 1) & 63, y0 = (yf & 63) * G, y1 = ((yf + 1) & 63) * G;
    return lerp(lerp(g[y0 + x0], g[y0 + x1], tx), lerp(g[y1 + x0], g[y1 + x1], tx), ty);
  }
  n2.fbm = function (x, y, oct) {
    var s = 0, a = .5, f = 1, tot = 0;
    for (var k = 0; k < (oct || 3); k++) { s += a * n2(x * f, y * f); tot += a; f *= 2.03; a *= .5; }
    return s / tot;
  };
  return n2;
}

/* ------------------------------------------------------------- polylines */

function chaikin(pts, n, closed) {
  for (var k = 0; k < n; k++) {
    var out = [], lim = closed ? pts.length : pts.length - 1;
    if (!closed) out.push(pts[0]);
    for (var i = 0; i < lim; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]);
      out.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    if (!closed) out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  var out = [pts[0].slice()], cur = pts[0].slice(), idx = 1, need = step, guard = 0;
  while (idx < pts.length && guard++ < 40000) {
    var b = pts[idx], d = dist(cur, b);
    if (d < need) { need -= d; cur = b.slice(); idx++; continue; }
    var t = need / (d || 1);
    cur = [cur[0] + (b[0] - cur[0]) * t, cur[1] + (b[1] - cur[1]) * t];
    out.push(cur.slice());
    need = step;
  }
  var end = pts[pts.length - 1];
  if (dist(out[out.length - 1], end) > step * .35) out.push(end.slice());
  return out;
}

function tangentAt(pts, i) {
  var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return [dx / L, dy / L];
}

// offset a polyline by d (number, or fn(t) of the 0..1 station)
function offsetPath(pts, d) {
  var out = [];
  for (var i = 0; i < pts.length; i++) {
    var t = tangentAt(pts, i), s = pts.length > 1 ? i / (pts.length - 1) : 0;
    var dd = typeof d === "function" ? d(s, i) : d;
    out.push([pts[i][0] - t[1] * dd, pts[i][1] + t[0] * dd]);
  }
  return out;
}

// midpoint displacement then Chaikin — how every natural line here is born
function meander(rng, a, b, rough, levels, smoothing) {
  var pts = [a.slice(), b.slice()];
  for (var k = 0; k < (levels || 5); k++) {
    var out = [pts[0]];
    for (var i = 0; i < pts.length - 1; i++) {
      var p = pts[i], q = pts[i + 1];
      var dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1;
      var amp = L * rough * (rng() - .5) * 2;
      out.push([(p[0] + q[0]) / 2 - dy / L * amp, (p[1] + q[1]) / 2 + dx / L * amp]);
      out.push(q);
    }
    pts = out;
  }
  return chaikin(pts, smoothing == null ? 3 : smoothing);
}

function polyBounds(p) {
  var a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (var i = 0; i < p.length; i++) {
    if (p[i][0] < a) a = p[i][0]; if (p[i][1] < b) b = p[i][1];
    if (p[i][0] > c) c = p[i][0]; if (p[i][1] > d) d = p[i][1];
  }
  return { x: a, y: b, w: c - a, h: d - b };
}

function pointInPoly(x, y, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSeg(px, py, a, b) {
  var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  if (L2 < 1e-9) return Math.hypot(px - a[0], py - a[1]);
  var t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L2, 0, 1);
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}
function distToPath(px, py, pts) {
  var m = 1e9;
  for (var i = 1; i < pts.length; i++) { var d = distToSeg(px, py, pts[i - 1], pts[i]); if (d < m) m = d; }
  return m;
}

// Voronoi by half-plane clipping — tehsils from their headquarters.
function clipHalf(poly, a, b) {
  var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = b[0] - a[0], ny = b[1] - a[1], out = [];
  function side(p) { return (p[0] - mx) * nx + (p[1] - my) * ny; }
  for (var i = 0; i < poly.length; i++) {
    var p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
    if (sp <= 0) out.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
      var t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/* --------------------------------------------------------------- marking */

// The burin: a stroke that swells through its belly and lifts at both ends.
function stroke(ctx, pts, w, alpha, col) {
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = col || INK; ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  if (pts.length > 5 && w >= 1.1) {
    var a = Math.floor(pts.length * .28), b = Math.ceil(pts.length * .72);
    ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]);
    for (var j = a + 1; j < b; j++) ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.lineWidth = w * 1.26; ctx.globalAlpha = (alpha == null ? 1 : alpha) * .5; ctx.stroke();
  }
  ctx.restore();
}

function wobbly(x1, y1, x2, y2, amp, rng, seg) {
  var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < .001) return [[x1, y1], [x2, y2]];
  var n = Math.max(2, Math.min(90, Math.round(len / (seg || 14))));
  var px = -dy / len, py = dx / len, pts = [], phase = rng() * 6.28, freq = .35 + rng() * .5;
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    var off = Math.sin(phase + t * freq * 3.1) * amp + (rng() - .5) * amp * .35;
    off *= Math.sin(Math.PI * clamp(t, 0, 1)) * .8 + .2;
    pts.push([x1 + dx * t + px * off, y1 + dy * t + py * off]);
  }
  return pts;
}

function polyPath(ctx, poly, rng, amp) {
  ctx.beginPath();
  for (var i = 0; i < poly.length; i++) {
    var p = poly[i], q = poly[(i + 1) % poly.length];
    if (i === 0) ctx.moveTo(p[0], p[1]);
    if (amp && rng) {
      var pts = wobbly(p[0], p[1], q[0], q[1], amp, rng, 16);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
    } else ctx.lineTo(q[0], q[1]);
  }
  ctx.closePath();
}

function pathOf(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
}

// Stipple with a spacing (not a magic density) so it scales predictably.
function stipple(ctx, b, spacing, rng, o) {
  o = o || {};
  var n = Math.round(b.w * b.h / (spacing * spacing));
  if (n <= 0) return;
  n = Math.min(n, o.cap || 9000);
  var mask = o.mask, size = o.size || .55, jit = o.sizeJitter == null ? .5 : o.sizeJitter;
  ctx.save(); ctx.fillStyle = o.colour || INK; ctx.globalAlpha = o.alpha == null ? .62 : o.alpha;
  for (var i = 0; i < n; i++) {
    var x = b.x + rng() * b.w, y = b.y + rng() * b.h;
    if (mask && !mask(x, y)) continue;
    var r = size * (1 - jit / 2 + rng() * jit);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
}

// Map lettering is masked out of the linework beneath it.
function label(ctx, text, x, y, o) {
  o = o || {};
  ctx.save();
  ctx.translate(x, y); ctx.rotate(o.rot || 0);
  ctx.font = o.font || '600 12px ' + SERIF;
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  var sp = o.track == null ? 2 : o.track, chars = String(text).split(""), total = 0, i;
  for (i = 0; i < chars.length; i++) total += ctx.measureText(chars[i]).width + sp;
  var cur = -total / 2;
  if (o.halo) {
    ctx.strokeStyle = o.haloColour || PAPER; ctx.lineWidth = o.halo;
    ctx.lineJoin = "round"; ctx.miterLimit = 2;
    ctx.globalAlpha = o.haloAlpha == null ? 1 : o.haloAlpha;
    var c2 = cur;
    for (i = 0; i < chars.length; i++) { ctx.strokeText(chars[i], c2, 0); c2 += ctx.measureText(chars[i]).width + sp; }
  }
  ctx.fillStyle = o.colour || INK; ctx.globalAlpha = o.alpha == null ? .95 : o.alpha;
  for (i = 0; i < chars.length; i++) { ctx.fillText(chars[i], cur, 0); cur += ctx.measureText(chars[i]).width + sp; }
  ctx.restore();
}

// Lettering laid along a path, as a river's name is.
function labelAlong(ctx, text, pts, t, o) {
  var idx = clamp(Math.round(t * (pts.length - 1)), 0, pts.length - 1);
  var p = pts[idx], tan = tangentAt(pts, idx);
  var ang = Math.atan2(tan[1], tan[0]);
  if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
  o = o || {}; o.rot = ang;
  var off = o.side == null ? -6 : o.side;
  label(ctx, text, p[0] - Math.sin(ang) * off, p[1] + Math.cos(ang) * off, o);
}

/* ------------------------------------------------------------ vocabulary */

var RIVERS = ["SONAI", "DAMUNI", "BARUNA", "ROHINI", "PALAS", "KHERI", "NAGRI", "SARJU"];
var HILLNAMES = ["KAIMUR", "BARWA", "GIRDHA", "PANCHET", "SIRIS", "TILAIYA"];

/* ----------------------------------------------------------------- plate */

function drawDistrict(cv, opts) {
  var t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
  var W = cv.width / 2, H = cv.height / 2;          // authored at half backing size
  var ctx = cv.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(2, 2); ctx.clearRect(0, 0, W, H);
  var rng = mulberry32(opts.seed || 20251115);
  var noise = makeNoise(mulberry32((opts.seed || 20251115) ^ 0x5bf03635));
  var compact = !!opts.compact;
  var T = opts.tehsils || [];
  var sel = opts.selected || [];
  // detail scale: how large a mark may be before it stops looking engraved
  var S = compact ? 1 : clamp(Math.min(W / 780, H / 470), .6, 1.3);

  /* -- the paper ------------------------------------------------------- */
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  var fibres = Math.round(W * H / 900);
  for (var fi = 0; fi < fibres; fi++) {
    ctx.fillStyle = rng() < .5 ? "rgba(120,95,45,.09)" : "rgba(255,250,235,.11)";
    ctx.fillRect(rng() * W, rng() * H, 1, rng() < .12 ? 2 : 1);
  }

  /* -- the neat lines and the margin ----------------------------------- */
  var M = compact ? 3.5 : Math.round(12 * S);
  var band = compact ? 0 : Math.max(3, 3.4 * S);
  var neat = { x: M + band + 3, y: M + band + 3, w: W - 2 * (M + band + 3), h: H - 2 * (M + band + 3) };
  var inner = {
    x: neat.x + (compact ? 3 : 10 * S), y: neat.y + (compact ? 3 : 9 * S),
    w: neat.w - (compact ? 6 : 20 * S), h: neat.h - (compact ? 6 : 18 * S)
  };

  /* -- the district ---------------------------------------------------- */
  var cx = inner.x + inner.w / 2, cy = inner.y + inner.h * .49;
  var rx = inner.w * .49, ry = inner.h * .485;
  var outline = [], a, nOut = 78;
  for (var oi = 0; oi < nOut; oi++) {
    a = oi / nOut * Math.PI * 2;
    var nn = .82 + .12 * Math.sin(a * 2.7 + 1.2) + .07 * Math.sin(a * 4.3 + .4)
      + .045 * Math.sin(a * 7.9 + 2.1)
      + (noise.fbm(Math.cos(a) * 2.4 + 9, Math.sin(a) * 2.4 + 9, 3) - .5) * .18;
    outline.push([cx + Math.cos(a) * rx * nn, cy + Math.sin(a) * ry * nn]);
  }
  var obounds = polyBounds(outline);
  function inDistrict(x, y) { return pointInPoly(x, y, outline); }

  var sites = T.map(function (t) { return [inner.x + t.x * inner.w, inner.y + t.y * inner.h]; });
  var cells = sites.map(function (sp, i) {
    var poly = outline.slice();
    sites.forEach(function (op, j) { if (i !== j) poly = clipHalf(poly, sp, op); });
    return poly;
  });

  /* -- the river ------------------------------------------------------- */
  var ry0 = cy + inner.h * (.05 + rng() * .10);
  var ry1 = cy + inner.h * (.12 + rng() * .14);
  var river = resample(meander(rng, [neat.x - 10, ry0], [neat.x + neat.w + 10, ry1], .155, 5, 3), 3.2);
  var hwBase = compact ? 1.3 : 2.4 * S, hwEnd = compact ? 3.2 : 9.5 * S;
  function halfWidth(s) {
    return lerp(hwBase, hwEnd, Math.pow(clamp(s, 0, 1), .75)) * (.8 + .4 * noise.fbm(s * 11 + 3, 21, 2));
  }
  var bankN = offsetPath(river, function (s) { return -halfWidth(s); });
  var bankS = offsetPath(river, function (s) { return halfWidth(s); });

  // Tributaries out of the higher ground, joining at an angle.
  var tribs = [];
  for (var ti = 0; ti < (compact ? 1 : 2); ti++) {
    var jt = .26 + ti * .33 + rng() * .10;
    var ji = clamp(Math.round(jt * (river.length - 1)), 2, river.length - 3);
    var jp = river[ji], up = ti % 2 === 0 ? -1 : 1;
    var reach = inner.h * (.30 + rng() * .20);
    var head = [jp[0] - reach * (.4 + rng() * .5), jp[1] + up * reach];
    tribs.push({
      pts: resample(meander(rng, head, [jp[0], jp[1] + up * halfWidth(jt) * .5], .15, 4, 3), 3.2),
      w: 1.0 + rng() * .8
    });
  }

  /* -- the hills ------------------------------------------------------- */
  // A ridge system in the north-west: one spine with spurs off it, so the
  // hachures always have a flank to run down and never a cone to radiate from.
  function pickCorner(cands, avoid, avoidR) {
    var best = cands[0], bs = -1;
    cands.forEach(function (c) {
      var p = [inner.x + c[0] * inner.w, inner.y + c[1] * inner.h], m = 1e9;
      avoid.forEach(function (q) { m = Math.min(m, dist(p, q)); });
      m += (c[2] || 0) * inner.w;
      if (m > bs) { bs = m; best = c; }
    });
    return [inner.x + best[0] * inner.w, inner.y + best[1] * inner.h];
  }
  var hillC = pickCorner([[.15, .19], [.16, .80], [.85, .19], [.84, .81], [.50, .13]], sites);
  var hillR = [inner.w * (.23 + rng() * .04), inner.h * (.24 + rng() * .04)];
  var ridges = [];
  (function () {
    var dir = -.62 + (rng() - .5) * .5, step = hillR[0] * .34;
    var sx = hillC[0] - Math.cos(dir) * hillR[0] * .75, sy = hillC[1] - Math.sin(dir) * hillR[1] * .75;
    var spine = [[sx, sy]];
    for (var i = 0; i < 6; i++) {
      dir += (rng() - .5) * .48;
      sx += Math.cos(dir) * step; sy += Math.sin(dir) * step * .8;
      spine.push([sx, sy]);
    }
    ridges.push({ pts: chaikin(spine, 2), amp: 1, w: (12 + rng() * 4) * (compact ? 1.4 : S) });
    var nSpur = compact ? 3 : 7;
    for (var s = 0; s < nSpur; s++) {
      var at = 1 + Math.floor(rng() * (spine.length - 2));
      var base = spine[at], side = rng() < .5 ? 1 : -1;
      var bd = Math.atan2(spine[at + 1][1] - spine[at - 1][1], spine[at + 1][0] - spine[at - 1][0])
        + side * (1.0 + rng() * .55);
      var pts = [base.slice()], px = base[0], py = base[1], slen = hillR[0] * (.30 + rng() * .28);
      for (var k = 0; k < 3; k++) {
        bd += (rng() - .5) * .45;
        px += Math.cos(bd) * slen / 3; py += Math.sin(bd) * slen / 3 * .85;
        pts.push([px, py]);
      }
      ridges.push({ pts: chaikin(pts, 2), amp: .6 + rng() * .3, w: (7.5 + rng() * 3.5) * (compact ? 1.4 : S) });
    }
  })();
  function hillMask(x, y) {
    var dx = (x - hillC[0]) / hillR[0], dy = (y - hillC[1]) / hillR[1];
    var d = Math.hypot(dx, dy) * (.88 + .26 * noise.fbm(x / 40 + 3, y / 40 + 7, 2));
    return 1 - smoothstep(.62, 1.18, d);
  }
  function rawHeight(x, y) {
    var m = hillMask(x, y);
    if (m <= .002) return 0;
    var v = 0;
    for (var i = 0; i < ridges.length; i++) {
      var R = ridges[i], d = distToPath(x, y, R.pts);
      var h = R.amp * Math.exp(-(d * d) / (2 * R.w * R.w));
      if (h > v) v = h;
    }
    if (v < .004) return 0;
    return v * m * (.84 + .32 * noise.fbm(x / 30 + 41, y / 30 + 13, 3));
  }
  // sampled onto a grid once — the hachure pass then costs a lookup, not a search
  var HG = compact ? 2.4 : 2.0;
  var hx0 = hillC[0] - hillR[0] * 1.3, hy0 = hillC[1] - hillR[1] * 1.3;
  var hgw = Math.ceil(hillR[0] * 2.6 / HG) + 2, hgh = Math.ceil(hillR[1] * 2.6 / HG) + 2;
  var hgrid = new Float32Array(hgw * hgh);
  for (var gj = 0; gj < hgh; gj++)
    for (var gi = 0; gi < hgw; gi++)
      hgrid[gj * hgw + gi] = rawHeight(hx0 + gi * HG, hy0 + gj * HG);
  function height(x, y) {
    var u = (x - hx0) / HG, v = (y - hy0) / HG;
    var i0 = Math.floor(u), j0 = Math.floor(v);
    if (i0 < 0 || j0 < 0 || i0 >= hgw - 1 || j0 >= hgh - 1) return 0;
    var tu = u - i0, tv = v - j0, o = j0 * hgw + i0;
    return lerp(lerp(hgrid[o], hgrid[o + 1], tu), lerp(hgrid[o + hgw], hgrid[o + hgw + 1], tu), tv);
  }
  function grad(x, y) {
    return [(height(x + HG, y) - height(x - HG, y)) / (2 * HG),
            (height(x, y + HG) - height(x, y - HG)) / (2 * HG)];
  }

  /* -- the canal ------------------------------------------------------- */
  var canalT = .20 + rng() * .14;
  var canalHead = river[clamp(Math.round(canalT * (river.length - 1)), 0, river.length - 1)];
  var canalEnd = [neat.x + neat.w * (.80 + rng() * .08), neat.y + neat.h * (.84 + rng() * .08)];
  var canal = resample(meander(rng, [canalHead[0], canalHead[1] + halfWidth(canalT)], canalEnd, .03, 3, 3), 4);
  var distribs = [];
  for (var di = 0; di < (compact ? 0 : 5); di++) {
    var dt = .16 + di * .16 + rng() * .05;
    var dIdx = clamp(Math.round(dt * (canal.length - 1)), 1, canal.length - 2);
    var dp = canal[dIdx], dtan = tangentAt(canal, dIdx), sgn = di % 2 ? 1 : -1;
    var ba = Math.atan2(dtan[1], dtan[0]) + sgn * (.48 + rng() * .3);
    var blen = inner.w * (.10 + rng() * .08);
    var bend = [dp[0] + Math.cos(ba) * blen, dp[1] + Math.sin(ba) * blen];
    while (!pointInPoly(bend[0], bend[1], outline) && blen > 8) {
      blen *= .8; bend = [dp[0] + Math.cos(ba) * blen, dp[1] + Math.sin(ba) * blen];
    }
    var br = resample(meander(rng, dp, bend, .04, 3, 3), 4);
    distribs.push({ pts: br, order: 1 });
    for (var sd = 0; sd < 2; sd++) {
      if (rng() < .25) continue;
      var mi = Math.round(br.length * (.35 + sd * .3 + rng() * .18));
      var mp = br[clamp(mi, 1, br.length - 2)], mt = tangentAt(br, clamp(mi, 1, br.length - 2));
      var ma = Math.atan2(mt[1], mt[0]) + (sd ? 1 : -1) * (.5 + rng() * .4);
      var ml = blen * (.32 + rng() * .26);
      distribs.push({
        pts: resample(meander(rng, mp, [mp[0] + Math.cos(ma) * ml, mp[1] + Math.sin(ma) * ml], .05, 3, 3), 4),
        order: 2
      });
    }
  }

  /* -- the metalled road, headquarters strung along it ------------------ */
  var order = [];
  if (sites.length) {
    var remaining = sites.map(function (_, i) { return i; });
    var start = remaining.reduce(function (bi, i) { return sites[i][0] < sites[bi][0] ? i : bi; }, remaining[0]);
    var cur0 = start; order.push(cur0); remaining.splice(remaining.indexOf(cur0), 1);
    while (remaining.length) {
      var best = remaining[0], bd = 1e9;
      /*jshint loopfunc:true */
      remaining.forEach(function (i) { var d = dist(sites[cur0], sites[i]); if (d < bd) { bd = d; best = i; } });
      order.push(best); remaining.splice(remaining.indexOf(best), 1); cur0 = best;
    }
  }
  var legs = [];
  for (var li = 0; li < order.length - 1; li++)
    legs.push(resample(meander(rng, sites[order[li]], sites[order[li + 1]], .07, 3, 3), 4));
  var tails = [];
  if (order.length) {
    var firstS = sites[order[0]], lastS = sites[order[order.length - 1]];
    tails.push(resample(meander(rng, [neat.x - 8, firstS[1] + (rng() - .5) * inner.h * .14], firstS, .03, 3, 3), 4));
    tails.push(resample(meander(rng, lastS, [neat.x + neat.w + 8, lastS[1] + (rng() - .5) * inner.h * .14], .03, 3, 3), 4));
  }
  var metalled = tails.slice(0, 1).concat(legs, tails.slice(1));

  /* -- the railway ----------------------------------------------------- */
  var rail = resample(meander(rng,
    [neat.x - 8, neat.y + neat.h * (.80 + rng() * .10)],
    [neat.x + neat.w + 8, neat.y + neat.h * (.15 + rng() * .14)], .02, 3, 3), 4);

  /* -- the reserved forest --------------------------------------------- */
  var forestC = pickCorner([[.78, .22], [.22, .20], [.78, .76], [.24, .78]], sites.concat([hillC]));
  var fRx = inner.w * (.13 + rng() * .04), fRy = inner.h * (.15 + rng() * .05);
  var forestPoly = [];
  for (var fj = 0; fj < 30; fj++) {
    var fa = fj / 30 * Math.PI * 2;
    var fn = .66 + .32 * noise.fbm(Math.cos(fa) * 3 + 30, Math.sin(fa) * 3 + 30, 3);
    forestPoly.push([forestC[0] + Math.cos(fa) * fRx * fn, forestC[1] + Math.sin(fa) * fRy * fn]);
  }
  forestPoly = chaikin(forestPoly, 1, true);

  /* -- what is water, cheaply ------------------------------------------ */
  var GC = 3, gw = Math.ceil(W / GC) + 2, gh = Math.ceil(H / GC) + 2;
  var water = new Uint8Array(gw * gh);
  function markWater(pts, wfn, pad) {
    for (var i = 0; i < pts.length; i++) {
      var r = (typeof wfn === "function" ? wfn(i / (pts.length - 1)) : wfn) + (pad || 0);
      var x = pts[i][0], y = pts[i][1];
      var a0 = Math.max(0, Math.floor((x - r) / GC)), a1 = Math.min(gw - 1, Math.ceil((x + r) / GC));
      var b0 = Math.max(0, Math.floor((y - r) / GC)), b1 = Math.min(gh - 1, Math.ceil((y + r) / GC));
      for (var j = b0; j <= b1; j++) for (var k = a0; k <= a1; k++) {
        var dx = k * GC - x, dy = j * GC - y;
        if (dx * dx + dy * dy <= r * r) water[j * gw + k] = 1;
      }
    }
  }
  markWater(river, halfWidth, 2.5);
  tribs.forEach(function (t) { markWater(t.pts, t.w + 1.5, 1.5); });
  markWater(canal, 2, 1.5);
  function isWater(x, y) {
    var k = Math.round(x / GC), j = Math.round(y / GC);
    if (k < 0 || j < 0 || k >= gw || j >= gh) return false;
    return water[j * gw + k] === 1;
  }

  /* -- villages, strung along the roads and the water ------------------- */
  var villages = [];
  var VG = 10, vgw = Math.ceil(W / VG) + 2, vgh = Math.ceil(H / VG) + 2;
  var vgrid = [];
  function vgAt(x, y) {
    var k = clamp(Math.floor(x / VG), 0, vgw - 1), j = clamp(Math.floor(y / VG), 0, vgh - 1);
    return j * vgw + k;
  }
  function tooClose(x, y, r) {
    var k = Math.floor(x / VG), j = Math.floor(y / VG), span = Math.ceil(r / VG);
    for (var b = j - span; b <= j + span; b++) for (var c = k - span; c <= k + span; c++) {
      var cellv = vgrid[b * vgw + c];
      if (!cellv) continue;
      for (var i = 0; i < cellv.length; i++)
        if (Math.hypot(cellv[i].x - x, cellv[i].y - y) < r) return true;
    }
    return false;
  }
  function tryVillage(x, y, big) {
    if (!inDistrict(x, y)) return;
    if (isWater(x, y)) return;
    if (height(x, y) > .30) return;
    if (tooClose(x, y, 11 * S)) return;
    for (var i = 0; i < sites.length; i++) if (dist([x, y], sites[i]) < 17 * S) return;
    var v = { x: x, y: y, big: !!big };
    villages.push(v);
    var idx = vgAt(x, y);
    (vgrid[idx] || (vgrid[idx] = [])).push(v);
  }
  if (!compact) {
    var stringers = metalled.concat([bankN, bankS, canal]).concat(tribs.map(function (t) { return t.pts; }));
    stringers.forEach(function (path, pi) {
      if (!path || path.length < 5) return;
      for (var i = 3; i < path.length - 3; i += 3) {
        if (rng() < .5) continue;
        var t = tangentAt(path, i), side = rng() < .5 ? 1 : -1, off = (3 + rng() * 8) * side;
        tryVillage(path[i][0] - t[1] * off, path[i][1] + t[0] * off, rng() < .14);
      }
    });
    for (var vs = 0; vs < Math.round(300 * S); vs++)
      tryVillage(obounds.x + rng() * obounds.w, obounds.y + rng() * obounds.h, rng() < .06);
  }

  /* -- cart tracks: the web that actually joins the villages ------------ */
  var tracks = [];
  if (!compact && villages.length) {
    var nodes = villages.map(function (v) { return [v.x, v.y]; }).concat(sites);
    var seen = {}, maxLen = inner.w * .19;
    nodes.forEach(function (na, i) {
      var ds = [];
      for (var j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        var d = dist(na, nodes[j]);
        if (d < maxLen) ds.push([d, j]);
      }
      ds.sort(function (p, q) { return p[0] - q[0]; });
      var k = 1 + (rng() < .28 ? 1 : 0);
      for (var m = 0; m < k && m < ds.length; m++) {
        var key = Math.min(i, ds[m][1]) + ":" + Math.max(i, ds[m][1]);
        if (seen[key]) continue;
        seen[key] = 1;
        tracks.push(resample(meander(rng, na, nodes[ds[m][1]], .10, 3, 2), 5));
      }
    });
  }

  /* ==================================================================== *
   *  Ink on the plate, weakest first.                                    *
   * ==================================================================== */

  /* -- 1. cultivation, tehsil by tehsil --------------------------------- */
  cells.forEach(function (poly, i) {
    if (poly.length < 3) return;
    var cond = T[i].cond == null ? .25 : T[i].cond;
    var b = polyBounds(poly);
    ctx.save(); polyPath(ctx, poly, null, 0); ctx.clip();
    var sp = (compact ? lerp(2.6, 7.5, cond) : lerp(3.0, 9.5, cond) / S);
    var thr = lerp(.10, .70, cond);
    function open(x, y) {
      return !isWater(x, y) && height(x, y) < .13;
    }
    stipple(ctx, b, sp, rng, {
      size: compact ? .46 : .48 * (1 + .25 * S), alpha: lerp(.6, .38, cond),
      cap: compact ? 2600 : 14000,
      mask: function (x, y) { return open(x, y) && noise.fbm(x / 44 + 11, y / 44 + 5, 4) > thr; }
    });
    if (!compact) {
      // field blocks: the woven look of a settled plain, thinning as it fails
      var nBlocks = Math.round(b.w * b.h / 900 * (1 - cond * .9));
      for (var fb2 = 0; fb2 < nBlocks; fb2++) {
        var bx5 = b.x + rng() * b.w, by5 = b.y + rng() * b.h;
        if (!open(bx5, by5)) continue;
        if (noise.fbm(bx5 / 44 + 11, by5 / 44 + 5, 4) < thr + .03) continue;
        var ang2 = rng() * Math.PI, ln = (3.5 + rng() * 4.5) * S, gap2 = 1.1 + rng() * .7;
        var ca = Math.cos(ang2), sa2 = Math.sin(ang2);
        for (var q3 = -1; q3 <= 1; q3++) {
          var ox2 = bx5 - sa2 * q3 * gap2, oy2 = by5 + ca * q3 * gap2;
          stroke(ctx, [[ox2 - ca * ln / 2, oy2 - sa2 * ln / 2], [ox2 + ca * ln / 2, oy2 + sa2 * ln / 2]],
            .26, .34 + rng() * .16);
        }
      }
      // scrub creeping in where the cultivation has gone
      if (cond > .45) {
        var nScrub = Math.round(b.w * b.h / 2200 * (cond - .4));
        for (var s2 = 0; s2 < nScrub; s2++) {
          var x2 = b.x + rng() * b.w, y2 = b.y + rng() * b.h;
          if (!open(x2, y2)) continue;
          if (noise.fbm(x2 / 44 + 11, y2 / 44 + 5, 4) > thr) continue;
          var sa3 = rng() * .6 - .3;
          stroke(ctx, [[x2 - 1.5, y2 + 1], [x2 + Math.sin(sa3) * .6, y2 - 1.7]], .3, .5);
          stroke(ctx, [[x2 + 1.5, y2 + 1], [x2 + Math.sin(sa3) * .6, y2 - 1.7]], .3, .5);
        }
      }
    }
    ctx.restore();
  });

  /* -- 2. the tint band inside the district boundary -------------------- */
  (function () {
    ctx.save(); polyPath(ctx, outline, null, 0); ctx.clip();
    ctx.fillStyle = INK; ctx.globalAlpha = compact ? .3 : .45;
    var reach2 = compact ? 4 : 9 * S, per = compact ? 3 : 9;
    for (var i = 0; i < outline.length; i++) {
      var p = outline[i];
      var dxv = cx - p[0], dyv = cy - p[1], L = Math.hypot(dxv, dyv) || 1;
      for (var q = 0; q < per; q++) {
        var t = Math.pow(rng(), 1.7) * reach2;
        var jx = (rng() - .5) * 7, jy = (rng() - .5) * 7;
        ctx.beginPath();
        ctx.arc(p[0] + dxv / L * t + jx, p[1] + dyv / L * t + jy, compact ? .4 : .5, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.restore();
  })();

  /* -- 3. the reserved forest ------------------------------------------- */
  if (!compact) {
    var fbnd = polyBounds(forestPoly);
    ctx.save();
    polyPath(ctx, outline, null, 0); ctx.clip();
    ctx.save();
    polyPath(ctx, forestPoly, null, 0); ctx.clip();
    stipple(ctx, fbnd, 3.0 / S, rng, { size: .6, alpha: .5, cap: 7000 });
    for (var ft = 0; ft < Math.round(fbnd.w * fbnd.h / 380); ft++) {
      var fx = fbnd.x + rng() * fbnd.w, fy = fbnd.y + rng() * fbnd.h;
      ctx.save(); ctx.globalAlpha = .6; ctx.strokeStyle = INK; ctx.lineWidth = .34;
      ctx.beginPath(); ctx.arc(fx, fy, .9 + rng() * .8, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + 1.4); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.setLineDash([2.4, 2.2]); ctx.strokeStyle = INK;
    ctx.globalAlpha = .6; ctx.lineWidth = .6;
    polyPath(ctx, forestPoly, rng, .5); ctx.stroke();
    ctx.restore();
  }

  /* -- 4. the hills, hachured down the flank ---------------------------- */
  // Rows are laid between contour levels along each ridge's flank: the gap
  // between rows narrows where the ground steepens, which is what makes the
  // tone. Because every stroke is hung off a spine it can never radiate.
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x, neat.y, neat.w, neat.h); ctx.clip();
    var dh = compact ? .15 : .085;                     // contour interval
    var along = compact ? 3.2 : 2.3 / S;
    ridges.forEach(function (R, rid) {
      var spine = resample(R.pts, along);
      for (var i = 0; i < spine.length; i++) {
        var p = spine[i], tan = tangentAt(spine, i);
        var mk = hillMask(p[0], p[1]);
        if (mk < .12) continue;
        var ampS = R.amp * mk * (.7 + .5 * noise.fbm(p[0] / 27 + 61, p[1] / 27 + 17, 2))
          * (.82 + .34 * noise.fbm(p[0] / 9 + 5, p[1] / 9 + 29, 2));
        if (ampS < dh * 1.6) continue;
        var phase = rng();                             // stagger, or it combs
        // which side of a spur belongs to the spine that made it
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          var wobbleA = (noise.fbm(p[0] / 19 + sgn * 7, p[1] / 19 + 3, 2) - .5) * .5;
          var ca = Math.cos(wobbleA), sa = Math.sin(wobbleA);
          var nx = (-tan[1] * ca - tan[0] * sa) * sgn, ny = (tan[0] * ca - tan[1] * sa) * sgn;
          var prevD = .4 + rng() * .4, k, lvl2, d;
          for (k = Math.floor((ampS / dh) - phase); k >= 1; k--) {
            lvl2 = (k + phase) * dh;
            d = R.w * Math.sqrt(2 * Math.log(ampS / lvl2));
            if (d <= prevD) { prevD = d; continue; }
            var gapd = d - prevD;
            var mx2 = p[0] + nx * (prevD + gapd / 2), my2 = p[1] + ny * (prevD + gapd / 2);
            if (hillMask(mx2, my2) < .06) break;
            // let the tallest ridge own the ground where two of them meet
            var owned = true;
            for (var q4 = 0; q4 < ridges.length && owned; q4++) {
              if (q4 === rid) continue;
              var O = ridges[q4], od = distToPath(mx2, my2, O.pts);
              if (O.amp * Math.exp(-(od * od) / (2 * O.w * O.w)) > lvl2 * 1.04) owned = false;
            }
            if (!owned) { prevD = d; continue; }
            if (rng() < .07) { prevD = d; continue; }   // the burin lifts
            var norm = clamp(3.6 / Math.max(1.1, gapd), 0, 1);
            var len = Math.min(gapd * .82, compact ? 4.2 : 5.4 * S);
            var jx2 = (rng() - .5) * .5, jy2 = (rng() - .5) * .5;
            var s0 = prevD + (gapd - len) * .5 + (rng() - .5) * .3;
            stroke(ctx, [
              [p[0] + nx * s0 + jx2, p[1] + ny * s0 + jy2],
              [p[0] + nx * (s0 + len * .55) + jx2 * .4, p[1] + ny * (s0 + len * .55) + jy2 * .4],
              [p[0] + nx * (s0 + len), p[1] + ny * (s0 + len)]
            ], lerp(.2, .55, norm) * (compact ? 1.3 : S), lerp(.4, .88, norm));
            prevD = d;
          }
        }
      }
    });
    ctx.restore();
  })();

  /* -- 5. the river ------------------------------------------------------ */
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x - 9, neat.y - 9, neat.w + 18, neat.h + 18); ctx.clip();

    // marsh along one bank, in a single stretch
    if (!compact) {
      var m0 = .42 + rng() * .16;
      var i0 = Math.round(m0 * (river.length - 1)), i1 = Math.round((m0 + .17) * (river.length - 1));
      for (var mi = i0; mi < i1 && mi < river.length; mi += 2) {
        var mp = river[mi], mt = tangentAt(river, mi);
        var hwm = halfWidth(mi / (river.length - 1));
        for (var b3 = 1; b3 <= 3; b3++) {
          if (rng() < .28) continue;
          var d2 = hwm + 3 + b3 * 4.2 + (rng() - .5) * 1.8;
          var bx2 = mp[0] + mt[1] * d2, by2 = mp[1] - mt[0] * d2;
          if (!inDistrict(bx2, by2)) continue;
          for (var dsh = -1; dsh <= 1; dsh++)
            stroke(ctx, [[bx2 - 2.1 + Math.abs(dsh) * .7, by2 + dsh * 1.5],
                         [bx2 + 2.1 - Math.abs(dsh) * .7, by2 + dsh * 1.5]], .32, .65);
        }
      }
    }

    tribs.forEach(function (t) {
      var tw = function (s) { return lerp(.45, t.w, s) * (compact ? .8 : S); };
      stroke(ctx, offsetPath(t.pts, function (s) { return -tw(s); }), compact ? .5 : .7 * S, .82);
      stroke(ctx, offsetPath(t.pts, function (s) { return tw(s); }), compact ? .5 : .7 * S, .82);
    });

    // the channel: paper back in, then the water ruled parallel to the banks
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bankN[0][0], bankN[0][1]);
    for (var b1 = 1; b1 < bankN.length; b1++) ctx.lineTo(bankN[b1][0], bankN[b1][1]);
    for (var b2 = bankS.length - 1; b2 >= 0; b2--) ctx.lineTo(bankS[b2][0], bankS[b2][1]);
    ctx.closePath();
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.clip();
    if (!compact) {
      [.52].forEach(function (f, k) {
        stroke(ctx, offsetPath(river, function (s) { return -halfWidth(s) * f; }), .28, .24);
        stroke(ctx, offsetPath(river, function (s) { return halfWidth(s) * f; }), .28, .24);
      });
    }
    ctx.restore();

    // sandbanks: lens-shaped islands, stippled, in the wider reaches
    if (!compact) {
      for (var sb = 0; sb < 3; sb++) {
        var st = .46 + sb * .17 + rng() * .05;
        var si0 = Math.round(st * (river.length - 1)), si1 = si0 + Math.round(10 + rng() * 14);
        if (si1 >= river.length - 2) continue;
        var lens = [], lat = (rng() - .5) * .55;
        for (var q = si0; q <= si1; q++) {
          var u = (q - si0) / (si1 - si0), hw2 = halfWidth(q / (river.length - 1));
          var tn = tangentAt(river, q), sw = Math.sin(Math.PI * u) * hw2 * .5;
          lens.push([river[q][0] - tn[1] * (lat * hw2 + sw), river[q][1] + tn[0] * (lat * hw2 + sw)]);
        }
        for (var q2 = si1; q2 >= si0; q2--) {
          var u2 = (q2 - si0) / (si1 - si0), hw3 = halfWidth(q2 / (river.length - 1));
          var tn2 = tangentAt(river, q2), sw2 = Math.sin(Math.PI * u2) * hw3 * .5;
          lens.push([river[q2][0] - tn2[1] * (lat * hw3 - sw2), river[q2][1] + tn2[0] * (lat * hw3 - sw2)]);
        }
        if (lens.length < 6) continue;
        ctx.save();
        polyPath(ctx, lens, null, 0);
        ctx.fillStyle = PAPER; ctx.fill(); ctx.clip();
        stipple(ctx, polyBounds(lens), 2.0, rng, { size: .5, alpha: .72, cap: 1200 });
        ctx.restore();
        ctx.save(); ctx.setLineDash([1.5, 1.7]); ctx.strokeStyle = INK;
        ctx.lineWidth = .42; ctx.globalAlpha = .75;
        polyPath(ctx, lens, null, 0); ctx.stroke(); ctx.restore();
      }
    }

    stroke(ctx, bankN, compact ? .8 : 1.25 * S, .95);
    stroke(ctx, bankS, compact ? .8 : 1.05 * S, .92);
    ctx.restore();
  })();

  /* -- 6. the canal and its distributaries ------------------------------- */
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x - 9, neat.y - 9, neat.w + 18, neat.h + 18); ctx.clip();
    distribs.forEach(function (d) {
      stroke(ctx, d.pts, d.order === 1 ? .62 * S + .12 : .3, d.order === 1 ? .85 : .6);
    });
    var gap = compact ? .8 : 1.5 * S;
    stroke(ctx, offsetPath(canal, -gap), compact ? .6 : .75 * S, .92);
    stroke(ctx, offsetPath(canal, gap), compact ? .6 : .75 * S, .92);
    if (!compact) {
      for (var lk = 0; lk < 3; lk++) {
        var lidx = Math.round((.3 + lk * .22) * (canal.length - 1));
        var lp = canal[lidx], lt = tangentAt(canal, lidx);
        stroke(ctx, [[lp[0] - lt[1] * gap * 2.1, lp[1] + lt[0] * gap * 2.1],
                     [lp[0] + lt[1] * gap * 2.1, lp[1] - lt[0] * gap * 2.1]], .75, .85);
      }
    }
    ctx.restore();
  })();

  /* -- 7. roads ---------------------------------------------------------- */
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x - 9, neat.y - 9, neat.w + 18, neat.h + 18); ctx.clip();
    tracks.forEach(function (tp) { stroke(ctx, tp, .34 + rng() * .16, .5 + rng() * .22); });
    var g3 = compact ? .9 : 1.5 * S;
    metalled.forEach(function (leg) {
      if (!leg || leg.length < 2) return;
      if (compact) { stroke(ctx, leg, 1.05, .92); return; }
      // the pale metal between the kerbs, so the road reads as a band
      ctx.save(); ctx.strokeStyle = PAPER; ctx.globalAlpha = .9;
      ctx.lineWidth = g3 * 2; ctx.lineCap = "round";
      pathOf(ctx, leg); ctx.stroke(); ctx.restore();
      stroke(ctx, offsetPath(leg, -g3), .68 * S + .2, .95);
      stroke(ctx, offsetPath(leg, g3), .68 * S + .2, .95);
    });
    ctx.restore();
  })();

  /* -- 8. the railway ---------------------------------------------------- */
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x - 9, neat.y - 9, neat.w + 18, neat.h + 18); ctx.clip();
    stroke(ctx, rail, compact ? .95 : 1.15 * S, .95);
    var tie = compact ? 2.0 : 2.8 * S;
    for (var i = 1; i < rail.length - 1; i += 2) {
      var t = tangentAt(rail, i), p = rail[i];
      stroke(ctx, [[p[0] - t[1] * tie, p[1] + t[0] * tie], [p[0] + t[1] * tie, p[1] - t[0] * tie]],
        compact ? .48 : .5 * S + .14, .85);
    }
    for (var st = 0; st < (compact ? 2 : 3); st++) {
      var sIdx = Math.round((.24 + st * .26) * (rail.length - 1));
      var sp2 = rail[sIdx], stn = tangentAt(rail, sIdx), sz = compact ? 1.5 : 2.3 * S;
      ctx.save();
      ctx.translate(sp2[0], sp2[1]); ctx.rotate(Math.atan2(stn[1], stn[0]));
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = compact ? .7 : .9;
      ctx.beginPath(); ctx.rect(-sz * 1.6, -sz * 3.0, sz * 3.2, sz * 2.0);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(0, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  })();

  /* -- 9. villages, groves, tanks ---------------------------------------- */
  if (!compact) {
    villages.forEach(function (v, vi2) {
      ctx.save();
      ctx.strokeStyle = INK; ctx.fillStyle = PAPER; ctx.lineWidth = v.big ? .75 : .55;
      ctx.globalAlpha = .93;
      var r = (v.big ? 2.0 : 1.3) * S;
      ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, 6.2832); ctx.fill(); ctx.stroke();
      if (v.big) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(v.x, v.y, r * .42, 0, 6.2832); ctx.fill(); }
      ctx.restore();
      if ((vi2 * 7 + 3) % 11 < 3) {                    // a mango grove beside it
        var gx = v.x + (rng() - .5) * 10, gy = v.y + (rng() < .5 ? -1 : 1) * (3 + rng() * 4.5);
        ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = .38; ctx.globalAlpha = .78;
        for (var g4 = 0, nT = 3 + Math.floor(rng() * 4); g4 < nT; g4++) {
          var tx2 = gx + (rng() - .5) * 7 * S, ty2 = gy + (rng() - .5) * 5 * S, tr = (1 + rng() * .7) * S;
          ctx.beginPath(); ctx.arc(tx2, ty2, tr, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(tx2, ty2 + tr * 1.5); ctx.stroke();
        }
        ctx.restore();
      }
      if ((vi2 * 5 + 1) % 13 < 2) {                    // a tank beside a few more
        var kx = v.x + (rng() - .5) * 11, ky = v.y + (rng() < .5 ? -1 : 1) * (4 + rng() * 4);
        var kw = (2.6 + rng() * 2.6) * S, kh = kw * (.5 + rng() * .3), tank = [];
        for (var kq = 0; kq < 10; kq++) {
          var ka = kq / 10 * Math.PI * 2;
          tank.push([kx + Math.cos(ka) * kw * (.85 + rng() * .3), ky + Math.sin(ka) * kh * (.85 + rng() * .3)]);
        }
        ctx.save();
        polyPath(ctx, tank, null, 0);
        ctx.fillStyle = PAPER; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = .55; ctx.globalAlpha = .9; ctx.stroke();
        ctx.clip();
        for (var kl = -kh; kl < kh; kl += 1.4)
          stroke(ctx, [[kx - kw, ky + kl], [kx + kw, ky + kl]], .26, .45);
        ctx.restore();
      }
    });
  }

  /* -- 10. boundaries ---------------------------------------------------- */
  cells.forEach(function (poly) {
    if (poly.length < 3) return;
    ctx.save();
    ctx.setLineDash(compact ? [3, 2.2, .9, 2.2] : [6, 3, 1.3, 3]);
    ctx.strokeStyle = INK; ctx.globalAlpha = compact ? .5 : .7;
    ctx.lineWidth = compact ? .6 : .85;
    polyPath(ctx, poly, rng, .8); ctx.stroke();
    ctx.restore();
  });

  (function () {                                       // the district boundary
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.lineWidth = compact ? 1.3 : 2.0 * S;
    polyPath(ctx, outline, rng, compact ? .5 : 1.0); ctx.stroke();
    ctx.restore();
  })();

  /* -- 11. feature lettering --------------------------------------------- */
  if (!compact && S > .72) {
    labelAlong(ctx, "R. " + RIVERS[Math.floor(rng() * RIVERS.length)], river, .66, {
      font: 'italic 600 ' + (9.5 * S).toFixed(1) + 'px ' + SERIF,
      track: 2.4 * S, halo: 3.6, alpha: .82, side: -(hwEnd + 7)
    });
    labelAlong(ctx, "CANAL", canal, .62, {
      font: (7.4 * S).toFixed(1) + 'px ' + SERIF, track: 2.6 * S, halo: 3.2, alpha: .6, side: -7
    });
    label(ctx, HILLNAMES[Math.floor(rng() * HILLNAMES.length)] + " HILLS",
      hillC[0], hillC[1] + hillR[1] * .78, {
        font: 'italic 600 ' + (8.5 * S).toFixed(1) + 'px ' + SERIF, track: 2.8 * S, halo: 3.8, alpha: .75
      });
    label(ctx, "RESERVED FOREST", forestC[0], forestC[1], {
      font: (6.6 * S).toFixed(1) + 'px ' + SERIF, track: 2.2 * S, halo: 3.4, alpha: .6
    });
  }

  /* -- 12. the route, following the road where it can -------------------- */
  var marks = [];
  if (sel.length > 1 && order.length) {
    var posOf = {};
    order.forEach(function (si, k) { posOf[T[si].id] = k; });
    var routeSegs = [];
    for (var si2 = 0; si2 + 1 < sel.length; si2++) {
      var pa = posOf[sel[si2]], pb = posOf[sel[si2 + 1]];
      if (pa == null || pb == null) continue;
      var stepDir = pa < pb ? 1 : -1, chain = [];
      for (var k2 = pa; k2 !== pb; k2 += stepDir) {
        var leg2 = legs[stepDir > 0 ? k2 : k2 - 1];
        if (!leg2) continue;
        chain = chain.concat(stepDir > 0 ? leg2 : leg2.slice().reverse());
      }
      if (chain.length > 1) routeSegs.push(chain);
    }
    ctx.save();
    ctx.setLineDash([5.5, 3.5]); ctx.strokeStyle = SEAL;
    ctx.lineWidth = compact ? 1.2 : 2.0 * S; ctx.globalAlpha = .88;
    ctx.lineCap = "butt"; ctx.lineJoin = "round";
    routeSegs.forEach(function (seq) {
      pathOf(ctx, offsetPath(seq, compact ? 2.0 : 3.4 * S)); ctx.stroke();
    });
    ctx.restore();
  }

  /* -- 13. headquarters --------------------------------------------------- */
  T.forEach(function (t, i) {
    var sp3 = sites[i], on = sel.indexOf(t.id) !== -1;
    var r = compact ? 2.4 : 4.0 * S;
    ctx.save();
    ctx.fillStyle = PAPER; ctx.globalAlpha = .8;
    ctx.beginPath(); ctx.arc(sp3[0], sp3[1], r * 2.0, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = on ? SEAL : INK; ctx.fillStyle = on ? SEAL : PAPER;
    ctx.lineWidth = on ? 1.8 : 1.2;
    ctx.beginPath(); ctx.arc(sp3[0], sp3[1], r, 0, 6.2832); ctx.fill(); ctx.stroke();
    if (!on) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sp3[0], sp3[1], r * .38, 0, 6.2832); ctx.fill(); }
    else { ctx.globalAlpha = .7; ctx.lineWidth = compact ? .9 : 1.1;
      ctx.beginPath(); ctx.arc(sp3[0], sp3[1], r * 1.95, 0, 6.2832); ctx.stroke(); }
    ctx.restore();
    if (!compact) {
      label(ctx, t.name, sp3[0], sp3[1] - 12 * S, {
        font: '600 ' + (11.5 * S).toFixed(1) + 'px ' + SERIF,
        track: 2.2 * S, halo: 4.5, colour: on ? SEAL : INK
      });
      label(ctx, t.days + " days", sp3[0], sp3[1] + 12.5 * S, {
        font: (8.5 * S).toFixed(1) + 'px ' + MONO, track: 1.5 * S, halo: 4, alpha: .75,
        colour: on ? SEAL : "#6a5f45"
      });
    }
    marks.push({ id: t.id, x: sp3[0], y: sp3[1] });
  });

  /* -- 14. sheet furniture ------------------------------------------------ */
  ctx.save();                                          // clear the margin
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, neat.y); ctx.fillRect(0, neat.y + neat.h, W, H - neat.y - neat.h);
  ctx.fillRect(0, 0, neat.x, H); ctx.fillRect(neat.x + neat.w, 0, W - neat.x - neat.w, H);
  ctx.restore();
  for (var fj2 = 0; fj2 < Math.round(fibres * .4); fj2++) {
    var fx2 = rng() * W, fy2 = rng() * H;
    if (fx2 > neat.x && fx2 < neat.x + neat.w && fy2 > neat.y && fy2 < neat.y + neat.h) continue;
    ctx.fillStyle = rng() < .5 ? "rgba(120,95,45,.09)" : "rgba(255,250,235,.11)";
    ctx.fillRect(fx2, fy2, 1, 1);
  }

  (function () {
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineCap = "butt"; ctx.lineJoin = "miter";
    if (compact) {
      ctx.globalAlpha = .85; ctx.lineWidth = .9;
      ctx.strokeRect(neat.x - 2, neat.y - 2, neat.w + 4, neat.h + 4);
      ctx.globalAlpha = .4; ctx.lineWidth = .5;
      ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);
      ctx.restore(); return;
    }
    var ox = M, oy = M, ow = W - 2 * M, oh = H - 2 * M;
    var ix = M + band, iy = M + band, iw = W - 2 * (M + band), ih = H - 2 * (M + band);
    ctx.globalAlpha = .9; ctx.lineWidth = .9; ctx.strokeRect(ox, oy, ow, oh);
    ctx.lineWidth = .65; ctx.strokeRect(ix, iy, iw, ih);
    ctx.lineWidth = .9; ctx.globalAlpha = .85; ctx.strokeRect(neat.x - 2, neat.y - 2, neat.w + 4, neat.h + 4);
    ctx.fillStyle = INK; ctx.globalAlpha = .88;
    var cell = Math.max(5, Math.round(6 * S)), n3;
    for (n3 = 0; n3 * cell < iw; n3++) {
      if (n3 % 2) continue;
      var cw3 = Math.min(cell, iw - n3 * cell);
      ctx.fillRect(ix + n3 * cell, oy, cw3, band);
      ctx.fillRect(ix + n3 * cell, iy + ih, cw3, band);
    }
    for (n3 = 0; n3 * cell < ih; n3++) {
      if (n3 % 2) continue;
      var ch3 = Math.min(cell, ih - n3 * cell);
      ctx.fillRect(ox, iy + n3 * cell, band, ch3);
      ctx.fillRect(ix + iw, iy + n3 * cell, band, ch3);
    }
    ctx.globalAlpha = .5; ctx.lineWidth = .45;
    ctx.beginPath();
    for (var gx3 = neat.x; gx3 <= neat.x + neat.w + .5; gx3 += cell / 2) {
      ctx.moveTo(gx3, neat.y - 2); ctx.lineTo(gx3, neat.y + 1.4);
      ctx.moveTo(gx3, neat.y + neat.h + 2); ctx.lineTo(gx3, neat.y + neat.h - 1.4);
    }
    for (var gy3 = neat.y; gy3 <= neat.y + neat.h + .5; gy3 += cell / 2) {
      ctx.moveTo(neat.x - 2, gy3); ctx.lineTo(neat.x + 1.4, gy3);
      ctx.moveTo(neat.x + neat.w + 2, gy3); ctx.lineTo(neat.x + neat.w - 1.4, gy3);
    }
    ctx.stroke();
    ctx.restore();
  })();

  if (!compact && S > .7) {
    (function () {                                     // the north point
      var nx = neat.x + neat.w - 20 * S, ny = neat.y + 26 * S, L = 14 * S;
      ctx.save();
      ctx.fillStyle = PAPER; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.arc(nx, ny - 2, L * 1.15, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.translate(nx, ny);
      ctx.strokeStyle = INK; ctx.lineWidth = .6; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.arc(0, 0, L * .3, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(-L * .2, L * .45); ctx.lineTo(0, L * .18); ctx.closePath();
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(L * .2, L * .45); ctx.lineTo(0, L * .18); ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = .7; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.moveTo(-L * .5, 0); ctx.lineTo(L * .5, 0); ctx.stroke();
      ctx.restore();
      label(ctx, "N", nx, ny - L - 5.5 * S,
        { font: '600 ' + (8.5 * S).toFixed(1) + 'px ' + SERIF, track: 0, halo: 3.4, alpha: .9 });
    })();

    (function () {                                     // the scale of miles
      var bw = Math.min(112 * S, neat.w * .3), bh = 3.4 * S;
      var bx3 = neat.x + 12 * S, by3 = neat.y + neat.h - 15 * S;
      ctx.save();
      ctx.fillStyle = PAPER; ctx.globalAlpha = .85;
      ctx.fillRect(bx3 - 6, by3 - 13 * S, bw + 12, bh + 23 * S);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INK; ctx.lineWidth = .7; ctx.strokeRect(bx3, by3, bw, bh);
      ctx.fillStyle = INK;
      var segs = 5, sw = bw / segs;
      for (var s3 = 0; s3 < segs; s3++) if (s3 % 2 === 0) ctx.fillRect(bx3 + s3 * sw, by3, sw, bh);
      ctx.lineWidth = .45; ctx.globalAlpha = .8;
      ctx.beginPath();
      for (var h4 = 1; h4 < 4; h4++) { ctx.moveTo(bx3 + sw * h4 / 4, by3); ctx.lineTo(bx3 + sw * h4 / 4, by3 + bh); }
      ctx.stroke();
      ctx.restore();
      var fnt = (6.2 * S).toFixed(1) + 'px ' + MONO;
      for (var lb = 0; lb <= segs; lb++)
        label(ctx, String(lb * 4), bx3 + lb * sw, by3 + bh + 6 * S, { font: fnt, track: .6, alpha: .72 });
      label(ctx, "SCALE OF MILES", bx3 + bw / 2, by3 - 6.5 * S,
        { font: (6.0 * S).toFixed(1) + 'px ' + SERIF, track: 2.2 * S, alpha: .68 });
    })();
  }

  if (!compact && opts.title) {                        // the cartouche
    var cw2 = Math.min(neat.w * .42, 205 * S), ch2 = 50 * S;
    var bx4 = neat.x + neat.w - cw2 - 8 * S, by4 = neat.y + neat.h - ch2 - 8 * S;
    ctx.save();
    ctx.fillStyle = PAPER; ctx.globalAlpha = .96; ctx.fillRect(bx4, by4, cw2, ch2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.strokeRect(bx4, by4, cw2, ch2);
    ctx.lineWidth = .5; ctx.globalAlpha = .75; ctx.strokeRect(bx4 + 3, by4 + 3, cw2 - 6, ch2 - 6);
    ctx.globalAlpha = .8; ctx.lineWidth = .6;
    [[bx4 + 3, by4 + 3, 1, 1], [bx4 + cw2 - 3, by4 + 3, -1, 1],
     [bx4 + 3, by4 + ch2 - 3, 1, -1], [bx4 + cw2 - 3, by4 + ch2 - 3, -1, -1]].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(c[0] + c[2] * 7, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * 7);
      ctx.stroke();
    });
    ctx.restore();
    label(ctx, opts.title, bx4 + cw2 / 2, by4 + 15.5 * S,
      { font: '600 ' + (11 * S).toFixed(1) + 'px ' + SERIF, track: 1.8 * S });
    ctx.save();
    ctx.strokeStyle = INK; ctx.globalAlpha = .5; ctx.lineWidth = .5;
    ctx.beginPath(); ctx.moveTo(bx4 + cw2 * .3, by4 + 23 * S); ctx.lineTo(bx4 + cw2 * .7, by4 + 23 * S);
    ctx.stroke(); ctx.restore();
    label(ctx, opts.sub || "", bx4 + cw2 / 2, by4 + 31 * S,
      { font: (7 * S).toFixed(1) + 'px ' + MONO, track: 2.2 * S, alpha: .68 });
    label(ctx, "SURVEY OF INDIA", bx4 + cw2 / 2, by4 + 42 * S,
      { font: (5.8 * S).toFixed(1) + 'px ' + SERIF, track: 2.6 * S, alpha: .5 });
  }

  if (typeof performance !== "undefined" && performance.now && opts.timing)
    drawDistrict.lastMs = performance.now() - t0;
  return marks;                                        // for hit targets
}

window.drawDistrict = drawDistrict;
