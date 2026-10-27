import SwiftUI
import WebKit

struct PortalWebView: UIViewRepresentable {
    @ObservedObject var model: PortalModel
    func makeCoordinator() -> Coordinator { Coordinator(model) }
    func makeUIView(context: Context) -> WKWebView {
        model.web.navigationDelegate = context.coordinator
        model.web.uiDelegate = context.coordinator
        let controller = model.web.configuration.userContentController
        controller.removeScriptMessageHandler(forName: "h2oPdf")
        controller.add(WeakPdfHandler(context.coordinator), name: "h2oPdf")
        controller.removeScriptMessageHandler(forName: "h2oInvitation")
        controller.add(WeakPdfHandler(context.coordinator), name: "h2oInvitation")
        if let url = Bundle.main.url(forResource: "ios-entry", withExtension: "js"), let script = try? String(contentsOf: url, encoding: .utf8) {
            controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        if let url = Bundle.main.url(forResource: "pdf-export", withExtension: "js"), let script = try? String(contentsOf: url, encoding: .utf8) {
            controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        NativePdfPresenter.clean()
        return model.web
    }
    func updateUIView(_ view: WKWebView, context: Context) {}
    final class WeakPdfHandler: NSObject, WKScriptMessageHandler {
        weak var target: Coordinator?
        init(_ target: Coordinator) { self.target = target }
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) { target?.userContentController(controller, didReceive: message) }
    }
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let model: PortalModel
        init(_ model: PortalModel) { self.model = model }
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            let origin = message.frameInfo.securityOrigin
            guard ["h2oPdf", "h2oInvitation"].contains(message.name), message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == "ffw-wasser.github.io", [0,443].contains(origin.port),
                  let frameURL = message.frameInfo.request.url, PortalLinks.trusted(frameURL),
                  let webView = message.webView, let url = webView.url, PortalLinks.trusted(url) else { return }
            if message.name == "h2oInvitation" {
                guard message.body as? String == "scan" else { return }
                // Only an explicit action in the visible, signed-out setup can open the camera.
                webView.evaluateJavaScript("(() => { const e = document.getElementById('identity-setup'); return !!e && !e.closest('[hidden]') && !window.H2OIdentity?.session?.(); })()") { value, error in
                    guard error == nil, value as? Bool == true else { return }
                    self.model.showScanner = true
                }
                return
            }
            NativePdfPresenter.show(body: message.body, webView: webView) { self.model.message = $0 }
        }
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
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { if (error as NSError).code != NSURLErrorCancelled { model.message = "Portal nicht erreichbar. Prüfe deine Internetverbindung und tippe auf „Erneut laden“." } }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { model.message = "Die Verbindung wurde unterbrochen. Bitte tippe auf „Erneut laden“." }
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { model.message = "Die Ansicht wurde beendet. Bitte tippe auf „Erneut laden“." }
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
