import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItemController: StatusItemController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        statusItemController = StatusItemController(store: .shared)
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        guard let url = urls.first else { return }
        ReceiptStore.shared.handle(url: url)
    }

    func applicationDidChangeScreenParameters(_ notification: Notification) {
        ReceiptStore.shared.screenParametersDidChange()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}

@MainActor
final class SettingsWindowController: NSObject, NSWindowDelegate {
    static let shared = SettingsWindowController()

    private var windowController: NSWindowController?
    private weak var store: ReceiptStore?
    private var restoresDashboardOnClose = true

    private override init() {}

    func show(store: ReceiptStore) {
        self.store = store
        restoresDashboardOnClose = true
        store.setSettingsPresented(true)
        let controller: NSWindowController
        if let windowController {
            controller = windowController
        } else {
            let hostingController = NSHostingController(
                rootView: PopupSettingsView(store: store)
            )
            let window = NSWindow(contentViewController: hostingController)
            window.title = "Mission Invoice 設定"
            window.styleMask = [.titled, .closable, .miniaturizable]
            let contentSize = PopupSettingsLayout.contentSize
            window.setContentSize(contentSize)
            window.minSize = contentSize
            window.maxSize = contentSize
            window.isReleasedWhenClosed = false
            window.delegate = self
            window.center()
            controller = NSWindowController(window: window)
            windowController = controller
        }

        controller.showWindow(nil)
        controller.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    var isVisible: Bool {
        windowController?.window?.isVisible == true
    }

    func close() {
        windowController?.close()
    }

    func closeWithoutRestoringDashboard() {
        guard isVisible else {
            store?.setSettingsPresented(false)
            return
        }
        restoresDashboardOnClose = false
        windowController?.close()
    }

    func windowWillClose(_ notification: Notification) {
        let shouldRestoreDashboard = restoresDashboardOnClose
        restoresDashboardOnClose = true
        if shouldRestoreDashboard {
            store?.settingsDidClose()
        } else {
            store?.setSettingsPresented(false)
        }
    }
}

@main
struct MissionInvoicePopupApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    private let store = ReceiptStore.shared

    var body: some Scene {
        Window("Mission Invoice", id: "receipt") {
            PopupRootView(store: store)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 221, height: 55)
        .commandsRemoved()
    }
}
