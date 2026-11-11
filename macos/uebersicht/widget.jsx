import { run } from "uebersicht";

const shellArg = value => "'" + value.replace(/'/g, "'\\''") + "'";
const helper = /* REQUEST_COMMAND */ "";
const localRequest = (value, mode) => run(helper + " " + shellArg(value) + (mode ? " " + shellArg(mode) : ""));
const sizes = { small: [156, 156], medium: [330, 156], large: [330, 345] };
const fonts = {
  kaiti: '"Kaiti SC", "STKaiti", "KaiTi", "Songti SC", serif',
  songti: '"Songti SC", "STSong", serif',
  system: '"PingFang SC", -apple-system, sans-serif'
};
const intervals = [1, 2, 3, 4, 6, 8, 12, 24];
const fontScales = { compact: 0.87, standard: 1, roomy: 1.13 };
const preferencesKey = "WeReadHighlights.appearance";
let appearance = {
  family: "medium", font: "system", version: 2,
  refreshHours: 4, textSize: "standard", showAuthor: true
};
try {
  const saved = JSON.parse(localStorage.getItem(preferencesKey));
  if (saved && Object.hasOwn(sizes, saved.family) && Object.hasOwn(fonts, saved.font)) {
    appearance = {
      ...appearance,
      family: saved.family,
      font: saved.version !== 2 && saved.font === "kaiti" ? "system" : saved.font,
      refreshHours: intervals.includes(saved.refreshHours) ? saved.refreshHours : appearance.refreshHours,
      textSize: Object.hasOwn(fontScales, saved.textSize) ? saved.textSize : appearance.textSize,
      showAuthor: saved.showAuthor !== false
    };
  }
} catch {}

const themeKey = "WeReadHighlights.theme";
const defaultTheme = {
  backgroundStart: "#F9FDFF", backgroundEnd: "#E7F5FF", text: "#263A48",
  title: "#257EAF", author: "#263A48", accentStart: "#31A7F4",
  accentEnd: "#79CDFF", divider: "#2499E5", quoteMark: "#31A7F4",
  backgroundImage: null, overlay: 0.25, crops: {}
};
const themeLabels = {
  backgroundStart: "背景起始", backgroundEnd: "背景结束", text: "正文",
  title: "书名", author: "作者", accentStart: "装饰线起始",
  accentEnd: "装饰线结束", divider: "分隔线", quoteMark: "引号"
};
const centerCrop = { x: 0.5, y: 0.5, zoom: 1 };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let cropFamily;
let cropDraft;
let cropDrag;
let theme = { ...defaultTheme };
try {
  const saved = JSON.parse(localStorage.getItem(themeKey));
  if (saved) {
    for (const key of Object.keys(themeLabels)) {
      if (/^#[0-9a-f]{6}$/i.test(saved[key])) theme[key] = saved[key];
    }
    if (/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(saved.backgroundImage || "")) theme.backgroundImage = saved.backgroundImage;
    for (const family of Object.keys(sizes)) {
      const crop = saved.crops?.[family];
      if (crop && [crop.x, crop.y, crop.zoom].every(Number.isFinite)) {
        theme.crops = { ...theme.crops, [family]: {
          x: clamp(crop.x, 0, 1), y: clamp(crop.y, 0, 1), zoom: clamp(crop.zoom, 1, 4)
        } };
      }
    }
    if (Number.isFinite(saved.overlay)) theme.overlay = Math.max(0, Math.min(1, saved.overlay));
  }
} catch {}

function changeTheme(change, dispatch) {
  const next = { ...theme, ...change };
  try { localStorage.setItem(themeKey, JSON.stringify(next)); }
  catch { dispatch({ themeMessage: "无法保存设置，本地存储空间可能不足。" }); return; }
  theme = next;
  dispatch({ themeMessage: "" });
  requestRefresh(dispatch);
}

let choosingBackground = false;
async function selectBackground(dispatch) {
  if (choosingBackground) return;
  choosingBackground = true;
  try {
    const image = (await localRequest("choose-background")).trim();
    if (!image) return;
    if (!/^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(image)) throw new Error();
    cropDraft = undefined;
    changeTheme({ backgroundImage: image, crops: {} }, dispatch);
  } catch {
    dispatch({ themeMessage: "无法载入背景。请选择 20 MB 以内的 JPG、PNG 或 WebP 图片。" });
  } finally {
    choosingBackground = false;
  }
}

function renderCropEditor(dispatch) {
  const family = cropFamily || appearance.family;
  const crop = cropDraft || theme.crops[family] || centerCrop;
  const [width, height] = sizes[family];
  const update = change => {
    cropDraft = { ...(cropDraft || crop), ...change };
    dispatch({ cropChanged: true });
  };
  return (
    <details>
      <summary>裁切背景</summary>
      <div style={{ display: "grid", gap: 8, paddingTop: 8 }}>
        <label>预览尺寸 <select value={family} onChange={event => {
          cropFamily = event.target.value;
          cropDraft = undefined;
          dispatch({ cropChanged: true });
        }}>
          <option value="small">小</option><option value="medium">中</option><option value="large">大</option>
        </select></label>
        <div aria-label="拖动图片调整裁切" style={{
          position: "relative", width: "100%", aspectRatio: width + " / " + height,
          overflow: "hidden", borderRadius: 10, cursor: "grab", touchAction: "none", userSelect: "none"
        }} onPointerDown={event => {
          if (event.button !== 0) return;
          const frame = event.currentTarget;
          const image = frame.querySelector("img");
          if (!image.naturalWidth || !image.naturalHeight) return;
          const bounds = frame.getBoundingClientRect();
          const scale = crop.zoom * Math.max(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
          cropDrag = {
            id: event.pointerId, x: event.clientX, y: event.clientY, crop,
            overflowX: image.naturalWidth * scale - bounds.width,
            overflowY: image.naturalHeight * scale - bounds.height
          };
          frame.setPointerCapture(event.pointerId);
        }} onPointerMove={event => {
          if (cropDrag?.id !== event.pointerId) return;
          const { x, y, crop: start, overflowX, overflowY } = cropDrag;
          update({
            x: overflowX > 0.01 ? clamp(start.x - (event.clientX - x) / overflowX, 0, 1) : start.x,
            y: overflowY > 0.01 ? clamp(start.y - (event.clientY - y) / overflowY, 0, 1) : start.y
          });
        }} onLostPointerCapture={() => { cropDrag = undefined; }}>
          <img src={theme.backgroundImage} alt="" draggable={false} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            objectPosition: (crop.x * 100) + "% " + (crop.y * 100) + "%",
            transform: "scale(" + crop.zoom + ")",
            transformOrigin: (crop.x * 100) + "% " + (crop.y * 100) + "%",
            pointerEvents: "none"
          }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: theme.overlay,
            background: "linear-gradient(to bottom right, " + theme.backgroundStart + ", " + theme.backgroundEnd + ")" }} />
        </div>
        <small>拖动图片调整位置。切换尺寸前，先保存当前裁切。</small>
        <label>缩放 {Math.round(crop.zoom * 100)}%
          <input type="range" min="1" max="4" step="0.05" value={crop.zoom}
            onInput={event => update({ zoom: Number(event.target.value) })} />
        </label>
        <button type="button" onClick={() => update(centerCrop)}>重置构图</button>
        <button type="button" disabled={!cropDraft} onClick={() => {
          changeTheme({ crops: { ...theme.crops, [family]: crop } }, dispatch);
          if (theme.crops[family] === crop) {
            cropDraft = undefined;
            dispatch({ cropChanged: true });
          }
        }}>保存当前尺寸裁切</button>
      </div>
    </details>
  );
}

const positionKey = "WeReadHighlights.position";
let position = { x: 24, y: 42 };
try {
  const saved = JSON.parse(localStorage.getItem(positionKey));
  if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) position = saved;
} catch {}
let drag;
let suppressClick = false;

function clampPosition(value, width, height) {
  return {
    x: Math.max(0, Math.min(value.x, Math.max(0, window.innerWidth - width))),
    y: Math.max(0, Math.min(value.y, Math.max(0, window.innerHeight - height)))
  };
}

function startDrag(event) {
  suppressClick = false;
  if (event.button !== 0 || event.target.closest(".settings")) return;
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
    origin: { x: bounds.left, y: bounds.top }, width: bounds.width,
    height: bounds.height, moved: false };
}

function moveDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  if (!drag.moved) event.currentTarget.setPointerCapture(event.pointerId);
  drag.moved = true;
  event.preventDefault();
  position = clampPosition({ x: drag.origin.x + dx, y: drag.origin.y + dy }, drag.width, drag.height);
  event.currentTarget.style.transform = `translate(${position.x}px, ${position.y}px)`;
}

function finishDrag(event, dispatch) {
  if (!drag || drag.id !== event.pointerId) return;
  if (drag.moved) {
    suppressClick = true;
    try { localStorage.setItem(positionKey, JSON.stringify(position)); } catch {}
    dispatch({ positionChanged: true });
  }
  drag = undefined;
}

let account;
let storage = {};
let refreshing = false;
let refreshRequested = false;
let forceRefreshRequested = false;
let nextRefresh = 0;

export const refreshFrequency = 60 * 1000;
export const initialState = { message: "正在读取微信读书划线…" };
export const className = `
  top: 0;
  left: 0;
  font: 13px -apple-system, sans-serif;
  color: #263a48;

  .settings {
    position: absolute;
    z-index: 1;
    top: 8px;
    right: 8px;
    opacity: 0;
  }
  &:hover .settings, .settings:has(:focus-visible),
  .settings[open], .settings[data-setup="true"] {
    opacity: 1;
  }
  .settings > summary {
    display: grid;
    place-items: center;
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background: rgba(255, 255, 255, .9);
    cursor: pointer;
    font-size: 16px;
    list-style: none;
  }
  .settings > summary::-webkit-details-marker { display: none; }
  .settings-panel {
    position: absolute;
    top: 0;
    left: calc(100% + 8px);
    width: 210px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    display: grid;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    background: #f5fbff;
    box-shadow: 0 2px 12px rgba(38, 58, 72, .18);
  }
`;

async function renderCard(storage, demo, widgetFamily, cardChineseFont, cardOptions) {
  const loadWeRead = ({ body }) => localRequest(body);
  /* SCRIPTABLE_HOST */
  /* SHARED_SCRIPT */
  return output;
}

export const command = async dispatch => {
  if (refreshing) return;
  refreshing = true;
  try {
    const currentAccount = await localRequest("status").catch(() => null);
    if (account !== currentAccount) {
      account = currentAccount;
      storage = account ? { weread_daily_quote_api_key: "wrk-local-keychain" } : {};
      nextRefresh = 0;
      dispatch({ reset: true, message: "正在读取微信读书划线…" });
    }
    if (Date.now() < nextRefresh) return;
    const requested = appearance;
    const forceRefresh = !!account && forceRefreshRequested;
    forceRefreshRequested = false;
    const card = await renderCard(storage, !account, requested.family, fonts[requested.font], {
      refreshHours: requested.refreshHours,
      fontScale: fontScales[requested.textSize],
      showAuthor: requested.showAuthor,
      forceRefresh, theme
    });
    if (card.backgroundImage) {
      const image = "data:image/png;base64," + card.backgroundImage;
      const { bookId, chapterUid, range, title } = JSON.parse(storage.weread_quote_cache || "{}");
      const link = account ? await localRequest(JSON.stringify({
        bookId, chapterUid, range, title, fallback: card.url
      }), "link") : null;
      if (requested !== appearance) return;
      nextRefresh = card.refreshAfterDate?.getTime() || 0;
      dispatch({ image, link, demo: !account, family: requested.family });
    } else {
      dispatch({ message: card.lines[1] || "无法加载微信读书划线" });
    }
  } catch {
    dispatch({ message: "无法加载微信读书划线" });
  } finally {
    refreshing = false;
    if (refreshRequested) {
      refreshRequested = false;
      void command(dispatch);
    }
  }
};

function requestRefresh(dispatch, force = false) {
  nextRefresh = 0;
  forceRefreshRequested ||= force;
  if (refreshing) refreshRequested = true;
  else void command(dispatch);
}

function changeAppearance(change, dispatch) {
  appearance = { ...appearance, ...change };
  try { localStorage.setItem(preferencesKey, JSON.stringify(appearance)); } catch {}
  requestRefresh(dispatch);
}

export const updateState = (event, previous) => {
  if (event.type === "UB/COMMAND_RAN") return previous;
  if (Object.hasOwn(event, "themeMessage")) return { ...previous, themeMessage: event.themeMessage };
  if (event.positionChanged || event.cropChanged) return { ...previous };
  if (event.message && previous.image && !event.reset) return { ...previous, message: event.message };
  return event;
};

export const render = ({ image, link, demo, message, family, themeMessage }, dispatch) => {
  const [width, height] = sizes[family || appearance.family];
  const card = image && (
    <img src={image} alt="微信读书划线" width={width} height={height}
         draggable={false} style={{ display: "block", borderRadius: 14, userSelect: "none" }} />
  );
  return (
    <div style={{ width, position: "relative", touchAction: "none",
                  transform: `translate(${clampPosition(position, width, height).x}px, ${clampPosition(position, width, height).y}px)` }}
         onPointerDown={startDrag} onPointerMove={moveDrag}
         onPointerUp={event => finishDrag(event, dispatch)}
         onPointerCancel={event => finishDrag(event, dispatch)}
         onLostPointerCapture={event => finishDrag(event, dispatch)}
         onClickCapture={event => {
           if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
         }}>
      {link ? (
        <button type="button" aria-label="在浏览器打开微信读书"
                style={{ display: "block", padding: 0, border: 0, background: "transparent", cursor: "grab" }}
                onClick={() => run("/usr/bin/open " + shellArg(link))}>
          {card}
        </button>
      ) : card}
      {(demo || message) && (
        <div style={{ background: "#eaf7ff", padding: "5px 10px", borderRadius: 8, marginTop: 4 }}>
          {message || "示例划线"}
        </div>
      )}
      <details className="settings" data-setup={demo ? "true" : undefined}>
        <summary aria-label="设置" title="设置">⚙</summary>
        <div className="settings-panel" style={{
          left: clampPosition(position, width, height).x + width + 240 > window.innerWidth ? "auto" : undefined,
          right: clampPosition(position, width, height).x + width + 240 > window.innerWidth ? 0 : undefined,
          top: Math.min(0, window.innerHeight - clampPosition(position, width, height).y - 280),
          maxHeight: Math.min(560, Math.max(260, window.innerHeight - clampPosition(position, width, height).y - 16))
        }}>
          <label>尺寸 <select value={appearance.family}
              onChange={event => changeAppearance({ family: event.target.value }, dispatch)}>
            <option value="small">小</option><option value="medium">中</option><option value="large">大</option>
          </select></label>
          <label>字体 <select value={appearance.font}
              onChange={event => changeAppearance({ font: event.target.value }, dispatch)}>
            <option value="system">系统字体</option><option value="songti">宋体</option><option value="kaiti">楷体优先</option>
          </select></label>
          <label>随机更新周期 <select value={appearance.refreshHours}
              onChange={event => changeAppearance({ refreshHours: Number(event.target.value) }, dispatch)}>
            {intervals.map(hours => <option key={hours} value={hours}>{hours} 小时</option>)}
          </select></label>
          <label>正文字号 <select value={appearance.textSize}
              onChange={event => changeAppearance({ textSize: event.target.value }, dispatch)}>
            <option value="compact">紧凑</option><option value="standard">标准</option><option value="roomy">舒展</option>
          </select></label>
          <label><input type="checkbox" checked={appearance.showAuthor}
              disabled={appearance.family === "small"}
              onChange={event => changeAppearance({ showAuthor: event.target.checked }, dispatch)} /> 显示作者</label>
          <details>
            <summary>颜色与背景</summary>
            <div style={{ display: "grid", gap: 8, paddingTop: 8 }}>
              {Object.entries(themeLabels).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {label} <input type="color" aria-label={label + "颜色"} value={theme[key]}
                    onChange={event => changeTheme({ [key]: event.target.value }, dispatch)} />
                </label>
              ))}
              <button type="button" onClick={() => selectBackground(dispatch)}>选择背景图片…</button>
              {theme.backgroundImage && (
                <div style={{ display: "grid", gap: 8 }}>
                  {renderCropEditor(dispatch)}
                  <label>背景遮罩 {Math.round(theme.overlay * 100)}%
                    <input type="range" min="0" max="1" step="0.05" aria-label="背景遮罩"
                      value={theme.overlay} onChange={event => changeTheme({ overlay: Number(event.target.value) }, dispatch)} />
                  </label>
                  <button type="button" onClick={() => { cropDraft = undefined; changeTheme({ backgroundImage: null, crops: {} }, dispatch); }}>移除背景图片</button>
                </div>
              )}
              <button type="button" onClick={() => { cropDraft = undefined; changeTheme(defaultTheme, dispatch); }}>恢复默认颜色与背景</button>
              <small>图片仅保存于本机。</small>
            </div>
          </details>
          {themeMessage && <div role="status">{themeMessage}</div>}
          <button type="button" disabled={demo || !account}
                  onClick={() => requestRefresh(dispatch, true)}>换一句划线</button>
          <button type="button" onClick={async () => {
            try {
              const result = await localRequest("setup");
              if (result.trim() === "saved") {
                requestRefresh(dispatch);
              }
            } catch {
              dispatch({ message: "无法保存 API Key，请检查格式或钥匙串权限。" });
            }
          }}>配置 API Key</button>
        </div>
      </details>
    </div>
  );
};
