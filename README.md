<div align="center">

# 📚 WeReadHighlights

**把微信读书里曾经划过的句子，重新带回你的 iPhone 桌面。**

随机展示你在微信读书中的个人划线，按设定周期自动更新；点击 小组件，可直接跳回微信读书中的原文位置。

![iOS](https://img.shields.io/badge/iOS-%E5%B0%8F%E7%BB%84%E4%BB%B6-000000?logo=apple&logoColor=white)
![Scriptable](https://img.shields.io/badge/Scriptable-JavaScript-2F80ED)
![WeRead](https://img.shields.io/badge/微信读书-Highlights-20B875)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## ✨ 它能做什么？

WeReadHighlights 是一个基于 **Scriptable + 微信读书 Skill API** 的 iPhone 小组件。

它会从你自己的微信读书划线中随机抽取一条，在桌面或锁屏上展示。刷新周期可以在脚本顶部自行配置，默认每 4 小时更新一次。

最重要的是：**它不只是展示一句摘录。**

点击 小组件 后，会利用划线对应的书籍、章节和文本范围信息，直接跳回微信读书中的原文位置，方便你重新进入上下文继续阅读。

> 📷 **效果截图待补充**
>
> 后续图片位置：<code>docs/images/widget-preview.png</code>

---

## 🌟 功能亮点

| 功能 | 说明 |
| --- | --- |
| 🎲 随机回顾 | 从自己的微信读书个人划线中随机选择 |
| ⏱️ 刷新周期可配置 | 默认 4 小时，可改为 1 / 2 / 3 / 4 / 6 / 8 / 12 / 24 小时 |
| 🔁 有放回抽样 | 每个新时段独立随机，允许再次抽到以前出现过的句子 |
| 🧠 尽量全局等概率 | 按每本书的划线数量加权选书，再在书内均匀抽取 |
| 📖 精确跳回原文 | 点击 小组件 可定位到对应书籍、章节和划线范围 |
| 🎨 中文阅读样式 | 浅蓝白背景、楷体正文、背景大引号、书名与作者同一行 |
| 📱 桌面 + 锁屏 | 支持主屏幕 Medium 小组件 与锁屏矩形 小组件 |
| 🔐 本地保存凭据 | API Key 与 userVid 使用 iOS Keychain 保存，不写入脚本源码 |

---

## 🖼️ 效果展示

### 桌面 小组件

> 📷 **截图待补充：桌面 Medium 小组件**
>
> 建议文件名：<code>docs/images/widget-preview.png</code>

### 点击后跳回原文

> 📷 **截图待补充：点击 小组件 后在微信读书中精确定位划线**
>
> 建议文件名：<code>docs/images/deeplink-demo.png</code>

---

## 🧩 工作原理

<pre>
微信读书个人划线
        ↓
获取所有有笔记的书籍
        ↓
按 noteCount 加权随机选书
        ↓
在该书个人划线中均匀随机一条
        ↓
缓存当前刷新时段
        ↓
iPhone 小组件 展示
        ↓
点击 小组件
        ↓
跳回微信读书原文
</pre>

当前实现会先按微信读书返回的 <code>noteCount</code> 对书籍进行加权，再从选中书籍的个人划线中均匀随机一条。这样避免“每本书概率相同”导致划线很少的书被过度抽中。

同一刷新时段内会使用缓存，因此系统多次刷新 小组件 时不会不断换句子。进入下一个时段后重新随机，属于**独立、有放回抽样**。

---

# 🚀 安装

## 1. 安装 Scriptable

在 iPhone App Store 中安装 **Scriptable**。

Scriptable 是一个可以用 JavaScript 创建 iOS 小组件 的应用，本项目的所有逻辑都运行在 Scriptable 中。

> 📷 **截图待补充：Scriptable App**
>
> 建议文件名：<code>docs/images/setup-scriptable.png</code>

---

## 2. 获取微信读书 Skill API Key

本项目通过腾讯官方 **WeChatReading Skill Gateway** 获取你的书籍与个人划线数据。

获取一个以 <code>wrk-</code> 开头的 API Key。

首次运行脚本时，WeReadHighlights 会弹窗要求输入 API Key，并将它保存到 iOS Keychain 中。

**不要把自己的 API Key 提交到 GitHub，也不要分享给其他人。**

> 📷 **截图待补充：获取 / 填写 API Key**
>
> 建议文件名：<code>docs/images/setup-api-key.png</code>

---

## 3. 导入脚本

打开仓库中的：

**<code>WeReadHighlights.js</code>**

复制全部代码，在 Scriptable 中新建一个 Script，并粘贴进去。

推荐将 Script 命名为：

**WeReadHighlights**

第一次在 Scriptable 中手动运行时：

1. 输入微信读书 API Key；
2. 脚本读取你的微信读书划线；
3. 自动寻找并保存你的 <code>userVid</code>；
4. 随机生成第一条摘录；
5. 显示 小组件 预览。

API Key 和 userVid 都保存在 Keychain 中，之后不需要重复输入。

---

## 4. 添加桌面 小组件

在 iPhone 主屏幕长按空白区域：

1. 添加 小组件；
2. 搜索 **Scriptable**；
3. 选择 **Medium** 尺寸；
4. 添加到桌面；
5. 长按 小组件 → 编辑 小组件；
6. Script 选择 **WeReadHighlights**。

> 📷 **截图待补充：Scriptable 小组件 配置**
>
> 建议文件名：<code>docs/images/widget-config.png</code>

---

## 5. 点击 小组件 回到原文

当抽中的划线包含完整定位信息时，脚本会生成类似：

<pre>
weread://bestbookmark
  ?bookId=...
  &chapterUid=...
  &rangeStart=...
  &rangeEnd=...
  &userVid=...
</pre>

点击 小组件 后，iOS 会打开微信读书，并定位到对应划线所在的位置。

如果某条数据缺少精确定位所需字段，脚本会尝试退化为微信读书返回的书籍级 <code>deepLink</code>。

> 📷 **截图待补充：精确跳转原文**
>
> 建议文件名：<code>docs/images/deeplink-demo.png</code>

---

# ⏰ 刷新周期

默认刷新周期为 **4 小时**，但这只是默认配置，不是固定行为。

打开 <code>WeReadHighlights.js</code>，修改顶部的：

<pre>
const REFRESH_INTERVAL_HOURS = 4;
</pre>

目前支持：

<pre>
1 / 2 / 3 / 4 / 6 / 8 / 12 / 24 小时
</pre>

例如：

<pre>
const REFRESH_INTERVAL_HOURS = 2;
</pre>

表示每天按 2 小时划分刷新时段；进入新的时段后，会重新随机一条划线。

同一个刷新时段内使用缓存，因此即使 iOS 多次刷新 小组件，内容也不会不断变化。

需要注意：iOS 对 小组件 后台刷新拥有最终调度权。脚本会通过 <code>refreshAfterDate</code> 请求在下一个刷新时段开始后更新，但**实际刷新时间可能被 iOS 延后**。因此配置项控制的是摘录的刷新时段，而不是保证系统在整点精确执行。

---

# 🎨 当前样式

主屏幕 Medium 小组件 当前采用：

- 660 × 312 Canvas；
- 浅蓝 → 白色渐变背景；
- 左侧蓝色竖向装饰线；
- 半透明大型开引号；
- 33 px 中文楷体正文；
- 46 px 行距；
- 最多显示 4 行；
- 超出部分仅视觉截断并显示省略号；
- 底部书名与作者同一行；
- 点击整张卡片跳回微信读书。

原始划线文本不会因为 小组件 的视觉截断而被修改。

---

# 🔐 隐私与安全

WeReadHighlights 不要求你把微信读书 API Key 写在代码中。

首次输入后：

- API Key 保存于 Scriptable 可访问的 **iOS Keychain**；
- userVid 同样保存在 Keychain；
- 当前刷新时段的摘录缓存在本机；
- 项目代码不会主动把 API Key 上传到第三方服务器。

代码仓库中**不应包含任何真实 API Key、userVid 或个人阅读数据**。

如果你曾经在公开场合暴露 API Key，建议立即更换。

---

# ❓ 常见问题

### 为什么没有严格按照我配置的周期整点变化？

小组件 后台刷新由 iOS 控制，应用只能请求一个建议刷新时间，不能保证精确执行。

### 为什么连续两个时段可能出现同一句？

这是设计行为。当前采用**有放回随机抽样**，不同时间段之间互相独立。

### 为什么同一个刷新时段手动刷新后还是同一句？

脚本会缓存当前时段的结果，避免 iOS 多次刷新导致一句话不停变化。

### 为什么正文只显示 4 行？

Medium 小组件 空间有限。长划线只在视觉上被截断，点击后仍然会跳到完整原文。

### API Key 会不会出现在 GitHub？

不会。脚本通过运行时弹窗获取 API Key，并保存到 Keychain。请不要自己把 Key 写进源码后再提交。

### 点击后为什么只能打开书，不能定位划线？

精确跳转依赖 <code>bookId</code>、<code>chapterUid</code>、<code>range</code> 和 <code>userVid</code>。如果某条划线缺少这些信息，会退化为书籍级跳转。

---

# 📂 项目结构

<pre>
WeReadHighlights/
├── WeReadHighlights.js
├── README.md
├── LICENSE
├── .gitignore
└── docs/
    └── images/
        ├── widget-preview.png
        ├── setup-api-key.png
        ├── setup-scriptable.png
        ├── widget-config.png
        └── deeplink-demo.png
</pre>

<code>docs/images/</code> 中的图片将在后续补充。

---

# 🛠️ 依赖

- iOS
- Scriptable
- 微信读书
- 腾讯微信读书 Skill API

本项目没有 npm 依赖，也不需要服务器。

---

# 🤝 贡献

欢迎提交 Issue 或 Pull Request。

如果你有新的 小组件 样式、抽样策略、锁屏布局，或者发现某些书籍无法正确跳转，也欢迎一起完善。

---

# 📄 License

本项目采用 **MIT License** 开源。

---

<div align="center">

**让读过的句子，再遇见你一次。**

</div>
