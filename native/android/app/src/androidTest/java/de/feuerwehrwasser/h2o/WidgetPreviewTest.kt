package de.feuerwehrwasser.h2o

import android.content.Intent
import android.appwidget.AppWidgetManager
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
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
        val providers = AppWidgetManager.getInstance(context).installedProviders.filter { it.provider.packageName == context.packageName }
        assertEquals("Both formats appear in the Android widget picker", 2, providers.size)
        assertEquals(setOf(2, 4), providers.map { it.targetCellWidth }.toSet())
        for (provider in providers) {
            assertEquals(AppWidgetProviderResize, provider.resizeMode)
            assertTrue("Widget can shrink to one launcher row", provider.minResizeHeight <= 48 * context.resources.displayMetrics.density)
        }
        val sizes = listOf(Triple(110, 48, 1f), Triple(110, 48, 1.3f), Triple(170, 48, 1.3f), Triple(330, 48, 1.3f), Triple(250, 64, 1f), Triple(170, 170, 1f), Triple(330, 170, 1f), Triple(110, 110, 1f), Triple(330, 110, 1f), Triple(330, 250, 1f), Triple(170, 170, 1.3f), Triple(330, 170, 1.3f))
        val expandedSizes = sizes + listOf(Triple(220, 220, 1f), Triple(450, 250, 1f), Triple(450, 250, 1.3f), Triple(239, 160, 1.3f), Triple(240, 160, 1.3f))
        for (exactSize in listOf(false, true)) for ((width, height, fontScale) in expandedSizes) for (fixture in listOf("today", "tomorrow", "future", "empty", "clear", "stale", "excused", "allday")) {
            val intent = Intent(context, WidgetPreviewActivity::class.java).putExtra("width", width).putExtra("height", height).putExtra("fontScale", fontScale).putExtra("fixture", fixture).putExtra("exactSize", exactSize)
            ActivityScenario.launch<WidgetPreviewActivity>(intent).use { scenario ->
                instrumentation.waitForIdleSync()
                var rendered: Bitmap? = null
                scenario.onActivity { activity ->
                    val title = activity.findViewById<android.widget.TextView>(R.id.widget_title)
                    assertEquals(height >= 100 || width >= 240 || fixture in listOf("clear", "empty"), title.isShown)
                    assertEquals(if (fixture == "clear") "H₂O öffnen, um Termine zu laden." else if (fixture == "empty") "Keine kommenden Termine" else "Probe · Technische Hilfeleistung", title.text.toString())
                    val root = activity.findViewById<android.view.View>(android.R.id.content)
                    assertTrue(root.width > 0 && root.height > 0)
                    val widget = activity.findViewById<View>(R.id.widget_root)
                    rendered = Bitmap.createBitmap(widget.width, widget.height, Bitmap.Config.ARGB_8888).also { widget.draw(android.graphics.Canvas(it)) }
                    File(folder, "${width}x${height}-font${fontScale}-${fixture}-exact${exactSize}.png").outputStream().use { requireNotNull(rendered).compress(Bitmap.CompressFormat.PNG, 100, it) }
                    val isEvent = fixture !in listOf("clear", "empty")
                    assertEquals(if (isEvent) View.VISIBLE else View.GONE, activity.findViewById<View>(R.id.widget_footer).visibility)
                    assertEquals(if (fixture == "stale") View.VISIBLE else View.GONE, activity.findViewById<View>(R.id.widget_note).visibility)
                    if (isEvent) assertEquals(if (fixture == "excused") "Entschuldigt" else "Dabei", activity.findViewById<TextView>(R.id.widget_status).text.toString())
                    assertTextFits(widget, widget)
                    if (fixture in listOf("today", "tomorrow")) assertEquals(if (fixture == "today") "Heute" else "Morgen", activity.findViewById<android.widget.TextView>(R.id.widget_day).text.toString())
                    if (fixture == "future" && width < 240 && height >= 160) {
                        assertTrue("Month gets its own visible row", activity.findViewById<TextView>(R.id.widget_month).isShown)
                        assertTrue("Day is readable on its own", activity.findViewById<TextView>(R.id.widget_day).text.matches(Regex("\\d{2}")))
                    }
                    if (isEvent && width >= 450 && height >= 250) {
                        assertTrue("Large widgets use larger event headings", title.textSize / activity.resources.displayMetrics.scaledDensity >= 24f)
                    }
                }
                val bitmap = requireNotNull(rendered)
                assertNotNull(bitmap)
            }
        }
        WidgetStore.clear(context)
    }
    private fun assertTextFits(root: View, view: View) {
        if (!view.isShown) return
        if (view is TextView) {
            val rect = android.graphics.Rect()
            view.getDrawingRect(rect)
            (root as ViewGroup).offsetDescendantRectToMyCoords(view, rect)
            assertTrue("Visible text ${view.text} extends below widget: ${rect.bottom}/${root.height}", rect.bottom <= root.height + 2)
            assertTrue("Text is inside widget horizontally", rect.left >= -2 && rect.right <= root.width + 2)
            assertTrue("Text has visible height", view.height > 0)
            val textLayout = view.layout
            if (textLayout != null && view.text.isNotEmpty()) assertTrue("Text line is not vertically clipped: ${view.text}", textLayout.getLineBottom(textLayout.lineCount - 1) <= view.height - view.compoundPaddingTop - view.compoundPaddingBottom + 2)
        }
        if (view is ViewGroup) for (i in 0 until view.childCount) assertTextFits(root, view.getChildAt(i))
    }
    private val AppWidgetProviderResize = android.appwidget.AppWidgetProviderInfo.RESIZE_HORIZONTAL or android.appwidget.AppWidgetProviderInfo.RESIZE_VERTICAL
}
