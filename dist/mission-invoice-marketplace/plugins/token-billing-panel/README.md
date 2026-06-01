# Mission Invoice

## 中文

Mission Invoice 是一個本機 Codex 外掛，會把預估 token 使用量記錄成電子發票樣式的本機紀錄。

外掛會把所有紀錄儲存在使用者自己的電腦：

```text
~/.codex-token-billing
```

它不會讀取官方 Codex 帳號方案、實際帳單或雲端用量資料。

### 功能

- 在 Codex 任務後建立本機 token 發票紀錄
- 開啟本機 Dashboard：`http://127.0.0.1:48732`
- 支援 `/mission setup` 專案設定
- 支援全域開關：
  - `/mission on`
  - `/mission off`
- 專案設定採 opt-in，只有使用者確認後才會寫入專案 `AGENTS.md`

### 從分享包安裝

收到並解壓縮分享包後：

```bash
codex plugin marketplace add /path/to/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

如果安裝後外掛沒有立即出現，請重啟 Codex。

### 第一次專案使用

在想穩定自動開發票的專案中執行：

```text
/mission setup
```

Mission Invoice 會詢問是否要把標記區塊加入該專案的 `AGENTS.md`。只有使用者同意後才會寫入。

寫入區塊會包在：

```text
<!-- mission-invoice:start -->
...
<!-- mission-invoice:end -->
```

重跑 `/mission setup` 會刷新區塊，不會重複新增。

### 使用方式

一般 Codex 任務不需要任何前綴。Mission Invoice 啟用時，代理應該在最後回覆前記錄發票並附上發票連結。

只有切換狀態時需要使用：

```text
/mission on
/mission off
/mission setup
```

### 限制

- 除非環境提供實際用量，否則 token 數量是估算值。
- 自動開票取決於 Codex 是否載入外掛 Skill 或專案指令。
- 若要提高專案穩定度，請執行一次 `/mission setup` 並同意寫入規則。

## English

Mission Invoice is a local Codex plugin that records estimated token usage as receipt-style invoices.

The plugin stores all records on the user's own machine:

```text
~/.codex-token-billing
```

It does not read official Codex account plans, actual account billing, or hosted usage data.

### Features

- Creates local token receipt records after Codex tasks
- Opens a local dashboard at `http://127.0.0.1:48732`
- Supports project setup with `/mission setup`
- Supports global invoice mode commands:
  - `/mission on`
  - `/mission off`
- Keeps project setup opt-in. It only writes to a project's `AGENTS.md` after the user confirms.

### Install From Shared Package

After receiving and unzipping the shared package:

```bash
codex plugin marketplace add /path/to/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

Restart Codex after installation if the plugin does not appear immediately.

### First Use In A Project

In a project where you want more reliable automatic receipts, run:

```text
/mission setup
```

Mission Invoice will ask whether it should add a marked rule block to that project's `AGENTS.md`. It writes only after the user agrees.

The inserted block is bounded by:

```text
<!-- mission-invoice:start -->
...
<!-- mission-invoice:end -->
```

Running `/mission setup` again refreshes the block without duplicating it.

### Usage

General Codex tasks do not need any prefix. When Mission Invoice is enabled, the agent should record a receipt before the final response and include the receipt URL.

Use these commands only when changing Mission Invoice behavior:

```text
/mission on
/mission off
/mission setup
```

### Limitations

- Token counts are estimates unless a real usage source is provided by the environment.
- Automatic receipt behavior depends on Codex loading the plugin skill or project instructions.
- For best reliability per project, run `/mission setup` once and approve the `AGENTS.md` rule.
