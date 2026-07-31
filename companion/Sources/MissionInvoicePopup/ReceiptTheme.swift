import SwiftUI

enum ReceiptTheme: String, CaseIterable, Identifiable {
    case standard
    case neon2026

    var id: String { rawValue }

    var title: String {
        switch self {
        case .standard: "預設"
        case .neon2026: "iPlayground2026樣式"
        }
    }

    var swatches: [ReceiptThemeSwatch] {
        switch self {
        case .standard:
            [
                ReceiptThemeSwatch(title: "主色", hex: "#7F0019", color: palette.accent),
                ReceiptThemeSwatch(title: "票面", hex: "#F7F5F0", color: palette.paper),
                ReceiptThemeSwatch(title: "文字", hex: "#333333", color: palette.primaryText),
                ReceiptThemeSwatch(title: "輔助", hex: "#8C8983", color: palette.secondaryText)
            ]
        case .neon2026:
            [
                ReceiptThemeSwatch(title: "主色", hex: "#D2FF01", color: palette.accent),
                ReceiptThemeSwatch(title: "票面", hex: "#0B0B0B", color: palette.paper),
                ReceiptThemeSwatch(title: "文字", hex: "#EDEDED", color: palette.primaryText),
                ReceiptThemeSwatch(title: "輔助", hex: "#A3A3A3", color: palette.secondaryText)
            ]
        }
    }

    var palette: ReceiptThemePalette {
        switch self {
        case .standard:
            ReceiptThemePalette(
                accent: Color(red: 127 / 255, green: 0, blue: 25 / 255),
                primaryText: Color(red: 51 / 255, green: 51 / 255, blue: 51 / 255),
                secondaryText: Color(red: 140 / 255, green: 137 / 255, blue: 131 / 255),
                divider: Color(red: 222 / 255, green: 220 / 255, blue: 215 / 255),
                paper: Color(red: 247 / 255, green: 245 / 255, blue: 240 / 255),
                shadow: Color.black.opacity(0.18)
            )
        case .neon2026:
            ReceiptThemePalette(
                accent: Color(red: 210 / 255, green: 1, blue: 1 / 255),
                primaryText: Color(red: 237 / 255, green: 237 / 255, blue: 237 / 255),
                secondaryText: Color(red: 163 / 255, green: 163 / 255, blue: 163 / 255),
                divider: Color(red: 41 / 255, green: 41 / 255, blue: 41 / 255),
                paper: Color(red: 11 / 255, green: 11 / 255, blue: 11 / 255),
                shadow: Color(red: 210 / 255, green: 1, blue: 1 / 255).opacity(0.28)
            )
        }
    }

    func advanced(by offset: Int) -> ReceiptTheme {
        guard let index = Self.allCases.firstIndex(of: self),
              !Self.allCases.isEmpty
        else {
            return self
        }
        let count = Self.allCases.count
        let wrappedIndex = (index + offset % count + count) % count
        return Self.allCases[wrappedIndex]
    }
}

struct ReceiptThemePalette {
    let accent: Color
    let primaryText: Color
    let secondaryText: Color
    let divider: Color
    let paper: Color
    let shadow: Color
}

struct ReceiptThemeSwatch: Identifiable {
    let title: String
    let hex: String
    let color: Color

    var id: String { title }
}
