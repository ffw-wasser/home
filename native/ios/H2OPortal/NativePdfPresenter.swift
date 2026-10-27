import UIKit
import WebKit

@MainActor enum NativePdfPresenter {
    private static var sharing = false
    private static var root: URL { FileManager.default.temporaryDirectory.appendingPathComponent("h2o-pdf-share", isDirectory: true) }
    static func clean() {
        let files = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
        for file in files {
            if let date = try? file.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate, date.timeIntervalSinceNow < -86400 { try? FileManager.default.removeItem(at: file) }
        }
    }
    static func show(body: Any, webView: WKWebView, notice: (String) -> Void) {
        guard !sharing, UIApplication.shared.applicationState == .active,
              let value = body as? [String: Any], let name = value["name"] as? String,
              let mime = value["mime"] as? String, let encoded = value["data"] as? String,
              let data = PortalPdfPolicy.decode(name: name, mime: mime, encoded: encoded) else { notice("Die PDF konnte nicht bestätigt werden. Bitte eine PDF bis 10 MB wählen."); return }
        guard let controller = webView.window?.rootViewController, controller.presentedViewController == nil else { notice("Bitte zuerst den geöffneten App-Dialog schließen."); return }
        clean()
        let directory = root.appendingPathComponent(UUID().uuidString, isDirectory: true), file = directory.appendingPathComponent(name)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: file, options: [.atomic, .completeFileProtection])
        } catch { try? FileManager.default.removeItem(at: directory); notice("Die PDF konnte nicht zum Teilen vorbereitet werden."); return }
        let share = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = webView
        share.popoverPresentationController?.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.midY, width: 1, height: 1)
        sharing = true
        share.completionWithItemsHandler = { _, _, _, _ in Task { @MainActor in sharing = false; try? FileManager.default.removeItem(at: directory) } }
        controller.present(share, animated: true)
    }
}
