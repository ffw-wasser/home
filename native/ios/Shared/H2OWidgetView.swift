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
        if renderingMode != .fullColor { return .primary }
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

    private let burgundy = Color(red: 0.62, green: 0.04, blue: 0.12)

    private func datePart(_ date: Date, _ format: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = TimeZone(identifier: "Europe/Berlin")
        formatter.dateFormat = format
        return formatter.string(from: date)
    }

    private func header(_ scale: CGFloat) -> some View {
        HStack(spacing: 5 * scale) {
            brandLogo
                .frame(width: (family == .systemSmall ? 16 : 18) * scale, height: (family == .systemSmall ? 16 : 18) * scale)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .accessibilityHidden(true)
            Text("Feuerwehr Wasser")
                .font(.system(size: (family == .systemSmall ? 10 : 11) * scale, weight: .semibold))
                .foregroundStyle(renderingMode == .fullColor ? burgundy : ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 0)

        }
        .frame(height: (family == .systemSmall ? 18 : 20) * scale)
        .accessibilityElement(children: .combine)
    }

    private var statusSymbol: String {
        switch event?.status {
        case "yes": return "checkmark.circle.fill"
        case "excused": return "xmark.circle.fill"
        case "maybe": return "questionmark.circle.fill"
        default: return "circle"
        }
    }

    private func statusBadge(_ scale: CGFloat, small: Bool) -> some View {
        HStack(spacing: 5 * scale) {
            Image(systemName: statusSymbol)
                .font(.system(size: (small ? 12 : 13) * scale, weight: .medium))
            Text(statusTitle)
                .font(.system(size: (small ? 14 : 16) * scale, weight: .semibold))
        }
        .foregroundStyle(statusColor)
        .lineLimit(1)
        .minimumScaleFactor(0.85)
        .frame(height: 21 * scale, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rückmeldung: " + statusTitle)
    }

    private func calendarTile(_ date: Date, small: Bool, scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(datePart(date, "EEEE"))
                .font(.system(size: 11 * scale, weight: .medium))
                .foregroundStyle(ink.opacity(0.65))
                .lineLimit(1)
            if small {
                Text(datePart(date, "d. MMM"))
                    .font(.system(size: 30 * scale, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            } else {
                Text(datePart(date, "d."))
                    .font(.system(size: 42 * scale, weight: .semibold))
                    .monospacedDigit()
                Text(datePart(date, "MMMM"))
                    .font(.system(size: 14 * scale, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
        }
        .frame(maxWidth: small ? .infinity : nil, alignment: .leading)
        .frame(width: small ? nil : 92 * scale, height: (small ? 52 : 82) * scale, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(datePart(date, "EEEE, d. MMMM"))
    }

    private func title(_ event: H2OWidgetEvent, small: Bool) -> String {
        event.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "probe"
            ? "Nächste Probe" : event.title
    }

    private func clock(_ event: H2OWidgetEvent, small: Bool, scale: CGFloat) -> some View {
        Text(event.allDay ? "Ganztägig" : berlinTime(event.start) + (small ? "" : " Uhr"))
            .font(.system(size: (small ? 10 : 12) * scale, weight: .medium))
            .monospacedDigit()
            .lineLimit(1)
            .foregroundStyle(ink.opacity(0.65))
    }

    private var noEvent: some View {
        Text(entry.snapshot == nil ? "H₂O öffnen, um Termine zu laden." : "Keine kommenden Termine")
            .font(.system(size: 12, weight: .medium))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func smallLayout(_ scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 4 * scale) {
            header(scale)
            if let event {
                Spacer(minLength: 4 * scale)
                calendarTile(event.start, small: true, scale: scale)
                statusBadge(scale, small: true)
                Spacer(minLength: 0)
                HStack(spacing: 5 * scale) {
                    Text(title(event, small: true))
                        .font(.system(size: 11 * scale, weight: .medium))
                        .foregroundStyle(ink.opacity(0.65))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .accessibilityLabel(event.title)
                    Spacer(minLength: 0)
                    if entry.snapshot?.stale == true {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 10 * scale))
                            .foregroundStyle(ink.opacity(0.65))
                            .accessibilityLabel("Kalenderstand prüfen")
                    }
                    clock(event, small: true, scale: scale)
                        .fixedSize(horizontal: true, vertical: false)
                }
            } else { noEvent }
        }
    }

    private func mediumLayout(_ scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 4 * scale) {
            header(scale)
            if let event {
                Spacer(minLength: 5 * scale)
                HStack(alignment: .center, spacing: 14 * scale) {
                    calendarTile(event.start, small: false, scale: scale)
                    VStack(alignment: .leading, spacing: 3 * scale) {
                        Text(title(event, small: false))
                            .font(.system(size: 14 * scale, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                            .accessibilityLabel(event.title)
                        statusBadge(scale, small: false)
                        HStack(spacing: 5 * scale) {
                            clock(event, small: false, scale: scale)
                            if entry.snapshot?.stale == true {
                                Image(systemName: "exclamationmark.triangle")
                                    .font(.system(size: 10 * scale))
                                    .foregroundStyle(ink.opacity(0.65))
                                    .accessibilityLabel("Kalenderstand prüfen")
                            }
                        }
                        Text(event.location.isEmpty ? "GH Wasser" : event.location)
                            .font(.system(size: 10 * scale))
                            .foregroundStyle(ink.opacity(0.65))
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                        if !event.clothing.isEmpty {
                            Text(event.clothing)
                                .font(.system(size: 10 * scale))
                                .foregroundStyle(ink.opacity(0.65))
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                Spacer(minLength: 0)
            } else { noEvent }
        }
    }

    var body: some View {
        GeometryReader { geometry in
            let scale = min(geometry.size.height / 155, 1.15)
            Group {
                if family == .systemSmall { smallLayout(scale) }
                else { mediumLayout(scale) }
            }
            .padding(.horizontal, 12 * scale)
            .padding(.top, 12 * scale)
            .padding(.bottom, 10 * scale)
            .frame(maxWidth: .infinity, maxHeight: .infinity)

        }
        .foregroundStyle(ink)
        .containerBackground(Color(red: 0.94, green: 0.97, blue: 0.95), for: .widget)
        .widgetURL(URL(string: "h2oportal://termine"))
        .environment(\.locale, Locale(identifier: "de_DE"))
        .environment(\.timeZone, TimeZone(identifier: "Europe/Berlin")!)
    }
}
#endif
