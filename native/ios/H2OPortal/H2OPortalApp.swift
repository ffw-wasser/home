import SwiftUI
import WebKit
import UserNotifications

@main
struct H2OPortalApp: App {
    var body: some Scene { WindowGroup { PortalScreen() } }
}

@MainActor final class PortalModel: ObservableObject {
    @Published var message = ""
    let web: WKWebView
    private(set) var hasOpened = false
    init() {
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
    @State private var scan = false
    @State private var help = false
    @State private var reminder = false
    @State private var time = Date()
    var body: some View {
        VStack(spacing: 0) {
            ViewThatFits(in: .horizontal) {
                toolButtons
                toolButtons.labelStyle(.iconOnly)
            }.buttonStyle(.borderless).padding(.horizontal).tint(Color(red: 0.54, green: 0.14, blue: 0.24))
            if !model.message.isEmpty { Text(model.message).font(.callout).padding().frame(maxWidth: .infinity, alignment: .leading).background(Color.yellow.opacity(0.15)) }
            PortalWebView(model: model)
        }
        .onAppear { if !model.hasOpened && ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] == nil { model.open(PortalLinks.home) } }
        .onOpenURL { model.open($0) }
        .onChange(of: scenePhase) { _, phase in if phase == .background { scan = false } }
        .sheet(isPresented: $scan) {
            ScannerView { value in
                scan = false
                if let url = URL(string: value), PortalLinks.invitation(url) { model.open(url) }
                else { model.message = "Bitte den einmaligen Einladungs-QR der Feuerwehrverwaltung scannen." }
            }.ignoresSafeArea().overlay(alignment: .topTrailing) { Button("Schließen") { scan = false }.padding().background(.regularMaterial) }
        }
        .sheet(isPresented: $help) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Dein Einstieg").font(.title2.bold())
                        Text("1. Bei der Verwaltung eine persönliche Einladung holen.\n2. Oben QR wählen und den QR-Code scannen.\n3. Den Passkey auf deinem eigenen Handy einrichten.")
                        Text("Termine, Status und Mein Deckel bleiben im H₂O Portal. Die Anmeldung aus Safari wird nicht automatisch übernommen. Bei Geräteverlust hilft die Verwaltung.")
                        Text("Diese Hilfe ist auch ohne Internet verfügbar. Server-Push ist in dieser Entwicklungsversion noch nicht eingerichtet. Die freiwillige tägliche App-Erinnerung funktioniert unabhängig davon.")
                        Button("Portal erneut laden") { model.web.reload(); help = false }
                        Link("Portal in Safari öffnen", destination: PortalLinks.home)
                    }.padding()
                }.navigationTitle("H₂O · Hilfe").toolbar { Button("Schließen") { help = false } }
            }
        }
        .sheet(isPresented: $reminder) {
            NavigationStack {
                Form {
                    Text("Eine allgemeine tägliche Erinnerung, das Portal zu prüfen. Keine automatische Erinnerung an einzelne Termine.")
                    DatePicker("Uhrzeit", selection: $time, displayedComponents: .hourAndMinute)
                    Button("Erinnerung einschalten") { Task { await enableReminder() } }
                    Button("Erinnerung ausschalten", role: .destructive) { UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["h2o-reminder"]); model.message = "App-Erinnerung ausgeschaltet."; reminder = false }
                }.navigationTitle("App-Erinnerung").toolbar { Button("Schließen") { reminder = false } }
            }
        }
    }
    private var toolButtons: some View {
        HStack {
            Button("Einladung scannen", systemImage: "qrcode.viewfinder") { scan = true }.frame(minWidth: 44, minHeight: 44)
            Spacer()
            Button("Erinnerung", systemImage: "bell") { reminder = true }.frame(minWidth: 44, minHeight: 44)
            Spacer()
            Button("Hilfe", systemImage: "questionmark.circle") { help = true }.frame(minWidth: 44, minHeight: 44)
        }
    }
    @MainActor private func enableReminder() async {
        do {
            let center = UNUserNotificationCenter.current()
            guard try await center.requestAuthorization(options: [.alert, .sound]) else { model.message = "Mitteilungen sind nicht freigegeben. Die App bleibt nutzbar."; reminder = false; return }
            let content = UNMutableNotificationContent(); content.title = "H₂O Portal"; content.body = "Prüfe deine Termine und Rückmeldungen im H₂O Portal."; content.sound = .default
            let clock = Calendar.current.dateComponents([.hour, .minute], from: time)
            try await center.add(UNNotificationRequest(identifier: "h2o-reminder", content: content, trigger: UNCalendarNotificationTrigger(dateMatching: clock, repeats: true)))
            model.message = "Tägliche App-Erinnerung eingerichtet."; reminder = false
        } catch { model.message = "Die App-Erinnerung konnte nicht gespeichert werden. Bitte erneut versuchen." }
    }
}
