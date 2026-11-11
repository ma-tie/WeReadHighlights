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

let account;
let storage = {};
let refreshing = false;
let refreshRequested = false;
let forceRefreshRequested = false;
let nextRefresh = 0;

export const refreshFrequency = 60 * 1000;
export const initialState = { message: "正在读取微信读书划线…" };
export const className = `
  top: 42px;
  left: 24px;
  font: 13px -apple-system, sans-serif;
  color: #263a48;

  .settings {
    position: absolute;
    z-index: 1;
    top: 8px;
    right: 8px;
    opacity: 0;
  }
  &:hover .settings, &:focus-within .settings,
  .settings[open], .settings[data-setup="true"] {
    opacity: 1;
  }
  .settings summary {
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
  .settings summary::-webkit-details-marker { display: none; }
  .settings-panel {
    position: absolute;
    top: 0;
    left: calc(100% + 8px);
    width: 175px;
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
      forceRefresh
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
  if (event.message && previous.image && !event.reset) return { ...previous, message: event.message };
  return event;
};

export const render = ({ image, link, demo, message, family }, dispatch) => {
  const [width, height] = sizes[family || appearance.family];
  const card = image && (
    <img src={image} alt="微信读书划线" width={width} height={height}
         style={{ display: "block", borderRadius: 14 }} />
  );
  return (
    <div style={{ width, position: "relative" }}>
      {link ? (
        <button type="button" aria-label="在浏览器打开微信读书"
                style={{ display: "block", padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
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
        <div className="settings-panel">
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
