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
            val large = !compact && logicalHeight >= 290
            val views = RemoteViews(context.packageName, if (flat) { if (compact) R.layout.widget_event_flat_small else R.layout.widget_event_flat } else if (large) R.layout.widget_event_large else if (compact) R.layout.widget_event_small else R.layout.widget_event)
            fun show(id: Int, value: Boolean) = views.setViewVisibility(id, if (value) View.VISIBLE else View.GONE)
            fun size(id: Int, value: Float) = views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, value)
            val roomy = !compact && width / fontScale >= 280 && logicalHeight >= 155
            val smallDate = compact && !flat && logicalHeight >= 140
            val date = event?.let { Instant.ofEpochMilli(it.start).atZone(WidgetSnapshot.zone) }
            val relative = event?.let { WidgetSnapshot.day(it.start, now) }
            val day = when {
                event == null -> ""
                relative in listOf("Heute", "Morgen") -> relative!! + if (!compact && !flat) " · " + date!!.format(DateTimeFormatter.ofPattern("d. MMMM", Locale.GERMAN)) else ""
                smallDate -> date!!.format(DateTimeFormatter.ofPattern("dd", Locale.GERMAN))
                else -> date!!.format(DateTimeFormatter.ofPattern(if (flat || compact) "dd.MM." else "d. MMMM", Locale.GERMAN))
            }
            views.setTextViewText(R.id.widget_day, day)
            val baseDaySize = if (flat) (if (compact) 13f else 17f) else if (smallDate) 30f else if (roomy) 21f else 18f
            val metrics = context.resources.displayMetrics
            val dayPaint = Paint().apply { typeface = Typeface.DEFAULT_BOLD; textSize = baseDaySize * metrics.scaledDensity }
            val timePaint = Paint().apply { textSize = 10f * metrics.scaledDensity }
            val availableDayWidth = if (flat && compact) width - 16f - timePaint.measureText(if (event?.allDay == true) "Ganztägig" else "23:58") / metrics.density else if (flat) 66f else width - 20f
            val fit = if (day.isEmpty()) 1f else ((availableDayWidth - 2f).coerceAtLeast(1f) * metrics.density / dayPaint.measureText(day)).coerceAtMost(1f)
            size(R.id.widget_day, baseDaySize * fit)
            views.setTextViewText(R.id.widget_weekday, "")
            views.setTextViewText(R.id.widget_month, date?.format(DateTimeFormatter.ofPattern("MMMM", Locale.GERMAN)) ?: "")
            show(R.id.widget_weekday, false); show(R.id.widget_month, smallDate && relative !in listOf("Heute", "Morgen"))
            show(R.id.widget_brand, !flat && logicalHeight >= 140)
            show(R.id.widget_date, event != null); show(R.id.widget_separator, false)
            val title = event?.title ?: if (snapshot == null) "H₂O öffnen, um Termine zu laden." else "Keine kommenden Termine"
            views.setTextViewText(R.id.widget_title, title)
            size(R.id.widget_title, if (flat) 12f else if (large || width >= 450 && height >= 250) 24f else if (roomy) 16f else if (compact) 12f else 15f)
            views.setInt(R.id.widget_title, "setMaxLines", if (event == null && !flat) 3 else if (logicalHeight >= 155) 2 else 1)
            show(R.id.widget_title, !(flat && compact && event != null))
            val time = event?.let { if (it.allDay) "Ganztägig" else date!!.format(DateTimeFormatter.ofPattern("HH:mm")) } ?: ""
            views.setTextViewText(R.id.widget_time, time)
            views.setTextViewText(R.id.widget_location, "$time · ${event?.location.orEmpty()}")
            views.setTextViewText(R.id.widget_clothing, event?.clothing.orEmpty())
            show(R.id.widget_location, event != null && !flat && !compact && logicalHeight >= 140)
            show(R.id.widget_clothing, event != null && !flat && !compact && logicalHeight >= 155 && event.clothing.isNotEmpty())
            val prefs = WidgetStore.prefs(context)
            val job = runCatching { prefs.getString("job", null)?.let(::JSONObject)?.takeIf { it.optString("eventId") == event?.id } }.getOrNull()
            val timedOut = job != null && now - job.optLong("startedAt") >= 30000
            if (timedOut && job?.optString("phase") == "saving") prefs.edit().putString("job", job.put("phase", "retry").toString()).apply()
            val saving = job?.optString("phase") == "saving"
            val retry = job != null && !saving
            val message = prefs.getString("message", null)
            val canReply = event != null && event.canReply && WidgetEvent.validID(event.id) && event.start > now && snapshot?.stale == false && prefs.getLong("expires", 0) > now && prefs.getString("grant", null) != null
            val choosing = event?.status == "open" || prefs.getString("editing", null) == event?.id
            val actions = roomy && canReply && choosing && job == null && message == null
            val status = when (event?.status) { "yes" -> "✓ Dabei"; "excused" -> "× Entschuldigt"; "maybe" -> "? Unsicher"; else -> if (compact || flat) "Offen" else "Rückmeldung offen" }
            val statusText = when { saving -> "Wird gespeichert …"; retry -> "Unbestätigt · Erneut versuchen"; message != null -> message; else -> status }
            val statusColor = when (event?.status) { "yes" -> 0xFF294835; "excused" -> 0xFF512B35; "maybe" -> 0xFF513F25; else -> 0xFF253240 }.toInt()
            views.setInt(R.id.widget_footer, "setBackgroundColor", statusColor)
            views.setTextViewText(R.id.widget_status, statusText)
            size(R.id.widget_status, if (flat) 10f else 12f)
            views.setTextColor(R.id.widget_status, 0xFFF7F8FA.toInt())
            show(R.id.widget_footer, event != null && !actions)
            show(R.id.widget_status_icon, false)
            show(R.id.widget_time, event != null && (flat || compact || logicalHeight < 140) && !retry && !saving)
            show(R.id.widget_note, snapshot?.stale == true && event != null)
            views.setContentDescription(R.id.widget_note, "Gespeicherter Kalenderstand · H₂O öffnen")
            val open = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(android.net.Uri.parse(PortalLinks.HOME + "?nativePage=terms" + if (event != null && WidgetEvent.validID(event.id)) "&event=${event.id}" else ""))
            val openPending = PendingIntent.getActivity(context, 42, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_root, openPending)
            views.setOnClickPendingIntent(R.id.widget_footer, openPending)
            if (!flat) {
                show(R.id.widget_actions, actions)
                show(R.id.widget_edit, roomy && canReply && !choosing && job == null && message == null)
                views.setInt(R.id.widget_footer, "setMinimumHeight", ((if (roomy) 44 else 32) * context.resources.displayMetrics.density).toInt())
                show(R.id.widget_hint, actions && logicalHeight >= 190)
                views.setTextViewText(R.id.widget_hint, if (event?.reminded == true) "Bitte Rückmeldung geben" else "Rückmeldung offen")
                show(R.id.widget_following, large && snapshot?.following?.isNotEmpty() == true)
                for ((index, id) in listOf(R.id.widget_following_one, R.id.widget_following_two).withIndex()) {
                    val next = snapshot?.following?.getOrNull(index)
                    show(id, next != null)
                    views.setTextViewText(id, next?.let { WidgetSnapshot.day(it.start, now) + " · " + (if (it.allDay) "Ganztägig" else Instant.ofEpochMilli(it.start).atZone(WidgetSnapshot.zone).format(DateTimeFormatter.ofPattern("HH:mm"))) + "\n" + it.title }.orEmpty())
                    if (next != null && WidgetEvent.validID(next.id)) {
                        val link = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(android.net.Uri.parse(PortalLinks.HOME + "?nativePage=terms&event=${next.id}"))
                        views.setOnClickPendingIntent(id, PendingIntent.getActivity(context, 100 + index, link, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                    }
                }
                if (event != null && canReply) {
                    for ((id, answer) in listOf(R.id.widget_reply_yes to "yes", R.id.widget_reply_excused to "excused", R.id.widget_reply_maybe to "maybe", R.id.widget_edit to "edit")) views.setOnClickPendingIntent(id, WidgetReplyReceiver.pending(context, event, answer))
                    if (retry) views.setOnClickPendingIntent(R.id.widget_footer, WidgetReplyReceiver.pending(context, event, "retry"))
                }
            }
            views.setContentDescription(R.id.widget_root, if (event != null) listOf(day, event.title, time, event.location, event.clothing, statusText, if (snapshot?.stale == true) "Gespeicherter Stand" else "").filter { it.isNotEmpty() }.joinToString(". ") else title)
            return views
        }
    }
}
class CompactNextEventWidget : NextEventWidget()
class WidgetClockWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result { NextEventWidget.updateAll(applicationContext); return Result.success() }
}
