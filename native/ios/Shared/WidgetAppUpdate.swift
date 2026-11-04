import Foundation

// Release metadata has no member data. Only confirmed, installable TestFlight builds
// are entered here; uploading an archive must never announce an available update.
struct H2OWidgetAppRelease: Codable {
    let build: Int
    let availableUntil: Date
    func isNewer(than installed: Int, at now: Date) -> Bool {
        installed > 0 && build > installed && availableUntil > now
    }
}
struct H2OWidgetAppReleases: Decodable {
    let schema: Int
    let iosTestFlight: H2OWidgetAppRelease?
    static func parse(_ data: Data) -> H2OWidgetAppReleases? {
        guard data.count <= 4096 else { return nil }
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        guard let value = try? decoder.decode(Self.self, from: data), value.schema == 1 else { return nil }
        return value
    }
}

#if os(iOS)
// The timeline provider checks one fixed public URL, never the portal login/session.
enum H2OWidgetAppUpdate {
    private static let endpoint = URL(string: "https://ffw-wasser.github.io/home/native/store/widget-updates.json")!
    private static var preferences: UserDefaults? { UserDefaults(suiteName: H2OWidgetStorage.suite) }
    static func available(at now: Date = Date()) -> Bool {
        guard let preferences,
              let checked = preferences.object(forKey: "nativeUpdateCheckedAt") as? Date,
              (0..<86400).contains(now.timeIntervalSince(checked)),
              let data = preferences.data(forKey: "nativeUpdateRelease"),
              let release = H2OWidgetAppReleases.parse(data)?.iosTestFlight,
              let installed = Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "")
        else { return false }
        return release.isNewer(than: installed, at: now)
    }
    static func refresh() async {
        let now = Date()
        if let checked = preferences?.object(forKey: "nativeUpdateCheckedAt") as? Date,
           (0..<3600).contains(now.timeIntervalSince(checked)) { return }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.urlCredentialStorage = nil
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 5
        configuration.timeoutIntervalForResource = 5
        let session = URLSession(configuration: configuration, delegate: NoUpdateRedirect(), delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        do {
            let (data, response) = try await session.data(from: endpoint)
            guard let response = response as? HTTPURLResponse, response.statusCode == 200,
                  response.url == endpoint, H2OWidgetAppReleases.parse(data) != nil else { return }
            preferences?.set(data, forKey: "nativeUpdateRelease")
            preferences?.set(now, forKey: "nativeUpdateCheckedAt")
        } catch { /* Offline never becomes a reply error or extends calendar freshness. */ }
    }
    private final class NoUpdateRedirect: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(nil)
        }
    }
}
#endif
