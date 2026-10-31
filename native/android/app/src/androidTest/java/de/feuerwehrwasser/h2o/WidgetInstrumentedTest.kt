package de.feuerwehrwasser.h2o
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WidgetInstrumentedTest {
    @Test fun snapshotsAreValidatedExpiredAndCleared() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        WidgetStore.clear(context)
        val now = System.currentTimeMillis()
        val event = JSONObject().put("title", "Übung Technische Hilfeleistung").put("start", now+3600000).put("end", now+7200000).put("allDay", false).put("location", "Gerätehaus Wasser").put("clothing", "Einsatzkleidung").put("status", "yes").put("capability", "must-not-be-saved")
        WidgetStore.accept(context, JSONObject().put("action", "update").put("event", event).toString())
        assertEquals("Übung Technische Hilfeleistung", WidgetStore.read(context)?.event?.title)
        assertFalse(context.getSharedPreferences("h2o.widget.v1", 0).getString("snapshot", "")!!.contains("capability"))
        event.put("end", now-1)
        WidgetStore.accept(context, JSONObject().put("action", "update").put("event", event).toString())
        assertNotNull(WidgetStore.read(context)?.event)
        assertNull(WidgetStore.read(context, now+WidgetState.MAX_AGE+1000))
        WidgetStore.accept(context, "{\"action\":\"clear\"}")
        assertNull(WidgetStore.read(context))
        WidgetStore.accept(context, "{\"action\":\"empty\"}")
        assertNotNull(WidgetStore.read(context))
        assertNull(WidgetStore.read(context, now+WidgetState.MAX_AGE+1000))
        WidgetStore.clear(context)
    }
    @Test fun renderBothSizesAndEmptyState() {
        ActivityScenario.launch(WidgetPreviewActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                val now = System.currentTimeMillis()
                val event = WidgetEvent("Übung Technische Hilfeleistung", now+3600000, now+7200000, "Gerätehaus Wasser", "Einsatzkleidung", "yes", false)
                val snapshot = WidgetState(now, event, false)
                for ((name, wide, state) in listOf(Triple("small", false, snapshot), Triple("medium", true, snapshot), Triple("empty", false, null))) {
                    val density = activity.resources.displayMetrics.density
                    val width = ((if (wide) 330 else 158)*density).toInt(); val height = (170*density).toInt()
                    val view = H2OWidgetProvider.render(activity, state, wide, now).apply(activity, activity.canvas)
                    activity.canvas.removeAllViews(); activity.canvas.addView(view, FrameLayout.LayoutParams(width, height))
                    view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)); view.layout(0,0,width,height)
                    assertEquals(width, view.measuredWidth)
                    if (state != null) assertEquals(event.title, view.findViewById<TextView>(R.id.widget_title).text.toString())
                    val bitmap = Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888)
                    view.draw(Canvas(bitmap))
                    activity.openFileOutput("widget-"+name+".png",0).use { bitmap.compress(Bitmap.CompressFormat.PNG,100,it) }; bitmap.recycle()
                }
            }
        }
    }
}
