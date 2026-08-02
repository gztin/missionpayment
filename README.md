# Mission Invoice

Mission Invoice 是 Codex 專用的小插件，會把每次 AI 協作消耗的 token 與實際使用模型記錄成一張本機電子發票，並提供歷史帳單與簡單統計資訊。

所有資料都只儲存在本機；設定是全域共用，發票紀錄與歷史帳單會依專案路徑分開：

```text
~/.codex-token-billing/settings.json
~/.codex-token-billing/projects/<project-id>/usage-log.json
~/.codex-token-billing/projects/<project-id>/receipts/
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
/mission runtime
/mission update
/mission rate-limits
```

- `/mission setup`：把 Mission Invoice 規則加入目前專案。
- `/mission on`：啟用任務發票紀錄。
- `/mission off`：停用任務發票紀錄。
- `/mission runtime`：查看目前使用的 Mission Invoice runtime 版本與路徑。
- `/mission update`：更新本機 runtime override，用於發票邏輯、HTML 或資料處理 bugfix；不會改 plugin manifest。
- `/mission rate-limits`：從已登入的本機 Codex app-server 讀取目前官方使用百分比與重置時間。

## 產出內容

- 中文靜態 HTML 發票。
- 發票顯示本次 token 消耗與可取得的實際 Codex 模型。
- 不顯示 credits、Rate card 或參考費率模型。
- 發票底部提供 `歷史帳單` 與 `統計資訊` 文字連結。
- 歷史帳單以任務類型整理發票，列表顯示該次開票時保存的官方用量百分比，不顯示 token 數量。
- 統計資訊顯示最新一次成功取得的官方短期／每週用量、剩餘百分比與重置時間。
- 只有單張發票顯示該次任務的 token 數量與明細。
- 資料保存在本機，不需要啟動本機 dashboard server。

## 資料位置

```text
~/.codex-token-billing/settings.json
~/.codex-token-billing/projects/<project-id>/usage-log.json
~/.codex-token-billing/projects/<project-id>/receipts/
~/.codex-token-billing/projects/<project-id>/receipts/index.html
~/.codex-token-billing/runtime/mission-invoice-runtime.cjs
```

`<project-id>` 會由專案的絕對路徑產生，因此不同專案預設不會共用發票紀錄。舊版全域帳本不會自動導入新專案。

## 更新與重啟

Mission Invoice 0.2.0 之後採用固定 MCP 外殼加可更新 runtime。一般發票邏輯、歷史頁 HTML、資料路徑 bugfix 可以透過 `/mission update` 寫入本機 runtime override，通常不需要重新安裝 plugin。

仍建議重啟 Codex 或開新 thread 的情況：

- 新增、移除或改名 skill。
- 修改 `.codex-plugin/plugin.json`。
- 修改 `.mcp.json` 或 MCP server 啟動方式。
- 修改 marketplace metadata。

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
  runtime/mission-invoice-runtime.cjs

dist/mission-invoice-share/
  marketplace.json
  plugins/token-billing-panel/
    .codex-plugin/plugin.json
    .mcp.json
    skills/token-billing-panel/SKILL.md
    scripts/token-billing-mcp.js
    runtime/mission-invoice-runtime.cjs
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

## macOS AURA App（選配）

Mission Invoice 可以獨立產生 HTML 發票與歷史帳單；若需要原生 macOS 浮動收據、設定介面與音效，可另外安裝 AURA。

AURA 已移至獨立專案開發與發布：

```text
https://github.com/gztin/aura-macos
```

App 的建置、安裝、版本同步及測試方式請參閱 AURA repo。Mission Invoice 仍會透過 `missioninvoice://receipt` 傳送本機收據通知；未安裝或未啟用 AURA 時，不影響一般發票功能。

## 限制

Mission Invoice 會在可用時透過 experimental Codex app-server 協定讀取目前方案的使用百分比、限制週期與重置時間。這是當下快照，不是官方帳單或剩餘 token 數；Codex 更新後協定可能變動。

若 app-server 查詢失敗，發票仍會正常產生，月曆顯示「官方用量 —」。若 Codex 沒有提供實際 token usage data，發票上的 token 數會標示為估算；若無法取得實際模型，則顯示「未取得」，不會用參考費率模型代替。
