import SwiftUI
import WidgetKit

private struct NextEventEntry: TimelineEntry {
    let date: Date
    let snapshot: H2OWidgetSnapshot?
}

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
        let snapshot = H2OWidgetStorage.read(now: now)
        let expiration = snapshot?.updatedAt.addingTimeInterval(H2OWidgetStorage.maxAge)
        let eventEnd = snapshot?.event?.end
        let next = [now.addingTimeInterval(60 * 60), expiration, eventEnd]
            .compactMap { $0 }.filter { $0 > now.addingTimeInterval(60) }.min()
            ?? now.addingTimeInterval(15 * 60)
        completion(Timeline(entries: [NextEventEntry(date: now, snapshot: snapshot)],
                            policy: .after(next)))
    }
}

private struct NextEventView: View {
    let entry: NextEventEntry
    @Environment(\.widgetFamily) private var family

    private var event: H2OWidgetEvent? {
        guard let event = entry.snapshot?.event, event.end > entry.date else { return nil }
        return event
    }

    private var statusTitle: String {
        switch event?.status {
        case "yes": return "Dabei"
        case "excused": return "Entschuldigt"
        case "maybe": return "Unsicher"
        default: return "Offen"
        }
    }

    private var statusColor: Color {
        switch event?.status {
        case "yes": return Color(red: 0.12, green: 0.47, blue: 0.28)
        case "excused": return Color(red: 0.70, green: 0.19, blue: 0.23)
        case "maybe": return Color(red: 0.56, green: 0.38, blue: 0.10)
        default: return Color(red: 0.36, green: 0.41, blue: 0.48)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 6) {
                Image(systemName: "flame.fill").foregroundStyle(.white)
                    .frame(width: 26, height: 26)
                    .background(Color(red: 0.49, green: 0.15, blue: 0.24), in: RoundedRectangle(cornerRadius: 7))
                Text("Feuerwehr Wasser").font(.system(size: family == .systemSmall ? 12 : 14, weight: .bold))
                    .foregroundStyle(Color(red: 0.10, green: 0.17, blue: 0.25)).lineLimit(1)
                Spacer(minLength: 0)
            }
            if let event {
                HStack {
                    Text("NÄCHSTER TERMIN")
                        .font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                    Text(statusTitle).font(.system(size: 10, weight: .bold))
                        .foregroundStyle(statusColor).lineLimit(1)
                }
                Text(event.title).font(.system(size: 16, weight: .bold))
                    .lineLimit(family == .systemSmall ? 1 : 2)
                    .foregroundStyle(Color(red: 0.10, green: 0.17, blue: 0.25))
                Text(event.start, format: .dateTime.weekday(.abbreviated).day().month(.twoDigits))
                    .font(.system(size: 13, weight: .semibold))
                Text(event.allDay ? "Ganztägig" : event.start.formatted(date: .omitted, time: .shortened) + " Uhr")
                    .font(.system(size: 12))
                if family != .systemSmall {
                    Label(event.location.isEmpty ? "GH Wasser" : event.location, systemImage: "mappin")
                        .lineLimit(1).font(.system(size: 11))
                    if !event.clothing.isEmpty {
                        Label(event.clothing, systemImage: "tshirt").lineLimit(1).font(.system(size: 11))
                    }
                }
                if entry.snapshot?.stale == true {
                    Text("Kalenderstand prüfen").font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            } else {
                Spacer(minLength: 4)
                Text(entry.snapshot == nil ? "H₂O öffnen, um Termine zu laden." : "Keine kommenden Termine")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color(red: 0.10, green: 0.17, blue: 0.25))
                Spacer(minLength: 4)
            }
            Spacer(minLength: 0)
            Text("H₂O öffnen").font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(Color(red: 0.94, green: 0.97, blue: 0.95), for: .widget)
        .widgetURL(URL(string: "h2oportal://termine"))
        .environment(\.locale, Locale(identifier: "de_DE"))
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
    }
}

@main
struct H2OWidgetBundle: WidgetBundle {
    var body: some Widget {
        H2ONextEventWidget()
    }
}
