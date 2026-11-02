import Foundation
import WidgetKit

// Accepted only from the trusted, authenticated top-level member portal.
enum H2OWidgetBridge {
    static let kind = "H2ONextEventWidget"
    static func accept(_ body: Any) {
        guard let message = body as? [String: Any], let action = message["action"] as? String else { return }
        if action == "clear" {
            H2OWidgetStorage.transaction { H2OWidgetStorage.clear() }
            WidgetCenter.shared.reloadTimelines(ofKind: kind); return
        }
        guard ["update", "empty"].contains(action) else { return }
        let inputs = message["events"] as? [[String: Any]] ?? (message["event"].map { [$0 as? [String: Any] ?? [:]] } ?? [])
        guard action == "empty" || (1...3).contains(inputs.count) else { return }
        let events = action == "empty" ? [] : inputs.compactMap(event)
        guard action == "empty" || events.count == inputs.count else { return }
        let reply = message["reply"] as? [String: Any]
        let grant: H2OWidgetGrant?
        if let token = reply?["token"] as? String, (1...3000).contains(token.count),
           token.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil,
           let expires = reply?["expiresAt"] as? Double, expires.isFinite,
           expires > Date().timeIntervalSince1970 * 1000, expires <= (Date().timeIntervalSince1970 + H2OWidgetStorage.maxAge + 60) * 1000 {
            grant = H2OWidgetGrant(token: token, expiresAt: Date(timeIntervalSince1970: expires / 1000), generation: UUID().uuidString)
        } else { grant = nil }
        let snapshot = H2OWidgetSnapshot(updatedAt: Date(), event: events.first, stale: message["stale"] as? Bool == true, following: Array(events.dropFirst()))
        H2OWidgetStorage.transaction { try? H2OWidgetStorage.write(H2OWidgetDocument(snapshot: snapshot, grant: grant)) }
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
    }
    private static func event(_ input: [String: Any]) -> H2OWidgetEvent? {
        guard let start = input["start"] as? Double, let end = input["end"] as? Double,
              start.isFinite, end.isFinite, end > start, end - start < 7 * 86400000,
              end > Date().timeIntervalSince1970 * 1000, start < (Date().timeIntervalSince1970 + 366 * 86400) * 1000,
              let status = input["status"] as? String, ["yes", "excused", "maybe", "open"].contains(status),
              let title = clean(input["title"], max: 100), let location = clean(input["location"], max: 100),
              let clothing = clean(input["clothing"], max: 80), let allDay = input["allDay"] as? Bool else { return nil }
        let id = input["id"] as? String
        return H2OWidgetEvent(title: title, start: Date(timeIntervalSince1970: start / 1000), end: Date(timeIntervalSince1970: end / 1000), location: location, clothing: clothing, status: status, allDay: allDay,
            id: id.flatMap { H2OWidgetEvent.validID($0) ? $0 : nil }, version: (input["version"] as? Int).flatMap { $0 >= 0 ? $0 : nil }, canReply: input["canReply"] as? Bool, reminded: input["reminded"] as? Bool)
    }
    private static func clean(_ input: Any?, max: Int) -> String? {
        guard let raw = input as? String else { return nil }
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.count <= max && !value.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) ? value : nil
    }
}
