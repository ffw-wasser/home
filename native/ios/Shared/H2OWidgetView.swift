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
                .frame(width: 19 * scale, height: 19 * scale)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .accessibilityHidden(true)
            Text("Feuerwehr Wasser")
                .font(.system(size: (family == .systemSmall ? 10 : 12) * scale, weight: .bold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 0)

        }
        .frame(height: (family == .systemSmall ? 18 : 20) * scale)
        .accessibilityElement(children: .combine)
    }

    private var statusSymbol: String {
        switch event?.status {
        case "yes": return "checkmark"
        case "excused": return "xmark"
        case "maybe": return "questionmark"
        default: return "minus"
        }
    }

    private func statusBadge(_ scale: CGFloat, small: Bool) -> some View {
        HStack(spacing: 6 * scale) {
            Image(systemName: statusSymbol).font(.system(size: (small ? 14 : 20) * scale, weight: .heavy))
            Text(statusTitle).font(.system(size: (small ? 14 : 20) * scale, weight: .bold))
        }
        .foregroundStyle(.white)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .frame(maxWidth: .infinity)
        .frame(height: (small ? 23 : 30) * scale)
        .background(statusColor, in: RoundedRectangle(cornerRadius: 7 * scale))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Rückmeldung: " + statusTitle)
    }

    private func calendarTile(_ date: Date, small: Bool, scale: CGFloat) -> some View {
        VStack(spacing: 0) {
            Text(datePart(date, "EEEE").uppercased())
                .font(.system(size: (small ? 10 : 11) * scale, weight: .bold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            if small {
                HStack(alignment: .center, spacing: 5 * scale) {
                    Text(datePart(date, "dd") + ".")
                        .font(.system(size: 28 * scale, weight: .heavy))
                        .monospacedDigit()
                    Text(datePart(date, "MMMM").uppercased())
                        .font(.system(size: 12 * scale, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            } else {
                Text(datePart(date, "dd"))
                    .font(.system(size: 36 * scale, weight: .heavy))
                    .monospacedDigit()
                Text(datePart(date, "MMMM").uppercased())
                    .font(.system(size: 12 * scale, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 6 * scale)
        .frame(maxWidth: small ? .infinity : nil)
        .frame(width: small ? nil : 94 * scale, height: (small ? 50 : 80) * scale)
        .background(burgundy, in: RoundedRectangle(cornerRadius: 7 * scale))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(datePart(date, "EEEE, d. MMMM"))
    }

    private func title(_ event: H2OWidgetEvent, small: Bool) -> String {
        event.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "probe"
            ? "Nächste Probe" : event.title
    }

    private func clock(_ event: H2OWidgetEvent, small: Bool, scale: CGFloat) -> some View {
        Label(event.allDay ? "Ganztägig" : berlinTime(event.start) + " Uhr", systemImage: "clock")
            .font(.system(size: (small ? 11 : 14) * scale, weight: .semibold))
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }

    private var noEvent: some View {
        Text(entry.snapshot == nil ? "H₂O öffnen, um Termine zu laden." : "Keine kommenden Termine")
            .font(.system(size: 12, weight: .medium))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func smallLayout(_ scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 1 * scale) {
            header(scale)
            if let event {
                Text(title(event, small: true))
                    .font(.system(size: 14 * scale, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .accessibilityLabel(event.title)
                Spacer(minLength: 0)
                calendarTile(event.start, small: true, scale: scale)
                statusBadge(scale, small: true)
                Spacer(minLength: 0)
                HStack(spacing: 4 * scale) {
                    if entry.snapshot?.stale == true {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 10 * scale))
                            .accessibilityLabel("Kalenderstand prüfen")
                    }
                    clock(event, small: true, scale: scale)
                }
                .frame(maxWidth: .infinity)
            } else { noEvent }
        }
    }

    private func mediumLayout(_ scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 3 * scale) {
            header(scale)
            if let event {
                Text(title(event, small: false))
                    .font(.system(size: 16 * scale, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                Spacer(minLength: 0)
                HStack(alignment: .center, spacing: 12 * scale) {
                    calendarTile(event.start, small: false, scale: scale)
                    VStack(alignment: .leading, spacing: 3 * scale) {
                        statusBadge(scale, small: false)
                        HStack(spacing: 4 * scale) {
                            clock(event, small: false, scale: scale)
                            if entry.snapshot?.stale == true {
                                Image(systemName: "exclamationmark.triangle")
                                    .font(.system(size: 11 * scale))
                                    .accessibilityLabel("Kalenderstand prüfen")
                            }
                        }
                        Label(event.location.isEmpty ? "GH Wasser" : event.location, systemImage: "mappin.and.ellipse")
                            .font(.system(size: 10 * scale))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        if !event.clothing.isEmpty {
                            Label(event.clothing, systemImage: "tshirt")
                                .font(.system(size: 10 * scale))
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
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
            .overlay(alignment: .top) {
                VStack(spacing: 0) {
                    burgundy.frame(height: 6 * scale)
                    Color(red: 0.93, green: 0.96, blue: 0.05).frame(height: 2 * scale)
                }
                .accessibilityHidden(true)
            }
        }
        .foregroundStyle(ink)
        .containerBackground(Color(red: 0.94, green: 0.97, blue: 0.95), for: .widget)
        .widgetURL(URL(string: "h2oportal://termine"))
        .environment(\.locale, Locale(identifier: "de_DE"))
        .environment(\.timeZone, TimeZone(identifier: "Europe/Berlin")!)
    }
}
#endif
