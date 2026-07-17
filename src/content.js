/* Content loader/merger. A CHAPTER of the career is a self-contained content
   bundle — config (calendar, postures, occasions, economy, honours ladder,
   chapter meta), endings, events, codas — and createGame() takes any bundle,
   so the engine is chapter-agnostic. Chapters live under src/content/ (the
   District Magistrate year at the top level today; later ranks in their own
   directories). build.js, the validator, and the simulator all load the
   registry through here; event order within a chapter is deterministic (the
   concat order below), which keeps the seeded simulation stable. */
"use strict";
var fs = require("fs");
var path = require("path");
var DIR = path.join(__dirname, "content");

function load(name) { return JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8")); }

/* ---- Chapter II: District Magistrate & Collector, Chhota Nagra ---- */
var dmBase = load("config.json"); // { config, endings }
var dm = {
  key: "dm",
  config: dmBase.config,
  endings: dmBase.endings,
  events: []
    .concat(load("events-district.json"))
    .concat(load("events-personal.json"))
    .concat(load("events-personal-arc.json"))
    .concat(load("events-kipling.json"))
    .concat(load("events-kipling-2.json"))
    .concat(load("events-monsoon.json"))
    .concat(load("warnings.json"))
    .concat(load("interludes.json")),
  occasions: load("occasions.json"),
  codas: load("codas.json")
};

// The career ladder, in playing order. Chapter I (Assistant Commissioner)
// joins ahead of dm when its bundle lands; III and IV after.
module.exports = { chapters: { dm: dm }, order: ["dm"] };
