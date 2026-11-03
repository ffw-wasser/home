import Foundation

enum PortalLinks {
    // Review builds must be explicitly compiled with a separate, isolated demo host.
    // Production remains pinned to the original GitHub Pages origin.
    #if H2O_APP_REVIEW
    static let home = URL(string: "https://h2o-apple-review.522dn4fc5f.workers.dev/home/deckel.html")!
    static let host = "h2o-apple-review.522dn4fc5f.workers.dev"
    #else
    static let home = URL(string: "https://ffw-wasser.github.io/home/deckel.html")!
    static let host = "ffw-wasser.github.io"
    #endif
    static let privacy = URL(string: "https://ffw-wasser.github.io/home/privacy.html")!
    static func isPublicPrivacy(_ url: URL) -> Bool { url.absoluteString == privacy.absoluteString }
    static let review = URL(string: "https://ffw-wasser.github.io/home/review.html")!
    static func isReview(_ url: URL) -> Bool { url.absoluteString == review.absoluteString }

    static func trusted(_ url: URL) -> Bool {
        if isReview(url) { return true }
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return parts.scheme == "https" && parts.host == host && parts.port == nil &&
            parts.user == nil && parts.password == nil && ["/home/deckel.html", "/home/termin.html"].contains(parts.percentEncodedPath)
    }
    // Calendar response links use a standalone browser page. Inside the native
    // container keep full portal navigation and its authenticated widget bridge.
    static func destination(_ url: URL) -> URL? {
        guard trusted(url) else { return nil }
        guard url.path == "/home/termin.html" else { return url }
        var parts = URLComponents(url: terms, resolvingAgainstBaseURL: false)!
        if let event = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "event" })?.value,
           event.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil {
            parts.queryItems?.append(URLQueryItem(name: "event", value: event))
        }
        return parts.url
    }

    // A widget opens the signed native container, never a website or token-bearing URL.
    static func isWidgetTermine(_ url: URL) -> Bool {
        guard let p = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return p.scheme == "h2oportal" && p.host == "termine" && p.path.isEmpty &&
            p.user == nil && p.password == nil && p.port == nil && p.fragment == nil &&
            (p.query == nil || (p.queryItems?.count == 1 && p.queryItems?.first?.name == "event" && widgetEvent(url) != nil))
    }
    static func widgetEvent(_ url: URL) -> String? {
        let value = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "event" })?.value
        return value.flatMap { $0.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil ? $0 : nil }
    }
    static func terms(event: String?) -> URL {
        var parts = URLComponents(url: terms, resolvingAgainstBaseURL: false)!
        if let event { parts.queryItems?.append(URLQueryItem(name: "event", value: event)) }
        return parts.url!
    }
    static var terms: URL {
        var parts = URLComponents(url: home, resolvingAgainstBaseURL: false)!
        parts.queryItems = [URLQueryItem(name: "nativePage", value: "terms")]
        return parts.url!
    }
    // Accept only a deliberate day link from the real member page, without URL extras.
    static func calendarDay(from source: URL, to destination: URL, mainFrame: Bool, userInitiated: Bool) -> Date? {
        guard mainFrame, userInitiated, source.host == "ffw-wasser.github.io", trusted(source), !isReview(source),
              destination.absoluteString.range(of: "^calshow:[0-9]{1,11}$", options: .regularExpression) != nil,
              let seconds = TimeInterval(destination.absoluteString.dropFirst("calshow:".count)),
              (0...31525372800).contains(seconds) else { return nil }
        return Date(timeIntervalSinceReferenceDate: seconds)
    }
    static func calendarDayFallback(_ date: Date) -> URL {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "Europe/Berlin")
        formatter.dateFormat = "yyyy/MM/dd"
        return URL(string: "https://calendar.google.com/calendar/u/0/r/day/" + formatter.string(from: date))!
    }
    static func calendarSubscription(_ url: URL) -> Bool {
        guard let p = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return p.scheme == "webcal" && p.host == "feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev" &&
            p.port == nil && p.user == nil && p.password == nil && p.query == nil && p.fragment == nil &&
            p.percentEncodedPath.range(of: "^/calendar/member/[A-Za-z0-9_-]{43}\\.ics$", options: .regularExpression) != nil
    }
    static func setupLink(_ url: URL) -> Bool {
        guard trusted(url), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false), parts.percentEncodedPath == "/home/deckel.html", parts.query == nil, let fragment = parts.percentEncodedFragment else { return false }
        return fragment.range(of: "^setup=[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil
    }
}
