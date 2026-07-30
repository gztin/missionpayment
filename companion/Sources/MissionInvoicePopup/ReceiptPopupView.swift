import AppKit
import SwiftUI

struct ReceiptPopupView: View {
    let store: ReceiptStore

    private let accentColor = Color(red: 127 / 255, green: 0, blue: 25 / 255)
    private let inkColor = Color(red: 51 / 255, green: 51 / 255, blue: 51 / 255)
    private let secondaryColor = Color(red: 140 / 255, green: 137 / 255, blue: 131 / 255)
    private let dividerColor = Color(red: 222 / 255, green: 220 / 255, blue: 215 / 255)
    private let tokenFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter
    }()

    var body: some View {
        VStack(spacing: 0) {
            header
            divider
                .padding(.top, 12)
            receiptSummary
            sectionHeader("任務資訊")
            receiptDetails
            sectionHeader("使用量統計")
            lineItems
            dashedDivider
            total
        }
        .padding(.top, 16)
        .padding(.horizontal, 16)
        .padding(.bottom, 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .foregroundStyle(inkColor)
        .onOpenURL { store.handle(url: $0) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Mission Invoice 發票")
    }

    private var header: some View {
        HStack {
            HStack(spacing: 11) {
                Rectangle()
                    .fill(accentColor)
                    .frame(width: 6, height: 28)

                Text("Mission Invoice")
                    .font(.system(size: 20, weight: .bold))
            }

            Spacer()

            Button {
                store.dismiss()
            } label: {
                closeImage
                    .resizable()
                    .scaledToFit()
                    .frame(width: 22, height: 22)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("關閉發票")
        }
        .frame(height: 28)
    }

    private var receiptSummary: some View {
        HStack {
            Label(receiptDateText, systemImage: "calendar")
            Spacer()
            Label(store.receipt.receiptNo, systemImage: "doc.text")
                .lineLimit(1)
        }
        .font(.system(size: 11, weight: .regular))
        .foregroundStyle(secondaryColor)
        .labelStyle(.titleAndIcon)
        .padding(.vertical, 11)
        .overlay(alignment: .bottom) {
            divider
        }
    }

    private var receiptDetails: some View {
        VStack(spacing: 0) {
            detailRow("任務", store.receipt.task, lineLimit: 2)
            detailRow("模型", store.receipt.model)
            detailRow("耗時", store.receipt.formattedDuration)
        }
    }

    private var lineItems: some View {
        VStack(spacing: 0) {
            ForEach(displayLineItems) { item in
                HStack(alignment: .firstTextBaseline) {
                    Text(Self.localizedLineItemLabel(item.label))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(secondaryColor)
                        .lineLimit(1)

                    Spacer(minLength: 8)

                    Text("\(format(item.tokens)) tokens")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(secondaryColor)
                        .lineLimit(1)
                }
                .padding(.vertical, 6)
            }
        }
    }

    private var total: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("TOKEN 合計")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(secondaryColor)

            Spacer()

            Text(format(store.receipt.totalTokens))
                .font(.system(size: 22, weight: .bold, design: .monospaced))
                .foregroundStyle(accentColor)
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            Text("tokens")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(secondaryColor)
        }
        .padding(.top, 10)
    }

    private var divider: some View {
        Rectangle()
            .fill(dividerColor)
            .frame(height: 0.8)
    }

    private var dashedDivider: some View {
        Rectangle()
            .fill(Color.clear)
            .frame(height: 1)
            .overlay {
                HStack(spacing: 4) {
                    ForEach(0..<34, id: \.self) { _ in
                        Rectangle()
                            .fill(dividerColor)
                            .frame(width: 4, height: 1)
                    }
                }
                .clipped()
            }
        .padding(.top, 6)
    }

    private var closeImage: Image {
        guard let image = NSImage(named: "close_figma") else {
            return Image(systemName: "xmark.circle.fill")
        }
        return Image(nsImage: image)
    }

    private var receiptDateText: String {
        guard let date = ISO8601DateFormatter().date(from: store.receipt.endedAt) else {
            return String(store.receipt.formattedDate.prefix(10))
        }
        let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
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

    private func detailRow(
        _ label: String,
        _ value: String,
        lineLimit: Int = 1
    ) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(secondaryColor)
                .frame(width: 32, alignment: .leading)

            Text(value)
                .font(.system(size: 11, weight: .medium))
                .lineLimit(lineLimit)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)

        }
        .padding(.vertical, 6)
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(secondaryColor)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 12)
            .padding(.bottom, 7)
            .overlay(alignment: .bottom) {
                divider
            }
    }

    private func format(_ value: Int) -> String {
        tokenFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    static func localizedLineItemLabel(_ label: String) -> String {
        switch label {
        case "Read and understand":
            "閱讀與理解"
        case "Generate and summarize":
            "生成與摘要"
        default:
            label
        }
    }
}

struct ReceiptCardShape: Shape {
    private let cornerRadius: CGFloat = 14
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
