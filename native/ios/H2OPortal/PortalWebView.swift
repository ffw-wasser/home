import SwiftUI
import WebKit

struct PortalWebView: UIViewRepresentable {
    @ObservedObject var model: PortalModel
    func makeCoordinator() -> Coordinator { Coordinator(model) }
    func makeUIView(context: Context) -> WKWebView {
        model.web.navigationDelegate = context.coordinator
        model.web.uiDelegate = context.coordinator
        return model.web
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let model: PortalModel
        init(_ model: PortalModel) { self.model = model }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard action.targetFrame?.isMainFrame != false else { decisionHandler(.allow); return }
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if PortalLinks.trusted(url) { decisionHandler(.allow); return }
            if action.navigationType == .linkActivated && ["https", "mailto", "tel"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if action.targetFrame == nil, let url = action.request.url {
                if PortalLinks.trusted(url) { model.open(url) }
                else if ["https", "mailto", "tel"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
            }; return nil
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { model.message = "" }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { if (error as NSError).code != NSURLErrorCancelled { model.message = "Portal nicht erreichbar. Unter Hilfe kannst du erneut laden oder die Offline-Anleitung öffnen." } }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { model.message = "Die Verbindung wurde unterbrochen. Bitte unter Hilfe erneut laden." }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { model.message = "Die Ansicht wurde beendet. Bitte unter Hilfe erneut laden." }
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            guard let url = frame.request.url, frame.isMainFrame, PortalLinks.trusted(url) else { completionHandler(); return }
            let alert = UIAlertController(title: "H₂O Portal", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(alert, webView: webView, fallback: completionHandler)
        }
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            guard let url = frame.request.url, frame.isMainFrame, PortalLinks.trusted(url) else { completionHandler(false); return }
            let alert = UIAlertController(title: "H₂O Portal", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) }); present(alert, webView: webView) { completionHandler(false) }
        }
        private func present(_ alert: UIAlertController, webView: WKWebView, fallback: () -> Void) {
            guard var controller = webView.window?.rootViewController else { fallback(); return }
            while let presented = controller.presentedViewController { controller = presented }
            controller.present(alert, animated: true)
        }
    }
}
