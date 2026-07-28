/* furniture.js — the objects on a District Officer's desk, 1920s, as inline SVG.

   Each entry takes { w } (width in CSS px; height follows the natural aspect)
   and returns a complete, self-contained <svg> string: no <style>, no classes,
   no external references — everything styled by attribute, because these are
   dropped into a page with innerHTML and the page's stylesheet must not reach
   them.

   House rules, held to without exception:
     · the light comes from the UPPER LEFT. Highlights up-left, shadow and
       reflected light down-right, a soft contact shadow to the lower right of
       whatever stands on the desk.
     · a shallow three-quarter view from slightly above — never a flat
       elevation, never a plan. Round things show their top as an ellipse.
     · brass gets a vertical gradient, one hot specular, and a dark rim on the
       side away from the light; glass gets low-alpha fills and bright edges,
       never a flat grey.
     · every gradient id carries a per-call counter, or gradients bleed between
       instances sharing a page.                                              */
"use strict";

(function (root) {

  /* ---- the desk palette ------------------------------------------------ */
  var BR_SPEC = "#fff3d0",       /* brass, hot specular   */
      BR_HI   = "#e2c073",       /* brass, highlight      */
      BR_LIT  = "#cda css",      /* (unused placeholder)  */
      BR_MID  = "#c19a45",
      BR      = "#a9822f",       /* brass, base           */
      BR_SH   = "#6d5119",       /* brass, shadow         */
      BR_DEEP = "#4a3610",
      WD_HI   = "#a8794a",       /* wood, highlight       */
      WD      = "#6b4a2f",       /* wood, base            */
      WD_SH   = "#3d2917",       /* wood, shadow          */
      WD_DEEP = "#281a0d",
      INK     = "#221c12",
      LEATHER = "#33402f",
      PAPER   = "#efe7ce",
      PAPER_S = "#cbbc98",
      SERIF   = "Georgia,'Times New Roman',Times,serif";

  BR_LIT = "#d8b25e";

  /* ---- plumbing -------------------------------------------------------- */
  var seq = 0;
  function uid() { seq += 1; return "fn" + seq; }

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
  /* a soft blot for the contact shadow; objectBoundingBox so it fits any ellipse */
  function blot(id, op) {
    return '<radialGradient id="' + id + '">' + stops([
      [0, "#17100a", op], [0.45, "#17100a", op * 0.72],
      [0.78, "#17100a", op * 0.28], [1, "#17100a", 0]
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

  /* standard brass barrel: light down the upper-left, dark rim right,
     reflected warmth creeping back at the bottom edge */
  function brassBar(id, x1, y1, x2, y2) {
    return lg(id, x1, y1, x2, y2, [
      [0, BR_HI], [0.14, BR_LIT], [0.34, BR_MID], [0.55, BR],
      [0.78, BR_SH], [0.92, BR_DEEP], [1, "#8a6a28"]
    ]);
  }
  function woodBar(id, x1, y1, x2, y2) {
    return lg(id, x1, y1, x2, y2, [
      [0, WD_HI], [0.22, "#8a6038"], [0.5, WD], [0.8, WD_SH], [1, "#4a3120"]
    ]);
  }

  /* ====================================================================== *
   *  INKWELL — square-cut glass well, brass collar and domed lid
   * ====================================================================== */
  function inkwell(o) {
    var u = uid(), w = num(o && o.w, 80);
    var d =
      blot("sh" + u, 0.5) +
      lg("gl" + u, 14, 50, 86, 104, [
        ["0", "#f4f6ef", "0.5"], ["0.22", "#cdd6cd", "0.34"],
        ["0.5", "#8f9c92", "0.3"], ["0.8", "#5d6a5f", "0.4"], ["1", "#8e9a8c", "0.5"]
      ]) +
      lg("ik" + u, 18, 72, 84, 106, [
        ["0", "#3a3121"], ["0.35", "#282112"], ["0.72", INK], ["1", "#3b3220"]
      ]) +
      brassBar("co" + u, 22, 40, 82, 62) +
      rg("dm" + u, 38, 22, 44, [
        [0, BR_SPEC], [0.16, BR_HI], [0.38, BR_MID], [0.62, BR],
        [0.85, BR_SH], [1, BR_DEEP]
      ], 33, 17) +
      brassBar("kn" + u, 44, 8, 58, 22);

    var b =
      /* contact shadow, thrown down and to the right */
      '<ellipse cx="55" cy="104" rx="45" ry="9.5" fill="url(#sh' + u + ')"/>' +
      /* far rim of the well, seen over the front wall */
      '<path d="M22 54 Q50 44 78 54 Q50 62 22 54 Z" fill="#5f6a5c" opacity=".55"/>' +
      /* glass body */
      '<path d="M22 54 Q50 64 78 54 L86 98 Q50 111 14 98 Z" fill="url(#gl' + u + ')"/>' +
      /* the ink standing in it */
      '<path d="M19.5 78 Q50 88 80.5 78 L86 98 Q50 111 14 98 Z" fill="url(#ik' + u + ')"/>' +
      '<path d="M19.5 78 Q50 70 80.5 78 Q50 88 19.5 78 Z" fill="#2c2416"/>' +
      '<path d="M27 76.6 Q38 73.4 50 73.2" stroke="#7a6f52" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round" opacity=".55"/>' +
      /* glass: bright left edge, thin reflected light on the right, foot flare */
      '<path d="M23.4 56 L16.4 96" stroke="#ffffff" stroke-width="2.6" ' +
        'stroke-linecap="round" fill="none" opacity=".72"/>' +
      '<path d="M27.5 58 L21.5 94" stroke="#ffffff" stroke-width="1.1" ' +
        'stroke-linecap="round" fill="none" opacity=".34"/>' +
      '<path d="M77.2 57 L83.6 95" stroke="#dfe7dd" stroke-width="1.5" ' +
        'stroke-linecap="round" fill="none" opacity=".4"/>' +
      '<path d="M18 97 Q50 108 82 97" stroke="#ffffff" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".45"/>' +
      /* brass collar */
      '<path d="M18 48 Q50 60 82 48 L82 58 Q50 70 18 58 Z" fill="url(#co' + u + ')"/>' +
      '<path d="M18 48 Q50 36 82 48 Q50 60 18 48 Z" fill="' + BR_MID + '"/>' +
      '<path d="M21 47 Q34 40 47 39.2" stroke="' + BR_SPEC + '" stroke-width="1.8" ' +
        'fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M18 58 Q50 70 82 58" stroke="' + BR_DEEP + '" stroke-width="1.4" ' +
        'fill="none" opacity=".75"/>' +
      /* hinge lug, back right */
      '<path d="M78 44 Q86 42 87 48 Q86 53 79 51 Z" fill="' + BR_SH + '"/>' +
      /* domed lid */
      '<path d="M21 47 C21 20 79 20 79 47 Q50 59 21 47 Z" fill="url(#dm' + u + ')"/>' +
      '<path d="M25.5 43 C26.5 26 38 20.5 49 20" stroke="' + BR_SPEC + '" ' +
        'stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M31 44.5 C32 32 40 27 47 26" stroke="#ffffff" stroke-width="1.1" ' +
        'fill="none" stroke-linecap="round" opacity=".45"/>' +
      '<path d="M74.5 33 C78.5 39 78.8 44 78.2 47.6" stroke="' + BR_DEEP + '" ' +
        'stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M28 50.5 Q50 58 72 50.5" stroke="' + BR_HI + '" stroke-width="1.2" ' +
        'fill="none" opacity=".45"/>' +
      /* knob */
      '<path d="M46 22 L46 15 Q50 12 54 15 L54 22 Q50 25 46 22 Z" fill="url(#kn' + u + ')"/>' +
      '<ellipse cx="50" cy="13.6" rx="6.6" ry="3.6" fill="url(#kn' + u + ')"/>' +
      '<path d="M45.6 12.6 Q48 10.4 51 10.6" stroke="' + BR_SPEC + '" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round" opacity=".9"/>';
    return svg(w, 100, 114, d, b);
  }

  /* ====================================================================== *
   *  PEN REST — turned wood cradle, a dip pen lying in it
   * ====================================================================== */
  function penrest(o) {
    var u = uid(), w = num(o && o.w, 90);
    var d =
      blot("sh" + u, 0.46) +
      woodBar("bo" + u, 0, 26, 0, 50) +
      lg("tp" + u, 0, 22, 0, 34, [[0, "#b9884f"], [0.5, WD_HI], [1, "#7d5836"]]) +
      woodBar("kb" + u, 0, 18, 0, 48) +
      lg("hd" + u, 20, 12, 74, 30, [
        [0, "#8d6a3c"], [0.3, "#6f4f2c"], [0.68, "#4b3320"], [1, "#6a4a2c"]
      ]) +
      brassBar("fe" + u, 60, 16, 76, 30) +
      lg("nb" + u, 74, 18, 94, 32, [
        [0, "#6b6355"], [0.35, "#3a352b"], [0.75, INK], [1, "#4a4436"]
      ]);

    var b =
      '<ellipse cx="53" cy="49" rx="46" ry="7.5" fill="url(#sh' + u + ')"/>' +
      /* the rest: a turned bar between two bobbin ends */
      '<path d="M18 33 L82 33 L82 44 Q50 50 18 44 Z" fill="url(#bo' + u + ')"/>' +
      '<path d="M18 33 Q50 27 82 33 Q50 39 18 33 Z" fill="url(#tp' + u + ')"/>' +
      /* the two grooves cut in the top */
      '<path d="M36 31.4 Q40 34.6 44 31.6" stroke="' + WD_DEEP + '" stroke-width="2" ' +
        'fill="none" opacity=".7"/>' +
      '<path d="M56 31.6 Q60 34.8 64 31.8" stroke="' + WD_DEEP + '" stroke-width="2" ' +
        'fill="none" opacity=".7"/>' +
      /* turned ends */
      '<ellipse cx="16" cy="37" rx="9.5" ry="10" fill="url(#kb' + u + ')"/>' +
      '<ellipse cx="84" cy="37" rx="9.5" ry="10" fill="url(#kb' + u + ')"/>' +
      '<path d="M10 34 Q12.5 28.5 18 28.5" stroke="' + WD_HI + '" stroke-width="2.2" ' +
        'fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M78.5 30 Q90.5 31.5 90 39" stroke="#c99a63" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".5"/>' +
      '<path d="M88.5 42 Q84 47 78 45.5" stroke="' + WD_DEEP + '" stroke-width="1.8" ' +
        'fill="none" stroke-linecap="round" opacity=".7"/>' +
      /* grain along the bar */
      '<path d="M22 36.5 Q48 33.6 79 36.2" stroke="#8f6740" stroke-width="0.8" ' +
        'fill="none" opacity=".55"/>' +
      '<path d="M22 40.2 Q50 37.6 79 39.8" stroke="' + WD_DEEP + '" stroke-width="0.7" ' +
        'fill="none" opacity=".4"/>' +
      '<path d="M20 43.6 Q50 49 82 43.4" stroke="' + WD_DEEP + '" stroke-width="1.6" ' +
        'fill="none" opacity=".5"/>' +
      /* the pen lying across the grooves */
      '<g transform="rotate(-7 55 24)">' +
        '<path d="M18 23.2 Q20 20.4 24 20.6 L64 22 L64 26.4 L24 27.6 Q20 27.6 18 25 Z" ' +
          'fill="url(#hd' + u + ')"/>' +
        '<path d="M23 21.8 L60 22.9" stroke="#c19560" stroke-width="1.3" ' +
          'fill="none" stroke-linecap="round" opacity=".65"/>' +
        '<path d="M25 26.4 L60 25.7" stroke="#1e1409" stroke-width="1" ' +
          'fill="none" opacity=".5"/>' +
        '<path d="M63 21.6 L72 22.2 L72 26.4 L63 26.9 Z" fill="url(#fe' + u + ')"/>' +
        '<path d="M64 22.2 L71 22.7" stroke="' + BR_SPEC + '" stroke-width="1.1" ' +
          'fill="none" opacity=".85"/>' +
        '<path d="M71.5 22.6 Q84 23 90 24.4 Q84 26 71.5 26.2 Z" fill="url(#nb' + u + ')"/>' +
        '<path d="M73 23.2 Q82 23.6 88 24.4" stroke="#9a9182" stroke-width="0.9" ' +
          'fill="none" opacity=".7"/>' +
        '<path d="M79 24.4 L88.6 24.4" stroke="' + INK + '" stroke-width="0.8" fill="none"/>' +
      '</g>';
    return svg(w, 100, 56, d, b);
  }

  /* ====================================================================== *
   *  PAPERWEIGHT — bevelled brass slab with a domed boss
   * ====================================================================== */
  function paperweight(o) {
    var u = uid(), w = num(o && o.w, 70);
    var d =
      blot("sh" + u, 0.52) +
      lg("tp" + u, 12, 20, 88, 50, [
        [0, BR_SPEC], [0.1, BR_HI], [0.3, BR_LIT], [0.58, BR_MID], [0.85, BR], [1, BR_SH]
      ]) +
      lg("fr" + u, 10, 48, 40, 76, [
        [0, BR_MID], [0.3, BR], [0.72, BR_SH], [1, "#7e6023"]
      ]) +
      lg("rt" + u, 62, 44, 96, 74, [
        [0, BR_SH], [0.45, BR_DEEP], [0.85, "#3a2a0b"], [1, "#7a5c22"]
      ]) +
      rg("bs" + u, 44, 22, 26, [
        [0, BR_SPEC], [0.2, BR_HI], [0.5, BR_MID], [0.8, BR], [1, BR_SH]
      ], 38, 16);

    var b =
      '<ellipse cx="54" cy="74" rx="46" ry="8" fill="url(#sh' + u + ')"/>' +
      /* body: top face, then the two visible sides */
      '<path d="M14 45 L44 62 L92 50 L62 35 Z" fill="url(#rt' + u + ')" opacity="0"/>' +
      '<path d="M8 46 L46 66 L46 76 L8 56 Z" fill="url(#fr' + u + ')"/>' +
      '<path d="M46 66 L94 50 L94 60 L46 76 Z" fill="url(#rt' + u + ')"/>' +
      '<path d="M8 46 L42 30 L94 50 L46 66 Z" fill="url(#tp' + u + ')"/>' +
      /* bevel: the lit upper-left arris, the dark one away from the light */
      '<path d="M9.6 46.4 L42.2 31.2" stroke="' + BR_SPEC + '" stroke-width="1.9" ' +
        'fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M42.6 31 L92.6 49.8" stroke="' + BR_HI + '" stroke-width="1.3" ' +
        'fill="none" stroke-linecap="round" opacity=".55"/>' +
      '<path d="M46.2 66.4 L93.4 50.6" stroke="#2f2208" stroke-width="1.5" ' +
        'fill="none" opacity=".75"/>' +
      '<path d="M94 50 L94 60" stroke="#2f2208" stroke-width="1.4" fill="none" opacity=".8"/>' +
      '<path d="M9 55.4 L45.4 74.6" stroke="#8f6d26" stroke-width="1.4" ' +
        'fill="none" opacity=".6"/>' +
      /* a raked specular streak across the top face */
      '<path d="M20 44 L52 32 L60 35 L28 47.6 Z" fill="' + BR_SPEC + '" opacity=".3"/>' +
      '<path d="M22.5 44.6 L50.5 34" stroke="#ffffff" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round" opacity=".5"/>' +
      /* domed boss on the top face */
      '<ellipse cx="52" cy="45" rx="19" ry="8.5" fill="' + BR_SH + '" opacity=".55"/>' +
      '<path d="M34 43.6 C36 30 68 27.6 70 41 C70 47.6 34 50 34 43.6 Z" ' +
        'fill="url(#bs' + u + ')"/>' +
      '<path d="M39 41.5 C41.5 33.6 50 31 57 31.2" stroke="' + BR_SPEC + '" ' +
        'stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M66.5 35.5 C69.6 38.4 69.8 41.6 69.2 44" stroke="#3a2a0b" ' +
        'stroke-width="1.9" fill="none" stroke-linecap="round" opacity=".75"/>' +
      '<path d="M38 47 Q52 52 67 46.4" stroke="' + BR_HI + '" stroke-width="1.1" ' +
        'fill="none" opacity=".5"/>';
    return svg(w, 100, 82, d, b);
  }

  /* ====================================================================== *
   *  BELL — brass counter bell with its plunger
   * ====================================================================== */
  function bell(o) {
    var u = uid(), w = num(o && o.w, 70);
    var d =
      blot("sh" + u, 0.55) +
      rg("dm" + u, 40, 40, 52, [
        [0, BR_SPEC], [0.1, BR_HI], [0.3, BR_LIT], [0.5, BR_MID],
        [0.68, BR], [0.86, BR_SH], [0.96, BR_DEEP], [1, "#9a7628"]
      ], 30, 28) +
      brassBar("bp" + u, 18, 80, 84, 96) +
      brassBar("st" + u, 42, 12, 60, 24) +
      rg("kb" + u, 46, 9, 12, [
        [0, BR_SPEC], [0.25, BR_HI], [0.6, BR], [1, BR_SH]
      ], 44, 6);

    var b =
      '<ellipse cx="55" cy="93" rx="46" ry="9" fill="url(#sh' + u + ')"/>' +
      /* base plate */
      '<path d="M14 84 Q50 96 86 84 L86 89 Q50 101 14 89 Z" fill="' + BR_DEEP + '"/>' +
      '<ellipse cx="50" cy="84" rx="36" ry="10.5" fill="url(#bp' + u + ')"/>' +
      '<path d="M17 81 Q30 74.6 46 73.8" stroke="' + BR_SPEC + '" stroke-width="1.8" ' +
        'fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<ellipse cx="50" cy="83" rx="27" ry="7.5" fill="' + BR_SH + '" opacity=".45"/>' +
      /* dome */
      '<path d="M16 79 C16 36 84 36 84 79 Q50 91 16 79 Z" fill="url(#dm' + u + ')"/>' +
      /* dark rim away from the light + reflected warmth at the very bottom */
      '<path d="M75 47 C82.5 56 84.4 68 83.6 78.4" stroke="#3a2a0b" stroke-width="3" ' +
        'fill="none" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M28 84.6 Q50 90.4 72 84.4" stroke="' + BR_HI + '" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".55"/>' +
      /* specular: one crisp streak up the left shoulder, one small hot spot */
      '<path d="M25 72 C24 50 34 40.4 47 38.6" stroke="' + BR_SPEC + '" stroke-width="3.4" ' +
        'fill="none" stroke-linecap="round" opacity=".92"/>' +
      '<path d="M32 68 C31.6 52 39 44.6 47 43.4" stroke="#ffffff" stroke-width="1.3" ' +
        'fill="none" stroke-linecap="round" opacity=".45"/>' +
      '<ellipse cx="61" cy="52" rx="5" ry="3" fill="' + BR_SPEC + '" opacity=".35" ' +
        'transform="rotate(-28 61 52)"/>' +
      /* the turned band around the skirt */
      '<path d="M17.5 73 Q50 84.5 82.5 73" stroke="' + BR_DEEP + '" stroke-width="1.2" ' +
        'fill="none" opacity=".55"/>' +
      '<path d="M17.8 76 Q50 87.6 82.2 76" stroke="' + BR_HI + '" stroke-width="1" ' +
        'fill="none" opacity=".4"/>' +
      /* plunger */
      '<path d="M44 34 L44 20 L56 20 L56 34 Q50 37 44 34 Z" fill="url(#st' + u + ')"/>' +
      '<path d="M45.4 21 L45.4 33" stroke="' + BR_SPEC + '" stroke-width="1.4" ' +
        'fill="none" opacity=".85"/>' +
      '<ellipse cx="50" cy="17.5" rx="12" ry="6.6" fill="url(#kb' + u + ')"/>' +
      '<path d="M41 15.6 Q45.4 11.6 51.6 11.6" stroke="' + BR_SPEC + '" stroke-width="2" ' +
        'fill="none" stroke-linecap="round" opacity=".95"/>' +
      '<path d="M40.4 20.4 Q50 25 60 19.8" stroke="#3a2a0b" stroke-width="1.4" ' +
        'fill="none" stroke-linecap="round" opacity=".6"/>';
    return svg(w, 100, 102, d, b);
  }

  /* ====================================================================== *
   *  SPECTACLES — gold wire rims, one arm folded across
   * ====================================================================== */
  function spectacles(o) {
    var u = uid(), w = num(o && o.w, 90);
    var d =
      blot("sh" + u, 0.4) +
      lg("wi" + u, 6, 12, 96, 46, [
        [0, BR_SPEC], [0.18, BR_HI], [0.42, BR_MID], [0.62, BR],
        [0.82, BR_SH], [1, BR_HI]
      ]) +
      rg("le" + u, 26, 22, 22, [
        ["0", "#ffffff", "0.4"], ["0.4", "#dfe6dd", "0.2"],
        ["0.78", "#8e9a8c", "0.22"], ["1", "#f2f6ee", "0.42"]
      ], 20, 15) +
      rg("re" + u, 70, 22, 22, [
        ["0", "#ffffff", "0.36"], ["0.42", "#dfe6dd", "0.18"],
        ["0.8", "#7f8c80", "0.24"], ["1", "#eef3ea", "0.4"]
      ], 64, 15);

    var b =
      '<ellipse cx="34" cy="43" rx="26" ry="6" fill="url(#sh' + u + ')"/>' +
      '<ellipse cx="76" cy="42" rx="24" ry="5.5" fill="url(#sh' + u + ')"/>' +
      /* the folded arm, running back to the right */
      '<path d="M84 24 Q94 22 96 27 Q92 30 84 29" fill="none" stroke="' + BR_SH + '" ' +
        'stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M22 30 Q46 40 74 33" fill="none" stroke="' + BR_SH + '" ' +
        'stroke-width="2.4" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M23 29.2 Q46 38.8 74 32" fill="none" stroke="' + BR_HI + '" ' +
        'stroke-width="0.9" stroke-linecap="round" opacity=".75"/>' +
      /* lenses (glass, seen at a shallow tilt) */
      '<ellipse cx="28" cy="24" rx="22" ry="17" fill="url(#le' + u + ')"/>' +
      '<ellipse cx="72" cy="23" rx="20.5" ry="15.5" fill="url(#re' + u + ')"/>' +
      '<path d="M14 16 Q22 8.5 34 9" stroke="#ffffff" stroke-width="2.6" fill="none" ' +
        'stroke-linecap="round" opacity=".72"/>' +
      '<path d="M18 30 Q22 35.6 30 37.4" stroke="#ffffff" stroke-width="1.2" fill="none" ' +
        'stroke-linecap="round" opacity=".38"/>' +
      '<path d="M60 16 Q66.5 9 76 9.4" stroke="#ffffff" stroke-width="2.2" fill="none" ' +
        'stroke-linecap="round" opacity=".62"/>' +
      /* rims */
      '<ellipse cx="28" cy="24" rx="22" ry="17" fill="none" stroke="url(#wi' + u + ')" ' +
        'stroke-width="3"/>' +
      '<ellipse cx="28" cy="24" rx="22" ry="17" fill="none" stroke="' + BR_SPEC + '" ' +
        'stroke-width="1" stroke-dasharray="20 60" stroke-dashoffset="8" opacity=".9"/>' +
      '<ellipse cx="72" cy="23" rx="20.5" ry="15.5" fill="none" stroke="url(#wi' + u + ')" ' +
        'stroke-width="2.8"/>' +
      '<ellipse cx="72" cy="23" rx="20.5" ry="15.5" fill="none" stroke="' + BR_SPEC + '" ' +
        'stroke-width="0.9" stroke-dasharray="17 58" stroke-dashoffset="7" opacity=".8"/>' +
      /* bridge */
      '<path d="M49.6 20 Q56 13.4 62 18.6" fill="none" stroke="url(#wi' + u + ')" ' +
        'stroke-width="3"/>' +
      '<path d="M50.6 19 Q56 14.4 61.4 17.8" fill="none" stroke="' + BR_SPEC + '" ' +
        'stroke-width="1" opacity=".85"/>' +
      /* hinge lugs */
      '<rect x="4.5" y="21" width="5" height="4.4" rx="1.4" fill="url(#wi' + u + ')"/>' +
      '<rect x="90.5" y="20.4" width="5" height="4.2" rx="1.4" fill="url(#wi' + u + ')"/>';
    return svg(w, 100, 50, d, b);
  }

  /* ====================================================================== *
   *  LAMP — brass oil lamp with a glass chimney, lit
   * ====================================================================== */
  function lamp(o) {
    var u = uid(), w = num(o && o.w, 80);
    var d =
      blot("sh" + u, 0.5) +
      brassBar("ft" + u, 22, 136, 80, 162) +
      rg("fo" + u, 36, 100, 42, [
        [0, BR_SPEC], [0.12, BR_HI], [0.32, BR_LIT], [0.52, BR_MID],
        [0.72, BR], [0.9, BR_SH], [1, BR_DEEP]
      ], 32, 96) +
      brassBar("cl" + u, 26, 80, 76, 96) +
      lg("ch" + u, 20, 6, 82, 78, [
        ["0", "#ffffff", "0.3"], ["0.2", "#e6ece4", "0.16"],
        ["0.48", "#b7c2b6", "0.14"], ["0.76", "#7d8a7e", "0.24"], ["1", "#dfe7dc", "0.36"]
      ]) +
      rg("fl" + u, 50, 66, 20, [
        ["0", "#fff8de", "0.95"], ["0.3", "#ffdf94", "0.8"],
        ["0.62", "#e39a34", "0.45"], ["1", "#c9701a", "0"]
      ], 48, 62);

    var b =
      '<ellipse cx="56" cy="160" rx="42" ry="8.5" fill="url(#sh' + u + ')"/>' +
      /* foot */
      '<path d="M24 146 Q50 158 76 146 L76 152 Q50 164 24 152 Z" fill="' + BR_DEEP + '"/>' +
      '<ellipse cx="50" cy="146" rx="26" ry="9" fill="url(#ft' + u + ')"/>' +
      '<path d="M28 143 Q37 137.6 48 137" stroke="' + BR_SPEC + '" stroke-width="1.7" ' +
        'fill="none" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M30 149.6 Q50 156.4 70 149.4" stroke="' + BR_HI + '" stroke-width="1.2" ' +
        'fill="none" opacity=".45"/>' +
      /* stem */
      '<path d="M42 122 L58 122 L61 143 Q50 148 39 143 Z" fill="url(#fo' + u + ')"/>' +
      '<path d="M43.6 123 L41.4 142" stroke="' + BR_SPEC + '" stroke-width="1.6" ' +
        'fill="none" opacity=".8"/>' +
      '<path d="M57.4 124 L59.6 142" stroke="' + BR_DEEP + '" stroke-width="1.6" ' +
        'fill="none" opacity=".7"/>' +
      /* oil font */
      '<path d="M28 104 C28 88 72 88 72 104 C72 120 62 126 50 126 C38 126 28 120 28 104 Z" ' +
        'fill="url(#fo' + u + ')"/>' +
      '<path d="M34.5 110 C33 98 39 92.6 47 91.6" stroke="' + BR_SPEC + '" ' +
        'stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".92"/>' +
      '<path d="M40.6 108 C39.8 100 43.6 96.4 48 95.6" stroke="#ffffff" ' +
        'stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".4"/>' +
      '<path d="M66 96 C71.6 102 71.4 112 66.4 119.6" stroke="#3a2a0b" ' +
        'stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>' +
      '<path d="M36 122.6 Q50 128 64 122.4" stroke="' + BR_HI + '" stroke-width="1.4" ' +
        'fill="none" stroke-linecap="round" opacity=".5"/>' +
      /* collar and wick wheel */
      '<path d="M34 86 Q50 94 66 86 L66 96 Q50 104 34 96 Z" fill="url(#cl' + u + ')"/>' +
      '<ellipse cx="50" cy="86" rx="16" ry="6" fill="' + BR_MID + '"/>' +
      '<path d="M36.4 85 Q42 81.4 48 81" stroke="' + BR_SPEC + '" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M34 96 Q50 104 66 96" stroke="' + BR_DEEP + '" stroke-width="1.2" ' +
        'fill="none" opacity=".7"/>' +
      '<ellipse cx="70" cy="92" rx="6" ry="6.4" fill="url(#cl' + u + ')"/>' +
      '<path d="M64.4 90 Q66.6 86.4 70.6 86" stroke="' + BR_SPEC + '" stroke-width="1.3" ' +
        'fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M65 92 L75 92 M66 88.6 L74.4 95.4 M66 95.4 L74.4 88.6" stroke="' + BR_DEEP +
        '" stroke-width="0.9" opacity=".6"/>' +
      /* the flame, behind the glass */
      '<ellipse cx="50" cy="66" rx="18" ry="20" fill="url(#fl' + u + ')"/>' +
      '<path d="M50 52 Q56 62 53 72 Q50 78 47 72 Q44 62 50 52 Z" fill="#fff3d0" opacity=".9"/>' +
      /* chimney */
      '<path d="M32 84 C31 66 34 58 36 46 C37 36 36 28 34 20 L66 20 C64 28 63 36 64 46 ' +
        'C66 58 69 66 68 84 Q50 91 32 84 Z" fill="url(#ch' + u + ')"/>' +
      '<path d="M34 20 Q50 15 66 20 Q50 25 34 20 Z" fill="#e9f0e6" opacity=".45"/>' +
      '<path d="M34.6 20.6 Q50 16.4 65.4 20.6" stroke="#ffffff" stroke-width="1.5" ' +
        'fill="none" opacity=".8"/>' +
      '<path d="M37 22.6 C35.4 32 36.4 40 38.6 48 C40.6 60 37.6 70 37.2 82" ' +
        'stroke="#ffffff" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".72"/>' +
      '<path d="M42 24 C40.8 33 41.8 41 43.4 48" stroke="#ffffff" stroke-width="1" ' +
        'fill="none" stroke-linecap="round" opacity=".38"/>' +
      '<path d="M63.4 23 C64.6 33 63.6 41 62 48 C60 60 63.4 70 63.6 82" ' +
        'stroke="#dfe7dc" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".5"/>' +
      '<path d="M34 84 Q50 90 68 84" stroke="#ffffff" stroke-width="1.3" fill="none" ' +
        'opacity=".45"/>';
    return svg(w, 100, 170, d, b);
  }

  /* ====================================================================== *
   *  STAMP RACK — shallow turned-wood rack; the stamps stand in it
   * ====================================================================== */
  function stampRack(o) {
    var u = uid(), w = num(o && o.w, 120), i, x, holes = "", hx = [18, 38.5, 59, 79.5];
    var d =
      blot("sh" + u, 0.5) +
      lg("tp" + u, 6, 14, 96, 40, [
        [0, "#b98a52"], [0.28, WD_HI], [0.6, "#8a6038"], [0.86, WD], [1, "#5a3d26"]
      ]) +
      woodBar("fr" + u, 0, 34, 0, 58) +
      lg("ho" + u, 0, 20, 0, 32, [[0, WD_DEEP], [0.55, "#170f07"], [1, "#5c4025"]]);

    for (i = 0; i < hx.length; i++) {
      x = hx[i];
      holes +=
        '<ellipse cx="' + x + '" cy="26" rx="8" ry="4.2" fill="url(#ho' + u + ')"/>' +
        '<path d="M' + (x - 8) + ' 26 Q' + x + ' 21.4 ' + (x + 8) + ' 26" stroke="#150e06" ' +
          'stroke-width="1.5" fill="none" opacity=".85"/>' +
        '<path d="M' + (x - 6.4) + ' 27.8 Q' + x + ' 31 ' + (x + 6.4) + ' 27.8" ' +
          'stroke="#8a6038" stroke-width="1.2" fill="none" opacity=".55"/>';
    }

    var b =
      '<ellipse cx="54" cy="50" rx="48" ry="7.5" fill="url(#sh' + u + ')"/>' +
      /* front face of the plinth */
      '<path d="M6 24 L6 36 Q50 47 94 36 L94 24 Z" fill="url(#fr' + u + ')"/>' +
      /* top face */
      '<path d="M6 24 Q50 12 94 24 Q50 36 6 24 Z" fill="url(#tp' + u + ')"/>' +
      holes +
      /* mouldings on the front */
      '<path d="M6 24 Q50 36 94 24" stroke="#c99a63" stroke-width="1.1" fill="none" ' +
        'opacity=".55"/>' +
      '<path d="M6 28.6 Q50 40.6 94 28.6" stroke="' + WD_DEEP + '" stroke-width="1.6" ' +
        'fill="none" opacity=".55"/>' +
      '<path d="M6 32 Q50 44 94 32" stroke="#8f6740" stroke-width="0.9" fill="none" ' +
        'opacity=".4"/>' +
      '<path d="M8 36 Q50 47 92 36" stroke="' + WD_DEEP + '" stroke-width="1.8" ' +
        'fill="none" opacity=".6"/>' +
      /* the lit left end, the dark right end */
      '<path d="M6.6 24.4 Q26 18.4 46 16" stroke="#d6a468" stroke-width="1.6" ' +
        'fill="none" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M6 24 L6 35.4" stroke="#c99a63" stroke-width="1.6" fill="none" opacity=".55"/>' +
      '<path d="M94 24 L94 35.6" stroke="#1e1409" stroke-width="1.8" fill="none" opacity=".7"/>' +
      '<path d="M70 19.6 Q84 21.4 93.4 24" stroke="#2a1c0f" stroke-width="1.2" ' +
        'fill="none" opacity=".45"/>' +
      /* turned feet */
      '<ellipse cx="14" cy="40" rx="6.5" ry="4" fill="' + WD_SH + '"/>' +
      '<ellipse cx="86" cy="40" rx="6.5" ry="4" fill="#2c1d10"/>';
    return svg(w, 100, 56, d, b);
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
    var band = 62, fs = Math.min(11.5, Math.max(6.2, band / (n * 0.62)));
    var ls = fs > 9 ? 1.5 : fs > 7.5 ? 1.1 : 0.7;
    var est = n * (fs * 0.66 + ls);
    var fit = est > band ? ' textLength="' + band + '" lengthAdjust="spacingAndGlyphs"' : "";

    var d =
      blot("sh" + u, 0.55) +
      rg("kb" + u, 42, 12, 22, [
        [0, "#c08d54"], [0.2, WD_HI], [0.55, WD], [0.85, WD_SH], [1, "#4c3320"]
      ], 38, 8) +
      lg("br" + u, 8, 34, 92, 86, [
        [0, "#b8874f"], [0.1, WD_HI], [0.3, "#8a6038"], [0.55, WD],
        [0.8, WD_SH], [0.94, "#2b1c0f"], [1, "#6a4a2e"]
      ]) +
      lg("bt" + u, 20, 26, 80, 44, [[0, "#c69465"], [0.45, WD_HI], [1, "#6f4e30"]]) +
      lg("pb" + u, 12, 44, 92, 74, [
        [0, "#fffaef"], [0.12, PAPER], [0.55, "#e4d9bd"], [0.84, PAPER_S], [1, "#efe4c6"]
      ]) +
      lg("ds" + u, 8, 84, 92, 106, [
        [0, "#a2764a"], [0.35, "#7d5733"], [0.7, "#4e3620"], [1, "#7a5636"]
      ]) +
      lg("rb" + u, 10, 100, 90, 118, [
        [0, "#585048"], [0.22, "#3d372f"], [0.6, "#241f19"], [0.88, "#14100c"], [1, "#3a332b"]
      ]);

    var b =
      '<ellipse cx="54" cy="116" rx="47" ry="8" fill="url(#sh' + u + ')"/>' +
      '<g transform="rotate(-4 50 70)">' +
        /* knob */
        '<ellipse cx="50" cy="14" rx="16" ry="12.5" fill="url(#kb' + u + ')"/>' +
        '<path d="M39 9.6 Q43.4 3.6 52 3.6" stroke="#e0b078" stroke-width="2.4" ' +
          'fill="none" stroke-linecap="round" opacity=".85"/>' +
        '<path d="M60.4 8 Q65.6 13.6 62.4 20.4" stroke="#2b1c0f" stroke-width="2" ' +
          'fill="none" stroke-linecap="round" opacity=".65"/>' +
        /* neck */
        '<path d="M40 20 Q50 30 60 20 L64 34 Q50 42 36 34 Z" fill="url(#br' + u + ')"/>' +
        '<path d="M41 23.6 L38.6 33" stroke="#c08d54" stroke-width="1.8" fill="none" ' +
          'opacity=".7"/>' +
        /* barrel */
        '<path d="M12 40 Q50 28 88 40 L90 82 Q50 94 10 82 Z" fill="url(#br' + u + ')"/>' +
        '<path d="M12 40 Q50 52 88 40 Q50 28 12 40 Z" fill="url(#bt' + u + ')" opacity=".9"/>' +
        '<path d="M14.6 41.6 L12.8 80" stroke="#d2a068" stroke-width="2.6" fill="none" ' +
          'stroke-linecap="round" opacity=".65"/>' +
        '<path d="M85.6 42 L87.6 80" stroke="#1e1409" stroke-width="2.6" fill="none" ' +
          'stroke-linecap="round" opacity=".6"/>' +
        /* paper band, wrapped round the barrel */
        '<path d="M12.6 46 Q50 58 87.4 46 L88.6 72 Q50 84 11.4 72 Z" fill="url(#pb' + u + ')"/>' +
        '<path d="M12.6 46 Q50 58 87.4 46" stroke="#b8a880" stroke-width="0.9" ' +
          'fill="none" opacity=".8"/>' +
        '<path d="M11.4 72 Q50 84 88.6 72" stroke="#9d8e68" stroke-width="1.1" ' +
          'fill="none" opacity=".8"/>' +
        '<path d="M12.1 49.4 Q50 61.4 87.9 49.4" stroke="' + col + '" stroke-width="1.2" ' +
          'fill="none" opacity=".85"/>' +
        '<path d="M11.7 68.6 Q50 80.6 88.3 68.6" stroke="' + col + '" stroke-width="1.2" ' +
          'fill="none" opacity=".85"/>' +
        /* the curl of the cylinder read on the band */
        '<path d="M12.6 46 Q50 58 87.4 46 L88.6 72 Q50 84 11.4 72 Z" fill="none"/>' +
        '<path d="M14 46.4 Q17 59.6 12.6 71.6" stroke="#ffffff" stroke-width="2.6" ' +
          'fill="none" opacity=".45"/>' +
        '<path d="M85.6 46.6 Q82.6 60 87 71.8" stroke="#7d7053" stroke-width="3" ' +
          'fill="none" opacity=".35"/>' +
        '<text x="50" y="66" text-anchor="middle" font-family="' + SERIF + '" ' +
          'font-size="' + fs.toFixed(2) + '" letter-spacing="' + ls + '" ' +
          'font-weight="700" fill="' + INK + '"' + fit + '>' + esc(label) + '</text>' +
        /* base disc */
        '<path d="M4 84 Q50 96 96 84 L96 96 Q50 108 4 96 Z" fill="url(#ds' + u + ')"/>' +
        '<path d="M4 84 Q50 74 96 84 Q50 96 4 84 Z" fill="#8a6038" opacity=".85"/>' +
        '<path d="M6.6 83.4 Q26 76.4 48 75.4" stroke="#d2a068" stroke-width="1.8" ' +
          'fill="none" stroke-linecap="round" opacity=".8"/>' +
        '<path d="M4 96 Q50 108 96 96" stroke="#241708" stroke-width="1.4" fill="none" ' +
          'opacity=".7"/>' +
        /* mount board, then the rubber die */
        '<path d="M6 95 Q50 106 94 95 L94 100 Q50 111 6 100 Z" fill="#c9b78e"/>' +
        '<path d="M8 100 Q50 111 92 100 L90 112 Q50 122 10 112 Z" fill="url(#rb' + u + ')"/>' +
        '<path d="M9.6 101.6 Q13 106 11.6 111.4" stroke="#6a6158" stroke-width="1.6" ' +
          'fill="none" opacity=".7"/>' +
        '<path d="M10 112 Q50 122 90 112" stroke="' + col + '" stroke-width="1.8" ' +
          'fill="none" opacity=".75"/>' +
      '</g>';
    return svg(w, 100, 126, d, b);
  }

  /* ====================================================================== *
   *  WIRE TRAY — brass letter tray with a few papers in it
   * ====================================================================== */
  function wiretray(o) {
    var u = uid(), w = num(o && o.w, 120), i, wires = "";
    var d =
      blot("sh" + u, 0.45) +
      lg("wr" + u, 4, 14, 96, 56, [
        [0, BR_SPEC], [0.16, BR_HI], [0.4, BR_MID], [0.66, BR], [0.88, BR_SH], [1, BR_HI]
      ]) +
      lg("pa" + u, 10, 22, 90, 46, [
        [0, "#fff8e6"], [0.35, PAPER], [0.75, "#ddd0ac"], [1, "#bfb08a"]
      ]) +
      lg("pb" + u, 10, 20, 90, 42, [[0, "#f7eed6"], [0.6, "#e3d7b6"], [1, "#c6b791"]]);

    /* the cross wires of the floor, running away to the upper right */
    for (i = 0; i < 7; i++) {
      var t = i / 6;
      var x0 = 14 + t * 56, x1 = 30 + t * 56;
      wires += '<path d="M' + x0.toFixed(1) + ' 47 L' + x1.toFixed(1) + ' 33" ' +
               'stroke="' + BR_SH + '" stroke-width="1.5" stroke-linecap="round" opacity=".85"/>' +
               '<path d="M' + (x0 - 0.5).toFixed(1) + ' 46.4 L' + (x1 - 0.5).toFixed(1) +
               ' 32.6" stroke="' + BR_HI + '" stroke-width="0.7" stroke-linecap="round" ' +
               'opacity=".6"/>';
    }

    var b =
      '<ellipse cx="54" cy="53" rx="48" ry="7" fill="url(#sh' + u + ')"/>' +
      /* back rail */
      '<path d="M28 30 L88 30" stroke="' + BR_SH + '" stroke-width="2.6" ' +
        'stroke-linecap="round"/>' +
      /* floor wires */
      wires +
      /* the papers sitting in it */
      '<path d="M22 42 L36 27 L84 27 L70 42 Z" fill="url(#pb' + u + ')"/>' +
      '<path d="M20 44 L34.4 28.6 L82 28.6 L68 44 Z" fill="url(#pa' + u + ')"/>' +
      '<path d="M20 44 L34.4 28.6" stroke="#ffffff" stroke-width="1.2" fill="none" ' +
        'opacity=".7"/>' +
      '<path d="M27 39.4 L52 32.6 M30 42 L58 34" stroke="' + INK + '" stroke-width="0.8" ' +
        'opacity=".3"/>' +
      '<path d="M20 44 L68 44" stroke="#a8987400" stroke-width="1"/>' +
      '<path d="M21 45.4 L69 45.4 L82.4 30" stroke="#b1a07a" stroke-width="1.4" ' +
        'fill="none" opacity=".8"/>' +
      /* corner posts */
      '<path d="M12 48 L12 40" stroke="' + BR_SH + '" stroke-width="2.4" ' +
        'stroke-linecap="round"/>' +
      '<path d="M86 46 L86 30" stroke="' + BR_SH + '" stroke-width="2.4" ' +
        'stroke-linecap="round"/>' +
      '<path d="M28 34 L28 26" stroke="' + BR_SH + '" stroke-width="2.2" ' +
        'stroke-linecap="round"/>' +
      /* rim: front lower left, back upper right — one continuous wire */
      '<path d="M12 48 L70 48 L88 30 L28 30 Z" fill="none" stroke="url(#wr' + u + ')" ' +
        'stroke-width="3.4" stroke-linejoin="round"/>' +
      '<path d="M12.8 46.8 L69.6 46.8 L86.8 29.2" fill="none" stroke="' + BR_SPEC + '" ' +
        'stroke-width="1.2" stroke-linejoin="round" opacity=".85"/>' +
      '<path d="M13 49.2 L70 49.2" fill="none" stroke="' + BR_DEEP + '" stroke-width="1.1" ' +
        'opacity=".7"/>' +
      /* feet */
      '<ellipse cx="12" cy="49" rx="3.6" ry="1.8" fill="' + BR_SH + '"/>' +
      '<ellipse cx="70" cy="49" rx="3.6" ry="1.8" fill="' + BR_DEEP + '"/>';
    return svg(w, 100, 58, d, b);
  }

  /* ====================================================================== *
   *  TUMBLER — cut-glass tumbler, half full
   * ====================================================================== */
  function tumbler(o) {
    var u = uid(), w = num(o && o.w, 60);
    var d =
      blot("sh" + u, 0.32) +
      lg("gl" + u, 20, 14, 82, 112, [
        ["0", "#ffffff", "0.34"], ["0.18", "#e8eee6", "0.16"],
        ["0.46", "#aab6a9", "0.13"], ["0.74", "#6f7c70", "0.2"], ["1", "#e4ebe1", "0.34"]
      ]) +
      lg("wa" + u, 22, 58, 80, 112, [
        ["0", "#e8f0ea", "0.5"], ["0.2", "#b9cbc0", "0.42"],
        ["0.6", "#8fa599", "0.44"], ["1", "#c9dbcf", "0.55"]
      ]) +
      rg("ca" + u, 46, 114, 34, [
        ["0", "#f6ecc8", "0.42"], ["0.55", "#d8c48c", "0.16"], ["1", "#c8b47c", "0"]
      ]);

    var b =
      '<ellipse cx="54" cy="114" rx="38" ry="7" fill="url(#sh' + u + ')"/>' +
      '<ellipse cx="44" cy="113" rx="27" ry="5.5" fill="url(#ca' + u + ')"/>' +
      /* body */
      '<path d="M26 20 Q50 28 74 20 L78 104 Q50 114 22 104 Z" fill="url(#gl' + u + ')"/>' +
      /* the water */
      '<path d="M24.6 58 Q50 68 75.4 58 L78 104 Q50 114 22 104 Z" fill="url(#wa' + u + ')"/>' +
      '<path d="M24.6 58 Q50 50 75.4 58 Q50 68 24.6 58 Z" fill="#dfeae1" opacity=".55"/>' +
      '<path d="M27 57 Q40 52.6 54 52.8" stroke="#ffffff" stroke-width="1.6" fill="none" ' +
        'stroke-linecap="round" opacity=".85"/>' +
      /* the cut flutes at the foot */
      '<path d="M26 92 Q50 102 74 92" stroke="#ffffff" stroke-width="1.1" fill="none" ' +
        'opacity=".35"/>' +
      '<path d="M33 94 L33 104 M43 96.4 L43 107 M57 96.4 L57 107 M67 94 L67 104" ' +
        'stroke="#ffffff" stroke-width="1" opacity=".28"/>' +
      /* specular: broad on the left, a thin band of reflected light right */
      '<path d="M31.4 26 L28.4 100" stroke="#ffffff" stroke-width="4.2" fill="none" ' +
        'stroke-linecap="round" opacity=".62"/>' +
      '<path d="M38 30 L36.4 92" stroke="#ffffff" stroke-width="1.4" fill="none" ' +
        'stroke-linecap="round" opacity=".3"/>' +
      '<path d="M69.6 28 L72.6 96" stroke="#ffffff" stroke-width="2.2" fill="none" ' +
        'stroke-linecap="round" opacity=".38"/>' +
      /* base and rim */
      '<path d="M22 104 Q50 114 78 104" stroke="#ffffff" stroke-width="2" fill="none" ' +
        'stroke-linecap="round" opacity=".55"/>' +
      '<path d="M24 101 Q50 110 76 101" stroke="#5c6a5f" stroke-width="1.2" fill="none" ' +
        'opacity=".3"/>' +
      '<path d="M26 20 Q50 12 74 20 Q50 28 26 20 Z" fill="#eef4ec" opacity=".4"/>' +
      '<path d="M26 20 Q50 12 74 20" stroke="#ffffff" stroke-width="2" fill="none" ' +
        'stroke-linecap="round" opacity=".9"/>' +
      '<path d="M26.6 21 Q50 28.6 73.4 21" stroke="#ffffff" stroke-width="1.4" fill="none" ' +
        'stroke-linecap="round" opacity=".55"/>';
    return svg(w, 100, 122, d, b);
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
