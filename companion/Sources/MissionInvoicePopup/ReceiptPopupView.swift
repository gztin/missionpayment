import SwiftUI

struct ReceiptPopupView: View {
    let store: ReceiptStore

    private let outerHorizontalPadding: CGFloat = 8
    private let paperColor = Color(red: 1.0, green: 0.985, blue: 0.93)
    private let inkColor = Color(red: 0.12, green: 0.10, blue: 0.08)
    private let tokenFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter
    }()

    var body: some View {
        VStack(spacing: 0) {
            receiptHeader
            Divider().overlay(Color.black.opacity(0.22))
            metadata
            dashedDivider
            lineItems
            dashedDivider
            total
        }
        .foregroundStyle(inkColor)
        .padding(.horizontal, 20)
        .padding(.top, 22)
        .padding(.bottom, 22)
        .frame(width: PopupLayout.receiptSize.width - (outerHorizontalPadding * 2))
        .overlay(alignment: .topTrailing) {
            if showsManualCloseButton {
                Button {
                    store.dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .frame(width: 24, height: 24)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(inkColor.opacity(0.62))
                .padding(.top, 12)
                .padding(.trailing, 12)
                .accessibilityLabel("關閉發票")
            }
        }
        .background {
            ReceiptPaperShape()
                .fill(paperColor)
                .shadow(color: .black.opacity(0.16), radius: 7, y: 3)
        }
        .padding(.horizontal, outerHorizontalPadding)
        .padding(.vertical, 7)
        .onOpenURL { store.handle(url: $0) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Mission Invoice 浮動收據")
    }

    private var receiptHeader: some View {
        VStack(spacing: 3) {
            Text("MISSION INVOICE")
                .font(.system(size: 19, weight: .black, design: .rounded))
                .tracking(1.2)
                .lineLimit(1)
            Text("CODEX TOKEN RECEIPT")
                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                .tracking(1.1)
                .foregroundStyle(.secondary)
            Text("任務完成，發票已開立")
                .font(.system(size: 12, weight: .bold))
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.bottom, 14)
    }

    private var metadata: some View {
        VStack(spacing: 5) {
            receiptRow("發票號碼", store.receipt.receiptNo, monospaced: true)
            receiptRow("日期", store.receipt.formattedDate)
            receiptRow("任務", store.receipt.task)
            receiptRow("模型", store.receipt.model)
            receiptRow("耗時", store.receipt.formattedDuration)
        }
        .padding(.vertical, 13)
    }

    private var lineItems: some View {
        VStack(spacing: 8) {
            ForEach(displayLineItems) { item in
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(item.label)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    Text(format(item.tokens))
                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                    Text("tokens")
                        .font(.system(size: 8, design: .monospaced))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .font(.system(size: 11))
        .padding(.vertical, 13)
    }

    private var total: some View {
        VStack(alignment: .trailing, spacing: 3) {
            Text("TOKEN 合計")
                .font(.system(size: 10, weight: .bold))
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Spacer(minLength: 0)
                Text(format(store.receipt.totalTokens))
                    .font(.system(size: 25, weight: .black, design: .monospaced))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                Text("tokens")
                    .font(.system(size: 9, weight: .bold, design: .monospaced))
            }
        }
        .padding(.top, 14)
    }

    private var showsManualCloseButton: Bool {
        !store.preferences.autoDismissEnabled
    }

    private var dashedDivider: some View {
        Rectangle()
            .fill(Color.clear)
            .frame(height: 1)
            .overlay {
                HStack(spacing: 3) {
                    ForEach(0..<36, id: \.self) { _ in
                        Rectangle()
                            .fill(Color.black.opacity(0.25))
                            .frame(width: 4, height: 1)
                    }
                }
                .clipped()
            }
    }

    private var displayLineItems: [ReceiptPayload.LineItem] {
        if !store.receipt.lineItems.isEmpty {
            return store.receipt.lineItems
        }
        return [
            .init(label: "輸入 Token", tokens: store.receipt.inputTokens),
            .init(label: "輸出 Token", tokens: store.receipt.outputTokens)
        ]
    }

    private func receiptRow(_ label: String, _ value: String, monospaced: Bool = false) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 7) {
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: 49, alignment: .leading)
            Text(value)
                .font(monospaced ? .system(size: 10, design: .monospaced) : .system(size: 10))
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            Spacer(minLength: 0)
        }
    }

    private func format(_ value: Int) -> String {
        tokenFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}

private struct ReceiptPaperShape: Shape {
    private let cornerRadius: CGFloat = 7
    private let toothWidth: CGFloat = 9
    private let toothDepth: CGFloat = 7

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let paperBottom = rect.maxY - toothDepth

        path.move(to: CGPoint(x: rect.minX, y: paperBottom))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + cornerRadius))
        path.addQuadCurve(
            to: CGPoint(x: rect.minX + cornerRadius, y: rect.minY),
            control: CGPoint(x: rect.minX, y: rect.minY)
        )
        path.addLine(to: CGPoint(x: rect.maxX - cornerRadius, y: rect.minY))
        path.addQuadCurve(
            to: CGPoint(x: rect.maxX, y: rect.minY + cornerRadius),
            control: CGPoint(x: rect.maxX, y: rect.minY)
        )
        path.addLine(to: CGPoint(x: rect.maxX, y: paperBottom))

        var x = rect.maxX
        while x > rect.minX {
            let nextX = max(rect.minX, x - toothWidth)
            let middleX = (x + nextX) / 2
            path.addLine(to: CGPoint(x: middleX, y: rect.maxY))
            path.addLine(to: CGPoint(x: nextX, y: paperBottom))
            x = nextX
        }

        path.closeSubpath()
        return path
    }
}
