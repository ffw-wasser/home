#if canImport(UIKit)
import SwiftUI
import WidgetKit
import UIKit
import ImageIO

struct NextEventEntry: TimelineEntry {
    let date: Date
    let snapshot: H2OWidgetSnapshot?
}

struct NextEventView: View {
    let entry: NextEventEntry
    @Environment(\.widgetFamily) private var widgetFamily
    @Environment(\.widgetRenderingMode) private var renderingMode
    var familyOverride: WidgetFamily? = nil
    private var family: WidgetFamily { familyOverride ?? widgetFamily }

    private func berlinTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = TimeZone(identifier: "Europe/Berlin")
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

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
        renderingMode == .fullColor ? Color(red: 0.10, green: 0.17, blue: 0.25) : .primary
    }

    // Keep the original logo, but decode only the pixels needed by WidgetKit.
    private static let logo: UIImage? = {
        guard let url = Bundle.main.url(forResource: "AppIcon", withExtension: "png"),
              let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 96
              ] as CFDictionary) else { return nil }
        return UIImage(cgImage: thumbnail)
    }()

    @ViewBuilder private var brandLogo: some View {
        if let image = Self.logo {
            if #available(iOS 18.0, *) {
                Image(uiImage: image)
                    .renderingMode(.original)
                    .resizable()
                    .widgetAccentedRenderingMode(.fullColor)
                    .scaledToFit()
            } else {
                Image(uiImage: image)
                    .renderingMode(.original)
                    .resizable()
                    .scaledToFit()
            }
        } else {
            Text("H₂O")
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(ink)
        }
    }

    private var header: some View {
        HStack(spacing: 6) {
            brandLogo
                .frame(width: 22, height: 22)
                .clipShape(RoundedRectangle(cornerRadius: 5))
                .accessibilityHidden(true)
            Text("Feuerwehr Wasser")
                .font(.system(size: family == .systemSmall ? 10 : 12, weight: .bold))
                .foregroundStyle(ink)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
            Spacer(minLength: 0)
            if family != .systemSmall, event != nil {
                statusBadge
            }
        }
        .frame(height: 22)
        .accessibilityElement(children: .combine)
    }

    private var statusBadge: some View {
        Text(statusTitle)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(statusColor)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(statusColor.opacity(0.12), in: Capsule())
            .accessibilityLabel("Rückmeldung: " + statusTitle)
    }

    private func eventDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = TimeZone(identifier: "Europe/Berlin")
        formatter.dateFormat = "EEE, d. MMM"
        return formatter.string(from: date)
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
        VStack(alignment: .leading, spacing: 6) {
            header
            if let event {
                Text(event.title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(ink)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .layoutPriority(1)
                VStack(alignment: .leading, spacing: 1) {
                    Text(eventDate(event.start))
                        .font(.system(size: 12, weight: .semibold))
                    Text(event.allDay ? "Ganztägig" : berlinTime(event.start) + " Uhr")
                        .font(.system(size: 18, weight: .bold))
                        .monospacedDigit()
                }
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                statusBadge
            } else {
                noEvent
            }
        }
        .frame(maxHeight: .infinity, alignment: .topLeading)
    }

    private var mediumLayout: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            if let event {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(eventDate(event.start))
                            .font(.system(size: 12, weight: .semibold))
                        Text(event.allDay ? "Ganztägig" : berlinTime(event.start))
                            .font(.system(size: event.allDay ? 17 : 25, weight: .bold))
                            .monospacedDigit()
                    }
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .frame(width: 94, alignment: .leading)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 8)
                    .background(statusColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))

                    VStack(alignment: .leading, spacing: 5) {
                        Text(event.title)
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(ink)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                            .layoutPriority(1)
                        Label(event.location.isEmpty ? "GH Wasser" : event.location, systemImage: "mappin.and.ellipse")
                            .font(.system(size: 11))
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                        if !event.clothing.isEmpty {
                            Label(event.clothing, systemImage: "tshirt")
                                .font(.system(size: 11))
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }
                        if entry.snapshot?.stale == true {
                            Text("Kalenderstand prüfen")
                                .font(.system(size: 9))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
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
        .foregroundStyle(ink)
        .containerBackground(Color(red: 0.94, green: 0.97, blue: 0.95), for: .widget)
        .widgetURL(URL(string: "h2oportal://termine"))
        .environment(\.locale, Locale(identifier: "de_DE"))
        .environment(\.timeZone, TimeZone(identifier: "Europe/Berlin")!)
    }
}


#endif
