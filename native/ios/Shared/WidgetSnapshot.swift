import Foundation

#if canImport(Darwin)
import Darwin
#endif

enum H2OWidgetDateLabel {
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Berlin")!
        return calendar
    }
    static func relativeDay(for date: Date, comparedTo reference: Date) -> String? {
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: reference), to: calendar.startOfDay(for: date)).day
        return days == 0 ? "Heute" : days == 1 ? "Morgen" : nil
    }
}

struct H2OWidgetEvent: Codable, Equatable {
    let title: String
    let start: Date
    let end: Date
    let location: String
    let clothing: String
    var status: String
    let allDay: Bool
    var id: String? = nil
    var version: Int? = nil
    var canReply: Bool? = nil
    var reminded: Bool? = nil
    var link: URL? { id.flatMap { Self.validID($0) ? URL(string: "h2oportal://termine?event=" + $0) : nil } }
    static func validID(_ value: String) -> Bool { value.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil }
}
struct H2OWidgetReplyJob: Codable, Equatable {
    let eventID: String
    let status: String
    let requestID: String
    let version: Int
    var phase: String
    var startedAt: Date
}
struct H2OWidgetSnapshot: Codable, Equatable {
    let updatedAt: Date
    var event: H2OWidgetEvent?
    var stale: Bool
    var following: [H2OWidgetEvent]? = nil
    var editing: String? = nil
    var job: H2OWidgetReplyJob? = nil
    var message: String? = nil
    var notice: String? = nil
    var currentReplyJob: H2OWidgetReplyJob? { job.flatMap { $0.eventID == event?.id ? $0 : nil } }
    // Moving the light is pending feedback, never an optimistic stored answer.
    var replyLightStatus: String {
        if let job = currentReplyJob, job.phase == "saving", ["yes", "excused", "maybe"].contains(job.status) { return job.status }
        return event?.status ?? "open"
    }
    var replyFeedback: String? {
        if let message { return message }
        if let job = currentReplyJob { return job.phase == "saving" ? nil : "Nicht bestätigt" }
        if let notice { return notice }
        if stale { return "Stand veraltet · H₂O öffnen" }
        if event?.status == "open" { return event?.reminded == true ? "Bitte Rückmeldung geben" : "Rückmeldung offen" }
        return nil
    }
    var events: [H2OWidgetEvent] { ([event].compactMap { $0 } + (following ?? [])).sorted { $0.start < $1.start } }
    func at(_ now: Date) -> H2OWidgetSnapshot {
        var value = self
        if !H2OWidgetStorage.fresh(self, now: now) { value.stale = true }
        let remaining = events.filter { $0.end > now }
        value.event = remaining.first
        value.following = Array(remaining.dropFirst())
        if value.event?.id != event?.id {
            value.job = nil; value.editing = nil; value.message = nil; value.notice = nil
        }
        if let job = value.job, job.phase == "saving", now.timeIntervalSince(job.startedAt) >= 20 {
            value.job?.phase = "retry"
        }
        return value
    }
}
struct H2OWidgetGrant: Codable {
    let token: String
    let expiresAt: Date
    let generation: String
}
struct H2OWidgetDocument: Codable {
    var snapshot: H2OWidgetSnapshot
    let grant: H2OWidgetGrant?
}
struct H2OWidgetState {
    let date: Date
    let snapshot: H2OWidgetSnapshot?
}

// Protected app-group storage contains only three appointments and an opaque,
// expiring, session-bound reply grant. No full login session or personal calendar URL.
enum H2OWidgetStorage {
    static let suite = "group.de.feuerwehrwasser.h2o"
    static let key = "h2o.widget.snapshot.v1"
    static let maxAge: TimeInterval = 12 * 60 * 60
    // Display-only retention never extends the reply grant or calendar freshness.
    static let displayAge: TimeInterval = 30 * 24 * 60 * 60
    private static var folder: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: suite) }
    private static var file: URL? { folder?.appendingPathComponent("widget-v2.json") }
    static func transaction<T>(_ action: () throws -> T) rethrows -> T {
        #if canImport(Darwin)
        let fd = folder.map { Darwin.open($0.appendingPathComponent("widget.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR) } ?? -1
        if fd >= 0 { flock(fd, LOCK_EX) }
        defer { if fd >= 0 { flock(fd, LOCK_UN); close(fd) } }
        #endif
        return try action()
    }
    static func document() -> H2OWidgetDocument? {
        guard let file, let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(H2OWidgetDocument.self, from: data)
    }
    static func write(_ value: H2OWidgetDocument) throws {
        guard var file else { throw CocoaError(.fileNoSuchFile) }
        let data = try JSONEncoder().encode(value)
        #if os(iOS)
        try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: file, options: .atomic)
        #endif
        var resources = URLResourceValues(); resources.isExcludedFromBackup = true
        try file.setResourceValues(resources)
        UserDefaults(suiteName: suite)?.removeObject(forKey: key)
    }
    static func clear() {
        if let file { try? FileManager.default.removeItem(at: file) }
        UserDefaults(suiteName: suite)?.removeObject(forKey: key)
    }
    static func fresh(_ snapshot: H2OWidgetSnapshot, now: Date) -> Bool {
        snapshot.updatedAt <= now.addingTimeInterval(60) && now.timeIntervalSince(snapshot.updatedAt) < maxAge
    }
    static func read(now: Date = Date()) -> H2OWidgetSnapshot? {
        let snapshot = document()?.snapshot ?? UserDefaults(suiteName: suite)?.data(forKey: key).flatMap { try? JSONDecoder().decode(H2OWidgetSnapshot.self, from: $0) }
        guard let snapshot, displayable(snapshot, now: now) else { return nil }
        return snapshot.at(now)
    }
    static func displayable(_ snapshot: H2OWidgetSnapshot, now: Date) -> Bool {
        snapshot.updatedAt <= now.addingTimeInterval(60) && now.timeIntervalSince(snapshot.updatedAt) < displayAge
    }
    static func timeline(snapshot: H2OWidgetSnapshot?, now: Date) -> [H2OWidgetState] {
        guard let snapshot, displayable(snapshot, now: now) else { return [H2OWidgetState(date: now, snapshot: nil)] }
        let expiry = snapshot.updatedAt.addingTimeInterval(displayAge)
        var dates = Set([now, expiry])
        let staleAt = snapshot.updatedAt.addingTimeInterval(maxAge)
        if staleAt > now { dates.insert(staleAt) }
        for event in snapshot.events where event.end > now && event.end < expiry { dates.insert(event.end) }
        if let midnight = H2OWidgetDateLabel.calendar.date(byAdding: .day, value: 1, to: H2OWidgetDateLabel.calendar.startOfDay(for: now)), midnight < expiry,
           snapshot.events.contains(where: { $0.end > midnight }) { dates.insert(midnight) }
        if let job = snapshot.job, job.phase == "saving" {
            let timeout = job.startedAt.addingTimeInterval(20)
            if timeout > now && timeout < expiry { dates.insert(timeout) }
        }
        return dates.sorted().map { H2OWidgetState(date: $0, snapshot: $0 < expiry ? snapshot.at($0) : nil) }
    }
}
