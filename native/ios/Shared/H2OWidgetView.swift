#if canImport(UIKit)
import SwiftUI
import WidgetKit
import AppIntents

struct NextEventEntry: TimelineEntry {
    let date: Date
    let snapshot: H2OWidgetSnapshot?
}

struct NextEventView: View {
    let entry: NextEventEntry
    @Environment(\.widgetFamily) private var widgetFamily
    @Environment(\.widgetRenderingMode) private var renderingMode
    private var family: WidgetFamily { widgetFamily }
    private var small: Bool { family == .systemSmall }
    private var large: Bool { family == .systemLarge }
    private var snapshot: H2OWidgetSnapshot? { entry.snapshot?.at(entry.date) }
    private var event: H2OWidgetEvent? { snapshot?.event }
    private let background = Color(red: 0.098, green: 0.106, blue: 0.125)
    private let red = Color(red: 0.65, green: 0.13, blue: 0.20)
    private let signalYellow = Color(red: 0.96, green: 0.77, blue: 0.26)
    private var ink: Color { renderingMode == .fullColor ? .white : .primary }
    private var secondaryInk: Color { ink.opacity(0.70) }
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
        case "excused": return Color(red: 179.0 / 255, green: 51.0 / 255, blue: 72.0 / 255)
        case "maybe": return Color(red: 154.0 / 255, green: 107.0 / 255, blue: 16.0 / 255)
        default: return signalYellow
        }
    }
    private func calendar(_ event: H2OWidgetEvent) -> some View {
        let paper = renderingMode == .fullColor ? Color(red: 0.95, green: 0.935, blue: 0.90) : ink.opacity(0.12)
        let dateInk = renderingMode == .fullColor ? Color(red: 0.10, green: 0.11, blue: 0.13) : ink
        return VStack(spacing: 0) {
            ZStack {
                Rectangle().fill(renderingMode == .fullColor ? red : ink.opacity(0.25))
                Text(part(event.start, "MMM").uppercased())
                    .font(.system(size: large ? 11 : 10, weight: .semibold)).foregroundStyle(renderingMode == .fullColor ? .white : ink)
            }.frame(height: large ? 19 : 15)
            Text(part(event.start, "d")).font(.system(size: large ? 44 : small ? 34 : 36, weight: .bold, design: .rounded))
                .frame(height: large ? 51 : small ? 42 : 44)
            Text(H2OWidgetDateLabel.relativeDay(for: event.start, comparedTo: entry.date) ?? part(event.start, "EEE"))
                .font(.system(size: large ? 11 : 10)).lineLimit(1).padding(.bottom, 3)
        }.foregroundStyle(dateInk).frame(width: large ? 70 : small ? 44 : 56)
            .background(paper).clipShape(RoundedRectangle(cornerRadius: 7))
            .accessibilityElement(children: .ignore).accessibilityLabel(part(event.start, "EEEE, d. MMMM yyyy"))
    }
    private func details(_ event: H2OWidgetEvent, titleSize: CGFloat, detailSize: CGFloat, spacing: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: spacing) {
            Text(event.title).font(.system(size: titleSize, weight: .semibold))
                .lineLimit(large || small ? 3 : 2).fixedSize(horizontal: false, vertical: true)
            Text((event.allDay ? "Ganztägig" : part(event.start, "HH:mm")) + " · " + event.location)
                .font(.system(size: detailSize)).foregroundStyle(secondaryInk).lineLimit(small ? 2 : 1).minimumScaleFactor(0.8)
            if !event.clothing.isEmpty {
                Text(event.clothing).font(.system(size: detailSize - 1)).foregroundStyle(secondaryInk).lineLimit(1).minimumScaleFactor(0.8)
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
    private func eventCard(_ event: H2OWidgetEvent) -> some View {
        HStack(spacing: small ? 7 : 11) {
            calendar(event)
            ViewThatFits(in: .vertical) {
                details(event, titleSize: large ? 26 : small ? 15 : 20, detailSize: large ? 14 : small ? 10 : 12, spacing: 2)
                details(event, titleSize: large ? 22 : small ? 13 : 17, detailSize: large ? 12 : small ? 9 : 11, spacing: 1)
            }
        }
    }
    private func choice(_ status: String) -> some View {
        let selected = job == nil && event?.status == status
        let pending = job?.phase == "saving" && job?.status == status
        return Button(intent: H2OWidgetReplyIntent(eventID: event?.id ?? "", response: status)) {
            HStack(spacing: 4) {
                Image(systemName: pending ? "hourglass" : selected ? "checkmark" : "circle").font(.system(size: 12, weight: .semibold))
                Text(title(status)).font(.system(size: 13, weight: selected ? .semibold : .medium)).lineLimit(1).minimumScaleFactor(0.75)
            }.frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(selected ? ink : secondaryInk)
                .background(selected ? color(status).opacity(renderingMode == .fullColor ? 1 : 0.2) : ink.opacity(0.035))
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
                Rectangle().fill(ink.opacity(0.20)).frame(width: 0.5, height: 44)
                choice("excused")
                Rectangle().fill(ink.opacity(0.20)).frame(width: 0.5, height: 44)
                choice("maybe")
            }.clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(ink.opacity(0.25), lineWidth: 0.7))
        }
    }
    private var feedbackText: String {
        if let message = snapshot?.message { return message }
        if let job { return job.phase == "saving" ? "Wird gespeichert …" : "Nicht bestätigt" }
        if event?.status == "open" { return event?.reminded == true ? "Bitte Rückmeldung geben" : "Rückmeldung offen" }
        return "Gespeichert"
    }
    private var feedback: some View {
        let unanswered = job == nil && snapshot?.message == nil && event?.status == "open"
        let textColor = unanswered ? signalYellow : secondaryInk
        return HStack(spacing: 4) {
            Image(systemName: job?.phase == "saving" ? "arrow.triangle.2.circlepath" : job != nil || snapshot?.message != nil ? "exclamationmark.circle" : event?.status == "open" ? "circle" : "checkmark")
                .foregroundStyle(unanswered ? signalYellow : job == nil && snapshot?.message == nil ? color("yes") : secondaryInk)
            Text(feedbackText).foregroundStyle(textColor)
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
            let vertical: CGFloat = large ? 12 : small ? 8 : 6
            let width = max(1, geometry.size.width - 2 * horizontal)
            let height = max(1, geometry.size.height - 2 * vertical)
            let eventHeight: CGFloat = large ? 119 : max(1, height - (small ? 28 + 1 + 6 : 44 + 14 + 1 + 9))
            VStack(alignment: .leading, spacing: large ? 5 : 3) {
                if let event {
                    Link(destination: destination) { eventCard(event) }.buttonStyle(.plain)
                        .frame(width: width, height: eventHeight, alignment: .center)
                    Rectangle().fill(ink.opacity(0.22)).frame(height: 0.5)
                    if small { compactStatus }
                    else {
                        if large { Text("Deine Rückmeldung").font(.system(size: 12, weight: .semibold)).foregroundStyle(secondaryInk) }
                        replyControls.invalidatableContent(job == nil)
                        feedback
                    }
                    if large && !(snapshot?.following ?? []).isEmpty {
                        Rectangle().fill(ink.opacity(0.22)).frame(height: 0.5)
                        Text("Weitere Termine").font(.system(size: 12)).foregroundStyle(secondaryInk)
                        following
                    }
                } else {
                    Text(snapshot == nil ? "H₂O öffnen, um Termine zu laden." : "Keine kommenden Termine")
                        .font(.system(size: 13, weight: .medium)).frame(maxHeight: .infinity, alignment: .leading)
                }
            }.frame(width: width, height: height, alignment: .topLeading)
                .padding(.horizontal, horizontal).padding(.vertical, vertical)
                .background(background)
                .overlay(alignment: .top) { red.frame(height: 3).accessibilityHidden(true) }
                .clipShape(RoundedRectangle(cornerRadius: 22))
        }.id(family)
            .foregroundStyle(ink).containerBackground(background, for: .widget)
            .widgetURL(destination).environment(\.locale, Locale(identifier: "de_DE"))
            .environment(\.timeZone, TimeZone(identifier: "Europe/Berlin")!)
    }
}
#endif
