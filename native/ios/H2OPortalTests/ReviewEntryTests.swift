import XCTest
@testable import H2OPortal

final class ReviewEntryTests: XCTestCase {
    @MainActor func testUserCanRequestIsolatedDemoFromMemberLogin() {
        let model = PortalModel()
        XCTAssertTrue(model.requestReview(from: PortalLinks.home, to: PortalLinks.review, mainFrame: true, userInitiated: true))
        XCTAssertTrue(model.reviewRequested)
        XCTAssertFalse(model.review)
        XCTAssertFalse(model.hasOpened)
    }

    @MainActor func testUntrustedFramesAndAutomaticNavigationCannotRequestDemo() {
        for (source, target, mainFrame, userInitiated) in [
            (PortalLinks.home, PortalLinks.review, false, true),
            (PortalLinks.home, PortalLinks.review, true, false),
            (URL(string: "https://example.invalid/home/deckel.html")!, PortalLinks.review, true, true),
            (PortalLinks.home, URL(string: PortalLinks.review.absoluteString + "?token=synthetic")!, true, true),
            (PortalLinks.home, PortalLinks.home, true, true)
        ] {
            let model = PortalModel()
            XCTAssertFalse(model.requestReview(from: source, to: target, mainFrame: mainFrame, userInitiated: userInitiated))
            XCTAssertFalse(model.reviewRequested)
        }
        let demo = PortalModel(review: true)
        XCTAssertFalse(demo.requestReview(from: PortalLinks.home, to: PortalLinks.review, mainFrame: true, userInitiated: true))
        XCTAssertFalse(demo.web.configuration.websiteDataStore.isPersistent)
    }
}
