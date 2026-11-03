package de.feuerwehrwasser.h2o

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.net.ssl.HttpsURLConnection

// Scoped grant only; the full WebView session never leaves the portal.
internal object WidgetReplyCipher {
    @Synchronized private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("h2o-widget-reply", null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("h2o-widget-reply", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun encrypt(token: String): String = Cipher.getInstance("AES/GCM/NoPadding").run {
        init(Cipher.ENCRYPT_MODE, key())
        Base64.encodeToString(iv + doFinal(token.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
    }
    fun decrypt(value: String): String = Cipher.getInstance("AES/GCM/NoPadding").run {
        val bytes = Base64.decode(value, Base64.NO_WRAP)
        init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        String(doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
    }
}

class WidgetReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val eventID = intent.getStringExtra("event") ?: return
        val action = intent.getStringExtra("response") ?: return
        if (!WidgetEvent.validID(eventID) || action !in setOf("yes", "excused", "maybe", "edit", "retry")) return
        synchronized(WidgetStore) {
            val now = System.currentTimeMillis()
            val snapshot = WidgetStore.read(context, now) ?: return
            val event = snapshot.event?.takeIf { it.id == eventID } ?: return
            val prefs = WidgetStore.prefs(context)
            if (action == "edit") {
                if (prefs.getString("job", null) == null) prefs.edit().putString("editing", eventID).commit()
            } else {
                if (snapshot.stale || !event.canReply || event.start <= now || prefs.getLong("expires", 0) <= now) {
                    prefs.edit().putString("message", "In H₂O aktualisieren").commit()
                } else {
                    val old = prefs.getString("job", null)?.let(::JSONObject)
                    val job = if (old != null) {
                        if (action != "retry" || old.optString("eventId") != eventID || old.optString("phase") != "retry") return
                        old
                    } else {
                        if (action == "retry") return
                        JSONObject().put("eventId", eventID).put("status", action).put("expectedVersion", event.version)
                            .put("requestId", UUID.randomUUID().toString())
                    }
                    job.put("phase", "saving").put("startedAt", now)
                    prefs.edit().putString("job", job.toString()).remove("message").remove("notice").commit()
                    val builder = OneTimeWorkRequestBuilder<WidgetReplyWorker>()
                        .setInputData(workDataOf("generation" to prefs.getString("generation", ""), "requestId" to job.getString("requestId")))
                    // Android 12+ supports immediate jobs without a foreground-service notification.
                    // Older devices retain the existing worker path.
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    }
                    val work = builder.build()
                    WorkManager.getInstance(context).enqueueUniqueWork("h2o-widget-reply", ExistingWorkPolicy.APPEND_OR_REPLACE, work)
                }
            }
        }
        NextEventWidget.updateAll(context)
    }
    companion object {
        fun pending(context: Context, event: WidgetEvent, response: String): PendingIntent {
            val intent = Intent(context, WidgetReplyReceiver::class.java).setAction("de.feuerwehrwasser.h2o.WIDGET_REPLY")
                .setData(android.net.Uri.parse("h2o-widget://reply/${event.id}/$response"))
                .putExtra("event", event.id).putExtra("response", response)
            return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
    }
}

class WidgetReplyWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = WidgetStore.prefs(applicationContext)
        val generation = inputData.getString("generation")
        val requestID = inputData.getString("requestId")
        val job = synchronized(WidgetStore) {
            if (prefs.getString("generation", null) != generation) return@withContext Result.success()
            val job = prefs.getString("job", null)?.let(::JSONObject) ?: return@withContext Result.success()
            if (job.optString("requestId") != requestID) return@withContext Result.success()
            if (System.currentTimeMillis() - job.optLong("startedAt") > 30000) {
                prefs.edit().putString("job", job.put("phase", "retry").toString()).commit()
                NextEventWidget.updateAll(applicationContext)
                return@withContext Result.success()
            }
            job
        }
        var saved = false; var denied = false; var conflict = false; var version = 0
        var refreshed: Pair<String, Int>? = null
        var connection: HttpsURLConnection? = null
        try {
            if (prefs.getLong("expires", 0) <= System.currentTimeMillis()) throw IllegalStateException()
            val token = WidgetReplyCipher.decrypt(prefs.getString("grant", null) ?: throw IllegalStateException())
            connection = URL("https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev/portal/widget-reply").openConnection() as HttpsURLConnection
            connection.requestMethod = "POST"; connection.instanceFollowRedirects = false
            connection.connectTimeout = 10000; connection.readTimeout = 12000; connection.useCaches = false; connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $token"); connection.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().put("eventId", job.getString("eventId")).put("status", job.getString("status"))
                .put("expectedVersion", job.getInt("expectedVersion")).put("requestId", job.getString("requestId"))
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            denied = code in listOf(401, 403); conflict = code in listOf(400, 404, 409, 423)
            if (code == 200 || code == 409) {
                val stream = if (code == 200) connection.inputStream else connection.errorStream
                val bytes = stream.use { stream ->
                    val buffer = java.io.ByteArrayOutputStream()
                    val chunk = ByteArray(1024)
                    while (buffer.size() <= 4096) {
                        val count = stream.read(chunk, 0, minOf(chunk.size, 4097 - buffer.size()))
                        if (count < 0) break
                        buffer.write(chunk, 0, count)
                    }
                    buffer.toByteArray()
                }
                if (bytes.size <= 4096) {
                    val value = JSONObject(String(bytes, Charsets.UTF_8)); version = value.optInt("version", -1)
                    saved = code == 200 && value.optBoolean("ok") && value.optString("status") == job.getString("status") && version == job.getInt("expectedVersion") + 1
                    val current = value.optJSONObject("currentReply")
                    if (code == 409 && current != null && current.optString("status") in listOf("yes", "excused", "maybe", "open") && current.opt("version") is Number && current.optDouble("version") >= 0 && current.optDouble("version") <= Int.MAX_VALUE && current.optDouble("version") == current.optInt("version").toDouble()) {
                        refreshed = current.getString("status") to current.getInt("version")
                    }
                }
            }
        } catch (_: Exception) { /* Preserve original request for explicit idempotent retry. */ }
        finally { connection?.disconnect() }
        synchronized(WidgetStore) {
            if (prefs.getString("generation", null) != generation || prefs.getString("job", null)?.let(::JSONObject)?.optString("requestId") != requestID) return@withContext Result.success()
            if (denied) WidgetStore.clear(applicationContext)
            else if (saved) WidgetStore.confirm(applicationContext, job.getString("eventId"), job.getString("status"), version)
            else if (refreshed != null) {
                val current = requireNotNull(refreshed)
                WidgetStore.confirm(applicationContext, job.getString("eventId"), current.first, current.second, "Stand aktualisiert – erneut wählen")
            }
            else if (conflict) prefs.edit().remove("job").remove("editing").putString("message", "In H₂O aktualisieren").commit()
            else prefs.edit().putString("job", job.put("phase", "retry").toString()).commit()
        }
        NextEventWidget.updateAll(applicationContext)
        Result.success() // Never silently deliver a new answer later in the background.
    }
}
