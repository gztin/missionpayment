# 日式發票模板 japanese-v1

此資料夾保存日式發票的設計資產，目前不會改變 Mission Invoice 的發票產生流程。

- `reference.png`：使用者提供的原始視覺規格。
- `template.json`：尺寸、色彩、字體與浮動發票寬度規格。
- `template.html`：包含動態欄位 placeholder 的可重用 HTML 版型。

## 原生浮動發票約束

- 紙張內容寬度：`280pt`
- 左右陰影安全邊距：各 `6pt`
- 外層視窗總寬：`292pt`

## 尚未實作

- 模板選擇設定
- 模板切換命令
- runtime renderer 串接
- 既有發票套版或重新產生

未來實作替換功能時，必須先對所有動態文字做 HTML escaping，再替換
`template.json` 列出的 placeholders。
