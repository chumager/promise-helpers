"use strict";
const {obfuscate: needObfuscate} = require("./package.json");
console.log("needObfuscate", needObfuscate);
const {src, dest, parallel, watch: w} = require("gulp");
const terser = require("gulp-terser");
const gif = require("gulp-if");
const rename = require("gulp-rename");
const del = require("del");
let gobf = v => v;
if (needObfuscate) gobf = require("gulp-javascript-obfuscator");
const debug = require("gulp-debug");
const babel = require("gulp-babel");
const path = ["src/**/*.js"];
del.sync("dist/*");
function js() {
  return src(path, {base: "src"})
    .pipe(debug())
    .pipe(babel())
    .pipe(dest("dist/"))
    .pipe(terser())
    .pipe(gif(needObfuscate, gobf({compact: true})))
    .pipe(rename({extname: ".min.js"}))
    .pipe(dest("dist/"));
}
function obfuscate(path) {
  return src(path, {base: "src"})
    .pipe(debug({title: "Minimizando"}))
    .pipe(babel())
    .pipe(dest("dist/"))
    .pipe(terser())
    .pipe(gif(needObfuscate, debug({title: "Ofuscando"})))
    .pipe(gif(needObfuscate, gobf({compact: true})))
    .pipe(rename({extname: ".min.js"}))
    .pipe(dest("dist/"));
}
function watch() {
  const watcher = w(path);
  watcher.on("change", obfuscate);
  watcher.on("add", obfuscate);
  watcher.on("unlink", filePath => {
    const filePathFromSrc = path.relative(path.resolve("src"), filePath);
    const destFilePath = path.resolve("dist", filePathFromSrc);
    console.log("Eliminando", destFilePath);
    del.sync(destFilePath);
  });
  return watcher;
}
exports.watch = watch;
exports.js = js;
exports.default = parallel(js, watch);
