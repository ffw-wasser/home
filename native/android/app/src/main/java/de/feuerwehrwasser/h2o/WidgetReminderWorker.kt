package de.feuerwehrwasser.h2o

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class WidgetReminderWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val context = applicationContext
        val now = System.currentTimeMillis()
        val prefs = WidgetStore.prefs(context)
        val snapshot = WidgetStore.read(context, now) ?: return@withContext Result.success()
        if (!snapshot.fresh(now) || prefs.getLong("expires", 0) <= now) return@withContext Result.success()
        val generation = prefs.getString("generation", null) ?: return@withContext Result.success()
        val token = runCatching { WidgetReplyCipher.decrypt(prefs.getString("grant", null) ?: "") }.getOrNull() ?: return@withContext Result.success()
        for (event in (listOfNotNull(snapshot.event) + snapshot.following).take(3)) {
            if (!event.canReply || !WidgetEvent.validID(event.id)) continue
            var connection: HttpsURLConnection? = null
            try {
                connection = URL("https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev/portal/widget-status").openConnection() as HttpsURLConnection
                connection.requestMethod = "POST"; connection.instanceFollowRedirects = false
                connection.connectTimeout = 4000; connection.readTimeout = 5000; connection.useCaches = false; connection.doOutput = true
                connection.setRequestProperty("Authorization", "Bearer $token"); connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(JSONObject().put("eventId", event.id).toString().toByteArray(Charsets.UTF_8)) }
                if (connection.responseCode != 200) continue
                val bytes = connection.inputStream.use { input ->
                    val buffer = ByteArray(4097); var count = 0
                    while (count < buffer.size) { val n = input.read(buffer, count, buffer.size - count); if (n < 0) break; count += n }
                    buffer.copyOf(count)
                }; if (bytes.size > 4096) continue
                val value = JSONObject(String(bytes, Charsets.UTF_8)); val status = value.getString("status"); val version = value.getInt("version")
                if (!value.getBoolean("ok") || status !in setOf("open", "yes", "excused", "maybe") || version < 0) continue
                WidgetStore.reminder(context, generation, event.id, status, version, value.getBoolean("reminded"), value.getBoolean("canReply"))
            } catch (_: Exception) { /* Retain the existing snapshot and its age. */ }
            finally { connection?.disconnect() }
        }
        NextEventWidget.updateAll(context)
        Result.success()
    }
}
