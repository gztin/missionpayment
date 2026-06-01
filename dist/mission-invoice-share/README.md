# Mission Invoice Share Package

## 中文

這個資料夾是 Mission Invoice 的本機 Codex 外掛 marketplace 分享包。

### 安裝

在已安裝 Codex 的電腦上執行：

```bash
codex plugin marketplace add /absolute/path/to/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

如果 Codex 已經開著，安裝後建議重啟一次。

### 內含外掛

- Plugin id：`token-billing-panel`
- 顯示名稱：`Mission Invoice`
- 版本：`0.1.0+codex.20260601083233`

### 第一次專案設定

在每個想讓 Mission Invoice 穩定生效的專案中執行：

```text
/mission setup
```

外掛會先詢問，確認後才會把 Mission Invoice 規則加入該專案的 `AGENTS.md`。

### 資料位置

發票與設定會儲存在使用者自己的電腦：

```text
~/.codex-token-billing
```

## English

This folder is a local Codex plugin marketplace package for Mission Invoice.

### Install

From the machine where Codex is installed:

```bash
codex plugin marketplace add /absolute/path/to/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

If Codex is already open, restart it after installation.

### Included Plugin

- Plugin id: `token-billing-panel`
- Display name: `Mission Invoice`
- Version: `0.1.0+codex.20260601083233`

### First Project Setup

In each project where you want Mission Invoice to persist reliably, run:

```text
/mission setup
```

The plugin will ask before adding Mission Invoice rules to that project's `AGENTS.md`.

### Data Location

Receipts and settings are stored locally on the user's machine:

```text
~/.codex-token-billing
```
