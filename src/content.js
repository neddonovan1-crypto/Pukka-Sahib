/* Content loader/merger. Content is authored across several themed files under
   src/content/ (smaller diffs, easier review); this module merges them into the
   one shape the engine expects: { config, endings, events }. build.js, the
   validator, and the simulator all load content through here, and the build
   inlines the merged JSON into the shipped page. Event order is deterministic
   (the concat order below), which keeps the seeded simulation stable. */
"use strict";
var fs = require("fs");
var path = require("path");
var DIR = path.join(__dirname, "content");

function load(name) { return JSON.parse(fs.readFileSync(path.join(DIR, name), "utf8")); }

var base = load("config.json"); // { config, endings }
var events = []
  .concat(load("events-district.json"))
  .concat(load("events-personal.json"))
  .concat(load("events-personal-arc.json"))
  .concat(load("events-kipling.json"))
  .concat(load("events-kipling-2.json"))
  .concat(load("events-monsoon.json"))
  .concat(load("warnings.json"))
  .concat(load("interludes.json"));

// Occasions: the fixed calendar of the year — set-piece fortnights keyed to a
// specific turn, outside the drawn deck (see docs/event-schema.md).
var occasions = load("occasions.json");
// Codas: arc-conditional sentences appended to the year-end verdict.
var codas = load("codas.json");

module.exports = { config: base.config, endings: base.endings, events: events, occasions: occasions, codas: codas };
