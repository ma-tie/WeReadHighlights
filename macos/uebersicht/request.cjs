const { execFileSync, spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");

const service = "WeReadHighlights";
const account = "WeRead API Key";

function configureKey() {
  const dialog = spawnSync("/usr/bin/osascript", [
    "-e", 'tell current application to activate',
    "-e", 'set entry to display dialog "请输入微信读书的 wrk- API Key" with title "WeReadHighlights" default answer "" with hidden answer buttons {"取消", "保存"} default button "保存" cancel button "取消"',
    "-e", "text returned of entry"
  ], { encoding: "utf8" });
  if (dialog.status !== 0) {
    if (dialog.stderr?.includes("(-128)")) return;
    throw new Error("无法打开配置窗口");
  }
  const key = dialog.stdout.trim();
  if (!key.startsWith("wrk-") || key.length <= 4) throw new Error("API Key 格式不正确");

  // Feed the password to security through stdin so it stays out of process arguments.
  const password = Buffer.from(key).toString("hex");
  const command = `add-generic-password -U -s "${service}" -a "${account}" -X ${password}\n`;
  const result = spawnSync("/usr/bin/security", ["-i"], { input: command, encoding: "utf8" });
  if (result.error || result.status !== 0 || result.stderr.trim()) {
    throw new Error("无法保存到钥匙串");
  }
  process.stdout.write("saved");
}

function chooseBackground() {
  const dialog = spawnSync("/usr/bin/osascript", [
    "-e", "tell current application to activate",
    "-e", 'POSIX path of (choose file with prompt "选择划线卡片的背景图片")'
  ], { encoding: "utf8" });
  if (dialog.status !== 0) {
    if (dialog.stderr?.includes("(-128)")) return;
    throw new Error("无法打开图片选择窗口");
  }

  const source = dialog.stdout.replace(/\r?\n$/, "");
  if (!/\.(jpe?g|png|webp)$/i.test(source) || fs.statSync(source).size > 20 * 1024 * 1024) {
    throw new Error("请选择 20 MB 以内的 JPG、PNG 或 WebP 图片");
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "weread-background-"));
  try {
    const output = path.join(directory, "background.jpg");
    execFileSync("/usr/bin/sips", [
      "-Z", "1200", "-s", "format", "jpeg", "-s", "formatOptions", "85",
      source, "--out", output
    ], { stdio: "pipe" });
    process.stdout.write("data:image/jpeg;base64," + fs.readFileSync(output).toString("base64"));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function fetchWeRead(key, body) {
  return new Promise((resolve, reject) => {
    const request = https.request("https://i.weread.qq.com/api/agent/gateway", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error("微信读书请求失败（" + response.statusCode + "）"));
        return;
      }
      response.setEncoding("utf8");
      let text = "";
      response.on("data", chunk => { text += chunk; });
      response.on("end", () => resolve(text));
      response.on("error", reject);
    });
    request.setTimeout(20000, () => request.destroy(new Error("微信读书请求超时")));
    request.on("error", reject);
    request.end(body);
  });
}

const md5 = value => createHash("md5").update(value).digest("hex");

// The web reader uses encoded decimal IDs in the path and a separate range query.
function encodeReaderId(id) {
  const digest = md5(id);
  const body = id.match(/.{1,9}/g).map(group => {
    const hex = Number(group).toString(16);
    return hex.length.toString(16).padStart(2, "0") + hex;
  }).join("g");
  let encoded = digest.slice(0, 3) + "32" + digest.slice(-2) + body;
  encoded += digest.slice(0, Math.max(0, 20 - encoded.length));
  return encoded + md5(encoded).slice(0, 3);
}

function readerLink({ bookId, chapterUid, range, title, fallback }) {
  if (/^\d+$/.test(String(bookId))) {
    const base = "https://weread.qq.com/web/reader/" + encodeReaderId(String(bookId));
    if (/^[1-9]\d*$/.test(String(chapterUid))) {
      const chapter = base + "k" + encodeReaderId(String(chapterUid));
      const offsets = /^(\d+)-(\d+)$/.exec(range || "");
      return offsets && Number(offsets[1]) < Number(offsets[2]) ? chapter + "?range=" + range : chapter;
    }
    return base;
  }
  if (/^https:\/\/weread\.qq\.com\//.test(fallback || "")) return fallback;
  return title ? "https://weread.qq.com/web/search/books?keyword=" + encodeURIComponent(title)
    : "https://weread.qq.com/";
}

async function main() {
  if (process.argv[2] === "choose-background") {
    chooseBackground();
    return;
  }
  if (process.argv[2] === "setup") {
    configureKey();
    return;
  }
  if (process.argv[3] === "link") {
    process.stdout.write(readerLink(JSON.parse(process.argv[2])));
    return;
  }
  let key;
  try {
    key = execFileSync("/usr/bin/security", [
      "find-generic-password", "-s", service, "-a", account, "-w"
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    throw new Error("无法读取微信读书 API Key");
  }
  if (!key.startsWith("wrk-") || key.length <= 4) throw new Error("API Key 格式不正确");

  if (process.argv[2] === "status") {
    process.stdout.write(createHash("sha256").update(key).digest("hex"));
    return;
  }

  process.stdout.write(await fetchWeRead(key, process.argv[2]));
}

main().catch(error => {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
});
