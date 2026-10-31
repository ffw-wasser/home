import SwiftUI
import WidgetKit
import UIKit

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
        var entries = [NextEventEntry(date: now, snapshot: snapshot)]

        // Schedule actual future view entries, not just a requested reload.
        // iOS may delay timeline reloads; an already rendered event must still
        // disappear when it ends or its 12-hour member-data lifetime expires.
        if let snapshot, let event = snapshot.event, event.end > now {
            let expiry = snapshot.updatedAt.addingTimeInterval(H2OWidgetStorage.maxAge)
            if event.end < expiry {
                let noEvent = H2OWidgetSnapshot(updatedAt: snapshot.updatedAt,
                                                event: nil, stale: snapshot.stale)
                entries.append(NextEventEntry(date: event.end, snapshot: noEvent))
            }
            entries.append(NextEventEntry(date: expiry, snapshot: nil))
        }

        // A successful app refresh or logout explicitly reloads the widget.
        // No background network access is needed, and no 15-minute polling.
        completion(Timeline(entries: entries, policy: .never))
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

    private var ink: Color {
        Color(red: 0.10, green: 0.17, blue: 0.25)
    }

    // The AppIcon.png is copied as a *raw resource* into the widget extension.
    // Asset-catalog app icons are not normal named images. In particular,
    // Image("AppIcon", bundle: .main) can be empty even when the PNG exists.
    @ViewBuilder private var brandLogo: some View {
        if let url = Bundle.main.url(forResource: "AppIcon", withExtension: "png"),
           let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
        } else {
            // An explicit fallback avoids an invisible header on unexpected
            // iOS resource-bundle changes.
            Image(systemName: "flame.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(Color(red: 0.49, green: 0.15, blue: 0.24))
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 7) {
            brandLogo
                .frame(width: family == .systemSmall ? 26 : 28,
                       height: family == .systemSmall ? 26 : 28)
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .accessibilityHidden(true)
            // Small widgets have little horizontal space. A deliberate line
            // break is more reliable than asking SwiftUI to shrink or clip.
            Text(family == .systemSmall ? "Feuerwehr\nWasser" : "Feuerwehr Wasser")
                .font(.system(size: family == .systemSmall ? 11 : 14, weight: .bold))
                .foregroundStyle(ink)
                .lineLimit(family == .systemSmall ? 2 : 1)
                .minimumScaleFactor(0.75)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var noEvent: some View {
        VStack(alignment: .leading, spacing: 6) {
            Spacer(minLength: 2)
            Text(entry.snapshot == nil ? "H₂O öffnen, um Termine zu laden." : "Keine kommenden Termine")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 2)
        }
    }

    private var smallLayout: some View {
        VStack(alignment: .leading, spacing: 4) {
            header
            if let event {
                HStack(spacing: 3) {
                    Text("TERMIN").font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                    Text(statusTitle).font(.system(size: 10, weight: .bold))
                        .foregroundStyle(statusColor)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                Text(event.title)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(ink)
                    .lineLimit(3)
                    .minimumScaleFactor(0.75)
                    .fixedSize(horizontal: false, vertical: true)
                    .layoutPriority(1)
                Spacer(minLength: 0)
                Text(event.start, format: .dateTime.weekday(.abbreviated).day().month(.twoDigits))
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                Text(event.allDay ? "Ganztägig" : event.start.formatted(date: .omitted, time: .shortened) + " Uhr")
                    .font(.system(size: 11))
                    .lineLimit(1)
            } else {
                noEvent
            }
        }
    }

    private var mediumLayout: some View {
        VStack(alignment: .leading, spacing: 6) {
            header
            if let event {
                // Two columns avoid squeezing six or more full-width rows
                // into the fixed height of an iPhone medium widget.
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("NÄCHSTER TERMIN")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(.secondary)
                        Text(event.title)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(ink)
                            .lineLimit(3)
                            .minimumScaleFactor(0.75)
                            .fixedSize(horizontal: false, vertical: true)
                            .layoutPriority(1)
                        Spacer(minLength: 0)
                        Text(event.start, format: .dateTime.weekday(.abbreviated).day().month(.twoDigits))
                            .font(.system(size: 11, weight: .semibold))
                        Text(event.allDay ? "Ganztägig" : event.start.formatted(date: .omitted, time: .shortened) + " Uhr")
                            .font(.system(size: 11))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                    VStack(alignment: .leading, spacing: 6) {
                        Text(statusTitle)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(statusColor)
                            .lineLimit(1)
                        Label(event.location.isEmpty ? "GH Wasser" : event.location, systemImage: "mappin")
                            .font(.system(size: 11))
                            .lineLimit(2)
                        if !event.clothing.isEmpty {
                            Label(event.clothing, systemImage: "tshirt")
                                .font(.system(size: 11))
                                .lineLimit(2)
                        }
                        if entry.snapshot?.stale == true {
                            Text("Kalenderstand prüfen")
                                .font(.system(size: 9))
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                }
            } else {
                noEvent
            }
        }
    }

    var body: some View {
        Group {
            if family == .systemSmall {
                smallLayout
            } else {
                mediumLayout
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
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
