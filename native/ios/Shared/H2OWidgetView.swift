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
        HStack(spacing: 7 * scale) {
            Image(systemName: statusSymbol)
                .font(.system(size: (small ? 17 : 18) * scale, weight: .medium))
            Text(statusTitle)
                .font(.system(size: (small ? 14 : 16) * scale, weight: .semibold))
        }
        .foregroundStyle(statusColor)
        .lineLimit(1)
        .minimumScaleFactor(0.85)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rückmeldung: " + statusTitle)
    }

    private func calendarTile(_ date: Date, small: Bool, scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(datePart(date, "EEEE"))
                .font(.system(size: 11 * scale, weight: .medium))
                .foregroundStyle(ink.opacity(0.72))
                .lineLimit(1)
            if let relative = H2OWidgetDateLabel.relativeDay(for: date, comparedTo: entry.date) {
                Text(relative)
                    .font(.system(size: (small ? 34 : 25) * scale, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            } else if small {
                HStack(alignment: .firstTextBaseline, spacing: 6 * scale) {
                    Text(datePart(date, "dd"))
                        .font(.system(size: 46 * scale, weight: .bold))
                        .monospacedDigit()
                    Text(datePart(date, "MMM").replacingOccurrences(of: ".", with: "").uppercased())
                        .font(.system(size: 20 * scale, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
            } else {
                Text(datePart(date, "dd"))
                    .font(.system(size: 48 * scale, weight: .bold))
                    .monospacedDigit()
                Text(datePart(date, "MMMM").uppercased())
                    .font(.system(size: 12 * scale, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
        }
        .frame(maxWidth: small ? .infinity : nil, alignment: .leading)
        .frame(width: small ? nil : 92 * scale, height: (small ? 70 : 86) * scale, alignment: .leading)
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
            .foregroundStyle(ink.opacity(0.72))
    }

    private var noEvent: some View {
        Text(entry.snapshot == nil ? "H₂O öffnen, um Termine zu laden." : "Keine kommenden Termine")
            .font(.system(size: 12, weight: .medium))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func smallLayout(_ scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header(scale)
            if let event {
                Spacer(minLength: 2 * scale)
                calendarTile(event.start, small: true, scale: scale)
                Rectangle().fill(ink.opacity(0.16)).frame(height: 0.5 * scale)
                    .padding(.bottom, 3 * scale)
                    .accessibilityHidden(true)
                HStack(spacing: 5 * scale) {
                    Text(title(event, small: true))
                        .font(.system(size: 11 * scale, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .accessibilityLabel(event.title)
                    Spacer(minLength: 0)
                    clock(event, small: true, scale: scale)
                        .fixedSize(horizontal: true, vertical: false)
                }
                .frame(height: 14 * scale)
            } else { noEvent }
        }
    }

    private func mediumLayout(_ scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            header(scale)
            if let event {
                Spacer(minLength: 3 * scale)
                HStack(alignment: .center, spacing: 12 * scale) {
                    calendarTile(event.start, small: false, scale: scale)
                    Rectangle().fill(ink.opacity(0.16))
                        .frame(width: 0.5 * scale, height: 76 * scale)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 5 * scale) {
                        Text(title(event, small: false))
                            .font(.system(size: 18 * scale, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .accessibilityLabel(event.title)
                        Text(event.location.isEmpty ? "GH Wasser" : event.location)
                            .font(.system(size: 12 * scale))
                            .foregroundStyle(ink.opacity(0.85))
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                        if !event.clothing.isEmpty {
                            Text(event.clothing)
                                .font(.system(size: 11 * scale))
                                .foregroundStyle(ink.opacity(0.72))
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else { noEvent }
        }
    }

    private func responseFooter(_ scale: CGFloat) -> some View {
        HStack(spacing: 6 * scale) {
            statusBadge(scale, small: family == .systemSmall)
            Spacer(minLength: 0)
            if entry.snapshot?.stale == true {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 10 * scale))
                    .accessibilityLabel("Kalenderstand prüfen")
            }
            if family != .systemSmall, let event {
                clock(event, small: false, scale: scale)
            }
        }
        .padding(.horizontal, 12 * scale)
        .frame(height: 32 * scale)
        .background(statusColor.opacity(0.1))
    }

    var body: some View {
        GeometryReader { geometry in
            let scale = min(geometry.size.height / 155, 1.15)
            VStack(spacing: 0) {
                Group {
                    if family == .systemSmall { smallLayout(scale) }
                    else { mediumLayout(scale) }
                }
                .padding(.horizontal, 12 * scale)
                .padding(.top, 9 * scale)
                .padding(.bottom, 4 * scale)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                if event != nil { responseFooter(scale) }
            }
            .background(Color(red: 0.975, green: 0.968, blue: 0.94))
            .overlay(alignment: .top) {
                burgundy.frame(height: 4 * scale).accessibilityHidden(true)
            }
        }
        .foregroundStyle(ink)
        .containerBackground(Color(red: 0.975, green: 0.968, blue: 0.94), for: .widget)
        .widgetURL(URL(string: "h2oportal://termine"))
        .environment(\.locale, Locale(identifier: "de_DE"))
        .environment(\.timeZone, TimeZone(identifier: "Europe/Berlin")!)
    }
}
#endif
