# Install Mission Invoice

## 中文

### 從本機資料夾安裝

解壓縮或 clone 這個 marketplace 資料夾後，執行：

```bash
codex plugin marketplace add /absolute/path/to/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

如果 Codex 已經開著，安裝後建議重啟一次。

### 從 Git Repository 安裝

如果這個 marketplace 發布在 Git repository 根目錄：

```bash
codex plugin marketplace add owner/repo --ref main
codex plugin add token-billing-panel@mission-invoice
```

如果 marketplace 放在 repository 的子資料夾，請加上 sparse path：

```bash
codex plugin marketplace add owner/repo --ref main --sparse path/to/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

本 repo 的安裝指令是：

```bash
codex plugin marketplace add gztin/missionpayment --ref main --sparse dist/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

### 驗證安裝

列出已設定的 marketplace：

```bash
codex plugin marketplace list
```

列出可用外掛：

```bash
codex plugin list
```

Mission Invoice 的 plugin id 是：

```text
token-billing-panel
```

### 第一次專案設定

在每個想穩定自動開發票的 Codex 專案中執行：

```text
/mission setup
```

Mission Invoice 會先詢問，確認後才會把規則寫入該專案的 `AGENTS.md`。

### 開啟 Dashboard

可以在 Codex 中詢問：

```text
打開我的 Mission Invoice Dashboard
```

Dashboard 會在本機執行：

```text
http://127.0.0.1:48732
```

## English

### Install From A Local Folder

Unzip or clone this marketplace folder, then run:

```bash
codex plugin marketplace add /absolute/path/to/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

Restart Codex if the plugin does not appear immediately.

### Install From A Git Repository

If this marketplace is published at the root of a Git repository:

```bash
codex plugin marketplace add owner/repo --ref main
codex plugin add token-billing-panel@mission-invoice
```

If the marketplace lives in a subfolder of a repository, add the sparse path:

```bash
codex plugin marketplace add owner/repo --ref main --sparse path/to/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

For this repository, use:

```bash
codex plugin marketplace add gztin/missionpayment --ref main --sparse dist/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

### Verify Installation

List configured marketplaces:

```bash
codex plugin marketplace list
```

List available plugins:

```bash
codex plugin list
```

Mission Invoice should appear with plugin id:

```text
token-billing-panel
```

### First Project Setup

In each Codex project where you want more reliable automatic receipts, run:

```text
/mission setup
```

Mission Invoice will ask before writing rules to that project's `AGENTS.md`.

### Open The Dashboard

Ask Codex:

```text
Open my Mission Invoice Dashboard.
```

The dashboard runs locally at:

```text
http://127.0.0.1:48732
```
