// Ensambla ../index.html desde src/ y transpila cada <script> a ES2017
// (compatible con iPhone iOS 11+ y Android Chrome 61+).  Uso: cd html5 && npm install && npm run build
const fs = require("fs"), path = require("path"), esbuild = require("esbuild");
const src = (f) => fs.readFileSync(path.join(__dirname, "src", f), "utf8");
const head = src("01_head.html").replace("<!--GUARD-->", src("00_guard.html"))
  .replace("</style>", src("01c_style.css") + "</style>")
  .replace('<meta name="theme-color" content="#07090D">', '<meta name="theme-color" content="#07090D">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-192.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="SVB">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<link rel="preconnect" href="https://firestore.googleapis.com">\n<link rel="preconnect" href="https://www.gstatic.com">');
const parts = ["02_core.js", "02b_cloud.js", "03_seed.js", "04_logic.js", "05_monitor.js", "06_ui.js", "07_views1.js", "08_views2.js", "09_events.js", "10_cloudui.js"].map(src);
const html = (head + parts.join("") + src("00_fb.html")).replace(/<script>([\s\S]*?)<\/script>/g, (m, code) =>
  code.includes("__svbShowError = show") ? m
    : "<script>\n" + esbuild.transformSync(code, { loader: "js", target: "es2017", charset: "utf8" }).code + "</script>");
fs.writeFileSync(path.join(__dirname, "..", "index.html"), html);
console.log("index.html generado:", (html.length / 1024).toFixed(0), "KB");
