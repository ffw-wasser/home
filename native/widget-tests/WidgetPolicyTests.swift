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
        XCTAssertEqual(states.map(\.date), [now, date("2026-11-01T23:00:00Z"), event.end, now.addingTimeInterval(43200)])
        XCTAssertEqual(H2OWidgetDateLabel.relativeDay(for: start, comparedTo: states[0].date), "Morgen")
        XCTAssertEqual(H2OWidgetDateLabel.relativeDay(for: start, comparedTo: states[1].date), "Heute")
        XCTAssertNil(states[2].snapshot?.event)
        XCTAssertNil(states[3].snapshot)
    }

    let now = Date(timeIntervalSince1970: 1_800_000_000)
    func snapshot(end: TimeInterval? = nil) -> H2OWidgetSnapshot {
        H2OWidgetSnapshot(updatedAt: now, event: end.map {
            H2OWidgetEvent(title: "Synthetic exercise", start: now, end: now.addingTimeInterval($0), location: "Test", clothing: "Test", status: "yes", allDay: false)
        }, stale: false)
    }
    func testEmptyCalendarExpiresWithoutReload() {
        let states = H2OWidgetStorage.timeline(snapshot: snapshot(), now: now)
        XCTAssertEqual(states.count, 2)
        XCTAssertNotNil(states[0].snapshot)
        XCTAssertEqual(states[1].date, now.addingTimeInterval(43200))
        XCTAssertNil(states[1].snapshot)
    }
    func testEventDisappearsAtEndAndCacheExpiresLater() {
        let states = H2OWidgetStorage.timeline(snapshot: snapshot(end: 3600), now: now)
        XCTAssertEqual(states.count, 3)
        XCTAssertNotNil(states[0].snapshot?.event)
        XCTAssertEqual(states[1].date, now.addingTimeInterval(3600))
        XCTAssertNil(states[1].snapshot?.event)
        XCTAssertNil(states[2].snapshot)
    }
    func testLongEventDoesNotOutliveTwelveHourCache() {
        let states = H2OWidgetStorage.timeline(snapshot: snapshot(end: 86400), now: now)
        XCTAssertEqual(states.count, 2)
        XCTAssertEqual(states[1].date, now.addingTimeInterval(43200))
        XCTAssertNil(states[1].snapshot)
    }
    func testExpiredAndFutureDatedSnapshotsAreRejected() {
        for date in [now.addingTimeInterval(-43200), now.addingTimeInterval(61)] {
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
}
