import XCTest
#if canImport(PortalLinkPolicy)
@testable import PortalLinkPolicy
#else
@testable import H2OPortal
#endif
final class PortalPdfTests: XCTestCase {
    private let encoded = Data("%PDF-1.7\nsynthetic".utf8).base64EncodedString()
    func testAcceptsOnlyNamedPdfs() { XCTAssertNotNil(PortalPdfPolicy.decode(name: "Jahresplan-2026.pdf", mime: "application/pdf", encoded: encoded)) }
    func testRejectsUnsafeNamesTypesAndPayloads() {
        for name in ["../secret.pdf", ".pdf", "file.html", "x/y.pdf"] { XCTAssertNil(PortalPdfPolicy.decode(name: name, mime: "application/pdf", encoded: encoded)) }
        XCTAssertNil(PortalPdfPolicy.decode(name: "file.pdf", mime: "text/html", encoded: encoded))
        XCTAssertNil(PortalPdfPolicy.decode(name: "file.pdf", mime: "application/pdf", encoded: "invalid!"))
        XCTAssertNil(PortalPdfPolicy.decode(name: "file.pdf", mime: "application/pdf", encoded: Data("<html>".utf8).base64EncodedString()))
        XCTAssertNil(PortalPdfPolicy.decode(name: "file.pdf", mime: "application/pdf", encoded: String(repeating: "A", count: PortalPdfPolicy.maximumEncoded+1)))
    }
}
