import SwiftUI

struct TodayReceiptsView: View {
    let store: ReceiptStore

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    store.showHome()
                } label: {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("返回剩餘用量")

                Text("本日紀錄")
                    .font(.headline)

                Spacer()

                Text("\(store.todayReceipts.count) 張")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(16)

            Divider()

            if store.todayReceipts.isEmpty {
                ContentUnavailableView(
                    "今天尚無發票",
                    systemImage: "doc.text.magnifyingglass",
                    description: Text("完成 Codex 任務後，今天的發票會顯示在這裡。")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(store.todayReceipts) { item in
                    Button {
                        store.showReceipt(item)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(item.payload.task)
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(2)
                                Spacer(minLength: 8)
                                Text(item.timeText)
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            HStack {
                                Text(item.payload.receiptNo)
                                Spacer()
                                Text("\(item.payload.totalTokens.formatted()) tokens")
                            }
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 5)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
            }
        }
    }
}
