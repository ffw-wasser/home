import Foundation
import WidgetKit

// The only data entering the shared widget store comes from the authenticated,
// already member-filtered H2O list response in the trusted top-level portal.
enum H2OWidgetBridge {
    static let kind = "H2ONextEventWidget"

    static func accept(_ body: Any) {
        guard let message = body as? [String: Any], let action = message["action"] as? String else { return }
        if action == "clear" {
            UserDefaults(suiteName: H2OWidgetStorage.suite)?.removeObject(forKey: H2OWidgetStorage.key)
            WidgetCenter.shared.reloadTimelines(ofKind: kind)
            return
        }
        guard ["update", "empty"].contains(action) else { return }
        let event: H2OWidgetEvent?
        if action == "empty" {
            event = nil
        } else {
            guard let input = message["event"] as? [String: Any],
                  let start = number(input["start"]),
                  let end = number(input["end"]),
                  start.isFinite, end.isFinite,
                  end > start, end - start < 7 * 24 * 60 * 60 * 1000,
                  end > Date().timeIntervalSince1970 * 1000,
                  start < (Date().timeIntervalSince1970 + 366 * 24 * 60 * 60) * 1000,
                  let status = input["status"] as? String,
                  ["yes", "excused", "maybe", "open"].contains(status),
                  let title = clean(input["title"], max: 100),
                  let location = clean(input["location"], max: 100),
                  let clothing = clean(input["clothing"], max: 80),
                  let allDay = input["allDay"] as? Bool else { return }
            event = H2OWidgetEvent(title: title, start: Date(timeIntervalSince1970: start / 1000),
                                   end: Date(timeIntervalSince1970: end / 1000),
                                   location: location, clothing: clothing, status: status, allDay: allDay)
        }
        let snapshot = H2OWidgetSnapshot(updatedAt: Date(), event: event,
                                         stale: message["stale"] as? Bool == true)
        guard let data = try? JSONEncoder().encode(snapshot),
              let defaults = UserDefaults(suiteName: H2OWidgetStorage.suite) else { return }
        defaults.set(data, forKey: H2OWidgetStorage.key)
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
    }

    private static func number(_ value: Any?) -> Double? {
        guard let n = value as? NSNumber else { return nil }
        return n.doubleValue
    }

    private static func clean(_ input: Any?, max: Int) -> String? {
        guard let raw = input as? String else { return nil }
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.count <= max, !value.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else { return nil }
        return value
    }
}
