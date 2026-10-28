package io.github.matie.wereadhighlights

import android.app.Activity
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var quoteView: TextView
    private lateinit var keyField: EditText
    private lateinit var saveButton: Button
    private lateinit var refreshButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val scroll = ScrollView(this)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28.dp, 32.dp, 28.dp, 28.dp)
        }
        scroll.addView(column)
        setContentView(scroll)

        fun heading(text: String, size: Float) {
            column.addView(TextView(this).apply {
                this.text = text
                textSize = size
                setTextColor(0xff263a48.toInt())
                setPadding(0, 0, 0, 12.dp)
            })
        }
        heading("WeReadHighlights", 25f)
        heading("随机回顾微信读书划线。API Key 仅加密存储在本机，不上传到我们的服务器。", 14f)
        heading("1. 从 weread.qq.com/r/weread-skills 获取 wrk- 开头的 API Key。", 14f)

        keyField = EditText(this).apply {
            hint = "wrk-...（已保存的密钥不会回显）"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            setSingleLine(true)
        }
        column.addView(keyField)

        saveButton = Button(this).apply {
            text = "保存 API Key 并获取划线"
            setOnClickListener {
                val value = keyField.text.toString().trim()
                if (!value.startsWith("wrk-")) {
                    status.text = "请输入有效的 wrk- 开头的 API Key"
                    return@setOnClickListener
                }
                try {
                    QuoteStore.saveApiKey(this@MainActivity, value)
                    keyField.text.clear()
                    RefreshWorker.schedule(this@MainActivity)
                    updateQuote(force = true)
                } catch (error: Exception) {
                    status.text = "保存失败：${error.message}"
                }
            }
        }
        column.addView(saveButton)

        refreshButton = Button(this).apply {
            text = "立即随机刷新"
            setOnClickListener { updateQuote(force = true) }
        }
        column.addView(refreshButton)

        status = TextView(this).apply {
            textSize = 14f
            setPadding(0, 12.dp, 0, 12.dp)
        }
        column.addView(status)

        heading("当前摘录", 17f)
        quoteView = TextView(this).apply {
            textSize = 19f
            setTextColor(0xff263a48.toInt())
            setPadding(16.dp, 24.dp, 16.dp, 24.dp)
            setBackgroundColor(0xffeaf7ff.toInt())
        }
        column.addView(
            quoteView, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            )
        )
        heading("2. 长按 Android 桌面空白处 → 小组件 → WeReadHighlights，添加后即可显示。后台每约 4 小时更新，具体时间由 Android 控制。", 14f)
        showCached()
        RefreshWorker.schedule(this)
    }

    override fun onResume() {
        super.onResume()
        if (::quoteView.isInitialized) showCached()
    }

    private fun showCached() {
        val quote = QuoteStore.cached(this)
        quoteView.text = if (quote == null) {
            "尚无划线，保存 API Key 后点击获取。"
        } else {
            quote.text + "\n\n《" + quote.title + "》" +
                quote.author.takeIf { it.isNotBlank() }?.let { " · $it" }.orEmpty()
        }
        status.text = if (QuoteStore.apiKey(this) == null) {
            "尚未设置 API Key"
        } else {
            QuoteStore.lastError(this) ?: "API Key 已保存"
        }
    }

    private fun updateQuote(force: Boolean) {
        if (QuoteStore.apiKey(this) == null) {
            status.text = "请先保存 API Key"
            return
        }
        saveButton.isEnabled = false
        refreshButton.isEnabled = false
        status.text = "正在获取划线…"
        Thread {
            val result = try {
                QuoteApi.fetch(applicationContext, force)
                QuoteWidgetProvider.renderAll(applicationContext)
                "刷新成功"
            } catch (error: Exception) {
                val message = error.message ?: "未知错误"
                QuoteStore.saveError(applicationContext, message)
                QuoteWidgetProvider.renderAll(applicationContext)
                "刷新失败：$message（已保留旧摘录）"
            }
            runOnUiThread {
                saveButton.isEnabled = true
                refreshButton.isEnabled = true
                showCached()
                status.text = result
            }
        }.start()
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density + 0.5f).toInt()
}
