package io.github.matie.wereadhighlights

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView

/**
 * A lightweight native settings screen. No WebView, Compose or API key in HTML.
 * Persisted preferences update every installed widget immediately.
 */
class MainActivity : Activity() {
    private val ink = Color.rgb(38, 58, 72)
    private val blue = Color.rgb(36, 153, 229)
    private val muted = Color.rgb(109, 131, 146)
    private val page = Color.rgb(245, 249, 252)

    private lateinit var statusView: TextView
    private lateinit var previewBody: TextView
    private lateinit var previewTitle: TextView
    private lateinit var previewAuthor: TextView
    private lateinit var keyField: EditText
    private lateinit var saveButton: TextView
    private lateinit var refreshButton: TextView
    private lateinit var refreshDescription: TextView
    private val intervalChips = mutableListOf<Pair<Int, TextView>>()
    private val fontChips = mutableListOf<Pair<Int, TextView>>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = page
        window.navigationBarColor = page
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or
            View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR

        val scroll = ScrollView(this).apply {
            setBackgroundColor(page)
            isFillViewport = true
            clipToPadding = false
        }
        val content = vertical().apply {
            setPadding(20.dp, 26.dp, 20.dp, 38.dp)
        }
        scroll.addView(content)
        setContentView(scroll)

        label(content, "WEREAD  /  HIGHLIGHTS", 12f, blue, true).apply {
            letterSpacing = 0.17f
        }
        space(content, 6)
        label(content, "让读过的句子，再遇见你一次。", 24f, ink, true)
        space(content, 7)
        label(content, "让划线成为桌面上的日常提醒", 14f, muted)
        space(content, 24)

        sectionHeading(content, "摘录预览", "与桌面小组件实时同步")
        createPreview(content)
        space(content, 22)

        sectionHeading(content, "连接微信读书", "API Key 只加密保存在本机")
        val keyCard = card(content)
        label(keyCard, "微信读书 Skill API Key", 15f, ink, true)
        space(keyCard, 9)
        label(keyCard, "已经保存过无需重复填写。修改 Key 会清空旧账号摘录。", 12f, muted)
        space(keyCard, 11)
        keyField = EditText(this).apply {
            hint = "wrk-…  输入新的 API Key"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            isSingleLine = true
            textSize = 14f
            setTextColor(ink)
            setHintTextColor(muted)
            background = rounded(Color.rgb(243, 248, 252), 12)
            setPadding(14.dp, 12.dp, 14.dp, 12.dp)
        }
        keyCard.addView(keyField, LinearLayout.LayoutParams(-1, 48.dp))
        space(keyCard, 12)
        saveButton = actionButton(keyCard, "保存密钥并同步", true) {
            val key = keyField.text.toString().trim()
            if (!key.startsWith("wrk-")) {
                statusView.text = "请输入 wrk- 开头的有效 API Key"
                return@actionButton
            }
            try {
                QuoteStore.saveApiKey(this, key)
                keyField.text.clear()
                RefreshWorker.schedule(this)
                updateQuote()
            } catch (error: Exception) {
                statusView.text = "保存失败：${error.message}"
            }
        }
        space(keyCard, 8)
        actionButton(keyCard, "获取 API Key   ↗", false) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://weread.qq.com/r/weread-skills")))
        }
        space(keyCard, 10)
        statusView = label(keyCard, "", 13f, muted)
        space(content, 22)

        sectionHeading(content, "阅读设置", "修改后同步到三种尺寸的小组件")
        val settings = card(content)
        label(settings, "随机更新周期", 16f, ink, true)
        space(settings, 7)
        refreshDescription = label(settings, "", 12f, muted)
        space(settings, 13)
        val intervalRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val horizontal = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            clipToPadding = false
            addView(intervalRow)
        }
        settings.addView(horizontal, LinearLayout.LayoutParams(-1, 44.dp))
        for (hour in QuoteStore.allowedIntervals) {
            val chip = chip("${hour}h")
            intervalRow.addView(chip, LinearLayout.LayoutParams(-2, 38.dp).apply {
                rightMargin = 7.dp
            })
            intervalChips.add(hour to chip)
            chip.setOnClickListener {
                if (QuoteStore.refreshHours(this) != hour) {
                    QuoteStore.setRefreshHours(this, hour)
                    RefreshWorker.schedule(this)
                    renderSettings()
                    updateQuote() // New slot should take effect immediately.
                }
            }
        }
        space(settings, 16)
        line(settings)
        space(settings, 16)
        label(settings, "摘录正文字号", 16f, ink, true)
        space(settings, 11)
        val fontRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        settings.addView(fontRow, LinearLayout.LayoutParams(-1, 42.dp))
        listOf("紧凑", "标准", "舒展").forEachIndexed { i, name ->
            val item = chip(name)
            fontRow.addView(item, LinearLayout.LayoutParams(0, 38.dp, 1f).apply {
                rightMargin = if (i == 2) 0 else 8.dp
            })
            fontChips.add(i to item)
            item.setOnClickListener {
                QuoteStore.setFontChoice(this, i)
                renderSettings()
                QuoteWidgetProvider.renderAll(this)
            }
        }
        space(settings, 16)
        line(settings)
        space(settings, 12)
        val authorRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val authorTexts = vertical()
        label(authorTexts, "显示作者", 16f, ink, true)
        label(authorTexts, "小号仅显示书名，中号和大号可显示作者", 12f, muted)
        authorRow.addView(authorTexts, LinearLayout.LayoutParams(0, -2, 1f))
        val authorSwitch = Switch(this).apply {
            isChecked = QuoteStore.showAuthor(this@MainActivity)
            setOnCheckedChangeListener { _, enabled ->
                QuoteStore.setShowAuthor(this@MainActivity, enabled)
                showCached()
                QuoteWidgetProvider.renderAll(this@MainActivity)
            }
        }
        authorRow.addView(authorSwitch)
        settings.addView(authorRow)
        space(content, 22)

        sectionHeading(content, "桌面小组件", "在桌面长按空白处 → 小组件")
        val sizes = card(content)
        listOf(
            "S  小号" to "紧凑摘录 · 最多 4 行正文",
            "M  中号" to "标准阅读卡 · 最多 4 行正文",
            "L  大号" to "宽松阅读卡 · 最多 9 行正文"
        ).forEachIndexed { index, (name, detail) ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            val badge = label(row, name.substring(0, 1), 18f, blue, true).apply {
                gravity = Gravity.CENTER
                background = rounded(Color.rgb(233, 247, 255), 12)
            }
            badge.layoutParams = LinearLayout.LayoutParams(46.dp, 46.dp)
            val details = vertical().apply { setPadding(13.dp, 0, 0, 0) }
            label(details, name.substring(3), 15f, ink, true)
            label(details, detail, 12f, muted)
            row.addView(details, LinearLayout.LayoutParams(0, -2, 1f))
            sizes.addView(row)
            if (index < 2) {
                space(sizes, 14)
                line(sizes)
                space(sizes, 14)
            }
        }
        space(content, 22)
        refreshButton = actionButton(content, "换一句划线", true) { updateQuote() }
        space(content, 13)
        label(
            content,
            "后台刷新时间由 Android 决定，可能晚于所设周期；" +
                "网络异常时仍显示上一条划线。",
            12f, muted
        ).gravity = Gravity.CENTER
        renderSettings()
        showCached()
        RefreshWorker.schedule(this)
    }

    private fun createPreview(parent: LinearLayout) {
        val frame = FrameLayout(this).apply {
            minimumHeight = 200.dp
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.rgb(249, 253, 255), Color.rgb(231, 245, 255))
            ).apply { cornerRadius = 22.dp.toFloat() }
            elevation = 2.dp.toFloat()
        }
        parent.addView(frame, LinearLayout.LayoutParams(-1, -2))
        frame.addView(View(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.rgb(49, 167, 244), Color.rgb(121, 205, 255))
            ).apply { cornerRadius = 4.dp.toFloat() }
        }, FrameLayout.LayoutParams(4.dp, -1).apply {
            leftMargin = 18.dp
            topMargin = 19.dp
            bottomMargin = 19.dp
        })
        // Same vector and near-accent placement as the home-screen medium
        // widget: unlike a font glyph this has no hidden font/baseline padding.
        frame.addView(ImageView(this).apply {
            setImageResource(R.drawable.widget_quote_mark)
            scaleType = ImageView.ScaleType.FIT_XY
            contentDescription = null
        }, FrameLayout.LayoutParams(37.dp, 30.dp).apply {
            leftMargin = 29.dp
            topMargin = 15.dp
        })
        val inner = vertical().apply {
            setPadding(40.dp, 28.dp, 21.dp, 19.dp)
        }
        frame.addView(inner, FrameLayout.LayoutParams(-1, -2))
        previewBody = label(inner, "", 19f, ink)
        previewBody.maxLines = 6
        previewBody.ellipsize = TextUtils.TruncateAt.END
        previewBody.setLineSpacing(5.dp.toFloat(), 1f)
        space(inner, 22)
        line(inner)
        space(inner, 10)
        val footer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
        }
        inner.addView(footer, LinearLayout.LayoutParams(-1, -2))
        previewTitle = TextView(this).apply {
            textSize = 14f
            setTextColor(blue)
            gravity = Gravity.END
            isSingleLine = true
            includeFontPadding = false
            ellipsize = TextUtils.TruncateAt.END
        }
        footer.addView(previewTitle, LinearLayout.LayoutParams(0, -2, 1f))
        previewAuthor = TextView(this).apply {
            textSize = 12f
            setTextColor(Color.rgb(113, 134, 149))
            gravity = Gravity.END
            isSingleLine = true
            includeFontPadding = false
            ellipsize = TextUtils.TruncateAt.END
            maxWidth = 118.dp
        }
        footer.addView(previewAuthor, LinearLayout.LayoutParams(-2, -2))
    }

    private fun renderSettings() {
        val interval = QuoteStore.refreshHours(this)
        refreshDescription.text = "每 ${interval} 小时进入新的随机时段 · 系统可能延后后台更新"
        intervalChips.forEach { (hour, chip) -> styleChip(chip, hour == interval) }
        fontChips.forEach { (choice, chip) ->
            styleChip(chip, choice == QuoteStore.fontChoice(this))
        }
        if (::previewBody.isInitialized) previewBody.textSize = 19f * QuoteStore.fontScale(this)
    }

    override fun onResume() {
        super.onResume()
        if (::statusView.isInitialized) showCached()
    }

    private fun showCached() {
        val quote = QuoteStore.cached(this)
        previewBody.text = quote?.text ?: "那些值得记住的句子，会在这里重新出现。"
        previewTitle.text = quote?.let { "《${it.title}》" }.orEmpty()
        val author = quote?.author.orEmpty()
        val displayAuthor = QuoteStore.showAuthor(this) && author.isNotBlank()
        previewAuthor.visibility = if (displayAuthor) View.VISIBLE else View.GONE
        previewAuthor.text = if (displayAuthor) " · $author" else ""
        statusView.text = if (QuoteStore.apiKey(this) == null) {
            "尚未连接 · 输入密钥开始同步"
        } else {
            QuoteStore.lastError(this)?.let { "上次刷新提示：$it" }
                ?: "已安全连接 · API Key 已保存在本机"
        }
    }

    private fun updateQuote() {
        if (QuoteStore.apiKey(this) == null) {
            statusView.text = "请先保存微信读书 API Key"
            return
        }
        saveButton.isEnabled = false
        refreshButton.isEnabled = false
        statusView.text = "正在连接微信读书并抽取划线…"
        Thread {
            val result = try {
                QuoteApi.fetch(applicationContext, force = true)
                QuoteWidgetProvider.renderAll(applicationContext)
                "新划线已同步到桌面"
            } catch (error: Exception) {
                val message = error.message ?: "未知错误"
                QuoteStore.saveError(applicationContext, message)
                QuoteWidgetProvider.renderAll(applicationContext)
                "刷新失败：$message（已保留上一条划线）"
            }
            runOnUiThread {
                saveButton.isEnabled = true
                refreshButton.isEnabled = true
                showCached()
                statusView.text = result
            }
        }.start()
    }

    private fun vertical() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
    }

    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius.dp.toFloat()
    }

    private fun label(
        parent: LinearLayout, value: String, size: Float,
        color: Int, bold: Boolean = false
    ): TextView {
        val view = TextView(this).apply {
            text = value
            textSize = size
            setTextColor(color)
            includeFontPadding = false
            if (bold) typeface = Typeface.DEFAULT_BOLD
        }
        parent.addView(view, LinearLayout.LayoutParams(-1, -2))
        return view
    }

    private fun sectionHeading(parent: LinearLayout, title: String, hint: String) {
        val row = vertical()
        label(row, title, 18f, ink, true)
        space(row, 5)
        label(row, hint, 12f, muted)
        parent.addView(row)
        space(parent, 12)
    }

    private fun card(parent: LinearLayout): LinearLayout {
        val inner = vertical().apply {
            setPadding(19.dp, 19.dp, 19.dp, 19.dp)
            background = rounded(Color.WHITE, 20)
            elevation = 2.dp.toFloat()
        }
        parent.addView(inner, LinearLayout.LayoutParams(-1, -2))
        return inner
    }

    private fun line(parent: LinearLayout) {
        parent.addView(View(this).apply {
            setBackgroundColor(Color.rgb(225, 236, 242))
        }, LinearLayout.LayoutParams(-1, 1.dp))
    }

    private fun space(parent: LinearLayout, height: Int) {
        parent.addView(View(this), LinearLayout.LayoutParams(1, height.dp))
    }

    private fun chip(value: String) = TextView(this).apply {
        text = value
        gravity = Gravity.CENTER
        textSize = 14f
        setPadding(14.dp, 6.dp, 14.dp, 6.dp)
        isClickable = true
    }

    private fun styleChip(view: TextView, selected: Boolean) {
        view.background = rounded(
            if (selected) Color.rgb(36, 153, 229) else Color.rgb(239, 246, 250), 11
        )
        view.setTextColor(if (selected) Color.WHITE else ink)
        view.typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    }

    private fun actionButton(
        parent: LinearLayout, text: String, filled: Boolean,
        action: () -> Unit
    ): TextView {
        val view = TextView(this).apply {
            this.text = text
            gravity = Gravity.CENTER
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(if (filled) Color.WHITE else blue)
            background = rounded(
                if (filled) blue else Color.rgb(234, 247, 254), 13
            )
            isClickable = true
            setOnClickListener { action() }
        }
        parent.addView(view, LinearLayout.LayoutParams(-1, 48.dp))
        return view
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density + 0.5f).toInt()
}
