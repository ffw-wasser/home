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
        val fixtures = listOf("today", "tomorrow", "future", "empty", "clear", "stale", "excused", "allday", "open", "reminded", "edit", "saving", "retry", "conflict", "long-title")
        val scenarios = expandedSizes.flatMap { size -> fixtures.map { size to it } } +
            listOf(Triple(330, 210, 1f), Triple(330, 230, 1f), Triple(330, 260, 1f), Triple(330, 230, 1.3f), Triple(360, 260, 1.3f), Triple(170, 345, 1f), Triple(220, 345, 1.3f), Triple(330, 450, 1f)).flatMap { size ->
                listOf("short-title", "long-title", "open").map { size to it }
            } + listOf(Triple(330, 170, 1f), Triple(330, 230, 1f), Triple(330, 345, 1.3f)).map { it to "refreshed" }
        val sketchScenarios = listOf(Triple(170, 170, 1f), Triple(330, 170, 1f), Triple(330, 230, 1f), Triple(330, 170, 1.3f)).map { it to "sketch-reference" }
        val monthScenarios = listOf(Triple(110, 48, 1.3f), Triple(170, 170, 1.3f), Triple(330, 345, 1.3f)).map { it to "long-month" }
        for (exactSize in listOf(false, true)) for ((dimensions, fixture) in scenarios + monthScenarios + sketchScenarios) {
            val (width, height, fontScale) = dimensions
            val intent = Intent(context, WidgetPreviewActivity::class.java).putExtra("width", width).putExtra("height", height).putExtra("fontScale", fontScale).putExtra("fixture", fixture).putExtra("exactSize", exactSize)
            ActivityScenario.launch<WidgetPreviewActivity>(intent).use { scenario ->
                instrumentation.waitForIdleSync()
                var rendered: Bitmap? = null
                scenario.onActivity { activity ->
                    val title = activity.findViewById<android.widget.TextView>(R.id.widget_title)
                    assertEquals(height >= 100 || width >= 240 || fixture in listOf("clear", "empty"), title.isShown)
                    assertEquals(if (fixture == "clear") "H₂O öffnen, um Termine zu laden." else if (fixture == "empty") "Keine kommenden Termine" else if (fixture == "sketch-reference") "Indoor Cycling" else if (fixture == "long-title") "Technische Hilfeleistung am Gerätehaus" else if (fixture == "short-title") "Probe" else "Technische Hilfeleistung", title.text.toString())
                    val root = activity.findViewById<android.view.View>(android.R.id.content)
                    assertTrue(root.width > 0 && root.height > 0)
                    val isEvent = fixture !in listOf("clear", "empty")
                    val widget = activity.findViewById<View>(R.id.widget_root)
                    assertFalse("Brand heading must not consume calendar space", activity.findViewById<View>(R.id.widget_brand).isShown)
                    if (isEvent && width >= 300 && height in 210..289 && height / fontScale >= 160 && width / fontScale >= 240) {
                        val day = activity.findViewById<TextView>(R.id.widget_day)
                        assertTrue("Intermediate launcher heights enlarge the calendar day", day.textSize / activity.resources.displayMetrics.scaledDensity >= if (fontScale > 1.15f) 31.9f else 41.9f)
                        assertTrue("Intermediate launcher heights enlarge the subject", title.textSize / activity.resources.displayMetrics.scaledDensity >= if (fontScale > 1.15f) 16.9f else 21.9f)
                        val dateCard = activity.findViewById<View>(R.id.widget_date)
                        assertTrue("The calendar is at least 70dp wide", dateCard.width / activity.resources.displayMetrics.density >= 70)
                    }
                    if (isEvent && height >= 200 && height / fontScale >= 160) {
                        val weekday = activity.findViewById<TextView>(R.id.widget_weekday)
                        assertTrue("The label beneath the day is readable", weekday.textSize / activity.resources.displayMetrics.scaledDensity >= 11.9f)
                    }
                    if (fixture == "today" && width == 170 && height == 170) {
                        assertTrue("The topic uses at most two lines; full text opens in H₂O", title.layout.lineCount <= 2)
                    }
                    rendered = Bitmap.createBitmap(widget.width, widget.height, Bitmap.Config.ARGB_8888).also { widget.draw(android.graphics.Canvas(it)) }
                    File(folder, "${width}x${height}-font${fontScale}-${fixture}-exact${exactSize}.png").outputStream().use { requireNotNull(rendered).compress(Bitmap.CompressFormat.PNG, 100, it) }
                    val card = activity.findViewById<View>(R.id.widget_reply_section) != null
                    val actions = activity.findViewById<View>(R.id.widget_actions)?.isShown == true
                    assertEquals(if (isEvent) View.VISIBLE else View.GONE, activity.findViewById<View>(R.id.widget_footer).visibility)
                    if (actions) {
                        val control = activity.findViewById<View>(R.id.widget_actions)
                        assertTrue("The direct selector uses the widget width", control.width >= widget.width * 0.8f)
                        for (id in listOf(R.id.widget_reply_yes, R.id.widget_reply_excused, R.id.widget_reply_maybe)) {
                            val button = activity.findViewById<TextView>(id)
                            assertTrue("Answer target is at least 44dp high", button.height / activity.resources.displayMetrics.density >= 44)
                            assertEquals("Pending and stale replies cannot be submitted again", fixture !in listOf("saving", "stale"), button.isEnabled)
                            if (fixture in listOf("open", "reminded")) assertFalse("Open replies have no selected answer", button.text.contains("✓"))
                        }
                    }
                    assertFalse("No separate change button remains", activity.findViewById<View>(R.id.widget_edit)?.isShown == true)
                    assertEquals(if (fixture == "stale") View.VISIBLE else View.GONE, activity.findViewById<View>(R.id.widget_note).visibility)
                    if (isEvent) {
                        val status = activity.findViewById<TextView>(R.id.widget_status)
                        val text = status.text.toString()
                        assertTrue(text.isNotBlank())
                        if (fixture == "saving") assertEquals("Wird gespeichert …", text)
                        if (fixture == "refreshed") {
                            assertEquals("Stand aktualisiert – erneut wählen", text)
                            assertTrue("Refreshed conflicts keep the direct selector available", actions)
                            assertFalse(text.contains("Gespeichert"))
                        }
                        if (fixture == "retry") assertTrue(text.contains("Nicht bestätigt"))
                        if (card && fixture in listOf("today", "tomorrow", "future", "excused", "allday")) assertTrue("Only confirmed replies say saved", text.contains("Gespeichert"))
                        if (fixture in listOf("saving", "retry", "conflict", "open", "reminded")) assertFalse("Unconfirmed operations never claim success", text.contains("Gespeichert"))
                        if (fixture in listOf("open", "reminded")) {
                            assertEquals("Unanswered replies use signal yellow", 0xFFF4C542.toInt(), status.currentTextColor)
                            if (card) assertEquals(if (fixture == "reminded") "Bitte Rückmeldung geben" else "Rückmeldung offen", text)
                        }
                    }
                    val bindings = activity.findViewById<View>(R.id.widget_bindings)
                    if (isEvent && bindings?.isShown == true) {
                        val month = activity.findViewById<TextView>(R.id.widget_month)
                        val monthPoint = IntArray(2); val ringPoint = IntArray(2)
                        month.getLocationOnScreen(monthPoint); bindings.getLocationOnScreen(ringPoint)
                        val ink = android.graphics.Rect()
                        month.paint.getTextBounds(month.text.toString(), 0, month.text.length, ink)
                        val gap = monthPoint[1] + month.baseline + ink.top - ringPoint[1] - bindings.height
                        assertTrue("Calendar rings leave clear space above month text: $gap px", gap >= 2 * activity.resources.displayMetrics.density - 1)
                    }
                    assertTextFits(widget, widget, "${width}x${height} font=$fontScale fixture=$fixture exact=$exactSize")
                    if (isEvent) {
                        assertTrue("Calendar month is visible", activity.findViewById<TextView>(R.id.widget_month).isShown)
                        val month = activity.findViewById<TextView>(R.id.widget_month)
                        assertTrue("Month fits its red field: ${month.text} at $width/$fontScale", month.paint.measureText(month.text.toString()) <= month.width - month.compoundPaddingLeft - month.compoundPaddingRight + 2)

                        assertTrue("Calendar day is numeric and readable", activity.findViewById<TextView>(R.id.widget_day).text.matches(Regex("\\d{1,2}")))
                    }
                    if (fixture in listOf("today", "tomorrow") && height >= 100) {
                        assertEquals(if (fixture == "today") "Heute" else "Morgen", activity.findViewById<TextView>(R.id.widget_weekday).text.toString())
                    }
                    if (fixture == "future" && width < 240 && height / fontScale >= 140) {
                        assertTrue("Day stays more prominent than month", activity.findViewById<TextView>(R.id.widget_day).textSize >= 1.25f * activity.findViewById<TextView>(R.id.widget_month).textSize)
                    }
                    if (isEvent && width >= 450 && height >= 250) {
                        assertTrue("Roomy widgets keep legible topic headings", title.textSize / activity.resources.displayMetrics.scaledDensity >= if (fontScale > 1.15f) 14.9f else 17.9f)
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
