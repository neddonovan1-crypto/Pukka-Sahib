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

function build() {
  var shell = read(path.join(SRC, "shell.html"));
  var contentRaw = read(path.join(SRC, "content.json"));
  var content = JSON.stringify(JSON.parse(contentRaw)); // minify + validate JSON
  var logic = stripJs(read(path.join(SRC, "logic.js")));
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
  var embeddedArt = {}, artKb = 0;
  artNames().forEach(function (f) {
    var buf = fs.readFileSync(path.join(artWeb, f));
    embeddedArt[artKey(f)] = "data:" + artMime(f) + ";base64," + buf.toString("base64");
    artKb += buf.length / 1024;
  });
  var artBlockSingle = "<script>window.PUKKA_ART=" + JSON.stringify(embeddedArt) + ";</script>";

  var dataBlock = '<script type="application/json" id="game-data">' + content + "</script>";
  var codeBlock = "<script>\n" + logic + "\n" + ui + "\n</script>";
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
  fs.mkdirSync(assets, { recursive: true });
  // Pages references art as external files (no weight limit); copy the web JPEGs.
  var distArt = {};
  artNames().forEach(function (f) {
    fs.copyFileSync(path.join(artWeb, f), path.join(assets, f));
    distArt[artKey(f)] = "assets/" + f;
  });
  var artBlockDist = "<script>window.PUKKA_ART=" + JSON.stringify(distArt) + ";</script>";
  var distHtml = shell.replace("<!--GAME_SCRIPTS-->",
    dataBlock + "\n" + artBlockDist + '\n<script src="logic.js"></script>\n<script src="ui.js"></script>');
  fs.writeFileSync(path.join(dist, "index.html"), distHtml);
  fs.writeFileSync(path.join(dist, "logic.js"), logic);
  fs.writeFileSync(path.join(dist, "ui.js"), ui);
  var copied = artNames().length;

  console.log("Built index.html:", (out.length / 1024).toFixed(0) + " KB (single-file / Artifact)");
  console.log("  logic:", logic.length, "b · ui:", ui.length, "b · content:", content.length, "b · art embedded:", artKb.toFixed(0) + " KB (" + Object.keys(embeddedArt).length + ")");
  console.log("Built dist/ for Pages:", "index.html + logic.js + ui.js" + (copied ? " + " + copied + " asset(s)" : ""));
  return out;
}

build();
