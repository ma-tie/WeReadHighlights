package io.github.matie.wereadhighlights

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews

/** Medium keeps the original receiver name, so previously installed widgets survive upgrades. */
open class QuoteWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        super.onUpdate(context, manager, ids)
        renderAll(context)
        RefreshWorker.schedule(context)
        RefreshWorker.refreshNow(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context, manager: AppWidgetManager, widgetId: Int, newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, manager, widgetId, newOptions)
        renderAll(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) RefreshWorker.refreshNow(context, force = true)
    }

    companion object {
        const val ACTION_REFRESH = "io.github.matie.wereadhighlights.REFRESH"

        private data class Style(
            val provider: Class<out AppWidgetProvider>,
            val layout: Int,
            val bodySp: Float,
            val sourceTitleSp: Float,
            val sourceAuthorSp: Float,
            val showAuthor: Boolean
        )

        private val styles = listOf(
            Style(QuoteWidgetSmallProvider::class.java, R.layout.widget_quote_small, 16f, 12f, 11f, false),
            Style(QuoteWidgetProvider::class.java, R.layout.widget_quote, 19f, 14f, 12f, true),
            Style(QuoteWidgetLargeProvider::class.java, R.layout.widget_quote_large, 23f, 17f, 14f, true)
        )

        fun renderAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val quote = QuoteStore.cached(context)
            val text = quote?.text ?: if (QuoteStore.apiKey(context) == null) {
                "打开 WeReadHighlights 设置微信读书 API Key"
            } else {
                QuoteStore.lastError(context) ?: "正在获取微信读书划线…"
            }
            val scale = QuoteStore.fontScale(context)
            val allowAuthor = QuoteStore.showAuthor(context)

            for (style in styles) {
                val ids = manager.getAppWidgetIds(ComponentName(context, style.provider))
                for (id in ids) {
                    val views = RemoteViews(context.packageName, style.layout)
                    views.setTextViewText(R.id.quote_text, text)
                    views.setTextViewText(
                        R.id.source_title, quote?.let { "《${it.title}》" }.orEmpty()
                    )
                    // A separate author view reserves its width, so longer titles
                    // are ellipsized instead of making the attribution disappear.
                    val author = quote?.author.orEmpty()
                    val displayAuthor = style.showAuthor && allowAuthor && author.isNotBlank()
                    views.setViewVisibility(
                        R.id.source_author, if (displayAuthor) View.VISIBLE else View.GONE
                    )
                    views.setTextViewText(
                        R.id.source_author, if (displayAuthor) " · $author" else ""
                    )
                    views.setTextViewTextSize(
                        R.id.quote_text, TypedValue.COMPLEX_UNIT_SP, style.bodySp * scale
                    )
                    views.setTextViewTextSize(
                        R.id.source_title, TypedValue.COMPLEX_UNIT_SP, style.sourceTitleSp
                    )
                    views.setTextViewTextSize(
                        R.id.source_author, TypedValue.COMPLEX_UNIT_SP, style.sourceAuthorSp
                    )

                    val openIntent = Intent(context, OpenQuoteActivity::class.java)
                        .putExtra(OpenQuoteActivity.EXTRA_URL, quote?.url.orEmpty())
                        .putExtra(OpenQuoteActivity.EXTRA_HAS_QUOTE, quote != null)
                    views.setOnClickPendingIntent(
                        R.id.widget_root,
                        PendingIntent.getActivity(
                            context, id, openIntent,
                            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                        )
                    )
                    manager.updateAppWidget(id, views)
                }
            }
        }
    }
}

class QuoteWidgetSmallProvider : QuoteWidgetProvider()
class QuoteWidgetLargeProvider : QuoteWidgetProvider()
