import AppKit
import SwiftUI

struct FloatingWindowConfigurator: NSViewRepresentable {
    let store: ReceiptStore
    let contentSize: CGSize

    func makeCoordinator() -> Coordinator {
        Coordinator(store: store)
    }

    func makeNSView(context: Context) -> NSView {
        let view = NSView()
        DispatchQueue.main.async {
            configure(view.window, coordinator: context.coordinator)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            configure(nsView.window, coordinator: context.coordinator)
        }
    }

    private func configure(_ window: NSWindow?, coordinator: Coordinator) {
        guard let window else { return }
        let isNewWindow = coordinator.configuredWindow !== window
        if isNewWindow {
            coordinator.configuredWindow = window
            window.level = .floating
            window.styleMask = [.borderless, .fullSizeContentView]
            window.isOpaque = false
            window.backgroundColor = .clear
            window.hasShadow = false
            window.isMovableByWindowBackground = true
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            window.hidesOnDeactivate = false
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.delegate = coordinator
        }

        let targetSize = NSSize(width: contentSize.width, height: contentSize.height)
        let needsResize = window.contentLayoutRect.size != targetSize
        if needsResize {
            window.minSize = .zero
            window.maxSize = targetSize
            window.setContentSize(targetSize)
            window.minSize = targetSize
        }

        if isNewWindow {
            store.attach(window: window)
        } else {
            DispatchQueue.main.async {
                store.screenParametersDidChange()
            }
        }
    }

    final class Coordinator: NSObject, NSWindowDelegate {
        private let store: ReceiptStore
        weak var configuredWindow: NSWindow?

        init(store: ReceiptStore) {
            self.store = store
        }

        func windowDidMove(_ notification: Notification) {
            guard let window = notification.object as? NSWindow else { return }
            Task { @MainActor in
                store.windowDidMove(window)
            }
        }
    }
}
