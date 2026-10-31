package de.feuerwehrwasser.h2o

import android.content.Context
import org.json.JSONObject

object WidgetStore {
    private const val KEY = "snapshot"
    private fun preferences(context: Context) = context.getSharedPreferences("h2o.widget.v1", Context.MODE_PRIVATE)
    fun clear(context: Context) { preferences(context).edit().remove(KEY).apply(); H2OWidgetProvider.refresh(context) }
    fun read(context: Context, now: Long = System.currentTimeMillis()): WidgetState? = runCatching {
        val raw = preferences(context).getString(KEY, null) ?: return null
        decode(JSONObject(raw)).takeIf { it.valid(now) }
    }.getOrNull()
    fun accept(context: Context, message: String) {
        if (message.length > 4000) return
        runCatching {
            val input = JSONObject(message)
            when (input.optString("action")) {
                "clear" -> { clear(context); return }
                "update", "empty" -> {
                    val now = System.currentTimeMillis()
                    val data = JSONObject().put("updatedAt", now).put("stale", input.optBoolean("stale"))
                    if (input.optString("action") == "update") {
                        val event = input.getJSONObject("event")
                        val start = event.getDouble("start"); val end = event.getDouble("end")
                        require(start.isFinite() && end.isFinite() && end > now && end > start && end - start < 7 * 86400000L && start < now + 366 * 86400000L)
                        for ((key, length) in mapOf("title" to 100, "location" to 100, "clothing" to 80)) {
                            val text = event.getString(key)
                            require(text.length <= length && text.none { it.isISOControl() })
                        }
                        require(event.getString("status") in setOf("yes", "excused", "maybe", "open"))
                        event.getBoolean("allDay")
                        val safe = JSONObject()
                        for (key in listOf("title", "start", "end", "location", "clothing", "status", "allDay")) safe.put(key, event.get(key))
                        data.put("event", safe)
                    }
                    preferences(context).edit().putString(KEY, data.toString()).apply()
                    H2OWidgetProvider.refresh(context)
                }
            }
        }
    }
    private fun decode(value: JSONObject): WidgetState {
        val event = value.optJSONObject("event")?.let { WidgetEvent(it.getString("title"), it.getDouble("start").toLong(), it.getDouble("end").toLong(), it.getString("location"), it.getString("clothing"), it.getString("status"), it.getBoolean("allDay")) }
        return WidgetState(value.getLong("updatedAt"), event, value.optBoolean("stale"))
    }
}
