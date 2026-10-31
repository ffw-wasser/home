#if canImport(UIKit)
import XCTest
import SwiftUI
import WidgetKit
import UIKit
@testable import H2OPortal

final class WidgetLayoutTests: XCTestCase {
    @MainActor func testRenderSmallAndMediumEventLayouts() throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let cases: [(String, H2OWidgetEvent?, Bool)] = [
            ("probe", H2OWidgetEvent(title: "Probe", start: now, end: now.addingTimeInterval(7200), location: "GH Wasser", clothing: "Einsatzkleidung", status: "yes", allDay: false), false),
            ("long-title", H2OWidgetEvent(title: "Sonderprobe · Technische Hilfeleistung am Gerätehaus", start: now, end: now.addingTimeInterval(7200), location: "Gerätehaus Wasser (Test)", clothing: "Einsatzkleidung", status: "excused", allDay: false), false),
            ("all-day-stale", H2OWidgetEvent(title: "Kameradschaftsabend", start: now, end: now.addingTimeInterval(86400), location: "Drei Könige Emmendingen", clothing: "Tagesdienst", status: "maybe", allDay: true), true),
            ("empty", nil, false)
        ]
        // Include the smallest supported canvas and a larger iPhone canvas.
        for (name, family, width, height) in [
            ("small", WidgetFamily.systemSmall, 155.0, 155.0),
            ("medium", WidgetFamily.systemMedium, 329.0, 155.0),
            ("small-large", WidgetFamily.systemSmall, 170.0, 170.0),
            ("medium-large", WidgetFamily.systemMedium, 364.0, 170.0)
        ] {
            for (scenario, event, stale) in cases {
                let snapshot = H2OWidgetSnapshot(updatedAt: now, event: event, stale: stale)
                let view = NextEventView(entry: NextEventEntry(date: now, snapshot: snapshot), familyOverride: family)
                    .frame(width: width, height: height)
                    .background(Color(red: 0.94, green: 0.97, blue: 0.95))
                let renderer = ImageRenderer(content: view)
                renderer.scale = 3
                let image: UIImage = try XCTUnwrap(renderer.uiImage)
                XCTAssertEqual(image.size.width, width)
                XCTAssertEqual(image.size.height, height)
                let attachment = XCTAttachment(image: image)
                attachment.name = "widget-\(name)-\(scenario)"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
        }
    }
}
#endif
