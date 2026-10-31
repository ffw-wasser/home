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
    static func trusted(_ url: URL) -> Bool {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return parts.scheme == "https" && parts.host == host && parts.port == nil &&
            parts.user == nil && parts.password == nil && ["/home/deckel.html", "/home/termin.html"].contains(parts.percentEncodedPath)
    }
    // A widget opens the signed native container, never a website or token-bearing URL.
    static func isWidgetTermine(_ url: URL) -> Bool {
        guard let p = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return p.scheme == "h2oportal" && p.host == "termine" && p.path.isEmpty &&
            p.user == nil && p.password == nil && p.port == nil && p.query == nil && p.fragment == nil
    }
    static var terms: URL {
        var parts = URLComponents(url: home, resolvingAgainstBaseURL: false)!
        parts.queryItems = [URLQueryItem(name: "nativePage", value: "terms")]
        return parts.url!
    }
    static func invitation(_ url: URL) -> Bool {
        guard trusted(url), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false), parts.percentEncodedPath == "/home/deckel.html", parts.query == nil, let fragment = parts.percentEncodedFragment else { return false }
        return fragment.range(of: "^setup=[A-Za-z0-9_-]{16,128}$", options: .regularExpression) != nil
    }
}
