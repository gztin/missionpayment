import AppKit
import os
import SwiftUI
import Testing
@testable import MissionInvoicePopup

@Suite(.serialized)
@MainActor
struct ReceiptStoreTests {
    @Test
    func connectionStateUsesRealConfigurationAndSessionActivity() {
        #expect(
            ReceiptStore.ConnectionState.resolve(
                popupEnabled: false,
                hasReadableLedger: true,
                hasSessionActivity: true
            ) == .disconnected
        )
        #expect(
            ReceiptStore.ConnectionState.resolve(
                popupEnabled: true,
                hasReadableLedger: true,
                hasSessionActivity: false
            ) == .waiting
        )
        #expect(
            ReceiptStore.ConnectionState.resolve(
                popupEnabled: true,
                hasReadableLedger: true,
                hasSessionActivity: true
            ) == .connected
        )
    }

    @Test
    func dashboardWindowStartsVisibleAndReceiptCanBeReused() {
        _ = NSApplication.shared
        let defaults = UserDefaults(suiteName: "ReceiptStoreTests")!
        defaults.removePersistentDomain(forName: "ReceiptStoreTests")
        let preferences = PopupPreferences(defaults: defaults)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 260),
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        let store = ReceiptStore(preferences: preferences)
        store.attach(window: window)

        #expect(window.isVisible)
        #expect(!store.isReceiptPresented)

        store.present(.sample, playSound: false)
        #expect(window.isVisible)
        #expect(store.isReceiptPresented)

        store.dismiss()
        #expect(window.isVisible)
        #expect(!store.isReceiptPresented)
        #expect(store.page == .home)

        store.present(.sample, playSound: false)
        #expect(window.isVisible)

        store.dismiss()
    }

    @Test
    func closingTodayRestoresDashboardWindow() {
        _ = NSApplication.shared
        let defaults = UserDefaults(suiteName: "TodayWindowFlowTests")!
        defaults.removePersistentDomain(forName: "TodayWindowFlowTests")
        let store = ReceiptStore(
            preferences: PopupPreferences(defaults: defaults)
        )
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 260),
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        store.attach(window: window)

        store.showToday()
        #expect(window.isVisible)
        #expect(store.page == .today)

        store.closeWindow()
        #expect(window.isVisible)
        #expect(store.page == .home)
        #expect(!store.isReceiptPresented)
    }

    @Test
    func todayReceiptListIdentifiesItemsByReceiptNumberNotTaskName() {
        let item = ReceiptStore.TodayReceipt(
            id: ReceiptPayload.sample.receiptNo,
            payload: .sample,
            receiptFileURL: nil
        )

        let label = TodayReceiptsView.receiptAccessibilityLabel(for: item)

        #expect(label.contains(ReceiptPayload.sample.receiptNo))
        #expect(!label.contains(ReceiptPayload.sample.task))
        #expect(label.contains("4,420 tokens"))
    }

    @Test
    func autoDismissContinuesWhileSettingsArePresented() async throws {
        _ = NSApplication.shared
        let defaults = UserDefaults(suiteName: "StrictAutoDismissTests")!
        defaults.removePersistentDomain(forName: "StrictAutoDismissTests")
        let preferences = PopupPreferences(defaults: defaults)
        preferences.setAutoDismissSeconds(5)
        let store = ReceiptStore(preferences: preferences)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 260),
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        store.attach(window: window)

        store.present(.sample, playSound: false)
        store.setSettingsPresented(true)
        #expect(window.isVisible)
        try await Task.sleep(for: .seconds(6))

        #expect(!store.isReceiptPresented)
        #expect(!window.isVisible)
    }

    @Test
    func popupLayoutUsesSizeForCurrentContent() {
        #expect(
            PopupLayout.contentSize(isReceiptPresented: false, page: .home)
                == CGSize(width: 233, height: 48)
        )
        #expect(
            PopupLayout.contentSize(
                isReceiptPresented: false,
                page: .home,
                usageText: "100000000000000%",
                resetTimeText: "重置時間：12月31日",
                resetCountText: "重置次數：2次"
            ).width
                > PopupLayout.dashboardMinimumSurfaceSize.width
                    + (PopupLayout.dashboardShadowInset * 2)
        )
        #expect(PopupLayout.dashboardMinimumSurfaceSize == CGSize(width: 225, height: 40))
        #expect(PopupLayout.dashboardShadowInset == 4)
        #expect(PopupLayout.dashboardHorizontalPadding == 10)
        #expect(PopupLayout.dashboardVerticalPadding == 5)
        #expect(PopupLayout.dashboardIconSize == 30)
        #expect(PopupLayout.connectionIndicatorSize == 10)
        #expect(PopupLayout.dashboardGroupSpacing == 15)
        #expect(PopupLayout.dashboardResetFontSize == 10)
        #expect(PopupLayout.dashboardResetLineSpacing == 5)
        #expect(PopupLayout.dashboardCornerRadius == 12.875)
        #expect(
            PopupLayout.contentSize(isReceiptPresented: false, page: .today)
                == CGSize(width: 292, height: 388)
        )
        #expect(PopupLayout.todaySurfaceSize == CGSize(width: 280, height: 376))
        #expect(
            PopupLayout.todayShadowInsets
                == SwiftUI.EdgeInsets(top: 2, leading: 6, bottom: 10, trailing: 6)
        )
        #expect(
            PopupLayout.contentSize(isReceiptPresented: true, page: .home)
                == CGSize(width: 292, height: 370)
        )
        #expect(PopupLayout.receiptSurfaceSize == CGSize(width: 280, height: 358))
        #expect(PopupLayout.receiptSize.width == PopupLayout.todaySize.width)
        #expect(PopupLayout.showsMaterialBackground(isReceiptPresented: false))
        #expect(PopupLayout.showsMaterialBackground(isReceiptPresented: true))
        #expect(PopupLayout.usesCapsuleBackground(isReceiptPresented: false, page: .home))
        #expect(!PopupLayout.usesCapsuleBackground(isReceiptPresented: false, page: .today))
        #expect(!PopupLayout.usesCapsuleBackground(isReceiptPresented: true, page: .home))
        #expect(!PopupLayout.usesWindowShadow(isReceiptPresented: false, page: .home))
        #expect(!PopupLayout.usesWindowShadow(isReceiptPresented: false, page: .today))
        #expect(!PopupLayout.usesWindowShadow(isReceiptPresented: true, page: .home))
        #expect(!PopupLayout.usesNativeCloseButton(isReceiptPresented: false, page: .home))
        #expect(!PopupLayout.usesNativeCloseButton(isReceiptPresented: false, page: .today))
        #expect(!PopupLayout.usesNativeCloseButton(isReceiptPresented: true, page: .today))
    }

    @Test
    func dashboardResetTimeUsesTaipeiMonthAndDay() {
        #expect(PopupHomeView.resetTimeText(for: nil) == "重置時間：--")
        #expect(
            PopupHomeView.resetTimeText(
                for: Date(timeIntervalSince1970: 1_785_903_353)
            ) == "重置時間：8月5日"
        )
        #expect(PopupHomeView.resetCountText(for: nil) == "重置次數：--")
        #expect(PopupHomeView.resetCountText(for: 1) == "重置次數：1次")
        #expect(PopupHomeView.resetCountText(for: 2) == "重置次數：2次")
    }

    @Test
    func dashboardUsesFullResetCreditCountInsteadOfRateLimitWindowCount() {
        #expect(usageSnapshot(availableResetCount: nil).rateLimitResetCredits == nil)
        #expect(
            usageSnapshot(availableResetCount: 0)
                .rateLimitResetCredits?.availableCount == 0
        )
        #expect(
            usageSnapshot(availableResetCount: 1)
                .rateLimitResetCredits?.availableCount == 1
        )
        #expect(
            usageSnapshot(availableResetCount: 2)
                .rateLimitResetCredits?.availableCount == 2
        )
    }

    @Test
    func accountUsageSnapshotDecodesOlderPayloadWithoutResetCredits() throws {
        let data = Data(
            """
            {
              "status": "available",
              "capturedAt": null,
              "primary": null,
              "secondary": null,
              "preferredWindow": null
            }
            """.utf8
        )

        let snapshot = try JSONDecoder().decode(
            ReceiptPayload.AccountUsageSnapshot.self,
            from: data
        )

        #expect(snapshot.rateLimitResetCredits == nil)
    }

    @Test
    func standardReceiptLineItemLabelsAreLocalizedForDisplay() {
        #expect(
            ReceiptPopupView.localizedLineItemLabel("Read and understand")
                == "閱讀與理解"
        )
        #expect(
            ReceiptPopupView.localizedLineItemLabel("Generate and summarize")
                == "生成與摘要"
        )
        #expect(
            ReceiptPopupView.localizedLineItemLabel("Custom item")
                == "Custom item"
        )
    }

    private func usageSnapshot(
        availableResetCount: Int?
    ) -> ReceiptPayload.AccountUsageSnapshot {
        .init(
            status: "available",
            capturedAt: "2026-07-29T06:28:26.270Z",
            primary: nil,
            secondary: nil,
            preferredWindow: nil,
            rateLimitResetCredits: availableResetCount.map {
                .init(availableCount: $0, credits: [])
            }
        )
    }

    @Test
    func settingsWindowCanOpenCloseAndReuseOneWindow() async throws {
        _ = NSApplication.shared
        let defaults = UserDefaults(suiteName: "SettingsWindowTests")!
        defaults.removePersistentDomain(forName: "SettingsWindowTests")
        let store = ReceiptStore(preferences: PopupPreferences(defaults: defaults))
        let controller = SettingsWindowController.shared
        let dashboardWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 300, height: 260),
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        store.attach(window: dashboardWindow)

        store.showSettings()
        #expect(controller.isVisible)
        #expect(store.isSettingsPresented)
        #expect(!dashboardWindow.isVisible)
        #expect(PopupSettingsLayout.contentSize == CGSize(width: 360, height: 460))
        #expect(PopupSettingsLayout.dismissSecondsStep == 5)
        controller.applyAppearance(.dark)
        #expect(controller.window?.appearance?.name == .darkAqua)
        controller.applyAppearance(.light)
        #expect(controller.window?.appearance?.name == .aqua)
        controller.applyAppearance(.system)
        #expect(controller.window?.appearance == nil)

        store.showSettings()
        #expect(controller.isVisible)
        #expect(store.isSettingsPresented)
        #expect(!dashboardWindow.isVisible)

        controller.close()
        #expect(!controller.isVisible)
        #expect(!store.isSettingsPresented)
        #expect(dashboardWindow.isVisible)
        #expect(store.page == .home)

        store.showSettings()
        store.showToday()
        #expect(!controller.isVisible)
        #expect(!store.isSettingsPresented)
        #expect(dashboardWindow.isVisible)
        #expect(store.page == .today)

        store.showSettings()
        store.present(.sample, playSound: false)
        #expect(!controller.isVisible)
        #expect(!store.isSettingsPresented)
        #expect(dashboardWindow.isVisible)
        #expect(store.isReceiptPresented)
        store.dismiss()

        store.showSettings()
        let settingsWindow = try #require(controller.window)
        controller.windowDidResignKey(
            Notification(name: NSWindow.didResignKeyNotification, object: settingsWindow)
        )
        try await Task.sleep(for: .milliseconds(100))
        #expect(!controller.isVisible)
        #expect(!store.isSettingsPresented)
        #expect(dashboardWindow.isVisible)
    }

    @Test
    func preferencesDefaultToTopRightAndTenSeconds() {
        let suiteName = "PopupPreferencesDefaultsTests"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)

        let preferences = PopupPreferences(defaults: defaults)

        #expect(preferences.position == .topRight)
        #expect(preferences.autoDismissEnabled)
        #expect(preferences.autoDismissSeconds == 10)
        #expect(preferences.soundEnabled)
        #expect(preferences.soundSource == .bundled)
        #expect(preferences.appearance == .system)
        #expect(preferences.receiptTheme == .standard)
        #expect(preferences.receiptTheme.title == "預設")
        #expect(defaults.integer(forKey: "preferences.schemaVersion") == 4)
    }

    @Test
    func oldPreferencesMigrateAutomaticDismissAndSoundToEnabled() {
        let suiteName = "PopupPreferencesMigrationTests"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        defaults.set(false, forKey: "popup.autoDismissEnabled")
        defaults.set(false, forKey: "sound.enabled")
        defaults.set(1, forKey: "preferences.schemaVersion")

        let preferences = PopupPreferences(defaults: defaults)

        #expect(preferences.autoDismissEnabled)
        #expect(preferences.soundEnabled)
        #expect(preferences.soundSource == .bundled)
        #expect(preferences.appearance == .system)
        #expect(defaults.integer(forKey: "preferences.schemaVersion") == 4)
    }

    @Test
    func currentManualPreferencesRemainDisabled() {
        let suiteName = "PopupPreferencesCurrentTests"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        defaults.set(false, forKey: "popup.autoDismissEnabled")
        defaults.set(false, forKey: "sound.enabled")
        defaults.set(2, forKey: "preferences.schemaVersion")

        let preferences = PopupPreferences(defaults: defaults)

        #expect(!preferences.autoDismissEnabled)
        #expect(!preferences.soundEnabled)
        #expect(preferences.soundSource == .bundled)
    }

    @Test
    func existingCustomSoundMigratesToCustomSource() {
        let suiteName = "PopupPreferencesCustomSoundMigrationTests"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        defaults.set("custom-sound.mp3", forKey: "sound.customFilename")
        defaults.set("my-sound.mp3", forKey: "sound.customDisplayName")
        defaults.set(2, forKey: "preferences.schemaVersion")

        let preferences = PopupPreferences(defaults: defaults)

        #expect(preferences.soundSource == .custom)
        #expect(preferences.customSoundFilename == "custom-sound.mp3")
        #expect(defaults.integer(forKey: "preferences.schemaVersion") == 4)
    }

    @Test
    func customSoundCanBeSelectedBeforeFileIsImported() {
        let suiteName = "PopupPreferencesEmptyCustomSoundTests"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        let preferences = PopupPreferences(defaults: defaults)
        let soundService = ReceiptSoundService(
            applicationSupportDirectory: FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
        )
        let store = ReceiptStore(preferences: preferences, soundService: soundService)

        store.setSoundSource(.custom)

        #expect(preferences.soundSource == .custom)
        #expect(preferences.customSoundFilename == nil)
        #expect(!store.playReceiptSound())
        #expect(preferences.soundSource == .custom)
    }

    @Test
    func appearanceCanBePersistedAndRestored() {
        let suiteName = "PopupPreferencesAppearanceTests"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)

        let preferences = PopupPreferences(defaults: defaults)
        preferences.appearance = .dark

        let restored = PopupPreferences(defaults: defaults)
        #expect(restored.appearance == .dark)
        #expect(restored.appearance.colorScheme == .dark)
        #expect(
            PopupAppearance.system.resolvedColorScheme(systemColorScheme: .light) == .light
        )
        #expect(
            PopupAppearance.system.resolvedColorScheme(systemColorScheme: .dark) == .dark
        )
        #expect(
            PopupAppearance.light.resolvedColorScheme(systemColorScheme: .dark) == .light
        )
        #expect(
            PopupAppearance.dark.resolvedColorScheme(systemColorScheme: .light) == .dark
        )
        #expect(PopupAppearance.system.nsAppearanceName == nil)
        #expect(PopupAppearance.light.nsAppearanceName == .aqua)
        #expect(PopupAppearance.dark.nsAppearanceName == .darkAqua)

        restored.appearance = .light
        #expect(PopupPreferences(defaults: defaults).appearance == .light)
    }

    @Test
    func floatingWindowAppliesSelectedAppearance() {
        let window = NSWindow()

        FloatingWindowConfigurator.applyAppearance(.dark, to: window)
        #expect(window.appearance?.name == .darkAqua)

        FloatingWindowConfigurator.applyAppearance(.light, to: window)
        #expect(window.appearance?.name == .aqua)

        FloatingWindowConfigurator.applyAppearance(.system, to: window)
        #expect(window.appearance == nil)
    }

    @Test
    func applicationAppliesSelectedAppearance() {
        let application = NSApplication.shared
        defer { application.appearance = nil }

        PopupAppearance.dark.apply(to: application)
        #expect(application.appearance?.name == .darkAqua)

        PopupAppearance.light.apply(to: application)
        #expect(application.appearance?.name == .aqua)

        PopupAppearance.system.apply(to: application)
        #expect(application.appearance == nil)
    }

    @Test
    func receiptThemeDefaultsToStandardAndPersists() {
        let suiteName = "PopupPreferencesReceiptThemeTests"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)

        let preferences = PopupPreferences(defaults: defaults)
        #expect(preferences.receiptTheme == .standard)
        #expect(preferences.receiptTheme.title == "預設")
        #expect(ReceiptTheme.allCases == [.standard, .neon2026])
        #expect(ReceiptTheme.neon2026.title == "iPlayground2026樣式")
        #expect(ReceiptTheme.standard.swatches.count == 4)
        #expect(ReceiptTheme.neon2026.swatches.map(\.hex) == [
            "#D2FF01", "#0B0B0B", "#EDEDED", "#A3A3A3"
        ])
        #expect(ReceiptTheme.standard.advanced(by: -1) == .neon2026)
        #expect(ReceiptTheme.neon2026.advanced(by: 1) == .standard)

        preferences.receiptTheme = .neon2026
        #expect(PopupPreferences(defaults: defaults).receiptTheme == .neon2026)
    }

    @Test
    func dismissSecondsAreClampedToFiveThroughTwenty() {
        #expect(PopupPreferences.clampedDismissSeconds(1) == 5)
        #expect(PopupPreferences.clampedDismissSeconds(10) == 10)
        #expect(PopupPreferences.clampedDismissSeconds(37) == 20)
    }

    @Test
    func gridOriginsRespectVisibleScreenFrame() {
        let visibleFrame = CGRect(x: 0, y: 24, width: 1_440, height: 876)
        let windowSize = CGSize(width: 336, height: 403)

        #expect(
            PopupPosition.topRight.origin(
                windowSize: windowSize,
                visibleFrame: visibleFrame
            ) == CGPoint(x: 1_094, y: 487)
        )
        #expect(
            PopupPosition.bottomLeft.origin(
                windowSize: windowSize,
                visibleFrame: visibleFrame
            ) == CGPoint(x: 10, y: 34)
        )
        #expect(
            PopupPosition.center.origin(
                windowSize: windowSize,
                visibleFrame: visibleFrame
            ) == CGPoint(x: 552, y: 260.5)
        )
        #expect(
            ReceiptStore.availableOriginRange(
                windowSize: windowSize,
                visibleFrame: visibleFrame
            ) == CGRect(x: 10, y: 34, width: 1_084, height: 453)
        )
    }

    @Test
    func soundFileSizeLimitsRejectEmptyAndOversizedFiles() {
        #expect(throws: ReceiptSoundError.emptyFile) {
            try ReceiptSoundService.validateFileSize(0)
        }
        #expect(throws: Never.self) {
            try ReceiptSoundService.validateFileSize(ReceiptSoundService.maximumFileSize)
        }
        #expect(throws: ReceiptSoundError.fileTooLarge) {
            try ReceiptSoundService.validateFileSize(ReceiptSoundService.maximumFileSize + 1)
        }
    }

    @Test
    func billingDirectoryRequiresSettingsOrProjects() throws {
        let testDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("MissionInvoiceDirectoryTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: testDirectory) }

        #expect(!BillingDirectoryAccess.isBillingDirectory(testDirectory))

        let projectsDirectory = testDirectory.appendingPathComponent("projects", isDirectory: true)
        try FileManager.default.createDirectory(
            at: projectsDirectory,
            withIntermediateDirectories: true
        )

        #expect(BillingDirectoryAccess.isBillingDirectory(testDirectory))
    }

    @Test
    func billingDirectoryAuthorizationIsRequiredWhenMissingOrInvalid() throws {
        let testDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("MissionInvoiceAuthorizationTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: testDirectory) }

        #expect(BillingDirectoryAccess.requiresAuthorization(for: nil))
        #expect(BillingDirectoryAccess.requiresAuthorization(for: testDirectory))

        let projectsDirectory = testDirectory.appendingPathComponent("projects", isDirectory: true)
        try FileManager.default.createDirectory(
            at: projectsDirectory,
            withIntermediateDirectories: true
        )

        #expect(!BillingDirectoryAccess.requiresAuthorization(for: testDirectory))
    }

    @Test
    func authorizingBillingDirectoryUpdatesObservableStoreState() throws {
        let suiteName = "BillingDirectoryObservationTests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }
        let access = BillingDirectoryAccess(defaults: defaults)
        let store = ReceiptStore(
            preferences: PopupPreferences(defaults: defaults),
            billingDirectoryAccess: access
        )
        let testDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("MissionInvoiceObservationTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: testDirectory) }
        try Data("{}".utf8).write(to: testDirectory.appendingPathComponent("settings.json"))
        let didObserveChange = OSAllocatedUnfairLock(initialState: false)

        withObservationTracking {
            _ = store.hasBillingDirectoryAccess
            _ = store.billingDirectoryName
        } onChange: {
            didObserveChange.withLock { $0 = true }
        }

        try store.authorizeBillingDirectory(testDirectory)

        #expect(didObserveChange.withLock { $0 })
        #expect(store.hasBillingDirectoryAccess)
        #expect(store.billingDirectoryName == testDirectory.lastPathComponent)
    }

    @Test
    func bundledSoundCanBeDecodedImportedAndPlayed() throws {
        let testDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("MissionInvoiceSoundTests-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: testDirectory) }
        let soundService = ReceiptSoundService(applicationSupportDirectory: testDirectory)
        let bundledURL = try #require(soundService.bundledSoundURL)

        let imported = try soundService.importCustomSound(from: bundledURL)

        #expect(imported.storedFilename == "custom-sound.mp3")
        #expect(imported.byteCount > 0)
        #expect(imported.duration > 0)
        #expect(imported.duration <= ReceiptSoundService.maximumDuration)
        #expect(soundService.customSoundURL(filename: imported.storedFilename) != nil)
        #expect(soundService.hasCustomSound(filename: imported.storedFilename))
        #expect(soundService.play(customFilename: imported.storedFilename))
    }

    @Test
    func fakeAudioWithSupportedExtensionIsRejected() throws {
        let testDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("MissionInvoiceFakeSoundTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: testDirectory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: testDirectory) }
        let fakeAudio = testDirectory.appendingPathComponent("fake.mp3")
        try Data("not an audio file".utf8).write(to: fakeAudio)
        let soundService = ReceiptSoundService(applicationSupportDirectory: testDirectory)

        #expect(throws: ReceiptSoundError.invalidAudio) {
            try soundService.importCustomSound(from: fakeAudio)
        }
    }
}
