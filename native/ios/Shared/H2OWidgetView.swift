#if canImport(UIKit)
import SwiftUI
import WidgetKit
import UIKit
import ImageIO
import AppIntents

struct NextEventEntry: TimelineEntry {
    let date: Date
    let snapshot: H2OWidgetSnapshot?
}

struct NextEventView: View {
    let entry: NextEventEntry
    @Environment(\.widgetFamily) private var widgetFamily
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.dynamicTypeSize) private var typeSize
    var familyOverride: WidgetFamily? = nil
    private var family: WidgetFamily { familyOverride ?? widgetFamily }
    private var small: Bool { family == .systemSmall }
    private var large: Bool { family == .systemLarge }
    private var snapshot: H2OWidgetSnapshot? { entry.snapshot?.at(entry.date) }
    private var event: H2OWidgetEvent? { snapshot?.event }
    private let background = Color(red: 0.09, green: 0.12, blue: 0.17)
    private var ink: Color { renderingMode == .fullColor ? .white : .primary }
    private var secondaryInk: Color { ink.opacity(0.72) }
    private var job: H2OWidgetReplyJob? { snapshot?.job.flatMap { $0.eventID == event?.id ? $0 : nil } }
    private var canReply: Bool { event?.canReply == true && (event?.start ?? .distantPast) > entry.date && snapshot?.stale == false && event?.id != nil }
    private var choosing: Bool { event?.status == "open" || snapshot?.editing == event?.id }
    private static let logo: UIImage? = {
        guard let url = Bundle.main.url(forResource: "AppIcon", withExtension: "png"), let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: 96] as CFDictionary) else { return nil }
        return UIImage(cgImage: thumbnail)
    }()
    private func part(_ date: Date, _ format: String) -> String {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = TimeZone(identifier: "Europe/Berlin"); formatter.dateFormat = format
        return formatter.string(from: date)
    }
    private func day(_ event: H2OWidgetEvent) -> String {
        let relative = H2OWidgetDateLabel.relativeDay(for: event.start, comparedTo: entry.date)
        if small { return relative ?? part(event.start, "d. MMM") }
        return (relative.map { $0 + " · " } ?? "") + part(event.start, "d. MMMM")
    }
    private func title(_ status: String) -> String {
        switch status { case "yes": return "Dabei"; case "excused": return "Entschuldigt"; case "maybe": return "Unsicher"; default: return "Rückmeldung offen" }
    }
    private func symbol(_ status: String) -> String {
        switch status { case "yes": return "checkmark"; case "excused": return "xmark"; case "maybe": return "questionmark"; default: return "circle" }
    }
    private func color(_ status: String) -> Color {
        if renderingMode != .fullColor { return .primary }
        switch status { case "yes": return Color(red: 0.20, green: 0.43, blue: 0.29); case "excused": return Color(red: 0.48, green: 0.17, blue: 0.22); case "maybe": return Color(red: 0.49, green: 0.34, blue: 0.12); default: return Color.white.opacity(0.10) }
    }
    private var header: some View {
        HStack(spacing: 5) {
            if let logo = Self.logo { Image(uiImage: logo).resizable().scaledToFit().frame(width: small || large ? 17 : 12, height: small || large ? 17 : 12).accessibilityHidden(true) }
            Text(small ? "Feuerwehr Wasser" : "H₂O · Feuerwehr Wasser")
                .font(.system(size: small || !large ? 10 : 11, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 0)
            if snapshot?.stale == true { Image(systemName: "exclamationmark.triangle").accessibilityLabel("Gespeicherter Kalenderstand · H₂O öffnen") }
        }.foregroundStyle(secondaryInk)
    }
    private func details(_ event: H2OWidgetEvent, compact: Bool, dense: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: compact || dense ? 2 : 5) {
            Text(day(event)).font(.system(size: compact ? 24 : large ? 27 : dense ? 17 : 21, weight: .bold))
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(event.title).font(.system(size: compact ? 13 : large ? 23 : dense ? 15 : 17, weight: .semibold))
                .lineLimit(2).minimumScaleFactor(0.8)
            Text((event.allDay ? "Ganztägig" : part(event.start, "HH:mm")) + (compact ? "" : " · " + event.location))
                .font(.system(size: compact || dense ? 10 : 12)).foregroundStyle(secondaryInk).lineLimit(1).minimumScaleFactor(0.8)
            if !compact && !event.clothing.isEmpty {
                Text(event.clothing).font(.system(size: dense ? 10 : 11)).foregroundStyle(secondaryInk).lineLimit(1).minimumScaleFactor(0.8)
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
    private func action(_ status: String, label: String? = nil) -> some View {
        Button(intent: H2OWidgetReplyIntent(eventID: event?.id ?? "", response: status)) {
            HStack(spacing: 4) {
                if label == nil { Image(systemName: symbol(status)).accessibilityHidden(true) }
                Text(label ?? title(status)).font(.system(size: 11, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
            }.frame(maxWidth: .infinity, minHeight: 44)
                .background(color(status), in: RoundedRectangle(cornerRadius: 10))
        }.buttonStyle(.plain).accessibilityLabel(label ?? title(status))
    }
    @ViewBuilder private var footer: some View {
        if let event {
            if small {
                Link(destination: event.link ?? URL(string: "h2oportal://termine")!) {
                    Label(title(event.status), systemImage: symbol(event.status))
                        .font(.system(size: 12, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.75)
                        .frame(maxWidth: .infinity, minHeight: 27, alignment: .leading)
                        .padding(.horizontal, 10).background(color(event.status))
                }
            } else if let message = snapshot?.message {
                Link(message, destination: event.link ?? URL(string: "h2oportal://termine")!)
                    .font(.system(size: 12, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44)
            } else if let job {
                if job.phase == "saving" {
                    Text("Wird gespeichert …").font(.system(size: 12, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44)
                } else {
                    HStack(spacing: 6) {
                        Text("Speicherung unbestätigt").font(.system(size: 10)).lineLimit(2)
                        action("retry", label: "Erneut versuchen")
                    }
                }
            } else if canReply && choosing {
                HStack(spacing: 6) { action("yes"); action("excused"); action("maybe") }
            } else {
                HStack {
                    Label(title(event.status), systemImage: symbol(event.status)).font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                    Spacer(minLength: 4)
                    if canReply { action("edit", label: "Ändern").frame(width: 80) }
                }.padding(.leading, 10).background(color(event.status), in: RoundedRectangle(cornerRadius: 10))
                    .frame(minHeight: 44)
            }
        }
    }
    var body: some View {
        GeometryReader { geometry in
            VStack(alignment: .leading, spacing: small ? 4 : large ? 6 : 3) {
                header.frame(height: small || large ? 17 : 12)
                if let event {
                    Link(destination: event.link ?? URL(string: "h2oportal://termine")!) { details(event, compact: small, dense: !small && !large) }.buttonStyle(.plain)
                    if !small && event.status == "open" && job == nil && canReply && (large || geometry.size.height >= 170) {
                        Text(event.reminded == true ? "Bitte Rückmeldung geben" : "Rückmeldung offen").font(.system(size: 10)).foregroundStyle(secondaryInk)
                    }
                    if large { Spacer(minLength: 0) }
                    footer
                    if large {
                        ForEach(Array((snapshot?.following ?? []).prefix(2).enumerated()), id: \.offset) { _, next in
                            Link(destination: next.link ?? URL(string: "h2oportal://termine")!) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Divider().overlay(ink.opacity(0.14))
                                    Text(day(next) + " · " + (next.allDay ? "Ganztägig" : part(next.start, "HH:mm")))
                                        .font(.system(size: 11)).foregroundStyle(secondaryInk).lineLimit(1)
                                    Text(next.title).font(.system(size: 13, weight: .medium)).lineLimit(1)
                                }.padding(.top, 4)
                            }.buttonStyle(.plain)
                        }
                    }
                } else {
                    Text(snapshot == nil ? "H₂O öffnen, um Termine zu laden." : "Keine kommenden Termine")
                        .font(.system(size: 13, weight: .medium)).frame(maxHeight: .infinity, alignment: .leading)
                }
            }
            .padding(.horizontal, small ? 10 : 12)
            .padding(.vertical, small ? 8 : large ? 12 : 3)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(background)
            .overlay(alignment: .top) { Color(red: 0.70, green: 0.11, blue: 0.17).frame(height: 3).accessibilityHidden(true) }
        }
        .foregroundStyle(ink)
        .containerBackground(background, for: .widget)
        .widgetURL(event?.link ?? URL(string: "h2oportal://termine"))
        .environment(\.locale, Locale(identifier: "de_DE"))
        .environment(\.timeZone, TimeZone(identifier: "Europe/Berlin")!)
    }
}
#endif
