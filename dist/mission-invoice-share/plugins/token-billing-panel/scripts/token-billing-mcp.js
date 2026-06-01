#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { URL } = require("url");

const DATA_DIR = process.env.TOKEN_BILLING_PANEL_DATA_DIR || path.join(os.homedir(), ".codex-token-billing");
const LOG_FILE = path.join(DATA_DIR, "usage-log.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const DASHBOARD_PORT = Number(process.env.TOKEN_BILLING_PANEL_PORT || 48732);
const SETUP_START = "<!-- mission-invoice:start -->";
const SETUP_END = "<!-- mission-invoice:end -->";

let httpServer = null;

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify({ records: [] }, null, 2));
  }
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(
        {
          currency: "tokens",
          estimateMultiplier: 1,
          monthlyTokenBudget: 2000000,
          resetDay: 1,
          invoiceEnabled: true,
          categories: [
            "planning",
            "coding",
            "frontend-review",
            "analysis",
            "documentation",
            "debugging"
          ]
        },
        null,
        2
      )
    );
  } else {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      let changed = false;
      if (settings.monthlyTokenBudget === undefined) {
        settings.monthlyTokenBudget = 2000000;
        changed = true;
      }
      if (settings.resetDay === undefined) {
        settings.resetDay = 1;
        changed = true;
      }
      if (settings.invoiceEnabled === undefined) {
        settings.invoiceEnabled = true;
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      }
    } catch {
      fs.writeFileSync(
        SETTINGS_FILE,
        JSON.stringify({ currency: "tokens", estimateMultiplier: 1, monthlyTokenBudget: 2000000, resetDay: 1, invoiceEnabled: true }, null, 2)
      );
    }
  }
}

function readJson(file, fallback) {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureStore();
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function countTextTokens(text) {
  if (!text) return 0;
  const normalized = String(text).trim();
  if (!normalized) return 0;
  const cjk = (normalized.match(/[\u3400-\u9fff]/g) || []).length;
  const asciiWords = (normalized.replace(/[\u3400-\u9fff]/g, " ").match(/[A-Za-z0-9_]+/g) || []).length;
  const punctuation = (normalized.match(/[^\sA-Za-z0-9_\u3400-\u9fff]/g) || []).length;
  return Math.ceil(cjk * 1.35 + asciiWords * 1.25 + punctuation * 0.35);
}

function estimatePlanCost(args = {}) {
  const planText = args.plan || args.planText || "";
  const context = args.context || "";
  const taskType = args.taskType || args.category || "planning";
  const fileCount = Number(args.fileCount || 0);
  const expectedEdits = Number(args.expectedEdits || 0);
  const verificationSteps = Number(args.verificationSteps || 0);

  const planTokens = countTextTokens(planText);
  const contextTokens = countTextTokens(context);
  const taskBase = {
    planning: 900,
    coding: 2400,
    "frontend-review": 3200,
    analysis: 1800,
    documentation: 1600,
    debugging: 2800
  }[taskType] || 1800;

  const inputTokens = Math.ceil(contextTokens + planTokens + fileCount * 850 + verificationSteps * 350 + 500);
  const outputTokens = Math.ceil(taskBase + expectedEdits * 700 + verificationSteps * 650 + planTokens * 0.35);
  const totalTokens = inputTokens + outputTokens;
  const band = totalTokens < 6000 ? "低" : totalTokens < 18000 ? "中" : "高";
  const low = Math.ceil(totalTokens * 0.72);
  const high = Math.ceil(totalTokens * 1.45);

  const drivers = [];
  if (fileCount > 0) drivers.push(`預計讀取 ${fileCount} 個檔案`);
  if (expectedEdits > 0) drivers.push(`預計修改 ${expectedEdits} 個區塊`);
  if (verificationSteps > 0) drivers.push(`包含 ${verificationSteps} 個驗證步驟`);
  if (contextTokens > 1200) drivers.push("上下文內容較長");
  if (drivers.length === 0) drivers.push("以計畫文字長度與任務類型估算");

  return {
    taskType,
    inputTokens,
    outputTokens,
    totalTokens,
    range: { low, high },
    band,
    confidence: fileCount || expectedEdits || verificationSteps ? "medium" : "low",
    drivers
  };
}

function formatReceiptNo(date = new Date()) {
  const y = String(date.getFullYear()).slice(2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TX-${y}${m}-${random}`;
}

function dashboardBaseUrl() {
  return `http://127.0.0.1:${DASHBOARD_PORT}`;
}

function msFromArgs(args = {}) {
  if (args.durationMs !== undefined) return Number(args.durationMs || 0);
  const started = args.startedAt ? new Date(args.startedAt).getTime() : 0;
  const ended = args.endedAt ? new Date(args.endedAt).getTime() : Date.now();
  if (!started || Number.isNaN(started) || Number.isNaN(ended)) return 0;
  return Math.max(0, ended - started);
}

function defaultLineItems(args = {}, estimate = null) {
  if (Array.isArray(args.lineItems) && args.lineItems.length > 0) {
    return args.lineItems.map((item) => ({
      label: item.label || item.name || "Token item",
      quantity: Number(item.quantity || item.qty || 1),
      tokens: Number(item.tokens || 0)
    }));
  }

  const totalTokens = Number(args.totalTokens ?? estimate?.totalTokens ?? 0);
  const inputTokens = Number(args.inputTokens ?? estimate?.inputTokens ?? 0);
  const outputTokens = Number(args.outputTokens ?? estimate?.outputTokens ?? 0);
  const items = [];
  if (inputTokens > 0) items.push({ label: "讀取與理解", quantity: 1, tokens: inputTokens });
  if (outputTokens > 0) items.push({ label: "生成與整理", quantity: 1, tokens: outputTokens });
  if (items.length === 0 && totalTokens > 0) items.push({ label: "任務處理", quantity: 1, tokens: totalTokens });
  if (items.length === 0) items.push({ label: "待估算項目", quantity: 1, tokens: 0 });
  return items;
}

function summarize(records) {
  const settings = readJson(SETTINGS_FILE, {});
  const todayKey = new Date().toISOString().slice(0, 10);
  const totals = {
    records: records.length,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
  const today = {
    records: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
  const byCategory = {};
  const recent = records.slice(-12).reverse();
  const latestReceipt = records.slice().reverse().find((record) => record.receipt);

  for (const record of records) {
    const category = record.category || "uncategorized";
    const input = Number(record.inputTokens || 0);
    const output = Number(record.outputTokens || 0);
    const total = Number(record.totalTokens || input + output || 0);
    totals.inputTokens += input;
    totals.outputTokens += output;
    totals.totalTokens += total;
    if (String(record.createdAt || record.endedAt || "").slice(0, 10) === todayKey) {
      today.records += 1;
      today.inputTokens += input;
      today.outputTokens += output;
      today.totalTokens += total;
    }
    if (!byCategory[category]) {
      byCategory[category] = { category, records: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    }
    byCategory[category].records += 1;
    byCategory[category].inputTokens += input;
    byCategory[category].outputTokens += output;
    byCategory[category].totalTokens += total;
  }

  const categories = Object.values(byCategory).sort((a, b) => b.totalTokens - a.totalTokens);
  const monthlyTokenBudget = Number(settings.monthlyTokenBudget || 0);
  const remainingTokens = Math.max(0, monthlyTokenBudget - totals.totalTokens);
  return {
    generatedAt: new Date().toISOString(),
    dataDir: DATA_DIR,
    logFile: LOG_FILE,
    totals,
    today,
    wallet: {
      monthlyTokenBudget,
      usedTokens: totals.totalTokens,
      remainingTokens,
      usageRate: monthlyTokenBudget > 0 ? totals.totalTokens / monthlyTokenBudget : 0,
      resetDay: Number(settings.resetDay || 1)
    },
    categories,
    recent
    ,
    latestReceipt
  };
}

function getUsageSummary() {
  const data = readJson(LOG_FILE, { records: [] });
  return summarize(Array.isArray(data.records) ? data.records : []);
}

function getInvoiceMode() {
  const settings = readJson(SETTINGS_FILE, {});
  return {
    invoiceEnabled: settings.invoiceEnabled !== false,
    commandOn: "/mission on",
    commandOff: "/mission off",
    commandSetup: "/mission setup",
    legacyOnAliases: ["/Token Billing Invoice"],
    legacyOffAliases: ["/Token Billing texfree", "/Token Billing taxfree"]
  };
}

function projectAgentsPath(projectPath) {
  const resolved = path.resolve(String(projectPath || process.cwd()));
  return path.join(resolved, "AGENTS.md");
}

function projectSetupBlock() {
  return `${SETUP_START}

## Mission Invoice

- Mission Invoice is ON by default for this project.
- For every Codex interaction that consumes tokens, record a Mission Invoice receipt before the final response and include the receipt link.
- General user tasks do not need a prefix. Only use commands when changing invoice behavior.
- Use \`/mission on\` to enable invoice generation.
- Use \`/mission off\` to disable invoice generation.
- Use \`/mission setup\` to refresh this project rule after asking the user for confirmation.

${SETUP_END}`;
}

function getProjectSetupStatus(args = {}) {
  const agentsPath = projectAgentsPath(args.projectPath);
  const exists = fs.existsSync(agentsPath);
  const content = exists ? fs.readFileSync(agentsPath, "utf8") : "";
  const hasRule = content.includes(SETUP_START) && content.includes(SETUP_END);
  return {
    projectPath: path.dirname(agentsPath),
    agentsPath,
    exists,
    hasMissionInvoiceRule: hasRule,
    commandSetup: "/mission setup",
    needsUserConsent: !hasRule,
    prompt: hasRule
      ? "Mission Invoice rules are already installed in this project's AGENTS.md."
      : "This project has no Mission Invoice AGENTS.md rule yet. Ask the user whether to add it before writing anything."
  };
}

function setupProject(args = {}) {
  const status = getProjectSetupStatus(args);
  if (args.confirmed !== true) {
    return {
      ...status,
      skipped: true,
      message: "User confirmation is required before writing Mission Invoice rules to AGENTS.md."
    };
  }

  const block = projectSetupBlock();
  let content = "";
  if (status.exists) {
    content = fs.readFileSync(status.agentsPath, "utf8");
  }

  if (status.hasMissionInvoiceRule) {
    const pattern = new RegExp(`${SETUP_START}[\\s\\S]*?${SETUP_END}`);
    content = content.replace(pattern, block);
  } else {
    const separator = content.trim() ? "\n\n" : "";
    content = `${content.replace(/\s*$/, "")}${separator}${block}\n`;
  }

  fs.writeFileSync(status.agentsPath, content);
  return {
    ...getProjectSetupStatus(args),
    skipped: false,
    message: "Mission Invoice rules were added to this project's AGENTS.md."
  };
}

function setInvoiceMode(args = {}) {
  const settings = readJson(SETTINGS_FILE, {});
  const rawMode = String(args.mode || "").trim().toLowerCase();
  const normalizedMode = rawMode.replace(/^\/+/, "").replace(/\s+/g, " ");
  let enabled;
  if (typeof args.enabled === "boolean") {
    enabled = args.enabled;
  } else if (["mission on", "on", "invoice", "token billing invoice", "enabled", "enable", "true"].includes(normalizedMode)) {
    enabled = true;
  } else if (["mission off", "off", "texfree", "taxfree", "token billing texfree", "token billing taxfree", "disabled", "disable", "false"].includes(normalizedMode)) {
    enabled = false;
  } else {
    enabled = true;
  }
  settings.invoiceEnabled = enabled;
  writeJson(SETTINGS_FILE, settings);
  return {
    invoiceEnabled: enabled,
    message: enabled
      ? "Mission Invoice is ON. Future token-consuming tasks should generate receipts automatically."
      : "Mission Invoice is OFF. Future token-consuming tasks should not generate receipts until /mission on is used."
  };
}

function recordTaskUsage(args = {}) {
  const mode = getInvoiceMode();
  if (mode.invoiceEnabled === false && args.force !== true) {
    return {
      skipped: true,
      invoiceEnabled: false,
      receiptUrl: null,
      message: "Mission Invoice is OFF; receipt generation was skipped."
    };
  }
  const data = readJson(LOG_FILE, { records: [] });
  const estimate = args.estimate && typeof args.estimate === "object" ? args.estimate : null;
  const inputTokens = Number(args.inputTokens ?? estimate?.inputTokens ?? 0);
  const outputTokens = Number(args.outputTokens ?? estimate?.outputTokens ?? 0);
  const totalTokens = Number(args.totalTokens ?? estimate?.totalTokens ?? inputTokens + outputTokens);
  const startedAt = args.startedAt || undefined;
  const endedAt = args.endedAt || new Date().toISOString();
  const durationMs = msFromArgs({ ...args, endedAt });
  const lineItems = defaultLineItems({ ...args, inputTokens, outputTokens, totalTokens }, estimate);
  const receiptNo = args.receiptNo || formatReceiptNo(new Date(endedAt));
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    task: args.task || args.title || "Untitled task",
    category: args.category || estimate?.taskType || "uncategorized",
    model: args.model || "unknown",
    startedAt,
    endedAt,
    durationMs,
    inputTokens,
    outputTokens,
    totalTokens,
    confidence: args.confidence || estimate?.confidence || "estimated",
    status: args.status || "completed",
    notes: args.notes || "",
    receipt: {
      receiptNo,
      storeName: args.storeName || "Codex Token Mart",
      paymentType: args.paymentType || "Estimated",
      model: args.model || "unknown",
      startedAt,
      endedAt,
      durationMs,
      lineItems
    },
    estimate: estimate || undefined
  };
  record.receiptUrl = `${dashboardBaseUrl()}/receipt/${encodeURIComponent(record.id)}`;
  data.records = Array.isArray(data.records) ? data.records : [];
  data.records.push(record);
  writeJson(LOG_FILE, data);
  return { record, receiptUrl: record.receiptUrl, summary: getUsageSummary() };
}

function getLatestReceipt() {
  const data = readJson(LOG_FILE, { records: [] });
  const records = Array.isArray(data.records) ? data.records : [];
  return records.slice().reverse().find((record) => record.receipt) || null;
}

function getReceiptById(id) {
  const data = readJson(LOG_FILE, { records: [] });
  const records = Array.isArray(data.records) ? data.records : [];
  return records.find((record) => record.id === id) || null;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  res.end(body);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function receiptPageHtml(record) {
  const receipt = record?.receipt;
  const lineItems = receipt?.lineItems || [];
  const itemRows = lineItems.map((item) => `
      <tr>
        <td>${escapeHtml(item.label)}</td>
        <td class="num">${escapeHtml(item.quantity || 1)}</td>
        <td class="num">${escapeHtml(Number(item.tokens || 0).toLocaleString("zh-Hant-TW"))}</td>
      </tr>`).join("");
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Token 電子發票</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: start center; background: #eef1f5; color: #16181d; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 28px 16px; }
    .receipt { width: min(390px, 100%); background: #fffefa; border: 1px solid #dad4c8; box-shadow: 0 18px 42px rgba(28, 33, 39, .16); padding: 22px 20px; }
    .center { text-align: center; }
    .title { font-size: 20px; font-weight: 800; letter-spacing: 0; }
    .subtitle { color: #69707a; font-size: 12px; margin-top: 4px; }
    .cut { border-top: 1px dashed #9ca3af; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; gap: 14px; margin: 8px 0; font-size: 13px; }
    .row span:first-child { color: #69707a; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 7px 0; border-bottom: 1px dotted #c7ccd4; text-align: left; }
    th { color: #69707a; font-weight: 700; }
    .num { text-align: right; }
    .total { font-size: 22px; font-weight: 900; }
    .badge { display: inline-block; border: 1px solid #1f7a5a; color: #1f7a5a; padding: 4px 8px; border-radius: 999px; font-size: 12px; }
    a { color: #2457a6; text-decoration: none; }
  </style>
</head>
<body>
  <article class="receipt">
    <div class="center">
      <div class="title">${escapeHtml(receipt?.storeName || "Codex Token Mart")}</div>
      <div class="subtitle">TOKEN ELECTRONIC RECEIPT</div>
      <div class="subtitle">${escapeHtml(receipt?.receiptNo || "NO-RECEIPT")}</div>
    </div>
    <div class="cut"></div>
    <div class="row"><span>任務</span><strong>${escapeHtml(record?.task || "尚無任務")}</strong></div>
    <div class="row"><span>類型</span><strong>${escapeHtml(record?.category || "-")}</strong></div>
    <div class="row"><span>模型</span><strong>${escapeHtml(record?.model || receipt?.model || "unknown")}</strong></div>
    <div class="row"><span>耗時</span><strong>${escapeHtml(formatDuration(record?.durationMs || receipt?.durationMs))}</strong></div>
    <div class="row"><span>時間</span><strong>${escapeHtml(record?.endedAt || record?.createdAt || "-")}</strong></div>
    <div class="cut"></div>
    <table>
      <thead><tr><th>品項</th><th class="num">數量</th><th class="num">TOKENS</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="3">尚無明細</td></tr>'}</tbody>
    </table>
    <div class="cut"></div>
    <div class="row"><span>INPUT</span><strong>${escapeHtml(Number(record?.inputTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
    <div class="row"><span>OUTPUT</span><strong>${escapeHtml(Number(record?.outputTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
    <div class="row"><span>TOTAL</span><strong class="total">${escapeHtml(Number(record?.totalTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
    <div class="row"><span>PAYMENT</span><span class="badge">${escapeHtml(receipt?.paymentType || "Estimated")}</span></div>
    <div class="cut"></div>
    <div class="center subtitle">資料僅儲存在本機。<br><a href="/dashboard">查看 Dashboard</a></div>
  </article>
</body>
</html>`;
}

function dashboardHtml() {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mission Invoice</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17202a;
      --muted: #667085;
      --line: #d8dee8;
      --panel: #ffffff;
      --bg: #f5f7fa;
      --green: #1f7a5a;
      --blue: #2457a6;
      --amber: #a05a00;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
    header { padding: 22px 28px 18px; border-bottom: 1px solid var(--line); background: #fff; }
    h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
    main { padding: 24px 28px 36px; display: grid; gap: 18px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    .tabs { display: flex; gap: 4px; margin-top: 18px; }
    .tab { appearance: none; border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--muted); cursor: pointer; font: inherit; font-weight: 700; padding: 12px 16px; }
    .tab.active { color: var(--ink); border-bottom-color: var(--blue); }
    .panel { display: none; }
    .panel.active { display: grid; gap: 18px; }
    .label { color: var(--muted); font-size: 13px; }
    .value { font-size: 28px; font-weight: 700; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-weight: 600; }
    .muted { color: var(--muted); }
    .num { text-align: right; }
    .wallet-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .wallet-bar { height: 14px; background: #e6ebf2; border-radius: 999px; overflow: hidden; }
    .wallet-fill { height: 100%; background: var(--green); }
    .history-actions a { color: var(--blue); font-weight: 700; text-decoration: none; }
    .top-link { color: var(--blue); font-weight: 700; text-decoration: none; }
    @media (max-width: 820px) {
      header, main { padding-left: 16px; padding-right: 16px; }
      .wallet-grid { grid-template-columns: 1fr; }
      .value { font-size: 24px; }
      .tabs { overflow-x: auto; }
      .tab { white-space: nowrap; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Mission Invoice</h1>
    <div class="muted">歷史帳單與錢包資訊</div>
    <p><a class="top-link" href="/">回到最新發票</a></p>
    <nav class="tabs" aria-label="Dashboard tabs">
      <button class="tab active" data-tab="history">歷史帳單</button>
      <button class="tab" data-tab="wallet">錢包資訊</button>
    </nav>
  </header>
  <main>
    <section id="history" class="panel active">
      <div class="card">
        <h2>歷史帳單</h2>
        <table>
          <thead><tr><th>發票號碼</th><th class="num">Token 花費</th><th>明細</th></tr></thead>
          <tbody id="history-rows"></tbody>
        </table>
      </div>
    </section>
    <section id="wallet" class="panel">
      <div class="wallet-grid">
        <div class="card"><div class="label">總 token 預算</div><div id="wallet-budget" class="value">0</div></div>
        <div class="card"><div class="label">剩餘 token</div><div id="wallet-remaining" class="value">0</div></div>
        <div class="card"><div class="label">本日任務筆數</div><div id="wallet-today" class="value">0</div></div>
      </div>
      <div class="card">
        <div class="label">使用率</div>
        <div class="wallet-bar"><div id="wallet-fill" class="wallet-fill" style="width:0%"></div></div>
        <p id="wallet-copy" class="muted"></p>
      </div>
    </section>
  </main>
  <script>
    const fmt = new Intl.NumberFormat("zh-Hant-TW");
    function setText(id, value) { document.getElementById(id).textContent = fmt.format(value || 0); }
    function switchTab(name) {
      document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === name));
    }
    async function load() {
      const [summaryRes, recordsRes] = await Promise.all([
        fetch("/api/summary", { cache: "no-store" }),
        fetch("/api/records", { cache: "no-store" })
      ]);
      const data = await summaryRes.json();
      const recordData = await recordsRes.json();
      const allRecords = Array.isArray(recordData.records) ? recordData.records.slice().reverse() : [];
      setText("wallet-budget", data.wallet.monthlyTokenBudget);
      setText("wallet-remaining", data.wallet.remainingTokens);
      setText("wallet-today", data.today.records);
      const usagePct = Math.min(100, Math.max(0, (data.wallet.usageRate || 0) * 100));
      document.getElementById("wallet-fill").style.width = usagePct + "%";
      document.getElementById("wallet-copy").textContent = "已使用 " + fmt.format(data.wallet.usedTokens || 0) + " tokens，約 " + usagePct.toFixed(1) + "%。重置日：每月 " + (data.wallet.resetDay || 1) + " 日。";
      document.getElementById("history-rows").innerHTML = allRecords.length ? allRecords.map((item) => {
        const receipt = item.receipt || {};
        const url = item.receiptUrl || ("/receipt/" + encodeURIComponent(item.id));
        return \`<tr>
          <td>\${receipt.receiptNo || "-"}</td>
          <td class="num"><strong>\${fmt.format(item.totalTokens || 0)}</strong></td>
          <td class="history-actions"><a href="\${url}">查看</a></td>
        </tr>\`;
      }).join("") : '<tr><td colspan="3" class="muted">尚無歷史帳單</td></tr>';
    }
    document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
    load().catch((error) => {
      document.querySelector("main").innerHTML = '<div class="card">Dashboard API 尚未啟動：' + error.message + '</div>';
    });
  </script>
</body>
</html>`;
}

function startDashboardServer() {
  if (httpServer) {
    return `http://127.0.0.1:${DASHBOARD_PORT}`;
  }
  ensureStore();
  httpServer = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://127.0.0.1:${DASHBOARD_PORT}`);
    if (requestUrl.pathname === "/api/summary") {
      sendJson(res, 200, getUsageSummary());
      return;
    }
    if (requestUrl.pathname === "/api/receipt/latest") {
      sendJson(res, 200, getLatestReceipt() || {});
      return;
    }
    if (requestUrl.pathname === "/api/records") {
      sendJson(res, 200, readJson(LOG_FILE, { records: [] }));
      return;
    }
    if (requestUrl.pathname === "/receipt/latest") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(receiptPageHtml(getLatestReceipt()));
      return;
    }
    if (requestUrl.pathname.startsWith("/receipt/")) {
      const id = decodeURIComponent(requestUrl.pathname.slice("/receipt/".length));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(receiptPageHtml(getReceiptById(id)));
      return;
    }
    if (requestUrl.pathname === "/dashboard") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(dashboardHtml());
      return;
    }
    if (requestUrl.pathname === "/" || requestUrl.pathname === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(receiptPageHtml(getLatestReceipt()));
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  });
  httpServer.listen(DASHBOARD_PORT, "127.0.0.1");
  httpServer.on("error", (error) => {
    console.error(`[token-billing-panel] dashboard error: ${error.message}`);
  });
  return `http://127.0.0.1:${DASHBOARD_PORT}`;
}

const tools = [
  {
    name: "estimate_plan_cost",
    description: "Estimate expected token consumption for a proposed Codex plan.",
    inputSchema: {
      type: "object",
      properties: {
        plan: { type: "string", description: "Plan text to estimate." },
        context: { type: "string", description: "Optional relevant context." },
        taskType: { type: "string", description: "Task category such as coding, analysis, documentation, debugging, frontend-review, or planning." },
        fileCount: { type: "number", description: "Estimated number of files to inspect." },
        expectedEdits: { type: "number", description: "Estimated number of meaningful edit blocks." },
        verificationSteps: { type: "number", description: "Estimated number of test or verification steps." }
      }
    }
  },
  {
    name: "record_task_usage",
    description: "Append one local token usage record to the task ledger and generate a token receipt.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string" },
        category: { type: "string" },
        model: { type: "string" },
        startedAt: { type: "string" },
        endedAt: { type: "string" },
        durationMs: { type: "number" },
        inputTokens: { type: "number" },
        outputTokens: { type: "number" },
        totalTokens: { type: "number" },
        confidence: { type: "string" },
        status: { type: "string" },
        notes: { type: "string" },
        lineItems: { type: "array" },
        paymentType: { type: "string" },
        estimate: { type: "object" },
        force: { type: "boolean", description: "Record a receipt even when invoice mode is disabled." }
      }
    }
  },
  {
    name: "get_usage_summary",
    description: "Return local token usage totals, recent records, and category breakdown.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_invoice_mode",
    description: "Return whether automatic Mission Invoice generation is enabled.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "set_invoice_mode",
    description: "Enable or disable Mission Invoice generation. Use mode=off to disable and mode=on to enable.",
    inputSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        mode: { type: "string", description: "on/off, mission on/off, invoice/texfree legacy aliases, or enabled/disabled" }
      }
    }
  },
  {
    name: "get_project_setup_status",
    description: "Check whether a project's AGENTS.md already contains the Mission Invoice setup rule.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project root. Defaults to the MCP process working directory." }
      }
    }
  },
  {
    name: "setup_project_instructions",
    description: "Add or refresh Mission Invoice rules in a project's AGENTS.md after explicit user confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project root." },
        confirmed: { type: "boolean", description: "Must be true only after the user agreed to write the rule." }
      },
      required: ["projectPath", "confirmed"]
    }
  },
  {
    name: "open_billing_panel",
    description: "Start the local dashboard server and return its URL.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "open_latest_receipt",
    description: "Start the local dashboard server and return the latest token receipt URL.",
    inputSchema: { type: "object", properties: {} }
  }
];

function content(value) {
  return [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }];
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
}

async function callTool(name, args) {
  if (name === "estimate_plan_cost") return estimatePlanCost(args);
  if (name === "record_task_usage") return recordTaskUsage(args);
  if (name === "get_usage_summary") return getUsageSummary();
  if (name === "get_invoice_mode") return getInvoiceMode();
  if (name === "set_invoice_mode") return setInvoiceMode(args);
  if (name === "get_project_setup_status") return getProjectSetupStatus(args);
  if (name === "setup_project_instructions") return setupProject(args);
  if (name === "open_billing_panel") {
    const url = startDashboardServer();
    return { url, summary: getUsageSummary() };
  }
  if (name === "open_latest_receipt") {
    const url = startDashboardServer();
    return { url: `${url}/receipt/latest`, receipt: getLatestReceipt() };
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(request) {
  if (request.method === "initialize") {
    return {
      protocolVersion: request.params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "token-billing-panel", version: "0.1.0" }
    };
  }
  if (request.method === "tools/list") {
    return { tools };
  }
  if (request.method === "tools/call") {
    const result = await callTool(request.params?.name, request.params?.arguments || {});
    return { content: content(result) };
  }
  if (request.method === "ping" || request.method === "notifications/initialized") {
    return {};
  }
  throw new Error(`Unsupported method: ${request.method}`);
}

let buffer = Buffer.alloc(0);

function extractMessages() {
  const messages = [];
  while (buffer.length > 0) {
    const text = buffer.toString("utf8");
    if (text.startsWith("Content-Length:")) {
      const headerEnd = text.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = text.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = Buffer.byteLength(text.slice(0, headerEnd + 4), "utf8");
      if (buffer.length < bodyStart + length) break;
      messages.push(buffer.subarray(bodyStart, bodyStart + length).toString("utf8"));
      buffer = buffer.subarray(bodyStart + length);
      continue;
    }

    const newline = text.indexOf("\n");
    if (newline === -1) break;
    messages.push(text.slice(0, newline).trim());
    buffer = buffer.subarray(Buffer.byteLength(text.slice(0, newline + 1), "utf8"));
  }
  return messages.filter(Boolean);
}

if (process.argv.includes("--dashboard-only")) {
  const url = startDashboardServer();
  console.log(`Mission Invoice dashboard: ${url}`);
  process.stdin.resume();
} else {
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
  for (const rawMessage of extractMessages()) {
    let request;
    try {
      request = JSON.parse(rawMessage);
    } catch (error) {
      continue;
    }
    handle(request)
      .then((result) => {
        if (request.id === undefined) return;
        sendMessage({ jsonrpc: "2.0", id: request.id, result });
      })
      .catch((error) => {
        if (request.id === undefined) return;
        sendMessage({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32000, message: error.message }
        });
      });
  }
});

ensureStore();
}
