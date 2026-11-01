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
        val date = java.time.Instant.ofEpochMilli(now).atZone(WidgetSnapshot.zone).toLocalDate().plusDays(when (action) { "tomorrow" -> 1; "future" -> 3; else -> 0 })
        val start = date.atTime(23, 58).atZone(WidgetSnapshot.zone).toInstant().toEpochMilli()
        val input = if (action == "clear") JSONObject().put("action", "clear") else JSONObject().put("action", if (action == "empty") "empty" else "update")
            .put("stale", action == "stale").put("event", JSONObject().put("title", "Probe · Technische Hilfeleistung")
                .put("start", start).put("end", start + 3600000).put("allDay", false).put("location", "Gerätehaus Wasser")
                .put("clothing", "Einsatzkleidung").put("status", "yes"))
        WidgetStore.accept(this, input.toString())
        val layout = FrameLayout(previewContext).apply { setBackgroundColor(0xFF18283C.toInt()) }
        val options = Bundle().apply {
            putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, width)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, width)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, height)
            putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, height)
        }
        val view = NextEventWidget.viewsForOptions(previewContext, options, width < 240, now).apply(previewContext, layout)
        val density = resources.displayMetrics.density
        val params = FrameLayout.LayoutParams((width * density).toInt(), (height * density).toInt())
        params.gravity = android.view.Gravity.CENTER
        layout.addView(view, params)
        setContentView(layout)
    }
}
