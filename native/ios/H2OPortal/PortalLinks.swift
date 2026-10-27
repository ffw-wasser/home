import Foundation

enum PortalLinks {
    static let home = URL(string: "https://ffw-wasser.github.io/home/deckel.html")!
    static func trusted(_ url: URL) -> Bool {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return parts.scheme == "https" && parts.host == "ffw-wasser.github.io" && parts.port == nil &&
            parts.user == nil && parts.password == nil && ["/home/deckel.html", "/home/termin.html"].contains(parts.percentEncodedPath)
    }
    static func invitation(_ url: URL) -> Bool {
        guard trusted(url), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false), parts.percentEncodedPath == "/home/deckel.html", parts.query == nil, let fragment = parts.percentEncodedFragment else { return false }
        return fragment.range(of: "^setup=[A-Za-z0-9_-]{16,128}$", options: .regularExpression) != nil
    }
}
