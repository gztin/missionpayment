import AppKit
import SwiftUI

enum PopupLayout {
    static let dashboardMinimumSurfaceSize = CGSize(width: 225, height: 40)
    static let dashboardShadowInset: CGFloat = 4
    static let dashboardHorizontalPadding: CGFloat = 10
    static let dashboardVerticalPadding: CGFloat = 5
    static let dashboardIconSize: CGFloat = 30
    static let connectionIndicatorSize: CGFloat = 10
    static let dashboardItemSpacing: CGFloat = 5
    static let dashboardGroupSpacing: CGFloat = 15
    static let dashboardResetFontSize: CGFloat = 10
    static let dashboardResetLineSpacing: CGFloat = 5
    static let dashboardCornerRadius: CGFloat = 12.875
    static let todaySurfaceSize = CGSize(width: 280, height: 376)
    static let todayShadowInsets = EdgeInsets(
        top: 2,
        leading: 6,
        bottom: 10,
        trailing: 6
    )
    static let todaySize = CGSize(
        width: todaySurfaceSize.width
            + todayShadowInsets.leading
            + todayShadowInsets.trailing,
        height: todaySurfaceSize.height
            + todayShadowInsets.top
            + todayShadowInsets.bottom
    )
    static let receiptSurfaceSize = CGSize(width: 280, height: 358)
    static let receiptSize = CGSize(
        width: receiptSurfaceSize.width
            + todayShadowInsets.leading
            + todayShadowInsets.trailing,
        height: receiptSurfaceSize.height
            + todayShadowInsets.top
            + todayShadowInsets.bottom
    )

    static func contentSize(
        isReceiptPresented: Bool,
        page: ReceiptStore.Page,
        usageText: String = "--%",
        resetTimeText: String = "重置時間：--",
        resetCountText: String = "重置次數：--"
    ) -> CGSize {
        if isReceiptPresented {
            return receiptSize
        }
        return page == .home
            ? dashboardSize(
                usageText: usageText,
                resetTimeText: resetTimeText,
                resetCountText: resetCountText
            )
            : todaySize
    }

    static func dashboardSize(
        usageText: String,
        resetTimeText: String,
        resetCountText: String
    ) -> CGSize {
        let usageFont = NSFont.systemFont(ofSize: 25, weight: .bold)
        let textWidth = ceil(
            (usageText as NSString).size(withAttributes: [.font: usageFont]).width
        )
        let resetFont = NSFont.systemFont(
            ofSize: dashboardResetFontSize,
            weight: .regular
        )
        let resetTextWidth = ceil(
            max(
                (resetTimeText as NSString)
                    .size(withAttributes: [.font: resetFont])
                    .width,
                (resetCountText as NSString)
                    .size(withAttributes: [.font: resetFont])
                    .width
            )
        )
        let leadingContentWidth = dashboardIconSize
            + connectionIndicatorSize
            + textWidth
            + (dashboardItemSpacing * 2)
        let requiredSurfaceWidth = ceil(
            (dashboardHorizontalPadding * 2)
                + leadingContentWidth
                + dashboardGroupSpacing
                + resetTextWidth
        )
        return CGSize(
            width: max(
                dashboardMinimumSurfaceSize.width,
                requiredSurfaceWidth
            ) + (dashboardShadowInset * 2),
            height: dashboardMinimumSurfaceSize.height + (dashboardShadowInset * 2)
        )
    }

    static func showsMaterialBackground(isReceiptPresented: Bool) -> Bool {
        true
    }

    static func usesCapsuleBackground(
        isReceiptPresented: Bool,
        page: ReceiptStore.Page
    ) -> Bool {
        !isReceiptPresented && page == .home
    }

    static func usesWindowShadow(
        isReceiptPresented: Bool,
        page: ReceiptStore.Page
    ) -> Bool {
        false
    }

    static func usesNativeCloseButton(
        isReceiptPresented: Bool,
        page: ReceiptStore.Page
    ) -> Bool {
        false
    }
}

struct PopupRootView: View {
    @Environment(\.colorScheme) private var colorScheme

    let store: ReceiptStore

    var body: some View {
        Group {
            if store.isReceiptPresented {
                ReceiptPopupView(store: store)
                    .padding(PopupLayout.todayShadowInsets)
            } else {
                switch store.page {
                case .home:
                    PopupHomeView(store: store)
                case .today:
                    TodayReceiptsView(store: store)
                        .padding(PopupLayout.todayShadowInsets)
                }
            }
        }
        .frame(width: contentSize.width, height: contentSize.height)
        .background {
            if PopupLayout.showsMaterialBackground(
                isReceiptPresented: store.isReceiptPresented
            ) {
                if store.isReceiptPresented {
                    ReceiptCardShape()
                        .fill(
                            Color(
                                red: 247 / 255,
                                green: 245 / 255,
                                blue: 240 / 255
                            )
                        )
                        .shadow(
                            color: Color.black.opacity(0.18),
                            radius: 6,
                            x: 0,
                            y: 4
                        )
                        .padding(PopupLayout.todayShadowInsets)
                } else if PopupLayout.usesCapsuleBackground(
                    isReceiptPresented: store.isReceiptPresented,
                    page: store.page
                ) {
                    RoundedRectangle(
                        cornerRadius: PopupLayout.dashboardCornerRadius,
                        style: .continuous
                    )
                        .fill(
                            colorScheme == .light
                                ? Color.white
                                : Color(nsColor: .windowBackgroundColor)
                        )
                        .shadow(
                            color: Color.black.opacity(
                                colorScheme == .light ? 0.12 : 0.24
                            ),
                            radius: 3,
                            x: 0,
                            y: 1
                        )
                        .padding(PopupLayout.dashboardShadowInset)
                } else {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(
                            Color(
                                red: 247 / 255,
                                green: 245 / 255,
                                blue: 240 / 255
                            )
                        )
                        .shadow(
                            color: Color.black.opacity(0.18),
                            radius: 6,
                            x: 0,
                            y: 4
                        )
                        .padding(PopupLayout.todayShadowInsets)
                }
            }
        }
        .background(
            FloatingWindowConfigurator(
                store: store,
                windowSize: windowSize,
                hasShadow: PopupLayout.usesWindowShadow(
                    isReceiptPresented: store.isReceiptPresented,
                    page: store.page
                ),
                showsCloseButton: PopupLayout.usesNativeCloseButton(
                    isReceiptPresented: store.isReceiptPresented,
                    page: store.page
                )
            )
        )
        .onOpenURL { store.handle(url: $0) }
        .task { await store.monitorConnection() }
        .preferredColorScheme(store.preferences.appearance.colorScheme)
    }

    private var contentSize: CGSize {
        PopupLayout.contentSize(
            isReceiptPresented: store.isReceiptPresented,
            page: store.page,
            usageText: remainingUsageText,
            resetTimeText: PopupHomeView.resetTimeText(for: store.usageResetsAt),
            resetCountText: PopupHomeView.resetCountText(for: store.availableResetCount)
        )
    }

    private var windowSize: CGSize {
        contentSize
    }

    private var remainingUsageText: String {
        store.remainingPercent.map { "\($0)%" } ?? "--%"
    }
}

struct PopupHomeView: View {
    @Environment(\.colorScheme) private var colorScheme

    let store: ReceiptStore

    var body: some View {
        HStack(spacing: PopupLayout.dashboardGroupSpacing) {
            HStack(spacing: PopupLayout.dashboardItemSpacing) {
                codexIcon
                    .resizable()
                    .scaledToFill()
                    .frame(
                        width: PopupLayout.dashboardIconSize,
                        height: PopupLayout.dashboardIconSize
                    )
                    .clipShape(Circle())
                    .accessibilityHidden(true)

                HStack(spacing: PopupLayout.dashboardItemSpacing) {
                    Circle()
                        .fill(connectionColor)
                        .frame(
                            width: PopupLayout.connectionIndicatorSize,
                            height: PopupLayout.connectionIndicatorSize
                        )
                        .shadow(color: connectionColor.opacity(0.45), radius: 3)

                    Text(remainingUsageText)
                        .font(.system(size: 25, weight: .bold))
                        .monospacedDigit()
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(
                "Codex 剩餘用量 \(remainingUsageText)，\(store.connectionState.title)"
            )

            VStack(alignment: .leading, spacing: PopupLayout.dashboardResetLineSpacing) {
                Text(resetTimeText)
                Text(resetCountText)
            }
            .font(.system(size: PopupLayout.dashboardResetFontSize))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, PopupLayout.dashboardHorizontalPadding)
        .padding(.vertical, PopupLayout.dashboardVerticalPadding)
        .padding(PopupLayout.dashboardShadowInset)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Mission Invoice，剩餘用量 \(remainingUsageText)，"
                + "\(store.connectionState.title)，\(resetTimeText)，\(resetCountText)"
        )
    }

    private var remainingUsageText: String {
        store.remainingPercent.map { "\($0)%" } ?? "--%"
    }

    private var resetTimeText: String {
        Self.resetTimeText(for: store.usageResetsAt)
    }

    private var resetCountText: String {
        Self.resetCountText(for: store.availableResetCount)
    }

    static func resetTimeText(for date: Date?) -> String {
        guard let date else { return "重置時間：--" }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "zh_TW")
        formatter.timeZone = TimeZone(identifier: "Asia/Taipei")
        formatter.dateFormat = "M月d日"
        return "重置時間：\(formatter.string(from: date))"
    }

    static func resetCountText(for count: Int?) -> String {
        guard let count else { return "重置次數：--" }
        return "重置次數：\(count)次"
    }

    private var codexIcon: Image {
        let resourceName = colorScheme == .dark ? "codex_dark" : "codex_light"
        guard let image = NSImage(named: resourceName) else {
            return Image(systemName: "terminal")
        }
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
