package io.github.matie.wereadhighlights

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews

class QuoteWidgetProvider : AppWidgetProvider() {
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

        fun renderAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, QuoteWidgetProvider::class.java)
            )
            val quote = QuoteStore.cached(context)
            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_quote)
                val display = quote?.text ?: if (QuoteStore.apiKey(context) == null) {
                    "打开 WeReadHighlights 设置微信读书 API Key"
                } else {
                    QuoteStore.lastError(context) ?: "正在获取微信读书划线…"
                }
                views.setTextViewText(R.id.quote_text, display)
                val source = quote?.let {
                    "《${it.title}》" + it.author.takeIf { author -> author.isNotBlank() }
                        ?.let { author -> " · $author" }.orEmpty()
                }.orEmpty()
                views.setTextViewText(R.id.source_text, source)

                val openIntent = Intent(context, OpenQuoteActivity::class.java)
                    .putExtra(OpenQuoteActivity.EXTRA_URL, quote?.url.orEmpty())
                    .putExtra(OpenQuoteActivity.EXTRA_HAS_QUOTE, quote != null)
                val open = PendingIntent.getActivity(
                    context, id, openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_root, open)

                // Keep fonts readable when host allocates a small widget.
                val options = manager.getAppWidgetOptions(id)
                val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
                val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 100)
                val size = when {
                    minWidth < 180 || minHeight < 110 -> 14f
                    minHeight > 240 -> 21f
                    else -> 18f
                }
                views.setTextViewTextSize(
                    R.id.quote_text, android.util.TypedValue.COMPLEX_UNIT_SP, size
                )
                manager.updateAppWidget(id, views)
            }
        }
    }
}
