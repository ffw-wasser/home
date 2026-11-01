package de.feuerwehrwasser.h2o

import android.app.Activity
import android.os.Bundle
import android.widget.FrameLayout
import org.json.JSONObject

// Debug-only, synthetic rendering harness; never loads a WebView or a real member account.
class WidgetPreviewActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val now = System.currentTimeMillis()
        val compact = intent.getBooleanExtra("compact", false)
        val action = intent.getStringExtra("fixture") ?: "today"
        val date = java.time.Instant.ofEpochMilli(now).atZone(WidgetSnapshot.zone).toLocalDate().plusDays(if (action == "tomorrow") 1 else 0)
        val start = date.atTime(23, 58).atZone(WidgetSnapshot.zone).toInstant().toEpochMilli()
        val input = if (action == "clear") JSONObject().put("action", "clear") else JSONObject().put("action", if (action == "empty") "empty" else "update")
            .put("stale", action == "stale").put("event", JSONObject().put("title", "Probe · Technische Hilfeleistung")
                .put("start", start).put("end", start + 3600000).put("allDay", false).put("location", "Gerätehaus Wasser")
                .put("clothing", "Einsatzkleidung").put("status", "yes"))
        WidgetStore.accept(this, input.toString())
        val layout = FrameLayout(this).apply { setBackgroundColor(0xFF18283C.toInt()) }
        val view = NextEventWidget.views(this, compact, now).apply(this, layout)
        val density = resources.displayMetrics.density
        val params = FrameLayout.LayoutParams(((if (compact) 170 else 330) * density).toInt(), (260 * density).toInt())
        params.gravity = android.view.Gravity.CENTER
        layout.addView(view, params)
        setContentView(layout)
    }
}
