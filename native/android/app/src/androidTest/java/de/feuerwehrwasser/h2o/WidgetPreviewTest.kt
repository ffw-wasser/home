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
        val expandedSizes = sizes + listOf(Triple(220, 220, 1f), Triple(450, 250, 1f), Triple(450, 250, 1.3f), Triple(239, 160, 1.3f), Triple(240, 160, 1.3f), Triple(330, 345, 1f), Triple(330, 345, 1.3f), Triple(450, 345, 1.3f))
        for (exactSize in listOf(false, true)) for ((width, height, fontScale) in expandedSizes) for (fixture in listOf("today", "tomorrow", "future", "empty", "clear", "stale", "excused", "allday", "open", "reminded", "edit", "saving", "retry", "conflict", "long-title")) {
            val intent = Intent(context, WidgetPreviewActivity::class.java).putExtra("width", width).putExtra("height", height).putExtra("fontScale", fontScale).putExtra("fixture", fixture).putExtra("exactSize", exactSize)
            ActivityScenario.launch<WidgetPreviewActivity>(intent).use { scenario ->
                instrumentation.waitForIdleSync()
                var rendered: Bitmap? = null
                scenario.onActivity { activity ->
                    val title = activity.findViewById<android.widget.TextView>(R.id.widget_title)
                    assertEquals(height >= 100 || width >= 240 || fixture in listOf("clear", "empty"), title.isShown)
                    assertEquals(if (fixture == "clear") "H₂O öffnen, um Termine zu laden." else if (fixture == "empty") "Keine kommenden Termine" else if (fixture == "long-title") "Technische Hilfeleistung am Gerätehaus" else "Technische Hilfeleistung", title.text.toString())
                    val root = activity.findViewById<android.view.View>(android.R.id.content)
                    assertTrue(root.width > 0 && root.height > 0)
                    val widget = activity.findViewById<View>(R.id.widget_root)
                    rendered = Bitmap.createBitmap(widget.width, widget.height, Bitmap.Config.ARGB_8888).also { widget.draw(android.graphics.Canvas(it)) }
                    File(folder, "${width}x${height}-font${fontScale}-${fixture}-exact${exactSize}.png").outputStream().use { requireNotNull(rendered).compress(Bitmap.CompressFormat.PNG, 100, it) }
                    val isEvent = fixture !in listOf("clear", "empty")
                    val actions = activity.findViewById<View>(R.id.widget_actions)?.isShown == true
                    assertEquals(if (isEvent && !actions) View.VISIBLE else View.GONE, activity.findViewById<View>(R.id.widget_footer).visibility)
                    if (actions) for (id in listOf(R.id.widget_reply_yes, R.id.widget_reply_excused, R.id.widget_reply_maybe)) {
                        val button = activity.findViewById<View>(id)
                        assertTrue("Answer target is at least 44dp high", button.height / activity.resources.displayMetrics.density >= 44)
                    }
                    activity.findViewById<View>(R.id.widget_edit)?.takeIf { it.isShown }?.let {
                        assertTrue("Change and open targets are at least 44dp high", it.height / activity.resources.displayMetrics.density >= 44)
                    }
                    assertEquals(if (fixture == "stale") View.VISIBLE else View.GONE, activity.findViewById<View>(R.id.widget_note).visibility)
                    if (isEvent && !actions) {
                        val text = activity.findViewById<TextView>(R.id.widget_status).text.toString()
                        assertTrue(text.isNotBlank())
                        if (fixture == "saving") assertEquals("Wird gespeichert …", text)
                        if (fixture == "retry") assertTrue(text.contains("Unbestätigt"))
                        val sidebar = activity.findViewById<View>(R.id.widget_sidebar)
                        if (sidebar?.isShown == true) {
                            val rect = android.graphics.Rect()
                            sidebar.getDrawingRect(rect)
                            (widget as ViewGroup).offsetDescendantRectToMyCoords(sidebar, rect)
                            assertTrue("The status uses the right half of a broad widget", rect.left > widget.width / 2)
                            if (fixture in listOf("today", "tomorrow", "future", "excused", "allday")) assertTrue("Confirmed replies explicitly say saved", text.contains("Gespeichert"))
                            if (fixture in listOf("saving", "retry", "conflict")) assertFalse("Unconfirmed operations never claim success", text.contains("Gespeichert"))
                        }
                    }
                    assertTextFits(widget, widget, "${width}x${height} font=$fontScale fixture=$fixture exact=$exactSize")
                    if (fixture in listOf("today", "tomorrow")) {
                        val dateId = if (activity.findViewById<View>(R.id.widget_sidebar) != null) R.id.widget_weekday else R.id.widget_day
                        assertTrue(activity.findViewById<TextView>(dateId).text.toString().startsWith(if (fixture == "today") "Heute" else "Morgen"))
                    }
                    if (fixture == "future" && width < 240 && height / fontScale >= 140) {
                        assertTrue("Month gets its own visible row", activity.findViewById<TextView>(R.id.widget_month).isShown)
                        assertTrue("Day is readable on its own", activity.findViewById<TextView>(R.id.widget_day).text.matches(Regex("\\d{2}")))
                        assertTrue("The day stays more prominent than the month with enlarged system fonts", activity.findViewById<TextView>(R.id.widget_day).textSize >= 1.25f * activity.findViewById<TextView>(R.id.widget_month).textSize)
                    }
                    if (isEvent && width >= 450 && height >= 250) {
                        assertTrue("Large widgets use larger event headings", title.textSize / activity.resources.displayMetrics.scaledDensity >= 23.9f)
                    }
                }
                val bitmap = requireNotNull(rendered)
                assertNotNull(bitmap)
            }
        }
        WidgetStore.clear(context)
    }
    private fun assertTextFits(root: View, view: View, scenario: String) {
        if (!view.isShown) return
        if (view is TextView) {
            val rect = android.graphics.Rect()
            view.getDrawingRect(rect)
            (root as ViewGroup).offsetDescendantRectToMyCoords(view, rect)
            assertTrue("Visible text ${view.text} extends below widget: ${rect.bottom}/${root.height}", rect.bottom <= root.height + 2)
            assertTrue("Text is inside widget horizontally", rect.left >= -2 && rect.right <= root.width + 2)
            assertTrue("Text has visible height", view.height > 0)
            val textLayout = view.layout
            if (textLayout != null && view.text.isNotEmpty()) assertTrue("$scenario: Text line is not vertically clipped: ${view.text}, height=${view.height}, bottom=${textLayout.getLineBottom(textLayout.lineCount - 1)}", textLayout.getLineBottom(textLayout.lineCount - 1) <= view.height - view.compoundPaddingTop - view.compoundPaddingBottom + 2)
        }
        if (view is ViewGroup) for (i in 0 until view.childCount) assertTextFits(root, view.getChildAt(i), scenario)
    }
    private val AppWidgetProviderResize = android.appwidget.AppWidgetProviderInfo.RESIZE_HORIZONTAL or android.appwidget.AppWidgetProviderInfo.RESIZE_VERTICAL
}
