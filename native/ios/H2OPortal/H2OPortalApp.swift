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
    @Published var showScanner = false
    let web: WKWebView
    private(set) var hasOpened = false
    init() {
        // Retire only the optional daily reminder from earlier app builds.
        let notifications = UNUserNotificationCenter.current()
        notifications.removePendingNotificationRequests(withIdentifiers: ["h2o-reminder"])
        notifications.removeDeliveredNotifications(withIdentifiers: ["h2o-reminder"])
        // Require a fresh authenticated response after a build or session switch.
        H2OWidgetBridge.accept(["action": "clear"])
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.applicationNameForUserAgent = "H2ONative/1 iOS"
        web = WKWebView(frame: .zero, configuration: config)
        web.allowsBackForwardNavigationGestures = true
        web.isInspectable = false
    }
    func open(_ url: URL) {
        guard PortalLinks.trusted(url) else { message = "Dieser Link gehört nicht zum Mitgliederportal."; return }
        hasOpened = true
        web.load(URLRequest(url: url))
    }
}

struct PortalScreen: View {
    @StateObject private var model = PortalModel()
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        VStack(spacing: 0) {
            if !model.message.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text(model.message).font(.callout)
                    HStack {
                        Button("Erneut laden") { model.open(model.web.url.flatMap { PortalLinks.trusted($0) ? $0 : nil } ?? PortalLinks.home) }
                        Spacer()
                        Button("Schließen") { model.message = "" }
                    }
                }.padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.yellow.opacity(0.15))
            }
            PortalWebView(model: model)
        }
        // Continue the navy footer behind the iPhone home indicator.
        .background(Color(red: 16.0 / 255, green: 28.0 / 255, blue: 44.0 / 255).ignoresSafeArea(.container, edges: .bottom))
        .onAppear {
            // Snapshot/unit-test hosts must not contact the production portal.
            if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil && !model.hasOpened { model.open(PortalLinks.home) }
        }
        .onOpenURL { url in
            if PortalLinks.isWidgetTermine(url) {
                if model.hasOpened, !model.web.isLoading, model.web.url.map(PortalLinks.trusted) == true {
                    model.web.evaluateJavaScript("window.DeckelMobile?.jump('portal-section')")
                } else {
                    model.open(PortalLinks.terms)
                }
            } else { model.open(url) }
        }
        .onChange(of: scenePhase) { _, phase in if phase == .background { model.showScanner = false } }
        .sheet(isPresented: $model.showScanner) {
            ScannerView { value in
                model.showScanner = false
                if let url = URL(string: value), PortalLinks.invitation(url) { model.open(url) }
                else { model.message = "Bitte den einmaligen Einladungs-QR der Feuerwehrverwaltung scannen." }
            }.ignoresSafeArea().overlay(alignment: .topTrailing) { Button("Schließen") { model.showScanner = false }.padding().background(.regularMaterial) }
        }
    }
}
