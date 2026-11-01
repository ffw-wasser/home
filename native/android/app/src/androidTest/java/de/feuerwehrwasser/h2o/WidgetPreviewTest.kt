package de.feuerwehrwasser.h2o

import android.content.Intent
import android.graphics.Bitmap
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import org.junit.Assert.*

@RunWith(AndroidJUnit4::class)
class WidgetPreviewTest {
    @Test fun renderSyntheticWidgetStates() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val folder = File(context.getExternalFilesDir(null), "widget-previews").apply { mkdirs() }
        for (compact in listOf(true, false)) for (fixture in listOf("today", "tomorrow", "empty", "clear", "stale")) {
            val intent = Intent(context, WidgetPreviewActivity::class.java).putExtra("compact", compact).putExtra("fixture", fixture)
            ActivityScenario.launch<WidgetPreviewActivity>(intent).use { scenario ->
                instrumentation.waitForIdleSync()
                scenario.onActivity { activity ->
                    val title = activity.findViewById<android.widget.TextView>(R.id.widget_title)
                    assertTrue(title.isShown)
                    assertEquals(if (fixture == "clear") "H₂O öffnen und aktualisieren" else if (fixture == "empty") "Keine kommenden Termine" else "Probe · Technische Hilfeleistung", title.text.toString())
                    if (fixture in listOf("today", "tomorrow")) assertEquals(if (fixture == "today") "Heute" else "Morgen", activity.findViewById<android.widget.TextView>(R.id.widget_day).text.toString())
                }
                val bitmap = instrumentation.uiAutomation.takeScreenshot()
                assertNotNull(bitmap)
                File(folder, (if (compact) "small" else "medium") + "-" + fixture + ".png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            }
        }
        WidgetStore.clear(context)
    }
}
