import AVFAudio
import Foundation

struct ImportedSound: Equatable, Sendable {
    let storedFilename: String
    let displayName: String
    let duration: TimeInterval
    let byteCount: Int
}

enum ReceiptSoundError: LocalizedError, Equatable {
    case unsupportedFormat
    case emptyFile
    case fileTooLarge
    case invalidAudio
    case audioTooLong
    case storageUnavailable

    var errorDescription: String? {
        switch self {
        case .unsupportedFormat:
            "只支援 MP3、M4A、WAV、AIFF 音效檔。"
        case .emptyFile:
            "音效檔沒有內容。"
        case .fileTooLarge:
            "音效檔不可超過 5 MB。"
        case .invalidAudio:
            "檔案不是可播放的音訊，或音訊已損壞。"
        case .audioTooLong:
            "音效長度不可超過 10 秒。"
        case .storageUnavailable:
            "無法將音效保存到本機 Application Support。"
        }
    }
}

@MainActor
final class ReceiptSoundService {
    static let maximumFileSize = 5 * 1_024 * 1_024
    static let maximumDuration: TimeInterval = 10
    static let supportedExtensions = ["mp3", "m4a", "wav", "aiff", "aif"]

    private let fileManager: FileManager
    private let audioDirectory: URL
    private var player: AVAudioPlayer?

    init(
        fileManager: FileManager = .default,
        applicationSupportDirectory: URL? = nil
    ) {
        self.fileManager = fileManager
        let baseDirectory = applicationSupportDirectory
            ?? fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? fileManager.temporaryDirectory
        audioDirectory = baseDirectory
            .appendingPathComponent("Mission Invoice", isDirectory: true)
            .appendingPathComponent("Audio", isDirectory: true)
    }

    var bundledSoundURL: URL? {
#if SWIFT_PACKAGE
        Bundle.module.url(forResource: "cash-register", withExtension: "mp3")
#else
        Bundle.main.url(forResource: "cash-register", withExtension: "mp3")
#endif
    }

    func customSoundURL(filename: String?) -> URL? {
        guard let filename, !filename.isEmpty else { return nil }
        return audioDirectory.appendingPathComponent(filename, isDirectory: false)
    }

    func hasCustomSound(filename: String?) -> Bool {
        guard let url = customSoundURL(filename: filename) else { return false }
        return fileManager.fileExists(atPath: url.path)
    }

    @discardableResult
    func play(customFilename: String?, allowFallback: Bool = true) -> Bool {
        if let customURL = customSoundURL(filename: customFilename),
           fileManager.fileExists(atPath: customURL.path),
           play(url: customURL) {
            return true
        }
        guard allowFallback, let bundledSoundURL else { return false }
        return play(url: bundledSoundURL)
    }

    @discardableResult
    func play(url: URL) -> Bool {
        do {
            player?.stop()
            let newPlayer = try AVAudioPlayer(contentsOf: url)
            guard newPlayer.prepareToPlay() else { return false }
            player = newPlayer
            return newPlayer.play()
        } catch {
            return false
        }
    }

    func importCustomSound(from sourceURL: URL) throws -> ImportedSound {
        let didAccess = sourceURL.startAccessingSecurityScopedResource()
        defer {
            if didAccess {
                sourceURL.stopAccessingSecurityScopedResource()
            }
        }

        let extensionName = sourceURL.pathExtension.lowercased()
        guard Self.supportedExtensions.contains(extensionName) else {
            throw ReceiptSoundError.unsupportedFormat
        }

        let values = try sourceURL.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey, .nameKey])
        guard values.isRegularFile == true else {
            throw ReceiptSoundError.invalidAudio
        }
        let fileSize = values.fileSize ?? 0
        try Self.validateFileSize(fileSize)

        let probe: AVAudioPlayer
        do {
            probe = try AVAudioPlayer(contentsOf: sourceURL)
        } catch {
            throw ReceiptSoundError.invalidAudio
        }
        guard probe.duration.isFinite, probe.duration > 0 else {
            throw ReceiptSoundError.invalidAudio
        }
        guard probe.duration <= Self.maximumDuration else {
            throw ReceiptSoundError.audioTooLong
        }

        do {
            try fileManager.createDirectory(at: audioDirectory, withIntermediateDirectories: true)
            let targetFilename = "custom-sound.\(extensionName)"
            let targetURL = audioDirectory.appendingPathComponent(targetFilename)

            if sourceURL.standardizedFileURL != targetURL.standardizedFileURL {
                let incomingURL = audioDirectory.appendingPathComponent(
                    ".incoming-\(UUID().uuidString).\(extensionName)"
                )
                defer { try? fileManager.removeItem(at: incomingURL) }
                try fileManager.copyItem(at: sourceURL, to: incomingURL)
                if fileManager.fileExists(atPath: targetURL.path) {
                    try fileManager.removeItem(at: targetURL)
                }
                try fileManager.moveItem(at: incomingURL, to: targetURL)
            }

            let otherFiles = try fileManager.contentsOfDirectory(
                at: audioDirectory,
                includingPropertiesForKeys: nil
            )
            for file in otherFiles
            where file.lastPathComponent.hasPrefix("custom-sound.")
                && file.lastPathComponent != targetFilename {
                try? fileManager.removeItem(at: file)
            }

            return ImportedSound(
                storedFilename: targetFilename,
                displayName: values.name ?? sourceURL.lastPathComponent,
                duration: probe.duration,
                byteCount: fileSize
            )
        } catch {
            throw ReceiptSoundError.storageUnavailable
        }
    }

    func removeCustomSound(filename: String?) {
        guard let url = customSoundURL(filename: filename) else { return }
        try? fileManager.removeItem(at: url)
    }

    static func validateFileSize(_ byteCount: Int) throws {
        guard byteCount > 0 else { throw ReceiptSoundError.emptyFile }
        guard byteCount <= maximumFileSize else { throw ReceiptSoundError.fileTooLarge }
    }
}
