#if canImport(UIKit)
import XCTest
import SwiftUI
import WidgetKit
import UIKit
@testable import H2OPortal

final class WidgetLayoutTests: XCTestCase {
    @MainActor func testRenderSmallAndMediumEventLayouts() throws {
        let now = ISO8601DateFormatter().date(from: "2026-10-31T12:00:00Z")!
        let start = ISO8601DateFormatter().date(from: "2026-11-02T18:30:00Z")!
        var cases: [(String, H2OWidgetEvent?, Bool)] = [
            ("today-excused", H2OWidgetEvent(title: "Probe", start: now.addingTimeInterval(3600), end: now.addingTimeInterval(10800), location: "GH Wasser", clothing: "Einsatzkleidung", status: "excused", allDay: false), false),
            ("today", H2OWidgetEvent(title: "Löschangriff", start: now.addingTimeInterval(3600), end: now.addingTimeInterval(10800), location: "GH Wasser", clothing: "Einsatzkleidung", status: "yes", allDay: false), false),
            ("tomorrow", H2OWidgetEvent(title: "Löschangriff", start: now.addingTimeInterval(86400), end: now.addingTimeInterval(93600), location: "GH Wasser", clothing: "Einsatzkleidung", status: "open", allDay: false), false),
            ("probe", H2OWidgetEvent(title: "Löschangriff", start: start, end: start.addingTimeInterval(7200), location: "GH Wasser", clothing: "Einsatzkleidung", status: "yes", allDay: false), false),
            ("long-title", H2OWidgetEvent(title: "Technische Hilfeleistung am Gerätehaus", start: start, end: start.addingTimeInterval(7200), location: "Gerätehaus Wasser (Test)", clothing: "Einsatzkleidung", status: "excused", allDay: false), false),
            ("all-day-stale", H2OWidgetEvent(title: "Kameradschaftsabend", start: start, end: start.addingTimeInterval(86400), location: "Drei Könige Emmendingen", clothing: "Tagesdienst", status: "maybe", allDay: true), true),
            ("open-long-month", H2OWidgetEvent(title: "Unterricht", start: ISO8601DateFormatter().date(from: "2027-09-22T17:30:00Z")!, end: ISO8601DateFormatter().date(from: "2027-09-22T19:30:00Z")!, location: "GH Wasser", clothing: "Tagesdienst", status: "open", allDay: false), false),
            ("empty", nil, false)
        ]
        for phase in ["reply-saving", "reply-retry", "reply-edit", "reply-conflict"] {
            cases.append((phase, H2OWidgetEvent(title: "Technische Hilfeleistung", start: start, end: start.addingTimeInterval(7200), location: "Gerätehaus Wasser", clothing: "Einsatzkleidung", status: "yes", allDay: false), false))
        }
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
                current?.id = String(repeating: "a", count: 43); current?.version = 0; current?.canReply = scenario != "today-excused"; current?.reminded = true
                let following = event.map { e in [H2OWidgetEvent(title: "Funkübung", start: e.start.addingTimeInterval(86400), end: e.end.addingTimeInterval(86400), location: "Testort", clothing: "Tagesdienst", status: "open", allDay: false, id: String(repeating: "b", count: 43)), H2OWidgetEvent(title: "Unterricht", start: e.start.addingTimeInterval(172800), end: e.end.addingTimeInterval(172800), location: "Testort", clothing: "Tagesdienst", status: "maybe", allDay: false, id: String(repeating: "c", count: 43))] } ?? []
                var snapshot = H2OWidgetSnapshot(updatedAt: now, event: current, stale: stale, following: following)
                if scenario == "reply-edit" { snapshot.editing = current?.id }
                if scenario == "reply-conflict" { snapshot.message = "In H₂O aktualisieren" }
                if scenario == "reply-saving" || scenario == "reply-retry" {
                    snapshot.job = H2OWidgetReplyJob(eventID: current?.id ?? "", status: "maybe", requestID: "synthetic", version: 0, phase: scenario == "reply-saving" ? "saving" : "retry", startedAt: now)
                }
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
