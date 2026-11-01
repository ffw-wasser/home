package de.feuerwehrwasser.h2o
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
class WidgetSnapshotTest {
 private fun time(value: String) = Instant.parse(value).toEpochMilli()
 @Test fun midnightAndDstUseBerlin() {
  val now = time("2026-10-24T22:30:00Z")
  assertEquals("Heute", WidgetSnapshot.day(time("2026-10-25T18:00:00Z"), now))
  assertEquals("Morgen", WidgetSnapshot.day(time("2026-10-26T18:00:00Z"), now))
  assertEquals("Heute", WidgetSnapshot.day(time("2026-03-29T18:00:00Z"), time("2026-03-28T23:30:00Z")))
 }
 @Test fun emptySnapshotsExpireAndFutureSnapshotsAreRejected() {
  val now = time("2026-11-01T12:00:00Z")
  assertTrue(WidgetSnapshot(now, null, false).fresh(now))
  assertFalse(WidgetSnapshot(now - 12 * 3600000L, null, false).fresh(now))
  assertFalse(WidgetSnapshot(now + 61000, null, false).fresh(now))
 }
 @Test fun expiredEventsAndUntrustedFieldsAreRejected() {
  val now = System.currentTimeMillis()
  val event = WidgetEvent("Probe", now + 1000, now + 3600000, "GH Wasser", "Einsatzkleidung", "yes", false)
  assertTrue(event.valid(now))
  assertFalse(event.copy(end = now).valid(now))
  assertFalse(event.copy(status = "admin").valid(now))
  assertFalse(event.copy(title = "Probe\nSecret").valid(now))
  assertFalse(event.copy(title = "a".repeat(101)).valid(now))
 }
}
