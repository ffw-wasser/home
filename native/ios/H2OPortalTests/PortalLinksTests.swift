import XCTest
#if canImport(PortalLinkPolicy)
@testable import PortalLinkPolicy
#else
@testable import H2OPortal
#endif
final class PortalLinksTests: XCTestCase {
    func testPublicPrivacyCanOpenExternallyWithoutReceivingMemberTokens() {
        XCTAssertTrue(PortalLinks.isPublicPrivacy(PortalLinks.privacy))
        XCTAssertFalse(PortalLinks.trusted(PortalLinks.privacy))
        for suffix in ["?token=secret", "#setup=secret", "/"] {
            XCTAssertFalse(PortalLinks.isPublicPrivacy(URL(string: PortalLinks.privacy.absoluteString + suffix)!))
        }
    }
    func testReviewEntryIsExactAndNeverCarriesMemberTokens() {
        XCTAssertTrue(PortalLinks.isReview(PortalLinks.review))
        XCTAssertTrue(PortalLinks.trusted(PortalLinks.review))
        for suffix in ["?token=member", "#setup=member", "/"] {
            XCTAssertFalse(PortalLinks.trusted(URL(string: PortalLinks.review.absoluteString + suffix)!))
        }
        XCTAssertFalse(PortalLinks.isReview(PortalLinks.home))
    }
    func testOnlyExactPortalEndpointsAreAccepted() {
        XCTAssertTrue(PortalLinks.trusted(PortalLinks.home))
        for value in ["http://ffw-wasser.github.io/home/deckel.html", "https://ffw-wasser.github.io.evil.test/home/deckel.html", "https://user@ffw-wasser.github.io/home/deckel.html", "https://ffw-wasser.github.io:443/home/deckel.html", "https://ffw-wasser.github.io/home/index.html", "https://ffw-wasser.github.io/home/%64eckel.html"] { XCTAssertFalse(PortalLinks.trusted(URL(string: value)!)) }
    }
    func testTrustedHostIsStrictlyBuildBound() {
        XCTAssertTrue(PortalLinks.trusted(PortalLinks.home))
        XCTAssertFalse(PortalLinks.trusted(URL(string: "https://evil.example/home/deckel.html")!))
        XCTAssertFalse(PortalLinks.trusted(URL(string: "http://ffw-wasser.github.io/home/deckel.html")!))
        XCTAssertFalse(PortalLinks.trusted(URL(string: "https://ffw-wasser.github.io.evil.example/home/deckel.html")!))
    }
    func testCalendarResponseOpensFullPortalAndKeepsOnlyValidatedEvent() throws {
        let event = String(repeating: "a", count: 43)
        let response = PortalLinks.home.deletingLastPathComponent().appendingPathComponent("termin.html")
        let destination = try XCTUnwrap(PortalLinks.destination(URL(string: response.absoluteString + "?event=" + event + "&token=discard#pair=discard")!))
        XCTAssertEqual(destination.path, PortalLinks.home.path)
        let parts = try XCTUnwrap(URLComponents(url: destination, resolvingAgainstBaseURL: false))
        XCTAssertEqual(parts.queryItems, [URLQueryItem(name: "nativePage", value: "terms"), URLQueryItem(name: "event", value: event)])
        XCTAssertNil(parts.fragment)
        XCTAssertEqual(PortalLinks.destination(URL(string: response.absoluteString + "?event=invalid")!), PortalLinks.terms)
        XCTAssertEqual(PortalLinks.destination(PortalLinks.home), PortalLinks.home)
        XCTAssertNil(PortalLinks.destination(URL(string: "https://evil.example/home/termin.html?event=" + event)!))
    }

    func testWidgetLinkOnlyOpensTheNativePortal() {
        XCTAssertTrue(PortalLinks.trusted(PortalLinks.terms))
        XCTAssertEqual(URLComponents(url: PortalLinks.terms, resolvingAgainstBaseURL: false)?.queryItems?.first?.value, "terms")
        XCTAssertTrue(PortalLinks.isWidgetTermine(URL(string: "h2oportal://termine")!))
        let event = String(repeating: "a", count: 43)
        XCTAssertTrue(PortalLinks.isWidgetTermine(URL(string: "h2oportal://termine?event=" + event)!))
        XCTAssertEqual(PortalLinks.widgetEvent(URL(string: "h2oportal://termine?event=" + event)!), event)
        XCTAssertFalse(PortalLinks.isWidgetTermine(URL(string: "h2oportal://termine?event=" + event + "&token=x")!))
        for value in ["h2oportal://termine?token=x", "h2oportal://anders", "https://termine", "h2oportal://termine/#setup=x"] {
            XCTAssertFalse(PortalLinks.isWidgetTermine(URL(string: value)!))
        }
    }
    func testCalendarDayAcceptsOnlyExplicitMemberNavigationAndNumericDates() throws {
        let target = URL(string: "calshow:814608000")!
        let date = try XCTUnwrap(PortalLinks.calendarDay(from: PortalLinks.home, to: target, mainFrame: true, userInitiated: true))
        XCTAssertEqual(date.timeIntervalSince1970, 1792915200)
        XCTAssertEqual(PortalLinks.calendarDayFallback(date).absoluteString, "https://calendar.google.com/calendar/u/0/r/day/2026/10/25")
        for value in ["calshow:", "calshow://814608000", "calshow:-1", "calshow:1.5", "calshow:31525372801", "calshow:814608000?token=synthetic", "calshow:814608000#extra", "https://example.invalid/814608000"] {
            XCTAssertNil(PortalLinks.calendarDay(from: PortalLinks.home, to: URL(string: value)!, mainFrame: true, userInitiated: true), value)
        }
        for (source, mainFrame, userInitiated) in [(PortalLinks.home, false, true), (PortalLinks.home, true, false), (PortalLinks.review, true, true), (URL(string: "https://example.invalid/home/deckel.html")!, true, true)] {
            XCTAssertNil(PortalLinks.calendarDay(from: source, to: target, mainFrame: mainFrame, userInitiated: userInitiated))
        }
        let berlinNextDay = Date(timeIntervalSince1970: 1793662200) // 2026-11-02 23:30 UTC
        XCTAssertEqual(PortalLinks.calendarDayFallback(berlinNextDay).absoluteString, "https://calendar.google.com/calendar/u/0/r/day/2026/11/03")
    }
    func testOnlyPersonalCalendarSubscriptionCanLeaveTheWebView() {
        let valid = "webcal://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev/calendar/member/" + String(repeating: "a", count: 43) + ".ics"
        XCTAssertTrue(PortalLinks.calendarSubscription(URL(string: valid)!))
        for value in [valid + "?x=1", valid + "#x", valid.replacingOccurrences(of: "webcal://", with: "https://"), valid.replacingOccurrences(of: ".workers.dev", with: ".workers.dev.evil.test")] {
            XCTAssertFalse(PortalLinks.calendarSubscription(URL(string: value)!))
        }
    }
    func testAccountSetupLinkRejectsQueriesAndExtraKeys() {
        let base = PortalLinks.home.absoluteString
        XCTAssertTrue(PortalLinks.setupLink(URL(string: base + "#setup=" + String(repeating: "a", count: 43))!))
        for value in [base, base + "#setup=short", base + "#setup=" + String(repeating: "a", count: 43) + "&k=secret"] { XCTAssertFalse(PortalLinks.setupLink(URL(string: value)!)) }
    }
}
