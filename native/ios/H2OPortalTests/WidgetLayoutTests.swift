#if canImport(UIKit)
import XCTest
import SwiftUI
import WidgetKit
import UIKit
@testable import H2OPortal

final class WidgetLayoutTests: XCTestCase {
    @MainActor func testRenderSmallAndMediumWithLongTitlesAndEmptyState() throws {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let event = H2OWidgetEvent(title: "Sonderprobe · Technische Hilfeleistung am Gerätehaus", start: now, end: now.addingTimeInterval(7200), location: "Gerätehaus Wasser (Test)", clothing: "Einsatzkleidung", status: "yes", allDay: false)
        for (name, family, width) in [("small", WidgetFamily.systemSmall, 155.0), ("medium", WidgetFamily.systemMedium, 329.0)] {
            for empty in [false, true] {
                let snapshot = H2OWidgetSnapshot(updatedAt: now, event: empty ? nil : event, stale: false)
                let view = NextEventView(entry: NextEventEntry(date: now, snapshot: snapshot), familyOverride: family)
                    .frame(width: width, height: 155)
                let renderer = ImageRenderer(content: view)
                renderer.scale = 3
                let image: UIImage = try XCTUnwrap(renderer.uiImage)
                XCTAssertEqual(image.size.width, width)
                XCTAssertEqual(image.size.height, 155)
                let attachment = XCTAttachment(image: image)
                attachment.name = "widget-\(name)-\(empty ? "empty" : "long-title")"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
        }
    }
}
#endif
