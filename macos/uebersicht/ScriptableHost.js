// The subset of Scriptable used by ios/WeReadHighlights.js.
const config = { runsInWidget: true, widgetFamily, cardChineseFont, cardOptions };
const Keychain = {
  contains: key => Object.hasOwn(storage, key),
  get: key => storage[key],
  set: (key, value) => { storage[key] = value; }
};

class Request {
  async loadJSON() {
    const response = await loadWeRead({
      headers: this.headers,
      body: this.body
    });
    return JSON.parse(response);
  }
}

class WebView {
  async loadHTML(html) {
    this.frame = document.createElement("iframe");
    this.frame.hidden = true;
    const loaded = new Promise(resolve => { this.frame.onload = resolve; });
    this.frame.srcdoc = html;
    document.body.append(this.frame);
    await loaded;
  }

  async evaluateJavaScript() {
    try {
      return this.frame.contentDocument.getElementById("card").toDataURL("image/png");
    } finally {
      this.frame.remove();
    }
  }
}

const Data = { fromBase64String: value => value };
const Image = { fromData: value => value };
class Color {}
const Font = { boldSystemFont() {}, systemFont() {} };

class ListWidget {
  constructor() { this.lines = []; }
  setPadding() {}
  addSpacer() {}
  addText(text) {
    this.lines.push(text);
    return {};
  }
}

let output;
const Script = {
  setWidget(widget) { output = widget; },
  complete() {}
};
