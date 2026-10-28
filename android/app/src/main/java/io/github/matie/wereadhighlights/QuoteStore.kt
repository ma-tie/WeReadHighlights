package io.github.matie.wereadhighlights

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class Quote(
    val text: String,
    val title: String,
    val author: String,
    val url: String,
    val slot: String
)

object QuoteStore {
    private const val PREFS = "weread_highlights"
    private const val KEY_ALIAS = "weread_highlights_api_key_v1"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // An AndroidKeyStore-backed AES key protects the persisted API token.
    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = store.getKey(KEY_ALIAS, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    fun saveApiKey(context: Context, value: String) {
        val key = value.trim()
        require(key.startsWith("wrk-")) { "API Key 必须以 wrk- 开头" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(key.toByteArray(Charsets.UTF_8))
        val payload = cipher.iv + encrypted
        val changedAccount = apiKey(context) != key
        val editor = prefs(context).edit()
            .putString("api_key", Base64.encodeToString(payload, Base64.NO_WRAP))
        if (changedAccount) {
            editor.remove("user_vid")
                .remove("quote")
                .remove("title")
                .remove("author")
                .remove("url")
                .remove("slot")
                .remove("skill_version")
                .remove("last_error")
        }
        editor.apply()
    }

    fun apiKey(context: Context): String? {
        val value = prefs(context).getString("api_key", null) ?: return null
        return try {
            val payload = Base64.decode(value, Base64.DEFAULT)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(
                Cipher.DECRYPT_MODE, secretKey(),
                GCMParameterSpec(128, payload.copyOfRange(0, 12))
            )
            String(cipher.doFinal(payload.copyOfRange(12, payload.size)), Charsets.UTF_8)
        } catch (_: Exception) {
            null // e.g. a restored preference without its AndroidKeyStore key
        }
    }

    fun skillVersion(context: Context): String =
        prefs(context).getString("skill_version", "1.0.5") ?: "1.0.5"

    fun saveSkillVersion(context: Context, version: String) {
        prefs(context).edit().putString("skill_version", version).apply()
    }

    fun userVid(context: Context): String? = prefs(context).getString("user_vid", null)

    fun saveUserVid(context: Context, vid: String) {
        prefs(context).edit().putString("user_vid", vid).apply()
    }

    fun currentSlot(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()) +
            "-4h-" + (java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY) / 4)

    fun cached(context: Context): Quote? {
        val p = prefs(context)
        val text = p.getString("quote", null)?.takeIf { it.isNotBlank() } ?: return null
        return Quote(
            text = text,
            title = p.getString("title", "") ?: "",
            author = p.getString("author", "") ?: "",
            url = p.getString("url", "") ?: "",
            slot = p.getString("slot", "") ?: ""
        )
    }

    fun saveQuote(context: Context, quote: Quote) {
        prefs(context).edit()
            .putString("quote", quote.text)
            .putString("title", quote.title)
            .putString("author", quote.author)
            .putString("url", quote.url)
            .putString("slot", quote.slot)
            .remove("last_error")
            .apply()
    }

    fun saveError(context: Context, error: String) {
        prefs(context).edit().putString("last_error", error.take(160)).apply()
    }

    fun lastError(context: Context): String? =
        prefs(context).getString("last_error", null)
}
