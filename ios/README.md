# WeReadHighlights · iOS / Scriptable

iOS 版本使用 [Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188) 运行 JavaScript，
不需要安装额外的 iOS App 或部署服务器。

## 安装使用

1. 在 [GitHub Releases](https://github.com/ma-tie/WeReadHighlights/releases/latest) 下载 **`WeReadHighlights.js`**。
2. 安装 Scriptable，将脚本导入或复制到新建的脚本，命名为 `WeReadHighlights`。
3. 在 Scriptable 内手动运行一次，输入微信读书 [Skill API Key](https://weread.qq.com/r/weread-skills)（以 `wrk-` 开头）。
4. 在 iPhone 桌面添加 Small / Medium / Large 尺寸的 Scriptable 小组件。
5. 长按小组件 → **编辑小组件**，在 **Script** 中选择 `WeReadHighlights`，**When Interacting** 设为 **Run Script**。

项目主页提供 [配置截图与效果演示](../README.md#效果展示)。

## 配置

在当前目录的 [`WeReadHighlights.js`](WeReadHighlights.js) 顶部修改：

```javascript
const REFRESH_INTERVAL_HOURS = 4;
```

支持 `1 / 2 / 3 / 4 / 6 / 8 / 12 / 24` 小时。该参数用于划分缓存时段，
iOS 小组件的实际刷新时间仍由系统决定。

脚本从微信读书 Skill API 随机选取个人划线，本地缓存摘录。
API Key 和 `userVid` 保存在 Scriptable 可访问的 Keychain 中；
点击小组件会尝试打开对应微信读书原文，必要时退化为书籍级跳转。

## 开发与发布

- **源码：** `ios/WeReadHighlights.js`
- **iOS 版本号：** 脚本中的 `APP_VERSION`，与 Android `versionName` 独立。
- **统一发布批次：** 仓库根目录 `VERSION`，每个 GitHub Release 同时附带 `WeReadHighlights.js` 与签名 Android APK。
- **源码 PDF 导出：** 在仓库根目录运行 `python3 -m pip install -r tools/requirements.txt`，
  再运行 `python3 tools/export_source_pdf.py`。工具默认读取本目录脚本，输出到根目录的 `WeReadHighlights.pdf`。

**注意：** 移动仓库内文件路径不会改变已经导入 Scriptable 的本地脚本；
历史 Release `v0.2.3` 中的附件名称和下载地址也保持不变。
