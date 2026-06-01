# Mission Invoice

Mission Invoice 是本機 Codex 外掛，用來記錄任務 token 消耗並產生 receipt-style 靜態發票。

## 安裝

從 GitHub share package 安裝：

```bash
codex plugin marketplace add /path/to/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

安裝後請重新啟動 Codex。

## 功能

- 任務完成後記錄 token usage 與參考 credits。
- 產生中文靜態 HTML 發票。
- 發票底部提供 `歷史帳單` 與 `統計資訊` 文字連結。
- 歷史帳單顯示發票號碼、token 花費與查看連結。
- 統計資訊顯示總消耗 token，並依模型名稱分組各任務類型消耗。
- 支援 `/mission model` 切換參考模型費率，預設為 `GPT-5.5`。
- 支援 `/mission on` 與 `/mission off` 控制自動紀錄。
- 支援 `/mission setup` 將專案規則寫入 `AGENTS.md`，且必須先取得使用者同意。

## 指令

```text
/mission on
/mission off
/mission setup
/mission model list
/mission model GPT-5.5
/mission model GPT-5.4
/mission model GPT-5.3-Codex
/mission model GPT-5.2
```

## 靜態發票

發票檔案位於：

```text
~/.codex-token-billing/receipts/TX-....html
```

發票預設為中文，底部有：

- `歷史帳單`: 開啟 `index.html#history`
- `統計資訊`: 開啟 `index.html#stats`

## 歷史帳單

歷史帳單位於：

```text
~/.codex-token-billing/receipts/index.html
```

`歷史帳單` 頁面只顯示：

- 發票號碼
- Token 花費
- 查看

`統計資訊` 頁面顯示：

- 總消耗 token
- 依模型名稱分組的任務類型 token 統計

## 隱私與限制

Mission Invoice 不會讀取官方 Codex 帳戶方案、雲端帳單或真實帳戶用量。除非執行環境提供實際 usage，否則 token 與 credits 是估算值。
