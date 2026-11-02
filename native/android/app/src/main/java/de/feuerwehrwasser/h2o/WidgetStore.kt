package de.feuerwehrwasser.h2o

import android.content.Context
import org.json.JSONObject
import org.json.JSONArray
import java.util.UUID

object WidgetStore {
    private const val KEY = "snapshot"
    internal fun prefs(context: Context) = context.getSharedPreferences("h2o-widget", Context.MODE_PRIVATE)
    @Synchronized fun clear(context: Context) {
        prefs(context).edit().clear().commit()
        NextEventWidget.updateAll(context)
    }
    @Synchronized fun accept(context: Context, raw: String) {
        if (raw.length > 10000) return
        runCatching {
            val input = JSONObject(raw)
            when (input.getString("action")) {
                "clear" -> clear(context)
                "update", "empty" -> {
                    val now = System.currentTimeMillis()
                    val events = if (input.getString("action") == "empty") emptyList() else {
                        val array = input.optJSONArray("events") ?: JSONArray().put(input.getJSONObject("event"))
                        if (array.length() !in 1..3) return
                        (0 until array.length()).map { readEvent(array.getJSONObject(it)) }
                    }
                    if (events.any { !it.valid(now) }) return
                    val saved = JSONObject().put("updatedAt", now).put("stale", input.optBoolean("stale"))
                        .put("events", JSONArray(events.map(::eventJSON)))
                    val reply = input.optJSONObject("reply")
                    val token = reply?.optString("token").orEmpty()
                    val expires = reply?.optLong("expiresAt") ?: 0L
                    val encrypted = if (token.matches(Regex("[A-Za-z0-9_-]{1,3000}")) && expires > now && expires <= now + 12 * 3600000L + 60000) WidgetReplyCipher.encrypt(token) else null
                    prefs(context).edit().clear().putString(KEY, saved.toString())
                        .putString("grant", encrypted).putLong("expires", expires)
                        .putString("generation", UUID.randomUUID().toString()).putString("stateEvent", events.firstOrNull()?.id.orEmpty()).commit()
                    NextEventWidget.updateAll(context)
                }
            }
        }
    }
    private fun readEvent(e: JSONObject) = WidgetEvent(e.getString("title").trim(), e.getLong("start"), e.getLong("end"),
        e.getString("location").trim(), e.getString("clothing").trim(), e.getString("status"), e.getBoolean("allDay"),
        e.optString("id"), e.optInt("version"), e.optBoolean("canReply"), e.optBoolean("reminded"))
    internal fun eventJSON(event: WidgetEvent) = JSONObject().put("title", event.title).put("start", event.start)
        .put("end", event.end).put("location", event.location).put("clothing", event.clothing).put("status", event.status)
        .put("allDay", event.allDay).put("id", event.id).put("version", event.version).put("canReply", event.canReply).put("reminded", event.reminded)
    @Synchronized fun read(context: Context, now: Long): WidgetSnapshot? = runCatching {
        val value = JSONObject(prefs(context).getString(KEY, null) ?: return null)
        val array = value.optJSONArray("events") ?: JSONArray().also { array -> value.optJSONObject("event")?.let { event -> array.put(event) } }
        val events = (0 until array.length()).map { readEvent(array.getJSONObject(it)) }.filter { it.valid(now) }.sortedBy { it.start }
        val stateEvent = prefs(context).getString("stateEvent", null)
        val nextID = events.firstOrNull()?.id.orEmpty()
        if (stateEvent != nextID) prefs(context).edit().putString("stateEvent", nextID).remove("job").remove("editing").remove("message").remove("notice").commit()
        WidgetSnapshot(value.getLong("updatedAt"), events.firstOrNull(), value.getBoolean("stale"), events.drop(1)).takeIf { it.fresh(now) }
    }.getOrNull()
    @Synchronized internal fun confirm(context: Context, eventID: String, status: String, version: Int, notice: String? = null) {
        val value = JSONObject(prefs(context).getString(KEY, null) ?: return)
        val events = value.getJSONArray("events")
        for (i in 0 until events.length()) if (events.getJSONObject(i).optString("id") == eventID) {
            events.getJSONObject(i).put("status", status).put("version", version)
        }
        // Keep original calendar age, even after a successful response.
        prefs(context).edit().putString(KEY, value.toString()).remove("job").remove("editing").remove("message")
            .apply { if (notice == null) remove("notice") else putString("notice", notice) }.commit()
    }
}
