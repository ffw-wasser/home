#if canImport(UIKit)
import SwiftUI
import UIKit
import WidgetKit
import AppIntents

struct NextEventEntry: TimelineEntry {
    let date: Date
    let snapshot: H2OWidgetSnapshot?
    var family: WidgetFamily? = nil
}

struct NextEventView: View {
    let entry: NextEventEntry
    @Environment(\.widgetFamily) private var widgetFamily
    @Environment(\.widgetRenderingMode) private var renderingMode
    var familyOverride: WidgetFamily? = nil
    private var family: WidgetFamily { familyOverride ?? entry.family ?? widgetFamily }
    private var small: Bool { family == .systemSmall }
    private var large: Bool { family == .systemLarge }
    private var calendarWidth: CGFloat { large ? 76 : small ? 50 : 64 }
    private var snapshot: H2OWidgetSnapshot? { entry.snapshot?.at(entry.date) }
    private var event: H2OWidgetEvent? { snapshot?.event }
    @ScaledMetric(relativeTo: .body) private var textScale: CGFloat = 1
    private let background = Color(red: 16.0 / 255, green: 38.0 / 255, blue: 58.0 / 255)
    private let red = Color(red: 0.65, green: 0.13, blue: 0.20)
    private let signalYellow = Color(red: 244.0 / 255, green: 197.0 / 255, blue: 66.0 / 255)
    private var ink: Color { renderingMode == .fullColor ? .white : .primary }
    private var secondaryInk: Color { renderingMode == .fullColor ? Color(red: 198.0 / 255, green: 210.0 / 255, blue: 223.0 / 255) : ink.opacity(0.75) }
    private var job: H2OWidgetReplyJob? { snapshot?.job.flatMap { $0.eventID == event?.id ? $0 : nil } }
    private var canReply: Bool { event?.canReply == true && (event?.start ?? .distantPast) > entry.date && snapshot?.stale == false && event?.id != nil }
    private var destination: URL { event?.link ?? URL(string: "h2oportal://termine")! }
    private func part(_ date: Date, _ format: String) -> String {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = TimeZone(identifier: "Europe/Berlin"); formatter.dateFormat = format
        return formatter.string(from: date)
    }
    private func title(_ status: String) -> String {
        switch status { case "yes": return "Dabei"; case "excused": return "Entschuldigt"; case "maybe": return "Unsicher"; default: return "Offen" }
    }
    private func color(_ status: String) -> Color {
        if renderingMode != .fullColor { return .primary }
        switch status {
        case "yes": return Color(red: 40.0 / 255, green: 125.0 / 255, blue: 73.0 / 255)
        case "excused": return signalYellow
        case "maybe": return Color(red: 232.0 / 255, green: 117.0 / 255, blue: 36.0 / 255)
        default: return secondaryInk
        }
    }
    private func rgb(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
    private func highlight(_ status: String) -> Color {
        guard renderingMode == .fullColor else { return ink.opacity(0.3) }
        switch status {
        case "yes": return rgb(0x65B580)
        case "excused": return rgb(0xFFE797)
        case "maybe": return rgb(0xFFC184)
        default: return secondaryInk
        }
    }
    private var bindings: some View {
        HStack {
            binding
            Spacer()
            binding
        }.padding(.horizontal, calendarWidth * 0.22)
            .frame(height: 9).accessibilityHidden(true)
    }
    private var binding: some View {
        Capsule().fill(LinearGradient(colors: [rgb(0x7E8791), rgb(0xF1F4F7), rgb(0x949FA9)], startPoint: .leading, endPoint: .trailing))
            .frame(width: small ? 3 : 4, height: 9)
            .overlay(Capsule().stroke(.white.opacity(0.45), lineWidth: 0.4))
            .compositingGroup().shadow(color: .black.opacity(0.4), radius: 0.6, x: 0.5, y: 1)
    }
    private func calendar(_ event: H2OWidgetEvent) -> some View {
        let paper = renderingMode == .fullColor ? Color(red: 0.95, green: 0.935, blue: 0.90) : ink.opacity(0.12)
        let dateInk = renderingMode == .fullColor ? Color(red: 0.10, green: 0.11, blue: 0.13) : ink
        return VStack(spacing: 0) {
            rgb(0xBD2542).frame(height: 5)
            ZStack {
                Rectangle().fill(LinearGradient(colors: renderingMode == .fullColor ? [rgb(0xBD2542), rgb(0x8C142D)] : [ink.opacity(0.3), ink.opacity(0.2)], startPoint: .top, endPoint: .bottom))
                Text(part(event.start, "MMM").uppercased())
                    .font(.system(size: large ? 15 : small ? 13 : 14, weight: .bold)).foregroundStyle(renderingMode == .fullColor ? .white : ink)
            }.frame(height: large ? 25 : 20)
            Text(part(event.start, "d")).font(.system(size: large ? 38 : small ? 30 : 31, weight: .bold, design: .rounded))
                .frame(height: large ? 45 : small ? 32 : 30)
            Capsule().fill(red.opacity(0.85)).frame(width: calendarWidth * 0.72, height: 0.8)
            Text(H2OWidgetDateLabel.relativeDay(for: event.start, comparedTo: entry.date) ?? part(event.start, "EEE"))
                .font(.system(size: large ? 16 : small ? 12 : 14, weight: .bold)).lineLimit(1).padding(.bottom, 3)
        }.foregroundStyle(dateInk).frame(width: calendarWidth)
            .background(LinearGradient(colors: [paper, renderingMode == .fullColor ? rgb(0xEDE7DD) : paper, paper], startPoint: .topLeading, endPoint: .bottomTrailing))
            .clipShape(RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LinearGradient(colors: [.white.opacity(0.65), red.opacity(0.35)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 0.7))
            .background(RoundedRectangle(cornerRadius: 9).fill(red).offset(y: 2))
            .overlay(alignment: .top) { bindings.offset(y: -4) }
            .compositingGroup()
            .shadow(color: .black.opacity(0.4), radius: 2, y: 2)
            .accessibilityElement(children: .ignore).accessibilityLabel(part(event.start, "EEEE, d. MMMM yyyy"))
    }
    private func details(_ event: H2OWidgetEvent, titleSize: CGFloat, detailSize: CGFloat, spacing: CGFloat, availableWidth: CGFloat) -> some View {
        let fittingSize = titleSize * min(textScale, 1.5)
        return VStack(alignment: .leading, spacing: spacing) {
            Text(event.title).font(.system(size: fittingSize, weight: .bold))
                .lineLimit(2).truncationMode(.tail)
            HStack(spacing: 4) {
                Image(systemName: "clock")
                Text((event.allDay ? "Ganztägig" : part(event.start, "HH:mm")) + (event.location.isEmpty ? "" : " · " + event.location))
            }.font(.system(size: detailSize * min(textScale, 1.5), weight: .semibold)).foregroundStyle(secondaryInk).lineLimit(1).minimumScaleFactor(0.85)
            if !event.clothing.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "tshirt")
                    Text(event.clothing)
                }.font(.system(size: detailSize * min(textScale, 1.5), weight: .semibold)).foregroundStyle(secondaryInk).lineLimit(1).minimumScaleFactor(0.85)
            }
        }.frame(width: max(1, availableWidth), alignment: .leading)
    }
    private func eventCard(_ event: H2OWidgetEvent, width: CGFloat) -> some View {
        let available = max(1, width - calendarWidth - (small ? 7 : 11))
        let titleSize: CGFloat = large ? 26 : small ? 15 : 20
        let font = UIFont.systemFont(ofSize: titleSize * min(textScale, 1.5), weight: .bold)
        let titleWidth = (event.title as NSString).size(withAttributes: [.font: font]).width
        // Reserve real space for the exact original asset; text never sits underneath it.
        let logoSize: CGFloat = small || textScale > 1.2 ? 0 : titleWidth <= available - 62 ? 48 : titleWidth <= (available - 38) * 1.7 ? 28 : 0
        return HStack(spacing: small ? 7 : 11) {
            calendar(event)
            ViewThatFits(in: .vertical) {
                details(event, titleSize: titleSize, detailSize: large ? 14 : small ? 10 : 12, spacing: 2, availableWidth: available - (logoSize > 0 ? logoSize + 11 : 0))
                details(event, titleSize: large ? 22 : small ? 13 : 17, detailSize: large ? 12 : small ? 9 : 11, spacing: 1, availableWidth: available - (logoSize > 0 ? logoSize + 11 : 0))
            }
            if logoSize > 0, let url = Bundle.main.url(forResource: "h2o-symbol-white-512", withExtension: "png"), let logo = UIImage(contentsOfFile: url.path) {
                Image(uiImage: logo).resizable().scaledToFit().frame(width: logoSize, height: logoSize)
                    .opacity(0.12).accessibilityHidden(true)
            }
        }
    }
    private var statusLine: some View {
        let status = event?.status ?? "open"
        let center: CGFloat = status == "yes" ? 1.0 / 6 : status == "maybe" ? 5.0 / 6 : 0.5
        let tint = color(status)
        let core = LinearGradient(stops: [
            .init(color: secondaryInk.opacity(0.42), location: 0),
            .init(color: tint.opacity(0.35), location: max(0.001, center - 0.22)),
            .init(color: status == "open" ? secondaryInk.opacity(0.45) : highlight(status), location: center),
            .init(color: tint.opacity(0.35), location: min(0.999, center + 0.22)),
            .init(color: secondaryInk.opacity(0.42), location: 1)
        ], startPoint: .leading, endPoint: .trailing)
        return ZStack {
            if status != "open" && renderingMode == .fullColor {
                Capsule().fill(LinearGradient(stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .clear, location: max(0.001, center - 0.22)),
                    .init(color: tint.opacity(0.50), location: center),
                    .init(color: .clear, location: min(0.999, center + 0.22)),
                    .init(color: .clear, location: 1)
                ], startPoint: .leading, endPoint: .trailing))
                    .frame(height: 2.5).blur(radius: 1)
            }
            Capsule().fill(core).frame(height: 0.8)
                .overlay(alignment: .top) { Color.white.opacity(0.16).frame(height: 0.2) }
        }.frame(height: 1).accessibilityHidden(true)
    }
    private func choice(_ status: String) -> some View {
        let selected = event?.status == status
        let pending = job?.phase == "saving" && job?.status == status
        return Button(intent: H2OWidgetReplyIntent(eventID: event?.id ?? "", response: status)) {
            HStack(spacing: 4) {
                Image(systemName: pending ? "hourglass" : selected ? "checkmark" : "circle").font(.system(size: 12, weight: .semibold))
                Text(title(status)).font(.system(size: 13, weight: selected ? .bold : .semibold)).lineLimit(1).minimumScaleFactor(0.75)
            }.frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(selected ? (renderingMode == .fullColor && status != "yes" ? Color(red: 45.0 / 255, green: 33.0 / 255, blue: 10.0 / 255) : ink) : secondaryInk)
                .background {
                    if selected {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(LinearGradient(stops: [.init(color: highlight(status), location: 0), .init(color: color(status), location: 0.68), .init(color: color(status).opacity(0.94), location: 1)], startPoint: .top, endPoint: .bottom))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LinearGradient(colors: [.white.opacity(0.8), highlight(status).opacity(0.45), .black.opacity(0.2)], startPoint: .top, endPoint: .bottom), lineWidth: 0.9))
                            .compositingGroup().shadow(color: .black.opacity(0.35), radius: 1.5, y: 1.5)
                            .padding(1)
                    }
                }
        }.buttonStyle(.plain).disabled(!canReply || job != nil)
            .accessibilityLabel(title(status)).accessibilityValue(selected ? "Ausgewählt" : pending ? "Wird gespeichert" : "")
    }
    @ViewBuilder private var replyControls: some View {
        if let message = snapshot?.message {
            Link(message, destination: destination).font(.system(size: 11, weight: .medium))
                .frame(maxWidth: .infinity, minHeight: 44)
        } else if job?.phase == "retry" {
            Button(intent: H2OWidgetReplyIntent(eventID: event?.id ?? "", response: "retry")) {
                Label("Erneut versuchen", systemImage: "arrow.clockwise")
                    .font(.system(size: 12, weight: .semibold)).frame(maxWidth: .infinity, minHeight: 44)
            }.buttonStyle(.plain).background(ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
        } else {
            HStack(spacing: 0) {
                choice("yes")
                choice("excused")
                choice("maybe")
            }.background(LinearGradient(colors: [rgb(0x315971), rgb(0x183A52), rgb(0x102A40)], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LinearGradient(colors: [rgb(0xB9DAE8).opacity(0.85), rgb(0x4C758E).opacity(0.5)], startPoint: .top, endPoint: .bottom), lineWidth: 0.8))
                .compositingGroup().shadow(color: .black.opacity(0.3), radius: 1.5, y: 2)

        }
    }
    private var feedbackText: String {
        if let message = snapshot?.message { return message }
        if let job { return job.phase == "saving" ? "Wird gespeichert …" : "Nicht bestätigt" }
        if let notice = snapshot?.notice { return notice }
        if snapshot?.stale == true { return "Gespeicherter Stand · H₂O öffnen" }
        if event?.status == "open" { return event?.reminded == true ? "Bitte Rückmeldung geben" : "Rückmeldung offen" }
        return "Gespeichert"
    }
    private var feedback: some View {
        let unanswered = job == nil && snapshot?.message == nil && event?.status == "open"
        let textColor = unanswered ? signalYellow : secondaryInk
        let confirmed = job == nil && snapshot?.message == nil && snapshot?.notice == nil && snapshot?.stale == false && ["yes", "excused", "maybe"].contains(event?.status ?? "open")
        return HStack(spacing: 4) {
            if confirmed {
                ZStack {
                    Circle().fill(LinearGradient(colors: [highlight("yes"), color("yes")], startPoint: .topLeading, endPoint: .bottomTrailing))
                    Image(systemName: "checkmark").font(.system(size: 8, weight: .bold)).foregroundStyle(renderingMode == .fullColor ? .white : ink)
                }.frame(width: 12, height: 12)
                    .overlay(Circle().stroke(ink.opacity(0.35), lineWidth: 0.4))
            } else {
            Image(systemName: job?.phase == "saving" ? "arrow.triangle.2.circlepath" : snapshot?.notice != nil || snapshot?.stale == true ? "arrow.clockwise" : job != nil || snapshot?.message != nil ? "exclamationmark.circle" : event?.status == "open" ? "circle" : "checkmark.circle.fill")
                .foregroundStyle(unanswered ? signalYellow : job == nil && snapshot?.message == nil && snapshot?.notice == nil && snapshot?.stale == false ? color("yes") : secondaryInk)
            }
            Text(feedbackText).fontWeight(.semibold).foregroundStyle(textColor)
            if snapshot?.stale == true {
                Image(systemName: "exclamationmark.triangle").foregroundStyle(secondaryInk)
                    .accessibilityLabel("Gespeicherter Kalenderstand · H₂O öffnen")
            }
            Spacer(minLength: 0)
        }.font(.system(size: large ? 12 : 11)).lineLimit(1).minimumScaleFactor(0.8)
            .frame(height: large ? 15 : 14).invalidatableContent(job == nil)
    }
    private var compactStatus: some View {
        Link(destination: destination) {
            HStack(spacing: 4) {
                Circle().stroke(color(event?.status ?? "open"), lineWidth: 1.5).frame(width: 11, height: 11)
                Text(job == nil ? title(event?.status ?? "open") : feedbackText).fontWeight(.semibold)
                    .foregroundStyle(job == nil && event?.status == "open" ? signalYellow : ink)
                Spacer(minLength: 0)
                Image(systemName: snapshot?.stale == true ? "exclamationmark.triangle" : "chevron.down").font(.system(size: 8)).foregroundStyle(secondaryInk)
            }.font(.system(size: 12)).lineLimit(1).minimumScaleFactor(0.75)
                .padding(.horizontal, 5).frame(maxWidth: .infinity, minHeight: 28)
                .background(ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 7))
        }.buttonStyle(.plain)
    }
    private var following: some View {
        VStack(spacing: 0) {
            ForEach(Array((snapshot?.following ?? []).prefix(2).enumerated()), id: \.offset) { _, next in
                Link(destination: next.link ?? URL(string: "h2oportal://termine")!) {
                    HStack(spacing: 7) {
                        Text(part(next.start, "d. MMM").uppercased()).font(.system(size: 12, weight: .medium)).frame(width: 56, alignment: .leading)
                        Text(next.title).font(.system(size: 14, weight: .medium)).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                        Text(next.allDay ? "Ganztägig" : part(next.start, "HH:mm")).font(.system(size: 12)).foregroundStyle(secondaryInk).lineLimit(1)
                        Image(systemName: "chevron.right").font(.system(size: 8)).foregroundStyle(secondaryInk)
                    }.frame(minHeight: 36)
                        .overlay(alignment: .bottom) { Rectangle().fill(ink.opacity(0.16)).frame(height: 0.5) }
                }.buttonStyle(.plain)
            }
        }
    }
    var body: some View {
        GeometryReader { geometry in
            let horizontal: CGFloat = small ? 10 : large ? 14 : 12
            let vertical: CGFloat = large ? 12 : small ? 8 : 4
            let width = max(1, geometry.size.width - 2 * horizontal)
            let height = max(1, geometry.size.height - 2 * vertical)
            let eventHeight: CGFloat = large ? 119 : max(1, height - (small ? 28 + 1 + 6 : 44 + 14 + 1 + 13))
            VStack(alignment: .leading, spacing: large ? 5 : 3) {
                if let event {
                    Link(destination: destination) { eventCard(event, width: width) }.buttonStyle(.plain)
                        .frame(width: width, height: eventHeight, alignment: .center)
                    Rectangle().fill(ink.opacity(0.22)).frame(height: 0.5)
                    if small { compactStatus }
                    else {
                        if large { Text("Deine Rückmeldung").font(.system(size: 12, weight: .semibold)).foregroundStyle(secondaryInk) }
                        replyControls.invalidatableContent(job == nil)
                        statusLine
                        feedback
                    }
                    if large && !(snapshot?.following ?? []).isEmpty {
                        Rectangle().fill(ink.opacity(0.22)).frame(height: 0.5)
                        Text("Weitere Termine").font(.system(size: 12)).foregroundStyle(secondaryInk)
                        following
                    }
                } else {
                    Text(snapshot == nil ? "H₂O öffnen, um Termine zu laden." : snapshot?.stale == true ? "Keine gespeicherten Termine · H₂O öffnen" : "Keine kommenden Termine")
                        .font(.system(size: 13, weight: .medium)).frame(maxHeight: .infinity, alignment: .leading)
                }
            }.frame(width: width, height: height, alignment: .topLeading)
                .padding(.horizontal, horizontal).padding(.vertical, vertical)
                .background {
                    LinearGradient(stops: [.init(color: Color(red: 29.0 / 255, green: 48.0 / 255, blue: 68.0 / 255), location: 0), .init(color: background, location: 1)], startPoint: .topLeading, endPoint: .bottomTrailing)
                    LinearGradient(stops: [.init(color: rgb(0x781234).opacity(0.75), location: 0), .init(color: red.opacity(0), location: 0.25), .init(color: .clear, location: 1)], startPoint: .top, endPoint: .bottom)
                    RadialGradient(colors: [rgb(0x2C6378).opacity(0.22), .clear], center: .bottomLeading, startRadius: 0, endRadius: geometry.size.width)
                }
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(LinearGradient(colors: [rgb(0xD1B2BA).opacity(0.7), rgb(0x4A748D).opacity(0.55), rgb(0x071725)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 22))
        }.id(family)
            .foregroundStyle(ink).containerBackground(background, for: .widget)
            .widgetURL(destination).environment(\.locale, Locale(identifier: "de_DE"))
            .environment(\.timeZone, TimeZone(identifier: "Europe/Berlin")!)
    }
}
#endif
