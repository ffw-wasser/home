import XCTest
@testable import WidgetPolicy

final class WidgetPolicyTests: XCTestCase {
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
