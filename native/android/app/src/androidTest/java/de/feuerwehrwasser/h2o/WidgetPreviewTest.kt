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
    @Test fun mediumRepliesRemainVisibleAtLargeSystemFonts() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        for (height in listOf(110, 170)) for (fontScale in listOf(1.5f, 1.8f, 2f)) {
            val intent = Intent(context, WidgetPreviewActivity::class.java)
                .putExtra("width", 330).putExtra("height", height)
                .putExtra("fontScale", fontScale).putExtra("fixture", "long-title")
            ActivityScenario.launch<WidgetPreviewActivity>(intent).use { scenario ->
                instrumentation.waitForIdleSync()
                scenario.onActivity { activity ->
                    val root = activity.findViewById<ViewGroup>(R.id.widget_root)
                    for (id in listOf(R.id.widget_reply_yes, R.id.widget_reply_excused, R.id.widget_reply_maybe)) {
                        val button = activity.findViewById<TextView>(id)
                        assertNotNull("Medium widget retains replies at font=$fontScale", button)
                        assertTrue("Reply is visible and enabled at font=$fontScale", button.isShown && button.isEnabled)
                        val rect = android.graphics.Rect()
                        assertTrue(button.getGlobalVisibleRect(rect))
                        assertEquals("Entire reply target is visible", button.height, rect.height())
                        assertTrue("Reply target keeps its height", button.height >= 44 * activity.resources.displayMetrics.density - 1)
                        assertTrue("Reply label fits", button.paint.measureText(button.text.toString()) <= button.width - button.compoundPaddingLeft - button.compoundPaddingRight + 2)
                    }
                    assertEquals("Reply labels use the same readable size", 1,
                        listOf(R.id.widget_reply_yes, R.id.widget_reply_excused, R.id.widget_reply_maybe)
                            .map { activity.findViewById<TextView>(it).textSize }.distinct().size)
                    assertTextFits(root, root, "medium height=$height font=$fontScale")
                    val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
                    root.draw(android.graphics.Canvas(bitmap))
                    File(context.getExternalFilesDir(null), "widget-previews/medium-$height-large-font-$fontScale.png").apply {
                        parentFile?.mkdirs()
                        outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                    }
                }
            }
        }
        WidgetStore.clear(context)
    }

    @Test fun statusEdgeReappliesWithoutReplacingContentOrAnimatingUnchangedStatus() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val intent = Intent(context, WidgetPreviewActivity::class.java).putExtra("width", 330).putExtra("height", 230).putExtra("fixture", "today")
        ActivityScenario.launch<WidgetPreviewActivity>(intent).use { scenario ->
            scenario.onActivity { activity ->
                val root = activity.findViewById<View>(R.id.widget_root)
                val heading = activity.findViewById<TextView>(R.id.widget_title)
                val originalTitle = heading.text.toString()
                val now = System.currentTimeMillis()
                val event = requireNotNull(WidgetStore.read(context, now)?.event)
                for ((status, index) in listOf("yes" to 1, "excused" to 2, "maybe" to 3, "open" to 0)) {
                    WidgetStore.confirm(context, event.id, status, 1)
                    NextEventWidget.views(activity, 330, 230, now, true).reapply(activity, root)
                    val flipper = activity.findViewById<android.widget.ViewFlipper>(R.id.widget_edge_transition)
                    assertEquals(index, flipper.displayedChild)
                    assertFalse("The edge must never loop", flipper.isFlipping)
                    assertSame("Replies keep the existing content view", heading, activity.findViewById<TextView>(R.id.widget_title))
                    assertEquals(originalTitle, heading.text.toString())
                    NextEventWidget.views(activity, 330, 230, now, false).reapply(activity, root)
                    assertEquals("An unchanged status uses a static surface", View.VISIBLE, activity.findViewById<View>(R.id.widget_edge_static).visibility)
                    assertEquals(View.GONE, flipper.visibility)
                }
            }
        }
    }

    @Test fun reminderUpdatesRetainCalendarAgeAndRejectOldSessionsOrReplyVersions() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        ActivityScenario.launch<WidgetPreviewActivity>(Intent(context, WidgetPreviewActivity::class.java).putExtra("fixture", "today")).use { scenario ->
            scenario.onActivity {
                val now = System.currentTimeMillis(); val prefs = WidgetStore.prefs(context)
                val original = requireNotNull(WidgetStore.read(context, now)); val event = requireNotNull(original.event)
                val generation = requireNotNull(prefs.getString("generation", null))
                WidgetStore.reminder(context, "old-session", event.id, "maybe", 5, true, true)
                assertEquals(event, WidgetStore.read(context, now)?.event)
                WidgetStore.reminder(context, generation, event.id, "maybe", 5, true, true)
                val updated = requireNotNull(WidgetStore.read(context, now)); assertEquals(original.updatedAt, updated.updatedAt)
                assertEquals("maybe", updated.event?.status); assertTrue(updated.event?.reminded == true)
                WidgetStore.reminder(context, generation, event.id, "open", 1, false, true)
                assertEquals("maybe", WidgetStore.read(context, now)?.event?.status)
                WidgetStore.reminder(context, generation, event.id, "open", 0, false, false)
                assertFalse(requireNotNull(WidgetStore.read(context, now)?.event).canReply)
            }
        }
    }

    @Test fun renderSyntheticWidgetStates() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        context.getSharedPreferences("h2o-app-updates", android.content.Context.MODE_PRIVATE).edit().clear().commit()
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
        val sketchScenarios = listOf(Triple(170, 170, 1f), Triple(330, 110, 1f), Triple(330, 130, 1f), Triple(330, 140, 1f), Triple(330, 150, 1f), Triple(330, 160, 1f), Triple(330, 170, 1f), Triple(330, 230, 1f), Triple(330, 170, 1.3f), Triple(330, 150, 1.3f)).map { it to "sketch-reference" }
        val shortCalendarScenarios = listOf(Triple(330, 150, 1.3f), Triple(330, 160, 1.3f)).flatMap { size -> listOf("today", "tomorrow").map { size to it } }
        val monthScenarios = listOf(Triple(110, 48, 1.3f), Triple(170, 170, 1.3f), Triple(330, 345, 1.3f)).map { it to "long-month" }
        val previewOnly = InstrumentationRegistry.getArguments().getString("widgetPreviewOnly") == "true"
        val selectedScenarios = if (previewOnly) listOf(Triple(330, 230, 1f), Triple(330, 110, 1f)).flatMap { size -> listOf("sketch-reference", "reminded", "reminded-maybe").map { size to it } }
            else shortCalendarScenarios + sketchScenarios + scenarios + monthScenarios + listOf(Triple(330, 170, 1f), Triple(330, 345, 1f), Triple(330, 170, 1.3f)).flatMap { size -> listOf("saving-yes", "saving-excused").map { size to it } }
        for (exactSize in if (previewOnly) listOf(true) else listOf(false, true)) for ((dimensions, fixture) in selectedScenarios) {
            val (width, height, fontScale) = dimensions
            val intent = Intent(context, WidgetPreviewActivity::class.java).putExtra("width", width).putExtra("height", height).putExtra("fontScale", fontScale).putExtra("fixture", fixture).putExtra("exactSize", exactSize)
            ActivityScenario.launch<WidgetPreviewActivity>(intent).use { scenario ->
                instrumentation.waitForIdleSync()
                var rendered: Bitmap? = null
                scenario.onActivity { activity ->
                    val title = activity.findViewById<android.widget.TextView>(R.id.widget_title)
                    assertEquals(height >= 100 || width >= 240 || fixture in listOf("clear", "empty"), title.isShown)
                    assertEquals(if (fixture == "clear") "H₂O öffnen, um Termine zu laden." else if (fixture == "empty") "Keine kommenden Termine" else if (fixture.startsWith("reminded")) "Probe mit Emmendingen" else if (fixture == "sketch-reference") "Indoor Cycling" else if (fixture == "long-title") "Technische Hilfeleistung am Gerätehaus" else if (fixture == "short-title") "Probe" else "Technische Hilfeleistung", title.text.toString())
                    val root = activity.findViewById<android.view.View>(android.R.id.content)
                    assertTrue(root.width > 0 && root.height > 0)
                    val isEvent = fixture !in listOf("clear", "empty")
                    val widget = activity.findViewById<View>(R.id.widget_root)
                    assertFalse("Brand heading must not consume calendar space", activity.findViewById<View>(R.id.widget_brand).isShown)
                    if (isEvent && width >= 300 && height in 210..289 && height / fontScale >= 160 && width / fontScale >= 240) {
                        val day = activity.findViewById<TextView>(R.id.widget_day)
                        assertTrue("Intermediate launcher heights enlarge the calendar day", day.textSize / activity.resources.displayMetrics.scaledDensity >= 21.9f)
                        assertTrue("Intermediate launcher heights enlarge the subject", title.textSize / activity.resources.displayMetrics.scaledDensity >= 16.9f)
                        val dateCard = activity.findViewById<View>(R.id.widget_date)
                        assertTrue("The compact calendar leaves room for the subject and crest", dateCard.width / activity.resources.displayMetrics.density in 55f..97f)
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
                    val saving = fixture.startsWith("saving")
                    val actions = activity.findViewById<View>(R.id.widget_actions)?.isShown == true
                    val footer = activity.findViewById<View>(R.id.widget_footer)
                    val inlineNotice = footer.parent === activity.findViewById<View>(R.id.widget_details)
                    val visibleNotice = isEvent && (!inlineNotice || activity.findViewById<TextView>(R.id.widget_status).text.isNotEmpty())
                    assertEquals(if (visibleNotice) View.VISIBLE else View.GONE, footer.visibility)
                    if (fixture == "sketch-reference" && width == 330 && height in 110..139 && fontScale == 1f) {
                        assertTrue("Short wide cards retain all three response buttons", actions)
                        assertTrue("Short wide cards retain clothing", activity.findViewById<View>(R.id.widget_clothing).isShown)
                        assertTrue("Short wide cards use the free space for a crest", activity.findViewById<View>(R.id.widget_logo).isShown)
                        assertEquals("The compact subject remains on one line", 1, title.lineCount)
                    }
                    if (fixture == "sketch-reference" && width == 330 && height >= 140) {
                        assertTrue("Galaxy-sized cards retain all three response options", actions)
                        val selector = activity.findViewById<View>(R.id.widget_actions)
                        val selectorPoint = IntArray(2); val widgetPoint = IntArray(2)
                        selector.getLocationOnScreen(selectorPoint); widget.getLocationOnScreen(widgetPoint)
                        assertTrue("The whole selector stays inside the widget", selectorPoint[1] >= widgetPoint[1] && selectorPoint[1] + selector.height <= widgetPoint[1] + widget.height)
                        if (fontScale == 1f && height >= 160) {
                            val logo = activity.findViewById<View>(R.id.widget_logo)
                            val details = activity.findViewById<View>(R.id.widget_details)
                            val logoPoint = IntArray(2); val detailsPoint = IntArray(2)
                            logo.getLocationOnScreen(logoPoint); details.getLocationOnScreen(detailsPoint)
                            assertTrue("The crest remains visible at a useful size", logo.isShown && logo.width / activity.resources.displayMetrics.density >= 47)
                            assertTrue("The crest never overlaps the subject", detailsPoint[0] + details.width <= logoPoint[0])
                            assertEquals("Indoor Cycling fits on one line like the iPhone reference", 1, title.lineCount)
                        }
                    }
                    if (actions) {
                        val control = activity.findViewById<View>(R.id.widget_actions)
                        assertTrue("The direct selector uses the widget width", control.width >= widget.width * 0.8f)
                        for (id in listOf(R.id.widget_reply_yes, R.id.widget_reply_excused, R.id.widget_reply_maybe)) {
                            val button = activity.findViewById<TextView>(id)
                            assertTrue("Answer target is at least 44dp high", button.height / activity.resources.displayMetrics.density >= 44)
                            assertEquals("Pending and stale replies cannot be submitted again", !saving && fixture != "stale", button.isEnabled)
                            if (fixture in listOf("open", "reminded")) assertFalse("Open replies have no selected answer", button.text.contains("✓"))
                        }
                    }
                    if (isEvent && !card) {
                        val neutral = fixture in listOf("stale", "retry", "conflict", "refreshed", "open", "reminded")
                        val expected = if (neutral) "neutral" else if (fixture in listOf("excused", "sketch-reference")) "excused" else if (fixture in listOf("future", "saving-yes", "reminded-maybe")) "maybe" else "yes"
                        val footer = activity.findViewById<View>(R.id.widget_footer)
                        val background = footer.background
                        val originalBounds = android.graphics.Rect(background.bounds)
                        val sample = Bitmap.createBitmap(80, 40, Bitmap.Config.ARGB_8888)
                        background.setBounds(0, 0, 80, 40); background.draw(android.graphics.Canvas(sample)); background.bounds = originalBounds
                        val pixel = sample.getPixel(40, 20)
                        val red = android.graphics.Color.red(pixel); val green = android.graphics.Color.green(pixel); val blue = android.graphics.Color.blue(pixel)
                        when (expected) {
                            "yes" -> assertTrue("Confirmed compact presence has a green status surface", green > red && green > blue)
                            "excused" -> assertTrue("Confirmed compact absence has a yellow status surface", red > blue + 80 && green > blue + 60)
                            "maybe" -> assertTrue("Confirmed compact uncertainty has an orange status surface", red > green + 40 && green > blue + 30)
                            else -> assertTrue("Open, stale and failed replies keep a neutral blue surface", blue > red)
                        }
                        if (!neutral) {
                            val ink = if (expected == "yes") 0xFFFFFFFF.toInt() else 0xFF2D210A.toInt()
                            assertEquals("The compact status uses readable contrast", ink, activity.findViewById<TextView>(R.id.widget_status).currentTextColor)
                        }
                    }
                    if (fixture == "sketch-reference" && width == 330 && height in 160..289 && fontScale == 1f) {
                        val dateCard = activity.findViewById<View>(R.id.widget_date)
                        val selector = activity.findViewById<View>(R.id.widget_actions)
                        val datePoint = IntArray(2); val selectorPoint = IntArray(2)
                        dateCard.getLocationOnScreen(datePoint); selector.getLocationOnScreen(selectorPoint)
                        val gap = (selectorPoint[1] - datePoint[1] - dateCard.height) / activity.resources.displayMetrics.density
                        assertTrue("Calendar and replies form one compact group: $gap dp", gap in 0f..12f)
                        if (height >= 210) {
                            val density = activity.resources.displayMetrics.density
                            val scaled = activity.resources.displayMetrics.scaledDensity
                            assertTrue("Roomy previews use larger readable headings", title.textSize / scaled >= 29f)
                            assertTrue("Roomy previews enlarge the calendar proportionally", dateCard.width / density >= 72f)
                            assertTrue("Roomy previews enlarge metadata", activity.findViewById<TextView>(R.id.widget_location).textSize / scaled >= 15f)
                            assertTrue("Roomy previews enlarge the crest", activity.findViewById<View>(R.id.widget_logo).width / density >= 55f)
                        }
                        val aspect = dateCard.height.toFloat() / dateCard.width
                        assertTrue("The calendar sheet keeps iPhone-like proportions: $aspect", aspect in 1.05f..1.5f)
                    }
                    assertFalse("No separate change button remains", activity.findViewById<View>(R.id.widget_edit)?.isShown == true)
                    assertEquals(if (fixture == "stale") View.VISIBLE else View.GONE, activity.findViewById<View>(R.id.widget_note).visibility)
                    if (isEvent) {
                        val status = activity.findViewById<TextView>(R.id.widget_status)
                        val text = status.text.toString()
                        val quiet = card && fixture !in listOf("stale", "conflict", "refreshed", "open", "reminded", "reminded-maybe", "retry")
                        if (quiet) assertEquals("Confirmed and pending replies leave notification space empty", "", text) else assertTrue(text.isNotBlank())
                        assertFalse("Saved is never a persistent widget message", text.contains("Gespeichert"))
                        assertFalse("No saved badge remains", activity.findViewById<View>(R.id.widget_status_icon).isShown)
                        if (card) {
                            val pendingTarget = when (fixture) { "saving-yes" -> "yes"; "saving-excused" -> "excused"; else -> "maybe" }
                            for ((id, target, tint) in listOf(Triple(R.id.widget_reply_loading_yes, "yes", 0xFF287D49.toInt()), Triple(R.id.widget_reply_loading_excused, "excused", 0xFFF4C542.toInt()), Triple(R.id.widget_reply_loading_maybe, "maybe", 0xFFE87524.toInt()))) {
                                val loading = activity.findViewById<android.widget.ProgressBar>(id)
                                assertEquals("Only the requested response animates", saving && pendingTarget == target, loading.isShown)
                                if (saving && pendingTarget == target) {
                                    assertTrue("The system renders an indeterminate loading animation", loading.isIndeterminate)
                                    assertEquals(tint, loading.indeterminateTintList!!.defaultColor)
                                }
                            }
                            if (saving) {
                                val confirmedID = if (fixture == "saving-yes") R.id.widget_reply_maybe else R.id.widget_reply_yes
                                assertTrue("Only the stored response remains checked while saving", activity.findViewById<TextView>(confirmedID).text.contains("✓"))
                                for (id in listOf(R.id.widget_reply_yes, R.id.widget_reply_excused, R.id.widget_reply_maybe)) assertEquals("Saving does not flash/dim the selector", 1f, activity.findViewById<View>(id).alpha, 0.01f)
                            }
                        }
                        if (fixture == "refreshed") {
                            assertEquals("Stand aktualisiert – erneut wählen", text)
                            assertTrue("Refreshed conflicts keep the direct selector available", actions)
                            assertFalse(text.contains("Gespeichert"))
                        }
                        if (fixture == "retry") assertTrue(text.contains("Nicht bestätigt"))
                        if (fixture in listOf("saving", "retry", "conflict", "open", "reminded")) assertFalse("Unconfirmed operations never claim success", text.contains("Gespeichert"))
                        if (fixture in listOf("open", "reminded")) {
                            assertEquals("Unanswered replies use signal yellow", 0xFFF4C542.toInt(), status.currentTextColor)
                            if (card) assertEquals(if (fixture == "reminded") "Erinnerung: Bitte antworten" else "Rückmeldung offen", text)
                        }
                    }
                    if (isEvent && width >= 300 && height >= 290 && height / fontScale >= 250 && fontScale <= 1.2f) {
                        val logo = activity.findViewById<View>(R.id.widget_logo)
                        assertTrue("Large widgets retain a larger crest", logo.isShown && logo.width / activity.resources.displayMetrics.density >= 39)
                        assertEquals("Large headings are not squeezed by the crest", 0, activity.findViewById<View>(R.id.widget_details).paddingRight)
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
