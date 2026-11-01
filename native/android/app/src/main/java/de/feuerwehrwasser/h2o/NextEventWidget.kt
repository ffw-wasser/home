package de.feuerwehrwasser.h2o

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
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
        }
        internal fun viewsForOptions(context: Context, options: Bundle, compactDefault: Boolean, now: Long): RemoteViews {
            val defaultWidth = if (compactDefault) 170 else 330
            // Android supplies portrait as min-width/max-height, landscape as max-width/min-height.
            val portrait = views(context, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, defaultWidth), options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 170), now)
            val landscape = views(context, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, defaultWidth), options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 170), now)
            return RemoteViews(landscape, portrait)
        }
        internal fun views(context: Context, width: Int, height: Int, now: Long): RemoteViews {
            val compact = width < 240
            val short = height < 140
            val snapshot = WidgetStore.read(context, now)
            val event = snapshot?.event
            val views = RemoteViews(context.packageName, if (compact) R.layout.widget_event_small else R.layout.widget_event)
            val date = event?.let { Instant.ofEpochMilli(it.start).atZone(WidgetSnapshot.zone) }
            val day = event?.let { WidgetSnapshot.day(it.start, now) }
            val relative = day == "Heute" || day == "Morgen"
            val dayText = if (event == null) "" else if (relative) day else date!!.format(DateTimeFormatter.ofPattern(if (compact) "dd MMM" else "dd", Locale.GERMAN)).replace(".", "").uppercase(Locale.GERMAN)
            views.setTextViewText(R.id.widget_day, dayText)
            views.setTextViewText(R.id.widget_weekday, date?.format(DateTimeFormatter.ofPattern("EEEE", Locale.GERMAN)) ?: "")
            views.setTextViewText(R.id.widget_month, date?.format(DateTimeFormatter.ofPattern("MMMM", Locale.GERMAN))?.uppercase(Locale.GERMAN) ?: "")
            val daySize = when { compact -> if (short) 24f else if (height < 160) 28f else 34f; relative -> if (short) 22f else 25f; else -> if (height < 170) 28f else 38f }
            val metrics = context.resources.displayMetrics
            val dayPaint = Paint().apply { typeface = Typeface.DEFAULT_BOLD; textSize = daySize * metrics.scaledDensity }
            val available = (if (compact) width - 20 else 88).coerceAtLeast(1) * metrics.density
            val fit = if (dayText.isNullOrEmpty()) 1f else (available / dayPaint.measureText(dayText)).coerceAtMost(1f)
            views.setTextViewTextSize(R.id.widget_day, TypedValue.COMPLEX_UNIT_SP, daySize * fit)
            views.setViewVisibility(R.id.widget_brand, if (short) View.GONE else View.VISIBLE)
            views.setViewVisibility(R.id.widget_date, if (event == null) View.GONE else View.VISIBLE)
            views.setViewVisibility(R.id.widget_separator, if (event == null) View.GONE else View.VISIBLE)
            views.setViewVisibility(R.id.widget_weekday, if (event != null && height >= 160) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.widget_month, if (event != null && !compact && !relative) View.VISIBLE else View.GONE)
            val title = event?.title?.let { if (it.trim().equals("Probe", ignoreCase = true)) "Nächste Probe" else it }
                ?: if (snapshot == null) "H₂O öffnen, um Termine zu laden." else "Keine kommenden Termine"
            views.setTextViewText(R.id.widget_title, title)
            views.setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, if (compact) (if (short) 11f else 12f) else (if (short) 15f else 18f))
            views.setInt(R.id.widget_title, "setMaxLines", if (event == null) 3 else 1)
            val time = event?.let { if (it.allDay) "Ganztägig" else Instant.ofEpochMilli(it.start).atZone(WidgetSnapshot.zone).format(DateTimeFormatter.ofPattern("HH:mm")) + if (compact) "" else " Uhr" } ?: ""
            views.setTextViewText(R.id.widget_time, time)
            views.setTextViewText(R.id.widget_location, event?.location?.ifEmpty { "GH Wasser" } ?: "")
            views.setTextViewText(R.id.widget_clothing, event?.clothing ?: "")
            views.setViewVisibility(R.id.widget_location, if (event != null && !compact) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.widget_clothing, if (event != null && !compact && !short && event.clothing.isNotEmpty()) View.VISIBLE else View.GONE)
            val response = when (event?.status) {
                "yes" -> WidgetResponse("Dabei", 0xFF1F7847.toInt(), 0xFFE3EDE4.toInt(), R.drawable.widget_status_yes)
                "excused" -> WidgetResponse("Entschuldigt", 0xFFB3313B.toInt(), 0xFFF2E1DE.toInt(), R.drawable.widget_status_excused)
                "maybe" -> WidgetResponse("Unsicher", 0xFF8F611A.toInt(), 0xFFF1E9D9.toInt(), R.drawable.widget_status_maybe)
                else -> WidgetResponse("Offen", 0xFF5C697A.toInt(), 0xFFE8E9E7.toInt(), R.drawable.widget_status_open)
            }
            views.setViewVisibility(R.id.widget_footer, if (event != null) View.VISIBLE else View.GONE)
            views.setInt(R.id.widget_footer, "setBackgroundColor", response.background)
            views.setTextViewText(R.id.widget_status, response.title)
            views.setTextColor(R.id.widget_status, response.color)
            views.setImageViewResource(R.id.widget_status_icon, response.icon)
            views.setViewVisibility(R.id.widget_note, if (snapshot?.stale == true && event != null) View.VISIBLE else View.GONE)
            views.setContentDescription(R.id.widget_note, "Gespeicherter Kalenderstand · H₂O öffnen")
            views.setContentDescription(R.id.widget_root, if (event != null) listOfNotNull(day, event.title, time, event.location, event.clothing, response.title, if (snapshot?.stale == true) "Gespeicherter Stand, H₂O öffnen" else null).filter { it.isNotEmpty() }.joinToString(". ") else title)
            val open = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(android.net.Uri.parse(PortalLinks.HOME + "?nativePage=terms"))
            views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 42, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            return views
        }
        private data class WidgetResponse(val title: String, val color: Int, val background: Int, val icon: Int)

    }
}
class CompactNextEventWidget : NextEventWidget()

class WidgetClockWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result { NextEventWidget.updateAll(applicationContext); return Result.success() }
}
