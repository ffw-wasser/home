#if canImport(UIKit)
import AppIntents
import Foundation
import WidgetKit

struct H2OWidgetReplyIntent: AppIntent {
    static var title: LocalizedStringResource = "Terminrückmeldung"
    static var openAppWhenRun = false
    @Parameter(title: "Termin") var eventID: String
    @Parameter(title: "Antwort") var response: String
    init() {}
    init(eventID: String, response: String) { self.eventID = eventID; self.response = response }
    func perform() async throws -> some IntentResult {
        await H2OWidgetReply.send(eventID: eventID, response: response)
        return .result()
    }
}

private final class NoWidgetRedirects: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

enum H2OWidgetReply {
    static func send(eventID: String, response: String) async {
        guard H2OWidgetEvent.validID(eventID), ["yes", "excused", "maybe", "edit", "retry"].contains(response) else { return }
        let now = Date()
        let request: (H2OWidgetGrant, H2OWidgetReplyJob)? = H2OWidgetStorage.transaction {
            guard var document = H2OWidgetStorage.document(), H2OWidgetStorage.fresh(document.snapshot, now: now) else { return nil }
            document.snapshot = document.snapshot.at(now)
            guard let event = document.snapshot.event, event.id == eventID else { return nil }
            if response == "edit" {
                guard document.snapshot.job == nil else { return nil }
                document.snapshot.editing = eventID
                try? H2OWidgetStorage.write(document); return nil
            }
            guard !document.snapshot.stale, event.start > now, event.canReply == true,
                  let grant = document.grant, grant.expiresAt > now else {
                document.snapshot.message = "Bitte H₂O öffnen und aktualisieren."
                try? H2OWidgetStorage.write(document); return nil
            }
            let job: H2OWidgetReplyJob
            if var pending = document.snapshot.job {
                guard pending.eventID == eventID, pending.phase == "retry", response == "retry" else { return nil }
                pending.phase = "saving"; pending.startedAt = now; job = pending
            } else {
                guard ["yes", "excused", "maybe"].contains(response), let version = event.version else { return nil }
                job = H2OWidgetReplyJob(eventID: eventID, status: response, requestID: UUID().uuidString.lowercased(), version: version, phase: "saving", startedAt: now)
            }
            document.snapshot.job = job; document.snapshot.message = nil
            do { try H2OWidgetStorage.write(document); return (grant, job) } catch { return nil }
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "H2ONextEventWidget")
        guard let (grant, job) = request else { return }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 12; configuration.timeoutIntervalForResource = 15
        configuration.httpCookieStorage = nil; configuration.urlCache = nil
        let session = URLSession(configuration: configuration, delegate: NoWidgetRedirects(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        var saved: (String, Int)?
        var denied = false; var conflict = false
        do {
            var request = URLRequest(url: URL(string: "https://feuerwehr-wasser-deckel-push.522dn4fc5f.workers.dev/portal/widget-reply")!)
            request.httpMethod = "POST"; request.cachePolicy = .reloadIgnoringLocalCacheData
            request.setValue("Bearer " + grant.token, forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["eventId": job.eventID, "status": job.status, "expectedVersion": job.version, "requestId": job.requestID])
            let (data, result) = try await session.data(for: request)
            let code = (result as? HTTPURLResponse)?.statusCode ?? 0
            denied = [401, 403].contains(code); conflict = [400, 404, 409, 423].contains(code)
            if code == 200, data.count < 4096, let value = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               value["ok"] as? Bool == true, value["status"] as? String == job.status,
               let version = value["version"] as? Int, version == job.version + 1 { saved = (job.status, version) }
        } catch { /* An uncertain delivery keeps exactly the same request ID for explicit retry. */ }
        H2OWidgetStorage.transaction {
            guard var document = H2OWidgetStorage.document(), document.grant?.generation == grant.generation,
                  document.snapshot.job?.requestID == job.requestID else { return }
            if denied { H2OWidgetStorage.clear(); return }
            if let (status, version) = saved {
                if document.snapshot.event?.id == eventID { document.snapshot.event?.status = status; document.snapshot.event?.version = version }
                document.snapshot.job = nil; document.snapshot.editing = nil; document.snapshot.message = nil
            } else if conflict {
                document.snapshot.job = nil; document.snapshot.editing = nil
                document.snapshot.message = "In H₂O aktualisieren"
            } else { document.snapshot.job?.phase = "retry" }
            // Replying never renews the age of the calendar snapshot.
            try? H2OWidgetStorage.write(document)
        }
        WidgetCenter.shared.reloadTimelines(ofKind: "H2ONextEventWidget")
    }
}
#endif
