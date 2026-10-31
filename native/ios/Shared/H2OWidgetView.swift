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
            if family != .systemSmall, event != nil { statusBadge(scale) }
        }
        .frame(height: 20 * scale)
        .accessibilityElement(children: .combine)
    }

    private func statusBadge(_ scale: CGFloat) -> some View {
        HStack(spacing: 3 * scale) {
            if event?.status == "yes" { Image(systemName: "checkmark") }
            Text(statusTitle)
        }
        .font(.system(size: 9 * scale, weight: .bold))
        .foregroundStyle(statusColor)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .padding(.horizontal, 6 * scale)
        .padding(.vertical, 3 * scale)
        .background(statusColor.opacity(0.12), in: Capsule())
        .accessibilityLabel("Rückmeldung: " + statusTitle)
    }

    private func calendarTile(_ date: Date, small: Bool, scale: CGFloat) -> some View {
        VStack(spacing: small ? 0 : 2 * scale) {
            Text(datePart(date, "EEE").replacingOccurrences(of: ".", with: "").uppercased())
                .font(.system(size: (small ? 9 : 10) * scale, weight: .bold))
            Text(datePart(date, "dd"))
                .font(.system(size: (small ? 22 : 36) * scale, weight: .heavy))
                .monospacedDigit()
            Rectangle().fill(Color.white.opacity(0.5)).frame(height: 0.5)
                .padding(.horizontal, 5 * scale)
            Text(datePart(date, small ? "MMM" : "MMMM").replacingOccurrences(of: ".", with: "").uppercased())
                .font(.system(size: (small ? 8 : 9) * scale, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 4 * scale)
        .frame(width: (small ? 44 : 65) * scale, height: (small ? 46 : 80) * scale)
        .background(burgundy, in: RoundedRectangle(cornerRadius: 7 * scale))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(datePart(date, "EEEE, d. MMMM"))
    }

    private func title(_ event: H2OWidgetEvent, small: Bool) -> String {
        event.title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "probe"
            ? (small ? "Nächste\nProbe" : "Nächste Probe") : event.title
    }

    private func clock(_ event: H2OWidgetEvent, small: Bool, scale: CGFloat) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 3 * scale) {
            Text(event.allDay ? "Ganztägig" : berlinTime(event.start))
                .font(.system(size: (event.allDay ? (small ? 22 : 27) : (small ? 32 : (event.title.count > 24 ? 32 : 40))) * scale, weight: .heavy))
                .monospacedDigit()
            if !event.allDay {
                Text("Uhr").font(.system(size: (small ? 12 : 15) * scale, weight: .bold))
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .accessibilityElement(children: .combine)
    }

    private var noEvent: some View {
        Text(entry.snapshot == nil ? "H₂O öffnen, um Termine zu laden." : "Keine kommenden Termine")
            .font(.system(size: 12, weight: .medium))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func smallLayout(_ scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 2 * scale) {
            header(scale)
            if let event {
                HStack(spacing: 9 * scale) {
                    calendarTile(event.start, small: true, scale: scale)
                    Text(title(event, small: true))
                        .font(.system(size: 17 * scale, weight: .bold))
                        .lineLimit(2)
                        .minimumScaleFactor(0.7)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Spacer(minLength: 0)
                clock(event, small: true, scale: scale)
                Spacer(minLength: 0)
                HStack(spacing: 4 * scale) {
                    statusBadge(scale)
                    if entry.snapshot?.stale == true {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 9 * scale))
                            .accessibilityLabel("Kalenderstand prüfen")
                    }
                    Spacer(minLength: 0)
                    Label(event.location.isEmpty ? "GH Wasser" : event.location, systemImage: "mappin.and.ellipse")
                        .font(.system(size: 9 * scale))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
            } else { noEvent }
        }
    }

    private func mediumLayout(_ scale: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 4 * scale) {
            header(scale)
            if let event {
                Spacer(minLength: 0)
                HStack(spacing: 12 * scale) {
                    calendarTile(event.start, small: false, scale: scale)
                    VStack(alignment: .leading, spacing: 1 * scale) {
                        Text(title(event, small: false))
                            .font(.system(size: (event.title.count > 24 ? 14 : 18) * scale, weight: .bold))
                            .lineLimit(2)
                            .minimumScaleFactor(0.75)
                        clock(event, small: false, scale: scale)
                        HStack(spacing: 7 * scale) {
                            Label(event.location.isEmpty ? "GH Wasser" : event.location, systemImage: "mappin.and.ellipse")
                            if !event.clothing.isEmpty {
                                Label(event.clothing, systemImage: "tshirt")
                            }
                        }
                        .font(.system(size: 10 * scale))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                Spacer(minLength: 0)
                Rectangle().fill(ink.opacity(0.15)).frame(height: 0.5)
                Text((entry.snapshot?.stale == true ? "Kalenderstand prüfen · " : "") + datePart(event.start, "EEEE, d. MMMM").uppercased())
                    .font(.system(size: 8 * scale, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity)
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
