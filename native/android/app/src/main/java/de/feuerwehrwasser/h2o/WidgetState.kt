package de.feuerwehrwasser.h2o

data class WidgetEvent(val title: String, val start: Long, val end: Long, val location: String, val clothing: String, val status: String, val allDay: Boolean)
data class WidgetState(val updatedAt: Long, val event: WidgetEvent?, val stale: Boolean) {
    fun valid(now: Long): Boolean = updatedAt <= now + 60_000 && now - updatedAt < MAX_AGE
    fun visibleEvent(now: Long): WidgetEvent? = if (valid(now)) event?.takeIf { it.end > now } else null
    fun nextUpdate(now: Long): Long = minOf(updatedAt + MAX_AGE, event?.end?.takeIf { it > now } ?: Long.MAX_VALUE)
    companion object { const val MAX_AGE = 12 * 60 * 60 * 1000L }
}
