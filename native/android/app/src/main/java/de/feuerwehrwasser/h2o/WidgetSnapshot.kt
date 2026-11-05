package de.feuerwehrwasser.h2o

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

// No full identity session, member names, calendar URLs or medical information.
data class WidgetEvent(val title: String, val start: Long, val end: Long, val location: String,
                       val clothing: String, val status: String, val allDay: Boolean,
                       val id: String = "", val version: Int = 0, val canReply: Boolean = false, val reminded: Boolean = false) {
    fun valid(now: Long): Boolean = start > 0 && end > start && end - start < 7 * 86400000L &&
        end > now && start < now + 366 * 86400000L && status in setOf("open", "yes", "excused", "maybe") &&
        clean(title, 100) && clean(location, 100) && clean(clothing, 80) && version >= 0 && (id.isEmpty() || validID(id))
    companion object {
        fun validID(value: String) = value.matches(Regex("[A-Za-z0-9_-]{43}"))
        fun clean(value: String, max: Int) = value.length <= max && value.none { it.isISOControl() }
    }
}
data class WidgetSnapshot(val updatedAt: Long, val event: WidgetEvent?, val stale: Boolean, val following: List<WidgetEvent> = emptyList()) {
    fun fresh(now: Long) = updatedAt <= now + 60000 && now - updatedAt < 12 * 3600000L
    fun displayable(now: Long) = updatedAt <= now + 60000 && now - updatedAt < 30 * 86400000L
    companion object {
        fun orderEvents(events: List<WidgetEvent>): List<WidgetEvent> {
            val ordered = events.sortedBy { it.start }
            val first = ordered.firstOrNull() ?: return ordered
            if (first.canReply) return ordered
            val preferred = ordered.firstOrNull { it.canReply && it.start < first.end && it.end > first.start }
                ?: return ordered
            return listOf(preferred) + ordered.filter { it !== preferred }
        }

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
