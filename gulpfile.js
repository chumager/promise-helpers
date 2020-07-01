"use strict";
const {obfuscate: needObfuscate} = require("./package.json");
console.log("needObfuscate", needObfuscate);
const {src, dest, parallel, watch: w} = require("gulp");
const terser = require("gulp-terser");
const gif = require("gulp-if");
const gobf = require("gulp-javascript-obfuscator");
const debug = require("gulp-debug");
const path = ["src/**/*.js"];
function js() {
  return src(path, {base: "src"})
    .pipe(debug())
    .pipe(terser())
    .pipe(gif(needObfuscate, gobf({compact: true})))
    .pipe(dest("dist/"));
}
function obfuscate(path) {
  return src(path, {base: "src"})
    .pipe(debug({title: "Minimizando"}))
    .pipe(terser())
    .pipe(gif(needObfuscate, debug({title: "Ofuscando"})))
    .pipe(gif(needObfuscate, gobf({compact: true})))
    .pipe(dest("dist/"));
}
function watch() {
  const watcher = w(path);
  watcher.on("change", obfuscate);
  watcher.on("add", obfuscate);
  return watcher;
}
exports.watch = watch;
exports.js = js;
exports.default = parallel(js, watch);
