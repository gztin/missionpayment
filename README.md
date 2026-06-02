# Mission Invoice

Mission Invoice 是 Codex 專用的小插件，會把每次 AI 協作消耗的 token 與 credits 統計成一張本機電子發票，並提供歷史帳單與簡單統計資訊。

所有資料都只儲存在本機：

```text
~/.codex-token-billing
```

## 快速安裝

請在終端機執行：

```bash
npx skills add https://github.com/gztin/missionpayment/tree/main/skills/mission-invoice
```

安裝完成後，重新啟動 Codex，接著在想啟用 Mission Invoice 的專案中輸入：

```text
/mission setup
```

## 推薦給朋友的安裝方式：Skills Installer

如果只是想讓朋友順利使用 Mission Invoice，建議先使用 Skill 版。它不需要朋友手動新增 Codex marketplace，也比較不容易卡在 GitHub 分享市集的 `git clone` 問題。

前置需求：

- 已安裝 Codex。
- 已安裝 Node.js，並可使用 `npx`。
- 可以連線到 GitHub。

安裝：

```bash
npx skills add https://github.com/gztin/missionpayment/tree/main/skills/mission-invoice
```

安裝後請重新啟動 Codex。

接著在想啟用 Mission Invoice 的專案中輸入：

```text
/mission setup
```

這個指令會詢問是否要把 Mission Invoice 規則寫入該專案的 `AGENTS.md`。只有使用者同意後才會寫入。

## 進階安裝方式：Codex Plugin Marketplace

如果你想使用完整的 Codex plugin marketplace 版本，可以用 GitHub 分享市集安裝。

這種方式需要本機能執行 `git`，因為 Codex 會在背景使用 `git clone` 下載分享市集內容。

在 Codex 的「新增市集」畫面填入：

```text
來源：https://github.com/gztin/missionpayment.git
Git 參照：main
稀疏路徑：dist/mission-invoice-share
```

或使用 Codex CLI：

```bash
codex plugin marketplace add gztin/missionpayment --ref main --sparse dist/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

安裝後請重新啟動 Codex，再到專案中執行：

```text
/mission setup
```

## Skill 版與 Plugin 版差異

```text
Skill 版
- 推薦給一般朋友使用。
- 透過通用 skills installer 安裝。
- 主要提供 Mission Invoice 工作流程、專案規則與本機 receipt 記錄腳本。
- 通常需要 Node.js / npx。

Plugin 版
- 推薦給熟悉 Codex 外掛/市集的人。
- 透過 Codex marketplace 安裝。
- 包含 .codex-plugin/plugin.json 與 MCP server 設定。
- 使用 GitHub 分享市集時通常需要本機已安裝 Git。
```

## 指令

```text
/mission setup
/mission on
/mission off
/mission model list
/mission model GPT-5.5
/mission model GPT-5.4
/mission model GPT-5.3-Codex
/mission model GPT-5.2
```

- `/mission setup`：把 Mission Invoice 規則加入目前專案。
- `/mission on`：啟用任務發票紀錄。
- `/mission off`：停用任務發票紀錄。
- `/mission model list`：查看可用的參考模型。
- `/mission model ...`：切換 credits 估算用的參考模型，預設為 `GPT-5.5`。

## 產出內容

- 中文靜態 HTML 發票。
- 發票底部提供 `歷史帳單` 與 `統計資訊` 文字連結。
- 歷史帳單顯示發票號碼、token 花費與查看連結。
- 統計資訊顯示總消耗 token，並依模型名稱與任務類型分組。
- 資料保存在本機，不需要啟動本機 dashboard server。

## 資料位置

```text
~/.codex-token-billing/usage-log.json
~/.codex-token-billing/settings.json
~/.codex-token-billing/receipts/
~/.codex-token-billing/receipts/index.html
```

## 開發與發佈流程

本 repo 以 `skills/mission-invoice` 作為主要功能來源。Skill 版直接由這個資料夾安裝；Plugin Marketplace 版則由 build script 產生到 `plugins/token-billing-panel` 與 `dist/mission-invoice-share`。

重新產生分享市集：

```bash
node scripts/build_plugin_share.js
```

產出結構：

```text
.agents/plugins/marketplace.json
plugins/token-billing-panel/
  .codex-plugin/plugin.json
  .mcp.json
  skills/token-billing-panel/SKILL.md
  scripts/token-billing-mcp.js

dist/mission-invoice-share/
  marketplace.json
  plugins/token-billing-panel/
    .codex-plugin/plugin.json
    .mcp.json
    skills/token-billing-panel/SKILL.md
    scripts/token-billing-mcp.js
```

產出後建議驗證 plugin：

```bash
python3 /Users/ggt/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /Users/ggt/Documents/GitHub/missionpayment/plugins/token-billing-panel
python3 /Users/ggt/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /Users/ggt/Documents/GitHub/missionpayment/dist/mission-invoice-share/plugins/token-billing-panel
```

本機測試 repo marketplace：

```bash
codex plugin marketplace add /Users/ggt/Documents/GitHub/missionpayment
codex plugin add token-billing-panel@mission-invoice
```

## 問題排解

### npx 不是內部或外部命令

如果使用 Skill 版安裝時看到：

```text
npx 不是內部或外部命令
```

代表目前電腦沒有可用的 Node.js / npm / npx。請先安裝 Node.js：

```text
https://nodejs.org/
```

安裝後重新開啟終端機，確認：

```bash
node --version
npx --version
```

再重新執行 Skill 安裝指令。

### codex 不是內部或外部命令

如果使用 Codex CLI 安裝 plugin 版時看到：

```text
codex 不是內部或外部命令
```

代表外部終端機找不到 Codex CLI。這時可以改用 Codex 介面的「新增市集」安裝，不一定要使用 CLI。

### codex.exe 顯示 Access is denied

如果安裝時出現：

```text
codex.exe -> Access is denied
```

代表目前環境無法執行 Codex CLI，問題通常不是 Mission Invoice 本身。

可以先檢查：

```bash
where codex
codex --version
```

如果仍然失敗，請改用外部終端機，必要時以系統管理員身分執行。也可以檢查 Windows 安全性、防毒軟體、App execution aliases 或 Codex app 安裝狀態。

### failed to run git clone ... program not found

如果使用 GitHub 分享市集安裝 plugin 版時看到：

```text
failed to run git clone ... program not found
```

代表 Codex 想呼叫 `git clone`，但電腦找不到 `git`。

這不是 Mission Invoice 本身需要 Git，而是 GitHub 分享市集安裝方式需要 Git 下載 marketplace。

解法：

1. 安裝 Git for Windows：

   ```text
   https://git-scm.com/download/win
   ```

2. 安裝時選擇讓命令列與第三方程式可以使用 Git。
3. 重啟 Codex。
4. 確認：

   ```bash
   git --version
   ```

5. 再重新新增市集。

### 找不到 marketplace manifest

如果看到類似：

```text
marketplace root does not contain a supported manifest
```

請確認稀疏路徑是：

```text
dist/mission-invoice-share
```

不要填到更深層的 plugin 目錄。Codex 需要先讀到：

```text
dist/mission-invoice-share/marketplace.json
```

### GitHub URL 不要使用 /tree/main

如果透過 Codex 介面新增市集，來源請填 Git repo URL：

```text
https://github.com/gztin/missionpayment.git
```

不要填：

```text
https://github.com/gztin/missionpayment/tree/main
```

`/tree/main` 是 GitHub 網頁路徑，不是可 clone 的 Git URL。

## 限制

Mission Invoice 不會讀取官方 Codex 帳號方案、實際帳單或官方 usage data。

目前 token 與 credits 是依任務上下文與使用者選擇的模型費率做參考估算。若 Codex 沒有提供實際 usage data，發票上的金額應視為輔助紀錄，不是官方帳單。
