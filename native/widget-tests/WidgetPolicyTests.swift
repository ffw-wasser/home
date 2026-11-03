import XCTest
@testable import WidgetPolicy

final class WidgetPolicyTests: XCTestCase {
    func date(_ value: String) -> Date { ISO8601DateFormatter().date(from: value)! }

    func testRelativeDaysUseBerlinCalendarIncludingClockChanges() {
        for (reference, tomorrow) in [
            ("2026-03-28T23:30:00Z", "2026-03-29T22:30:00Z"),
            ("2026-10-24T22:30:00Z", "2026-10-25T23:30:00Z")
        ] {
            XCTAssertEqual(H2OWidgetDateLabel.relativeDay(for: date(reference), comparedTo: date(reference)), "Heute")
            XCTAssertEqual(H2OWidgetDateLabel.relativeDay(for: date(tomorrow), comparedTo: date(reference)), "Morgen")
            XCTAssertNil(H2OWidgetDateLabel.relativeDay(for: date(reference), comparedTo: date(tomorrow)))
        }
        XCTAssertNil(H2OWidgetDateLabel.relativeDay(for: date("2026-11-03T18:00:00Z"), comparedTo: date("2026-11-01T12:00:00Z")))
    }

    func testMidnightRefreshChangesTomorrowToTodayWithoutExtendingCache() {
        let now = date("2026-11-01T21:00:00Z")
        let start = date("2026-11-02T06:00:00Z")
        let event = H2OWidgetEvent(title: "Probe", start: start, end: start.addingTimeInterval(3600), location: "Test", clothing: "Test", status: "yes", allDay: false)
        let snapshot = H2OWidgetSnapshot(updatedAt: now, event: event, stale: false)
        let states = H2OWidgetStorage.timeline(snapshot: snapshot, now: now)
        XCTAssertEqual(states.map(\.date), [now, date("2026-11-01T23:00:00Z"), event.end, now.addingTimeInterval(43200), now.addingTimeInterval(H2OWidgetStorage.displayAge)])
        XCTAssertEqual(H2OWidgetDateLabel.relativeDay(for: start, comparedTo: states[0].date), "Morgen")
        XCTAssertEqual(H2OWidgetDateLabel.relativeDay(for: start, comparedTo: states[1].date), "Heute")
        XCTAssertNil(states[2].snapshot?.event)
        XCTAssertEqual(states[3].snapshot?.stale, true)
        XCTAssertNil(states[4].snapshot)
    }

    func testConflictNoticeKeepsCalendarAgeAndClearsWhenAdvancing() throws {
        let reference = date("2026-11-02T12:00:00Z")
        let event = H2OWidgetEvent(title: "Probe", start: reference.addingTimeInterval(60), end: reference.addingTimeInterval(120), location: "Test", clothing: "Test", status: "excused", allDay: false, id: String(repeating: "a", count: 43), version: 4)
        let next = H2OWidgetEvent(title: "Nächster Termin", start: reference.addingTimeInterval(180), end: reference.addingTimeInterval(240), location: "Test", clothing: "Test", status: "open", allDay: false, id: String(repeating: "b", count: 43))
        var value = H2OWidgetSnapshot(updatedAt: reference, event: event, stale: false, following: [next])
        value.notice = "Stand aktualisiert – erneut wählen"
        let decoded = try JSONDecoder().decode(H2OWidgetSnapshot.self, from: JSONEncoder().encode(value))
        XCTAssertEqual(decoded.notice, value.notice)
        XCTAssertEqual(decoded.updatedAt, reference)
        XCTAssertEqual(decoded.event?.status, "excused")
        XCTAssertEqual(decoded.event?.version, 4)
        XCTAssertNil(decoded.job)
        XCTAssertNil(decoded.at(event.end).notice)
        XCTAssertEqual(decoded.at(event.end).updatedAt, reference)
    }

    let now = Date(timeIntervalSince1970: 1_800_000_000)
    func snapshot(end: TimeInterval? = nil) -> H2OWidgetSnapshot {
        H2OWidgetSnapshot(updatedAt: now, event: end.map {
            H2OWidgetEvent(title: "Synthetic exercise", start: now, end: now.addingTimeInterval($0), location: "Test", clothing: "Test", status: "yes", allDay: false)
        }, stale: false)
    }
    func testEmptyCalendarBecomesStaleBeforeDisplayRetentionEnds() {
        let states = H2OWidgetStorage.timeline(snapshot: snapshot(), now: now)
        XCTAssertEqual(states.count, 3)
        XCTAssertNotNil(states[0].snapshot)
        XCTAssertEqual(states[1].date, now.addingTimeInterval(43200))
        XCTAssertEqual(states[1].snapshot?.stale, true)
        XCTAssertNil(states.last?.snapshot)
    }
    func testEventDisappearsAtEndAndCacheExpiresLater() {
        let states = H2OWidgetStorage.timeline(snapshot: snapshot(end: 3600), now: now)
        XCTAssertEqual(states.count, 4)
        XCTAssertNotNil(states[0].snapshot?.event)
        XCTAssertEqual(states[1].date, now.addingTimeInterval(3600))
        XCTAssertNil(states[1].snapshot?.event)
        XCTAssertEqual(states[2].snapshot?.stale, true)
        XCTAssertNil(states.last?.snapshot)
    }
    func testLongEventRemainsVisibleButCannotRenewFreshness() {
        let states = H2OWidgetStorage.timeline(snapshot: snapshot(end: 86400), now: now)
        let stale = states.first(where: { $0.date == now.addingTimeInterval(43200) })?.snapshot
        XCTAssertNotNil(stale?.event)
        XCTAssertEqual(stale?.stale, true)
        XCTAssertFalse(H2OWidgetStorage.fresh(stale!, now: now.addingTimeInterval(43200)))
        XCTAssertNil(states.last?.snapshot)
    }
    func testExpiredAndFutureDatedSnapshotsAreRejected() {
        for date in [now.addingTimeInterval(-H2OWidgetStorage.displayAge), now.addingTimeInterval(61)] {
            let old = H2OWidgetSnapshot(updatedAt: date, event: nil, stale: false)
            let states = H2OWidgetStorage.timeline(snapshot: old, now: now)
            XCTAssertEqual(states.count, 1)
            XCTAssertNil(states[0].snapshot)
        }
    }
    func testAlreadyEndedEventIsNotShown() {
        let states = H2OWidgetStorage.timeline(snapshot: snapshot(end: -1), now: now)
        XCTAssertNil(states[0].snapshot?.event)
        XCTAssertNotNil(states[0].snapshot)
    }
    func testAutomaticAdvanceKeepsOriginalExpiryAndIgnoresUnansweredPastEvent() {
        let first = H2OWidgetEvent(title: "First", start: now, end: now.addingTimeInterval(60), location: "Test", clothing: "Test", status: "open", allDay: false)
        let second = H2OWidgetEvent(title: "Second", start: now.addingTimeInterval(600), end: now.addingTimeInterval(900), location: "Test", clothing: "Test", status: "maybe", allDay: false)
        let snapshot = H2OWidgetSnapshot(updatedAt: now, event: first, stale: false, following: [second])
        let states = H2OWidgetStorage.timeline(snapshot: snapshot, now: now)
        XCTAssertEqual(states.first(where: { $0.date == first.end })?.snapshot?.event?.title, "Second")
        XCTAssertNil(states.first(where: { $0.date == second.end })?.snapshot?.event)
        XCTAssertEqual(states.last?.date, now.addingTimeInterval(H2OWidgetStorage.displayAge))
    }
    func testUnconfirmedWriteNeverChangesStatusAndBecomesExplicitRetry() {
        let job = H2OWidgetReplyJob(eventID: "test", status: "yes", requestID: "same-request", version: 0, phase: "saving", startedAt: now)
        var value = snapshot(end: 3600); value.job = job
        let states = H2OWidgetStorage.timeline(snapshot: value, now: now)
        let retry = states.first(where: { $0.date == now.addingTimeInterval(20) })?.snapshot
        XCTAssertEqual(retry?.job?.phase, "retry")
        XCTAssertEqual(retry?.job?.requestID, "same-request")
        XCTAssertEqual(retry?.updatedAt, now)
    }

    func testTwelveHourOldSnapshotKeepsNextEventWithoutRenewingAccess() {
        let start = now.addingTimeInterval(86400)
        let event = H2OWidgetEvent(title: "Probe", start: start, end: start.addingTimeInterval(3600), location: "Test", clothing: "Test", status: "excused", allDay: false)
        let old = H2OWidgetSnapshot(updatedAt: now.addingTimeInterval(-43200), event: event, stale: false)
        let states = H2OWidgetStorage.timeline(snapshot: old, now: now)
        XCTAssertEqual(states.first?.snapshot?.event, event)
        XCTAssertEqual(states.first?.snapshot?.stale, true)
        XCTAssertEqual(states.first?.snapshot?.updatedAt, old.updatedAt)
        XCTAssertFalse(H2OWidgetStorage.fresh(old, now: now))
        XCTAssertTrue(H2OWidgetStorage.displayable(old, now: now))
    }

}
