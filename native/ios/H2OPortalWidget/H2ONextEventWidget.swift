import SwiftUI
import WidgetKit
import UIKit
import ImageIO

private struct NextEventProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextEventEntry {
        // Synthetic Xcode preview only; never displayed as real member data.
        NextEventEntry(date: Date(), snapshot: H2OWidgetSnapshot(updatedAt: Date(),
            event: H2OWidgetEvent(title: "Probe", start: Date().addingTimeInterval(3600),
                                  end: Date().addingTimeInterval(7200), location: "GH Wasser",
                                  clothing: "Einsatzkleidung", status: "yes", allDay: false),
            stale: false))
    }

    func getSnapshot(in context: Context, completion: @escaping (NextEventEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) :
                   NextEventEntry(date: Date(), snapshot: H2OWidgetStorage.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextEventEntry>) -> Void) {
        let now = Date()
        let entries = H2OWidgetStorage.timeline(snapshot: H2OWidgetStorage.read(now: now), now: now)
            .map { NextEventEntry(date: $0.date, snapshot: $0.snapshot) }

        // A successful app refresh or logout explicitly reloads the widget.
        // No background network access is needed, and no 15-minute polling.
        completion(Timeline(entries: entries, policy: .never))
    }
}

struct H2ONextEventWidget: Widget {
    let kind = "H2ONextEventWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextEventProvider()) { entry in
            NextEventView(entry: entry)
        }
        .configurationDisplayName("H₂O · Nächster Termin")
        .description("Nächster Feuerwehrtermin und deine Rückmeldung. Zum Öffnen antippen.")
        .supportedFamilies([.systemSmall, .systemMedium])
        // iOS 17+ otherwise adds its own margins on top of our padding.
        .contentMarginsDisabled()
    }
}

@main
struct H2OWidgetBundle: WidgetBundle {
    var body: some Widget {
        H2ONextEventWidget()
    }
}
