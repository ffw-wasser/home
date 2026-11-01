package de.feuerwehrwasser.h2o

import android.content.Context
import org.json.JSONObject

object WidgetStore {
    private const val KEY = "snapshot"
    private fun prefs(context: Context) = context.getSharedPreferences("h2o-widget", Context.MODE_PRIVATE)
    fun clear(context: Context) { prefs(context).edit().clear().apply(); NextEventWidget.updateAll(context) }
    fun accept(context: Context, raw: String) {
        if (raw.length > 4096) return
        runCatching {
            val input = JSONObject(raw)
            when (input.getString("action")) {
                "clear" -> clear(context)
                "update", "empty" -> {
                    val now = System.currentTimeMillis()
                    val event = if (input.getString("action") == "empty") null else readEvent(input.getJSONObject("event"))
                    if (event != null && !event.valid(now)) return
                    // Store a new allowlisted object, never the raw bridge message.
                    val saved = JSONObject().put("updatedAt", now).put("stale", input.optBoolean("stale"))
                    if (event != null) saved.put("event", JSONObject().put("title", event.title).put("start", event.start)
                        .put("end", event.end).put("location", event.location).put("clothing", event.clothing)
                        .put("status", event.status).put("allDay", event.allDay))
                    prefs(context).edit().putString(KEY, saved.toString()).apply()
                    NextEventWidget.updateAll(context)
                }
            }
        }
    }
    private fun readEvent(e: JSONObject) = WidgetEvent(e.getString("title").trim(), e.getLong("start"), e.getLong("end"),
        e.getString("location").trim(), e.getString("clothing").trim(), e.getString("status"), e.getBoolean("allDay"))
    fun read(context: Context, now: Long): WidgetSnapshot? = runCatching {
        val value = JSONObject(prefs(context).getString(KEY, null) ?: return null)
        val event = value.optJSONObject("event")?.let(::readEvent)
        val snapshot = WidgetSnapshot(value.getLong("updatedAt"), event, value.getBoolean("stale"))
        snapshot.takeIf { it.fresh(now) && (event == null || event.valid(now)) }
    }.getOrNull()
}
