import Foundation

// Shared between the signed-in iOS app and its WidgetKit extension.
// Never store capability tokens, passkeys, member IDs, or calendar URLs here.
enum H2OWidgetStorage {
    static let suite = "group.de.feuerwehrwasser.h2o"
    static let key = "h2o.widget.snapshot.v1"
    static let maxAge: TimeInterval = 12 * 60 * 60

    static func read(now: Date = Date()) -> H2OWidgetSnapshot? {
        guard let data = UserDefaults(suiteName: suite)?.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(H2OWidgetSnapshot.self, from: data),
              snapshot.updatedAt <= now.addingTimeInterval(60),
              now.timeIntervalSince(snapshot.updatedAt) < maxAge else { return nil }
        return snapshot
    }
}

struct H2OWidgetEvent: Codable, Equatable {
    let title: String
    let start: Date
    let end: Date
    let location: String
    let clothing: String
    let status: String
    let allDay: Bool
}

struct H2OWidgetSnapshot: Codable, Equatable {
    let updatedAt: Date
    let event: H2OWidgetEvent?
    let stale: Bool
}
