/* The district, drawn as a Survey of India plate.

   The hatching engine from the engraving spike, cut down to what a map needs.
   Tone is line spacing, texture is angle, hills are hachured down the slope.
   Everything comes from a seed and the tehsil data, so the same district draws
   identically every time — and redraws when its condition changes, which is
   the whole reason this is code and not a picture.

   drawDistrict(canvas, {seed, tehsils, selected, title, sub, compact})       */
"use strict";

var INK = "#221c12", PAPER = "#efe7ce";

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

function stroke(ctx, pts, w, alpha) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = INK; ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  if (pts.length > 3 && w >= 1.2) {           // the burin swells through the belly
    var a = Math.floor(pts.length * 0.3), b = Math.ceil(pts.length * 0.7);
    ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]);
    for (var j = a + 1; j < b; j++) ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.lineWidth = w * 1.3; ctx.globalAlpha = (alpha == null ? 1 : alpha) * .6; ctx.stroke();
  }
  ctx.restore();
}

function wobbly(x1, y1, x2, y2, amp, rng, seg) {
  var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < .001) return [[x1, y1], [x2, y2]];
  var n = Math.max(2, Math.min(80, Math.round(len / (seg || 14))));
  var px = -dy / len, py = dx / len, pts = [], phase = rng() * 6.28, freq = .35 + rng() * .5;
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    var off = Math.sin(phase + t * freq * 3.1) * amp + (rng() - .5) * amp * .35;
    off *= Math.sin(Math.PI * clamp(t, 0, 1)) * .8 + .2;
    pts.push([x1 + dx * t + px * off, y1 + dy * t + py * off]);
  }
  return pts;
}

// Fine, close and calm. Three crossing families at most, or it turns to mud.
function hatch(ctx, b, tone, o) {
  o = o || {}; var rng = o.rng, t = clamp(tone, 0, 1);
  if (t <= .012) return;
  var cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.hypot(b.w, b.h) / 2 + 10;
  var fams = [[o.angle || 0, lerp(8.5, 1.6, t), 1]];
  if (t > .52) fams.push([(o.angle || 0) + 1.24, lerp(11, 2.3, t), .9]);
  fams.forEach(function (f) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(f[0]);
    for (var y = -R; y <= R; y += f[1] * (o.coarse || 1)) {
      var w = lerp(.28, .55, t) * (.85 + rng() * .3);
      stroke(ctx, wobbly(-R, y + (rng() - .5) * 2, R, y, o.wobble == null ? .35 : o.wobble, rng, 30), w, f[2] * (o.alpha == null ? .85 : o.alpha));
    }
    ctx.restore();
  });
}

function stipple(ctx, b, density, rng, o) {
  o = o || {};
  var n = Math.round(b.w * b.h * density / 900);
  ctx.save(); ctx.fillStyle = INK; ctx.globalAlpha = o.alpha || .55;
  for (var i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(b.x + rng() * b.w, b.y + rng() * b.h, (o.size || .7) * (.5 + rng()), 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

function polyPath(ctx, poly, rng, amp) {
  ctx.beginPath();
  for (var i = 0; i < poly.length; i++) {
    var p = poly[i], q = poly[(i + 1) % poly.length];
    if (i === 0) ctx.moveTo(p[0], p[1]);
    if (amp) { var pts = wobbly(p[0], p[1], q[0], q[1], amp, rng, 20);
      for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]); }
    else ctx.lineTo(q[0], q[1]);
  }
  ctx.closePath();
}
function polyBounds(p) {
  var a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  p.forEach(function (q) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); });
  return { x: a, y: b, w: c - a, h: d - b };
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

// Map lettering is masked out of the linework beneath it.
function label(ctx, text, x, y, o) {
  o = o || {};
  ctx.save();
  ctx.translate(x, y); ctx.rotate(o.rot || 0);
  ctx.font = o.font || '600 12px "Iowan Old Style", Palatino, Georgia, serif';
  ctx.textBaseline = "middle"; ctx.textAlign = "left";
  var sp = o.track == null ? 2 : o.track, chars = String(text).split(""), total = 0;
  chars.forEach(function (c) { total += ctx.measureText(c).width + sp; });
  var cur = -total / 2;
  if (o.halo) {
    ctx.strokeStyle = PAPER; ctx.lineWidth = o.halo; ctx.lineJoin = "round";
    var c2 = cur;
    chars.forEach(function (c) { ctx.strokeText(c, c2, 0); c2 += ctx.measureText(c).width + sp; });
  }
  ctx.fillStyle = o.colour || INK; ctx.globalAlpha = o.alpha == null ? .95 : o.alpha;
  chars.forEach(function (c) { ctx.fillText(c, cur, 0); cur += ctx.measureText(c).width + sp; });
  ctx.restore();
}

function drawDistrict(cv, opts) {
  var W = cv.width / 2, H = cv.height / 2;          // authored at half backing size
  var ctx = cv.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(2, 2); ctx.clearRect(0, 0, W, H);
  var rng = mulberry32(opts.seed || 20251115);
  var compact = !!opts.compact;

  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  for (var i = 0; i < W * H / 1400; i++) {           // fibre
    ctx.fillStyle = rng() < .5 ? "rgba(120,95,45,.10)" : "rgba(255,250,235,.12)";
    ctx.fillRect(rng() * W, rng() * H, 1, 1);
  }

  var M = compact ? 6 : 16;
  if (!compact) {                                     // the plate mark
    ctx.save(); ctx.strokeStyle = "rgba(90,70,30,.32)"; ctx.lineWidth = 1.2;
    ctx.strokeRect(M, M, W - 2 * M, H - 2 * M); ctx.restore();
  }
  var inner = { x: M + 8, y: M + 8, w: W - 2 * M - 16, h: H - 2 * M - 16 };
  var cx = inner.x + inner.w / 2, cy = inner.y + inner.h * .47;
  var rx = inner.w * .46, ry = inner.h * .44;

  var outline = [];
  for (var a = 0; a < Math.PI * 2; a += Math.PI / 22) {
    var n = .86 + .16 * Math.sin(a * 3.1 + 1.2) + .09 * Math.sin(a * 5.7) + (rng() - .5) * .05;
    outline.push([cx + Math.cos(a) * rx * n, cy + Math.sin(a) * ry * n]);
  }

  var T = opts.tehsils || [];
  var sites = T.map(function (t) { return [inner.x + t.x * inner.w, inner.y + t.y * inner.h]; });
  var cells = sites.map(function (sp, i) {
    var poly = outline.slice();
    sites.forEach(function (op, j) { if (i !== j) poly = clipHalf(poly, sp, op); });
    return poly;
  });

  // cultivation: dense stipple where the tehsil is well, thinning as it fails
  cells.forEach(function (poly, i) {
    if (poly.length < 3) return;
    var cond = T[i].cond == null ? .25 : T[i].cond;
    ctx.save(); polyPath(ctx, poly, null, 0); ctx.clip();
    var b = polyBounds(poly);
    stipple(ctx, b, lerp(3.4, .4, cond) * (compact ? .5 : 1), rng, { size: compact ? .5 : .7, alpha: .5 });
    if (cond > .55) hatch(ctx, b, .1, { rng: rng, angle: .42, wobble: 1.2, alpha: .45 });
    ctx.restore();
  });

  // hills, hachured down the flank — never radiating from a crest
  var hilly = cells[T.length - 1];
  if (hilly && hilly.length > 2 && !compact) {
    ctx.save(); polyPath(ctx, hilly, null, 0); ctx.clip();
    var hb = polyBounds(hilly);
    for (var k = 0; k < 9; k++) {
      var bx = hb.x + 10 + rng() * Math.max(1, hb.w - 20), by = hb.y + 10 + rng() * Math.max(1, hb.h - 20);
      var hrx = 12 + rng() * 16, hry = hrx * (.42 + rng() * .2), tilt = (rng() - .5) * .7;
      [0.6, 0.82, 1.0].forEach(function (f) {
        for (var th = 0; th < Math.PI * 2; th += .17 + f * .05) {
          if (rng() < .16) continue;
          var c = Math.cos(th), s = Math.sin(th), iR = f - .22;
          var ox = bx + (c * hrx * f) * Math.cos(tilt) - (s * hry * f) * Math.sin(tilt);
          var oy = by + (c * hrx * f) * Math.sin(tilt) + (s * hry * f) * Math.cos(tilt);
          var ix = bx + (c * hrx * iR) * Math.cos(tilt) - (s * hry * iR) * Math.sin(tilt);
          var iy = by + (c * hrx * iR) * Math.sin(tilt) + (s * hry * iR) * Math.cos(tilt);
          stroke(ctx, [[ox, oy], [ix, iy]], (.3 + rng() * .2) * (s > 0 ? 1.35 : .85), .8);
        }
      });
    }
    ctx.restore();
  }

  // the river: banks widening downstream, water ruled between them
  var riv = [], rw = [];
  for (var t2 = 0; t2 <= 1.0001; t2 += .05) {
    riv.push([inner.x - 6 + (inner.w + 12) * t2,
      cy - inner.h * .04 + Math.sin(t2 * 3.6 + .9) * inner.h * .13 + Math.sin(t2 * 9.5) * 3]);
    rw.push(lerp(compact ? 1.2 : 2.6, compact ? 3 : 7, t2));
  }
  var bankA = riv.map(function (p, i) { return [p[0], p[1] - rw[i]]; });
  var bankB = riv.map(function (p, i) { return [p[0], p[1] + rw[i]]; });
  ctx.save();
  ctx.beginPath(); ctx.moveTo(bankA[0][0], bankA[0][1]);
  bankA.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
  for (var r2 = bankB.length - 1; r2 >= 0; r2--) ctx.lineTo(bankB[r2][0], bankB[r2][1]);
  ctx.closePath(); ctx.clip();
  for (var wy = cy - inner.h * .3; wy < cy + inner.h * .3; wy += 2.4) {
    stroke(ctx, wobbly(inner.x - 8, wy, inner.x + inner.w + 8, wy + 2, .5, rng, 40), .3, .5);
  }
  ctx.restore();
  stroke(ctx, bankA, compact ? .8 : 1.3, .95);
  stroke(ctx, bankB, compact ? .8 : 1.3, .95);

  // the railway, with its sleepers
  var rA = [inner.x + 14, inner.y + inner.h * .84], rB = [inner.x + inner.w - 14, inner.y + inner.h * .2];
  stroke(ctx, wobbly(rA[0], rA[1], rB[0], rB[1], .6, rng, 40), compact ? 1 : 1.5, .95);
  var rl = Math.hypot(rB[0] - rA[0], rB[1] - rA[1]), ux = (rB[0] - rA[0]) / rl, uy = (rB[1] - rA[1]) / rl;
  for (var d = 8; d < rl - 8; d += compact ? 9 : 13) {
    var px = -uy * (compact ? 2.6 : 4.2), py = ux * (compact ? 2.6 : 4.2);
    var mx = rA[0] + ux * d, my = rA[1] + uy * d;
    stroke(ctx, [[mx - px, my - py], [mx + px, my + py]], .8, .9);
  }

  // tehsil boundaries, dotted as a revenue map has them
  cells.forEach(function (poly) {
    if (poly.length < 3) return;
    ctx.save(); ctx.setLineDash([6, 4, 1.5, 4]);
    ctx.strokeStyle = INK; ctx.globalAlpha = .7; ctx.lineWidth = .9;
    polyPath(ctx, poly, rng, .9); ctx.stroke(); ctx.restore();
  });
  ctx.save(); polyPath(ctx, outline, rng, 1.2);
  ctx.strokeStyle = INK; ctx.lineWidth = compact ? 1.4 : 2.2; ctx.stroke(); ctx.restore();

  // headquarters and names, and where a route has been laid
  var marks = [];
  T.forEach(function (t, i) {
    var sp = sites[i], on = (opts.selected || []).indexOf(t.id) !== -1;
    ctx.save();
    ctx.strokeStyle = on ? "#8f2f22" : INK; ctx.fillStyle = on ? "#8f2f22" : PAPER;
    ctx.lineWidth = on ? 2 : 1.2;
    ctx.beginPath(); ctx.arc(sp[0], sp[1], compact ? 2.6 : 4.4, 0, 7); ctx.fill(); ctx.stroke();
    if (on) {
      ctx.globalAlpha = .55; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sp[0], sp[1], compact ? 5 : 9, 0, 7); ctx.stroke();
    }
    ctx.restore();
    if (!compact) {
      label(ctx, t.name, sp[0], sp[1] - 14, {
        font: '600 12px "Iowan Old Style", Palatino, Georgia, serif',
        track: 2.2, halo: 4.5, colour: on ? "#8f2f22" : INK
      });
      label(ctx, t.days + " days", sp[0], sp[1] + 15, {
        font: '9px "Courier New", monospace', track: 1.6, halo: 4, alpha: .7,
        colour: on ? "#8f2f22" : "#6a5f45"
      });
    }
    marks.push({ id: t.id, x: sp[0], y: sp[1] });
  });

  if (!compact && opts.title) {                       // cartouche
    var cw = 210, ch = 50, bx = W - M - 14 - cw, by = H - M - 12 - ch;
    ctx.save(); ctx.fillStyle = PAPER; ctx.fillRect(bx, by, cw, ch);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(bx, by, cw, ch);
    ctx.lineWidth = .6; ctx.globalAlpha = .7; ctx.strokeRect(bx + 3, by + 3, cw - 6, ch - 6);
    ctx.restore();
    label(ctx, opts.title, bx + cw / 2, by + 19, { font: '600 12px "Iowan Old Style", Palatino, Georgia, serif', track: 1.8 });
    label(ctx, opts.sub || "", bx + cw / 2, by + 34, { font: '8px "Courier New", monospace', track: 2.4, alpha: .6 });
  }
  return marks;                                       // for hit targets
}

window.drawDistrict = drawDistrict;
