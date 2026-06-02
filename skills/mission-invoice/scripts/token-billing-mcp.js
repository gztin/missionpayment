#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { pathToFileURL } = require("url");

const DATA_DIR = process.env.TOKEN_BILLING_PANEL_DATA_DIR || path.join(os.homedir(), ".codex-token-billing");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const SETUP_START = "<!-- mission-invoice:start -->";
const SETUP_END = "<!-- mission-invoice:end -->";
const DEFAULT_RATE_MODEL = "gpt-5.5";
const RATE_CARD_SOURCE = "https://help.openai.com/en/articles/20001106-codex-rate-card";
const MODEL_ALIASES = {
  "5.5": "gpt-5.5",
  "gpt-5.5": "gpt-5.5",
  "gpt5.5": "gpt-5.5",
  "5.4": "gpt-5.4",
  "gpt-5.4": "gpt-5.4",
  "gpt5.4": "gpt-5.4",
  "5.3-codex": "gpt-5.3-codex",
  "gpt-5.3-codex": "gpt-5.3-codex",
  "gpt5.3-codex": "gpt-5.3-codex",
  "5.2": "gpt-5.2",
  "gpt-5.2": "gpt-5.2",
  "gpt5.2": "gpt-5.2"
};
const TOKEN_RATE_CARD = {
  "gpt-5.5": { displayName: "GPT-5.5", input: 125, cachedInput: 12.5, output: 750 },
  "gpt-5.4": { displayName: "GPT-5.4", input: 62.5, cachedInput: 6.25, output: 375 },
  "gpt-5.3-codex": { displayName: "GPT-5.3-Codex", input: 43.75, cachedInput: 4.375, output: 350 },
  "gpt-5.2": { displayName: "GPT-5.2", input: 43.75, cachedInput: 4.375, output: 350 }
};

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(
        {
          currency: "tokens",
          estimateMultiplier: 1,
          monthlyTokenBudget: 2000000,
          resetDay: 1,
          referenceModel: DEFAULT_RATE_MODEL,
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
      if (settings.referenceModel === undefined) {
        settings.referenceModel = DEFAULT_RATE_MODEL;
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
      }
    } catch {
      fs.writeFileSync(
        SETTINGS_FILE,
        JSON.stringify({ currency: "tokens", estimateMultiplier: 1, monthlyTokenBudget: 2000000, resetDay: 1, referenceModel: DEFAULT_RATE_MODEL, invoiceEnabled: true }, null, 2)
      );
    }
  }
}

function safeIdentifier(value, fallback = "project") {
  return String(value || fallback)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function projectDataPaths(args = {}) {
  const rawPath = args.projectPath || args.cwd || process.cwd();
  const projectPath = path.resolve(String(rawPath));
  const baseName = safeIdentifier(path.basename(projectPath), "project").slice(0, 40);
  const hash = crypto.createHash("sha256").update(projectPath).digest("hex").slice(0, 12);
  const projectId = args.projectId ? safeIdentifier(args.projectId) : `${baseName}-${hash}`;
  const dataDir = path.join(PROJECTS_DIR, projectId);
  return {
    projectPath,
    projectId,
    dataDir,
    logFile: path.join(dataDir, "usage-log.json"),
    receiptsDir: path.join(dataDir, "receipts")
  };
}

function ensureProjectStore(paths) {
  ensureStore();
  fs.mkdirSync(paths.dataDir, { recursive: true });
  if (!fs.existsSync(paths.logFile)) {
    fs.writeFileSync(paths.logFile, JSON.stringify({ projectPath: paths.projectPath, projectId: paths.projectId, records: [] }, null, 2));
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
  fs.mkdirSync(path.dirname(file), { recursive: true });
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

function normalizeModelName(model) {
  return String(model || "").trim().toLowerCase();
}

function normalizeReferenceModel(model) {
  const normalized = normalizeModelName(model).replace(/\s+/g, "-");
  return MODEL_ALIASES[normalized] || (TOKEN_RATE_CARD[normalized] ? normalized : DEFAULT_RATE_MODEL);
}

function getReferenceModel() {
  const settings = readJson(SETTINGS_FILE, {});
  return normalizeReferenceModel(settings.referenceModel || DEFAULT_RATE_MODEL);
}

function getReferenceModelInfo(model = getReferenceModel()) {
  const key = normalizeReferenceModel(model);
  return {
    key,
    ...TOKEN_RATE_CARD[key]
  };
}

function listReferenceModels() {
  const current = getReferenceModel();
  return Object.entries(TOKEN_RATE_CARD).map(([key, value]) => ({
    key,
    displayName: value.displayName,
    inputCreditsPerMillion: value.input,
    cachedInputCreditsPerMillion: value.cachedInput,
    outputCreditsPerMillion: value.output,
    selected: key === current
  }));
}

function rateForModel(model) {
  const normalized = normalizeReferenceModel(model);
  return TOKEN_RATE_CARD[normalized] || TOKEN_RATE_CARD[DEFAULT_RATE_MODEL];
}

function estimateTokenSpend({ model, inputTokens = 0, outputTokens = 0, cachedInputTokens = 0 } = {}) {
  const rateModel = normalizeReferenceModel(model || getReferenceModel());
  const rate = rateForModel(rateModel);
  const billableInputTokens = Math.max(0, Number(inputTokens || 0) - Number(cachedInputTokens || 0));
  const cachedTokens = Math.max(0, Number(cachedInputTokens || 0));
  const inputCredits = (billableInputTokens / 1000000) * rate.input;
  const cachedInputCredits = (cachedTokens / 1000000) * rate.cachedInput;
  const outputCredits = (Number(outputTokens || 0) / 1000000) * rate.output;
  const totalCredits = inputCredits + cachedInputCredits + outputCredits;
  return {
    currency: "credits",
    rateModel,
    rateModelDisplayName: rate.displayName,
    rateSource: RATE_CARD_SOURCE,
    ratePerMillionTokens: {
      input: rate.input,
      cachedInput: rate.cachedInput,
      output: rate.output
    },
    cachedInputTokens: cachedTokens,
    inputCredits,
    cachedInputCredits,
    outputCredits,
    totalCredits,
    inputUsd: 0,
    cachedInputUsd: 0,
    outputUsd: 0,
    totalUsd: 0
  };
}

function formatCredits(value) {
  return `${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} credits`;
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
  const band = totalTokens < 6000 ? "low" : totalTokens < 18000 ? "medium" : "high";
  const low = Math.ceil(totalTokens * 0.72);
  const high = Math.ceil(totalTokens * 1.45);

  const drivers = [];
  if (fileCount > 0) drivers.push(`Need to inspect about ${fileCount} files.`);
  if (expectedEdits > 0) drivers.push(`Expected edit blocks: ${expectedEdits}.`);
  if (verificationSteps > 0) drivers.push(`Verification steps: ${verificationSteps}.`);
  if (contextTokens > 1200) drivers.push("Large context was provided.");
  if (drivers.length === 0) drivers.push("Baseline estimate from task type and plan length.");

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

function safeReceiptFilename(receiptNo, id) {
  const base = String(receiptNo || id || "receipt")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "receipt"}.html`;
}

function writeStaticReceipt(record, paths = projectDataPaths({ projectPath: record?.projectPath })) {
  ensureProjectStore(paths);
  fs.mkdirSync(paths.receiptsDir, { recursive: true });
  const receiptNo = record?.receipt?.receiptNo || record?.id;
  const receiptFile = path.join(paths.receiptsDir, safeReceiptFilename(receiptNo, record?.id));
  fs.writeFileSync(receiptFile, receiptPageHtml(record, { static: true }), "utf8");
  return {
    receiptFile,
    receiptFileUrl: pathToFileURL(receiptFile).href
  };
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
  if (inputTokens > 0) items.push({ label: "Read and understand", quantity: 1, tokens: inputTokens });
  if (outputTokens > 0) items.push({ label: "Generate and summarize", quantity: 1, tokens: outputTokens });
  if (items.length === 0 && totalTokens > 0) items.push({ label: "Total tokens", quantity: 1, tokens: totalTokens });
  if (items.length === 0) items.push({ label: "Unrecorded item", quantity: 1, tokens: 0 });
  return items;
}

function displayModelForRecord(record = {}) {
  const spend = record.tokenSpend || {};
  const receipt = record.receipt || {};
  return spend.rateModelDisplayName || receipt.model || record.model || "Unknown";
}

function summarize(records, paths = projectDataPaths({})) {
  const settings = readJson(SETTINGS_FILE, {});
  const todayKey = new Date().toISOString().slice(0, 10);
  const totals = {
    records: records.length,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCredits: 0,
    estimatedUsd: 0
  };
  const today = {
    records: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCredits: 0,
    estimatedUsd: 0
  };
  const byCategory = {};
  const byModel = {};
  const recent = records.slice(-12).reverse();
  const latestReceipt = records.slice().reverse().find((record) => record.receipt);

  for (const record of records) {
    const category = record.category || "uncategorized";
    const modelName = displayModelForRecord(record);
    const input = Number(record.inputTokens || 0);
    const output = Number(record.outputTokens || 0);
    const total = Number(record.totalTokens || input + output || 0);
    const spend = record.tokenSpend || estimateTokenSpend({ model: record.model, inputTokens: input, outputTokens: output });
    totals.inputTokens += input;
    totals.outputTokens += output;
    totals.totalTokens += total;
    const credits = Number(spend.totalCredits ?? spend.totalUsd ?? 0);
    totals.estimatedCredits += credits;
    totals.estimatedUsd += Number(spend.totalUsd || 0);
    if (String(record.createdAt || record.endedAt || "").slice(0, 10) === todayKey) {
      today.records += 1;
      today.inputTokens += input;
      today.outputTokens += output;
      today.totalTokens += total;
      today.estimatedCredits += credits;
      today.estimatedUsd += Number(spend.totalUsd || 0);
    }
    if (!byCategory[category]) {
      byCategory[category] = { category, records: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    }
    byCategory[category].records += 1;
    byCategory[category].inputTokens += input;
    byCategory[category].outputTokens += output;
    byCategory[category].totalTokens += total;
    if (!byModel[modelName]) {
      byModel[modelName] = { model: modelName, records: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, categories: {} };
    }
    byModel[modelName].records += 1;
    byModel[modelName].inputTokens += input;
    byModel[modelName].outputTokens += output;
    byModel[modelName].totalTokens += total;
    if (!byModel[modelName].categories[category]) {
      byModel[modelName].categories[category] = { category, records: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    }
    byModel[modelName].categories[category].records += 1;
    byModel[modelName].categories[category].inputTokens += input;
    byModel[modelName].categories[category].outputTokens += output;
    byModel[modelName].categories[category].totalTokens += total;
  }

  const categories = Object.values(byCategory).sort((a, b) => b.totalTokens - a.totalTokens);
  const models = Object.values(byModel)
    .map((model) => ({
      ...model,
      categories: Object.values(model.categories).sort((a, b) => b.totalTokens - a.totalTokens)
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
  const monthlyTokenBudget = Number(settings.monthlyTokenBudget || 0);
  const remainingTokens = Math.max(0, monthlyTokenBudget - totals.totalTokens);
  return {
    generatedAt: new Date().toISOString(),
    dataDir: paths.dataDir,
    logFile: paths.logFile,
    project: {
      id: paths.projectId,
      path: paths.projectPath
    },
    totals,
    today,
    rateCard: {
      source: RATE_CARD_SOURCE,
      defaultModel: DEFAULT_RATE_MODEL,
      rates: TOKEN_RATE_CARD
    },
    referenceModel: getReferenceModelInfo(),
    wallet: {
      monthlyTokenBudget,
      usedTokens: totals.totalTokens,
      remainingTokens,
      usageRate: monthlyTokenBudget > 0 ? totals.totalTokens / monthlyTokenBudget : 0,
      resetDay: Number(settings.resetDay || 1)
    },
    categories,
    models,
    recent
    ,
    latestReceipt
  };
}

function getUsageSummary(args = {}) {
  const paths = projectDataPaths(args);
  ensureProjectStore(paths);
  const data = readJson(paths.logFile, { records: [] });
  return summarize(Array.isArray(data.records) ? data.records.map(withTokenSpend) : [], paths);
}

function withTokenSpend(record) {
  const inputTokens = Number(record?.inputTokens || 0);
  const outputTokens = Number(record?.outputTokens || 0);
  const tokenSpend = record?.tokenSpend && record.tokenSpend.totalCredits !== undefined
    ? record.tokenSpend
    : estimateTokenSpend({
      model: record?.referenceModel || record?.model || getReferenceModel(),
      inputTokens,
      outputTokens,
      cachedInputTokens: record?.cachedInputTokens || 0
    });
  return {
    ...record,
    tokenSpend
  };
}

function getUsageRecords(args = {}) {
  const paths = projectDataPaths(args);
  ensureProjectStore(paths);
  const data = readJson(paths.logFile, { records: [] });
  const records = Array.isArray(data.records) ? data.records.map(withTokenSpend) : [];
  return { ...data, projectPath: paths.projectPath, projectId: paths.projectId, records };
}

function getInvoiceMode() {
  const settings = readJson(SETTINGS_FILE, {});
  return {
    invoiceEnabled: settings.invoiceEnabled !== false,
    commandOn: "/mission on",
    commandOff: "/mission off",
    commandSetup: "/mission setup",
    commandModel: "/mission model GPT-5.5",
    referenceModel: getReferenceModelInfo(),
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
  const paths = projectDataPaths(args);
  ensureProjectStore(paths);
  const data = readJson(paths.logFile, { projectPath: paths.projectPath, projectId: paths.projectId, records: [] });
  const estimate = args.estimate && typeof args.estimate === "object" ? args.estimate : null;
  const inputTokens = Number(args.inputTokens ?? estimate?.inputTokens ?? 0);
  const outputTokens = Number(args.outputTokens ?? estimate?.outputTokens ?? 0);
  const totalTokens = Number(args.totalTokens ?? estimate?.totalTokens ?? inputTokens + outputTokens);
  const cachedInputTokens = Number(args.cachedInputTokens ?? estimate?.cachedInputTokens ?? 0);
  const startedAt = args.startedAt || undefined;
  const endedAt = args.endedAt || new Date().toISOString();
  const durationMs = msFromArgs({ ...args, endedAt });
  const lineItems = defaultLineItems({ ...args, inputTokens, outputTokens, totalTokens }, estimate);
  const receiptNo = args.receiptNo || formatReceiptNo(new Date(endedAt));
  const referenceModel = normalizeReferenceModel(args.referenceModel || args.model || getReferenceModel());
  const referenceModelInfo = getReferenceModelInfo(referenceModel);
  const model = referenceModelInfo.displayName;
  const modelSource = args.referenceModel || args.model ? "manual override" : "stored reference model";
  const tokenSpend = estimateTokenSpend({ model: referenceModel, inputTokens, outputTokens, cachedInputTokens });
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    projectPath: paths.projectPath,
    projectId: paths.projectId,
    task: args.task || args.title || "Untitled task",
    category: args.category || estimate?.taskType || "uncategorized",
    model,
    startedAt,
    endedAt,
    durationMs,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    tokenSpend,
    referenceModel,
    modelSource,
    confidence: args.confidence || estimate?.confidence || "estimated",
    status: args.status || "completed",
    notes: args.notes || "",
    receipt: {
      receiptNo,
      storeName: args.storeName || "Codex Token Mart",
      paymentType: args.paymentType || "Estimated",
      model,
      referenceModel,
      modelSource,
      startedAt,
      endedAt,
      durationMs,
      lineItems
    },
    estimate: estimate || undefined
  };
  const staticReceipt = writeStaticReceipt(record, paths);
  record.receiptFile = staticReceipt.receiptFile;
  record.receiptFileUrl = staticReceipt.receiptFileUrl;
  record.receiptUrl = record.receiptFileUrl;
  data.records = Array.isArray(data.records) ? data.records : [];
  data.projectPath = paths.projectPath;
  data.projectId = paths.projectId;
  data.records.push(record);
  writeJson(paths.logFile, data);
  const history = writeStaticHistory(data.records, paths);
  return {
    record,
    receiptUrl: record.receiptUrl,
    receiptFile: record.receiptFile,
    receiptFileUrl: record.receiptFileUrl,
    historyUrl: history.historyFileUrl,
    historyFile: history.historyFile,
    summary: getUsageSummary(args)
  };
}

function setReferenceModel(args = {}) {
  const requested = args.model || args.referenceModel || args.name || args.mode;
  if (String(requested || "").trim().toLowerCase() === "list") {
    return {
      referenceModel: getReferenceModelInfo(),
      models: listReferenceModels(),
      command: "/mission model <model>"
    };
  }
  const model = normalizeReferenceModel(requested || DEFAULT_RATE_MODEL);
  const settings = readJson(SETTINGS_FILE, {});
  settings.referenceModel = model;
  writeJson(SETTINGS_FILE, settings);
  return {
    referenceModel: getReferenceModelInfo(model),
    models: listReferenceModels(),
    command: `/mission model ${TOKEN_RATE_CARD[model].displayName}`,
    message: `Mission Invoice reference model is now ${TOKEN_RATE_CARD[model].displayName}. Future receipts use this model's credits rate card for estimates.`
  };
}

function getLatestReceipt(args = {}) {
  const paths = projectDataPaths(args);
  ensureProjectStore(paths);
  const data = readJson(paths.logFile, { records: [] });
  const records = Array.isArray(data.records) ? data.records : [];
  return records.slice().reverse().find((record) => record.receipt) || null;
}

function getReceiptById(id, args = {}) {
  const paths = projectDataPaths(args);
  ensureProjectStore(paths);
  const data = readJson(paths.logFile, { records: [] });
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

function receiptFilenameFor(record) {
  return safeReceiptFilename(record?.receipt?.receiptNo, record?.id);
}

function receiptHrefFor(record) {
  return receiptFilenameFor(record);
}

function localizeLineLabel(label, lang) {
  const value = String(label || "Token item");
  const zh = {
    "Implement static receipt export": "Static receipt export",
    "Sync marketplace and share packages": "Sync share package",
    "Verify generated HTML receipt": "Verify HTML receipt",
    "Static receipt test": "Static receipt test",
    "Plan and approval": "Plan and approval",
    "Delete archive files": "Delete archive files",
    "Verification and receipt": "Verification and receipt",
    "Read and understand": "Read and understand",
    "Generate and summarize": "Generate and summarize",
    "Total tokens": "Total tokens",
    "Unrecorded item": "Unrecorded item"
  };
  return lang === "zh" ? (zh[value] || value) : value;
}

function receiptPageHtml(record) {
  const receipt = record?.receipt || {};
  const spend = record?.tokenSpend || estimateTokenSpend({
    model: record?.referenceModel,
    inputTokens: record?.inputTokens,
    outputTokens: record?.outputTokens,
    cachedInputTokens: record?.cachedInputTokens
  });
  const modelName = spend.rateModelDisplayName || receipt.model || record?.model || getReferenceModelInfo().displayName;
  const rows = (receipt.lineItems || []).map((item) => `
      <tr>
        <td>${escapeHtml(localizeLineLabel(item.label, "zh"))}</td>
        <td class="num">${escapeHtml(item.quantity || 1)}</td>
        <td class="num">${escapeHtml(Number(item.tokens || 0).toLocaleString("zh-Hant-TW"))}</td>
      </tr>`).join("");
  const dataJson = JSON.stringify({ record, rateCard: getReferenceModelInfo(record?.referenceModel) }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mission Invoice ${escapeHtml(receipt.receiptNo || "")}</title>
  <style>
    :root { color-scheme: light; --ink: #20242b; --muted: #69707a; --line: #c7ccd4; --paper: #fffefa; --bg: #eef1f5; --accent: #2457a6; --green: #1f7a5a; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: start center; background: var(--bg); color: var(--ink); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 28px 16px; }
    .receipt { width: min(430px, 100%); background: var(--paper); border: 1px solid #dad4c8; box-shadow: 0 18px 42px rgba(28, 33, 39, .16); padding: 22px 20px; }
    .center { text-align: center; }
    .title { font-size: 20px; font-weight: 800; letter-spacing: 0; }
    .subtitle { color: var(--muted); font-size: 12px; margin-top: 4px; line-height: 1.5; }
    .cut { border-top: 1px dashed #9ca3af; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; gap: 14px; margin: 8px 0; font-size: 13px; }
    .row span:first-child { color: var(--muted); white-space: nowrap; }
    .row strong { text-align: right; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 7px 0; border-bottom: 1px dotted var(--line); text-align: left; vertical-align: top; }
    th { color: var(--muted); font-weight: 700; }
    .num { text-align: right; }
    .total { font-size: 22px; font-weight: 900; }
    .badge { display: inline-block; border: 1px solid var(--green); color: var(--green); padding: 4px 8px; border-radius: 999px; font-size: 12px; }
    .footer-links { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; }
    .footer-links a { color: var(--accent); font-weight: 800; text-decoration: none; }
  </style>
</head>
<body>
  <article class="receipt">
    <section>
      <div class="center"><div class="title">${escapeHtml(receipt.storeName || "Codex Token Mart")}</div><div class="subtitle">TOKEN &#x96FB;&#x5B50;&#x767C;&#x7968;</div><div class="subtitle">${escapeHtml(receipt.receiptNo || "NO-RECEIPT")}</div></div>
      <div class="cut"></div>
      <div class="row"><span>&#x4EFB;&#x52D9;</span><strong>${escapeHtml(record?.task || "Untitled task")}</strong></div>
      <div class="row"><span>&#x985E;&#x578B;</span><strong>${escapeHtml(record?.category || "-")}</strong></div>
      <div class="row"><span>&#x6A21;&#x578B;</span><strong>${escapeHtml(modelName)}</strong></div>
      <div class="row"><span>&#x6A21;&#x578B;&#x4F86;&#x6E90;</span><strong>${escapeHtml(record?.modelSource || "default reference model")}</strong></div>
      <div class="row"><span>&#x8017;&#x6642;</span><strong>${escapeHtml(formatDuration(record?.durationMs || receipt.durationMs))}</strong></div>
      <div class="row"><span>&#x6642;&#x9593;</span><strong>${escapeHtml(record?.endedAt || record?.createdAt || "-")}</strong></div>
      <div class="cut"></div>
      <table><thead><tr><th>&#x54C1;&#x9805;</th><th class="num">&#x6578;&#x91CF;</th><th class="num">Tokens</th></tr></thead><tbody>${rows || '<tr><td colspan="3">No items</td></tr>'}</tbody></table>
      <div class="cut"></div>
      <div class="row"><span>Input</span><strong>${escapeHtml(Number(record?.inputTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
      <div class="row"><span>Cached input</span><strong>${escapeHtml(Number(record?.cachedInputTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
      <div class="row"><span>Output</span><strong>${escapeHtml(Number(record?.outputTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
      <div class="row"><span>Total</span><strong class="total">${escapeHtml(Number(record?.totalTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
      <div class="row"><span>&#x4ED8;&#x6B3E;</span><span class="badge">${escapeHtml(receipt.paymentType || "Estimated")}</span></div>
      <div class="row"><span>Rate card</span><strong>${escapeHtml(modelName)}</strong></div>
      <div class="center subtitle">Estimated from the Codex rate card. Data is stored locally. The model is a user-selected reference basis.</div>
      <div class="cut"></div>
      <nav class="footer-links"><a href="index.html#history">&#x6B77;&#x53F2;&#x5E33;&#x55AE;</a><a href="index.html#stats">&#x7D71;&#x8A08;&#x8CC7;&#x8A0A;</a></nav>
    </section>
  </article>
  <script type="application/json" id="mission-invoice-data">${dataJson}</script>
</body>
</html>`;
}

function historyPageHtml(records, paths = projectDataPaths({})) {
  const normalized = Array.isArray(records) ? records.map(withTokenSpend) : [];
  const summary = summarize(normalized, paths);
  const rows = normalized.slice().reverse().map((record) => {
    const receipt = record.receipt || {};
    const receiptNo = receipt.receiptNo || record.id || "-";
    return `<tr><td><strong>${escapeHtml(receiptNo)}</strong></td><td class="num">${escapeHtml(Number(record.totalTokens || 0).toLocaleString("zh-Hant-TW"))}</td><td><a class="view-link" href="${escapeHtml(receiptHrefFor(record))}">查看</a></td></tr>`;
  }).join("");
  const stats = summary.models.map((model) => {
    const categoryRows = model.categories.map((category) => `<tr><td>${escapeHtml(category.category)}</td><td class="num">${escapeHtml(Number(category.totalTokens || 0).toLocaleString("zh-Hant-TW"))}</td><td class="num">${escapeHtml(Number(category.records || 0).toLocaleString("zh-Hant-TW"))}</td></tr>`).join("");
    return `<section class="model-block"><div class="model-head"><h3>${escapeHtml(model.model)}</h3><span>${escapeHtml(Number(model.totalTokens || 0).toLocaleString("zh-Hant-TW"))} tokens</span></div><table><thead><tr><th>任務類型</th><th class="num">Token</th><th class="num">筆數</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="3">尚無統計資料</td></tr>'}</tbody></table></section>`;
  }).join("");
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mission Invoice History</title>
  <style>
    :root { color-scheme: light; --ink: #20242b; --muted: #69707a; --line: #d8dee8; --panel: #fbfcfe; --bg: #f4f6f9; --accent: #2457a6; --accent-bg: #eaf1fb; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
    header { padding: 24px 28px 18px; background: var(--panel); border-bottom: 1px solid var(--line); }
    h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
    h2 { margin: 0; font-size: 20px; letter-spacing: 0; }
    h3 { margin: 0; font-size: 15px; letter-spacing: 0; }
    main { padding: 24px 28px 36px; }
    .panel { max-width: 1040px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 20px; }
    .panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .count { color: var(--muted); font-size: 13px; white-space: nowrap; }
    .desc { color: var(--muted); font-size: 14px; margin: 0 0 18px; }
    .desc a { color: var(--accent); font-weight: 800; text-decoration: none; }
    .metric { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 12px 0 14px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
    .metric span, .model-head span { color: var(--muted); font-size: 13px; white-space: nowrap; }
    .metric strong { font-size: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
    th { color: var(--muted); font-weight: 700; }
    .num { text-align: right; }
    .view-link { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; border: 1px solid var(--accent); border-radius: 6px; color: var(--accent); background: var(--accent-bg); font-weight: 800; text-decoration: none; padding: 5px 10px; }
    .model-block { padding: 14px 0; border-top: 1px solid var(--line); }
    .model-block:first-of-type { border-top: 0; padding-top: 0; }
    .model-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    [data-view-panel] { display: none; }
    [data-view-panel].active { display: block; }
    @media (max-width: 720px) { header, main { padding-left: 16px; padding-right: 16px; } table { font-size: 13px; } .panel-head { display: block; } .count { display: block; margin-top: 6px; } }
  </style>
</head>
<body>
  <header><h1>Mission Invoice</h1></header>
  <main>
    <section class="panel" data-view-panel="history"><div class="panel-head"><h2>歷史帳單</h2><span class="count">帳單數量 ${escapeHtml(summary.totals.records.toLocaleString("zh-Hant-TW"))}</span></div><p class="desc">查看每張任務發票的 token 花費，或切換到 <a href="#stats" data-view="stats">統計資訊</a></p><table><thead><tr><th>發票號碼</th><th class="num">Token 花費</th><th>查看</th></tr></thead><tbody>${rows || '<tr><td colspan="3">尚無發票紀錄</td></tr>'}</tbody></table></section>
    <section class="panel" data-view-panel="stats"><div class="panel-head"><h2>統計資訊</h2></div><p class="desc">依模型與任務類型統計 token 使用量。<a href="#history" data-view="history">返回歷史帳單</a></p><div class="metric"><span>總消耗 token</span><strong>${escapeHtml(summary.totals.totalTokens.toLocaleString("zh-Hant-TW"))}</strong></div>${stats || '<p>尚無統計資料</p>'}</section>
  </main>
  <script>
    function setHistoryView(view) {
      var next = view === "stats" ? "stats" : "history";
      document.querySelectorAll("[data-view-panel]").forEach(function(panel) { panel.classList.toggle("active", panel.dataset.viewPanel === next); });
      localStorage.setItem("missionInvoiceHistoryView", next);
    }
    document.querySelectorAll("a[data-view]").forEach(function(link) { link.addEventListener("click", function(event) { event.preventDefault(); setHistoryView(link.dataset.view); location.hash = link.dataset.view; }); });
    setHistoryView(location.hash === "#stats" ? "stats" : (localStorage.getItem("missionInvoiceHistoryView") || "history"));
  </script>
</body>
</html>`;
}
function writeStaticHistory(records, paths = projectDataPaths({})) {
  ensureProjectStore(paths);
  fs.mkdirSync(paths.receiptsDir, { recursive: true });
  const allRecords = Array.isArray(records) ? records.map(withTokenSpend) : [];
  for (const item of allRecords) {
    if (item.receipt) {
      const file = path.join(paths.receiptsDir, receiptFilenameFor(item));
      fs.writeFileSync(file, receiptPageHtml(item), "utf8");
    }
  }
  const historyFile = path.join(paths.receiptsDir, "index.html");
  fs.writeFileSync(historyFile, historyPageHtml(allRecords, paths), "utf8");
  return { historyFile, historyFileUrl: pathToFileURL(historyFile).href };
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
        projectPath: { type: "string", description: "Absolute path to the project root. Defaults to the MCP process working directory." },
        category: { type: "string" },
        model: { type: "string" },
        startedAt: { type: "string" },
        endedAt: { type: "string" },
        durationMs: { type: "number" },
        inputTokens: { type: "number" },
        outputTokens: { type: "number" },
        totalTokens: { type: "number" },
        cachedInputTokens: { type: "number" },
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
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project root. Defaults to the MCP process working directory." }
      }
    }
  },
  {
    name: "get_invoice_mode",
    description: "Return whether automatic Mission Invoice generation is enabled.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_reference_models",
    description: "List available Mission Invoice reference models and the selected credits rate basis.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "set_reference_model",
    description: "Set the Mission Invoice reference model used for credits estimates. Equivalent to /mission model <model>.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "One of GPT-5.5, GPT-5.4, GPT-5.3-Codex, or GPT-5.2. Use list to list models." }
      }
    }
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
  if (name === "get_usage_summary") return getUsageSummary(args);
  if (name === "get_invoice_mode") return getInvoiceMode();
  if (name === "get_reference_models") return { referenceModel: getReferenceModelInfo(), models: listReferenceModels(), command: "/mission model <model>" };
  if (name === "set_reference_model") return setReferenceModel(args);
  if (name === "set_invoice_mode") return setInvoiceMode(args);
  if (name === "get_project_setup_status") return getProjectSetupStatus(args);
  if (name === "setup_project_instructions") return setupProject(args);
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

const cliAliases = {
  estimate: "estimate_plan_cost",
  "record-task": "record_task_usage",
  record: "record_task_usage",
  summary: "get_usage_summary",
  mode: "get_invoice_mode",
  models: "get_reference_models",
  "set-model": "set_reference_model",
  "set-mode": "set_invoice_mode",
  "setup-status": "get_project_setup_status",
  setup: "setup_project_instructions"
};

function parseCliArgs() {
  const command = process.argv[2];
  const rawJson = process.argv[3] || "{}";
  if (!command) return null;
  const toolName = cliAliases[command] || command;
  let args;
  try {
    args = JSON.parse(rawJson);
  } catch (error) {
    throw new Error(`Invalid JSON arguments: ${error.message}`);
  }
  return { toolName, args };
}

async function runCli() {
  const parsed = parseCliArgs();
  if (!parsed) return false;
  const result = await callTool(parsed.toolName, parsed.args);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return true;
}

function runMcpServer() {
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
}

ensureStore();

runCli()
  .then((handled) => {
    if (!handled) runMcpServer();
  })
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
