# Mission Invoice

Mission Invoice 是 Codex 專用的插件，將把每次 AI 協作消耗的 token 與 credits 統計成一張電子發票。

所有資料都保存在使用者自己的電腦：

```text
~/.codex-token-billing
```

## 安裝

從 GitHub 安裝分享版本：

```bash
codex plugin marketplace add gztin/missionpayment --ref main --sparse dist/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

如果 Codex 已經開啟，安裝後請重新啟動 Codex。

## 專案設定

在需要自動記錄 Mission Invoice 的專案中執行：

```text
/mission setup
```

外掛會先詢問是否要寫入 `AGENTS.md`。使用者同意後，才會加入這段可重複更新的規則區塊：

```text
<!-- mission-invoice:start -->
...
<!-- mission-invoice:end -->
```

## 指令

```text
/mission setup
/mission on
/mission off
/mission model GPT-5.5
/mission model GPT-5.4
/mission model GPT-5.3-Codex
/mission model GPT-5.2
/mission model list
```

一般 Codex 任務不需要加任何前綴。Mission Invoice 開啟時，任務完成後會記錄一張本機靜態發票，並在回覆中附上可點擊的 `本次mission payment` 連結。

## 功能

- 產生本機靜態 HTML 發票。
- 發票預設顯示中文，不提供語系切換按鈕。
- 發票底部提供 `歷史帳單` 與 `統計資訊` 文字連結。
- 歷史帳單只顯示發票號碼、token 花費與查看連結。
- 統計資訊顯示總消耗 token，並依模型名稱分組各任務類型的 token 統計。
- 支援 `/mission model` 切換參考模型計算基準，預設為 `GPT-5.5`。
- 支援 `/mission on` 與 `/mission off` 控制是否自動產生發票。

## 資料位置

```text
~/.codex-token-billing/usage-log.json
~/.codex-token-billing/settings.json
~/.codex-token-billing/receipts/
~/.codex-token-billing/receipts/index.html
```

## 文件

- [Share package README](dist/mission-invoice-share/README.md)
- [Plugin README](dist/mission-invoice-share/plugins/token-billing-panel/README.md)
- [Skill instructions](dist/mission-invoice-share/plugins/token-billing-panel/skills/token-billing-panel/SKILL.md)

## 限制

Mission Invoice 不讀取官方 Codex 帳戶方案、雲端帳單或真實帳戶用量。除非執行環境提供實際 token usage，否則 token 與 credits 都是依本機紀錄與參考 rate card 估算。
