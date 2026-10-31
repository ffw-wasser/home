import Foundation

// Shared between the signed-in iOS app and its WidgetKit extension.
// Never store capability tokens, passkeys, member IDs, or calendar URLs here.
enum H2OWidgetStorage {
    static let suite = "group.de.feuerwehrwasser.h2o"
    static let key = "h2o.widget.snapshot.v1"
    static let maxAge: TimeInterval = 12 * 60 * 60

    static func timeline(snapshot: H2OWidgetSnapshot?, now: Date) -> [H2OWidgetState] {
        guard let snapshot,
              snapshot.updatedAt <= now.addingTimeInterval(60),
              now.timeIntervalSince(snapshot.updatedAt) < maxAge else {
            return [H2OWidgetState(date: now, snapshot: nil)]
        }
        let expiry = snapshot.updatedAt.addingTimeInterval(maxAge)
        let active = snapshot.event.map { $0.end > now } ?? false
        let current = active ? snapshot : H2OWidgetSnapshot(updatedAt: snapshot.updatedAt, event: nil, stale: snapshot.stale)
        var states = [H2OWidgetState(date: now, snapshot: current)]
        if let event = snapshot.event, active, event.end < expiry {
            states.append(H2OWidgetState(date: event.end, snapshot: H2OWidgetSnapshot(updatedAt: snapshot.updatedAt, event: nil, stale: snapshot.stale)))
        }
        // Empty calendars must expire too: an old empty result is not a fresh check.
        states.append(H2OWidgetState(date: expiry, snapshot: nil))
        return states
    }

    static func read(now: Date = Date()) -> H2OWidgetSnapshot? {
        guard let data = UserDefaults(suiteName: suite)?.data(forKey: key),
              let snapshot = try? JSONDecoder().decode(H2OWidgetSnapshot.self, from: data),
              snapshot.updatedAt <= now.addingTimeInterval(60),
              now.timeIntervalSince(snapshot.updatedAt) < maxAge else { return nil }
        return snapshot
    }
}

struct H2OWidgetState {
    let date: Date
    let snapshot: H2OWidgetSnapshot?
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
