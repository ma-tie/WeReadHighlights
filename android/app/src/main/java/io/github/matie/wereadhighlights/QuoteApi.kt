package io.github.matie.wereadhighlights

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Uses the same WeChat Reading Skill Gateway and weighted sampling as the iOS script.
 * Network work must run off the Android main thread (Activity thread or Worker).
 */
object QuoteApi {
    private const val GATEWAY = "https://i.weread.qq.com/api/agent/gateway"

    private fun call(context: Context, endpoint: String, params: JSONObject = JSONObject()): JSONObject {
        val token = QuoteStore.apiKey(context) ?: error("请先设置微信读书 API Key")
        var version = QuoteStore.skillVersion(context)
        repeat(2) { attempt ->
            val payload = JSONObject()
                .put("api_name", endpoint)
                .put("skill_version", version)
            val keys = params.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                payload.put(key, params.get(key))
            }

            val connection = URL(GATEWAY).openConnection() as HttpURLConnection
            try {
                connection.requestMethod = "POST"
                connection.connectTimeout = 15000
                connection.readTimeout = 20000
                connection.doOutput = true
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { out ->
                    out.write(payload.toString().toByteArray(Charsets.UTF_8))
                }
                val httpCode = connection.responseCode
                val stream = if (httpCode in 200..299) connection.inputStream else connection.errorStream
                val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                if (httpCode !in 200..299) {
                    error("微信读书接口 HTTP $httpCode")
                }
                val response = JSONObject(body)
                val upgrade = response.optJSONObject("upgrade_info")
                if (upgrade != null) {
                    val latest = upgrade.optString("latest_version")
                    if (attempt == 0 && latest.isNotBlank() && latest != version) {
                        version = latest
                        QuoteStore.saveSkillVersion(context, latest)
                        return@repeat
                    }
                    error(upgrade.optString("message").ifBlank { "微信读书 Skill 版本不兼容" })
                }
                val errcode = response.optInt("errcode", 0)
                if (errcode != 0) {
                    error(response.optString("errmsg").ifBlank { "微信读书 API 错误 $errcode" })
                }
                QuoteStore.saveSkillVersion(context, version)
                return response
            } finally {
                connection.disconnect()
            }
        }
        error("微信读书 Skill 自动升级失败")
    }

    private fun notebooks(context: Context): List<JSONObject> {
        val result = mutableListOf<JSONObject>()
        var lastSort: Any? = null
        // Defensive pagination bound and cursor loop check.
        repeat(100) {
            val params = JSONObject().put("count", 100)
            if (lastSort != null) params.put("lastSort", lastSort)
            val page = call(context, "/user/notebooks", params)
            val books = page.optJSONArray("books") ?: JSONArray()
            for (i in 0 until books.length()) {
                val book = books.optJSONObject(i) ?: continue
                if (book.optInt("noteCount", 0) > 0) result.add(book)
            }
            if (!page.optBoolean("hasMore") || books.length() == 0) return result
            val next = books.optJSONObject(books.length() - 1)?.opt("sort") ?: return result
            if (next == lastSort) return result
            lastSort = next
        }
        return result
    }

    private fun chooseBook(books: List<JSONObject>): JSONObject {
        val weights = books.map { it.optInt("noteCount", 0) }
        return books[WeightedSampler.pickIndex(weights)]
    }

    private fun getVid(context: Context, books: List<JSONObject>, preferred: JSONObject): String? {
        QuoteStore.userVid(context)?.let { return it }
        val ordered = listOf(preferred) + books.filter { it.optString("bookId") != preferred.optString("bookId") }
        // A missing personal review must not prevent showing a quote.
        for (book in ordered.take(8)) {
            try {
                val reviews = call(
                    context, "/review/list/mine",
                    JSONObject().put("bookid", book.optString("bookId")).put("count", 20)
                ).optJSONArray("reviews") ?: continue
                for (i in 0 until reviews.length()) {
                    val item = reviews.optJSONObject(i) ?: continue
                    val author = item.optJSONObject("review")?.optJSONObject("author")
                        ?: item.optJSONObject("author")
                    val vid = author?.optString("userVid").orEmpty()
                    if (vid.isNotBlank()) {
                        QuoteStore.saveUserVid(context, vid)
                        return vid
                    }
                }
            } catch (_: Exception) {
                // Some books have no personal reviews.
            }
        }
        return null
    }

    private fun bookmarkUrl(
        bookId: String, chapter: Any?, range: String, vid: String?
    ): String? {
        if (chapter == null || chapter == JSONObject.NULL || vid.isNullOrBlank()) return null
        val parts = range.split("-")
        if (parts.size != 2) return null
        fun esc(value: String) = java.net.URLEncoder.encode(value, "UTF-8")
        return "weread://bestbookmark?bookId=${esc(bookId)}" +
            "&chapterUid=${esc(chapter.toString())}&rangeStart=${esc(parts[0])}" +
            "&rangeEnd=${esc(parts[1])}&userVid=${esc(vid)}"
    }

    fun fetch(context: Context, force: Boolean = false): Quote {
        val slot = QuoteStore.currentSlot()
        val cached = QuoteStore.cached(context)
        if (!force && cached?.slot == slot) return cached

        val books = notebooks(context)
        require(books.isNotEmpty()) { "没有找到微信读书划线" }

        // Some notebook entries contain thoughts but no nonempty bookmarks.
        repeat(5) {
            val book = chooseBook(books)
            val bookId = book.optString("bookId")
            if (bookId.isBlank()) return@repeat
            val marks = call(
                context, "/book/bookmarklist",
                JSONObject().put("bookId", bookId)
            ).optJSONArray("updated") ?: JSONArray()
            val usable = (0 until marks.length())
                .mapNotNull { marks.optJSONObject(it) }
                .filter { it.optString("markText").isNotBlank() }
            if (usable.isEmpty()) return@repeat

            val selected = usable.random()
            val info = book.optJSONObject("book")
            val title = info?.optString("title").orEmpty().ifBlank { "未知书名" }
            val author = info?.optString("author").orEmpty()
            val vid = getVid(context, books, book)
            var url = bookmarkUrl(
                bookId,
                selected.opt("chapterUid"),
                selected.optString("range"),
                vid
            )
            if (url == null) {
                url = try {
                    call(context, "/book/info", JSONObject().put("bookId", bookId))
                        .optString("deepLink").takeIf { it.isNotBlank() }
                } catch (_: Exception) {
                    null
                }
            }
            val quote = Quote(
                text = selected.optString("markText").trim(),
                title = title,
                author = author,
                url = url ?: "",
                slot = slot
            )
            QuoteStore.saveQuote(context, quote)
            return quote
        }
        error("抽中的书籍没有可显示的划线，请稍后重试")
    }
}
