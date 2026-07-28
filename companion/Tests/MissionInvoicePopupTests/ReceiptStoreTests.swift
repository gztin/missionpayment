import AppKit
import Testing
@testable import MissionInvoicePopup

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
    func autoDismissContinuesWhileSettingsArePresented() async throws {
        _ = NSApplication.shared
        let defaults = UserDefaults(suiteName: "StrictAutoDismissTests")!
        defaults.removePersistentDomain(forName: "StrictAutoDismissTests")
        let preferences = PopupPreferences(defaults: defaults)
        preferences.setAutoDismissSeconds(5)
        let store = ReceiptStore(preferences: preferences)

        store.present(.sample, playSound: false)
        store.setSettingsPresented(true)
        try await Task.sleep(for: .seconds(6))

        #expect(!store.isReceiptPresented)
    }

    @Test
    func popupLayoutUsesSizeForCurrentContent() {
        #expect(
            PopupLayout.contentSize(isReceiptPresented: false, page: .home)
                == CGSize(width: 221, height: 55)
        )
        #expect(PopupLayout.dashboardPadding == 10)
        #expect(PopupLayout.dashboardButtonSize == CGSize(width: 44, height: 35))
        #expect(
            PopupLayout.contentSize(isReceiptPresented: false, page: .today)
                == CGSize(width: 300, height: 260)
        )
        #expect(
            PopupLayout.contentSize(isReceiptPresented: true, page: .home)
                == CGSize(width: 265, height: 374)
        )
        #expect(PopupLayout.showsMaterialBackground(isReceiptPresented: false))
        #expect(!PopupLayout.showsMaterialBackground(isReceiptPresented: true))
        #expect(PopupLayout.usesCapsuleBackground(isReceiptPresented: false, page: .home))
        #expect(!PopupLayout.usesCapsuleBackground(isReceiptPresented: false, page: .today))
        #expect(!PopupLayout.usesCapsuleBackground(isReceiptPresented: true, page: .home))
    }

    @Test
    func settingsWindowCanOpenCloseAndReuseOneWindow() {
        _ = NSApplication.shared
        let defaults = UserDefaults(suiteName: "SettingsWindowTests")!
        defaults.removePersistentDomain(forName: "SettingsWindowTests")
        let store = ReceiptStore(preferences: PopupPreferences(defaults: defaults))
        let controller = SettingsWindowController.shared

        controller.show(store: store)
        #expect(controller.isVisible)
        #expect(store.isSettingsPresented)

        controller.show(store: store)
        #expect(controller.isVisible)
        #expect(store.isSettingsPresented)

        controller.close()
        #expect(!controller.isVisible)
        #expect(!store.isSettingsPresented)
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
    func appearanceCanBePersistedAndRestored() {
        let suiteName = "PopupPreferencesAppearanceTests"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)

        let preferences = PopupPreferences(defaults: defaults)
        preferences.appearance = .dark

        let restored = PopupPreferences(defaults: defaults)
        #expect(restored.appearance == .dark)
        #expect(restored.appearance.colorScheme == .dark)

        restored.appearance = .light
        #expect(PopupPreferences(defaults: defaults).appearance == .light)
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
            ) == CGPoint(x: 1_054, y: 447)
        )
        #expect(
            PopupPosition.bottomLeft.origin(
                windowSize: windowSize,
                visibleFrame: visibleFrame
            ) == CGPoint(x: 50, y: 74)
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
            ) == CGRect(x: 50, y: 74, width: 1_004, height: 373)
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
