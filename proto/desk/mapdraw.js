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

/* ------------------------------------------------------------ polylines */

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

function pathLen(pts) {
  var L = 0; for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}

function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  var out = [pts[0].slice()], cur = pts[0].slice(), idx = 1, need = step, guard = 0;
  while (idx < pts.length && guard++ < 20000) {
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

// unit tangent at index i (central difference)
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
    ctx.lineWidth = w * 1.28; ctx.globalAlpha = (alpha == null ? 1 : alpha) * .55; ctx.stroke();
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

// Fine, close and calm. Two crossing families at most, or it turns to mud.
function hatch(ctx, b, tone, o) {
  o = o || {}; var rng = o.rng, t = clamp(tone, 0, 1);
  if (t <= .012) return;
  var cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.hypot(b.w, b.h) / 2 + 10;
  var fams = [[o.angle || 0, lerp(8.5, 1.9, t), 1]];
  if (t > .55) fams.push([(o.angle || 0) + 1.24, lerp(11, 2.6, t), .85]);
  fams.forEach(function (f) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(f[0]);
    for (var y = -R; y <= R; y += f[1] * (o.coarse || 1)) {
      var w = lerp(.24, .5, t) * (.8 + rng() * .4);
      stroke(ctx, wobbly(-R, y + (rng() - .5) * 2, R, y, o.wobble == null ? .35 : o.wobble, rng, 30),
        w, f[2] * (o.alpha == null ? .8 : o.alpha));
    }
    ctx.restore();
  });
}

// Stipple with a spacing (not a magic density) so it scales predictably.
function stipple(ctx, b, spacing, rng, o) {
  o = o || {};
  var n = Math.round(b.w * b.h / (spacing * spacing));
  if (n <= 0) return;
  n = Math.min(n, o.cap || 9000);
  var mask = o.mask, size = o.size || .55, jitter = o.sizeJitter == null ? .5 : o.sizeJitter;
  ctx.save(); ctx.fillStyle = o.colour || INK; ctx.globalAlpha = o.alpha == null ? .62 : o.alpha;
  for (var i = 0; i < n; i++) {
    var x = b.x + rng() * b.w, y = b.y + rng() * b.h;
    if (mask && !mask(x, y)) continue;
    var r = size * (1 - jitter / 2 + rng() * jitter);
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
var HILLS = ["KAIMUR", "BARWA", "GIRDHA", "PANCHET", "SIRIS", "TILAIYA"];

/* ----------------------------------------------------------------- plate */

function drawDistrict(cv, opts) {
  var t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
  var W = cv.width / 2, H = cv.height / 2;          // authored at half backing size
  var ctx = cv.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(2, 2); ctx.clearRect(0, 0, W, H);
  var rng = mulberry32(opts.seed || 20251115);
  var noise = makeNoise(mulberry32((opts.seed || 20251115) ^ 0x5bf03635));
  var compact = !!opts.compact;
  var S = Math.min(1.35, Math.max(.55, Math.min(W / 760, H / 460)));  // detail scale
  var T = opts.tehsils || [];
  var sel = opts.selected || [];

  /* -- the paper ------------------------------------------------------- */
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  var fibres = Math.round(W * H / 900);
  for (var fi = 0; fi < fibres; fi++) {
    ctx.fillStyle = rng() < .5 ? "rgba(120,95,45,.09)" : "rgba(255,250,235,.11)";
    ctx.fillRect(rng() * W, rng() * H, 1, rng() < .12 ? 2 : 1);
  }

  /* -- the neat lines and the margin ----------------------------------- */
  var M = compact ? 4 : Math.round(13 * S);
  var band = compact ? 0 : Math.max(3.5, 4.5 * S);
  var neat = { x: M + band + 3, y: M + band + 3, w: W - 2 * (M + band + 3), h: H - 2 * (M + band + 3) };
  var inner = {
    x: neat.x + (compact ? 3 : 10 * S), y: neat.y + (compact ? 3 : 9 * S),
    w: neat.w - (compact ? 6 : 20 * S), h: neat.h - (compact ? 6 : 18 * S)
  };

  /* -- the district ---------------------------------------------------- */
  var cx = inner.x + inner.w / 2, cy = inner.y + inner.h * .49;
  var rx = inner.w * .48, ry = inner.h * .47;
  var outline = [], a, nOut = 74;
  for (var oi = 0; oi < nOut; oi++) {
    a = oi / nOut * Math.PI * 2;
    var n = .82 + .13 * Math.sin(a * 2.7 + 1.2) + .07 * Math.sin(a * 4.3 + .4)
      + .05 * Math.sin(a * 7.9 + 2.1) + (noise.fbm(Math.cos(a) * 2.4 + 9, Math.sin(a) * 2.4 + 9, 3) - .5) * .2;
    outline.push([cx + Math.cos(a) * rx * n, cy + Math.sin(a) * ry * n]);
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
  // Enters low on the west, leaves east; the fall of the land is west to east.
  var ry0 = cy + inner.h * (.06 + rng() * .12);
  var ry1 = cy + inner.h * (.10 + rng() * .16);
  var river = meander(rng, [neat.x - 8, ry0], [neat.x + neat.w + 8, ry1], .17, 5, 3);
  river = resample(river, 3.2);
  var rvLen = pathLen(river);
  var hwBase = compact ? 1.5 : 3.2 * S, hwEnd = compact ? 3.4 : 8.4 * S;
  function halfWidth(s) {
    return lerp(hwBase, hwEnd, Math.pow(s, .8)) * (.82 + .36 * noise.fbm(s * 9 + 3, 21, 2));
  }
  var bankN = offsetPath(river, function (s) { return -halfWidth(s); });
  var bankS = offsetPath(river, function (s) { return halfWidth(s); });

  // Tributaries, joining at an angle out of the higher ground.
  var tribs = [];
  var nTribs = compact ? 1 : 2;
  for (var ti = 0; ti < nTribs; ti++) {
    var jt = .28 + ti * .34 + rng() * .12;
    var ji = clamp(Math.round(jt * (river.length - 1)), 2, river.length - 3);
    var jp = river[ji];
    var up = ti % 2 === 0 ? -1 : 1;                     // alternate bank
    var reach = (inner.h * (.34 + rng() * .22));
    var head = [jp[0] - reach * (.35 + rng() * .5), jp[1] + up * reach];
    var tp = meander(rng, head, [jp[0], jp[1] + up * halfWidth(jt) * .6], .16, 4, 3);
    tribs.push(resample(tp, 3.2));
  }

  /* -- the hills ------------------------------------------------------- */
  // A ridge system in the north-west, above the river's north bank.
  var hillC = [inner.x + inner.w * (.20 + rng() * .10), inner.y + inner.h * (.19 + rng() * .08)];
  var hillR = [inner.w * (.30 + rng() * .06), inner.h * (.28 + rng() * .06)];
  var ridges = [];
  var nRidge = compact ? 3 : 5;
  for (var ri = 0; ri < nRidge; ri++) {
    var sx = hillC[0] + (rng() - .5) * hillR[0] * 1.1;
    var sy = hillC[1] + (rng() - .5) * hillR[1] * 1.1;
    var dir = (rng() < .6 ? -.55 : .35) + (rng() - .5) * .7;   // ridges trend NE–SW-ish
    var pts = [[sx, sy]], steps = 3 + Math.floor(rng() * 4), step = 16 + rng() * 16;
    for (var rs = 0; rs < steps; rs++) {
      dir += (rng() - .5) * .7;
      sx += Math.cos(dir) * step; sy += Math.sin(dir) * step;
      pts.push([sx, sy]);
    }
    ridges.push({
      pts: chaikin(pts, 2), amp: .55 + rng() * .5,
      w: (7 + rng() * 9) * (compact ? 1.3 : 1)
    });
  }
  function hillMask(x, y) {
    var dx = (x - hillC[0]) / hillR[0], dy = (y - hillC[1]) / hillR[1];
    var d = Math.hypot(dx, dy) * (.86 + .3 * noise.fbm(x / 46 + 3, y / 46 + 7, 2));
    return 1 - smoothstep(.55, 1.05, d);
  }
  function height(x, y) {
    var m = hillMask(x, y);
    if (m <= .001) return 0;
    var v = 0;
    for (var i = 0; i < ridges.length; i++) {
      var R = ridges[i], d = distToPath(x, y, R.pts);
      var h = R.amp * Math.exp(-(d * d) / (2 * R.w * R.w));
      if (h > v) v = h;
    }
    if (v < .004) return 0;
    v *= m;
    v *= .78 + .44 * noise.fbm(x / 17 + 41, y / 17 + 13, 3);
    return v;
  }
  function grad(x, y) {
    var e = .9;
    return [(height(x + e, y) - height(x - e, y)) / (2 * e),
            (height(x, y + e) - height(x, y - e)) / (2 * e)];
  }

  /* -- roads: a chain of headquarters, and tracks between ---------------- */
  var order = [];
  if (sites.length) {
    var remaining = sites.map(function (_, i) { return i; });
    var start = remaining.reduce(function (bi, i) { return sites[i][0] < sites[bi][0] ? i : bi; }, remaining[0]);
    var cur = start; order.push(cur); remaining.splice(remaining.indexOf(cur), 1);
    while (remaining.length) {
      var best = remaining[0], bd = 1e9;
      remaining.forEach(function (i) { var d = dist(sites[cur], sites[i]); if (d < bd) { bd = d; best = i; } });
      order.push(best); remaining.splice(remaining.indexOf(best), 1); cur = best;
    }
  }
  // the metalled road: each leg a gently curved run between headquarters
  var legs = [];
  for (var li = 0; li < order.length - 1; li++) {
    var A = sites[order[li]], B = sites[order[li + 1]];
    legs.push(resample(meander(rng, A, B, .075, 3, 3), 4));
  }
  // and its continuation off the sheet at both ends
  var tails = [];
  if (order.length) {
    var first = sites[order[0]], last = sites[order[order.length - 1]];
    tails.push(resample(meander(rng, [neat.x - 6, first[1] + (rng() - .5) * inner.h * .2], first, .07, 3, 3), 4));
    tails.push(resample(meander(rng, last, [neat.x + neat.w + 6, last[1] + (rng() - .5) * inner.h * .2], .07, 3, 3), 4));
  }
  var metalled = tails.slice(0, 1).concat(legs, tails.slice(1));

  // cart tracks: a web off the metalled road, wandering to the boundary
  var tracks = [];
  var nTracks = compact ? 0 : Math.round(11 * S);
  for (var tk = 0; tk < nTracks; tk++) {
    var src = sites.length ? sites[Math.floor(rng() * sites.length)] : [cx, cy];
    var ang = rng() * Math.PI * 2, reach2 = inner.w * (.14 + rng() * .26);
    var dst = [src[0] + Math.cos(ang) * reach2, src[1] + Math.sin(ang) * reach2 * .8];
    dst[0] = clamp(dst[0], neat.x + 4, neat.x + neat.w - 4);
    dst[1] = clamp(dst[1], neat.y + 4, neat.y + neat.h - 4);
    tracks.push(resample(meander(rng, src, dst, .13, 4, 3), 4));
  }
  // a few cross-country links between track ends, so the web closes
  for (var tk2 = 0; tk2 + 1 < tracks.length; tk2 += 3) {
    var e1 = tracks[tk2][tracks[tk2].length - 1], e2 = tracks[tk2 + 1][tracks[tk2 + 1].length - 1];
    if (dist(e1, e2) < inner.w * .4) tracks.push(resample(meander(rng, e1, e2, .14, 4, 3), 4));
  }

  /* -- the canal ------------------------------------------------------- */
  // Taken off the river on the south bank, running away across the doab.
  var canalT = .22 + rng() * .16;
  var canalHead = river[clamp(Math.round(canalT * (river.length - 1)), 0, river.length - 1)];
  var canalEnd = [neat.x + neat.w * (.86 + rng() * .1), neat.y + neat.h * (.86 + rng() * .12)];
  var canal = resample(meander(rng, [canalHead[0], canalHead[1] + halfWidth(canalT)], canalEnd, .035, 3, 3), 4);
  var distribs = [];
  var nDist = compact ? 0 : 5;
  for (var di = 0; di < nDist; di++) {
    var dt = .18 + di * .16 + rng() * .06;
    var dIdx = clamp(Math.round(dt * (canal.length - 1)), 1, canal.length - 2);
    var dp = canal[dIdx], dtan = tangentAt(canal, dIdx);
    var sgn = di % 2 ? 1 : -1;
    var ba = Math.atan2(dtan[1], dtan[0]) + sgn * (.5 + rng() * .35);
    var blen = inner.w * (.10 + rng() * .10);
    var bend = [dp[0] + Math.cos(ba) * blen, dp[1] + Math.sin(ba) * blen];
    var br = resample(meander(rng, dp, bend, .045, 3, 3), 4);
    distribs.push({ pts: br, order: 1 });
    // second order, finer still
    if (rng() < .8) {
      var mi = Math.round(br.length * (.45 + rng() * .3));
      var mp = br[clamp(mi, 1, br.length - 2)], mt = tangentAt(br, mi);
      var ma = Math.atan2(mt[1], mt[0]) + (rng() < .5 ? 1 : -1) * (.5 + rng() * .4);
      var ml = blen * (.4 + rng() * .3);
      distribs.push({
        pts: resample(meander(rng, mp, [mp[0] + Math.cos(ma) * ml, mp[1] + Math.sin(ma) * ml], .05, 3, 3), 4),
        order: 2
      });
    }
  }

  /* -- the railway ----------------------------------------------------- */
  var railA = [neat.x - 6, neat.y + neat.h * (.80 + rng() * .12)];
  var railB = [neat.x + neat.w + 6, neat.y + neat.h * (.14 + rng() * .16)];
  var rail = resample(meander(rng, railA, railB, .022, 3, 3), 4);

  /* -- forest, marsh --------------------------------------------------- */
  var forestC = [inner.x + inner.w * (.74 + rng() * .10), inner.y + inner.h * (.20 + rng() * .12)];
  var forestPoly = [];
  var fRx = inner.w * (.15 + rng() * .05), fRy = inner.h * (.16 + rng() * .06);
  for (var fj = 0; fj < 30; fj++) {
    var fa = fj / 30 * Math.PI * 2;
    var fn = .68 + .3 * noise.fbm(Math.cos(fa) * 3 + 30, Math.sin(fa) * 3 + 30, 3);
    forestPoly.push([forestC[0] + Math.cos(fa) * fRx * fn, forestC[1] + Math.sin(fa) * fRy * fn]);
  }
  forestPoly = chaikin(forestPoly, 1, true);

  /* -- villages: strung along the roads and the river ------------------- */
  var villages = [];
  function tooClose(x, y, r) {
    for (var i = 0; i < villages.length; i++)
      if (Math.hypot(villages[i].x - x, villages[i].y - y) < r) return true;
    return false;
  }
  function riverClear(x, y) {
    return distToPath(x, y, river) > halfWidth(clamp((x - neat.x) / neat.w, 0, 1)) + 2.5;
  }
  function tryVillage(x, y, big) {
    if (x < neat.x + 3 || x > neat.x + neat.w - 3 || y < neat.y + 3 || y > neat.y + neat.h - 3) return;
    if (!riverClear(x, y)) return;
    if (height(x, y) > .34) return;
    if (tooClose(x, y, 9 * S)) return;
    var near = 1e9;
    for (var i = 0; i < sites.length; i++) near = Math.min(near, dist([x, y], sites[i]));
    if (near < 15 * S) return;
    villages.push({ x: x, y: y, big: !!big });
  }
  if (!compact) {
    var stringers = metalled.concat(tracks).concat([bankN, bankS]).concat(tribs).concat([canal]);
    stringers.forEach(function (path, pi) {
      if (!path || path.length < 4) return;
      var everyN = pi < metalled.length ? 4 : 6;
      for (var i = 3; i < path.length - 3; i += everyN) {
        if (rng() < .42) continue;
        var t = tangentAt(path, i), side = rng() < .5 ? 1 : -1;
        var off = (2.5 + rng() * 7) * side;
        tryVillage(path[i][0] - t[1] * off, path[i][1] + t[0] * off, rng() < .16);
      }
    });
    // a scattering in the open country, so the web is not all roadside
    for (var vs = 0; vs < Math.round(26 * S); vs++) {
      var vx = obounds.x + rng() * obounds.w, vy = obounds.y + rng() * obounds.h;
      if (inDistrict(vx, vy)) tryVillage(vx, vy, false);
    }
  }

  /* ==================================================================== *
   *  Now put ink on the plate, weakest first.                            *
   * ==================================================================== */

  /* -- 1. cultivation, by tehsil --------------------------------------- */
  cells.forEach(function (poly, i) {
    if (poly.length < 3) return;
    var cond = T[i].cond == null ? .25 : T[i].cond;
    var b = polyBounds(poly);
    ctx.save(); polyPath(ctx, poly, null, 0); ctx.clip();
    // spacing opens out as the tehsil fails; noise threshold breaks it up
    var sp = lerp(4.4, 11.5, cond) * (compact ? 2.0 : 1) / Math.max(.7, S);
    var thr = lerp(.02, .56, cond);
    stipple(ctx, b, sp, rng, {
      size: compact ? .45 : .55, alpha: lerp(.66, .42, cond), cap: compact ? 900 : 7000,
      mask: function (x, y) {
        if (height(x, y) > .18) return false;
        if (!riverClear(x, y)) return false;
        return noise.fbm(x / 26 + 11, y / 26 + 5, 3) > thr;
      }
    });
    // scrub creeping in where cultivation has gone
    if (cond > .5 && !compact) {
      var nScrub = Math.round(b.w * b.h / 2600 * (cond - .45));
      ctx.save(); ctx.globalAlpha = .5;
      for (var s2 = 0; s2 < nScrub; s2++) {
        var x2 = b.x + rng() * b.w, y2 = b.y + rng() * b.h;
        if (height(x2, y2) > .18 || !riverClear(x2, y2)) continue;
        if (noise.fbm(x2 / 26 + 11, y2 / 26 + 5, 3) > thr) continue;
        var sa = rng() * .6 - .3;
        stroke(ctx, [[x2 - 1.5, y2 + 1], [x2 + Math.sin(sa) * .6, y2 - 1.6]], .3, .55);
        stroke(ctx, [[x2 + 1.5, y2 + 1], [x2 + Math.sin(sa) * .6, y2 - 1.6]], .3, .55);
      }
      ctx.restore();
    }
    ctx.restore();
  });

  /* -- 2. the forest reserve ------------------------------------------- */
  if (!compact) {
    var fb = polyBounds(forestPoly);
    ctx.save(); polyPath(ctx, forestPoly, null, 0); ctx.clip();
    polyPath(ctx, outline, null, 0); ctx.clip();
    stipple(ctx, fb, 3.1 / Math.max(.7, S), rng, { size: .62, alpha: .55, cap: 6000 });
    // a scatter of tree marks through it
    for (var ft = 0; ft < Math.round(fb.w * fb.h / 420); ft++) {
      var fx = fb.x + rng() * fb.w, fy = fb.y + rng() * fb.h;
      ctx.save(); ctx.globalAlpha = .62; ctx.strokeStyle = INK; ctx.lineWidth = .34;
      ctx.beginPath(); ctx.arc(fx, fy, .9 + rng() * .8, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy + 1.4); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.save(); ctx.setLineDash([2.2, 2.2]); ctx.strokeStyle = INK;
    ctx.globalAlpha = .55; ctx.lineWidth = .55;
    polyPath(ctx, forestPoly, rng, .5); ctx.stroke(); ctx.restore();
  }

  /* -- 3. the hills, hachured down the flank --------------------------- */
  (function () {
    ctx.save(); polyPath(ctx, outline, null, 0); ctx.clip();
    // find a working maximum slope so weight and spacing normalise
    var sMax = 1e-6, probe;
    for (probe = 0; probe < 260; probe++) {
      var px = hillC[0] + (rng() - .5) * hillR[0] * 2, py = hillC[1] + (rng() - .5) * hillR[1] * 2;
      var g = grad(px, py), gs = Math.hypot(g[0], g[1]);
      if (gs > sMax) sMax = gs;
    }
    var dh = compact ? .12 : .075;                    // contour interval
    var step = compact ? 4.4 : 2.5 / Math.max(.75, S);
    var x0 = hillC[0] - hillR[0] * 1.15, x1 = hillC[0] + hillR[0] * 1.15;
    var y0 = hillC[1] - hillR[1] * 1.15, y1 = hillC[1] + hillR[1] * 1.15;
    for (var gy = y0; gy < y1; gy += step) {
      for (var gx = x0; gx < x1; gx += step) {
        var x = gx + (rng() - .5) * step * .9, y = gy + (rng() - .5) * step * .9;
        var h = height(x, y);
        if (h < .05) continue;
        var g2 = grad(x, y), s = Math.hypot(g2[0], g2[1]);
        if (s < 1e-4) continue;
        // slide onto the nearest contour so the strokes fall into rows
        for (var it = 0; it < 2; it++) {
          var lvl = Math.round(h / dh) * dh, dd = (h - lvl) / (s * s);
          x -= g2[0] * dd; y -= g2[1] * dd;
          h = height(x, y); g2 = grad(x, y); s = Math.hypot(g2[0], g2[1]);
          if (s < 1e-4) break;
        }
        if (s < 1e-4 || h < .05) continue;
        var norm = clamp(s / (sMax * .55), 0, 1);
        if (rng() > .18 + norm * .9) continue;        // denser where it is steep
        var len = clamp(dh / s, 1.1, compact ? 6 : 8.5);
        // walk down the slope: the stroke bends with the land
        var pts = [[x, y]], px2 = x, py2 = y, sub = 3, dl = len / sub;
        for (var w2 = 0; w2 < sub; w2++) {
          var gg = grad(px2, py2), gl = Math.hypot(gg[0], gg[1]) || 1;
          px2 -= gg[0] / gl * dl; py2 -= gg[1] / gl * dl;
          pts.push([px2, py2]);
        }
        stroke(ctx, pts, lerp(.26, .78, norm) * (compact ? 1.15 : 1), lerp(.5, .95, norm));
      }
    }
    ctx.restore();
  })();

  /* -- 4. the river ----------------------------------------------------- */
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x - 8, neat.y - 8, neat.w + 16, neat.h + 16); ctx.clip();

    // marsh along the north bank, in one stretch
    if (!compact) {
      var m0 = .40 + rng() * .2, m1 = m0 + .18;
      var i0 = Math.round(m0 * (river.length - 1)), i1 = Math.round(m1 * (river.length - 1));
      for (var mi = i0; mi < i1; mi += 2) {
        var mp = river[mi], mt = tangentAt(river, mi);
        var hwm = halfWidth(mi / (river.length - 1));
        for (var band2 = 1; band2 <= 3; band2++) {
          var d2 = hwm + 2.5 + band2 * 3.4 + (rng() - .5) * 1.6;
          var bx2 = mp[0] + mt[1] * d2, by2 = mp[1] - mt[0] * d2;
          if (rng() < .35) continue;
          for (var dsh = -1; dsh <= 1; dsh++)
            stroke(ctx, [[bx2 - 1.8, by2 + dsh * 1.3], [bx2 + 1.8 - Math.abs(dsh) * .8, by2 + dsh * 1.3]], .3, .6);
        }
      }
    }

    // tributaries beneath the main stream
    tribs.forEach(function (tp) {
      var tw = function (s) { return lerp(.5, 2.1, s) * (compact ? .7 : S); };
      stroke(ctx, offsetPath(tp, function (s) { return -tw(s); }), compact ? .5 : .75, .8);
      stroke(ctx, offsetPath(tp, function (s) { return tw(s); }), compact ? .5 : .75, .8);
      stroke(ctx, tp, .35, .35);
    });

    // the channel: fill the paper back in, then rule the water
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(bankN[0][0], bankN[0][1]);
    for (var b1 = 1; b1 < bankN.length; b1++) ctx.lineTo(bankN[b1][0], bankN[b1][1]);
    for (var b2 = bankS.length - 1; b2 >= 0; b2--) ctx.lineTo(bankS[b2][0], bankS[b2][1]);
    ctx.closePath();
    ctx.fillStyle = PAPER; ctx.fill();
    ctx.clip();
    var rules = compact ? [.55] : [.34, .62, .85];
    rules.forEach(function (f, k) {
      var w3 = compact ? .3 : .32;
      stroke(ctx, offsetPath(river, function (s) { return -halfWidth(s) * f; }), w3, .38 - k * .06);
      stroke(ctx, offsetPath(river, function (s) { return halfWidth(s) * f; }), w3, .38 - k * .06);
    });
    ctx.restore();

    // sandbanks: lens-shaped islands, stippled, in the wider reaches
    if (!compact) {
      for (var sb = 0; sb < 3; sb++) {
        var st = .40 + sb * .19 + rng() * .06;
        var si0 = Math.round(st * (river.length - 1));
        var si1 = si0 + Math.round(8 + rng() * 12);
        if (si1 >= river.length - 2) continue;
        var lens = [], lat = (rng() - .5) * .7;
        for (var q = si0; q <= si1; q++) {
          var u = (q - si0) / (si1 - si0);
          var hw2 = halfWidth(q / (river.length - 1));
          var tn = tangentAt(river, q), sw = Math.sin(Math.PI * u) * hw2 * .42;
          lens.push([river[q][0] - tn[1] * (lat * hw2 + sw), river[q][1] + tn[0] * (lat * hw2 + sw)]);
        }
        for (var q2 = si1; q2 >= si0; q2--) {
          var u2 = (q2 - si0) / (si1 - si0);
          var hw3 = halfWidth(q2 / (river.length - 1));
          var tn2 = tangentAt(river, q2), sw2 = Math.sin(Math.PI * u2) * hw3 * .42;
          lens.push([river[q2][0] - tn2[1] * (lat * hw3 - sw2), river[q2][1] + tn2[0] * (lat * hw3 - sw2)]);
        }
        if (lens.length < 6) continue;
        ctx.save();
        polyPath(ctx, lens, null, 0);
        ctx.fillStyle = PAPER; ctx.fill(); ctx.clip();
        stipple(ctx, polyBounds(lens), 2.3, rng, { size: .5, alpha: .7, cap: 900 });
        ctx.restore();
        ctx.save(); ctx.setLineDash([1.4, 1.6]); ctx.strokeStyle = INK;
        ctx.lineWidth = .4; ctx.globalAlpha = .7;
        polyPath(ctx, lens, null, 0); ctx.stroke(); ctx.restore();
      }
    }

    stroke(ctx, bankN, compact ? .75 : 1.15 * S, .95);
    stroke(ctx, bankS, compact ? .75 : 1.15 * S, .95);
    ctx.restore();
  })();

  /* -- 5. the canal and its distributaries ------------------------------ */
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x - 8, neat.y - 8, neat.w + 16, neat.h + 16); ctx.clip();
    distribs.forEach(function (d) {
      stroke(ctx, d.pts, d.order === 1 ? .55 : .34, d.order === 1 ? .8 : .62);
    });
    // main canal as a fine double line
    var gap = compact ? .7 : 1.15 * S;
    stroke(ctx, offsetPath(canal, -gap), compact ? .55 : .68, .88);
    stroke(ctx, offsetPath(canal, gap), compact ? .55 : .68, .88);
    // locks: a short pair of ticks across it
    if (!compact) {
      for (var lk = 0; lk < 3; lk++) {
        var lidx = Math.round((.28 + lk * .24) * (canal.length - 1));
        var lp = canal[lidx], lt = tangentAt(canal, lidx);
        stroke(ctx, [[lp[0] - lt[1] * gap * 2, lp[1] + lt[0] * gap * 2],
                     [lp[0] + lt[1] * gap * 2, lp[1] - lt[0] * gap * 2]], .7, .85);
      }
    }
    ctx.restore();
  })();

  /* -- 6. roads --------------------------------------------------------- */
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x - 8, neat.y - 8, neat.w + 16, neat.h + 16); ctx.clip();
    tracks.forEach(function (tp) {
      ctx.save(); ctx.setLineDash([]);
      stroke(ctx, tp, .42 + rng() * .16, .62 + rng() * .18);
      ctx.restore();
    });
    var g2 = compact ? .8 : 1.4 * S;
    metalled.forEach(function (leg) {
      if (!leg || leg.length < 2) return;
      if (compact) { stroke(ctx, leg, 1.0, .9); return; }
      stroke(ctx, offsetPath(leg, -g2), .62 * S + .18, .92);
      stroke(ctx, offsetPath(leg, g2), .62 * S + .18, .92);
    });
    ctx.restore();
  })();

  /* -- 7. the railway --------------------------------------------------- */
  (function () {
    ctx.save();
    ctx.beginPath(); ctx.rect(neat.x - 8, neat.y - 8, neat.w + 16, neat.h + 16); ctx.clip();
    stroke(ctx, rail, compact ? .9 : 1.05 * S, .95);
    var tie = compact ? 2.0 : 2.9 * S, every = compact ? 2 : 2;
    for (var i = 1; i < rail.length - 1; i += every) {
      var t = tangentAt(rail, i), p = rail[i];
      stroke(ctx, [[p[0] - t[1] * tie, p[1] + t[0] * tie], [p[0] + t[1] * tie, p[1] - t[0] * tie]],
        compact ? .45 : .5 * S + .12, .85);
    }
    // stations
    var nSt = compact ? 2 : 3;
    for (var st = 0; st < nSt; st++) {
      var sIdx = Math.round((.22 + st * .27) * (rail.length - 1));
      var sp = rail[sIdx], stn = tangentAt(rail, sIdx);
      var sz = compact ? 1.6 : 2.4 * S;
      ctx.save();
      ctx.translate(sp[0], sp[1]); ctx.rotate(Math.atan2(stn[1], stn[0]));
      ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = compact ? .7 : .85;
      ctx.beginPath(); ctx.rect(-sz * 1.5, -sz * 2.6, sz * 3, sz * 1.9);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -sz * .7); ctx.lineTo(0, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  })();

  /* -- 8. villages, groves, tanks --------------------------------------- */
  if (!compact) {
    villages.forEach(function (v, vi2) {
      ctx.save();
      ctx.strokeStyle = INK; ctx.fillStyle = PAPER; ctx.lineWidth = v.big ? .7 : .55;
      ctx.globalAlpha = .92;
      var r = v.big ? 1.9 * S : 1.35 * S;
      ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, 6.2832); ctx.fill(); ctx.stroke();
      if (v.big) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(v.x, v.y, r * .4, 0, 6.2832); ctx.fill(); }
      ctx.restore();
      // a mango grove beside about a third of them
      if ((vi2 * 7 + 3) % 10 < 3) {
        var gx = v.x + (rng() - .5) * 11, gy = v.y + (rng() < .5 ? -1 : 1) * (3 + rng() * 5);
        var nT = 3 + Math.floor(rng() * 4);
        ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = .38; ctx.globalAlpha = .78;
        for (var g3 = 0; g3 < nT; g3++) {
          var tx2 = gx + (rng() - .5) * 7, ty2 = gy + (rng() - .5) * 5, tr = 1 + rng() * .7;
          ctx.beginPath(); ctx.arc(tx2, ty2, tr, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tx2, ty2); ctx.lineTo(tx2, ty2 + tr * 1.5); ctx.stroke();
        }
        ctx.restore();
      }
      // a tank beside a few more
      if ((vi2 * 5 + 1) % 11 < 2) {
        var kx = v.x + (rng() - .5) * 12, ky = v.y + (rng() < .5 ? -1 : 1) * (4 + rng() * 5);
        var kw = 3 + rng() * 3.5, kh = kw * (.5 + rng() * .3);
        var tank = [];
        for (var kq = 0; kq < 10; kq++) {
          var ka = kq / 10 * Math.PI * 2;
          tank.push([kx + Math.cos(ka) * kw * (.85 + rng() * .3), ky + Math.sin(ka) * kh * (.85 + rng() * .3)]);
        }
        ctx.save();
        polyPath(ctx, tank, null, 0);
        ctx.fillStyle = PAPER; ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = .55; ctx.globalAlpha = .9; ctx.stroke();
        ctx.clip();
        for (var kl = -kh; kl < kh; kl += 1.5)
          stroke(ctx, [[kx - kw, ky + kl], [kx + kw, ky + kl]], .28, .5);
        ctx.restore();
      }
    });
  }

  /* -- 9. boundaries ---------------------------------------------------- */
  cells.forEach(function (poly) {
    if (poly.length < 3) return;
    ctx.save();
    ctx.setLineDash(compact ? [3, 2.4, 1, 2.4] : [5.5, 3, 1.2, 3]);
    ctx.strokeStyle = INK; ctx.globalAlpha = compact ? .45 : .62;
    ctx.lineWidth = compact ? .55 : .72;
    polyPath(ctx, poly, rng, .8); ctx.stroke();
    ctx.restore();
  });

  // the district boundary — heaviest line on the sheet, with its inner pecking
  (function () {
    ctx.save();
    ctx.strokeStyle = INK; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.lineWidth = compact ? 1.25 : 2.0 * S;
    polyPath(ctx, outline, rng, compact ? .5 : 1.0); ctx.stroke();
    ctx.restore();
    if (!compact) {
      // a fine companion line inside it, as the plates carry
      var shrunk = outline.map(function (p) {
        var dx = p[0] - cx, dy = p[1] - cy, L = Math.hypot(dx, dy) || 1;
        return [p[0] - dx / L * 3.4, p[1] - dy / L * 3.4];
      });
      ctx.save(); ctx.setLineDash([3.5, 2.6]);
      ctx.strokeStyle = INK; ctx.globalAlpha = .5; ctx.lineWidth = .5;
      polyPath(ctx, shrunk, rng, .5); ctx.stroke(); ctx.restore();
    }
  })();

  /* -- 10. feature lettering -------------------------------------------- */
  if (!compact && S > .72) {
    var rn = RIVERS[Math.floor(rng() * RIVERS.length)];
    labelAlong(ctx, "R. " + rn, river, .62, {
      font: 'italic 600 ' + (9.5 * S).toFixed(1) + 'px ' + SERIF,
      track: 2.4 * S, halo: 3.6, alpha: .8, side: -(hwEnd + 6)
    });
    labelAlong(ctx, "CANAL", canal, .58, {
      font: '' + (7.5 * S).toFixed(1) + 'px ' + SERIF, track: 2.6 * S, halo: 3.2, alpha: .62, side: -6
    });
    label(ctx, HILLS[Math.floor(rng() * HILLS.length)] + " HILLS", hillC[0], hillC[1] + hillR[1] * .62, {
      font: 'italic 600 ' + (8.5 * S).toFixed(1) + 'px ' + SERIF, track: 2.8 * S, halo: 3.6, alpha: .72
    });
    label(ctx, "RESERVED FOREST", forestC[0], forestC[1], {
      font: '' + (6.6 * S).toFixed(1) + 'px ' + SERIF, track: 2.2 * S, halo: 3.2, alpha: .6
    });
  }

  /* -- 11. the route, following the road where it can -------------------- */
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
        var legIdx = stepDir > 0 ? k2 : k2 - 1;
        var leg2 = legs[legIdx];
        if (!leg2) continue;
        var seq = stepDir > 0 ? leg2 : leg2.slice().reverse();
        chain = chain.concat(seq);
      }
      if (chain.length > 1) routeSegs.push(chain);
    }
    ctx.save();
    ctx.setLineDash([5.5, 3.5]); ctx.strokeStyle = SEAL;
    ctx.lineWidth = compact ? 1.1 : 1.9 * S; ctx.globalAlpha = .85;
    ctx.lineCap = "butt"; ctx.lineJoin = "round";
    routeSegs.forEach(function (seq) {
      var off = offsetPath(seq, compact ? 1.8 : 3.0 * S);
      pathOf(ctx, off); ctx.stroke();
    });
    ctx.restore();
  }

  /* -- 12. headquarters -------------------------------------------------- */
  T.forEach(function (t, i) {
    var sp = sites[i], on = sel.indexOf(t.id) !== -1;
    var r = compact ? 2.4 : 4.0 * S;
    ctx.save();
    // a clear disc of paper so the town reads out of the linework
    ctx.fillStyle = PAPER; ctx.globalAlpha = .85;
    ctx.beginPath(); ctx.arc(sp[0], sp[1], r * 2.1, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = on ? SEAL : INK; ctx.fillStyle = on ? SEAL : PAPER;
    ctx.lineWidth = on ? 1.8 : 1.2;
    ctx.beginPath(); ctx.arc(sp[0], sp[1], r, 0, 6.2832); ctx.fill(); ctx.stroke();
    if (!on) {                                     // the inner pip of a town symbol
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(sp[0], sp[1], r * .38, 0, 6.2832); ctx.fill();
    }
    if (on) {
      ctx.globalAlpha = .7; ctx.lineWidth = compact ? .8 : 1.0;
      ctx.beginPath(); ctx.arc(sp[0], sp[1], r * 2.0, 0, 6.2832); ctx.stroke();
    }
    ctx.restore();
    if (!compact) {
      label(ctx, t.name, sp[0], sp[1] - 12 * S, {
        font: '600 ' + (11.5 * S).toFixed(1) + 'px ' + SERIF,
        track: 2.2 * S, halo: 4.5, colour: on ? SEAL : INK
      });
      label(ctx, t.days + " days", sp[0], sp[1] + 12.5 * S, {
        font: (8.5 * S).toFixed(1) + 'px ' + MONO, track: 1.5 * S, halo: 4, alpha: .75,
        colour: on ? SEAL : "#6a5f45"
      });
    }
    marks.push({ id: t.id, x: sp[0], y: sp[1] });
  });

  /* -- 13. sheet furniture ---------------------------------------------- */
  // Kill anything that strayed into the margin, then rule the border.
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, neat.y); ctx.fillRect(0, neat.y + neat.h, W, H - neat.y - neat.h);
  ctx.fillRect(0, 0, neat.x, H); ctx.fillRect(neat.x + neat.w, 0, W - neat.x - neat.w, H);
  ctx.restore();
  // re-lay the fibre over the margin so it does not read as a flat mask
  for (var fj2 = 0; fj2 < Math.round(fibres * .35); fj2++) {
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
      ctx.globalAlpha = .45; ctx.lineWidth = .5;
      ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);
      ctx.restore(); return;
    }
    var ox = M, oy = M, ow = W - 2 * M, oh = H - 2 * M;
    var ix = M + band, iy = M + band, iw = W - 2 * (M + band), ih = H - 2 * (M + band);
    ctx.globalAlpha = .9; ctx.lineWidth = 1.0;
    ctx.strokeRect(ox, oy, ow, oh);
    ctx.lineWidth = .75; ctx.strokeRect(ix, iy, iw, ih);
    ctx.lineWidth = .9; ctx.globalAlpha = .85;
    ctx.strokeRect(neat.x - 2, neat.y - 2, neat.w + 4, neat.h + 4);
    // the graduated band — minutes of arc, alternately blocked in
    ctx.fillStyle = INK; ctx.globalAlpha = .88;
    var cell = Math.max(7, Math.round(9 * S)), n2;
    for (n2 = 0; n2 * cell < iw; n2++) {
      if (n2 % 2) continue;
      var cw = Math.min(cell, iw - n2 * cell);
      ctx.fillRect(ix + n2 * cell, oy, cw, band);
      ctx.fillRect(ix + n2 * cell, iy + ih, cw, band);
    }
    for (n2 = 0; n2 * cell < ih; n2++) {
      if (n2 % 2) continue;
      var chh = Math.min(cell, ih - n2 * cell);
      ctx.fillRect(ox, iy + n2 * cell, band, chh);
      ctx.fillRect(ix + iw, iy + n2 * cell, band, chh);
    }
    // fine graduation ticks inside the neat line
    ctx.globalAlpha = .55; ctx.lineWidth = .5;
    ctx.beginPath();
    for (var gx2 = neat.x; gx2 <= neat.x + neat.w + .5; gx2 += cell / 3) {
      ctx.moveTo(gx2, neat.y - 2); ctx.lineTo(gx2, neat.y + 1.6);
      ctx.moveTo(gx2, neat.y + neat.h + 2); ctx.lineTo(gx2, neat.y + neat.h - 1.6);
    }
    for (var gy2 = neat.y; gy2 <= neat.y + neat.h + .5; gy2 += cell / 3) {
      ctx.moveTo(neat.x - 2, gy2); ctx.lineTo(neat.x + 1.6, gy2);
      ctx.moveTo(neat.x + neat.w + 2, gy2); ctx.lineTo(neat.x + neat.w - 1.6, gy2);
    }
    ctx.stroke();
    ctx.restore();
  })();

  if (!compact && S > .7) {
    /* the north point */
    (function () {
      var nx = neat.x + neat.w - 22 * S, ny = neat.y + 24 * S, L = 13 * S;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.strokeStyle = INK; ctx.lineWidth = .6; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.arc(0, 0, L * .34, 0, 6.2832); ctx.stroke();
      // the long spike: west half solid, east half open
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(-L * .22, L * .5); ctx.lineTo(0, L * .22); ctx.closePath();
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(L * .22, L * .5); ctx.lineTo(0, L * .22); ctx.closePath();
      ctx.stroke();
      // short cross-arms
      ctx.globalAlpha = .75; ctx.lineWidth = .5;
      ctx.beginPath();
      ctx.moveTo(-L * .55, 0); ctx.lineTo(L * .55, 0); ctx.stroke();
      ctx.restore();
      label(ctx, "N", nx, ny - L - 6 * S, { font: '600 ' + (8.5 * S).toFixed(1) + 'px ' + SERIF, track: 0, halo: 3.4, alpha: .9 });
    })();

    /* the scale bar */
    (function () {
      var bw = Math.min(120 * S, neat.w * .3), bh = 3.6 * S;
      var bx3 = neat.x + 12 * S, by3 = neat.y + neat.h - 16 * S;
      ctx.save();
      ctx.fillStyle = PAPER; ctx.globalAlpha = .82;
      ctx.fillRect(bx3 - 5, by3 - 13 * S, bw + 10, bh + 24 * S);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = INK; ctx.lineWidth = .7;
      ctx.strokeRect(bx3, by3, bw, bh);
      ctx.fillStyle = INK;
      var segs = 5, sw = bw / segs;
      for (var s3 = 0; s3 < segs; s3++) if (s3 % 2 === 0) ctx.fillRect(bx3 + s3 * sw, by3, sw, bh);
      // a half-division at the left, subdivided
      ctx.lineWidth = .45; ctx.globalAlpha = .8;
      ctx.beginPath();
      for (var h4 = 1; h4 < 4; h4++) { ctx.moveTo(bx3 + sw * h4 / 4, by3); ctx.lineTo(bx3 + sw * h4 / 4, by3 + bh); }
      ctx.stroke();
      ctx.restore();
      var fnt = (6.4 * S).toFixed(1) + 'px ' + MONO;
      for (var lb = 0; lb <= segs; lb++)
        label(ctx, String(lb * 4), bx3 + lb * sw, by3 + bh + 6 * S, { font: fnt, track: .6, alpha: .72 });
      label(ctx, "SCALE OF MILES", bx3 + bw / 2, by3 - 6.5 * S,
        { font: (6.2 * S).toFixed(1) + 'px ' + SERIF, track: 2.2 * S, alpha: .68 });
    })();
  }

  /* the cartouche */
  if (!compact && opts.title) {
    var cw2 = Math.min(neat.w * .42, 210 * S), ch2 = 52 * S;
    var bx4 = neat.x + neat.w - cw2 - 8 * S, by4 = neat.y + neat.h - ch2 - 8 * S;
    ctx.save();
    ctx.fillStyle = PAPER; ctx.globalAlpha = .95;
    ctx.fillRect(bx4, by4, cw2, ch2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.strokeRect(bx4, by4, cw2, ch2);
    ctx.lineWidth = .5; ctx.globalAlpha = .75; ctx.strokeRect(bx4 + 3, by4 + 3, cw2 - 6, ch2 - 6);
    // corner ornaments
    ctx.globalAlpha = .8; ctx.lineWidth = .6;
    [[bx4 + 3, by4 + 3, 1, 1], [bx4 + cw2 - 3, by4 + 3, -1, 1],
     [bx4 + 3, by4 + ch2 - 3, 1, -1], [bx4 + cw2 - 3, by4 + ch2 - 3, -1, -1]].forEach(function (c) {
      ctx.beginPath();
      ctx.moveTo(c[0] + c[2] * 7, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * 7);
      ctx.stroke();
    });
    ctx.restore();
    label(ctx, opts.title, bx4 + cw2 / 2, by4 + 16 * S,
      { font: '600 ' + (11.5 * S).toFixed(1) + 'px ' + SERIF, track: 1.8 * S });
    ctx.save();
    ctx.strokeStyle = INK; ctx.globalAlpha = .5; ctx.lineWidth = .5;
    ctx.beginPath(); ctx.moveTo(bx4 + cw2 * .28, by4 + 24 * S); ctx.lineTo(bx4 + cw2 * .72, by4 + 24 * S);
    ctx.stroke(); ctx.restore();
    label(ctx, opts.sub || "", bx4 + cw2 / 2, by4 + 32 * S,
      { font: (7 * S).toFixed(1) + 'px ' + MONO, track: 2.2 * S, alpha: .68 });
    label(ctx, "SURVEY OF INDIA", bx4 + cw2 / 2, by4 + 43 * S,
      { font: (5.8 * S).toFixed(1) + 'px ' + SERIF, track: 2.6 * S, alpha: .5 });
  }

  if (typeof performance !== "undefined" && performance.now && opts.timing)
    drawDistrict.lastMs = performance.now() - t0;
  return marks;                                       // for hit targets
}

window.drawDistrict = drawDistrict;
