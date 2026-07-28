import AppKit
import Foundation
import Observation

@MainActor
@Observable
final class ReceiptStore {
    enum ConnectionState: Equatable {
        case connected
        case waiting
        case disconnected

        static func resolve(
            popupEnabled: Bool,
            hasReadableLedger: Bool,
            hasSessionActivity: Bool
        ) -> ConnectionState {
            guard popupEnabled, hasReadableLedger else { return .disconnected }
            return hasSessionActivity ? .connected : .waiting
        }

        var title: String {
            switch self {
            case .connected: "Codex 已連線"
            case .waiting: "等待 Codex"
            case .disconnected: "Codex 未連線"
            }
        }
    }

    enum Page: Equatable {
        case home
        case today
    }

    struct TodayReceipt: Identifiable, Equatable {
        let id: String
        let payload: ReceiptPayload
        let receiptFileURL: URL?

        var timeText: String {
            guard let date = ReceiptStore.date(from: payload.endedAt) else { return "--:--" }
            return date.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits))
        }
    }

    static let shared = ReceiptStore()

    var receipt: ReceiptPayload = .sample
    var page: Page = .home
    private(set) var todayReceipts: [TodayReceipt] = []
    private(set) var remainingPercent: Int?
    private(set) var usageUpdatedAt: Date?
    private(set) var usageResetsAt: Date?
    private(set) var dashboardMessage = "正在讀取本機用量紀錄…"
    private(set) var connectionState: ConnectionState = .disconnected
    private(set) var lastConnectionActivityAt: Date?
    private(set) var isReceiptPresented = false
    let preferences: PopupPreferences
    let soundService: ReceiptSoundService

    private var dismissTask: Task<Void, Never>?
    private(set) var isSettingsPresented = false
    private var isApplyingPosition = false
    private var hasSessionActivity = false
    private var observedLogModificationDate: Date?
    @ObservationIgnored private weak var receiptWindow: NSWindow?
    @ObservationIgnored private var openWindowAction: (() -> Void)?

    init(
        preferences: PopupPreferences = .shared,
        soundService: ReceiptSoundService = ReceiptSoundService()
    ) {
        self.preferences = preferences
        self.soundService = soundService
        reloadDashboard()
        refreshConnectionState(establishBaseline: true)
    }

    func present(_ receipt: ReceiptPayload, playSound: Bool = true) {
        self.receipt = receipt
        rememberProjectLogFile(receipt.projectLogFile)
        reloadDashboard(preferredLogFile: receipt.projectLogFile)
        page = .home
        isReceiptPresented = true
        showWindow()
        if playSound, preferences.soundEnabled {
            playReceiptSound()
        }
        scheduleDismiss()
    }

    func handle(url: URL) {
        guard let payload = try? ReceiptPayload.decode(from: url) else { return }
        markConnectionActivity()
        present(payload)
    }

    func setSettingsPresented(_ isPresented: Bool) {
        isSettingsPresented = isPresented
    }

    func showSettings() {
        SettingsWindowController.shared.show(store: self)
    }

    func setAutoDismissEnabled(_ enabled: Bool) {
        preferences.autoDismissEnabled = enabled
        scheduleDismiss()
    }

    func setAutoDismissSeconds(_ seconds: Int) {
        preferences.setAutoDismissSeconds(seconds)
        scheduleDismiss()
    }

    func setSoundEnabled(_ enabled: Bool) {
        preferences.soundEnabled = enabled
    }

    @discardableResult
    func playReceiptSound() -> Bool {
        switch preferences.soundSource {
        case .bundled:
            return soundService.play(customFilename: nil)
        case .custom:
            guard soundService.hasCustomSound(filename: preferences.customSoundFilename) else {
                preferences.resetCustomSound()
                return soundService.play(customFilename: nil)
            }
            return soundService.play(customFilename: preferences.customSoundFilename)
        }
    }

    func setSoundSource(_ source: ReceiptSoundSource) {
        guard source == .bundled
            || soundService.hasCustomSound(filename: preferences.customSoundFilename) else {
            preferences.setSoundSource(.bundled)
            return
        }
        preferences.setSoundSource(source)
    }

    func importCustomSound(from url: URL) throws -> ImportedSound {
        let importedSound = try soundService.importCustomSound(from: url)
        preferences.setCustomSound(
            filename: importedSound.storedFilename,
            displayName: importedSound.displayName
        )
        return importedSound
    }

    func resetCustomSound() {
        soundService.removeCustomSound(filename: preferences.customSoundFilename)
        preferences.resetCustomSound()
    }

    func select(position: PopupPosition) {
        preferences.resetCustomPosition(to: position)
        applyPreferredPosition()
    }

    func dismiss() {
        dismissTask?.cancel()
        isReceiptPresented = false
        page = .home
        reloadDashboard()
        showWindow()
    }

    func showHome() {
        dismissTask?.cancel()
        isReceiptPresented = false
        page = .home
        reloadDashboard()
        showWindow()
    }

    func showToday() {
        dismissTask?.cancel()
        isReceiptPresented = false
        page = .today
        reloadDashboard()
        showWindow()
    }

    func showReceipt(_ item: TodayReceipt) {
        guard let receiptFileURL = item.receiptFileURL else { return }
        NSWorkspace.shared.open(receiptFileURL)
    }

    func attach(window: NSWindow) {
        receiptWindow = window
        applyPreferredPosition()
        window.orderFrontRegardless()
    }

    func registerWindowOpener(_ action: @escaping () -> Void) {
        openWindowAction = action
    }

    func windowDidMove(_ window: NSWindow) {
        guard window === receiptWindow, !isApplyingPosition else { return }
        let screen = window.screen ?? NSScreen.main
        guard let screen else { return }
        let range = Self.availableOriginRange(
            windowSize: window.frame.size,
            visibleFrame: screen.visibleFrame
        )
        let clampedOrigin = CGPoint(
            x: min(max(window.frame.minX, range.minX), range.maxX),
            y: min(max(window.frame.minY, range.minY), range.maxY)
        )
        if window.frame.origin != clampedOrigin {
            isApplyingPosition = true
            window.setFrameOrigin(clampedOrigin)
            DispatchQueue.main.async { [weak self] in
                self?.isApplyingPosition = false
            }
        }
        let x = range.width > 0 ? (clampedOrigin.x - range.minX) / range.width : 0
        let y = range.height > 0 ? (clampedOrigin.y - range.minY) / range.height : 0
        preferences.setCustomPosition(
            x: Double(x),
            y: Double(y),
            displayID: screen.missionInvoiceDisplayID
        )
    }

    func screenParametersDidChange() {
        if preferences.position == .custom,
           let displayID = preferences.customDisplayID,
           screen(with: displayID) == nil {
            preferences.resetCustomPosition(to: .topRight)
        }
        applyPreferredPosition()
    }

    private func showWindow() {
        NSApp.setActivationPolicy(.accessory)
        NSApp.activate(ignoringOtherApps: true)
        if receiptWindow == nil {
            openWindowAction?()
            return
        }
        applyPreferredPosition()
        receiptWindow?.orderFrontRegardless()
    }

    func reloadDashboard(preferredLogFile: String? = nil) {
        guard let logFile = resolveLogFile(preferred: preferredLogFile),
              let data = try? Data(contentsOf: logFile),
              let ledger = try? JSONDecoder().decode(Ledger.self, from: data)
        else {
            todayReceipts = []
            remainingPercent = nil
            usageUpdatedAt = nil
            usageResetsAt = nil
            dashboardMessage = "目前沒有可讀取的發票紀錄"
            return
        }

        rememberProjectLogFile(logFile.path)
        let calendar = Self.taipeiCalendar
        todayReceipts = ledger.records.compactMap { record in
            guard let endedAt = record.endedAt ?? record.createdAt,
                  let date = Self.date(from: endedAt),
                  calendar.isDateInToday(date)
            else { return nil }
            return record.todayReceipt(endedAt: endedAt)
        }
        .sorted {
            (Self.date(from: $0.payload.endedAt) ?? .distantPast)
                > (Self.date(from: $1.payload.endedAt) ?? .distantPast)
        }

        let latestSnapshot = ledger.records
            .sorted {
                (Self.date(from: $0.endedAt ?? $0.createdAt ?? "") ?? .distantPast)
                    > (Self.date(from: $1.endedAt ?? $1.createdAt ?? "") ?? .distantPast)
            }
            .compactMap(\.usageSnapshot)
            .first { $0.status == "available" && $0.displayWindow != nil }

        if let snapshot = latestSnapshot, let window = snapshot.displayWindow {
            let remaining = window.remainingPercent ?? window.usedPercent.map { 100 - $0 }
            remainingPercent = remaining.map { min(100, max(0, Int($0.rounded()))) }
            usageUpdatedAt = snapshot.capturedAt.flatMap(Self.date(from:))
            usageResetsAt = window.resetsAtIso.flatMap(Self.date(from:))
                ?? window.resetsAt.map { Date(timeIntervalSince1970: $0) }
            dashboardMessage = "Codex 官方用量快照"
        } else {
            remainingPercent = nil
            usageUpdatedAt = nil
            usageResetsAt = nil
            dashboardMessage = "目前無法取得 Codex 官方用量"
        }
    }

    func monitorConnection() async {
        refreshConnectionState(establishBaseline: observedLogModificationDate == nil)
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            refreshConnectionState()
        }
    }

    private func scheduleDismiss() {
        dismissTask?.cancel()
        guard isReceiptPresented,
              preferences.autoDismissEnabled
        else {
            return
        }
        let seconds = preferences.autoDismissSeconds
        dismissTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            self?.dismiss()
        }
    }

    private func applyPreferredPosition() {
        guard let window = receiptWindow else { return }
        let targetScreen = preferredScreen(for: window)
        let visibleFrame = targetScreen.visibleFrame
        let origin: CGPoint

        if preferences.position == .custom {
            let range = Self.availableOriginRange(
                windowSize: window.frame.size,
                visibleFrame: visibleFrame
            )
            origin = CGPoint(
                x: range.minX + range.width * preferences.customX,
                y: range.minY + range.height * preferences.customY
            )
        } else {
            origin = preferences.position.origin(
                windowSize: window.frame.size,
                visibleFrame: visibleFrame
            )
        }

        isApplyingPosition = true
        window.setFrameOrigin(origin)
        DispatchQueue.main.async { [weak self] in
            self?.isApplyingPosition = false
        }
    }

    private func preferredScreen(for window: NSWindow) -> NSScreen {
        if preferences.position == .custom,
           let displayID = preferences.customDisplayID,
           let customScreen = screen(with: displayID) {
            return customScreen
        }
        return window.screen ?? NSScreen.main ?? NSScreen.screens[0]
    }

    private func screen(with displayID: UInt32) -> NSScreen? {
        NSScreen.screens.first { $0.missionInvoiceDisplayID == displayID }
    }

    static func availableOriginRange(windowSize: CGSize, visibleFrame: CGRect) -> CGRect {
        let margin = PopupPosition.screenMargin
        let minimumX = visibleFrame.minX + margin
        let maximumX = max(minimumX, visibleFrame.maxX - margin - windowSize.width)
        let minimumY = visibleFrame.minY + margin
        let maximumY = max(minimumY, visibleFrame.maxY - margin - windowSize.height)
        return CGRect(
            x: minimumX,
            y: minimumY,
            width: maximumX - minimumX,
            height: maximumY - minimumY
        )
    }

    private func rememberProjectLogFile(_ path: String?) {
        guard let path, !path.isEmpty else { return }
        UserDefaults.standard.set(path, forKey: Self.lastProjectLogFileKey)
    }

    private func markConnectionActivity(at date: Date = .now) {
        hasSessionActivity = true
        lastConnectionActivityAt = date
        refreshConnectionState()
    }

    private func refreshConnectionState(establishBaseline: Bool = false) {
        let logFile = resolveLogFile(preferred: nil)
        let modificationDate = logFile.flatMap {
            try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        }

        if establishBaseline {
            observedLogModificationDate = modificationDate
        } else if let modificationDate,
                  let observedLogModificationDate,
                  modificationDate > observedLogModificationDate {
            self.observedLogModificationDate = modificationDate
            markConnectionActivity(at: modificationDate)
            reloadDashboard(preferredLogFile: logFile?.path)
            return
        } else if observedLogModificationDate == nil {
            observedLogModificationDate = modificationDate
        }

        connectionState = ConnectionState.resolve(
            popupEnabled: isPopupEnabled(),
            hasReadableLedger: logFile != nil,
            hasSessionActivity: hasSessionActivity
        )
    }

    private func isPopupEnabled() -> Bool {
        let settingsFile = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".codex-token-billing/settings.json")
        guard let data = try? Data(contentsOf: settingsFile),
              let settings = try? JSONDecoder().decode(BillingSettings.self, from: data)
        else { return false }
        return settings.popupEnabled == true
    }

    private func resolveLogFile(preferred: String?) -> URL? {
        let fileManager = FileManager.default
        let candidates = [
            preferred,
            UserDefaults.standard.string(forKey: Self.lastProjectLogFileKey)
        ]
        for path in candidates.compactMap({ $0 }) where fileManager.fileExists(atPath: path) {
            return URL(fileURLWithPath: path)
        }

        let projectsDirectory = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent(".codex-token-billing/projects", isDirectory: true)
        guard let projectDirectories = try? fileManager.contentsOfDirectory(
            at: projectsDirectory,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ) else { return nil }

        return projectDirectories
            .map { $0.appendingPathComponent("usage-log.json") }
            .filter { fileManager.fileExists(atPath: $0.path) }
            .max {
                let lhs = (try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                let rhs = (try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
                return lhs < rhs
            }
    }

    nonisolated static func date(from value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private static var taipeiCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Taipei") ?? .current
        return calendar
    }

    private static let lastProjectLogFileKey = "dashboard.lastProjectLogFile.v1"
}

private struct BillingSettings: Decodable {
    let popupEnabled: Bool?
}

private struct Ledger: Decodable {
    let records: [LedgerRecord]
}

private struct LedgerRecord: Decodable {
    struct Receipt: Decodable {
        let receiptNo: String?
        let lineItems: [ReceiptPayload.LineItem]?
        let accountUsageSnapshot: ReceiptPayload.AccountUsageSnapshot?
    }

    let id: String?
    let createdAt: String?
    let task: String?
    let category: String?
    let model: String?
    let endedAt: String?
    let durationMs: Int?
    let inputTokens: Int?
    let outputTokens: Int?
    let totalTokens: Int?
    let receiptFile: String?
    let receiptFileUrl: String?
    let accountUsageSnapshot: ReceiptPayload.AccountUsageSnapshot?
    let receipt: Receipt?

    var usageSnapshot: ReceiptPayload.AccountUsageSnapshot? {
        accountUsageSnapshot ?? receipt?.accountUsageSnapshot
    }

    func todayReceipt(endedAt: String) -> ReceiptStore.TodayReceipt {
        let payload = ReceiptPayload(
            version: 1,
            receiptNo: receipt?.receiptNo ?? id ?? "-",
            task: task ?? "未命名任務",
            category: category ?? "uncategorized",
            model: model ?? "未取得",
            endedAt: endedAt,
            durationMs: durationMs ?? 0,
            inputTokens: inputTokens ?? 0,
            outputTokens: outputTokens ?? 0,
            totalTokens: totalTokens ?? 0,
            lineItems: receipt?.lineItems ?? [],
            projectId: nil,
            projectLogFile: nil,
            receiptFileUrl: receiptFileUrl,
            accountUsageSnapshot: usageSnapshot
        )
        let fileURL = receiptFileUrl.flatMap(URL.init(string:))
            ?? receiptFile.map { URL(fileURLWithPath: $0) }
        return .init(id: id ?? payload.receiptNo, payload: payload, receiptFileURL: fileURL)
    }
}

private extension ReceiptPayload.AccountUsageSnapshot {
    var displayWindow: ReceiptPayload.RateLimitWindow? {
        preferredWindow ?? primary ?? secondary
    }
}
