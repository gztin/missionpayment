import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItemController: StatusItemController?
    private var didRequestBillingDirectoryAuthorization = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        ReceiptStore.shared.preferences.appearance.apply(to: NSApp)
        statusItemController = StatusItemController(store: .shared)
        requestBillingDirectoryAuthorizationIfNeeded()
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

    private func requestBillingDirectoryAuthorizationIfNeeded() {
        let store = ReceiptStore.shared
        guard store.requiresBillingDirectoryAuthorization,
              !didRequestBillingDirectoryAuthorization
        else {
            return
        }

        didRequestBillingDirectoryAuthorization = true
        DispatchQueue.main.async {
            NSApp.activate(ignoringOtherApps: true)
            do {
                try BillingDirectoryAuthorization.request(for: store)
            } catch {
                NSAlert(error: error).runModal()
            }
        }
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
            window.title = "AURA 設定"
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

        applyAppearance(store.preferences.appearance)
        controller.showWindow(nil)
        controller.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applyAppearance(_ appearance: PopupAppearance) {
        windowController?.window?.appearance = appearance.nsAppearanceName.flatMap(NSAppearance.init)
    }

    var isVisible: Bool {
        windowController?.window?.isVisible == true
    }

    var window: NSWindow? {
        windowController?.window
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

    func windowDidResignKey(_ notification: Notification) {
        guard let window = notification.object as? NSWindow,
              window === windowController?.window,
              window.isVisible,
              !window.isMiniaturized
        else {
            return
        }

        DispatchQueue.main.async { [weak self, weak window] in
            guard let self,
                  let window,
                  window.isVisible,
                  !window.isKeyWindow,
                  !window.isMiniaturized,
                  NSApp.modalWindow == nil
            else {
                return
            }
            self.close()
        }
    }
}

@main
struct MissionInvoicePopupApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    private let store = ReceiptStore.shared

    var body: some Scene {
        Window("AURA", id: "receipt") {
            PopupRootView(store: store)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 221, height: 55)
        .commandsRemoved()
    }
}
