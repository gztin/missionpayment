// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "MissionInvoicePopup",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "MissionInvoicePopup", targets: ["MissionInvoicePopup"])
    ],
    targets: [
        .executableTarget(
            name: "MissionInvoicePopup",
            path: "Sources/MissionInvoicePopup",
            resources: [
                .copy("../../Resources/Audio/cash-register.mp3"),
                .copy("../../Resources/Icons/codex_dark.png"),
                .copy("../../Resources/Icons/codex_light.png"),
                .copy("../../Resources/Icons/close_figma.svg"),
                .copy("../../Resources/Icons/history_dark.svg"),
                .copy("../../Resources/Icons/setting_dark.svg")
            ]
        ),
        .testTarget(
            name: "MissionInvoicePopupTests",
            dependencies: ["MissionInvoicePopup"],
            path: "Tests/MissionInvoicePopupTests"
        )
    ]
)
