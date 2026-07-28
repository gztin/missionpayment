import AppKit

@MainActor
final class StatusItemController: NSObject {
    private let store: ReceiptStore
    private let statusItem: NSStatusItem

    init(store: ReceiptStore) {
        self.store = store
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        super.init()
        configureButton()
        configureMenu()
    }

    private func configureButton() {
        guard let button = statusItem.button else { return }
        button.image = Self.makeStatusIcon()
        button.imagePosition = .imageOnly
        button.toolTip = "Mission Invoice"
        button.setAccessibilityLabel("Mission Invoice")
    }

    private static func makeStatusIcon() -> NSImage {
        let image = NSImage(size: NSSize(width: 18, height: 18), flipped: false) { _ in
            guard let context = NSGraphicsContext.current?.cgContext else { return false }

            context.setFillColor(NSColor.black.cgColor)
            let receipt = CGMutablePath()
            receipt.move(to: CGPoint(x: 3, y: 17))
            receipt.addQuadCurve(
                to: CGPoint(x: 1, y: 15),
                control: CGPoint(x: 1, y: 17)
            )
            receipt.addLine(to: CGPoint(x: 1, y: 2.5))
            receipt.addLine(to: CGPoint(x: 2.5, y: 1))
            receipt.addLine(to: CGPoint(x: 4, y: 2.2))
            receipt.addLine(to: CGPoint(x: 5.5, y: 1))
            receipt.addLine(to: CGPoint(x: 7, y: 2.2))
            receipt.addLine(to: CGPoint(x: 8.5, y: 1))
            receipt.addLine(to: CGPoint(x: 10, y: 2.2))
            receipt.addLine(to: CGPoint(x: 11.5, y: 1))
            receipt.addLine(to: CGPoint(x: 13, y: 2.2))
            receipt.addLine(to: CGPoint(x: 13, y: 15))
            receipt.addQuadCurve(
                to: CGPoint(x: 11, y: 17),
                control: CGPoint(x: 13, y: 17)
            )
            receipt.closeSubpath()
            context.addPath(receipt)
            context.fillPath()

            context.setBlendMode(.clear)
            context.setLineCap(.round)
            context.setLineWidth(1.3)
            context.move(to: CGPoint(x: 4, y: 13))
            context.addLine(to: CGPoint(x: 10.5, y: 13))
            context.move(to: CGPoint(x: 4, y: 10))
            context.addLine(to: CGPoint(x: 9, y: 10))
            context.strokePath()

            context.setBlendMode(.normal)
            context.setFillColor(NSColor.black.cgColor)
            context.fillEllipse(in: CGRect(x: 9.5, y: 1.5, width: 8, height: 8))

            context.setBlendMode(.clear)
            context.setLineWidth(1.5)
            context.move(to: CGPoint(x: 11.4, y: 5.1))
            context.addLine(to: CGPoint(x: 12.8, y: 3.8))
            context.addLine(to: CGPoint(x: 15.8, y: 7.1))
            context.strokePath()
            return true
        }
        image.isTemplate = true
        image.accessibilityDescription = "Mission Invoice"
        return image
    }

    private func configureMenu() {
        let menu = NSMenu()
        menu.addItem(menuItem(
            title: "剩餘用量",
            symbolName: "gauge.with.dots.needle.50percent",
            action: #selector(showUsage)
        ))
        menu.addItem(menuItem(
            title: "本日紀錄",
            symbolName: "calendar",
            action: #selector(showToday)
        ))
        menu.addItem(menuItem(
            title: "開啟設定",
            symbolName: "gearshape",
            action: #selector(showSettings)
        ))
        menu.addItem(.separator())
        let quitItem = menuItem(
            title: "結束 Mission Invoice",
            symbolName: "power",
            action: #selector(quit)
        )
        quitItem.keyEquivalent = "q"
        menu.addItem(quitItem)
        statusItem.menu = menu
    }

    private func menuItem(title: String, symbolName: String, action: Selector) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        item.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: title)
        return item
    }

    @objc private func showUsage() {
        store.showHome()
    }

    @objc private func showToday() {
        store.showToday()
    }

    @objc private func showSettings() {
        store.showSettings()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
