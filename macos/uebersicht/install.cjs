const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const directory = process.argv[2] || path.join(
  os.homedir(), "Library", "Application Support", "Übersicht", "widgets"
);
const destination = path.resolve(directory, "WeReadHighlights.widget");
const read = relative => fs.readFileSync(path.join(__dirname, relative), "utf8");
const quote = value => "'" + value.replace(/'/g, "'\\''") + "'";
const helper = [process.execPath, path.join(destination, "lib", "request.cjs")].map(quote).join(" ");
const shared = read("../../ios/WeReadHighlights.js");
const entry = read("widget.jsx")
  .replace('/* REQUEST_COMMAND */ ""', () => JSON.stringify(helper))
  .replace("/* SCRIPTABLE_HOST */", () => read("ScriptableHost.js"))
  .replace("/* SHARED_SCRIPT */", () => shared.replace("let widget;", `
    if (demo) {
      Keychain.set(CACHE_KEY, JSON.stringify({
        cacheVersion: CACHE_VERSION,
        slot: currentSlot(),
        quote: "读书是一种随身携带的旅行。",
        title: "微信读书",
        author: "示例划线"
      }));
    }
    let widget;
  `));
fs.mkdirSync(path.join(destination, "lib"), { recursive: true });
fs.copyFileSync(path.join(__dirname, "request.cjs"), path.join(destination, "lib", "request.cjs"));
const pending = path.join(destination, "index.tmp");
fs.writeFileSync(pending, entry);
fs.renameSync(pending, path.join(destination, "index.jsx"));
console.log(destination);
