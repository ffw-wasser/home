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
            val date = event?.let { Instant.ofEpochMilli(it.start).atZone(WidgetSnapshot.zone) }
            val relative = event?.let { WidgetSnapshot.day(it.start, now) }
            val day = date?.format(DateTimeFormatter.ofPattern("d", Locale.GERMAN)).orEmpty()
            views.setTextViewText(R.id.widget_day, day)
            val baseDaySize = when {
                flat -> if (compact) 12f else 15f
                spacious -> if (fontScale > 1.15f) 36f else 46f
                large -> if (fontScale > 1.15f) 34f else 42f
                width < 150 -> 20f
                fontScale > 1.15f -> if (card) 26f else 20f
                card -> 32f
                else -> 28f
            }
            val metrics = context.resources.displayMetrics
            val dayPaint = Paint().apply { typeface = Typeface.DEFAULT_BOLD; textSize = baseDaySize * metrics.scaledDensity }
            val availableDayWidth = if (flat) (if (compact) 20f else 28f) else if (spacious) 64f else if (large) 56f else if (card) 42f else 32f
            val fit = if (day.isEmpty()) 1f else ((availableDayWidth - 2f) * metrics.density / dayPaint.measureText(day)).coerceAtMost(1f)
            size(R.id.widget_day, baseDaySize * fit)
            size(R.id.widget_month, if (flat) (if (compact) 6f else 7f) else if (spacious) 11f else if (large) 10f else if (width < 150) 7f else if (fontScale > 1.15f) 8f else 9f)
            val weekdayText = relative?.takeIf { it in listOf("Heute", "Morgen") } ?: date?.format(DateTimeFormatter.ofPattern("EEE", Locale.GERMAN)).orEmpty()
            size(R.id.widget_weekday, if (spacious || large) 14f else if (width < 150 || fontScale > 1.15f) 10f else 12f)
            views.setTextViewText(R.id.widget_weekday, weekdayText)
            views.setTextViewText(R.id.widget_month, date?.format(DateTimeFormatter.ofPattern("MMM", Locale.GERMAN))?.uppercase(Locale.GERMAN).orEmpty())
            show(R.id.widget_weekday, !flat); show(R.id.widget_month, event != null)
            show(R.id.widget_brand, false)
            show(R.id.widget_date, event != null); show(R.id.widget_separator, false)
            val title = event?.title ?: if (snapshot == null) "H₂O öffnen, um Termine zu laden." else "Keine kommenden Termine"
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
            size(R.id.widget_title, titleSize)
            views.setInt(R.id.widget_title, "setMaxLines", if (flat) 1 else if (large || spacious && (fontScale <= 1.15f || height >= 230) || !card && height >= 150 && logicalHeight >= 110) 3 else 2)
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
                val bodyHeight = (height - 18f - replyHeight - followingHeight).coerceAtLeast(1f)
                val grow = logicalHeight >= 140 && bodyHeight >= 70
                val dateHeight = if (tall) bodyHeight * if (bodyHeight >= 220) 0.55f else 0.44f else bodyHeight
                val desiredWidth = if (tall) (dateHeight * 0.70f).coerceIn(80f, 116f)
                    else (bodyHeight * 0.58f).coerceIn(56f, 112f).coerceAtMost((width - 24f) * 0.34f)
                val fixedWidth = if (tall) 80f else if (spacious) 72f else if (large) 64f else if (card) 50f else 40f
                val dateWidth = if (grow && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) desiredWidth else fixedWidth
                if (grow && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) views.setViewLayoutWidth(R.id.widget_date, dateWidth, TypedValue.COMPLEX_UNIT_DIP)
                fun fitted(sp: Float, text: String): Float {
                    val paint = Paint().apply { typeface = Typeface.DEFAULT_BOLD; textSize = sp * metrics.scaledDensity }
                    return if (text.isEmpty()) sp else sp * (((dateWidth - 4f) * metrics.density / paint.measureText(text)).coerceAtMost(1f))
                }
                val weekdaySize = if (grow) (dateHeight / fontScale * 0.115f).coerceIn(if (tall) 14f else 12f, if (tall) 20f else 18f)
                    else if (spacious || large) 14f else if (width < 150 || fontScale > 1.15f) 10f else 12f
                size(R.id.widget_weekday, fitted(weekdaySize, weekdayText))
                if (grow) {
                    val monthSize = (dateHeight / fontScale * 0.08f).coerceIn(10f, 16f)
                    val daySize = ((dateHeight / fontScale - 1.2f * (monthSize + weekdaySize) - 5f) / 1.2f).coerceIn(24f, 96f)
                    size(R.id.widget_month, fitted(monthSize, date?.format(DateTimeFormatter.ofPattern("MMM", Locale.GERMAN))?.uppercase(Locale.GERMAN).orEmpty()))
                    size(R.id.widget_day, fitted(daySize, day))
                    val textHeight = (if (tall) bodyHeight - dateHeight - 8f else bodyHeight) / fontScale
                    val locationSize = (textHeight / 10f).coerceIn(if (card) 11f else 9f, 16f)
                    val clothingSize = (textHeight / 12f).coerceIn(if (card) 10f else 8f, 14f)
                    val lines = if (tall || large || spacious || logicalHeight >= 140) 3 else 2
                    val maxTitle = ((textHeight - 1.2f * (locationSize + clothingSize) - 4f) / (lines * 1.2f)).coerceAtLeast(12f)
                    val titleLimit = if (compact && !tall) titleSize else if (tall) 28f else 36f
                    val growingTitle = maxOf(titleSize, textHeight * 0.19f).coerceAtMost(titleLimit).coerceAtMost(maxTitle)
                    size(R.id.widget_title, growingTitle)
                    views.setInt(R.id.widget_title, "setMaxLines", lines)
                    size(R.id.widget_location, locationSize)
                    size(R.id.widget_clothing, clothingSize)
                }
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
                saving -> "Wird gespeichert …"
                retry -> "Nicht bestätigt"
                message != null -> message
                notice != null -> notice
                card && event?.status in listOf("yes", "excused", "maybe") -> "✓ Gespeichert"
                card -> if (event?.reminded == true) "Bitte Rückmeldung geben" else "Rückmeldung offen"
                !flat && width >= 170 && event?.status in listOf("yes", "excused", "maybe") -> "$status · Gespeichert"
                else -> status
            }
            views.setTextViewText(R.id.widget_status, statusText)
            views.setTextColor(R.id.widget_status, if (job == null && message == null && event?.status == "open") 0xFFF4C542.toInt() else 0xFFB9BCC3.toInt())
            show(R.id.widget_footer, event != null)
            show(R.id.widget_status_icon, false); show(R.id.widget_time, false)
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
                    show(R.id.widget_reply_section, event != null)
                    show(R.id.widget_retry, event != null && retry)
                    views.setTextViewText(R.id.widget_retry, if (canReply) "Erneut versuchen" else "In H₂O öffnen")
                    views.setOnClickPendingIntent(R.id.widget_retry, if (canReply && event != null) WidgetReplyReceiver.pending(context, event, "retry") else openPending)
                    for ((id, answer) in listOf(R.id.widget_reply_yes to "yes", R.id.widget_reply_excused to "excused", R.id.widget_reply_maybe to "maybe")) {
                        val selected = job == null && event?.status == answer
                        val pending = saving && job?.optString("status") == answer
                        views.setTextViewText(id, (if (pending) "◌ " else if (selected) "✓ " else "○ ") + when (answer) { "yes" -> "Dabei"; "excused" -> "Entschuldigt"; else -> "Unsicher" })
                        val selectedBackground = when (answer) { "yes" -> R.drawable.widget_segment_yes; "excused" -> R.drawable.widget_segment_excused; else -> R.drawable.widget_segment_maybe }
                        views.setInt(id, "setBackgroundResource", if (selected) selectedBackground else 0)
                        views.setTextColor(id, if (selected) (if (answer == "yes") 0xFFFFFFFF.toInt() else 0xFF2D210A.toInt()) else 0xFFB9BCC3.toInt())
                        views.setBoolean(id, "setEnabled", canReply && job == null)
                        views.setFloat(id, "setAlpha", if (canReply && job == null) 1f else 0.55f)
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
            views.setContentDescription(R.id.widget_root, if (event != null) listOf(spokenDay, event.title, time, event.location, event.clothing, status, statusText, if (snapshot?.stale == true) "Gespeicherter Stand" else "").filter { it.isNotEmpty() }.joinToString(". ") else title)
            return views
        }
    }
}
class CompactNextEventWidget : NextEventWidget()
class WidgetClockWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result { NextEventWidget.updateAll(applicationContext); return Result.success() }
}
