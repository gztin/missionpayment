import AppKit
import SwiftUI

struct TodayReceiptsView: View {
    let store: ReceiptStore

    var body: some View {
        VStack(spacing: 5) {
            VStack(spacing: 10) {
                HStack(alignment: .center) {
                    HStack(spacing: 10) {
                        Rectangle()
                            .fill(Color(red: 127 / 255, green: 0, blue: 25 / 255))
                            .frame(width: 7, height: 24)

                        Text("本日紀錄")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundStyle(
                                Color(red: 51 / 255, green: 51 / 255, blue: 51 / 255)
                            )
                    }

                    Spacer()

                    Button {
                        store.closeWindow()
                    } label: {
                        closeImage
                            .resizable()
                            .scaledToFit()
                            .frame(width: 20, height: 20)
                            .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("關閉本日紀錄")
                }
                .frame(height: 24)

                HStack {
                    Text(todayDateText)
                        .foregroundStyle(
                            Color(red: 62 / 255, green: 62 / 255, blue: 62 / 255)
                        )

                    Spacer()

                    Text("共\(store.todayReceipts.count)筆")
                        .foregroundStyle(
                            Color(red: 140 / 255, green: 137 / 255, blue: 131 / 255)
                        )
                }
                .font(.system(size: 10, weight: .regular))
                .padding(.vertical, 10)
                .frame(height: 31)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(
                            Color(
                                red: 222 / 255,
                                green: 220 / 255,
                                blue: 215 / 255
                            )
                        )
                        .frame(height: 1)
                }
            }

            if store.todayReceipts.isEmpty {
                ContentUnavailableView(
                    "今天尚無發票",
                    systemImage: "doc.text.magnifyingglass",
                    description: Text("完成 Codex 任務後，今天的發票會顯示在這裡。")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(store.todayReceipts) { item in
                            Button {
                                store.showReceipt(item)
                            } label: {
                                HStack(alignment: .center, spacing: 8) {
                                    Text(item.payload.receiptNo)
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundStyle(
                                            Color(
                                                red: 127 / 255,
                                                green: 0,
                                                blue: 25 / 255
                                            )
                                        )
                                        .lineLimit(1)

                                    Spacer(minLength: 8)

                                    VStack(alignment: .trailing, spacing: 5) {
                                        Text(item.timeText)
                                            .font(.system(size: 10, weight: .medium))
                                            .foregroundStyle(
                                                Color(
                                                    red: 140 / 255,
                                                    green: 137 / 255,
                                                    blue: 131 / 255
                                                )
                                            )
                                            .monospacedDigit()

                                        Text("\(item.payload.totalTokens.formatted()) tokens")
                                            .lineLimit(1)
                                            .font(.system(size: 10, weight: .medium))
                                            .foregroundStyle(
                                                Color(
                                                    red: 140 / 255,
                                                    green: 137 / 255,
                                                    blue: 131 / 255
                                                )
                                            )
                                    }
                                }
                                .padding(.vertical, 5)
                                .frame(minHeight: 50)
                                .contentShape(Rectangle())
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel(
                                    Self.receiptAccessibilityLabel(for: item)
                                )
                            }
                            .buttonStyle(.plain)

                            Rectangle()
                                .fill(
                                    Color(
                                        red: 222 / 255,
                                        green: 220 / 255,
                                        blue: 215 / 255
                                    )
                                )
                                .frame(height: 0.8)
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
        }
        .padding(.top, 10)
        .padding(.horizontal, 10)
    }

    private var todayDateText: String {
        let components = Calendar.current.dateComponents(
            [.year, .month, .day],
            from: .now
        )
        return String(
            format: "%04d.%02d.%02d",
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
    }

    private var closeImage: Image {
        guard let image = NSImage(named: "close_figma") else {
            return Image(systemName: "xmark.circle.fill")
        }
        return Image(nsImage: image)
    }

    static func receiptAccessibilityLabel(
        for item: ReceiptStore.TodayReceipt
    ) -> String {
        "\(item.payload.receiptNo)，\(item.timeText)，"
            + "\(item.payload.totalTokens.formatted()) tokens"
    }
}
