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
    .concat(load("events-district-2.json"))
    .concat(load("events-personal.json"))
    .concat(load("events-personal-arc.json"))
    .concat(load("events-kipling.json"))
    .concat(load("events-kipling-2.json"))
    .concat(load("events-monsoon.json"))
    .concat(load("events-kotra-echoes.json"))
    .concat(load("warnings.json"))
    .concat(load("interludes.json")),
  occasions: load("occasions.json"),
  codas: load("codas.json")
};

/* ---- Chapter I: Assistant Commissioner, Kotra sub-division ---- */
var acBase = load("ac/config.json"); // { config, endings }
var ac = {
  key: "ac",
  config: acBase.config,
  endings: acBase.endings,
  events: []
    .concat(load("ac/events-apprentice.json"))
    .concat(load("ac/events-apprentice-2.json"))
    .concat(load("ac/events-personal.json"))
    .concat(load("ac/warnings.json")),
  occasions: load("ac/occasions.json"),
  codas: load("ac/codas.json")
};

/* ---- Chapter III: Commissioner, the Sonepore Division ---- */
var commBase = load("comm/config.json"); // { config, endings }
var comm = {
  key: "comm",
  config: commBase.config,
  endings: commBase.endings,
  events: []
    .concat(load("comm/events-division.json"))
    .concat(load("comm/events-division-2.json"))
    .concat(load("comm/events-carried.json"))
    .concat(load("comm/warnings.json")),
  occasions: load("comm/occasions.json"),
  codas: load("comm/codas.json")
};

// The career ladder, in playing order: the probation, the district, the
// Division. Chapter IV (the province) joins when written; `planned` lets the
// start screen show the whole ladder before it exists.
module.exports = {
  chapters: { ac: ac, dm: dm, comm: comm },
  order: ["ac", "dm", "comm"],
  planned: [
    { rank: "Lieutenant-Governor", plays: "the Grand Commanders" }
  ]
};
