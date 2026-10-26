import SwiftUI
import AVFoundation

struct ScannerView: UIViewControllerRepresentable {
    let received: (String) -> Void
    func makeUIViewController(context: Context) -> ScannerController { ScannerController(received: received) }
    func updateUIViewController(_ controller: ScannerController, context: Context) {}
    static func dismantleUIViewController(_ controller: ScannerController, coordinator: ()) { controller.stop() }
}

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "h2o-camera")
    private let received: (String) -> Void
    private var preview: AVCaptureVideoPreviewLayer?
    private var completed = false
    private var stopped = false
    init(received: @escaping (String) -> Void) { self.received = received; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .black
        AVCaptureDevice.requestAccess(for: .video) { [weak self] allowed in
            guard let self else { return }
            if allowed { self.configure() } else { DispatchQueue.main.async { self.hint("Bitte den Kamerazugriff in den iPhone-Einstellungen erlauben oder den Einladungscode im Portal eingeben.") } }
        }
    }
    private func configure() {
        queue.async { [weak self] in
            guard let self, !self.stopped, let camera = AVCaptureDevice.default(for: .video), let input = try? AVCaptureDeviceInput(device: camera), self.session.canAddInput(input) else { DispatchQueue.main.async { self?.hint("Keine Kamera verfügbar. Bitte den Einladungscode im Portal eingeben.") }; return }
            self.session.addInput(input)
            let output = AVCaptureMetadataOutput()
            guard self.session.canAddOutput(output) else { return }
            self.session.addOutput(output); output.setMetadataObjectsDelegate(self, queue: .main); output.metadataObjectTypes = [.qr]
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                let preview = AVCaptureVideoPreviewLayer(session: self.session); preview.videoGravity = .resizeAspectFill; preview.frame = self.view.bounds; self.view.layer.addSublayer(preview); self.preview = preview
            }
            self.session.startRunning()
        }
    }
    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); preview?.frame = view.bounds }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !completed, let value = (metadataObjects.first as? AVMetadataMachineReadableCodeObject)?.stringValue else { return }
        completed = true; stop(); received(value)
    }
    func stop() { queue.async { [weak self] in self?.stopped = true; if self?.session.isRunning == true { self?.session.stopRunning() } } }
    override func viewWillDisappear(_ animated: Bool) { super.viewWillDisappear(animated); stop() }
    private func hint(_ message: String) { let label = UILabel(); label.text = message; label.numberOfLines = 0; label.textColor = .white; label.textAlignment = .center; label.frame = view.bounds.insetBy(dx: 24, dy: 80); label.autoresizingMask = [.flexibleWidth, .flexibleHeight]; view.addSubview(label) }
}
