package io.github.matie.wereadhighlights

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast

/** Safely handles the optional iOS-origin WeRead deep link on Android. */
class OpenQuoteActivity : Activity() {
    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_HAS_QUOTE = "has_quote"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent.getStringExtra(EXTRA_URL).orEmpty()
        if (url.isNotBlank() && (url.startsWith("weread://") || url.startsWith("https://"))) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                finish()
                return
            } catch (_: ActivityNotFoundException) {
                Toast.makeText(this, "未找到能够打开微信读书链接的应用", Toast.LENGTH_LONG).show()
            } catch (_: SecurityException) {
                Toast.makeText(this, "微信读书不支持此跳转链接", Toast.LENGTH_LONG).show()
            }
        } else if (intent.getBooleanExtra(EXTRA_HAS_QUOTE, false)) {
            Toast.makeText(this, "此条划线暂时没有可用的跳转链接", Toast.LENGTH_LONG).show()
        }
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
