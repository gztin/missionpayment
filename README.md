# Mission Invoice

## 中文

Mission Invoice 是一個 Codex 外掛 marketplace package，會把 Codex 任務的預估 token 消耗記錄成本機電子發票。

這個外掛只在本機運作。發票與設定會儲存在使用者自己的電腦：

```text
~/.codex-token-billing
```

### 安裝

請在終端機執行：

```bash
codex plugin marketplace add gztin/missionpayment --ref main --sparse dist/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

如果 Codex 已經開著，安裝後建議重啟一次。

### 第一次使用

在每個想穩定自動開發票的專案中，先執行：

```text
/mission setup
```

Mission Invoice 會先詢問是否要把規則加入該專案的 `AGENTS.md`，只有使用者同意後才會寫入。

### 常用指令

```text
/mission setup
/mission on
/mission off
```

一般 Codex 任務不需要加任何前綴。當 Mission Invoice 已啟用且被載入時，代理會在最後回覆前記錄一張發票並附上發票連結。

### 功能

- 記錄本機 token 電子發票
- 提供本機 Dashboard：`http://127.0.0.1:48732`
- 支援 `/mission setup` 專案初始化
- 支援 `/mission on` 與 `/mission off` 全域開關

### 文件

- [Marketplace 說明](dist/mission-invoice-marketplace/README.md)
- [安裝指南](dist/mission-invoice-marketplace/INSTALL.md)
- [更新紀錄](dist/mission-invoice-marketplace/CHANGELOG.md)

### 隱私

Mission Invoice 不會讀取官方 Codex 帳號方案、雲端帳單或真實帳號用量。除非執行環境提供實際用量，否則 token 數量皆為估算。

## English

Mission Invoice is a Codex plugin marketplace package that records estimated Codex token usage as local receipt-style invoices.

The plugin is local-only. Receipts and settings are stored on the user's machine:

```text
~/.codex-token-billing
```

### Install

Run these commands in a terminal:

```bash
codex plugin marketplace add gztin/missionpayment --ref main --sparse dist/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

Restart Codex if the plugin does not appear immediately.

### First Use

In each project where you want more reliable automatic receipts, run:

```text
/mission setup
```

Mission Invoice will ask before adding a marked rule block to that project's `AGENTS.md`.

### Commands

```text
/mission setup
/mission on
/mission off
```

General Codex tasks do not need any prefix. When Mission Invoice is enabled and loaded, the agent records a receipt before the final response and includes the receipt URL.

### Features

- Local token receipt records
- Local dashboard at `http://127.0.0.1:48732`
- Project setup with `/mission setup`
- Global invoice mode with `/mission on` and `/mission off`

### Documentation

- [Marketplace README](dist/mission-invoice-marketplace/README.md)
- [Install Guide](dist/mission-invoice-marketplace/INSTALL.md)
- [Changelog](dist/mission-invoice-marketplace/CHANGELOG.md)

### Privacy

Mission Invoice does not read official Codex account plans, hosted billing records, or real account usage. Token counts are estimates unless actual usage data is provided by the runtime.
