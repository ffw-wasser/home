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

class NextEventWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { updateAll(context); schedule(context) }
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { updateAll(context) }
    override fun onEnabled(context: Context) { schedule(context); updateAll(context) }
    override fun onDisabled(context: Context) { WorkManager.getInstance(context).cancelUniqueWork("h2o-widget-clock") }
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action in setOf(Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_DATE_CHANGED)) updateAll(context)
    }
    companion object {
        private fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork("h2o-widget-clock", ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<WidgetClockWorker>(15, TimeUnit.MINUTES).build())
        }
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val now = System.currentTimeMillis()
            for (id in manager.getAppWidgetIds(ComponentName(context, NextEventWidget::class.java))) {
                val compact = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) < 240
                val views = views(context, compact, now)
                manager.updateAppWidget(id, views)
            }
        }
        internal fun views(context: Context, compact: Boolean, now: Long): RemoteViews {
            val snapshot = WidgetStore.read(context, now)
            val event = snapshot?.event
            val views = RemoteViews(context.packageName, if (compact) R.layout.widget_event_small else R.layout.widget_event)
            views.setTextViewText(R.id.widget_day, event?.let { WidgetSnapshot.day(it.start, now) } ?: "Nächster Termin")
            views.setTextViewText(R.id.widget_title, event?.title ?: if (snapshot == null) "H₂O öffnen und aktualisieren" else "Keine kommenden Termine")
            views.setTextViewText(R.id.widget_time, event?.let { if (it.allDay) "Ganztägig" else Instant.ofEpochMilli(it.start).atZone(WidgetSnapshot.zone).format(DateTimeFormatter.ofPattern("HH:mm")) + " Uhr" } ?: "")
            views.setTextViewText(R.id.widget_location, event?.location ?: "")
            views.setTextViewText(R.id.widget_clothing, event?.clothing ?: "")
            views.setViewVisibility(R.id.widget_clothing, if (event?.clothing.isNullOrEmpty()) View.GONE else View.VISIBLE)
            views.setTextViewText(R.id.widget_status, when (event?.status) { "yes" -> "✓ Dabei"; "excused" -> "Entschuldigt"; "maybe" -> "Noch unsicher"; "open" -> "Rückmeldung offen"; else -> "" })
            views.setTextColor(R.id.widget_status, when (event?.status) { "yes" -> 0xFF246344.toInt(); "excused" -> 0xFF8A243C.toInt(); else -> 0xFF6B530A.toInt() })
            views.setTextViewText(R.id.widget_note, if (snapshot?.stale == true) "Gespeicherter Stand · H₂O öffnen" else "")
            views.setViewVisibility(R.id.widget_note, if (snapshot?.stale == true) View.VISIBLE else View.GONE)
            val open = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(android.net.Uri.parse(PortalLinks.HOME + "?nativePage=terms"))
            views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 42, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            return views
        }

    }
}
class WidgetClockWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result { NextEventWidget.updateAll(applicationContext); return Result.success() }
}
