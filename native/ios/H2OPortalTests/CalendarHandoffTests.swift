import XCTest
#if canImport(H2OPortal)
@testable import H2OPortal

final class CalendarHandoffTests: XCTestCase {
    @MainActor func testCalendarSuccessNeedsNoBrowserFallback() async {
        let model = PortalModel()
        var opened: [URL] = []
        let coordinator = PortalWebView.Coordinator(model, openURL: { opened.append($0); return true })
        await coordinator.openCalendarDay(Date(timeIntervalSinceReferenceDate: 814608000))
        XCTAssertEqual(opened.map(\.absoluteString), ["calshow:814608000"])
        XCTAssertTrue(model.message.isEmpty)
        XCTAssertFalse(model.hasOpened, "No production page is loaded by this test")
    }
    @MainActor func testMissingCalendarFallsBackToTheSameBerlinDay() async {
        let model = PortalModel()
        var opened: [URL] = []
        let coordinator = PortalWebView.Coordinator(model, openURL: { url in opened.append(url); return url.scheme == "https" })
        await coordinator.openCalendarDay(Date(timeIntervalSinceReferenceDate: 814608000))
        XCTAssertEqual(opened.map(\.absoluteString), ["calshow:814608000", "https://calendar.google.com/calendar/u/0/r/day/2026/10/25"])
        XCTAssertTrue(model.message.isEmpty)
    }
    @MainActor func testFailedHandoffIsVisibleAndDemoNeverOpensExternalCalendar() async {
        let model = PortalModel()
        let coordinator = PortalWebView.Coordinator(model, openURL: { _ in false })
        await coordinator.openCalendarDay(Date(timeIntervalSinceReferenceDate: 814608000))
        XCTAssertFalse(model.message.isEmpty)
        let demo = PortalModel(review: true)
        var calls = 0
        let demoCoordinator = PortalWebView.Coordinator(demo, openURL: { _ in calls += 1; return true })
        await demoCoordinator.openCalendarDay(Date(timeIntervalSinceReferenceDate: 814608000))
        XCTAssertEqual(calls, 0)
    }
}
#endif
