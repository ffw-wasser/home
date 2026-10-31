package de.feuerwehrwasser.h2o

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class H2OWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { refresh(context) }
    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { refresh(context) }
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action in setOf(REFRESH, Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED)) refresh(context)
    }
    companion object {
        private const val REFRESH = "de.feuerwehrwasser.h2o.WIDGET_REFRESH"
        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, H2OWidgetProvider::class.java))
            val now = System.currentTimeMillis(); val snapshot = WidgetStore.read(context, now)
            for (id in ids) {
                val wide = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) >= 250
                manager.updateAppWidget(id, render(context, snapshot, wide, now))
            }
            val alarm = context.getSystemService(AlarmManager::class.java)
            val pending = PendingIntent.getBroadcast(context, 71, Intent(context, H2OWidgetProvider::class.java).setAction(REFRESH), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            alarm.cancel(pending)
            if (ids.isNotEmpty() && snapshot != null) {
                // Inexact expiry avoids an intrusive exact-alarm permission. Android may defer it.
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, maxOf(now + 1000, snapshot.nextUpdate(now)), pending)
            }
        }
        fun render(context: Context, snapshot: WidgetState?, wide: Boolean, now: Long = System.currentTimeMillis()): RemoteViews {
            val checked = snapshot?.takeIf { it.valid(now) }; val event = checked?.visibleEvent(now)
            return RemoteViews(context.packageName, if (wide) R.layout.widget_medium else R.layout.widget_small).apply {
                setViewVisibility(R.id.widget_event, if (event == null) View.GONE else View.VISIBLE)
                setViewVisibility(R.id.widget_empty, if (event == null) View.VISIBLE else View.GONE)
                setTextViewText(R.id.widget_empty, if (checked == null) "H₂O öffnen, um Termine zu laden." else "Keine kommenden Termine")
                if (event != null) {
                    fun format(pattern: String) = SimpleDateFormat(pattern, Locale.GERMANY).apply { timeZone = TimeZone.getTimeZone("Europe/Berlin") }.format(Date(event.start))
                    setTextViewText(R.id.widget_title, event.title)
                    setTextViewText(R.id.widget_date, format("EEE, dd.MM.") + " · " + if (event.allDay) "Ganztägig" else format("HH:mm") + " Uhr")
                    setTextViewText(R.id.widget_status, mapOf("yes" to "Dabei", "excused" to "Entschuldigt", "maybe" to "Unsicher")[event.status] ?: "Offen")
                    setTextViewText(R.id.widget_updated, "Stand: " + SimpleDateFormat("HH:mm", Locale.GERMANY).apply { timeZone = TimeZone.getTimeZone("Europe/Berlin") }.format(Date(checked?.updatedAt ?: now)) + if (checked?.stale == true) " · Bitte prüfen" else "")
                    if (wide) { setTextViewText(R.id.widget_location, event.location.ifBlank { "GH Wasser" }); setTextViewText(R.id.widget_clothing, event.clothing) }
                }
                val open = Intent(context, MainActivity::class.java).setAction(MainActivity.OPEN_TERMS).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 70, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            }
        }
    }
}
