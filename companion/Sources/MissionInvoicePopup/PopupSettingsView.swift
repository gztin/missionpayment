import AppKit
import SwiftUI
import UniformTypeIdentifiers

enum PopupSettingsLayout {
    static let contentSize = CGSize(width: 280, height: 560)
    static let dismissSecondsStep = 5
}

struct PopupSettingsView: View {
    let store: ReceiptStore
    @State private var soundError: SoundErrorPresentation?
    @State private var soundToRemove: String?

    private var preferences: PopupPreferences { store.preferences }

    var body: some View {
        Form {
            Section("外觀") {
                Picker("顯示模式", selection: appearanceBinding) {
                    ForEach(PopupAppearance.allCases) { appearance in
                        Text(appearance.title).tag(appearance)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("發票顯示位置") {
                positionGrid
                Text(positionDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("發票關閉") {
                Toggle("自動關閉", isOn: autoDismissBinding)
                    .toggleStyle(.switch)

                if preferences.autoDismissEnabled {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("秒數設定")
                            Spacer()
                            Text("\(preferences.autoDismissSeconds) 秒")
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                        }

                        Slider(
                            value: dismissSecondsBinding,
                            in: Double(PopupPreferences.minimumDismissSeconds)...Double(PopupPreferences.maximumDismissSeconds),
                            step: Double(PopupSettingsLayout.dismissSecondsStep)
                        )
                        .labelsHidden()
                        .frame(maxWidth: .infinity, alignment: .leading)

                        HStack {
                            Text("\(PopupPreferences.minimumDismissSeconds) 秒")
                            Spacer()
                            Text("\(PopupPreferences.maximumDismissSeconds) 秒")
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Text(preferences.autoDismissEnabled
                     ? "每張新發票出現時會重新計時。"
                     : "發票會持續顯示，直到按下「收起」。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("發票音效") {
                Toggle("音效", isOn: soundEnabledBinding)
                    .toggleStyle(.switch)

                Picker("來源", selection: soundSourceBinding) {
                    Text("預設").tag(ReceiptSoundSource.bundled)
                    Text("自訂")
                        .tag(ReceiptSoundSource.custom)
                }
                .pickerStyle(.segmented)
                .disabled(!preferences.soundEnabled)

                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(soundDisplayName)
                            .lineLimit(1)
                        Text(soundSourceDescription)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()

                    if preferences.soundSource == .custom {
                        Button("來源") {
                            chooseSound()
                        }

                        if preferences.customSoundFilename != nil {
                            Button("移除") {
                                soundToRemove = preferences.customSoundDisplayName
                                    ?? preferences.customSoundFilename
                            }
                        }
                    }
                }

                Button("播放測試") {
                    if !store.playReceiptSound() {
                        soundError = SoundErrorPresentation(message: "音效無法播放，請重新選擇檔案。")
                    }
                }
                .disabled(!canPlaySelectedSound)

                Text("支援 MP3、M4A、WAV、AIFF；最大 5 MB，最長 10 秒。檔案只會保存在這台 Mac。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(
            width: PopupSettingsLayout.contentSize.width,
            height: PopupSettingsLayout.contentSize.height
        )
        .preferredColorScheme(preferences.appearance.colorScheme)
        .alert(removalAlertTitle, isPresented: removalAlertIsPresented) {
            Button("取消", role: .cancel) {
                soundToRemove = nil
            }
            Button("移除", role: .destructive) {
                store.resetCustomSound()
                soundToRemove = nil
            }
        }
        .alert(item: $soundError) { error in
            Alert(
                title: Text("無法套用音效"),
                message: Text(error.message),
                dismissButton: .default(Text("好"))
            )
        }
    }

    private var removalAlertIsPresented: Binding<Bool> {
        Binding(
            get: { soundToRemove != nil },
            set: { isPresented in
                if !isPresented {
                    soundToRemove = nil
                }
            }
        )
    }

    private var removalAlertTitle: String {
        guard let soundToRemove else {
            return "是否要移除這個音效檔？"
        }
        return "是否要移除 \(soundToRemove)？"
    }

    private var canPlaySelectedSound: Bool {
        guard preferences.soundEnabled else { return false }
        switch preferences.soundSource {
        case .bundled:
            return true
        case .custom:
            return preferences.customSoundFilename != nil
        }
    }

    private var positionGrid: some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3),
            spacing: 8
        ) {
            ForEach(PopupPosition.gridPositions) { position in
                Button {
                    store.select(position: position)
                } label: {
                    RoundedRectangle(cornerRadius: 6)
                        .fill(preferences.position == position ? Color.accentColor : Color.secondary.opacity(0.14))
                        .frame(height: 42)
                        .overlay {
                            Circle()
                                .fill(preferences.position == position ? Color.white : Color.secondary)
                                .frame(width: 7, height: 7)
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(position.title)
                .accessibilityAddTraits(preferences.position == position ? .isSelected : [])
            }
        }
        .padding(.vertical, 4)
    }

    private var positionDescription: String {
        if preferences.position == .custom {
            return "目前為自訂位置。拖動發票可更新位置，選擇九宮格可恢復固定定位。"
        }
        return "目前位置：\(preferences.position.title)。你也可以直接拖動發票到任意位置。"
    }

    private var autoDismissBinding: Binding<Bool> {
        Binding(
            get: { preferences.autoDismissEnabled },
            set: { store.setAutoDismissEnabled($0) }
        )
    }

    private var appearanceBinding: Binding<PopupAppearance> {
        Binding(
            get: { preferences.appearance },
            set: { preferences.appearance = $0 }
        )
    }

    private var dismissSecondsBinding: Binding<Double> {
        Binding(
            get: { Double(preferences.autoDismissSeconds) },
            set: { store.setAutoDismissSeconds(Int($0.rounded())) }
        )
    }

    private var soundEnabledBinding: Binding<Bool> {
        Binding(
            get: { preferences.soundEnabled },
            set: { store.setSoundEnabled($0) }
        )
    }

    private var soundSourceBinding: Binding<ReceiptSoundSource> {
        Binding(
            get: { preferences.soundSource },
            set: { store.setSoundSource($0) }
        )
    }

    private var soundDisplayName: String {
        if preferences.soundSource == .custom {
            return preferences.customSoundDisplayName ?? "尚未選擇自訂音效"
        }
        return "預設收銀機音效"
    }

    private var soundSourceDescription: String {
        preferences.soundSource == .custom ? "本機自訂音效" : "App 內建音效（永久保留）"
    }

    private func chooseSound() {
        let panel = NSOpenPanel()
        panel.title = "選擇發票音效"
        panel.prompt = "套用音效"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [.mp3, .mpeg4Audio, .wav, .aiff]

        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            _ = try store.importCustomSound(from: url)
            if preferences.soundEnabled, !store.playReceiptSound() {
                soundError = SoundErrorPresentation(message: "音效已保存，但目前無法播放。")
            }
        } catch {
            soundError = SoundErrorPresentation(
                message: (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            )
        }
    }
}

private struct SoundErrorPresentation: Identifiable {
    let id = UUID()
    let message: String
}
