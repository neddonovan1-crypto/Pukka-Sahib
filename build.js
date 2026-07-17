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

  var dataBlock = '<script type="application/json" id="game-data">' + content + "</script>";
  var codeBlock = "<script>\n" + logic + "\n" + ui + "\n</script>";
  var scripts = dataBlock + "\n" + codeBlock;

  if (shell.indexOf("<!--GAME_SCRIPTS-->") === -1) throw new Error("shell.html missing <!--GAME_SCRIPTS--> marker");
  var out = shell.replace("<!--GAME_SCRIPTS-->", scripts);

  fs.writeFileSync(path.join(ROOT, "index.html"), out);

  // wrapper-free copy for the Artifact publisher (style + body, no doc shell)
  var style = out.match(/<style>[\s\S]*<\/style>/)[0];
  var body = out.match(/<body>([\s\S]*)<\/body>/)[1].trim();
  var artifactDir = process.env.PUKKA_ARTIFACT_DIR;
  if (artifactDir) fs.writeFileSync(path.join(artifactDir, "pukka-sahib.html"), style + "\n" + body + "\n");

  console.log("Built index.html:", out.length, "bytes");
  console.log("  logic:", logic.length, "b · ui:", ui.length, "b · content:", content.length, "b");
  return out;
}

build();
