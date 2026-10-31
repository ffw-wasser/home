package de.feuerwehrwasser.h2o
import org.junit.Assert.*
import org.junit.Test
class WidgetStateTest {
    private val now = 1_800_000_000_000L
    private fun event(end: Long) = WidgetEvent("Test", now, end, "Test", "Test", "yes", false)
    @Test fun emptyStateExpiresToo() { val s=WidgetState(now,null,false);assertTrue(s.valid(now));assertFalse(s.valid(now+WidgetState.MAX_AGE));assertEquals(now+WidgetState.MAX_AGE,s.nextUpdate(now)) }
    @Test fun eventEndsBeforeSnapshotExpires() { val s=WidgetState(now,event(now+3600000),false);assertNotNull(s.visibleEvent(now));assertNull(s.visibleEvent(now+3600000));assertEquals(now+3600000,s.nextUpdate(now)) }
    @Test fun longEventCannotExtendCacheLifetime() { val s=WidgetState(now,event(now+86400000),false);assertNull(s.visibleEvent(now+WidgetState.MAX_AGE));assertEquals(now+WidgetState.MAX_AGE,s.nextUpdate(now)) }
    @Test fun futureDatedSnapshotsAreRejected() { assertFalse(WidgetState(now+61000,null,false).valid(now)) }
}
