# WeReadHighlights for Android (experimental)

This directory is an **independent Kotlin Android app**. The existing iOS
`WeReadHighlights.js` remains unchanged. It is an early implementation and has
not been tested on an Android device yet.

## Features implemented

- Configure the WeRead Skill Gateway `wrk-` API Key in the app.
- Encrypt the API Key locally with **AndroidKeyStore AES-GCM**; never hardcode
  your token in source control.
- Fetch personal notebooks, sample books weighted by `noteCount`, and sample
  a nonempty personal bookmark.
- Cache the current quote and preserve it when offline or when the API fails.
- Android home-screen widget with resizable quote and attribution.
- Approximately four-hour WorkManager background refresh; Android may delay it.
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

You can also open **GitHub → Actions → Android debug APK** on the development
branch and download the `WeReadHighlights-Android-debug` artifact from a
successful run. This is a debug APK, **not a signed release**.

## Using

1. Install the APK and launch WeReadHighlights.
2. Obtain an API Key from https://weread.qq.com/r/weread-skills .
3. Enter the `wrk-` key and tap **保存 API Key 并获取划线**.
4. Long-press the Android home screen, open Widgets, and add WeReadHighlights.
5. To draw another quote immediately, open the app and tap **立即随机刷新**.

## Important limitations

- **Unverified:** Android WeRead support for the iOS-style
  `weread://bestbookmark` URL. Some records lack the required
  `chapterUid`, `range`, or `userVid`; we fall back to a returned book
  `deepLink`, if present. This cannot be claimed to locate the exact
  highlight on Android until tested with an installed copy of WeRead.
- **Unverified:** successful network authorization, rendering and scheduling
  on real Android devices. API responses are based on the existing iOS client.
- Widget uses native RemoteViews rather than the iOS WebView/Canvas, to avoid
  blank-image rendering failures.
- Updates are **best-effort**: WorkManager requests approximately one update
  every 4 hours and may be delayed by vendor background restrictions.
- The first launch requires network access. On subsequent failures the last
  cached quote stays visible.
- No analytics, advertising, external backend, or API Key logging.
- Debug APK is unsigned for distribution (Android debug signed only).
- No automated Android emulator/device test currently runs in CI.

## Architecture

- `MainActivity.kt`: API Key setup and manual refresh
- `QuoteApi.kt`: WeRead Gateway calls and weighted selection
- `QuoteStore.kt`: AndroidKeyStore encryption and cached quote
- `QuoteWidgetProvider.kt`: widget updates and rendering
- `RefreshWorker.kt`: background sync
- `OpenQuoteActivity.kt`: safe deep-link launching

Keep platform-specific iOS and Android code separate; they share the API
protocol and sampling design, not Scriptable's APIs.
