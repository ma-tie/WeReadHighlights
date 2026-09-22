// ======================================================
// WeReadHighlights · Scriptable
//
// - 按可配置周期随机展示一条自己的微信读书划线
// - 不同刷新时段独立、有放回抽样
// - 同一刷新时段使用缓存，避免 Widget 刷新时改变
// - 点击小组件可精确跳回对应原文
// - 支持 Small / Medium / Large 三种主屏小组件布局
// ======================================================

const API_URL = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.4";

// ======================================================
// 用户配置
//
// 默认每 4 小时更新一次。
// 支持：1 / 2 / 3 / 4 / 6 / 8 / 12 / 24
// ======================================================

const REFRESH_INTERVAL_HOURS = 4;

const API_KEY_NAME = "weread_daily_quote_api_key";
const USER_VID_KEY = "weread_user_vid";
const CACHE_KEY = "weread_quote_cache";
const CACHE_VERSION = 3;


// ======================================================
// API Key
// ======================================================

async function getApiKey() {
  if (Keychain.contains(API_KEY_NAME)) {
    return Keychain.get(API_KEY_NAME);
  }

  if (config.runsInWidget) {
    throw new Error("请先在 Scriptable 中手动运行一次并设置微信读书 API Key");
  }

  const alert = new Alert();
  alert.title = "微信读书 API Key";
  alert.message = "请输入 wrk- 开头的微信读书 API Key";
  alert.addSecureTextField("wrk-xxxxxxxx");
  alert.addAction("保存");
  alert.addCancelAction("取消");

  const result = await alert.presentAlert();

  if (result === -1) {
    throw new Error("未设置 API Key");
  }

  const key = alert.textFieldValue(0).trim();

  if (!key.startsWith("wrk-")) {
    throw new Error("API Key 格式不正确，应以 wrk- 开头");
  }

  Keychain.set(API_KEY_NAME, key);
  return key;
}


// ======================================================
// 微信读书 API
// ======================================================

async function weread(apiName, params = {}) {
  const apiKey = await getApiKey();

  const request = new Request(API_URL);
  request.method = "POST";
  request.headers = {
    "Authorization": "Bearer " + apiKey,
    "Content-Type": "application/json"
  };

  request.body = JSON.stringify({
    api_name: apiName,
    ...params,
    skill_version: SKILL_VERSION
  });

  const data = await request.loadJSON();

  if (data.errcode && data.errcode !== 0) {
    throw new Error(
      data.errmsg ||
      "微信读书 API 错误：" + data.errcode
    );
  }

  if (data.upgrade_info) {
    throw new Error(
      data.upgrade_info.message ||
      "微信读书 Skill 需要升级"
    );
  }

  return data;
}


// ======================================================
// 刷新周期
// ======================================================

function validateRefreshInterval() {
  const allowed = [
    1,
    2,
    3,
    4,
    6,
    8,
    12,
    24
  ];

  if (
    !allowed.includes(
      REFRESH_INTERVAL_HOURS
    )
  ) {
    throw new Error(
      "REFRESH_INTERVAL_HOURS 仅支持 1 / 2 / 3 / 4 / 6 / 8 / 12 / 24"
    );
  }
}


function currentSlot() {
  validateRefreshInterval();

  const now = new Date();

  const year = now.getFullYear();
  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  const block =
    Math.floor(
      now.getHours() /
      REFRESH_INTERVAL_HOURS
    );

  return (
    year +
    "-" +
    month +
    "-" +
    day +
    "-" +
    REFRESH_INTERVAL_HOURS +
    "h-" +
    block
  );
}


function nextRefreshTime() {
  validateRefreshInterval();

  const now = new Date();
  const next = new Date(now);

  const nextHour =
    (
      Math.floor(
        now.getHours() /
        REFRESH_INTERVAL_HOURS
      ) + 1
    ) *
    REFRESH_INTERVAL_HOURS;

  // 支持的周期都能整除 24，
  // 因此 setHours(24, ...) 会自然进入下一天。
  //
  // 在下一时段开始 5 分钟后请求刷新，
  // 实际刷新时间仍由 iOS 决定。
  next.setHours(
    nextHour,
    5,
    0,
    0
  );

  return next;
}


// ======================================================
// 获取全部有划线的书
// ======================================================

async function fetchAllBooks() {
  let books = [];
  let lastSort = null;

  while (true) {
    const params = {
      count: 100
    };

    if (lastSort !== null) {
      params.lastSort = lastSort;
    }

    const data = await weread(
      "/user/notebooks",
      params
    );

    const page = data.books || [];

    books.push(...page);

    if (!data.hasMore || page.length === 0) {
      break;
    }

    const lastBook = page[page.length - 1];

    if (
      lastBook.sort === undefined ||
      lastBook.sort === null
    ) {
      break;
    }

    lastSort = lastBook.sort;
  }

  return books.filter(
    book => Number(book.noteCount || 0) > 0
  );
}


// ======================================================
// 按 noteCount 加权选择书籍
// ======================================================

function chooseBookWeighted(books) {
  const total = books.reduce(
    (sum, book) =>
      sum + Number(book.noteCount || 0),
    0
  );

  if (total <= 0) {
    throw new Error("没有找到可随机抽取的划线");
  }

  let random = Math.random() * total;

  for (const book of books) {
    random -= Number(book.noteCount || 0);

    if (random < 0) {
      return book;
    }
  }

  return books[books.length - 1];
}


// ======================================================
// 获取自己的 userVid
// ======================================================

function extractUserVid(data) {
  const reviews =
    data && Array.isArray(data.reviews)
      ? data.reviews
      : [];

  for (const item of reviews) {
    if (
      item &&
      item.review &&
      item.review.author &&
      item.review.author.userVid !== undefined &&
      item.review.author.userVid !== null
    ) {
      return String(item.review.author.userVid);
    }

    if (
      item &&
      item.author &&
      item.author.userVid !== undefined &&
      item.author.userVid !== null
    ) {
      return String(item.author.userVid);
    }
  }

  return null;
}


async function getUserVid(
  books,
  preferredBookId
) {
  if (Keychain.contains(USER_VID_KEY)) {
    return Keychain.get(USER_VID_KEY);
  }

  // 优先检查当前抽中的书。
  const ordered = [];

  for (const book of books) {
    if (
      String(book.bookId) ===
      String(preferredBookId)
    ) {
      ordered.unshift(book);
    } else {
      ordered.push(book);
    }
  }

  for (const book of ordered) {
    try {
      const data = await weread(
        "/review/list/mine",
        {
          bookid: String(book.bookId),
          count: 20
        }
      );

      const userVid = extractUserVid(data);

      if (userVid) {
        Keychain.set(USER_VID_KEY, userVid);
        console.log("已保存微信读书 userVid");
        return userVid;
      }
    } catch (_) {
      // 某本书没有个人想法时继续尝试下一本。
    }
  }

  return null;
}


// ======================================================
// 跳转链接
// ======================================================

function buildBookmarkUrl(
  bookId,
  chapterUid,
  range,
  userVid
) {
  if (
    bookId === undefined ||
    bookId === null ||
    chapterUid === undefined ||
    chapterUid === null ||
    !range ||
    !userVid
  ) {
    return null;
  }

  const parts = String(range).split("-");

  if (parts.length !== 2) {
    return null;
  }

  return (
    "weread://bestbookmark" +
    "?bookId=" +
    encodeURIComponent(String(bookId)) +
    "&chapterUid=" +
    encodeURIComponent(String(chapterUid)) +
    "&rangeStart=" +
    encodeURIComponent(String(parts[0])) +
    "&rangeEnd=" +
    encodeURIComponent(String(parts[1])) +
    "&userVid=" +
    encodeURIComponent(String(userVid))
  );
}


async function getBookDeepLink(bookId) {
  try {
    const info = await weread(
      "/book/info",
      {
        bookId: String(bookId)
      }
    );

    if (info && info.deepLink) {
      return String(info.deepLink);
    }
  } catch (_) {}

  return null;
}


// ======================================================
// 获取当前时段摘录
// ======================================================

async function fetchQuote() {
  const slot = currentSlot();

  // 同一时段直接使用缓存。
  if (Keychain.contains(CACHE_KEY)) {
    try {
      const cached = JSON.parse(
        Keychain.get(CACHE_KEY)
      );

      if (
        cached.cacheVersion === CACHE_VERSION &&
        cached.slot === slot &&
        cached.quote &&
        cached.title
      ) {
        return cached;
      }
    } catch (_) {}
  }

  const books = await fetchAllBooks();

  if (books.length === 0) {
    throw new Error("没有找到微信读书划线");
  }

  // 先按划线数量加权随机选书。
  const selectedBook =
    chooseBookWeighted(books);

  const bookId = selectedBook.bookId;

  const title =
    selectedBook.book?.title ||
    "未知书名";

  const author =
    selectedBook.book?.author ||
    "";

  // 获取该书所有个人划线。
  const bookmarkData = await weread(
    "/book/bookmarklist",
    {
      bookId: String(bookId)
    }
  );

  const marks =
    (bookmarkData.updated || [])
      .filter(item => {
        return (
          item.markText !== undefined &&
          item.markText !== null &&
          String(item.markText).trim().length > 0
        );
      });

  if (marks.length === 0) {
    throw new Error(
      "《" + title + "》没有可显示的划线"
    );
  }

  // 在书内均匀随机一条。
  // 新时段重新 Math.random()，因此是独立、有放回抽样。
  const index =
    Math.floor(
      Math.random() * marks.length
    );

  const selected = marks[index];

  const userVid =
    await getUserVid(
      books,
      bookId
    );

  // 优先构造精确划线跳转。
  let url =
    buildBookmarkUrl(
      bookId,
      selected.chapterUid,
      selected.range,
      userVid
    );

  // 缺少精确定位信息时退化为书籍 deepLink。
  if (!url) {
    url =
      await getBookDeepLink(
        bookId
      );
  }

  const result = {
    cacheVersion: CACHE_VERSION,
    slot: slot,

    quote:
      String(selected.markText).trim(),

    title: title,
    author: author,

    bookId: String(bookId),
    chapterUid: selected.chapterUid,
    range: selected.range || "",
    bookmarkId: selected.bookmarkId || "",
    userVid: userVid || "",
    url: url || ""
  };

  Keychain.set(
    CACHE_KEY,
    JSON.stringify(result)
  );

  return result;
}


// ======================================================
// 小组件布局
//
// Small  : 312 × 312
// Medium : 660 × 312（保持原有布局）
// Large  : 660 × 690
// ======================================================

function getWidgetLayout(family) {
  if (family === "small") {
    return {
      width: 312,
      height: 312,

      accentX: 18,
      accentY: 20,
      accentWidth: 5,
      accentHeight: 272,

      quoteMarkX: 29,
      quoteMarkY: 92,
      quoteMarkSize: 104,

      bodyX: 44,
      bodyAreaTop: 38,
      bodyAreaBottom: 228,
      bodyFontSize: 28,
      bodyLineHeight: 39,
      bodyMaxWidth: 240,
      bodyMaxLines: 4,

      dividerX: 44,
      dividerY: 244,
      dividerWidth: 240,

      sourceRightX: 284,
      sourceY: 278,
      sourceTitleFontSize: 18,
      sourceAuthorFontSize: 0,
      sourceMaxWidth: 235,
      sourceAuthorMaxWidth: 0,
      showAuthor: false
    };
  }

  if (family === "large") {
    return {
      width: 660,
      height: 690,

      accentX: 25,
      accentY: 34,
      accentWidth: 6,
      accentHeight: 622,

      quoteMarkX: 39,
      quoteMarkY: 128,
      quoteMarkSize: 136,

      bodyX: 60,
      bodyAreaTop: 56,
      bodyAreaBottom: 584,
      bodyFontSize: 36,
      bodyLineHeight: 52,
      bodyMaxWidth: 540,
      bodyMaxLines: 9,

      dividerX: 60,
      dividerY: 610,
      dividerWidth: 542,

      sourceRightX: 602,
      sourceY: 654,
      sourceTitleFontSize: 24,
      sourceAuthorFontSize: 17,
      sourceMaxWidth: 530,
      sourceAuthorMaxWidth: 235,
      showAuthor: true
    };
  }

  // Medium：保持当前已经确认过的样式。
  return {
    width: 660,
    height: 312,

    accentX: 25,
    accentY: 27,
    accentWidth: 6,
    accentHeight: 258,

    quoteMarkX: 39,
    quoteMarkY: 111,
    quoteMarkSize: 125,

    bodyX: 60,
    bodyAreaTop: 38,
    bodyAreaBottom: 224,
    bodyFontSize: 33,
    bodyLineHeight: 46,
    bodyMaxWidth: 535,
    bodyMaxLines: 4,

    dividerX: 60,
    dividerY: 241,
    dividerWidth: 542,

    sourceRightX: 602,
    sourceY: 280,
    sourceTitleFontSize: 21,
    sourceAuthorFontSize: 15,
    sourceMaxWidth: 510,
    sourceAuthorMaxWidth: 210,
    showAuthor: true
  };
}


// ======================================================
// Canvas 卡片
// ======================================================

async function renderQuoteCard(
  data,
  family
) {
  const layout =
    getWidgetLayout(family);

  const W =
    layout.width;

  const H =
    layout.height;

  // 2× Retina 渲染：
  // 逻辑尺寸和布局参数保持不变，只提高底层位图像素密度。
  const RENDER_SCALE = 2;

  const quote =
    String(data.quote);

  const title =
    String(data.title);

  const author =
    String(data.author || "");

  const html = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<style>",
    "html, body { margin: 0; padding: 0; background: transparent; }",
    "canvas { display: block; }",
    "</style>",
    "</head>",
    "<body>",
    '<canvas id="card" width="' +
      (W * RENDER_SCALE) +
      '" height="' +
      (H * RENDER_SCALE) +
      '" style="width:' +
      W +
      'px;height:' +
      H +
      'px"></canvas>',
    "<script>",
    'const canvas = document.getElementById("card");',
    'const ctx = canvas.getContext("2d");',
    'ctx.scale(' + RENDER_SCALE + ', ' + RENDER_SCALE + ');',

    "const layout = " +
      JSON.stringify(layout) +
      ";",

    "// 背景",
    "const bg = ctx.createLinearGradient(0, 0, " + W + ", " + H + ");",
    'bg.addColorStop(0, "#F9FDFF");',
    'bg.addColorStop(1, "#E7F5FF");',
    "ctx.fillStyle = bg;",
    "ctx.fillRect(0, 0, " + W + ", " + H + ");",

    "// 左侧蓝色装饰线",
    "const accent = ctx.createLinearGradient(" +
      "0, layout.accentY, 0, layout.accentY + layout.accentHeight);",
    'accent.addColorStop(0, "#31A7F4");',
    'accent.addColorStop(1, "#79CDFF");',
    "ctx.fillStyle = accent;",
    "ctx.beginPath();",
    "ctx.roundRect(" +
      "layout.accentX, " +
      "layout.accentY, " +
      "layout.accentWidth, " +
      "layout.accentHeight, 3);",
    "ctx.fill();",

    "// 背景大引号",
    'ctx.fillStyle = "rgba(49,167,244,0.10)";',
    'ctx.font = layout.quoteMarkSize + "px Georgia, serif";',
    'ctx.fillText("“", layout.quoteMarkX, layout.quoteMarkY);',

    "// 正文",
    "const quote = " +
      JSON.stringify(quote) +
      ";",

    'ctx.fillStyle = "#263A48";',

    "ctx.font = layout.bodyFontSize + 'px \"Kaiti SC\", \"STKaiti\", \"KaiTi\", serif';",

    "let lines = [];",
    'let currentLine = "";',

    "for (const char of quote) {",
    "  const candidate = currentLine + char;",
    "  if (" +
      "ctx.measureText(candidate).width > layout.bodyMaxWidth && " +
      "currentLine.length > 0" +
    ") {",
    "    lines.push(currentLine);",
    "    currentLine = char;",
    "  } else {",
    "    currentLine = candidate;",
    "  }",
    "}",

    "if (currentLine) {",
    "  lines.push(currentLine);",
    "}",

    "const originalLineCount = lines.length;",
    "lines = lines.slice(0, layout.bodyMaxLines);",

    "if (originalLineCount > layout.bodyMaxLines) {",
    "  const lastIndex = lines.length - 1;",
    "  let last = lines[lastIndex];",

    '  while (' +
      'last.length > 0 && ' +
      'ctx.measureText(last + "…").width > layout.bodyMaxWidth' +
    ') {',
    "    last = last.slice(0, -1);",
    "  }",

    '  lines[lastIndex] = last + "…";',
    "}",

    "// 按实际正文高度，在正文区域内垂直居中",
    "const textHeight = " +
      "(lines.length - 1) * layout.bodyLineHeight + " +
      "layout.bodyFontSize;",

    "const bodyAreaHeight = " +
      "layout.bodyAreaBottom - layout.bodyAreaTop;",

    "const textTop = " +
      "layout.bodyAreaTop + " +
      "Math.max(0, (bodyAreaHeight - textHeight) / 2);",

    "// Canvas fillText 使用基线定位，0.82 用于把视觉字框放回 textTop",
    "let quoteY = " +
      "textTop + layout.bodyFontSize * 0.82;",

    "for (const line of lines) {",
    "  ctx.fillText(line, layout.bodyX, quoteY);",
    "  quoteY += layout.bodyLineHeight;",
    "}",

    "// 分割线",
    'ctx.fillStyle = "rgba(36,153,229,0.18)";',
    "ctx.fillRect(" +
      "layout.dividerX, " +
      "layout.dividerY, " +
      "layout.dividerWidth, 1);",

    "// 来源",
    "const fullTitle = " +
      JSON.stringify(title) +
      ";",

    "const fullAuthor = " +
      JSON.stringify(author) +
      ";",

    'let authorDisplay = layout.showAuthor ? fullAuthor : "";',

    "if (layout.showAuthor && authorDisplay) {",
    '  ctx.font = ' +
      'layout.sourceAuthorFontSize + ' +
      '"px -apple-system, BlinkMacSystemFont, sans-serif";',

    '  while (' +
      'authorDisplay.length > 4 && ' +
      'ctx.measureText(" · " + authorDisplay).width > ' +
      'layout.sourceAuthorMaxWidth' +
    ') {',
    '    authorDisplay = ' +
      'authorDisplay.slice(0, -2) + "…";',
    "  }",
    "}",

    'const authorPart = ' +
      'authorDisplay ? " · " + authorDisplay : "";',

    "let authorWidth = 0;",

    "if (authorPart) {",
    '  ctx.font = ' +
      'layout.sourceAuthorFontSize + ' +
      '"px -apple-system, BlinkMacSystemFont, sans-serif";',
    "  authorWidth = ctx.measureText(authorPart).width;",
    "}",

    "ctx.font = layout.sourceTitleFontSize + 'px \"Kaiti SC\", \"STKaiti\", \"KaiTi\", serif';",

    "let titleDisplay = fullTitle;",
    'let source = "《" + titleDisplay + "》";',

    "const maxTitleWidth = " +
      "layout.sourceMaxWidth - authorWidth;",

    "while (" +
      "titleDisplay.length > 3 && " +
      "ctx.measureText(source).width > maxTitleWidth" +
    ") {",
    '  titleDisplay = ' +
      'titleDisplay.slice(0, -2) + "…";',
    '  source = "《" + titleDisplay + "》";',
    "}",

    'ctx.textAlign = "right";',

    "if (authorPart) {",
    '  ctx.fillStyle = "rgba(38,58,72,0.43)";',
    '  ctx.font = ' +
      'layout.sourceAuthorFontSize + ' +
      '"px -apple-system, BlinkMacSystemFont, sans-serif";',
    "  ctx.fillText(" +
      "authorPart, " +
      "layout.sourceRightX, " +
      "layout.sourceY" +
    ");",
    "}",

    'ctx.fillStyle = "#257EAF";',

    "ctx.font = layout.sourceTitleFontSize + 'px \"Kaiti SC\", \"STKaiti\", \"KaiTi\", serif';",

    "ctx.fillText(" +
      "source, " +
      "layout.sourceRightX - authorWidth, " +
      "layout.sourceY" +
    ");",

    'ctx.textAlign = "left";',

    "</script>",
    "</body>",
    "</html>"
  ].join("\n");

  const web =
    new WebView();

  await web.loadHTML(
    html
  );

  const dataURL =
    await web.evaluateJavaScript(
      'document.getElementById("card").toDataURL("image/png")'
    );

  if (
    typeof dataURL !==
    "string"
  ) {
    throw new Error(
      "Canvas 没有返回图片数据"
    );
  }

  const prefix =
    "data:image/png;base64,";

  const base64 =
    dataURL.startsWith(prefix)
      ? dataURL.slice(prefix.length)
      : dataURL;

  const imageData =
    Data.fromBase64String(
      base64
    );

  if (!imageData) {
    throw new Error(
      "PNG 数据转换失败"
    );
  }

  return Image.fromData(
    imageData
  );
}


// ======================================================
// 主屏小组件
// ======================================================

async function createHomeWidget(
  data,
  family
) {
  const widget =
    new ListWidget();

  const image =
    await renderQuoteCard(
      data,
      family
    );

  widget.backgroundImage =
    image;

  widget.setPadding(
    0,
    0,
    0,
    0
  );

  if (data.url) {
    widget.url =
      data.url;
  }

  return widget;
}


// ======================================================
// 错误 Widget
// ======================================================

function createErrorWidget(error) {
  const widget =
    new ListWidget();

  widget.backgroundColor =
    new Color("#EAF7FF");

  widget.setPadding(
    18,
    18,
    18,
    18
  );

  const title =
    widget.addText("微信读书");

  title.font =
    Font.boldSystemFont(12);

  title.textColor =
    new Color("#2499E5");

  widget.addSpacer(8);

  const message =
    widget.addText(
      error.message ||
      String(error)
    );

  message.font =
    Font.systemFont(10);

  message.textColor =
    new Color("#263A48");

  message.lineLimit = 5;

  return widget;
}


// ======================================================
// 主程序
// ======================================================

let widget;

try {
  const data =
    await fetchQuote();

  const supportedFamilies = [
    "small",
    "medium",
    "large"
  ];

  const family =
    supportedFamilies.includes(
      config.widgetFamily
    )
      ? config.widgetFamily
      : "medium";

  widget =
    await createHomeWidget(
      data,
      family
    );

  widget.refreshAfterDate =
    nextRefreshTime();

} catch (error) {
  console.error(error);

  widget =
    createErrorWidget(error);
}


// ======================================================
// 展示
// ======================================================

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  const family =
    ["small", "medium", "large"].includes(
      config.widgetFamily
    )
      ? config.widgetFamily
      : "medium";

  if (family === "small") {
    await widget.presentSmall();
  } else if (family === "large") {
    await widget.presentLarge();
  } else {
    await widget.presentMedium();
  }
}

Script.complete();
