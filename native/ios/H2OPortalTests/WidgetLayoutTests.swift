#if canImport(UIKit)
import XCTest
import SwiftUI
import WidgetKit
import UIKit
@testable import H2OPortal

final class WidgetLayoutTests: XCTestCase {
    @MainActor func testExistingMediumWidgetExpandsToLargeInSameHost() async throws {
        let now = ISO8601DateFormatter().date(from: "2026-11-02T12:00:00Z")!
        let start = now.addingTimeInterval(3600)
        let event = H2OWidgetEvent(title: "Probe", start: start, end: start.addingTimeInterval(7200), location: "GH Wasser", clothing: "Einsatzkleidung", status: "yes", allDay: false)
        let next = H2OWidgetEvent(title: "Funkübung", start: start.addingTimeInterval(86400), end: start.addingTimeInterval(90000), location: "Test", clothing: "Test", status: "open", allDay: false)
        let state = WidgetResizeState()
        let host = UIHostingController(rootView: WidgetResizeHost(state: state, entry: NextEventEntry(date: now, snapshot: H2OWidgetSnapshot(updatedAt: now, event: event, stale: false, following: [next, next]), family: .systemMedium)))
        host.safeAreaRegions = []
        host.view.backgroundColor = .black
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene)
        window.frame = CGRect(x: 0, y: 0, width: 329, height: 345)
        window.backgroundColor = .black
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { window.isHidden = true }
        for family in [WidgetFamily.systemMedium, .systemLarge, .systemMedium, .systemLarge] {
            state.family = family
            let ready = expectation(description: "Widget layout updated for \(family)")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { ready.fulfill() }
            await fulfillment(of: [ready], timeout: 20)
            host.view.layoutIfNeeded()
            let image = UIGraphicsImageRenderer(size: host.view.bounds.size).image { _ in
                host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
            }
            let attachment = XCTAttachment(image: image)
            attachment.name = "widget-resize-\(family)"
            attachment.lifetime = .keepAlways
            add(attachment)
            if family == .systemLarge {
                let cg = try XCTUnwrap(image.cgImage)
                let colorSpace = CGColorSpaceCreateDeviceRGB()
                let stride = cg.width * 4
                var pixels = [UInt8](repeating: 0, count: stride * cg.height)
                try pixels.withUnsafeMutableBytes { bytes in
                    let context = try XCTUnwrap(CGContext(data: bytes.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: stride, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
                    context.draw(cg, in: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
                }
                var bright = 0
                for y in (cg.height * 3 / 4)..<cg.height {
                    for x in 0..<cg.width {
                        let index = y * stride + x * 4
                        if pixels[index] > 150 && pixels[index + 1] > 150 && pixels[index + 2] > 150 { bright += 1 }
                    }
                }
                XCTAssertGreaterThan(bright, 30, "Large widget must draw following appointments in its lower area after resizing")
                XCTAssertLessThan(bright, cg.width * cg.height / 16, "An empty white host area must not count as widget content")
            }
        }
    }

    @MainActor func testRenderAllSupportedWidgetLayouts() throws {
        let now = ISO8601DateFormatter().date(from: "2026-11-02T12:00:00Z")!
        let start = ISO8601DateFormatter().date(from: "2026-11-02T18:30:00Z")!
        var cases: [(String, H2OWidgetEvent?, Bool)] = [
            ("today-excused", H2OWidgetEvent(title: "Indoor Cycling", start: start, end: start.addingTimeInterval(7200), location: "GH Wasser", clothing: "Einsatzkleidung", status: "excused", allDay: false), false),
            ("today", H2OWidgetEvent(title: "Löschangriff", start: now.addingTimeInterval(3600), end: now.addingTimeInterval(10800), location: "GH Wasser", clothing: "Einsatzkleidung", status: "yes", allDay: false), false),
            ("tomorrow", H2OWidgetEvent(title: "Löschangriff", start: now.addingTimeInterval(86400), end: now.addingTimeInterval(93600), location: "GH Wasser", clothing: "Einsatzkleidung", status: "open", allDay: false), false),
            ("probe", H2OWidgetEvent(title: "Löschangriff", start: start, end: start.addingTimeInterval(7200), location: "GH Wasser", clothing: "Einsatzkleidung", status: "yes", allDay: false), false),
            ("long-title", H2OWidgetEvent(title: "Atemschutz-Übung – Notfall & Mayday", start: start, end: start.addingTimeInterval(7200), location: "Gerätehaus Wasser (Test)", clothing: "Einsatzkleidung", status: "excused", allDay: false), false),
            ("all-day-stale", H2OWidgetEvent(title: "Kameradschaftsabend", start: start, end: start.addingTimeInterval(86400), location: "Drei Könige Emmendingen", clothing: "Tagesdienst", status: "maybe", allDay: true), true),
            ("open-long-month", H2OWidgetEvent(title: "Unterricht", start: ISO8601DateFormatter().date(from: "2027-09-22T17:30:00Z")!, end: ISO8601DateFormatter().date(from: "2027-09-22T19:30:00Z")!, location: "GH Wasser", clothing: "Tagesdienst", status: "open", allDay: false), false),
            ("empty", nil, false)
        ]
        cases.append(("sketch-reference", H2OWidgetEvent(title: "Indoor Cycling", start: ISO8601DateFormatter().date(from: "2026-11-05T19:00:00Z")!, end: ISO8601DateFormatter().date(from: "2026-11-05T20:30:00Z")!, location: "Injoy EM", clothing: "Sportkleidung", status: "excused", allDay: false), false))
        for name in ["very-long-title", "large-font"] {
            cases.append((name, H2OWidgetEvent(title: "Atemschutz-Übung – Notfall & Mayday mit anschließender Nachbesprechung der gesamten Mannschaft", start: start, end: start.addingTimeInterval(7200), location: "Gerätehaus Wasser und Übungsgelände Emmendingen", clothing: "Einsatzkleidung mit persönlicher Schutzausrüstung", status: "maybe", allDay: false), false))
        }
        for phase in ["reply-saving", "reply-saving-yes", "reply-saving-excused", "reply-retry", "reply-edit", "reply-conflict", "reply-refreshed"] {
            cases.append((phase, H2OWidgetEvent(title: "Technische Hilfeleistung", start: start, end: start.addingTimeInterval(7200), location: "Gerätehaus Wasser", clothing: "Einsatzkleidung", status: phase == "reply-saving-yes" ? "maybe" : "yes", allDay: false), false))
        }
        var selectorBrightness: [String: Int] = [:]
        // Include the smallest supported canvas and a larger iPhone canvas.
        for (name, family, width, height) in [
            ("small", WidgetFamily.systemSmall, 155.0, 155.0),
            ("medium", WidgetFamily.systemMedium, 329.0, 155.0),
            ("small-large", WidgetFamily.systemSmall, 170.0, 170.0),
            ("medium-large", WidgetFamily.systemMedium, 364.0, 170.0),
            ("large", WidgetFamily.systemLarge, 329.0, 345.0),
            ("large-wide", WidgetFamily.systemLarge, 364.0, 382.0)
        ] {
            for (scenario, event, stale) in cases {
                var current = event
                current?.id = String(repeating: "a", count: 43); current?.version = 0; current?.canReply = scenario != "today-excused"; current?.reminded = scenario != "tomorrow"
                let following = event.map { e in [H2OWidgetEvent(title: "Funkübung", start: e.start.addingTimeInterval(86400), end: e.end.addingTimeInterval(86400), location: "Testort", clothing: "Tagesdienst", status: "open", allDay: false, id: String(repeating: "b", count: 43)), H2OWidgetEvent(title: "Unterricht", start: e.start.addingTimeInterval(172800), end: e.end.addingTimeInterval(172800), location: "Testort", clothing: "Tagesdienst", status: "maybe", allDay: false, id: String(repeating: "c", count: 43))] } ?? []
                var snapshot = H2OWidgetSnapshot(updatedAt: now, event: current, stale: stale, following: following)
                if scenario == "reply-refreshed" { snapshot.notice = "Stand aktualisiert – erneut wählen" }
                if scenario == "reply-edit" { snapshot.editing = current?.id }
                if scenario == "reply-conflict" { snapshot.message = "In H₂O aktualisieren" }
                if scenario.hasPrefix("reply-saving") || scenario == "reply-retry" {
                    snapshot.job = H2OWidgetReplyJob(eventID: current?.id ?? "", status: scenario == "reply-saving-yes" ? "yes" : scenario == "reply-saving-excused" ? "excused" : "maybe", requestID: "synthetic", version: 0, phase: scenario.hasPrefix("reply-saving") ? "saving" : "retry", startedAt: now)
                }
                let view = NextEventView(entry: NextEventEntry(date: now, snapshot: snapshot, family: family))
                    .environment(\.dynamicTypeSize, scenario == "large-font" ? .accessibility1 : .large)
                    .frame(width: width, height: height)
                    .background(Color(red: 0.94, green: 0.97, blue: 0.95))
                let renderer = ImageRenderer(content: view)
                renderer.scale = 3
                let image: UIImage = try XCTUnwrap(renderer.uiImage)
                XCTAssertEqual(image.size.width, width)
                XCTAssertEqual(image.size.height, height)
                if event != nil {
                    let cg = try XCTUnwrap(image.cgImage)
                    let stride = cg.width * 4
                    var pixels = [UInt8](repeating: 0, count: stride * cg.height)
                    try pixels.withUnsafeMutableBytes { bytes in
                        let context = try XCTUnwrap(CGContext(data: bytes.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: stride, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
                        context.draw(cg, in: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
                    }
                    var paper = 0
                    for y in 0..<cg.height {
                        for x in 0..<(cg.width / 4) {
                            let i = y * stride + x * 4
                            let r = Int(pixels[i]), g = Int(pixels[i + 1]), b = Int(pixels[i + 2])
                            if r >= 235 && g >= 230 && b >= 220 && r - g >= 2 && g - b >= 4 { paper += 1 }
                        }
                    }
                    XCTAssertGreaterThan(paper, 500, "Calendar paper must remain visible on the left in \(name)/\(scenario); long text must not push it out of bounds")
                    if family != .systemSmall && ["reply-edit", "reply-saving", "reply-saving-excused"].contains(scenario) {
                        // Compare the broad green selected surface, excluding the thin moving light.
                        var rows: [Int] = []
                        for y in 0..<cg.height {
                            var count = 0, peak = 0
                            for x in 0..<(cg.width / 3) {
                                let i = y * stride + x * 4
                                let r = Int(pixels[i]), g = Int(pixels[i + 1]), b = Int(pixels[i + 2])
                                if g * 10 > r * 14 && g * 10 > b * 12 { count += 1; peak = max(peak, g) }
                            }
                            if count > cg.width / 8 { rows.append(peak) }
                        }
                        XCTAssertGreaterThan(rows.count, 10, "The confirmed green selection must remain visible")
                        selectorBrightness["\(name)-\(scenario)"] = rows.sorted().dropFirst(rows.count / 2).first ?? 0
                    }

                }
                let attachment = XCTAttachment(image: image)
                attachment.name = "widget-\(name)-\(scenario)"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
            if family != .systemSmall {
                let confirmed = try XCTUnwrap(selectorBrightness["\(name)-reply-edit"])
                for saving in ["reply-saving", "reply-saving-excused"] {
                    let pending = try XCTUnwrap(selectorBrightness["\(name)-\(saving)"])
                    XCTAssertGreaterThanOrEqual(pending, confirmed - 3, "Saving must not dim/flicker the confirmed selector in \(name)")
                }
            }
        }
    }
}
private final class WidgetResizeState: ObservableObject {
    @Published var family: WidgetFamily = .systemMedium
}
private struct WidgetResizeHost: View {
    @ObservedObject var state: WidgetResizeState
    let entry: NextEventEntry
    var body: some View {
        NextEventView(entry: entry, familyOverride: state.family)
            .frame(width: 329, height: state.family == .systemLarge ? 345 : 155)
    }
}
#endif
