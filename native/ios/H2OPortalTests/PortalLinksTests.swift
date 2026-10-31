import XCTest
#if canImport(PortalLinkPolicy)
@testable import PortalLinkPolicy
#else
@testable import H2OPortal
#endif
final class PortalLinksTests: XCTestCase {
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
        for value in ["h2oportal://termine?token=x", "h2oportal://anders", "https://termine", "h2oportal://termine/#setup=x"] {
            XCTAssertFalse(PortalLinks.isWidgetTermine(URL(string: value)!))
        }
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
