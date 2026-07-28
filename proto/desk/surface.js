/* The desk itself — teak, leather, lamplight.

   window.drawDeskSurface(canvas, { seed, blotter:{x,y,w,h}, lamp:{x,y} })

   Draws once per resize. Deterministic: every random number comes from a
   mulberry32 seeded on opts.seed, so the same desk is the same desk. No DOM
   beyond an offscreen scratch canvas, no assets, no network, no animation. */
"use strict";

(function () {

  /* ——— plumbing ————————————————————————————————————————————————————— */

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var TAU = Math.PI * 2;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function mix(c1, c2, t) {
    return [
      Math.round(lerp(c1[0], c2[0], t)),
      Math.round(lerp(c1[1], c2[1], t)),
      Math.round(lerp(c1[2], c2[2], t))
    ];
  }
  function rgba(c, a) {
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }
  function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  function off(W, H, dpr) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(W * dpr));
    c.height = Math.max(1, Math.round(H * dpr));
    var g = c.getContext("2d");
    g.scale(dpr, dpr);
    return { c: c, g: g };
  }

  /* Teak, roughly: a dark heartwood streak, a mid body, a bleached highlight. */
  var TEAK_DARK = [58, 31, 15];
  var TEAK_BODY = [124, 78, 45];
  var TEAK_PALE = [168, 118, 73];
  var GRAIN_DARK = [38, 19, 8];
  var GRAIN_PALE = [196, 152, 104];
  var GRAIN_RED = [96, 42, 20];

  /* ——— rounded rectangle sampled as points + outward normals ————————— */

  function roundRectPoints(x, y, w, h, r, density) {
    var pts = [];
    var i, n, t, a;
    r = Math.min(r, Math.min(w, h) / 2);
    var sideT = Math.max(4, Math.round((w - 2 * r) * density));
    var sideS = Math.max(4, Math.round((h - 2 * r) * density));
    var arcN = Math.max(6, Math.round(r * density * 2.2));

    function side(x0, y0, x1, y1, nx, ny, count) {
      for (i = 0; i < count; i++) {
        t = i / count;
        pts.push({ x: lerp(x0, x1, t), y: lerp(y0, y1, t), nx: nx, ny: ny });
      }
    }
    function arc(cx, cy, a0, a1, count) {
      for (i = 0; i < count; i++) {
        a = lerp(a0, a1, i / count);
        pts.push({
          x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
          nx: Math.cos(a), ny: Math.sin(a)
        });
      }
    }
    side(x + r, y, x + w - r, y, 0, -1, sideT);
    arc(x + w - r, y + r, -Math.PI / 2, 0, arcN);
    side(x + w, y + r, x + w, y + h - r, 1, 0, sideS);
    arc(x + w - r, y + h - r, 0, Math.PI / 2, arcN);
    side(x + w - r, y + h, x + r, y + h, 0, 1, sideT);
    arc(x + r, y + h - r, Math.PI / 2, Math.PI, arcN);
    side(x, y + h - r, x, y + r, -1, 0, sideS);
    arc(x + r, y + r, Math.PI, Math.PI * 1.5, arcN);
    n = pts.length;
    for (i = 0; i < n; i++) pts[i].t = i / n;
    return pts;
  }

  /* Perimeter wobble: leather is cut and beaten, not machined. */
  function wobblePath(ctx, pts, amp, ph) {
    var i, p, d;
    ctx.beginPath();
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      d = amp * (
        0.55 * Math.sin(p.t * TAU * 3 + ph) +
        0.30 * Math.sin(p.t * TAU * 7 + ph * 2.3) +
        0.15 * Math.sin(p.t * TAU * 17 + ph * 0.7)
      );
      if (i === 0) ctx.moveTo(p.x + p.nx * d, p.y + p.ny * d);
      else ctx.lineTo(p.x + p.nx * d, p.y + p.ny * d);
    }
    ctx.closePath();
  }

  /* ——— the wood ————————————————————————————————————————————————————— */

  function drawTeak(ctx, W, H, R, dpr) {
    var i, j, k, x, y;

    /* Boards run the long way. Two to four of them, unequal. */
    var nB = 2 + Math.floor(R() * 3);
    var cuts = [0];
    for (i = 1; i < nB; i++) cuts.push((i / nB + (R() - 0.5) * 0.14) * H);
    cuts.push(H);
    cuts.sort(function (a, b) { return a - b; });

    var boards = [];
    for (i = 0; i < nB; i++) {
      var y0 = cuts[i], y1 = cuts[i + 1];
      var tone = 0.28 + R() * 0.44;          /* where this board sits dark→pale */
      var b = {
        y0: y0, y1: y1, tone: tone,
        base: mix(mix(TEAK_DARK, TEAK_BODY, 0.55 + tone * 0.45),
                  TEAK_PALE, tone * 0.34),
        tilt: (R() - 0.5) * 0.026,
        A0: 3 + R() * 6.5, f0: TAU * (0.25 + R() * 0.3) / W, p0: R() * TAU,
        A1: 1.6 + R() * 4.0, f1: TAU * (0.7 + R() * 1.0) / W,
        g1: 0.0022 + R() * 0.004, p1: R() * TAU,
        A2: 0.5 + R() * 1.5, f2: TAU * (2.6 + R() * 3.4) / W,
        g2: 0.004 + R() * 0.007, p2: R() * TAU,
        bandF: 0.020 + R() * 0.035, bandP: R() * TAU,
        knots: []
      };
      boards.push(b);
    }

    /* Knots — two to four across the whole board, never on a seam. */
    var nK = 2 + Math.floor(R() * 3);
    for (k = 0; k < nK; k++) {
      var bi = Math.floor(R() * nB);
      var bd = boards[bi];
      if (bd.y1 - bd.y0 < 60) continue;
      bd.knots.push({
        x: W * (0.06 + R() * 0.88),
        y: lerp(bd.y0 + 22, bd.y1 - 22, 0.15 + R() * 0.7),
        A: 16 + R() * 34,
        w: 26 + R() * 58,
        r: 3 + R() * 7,
        sq: 0.55 + R() * 0.5
      });
    }

    function grainY(b, x, baseY) {
      var yy = baseY;
      yy += b.tilt * (x - W * 0.5);
      yy += b.A0 * Math.sin(x * b.f0 + b.p0);
      yy += b.A1 * Math.sin(x * b.f1 + baseY * b.g1 + b.p1);
      yy += b.A2 * Math.sin(x * b.f2 + baseY * b.g2 + b.p2);
      for (var q = 0; q < b.knots.length; q++) {
        var kn = b.knots[q];
        var d = baseY - kn.y, dist = Math.abs(d);
        if (dist > 260) continue;
        var sgn = d >= 0 ? 1 : -1;
        var amp = kn.A / (1 + dist / (kn.A * 1.7));
        var ww = kn.w * (1 + dist / (kn.w * 1.1));
        var dx = x - kn.x;
        yy += sgn * amp * Math.exp(-(dx * dx) / (2 * ww * ww));
      }
      return yy;
    }

    /* 1 — board bodies, each its own tone, plus a soft across-the-board wash */
    for (i = 0; i < nB; i++) {
      var b = boards[i];
      var g = ctx.createLinearGradient(0, b.y0, 0, b.y1);
      var up = mix(b.base, TEAK_PALE, 0.10 + R() * 0.12);
      var dn = mix(b.base, TEAK_DARK, 0.10 + R() * 0.16);
      if (R() < 0.5) { var tmp = up; up = dn; dn = tmp; }
      g.addColorStop(0, rgb(up));
      g.addColorStop(0.35 + R() * 0.3, rgb(b.base));
      g.addColorStop(1, rgb(dn));
      ctx.fillStyle = g;
      ctx.fillRect(-2, b.y0 - 1, W + 4, b.y1 - b.y0 + 2);
    }

    /* soft tonal blotches — no two square inches of teak are the same colour */
    ctx.save();
    for (i = 0; i < 26; i++) {
      x = R() * W; y = R() * H;
      var rr = (0.10 + R() * 0.30) * Math.max(W, H);
      var dark = R() < 0.55;
      var col = dark ? mix(TEAK_DARK, TEAK_BODY, R() * 0.5)
                     : mix(TEAK_BODY, TEAK_PALE, 0.3 + R() * 0.6);
      var gg = ctx.createRadialGradient(x, y, 0, x, y, rr);
      gg.addColorStop(0, rgba(col, 0.05 + R() * 0.10));
      gg.addColorStop(0.6, rgba(col, 0.02 + R() * 0.04));
      gg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gg;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.35 + R() * 0.5);       /* washes stretch along the grain */
      ctx.translate(-x, -y);
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      ctx.restore();
    }
    ctx.restore();

    /* 2 — the fibre, drawn offscreen so it can be laid down soft as well as sharp */
    var O = off(W, H, dpr), g2 = O.g;
    g2.lineCap = "round";

    for (i = 0; i < nB; i++) {
      var bd2 = boards[i];
      var yy = bd2.y0 - 6;
      while (yy < bd2.y1 + 6) {
        var band = 0.5 + 0.5 * Math.sin(yy * bd2.bandF + bd2.bandP);
        var step = 0.62 + band * 2.0 + R() * 0.85;
        yy += step;

        var kind = R();
        var pale = kind < 0.20;
        var col2 = pale
          ? mix(GRAIN_PALE, bd2.base, R() * 0.45)
          : kind < 0.42
            ? mix(GRAIN_RED, bd2.base, R() * 0.45)
            : mix(GRAIN_DARK, bd2.base, R() * 0.40);
        var a = (0.06 + Math.pow(R(), 1.7) * 0.34) * (1.35 - band * 0.6);
        if (pale) a *= 0.45;
        var lw = 0.32 + Math.pow(R(), 1.8) * 2.0 + band * 0.5;

        /* some fibres run out before the edge */
        var x0 = R() < 0.30 ? R() * W * 0.42 : -14;
        var x1 = R() < 0.30 ? W - R() * W * 0.42 : W + 14;
        if (x1 - x0 < W * 0.2) { x0 = -14; x1 = W + 14; }

        var grd = g2.createLinearGradient(x0, 0, x1, 0);
        grd.addColorStop(0, rgba(col2, 0));
        grd.addColorStop(0.06 + R() * 0.08, rgba(col2, a));
        grd.addColorStop(0.3 + R() * 0.15, rgba(col2, a * (0.5 + R() * 0.85)));
        grd.addColorStop(0.6 + R() * 0.15, rgba(col2, a * (0.5 + R() * 0.85)));
        grd.addColorStop(0.9 - R() * 0.08, rgba(col2, a));
        grd.addColorStop(1, rgba(col2, 0));

        g2.strokeStyle = grd;
        g2.lineWidth = lw;
        g2.beginPath();
        var first = true;
        for (x = x0; x <= x1; x += 3.2) {
          var py = grainY(bd2, x, yy);
          if (py < bd2.y0 - 3 || py > bd2.y1 + 3) { first = true; continue; }
          if (first) { g2.moveTo(x, py); first = false; }
          else g2.lineTo(x, py);
        }
        g2.stroke();
      }
    }

    /* pores — short dark dashes lying along the fibre */
    var nP = Math.round((W * H) / 2600);
    for (i = 0; i < nP; i++) {
      var bd3 = boards[Math.floor(R() * nB)];
      var px = R() * W;
      var py0 = lerp(bd3.y0, bd3.y1, R());
      var len = 4 + Math.pow(R(), 2) * 30;
      g2.strokeStyle = rgba(mix(GRAIN_DARK, bd3.base, R() * 0.3), 0.10 + R() * 0.34);
      g2.lineWidth = 0.4 + R() * 1.2;
      g2.beginPath();
      for (j = 0; j <= 6; j++) {
        var xx = px + (len * j) / 6;
        var yv = grainY(bd3, xx, py0);
        if (j === 0) g2.moveTo(xx, yv); else g2.lineTo(xx, yv);
      }
      g2.stroke();
    }

    /* ray fleck — the pale chatoyant streaks that make polished teak shimmer */
    for (i = 0; i < 34; i++) {
      var bd4 = boards[Math.floor(R() * nB)];
      var fx = R() * W, fy = lerp(bd4.y0, bd4.y1, R());
      var fl = 30 + R() * 150;
      var fg = g2.createLinearGradient(fx, 0, fx + fl, 0);
      var fa = 0.02 + R() * 0.05;
      fg.addColorStop(0, rgba(GRAIN_PALE, 0));
      fg.addColorStop(0.5, rgba(GRAIN_PALE, fa));
      fg.addColorStop(1, rgba(GRAIN_PALE, 0));
      g2.strokeStyle = fg;
      g2.lineWidth = 1.5 + R() * 5;
      g2.beginPath();
      for (j = 0; j <= 8; j++) {
        var gx = fx + (fl * j) / 8;
        var gy = grainY(bd4, gx, fy);
        if (j === 0) g2.moveTo(gx, gy); else g2.lineTo(gx, gy);
      }
      g2.stroke();
    }

    /* lay the fibre down: soft first, then sharp on top */
    var hasFilter = typeof ctx.filter === "string";
    if (hasFilter) {
      ctx.save();
      ctx.filter = "blur(1.3px)";
      ctx.globalAlpha = 0.34;
      ctx.drawImage(O.c, 0, 0, W, H);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(O.c, 0, 0, W, H);
    ctx.restore();

    /* 3 — the knots themselves */
    for (i = 0; i < nB; i++) {
      var kb = boards[i];
      for (k = 0; k < kb.knots.length; k++) {
        var kn2 = kb.knots[k];
        ctx.save();
        ctx.translate(kn2.x, kn2.y);
        ctx.scale(1, kn2.sq);
        var kr = kn2.r;
        var halo = ctx.createRadialGradient(0, 0, kr * 0.3, 0, 0, kr * 5.5);
        halo.addColorStop(0, rgba(mix(GRAIN_DARK, TEAK_DARK, 0.5), 0.55));
        halo.addColorStop(0.35, rgba(TEAK_DARK, 0.22));
        halo.addColorStop(1, rgba(TEAK_DARK, 0));
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(0, 0, kr * 5.5, 0, TAU); ctx.fill();

        for (j = 4; j >= 0; j--) {
          ctx.strokeStyle = rgba([38, 22, 11], 0.16 + j * 0.09);
          ctx.lineWidth = 0.6 + R() * 1.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, kr * (0.25 + j * 0.24) * (0.9 + R() * 0.25),
                      kr * (0.25 + j * 0.24) * (0.75 + R() * 0.3),
                      R() * 0.6, 0, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = rgba([30, 17, 8], 0.75);
        ctx.beginPath(); ctx.arc(0, 0, kr * 0.42, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    /* 4 — plank seams: hairline, chamfer catch, and a whisper of shadow */
    for (i = 1; i < nB; i++) {
      var sy = cuts[i];
      var sw = 0.6 + R() * 0.9, sp = R() * TAU;
      function seam(dy, style, width) {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (x = -4; x <= W + 4; x += 6) {
          var vy = sy + dy + sw * Math.sin(x * 0.004 + sp) + 0.5 * Math.sin(x * 0.017 + sp * 2);
          if (x === -4) ctx.moveTo(x, vy); else ctx.lineTo(x, vy);
        }
        ctx.stroke();
      }
      seam(-2.0, rgba(TEAK_PALE, 0.20), 1.8);      /* chamfer catching light */
      seam(0, rgba([24, 12, 4], 0.72), 1.1);        /* the joint */
      seam(1.8, rgba([26, 13, 5], 0.30), 3.0);      /* shadow below */
    }
  }

  /* ——— sheen: polish, brighter along the grain, brighter toward the lamp —— */

  function drawSheen(ctx, W, H, lamp) {
    var r = Math.max(W, H) * 0.62;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.translate(lamp.x, lamp.y + H * 0.18);
    ctx.scale(2.3, 1);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, "rgba(255,206,138,0.11)");
    g.addColorStop(0.35, "rgba(240,180,116,0.06)");
    g.addColorStop(0.72, "rgba(190,136,86,0.02)");
    g.addColorStop(1, "rgba(160,110,70,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  /* ——— wear on the wood (goes under the lamplight) ————————————————— */

  function drawWoodWear(ctx, W, H, R, b) {
    var i, j;

    function clearOfPad(x, y, pad) {
      if (!b) return true;
      return !(x > b.x - pad && x < b.x + b.w + pad &&
               y > b.y - pad && y < b.y + b.h + pad);
    }

    /* two ring marks where a glass stood */
    var rings = 0, tries = 0;
    while (rings < 2 && tries < 80) {
      tries++;
      var rx = W * (0.05 + R() * 0.9), ry = H * (0.05 + R() * 0.9);
      var rr = Math.min(W, H) * (0.030 + R() * 0.022);
      if (!clearOfPad(rx, ry, rr * 1.4)) continue;
      rings++;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(1, 0.80 + R() * 0.18);
      ctx.rotate(R() * TAU);
      var fillA = 0.018 + R() * 0.022;
      var fg = ctx.createRadialGradient(0, 0, rr * 0.2, 0, 0, rr);
      fg.addColorStop(0, "rgba(238,228,208," + (fillA * 0.5).toFixed(3) + ")");
      fg.addColorStop(0.82, "rgba(238,228,208," + fillA.toFixed(3) + ")");
      fg.addColorStop(1, "rgba(238,228,208,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill();
      /* the ring proper — broken, uneven */
      for (j = 0; j < 5; j++) {
        var a0 = R() * TAU, a1 = a0 + 0.6 + R() * 2.1;
        ctx.strokeStyle = "rgba(242,232,212," + (0.05 + R() * 0.11).toFixed(3) + ")";
        ctx.lineWidth = 1.2 + R() * 3.4;
        ctx.beginPath();
        ctx.arc(0, 0, rr * (0.88 + R() * 0.14), a0, a1);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(52,32,16,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, rr * 1.03, R() * TAU, R() * TAU + 2.4); ctx.stroke();
      ctx.restore();
    }

    /* a splatter of old ink, near one edge */
    var ex = R() < 0.5 ? W * (0.04 + R() * 0.10) : W * (0.86 + R() * 0.10);
    var ey = H * (0.10 + R() * 0.80);
    if (!clearOfPad(ex, ey, 30)) ey = H * (R() < 0.5 ? 0.06 : 0.94);
    var ink = [16, 18, 30];
    for (i = 0; i < 9; i++) {
      var d = Math.pow(R(), 0.7) * Math.min(W, H) * 0.075;
      var ang = R() * TAU;
      var sx = ex + Math.cos(ang) * d, sy2 = ey + Math.sin(ang) * d;
      var sr = i === 0 ? 2.4 + R() * 3.2 : 0.5 + Math.pow(R(), 2) * 2.6;
      ctx.save();
      ctx.translate(sx, sy2);
      ctx.rotate(R() * TAU);
      ctx.scale(1, 0.5 + R() * 0.7);
      var ig = ctx.createRadialGradient(0, 0, 0, 0, 0, sr * 1.6);
      ig.addColorStop(0, rgba(ink, 0.48 + R() * 0.40));
      ig.addColorStop(0.55, rgba(ink, 0.26 + R() * 0.24));
      ig.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.arc(0, 0, sr * 1.6, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /* ——— the blotter ————————————————————————————————————————————————— */

  /* Pebble grain: each cell a shallow irregular dome, its crown catching the
     lamp and its far lip in shadow. Elliptical and unequal, so it never reads
     as a field of circles. */
  function pebble(ctx, R, x, y, w, h, cellR, lift, toward, per, strength) {
    var i, n = Math.round((w * h) / per);
    ctx.lineCap = "butt";
    for (i = 0; i < n; i++) {
      var px = x + R() * w, py = y + R() * h;
      var rx = cellR * (0.5 + R() * 1.15);
      var ry = rx * (0.55 + R() * 0.7);
      var rot = R() * TAU;
      var jt = (R() - 0.5) * 1.15;
      var span = 0.65 + R() * 0.95;
      var a = toward + jt;
      ctx.strokeStyle = rgba(lift, (0.020 + R() * 0.038) * strength);
      ctx.lineWidth = 0.4 + R() * 0.6;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, rot, a - span, a + span);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0," +
        ((0.050 + R() * 0.090) * strength).toFixed(3) + ")";
      ctx.lineWidth = 0.45 + R() * 0.8;
      ctx.beginPath();
      ctx.ellipse(px, py, rx * (1 + R() * 0.14), ry * (1 + R() * 0.14), rot,
                  a + Math.PI - span * 1.1, a + Math.PI + span * 1.1);
      ctx.stroke();
    }
    ctx.lineCap = "round";
  }

  function drawBlotter(ctx, W, H, R, b, lamp) {
    var i, j;
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var vx = cx - lamp.x, vy = cy - lamp.y;
    var vl = Math.hypot(vx, vy) || 1;
    vx /= vl; vy /= vl;                       /* unit vector away from the lamp */

    var r = Math.min(18, Math.min(b.w, b.h) * 0.05);
    var pts = roundRectPoints(b.x, b.y, b.w, b.h, r, 0.9);
    var ph = R() * TAU;
    var wob = 1.1 + R() * 0.9;

    var oxblood = R() < 0.35;
    var padDark = oxblood ? [40, 15, 13] : [16, 23, 17];
    var padMid = oxblood ? [78, 30, 25] : [33, 45, 33];
    var padEdge = oxblood ? [21, 8, 7] : [9, 13, 9];
    var padLift = oxblood ? [186, 138, 112] : [150, 160, 128];

    /* contact shadow, thrown away from the lamp */
    ctx.save();
    ctx.shadowColor = "rgba(18,9,3,0.55)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetX = vx * 11;
    ctx.shadowOffsetY = vy * 11;
    ctx.fillStyle = "rgba(0,0,0,1)";
    wobblePath(ctx, pts, wob, ph); ctx.fill();
    ctx.shadowBlur = 7;
    ctx.shadowOffsetX = vx * 3;
    ctx.shadowOffsetY = vy * 3;
    ctx.shadowColor = "rgba(12,6,2,0.75)";
    wobblePath(ctx, pts, wob, ph); ctx.fill();
    ctx.restore();

    /* the thickness of the hide, visible on the far side */
    ctx.save();
    ctx.translate(vx * 4.2, vy * 4.2);
    wobblePath(ctx, pts, wob, ph);
    ctx.fillStyle = rgb(padEdge);
    ctx.fill();
    ctx.restore();

    /* the face */
    ctx.save();
    wobblePath(ctx, pts, wob, ph);
    ctx.clip();

    var fg = ctx.createLinearGradient(b.x, b.y, b.x + b.w * 0.55, b.y + b.h);
    fg.addColorStop(0, rgb(mix(padMid, padDark, 0.15)));
    fg.addColorStop(0.5, rgb(padMid));
    fg.addColorStop(1, rgb(mix(padDark, padMid, 0.35)));
    ctx.fillStyle = fg;
    ctx.fillRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);

    /* large-scale mottle: hide is never even */
    for (i = 0; i < 24; i++) {
      var mx = b.x + R() * b.w, my = b.y + R() * b.h;
      var mr = Math.min(b.w, b.h) * (0.08 + R() * 0.30);
      var mc = R() < 0.5 ? padDark : mix(padMid, padLift, 0.30);
      var mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, rgba(mc, 0.08 + R() * 0.13));
      mg.addColorStop(1, rgba(mc, 0));
      ctx.fillStyle = mg;
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }

    /* pebble grain, two scales. The cells first: each a shallow dome, lit from
       the lamp side and shadowed away from it. Then a fine tooth over the top.
       Both at very low contrast — hide reads as texture, never as confetti. */
    var toward = Math.atan2(-vy, -vx);         /* angle back toward the lamp */
    /* The field is huge, so its grain is rasterised once at single density and
       laid back down — leather wants to be a shade soft anyway. */
    var cellR = clamp(Math.min(b.w, b.h) * 0.0055, 1.3, 3.0);
    var PB = off(b.w, b.h, 1);
    pebble(PB.g, R, 0, 0, b.w, b.h, cellR, padLift, toward, 58, 1.25);
    ctx.drawImage(PB.c, b.x, b.y, b.w, b.h);
    /* creases pressed in by years of elbows */
    for (i = 0; i < 14; i++) {
      var kx = b.x + R() * b.w, ky = b.y + R() * b.h;
      var kl = Math.min(b.w, b.h) * (0.1 + R() * 0.4);
      var ka = R() * TAU;
      ctx.strokeStyle = "rgba(0,0,0," + (0.03 + R() * 0.05).toFixed(3) + ")";
      ctx.lineWidth = 0.6 + R() * 1.6;
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.quadraticCurveTo(
        kx + Math.cos(ka) * kl * 0.5 + (R() - 0.5) * 20,
        ky + Math.sin(ka) * kl * 0.5 + (R() - 0.5) * 20,
        kx + Math.cos(ka) * kl, ky + Math.sin(ka) * kl);
      ctx.stroke();
    }

    /* darken toward the edges so a sheet of paper reads on it */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, b.h / b.w);
    var eg = ctx.createRadialGradient(0, 0, b.w * 0.18, 0, 0, b.w * 0.72);
    eg.addColorStop(0, "rgba(0,0,0,0)");
    eg.addColorStop(0.65, "rgba(0,0,0,0.10)");
    eg.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = eg;
    ctx.fillRect(-b.w, -b.w, b.w * 2, b.w * 2);
    ctx.restore();

    /* the lamp side of the pad catches a little */
    var lg = ctx.createLinearGradient(
      cx - vx * b.w * 0.7, cy - vy * b.h * 0.7,
      cx + vx * b.w * 0.7, cy + vy * b.h * 0.7);
    lg.addColorStop(0, "rgba(255,226,178,0.16)");
    lg.addColorStop(0.28, "rgba(255,218,170,0.07)");
    lg.addColorStop(0.62, "rgba(255,206,156,0.015)");
    lg.addColorStop(1, "rgba(255,200,150,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);

    ctx.restore();                                       /* end pad clip */

    /* rolled edge: bright where it faces the lamp, black where it does not */
    (function () {
      var i2, p2, d2, prev = null;
      for (i2 = 0; i2 < pts.length; i2++) {
        p2 = pts[i2];
        d2 = wob * (
          0.55 * Math.sin(p2.t * TAU * 3 + ph) +
          0.30 * Math.sin(p2.t * TAU * 7 + ph * 2.3) +
          0.15 * Math.sin(p2.t * TAU * 17 + ph * 0.7));
        var ex2 = p2.x + p2.nx * d2, ey2 = p2.y + p2.ny * d2;
        if (prev) {
          var facing = -(p2.nx * vx + p2.ny * vy);   /* +1 toward the lamp */
          ctx.beginPath();
          ctx.moveTo(prev[0], prev[1]);
          ctx.lineTo(ex2, ey2);
          if (facing > 0) {
            ctx.strokeStyle = "rgba(226,206,172," + (0.05 + facing * 0.24).toFixed(3) + ")";
            ctx.lineWidth = 1.3;
          } else {
            ctx.strokeStyle = "rgba(0,0,0," + (0.15 - facing * 0.40).toFixed(3) + ")";
            ctx.lineWidth = 2.0;
          }
          ctx.stroke();
        }
        prev = [ex2, ey2];
      }
    })();

    /* gilt double rule */
    var gold = ctx.createLinearGradient(
      cx - vx * b.w * 0.6, cy - vy * b.h * 0.6,
      cx + vx * b.w * 0.6, cy + vy * b.h * 0.6);
    gold.addColorStop(0, "rgba(246,214,140,0.92)");
    gold.addColorStop(0.35, "rgba(206,166,86,0.72)");
    gold.addColorStop(0.75, "rgba(128,98,44,0.42)");
    gold.addColorStop(1, "rgba(92,70,32,0.30)");

    var in1 = Math.max(6, Math.min(b.w, b.h) * 0.022);
    var in2 = in1 + Math.max(3.5, Math.min(b.w, b.h) * 0.010);

    function rule(inset, width, style) {
      var p = roundRectPoints(b.x + inset, b.y + inset,
                              b.w - inset * 2, b.h - inset * 2,
                              Math.max(3, r - inset * 0.4), 0.5);
      wobblePath(ctx, p, 0.5, ph * 1.7);
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    rule(in1 + 0.9, 1.6, "rgba(0,0,0,0.35)");
    rule(in1, 1.5, gold);
    rule(in2 + 0.7, 1.0, "rgba(0,0,0,0.30)");
    rule(in2, 0.9, gold);

    /* leather corner pieces */
    var cs = clamp(Math.min(b.w, b.h) * 0.15, 26, 120);
    var corners = [
      [b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1],
      [b.x + b.w, b.y + b.h, -1, -1], [b.x, b.y + b.h, 1, -1]
    ];
    for (i = 0; i < 4; i++) {
      var C = corners[i];
      var ox = C[0], oy = C[1], sxg = C[2], syg = C[3];
      var s1 = cs * (0.92 + R() * 0.2), s2 = cs * (0.92 + R() * 0.2);
      var ax = ox + sxg * s1, ay = oy;
      var bx = ox, by = oy + syg * s2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ox + sxg * 1.5, oy + syg * 1.5);
      ctx.lineTo(ax, ay + syg * 1.0);
      /* hypotenuse bows very slightly */
      ctx.quadraticCurveTo(
        (ax + bx) / 2 + sxg * cs * 0.06, (ay + by) / 2 + syg * cs * 0.06,
        bx + sxg * 1.0, by);
      ctx.closePath();
      ctx.clip();

      var cg = ctx.createLinearGradient(ox, oy, ax, by);
      cg.addColorStop(0, rgb(mix(padDark, [0, 0, 0], 0.40)));
      cg.addColorStop(0.45, rgb(mix(padDark, padMid, 0.62)));
      cg.addColorStop(1, rgb(mix(padDark, [0, 0, 0], 0.10)));
      ctx.fillStyle = cg;
      ctx.fillRect(Math.min(ox, ax, bx) - 4, Math.min(oy, ay, by) - 4,
                   cs * 2 + 8, cs * 2 + 8);
      pebble(ctx, R, Math.min(ox, ax), Math.min(oy, by),
             s1, s2, cellR * 0.9, padLift, toward, 90, 0.85);
      /* the strap is a heavier hide, and creases across the corner */
      for (j = 0; j < 5; j++) {
        var wx = lerp(ox, ax, 0.15 + R() * 0.7);
        var wy = lerp(oy, by, 0.15 + R() * 0.7);
        ctx.strokeStyle = "rgba(0,0,0," + (0.05 + R() * 0.10).toFixed(3) + ")";
        ctx.lineWidth = 0.7 + R() * 1.3;
        ctx.beginPath();
        ctx.moveTo(wx - sxg * cs * 0.3, wy + syg * cs * 0.3);
        ctx.quadraticCurveTo(wx, wy, wx + sxg * cs * 0.3, wy - syg * cs * 0.3);
        ctx.stroke();
      }
      ctx.restore();

      /* the strap's raised lip along the hypotenuse */
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ax, ay + syg * 1.0);
      ctx.quadraticCurveTo(
        (ax + bx) / 2 + sxg * cs * 0.06, (ay + by) / 2 + syg * cs * 0.06,
        bx + sxg * 1.0, by);
      var lit = (sxg * -vx + syg * -vy) > 0;
      ctx.strokeStyle = lit ? "rgba(206,192,162,0.10)" : "rgba(0,0,0,0.40)";
      ctx.lineWidth = lit ? 2.4 : 1.3;
      ctx.stroke();
      if (lit) {
        ctx.strokeStyle = "rgba(216,202,172,0.10)";
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.30)";
      ctx.lineWidth = 2.6;
      ctx.translate(-sxg * 1.8, -syg * 1.8);
      ctx.stroke();
      ctx.restore();

      /* stitching, set in from the hypotenuse */
      ctx.save();
      var inset = 5.5;
      var hx0 = ax - sxg * inset * 1.4, hy0 = ay + syg * (1.0 + inset * 0.5);
      var hx1 = bx + sxg * (1.0 + inset * 0.5), hy1 = by - syg * inset * 1.4;
      var stitches = Math.round(cs / 6.5);
      ctx.lineCap = "round";
      for (j = 0; j < stitches; j++) {
        var t = (j + 0.5) / stitches;
        var mx2 = lerp(hx0, hx1, t) + sxg * cs * 0.045;
        var my2 = lerp(hy0, hy1, t) + syg * cs * 0.045;
        var dxn = (hx1 - hx0), dyn = (hy1 - hy0);
        var dn = Math.hypot(dxn, dyn) || 1;
        dxn /= dn; dyn /= dn;
        var sl = 2.6 + R() * 1.8;
        ctx.strokeStyle = "rgba(0,0,0,0.34)";
        ctx.lineWidth = 1.9 + R() * 0.6;
        ctx.beginPath();
        ctx.moveTo(mx2 - dxn * sl, my2 - dyn * sl + 0.9);
        ctx.lineTo(mx2 + dxn * sl, my2 + dyn * sl + 0.9);
        ctx.stroke();
        ctx.strokeStyle = "rgba(214,196,154," + (0.34 + R() * 0.30).toFixed(3) + ")";
        ctx.lineWidth = 0.9 + R() * 0.6;
        ctx.beginPath();
        ctx.moveTo(mx2 - dxn * sl, my2 - dyn * sl);
        ctx.lineTo(mx2 + dxn * sl, my2 + dyn * sl);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ——— lamplight ————————————————————————————————————————————————— */

  function drawLight(ctx, W, H, lamp) {
    var far = Math.max(
      Math.hypot(lamp.x, lamp.y),
      Math.hypot(W - lamp.x, lamp.y),
      Math.hypot(lamp.x, H - lamp.y),
      Math.hypot(W - lamp.x, H - lamp.y));
    var R0 = far * 0.92;

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    var g = ctx.createRadialGradient(lamp.x, lamp.y, R0 * 0.02, lamp.x, lamp.y, R0);
    g.addColorStop(0.00, "rgb(255,244,226)");
    g.addColorStop(0.15, "rgb(248,228,200)");
    g.addColorStop(0.32, "rgb(224,196,164)");
    g.addColorStop(0.52, "rgb(186,154,124)");
    g.addColorStop(0.72, "rgb(140,110,84)");
    g.addColorStop(0.88, "rgb(100,74,54)");
    g.addColorStop(1.00, "rgb(70,48,32)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    /* the warm pool, and the hot spot at its heart */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    var p = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, R0 * 0.42);
    p.addColorStop(0, "rgba(255,196,116,0.24)");
    p.addColorStop(0.35, "rgba(240,166,88,0.11)");
    p.addColorStop(1, "rgba(200,130,60,0)");
    ctx.fillStyle = p;
    ctx.fillRect(0, 0, W, H);

    var hr = Math.min(W, H) * 0.16;
    var hs = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, hr);
    hs.addColorStop(0, "rgba(255,228,176,0.20)");
    hs.addColorStop(0.5, "rgba(255,202,136,0.08)");
    hs.addColorStop(1, "rgba(255,190,120,0)");
    ctx.fillStyle = hs;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    /* vignette */
    ctx.save();
    var vr = Math.max(W, H) * 0.80;
    var v = ctx.createRadialGradient(W / 2, H / 2, vr * 0.35, W / 2, H / 2, vr);
    v.addColorStop(0, "rgba(14,7,2,0)");
    v.addColorStop(0.7, "rgba(14,7,2,0.10)");
    v.addColorStop(1, "rgba(10,5,1,0.40)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ——— scratches and dust, which read only against the light ————————— */

  function drawFinalWear(ctx, W, H, R, lamp, b) {
    var i, j;
    var far = Math.hypot(W, H);

    /* fine scratches in the polish */
    for (i = 0; i < 6; i++) {
      var sx = R() * W, sy = R() * H;
      if (b && sx > b.x && sx < b.x + b.w && sy > b.y && sy < b.y + b.h) {
        sy = R() < 0.5 ? b.y * R() : b.y + b.h + R() * Math.max(4, H - b.y - b.h);
        sy = clamp(sy, 4, H - 4);
      }
      var d = Math.hypot(sx - lamp.x, sy - lamp.y) / far;
      var lit = clamp(1.25 - d * 1.35, 0.08, 1);
      var len = Math.min(W, H) * (0.03 + R() * 0.11);
      var ang = (R() - 0.5) * 0.9 + (R() < 0.35 ? Math.PI / 2 : 0);
      ctx.save();
      ctx.strokeStyle = "rgba(255,236,204," + (0.07 + lit * 0.34).toFixed(3) + ")";
      ctx.lineWidth = 0.35 + R() * 0.6;
      ctx.beginPath();
      var bow = (R() - 0.5) * len * 0.14;
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(
        sx + Math.cos(ang) * len * 0.5 - Math.sin(ang) * bow,
        sy + Math.sin(ang) * len * 0.5 + Math.cos(ang) * bow,
        sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      ctx.stroke();
      /* the shadowed lip of the scratch */
      ctx.strokeStyle = "rgba(24,12,4," + (0.05 + lit * 0.10).toFixed(3) + ")";
      ctx.lineWidth = 0.5 + R() * 0.5;
      ctx.translate(0.9, 0.9);
      ctx.stroke();
      ctx.restore();
    }

    /* dust, gathered where the lamp does not reach */
    for (i = 0; i < 2; i++) {
      var best = null, bd = -1;
      for (j = 0; j < 12; j++) {
        var qx = R() * W, qy = R() * H;
        var dd = Math.hypot(qx - lamp.x, qy - lamp.y);
        if (dd > bd) { bd = dd; best = { x: qx, y: qy }; }
      }
      var rr = Math.min(W, H) * (0.10 + R() * 0.14);
      var dg = ctx.createRadialGradient(best.x, best.y, 0, best.x, best.y, rr);
      dg.addColorStop(0, "rgba(196,182,158,0.055)");
      dg.addColorStop(0.6, "rgba(180,166,144,0.025)");
      dg.addColorStop(1, "rgba(170,158,138,0)");
      ctx.fillStyle = dg;
      ctx.fillRect(best.x - rr, best.y - rr, rr * 2, rr * 2);
      for (j = 0; j < 30; j++) {
        var a = R() * TAU, t = Math.pow(R(), 0.5) * rr;
        ctx.fillStyle = "rgba(206,192,166," + (0.02 + R() * 0.06).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(best.x + Math.cos(a) * t, best.y + Math.sin(a) * t,
                0.3 + R() * 0.8, 0, TAU);
        ctx.fill();
      }
    }
  }

  /* ——— the desk ————————————————————————————————————————————————— */

  window.drawDeskSurface = function (canvas, opts) {
    if (!canvas || !canvas.getContext) return;
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var dpr = 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    var W = canvas.width / dpr, H = canvas.height / dpr;
    if (!(W > 0 && H > 0)) return;

    var R = mulberry32((opts.seed == null ? 1 : opts.seed) | 0);

    var lamp = opts.lamp || { x: W * 0.18, y: -H * 0.05 };
    var b = opts.blotter || null;
    if (b && (!(b.w > 0) || !(b.h > 0))) b = null;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    drawTeak(ctx, W, H, R, dpr);
    drawSheen(ctx, W, H, lamp);
    drawWoodWear(ctx, W, H, R, b);
    if (b) drawBlotter(ctx, W, H, R, b, lamp);
    drawLight(ctx, W, H, lamp);
    drawFinalWear(ctx, W, H, R, lamp, b);

    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (typeof ctx.filter === "string") ctx.filter = "none";
  };

})();
