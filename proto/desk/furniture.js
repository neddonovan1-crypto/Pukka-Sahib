/* furniture.js — the objects on a District Officer's desk, 1920s, as inline SVG.

   Each entry takes { w } (width in CSS px; the height follows the object's
   natural aspect) and returns a complete, self-contained <svg> string: no
   <style>, no classes, no external references — everything styled by attribute,
   because these are dropped into a page with innerHTML and the page's own
   stylesheet must not reach them.

   House rules, held to without exception:
     · the light comes from the UPPER LEFT. Highlights up-left, core shadow and
       reflected light down-right, a soft contact shadow thrown to the lower
       right of everything that stands on the desk.
     · a shallow three-quarter view from slightly above — never a flat
       elevation, never a plan. Round things show their top as an ellipse.
     · metal reads as metal by the speed of the value swing: a hot specular
       lying next to a near-black core, then warmth bouncing back at the very
       bottom edge. Smooth gradients alone make plastic.
     · glass is low-alpha fills and bright edges, never a flat grey.
     · every gradient id carries a per-call counter, or gradients bleed between
       instances that share a page.                                           */
"use strict";

(function (root) {

  /* ---- the desk palette ------------------------------------------------ */
  var BR_SPEC = "#fff3d0",       /* brass, hot specular   */
      BR_HI   = "#e2c073",       /* brass, highlight      */
      BR_LIT  = "#d8b25e",
      BR_MID  = "#c19a45",
      BR      = "#a9822f",       /* brass, base           */
      BR_SH   = "#6d5119",       /* brass, shadow         */
      BR_DEEP = "#3a2a0b",       /* brass, core shadow    */
      BR_BNC  = "#b98f36",       /* brass, bounced light  */
      WD_HI   = "#a8794a",       /* wood, highlight       */
      WD_LIT  = "#c18f57",
      WD      = "#6b4a2f",       /* wood, base            */
      WD_SH   = "#3d2917",       /* wood, shadow          */
      WD_DEEP = "#221609",
      INK     = "#221c12",
      LEATHER = "#33402f",
      PAPER   = "#efe7ce",
      PAPER_S = "#c9ba95",
      SERIF   = "Georgia,'Times New Roman',Times,serif";

  /* ---- plumbing -------------------------------------------------------- */
  var seq = 0;
  function uid() { seq += 1; return "fn" + seq; }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function stops(list) {
    var out = "", i, s;
    for (i = 0; i < list.length; i++) {
      s = list[i];
      out += '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' +
             (s.length > 2 ? ' stop-opacity="' + s[2] + '"' : "") + '/>';
    }
    return out;
  }
  function lg(id, x1, y1, x2, y2, list) {
    return '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 +
           '" x2="' + x2 + '" y2="' + y2 + '" gradientUnits="userSpaceOnUse">' +
           stops(list) + '</linearGradient>';
  }
  function rg(id, cx, cy, r, list, fx, fy) {
    return '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy +
           '" r="' + r + '" fx="' + (fx == null ? cx : fx) + '" fy="' +
           (fy == null ? cy : fy) + '" gradientUnits="userSpaceOnUse">' +
           stops(list) + '</radialGradient>';
  }
  /* a soft blot — contact shadows, cast shadows, glows. objectBoundingBox, so
     the same def fits any ellipse you hang it on. */
  function blot(id, col, op) {
    return '<radialGradient id="' + id + '">' + stops([
      [0, col, op], [0.4, col, op * 0.76], [0.72, col, op * 0.34], [1, col, 0]
    ]) + '</radialGradient>';
  }
  function svg(w, vw, vh, defs, body) {
    var h = Math.round(w * vh / vw * 100) / 100;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
           '" viewBox="0 0 ' + vw + ' ' + vh + '" role="img" ' +
           'style="display:block;overflow:visible">' +
           '<defs>' + defs + '</defs>' + body + '</svg>';
  }
  function num(v, d) { return (typeof v === "number" && isFinite(v) && v > 0) ? v : d; }

  /* a turned brass barrel seen across: lit shoulder, fast fall to a near-black
     core three-quarters over, then the desk bouncing back into the far edge */
  function brassBar(id, x1, y1, x2, y2) {
    return lg(id, x1, y1, x2, y2, [
      [0, BR_HI], [0.07, BR_SPEC], [0.16, BR_LIT], [0.34, BR_MID], [0.5, BR],
      [0.64, BR_SH], [0.8, BR_DEEP], [0.92, "#5c4413"], [1, BR_BNC]
    ]);
  }
  function brassDome(id, cx, cy, r) {
    return rg(id, cx, cy, r, [
      [0, BR_SPEC], [0.1, BR_HI], [0.24, BR_LIT], [0.42, BR_MID], [0.58, BR],
      [0.74, BR_SH], [0.89, BR_DEEP], [0.97, "#54400f"], [1, BR_BNC]
    ], cx - r * 0.3, cy - r * 0.34);
  }
  function woodBar(id, x1, y1, x2, y2) {
    return lg(id, x1, y1, x2, y2, [
      [0, WD_LIT], [0.1, WD_HI], [0.3, "#8a6038"], [0.5, WD],
      [0.72, WD_SH], [0.9, WD_DEEP], [1, "#5c4026"]
    ]);
  }

  /* ====================================================================== *
   *  INKWELL — square-cut glass well, brass neck and hinged lid
   * ====================================================================== */
  function inkwell(o) {
    var u = uid(), w = num(o && o.w, 80);
    var d =
      blot("sh" + u, "#17100a", 0.55) +
      lg("gl" + u, 12, 44, 88, 104, [
        ["0", "#fbfdf7", "0.5"], ["0.14", "#dee6dc", "0.28"],
        ["0.4", "#a9b5a9", "0.18"], ["0.68", "#6c7a70", "0.24"],
        ["0.88", "#4e5a52", "0.32"], ["1", "#b3c0b3", "0.46"]
      ]) +
      lg("ik" + u, 14, 72, 88, 108, [
        [0, "#40371f"], [0.22, "#2b2415"], [0.55, INK], [0.82, "#14100a"], [1, "#3d3420"]
      ]) +
      brassBar("nk" + u, 28, 32, 74, 50) +
      brassDome("dm" + u, 50, 36, 26) +
      brassBar("kn" + u, 42, 8, 60, 24);

    var b =
      '<ellipse cx="55" cy="105" rx="45" ry="9" fill="url(#sh' + u + ')"/>' +
      /* far rim of the mouth, seen across the well */
      '<path d="M20 44 Q50 34 80 44 Q50 53 20 44 Z" fill="#5d6a60" opacity=".38"/>' +
      /* glass body, square-cut and slightly flared to the foot */
      '<path d="M20 44 Q50 53 80 44 L88 96 Q50 108 12 96 Z" fill="url(#gl' + u + ')"/>' +
      /* the ink standing in it */
      '<path d="M16.8 73 Q50 83 83.2 73 L88 96 Q50 108 12 96 Z" fill="url(#ik' + u + ')"/>' +
      '<path d="M16.8 73 Q50 65 83.2 73 Q50 83 16.8 73 Z" fill="#2f2718"/>' +
      '<path d="M26 71.6 Q37 68 49 67.8" stroke="#8a7f5e" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".5"/>' +
      /* facets: the two arrises of the cut glass, and the bright near corner */
      '<path d="M30.5 47 L26 100.6" stroke="#ffffff" stroke-width="1" fill="none" opacity=".3"/>' +
      '<path d="M69.5 47 L74 100.6" stroke="#ffffff" stroke-width="0.9" fill="none" opacity=".2"/>' +
      '<path d="M21.6 46.6 L14.6 94" stroke="#ffffff" stroke-width="3" ' +
        'stroke-linecap="round" fill="none" opacity=".78"/>' +
      '<path d="M25.6 49 L19.6 92" stroke="#ffffff" stroke-width="1.1" ' +
        'stroke-linecap="round" fill="none" opacity=".3"/>' +
      '<path d="M78.6 48 L85.6 93" stroke="#e6eee4" stroke-width="1.8" ' +
        'stroke-linecap="round" fill="none" opacity=".45"/>' +
      '<path d="M16 95 Q50 106 84 95" stroke="#ffffff" stroke-width="1.8" ' +
        'fill="none" stroke-linecap="round" opacity=".5"/>' +
      /* brass neck rising out of the mouth */
      '<path d="M29 42 Q50 49 71 42 L71 34 Q50 27 29 34 Z" fill="url(#nk' + u + ')"/>' +
      '<path d="M29 34 Q50 41 71 34 Q50 27 29 34 Z" fill="' + BR_MID + '"/>' +
      '<path d="M31.4 42.4 Q50 50 68.6 42.4" stroke="' + BR_DEEP + '" stroke-width="1.3" ' +
        'fill="none" opacity=".7"/>' +
      /* hinge lug, tucked round the back right */
      '<path d="M69 30.4 Q74.6 29.4 75 33 Q74.6 36.4 69.6 35.6 Z" fill="' + BR_SH + '"/>' +
      '<path d="M69.6 31 Q73.6 30.4 74.2 32.8" stroke="' + BR_HI + '" stroke-width="0.8" ' +
        'fill="none" opacity=".55"/>' +
      /* lid, a low dome */
      '<path d="M30 33 C30 17 70 17 70 33 Q50 40 30 33 Z" fill="url(#dm' + u + ')"/>' +
      '<path d="M33.6 30 C34.6 22 41 18.6 48 18.4" stroke="' + BR_SPEC + '" ' +
        'stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M64.6 21.4 C68.6 24.6 69.4 29 69 33.4" stroke="#231803" ' +
        'stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M33 35.6 Q50 41.6 67 35.4" stroke="' + BR_BNC + '" stroke-width="1.1" ' +
        'fill="none" opacity=".55"/>' +
      /* knob */
      '<path d="M47 18 L47 13 L53 13 L53 18 Q50 20 47 18 Z" fill="url(#kn' + u + ')"/>' +
      '<ellipse cx="50" cy="11.6" rx="6" ry="3.4" fill="url(#kn' + u + ')"/>' +
      '<path d="M45.8 10.6 Q48 8.6 51 8.8" stroke="' + BR_SPEC + '" stroke-width="1.4" ' +
        'fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M45.6 13.6 Q50 16.6 54.6 13.2" stroke="' + BR_DEEP + '" stroke-width="1" ' +
        'fill="none" opacity=".55"/>';
    return svg(w, 100, 114, d, b);
  }

  /* ====================================================================== *
   *  PEN REST — turned wood cradle with raised bobbin ends, a dip pen in it
   * ====================================================================== */
  function penrest(o) {
    var u = uid(), w = num(o && o.w, 90);
    var d =
      blot("sh" + u, "#17100a", 0.5) +
      blot("cs" + u, "#1c1207", 0.42) +
      woodBar("bo" + u, 0, 33, 0, 50) +
      lg("tp" + u, 8, 26, 92, 40, [
        [0, "#d0a067"], [0.16, WD_LIT], [0.45, WD_HI], [0.75, "#7d5836"], [1, "#4a3120"]
      ]) +
      rg("kl" + u, 14, 30, 15, [
        [0, "#d8a86e"], [0.22, WD_LIT], [0.5, WD_HI], [0.76, WD], [0.93, WD_DEEP], [1, "#7a5433"]
      ], 10, 26) +
      rg("kr" + u, 86, 30, 15, [
        [0, WD_LIT], [0.2, WD_HI], [0.46, WD], [0.72, WD_SH], [0.92, "#150d05"], [1, "#7a5433"]
      ], 81, 26) +
      lg("hd" + u, 20, 12, 62, 30, [
        [0, "#c08a5a"], [0.1, "#8d5c38"], [0.34, "#5a3320"], [0.62, "#2e1810"],
        [0.86, "#120a06"], [1, "#4e2c1c"]
      ]) +
      brassBar("fe" + u, 66, 10, 80, 24) +
      lg("nb" + u, 78, 12, 98, 26, [
        [0, "#8d867a"], [0.2, "#4c4639"], [0.62, "#26211a"], [1, "#5a5344"]
      ]);

    var b =
      '<ellipse cx="54" cy="50" rx="47" ry="7" fill="url(#sh' + u + ')"/>' +
      /* the cradle bar — stout, running between the two turned ends */
      '<path d="M17 33 L83 33 L82 45 Q50 48.6 18 45 Z" fill="url(#bo' + u + ')"/>' +
      '<path d="M17 33 Q50 28.6 83 33 Q50 37.6 17 33 Z" fill="url(#tp' + u + ')"/>' +
      '<path d="M23 31.4 Q36 28.6 50 28.2" stroke="#f0c48c" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round" opacity=".8"/>' +
      /* two grooves cut across the top to take a pen */
      '<path d="M33 30.6 Q38 35.4 43 31" stroke="' + WD_DEEP + '" stroke-width="2.6" ' +
        'fill="none" opacity=".85"/>' +
      '<path d="M33.6 30.2 Q38 33.8 42.4 30.6" stroke="#c1935e" stroke-width="0.9" ' +
        'fill="none" opacity=".45"/>' +
      '<path d="M58 31 Q63 35.8 68 31.4" stroke="' + WD_DEEP + '" stroke-width="2.6" ' +
        'fill="none" opacity=".85"/>' +
      '<path d="M58.6 30.6 Q63 34.2 67.4 31" stroke="#c1935e" stroke-width="0.9" ' +
        'fill="none" opacity=".4"/>' +
      /* grain and the shaded underside */
      '<path d="M22 36.6 Q50 34.4 78 36.4" stroke="#8f6740" stroke-width="0.8" ' +
        'fill="none" opacity=".5"/>' +
      '<path d="M21 41 Q50 43.8 80 40.8" stroke="#8f6740" stroke-width="0.7" ' +
        'fill="none" opacity=".35"/>' +
      '<path d="M19.6 44.4 Q50 48.2 80.4 44.2" stroke="' + WD_DEEP + '" stroke-width="2" ' +
        'fill="none" opacity=".6"/>' +
      /* the ends throw a little shade back along the bar */
      '<path d="M17 32 Q23 39 17 46" fill="#1c1207" opacity=".28"/>' +
      '<path d="M83 32 Q77 39 83 46" fill="#1c1207" opacity=".42"/>' +
      /* turned bobbin ends, standing proud of the bar */
      '<ellipse cx="14" cy="31" rx="9.6" ry="13" fill="url(#kl' + u + ')"/>' +
      '<ellipse cx="86" cy="31" rx="9.6" ry="13" fill="url(#kr' + u + ')"/>' +
      /* the turning: a collar groove round each end */
      '<path d="M5.4 27.4 Q14 33.4 22.6 27.4" stroke="' + WD_DEEP + '" stroke-width="1.4" ' +
        'fill="none" opacity=".55"/>' +
      '<path d="M5.6 29.6 Q14 35.6 22.4 29.6" stroke="#c99a63" stroke-width="1" ' +
        'fill="none" opacity=".45"/>' +
      '<path d="M77.4 27.4 Q86 33.4 94.6 27.4" stroke="' + WD_DEEP + '" stroke-width="1.4" ' +
        'fill="none" opacity=".6"/>' +
      '<path d="M77.6 29.6 Q86 35.6 94.4 29.6" stroke="#8a6038" stroke-width="0.9" ' +
        'fill="none" opacity=".4"/>' +
      '<path d="M7 26.4 Q9.4 20.4 15.4 20" stroke="#f4c894" stroke-width="2.4" ' +
        'fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M19.4 22.6 Q23.6 28.6 21 37.4" stroke="#150d05" stroke-width="2" ' +
        'fill="none" stroke-linecap="round" opacity=".55"/>' +
      '<path d="M80.4 23 Q84.4 19.4 90 20.6" stroke="#d1a06a" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M93.4 26 Q96 33 91.4 40.4" stroke="#120b04" stroke-width="2.4" ' +
        'fill="none" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M6 36 Q10.4 42.6 17.4 41.4" stroke="#8a6038" stroke-width="1.4" ' +
        'fill="none" stroke-linecap="round" opacity=".5"/>' +
      /* the pen cast onto the bar */
      '<ellipse cx="55" cy="33.6" rx="26" ry="3.4" fill="url(#cs' + u + ')" ' +
        'transform="rotate(-6 55 33.6)"/>' +
      /* the pen itself, lying in the grooves */
      '<g transform="rotate(-6 50 24) translate(0 5.6)">' +
        '<path d="M22 20.6 Q23.6 16.6 28 16.8 L60 18.6 L60 26 L28 27.4 Q23.6 27.6 22 23.8 Z" ' +
          'fill="url(#hd' + u + ')"/>' +
        '<path d="M28 18.6 L57 20" stroke="#e6b077" stroke-width="1.9" ' +
          'fill="none" stroke-linecap="round" opacity=".9"/>' +
        '<path d="M28 21 L57 22.2" stroke="#a06840" stroke-width="1" ' +
          'fill="none" stroke-linecap="round" opacity=".5"/>' +
        '<path d="M29 26.2 L57 25.4" stroke="#0d0805" stroke-width="1.4" fill="none" opacity=".7"/>' +
        '<path d="M59 18.6 L69 19.4 L69 25.8 L59 26 Z" fill="url(#fe' + u + ')"/>' +
        '<path d="M60 19.6 L68 20.2" stroke="' + BR_SPEC + '" stroke-width="1.4" ' +
          'fill="none" opacity=".95"/>' +
        '<path d="M60 25.2 L68 24.8" stroke="' + BR_DEEP + '" stroke-width="1.2" ' +
          'fill="none" opacity=".8"/>' +
        '<path d="M68.5 20 Q81 20.8 89 22.4 Q81 24.6 68.5 25 Z" fill="url(#nb' + u + ')"/>' +
        '<path d="M70 20.8 Q80 21.4 87 22.6" stroke="#b6ad9c" stroke-width="0.9" ' +
          'fill="none" opacity=".75"/>' +
        '<path d="M75 22.5 L88.4 22.5" stroke="#0d0805" stroke-width="0.9" fill="none"/>' +
        '<ellipse cx="75" cy="22.5" rx="2.4" ry="1.6" fill="#0d0805"/>' +
      '</g>';
    return svg(w, 100, 56, d, b);
  }

  /* ====================================================================== *
   *  PAPERWEIGHT — bevelled brass slab with a domed boss
   * ====================================================================== */
  function paperweight(o) {
    var u = uid(), w = num(o && o.w, 70);
    var d =
      blot("sh" + u, "#17100a", 0.55) +
      blot("cs" + u, "#241a05", 0.6) +
      lg("tp" + u, 10, 26, 84, 62, [
        [0, BR_SPEC], [0.08, BR_HI], [0.26, BR_LIT], [0.52, BR_MID], [0.78, BR], [1, BR_SH]
      ]) +
      lg("fr" + u, 8, 46, 46, 78, [
        [0, BR_MID], [0.2, BR], [0.55, BR_SH], [0.85, "#4c380f"], [1, BR_BNC]
      ]) +
      lg("rt" + u, 50, 50, 96, 72, [
        [0, "#4c380f"], [0.35, BR_DEEP], [0.72, "#2a1e07"], [1, "#8a6a28"]
      ]) +
      brassDome("bs" + u, 52, 42, 22);

    var b =
      '<ellipse cx="56" cy="74" rx="46" ry="8" fill="url(#sh' + u + ')"/>' +
      /* the two visible sides, then the top face */
      '<path d="M8 46 L46 66 L46 76 L8 56 Z" fill="url(#fr' + u + ')"/>' +
      '<path d="M46 66 L94 50 L94 60 L46 76 Z" fill="url(#rt' + u + ')"/>' +
      '<path d="M8 46 L42 30 L94 50 L46 66 Z" fill="url(#tp' + u + ')"/>' +
      /* a raked specular across the top face */
      '<path d="M18 43.4 L50 31.6 L58.4 34.8 L26.4 47 Z" fill="' + BR_SPEC + '" opacity=".34"/>' +
      '<path d="M21 44.2 L49 33.6" stroke="#ffffff" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".55"/>' +
      /* arrises: hot on the upper left, near-black away from the light */
      '<path d="M9.4 46.4 L42.2 31.2" stroke="' + BR_SPEC + '" stroke-width="2" ' +
        'fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M8.4 46.6 L8.4 55.6" stroke="' + BR_HI + '" stroke-width="1.4" ' +
        'fill="none" opacity=".6"/>' +
      '<path d="M42.6 31 L93 49.6" stroke="' + BR_HI + '" stroke-width="1.2" ' +
        'fill="none" stroke-linecap="round" opacity=".45"/>' +
      '<path d="M46.2 66.4 L93.6 50.6" stroke="#1e1504" stroke-width="1.6" ' +
        'fill="none" opacity=".8"/>' +
      '<path d="M93.6 50.2 L93.6 59.8" stroke="#1e1504" stroke-width="1.6" ' +
        'fill="none" opacity=".85"/>' +
      '<path d="M9 55.6 L45.6 74.8" stroke="' + BR_BNC + '" stroke-width="1.5" ' +
        'fill="none" opacity=".7"/>' +
      '<path d="M47 66.6 L47 75.6" stroke="#2a1e07" stroke-width="1.4" fill="none" opacity=".6"/>' +
      /* the boss casts down and to the right across the slab */
      '<ellipse cx="58" cy="48" rx="22" ry="9" fill="url(#cs' + u + ')"/>' +
      /* the boss */
      '<ellipse cx="52" cy="44.6" rx="18.5" ry="7.4" fill="#2a1e07" opacity=".5"/>' +
      '<path d="M33.6 43.6 C35.6 29.6 68.4 27.4 70.4 41 C70.4 47.8 33.6 50.2 33.6 43.6 Z" ' +
        'fill="url(#bs' + u + ')"/>' +
      '<path d="M38.4 41.4 C40.6 33.6 48.6 31 55 31.2" stroke="' + BR_SPEC + '" ' +
        'stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<ellipse cx="45" cy="35.6" rx="7" ry="2.6" fill="#ffffff" opacity=".28" ' +
        'transform="rotate(-16 45 35.6)"/>' +
      '<path d="M66 34.6 C70 38 70.2 42 69.6 44.6" stroke="#1e1504" ' +
        'stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M37.6 46.6 Q52 51.6 66.6 46" stroke="' + BR_BNC + '" stroke-width="1.2" ' +
        'fill="none" opacity=".6"/>';
    return svg(w, 100, 82, d, b);
  }

  /* ====================================================================== *
   *  BELL — brass counter bell with its plunger
   * ====================================================================== */
  function bell(o) {
    var u = uid(), w = num(o && o.w, 70);
    var d =
      blot("sh" + u, "#17100a", 0.58) +
      blot("cs" + u, "#241a05", 0.55) +
      blot("sp" + u, "#fff8e2", 0.95) +
      brassDome("dm" + u, 50, 70, 44) +
      brassBar("bp" + u, 12, 72, 88, 94) +
      brassBar("st" + u, 43, 16, 58, 28) +
      brassDome("kb" + u, 50, 18, 13);

    var b =
      '<ellipse cx="55" cy="92" rx="43" ry="8.5" fill="url(#sh' + u + ')"/>' +
      /* base plate: a low turned plinth, a hand\'s breadth wider than the dome */
      '<ellipse cx="50" cy="85" rx="34" ry="10.4" fill="#241a05"/>' +
      '<ellipse cx="50" cy="83" rx="34" ry="10.4" fill="#4c380f"/>' +
      '<ellipse cx="50" cy="79" rx="34" ry="10.4" fill="url(#bp' + u + ')"/>' +
      '<path d="M19.6 76.4 Q31 70.4 45 69.6" stroke="' + BR_SPEC + '" stroke-width="1.8" ' +
        'fill="none" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M70 71.4 Q80.4 74.6 82.4 79" stroke="#1e1504" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".7"/>' +
      '<ellipse cx="50" cy="79" rx="29.4" ry="8.8" fill="none" stroke="#1e1504" ' +
        'stroke-width="0.9" opacity=".4"/>' +
      '<path d="M20 85 Q50 95.4 80 84.8" stroke="' + BR_BNC + '" stroke-width="1.5" ' +
        'fill="none" opacity=".6"/>' +
      /* the dome sits down on the plate and shadows it to the right */
      '<ellipse cx="55" cy="76" rx="28" ry="8.5" fill="url(#cs' + u + ')"/>' +
      '<ellipse cx="50" cy="74" rx="25" ry="6.6" fill="#3a2a0b" opacity=".55"/>' +
      /* dome, standing clear inside the rim of the plate */
      '<path d="M23 72 C23 28 77 28 77 72 Q50 84 23 72 Z" fill="url(#dm' + u + ')"/>' +
      '<path d="M61 46 C67.4 53.4 70.6 61.6 71.4 70" stroke="#1c1403" stroke-width="3.2" ' +
        'fill="none" stroke-linecap="round" opacity=".45"/>' +
      '<path d="M28 76 Q50 84.6 72 75.6" stroke="' + BR_BNC + '" stroke-width="2" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>' +
      /* specular: a soft raked streak, with a slim hot core inside it */
      '<ellipse cx="33" cy="53" rx="7.4" ry="18" fill="url(#sp' + u + ')" opacity=".55" ' +
        'transform="rotate(-13 33 53)"/>' +
      '<ellipse cx="32.5" cy="50" rx="2" ry="8.6" fill="url(#sp' + u + ')" opacity=".85" ' +
        'transform="rotate(-13 32.5 50)"/>' +
      '<ellipse cx="61" cy="45" rx="5.4" ry="2.6" fill="url(#sp' + u + ')" opacity=".34" ' +
        'transform="rotate(-32 61 45)"/>' +
      /* one turned band round the skirt */
      '<path d="M23.4 69.6 Q50 80.8 76.6 69.6" stroke="#2a1e07" stroke-width="1" ' +
        'fill="none" opacity=".4"/>' +
      /* plunger */
      '<ellipse cx="50" cy="30.6" rx="7" ry="2.6" fill="#2a1e07" opacity=".45"/>' +
      '<path d="M43.4 30 L43.4 18 L56.6 18 L56.6 30 Q50 33.4 43.4 30 Z" fill="url(#st' + u + ')"/>' +
      '<path d="M45 19 L45 29" stroke="' + BR_SPEC + '" stroke-width="1.5" fill="none" opacity=".9"/>' +
      '<path d="M55 19 L55 29" stroke="#1e1504" stroke-width="1.3" fill="none" opacity=".7"/>' +
      '<ellipse cx="50" cy="15.6" rx="11" ry="6" fill="url(#kb' + u + ')"/>' +
      '<path d="M41.6 13.4 Q45.4 9.8 51.4 9.8" stroke="' + BR_SPEC + '" stroke-width="2" ' +
        'fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M57.6 11.8 Q61.4 14 60.4 17.4" stroke="#1e1504" stroke-width="1.4" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>' +
      '<path d="M41.4 18 Q50 22.4 59 17.6" stroke="' + BR_BNC + '" stroke-width="1.2" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>';
    return svg(w, 100, 100, d, b);
  }

  /* ====================================================================== *
   *  SPECTACLES — gold wire rims, arms folded under
   * ====================================================================== */
  function spectacles(o) {
    var u = uid(), w = num(o && o.w, 90);
    var d =
      blot("sh" + u, "#17100a", 0.42) +
      lg("wi" + u, 6, 10, 96, 44, [
        [0, BR_SPEC], [0.12, BR_HI], [0.34, BR_MID], [0.56, BR],
        [0.76, BR_SH], [0.9, BR_DEEP], [1, BR_HI]
      ]) +
      rg("le" + u, 26, 22, 23, [
        ["0", "#ffffff", "0.42"], ["0.34", "#e2e9df", "0.2"],
        ["0.7", "#98a599", "0.16"], ["0.92", "#68756b", "0.26"], ["1", "#f4f8f0", "0.5"]
      ], 19, 14) +
      rg("re" + u, 71, 22, 21, [
        ["0", "#ffffff", "0.36"], ["0.36", "#e2e9df", "0.16"],
        ["0.72", "#8b988d", "0.18"], ["0.93", "#5e6b62", "0.28"], ["1", "#eef4ea", "0.46"]
      ], 65, 14);

    var b =
      '<ellipse cx="33" cy="44" rx="27" ry="5.5" fill="url(#sh' + u + ')"/>' +
      '<ellipse cx="76" cy="43" rx="25" ry="5" fill="url(#sh' + u + ')"/>' +
      /* the arms, folded back and lying under the rims */
      '<path d="M92.6 22.6 Q95.6 27.6 90 31.4 Q78 37.6 60 36" fill="none" ' +
        'stroke="' + BR_DEEP + '" stroke-width="2.8" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M92 22.2 Q94.8 26.8 89.4 30.4 Q78 36.4 60 34.8" fill="none" ' +
        'stroke="' + BR_MID + '" stroke-width="1" stroke-linecap="round" opacity=".75"/>' +
      '<path d="M6.4 23.4 Q3.6 28.6 9 32 Q18 37 30 37" fill="none" stroke="' + BR_SH + '" ' +
        'stroke-width="2.4" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M6 23 Q3.2 28 8.4 31.2" fill="none" stroke="' + BR_HI + '" ' +
        'stroke-width="0.9" stroke-linecap="round" opacity=".7"/>' +
      /* lenses */
      '<ellipse cx="28" cy="22" rx="22" ry="17" fill="url(#le' + u + ')"/>' +
      '<ellipse cx="72" cy="21" rx="20.5" ry="15.5" fill="url(#re' + u + ')"/>' +
      '<path d="M13.6 14.6 Q21.4 6.4 33.6 6.8" stroke="#ffffff" stroke-width="2.8" fill="none" ' +
        'stroke-linecap="round" opacity=".8"/>' +
      '<path d="M19.6 12.6 Q25 8.6 32 8.6" stroke="#ffffff" stroke-width="1" fill="none" ' +
        'stroke-linecap="round" opacity=".4"/>' +
      '<path d="M17 28.6 Q21.4 34 30 35.6" stroke="#ffffff" stroke-width="1.2" fill="none" ' +
        'stroke-linecap="round" opacity=".34"/>' +
      '<path d="M59.6 13.6 Q66.4 6.6 76 7" stroke="#ffffff" stroke-width="2.2" fill="none" ' +
        'stroke-linecap="round" opacity=".64"/>' +
      /* rims */
      '<ellipse cx="28" cy="22" rx="22" ry="17" fill="none" stroke="url(#wi' + u + ')" ' +
        'stroke-width="3.2"/>' +
      '<path d="M12 14.4 Q19.6 4.6 32 4.8" fill="none" stroke="' + BR_SPEC + '" ' +
        'stroke-width="1.2" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M44 30.6 Q38.6 38.6 28.6 38.8" fill="none" stroke="#1e1504" ' +
        'stroke-width="1.2" stroke-linecap="round" opacity=".6"/>' +
      '<ellipse cx="72" cy="21" rx="20.5" ry="15.5" fill="none" stroke="url(#wi' + u + ')" ' +
        'stroke-width="3"/>' +
      '<path d="M57.6 13.6 Q64.6 4.6 76 4.8" fill="none" stroke="' + BR_SPEC + '" ' +
        'stroke-width="1.1" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M87 29 Q82 36.4 73 36.4" fill="none" stroke="#1e1504" ' +
        'stroke-width="1.1" stroke-linecap="round" opacity=".55"/>' +
      /* bridge */
      '<path d="M49.4 18 Q56 11 62 16.6" fill="none" stroke="url(#wi' + u + ')" ' +
        'stroke-width="3.2"/>' +
      '<path d="M50.4 17 Q56 12 61.4 15.8" fill="none" stroke="' + BR_SPEC + '" ' +
        'stroke-width="1.1" opacity=".9"/>' +
      /* hinge lugs */
      '<rect x="4" y="19" width="5.4" height="4.4" rx="1.4" fill="url(#wi' + u + ')"/>' +
      '<rect x="90.6" y="18.6" width="5.4" height="4.2" rx="1.4" fill="url(#wi' + u + ')"/>';
    return svg(w, 100, 50, d, b);
  }

  /* ====================================================================== *
   *  LAMP — brass oil lamp with a glass chimney, lit
   * ====================================================================== */
  function lamp(o) {
    var u = uid(), w = num(o && o.w, 80);
    var d =
      blot("sh" + u, "#17100a", 0.55) +
      blot("cs" + u, "#241a05", 0.5) +
      blot("gw" + u, "#ffd88a", 0.4) +
      brassBar("ft" + u, 20, 138, 82, 160) +
      brassDome("fo" + u, 50, 106, 26) +
      brassBar("cl" + u, 32, 84, 70, 100) +
      brassBar("sm" + u, 38, 120, 62, 144) +
      lg("ch" + u, 22, 8, 80, 80, [
        ["0", "#ffffff", "0.3"], ["0.16", "#eef3ea", "0.15"],
        ["0.44", "#bcc7bb", "0.12"], ["0.72", "#758376", "0.22"],
        ["0.9", "#5a6860", "0.28"], ["1", "#e6ede3", "0.4"]
      ]) +
      rg("fl" + u, 50, 64, 22, [
        ["0", "#fffbe8", "0.98"], ["0.22", "#ffe6a4", "0.85"],
        ["0.5", "#f0aa42", "0.5"], ["0.8", "#cf7a1e", "0.16"], ["1", "#b8620f", "0"]
      ], 48, 60);

    var b =
      '<ellipse cx="57" cy="159" rx="43" ry="8.5" fill="url(#sh' + u + ')"/>' +
      /* foot */
      '<path d="M22 146 Q50 159 78 146 L78 152 Q50 165 22 152 Z" fill="#2a1e07"/>' +
      '<ellipse cx="50" cy="146" rx="28" ry="9.5" fill="url(#ft' + u + ')"/>' +
      '<path d="M25.4 143 Q35.4 136.6 47 136" stroke="' + BR_SPEC + '" stroke-width="1.8" ' +
        'fill="none" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M68 139.4 Q76.4 141.6 77.6 146" stroke="#1e1504" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round" opacity=".6"/>' +
      '<path d="M27 150.4 Q50 158.6 73 150.2" stroke="' + BR_BNC + '" stroke-width="1.4" ' +
        'fill="none" opacity=".6"/>' +
      /* the font shadows the foot */
      '<ellipse cx="53" cy="143" rx="20" ry="6" fill="url(#cs' + u + ')"/>' +
      /* stem */
      '<path d="M41 122 L59 122 L62 142 Q50 147 38 142 Z" fill="url(#sm' + u + ')"/>' +
      '<path d="M42.6 123.6 L40.4 141" stroke="' + BR_SPEC + '" stroke-width="1.7" ' +
        'fill="none" opacity=".85"/>' +
      '<path d="M57.6 124.4 L59.8 141" stroke="#1e1504" stroke-width="1.6" ' +
        'fill="none" opacity=".7"/>' +
      /* oil font */
      '<path d="M26 104 C26 87 74 87 74 104 C74 120 63 127 50 127 C37 127 26 120 26 104 Z" ' +
        'fill="url(#fo' + u + ')"/>' +
      '<path d="M33.4 111 C31.6 98.4 38.4 92 46.6 91" stroke="' + BR_SPEC + '" ' +
        'stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M39.6 108 C38.8 100.4 42.6 96.6 47 95.8" stroke="#ffffff" ' +
        'stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".42"/>' +
      '<path d="M67 95.6 C73.4 102 73 113 67.4 121" stroke="#1c1403" ' +
        'stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>' +
      '<path d="M34 123 Q50 129.6 66 122.8" stroke="' + BR_BNC + '" stroke-width="1.8" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>' +
      /* collar and wick wheel */
      '<path d="M33 86 Q50 94 67 86 L67 97 Q50 105 33 97 Z" fill="url(#cl' + u + ')"/>' +
      '<ellipse cx="50" cy="86" rx="17" ry="6.4" fill="' + BR_MID + '"/>' +
      '<path d="M35.6 84.6 Q41.6 80.6 48 80.4" stroke="' + BR_SPEC + '" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M33 97 Q50 105 67 97" stroke="#1e1504" stroke-width="1.3" ' +
        'fill="none" opacity=".7"/>' +
      '<ellipse cx="72" cy="92" rx="6.4" ry="6.8" fill="url(#cl' + u + ')"/>' +
      '<path d="M66.4 89.6 Q68.6 85.8 73 85.4" stroke="' + BR_SPEC + '" stroke-width="1.3" ' +
        'fill="none" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M66.6 92 L77.4 92 M67.6 88.4 L76.4 95.6 M67.6 95.6 L76.4 88.4" ' +
        'stroke="#1e1504" stroke-width="0.9" opacity=".55"/>' +
      /* the flame, behind the glass */
      '<ellipse cx="50" cy="64" rx="20" ry="22" fill="url(#gw' + u + ')"/>' +
      '<ellipse cx="50" cy="66" rx="14" ry="16" fill="url(#fl' + u + ')"/>' +
      '<path d="M50 50 Q57 60 54 71 Q50 78 46 71 Q43 60 50 50 Z" fill="#fff8de" opacity=".92"/>' +
      '<path d="M50 58 Q52.6 64 51 70 Q50 73 49 70 Q47.4 64 50 58 Z" fill="#ffffff" opacity=".8"/>' +
      /* chimney */
      '<path d="M31 84 C30 66 33 58 35 46 C36 36 35 27 33 19 L67 19 C65 27 64 36 65 46 ' +
        'C67 58 70 66 69 84 Q50 92 31 84 Z" fill="url(#ch' + u + ')"/>' +
      '<path d="M33 19 Q50 13.6 67 19 Q50 24.6 33 19 Z" fill="#eef4ec" opacity=".45"/>' +
      '<path d="M33.6 19.6 Q50 15 66.4 19.6" stroke="#ffffff" stroke-width="1.7" ' +
        'fill="none" opacity=".85"/>' +
      '<path d="M36 22 C34.4 32 35.4 40 37.6 48 C39.6 60 36.4 70 36 82" ' +
        'stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".72"/>' +
      '<path d="M41.4 23.6 C40.2 33 41.2 41 42.8 48" stroke="#ffffff" stroke-width="1" ' +
        'fill="none" stroke-linecap="round" opacity=".36"/>' +
      '<path d="M64.4 22.4 C65.6 32.4 64.6 40.4 63 47.4 C61 59.4 64.6 70 64.8 82" ' +
        'stroke="#e6ede3" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".5"/>' +
      '<path d="M33 84 Q50 91 69 84" stroke="#ffffff" stroke-width="1.4" fill="none" ' +
        'opacity=".45"/>';
    return svg(w, 100, 170, d, b);
  }

  /* ====================================================================== *
   *  STAMP RACK — shallow turned-wood rack; the stamps stand in it
   * ====================================================================== */
  function stampRack(o) {
    var u = uid(), w = num(o && o.w, 120), i, t, x, y, holes = "";
    /* the top face, a plain rectangle in three-quarter: FL FR BR BL */
    var FLx = 7, FLy = 33, FRx = 74, FRy = 33, BRx = 93, BRy = 21, BLx = 26, BLy = 21;
    var dep = 11;   /* how deep the block stands */

    var d =
      blot("sh" + u, "#17100a", 0.52) +
      lg("tp" + u, 10, 32, 92, 18, [
        [0, "#e0b078"], [0.1, WD_LIT], [0.34, WD_HI], [0.62, "#8a6038"],
        [0.86, WD], [1, "#513724"]
      ]) +
      woodBar("fr" + u, 0, 33, 0, 46) +
      lg("en" + u, 74, 26, 96, 40, [[0, "#3a2716"], [0.55, WD_DEEP], [1, "#7d5836"]]) +
      rg("ho" + u, 50, 27, 9, [[0, "#0d0803"], [0.66, "#0d0803"], [1, "#7d5836"]]);

    /* the holes march along the centre line of the top face */
    for (i = 0; i < 4; i++) {
      t = 0.13 + i * 0.246;
      x = (FLx + BLx) / 2 + t * ((FRx + BRx) / 2 - (FLx + BLx) / 2);
      y = 27;
      holes +=
        '<ellipse cx="' + x.toFixed(1) + '" cy="' + y + '" rx="8" ry="3.6" ' +
          'fill="url(#ho' + u + ')"/>' +
        '<path d="M' + (x - 8).toFixed(1) + ' ' + y + ' Q' + x.toFixed(1) + ' ' + (y - 4) +
          ' ' + (x + 8).toFixed(1) + ' ' + y + '" stroke="#0a0602" stroke-width="1.5" ' +
          'fill="none" opacity=".9"/>' +
        '<path d="M' + (x - 6.8).toFixed(1) + ' ' + (y + 1.4) + ' Q' + x.toFixed(1) + ' ' +
          (y + 4.4) + ' ' + (x + 6.8).toFixed(1) + ' ' + (y + 1.4) +
          '" stroke="#a8794a" stroke-width="1.3" fill="none" opacity=".6"/>' +
        '<path d="M' + (x - 6.4).toFixed(1) + ' ' + (y - 1.4) + ' Q' + x.toFixed(1) + ' ' +
          (y - 3.6) + ' ' + (x + 1.6).toFixed(1) + ' ' + (y - 3.4) +
          '" stroke="#c99a63" stroke-width="0.8" fill="none" opacity=".4"/>';
    }

    var b =
      '<ellipse cx="52" cy="45" rx="47" ry="6.5" fill="url(#sh' + u + ')"/>' +
      /* front face */
      '<path d="M' + FLx + ' ' + FLy + ' L' + FRx + ' ' + FRy + ' L' + FRx + ' ' +
        (FRy + dep) + ' L' + FLx + ' ' + (FLy + dep) + ' Z" fill="url(#fr' + u + ')"/>' +
      /* right end face, turned away from the light */
      '<path d="M' + FRx + ' ' + FRy + ' L' + BRx + ' ' + BRy + ' L' + BRx + ' ' +
        (BRy + dep) + ' L' + FRx + ' ' + (FRy + dep) + ' Z" fill="url(#en' + u + ')"/>' +
      /* top face */
      '<path d="M' + FLx + ' ' + FLy + ' L' + BLx + ' ' + BLy + ' L' + BRx + ' ' + BRy +
        ' L' + FRx + ' ' + FRy + ' Z" fill="url(#tp' + u + ')"/>' +
      holes +
      /* grain running the length of the top */
      '<path d="M11 31.6 L28 23.6 M14 33 L31 25 M52 31 L69 23" stroke="#8a6038" ' +
        'stroke-width="0.7" fill="none" opacity=".4"/>' +
      /* arrises: hot along the near-left, near-black on the far right */
      '<path d="M' + FLx + ' ' + FLy + ' L' + BLx + ' ' + BLy + '" stroke="#f0c48c" ' +
        'stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M' + FLx + ' ' + FLy + ' L' + FRx + ' ' + FRy + '" stroke="#d6a468" ' +
        'stroke-width="1.4" fill="none" opacity=".7"/>' +
      '<path d="M' + BLx + ' ' + BLy + ' L' + BRx + ' ' + BRy + '" stroke="#2a1c0f" ' +
        'stroke-width="1.1" fill="none" opacity=".55"/>' +
      '<path d="M' + FRx + ' ' + FRy + ' L' + BRx + ' ' + BRy + '" stroke="#150d05" ' +
        'stroke-width="1.5" fill="none" opacity=".7"/>' +
      '<path d="M' + FLx + ' ' + FLy + ' L' + FLx + ' ' + (FLy + dep) + '" stroke="#d6a468" ' +
        'stroke-width="1.5" fill="none" opacity=".65"/>' +
      '<path d="M' + BRx + ' ' + BRy + ' L' + BRx + ' ' + (BRy + dep) + '" stroke="#150d05" ' +
        'stroke-width="1.5" fill="none" opacity=".8"/>' +
      /* mouldings run along the front */
      '<path d="M' + FLx + ' ' + (FLy + 3.6) + ' L' + FRx + ' ' + (FRy + 3.6) +
        '" stroke="' + WD_DEEP + '" stroke-width="1.5" fill="none" opacity=".5"/>' +
      '<path d="M' + FLx + ' ' + (FLy + 5.2) + ' L' + FRx + ' ' + (FRy + 5.2) +
        '" stroke="#a8794a" stroke-width="0.8" fill="none" opacity=".4"/>' +
      '<path d="M' + FLx + ' ' + (FLy + dep - 0.8) + ' L' + FRx + ' ' + (FRy + dep - 0.8) +
        '" stroke="' + WD_DEEP + '" stroke-width="1.6" fill="none" opacity=".6"/>' +
      /* turned feet under the near corners */
      '<path d="M13 44 Q18.6 50.6 24.2 43.6" fill="' + WD_SH + '"/>' +
      '<path d="M57 44 Q62.6 50.6 68.2 43.6" fill="#241708"/>' +
      '<path d="M13.6 44.4 Q16.6 47.6 19.4 47.6" stroke="#a8794a" stroke-width="1" ' +
        'fill="none" opacity=".5"/>';
    return svg(w, 100, 52, d, b);
  }

  /* ====================================================================== *
   *  STAMP — turned wooden handle, paper band, rubber die. A button.
   * ====================================================================== */
  function stamp(o) {
    o = o || {};
    var u = uid(), w = num(o.w, 90);
    var label = String(o.label == null ? "SANCTIONED" : o.label).toUpperCase();
    var col = o.colour || "#7c2b20";
    var n = Math.max(1, label.length);

    /* the band's usable run, and a size that fills it without spilling */
    var band = 64, fs = Math.min(12, Math.max(6, band / (n * 0.6)));
    var ls = fs > 9.5 ? 1.7 : fs > 7.5 ? 1.1 : 0.6;
    var est = n * (fs * 0.66 + ls);
    var fit = est > band ? ' textLength="' + band + '" lengthAdjust="spacingAndGlyphs"' : "";

    var d =
      blot("sh" + u, "#17100a", 0.58) +
      blot("cs" + u, "#1a1006", 0.5) +
      rg("kb" + u, 50, 14, 20, [
        [0, "#e2b177"], [0.14, WD_LIT], [0.4, WD_HI], [0.64, WD],
        [0.84, WD_SH], [0.96, WD_DEEP], [1, "#7a5433"]
      ], 43, 8) +
      lg("br" + u, 10, 36, 92, 84, [
        [0, "#c99a63"], [0.06, WD_LIT], [0.2, WD_HI], [0.42, "#8a6038"], [0.6, WD],
        [0.78, WD_SH], [0.92, "#1c1207"], [1, "#7d5836"]
      ]) +
      lg("bt" + u, 16, 26, 84, 44, [[0, "#e0b078"], [0.35, WD_LIT], [0.72, WD_HI], [1, "#6b4a2f"]]) +
      lg("pb" + u, 10, 42, 92, 76, [
        [0, "#fffcf3"], [0.09, "#faf3e0"], [0.4, PAPER], [0.68, "#ddd0ae"],
        [0.86, PAPER_S], [1, "#e6dabb"]
      ]) +
      lg("ds" + u, 6, 76, 94, 100, [
        [0, "#e0b078"], [0.08, "#b4854f"], [0.34, "#8a6038"], [0.58, "#6b4a2f"],
        [0.78, "#3d2917"], [0.92, "#1c1207"], [1, "#7d5836"]
      ]) +
      lg("rb" + u, 8, 98, 92, 120, [
        [0, "#6d6459"], [0.14, "#494238"], [0.42, "#2b261f"], [0.74, "#171310"],
        [0.9, "#0d0a08"], [1, "#4a4239"]
      ]);

    var b =
      '<ellipse cx="55" cy="117" rx="47" ry="7.5" fill="url(#sh' + u + ')"/>' +
      '<g transform="rotate(-4 50 70)">' +
        /* knob */
        '<ellipse cx="50" cy="14" rx="16" ry="12.6" fill="url(#kb' + u + ')"/>' +
        '<path d="M38.6 9.6 Q43 3.4 51.6 3.4" stroke="#f0c48c" stroke-width="2.4" ' +
          'fill="none" stroke-linecap="round" opacity=".9"/>' +
        '<path d="M61 8.6 Q66.4 14 63 21" stroke="#150d05" stroke-width="2.2" ' +
          'fill="none" stroke-linecap="round" opacity=".7"/>' +
        '<path d="M40.6 20.4 Q50 25.6 60 19.6" stroke="#9a6f42" stroke-width="1.2" ' +
          'fill="none" stroke-linecap="round" opacity=".55"/>' +
        /* neck */
        '<path d="M40 20 Q50 28 60 20 L64 34 Q50 41 36 34 Z" fill="url(#br' + u + ')"/>' +
        '<path d="M41.4 23.6 L38.6 33" stroke="#d2a068" stroke-width="1.8" fill="none" opacity=".7"/>' +
        '<path d="M59 23.6 L61.6 33" stroke="#150d05" stroke-width="1.6" fill="none" opacity=".65"/>' +
        /* the knob casts down the barrel */
        '<ellipse cx="55" cy="40" rx="20" ry="7" fill="url(#cs' + u + ')"/>' +
        /* barrel */
        '<path d="M12 40 Q50 28 88 40 L88 78 Q50 90 12 78 Z" fill="url(#br' + u + ')"/>' +
        '<path d="M12 40 Q50 52 88 40 Q50 28 12 40 Z" fill="url(#bt' + u + ')"/>' +
        '<path d="M15.6 39 Q32 32.4 50 31.4" stroke="#f0c48c" stroke-width="1.4" ' +
          'fill="none" stroke-linecap="round" opacity=".7"/>' +
        '<path d="M14.6 41.6 L14.4 76" stroke="#e0b078" stroke-width="2.8" fill="none" ' +
          'stroke-linecap="round" opacity=".6"/>' +
        '<path d="M20 43 L19.8 76" stroke="#f0c48c" stroke-width="0.9" fill="none" ' +
          'stroke-linecap="round" opacity=".3"/>' +
        '<path d="M85.6 42 L85.8 76" stroke="#150d05" stroke-width="3" fill="none" ' +
          'stroke-linecap="round" opacity=".6"/>' +
        /* paper band wrapped round the barrel */
        '<path d="M12.6 46 Q50 58 87.4 46 L88.6 72 Q50 84 11.4 72 Z" fill="url(#pb' + u + ')"/>' +
        '<path d="M12.6 46 Q50 58 87.4 46" stroke="#b0a077" stroke-width="0.9" ' +
          'fill="none" opacity=".85"/>' +
        '<path d="M11.4 72 Q50 84 88.6 72" stroke="#8e8060" stroke-width="1.2" ' +
          'fill="none" opacity=".85"/>' +
        '<path d="M12.1 49.4 Q50 61.4 87.9 49.4" stroke="' + col + '" stroke-width="1.3" ' +
          'fill="none" opacity=".9"/>' +
        '<path d="M11.7 68.6 Q50 80.6 88.3 68.6" stroke="' + col + '" stroke-width="1.3" ' +
          'fill="none" opacity=".9"/>' +
        /* the curl of the cylinder, read across the paper */
        '<path d="M14.2 46.4 Q17.2 59.6 12.8 71.8" stroke="#ffffff" stroke-width="3" ' +
          'fill="none" opacity=".55"/>' +
        '<path d="M85.4 46.6 Q82.4 60 86.8 72" stroke="#6f6248" stroke-width="3.4" ' +
          'fill="none" opacity=".35"/>' +
        '<text x="50" y="66" text-anchor="middle" font-family="' + SERIF + '" ' +
          'font-size="' + fs.toFixed(2) + '" letter-spacing="' + ls + '" ' +
          'font-weight="700" fill="' + INK + '"' + fit + '>' + esc(label) + '</text>' +
        /* the handle flares out into its foot — one turning, not a stack */
        '<path d="M12 78 Q50 90 88 78 L94 92 Q50 105 6 92 Z" fill="url(#ds' + u + ')"/>' +
        '<path d="M14.4 78.6 L8.4 91" stroke="#e8bc84" stroke-width="2.4" ' +
          'fill="none" stroke-linecap="round" opacity=".7"/>' +
        '<path d="M85.8 78.6 L91.6 91" stroke="#150d05" stroke-width="2.4" ' +
          'fill="none" stroke-linecap="round" opacity=".65"/>' +
        '<path d="M12 78 Q50 90 88 78" stroke="#3d2917" stroke-width="1" ' +
          'fill="none" opacity=".4"/>' +
        /* thin mount board, then the rubber die under it */
        '<path d="M6 92 Q50 105 94 92 L93.4 97 Q50 110 6.6 97 Z" fill="#cbb98f"/>' +
        '<path d="M6 92 Q50 105 94 92" stroke="#f2e9cd" stroke-width="1" fill="none" opacity=".85"/>' +
        '<path d="M6.6 96.6 Q50 109.6 93.4 96.6 L90 111 Q50 123.4 10 111 Z" ' +
          'fill="url(#rb' + u + ')"/>' +
        '<path d="M8.6 98 Q12.6 104.6 11.4 110.6" stroke="#7d7469" stroke-width="1.8" ' +
          'fill="none" opacity=".7"/>' +
        '<path d="M88.4 99 Q85.6 105.6 88.6 110.4" stroke="#050403" stroke-width="1.8" ' +
          'fill="none" opacity=".7"/>' +
        '<path d="M10 111 Q50 123.4 90 111" stroke="' + col + '" stroke-width="2.4" ' +
          'fill="none" opacity=".85"/>' +
        '<path d="M12 112.6 Q50 124 88 112.6" stroke="#0b0806" stroke-width="1" ' +
          'fill="none" opacity=".5"/>' +
      '</g>';
    return svg(w, 100, 128, d, b);
  }

  /* ====================================================================== *
   *  WIRE TRAY — brass letter tray, papers in it
   * ====================================================================== */
  function wiretray(o) {
    var u = uid(), w = num(o && o.w, 120), i, t, wires = "";
    var d =
      blot("sh" + u, "#17100a", 0.45) +
      lg("wr" + u, 6, 20, 96, 58, [
        [0, BR_SPEC], [0.1, BR_HI], [0.3, BR_MID], [0.54, BR],
        [0.74, BR_SH], [0.9, BR_DEEP], [1, BR_BNC]
      ]) +
      lg("pa" + u, 12, 30, 88, 52, [
        [0, "#fffaea"], [0.28, PAPER], [0.68, "#dfd2b0"], [1, "#b5a682"]
      ]) +
      lg("pe" + u, 12, 44, 88, 56, [[0, "#e4d8b8"], [0.5, PAPER_S], [1, "#9c8e6c"]]);

    /* floor wires, running front-left to back-right */
    for (i = 0; i <= 7; i++) {
      t = i / 7;
      wires += '<path d="M' + (11 + t * 53).toFixed(1) + ' 55.5 L' +
               (36 + t * 53).toFixed(1) + ' 38.5" stroke="' + BR_SH +
               '" stroke-width="1.7" stroke-linecap="round" opacity=".9"/>' +
               '<path d="M' + (10.4 + t * 53).toFixed(1) + ' 54.8 L' +
               (35.4 + t * 53).toFixed(1) + ' 37.8" stroke="' + BR_HI +
               '" stroke-width="0.7" stroke-linecap="round" opacity=".65"/>';
    }

    var b =
      '<ellipse cx="54" cy="58" rx="48" ry="6" fill="url(#sh' + u + ')"/>' +
      /* the far rim and its posts, behind everything */
      '<path d="M36 27 L90 27" stroke="url(#wr' + u + ')" stroke-width="3" ' +
        'stroke-linecap="round"/>' +
      '<path d="M36 27 L36 39" stroke="' + BR_SH + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M90 27 L90 39" stroke="' + BR_DEEP + '" stroke-width="2.4" stroke-linecap="round"/>' +
      /* the floor */
      wires +
      '<path d="M11 56 L64 56 L89 39 L36 39 Z" fill="none" stroke="' + BR_SH + '" ' +
        'stroke-width="1.6" stroke-linejoin="round" opacity=".8"/>' +
      /* the stack of papers, standing on the floor wires */
      '<path d="M16 53.6 L40 37.4 L85 37.4 L61 53.6 Z" fill="#9a8b68" opacity=".55"/>' +
      '<path d="M15 51.6 L39 35.4 L84 35.4 L60 51.6 Z" fill="#b5a682"/>' +
      '<path d="M14.4 49.4 L38.4 33.2 L83.4 33.2 L59.4 49.4 Z" fill="url(#pe' + u + ')"/>' +
      '<path d="M14 47 L38 30.8 L83 30.8 L59 47 Z" fill="url(#pa' + u + ')"/>' +
      '<path d="M14 47 L38 30.8" stroke="#ffffff" stroke-width="1.3" fill="none" opacity=".8"/>' +
      '<path d="M38 30.8 L83 30.8" stroke="#ffffff" stroke-width="1" fill="none" opacity=".5"/>' +
      '<path d="M24 43.4 L56 37 M27 45 L62 38 M30.6 46 L66 38.6" stroke="' + INK + '" ' +
        'stroke-width="0.7" opacity=".26"/>' +
      '<path d="M14 47 L59 47 L83 30.8" fill="none" stroke="#9a8b68" stroke-width="1.2" ' +
        'opacity=".8"/>' +
      '<path d="M14 47 L16 53.6 L61 53.6 L59 47 Z" fill="#a4956f"/>' +
      '<path d="M14.6 48.6 L59.6 48.6 M15 50.6 L60 50.6 M15.4 52.4 L60.4 52.4" ' +
        'stroke="#8a7c5c" stroke-width="0.6" opacity=".6"/>' +
      '<path d="M59 47 L61 53.6 L84.6 37.6 L83 30.8 Z" fill="#8d7f60"/>' +
      /* the near rim, in front of the papers, with its posts */
      '<path d="M11 47 L11 56" stroke="' + BR_MID + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M64 47 L64 56" stroke="' + BR_DEEP + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M11 46 L64 46 L89 29 L36 29 Z" fill="none" stroke="url(#wr' + u + ')" ' +
        'stroke-width="3.6" stroke-linejoin="round"/>' +
      '<path d="M11.6 44.8 L64.4 44.8 L88 28.2" fill="none" stroke="' + BR_SPEC + '" ' +
        'stroke-width="1.3" stroke-linejoin="round" opacity=".9"/>' +
      '<path d="M12 47.4 L64 47.4" fill="none" stroke="#1e1504" stroke-width="1.2" opacity=".8"/>' +
      '<path d="M65.4 45.6 L89.6 29.4" fill="none" stroke="#1e1504" stroke-width="1.2" opacity=".6"/>' +
      /* feet */
      '<ellipse cx="11" cy="56.4" rx="4" ry="2" fill="' + BR_SH + '"/>' +
      '<ellipse cx="64" cy="56.4" rx="4" ry="2" fill="' + BR_DEEP + '"/>' +
      '<ellipse cx="89" cy="39.4" rx="3.4" ry="1.7" fill="' + BR_DEEP + '"/>';
    return svg(w, 100, 62, d, b);
  }

  /* ====================================================================== *
   *  TUMBLER — cut-glass tumbler, half full
   * ====================================================================== */
  function tumbler(o) {
    var u = uid(), w = num(o && o.w, 60);
    var d =
      blot("sh" + u, "#17100a", 0.34) +
      blot("ca" + u, "#f6e7bc", 0.5) +
      lg("gl" + u, 18, 16, 84, 110, [
        ["0", "#ffffff", "0.36"], ["0.14", "#eaf0e7", "0.17"],
        ["0.42", "#b0bcaf", "0.12"], ["0.7", "#69766c", "0.2"],
        ["0.88", "#4c584f", "0.3"], ["1", "#e2e9df", "0.38"]
      ]) +
      lg("wa" + u, 22, 56, 80, 108, [
        ["0", "#eef5ef", "0.52"], ["0.16", "#c6d8cb", "0.44"],
        ["0.5", "#9db3a5", "0.44"], ["0.8", "#7d9488", "0.5"], ["1", "#d6e6da", "0.6"]
      ]) +
      lg("bs" + u, 24, 92, 78, 108, [
        ["0", "#ffffff", "0.5"], ["0.4", "#c2d0c4", "0.36"],
        ["0.75", "#77857a", "0.42"], ["1", "#e6ede3", "0.5"]
      ]);

    var b =
      '<ellipse cx="55" cy="110" rx="36" ry="6.5" fill="url(#sh' + u + ')"/>' +
      '<ellipse cx="42" cy="110" rx="24" ry="5" fill="url(#ca' + u + ')"/>' +
      /* body: mouth wider than the foot */
      '<path d="M20 18 Q50 27 80 18 L74 102 Q50 111 26 102 Z" fill="url(#gl' + u + ')"/>' +
      /* the water */
      '<path d="M23.4 56 Q50 65 76.6 56 L74 102 Q50 111 26 102 Z" fill="url(#wa' + u + ')"/>' +
      '<path d="M23.4 56 Q50 48 76.6 56 Q50 65 23.4 56 Z" fill="#e4efe6" opacity=".55"/>' +
      '<path d="M26.4 55 Q39 50.6 53 50.8" stroke="#ffffff" stroke-width="1.7" fill="none" ' +
        'stroke-linecap="round" opacity=".9"/>' +
      '<path d="M68 51.6 Q74 53 76 55.4" stroke="#ffffff" stroke-width="1" fill="none" ' +
        'stroke-linecap="round" opacity=".45"/>' +
      /* the thick cut foot: the glass gathers weight at the bottom */
      '<path d="M25.4 92 Q50 101 74.6 92 L74 102 Q50 111 26 102 Z" fill="url(#bs' + u + ')" ' +
        'opacity=".55"/>' +
      '<path d="M32 96.4 L31.6 104.4 M42 98.4 L42 107 M58 98.4 L58 107 M68 96.4 L68.4 104.4" ' +
        'stroke="#ffffff" stroke-width="1" opacity=".22"/>' +
      /* specular: broad on the left, a narrow band of reflected light on the right */
      '<path d="M30.6 24 Q28.4 62 27.8 98 L32.6 99.6 Q33.6 62 35 25.4 Z" ' +
        'fill="#ffffff" opacity=".42"/>' +
      '<path d="M31.4 26 L29.6 96" stroke="#ffffff" stroke-width="2.2" fill="none" ' +
        'stroke-linecap="round" opacity=".75"/>' +
      '<path d="M38.6 30 L37.6 90" stroke="#ffffff" stroke-width="1.2" fill="none" ' +
        'stroke-linecap="round" opacity=".26"/>' +
      '<path d="M70 27 Q72.6 62 72.6 96" stroke="#ffffff" stroke-width="2.4" fill="none" ' +
        'stroke-linecap="round" opacity=".4"/>' +
      '<path d="M75.4 24 Q78 60 75.6 98" stroke="#5c6a5f" stroke-width="1.4" fill="none" ' +
        'stroke-linecap="round" opacity=".3"/>' +
      /* base and rim */
      '<path d="M26 102 Q50 111 74 102" stroke="#ffffff" stroke-width="2.2" fill="none" ' +
        'stroke-linecap="round" opacity=".6"/>' +
      '<path d="M20 18 Q50 10 80 18 Q50 27 20 18 Z" fill="#f0f6ee" opacity=".38"/>' +
      '<path d="M20 18 Q50 10 80 18" stroke="#ffffff" stroke-width="2.2" fill="none" ' +
        'stroke-linecap="round" opacity=".95"/>' +
      '<path d="M20.6 19 Q50 27.6 79.4 19" stroke="#ffffff" stroke-width="1.5" fill="none" ' +
        'stroke-linecap="round" opacity=".6"/>';
    return svg(w, 100, 118, d, b);
  }

  root.FURNITURE = {
    inkwell: inkwell,
    penrest: penrest,
    paperweight: paperweight,
    bell: bell,
    spectacles: spectacles,
    lamp: lamp,
    stampRack: stampRack,
    stamp: stamp,
    wiretray: wiretray,
    tumbler: tumbler
  };

}(typeof window !== "undefined" ? window : this));
