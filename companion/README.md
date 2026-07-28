# Mission Invoice Popup for macOS

這是 Mission Invoice 的選配原生 macOS 浮動收據程式。外掛即使沒有安裝本程式，仍可正常產生 HTML 發票。

## 建置

使用 Xcode 開啟：

```text
companion/MissionInvoicePopup.xcodeproj
```

選擇 `MissionInvoicePopup` scheme 與 `My Mac`，按下 Run 即可啟動開發版。執行前請先結束 `/Applications` 內的安裝版，避免相同 Bundle Identifier 的兩個程序同時常駐。

產生可安裝 App 與 ZIP：

```bash
chmod +x companion/build-app.sh
./companion/build-app.sh
```

輸出：

```text
companion/dist/Mission Invoice Popup.app
companion/dist/Mission-Invoice-Popup-macOS.zip
```

Xcode 專案目前使用 ad hoc 本機簽章，適合開發與本機測試。正式散布或 Mac App Store 上架前，請在 Signing & Capabilities 選擇 Apple Developer Team、設定 App Sandbox，並完成公證／商店送審。

## 安裝與啟用

1. 將 `Mission Invoice Popup.app` 拖入 `/Applications`。
2. 第一次手動開啟 App；程式會安靜常駐於 macOS 選單列，不會顯示舊發票或示範收據。
3. 在 Codex 輸入 `/mission popup on`。
4. 下一張 Mission Invoice 開立後，App 會透過 `missioninvoice://receipt` 被喚起。

選單列會透過 SwiftUI `MenuBarExtra` 常駐顯示「錢包＋MI」，顯示狀態由 macOS 原生管理並保留使用者選擇；點擊後可開啟設定或結束程式。只有收到新的 Mission Invoice 時，浮動收據才會出現。

停用浮動視窗：

```text
/mission popup off
```

視窗會以寬度 265pt 的窄版鋸齒紙張呈現，保持置頂、無邊框。預設位置為螢幕右上角；齒輪設定可選擇九宮格位置，或直接拖動發票保存自訂位置。工具列與發票都會和螢幕可用範圍四側至少保留 50pt，並在螢幕或視窗尺寸改變後重新校正。

「自動關閉」Switch 關閉時為手動模式，發票會持續顯示到按下關閉按鈕；開啟時可用 Slider 設定 5～20 秒，預設 10 秒，倒數不受滑鼠停留或設定視窗影響。發票關閉後會恢復為 221 × 55pt 用量浮動視窗。

「外觀」可選擇跟隨系統、淺色或深色，並會套用到浮動工具列、本日發票與設定視窗。兩個 SVG 按鈕使用 Template Image，會隨選定外觀自動切換深淺色。

「播放發票音效」Switch 預設開啟。App 內建收銀機音效會永久保留，使用者可在「預設」與「自訂」之間切換；選擇新的本機音效後會自動改用自訂音效，移除或讀取不到自訂檔案時則回到預設音效。設定頁亦支援播放測試：

- 格式：MP3、M4A、WAV、AIFF。
- 最大容量：5 MB。
- 最長時間：10 秒。
- 檔案必須能被 Core Audio 正常解碼。
- 驗證成功後才會複製到 `~/Library/Application Support/Mission Invoice/Audio/`。
