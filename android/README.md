# WeReadHighlights for Android (experimental)

This directory is an **independent Kotlin Android app**. The existing iOS
`WeReadHighlights.js` remains unchanged. It is an early implementation and has
passed a previous emulator smoke test for basic quote rendering. The redesigned
version still needs a new emulator check.

## Features implemented

- Configure the WeRead Skill Gateway `wrk-` API Key in the app.
- Encrypt the API Key locally with **AndroidKeyStore AES-GCM**; never hardcode
  your token in source control.
- Fetch personal notebooks, sample books weighted by `noteCount`, and sample
  a nonempty personal bookmark.
- Cache the current quote and preserve it when offline or when the API fails.
- Refined 0.2.2 styling: the translucent opening quote is smaller, lighter,
  and shifted away from the blue accent. Book title and author now use separate
  TextViews so long titles ellipsize before the author disappears. Small
  intentionally shows the title only; Medium/Large honor the author toggle.
- iOS-inspired home-screen cards in three separate Android widget picker entries:
  Android 12+ uses explicit default launcher sizes (Small **2×2**, Medium
  **4×2**, Large **4×4**); final cell allocation depends on launcher grid.
  **Small** (4 quote lines, book title), **Medium** (4 lines, title and author),
  and **Large** (9 lines, title and author). Launcher grid size varies by device.
- Native settings screen with quote preview, configurable refresh intervals
  **1 / 2 / 3 / 4 / 6 / 8 / 12 / 24 hours** (default 4), three font-size presets,
  and author visibility toggle. Settings are stored locally and update widgets.
- WorkManager periodic refresh using the chosen interval; Android may delay it.
- Tap quote to attempt the `weread://bestbookmark` deep link; show a helpful
  message when no usable link exists or no app can handle it.
- GitHub Actions debug APK build on the `feature/android-app` branch.

## Building

Open the `android/` directory in Android Studio. Use **JDK 17**, Android SDK
35, and Gradle 8.10.2 (Android Gradle Plugin 8.8.2). Select the `app` run
configuration to run in an Android emulator (Android 8.0 / API 26 or newer).

From a machine with Gradle 8.10.2 and Android SDK installed:

```sh
gradle -p android :app:assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

Once the branch's **push-triggered GitHub Actions** job succeeds, open **GitHub → Actions → Android debug APK** and download the `WeReadHighlights-Android-debug` artifact. Manual `workflow_dispatch` from this branch alone is not available unless the workflow also exists on the default branch. This is a debug APK, **not a signed release**.

## Using

1. Install the APK and launch WeReadHighlights.
2. Obtain an API Key from https://weread.qq.com/r/weread-skills .
3. Enter the `wrk-` key and tap **保存 API Key 并获取划线**.
4. Set the refresh interval, font size and author option in the app.
5. Long-press the Android home screen, open Widgets, and choose
   **WeReadHighlights · 小号 / 中号 / 大号**.
6. To draw another quote immediately, open the app and tap **换一句划线**.

## Important limitations

- **Unverified:** Android WeRead support for the iOS-style
  `weread://bestbookmark` URL. Some records lack the required
  `chapterUid`, `range`, or `userVid`; we fall back to a returned book
  `deepLink`, if present. This cannot be claimed to locate the exact
  highlight on Android until tested with an installed copy of WeRead.
- A user reported successfully loading and displaying quotes in the first
  Android emulator build. The redesigned UI and all three widget sizes have
  not yet been visually validated on an emulator or physical device.
- Widget uses native RemoteViews rather than the iOS WebView/Canvas, to avoid
  blank-image rendering failures.
- Updates are **best-effort**: WorkManager requests approximately one update
  at the selected interval (1–24 hours) and may be delayed by vendor background restrictions.
- If an earlier 0.2.0 widget displays **Can't load widget**, update to 0.2.1:
  the decoration previously used a plain `<View>` which is unsupported by
  Android `RemoteViews`. Version 0.2.1 uses supported `ImageView` children
  and adds an automated layout validation check. After updating, remove and
  re-add affected home-screen widgets if the launcher retains the old failure.
- The first launch requires network access. On subsequent failures the last
  cached quote stays visible.
- No analytics, advertising, external backend, or API Key logging.
- Debug APK is signed with an automatically generated debug key, **not a stable
  release signing key**. Installing a later CI debug APK over an older one may
  fail with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`; for emulator testing,
  uninstall the old build and install the new APK. This clears saved API Keys,
  quotes and preferences. A stable release signing setup is needed before
  distributing seamless updates.
- No automated Android emulator/device test currently runs in CI.

## Architecture

- `MainActivity.kt`: redesigned settings, preview, API Key setup and manual refresh
- `QuoteApi.kt`: WeRead Gateway calls and weighted selection
- `QuoteStore.kt`: AndroidKeyStore encryption and cached quote
- `QuoteWidgetProvider.kt`: three widget receiver classes and native rendering
- `RefreshWorker.kt`: background sync
- `OpenQuoteActivity.kt`: safe deep-link launching

Keep platform-specific iOS and Android code separate; they share the API
protocol and sampling design, not Scriptable's APIs.
