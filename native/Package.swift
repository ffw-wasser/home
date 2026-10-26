// swift-tools-version: 5.9
import PackageDescription

// Run the same URL-security implementation/tests without launching a networked app.
let package = Package(
    name: "H2ONativePolicy",
    platforms: [.macOS(.v13), .iOS(.v17)],
    products: [.library(name: "PortalLinkPolicy", targets: ["PortalLinkPolicy"])],
    targets: [
        .target(name: "PortalLinkPolicy", path: "ios/H2OPortal", exclude: ["H2OPortalApp.swift", "NativePdfPresenter.swift", "PortalWebView.swift", "ScannerView.swift", "Assets.xcassets", "Info.plist", "H2OPortal.entitlements"], sources: ["PortalLinks.swift", "PortalPdfPolicy.swift"]),
        .testTarget(name: "PortalLinkPolicyTests", dependencies: ["PortalLinkPolicy"], path: "ios/H2OPortalTests")
    ]
)
