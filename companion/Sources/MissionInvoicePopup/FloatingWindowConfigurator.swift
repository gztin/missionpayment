import AppKit
import SwiftUI

struct FloatingWindowConfigurator: NSViewRepresentable {
    let store: ReceiptStore
    let windowSize: CGSize
    let hasShadow: Bool
    let showsCloseButton: Bool

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
            window.isOpaque = false
            window.backgroundColor = .clear
            window.isMovableByWindowBackground = true
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            window.hidesOnDeactivate = false
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.delegate = coordinator
        }

        let targetStyleMask: NSWindow.StyleMask = showsCloseButton
            ? [.titled, .closable, .fullSizeContentView]
            : [.borderless, .fullSizeContentView]
        if window.styleMask != targetStyleMask {
            window.styleMask = targetStyleMask
        }
        window.backgroundColor = showsCloseButton
            ? NSColor(
                calibratedRed: 248 / 255,
                green: 248 / 255,
                blue: 248 / 255,
                alpha: 1
            )
            : .clear
        window.standardWindowButton(.miniaturizeButton)?.isHidden = true
        window.standardWindowButton(.zoomButton)?.isHidden = true

        if window.hasShadow != hasShadow {
            window.hasShadow = hasShadow
        }

        let targetSize = NSSize(width: windowSize.width, height: windowSize.height)
        let currentSize = showsCloseButton
            ? window.frame.size
            : window.contentLayoutRect.size
        let needsResize = currentSize != targetSize
        if needsResize {
            window.minSize = .zero
            window.maxSize = targetSize
            if showsCloseButton {
                window.setFrame(
                    NSRect(origin: window.frame.origin, size: targetSize),
                    display: true
                )
            } else {
                window.setContentSize(targetSize)
            }
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
