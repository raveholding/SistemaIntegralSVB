// Ensambla ../index.html desde src/ y transpila cada <script> a ES2017
// (compatible con iPhone iOS 11+ y Android Chrome 61+).  Uso: cd html5 && npm install && npm run build
const fs = require("fs"), path = require("path"), esbuild = require("esbuild");
const src = (f) => fs.readFileSync(path.join(__dirname, "src", f), "utf8");
const head = src("01_head.html").replace("<!--GUARD-->", src("00_guard.html"));
const parts = ["02_core.js", "03_seed.js", "04_logic.js", "05_monitor.js", "06_ui.js", "07_views1.js", "08_views2.js", "09_events.js"].map(src);
const html = (head + parts.join("")).replace(/<script>([\s\S]*?)<\/script>/g, (m, code) =>
  code.includes("__svbShowError = show") ? m
    : "<script>\n" + esbuild.transformSync(code, { loader: "js", target: "es2017", charset: "utf8" }).code + "</script>");
fs.writeFileSync(path.join(__dirname, "..", "index.html"), html);
console.log("index.html generado:", (html.length / 1024).toFixed(0), "KB");
