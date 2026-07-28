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
      lg("hd" + u, 14, 8, 70, 26, [
        [0, "#7d5c34"], [0.14, "#5e4327"], [0.5, "#38271a"], [0.78, "#191009"], [1, "#4e3823"]
      ]) +
      brassBar("fe" + u, 66, 10, 80, 24) +
      lg("nb" + u, 78, 12, 98, 26, [
        [0, "#8d867a"], [0.2, "#4c4639"], [0.62, "#26211a"], [1, "#5a5344"]
      ]);

    var b =
      '<ellipse cx="54" cy="50" rx="47" ry="7" fill="url(#sh' + u + ')"/>' +
      /* the cradle bar */
      '<path d="M14 36 L86 36 L84 45 Q50 51 16 45 Z" fill="url(#bo' + u + ')"/>' +
      '<path d="M14 36 Q50 30 86 36 Q50 42 14 36 Z" fill="url(#tp' + u + ')"/>' +
      '<path d="M18 35 Q34 31.4 50 31" stroke="#e0b078" stroke-width="1.3" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>' +
      /* two grooves cut across the top */
      '<path d="M35 33.4 Q39.5 37.6 44 33.8" stroke="' + WD_DEEP + '" stroke-width="2.2" ' +
        'fill="none" opacity=".8"/>' +
      '<path d="M35.6 33 Q39.5 36.4 43.4 33.4" stroke="#c1935e" stroke-width="0.8" ' +
        'fill="none" opacity=".45"/>' +
      '<path d="M56 33.8 Q60.5 38 65 34.2" stroke="' + WD_DEEP + '" stroke-width="2.2" ' +
        'fill="none" opacity=".8"/>' +
      /* grain and the shaded underside */
      '<path d="M20 39.6 Q50 36.4 80 39.2" stroke="#8f6740" stroke-width="0.7" ' +
        'fill="none" opacity=".5"/>' +
      '<path d="M18 44.4 Q50 50.6 84 44.2" stroke="' + WD_DEEP + '" stroke-width="1.8" ' +
        'fill="none" opacity=".55"/>' +
      /* turned bobbin ends, standing proud of the bar */
      '<ellipse cx="13" cy="33" rx="10" ry="12" fill="url(#kl' + u + ')"/>' +
      '<ellipse cx="87" cy="33" rx="10" ry="12" fill="url(#kr' + u + ')"/>' +
      /* the turning: a collar groove round each bobbin */
      '<path d="M4.4 30 Q13 35.6 21.6 30" stroke="' + WD_DEEP + '" stroke-width="1.4" ' +
        'fill="none" opacity=".55"/>' +
      '<path d="M4.6 32.4 Q13 38 21.4 32.4" stroke="#c99a63" stroke-width="1" ' +
        'fill="none" opacity=".45"/>' +
      '<path d="M78.4 30 Q87 35.6 95.6 30" stroke="' + WD_DEEP + '" stroke-width="1.4" ' +
        'fill="none" opacity=".6"/>' +
      '<path d="M6 27.6 Q8.6 21.4 15 21" stroke="#eec08c" stroke-width="2.4" ' +
        'fill="none" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M18.6 24.4 Q23.4 30.4 20.6 39" stroke="#150d05" stroke-width="1.9" ' +
        'fill="none" stroke-linecap="round" opacity=".6"/>' +
      '<path d="M81 25.6 Q85 21.4 90.6 23" stroke="#d1a06a" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>' +
      '<path d="M94.6 28.6 Q97.4 35.4 92.6 41.6" stroke="#120b04" stroke-width="2.4" ' +
        'fill="none" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M5.4 37.6 Q10.4 44.6 18 43" stroke="#8a6038" stroke-width="1.4" ' +
        'fill="none" stroke-linecap="round" opacity=".5"/>' +
      /* the pen cast onto the bar */
      '<ellipse cx="52" cy="35" rx="29" ry="3.6" fill="url(#cs' + u + ')" ' +
        'transform="rotate(-6 52 35)"/>' +
      /* the pen itself */
      '<g transform="rotate(-6 50 24) translate(0 2.5)">' +
        '<path d="M10 21 Q11.6 17.2 16 17.4 L60 19 L60 25.6 L16 27 Q11.6 27.2 10 23.6 Z" ' +
          'fill="url(#hd' + u + ')"/>' +
        '<path d="M16 19.4 L57 20.6" stroke="#a97f4c" stroke-width="1.4" ' +
          'fill="none" stroke-linecap="round" opacity=".7"/>' +
        '<path d="M18 25.8 L57 25" stroke="#0d0805" stroke-width="1.2" fill="none" opacity=".6"/>' +
        '<path d="M59 18.8 L69 19.6 L69 25.4 L59 26 Z" fill="url(#fe' + u + ')"/>' +
        '<path d="M60 19.6 L68 20.2" stroke="' + BR_SPEC + '" stroke-width="1.2" ' +
          'fill="none" opacity=".95"/>' +
        '<path d="M60 25.2 L68 24.8" stroke="' + BR_DEEP + '" stroke-width="1" ' +
          'fill="none" opacity=".8"/>' +
        '<path d="M68.5 20 Q84 20.8 93 22.4 Q84 24.6 68.5 25 Z" fill="url(#nb' + u + ')"/>' +
        '<path d="M70 20.8 Q82 21.4 90.6 22.6" stroke="#b6ad9c" stroke-width="0.9" ' +
          'fill="none" opacity=".75"/>' +
        '<path d="M76 22.5 L92.4 22.5" stroke="#0d0805" stroke-width="0.9" fill="none"/>' +
        '<ellipse cx="76" cy="22.5" rx="2.4" ry="1.6" fill="#0d0805"/>' +
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
      '<path d="M38.4 41.6 C41 33.4 49.6 30.8 56.6 31" stroke="' + BR_SPEC + '" ' +
        'stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M44 40.2 C46 35.4 51 33.4 55.4 33.4" stroke="#ffffff" ' +
        'stroke-width="1" fill="none" stroke-linecap="round" opacity=".45"/>' +
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
      brassDome("dm" + u, 50, 74, 46) +
      brassBar("bp" + u, 12, 76, 88, 96) +
      brassBar("st" + u, 43, 18, 58, 30) +
      brassDome("kb" + u, 50, 20, 13);

    var b =
      '<ellipse cx="56" cy="94" rx="47" ry="9" fill="url(#sh' + u + ')"/>' +
      /* base plate: a low turned plinth wider than the dome */
      '<path d="M10 82 Q50 95 90 82 L90 88 Q50 101 10 88 Z" fill="#2a1e07"/>' +
      '<ellipse cx="50" cy="82" rx="40" ry="12" fill="url(#bp' + u + ')"/>' +
      '<path d="M13.6 78.6 Q28 71.4 46 70.4" stroke="' + BR_SPEC + '" stroke-width="1.8" ' +
        'fill="none" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M75 73 Q86.6 76.6 88.4 82" stroke="#1e1504" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>' +
      '<path d="M16 87.6 Q50 99.4 84 87.4" stroke="' + BR_BNC + '" stroke-width="1.4" ' +
        'fill="none" opacity=".6"/>' +
      /* the dome sits down on the plate and shadows it to the right */
      '<ellipse cx="55" cy="80" rx="34" ry="10" fill="url(#cs' + u + ')"/>' +
      '<ellipse cx="50" cy="78" rx="31" ry="8.6" fill="#3a2a0b" opacity=".5"/>' +
      /* dome */
      '<path d="M19 77 C19 33 81 33 81 77 Q50 89 19 77 Z" fill="url(#dm' + u + ')"/>' +
      '<path d="M74 45 C80.6 54 82.4 66 81.2 76.4" stroke="#1c1403" stroke-width="3" ' +
        'fill="none" stroke-linecap="round" opacity=".6"/>' +
      '<path d="M24 80.6 Q50 89.6 76 80.4" stroke="' + BR_BNC + '" stroke-width="2" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>' +
      /* specular: a soft raked streak, with a small hot core inside it */
      '<ellipse cx="31" cy="57" rx="7" ry="18" fill="url(#sp' + u + ')" opacity=".72" ' +
        'transform="rotate(-13 31 57)"/>' +
      '<ellipse cx="30.5" cy="54" rx="2.6" ry="9" fill="#ffffff" opacity=".7" ' +
        'transform="rotate(-13 30.5 54)"/>' +
      '<ellipse cx="63" cy="50" rx="6" ry="3" fill="url(#sp' + u + ')" opacity=".4" ' +
        'transform="rotate(-32 63 50)"/>' +
      /* the turned bands round the skirt */
      '<path d="M20.4 71 Q50 82.4 79.6 71" stroke="#2a1e07" stroke-width="1.2" ' +
        'fill="none" opacity=".55"/>' +
      '<path d="M20 73.6 Q50 85.4 80 73.6" stroke="' + BR_HI + '" stroke-width="1" ' +
        'fill="none" opacity=".45"/>' +
      /* plunger */
      '<ellipse cx="50" cy="34.6" rx="7" ry="2.6" fill="#2a1e07" opacity=".45"/>' +
      '<path d="M43.4 33 L43.4 20 L56.6 20 L56.6 33 Q50 36.4 43.4 33 Z" fill="url(#st' + u + ')"/>' +
      '<path d="M45 21 L45 32" stroke="' + BR_SPEC + '" stroke-width="1.5" fill="none" opacity=".9"/>' +
      '<path d="M55 21 L55 32" stroke="#1e1504" stroke-width="1.3" fill="none" opacity=".7"/>' +
      '<ellipse cx="50" cy="17.6" rx="11" ry="6" fill="url(#kb' + u + ')"/>' +
      '<path d="M41.6 15.4 Q45.4 11.8 51.4 11.8" stroke="' + BR_SPEC + '" stroke-width="2" ' +
        'fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M57.6 13.8 Q61.4 16 60.4 19.4" stroke="#1e1504" stroke-width="1.4" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>' +
      '<path d="M41.4 20 Q50 24.4 59 19.6" stroke="' + BR_BNC + '" stroke-width="1.2" ' +
        'fill="none" stroke-linecap="round" opacity=".65"/>';
    return svg(w, 100, 102, d, b);
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
      '<path d="M8 30 Q40 44 82 34 Q90 32 95 27" fill="none" stroke="' + BR_DEEP + '" ' +
        'stroke-width="2.8" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M8.6 29 Q40 42.6 82 32.6 Q90 30.6 94.6 26" fill="none" stroke="' + BR_MID +
        '" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M12 34 Q42 46.6 78 37" fill="none" stroke="' + BR_SH + '" ' +
        'stroke-width="2.2" stroke-linecap="round" opacity=".7"/>' +
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
    var u = uid(), w = num(o && o.w, 120), i, x, holes = "", hx = [19, 39.7, 60.3, 81];
    var d =
      blot("sh" + u, "#17100a", 0.52) +
      lg("tp" + u, 6, 16, 94, 34, [
        [0, "#d0a067"], [0.12, WD_LIT], [0.38, WD_HI], [0.68, "#825934"], [1, "#513724"]
      ]) +
      woodBar("fr" + u, 0, 26, 0, 44) +
      lg("en" + u, 88, 24, 100, 40, [[0, "#4a3120"], [0.6, WD_DEEP], [1, "#6a4a2e"]]) +
      lg("el" + u, 0, 24, 12, 40, [[0, WD_LIT], [0.6, WD_HI], [1, "#6b4a2f"]]) +
      rg("ho" + u, 50, 24, 9, [[0, "#0f0904"], [0.7, "#0f0904"], [1, "#6b4a2f"]]);

    for (i = 0; i < hx.length; i++) {
      x = hx[i];
      holes +=
        '<ellipse cx="' + x + '" cy="24.6" rx="8.2" ry="4" fill="url(#ho' + u + ')"/>' +
        '<path d="M' + (x - 8.2) + ' 24.6 Q' + x + ' 20.2 ' + (x + 8.2) + ' 24.6" ' +
          'stroke="#0b0703" stroke-width="1.6" fill="none" opacity=".9"/>' +
        '<path d="M' + (x - 7) + ' 26.2 Q' + x + ' 29.6 ' + (x + 7) + ' 26.2" ' +
          'stroke="#a8794a" stroke-width="1.3" fill="none" opacity=".6"/>' +
        '<path d="M' + (x - 6.4) + ' 23.2 Q' + x + ' 20.4 ' + (x + 2) + ' 20.6" ' +
          'stroke="#c99a63" stroke-width="0.8" fill="none" opacity=".4"/>';
    }

    var b =
      '<ellipse cx="54" cy="46" rx="48" ry="6.5" fill="url(#sh' + u + ')"/>' +
      /* the plinth: a flat block, only lightly bowed by the view */
      '<path d="M6 22 L6 34 Q50 40 94 34 L94 22 Z" fill="url(#fr' + u + ')"/>' +
      '<path d="M6 22 Q50 15 94 22 Q50 29 6 22 Z" fill="url(#tp' + u + ')"/>' +
      holes +
      /* ends, squared off */
      '<path d="M94 22 L94 34 L91 34.4 L91 21.6 Z" fill="url(#en' + u + ')"/>' +
      '<path d="M6 22 L6 34 L9 34.4 L9 21.6 Z" fill="url(#el' + u + ')"/>' +
      /* mouldings on the front */
      '<path d="M6 22 Q50 29 94 22" stroke="#d6a468" stroke-width="1" fill="none" opacity=".5"/>' +
      '<path d="M6 26.2 Q50 33.2 94 26.2" stroke="' + WD_DEEP + '" stroke-width="1.6" ' +
        'fill="none" opacity=".5"/>' +
      '<path d="M6 29 Q50 36 94 29" stroke="#966c42" stroke-width="0.8" fill="none" opacity=".4"/>' +
      '<path d="M6.6 33.4 Q50 39.6 93.4 33.4" stroke="' + WD_DEEP + '" stroke-width="1.6" ' +
        'fill="none" opacity=".6"/>' +
      /* lit left end, dark right end */
      '<path d="M6.6 22.2 Q26 17.6 46 15.8" stroke="#e0b078" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round" opacity=".75"/>' +
      '<path d="M6.4 22.4 L6.4 33.4" stroke="#d6a468" stroke-width="1.5" fill="none" opacity=".6"/>' +
      '<path d="M93.6 22.4 L93.6 33.6" stroke="#150d05" stroke-width="1.6" fill="none" opacity=".75"/>' +
      '<path d="M68 17.4 Q83 19.4 93.4 22" stroke="#2a1c0f" stroke-width="1.2" ' +
        'fill="none" opacity=".45"/>' +
      /* turned feet */
      '<path d="M13 34.6 Q19 41.6 25 34.2" fill="' + WD_SH + '"/>' +
      '<path d="M75 34.2 Q81 41.6 87 33.6" fill="#241708"/>' +
      '<path d="M13.6 35 Q17 38.6 20 38.4" stroke="#a8794a" stroke-width="1" ' +
        'fill="none" opacity=".5"/>';
    return svg(w, 100, 50, d, b);
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
      lg("ds" + u, 6, 82, 94, 104, [
        [0, "#d6a468"], [0.1, "#b4854f"], [0.4, "#835b35"], [0.72, "#48311d"],
        [0.9, "#241708"], [1, "#7d5836"]
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
        '<path d="M12 40 Q50 28 88 40 L90 82 Q50 94 10 82 Z" fill="url(#br' + u + ')"/>' +
        '<path d="M12 40 Q50 52 88 40 Q50 28 12 40 Z" fill="url(#bt' + u + ')"/>' +
        '<path d="M15.6 39 Q32 32.4 50 31.4" stroke="#f0c48c" stroke-width="1.4" ' +
          'fill="none" stroke-linecap="round" opacity=".7"/>' +
        '<path d="M14.6 41.6 L12.8 80" stroke="#e0b078" stroke-width="2.8" fill="none" ' +
          'stroke-linecap="round" opacity=".6"/>' +
        '<path d="M20 43 L18.6 79" stroke="#f0c48c" stroke-width="0.9" fill="none" ' +
          'stroke-linecap="round" opacity=".3"/>' +
        '<path d="M85.6 42 L87.8 80" stroke="#150d05" stroke-width="3" fill="none" ' +
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
        /* base disc */
        '<ellipse cx="54" cy="86" rx="42" ry="9" fill="url(#cs' + u + ')"/>' +
        '<path d="M4 84 Q50 96 96 84 L96 96 Q50 108 4 96 Z" fill="url(#ds' + u + ')"/>' +
        '<path d="M4 84 Q50 73 96 84 Q50 96 4 84 Z" fill="#9c7044"/>' +
        '<path d="M6.6 83 Q26 75.4 48 74.4" stroke="#e8bc84" stroke-width="1.8" ' +
          'fill="none" stroke-linecap="round" opacity=".85"/>' +
        '<path d="M72 76.4 Q88 79.4 95 84" stroke="#241708" stroke-width="1.4" ' +
          'fill="none" stroke-linecap="round" opacity=".55"/>' +
        '<path d="M4 96 Q50 108 96 96" stroke="#1c1207" stroke-width="1.5" fill="none" opacity=".7"/>' +
        /* mount board, then the rubber die */
        '<path d="M6 95 Q50 106.6 94 95 L93 101 Q50 112.6 7 101 Z" fill="#cbb98f"/>' +
        '<path d="M6 95 Q50 106.6 94 95" stroke="#f0e6c8" stroke-width="1" fill="none" opacity=".8"/>' +
        '<path d="M7 100.6 Q50 112.2 93 100.6 L90 113 Q50 124 10 113 Z" fill="url(#rb' + u + ')"/>' +
        '<path d="M9 102 Q12.6 107.6 11.4 112.6" stroke="#7d7469" stroke-width="1.8" ' +
          'fill="none" opacity=".7"/>' +
        '<path d="M10 113 Q50 124 90 113" stroke="' + col + '" stroke-width="2" ' +
          'fill="none" opacity=".8"/>' +
        '<path d="M12 114.6 Q50 124.6 88 114.6" stroke="#0b0806" stroke-width="1" ' +
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
      /* the stack of papers standing on it */
      '<path d="M20 47 L44.6 30.4 L84 30.4 L59.4 47 Z" fill="#b5a682"/>' +
      '<path d="M19 45.6 L43.6 29 L83 29 L58.4 45.6 Z" fill="url(#pe' + u + ')"/>' +
      '<path d="M18 44 L42.6 27.4 L82 27.4 L57.4 44 Z" fill="url(#pa' + u + ')"/>' +
      '<path d="M18 44 L42.6 27.4" stroke="#ffffff" stroke-width="1.3" fill="none" opacity=".8"/>' +
      '<path d="M42.6 27.4 L82 27.4" stroke="#ffffff" stroke-width="1" fill="none" opacity=".5"/>' +
      '<path d="M27 40 L56 34.6 M30 42 L62 35.6 M33.6 43 L66 36" stroke="' + INK + '" ' +
        'stroke-width="0.7" opacity=".26"/>' +
      '<path d="M18 44 L57.4 44 L82 27.4" fill="none" stroke="#9a8b68" stroke-width="1.2" ' +
        'opacity=".8"/>' +
      '<path d="M18 44 L20 47 L59.4 47 L57.4 44 Z" fill="#a4956f"/>' +
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
      /* thick cut foot */
      '<path d="M25.4 90 Q50 99 74.6 90 L74 102 Q50 111 26 102 Z" fill="url(#bs' + u + ')"/>' +
      '<path d="M25.4 90 Q50 99 74.6 90" stroke="#ffffff" stroke-width="1.2" fill="none" ' +
        'opacity=".55"/>' +
      '<path d="M32 93.6 L31.4 104.6 M42 95.8 L42 107.4 M58 95.8 L58 107.4 M68 93.6 L68.6 104.6" ' +
        'stroke="#ffffff" stroke-width="1.1" opacity=".34"/>' +
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
