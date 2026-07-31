import AppKit
import SwiftUI
import UniformTypeIdentifiers

enum PopupSettingsLayout {
    static let contentSize = CGSize(width: 360, height: 460)
    static let dismissSecondsStep = 5
}

struct PopupSettingsView: View {
    let store: ReceiptStore
    @State private var selectedTab = PopupSettingsTab.data
    @State private var soundError: SoundErrorPresentation?
    @State private var soundToRemove: String?
    @State private var previewedTheme: ReceiptTheme?

    private var preferences: PopupPreferences { store.preferences }

    var body: some View {
        VStack(spacing: 0) {
            EqualWidthSegmentedControl(selection: $selectedTab)
                .frame(maxWidth: .infinity)
                .frame(height: 28)
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 10)

            Divider()

            selectedSettings
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(
            width: PopupSettingsLayout.contentSize.width,
            height: PopupSettingsLayout.contentSize.height
        )
        .popupAppearance(preferences.appearance)
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

    @ViewBuilder
    private var selectedSettings: some View {
        switch selectedTab {
        case .data:
            dataSettings
        case .appearance:
            appearanceSettings
        case .receipt:
            receiptSettings
        }
    }

    private var dataSettings: some View {
        Form {
            Section("Mission Invoice 資料") {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(store.billingDirectoryName ?? "尚未授權資料夾")
                            .lineLimit(1)
                        Text(store.hasBillingDirectoryAccess
                             ? "已取得唯讀權限"
                             : "授權後才能讀取歷史帳單與連線狀態")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button(store.hasBillingDirectoryAccess ? "重新選擇" : "選擇") {
                        chooseBillingDirectory()
                    }
                }
            }

            Section("發票顯示位置") {
                positionGrid
                Text(positionDescription)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
    }

    private var appearanceSettings: some View {
        Form {
            Section("外觀") {
                Picker("顯示模式", selection: appearanceBinding) {
                    ForEach(PopupAppearance.allCases) { appearance in
                        Text(appearance.title).tag(appearance)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("發票樣式") {
                receiptThemeCarousel
            }
        }
        .formStyle(.grouped)
    }

    private var receiptSettings: some View {
        Form {
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

                    soundTestButton

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

                Text("支援 MP3、M4A、WAV、AIFF；最大 5 MB，最長 10 秒。檔案只會保存在這台 Mac。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
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

    private var soundTestButton: some View {
        Button("播放測試") {
            if !store.playReceiptSound() {
                soundError = SoundErrorPresentation(message: "音效無法播放，請重新選擇檔案。")
            }
        }
        .disabled(!canPlaySelectedSound)
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

    private var receiptThemeCarousel: some View {
        let displayedTheme = previewedTheme ?? preferences.receiptTheme

        return VStack(spacing: 12) {
            ZStack {
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 0) {
                        ForEach(ReceiptTheme.allCases) { theme in
                            ReceiptThemePreview(theme: theme)
                                .containerRelativeFrame(.horizontal)
                                .id(theme)
                        }
                    }
                    .scrollTargetLayout()
                }
                .scrollIndicators(.hidden)
                .scrollTargetBehavior(.paging)
                .scrollPosition(id: $previewedTheme)

                HStack {
                    carouselButton(
                        systemName: "chevron.left",
                        accessibilityLabel: "上一個發票樣式",
                        offset: -1
                    )
                    Spacer()
                    carouselButton(
                        systemName: "chevron.right",
                        accessibilityLabel: "下一個發票樣式",
                        offset: 1
                    )
                }
                .padding(.horizontal, 4)
            }
            .frame(height: 220)

            HStack(spacing: 8) {
                ForEach(ReceiptTheme.allCases) { theme in
                    Circle()
                        .fill(theme == displayedTheme ? Color.accentColor : Color.secondary.opacity(0.3))
                        .frame(width: 7, height: 7)
                }
            }
            .accessibilityHidden(true)

            Text(displayedTheme.title)
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Text("色票組成")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack(spacing: 8) {
                    ForEach(displayedTheme.swatches) { swatch in
                        VStack(spacing: 4) {
                            RoundedRectangle(cornerRadius: 5)
                                .fill(swatch.color)
                                .frame(height: 32)
                                .overlay {
                                    RoundedRectangle(cornerRadius: 5)
                                        .stroke(Color.secondary.opacity(0.25), lineWidth: 1)
                                }
                            Text(swatch.title)
                                .font(.caption2)
                            Text(swatch.hex)
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }

            Button(displayedTheme == preferences.receiptTheme ? "已套用" : "套用") {
                preferences.receiptTheme = displayedTheme
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .frame(maxWidth: .infinity)
            .disabled(displayedTheme == preferences.receiptTheme)
        }
        .frame(maxWidth: .infinity)
        .onAppear {
            if previewedTheme == nil {
                previewedTheme = preferences.receiptTheme
            }
        }
    }

    private func carouselButton(
        systemName: String,
        accessibilityLabel: String,
        offset: Int
    ) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                previewedTheme = (previewedTheme ?? preferences.receiptTheme)
                    .advanced(by: offset)
            }
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.primary)
                .frame(width: 44, height: 44)
                .background {
                    Circle()
                        .fill(Color.secondary.opacity(0.14))
                }
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
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
            set: {
                preferences.appearance = $0
                $0.apply(to: NSApp)
                SettingsWindowController.shared.applyAppearance($0)
            }
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
        } catch {
            soundError = SoundErrorPresentation(
                message: (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            )
        }
    }

    private func chooseBillingDirectory() {
        do {
            try BillingDirectoryAuthorization.request(for: store)
        } catch {
            soundError = SoundErrorPresentation(
                message: (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            )
        }
    }
}

private enum PopupSettingsTab: Int, Hashable {
    case data
    case appearance
    case receipt
}

private struct ReceiptThemePreview: View {
    let theme: ReceiptTheme

    private var palette: ReceiptThemePalette { theme.palette }

    var body: some View {
        ZStack {
            ReceiptCardShape()
                .fill(palette.paper)
                .shadow(color: palette.shadow, radius: 6, y: 4)

            ReceiptPopupView(
                previewing: .themePreview,
                palette: palette
            )
        }
        .frame(
            width: PopupLayout.receiptSurfaceSize.width,
            height: PopupLayout.receiptSurfaceSize.height
        )
        .scaleEffect(0.56)
        .frame(
            width: PopupLayout.receiptSurfaceSize.width * 0.56,
            height: PopupLayout.receiptSurfaceSize.height * 0.56
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(theme.title)發票預覽")
    }
}

private extension ReceiptPayload {
    static let themePreview = ReceiptPayload(
        version: 1,
        receiptNo: "TX-2607-2026",
        task: "發票樣式預覽",
        category: "frontend-review",
        model: "未取得",
        endedAt: "2026-07-31T00:00:00.000Z",
        durationMs: 0,
        inputTokens: 2_600,
        outputTokens: 700,
        totalTokens: 3_300,
        lineItems: [
            .init(label: "Read and understand", tokens: 2_600),
            .init(label: "Generate and summarize", tokens: 700)
        ],
        projectId: nil,
        projectLogFile: nil,
        receiptFileUrl: nil,
        accountUsageSnapshot: nil
    )
}

private struct EqualWidthSegmentedControl: NSViewRepresentable {
    @Environment(\.colorScheme) private var colorScheme
    @Binding var selection: PopupSettingsTab

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> NSSegmentedControl {
        let control = NSSegmentedControl(
            labels: ["資料", "外觀", "發票"],
            trackingMode: .selectOne,
            target: context.coordinator,
            action: #selector(Coordinator.selectionChanged(_:))
        )
        control.segmentStyle = .rounded
        control.segmentDistribution = .fillEqually
        control.selectedSegment = selection.rawValue
        control.setContentHuggingPriority(.defaultLow, for: .horizontal)
        control.setAccessibilityLabel("設定分類")
        updateAppearance(of: control)
        return control
    }

    func updateNSView(_ control: NSSegmentedControl, context: Context) {
        context.coordinator.parent = self
        control.selectedSegment = selection.rawValue
        updateAppearance(of: control)
    }

    private func updateAppearance(of control: NSSegmentedControl) {
        control.appearance = NSAppearance(
            named: colorScheme == .dark ? .darkAqua : .aqua
        )
        control.needsDisplay = true
    }

    @MainActor
    final class Coordinator: NSObject {
        var parent: EqualWidthSegmentedControl

        init(parent: EqualWidthSegmentedControl) {
            self.parent = parent
        }

        @objc func selectionChanged(_ sender: NSSegmentedControl) {
            guard let tab = PopupSettingsTab(rawValue: sender.selectedSegment) else { return }
            parent.selection = tab
        }
    }
}

private struct SoundErrorPresentation: Identifiable {
    let id = UUID()
    let message: String
}
