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
    func testWidgetLinkOnlyOpensTheNativePortal() {
        XCTAssertTrue(PortalLinks.isWidgetTermine(URL(string: "h2oportal://termine")!))
        for value in ["h2oportal://termine?token=x", "h2oportal://anders", "https://termine", "h2oportal://termine/#setup=x"] {
            XCTAssertFalse(PortalLinks.isWidgetTermine(URL(string: value)!))
        }
    }
    func testInvitationRejectsQueriesAndExtraKeys() {
        let base = PortalLinks.home.absoluteString
        XCTAssertTrue(PortalLinks.invitation(URL(string: base + "#setup=" + String(repeating: "a", count: 43))!))
        for value in [base, base + "#setup=short", base + "#setup=" + String(repeating: "a", count: 43) + "&k=secret"] { XCTAssertFalse(PortalLinks.invitation(URL(string: value)!)) }
    }
}
