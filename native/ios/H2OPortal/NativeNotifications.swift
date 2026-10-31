import UIKit
import UserNotifications
import WebKit

@MainActor enum NativeNotifications {
    private static var token: String?
    private static var waiting: [(WKWebView, String)] = []

    static func handle(_ body: Any, web: WKWebView) {
        guard let data = body as? [String: String], let id = data["id"],
              id.range(of: "^[a-f0-9-]{36}$", options: .regularExpression) != nil,
              let action = data["action"], ["status", "request"].contains(action) else { return }
        let center = UNUserNotificationCenter.current()
        center.getNotificationSettings { settings in
            Task { @MainActor in
                if action == "request" && settings.authorizationStatus == .notDetermined {
                    center.requestAuthorization(options: [.alert, .sound, .badge]) { allowed, _ in
                        Task { @MainActor in
                            if allowed { register(web: web, id: id) }
                            else { respond(web: web, id: id, permission: "denied") }
                        }
                    }
                } else if [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) {
                    register(web: web, id: id)
                } else {
                    respond(web: web, id: id, permission: settings.authorizationStatus == .denied ? "denied" : "default")
                }
            }
        }
    }
    private static func register(web: WKWebView, id: String) {
        if let token { respond(web: web, id: id, permission: "granted", deviceToken: token); return }
        waiting.append((web, id))
        UIApplication.shared.registerForRemoteNotifications()
    }
    static func registered(_ data: Data) {
        token = data.map { String(format: "%02x", $0) }.joined()
        let jobs = waiting; waiting.removeAll()
        for (web, id) in jobs { respond(web: web, id: id, permission: "granted", deviceToken: token) }
    }
    static func failed() {
        let jobs = waiting; waiting.removeAll()
        for (web, id) in jobs { respond(web: web, id: id, permission: "unavailable") }
    }
    private static func respond(web: WKWebView, id: String, permission: String, deviceToken: String? = nil) {
        guard let url = web.url, PortalLinks.trusted(url) else { return }
        var value = ["id": id, "permission": permission]
        if let deviceToken { value["deviceToken"] = deviceToken }
        guard let data = try? JSONSerialization.data(withJSONObject: value),
              let json = String(data: data, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('h2o-native-notifications', {detail: \(json)}))")
    }
}

final class PortalAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in NativeNotifications.registered(deviceToken) }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in NativeNotifications.failed() }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completion: @escaping () -> Void) {
        Task { @MainActor in UIApplication.shared.open(URL(string: "h2oportal://termine")!); completion() }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completion: @escaping (UNNotificationPresentationOptions) -> Void) {
        completion([.banner, .sound])
    }
}
