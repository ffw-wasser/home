import SwiftUI
import WidgetKit
import UIKit
import ImageIO

struct NextEventProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextEventEntry {
        // Synthetic Xcode preview only; never displayed as real member data.
        NextEventEntry(date: Date(), snapshot: H2OWidgetSnapshot(updatedAt: Date(),
            event: H2OWidgetEvent(title: "Probe", start: Date().addingTimeInterval(3600),
                                  end: Date().addingTimeInterval(7200), location: "GH Wasser",
                                  clothing: "Einsatzkleidung", status: "yes", allDay: false),
            stale: false), family: context.family)
    }

    func getSnapshot(in context: Context, completion: @escaping (NextEventEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) :
                   NextEventEntry(date: Date(), snapshot: H2OWidgetStorage.read(), family: context.family))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextEventEntry>) -> Void) {
        let now = Date()
        let entries = H2OWidgetStorage.timeline(snapshot: H2OWidgetStorage.read(now: now), now: now)
            .map { NextEventEntry(date: $0.date, snapshot: $0.snapshot, family: context.family) }

        // Re-read shared state periodically; no credentials or unscoped network access.
        // Cached appointments survive the reply grant expiry and remain clearly marked.
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(3600))))
    }
}

struct H2ONextEventWidget: Widget {
    let kind = "H2ONextEventWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextEventProvider()) { entry in
            NextEventView(entry: entry)
        }
        .configurationDisplayName("H₂O · Nächster Termin")
        .description("Nächster Termin mit direkter Rückmeldung. Datum oder Thema öffnet H₂O.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        // iOS 17+ otherwise adds its own margins on top of our padding.
        .contentMarginsDisabled()
    }
}

// A dedicated large configuration avoids the medium-widget resize path on iOS.
struct H2OLargeEventWidget: Widget {
    let kind = "H2OLargeEventWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextEventProvider()) { entry in
            NextEventView(entry: entry, familyOverride: .systemLarge)
        }
        .configurationDisplayName("H₂O · Großer Termin")
        .description("Großes Kalenderwidget mit Rückmeldung und weiteren Terminen.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

@main
struct H2OWidgetBundle: WidgetBundle {
    var body: some Widget {
        H2ONextEventWidget()
        H2OLargeEventWidget()
    }
}
