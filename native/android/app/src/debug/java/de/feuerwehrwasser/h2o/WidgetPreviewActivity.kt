package de.feuerwehrwasser.h2o

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.res.Configuration
import android.os.Bundle
import android.widget.FrameLayout
import org.json.JSONObject

// Debug-only, synthetic rendering harness; never loads a WebView or a real member account.
class WidgetPreviewActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val now = System.currentTimeMillis()
        val width = intent.getIntExtra("width", 170)
        val height = intent.getIntExtra("height", 170)
        val fontScale = intent.getFloatExtra("fontScale", 1f)
        val previewContext = createConfigurationContext(Configuration(resources.configuration).apply { this.fontScale = fontScale })
        val action = intent.getStringExtra("fixture") ?: "today"
        val relativeDate = java.time.Instant.ofEpochMilli(now).atZone(WidgetSnapshot.zone).toLocalDate().plusDays(when (action) { "tomorrow" -> 1; "future" -> 3; else -> 0 })
        val date = if (action == "long-month") relativeDate.withMonth(9).withDayOfMonth(22).let { if (it.isBefore(relativeDate)) it.plusYears(1) else it } else relativeDate
        val start = date.atTime(23, 58).atZone(WidgetSnapshot.zone).toInstant().toEpochMilli()
        val input = if (action == "clear") JSONObject().put("action", "clear") else JSONObject().put("action", if (action == "empty") "empty" else "update")
            .put("stale", action == "stale").put("event", JSONObject().put("title", if (action == "long-title") "Technische Hilfeleistung am Gerätehaus" else if (action == "short-title") "Probe" else "Technische Hilfeleistung")
                .put("start", start).put("end", start + 3600000).put("allDay", action == "allday").put("location", "Gerätehaus Wasser")
                .put("clothing", "Einsatzkleidung").put("status", if (action == "excused") "excused" else if (action in listOf("open", "reminded")) "open" else "yes")
                .put("id", "a".repeat(43)).put("version", 0).put("canReply", true).put("reminded", action == "reminded"))
            .put("reply", JSONObject().put("token", "synthetic".repeat(20)).put("expiresAt", now + 3600000))
        if (action !in listOf("clear", "empty")) {
            val first = input.getJSONObject("event")
            val following = org.json.JSONArray().put(first)
            for ((offset, title) in listOf("Funkübung", "Unterricht").withIndex()) {
                following.put(JSONObject(first.toString()).put("title", title).put("id", (if (offset == 0) "b" else "c").repeat(43))
                    .put("start", start + (offset + 1) * 86400000L).put("end", start + (offset + 1) * 86400000L + 3600000))
            }
            input.put("events", following)
        }
        WidgetStore.accept(this, input.toString())
        val prefs = WidgetStore.prefs(this)
        if (action == "refreshed") prefs.edit().putString("notice", "Stand aktualisiert – erneut wählen").commit()
        if (action == "edit") prefs.edit().putString("editing", "a".repeat(43)).commit()
        if (action in listOf("saving", "retry")) prefs.edit().putString("job", JSONObject().put("eventId", "a".repeat(43)).put("phase", action).put("startedAt", now).toString()).commit()
        if (action == "conflict") prefs.edit().putString("message", "In H₂O aktualisieren").commit()
        val layout = FrameLayout(previewContext).apply { setBackgroundColor(0xFF18283C.toInt()) }
        val options = Bundle().apply {
            putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, width)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, width)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, height)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, height)
            if (android.os.Build.VERSION.SDK_INT >= 31 && intent.getBooleanExtra("exactSize", false)) {
                // Deliberately disagreeing legacy ranges prove the exact launcher sizes win.
                putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
                putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 110)
                putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 48)
                putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 48)
                putParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, arrayListOf(android.util.SizeF(width.toFloat(), height.toFloat())))
            }
        }
        val view = NextEventWidget.viewsForOptions(previewContext, options, width < 240, now).apply(previewContext, layout)
        val density = resources.displayMetrics.density
        val params = FrameLayout.LayoutParams((width * density).toInt(), (height * density).toInt())
        params.gravity = android.view.Gravity.CENTER
        layout.addView(view, params)
        setContentView(layout)
    }
}
