import AppKit
import Foundation
import Observation
import SwiftUI

enum PopupAppearance: String, CaseIterable, Identifiable, Sendable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: "跟隨系統"
        case .light: "淺色"
        case .dark: "深色"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }

    var nsAppearanceName: NSAppearance.Name? {
        switch self {
        case .system: nil
        case .light: .aqua
        case .dark: .darkAqua
        }
    }

    func resolvedColorScheme(systemColorScheme: ColorScheme) -> ColorScheme {
        colorScheme ?? systemColorScheme
    }

    @MainActor
    func apply(to application: NSApplication) {
        application.appearance = nsAppearanceName.flatMap(NSAppearance.init)
    }
}

private struct PopupAppearanceModifier: ViewModifier {
    @Environment(\.colorScheme) private var systemColorScheme

    let appearance: PopupAppearance

    @ViewBuilder
    func body(content: Content) -> some View {
        content
            .environment(
                \.colorScheme,
                appearance.resolvedColorScheme(systemColorScheme: systemColorScheme)
            )
    }
}

extension View {
    func popupAppearance(_ appearance: PopupAppearance) -> some View {
        modifier(PopupAppearanceModifier(appearance: appearance))
    }
}

enum PopupPosition: String, CaseIterable, Identifiable, Sendable {
    static let screenMargin: CGFloat = 10

    case topLeft
    case topCenter
    case topRight
    case middleLeft
    case center
    case middleRight
    case bottomLeft
    case bottomCenter
    case bottomRight
    case custom

    static let gridPositions: [PopupPosition] = [
        .topLeft, .topCenter, .topRight,
        .middleLeft, .center, .middleRight,
        .bottomLeft, .bottomCenter, .bottomRight
    ]

    var id: String { rawValue }

    var title: String {
        switch self {
        case .topLeft: "左上"
        case .topCenter: "上方中央"
        case .topRight: "右上"
        case .middleLeft: "左側中央"
        case .center: "螢幕中央"
        case .middleRight: "右側中央"
        case .bottomLeft: "左下"
        case .bottomCenter: "下方中央"
        case .bottomRight: "右下"
        case .custom: "自訂位置"
        }
    }

    func origin(
        windowSize: CGSize,
        visibleFrame: CGRect,
        margin: CGFloat = PopupPosition.screenMargin
    ) -> CGPoint {
        let minimumX = visibleFrame.minX + margin
        let maximumX = max(minimumX, visibleFrame.maxX - margin - windowSize.width)
        let minimumY = visibleFrame.minY + margin
        let maximumY = max(minimumY, visibleFrame.maxY - margin - windowSize.height)
        let centerX = minimumX + (maximumX - minimumX) / 2
        let centerY = minimumY + (maximumY - minimumY) / 2

        switch self {
        case .topLeft:
            return CGPoint(x: minimumX, y: maximumY)
        case .topCenter:
            return CGPoint(x: centerX, y: maximumY)
        case .topRight:
            return CGPoint(x: maximumX, y: maximumY)
        case .middleLeft:
            return CGPoint(x: minimumX, y: centerY)
        case .center, .custom:
            return CGPoint(x: centerX, y: centerY)
        case .middleRight:
            return CGPoint(x: maximumX, y: centerY)
        case .bottomLeft:
            return CGPoint(x: minimumX, y: minimumY)
        case .bottomCenter:
            return CGPoint(x: centerX, y: minimumY)
        case .bottomRight:
            return CGPoint(x: maximumX, y: minimumY)
        }
    }
}

enum ReceiptSoundSource: String, CaseIterable, Identifiable, Sendable {
    case bundled
    case custom

    var id: String { rawValue }

    var title: String {
        switch self {
        case .bundled: "預設音效"
        case .custom: "自訂音效"
        }
    }
}

@MainActor
@Observable
final class PopupPreferences {
    static let shared = PopupPreferences()

    static let currentSchemaVersion = 4
    static let minimumDismissSeconds = 5
    static let maximumDismissSeconds = 20

    var position: PopupPosition {
        didSet { defaults.set(position.rawValue, forKey: Keys.position) }
    }

    var autoDismissEnabled: Bool {
        didSet { defaults.set(autoDismissEnabled, forKey: Keys.autoDismissEnabled) }
    }

    var soundEnabled: Bool {
        didSet { defaults.set(soundEnabled, forKey: Keys.soundEnabled) }
    }

    var appearance: PopupAppearance {
        didSet { defaults.set(appearance.rawValue, forKey: Keys.appearance) }
    }

    var receiptTheme: ReceiptTheme {
        didSet { defaults.set(receiptTheme.rawValue, forKey: Keys.receiptTheme) }
    }

    private(set) var soundSource: ReceiptSoundSource {
        didSet { defaults.set(soundSource.rawValue, forKey: Keys.soundSource) }
    }

    private(set) var autoDismissSeconds: Int {
        didSet { defaults.set(autoDismissSeconds, forKey: Keys.autoDismissSeconds) }
    }

    private(set) var customX: Double {
        didSet { defaults.set(customX, forKey: Keys.customX) }
    }

    private(set) var customY: Double {
        didSet { defaults.set(customY, forKey: Keys.customY) }
    }

    private(set) var customDisplayID: UInt32? {
        didSet {
            if let customDisplayID {
                defaults.set(Int(customDisplayID), forKey: Keys.customDisplayID)
            } else {
                defaults.removeObject(forKey: Keys.customDisplayID)
            }
        }
    }

    private(set) var customSoundFilename: String? {
        didSet { defaults.set(customSoundFilename, forKey: Keys.customSoundFilename) }
    }

    private(set) var customSoundDisplayName: String? {
        didSet { defaults.set(customSoundDisplayName, forKey: Keys.customSoundDisplayName) }
    }

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let storedSchemaVersion = defaults.integer(forKey: Keys.schemaVersion)
        position = PopupPosition(
            rawValue: defaults.string(forKey: Keys.position) ?? ""
        ) ?? .topRight

        if storedSchemaVersion < 2
            || defaults.object(forKey: Keys.autoDismissEnabled) == nil {
            autoDismissEnabled = true
        } else {
            autoDismissEnabled = defaults.bool(forKey: Keys.autoDismissEnabled)
        }

        if storedSchemaVersion < 2
            || defaults.object(forKey: Keys.soundEnabled) == nil {
            soundEnabled = true
        } else {
            soundEnabled = defaults.bool(forKey: Keys.soundEnabled)
        }

        appearance = PopupAppearance(
            rawValue: defaults.string(forKey: Keys.appearance) ?? ""
        ) ?? .system
        receiptTheme = ReceiptTheme(
            rawValue: defaults.string(forKey: Keys.receiptTheme) ?? ""
        ) ?? .standard

        let storedSeconds = defaults.object(forKey: Keys.autoDismissSeconds) as? Int ?? 10
        autoDismissSeconds = Self.clampedDismissSeconds(storedSeconds)
        customX = Self.clampedRatio(defaults.object(forKey: Keys.customX) as? Double ?? 1)
        customY = Self.clampedRatio(defaults.object(forKey: Keys.customY) as? Double ?? 1)

        if defaults.object(forKey: Keys.customDisplayID) != nil {
            customDisplayID = UInt32(clamping: defaults.integer(forKey: Keys.customDisplayID))
        } else {
            customDisplayID = nil
        }
        let storedCustomSoundFilename = defaults.string(forKey: Keys.customSoundFilename)
        customSoundFilename = storedCustomSoundFilename
        customSoundDisplayName = defaults.string(forKey: Keys.customSoundDisplayName)
        if let storedSource = ReceiptSoundSource(
            rawValue: defaults.string(forKey: Keys.soundSource) ?? ""
        ) {
            soundSource = storedSource
        } else {
            soundSource = storedCustomSoundFilename == nil ? .bundled : .custom
        }

        if storedSchemaVersion < Self.currentSchemaVersion {
            defaults.set(soundSource.rawValue, forKey: Keys.soundSource)
            defaults.set(Self.currentSchemaVersion, forKey: Keys.schemaVersion)
        }
    }

    func setAutoDismissSeconds(_ seconds: Int) {
        autoDismissSeconds = Self.clampedDismissSeconds(seconds)
    }

    func setCustomPosition(x: Double, y: Double, displayID: UInt32?) {
        customX = Self.clampedRatio(x)
        customY = Self.clampedRatio(y)
        customDisplayID = displayID
        position = .custom
    }

    func resetCustomPosition(to position: PopupPosition) {
        customDisplayID = nil
        self.position = position == .custom ? .topRight : position
    }

    func setCustomSound(filename: String, displayName: String) {
        customSoundFilename = filename
        customSoundDisplayName = displayName
        soundSource = .custom
    }

    func setSoundSource(_ source: ReceiptSoundSource) {
        soundSource = source
    }

    func resetCustomSound() {
        customSoundFilename = nil
        customSoundDisplayName = nil
        soundSource = .bundled
    }

    static func clampedDismissSeconds(_ seconds: Int) -> Int {
        min(max(seconds, minimumDismissSeconds), maximumDismissSeconds)
    }

    static func clampedRatio(_ value: Double) -> Double {
        min(max(value, 0), 1)
    }

    private enum Keys {
        static let schemaVersion = "preferences.schemaVersion"
        static let position = "popup.position"
        static let autoDismissEnabled = "popup.autoDismissEnabled"
        static let autoDismissSeconds = "popup.autoDismissSeconds"
        static let soundEnabled = "sound.enabled"
        static let appearance = "appearance.mode"
        static let receiptTheme = "receipt.theme"
        static let soundSource = "sound.source"
        static let customSoundFilename = "sound.customFilename"
        static let customSoundDisplayName = "sound.customDisplayName"
        static let customX = "popup.customX"
        static let customY = "popup.customY"
        static let customDisplayID = "popup.customDisplayID"
    }
}

extension NSScreen {
    var missionInvoiceDisplayID: UInt32? {
        (deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value
    }
}
