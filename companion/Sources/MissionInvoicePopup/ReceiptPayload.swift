import Foundation

struct ReceiptPayload: Codable, Equatable, Sendable {
    struct LineItem: Codable, Equatable, Identifiable, Sendable {
        let label: String
        let tokens: Int

        var id: String { "\(label)-\(tokens)" }
    }

    let version: Int
    let receiptNo: String
    let task: String
    let category: String
    let model: String
    let endedAt: String
    let durationMs: Int
    let inputTokens: Int
    let outputTokens: Int
    let totalTokens: Int
    let lineItems: [LineItem]
    let projectId: String?
    let projectLogFile: String?
    let receiptFileUrl: String?
    let accountUsageSnapshot: AccountUsageSnapshot?

    struct AccountUsageSnapshot: Codable, Equatable, Sendable {
        let status: String?
        let capturedAt: String?
        let primary: RateLimitWindow?
        let secondary: RateLimitWindow?
        let preferredWindow: RateLimitWindow?
    }

    struct RateLimitWindow: Codable, Equatable, Sendable {
        let usedPercent: Double?
        let remainingPercent: Double?
        let windowDurationMins: Double?
        let resetsAt: Double?
        let resetsAtIso: String?
    }

    static let sample = ReceiptPayload(
        version: 1,
        receiptNo: "TX-2607-DEMO01",
        task: "Mission Invoice 浮動收據",
        category: "coding",
        model: "GPT-5.6-SOL",
        endedAt: ISO8601DateFormatter().string(from: .now),
        durationMs: 42_000,
        inputTokens: 3_240,
        outputTokens: 1_180,
        totalTokens: 4_420,
        lineItems: [
            .init(label: "輸入 Token", tokens: 3_240),
            .init(label: "輸出 Token", tokens: 1_180)
        ],
        projectId: nil,
        projectLogFile: nil,
        receiptFileUrl: nil,
        accountUsageSnapshot: nil
    )

    static func decode(from url: URL) throws -> ReceiptPayload {
        guard url.scheme?.lowercased() == "missioninvoice",
              url.host?.lowercased() == "receipt",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let encoded = components.queryItems?.first(where: { $0.name == "payload" })?.value,
              let data = Data(base64URL: encoded)
        else {
            throw PayloadError.invalidURL
        }
        return try JSONDecoder().decode(ReceiptPayload.self, from: data)
    }

    var formattedDate: String {
        guard let date = ISO8601DateFormatter().date(from: endedAt) else { return endedAt }
        return date.formatted(
            .dateTime
                .year()
                .month(.twoDigits)
                .day(.twoDigits)
                .hour(.twoDigits(amPM: .omitted))
                .minute(.twoDigits)
        )
    }

    var formattedDuration: String {
        let seconds = max(0, durationMs / 1_000)
        if seconds < 60 { return "\(seconds) 秒" }
        return "\(seconds / 60) 分 \(seconds % 60) 秒"
    }
}

private enum PayloadError: Error {
    case invalidURL
}

private extension Data {
    init?(base64URL value: String) {
        var normalized = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = normalized.count % 4
        if remainder > 0 {
            normalized += String(repeating: "=", count: 4 - remainder)
        }
        self.init(base64Encoded: normalized)
    }
}
