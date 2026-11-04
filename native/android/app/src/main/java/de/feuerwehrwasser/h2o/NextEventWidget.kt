package de.feuerwehrwasser.h2o

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Build
import android.util.SizeF
import androidx.core.os.BundleCompat
import android.view.View
import android.widget.RemoteViews
import androidx.work.*
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit
import java.util.Locale
import android.util.TypedValue
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ComposeShader
import android.graphics.PorterDuff
import android.graphics.LinearGradient
import android.graphics.Shader
import android.graphics.Paint
import android.graphics.Typeface
import org.json.JSONObject

open class NextEventWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { updateAll(context); schedule(context) }
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { updateAll(context) }
    override fun onEnabled(context: Context) { schedule(context); updateAll(context) }
    override fun onDisabled(context: Context) { if (widgetIds(context).isEmpty()) WorkManager.getInstance(context).cancelUniqueWork("h2o-widget-clock") }
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action in setOf(Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_DATE_CHANGED)) updateAll(context)
    }
    companion object {
        private fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("h2o-widget-clock", ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<WidgetClockWorker>(15, TimeUnit.MINUTES).build())
        }
        private val providers = listOf(NextEventWidget::class.java, CompactNextEventWidget::class.java)
        private fun widgetIds(context: Context): List<Int> {
            val manager = AppWidgetManager.getInstance(context)
            return providers.flatMap { manager.getAppWidgetIds(ComponentName(context, it)).toList() }
        }
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val now = System.currentTimeMillis()
            for (id in widgetIds(context)) {
                val compact = manager.getAppWidgetInfo(id)?.provider?.className == CompactNextEventWidget::class.java.name
                manager.updateAppWidget(id, viewsForOptions(context, manager.getAppWidgetOptions(id), compact, now))
            }
            // Best-effort boundary refresh; Android may defer background work to save power.
            val snapshot = WidgetStore.read(context, now)
            val midnight = Instant.ofEpochMilli(now).atZone(WidgetSnapshot.zone).toLocalDate().plusDays(1).atStartOfDay(WidgetSnapshot.zone).toInstant().toEpochMilli()
            val pending = runCatching { WidgetStore.prefs(context).getString("job", null)?.let(::JSONObject) }.getOrNull()
            val replyTimeout = pending?.takeIf { it.optString("phase") == "saving" }?.optLong("startedAt")?.plus(30000)
            val boundary = listOfNotNull(snapshot?.event?.end, snapshot?.updatedAt?.plus(12 * 3600000L), replyTimeout, midnight).filter { it > now }.minOrNull()
            if (boundary != null && widgetIds(context).isNotEmpty()) WorkManager.getInstance(context).enqueueUniqueWork("h2o-widget-boundary", ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<WidgetClockWorker>().setInitialDelay(boundary - now, TimeUnit.MILLISECONDS).build())
        }
        private fun statusLine(width: Int, status: String, density: Float): Bitmap {
            val pixels = ((width - 24).coerceAtLeast(1) * density).toInt().coerceIn(1, 2048)
            val height = (5 * density).toInt().coerceAtLeast(3)
            val bitmap = Bitmap.createBitmap(pixels, height, Bitmap.Config.ARGB_8888)
            val center = when (status) { "yes" -> 1f / 6; "maybe" -> 5f / 6; else -> 0.5f }
            val tint = when (status) { "yes" -> 0xFF287D49; "excused" -> 0xFFF4C542; "maybe" -> 0xFFE87524; else -> 0xFFC6D2DF }.toInt()
            val bright = when (status) { "yes" -> 0xFF78C38F; "excused" -> 0xFFFFE8A0; "maybe" -> 0xFFFFC68B; else -> 0x70C6D2DF }.toInt()
            val stops = floatArrayOf(0f, (center - 0.29f).coerceAtLeast(0.001f), center - 0.11f, center, center + 0.11f, (center + 0.29f).coerceAtMost(0.999f), 1f)
            val edge = 0x38C6D2DF
            val faded = (tint and 0xFFFFFF) or 0x2E000000
            val vivid = if (status == "open") edge else (tint and 0xFFFFFF) or 0xF2000000.toInt()
            val core = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = LinearGradient(0f, 0f, pixels.toFloat(), 0f,
                    intArrayOf(edge, faded, vivid, bright, vivid, faded, edge), stops, Shader.TileMode.CLAMP)
            }
            Canvas(bitmap).apply {
                if (status != "open") {
                    val horizontal = LinearGradient(0f, 0f, pixels.toFloat(), 0f, intArrayOf(0, 0, (tint and 0xFFFFFF) or 0x66000000, (tint and 0xFFFFFF) or 0x80000000.toInt(), (tint and 0xFFFFFF) or 0x66000000, 0, 0), stops, Shader.TileMode.CLAMP)
                    val vertical = LinearGradient(0f, 0f, 0f, height.toFloat(), intArrayOf(0x00FFFFFF, 0xFFFFFFFF.toInt(), 0x00FFFFFF), floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP)
                    drawRect(0f, 0f, pixels.toFloat(), height.toFloat(), Paint().apply { shader = ComposeShader(horizontal, vertical, PorterDuff.Mode.DST_IN) })
                }
                val half = 0.65f * density
                drawRect(0f, height / 2f - half, pixels.toFloat(), height / 2f + half, core)
            }
            return bitmap
        }
        internal fun viewsForOptions(context: Context, options: Bundle, compactDefault: Boolean, now: Long): RemoteViews {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val sizes = BundleCompat.getParcelableArrayList(options, AppWidgetManager.OPTION_APPWIDGET_SIZES, SizeF::class.java)
                    ?.filter { it.width.isFinite() && it.height.isFinite() && it.width > 0 && it.height > 0 }?.distinct()?.take(16)
                if (!sizes.isNullOrEmpty()) return RemoteViews(sizes.associateWith { views(context, it.width.toInt(), it.height.toInt(), now) })
            }
            val width = if (compactDefault) 170 else 330
            val portrait = views(context, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, width), options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 170), now)
            val landscape = views(context, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, width), options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 170), now)
            return RemoteViews(landscape, portrait)
        }
        internal fun views(context: Context, width: Int, height: Int, now: Long): RemoteViews {
            val compact = width < 240; val flat = height < 100
            val snapshot = WidgetStore.read(context, now); val event = snapshot?.event
            val fontScale = context.resources.configuration.fontScale
            val logicalHeight = height / fontScale
            val large = width >= 300 && height >= 290 && logicalHeight >= 250
            val roomy = width >= 300 && width / fontScale >= 240 && height >= 160 && logicalHeight >= 130
            val card = large || roomy
            val tall = !flat && width < 300 && logicalHeight >= 200 && height >= width
            val spacious = !large && roomy && height >= 210 && logicalHeight >= 160
            val views = RemoteViews(context.packageName, if (flat) { if (compact) R.layout.widget_event_flat_small else R.layout.widget_event_flat } else if (tall) R.layout.widget_event_tall else if (large) R.layout.widget_event_large else if (spacious) R.layout.widget_event_spacious else if (card) R.layout.widget_event_card else if (compact) R.layout.widget_event_small else R.layout.widget_event)
            fun show(id: Int, value: Boolean) = views.setViewVisibility(id, if (value) View.VISIBLE else View.GONE)
            fun size(id: Int, value: Float) = views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, value)
            var largeLogoSize = if (large && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) 56 else 40
            var calendarLayoutWidth = if (spacious) 72f else if (large) 64f else if (card) 50f else 40f
            val date = event?.let { Instant.ofEpochMilli(it.start).atZone(WidgetSnapshot.zone) }
            val relative = event?.let { WidgetSnapshot.day(it.start, now) }
            val day = date?.format(DateTimeFormatter.ofPattern("d", Locale.GERMAN)).orEmpty()
            views.setTextViewText(R.id.widget_day, day)
            val baseDaySize = when {
                flat -> if (compact) 10f else 13f
                spacious -> if (fontScale > 1.15f) 32f else 40f
                large -> if (fontScale > 1.15f) 30f else 36f
                width < 150 -> 18f
                fontScale > 1.15f -> if (card) 23f else 18f
                card -> 28f
                else -> 24f
            }
            val metrics = context.resources.displayMetrics
            val dayPaint = Paint().apply { typeface = Typeface.DEFAULT_BOLD; textSize = baseDaySize * metrics.scaledDensity }
            val availableDayWidth = if (flat) (if (compact) 20f else 28f) else if (spacious) 64f else if (large) 56f else if (card) 42f else 32f
            val fit = if (day.isEmpty()) 1f else ((availableDayWidth - 2f) * metrics.density / dayPaint.measureText(day)).coerceAtMost(1f)
            size(R.id.widget_day, baseDaySize * fit)
            val monthText = date?.format(DateTimeFormatter.ofPattern("MMM", Locale.GERMAN))?.uppercase(Locale.GERMAN).orEmpty()
            val baseMonthSize = if (flat) (if (compact) 8f else 9f) else if (spacious) 14f else if (large) 13f else if (width < 150) 9f else if (fontScale > 1.15f) 10f else 12f
            val monthPaint = Paint().apply { typeface = Typeface.DEFAULT_BOLD; textSize = baseMonthSize * metrics.scaledDensity }
            val monthFit = if (monthText.isEmpty()) 1f else ((availableDayWidth + 2f) * metrics.density / monthPaint.measureText(monthText)).coerceAtMost(1f)
            size(R.id.widget_month, baseMonthSize * monthFit)
            val weekdayText = relative?.takeIf { it in listOf("Heute", "Morgen") } ?: date?.format(DateTimeFormatter.ofPattern("EEE", Locale.GERMAN)).orEmpty()
            size(R.id.widget_weekday, if (spacious || large) 14f else if (width < 150 || fontScale > 1.15f) 10f else 12f)
            views.setTextViewText(R.id.widget_weekday, weekdayText)
            views.setTextViewText(R.id.widget_month, monthText)
            val showBindings = !flat && logicalHeight >= 140
            show(R.id.widget_bindings, showBindings)
            show(R.id.widget_binding_gap, showBindings)
            show(R.id.widget_binding_headroom, showBindings)
            show(R.id.widget_date_line, !flat && logicalHeight >= 140)
            show(R.id.widget_weekday, !flat); show(R.id.widget_month, event != null)
            show(R.id.widget_brand, false)
            show(R.id.widget_date, event != null); show(R.id.widget_separator, false)
            val title = event?.title ?: if (snapshot == null) "H₂O öffnen, um Termine zu laden." else if (snapshot.stale) "Keine gespeicherten Termine · H₂O öffnen" else "Keine kommenden Termine"
            views.setTextViewText(R.id.widget_title, title)
            val titleSize = when {
                flat -> 12f
                large -> if (fontScale > 1.15f) 19f else 24f
                spacious -> if (fontScale > 1.15f) 20f else 26f
                width >= 450 && height >= 250 -> if (fontScale > 1.15f) 15f else 18f
                card -> if (fontScale > 1.15f) 15f else if (height <= 165) 18f else 20f
                compact -> if (height >= 150) (if (fontScale > 1.15f) 13f else 15f) else if (fontScale > 1.15f) 11f else 12f
                else -> 13f
            }
            var renderedTitleSize = titleSize
            size(R.id.widget_title, titleSize)
            views.setInt(R.id.widget_title, "setMaxLines", if (flat) 1 else 2)
            show(R.id.widget_title, !(flat && compact && event != null))
            val time = event?.let { if (it.allDay) "Ganztägig" else date!!.format(DateTimeFormatter.ofPattern("HH:mm")) }.orEmpty()
            views.setTextViewText(R.id.widget_time, time)
            views.setTextViewText(R.id.widget_location, if (flat || width < 150) time else "$time · ${event?.location.orEmpty()}")
            views.setTextViewText(R.id.widget_clothing, event?.clothing.orEmpty())
            show(R.id.widget_location, event != null)
            show(R.id.widget_clothing, event != null && !flat && (card || logicalHeight >= 140) && event.clothing.isNotEmpty())
            size(R.id.widget_location, if (flat) 10f else if (spacious) (if (fontScale > 1.15f) 11f else 13f) else if (large) (if (fontScale > 1.15f) 10f else 13f) else if (fontScale > 1.15f) (if (card) 10f else 8f) else if (card) 12f else 9f)
            size(R.id.widget_clothing, if (spacious) (if (fontScale > 1.15f) 10f else 12f) else if (large) (if (fontScale > 1.15f) 9f else 12f) else if (fontScale > 1.15f) (if (card) 9f else 7f) else if (card) 11f else 8f)
            // Spend additional launcher height on the actual date and topic.
            // Reserve the response targets and following appointments before growing text.
            if (!flat && event != null) {
                val followingCount = if (large) snapshot?.following?.size?.coerceAtMost(2) ?: 0 else 0
                val followingHeight = if (followingCount == 0) 0f else 26f + followingCount * maxOf(36f, 29f * fontScale + 4f)
                val replyHeight = if (card) 48f + 16f * fontScale + if (large) 22f else 0f else maxOf(32f, 30f * fontScale)
                val bodyHeight = (height - 24f - replyHeight - followingHeight).coerceAtLeast(1f)
                if (large && bodyHeight < 112f * fontScale) largeLogoSize = 40
                val grow = logicalHeight >= 140 && bodyHeight >= 70
                val dateHeight = if (tall) bodyHeight * if (bodyHeight >= 220) 0.55f else 0.44f else bodyHeight
                val desiredWidth = if (tall) (dateHeight * 0.70f).coerceIn(80f, 116f)
                    else (bodyHeight * 0.58f).coerceIn(56f, 112f).coerceAtMost((width - 24f) * 0.34f)
                val fixedWidth = if (tall) 80f else if (spacious) 72f else if (large) 64f else if (card) 50f else 40f
                val dateWidth = if (grow && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) desiredWidth else fixedWidth
                calendarLayoutWidth = dateWidth
                if (grow && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) views.setViewLayoutWidth(R.id.widget_date, dateWidth, TypedValue.COMPLEX_UNIT_DIP)
                fun fitted(sp: Float, text: String): Float {
                    val paint = Paint().apply { typeface = Typeface.DEFAULT_BOLD; textSize = sp * metrics.scaledDensity }
                    return if (text.isEmpty()) sp else sp * (((dateWidth - 4f) * metrics.density / paint.measureText(text)).coerceAtMost(1f))
                }
                val weekdaySize = if (grow) (dateHeight / fontScale * 0.115f).coerceIn(if (tall) 14f else 12f, if (tall) 20f else 18f)
                    else if (spacious || large) 14f else if (width < 150 || fontScale > 1.15f) 10f else 12f
                size(R.id.widget_weekday, fitted(weekdaySize, weekdayText))
                if (grow) {
                    val monthSize = (dateHeight / fontScale * 0.12f).coerceIn(13f, 22f)
                    val daySize = ((dateHeight / fontScale - 1.2f * (monthSize + weekdaySize) - 17f) / 1.2f).coerceIn(22f, 82f)
                    size(R.id.widget_month, fitted(monthSize, monthText))
                    size(R.id.widget_day, fitted(daySize, day))
                    val textHeight = (if (tall) bodyHeight - dateHeight - 8f else bodyHeight) / fontScale
                    val locationSize = (textHeight / 10f).coerceIn(if (card) 11f else 9f, 16f)
                    val clothingSize = (textHeight / 12f).coerceIn(if (card) 10f else 8f, 14f)
                    val lines = 2
                    val metadataHeight = if (large && fontScale <= 1.2f) maxOf(largeLogoSize / fontScale, 1.2f * (locationSize + clothingSize)) else 1.2f * (locationSize + clothingSize)
                    val maxTitle = ((textHeight - metadataHeight - 4f) / (lines * 1.2f)).coerceAtLeast(12f)
                    val titleLimit = if (compact && !tall) titleSize else if (tall) 28f else 36f
                    val growingTitle = maxOf(titleSize, textHeight * 0.19f).coerceAtMost(titleLimit).coerceAtMost(maxTitle)
                    renderedTitleSize = growingTitle
                    size(R.id.widget_title, growingTitle)
                    views.setInt(R.id.widget_title, "setMaxLines", lines)
                    size(R.id.widget_location, locationSize)
                    size(R.id.widget_clothing, clothingSize)
                }
            }
            val availableText = (width - calendarLayoutWidth - 34f).coerceAtLeast(1f)
            val titlePaint = Paint().apply { typeface = Typeface.DEFAULT_BOLD; textSize = renderedTitleSize * metrics.scaledDensity }
            val titleWidth = titlePaint.measureText(title) / metrics.density
            val logoSize = if (!card || fontScale > 1.2f || event == null) 0 else if (large) largeLogoSize else if (titleWidth <= availableText - 60f) 48 else if (titleWidth <= (availableText - 40f) * 1.7f) 28 else 0
            show(R.id.widget_logo, logoSize > 0)
            views.setViewPadding(R.id.widget_details, 0, 0, ((if (logoSize > 0 && !large) logoSize + 10 else 0) * metrics.density).toInt(), 0)
            if (logoSize > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                views.setViewLayoutWidth(R.id.widget_logo, logoSize.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
                views.setViewLayoutHeight(R.id.widget_logo, logoSize.toFloat(), TypedValue.COMPLEX_UNIT_DIP)
            }
            val prefs = WidgetStore.prefs(context)
            val job = runCatching { prefs.getString("job", null)?.let(::JSONObject)?.takeIf { it.optString("eventId") == event?.id } }.getOrNull()
            if (job?.optString("phase") == "saving" && now - job.optLong("startedAt") >= 30000) {
                prefs.edit().putString("job", job.put("phase", "retry").toString()).apply()
            }
            val saving = job?.optString("phase") == "saving"
            val retry = job != null && !saving
            val message = prefs.getString("message", null)
            val notice = prefs.getString("notice", null)
            val canReply = event != null && event.canReply && WidgetEvent.validID(event.id) && event.start > now && snapshot?.stale == false && prefs.getLong("expires", 0) > now && prefs.getString("grant", null) != null
            val actions = card && event != null && !retry && message == null
            val status = when (event?.status) {
                "yes" -> "Dabei"; "excused" -> if (flat && compact) "Entsch." else "Entschuldigt"; "maybe" -> "Unsicher"; else -> "Offen"
            }
            val statusText = when {
                saving -> if (card) "" else status
                retry -> "Nicht bestätigt"
                message != null -> message
                notice != null -> notice
                snapshot?.stale == true -> "Stand veraltet · H₂O öffnen"
                card && event?.status in listOf("yes", "excused", "maybe") -> ""
                card -> if (event?.reminded == true) "Bitte Rückmeldung geben" else "Rückmeldung offen"
                else -> status
            }
            views.setTextViewText(R.id.widget_status, statusText)
            views.setTextColor(R.id.widget_status, if (job == null && message == null && event?.status == "open") 0xFFF4C542.toInt() else 0xFFC6D2DF.toInt())
            // Keep notification space stable; successful replies show no footer label.
            show(R.id.widget_footer, event != null)
            show(R.id.widget_status_icon, false)
            show(R.id.widget_time, false)
            show(R.id.widget_note, snapshot?.stale == true && event != null)
            views.setContentDescription(R.id.widget_note, "Gespeicherter Kalenderstand · H₂O öffnen")
            val open = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(android.net.Uri.parse(PortalLinks.HOME + "?nativePage=terms" + if (event != null && WidgetEvent.validID(event.id)) "&event=${event.id}" else ""))
            val openPending = PendingIntent.getActivity(context, 42, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_root, openPending)
            views.setOnClickPendingIntent(R.id.widget_footer, openPending)
            if (!flat) {
                show(R.id.widget_actions, actions); show(R.id.widget_edit, false); show(R.id.widget_hint, false)
                views.setInt(R.id.widget_footer, "setMinimumHeight", ((if (card) 12 else 28) * metrics.density).toInt())
                if (card) {
                    show(R.id.widget_status_line, event != null)
                    if (event != null) views.setImageViewBitmap(R.id.widget_status_line, statusLine(width, if (saving) "open" else event.status, metrics.density))
                    for ((loadingID, target) in listOf(R.id.widget_reply_loading_yes to "yes", R.id.widget_reply_loading_excused to "excused", R.id.widget_reply_loading_maybe to "maybe")) {
                        val moving = saving && job?.optString("status") == target
                        show(loadingID, moving)
                        views.setProgressBar(loadingID, 100, 0, true)
                    }
                    show(R.id.widget_reply_section, event != null)
                    show(R.id.widget_retry, event != null && retry)
                    views.setTextViewText(R.id.widget_retry, if (canReply) "Erneut versuchen" else "In H₂O öffnen")
                    views.setOnClickPendingIntent(R.id.widget_retry, if (canReply && event != null) WidgetReplyReceiver.pending(context, event, "retry") else openPending)
                    for ((id, answer) in listOf(R.id.widget_reply_yes to "yes", R.id.widget_reply_excused to "excused", R.id.widget_reply_maybe to "maybe")) {
                        val selected = event?.status == answer
                        val pending = saving && job?.optString("status") == answer
                        views.setTextViewText(id, (if (selected) "✓ " else "○ ") + when (answer) { "yes" -> "Dabei"; "excused" -> "Entschuldigt"; else -> "Unsicher" })
                        val selectedBackground = when (answer) { "yes" -> R.drawable.widget_segment_yes; "excused" -> R.drawable.widget_segment_excused; else -> R.drawable.widget_segment_maybe }
                        views.setInt(id, "setBackgroundResource", if (selected) selectedBackground else 0)
                        views.setTextColor(id, if (selected) (if (answer == "yes") 0xFFFFFFFF.toInt() else 0xFF2D210A.toInt()) else 0xFFC6D2DF.toInt())
                        views.setBoolean(id, "setEnabled", canReply && job == null)
                        views.setFloat(id, "setAlpha", if (canReply) 1f else 0.55f)
                        views.setContentDescription(id, (when (answer) { "yes" -> "Dabei"; "excused" -> "Entschuldigt"; else -> "Unsicher" }) + if (selected) ". Ausgewählt" else if (pending) ". Wird gespeichert" else "")
                        if (event != null && canReply) views.setOnClickPendingIntent(id, WidgetReplyReceiver.pending(context, event, answer))
                    }
                }
                show(R.id.widget_following, large && snapshot?.following?.isNotEmpty() == true)
                for ((index, id) in listOf(R.id.widget_following_one, R.id.widget_following_two).withIndex()) {
                    val next = snapshot?.following?.getOrNull(index)
                    show(id, next != null)
                    views.setTextViewText(id, next?.let {
                        val nextDate = Instant.ofEpochMilli(it.start).atZone(WidgetSnapshot.zone)
                        nextDate.format(DateTimeFormatter.ofPattern("d. MMM", Locale.GERMAN)).uppercase(Locale.GERMAN) + " · " + it.title + " · " + (if (it.allDay) "Ganztägig" else nextDate.format(DateTimeFormatter.ofPattern("HH:mm"))) + " ›"
                    }.orEmpty())
                    if (next != null && WidgetEvent.validID(next.id)) {
                        val link = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(android.net.Uri.parse(PortalLinks.HOME + "?nativePage=terms&event=${next.id}"))
                        views.setOnClickPendingIntent(id, PendingIntent.getActivity(context, 100 + index, link, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                    }
                }
            }
            if (retry && canReply && event != null) views.setOnClickPendingIntent(R.id.widget_footer, WidgetReplyReceiver.pending(context, event, "retry"))
            val spokenDay = date?.format(DateTimeFormatter.ofPattern("EEEE, d. MMMM yyyy", Locale.GERMAN)).orEmpty()
            views.setContentDescription(R.id.widget_root, if (event != null) listOf(spokenDay, event.title, time, event.location, event.clothing, status, if (saving) "Rückmeldung wird gespeichert" else statusText, if (snapshot?.stale == true) "Gespeicherter Stand" else "").filter { it.isNotEmpty() }.joinToString(". ") else title)
            return views
        }
    }
}
class CompactNextEventWidget : NextEventWidget()
class WidgetClockWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result { NextEventWidget.updateAll(applicationContext); return Result.success() }
}
