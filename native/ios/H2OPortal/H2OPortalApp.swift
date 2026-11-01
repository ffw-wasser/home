import SwiftUI
import WebKit
import UserNotifications

@main
struct H2OPortalApp: App {
    @UIApplicationDelegateAdaptor(PortalAppDelegate.self) private var appDelegate
    var body: some Scene { WindowGroup { PortalScreen() } }
}

@MainActor final class PortalModel: ObservableObject {
    @Published var message = ""
    @Published var reviewRequested = false
    let web: WKWebView
    private(set) var hasOpened = false
    let review: Bool
    init(review: Bool = false) {
        self.review = review
        // Retire only the optional daily reminder from earlier app builds.
        let notifications = UNUserNotificationCenter.current()
        notifications.removePendingNotificationRequests(withIdentifiers: ["h2o-reminder"])
        notifications.removeDeliveredNotifications(withIdentifiers: ["h2o-reminder"])
        // Require a fresh authenticated response after a build or session switch.
        H2OWidgetBridge.accept(["action": "clear"])
        let config = WKWebViewConfiguration()
        config.websiteDataStore = review ? .nonPersistent() : .default()
        config.applicationNameForUserAgent = "H2ONative/1 iOS H2OReviewHelp/1"
        web = WKWebView(frame: .zero, configuration: config)
        web.allowsBackForwardNavigationGestures = true
        web.isInspectable = false
    }
    func open(_ url: URL) {
        guard (review ? PortalLinks.isReview(url) : !PortalLinks.isReview(url)),
              let destination = PortalLinks.destination(url), !(url.fragment?.hasPrefix("setup=") == true) || PortalLinks.setupLink(url) else { message = "Dieser Link gehört nicht zum Mitgliederportal."; return }
        hasOpened = true
        web.load(URLRequest(url: destination))
    }
    func requestReview(from source: URL, to destination: URL, mainFrame: Bool, userInitiated: Bool) -> Bool {
        guard !review, mainFrame, userInitiated, PortalLinks.trusted(source),
              !PortalLinks.isReview(source), PortalLinks.isReview(destination) else { return false }
        reviewRequested = true
        return true
    }
}

struct PortalScreen: View {
    @State private var review = false
    @State private var confirmSwitch = false
    var body: some View {
        VStack(spacing: 0) {
            PortalContent(review: review, onReviewRequested: { confirmSwitch = true }).id(review)
            if review {
            Button("Demo verlassen · Mitgliederanmeldung") { confirmSwitch = true }
                .font(.caption).padding(8).frame(maxWidth: .infinity)
                .background(Color(red: 16.0 / 255, green: 28.0 / 255, blue: 44.0 / 255))
                .foregroundStyle(.white)
            }
        }
        .confirmationDialog("Ansicht wechseln? Ungespeicherte Eingaben in der aktuellen Ansicht werden verworfen.", isPresented: $confirmSwitch, titleVisibility: .visible) {
            Button(review ? "Zur Mitgliederanmeldung" : "Prüfdemo öffnen") { review.toggle() }
            Button("Abbrechen", role: .cancel) {}
        }
    }
}

struct PortalContent: View {
    @StateObject private var model: PortalModel
    private let onReviewRequested: () -> Void
    init(review: Bool, onReviewRequested: @escaping () -> Void) {
        _model = StateObject(wrappedValue: PortalModel(review: review))
        self.onReviewRequested = onReviewRequested
    }
    var body: some View {
        VStack(spacing: 0) {
            if !model.message.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text(model.message).font(.callout)
                    HStack {
                        Button("Erneut laden") { model.open(model.web.url.flatMap { PortalLinks.trusted($0) ? $0 : nil } ?? (model.review ? PortalLinks.review : PortalLinks.home)) }
                        Spacer()
                        Button("Schließen") { model.message = "" }
                    }
                }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.yellow.opacity(0.15))
            }
            PortalWebView(model: model)
        }
        .onChange(of: model.reviewRequested) { requested in
            if requested { model.reviewRequested = false; onReviewRequested() }
        }
        // Continue the app background behind the iPhone home indicator.
        .background(Color(red: 16.0 / 255, green: 28.0 / 255, blue: 44.0 / 255).ignoresSafeArea(.container, edges: .bottom))
        .onAppear {
            // Snapshot/unit-test hosts must not contact the production portal.
            if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil && !model.hasOpened { model.open(model.review ? PortalLinks.review : PortalLinks.home) }
        }
        .onOpenURL { url in
            if PortalLinks.isWidgetTermine(url) {
                if model.hasOpened, !model.web.isLoading, model.web.url?.path == PortalLinks.home.path, model.web.url.map(PortalLinks.trusted) == true {
                    model.web.evaluateJavaScript("window.DeckelMobile?.jump('portal-section')")
                } else {
                    model.open(model.review ? PortalLinks.review : PortalLinks.terms)
                }
            } else { model.open(url) }
        }

    }
}
