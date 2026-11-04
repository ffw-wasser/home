import XCTest
@testable import WidgetPolicy

final class WidgetPolicyTests: XCTestCase {
    func testPackageUpdateDoesNotHideReplyErrorsOrChangeCalendarAge() throws {
        var value = snapshot(end: 3600)
        XCTAssertEqual(value.feedback(appUpdateAvailable: true), "App-Update verfügbar · TestFlight")
        XCTAssertNil(value.feedback(appUpdateAvailable: false))
        value.event?.status = "open"
        XCTAssertEqual(value.feedback(appUpdateAvailable: true), "Rückmeldung offen")
        value.stale = true
        XCTAssertEqual(value.feedback(appUpdateAvailable: true), "Stand veraltet · H₂O öffnen")
        value.message = "Nicht bestätigt"
        XCTAssertEqual(value.feedback(appUpdateAvailable: true), "Nicht bestätigt")
        XCTAssertEqual(value.updatedAt, now)
        let manifest = Data("{\"schema\":1,\"iosTestFlight\":{\"build\":1041,\"availableUntil\":\"2026-12-01T12:00:00Z\"}}".utf8)
        let release = try XCTUnwrap(H2OWidgetAppReleases.parse(manifest)?.iosTestFlight)
        XCTAssertTrue(release.isNewer(than: 1040, at: date("2026-11-04T12:00:00Z")))
        XCTAssertFalse(release.isNewer(than: 1041, at: now))
        XCTAssertFalse(release.isNewer(than: 0, at: now))
        XCTAssertFalse(release.isNewer(than: 1040, at: date("2026-12-01T12:00:00Z")))
        XCTAssertNil(H2OWidgetAppReleases.parse(Data("{\"schema\":1,\"iosTestFlight\":null}".utf8))?.iosTestFlight)
        XCTAssertNil(H2OWidgetAppReleases.parse(Data("{\"schema\":2}".utf8)))
        XCTAssertNil(H2OWidgetAppReleases.parse(Data(repeating: 32, count: 4097)))
    }
    func date(_ value: String) -> Date { ISO8601DateFormatter().date(from: value)! }

    func testReplyLightMovesWithoutConfirmingAndFeedbackOnlyReportsActionNeeded() throws {
        var value = snapshot(end: 3600)
        value.event?.id = String(repeating: "a", count: 43)
        XCTAssertNil(value.replyFeedback)
        XCTAssertEqual(value.replyLightStatus, "yes")
        value.job = H2OWidgetReplyJob(eventID: value.event!.id!, status: "maybe", requestID: "synthetic", version: 0, phase: "saving", startedAt: now)
        XCTAssertNil(value.replyFeedback, "Saving uses the light, not a footer label")
        XCTAssertEqual(value.replyLightStatus, "maybe")
        XCTAssertEqual(value.event?.status, "yes", "Moving the light must not claim a saved answer")
        XCTAssertEqual(value.updatedAt, now)
        value.job?.phase = "retry"
        XCTAssertEqual(value.replyFeedback, "Nicht bestätigt")
        XCTAssertEqual(value.replyLightStatus, "yes")
        value.job = nil
        value.message = "In H₂O aktualisieren"
        XCTAssertEqual(value.replyFeedback, value.message)
        value.message = nil
        value.notice = "Stand aktualisiert – erneut wählen"
        XCTAssertEqual(value.replyFeedback, value.notice)
        value.notice = nil; value.stale = true
        XCTAssertEqual(value.replyFeedback, "Stand veraltet · H₂O öffnen")
        value.stale = false; value.event?.status = "open"
        XCTAssertEqual(value.replyFeedback, "Rückmeldung offen")
        value.event?.reminded = true
        XCTAssertEqual(value.replyFeedback, "Erinnerung: Bitte antworten")
        for status in ["yes", "excused", "maybe"] {
            value.event?.status = status
            if status == "maybe" { XCTAssertEqual(value.replyFeedback, "Erinnerung: Bitte festlegen") } else { XCTAssertNil(value.replyFeedback) }
            XCTAssertEqual(value.replyLightStatus, status)
        }
        value.job = H2OWidgetReplyJob(eventID: String(repeating: "b", count: 43), status: "excused", requestID: "other-event", version: 0, phase: "saving", startedAt: now)
        XCTAssertEqual(value.replyLightStatus, "maybe", "Other appointments never move this light")
        value.event?.canReply = false
        XCTAssertEqual(value.replyFeedback, "Nur zur Information")
        let decoded = try JSONDecoder().decode(H2OWidgetSnapshot.self, from: JSONEncoder().encode(value))
        XCTAssertEqual(decoded, value)
    }

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
