import AppKit
import SwiftUI

enum PopupLayout {
    static let dashboardSize = CGSize(width: 221, height: 55)
    static let dashboardPadding: CGFloat = 10
    static let dashboardButtonSize = CGSize(width: 44, height: 35)
    static let todaySize = CGSize(width: 300, height: 260)
    static let receiptSize = CGSize(width: 265, height: 374)

    static func contentSize(
        isReceiptPresented: Bool,
        page: ReceiptStore.Page
    ) -> CGSize {
        if isReceiptPresented {
            return receiptSize
        }
        return page == .home ? dashboardSize : todaySize
    }

    static func showsMaterialBackground(isReceiptPresented: Bool) -> Bool {
        !isReceiptPresented
    }

    static func usesCapsuleBackground(
        isReceiptPresented: Bool,
        page: ReceiptStore.Page
    ) -> Bool {
        !isReceiptPresented && page == .home
    }
}

struct PopupRootView: View {
    @Environment(\.colorScheme) private var colorScheme

    let store: ReceiptStore

    var body: some View {
        Group {
            if store.isReceiptPresented {
                ReceiptPopupView(store: store)
            } else {
                switch store.page {
                case .home:
                    PopupHomeView(store: store)
                case .today:
                    TodayReceiptsView(store: store)
                }
            }
        }
        .frame(width: contentSize.width, height: contentSize.height)
        .background {
            if PopupLayout.showsMaterialBackground(
                isReceiptPresented: store.isReceiptPresented
            ) {
                if PopupLayout.usesCapsuleBackground(
                    isReceiptPresented: store.isReceiptPresented,
                    page: store.page
                ) {
                    Capsule().fill(
                        colorScheme == .light
                            ? Color.white
                            : Color(nsColor: .windowBackgroundColor)
                    )
                } else {
                    Rectangle().fill(.regularMaterial)
                }
            }
        }
        .background(FloatingWindowConfigurator(store: store, contentSize: contentSize))
        .onOpenURL { store.handle(url: $0) }
        .task { await store.monitorConnection() }
        .preferredColorScheme(store.preferences.appearance.colorScheme)
    }

    private var contentSize: CGSize {
        PopupLayout.contentSize(
            isReceiptPresented: store.isReceiptPresented,
            page: store.page
        )
    }
}

struct PopupHomeView: View {
    let store: ReceiptStore

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 8) {
                Circle()
                    .fill(connectionColor)
                    .frame(width: 11, height: 11)
                    .shadow(color: connectionColor.opacity(0.45), radius: 3)

                Text(remainingUsageText)
                    .font(.system(size: 22, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Codex 剩餘用量 \(remainingUsageText)，\(store.connectionState.title)")

            toolbarButton(
                resourceName: "history_dark",
                accessibilityLabel: "開啟本日發票",
                action: store.showToday
            )

            toolbarButton(
                resourceName: "setting_dark",
                accessibilityLabel: "開啟設定",
                action: store.showSettings
            )
        }
        .padding(PopupLayout.dashboardPadding)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Mission Invoice 剩餘用量")
    }

    private var remainingUsageText: String {
        store.remainingPercent.map { "\($0)%" } ?? "--%"
    }

    private func toolbarButton(
        resourceName: String,
        accessibilityLabel: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            templateImage(named: resourceName)
                .resizable()
                .scaledToFit()
                .frame(height: 32)
                .frame(
                    width: PopupLayout.dashboardButtonSize.width,
                    height: PopupLayout.dashboardButtonSize.height
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(.primary)
        .help(accessibilityLabel)
        .accessibilityLabel(accessibilityLabel)
    }

    private func templateImage(named name: String) -> Image {
        guard let source = NSImage(named: name),
              let image = source.copy() as? NSImage
        else {
            return Image(systemName: "questionmark")
        }
        image.isTemplate = true
        return Image(nsImage: image)
    }

    private var connectionColor: Color {
        switch store.connectionState {
        case .connected: .green
        case .waiting: .orange
        case .disconnected: .red
        }
    }
}
