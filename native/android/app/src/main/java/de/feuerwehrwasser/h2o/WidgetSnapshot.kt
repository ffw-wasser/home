package de.feuerwehrwasser.h2o

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

// No identities, credentials, calendar URLs or medical information in this model.
data class WidgetEvent(val title: String, val start: Long, val end: Long, val location: String,
                       val clothing: String, val status: String, val allDay: Boolean) {
    fun valid(now: Long): Boolean = start > 0 && end > start && end - start < 7 * 86400000L &&
        end > now && start < now + 366 * 86400000L && status in setOf("open", "yes", "excused", "maybe") &&
        clean(title, 100) && clean(location, 100) && clean(clothing, 80)
    companion object {
        fun clean(value: String, max: Int) = value.length <= max && value.none { it.isISOControl() }
    }
}
data class WidgetSnapshot(val updatedAt: Long, val event: WidgetEvent?, val stale: Boolean) {
    fun fresh(now: Long) = updatedAt <= now + 60000 && now - updatedAt < 12 * 3600000L
    companion object {
        val zone: ZoneId = ZoneId.of("Europe/Berlin")
        fun day(start: Long, now: Long): String {
            val date = Instant.ofEpochMilli(start).atZone(zone).toLocalDate()
            val today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate()
            return when (ChronoUnit.DAYS.between(today, date)) {
                0L -> "Heute"
                1L -> "Morgen"
                else -> date.format(DateTimeFormatter.ofPattern("EEE, dd.MM.", java.util.Locale.GERMAN))
            }
        }
    }
}
