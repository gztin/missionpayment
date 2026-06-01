# Mission Invoice Marketplace

## 中文

這個資料夾是一個 Codex 外掛 marketplace，用來散發 Mission Invoice 外掛。

Mission Invoice 會把 Codex 任務的預估 token 消耗記錄成本機電子發票。發票與設定都儲存在使用者自己的電腦：

```text
~/.codex-token-billing
```

### 內含外掛

- Marketplace name：`mission-invoice`
- Plugin id：`token-billing-panel`
- 顯示名稱：`Mission Invoice`
- 版本：`0.1.0+codex.20260601083233`
- 類別：`Productivity`

### 安裝

請參考 [INSTALL.md](./INSTALL.md)。

### 使用方式

安裝後，可在 Codex 中使用：

```text
/mission setup
/mission on
/mission off
```

如果希望某個專案更穩定地自動開發票，請在該專案先執行一次 `/mission setup`。Mission Invoice 會先詢問使用者，確認後才會把規則加入該專案的 `AGENTS.md`。

### 隱私

Mission Invoice 只在本機運作：

- 紀錄寫入 `~/.codex-token-billing`
- 不讀取官方 Codex 帳號方案
- 不讀取雲端帳單紀錄
- 不把發票紀錄送到外部服務

### 限制

- 除非執行環境提供實際用量，否則 token 數量是估算值。
- 自動開票取決於 Codex 是否載入外掛 Skill 或專案指令。
- 專案持久化需要使用者同意 `/mission setup`。

## English

This folder is a Codex plugin marketplace that distributes the Mission Invoice plugin.

Mission Invoice records estimated Codex token usage as local receipt-style invoices. Receipts and settings are stored on the user's own machine:

```text
~/.codex-token-billing
```

### Included Plugin

- Marketplace name: `mission-invoice`
- Plugin id: `token-billing-panel`
- Display name: `Mission Invoice`
- Version: `0.1.0+codex.20260601083233`
- Category: `Productivity`

### Install

See [INSTALL.md](./INSTALL.md).

### Usage

After installation, use these commands inside Codex:

```text
/mission setup
/mission on
/mission off
```

For each project, run `/mission setup` once if you want more reliable automatic receipts. Mission Invoice asks before adding a marked rule block to that project's `AGENTS.md`.

### Privacy

Mission Invoice is local-only:

- It writes records to `~/.codex-token-billing`.
- It does not read official Codex account plans.
- It does not read hosted billing records.
- It does not send receipt records to an external service.

### Limitations

- Token counts are estimates unless the runtime provides actual usage data.
- Automatic receipt generation depends on Codex loading the plugin skill or project instructions.
- Project persistence requires user-approved `/mission setup`.
