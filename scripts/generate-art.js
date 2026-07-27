/* Generate art from the briefs in art/briefs/.
   Build-time and hand-invoked — the shipped game never calls this, carries no
   key, and works offline. See docs/DESIGN-ART.md for what each register is and
   why; the briefs carry the style clauses derived from it.

   Runs in CI only, where the key lives as a repository secret. The key is read
   from process.env once, sent in a header, and never logged, written, or
   committed.

   Usage:  GEMINI_API_KEY=... node scripts/generate-art.js [briefId,briefId]
   Env:    BRIEFS  comma-separated brief ids (blank = all)
           DRY_RUN=1  list models and resolve briefs without generating   */
"use strict";
var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var BRIEF_DIR = path.join(ROOT, "art", "briefs");
var OUT_DIR = path.join(ROOT, "art", "gen");
var CREDITS = path.join(ROOT, "art", "CREDITS.md");
var API = "https://generativelanguage.googleapis.com/v1beta";

// A hard brake. A bug in a loop costs money, and a billing alert is a slower
// alarm than a throw. Raise deliberately, never "just for this run".
var MAX_IMAGES_PER_RUN = 12;

var KEY = process.env.GEMINI_API_KEY || "";
if (!KEY) { console.error("GEMINI_API_KEY is not set"); process.exit(1); }
console.log("key present: yes · length:", KEY.length);   // never the value

function req(url, init) {
  init = init || {};
  init.headers = Object.assign({ "x-goog-api-key": KEY }, init.headers || {});
  return fetch(url, init);
}

/* ——— which image models can this project actually reach? ——————————————
   Asking beats assuming: model names and generation methods move, and the
   answer is different per project and per billing tier. */
async function listImageModels() {
  var res = await req(API + "/models?pageSize=200");
  if (!res.ok) throw new Error("models.list failed: " + res.status + " " + (await res.text()).slice(0, 400));
  var body = await res.json();
  var all = (body.models || []).map(function (m) {
    return { name: (m.name || "").replace(/^models\//, ""), methods: m.supportedGenerationMethods || [] };
  });
  var image = all.filter(function (m) {
    return /image|imagen/i.test(m.name) && !/embed|upscale|segment/i.test(m.name);
  });
  console.log("\nimage-capable models visible to this key:");
  if (!image.length) console.log("  (none — the project may need billing enabled for image models)");
  image.forEach(function (m) { console.log("  " + m.name + "  [" + m.methods.join(", ") + "]"); });
  return image;
}

// Two shapes are in play: Gemini's generateContent (inline image parts) and
// Imagen's predict (bytesBase64Encoded). Pick per model rather than hard-code.
function pickModel(models, prefer) {
  if (prefer) {
    var exact = models.filter(function (m) { return m.name === prefer; })[0];
    if (exact) return exact;
    console.log("preferred model '" + prefer + "' not available; falling back");
  }
  // Best first, and released before preview. Art is authored once and lives a
  // long time, so quality beats speed and cost here.
  var order = [
    /^gemini-[\d.]+-pro-image$/i, /^gemini-[\d.]+-flash-image$/i,
    /^imagen-[\d.]+-ultra-generate/i, /^imagen-[\d.]+-generate/i,
    /gemini.*image/i, /imagen/i
  ];
  for (var i = 0; i < order.length; i++) {
    var hit = models.filter(function (m) { return order[i].test(m.name); })[0];
    if (hit) return hit;
  }
  return models[0];
}

async function generate(model, prompt, aspect) {
  if (model.methods.indexOf("predict") !== -1) {
    var res = await req(API + "/models/" + model.name + ":predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1, aspectRatio: aspect || "4:3" }
      })
    });
    if (!res.ok) throw new Error("predict " + res.status + ": " + (await res.text()).slice(0, 500));
    var j = await res.json();
    var b64 = j.predictions && j.predictions[0] && (j.predictions[0].bytesBase64Encoded || j.predictions[0].image);
    if (!b64) throw new Error("predict returned no image: " + JSON.stringify(j).slice(0, 400));
    return Buffer.from(b64, "base64");
  }

  var res2 = await req(API + "/models/" + model.name + ":generateContent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
    })
  });
  if (!res2.ok) throw new Error("generateContent " + res2.status + ": " + (await res2.text()).slice(0, 500));
  var j2 = await res2.json();
  var parts = (((j2.candidates || [])[0] || {}).content || {}).parts || [];
  var img = parts.filter(function (p) { return p.inlineData && p.inlineData.data; })[0];
  if (!img) throw new Error("no inline image in response: " + JSON.stringify(j2).slice(0, 400));
  return Buffer.from(img.inlineData.data, "base64");
}

function loadBriefs() {
  if (!fs.existsSync(BRIEF_DIR)) throw new Error("no art/briefs/ directory");
  var wanted = (process.argv[2] || process.env.BRIEFS || "").split(",")
    .map(function (s) { return s.trim(); }).filter(Boolean);
  var briefs = fs.readdirSync(BRIEF_DIR)
    // files beginning with _ are shared definitions, not subjects
    .filter(function (f) { return /\.json$/.test(f) && f.charAt(0) !== "_"; })
    .map(function (f) {
      var b = JSON.parse(fs.readFileSync(path.join(BRIEF_DIR, f), "utf8"));
      b.id = b.id || f.replace(/\.json$/, "");
      return b;
    });
  return wanted.length ? briefs.filter(function (b) { return wanted.indexOf(b.id) !== -1; }) : briefs;
}

// The style clause lives on the register, the subject on the brief — so a
// register's look can be retuned in one place across every asset that uses it.
var REGISTERS = JSON.parse(fs.readFileSync(path.join(BRIEF_DIR, "_registers.json"), "utf8"));

function buildPrompt(brief) {
  var reg = REGISTERS[brief.register];
  if (!reg) throw new Error(brief.id + ": unknown register '" + brief.register + "'");
  return [reg.style, brief.subject, reg.constraints].join(" ").replace(/\s+/g, " ").trim();
}

(async function main() {
  var briefs = loadBriefs();
  if (!briefs.length) { console.error("no briefs matched"); process.exit(1); }
  if (briefs.length > MAX_IMAGES_PER_RUN) {
    throw new Error("run would generate " + briefs.length + " images, over the cap of " + MAX_IMAGES_PER_RUN);
  }
  console.log("briefs:", briefs.map(function (b) { return b.id; }).join(", "));

  var models = await listImageModels();
  if (!models.length) process.exit(2);
  var model = pickModel(models, process.env.MODEL);
  console.log("\nusing model:", model.name, "via", model.methods.indexOf("predict") !== -1 ? "predict" : "generateContent");

  if (process.env.DRY_RUN) {
    briefs.forEach(function (b) { console.log("\n--- " + b.id + " ---\n" + buildPrompt(b)); });
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  var log = [], failures = 0;
  for (var i = 0; i < briefs.length; i++) {
    var b = briefs[i], prompt = buildPrompt(b);
    process.stdout.write("\n[" + (i + 1) + "/" + briefs.length + "] " + b.id + " … ");
    try {
      var buf = await generate(model, prompt, b.aspect);
      var out = path.join(OUT_DIR, b.id + ".png");
      fs.writeFileSync(out, buf);
      console.log("ok (" + (buf.length / 1024).toFixed(0) + " KB)");
      log.push({ id: b.id, register: b.register, model: model.name, prompt: prompt });
    } catch (e) {
      failures++;
      console.log("FAILED — " + e.message);
    }
  }

  // Provenance, following the audio/CREDITS.md convention. Model and prompt,
  // never the key.
  if (log.length) {
    var stamp = process.env.RUN_STAMP || "";
    var lines = ["", "## Generated " + stamp, ""];
    log.forEach(function (e) {
      lines.push("- **" + e.id + "** · register: " + e.register + " · model: `" + e.model + "`");
      lines.push("  > " + e.prompt);
    });
    var head = fs.existsSync(CREDITS) ? fs.readFileSync(CREDITS, "utf8")
      : "# Art credits\n\nProvenance for everything in `art/`. Generated assets record model and prompt.\n";
    fs.writeFileSync(CREDITS, head + lines.join("\n") + "\n");
  }

  console.log("\n" + log.length + " generated, " + failures + " failed → art/gen/");
  if (!log.length) process.exit(3);
})().catch(function (e) { console.error("\nfatal:", e.message); process.exit(1); });
