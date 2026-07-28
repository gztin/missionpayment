#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceSkill = path.join(root, "skills", "mission-invoice");
const outRoot = path.join(root, "dist", "mission-invoice-share");
const pluginName = "token-billing-panel";
const repoMarketplaceRoot = root;
const repoPluginRoot = path.join(root, "plugins", pluginName);
const sharePluginRoot = path.join(outRoot, "plugins", pluginName);
const pluginVersion = "0.3.0";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function assertFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required source file: ${path.relative(root, file)}`);
  }
}

function pluginSkillMarkdown(source) {
  return source
    .replace(
      /^name: mission-invoice$/m,
      "name: token-billing-panel"
    )
    .replace(
      /^description: .*$/m,
      "description: Record Mission Invoice token receipts, identify the actual Codex model when available, control invoice mode, and review local receipt history. Use for every token-consuming Codex task by default, and whenever the user asks about token usage, Mission Invoice, payment records, receipt history, or model identification."
    )
    .replace(
      "Use this skill when Mission Invoice is installed as a generic Codex skill instead of the full plugin marketplace package.",
      "Use this skill for every Codex interaction that consumes tokens unless Mission Invoice is disabled."
    );
}

const sourceSkillMd = path.join(sourceSkill, "SKILL.md");
const sourceScript = path.join(sourceSkill, "scripts", "token-billing-mcp.js");
const sourceRuntime = path.join(sourceSkill, "runtime", "mission-invoice-runtime.cjs");
assertFile(sourceSkillMd);
assertFile(sourceScript);
assertFile(sourceRuntime);

const marketplace = {
  name: "mission-invoice",
  interface: {
    displayName: "Mission Invoice"
  },
  plugins: [
    {
      name: pluginName,
      source: {
        source: "local",
        path: `./plugins/${pluginName}`
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL"
      },
      category: "Productivity"
    }
  ]
};

const shareMarketplace = {
  ...marketplace,
  name: "mission-invoice-share",
  interface: {
    displayName: "Mission Invoice Share"
  }
};

const pluginJson = {
  name: pluginName,
  version: pluginVersion,
  description: "Mission Invoice 會為 Codex 專案產生本機 Token 電子發票，並可選配 macOS 浮動收據。",
  author: {
    name: "本機開發者"
  },
  skills: "./skills/",
  interface: {
    displayName: "Mission Invoice",
    shortDescription: "自動開立 Token 電子發票，可選配 macOS 置頂浮動收據。",
    longDescription: "Mission Invoice 會在 Codex 任務消耗 token 後，透過本機 MCP 流程記錄一張 Token 電子發票，內容包含實際模型、token 用量、耗時、明細項目與發票連結，不顯示 credits 或費率資訊。開票時會嘗試透過 experimental Codex app-server 保存目前官方使用百分比與重置時間；歷史帳單以月曆顯示每日最後一次成功快照，查詢失敗不影響開票。一般任務不需要加任何前綴；只要 Mission Invoice 為 ON，就會在任務完成前自動開立發票並在回覆中附上連結。另可安裝 Mission Invoice Popup for macOS，並以 /mission popup on 開啟 265pt 置頂無邊框浮動收據與收銀機音效；沒有安裝 App 或通知失敗時，HTML 發票仍會照常產生。專案第一次使用時可執行 /mission setup：外掛會先詢問是否將 Mission Invoice 規則加入該專案的 AGENTS.md，只有在使用者同意後才會寫入，且會使用可辨識區塊避免重複。/mission inspect-events 可檢查本機 Codex token 事件，/mission import-events 可將最新的正數 token 事件與實際模型匯入目前專案帳本。/mission rate-limits 可唯讀檢查目前官方使用百分比。/mission runtime 可查看目前 runtime 版本，/mission update 可更新發票核心邏輯而不改動 plugin manifest。外掛會產生本機靜態 HTML 發票、月曆歷史帳單與統計資訊，不需要啟動本機 dashboard server。所有資料都只儲存在本機 ~/.codex-token-billing，其中 settings 為全域共用，usage-log 與 receipts 會依專案路徑分開保存。本機事件與用量快照不會保存登入憑證或對話原文。",
    developerName: "本機開發者",
    category: "生產力",
    capabilities: [
      "互動式",
      "讀取",
      "寫入"
    ],
    defaultPrompt: [
      "/mission on",
      "/mission off",
      "/mission popup on",
      "/mission popup off",
      "/mission setup",
      "/mission runtime",
      "/mission update",
      "/mission inspect-events",
      "/mission import-events",
      "/mission rate-limits",
      "打開我最新的 Mission Invoice。",
      "顯示我的 Mission Invoice 歷史帳單。",
      "估算這次任務的 Mission Invoice。"
    ]
  },
  mcpServers: "./.mcp.json"
};

const mcpJson = {
  mcpServers: {
    [pluginName]: {
      command: "node",
      args: [
        "./scripts/token-billing-mcp.js"
      ]
    }
  }
};

function writePlugin(targetRoot) {
  writeJson(path.join(targetRoot, ".codex-plugin", "plugin.json"), pluginJson);
  writeJson(path.join(targetRoot, ".mcp.json"), mcpJson);
  writeFile(
    path.join(targetRoot, "skills", pluginName, "SKILL.md"),
    pluginSkillMarkdown(fs.readFileSync(sourceSkillMd, "utf8"))
  );
  copyFile(sourceScript, path.join(targetRoot, "scripts", "token-billing-mcp.js"));
  copyFile(sourceRuntime, path.join(targetRoot, "runtime", "mission-invoice-runtime.cjs"));
}

writeJson(path.join(repoMarketplaceRoot, ".agents", "plugins", "marketplace.json"), marketplace);
writeJson(path.join(outRoot, "marketplace.json"), shareMarketplace);
writePlugin(repoPluginRoot);
writePlugin(sharePluginRoot);

console.log(`Built ${path.relative(root, repoPluginRoot)} and ${path.relative(root, outRoot)}`);
