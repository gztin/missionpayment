#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceSkill = path.join(root, "skills", "mission-invoice");
const outRoot = path.join(root, "dist", "mission-invoice-share");
const pluginName = "token-billing-panel";
const pluginRoot = path.join(outRoot, "plugins", pluginName);

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
      "description: Estimate planned Codex token usage, record Mission Invoice static receipts, control invoice mode, switch the reference model, and review local receipt history. Use for every token-consuming Codex task by default, and whenever the user asks about token usage, Mission Invoice, payment records, receipt history, or model-based credit estimates."
    )
    .replace(
      "Use this skill when Mission Invoice is installed as a generic Codex skill instead of the full plugin marketplace package.",
      "Use this skill for every Codex interaction that consumes tokens unless Mission Invoice is disabled."
    );
}

const sourceSkillMd = path.join(sourceSkill, "SKILL.md");
const sourceScript = path.join(sourceSkill, "scripts", "token-billing-mcp.js");
assertFile(sourceSkillMd);
assertFile(sourceScript);

writeJson(path.join(outRoot, "marketplace.json"), {
  name: "mission-invoice-share",
  interface: {
    displayName: "Mission Invoice Share"
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
});

writeJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"), {
  name: pluginName,
  version: "0.1.0+codex.20260601083233",
  description: "Mission Invoice 會為 Codex 專案產生本機 Token 電子發票，支援 /mission setup 專案初始化，並可用 /mission on 或 /mission off 切換。",
  author: {
    name: "本機開發者"
  },
  skills: "./skills/",
  interface: {
    displayName: "Mission Invoice",
    shortDescription: "自動開立 Token 電子發票，支援 /mission setup 專案初始化與 /mission on/off 開關。",
    longDescription: "Mission Invoice 會在 Codex 任務消耗 token 後，透過本機 MCP 流程記錄一張估算的 Token 電子發票，內容包含模型、耗時、明細項目與發票連結。一般任務不需要加任何前綴；只要 Mission Invoice 為 ON，就會在任務完成前自動開立發票並在回覆中附上連結。專案第一次使用時可執行 /mission setup：外掛會先詢問是否將 Mission Invoice 規則加入該專案的 AGENTS.md，只有在使用者同意後才會寫入，且會使用可辨識區塊避免重複。只有切換開票功能時才需要使用指令：/mission on 會開啟自動開票，/mission off 會關閉自動開票。/mission model list 可查看支援的參考模型，/mission model <model> 可切換 credits 估算用的參考費率。外掛會產生本機靜態 HTML 發票、歷史帳單與統計資訊，不需要啟動本機 dashboard server。所有紀錄都只儲存在本機 ~/.codex-token-billing。此插件不會讀取官方 Codex 帳號方案、實際用量或帳單資料。",
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
      "/mission setup",
      "/mission model list",
      "打開我最新的 Mission Invoice。",
      "顯示我的 Mission Invoice 歷史帳單。",
      "估算這次任務的 Mission Invoice。"
    ]
  },
  mcpServers: "./.mcp.json"
});

writeJson(path.join(pluginRoot, ".mcp.json"), {
  mcpServers: {
    [pluginName]: {
      command: "node",
      args: [
        "./scripts/token-billing-mcp.js"
      ]
    }
  }
});

writeFile(
  path.join(pluginRoot, "skills", pluginName, "SKILL.md"),
  pluginSkillMarkdown(fs.readFileSync(sourceSkillMd, "utf8"))
);
copyFile(sourceScript, path.join(pluginRoot, "scripts", "token-billing-mcp.js"));

console.log(`Built ${path.relative(root, outRoot)}`);
