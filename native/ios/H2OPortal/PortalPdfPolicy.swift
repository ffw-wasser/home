import Foundation

enum PortalPdfPolicy {
    static let maximumBytes = 10 * 1024 * 1024
    static let maximumEncoded = ((maximumBytes + 2) / 3) * 4
    static func decode(name: String, mime: String, encoded: String) -> Data? {
        guard name.range(of: "^[A-Za-z0-9][A-Za-z0-9._ -]{0,123}\\.[pP][dD][fF]$", options: .regularExpression) != nil,
              mime == "application/pdf", encoded.utf8.count <= maximumEncoded,
              let data = Data(base64Encoded: encoded), data.count <= maximumBytes,
              data.prefix(5) == Data("%PDF-".utf8) else { return nil }
        return data
    }
}
