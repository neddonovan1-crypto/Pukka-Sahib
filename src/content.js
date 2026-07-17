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
  .concat(load("events-kipling.json"))
  .concat(load("events-kipling-2.json"))
  .concat(load("interludes.json"));

module.exports = { config: base.config, endings: base.endings, events: events };
