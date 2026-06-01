# Mission Invoice Share Package

這個資料夾是 Mission Invoice 的 GitHub share 版本。現在專案只維護這一份發佈包，不再維護獨立的 marketplace 打包目錄。

## 安裝

在 Codex 所在的電腦上執行：

```bash
codex plugin marketplace add /absolute/path/to/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

如果 Codex 已經開啟，安裝後請重新啟動 Codex。

## 內含外掛

- Plugin id: `token-billing-panel`
- Display name: `Mission Invoice`
- Version: `0.1.0+codex.20260601083233`

## 第一次使用

在要啟用 Mission Invoice 自動紀錄的專案中執行：

```text
/mission setup
```

外掛會詢問是否要把 Mission Invoice 規則寫入該專案的 `AGENTS.md`。只有使用者同意後才會寫入。

## 使用方式

一般 Codex 任務不需要加前綴。Mission Invoice 開啟時，任務完成後會產生本機靜態發票。

常用指令：

```text
/mission on
/mission off
/mission setup
/mission model list
/mission model GPT-5.5
```

## 產出內容

- 每次任務產生一張中文靜態 HTML 發票。
- 發票底部有 `歷史帳單` 與 `統計資訊` 連結。
- 歷史帳單只顯示發票號碼、token 花費與查看連結。
- 統計資訊依模型名稱區隔，並列出各任務類型消耗的 token。

## 本機資料位置

```text
~/.codex-token-billing
~/.codex-token-billing/receipts
~/.codex-token-billing/receipts/index.html
```
