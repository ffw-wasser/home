#if canImport(UIKit)
import SwiftUI
import UIKit
import WidgetKit
import AppIntents

struct NextEventEntry: TimelineEntry {
    let date: Date
    let snapshot: H2OWidgetSnapshot?
    var family: WidgetFamily? = nil
    var appUpdateAvailable: Bool = false
}

// A pending reply remains disabled without PlainButtonStyle dimming the card.
private struct StableWidgetReplyStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { configuration.label }
}

struct NextEventView: View {
    let entry: NextEventEntry
    @Environment(\.widgetFamily) private var widgetFamily
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
    private var fullColor: Bool { renderingMode == .fullColor }
    private var ink: Color { fullColor ? .white : .primary }
    private var secondaryInk: Color { fullColor ? Color(red: 198.0 / 255, green: 210.0 / 255, blue: 223.0 / 255) : ink }
    private var noticeInk: Color { fullColor ? signalYellow : ink }
    private var job: H2OWidgetReplyJob? { snapshot?.currentReplyJob }
    private var canReply: Bool { event?.canReply == true && (event?.start ?? .distantPast) > entry.date && snapshot?.stale == false && event?.id != nil }
    private var destination: URL { event?.link ?? URL(string: "h2oportal://termine")! }
    private func part(_ date: Date, _ format: String) -> String {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "de_DE")
        formatter.timeZone = TimeZone(identifier: "Europe/Berlin"); formatter.dateFormat = format
        return formatter.string(from: date)
    }
    private func title(_ status: String) -> String {
        switch status { case "yes": return "Dabei"; case "excused": return "Absage"; case "maybe": return "Unsicher"; default: return "Offen" }
    }
    private func color(_ status: String) -> Color {
        switch status {
        case "yes": return Color(red: 40.0 / 255, green: 125.0 / 255, blue: 73.0 / 255)
        case "excused": return signalYellow
        case "maybe": return Color(red: 232.0 / 255, green: 106.0 / 255, blue: 34.0 / 255)
        default: return secondaryInk
        }
    }
    private func rgb(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
    private func highlight(_ status: String) -> Color {
        switch status {
        case "yes": return rgb(0x65B580)
        case "excused": return rgb(0xFFE16B)
        case "maybe": return rgb(0xFF9D55)
        default: return secondaryInk
        }
    }
    // Only the confirmed answer colors the frame; pending/error feedback stays below.
    private var edgeStatus: String { event?.status ?? "open" }
    private var edgePalette: [Color] {
        if event?.canReply == false { return [rgb(0x466E90), rgb(0x213346), rgb(0xA4CEE9)] }
        switch edgeStatus {
        case "yes": return [rgb(0x28513E), rgb(0x152D2D), rgb(0x78C38F)]
        case "excused": return [rgb(0x66511A), rgb(0x3A301C), rgb(0xFFE16B)]
        case "maybe": return [rgb(0x70321B), rgb(0x42231F), rgb(0xFF9D55)]
        default: return [rgb(0x344A60), rgb(0x213346), rgb(0x9AB2C6)]
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
    @ViewBuilder private func calendar(_ event: H2OWidgetEvent) -> some View {
        if fullColor {
            printedCalendar(event)
        } else {
            VStack(spacing: 2) {
                Text(part(event.start, "MMM").uppercased())
                    .font(.system(size: large ? 15 : small ? 12 : 13, weight: .bold))
                Text(part(event.start, "d"))
                    .font(.system(size: large ? 38 : small ? 29 : 30, weight: .bold, design: .rounded))
                Text(H2OWidgetDateLabel.relativeDay(for: event.start, comparedTo: entry.date) ?? part(event.start, "EEE"))
                    .font(.system(size: large ? 14 : small ? 11 : 12, weight: .semibold))
            }.lineLimit(1)
                .padding(.vertical, 3)
                .frame(width: calendarWidth)
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(ink.opacity(0.55), lineWidth: 1))
                .accessibilityElement(children: .ignore).accessibilityLabel(part(event.start, "EEEE, d. MMMM yyyy"))
        }
    }
    private func printedCalendar(_ event: H2OWidgetEvent) -> some View {
        let observation = event.canReply == false
        let monthTop = observation ? rgb(0xA4CEE9) : rgb(0xBD2542)
        let monthBottom = observation ? rgb(0x82BCE7) : rgb(0x8C142D)
        let monthInk = observation ? rgb(0x18344C) : Color.white
        let paper = Color(red: 0.95, green: 0.935, blue: 0.90)
        let dateInk = Color(red: 0.10, green: 0.11, blue: 0.13)
        return VStack(spacing: 0) {
            monthTop.frame(height: 5)
            ZStack {
                Rectangle().fill(LinearGradient(colors: [monthTop, monthBottom], startPoint: .top, endPoint: .bottom))
                Text(part(event.start, "MMM").uppercased())
                    .font(.system(size: large ? 15 : small ? 13 : 14, weight: .bold)).foregroundStyle(monthInk)
            }.frame(height: large ? 25 : 20)
            Text(part(event.start, "d")).font(.system(size: large ? 38 : small ? 30 : 31, weight: .bold, design: .rounded))
                .frame(height: large ? 47 : small ? 33 : 32)
            Capsule().fill(red.opacity(0.85)).frame(width: calendarWidth * 0.72, height: 0.8)
            Text(H2OWidgetDateLabel.relativeDay(for: event.start, comparedTo: entry.date) ?? part(event.start, "EEE"))
                .font(.system(size: large ? 14 : small ? 11 : 12, weight: .bold))
                .foregroundStyle(H2OWidgetDateLabel.relativeDay(for: event.start, comparedTo: entry.date) == "Heute" ? red : dateInk)
                .lineLimit(1).padding(.top, 2).padding(.bottom, 3)
        }.foregroundStyle(dateInk).frame(width: calendarWidth)
            .background(LinearGradient(colors: [paper, rgb(0xEDE7DD), paper], startPoint: .topLeading, endPoint: .bottomTrailing))
            .clipShape(RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(LinearGradient(colors: [.white.opacity(0.65), red.opacity(0.35)], startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 0.7))
            .background(RoundedRectangle(cornerRadius: 9).fill(red).offset(y: 2))
            .overlay(alignment: .top) { bindings.offset(y: -4) }
            .compositingGroup()
            .shadow(color: .black.opacity(0.4), radius: 2, y: 2)
            .accessibilityElement(children: .ignore).accessibilityLabel(part(event.start, "EEEE, d. MMMM yyyy"))
    }
    private func metadata(_ event: H2OWidgetEvent, size: CGFloat, spacing: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: spacing) {
            HStack(spacing: 4) {
                Image(systemName: "clock")
                Text((event.allDay ? "Ganztägig" : part(event.start, "HH:mm")) + (event.location.isEmpty ? "" : " · " + event.location))
            }
            if !event.clothing.isEmpty {
                HStack(spacing: 4) { Image(systemName: "tshirt"); Text(event.clothing) }
            }
        }.font(.system(size: size * min(textScale, 1.5), weight: .semibold))
            .foregroundStyle(secondaryInk).lineLimit(1).minimumScaleFactor(0.85)
    }
    private var reminderVisible: Bool {
        event?.canReply != false && event?.reminded == true && ["open", "maybe"].contains(event?.status ?? "")
    }
    // Decode the existing transparent asset once; the static watermark never requests data.
    private static let crestArtwork: UIImage? = Bundle.main.url(forResource: "h2o-widget-crest-artwork", withExtension: "png")
        .flatMap { UIImage(contentsOfFile: $0.path) }
    private static let crestBorder: UIImage? = Bundle.main.url(forResource: "h2o-widget-crest-border", withExtension: "png")
        .flatMap { UIImage(contentsOfFile: $0.path) }
    @ViewBuilder private func backgroundCrest(width: CGFloat, height: CGFloat) -> some View {
        if event != nil, let artwork = Self.crestArtwork, let border = Self.crestBorder {
            ZStack {
                Image(uiImage: artwork).resizable().scaledToFit()
                Image(uiImage: border).resizable().renderingMode(.template).scaledToFit()
                    .foregroundStyle(edgePalette[2])
            }.frame(width: min(width, height) * 0.98, height: height * 0.98)
                .mask(LinearGradient(stops: [.init(color: .white.opacity(0.25), location: 0), .init(color: .white.opacity(0.6), location: 0.5), .init(color: .white, location: 1)], startPoint: .leading, endPoint: .trailing))
                .compositingGroup()
                .opacity((small || textScale > 1.2) ? 0.16 : 0.25)
                .frame(width: width, height: height, alignment: .trailing)
                .allowsHitTesting(false).accessibilityHidden(true)
        }
    }
    private static let monochromeCrest: UIImage? = Bundle.main.url(forResource: "h2o-symbol-white-512", withExtension: "png")
        .flatMap { UIImage(contentsOfFile: $0.path) }
    @ViewBuilder private func crestSymbol(size: CGFloat) -> some View {
        if let crest = Self.monochromeCrest, #available(iOS 18.0, *) {
            Image(uiImage: crest).renderingMode(.template).resizable()
                .widgetAccentedRenderingMode(.accented)
                .scaledToFit().frame(width: size, height: size).accessibilityHidden(true)
        }
    }
    private var hasForegroundEmblem: Bool { event?.canReply == false || reminderVisible || !fullColor }
    @ViewBuilder private func emblem(size: CGFloat) -> some View {
        if size > 0 && event?.canReply == false {
            Image(systemName: "info.circle").font(.system(size: size * 0.72, weight: .light))
                .foregroundStyle(fullColor ? rgb(0xA4CEE9) : ink)
                .frame(width: size, height: size).accessibilityHidden(true)
        } else if size > 0 && reminderVisible {
            Image(systemName: "exclamationmark.triangle.fill").resizable().scaledToFit()
                .foregroundStyle(fullColor ? signalYellow : ink)
                .frame(width: size, height: size).accessibilityHidden(true)
        } else if size > 0 && !fullColor {
            crestSymbol(size: size * 0.55)
        }
    }
    private func details(_ event: H2OWidgetEvent, titleSize: CGFloat, detailSize: CGFloat, spacing: CGFloat, availableWidth: CGFloat, titleLines: Int = 2) -> some View {
        VStack(alignment: .leading, spacing: spacing) {
            Text(event.title).font(.system(size: titleSize * min(textScale, 1.5), weight: .bold)).lineLimit(titleLines).truncationMode(.tail)
            metadata(event, size: detailSize, spacing: spacing)
        }.frame(width: max(1, availableWidth), alignment: .leading)
    }
    private func largeDetails(_ event: H2OWidgetEvent, width: CGFloat, titleSize: CGFloat, detailSize: CGFloat, logoSize: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(event.title).font(.system(size: titleSize * min(textScale, 1.5), weight: .bold)).lineLimit(2).truncationMode(.tail)
            HStack(spacing: 8) {
                metadata(event, size: detailSize, spacing: 2).frame(maxWidth: .infinity, alignment: .leading)
                emblem(size: !hasForegroundEmblem || textScale > 1.2 ? 0 : logoSize)
            }
        }.frame(width: width, alignment: .leading)
    }
    private func eventCard(_ event: H2OWidgetEvent, width: CGFloat, height: CGFloat) -> some View {
        let available = max(1, width - calendarWidth - (small ? 7 : 11))
        let titleSize: CGFloat = small ? 15 : 20
        let font = UIFont.systemFont(ofSize: titleSize * min(textScale, 1.5), weight: .bold)
        let titleWidth = (event.title as NSString).size(withAttributes: [.font: font]).width
        let logoSize: CGFloat = !hasForegroundEmblem || small || textScale > 1.2 ? 0 : titleWidth <= available - 62 ? 48 : titleWidth <= (available - 38) * 1.7 ? 28 : 0
        return HStack(spacing: small ? 7 : 11) {
            calendar(event)
                .scaleEffect(small || large ? 1 : min(1, max(1, height - 4) / 80))
                .padding(.top, 4)
            if large {
                ViewThatFits(in: .vertical) {
                    largeDetails(event, width: available, titleSize: 26, detailSize: 14, logoSize: 56)
                    largeDetails(event, width: available, titleSize: 22, detailSize: 12, logoSize: 48)
                    largeDetails(event, width: available, titleSize: 18, detailSize: 11, logoSize: 0)
                }
            } else if small {
                ViewThatFits(in: .vertical) {
                    details(event, titleSize: titleSize, detailSize: small ? 10 : 12, spacing: 2, availableWidth: available - (logoSize > 0 ? logoSize + 11 : 0))
                    details(event, titleSize: small ? 13 : 17, detailSize: small ? 9 : 11, spacing: 1, availableWidth: available - (logoSize > 0 ? logoSize + 11 : 0))
                }
                emblem(size: logoSize)
            } else {
                let scale = min(textScale, 1.5)
                let textWidth = available - (logoSize > 0 ? logoSize + 11 : 0)
                let lines = titleWidth > textWidth && height >= 60 ? 2 : 1
                let metadataRows: CGFloat = event.clothing.isEmpty ? 1 : 2
                let titleHeight = font.lineHeight * CGFloat(lines)
                let detailHeight = UIFont.systemFont(ofSize: 12 * scale, weight: .semibold).lineHeight * metadataRows
                let fit = min(1, max(1, height - 2 * metadataRows) / (titleHeight + detailHeight))
                details(event, titleSize: titleSize * fit, detailSize: 12 * fit, spacing: 2, availableWidth: textWidth, titleLines: lines)
                    .fixedSize(horizontal: false, vertical: true)
                emblem(size: logoSize)
            }
        }
    }
    @ViewBuilder private var statusLine: some View {
        if fullColor {
            responseLight
        } else {
            Rectangle().fill(ink.opacity(0.22)).frame(height: 1).accessibilityHidden(true)
        }
    }

    private var responseLight: some View {
        let status = snapshot?.replyLightStatus ?? "open"
        let pending = job?.phase == "saving"
        let center: CGFloat = status == "yes" ? 1.0 / 6 : status == "maybe" ? 5.0 / 6 : 0.5
        let tint = color(status)
        return GeometryReader { _ in
            Capsule().fill(LinearGradient(stops: [
                .init(color: secondaryInk.opacity(0.15), location: 0),
                .init(color: tint.opacity(0.35), location: max(0.01, center - 0.15)),
                .init(color: highlight(status), location: center),
                .init(color: tint.opacity(0.35), location: min(0.99, center + 0.15)),
                .init(color: secondaryInk.opacity(0.15), location: 1)
            ], startPoint: .leading, endPoint: .trailing))
                .opacity(pending ? 0.6 : 1)
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.55), value: status)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.15), value: pending)
        }.frame(height: 1).accessibilityHidden(true)
    }

    private func buttonFill(_ status: String) -> LinearGradient {
        let shades: [Color]
        switch status {
        case "yes": shades = [rgb(0x53A06A), rgb(0x287D49), rgb(0x19562F)]
        case "excused": shades = [rgb(0xFFE38B), rgb(0xFFCB2F), rgb(0xE8A300)]
        default: shades = [rgb(0xFFB974), rgb(0xF18A2C), rgb(0xC65A0B)]
        }
        return LinearGradient(stops: [.init(color: shades[0], location: 0), .init(color: shades[1], location: 0.58), .init(color: shades[2], location: 1)], startPoint: .top, endPoint: .bottom)
    }
    private func choice(_ status: String) -> some View {
        let selected = event?.status == status
        let pending = job?.phase == "saving" && job?.status == status
        return Button(intent: H2OWidgetReplyIntent(eventID: event?.id ?? "", response: status)) {
            HStack(spacing: 4) {
                Image(systemName: selected && fullColor ? "checkmark" : replySymbol(selected ? status : "open")).font(.system(size: 12, weight: .semibold))
                Text(title(status)).font(.system(size: 13 * min(textScale, 1.2), weight: selected ? .bold : .semibold)).lineLimit(1).minimumScaleFactor(0.75)
            }.frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
                .foregroundStyle(selected ? (fullColor && status != "yes" ? Color(red: 45.0 / 255, green: 33.0 / 255, blue: 10.0 / 255) : ink) : secondaryInk)
                .background {
                    if selected && fullColor {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(buttonFill(status))
                            .overlay(alignment: .top) {
                                RoundedRectangle(cornerRadius: 9).fill(LinearGradient(colors: [.white.opacity(0.22), .clear], startPoint: .top, endPoint: .bottom)).frame(height: 14).padding(1)
                            }
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(LinearGradient(colors: [.white.opacity(0.95), highlight(status).opacity(0.55), .black.opacity(0.45)], startPoint: .top, endPoint: .bottom), lineWidth: 0.9))
                            .compositingGroup().shadow(color: .black.opacity(0.65), radius: 2, y: 2.5)
                            .padding(1)
                    } else if selected {
                        RoundedRectangle(cornerRadius: 10).strokeBorder(ink, lineWidth: 1.5).padding(2)
                    }
                }
        }.buttonStyle(StableWidgetReplyStyle()).disabled(!canReply || job != nil)
            .accessibilityLabel(title(status)).accessibilityValue(selected ? "Ausgewählt" : pending ? "Wird gespeichert" : "")
    }
    private func replySymbol(_ status: String) -> String {
        switch status {
        case "yes": return "checkmark.circle.fill"
        case "excused": return "xmark.circle.fill"
        case "maybe": return "questionmark.circle.fill"
        default: return "circle"
        }
    }
    private struct H2OWidgetSelectorSurface: ViewModifier {
        let fullColor: Bool

        private func rgb(_ hex: UInt32) -> Color {
            Color(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
        }
        @ViewBuilder func body(content: Content) -> some View {
            if fullColor {
                content.background(LinearGradient(colors: [rgb(0x406B83), rgb(0x183B51), rgb(0x092438)], startPoint: .top, endPoint: .bottom), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11).stroke(LinearGradient(colors: [rgb(0xD2EDF7).opacity(0.95), rgb(0x4C758E).opacity(0.45), .black.opacity(0.7)], startPoint: .top, endPoint: .bottom), lineWidth: 1))
                    .compositingGroup().shadow(color: .black.opacity(0.55), radius: 2, y: 2.5)
            } else {
                content.overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(Color.primary.opacity(0.5), lineWidth: 1))
            }
        }
    }
    @ViewBuilder private var replyControls: some View {
        if event?.canReply == false {
            Link(destination: destination) {
                Label("Nur zur Information", systemImage: "eye")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(secondaryInk)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .modifier(H2OWidgetSelectorSurface(fullColor: fullColor))
            }.buttonStyle(.plain)
        } else if let message = snapshot?.message {
            Link(destination: destination) {
                Text(message).font(.system(size: 11, weight: .medium))
                    .foregroundStyle(fullColor ? Color.accentColor : ink)
            }
                .frame(maxWidth: .infinity, minHeight: 44)
        } else if job?.phase == "retry" {
            Button(intent: H2OWidgetReplyIntent(eventID: event?.id ?? "", response: "retry")) {
                Label("Erneut versuchen", systemImage: "arrow.clockwise")
                    .font(.system(size: 12, weight: .semibold)).foregroundStyle(ink).frame(maxWidth: .infinity, minHeight: 44)
            }.buttonStyle(.plain).background(ink.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
        } else {
            HStack(spacing: 0) {
                choice("yes")
                choice("excused")
                choice("maybe")
            }.modifier(H2OWidgetSelectorSurface(fullColor: fullColor))

        }
    }
    private var feedback: some View {
        let unanswered = job == nil && snapshot?.message == nil && ["open", "maybe"].contains(event?.status ?? "") && (event?.status == "open" || event?.reminded == true) && event?.canReply != false
        let textColor = unanswered ? noticeInk : secondaryInk
        return HStack(spacing: 4) {
            if let text = snapshot?.feedback(appUpdateAvailable: entry.appUpdateAvailable),
               event?.canReply != false || text != "Nur zur Information" {
                Image(systemName: snapshot?.notice != nil || snapshot?.stale == true || (snapshot?.replyFeedback == nil && entry.appUpdateAvailable) ? "arrow.clockwise" : job != nil || snapshot?.message != nil ? "exclamationmark.circle" : "circle")
                    .foregroundStyle(textColor)
                Text(text).fontWeight(.semibold).foregroundStyle(textColor)
            }
            Spacer(minLength: 0)
        }.font(.system(size: large ? 12 : 11)).lineLimit(1).minimumScaleFactor(0.8)
            .frame(height: large ? 15 : 14).contentTransition(.identity)
    }
    private var compactStatus: some View {
        Link(destination: destination) {
            HStack(spacing: 4) {
                if event?.canReply == false {
                    Image(systemName: "eye").foregroundStyle(secondaryInk)
                } else if fullColor {
                    Circle().stroke(color(event?.status ?? "open"), lineWidth: 1.5).frame(width: 11, height: 11)
                } else {
                    Image(systemName: replySymbol(event?.status ?? "open")).foregroundStyle(ink)
                }
                Text(event?.canReply == false ? "Nur zur Information" : ((event?.reminded == true && ["open", "maybe"].contains(event?.status ?? "")) ? "Erinnerung · " : "") + title(event?.status ?? "open")).fontWeight(.semibold)
                    .foregroundStyle(job == nil && event?.status == "open" && event?.canReply != false ? noticeInk : ink)
                Spacer(minLength: 0)
                if fullColor || snapshot?.stale == true {
                    Image(systemName: snapshot?.stale == true ? "exclamationmark.triangle" : "chevron.down").font(.system(size: 8)).foregroundStyle(secondaryInk)
                } else {
                    crestSymbol(size: 12)
                }
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
                    Link(destination: destination) { eventCard(event, width: width, height: eventHeight) }.buttonStyle(.plain)
                        .frame(width: width, height: eventHeight, alignment: .center)
                        .clipped()
                    Color.clear.frame(height: 0.5)
                    if small { compactStatus }
                    else {
                        // Reserve the complete response area before laying out enlarged
                        // event text. Intrinsic text height must not cover its targets.
                        VStack(alignment: .leading, spacing: large ? 5 : 3) {
                            if large { Text(event.canReply == false ? "Information" : "Deine Rückmeldung").font(.system(size: 12, weight: .semibold)).foregroundStyle(secondaryInk) }
                            replyControls.contentTransition(.identity)
                                .frame(height: 44)
                            statusLine
                            feedback
                        }.fixedSize(horizontal: false, vertical: true).layoutPriority(1)
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
                    if fullColor {
                        ZStack {
                            LinearGradient(stops: [.init(color: edgePalette[0], location: 0), .init(color: edgePalette[1], location: 0.08), .init(color: edgePalette[1], location: 1)], startPoint: .top, endPoint: .bottom)
                            LinearGradient(stops: [.init(color: background.opacity(0), location: 0), .init(color: background, location: 0.24), .init(color: rgb(0x072436), location: 1)], startPoint: .top, endPoint: .bottom)
                            backgroundCrest(width: geometry.size.width, height: geometry.size.height)
                        }.animation(reduceMotion ? nil : .easeInOut(duration: 0.55), value: edgeStatus)
                    }
                }
                .overlay {
                    if fullColor {
                        RoundedRectangle(cornerRadius: 22).stroke(LinearGradient(stops: [.init(color: edgePalette[2].opacity(0.55), location: 0), .init(color: rgb(0x4A748D).opacity(0.7), location: 0.28), .init(color: rgb(0x030B12), location: 1)], startPoint: .top, endPoint: .bottom), lineWidth: 1)
                            .animation(reduceMotion ? nil : .easeInOut(duration: 0.55), value: edgeStatus)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 22))
        }.id(family)
            .contentTransition(.identity)
            .foregroundStyle(ink).containerBackground(background, for: .widget)
            .widgetURL(destination).environment(\.locale, Locale(identifier: "de_DE"))
            .environment(\.timeZone, TimeZone(identifier: "Europe/Berlin")!)
    }
}
#endif
