/* Build: assemble the shipped single-file index.html from src/.
   Sources stay separated (headless logic, schema'd content, presentation) and
   commented; the shipped bundle inlines them (CSP-safe, no external fetch) with
   comments stripped. Also emits the wrapper-free copy used to publish the
   Artifact. Run: node build.js */
"use strict";
var fs = require("fs");
var path = require("path");
var ROOT = __dirname;
var SRC = path.join(ROOT, "src");

function read(p) { return fs.readFileSync(p, "utf8"); }

// Conservative JS comment stripper: block comments and whole-line // comments
// only, so no regex/string in the sources can be corrupted. (Sources here
// contain no `/*` inside strings and no full-line-leading `//` inside code.)
function stripJs(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// CSS block comments in the shell's <style> are authoring notes; strip them
// from shipped output the same way JS comments are.
function stripCss(html) {
  return html.replace(/<style>[\s\S]*?<\/style>/, function (block) {
    return block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n{3,}/g, "\n\n");
  });
}

function build() {
  var shell = stripCss(read(path.join(SRC, "shell.html")));
  // Content is authored across themed files under src/content/ and merged here.
  delete require.cache[require.resolve("./src/content.js")];
  var content = JSON.stringify(require("./src/content.js"));
  var logic = stripJs(read(path.join(SRC, "logic.js")));
  var audio = stripJs(read(path.join(SRC, "audio.js")));
  var ui = stripJs(read(path.join(SRC, "ui.js")));

  // Web-ready art (art/web/*.jpg, produced by scripts/optimize-art.js). The UI
  // reads window.PUKKA_ART[name]; single-file gets data URIs, Pages gets paths,
  // so the same UI code works for both and art stays optional (absent → no art).
  var artWeb = path.join(ROOT, "art", "web");
  function artNames() {
    return fs.existsSync(artWeb) ? fs.readdirSync(artWeb).filter(function (f) { return /\.(jpe?g|png)$/i.test(f); }) : [];
  }
  function artKey(f) { return f.replace(/\.(jpe?g|png)$/i, ""); }
  function artMime(f) { return /\.png$/i.test(f) ? "image/png" : "image/jpeg"; }
  // The single-file build embeds art as base64 data URIs, so it carries a
  // page-weight budget; the dist/ build (what adventuresahib.com serves) uses
  // external files with no such limit. So the single-file embeds only the
  // essential chrome — cover, seal, season banners, medals — and leaves the
  // heavier station scenes (and any event art we add) to dist. That keeps the
  // portable build light while the live site can carry as much imagery as it
  // likes; a missing scene key just falls back to the season banner.
  function isEssentialArt(key) {
    return key === "cover" || key === "seal" || key.indexOf("season-") === 0 || key.indexOf("medal-") === 0;
  }
  var embeddedArt = {}, artKb = 0, artExternalOnly = 0;
  artNames().forEach(function (f) {
    var key = artKey(f);
    if (!isEssentialArt(key)) { artExternalOnly++; return; } // dist-only, not embedded
    var buf = fs.readFileSync(path.join(artWeb, f));
    embeddedArt[key] = "data:" + artMime(f) + ";base64," + buf.toString("base64");
    artKb += buf.length / 1024;
  });
  var artBlockSingle = "<script>window.PUKKA_ART=" + JSON.stringify(embeddedArt) + ";</script>";

  // Freely-licensed ambience recordings (audio/ambience-<season>.mp3|ogg|m4a,
  // or ambience.* for all seasons). Hosted deploys get them as lazy-loaded
  // loops via window.PUKKA_AUDIO_SAMPLES; the single-file build stays on the
  // synthesised ambience (zero page weight), which is also the runtime
  // fallback while a recording loads or if it fails. Licences/attribution for
  // anything in audio/ belong in audio/CREDITS.md.
  var audioDir = path.join(ROOT, "audio");
  function audioNames() {
    return fs.existsSync(audioDir) ? fs.readdirSync(audioDir).filter(function (f) { return /^ambience(-\w+)?\.(mp3|ogg|m4a)$/i.test(f); }) : [];
  }
  function audioKey(f) { var m = /^ambience-(\w+)\./i.exec(f); return m ? m[1].toLowerCase() : "all"; }

  var dataBlock = '<script type="application/json" id="game-data">' + content + "</script>";
  var codeBlock = "<script>\n" + logic + "\n" + audio + "\n" + ui + "\n</script>";
  var scripts = dataBlock + "\n" + artBlockSingle + "\n" + codeBlock;

  if (shell.indexOf("<!--GAME_SCRIPTS-->") === -1) throw new Error("shell.html missing <!--GAME_SCRIPTS--> marker");
  var out = shell.replace("<!--GAME_SCRIPTS-->", scripts);

  fs.writeFileSync(path.join(ROOT, "index.html"), out);

  // wrapper-free copy for the Artifact publisher (style + body, no doc shell)
  var style = out.match(/<style>[\s\S]*<\/style>/)[0];
  var body = out.match(/<body>([\s\S]*)<\/body>/)[1].trim();
  var artifactDir = process.env.PUKKA_ARTIFACT_DIR;
  if (artifactDir) fs.writeFileSync(path.join(artifactDir, "pukka-sahib.html"), style + "\n" + body + "\n");

  // Multi-file dist for GitHub Pages (external fetch allowed there, unlike the
  // Artifact). Code split from markup so a content change doesn't bust the code
  // bundle; art lives as real files under assets/ rather than data URIs.
  var dist = path.join(ROOT, "dist");
  var assets = path.join(dist, "assets");
  fs.rmSync(dist, { recursive: true, force: true }); // clean build — no stale/renamed assets linger
  fs.mkdirSync(assets, { recursive: true });
  // Pages references art as external files (no weight limit); copy the web JPEGs.
  var distArt = {};
  artNames().forEach(function (f) {
    fs.copyFileSync(path.join(artWeb, f), path.join(assets, f));
    distArt[artKey(f)] = "assets/" + f;
  });
  var artBlockDist = "<script>window.PUKKA_ART=" + JSON.stringify(distArt) + ";</script>";
  var distAudio = {};
  audioNames().forEach(function (f) {
    fs.copyFileSync(path.join(audioDir, f), path.join(assets, f));
    distAudio[audioKey(f)] = "assets/" + f;
  });
  var audioBlockDist = Object.keys(distAudio).length
    ? "<script>window.PUKKA_AUDIO_SAMPLES=" + JSON.stringify(distAudio) + ";</script>" : "";
  var distHtml = shell.replace("<!--GAME_SCRIPTS-->",
    dataBlock + "\n" + artBlockDist + (audioBlockDist ? "\n" + audioBlockDist : "") +
    '\n<script src="logic.js"></script>\n<script src="audio.js"></script>\n<script src="ui.js"></script>');
  fs.writeFileSync(path.join(dist, "index.html"), distHtml);
  fs.writeFileSync(path.join(dist, "logic.js"), logic);
  fs.writeFileSync(path.join(dist, "audio.js"), audio);
  fs.writeFileSync(path.join(dist, "ui.js"), ui);
  var copied = artNames().length;

  console.log("Built index.html:", (out.length / 1024).toFixed(0) + " KB (single-file / Artifact)");
  console.log("  logic:", logic.length, "b · ui:", ui.length, "b · content:", content.length, "b · art embedded:", artKb.toFixed(0) + " KB (" + Object.keys(embeddedArt).length + " essential; " + artExternalOnly + " scene/other art external in dist/ only)");
  console.log("Built dist/ for Pages:", "index.html + logic.js + audio.js + ui.js" + (copied ? " + " + copied + " asset(s)" : "") +
    (Object.keys(distAudio).length ? " + ambience recordings (" + Object.keys(distAudio).join(", ") + ")" : " (ambience: synthesised — no audio/ recordings)"));

  // Page-weight budget: the single-file build is what loads in one go, so
  // growth is a decision, not a drift. Raise these only deliberately (and
  // re-optimize first — scripts/optimize-art.js). Since the station scenes and
  // event art now live in dist/ only, the single-file's art is capped at the
  // essential chrome and the budgets tightened to guard content drift: page
  // 3400 → 2600 KB, embedded art 2100 → 1400 KB (was 3330/1875 before the split).
  var ART_BUDGET_KB = 1400, PAGE_BUDGET_KB = 2600;
  if (artKb > ART_BUDGET_KB) throw new Error("art budget blown: " + artKb.toFixed(0) + " KB embedded > " + ART_BUDGET_KB + " KB");
  if (out.length / 1024 > PAGE_BUDGET_KB) throw new Error("page budget blown: " + (out.length / 1024).toFixed(0) + " KB > " + PAGE_BUDGET_KB + " KB");
  return out;
}

build();
