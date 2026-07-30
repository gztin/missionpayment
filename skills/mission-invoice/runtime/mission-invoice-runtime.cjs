#!/usr/bin/env node
"use strict";

const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync, spawn } = require("child_process");
const { fileURLToPath, pathToFileURL } = require("url");

const MISSION_INVOICE_RUNTIME_VERSION = "0.3.0";
const DATA_DIR = process.env.TOKEN_BILLING_PANEL_DATA_DIR || path.join(os.homedir(), ".codex-token-billing");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const RUNTIME_OVERRIDE_DIR = path.join(DATA_DIR, "runtime");
const RUNTIME_OVERRIDE_FILE = path.join(RUNTIME_OVERRIDE_DIR, "mission-invoice-runtime.cjs");
const DEFAULT_RUNTIME_UPDATE_URL = "https://raw.githubusercontent.com/gztin/missionpayment/main/skills/mission-invoice/runtime/mission-invoice-runtime.cjs";
const SETUP_START = "<!-- mission-invoice:start -->";
const SETUP_END = "<!-- mission-invoice:end -->";
const DEFAULT_RATE_MODEL = "gpt-5.5";
const RATE_CARD_SOURCE = "https://help.openai.com/zh-hant/articles/20001106-codex-rate-card";
const MODEL_ALIASES = {
  "5.5": "gpt-5.5",
  "gpt-5.5": "gpt-5.5",
  "gpt5.5": "gpt-5.5",
  "5.4": "gpt-5.4",
  "gpt-5.4": "gpt-5.4",
  "gpt5.4": "gpt-5.4",
  "5.4-mini": "gpt-5.4-mini",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt5.4-mini": "gpt-5.4-mini",
  "gpt-5.4 mini": "gpt-5.4-mini",
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
  "gpt-5.4-mini": { displayName: "GPT-5.4-Mini", input: 18.75, cachedInput: 1.875, output: 113 },
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
          popupEnabled: false,
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
      if (settings.popupEnabled === undefined) {
        settings.popupEnabled = false;
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
        JSON.stringify({ currency: "tokens", estimateMultiplier: 1, monthlyTokenBudget: 2000000, resetDay: 1, referenceModel: DEFAULT_RATE_MODEL, invoiceEnabled: true, popupEnabled: false }, null, 2)
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

function codexLogsDbPath(args = {}) {
  return path.resolve(String(args.dbPath || path.join(os.homedir(), ".codex", "logs_2.sqlite")));
}

function codexExecutableCandidates(args = {}) {
  return [
    process.env.CODEX_BIN,
    process.env.CODEX_EXECUTABLE,
    process.platform === "darwin" ? "/Applications/ChatGPT.app/Contents/Resources/codex" : null,
    "codex"
  ].filter(Boolean);
}

function sanitizeRateLimitWindow(window) {
  if (!window || typeof window !== "object") return null;
  const usedPercent = Number(window.usedPercent);
  if (!Number.isFinite(usedPercent)) return null;
  const windowDurationMins = Number(window.windowDurationMins);
  const resetsAt = Number(window.resetsAt);
  return {
    usedPercent: Math.min(100, Math.max(0, Math.round(usedPercent))),
    remainingPercent: Math.min(100, Math.max(0, Math.round(100 - usedPercent))),
    windowDurationMins: Number.isFinite(windowDurationMins) ? windowDurationMins : null,
    resetsAt: Number.isFinite(resetsAt) ? resetsAt : null,
    resetsAtIso: Number.isFinite(resetsAt) ? new Date(resetsAt * 1000).toISOString() : null
  };
}

function sanitizeRateLimitResetCredits(value) {
  if (!value || typeof value !== "object") return null;
  const availableCount = Number(value.availableCount ?? value.available_count);
  const credits = Array.isArray(value.credits)
    ? value.credits.map((credit) => ({
        id: credit?.id == null ? null : String(credit.id),
        resetType: credit?.resetType == null
          ? (credit?.reset_type == null ? null : String(credit.reset_type))
          : String(credit.resetType),
        status: credit?.status == null ? null : String(credit.status),
        grantedAt: Number.isFinite(Number(credit?.grantedAt ?? credit?.granted_at))
          ? Number(credit?.grantedAt ?? credit?.granted_at)
          : null,
        expiresAt: Number.isFinite(Number(credit?.expiresAt ?? credit?.expires_at))
          ? Number(credit?.expiresAt ?? credit?.expires_at)
          : null,
        title: credit?.title == null ? null : String(credit.title),
        description: credit?.description == null ? null : String(credit.description)
      }))
    : [];
  return {
    availableCount: Number.isFinite(availableCount)
      ? Math.max(0, Math.round(availableCount))
      : null,
    credits
  };
}

function sanitizeRateLimitsResponse(result, capturedAt = new Date().toISOString()) {
  const buckets = result?.rateLimitsByLimitId && typeof result.rateLimitsByLimitId === "object"
    ? result.rateLimitsByLimitId
    : null;
  const raw = buckets?.codex || result?.rateLimits || Object.values(buckets || {})[0] || null;
  if (!raw) {
    return { status: "unavailable", source: "codex-app-server", capturedAt, errorCode: "MISSION_INVOICE_RATE_LIMITS_EMPTY" };
  }
  const primary = sanitizeRateLimitWindow(raw.primary);
  const secondary = sanitizeRateLimitWindow(raw.secondary);
  const rateLimitResetCredits = sanitizeRateLimitResetCredits(
    result?.rateLimitResetCredits ?? result?.rate_limit_reset_credits
  );
  const windows = [primary, secondary].filter(Boolean);
  const preferredWindow = windows.slice().sort((a, b) => Number(b.windowDurationMins || 0) - Number(a.windowDurationMins || 0))[0] || null;
  return {
    status: preferredWindow ? "available" : "unavailable",
    source: "codex-app-server",
    capturedAt,
    planType: raw.planType || null,
    limitId: raw.limitId || null,
    limitName: raw.limitName || null,
    primary,
    secondary,
    preferredWindow,
    rateLimitResetCredits,
    errorCode: preferredWindow ? null : "MISSION_INVOICE_RATE_LIMIT_WINDOW_MISSING"
  };
}

function readCodexAccountRateLimits(args = {}) {
  const timeoutMs = clampNumber(args.rateLimitsTimeoutMs || 5000, 500, 15000, 5000);
  const candidates = codexExecutableCandidates(args);
  const capturedAt = new Date().toISOString();
  return new Promise((resolve) => {
    let candidateIndex = 0;
    const tryNext = () => {
      if (candidateIndex >= candidates.length) {
        resolve({ status: "unavailable", source: "codex-app-server", capturedAt, errorCode: "MISSION_INVOICE_CODEX_APP_SERVER_NOT_FOUND" });
        return;
      }
      const executable = candidates[candidateIndex++];
      let settled = false;
      let buffer = "";
      let child;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (child && !child.killed) child.kill();
        resolve(value);
      };
      try {
        child = spawn(executable, ["app-server", "--stdio"], {
          stdio: ["pipe", "pipe", "ignore"],
          env: process.env
        });
      } catch {
        tryNext();
        return;
      }
      const timer = setTimeout(() => {
        if (candidateIndex < candidates.length) {
          settled = true;
          if (child && !child.killed) child.kill();
          tryNext();
          return;
        }
        finish({ status: "unavailable", source: "codex-app-server", capturedAt, errorCode: "MISSION_INVOICE_RATE_LIMITS_TIMEOUT" });
      }, timeoutMs);
      child.on("error", () => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        tryNext();
      });
      child.stdout.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let message;
          try {
            message = JSON.parse(line);
          } catch {
            continue;
          }
          if (message.id === "mission-init" && message.result) {
            child.stdin.write(`${JSON.stringify({ id: "mission-rate-limits", method: "account/rateLimits/read" })}\n`);
          }
          if (message.id === "mission-rate-limits") {
            if (message.result) finish(sanitizeRateLimitsResponse(message.result, capturedAt));
            else finish({ status: "unavailable", source: "codex-app-server", capturedAt, errorCode: "MISSION_INVOICE_RATE_LIMITS_REQUEST_FAILED" });
          }
        }
      });
      child.on("exit", () => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        tryNext();
      });
      child.stdin.write(`${JSON.stringify({
        id: "mission-init",
        method: "initialize",
        params: {
          clientInfo: { name: "mission-invoice", title: "Mission Invoice", version: MISSION_INVOICE_RUNTIME_VERSION },
          capabilities: { experimentalApi: true }
        }
      })}\n`);
    };
    tryNext();
  });
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function runSqliteQuery(dbPath, sql) {
  if (!fs.existsSync(dbPath)) {
    const error = new Error(`Codex local log database was not found at ${dbPath}.`);
    error.code = "MISSION_INVOICE_CODEX_LOG_DB_NOT_FOUND";
    throw error;
  }
  try {
    return execFileSync("sqlite3", [dbPath, sql], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
  } catch (error) {
    const wrapped = new Error(`Unable to read Codex local log database: ${error.message}`);
    wrapped.code = "MISSION_INVOICE_CODEX_LOG_READ_FAILED";
    throw wrapped;
  }
}

function parseTokenUsageLogBody(body) {
  const text = String(body || "");
  if (!text.includes("post sampling token usage")) return null;
  const total = text.match(/\btotal_usage_tokens=(\d+)\b/);
  const turnId = text.match(/\bturn(?:\.id|_id)=([0-9a-f-]{20,})\b/i);
  const threadId = text.match(/\bthread(?:\.id|_id)=([0-9a-f-]{20,})\b/i);
  const model = text.match(/\bmodel=([A-Za-z0-9._-]+)\b/);
  if (!total || !turnId || !threadId) return null;
  return {
    threadId: threadId[1],
    turnId: turnId[1],
    model: model ? model[1] : null,
    totalUsageTokens: Number(total[1]),
    needsFollowUp: /\bneeds_follow_up=true\b/.test(text),
    tokenLimitReached: /\btoken_limit_reached=true\b/.test(text)
  };
}

function readCodexTokenUsageSnapshots(args = {}) {
  const dbPath = codexLogsDbPath(args);
  const limit = clampNumber(args.scanLimit || args.limit || 2000, 1, 20000, 2000);
  const separator = "|||MISSION_INVOICE_SEPARATOR|||";
  const sql = `
select id || '${separator}' || ts || '${separator}' || ts_nanos || '${separator}' || replace(replace(feedback_log_body, char(10), ' '), '${separator}', ' ')
from logs
where feedback_log_body like '%post sampling token usage%'
order by ts asc, ts_nanos asc, id asc
limit ${limit};
`;
  const stdout = runSqliteQuery(dbPath, sql);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, ts, tsNanos, ...bodyParts] = line.split(separator);
      const parsed = parseTokenUsageLogBody(bodyParts.join(separator));
      if (!parsed) return null;
      return {
        id: Number(id),
        ts: Number(ts),
        tsNanos: Number(tsNanos),
        observedAt: new Date(Number(ts || 0) * 1000).toISOString(),
        ...parsed
      };
    })
    .filter(Boolean)
    .filter((event) => !args.threadId || event.threadId === args.threadId)
    .filter((event) => !args.turnId || event.turnId === args.turnId);
}

function collapseCodexTurnUsages(snapshots) {
  const byTurn = new Map();
  for (const snapshot of snapshots) {
    const key = `${snapshot.threadId}:${snapshot.turnId}`;
    const existing = byTurn.get(key);
    if (!existing || snapshot.id > existing.id) {
      byTurn.set(key, { ...snapshot, snapshotCount: (existing?.snapshotCount || 0) + 1 });
    } else {
      existing.snapshotCount = (existing.snapshotCount || 1) + 1;
    }
  }

  const turns = Array.from(byTurn.values()).sort((a, b) => a.ts - b.ts || a.tsNanos - b.tsNanos || a.id - b.id);
  const previousByThread = new Map();
  return turns.map((turn) => {
    const previous = previousByThread.get(turn.threadId) || null;
    const observedDeltaTokens = previous
      ? Math.max(0, Number(turn.totalUsageTokens || 0) - Number(previous.totalUsageTokens || 0))
      : Number(turn.totalUsageTokens || 0);
    previousByThread.set(turn.threadId, turn);
    return {
      source: "codex-local-logs",
      threadId: turn.threadId,
      turnId: turn.turnId,
      model: turn.model,
      observedAt: turn.observedAt,
      sourceLogId: turn.id,
      snapshotCount: turn.snapshotCount || 1,
      totalUsageTokens: turn.totalUsageTokens,
      previousTurnId: previous?.turnId || null,
      previousTotalUsageTokens: previous?.totalUsageTokens || 0,
      observedDeltaTokens,
      needsFollowUp: turn.needsFollowUp,
      tokenLimitReached: turn.tokenLimitReached
    };
  });
}

function inspectCodexEvents(args = {}) {
  const dbPath = codexLogsDbPath(args);
  const snapshots = readCodexTokenUsageSnapshots(args);
  const allEvents = collapseCodexTurnUsages(snapshots);
  const count = clampNumber(args.count || 12, 1, 100, 12);
  return {
    source: "codex-local-logs",
    dbPath,
    found: allEvents.length,
    events: allEvents.slice(-count).reverse(),
    limitations: [
      "Codex local logs expose a turn-level total_usage_tokens snapshot, not an official billing record.",
      "Mission Invoice computes each turn by subtracting the previous total_usage_tokens in the same thread.",
      "Input/output split is estimated during import unless Codex exposes a stable split in local logs."
    ]
  };
}

function hasImportedCodexEvent(records, event) {
  return records.some((record) => {
    const local = record?.localCodexEvent || {};
    return local.source === "codex-local-logs" && local.turnId === event.turnId && local.threadId === event.threadId;
  });
}

async function importCodexEvents(args = {}) {
  const paths = projectDataPaths(args);
  ensureProjectStore(paths);
  const data = readJson(paths.logFile, { projectPath: paths.projectPath, projectId: paths.projectId, records: [] });
  const records = Array.isArray(data.records) ? data.records : [];
  const inspected = inspectCodexEvents(args);
  const selected = inspected.events
    .find((event) => (
      event.observedDeltaTokens > 0
      && (!args.turnId || event.turnId === args.turnId)
      && (args.includeActive === true || event.needsFollowUp !== true)
    ));

  if (!selected) {
    return {
      skipped: true,
      errorCode: "MISSION_INVOICE_NO_CODEX_TOKEN_EVENT",
      message: "No importable completed Codex token event with a positive observed delta was found. Use includeActive=true only if you intentionally want to import an in-progress turn snapshot.",
      inspected
    };
  }

  if (args.force !== true && hasImportedCodexEvent(records, selected)) {
    return {
      skipped: true,
      errorCode: "MISSION_INVOICE_EVENT_ALREADY_IMPORTED",
      message: "This Codex token event has already been imported for this project. Use force=true to record it again intentionally.",
      event: selected
    };
  }

  const totalTokens = Number(selected.observedDeltaTokens || 0);
  const inputRatio = clampNumber(args.inputRatio ?? 0.75, 0.05, 0.95, 0.75);
  const inputTokens = Math.round(totalTokens * inputRatio);
  const outputTokens = Math.max(0, totalTokens - inputTokens);
  const model = selected.model || args.model || getReferenceModel();
  const result = await recordTaskUsage({
    ...args,
    task: args.task || `Codex local event ${selected.turnId.slice(0, 8)}`,
    category: args.category || "analysis",
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens: 0,
    confidence: "observed-total-estimated-split",
    paymentType: "Estimated",
    lineItems: [
      { label: "Observed total token delta", quantity: 1, tokens: totalTokens }
    ],
    notes: args.notes || `Observed total token delta from Codex local logs. Input/output split estimated with inputRatio=${inputRatio}. thread.id=${selected.threadId} turn.id=${selected.turnId} sourceLogId=${selected.sourceLogId} previousTotal=${selected.previousTotalUsageTokens} currentTotal=${selected.totalUsageTokens}.`,
    localCodexEvent: {
      ...selected,
      dbPath: inspected.dbPath,
      inputRatio,
      splitEstimated: true
    }
  });

  return {
    ...result,
    imported: true,
    event: selected,
    split: {
      inputRatio,
      inputTokens,
      outputTokens,
      totalTokens,
      splitEstimated: true
    }
  };
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

function formatActualModelName(model) {
  const value = String(model || "").trim();
  if (!value) return "未取得";
  const parts = value.split("-");
  const prefix = /^gpt$/i.test(parts[0]) && /^\d+(?:\.\d+)*$/.test(parts[1] || "")
    ? `GPT-${parts.splice(1, 1)[0]}`
    : null;
  if (prefix) parts.shift();
  const suffix = parts
    .map((part) => {
      if (/^\d+(?:\.\d+)*$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
  return [prefix, suffix].filter(Boolean).join(" ");
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
  const actualModel = record.actualModel || record?.localCodexEvent?.model;
  return actualModel ? formatActualModelName(actualModel) : "未取得";
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
    popupEnabled: settings.popupEnabled === true,
    commandOn: "/mission on",
    commandOff: "/mission off",
    commandPopupOn: "/mission popup on",
    commandPopupOff: "/mission popup off",
    commandSetup: "/mission setup",
    commandModel: "/mission model GPT-5.5",
    referenceModel: getReferenceModelInfo(),
    legacyOnAliases: ["/Token Billing Invoice"],
    legacyOffAliases: ["/Token Billing texfree", "/Token Billing taxfree"]
  };
}

function getPopupMode() {
  const settings = readJson(SETTINGS_FILE, {});
  return {
    popupEnabled: settings.popupEnabled === true,
    commandOn: "/mission popup on",
    commandOff: "/mission popup off",
    urlScheme: "missioninvoice://receipt",
    message: settings.popupEnabled === true
      ? "Mission Invoice floating receipt is ON."
      : "Mission Invoice floating receipt is OFF."
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

function setPopupMode(args = {}) {
  const settings = readJson(SETTINGS_FILE, {});
  const rawMode = String(args.mode || "").trim().toLowerCase();
  const normalizedMode = rawMode.replace(/^\/+/, "").replace(/\s+/g, " ");
  let enabled;
  if (typeof args.enabled === "boolean") {
    enabled = args.enabled;
  } else if (["mission popup on", "popup on", "on", "enabled", "enable", "true"].includes(normalizedMode)) {
    enabled = true;
  } else if (["mission popup off", "popup off", "off", "disabled", "disable", "false"].includes(normalizedMode)) {
    enabled = false;
  } else {
    throw new Error("Popup mode must be on or off.");
  }
  settings.popupEnabled = enabled;
  writeJson(SETTINGS_FILE, settings);
  return {
    popupEnabled: enabled,
    command: enabled ? "/mission popup off" : "/mission popup on",
    message: enabled
      ? "Mission Invoice floating receipt is ON. Install the companion app to show receipts after each task."
      : "Mission Invoice floating receipt is OFF. HTML receipts continue to be generated."
  };
}

function popupReceiptPayload(record = {}) {
  const paths = projectDataPaths({
    projectPath: record.projectPath,
    projectId: record.projectId
  });
  return {
    version: 1,
    receiptNo: String(record?.receipt?.receiptNo || ""),
    task: String(record.task || ""),
    category: String(record.category || "uncategorized"),
    model: displayModelForRecord(record),
    endedAt: String(record.endedAt || record.createdAt || new Date().toISOString()),
    durationMs: Number(record.durationMs || 0),
    inputTokens: Number(record.inputTokens || 0),
    outputTokens: Number(record.outputTokens || 0),
    totalTokens: Number(record.totalTokens || 0),
    projectId: String(record.projectId || paths.projectId || ""),
    projectLogFile: paths.logFile,
    receiptFileUrl: String(record.receiptFileUrl || record.receiptUrl || ""),
    accountUsageSnapshot: record.accountUsageSnapshot || record?.receipt?.accountUsageSnapshot || null,
    lineItems: (Array.isArray(record?.receipt?.lineItems) ? record.receipt.lineItems : [])
      .map((item) => ({
        label: String(item?.label || item?.name || "Token item"),
        tokens: Number(item?.tokens || 0)
      }))
  };
}

function notifyPopupApp(record = {}) {
  if (process.platform !== "darwin") {
    return { attempted: false, reason: "unsupported-platform" };
  }
  if (getPopupMode().popupEnabled !== true) {
    return { attempted: false, reason: "disabled" };
  }
  try {
    const payload = Buffer.from(JSON.stringify(popupReceiptPayload(record)), "utf8").toString("base64url");
    const url = `missioninvoice://receipt?payload=${encodeURIComponent(payload)}`;
    const child = spawn("/usr/bin/open", ["-g", url], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return { attempted: true, delivered: true };
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: String(error?.message || error)
    };
  }
}

function hasReceiptIdentity(args = {}, estimate = null) {
  const task = String(args.task || args.title || "").trim();
  const notes = String(args.notes || estimate?.notes || "").trim();
  return Boolean(task || notes);
}

function sumPositiveNumbers(values) {
  return values.reduce((sum, value) => {
    const numeric = Number(value || 0);
    return numeric > 0 ? sum + numeric : sum;
  }, 0);
}

function hasPositiveTokenEvidence(args = {}, estimate = null, tokens = {}) {
  const lineItemTokens = Array.isArray(args.lineItems)
    ? sumPositiveNumbers(args.lineItems.map((item) => item?.tokens))
    : 0;
  const estimateTokens = estimate
    ? sumPositiveNumbers([
      estimate.totalTokens,
      estimate.inputTokens,
      estimate.outputTokens,
      estimate.cachedInputTokens
    ])
    : 0;
  const providedTokens = sumPositiveNumbers([
    tokens.totalTokens,
    tokens.inputTokens,
    tokens.outputTokens,
    tokens.cachedInputTokens
  ]);
  return lineItemTokens + estimateTokens + providedTokens > 0;
}

async function recordTaskUsage(args = {}) {
  const mode = getInvoiceMode();
  if (mode.invoiceEnabled === false && args.force !== true) {
    return {
      skipped: true,
      invoiceEnabled: false,
      receiptUrl: null,
      message: "Mission Invoice is OFF; receipt generation was skipped."
    };
  }
  const estimate = args.estimate && typeof args.estimate === "object" ? args.estimate : null;
  const inputTokens = Number(args.inputTokens ?? estimate?.inputTokens ?? 0);
  const outputTokens = Number(args.outputTokens ?? estimate?.outputTokens ?? 0);
  const totalTokens = Number(args.totalTokens ?? estimate?.totalTokens ?? inputTokens + outputTokens);
  const cachedInputTokens = Number(args.cachedInputTokens ?? estimate?.cachedInputTokens ?? 0);
  if (args.forceEmpty !== true) {
    const hasIdentity = hasReceiptIdentity(args, estimate);
    const hasTokenEvidence = hasPositiveTokenEvidence(args, estimate, { inputTokens, outputTokens, totalTokens, cachedInputTokens });
    if (!hasIdentity && !hasTokenEvidence) {
      return {
        skipped: true,
        invoiceEnabled: mode.invoiceEnabled !== false,
        receiptUrl: null,
        errorCode: "MISSION_INVOICE_EMPTY_RECORD",
        message: "Mission Invoice skipped an empty receipt request. Provide task/title plus positive token estimates, estimate, or lineItems; use forceEmpty=true only for an intentional 0-token test receipt."
      };
    }
    if (!hasTokenEvidence) {
      return {
        skipped: true,
        invoiceEnabled: mode.invoiceEnabled !== false,
        receiptUrl: null,
        errorCode: "MISSION_INVOICE_MISSING_TOKENS",
        message: "Mission Invoice found task context but no positive token usage. Estimate inputTokens/outputTokens/totalTokens or provide positive lineItems before recording; use forceEmpty=true only for an intentional 0-token test receipt."
      };
    }
  }
  const paths = projectDataPaths(args);
  ensureProjectStore(paths);
  const data = readJson(paths.logFile, { projectPath: paths.projectPath, projectId: paths.projectId, records: [] });
  const startedAt = args.startedAt || undefined;
  const endedAt = args.endedAt || new Date().toISOString();
  const durationMs = msFromArgs({ ...args, endedAt });
  const lineItems = defaultLineItems({ ...args, inputTokens, outputTokens, totalTokens }, estimate);
  const receiptNo = args.receiptNo || formatReceiptNo(new Date(endedAt));
  const actualModel = String(args.actualModel || args.model || args?.localCodexEvent?.model || "").trim() || null;
  const model = formatActualModelName(actualModel);
  const modelSource = args.actualModel || args.model
    ? "task record"
    : args?.localCodexEvent?.model
      ? "codex local event"
      : "unavailable";
  const referenceModel = normalizeReferenceModel(args.referenceModel || getReferenceModel());
  const tokenSpend = estimateTokenSpend({ model: referenceModel, inputTokens, outputTokens, cachedInputTokens });
  const accountUsageSnapshot = args.accountUsageSnapshot && typeof args.accountUsageSnapshot === "object"
    ? args.accountUsageSnapshot
    : args.captureRateLimits === false
      ? { status: "skipped", source: "codex-app-server", capturedAt: new Date().toISOString(), errorCode: null }
      : await readCodexAccountRateLimits(args);
  const record = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    projectPath: paths.projectPath,
    projectId: paths.projectId,
    task: args.task || args.title || "Untitled task",
    category: args.category || args.taskType || estimate?.taskType || "uncategorized",
    model,
    actualModel,
    startedAt,
    endedAt,
    durationMs,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    tokenSpend,
    accountUsageSnapshot,
    referenceModel,
    modelSource,
    confidence: args.confidence || estimate?.confidence || "estimated",
    status: args.status || "completed",
    notes: args.notes || "",
    localCodexEvent: args.localCodexEvent || undefined,
    receipt: {
      receiptNo,
      storeName: args.storeName || "Codex Token Mart",
      paymentType: args.paymentType || "Estimated",
      model,
      actualModel,
      referenceModel,
      modelSource,
      startedAt,
      endedAt,
      durationMs,
      lineItems,
      accountUsageSnapshot
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
  const popup = notifyPopupApp(record);
  return {
    record,
    receiptUrl: record.receiptUrl,
    receiptFile: record.receiptFile,
    receiptFileUrl: record.receiptFileUrl,
    historyUrl: history.historyFileUrl,
    historyFile: history.historyFile,
    popup,
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

function getRuntimeStatus() {
  const overrideExists = fs.existsSync(RUNTIME_OVERRIDE_FILE);
  const activeRuntimeFile = __filename;
  return {
    runtimeVersion: MISSION_INVOICE_RUNTIME_VERSION,
    activeRuntimeFile,
    overrideFile: RUNTIME_OVERRIDE_FILE,
    overrideExists,
    updateUrl: DEFAULT_RUNTIME_UPDATE_URL,
    commandUpdate: "/mission update",
    restartGuidance: "Routine Mission Invoice runtime fixes can be loaded without reinstalling the plugin. Restart Codex or start a new thread only when plugin metadata, skills, or MCP server configuration changes."
  };
}

function downloadText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        downloadText(new URL(response.headers.location, url).href).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Runtime download failed with HTTP ${response.statusCode}.`));
        return;
      }
      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(body));
    });
    request.setTimeout(15000, () => {
      request.destroy(new Error("Runtime download timed out."));
    });
    request.on("error", reject);
  });
}

async function readRuntimeSource(source) {
  const value = String(source || DEFAULT_RUNTIME_UPDATE_URL);
  if (value.startsWith("file://")) {
    return fs.readFileSync(fileURLToPath(value), "utf8");
  }
  if (/^https?:\/\//i.test(value)) {
    return downloadText(value);
  }
  return fs.readFileSync(path.resolve(value), "utf8");
}

function validateRuntimeSource(source) {
  const text = String(source || "");
  if (!text.includes("MISSION_INVOICE_RUNTIME_VERSION")) {
    throw new Error("Downloaded runtime does not declare MISSION_INVOICE_RUNTIME_VERSION.");
  }
  if (!text.includes("module.exports")) {
    throw new Error("Downloaded runtime does not export the expected module API.");
  }
  return text;
}

async function updateRuntime(args = {}) {
  const url = args.url || DEFAULT_RUNTIME_UPDATE_URL;
  const source = validateRuntimeSource(await readRuntimeSource(url));
  const sha256 = crypto.createHash("sha256").update(source).digest("hex");
  if (args.sha256 && String(args.sha256).toLowerCase() !== sha256) {
    throw new Error(`Downloaded runtime checksum mismatch. Expected ${args.sha256}, got ${sha256}.`);
  }

  fs.mkdirSync(RUNTIME_OVERRIDE_DIR, { recursive: true });
  let backupFile = null;
  if (fs.existsSync(RUNTIME_OVERRIDE_FILE)) {
    backupFile = `${RUNTIME_OVERRIDE_FILE}.bak-${new Date().toISOString().replace(/[^0-9A-Za-z]+/g, "-")}`;
    fs.copyFileSync(RUNTIME_OVERRIDE_FILE, backupFile);
  }
  fs.writeFileSync(RUNTIME_OVERRIDE_FILE, source, "utf8");
  return {
    updated: true,
    runtimeVersion: MISSION_INVOICE_RUNTIME_VERSION,
    overrideFile: RUNTIME_OVERRIDE_FILE,
    backupFile,
    sha256,
    sourceUrl: url,
    message: "Mission Invoice runtime was updated. The fixed MCP shell reloads the runtime on each tool call, so routine receipt logic fixes can take effect without reinstalling the plugin."
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
    "Implement static receipt export": "實作靜態發票匯出",
    "Sync marketplace and share packages": "同步市集與分享套件",
    "Verify generated HTML receipt": "驗證產生的 HTML 發票",
    "Static receipt test": "靜態發票測試",
    "Plan and approval": "規劃與確認",
    "Delete archive files": "刪除封存檔案",
    "Verification and receipt": "驗證與開立發票",
    "Read and understand": "讀取與理解",
    "Generate and summarize": "生成與摘要",
    "Total tokens": "Token 總計",
    "Unrecorded item": "未記錄項目"
  };
  return lang === "zh" ? (zh[value] || value) : value;
}

function receiptPageHtml(record) {
  const receipt = record?.receipt || {};
  const modelName = displayModelForRecord(record);
  const rows = (receipt.lineItems || []).map((item) => `
      <tr>
        <td>${escapeHtml(localizeLineLabel(item.label, "zh"))}</td>
        <td class="num">${escapeHtml(Number(item.tokens || 0).toLocaleString("zh-Hant-TW"))}</td>
      </tr>`).join("");
  const dataJson = JSON.stringify({
    record: {
      id: record?.id,
      task: record?.task,
      category: record?.category,
      actualModel: record?.actualModel || record?.localCodexEvent?.model || null,
      model: modelName,
      startedAt: record?.startedAt,
      endedAt: record?.endedAt,
      durationMs: record?.durationMs,
      inputTokens: record?.inputTokens,
      cachedInputTokens: record?.cachedInputTokens,
      outputTokens: record?.outputTokens,
      totalTokens: record?.totalTokens,
      confidence: record?.confidence,
      status: record?.status
    }
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mission Invoice ${escapeHtml(receipt.receiptNo || "")}</title>
  <style>
    :root { color-scheme: light; --ink: #20242b; --muted: #69707a; --line: #c7ccd4; --paper: #fffefa; --bg: #eef1f5; --accent: #2457a6; }
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
      <div class="row"><span>&#x4F7F;&#x7528;&#x6A21;&#x578B;</span><strong>${escapeHtml(modelName)}</strong></div>
      <div class="row"><span>&#x8017;&#x6642;</span><strong>${escapeHtml(formatDuration(record?.durationMs || receipt.durationMs))}</strong></div>
      <div class="row"><span>&#x6642;&#x9593;</span><strong>${escapeHtml(record?.endedAt || record?.createdAt || "-")}</strong></div>
      <div class="cut"></div>
      <table><thead><tr><th>&#x54C1;&#x9805;</th><th class="num">Tokens</th></tr></thead><tbody>${rows || '<tr><td colspan="2">尚無品項</td></tr>'}</tbody></table>
      <div class="cut"></div>
      <div class="row"><span>輸入</span><strong>${escapeHtml(Number(record?.inputTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
      <div class="row"><span>快取輸入</span><strong>${escapeHtml(Number(record?.cachedInputTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
      <div class="row"><span>輸出</span><strong>${escapeHtml(Number(record?.outputTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
      <div class="row"><span>總計</span><strong class="total">${escapeHtml(Number(record?.totalTokens || 0).toLocaleString("zh-Hant-TW"))}</strong></div>
      <div class="center subtitle">Token &#x7528;&#x91CF;&#x8A18;&#x9304;&#x5132;&#x5B58;&#x65BC;&#x672C;&#x6A5F;&#x3002;</div>
      <div class="cut"></div>
      <nav class="footer-links"><a href="index.html#stats">&#x7D71;&#x8A08;&#x8CC7;&#x8A0A;</a></nav>
    </section>
  </article>
  <script type="application/json" id="mission-invoice-data">${dataJson}</script>
</body>
</html>`;
}

function rateLimitWindowLabel(window) {
  const duration = Number(window?.windowDurationMins || 0);
  if (duration >= 6 * 24 * 60) return "每週用量";
  if (duration > 0 && duration % 60 === 0) return `${duration / 60} 小時用量`;
  return "短期用量";
}

function rateLimitWindows(snapshot) {
  if (!snapshot || snapshot.status !== "available") return [];
  return [snapshot.primary, snapshot.secondary]
    .filter((window) => window && Number.isFinite(Number(window.usedPercent)))
    .sort((a, b) => Number(a.windowDurationMins || 0) - Number(b.windowDurationMins || 0));
}

function formatRateLimitReset(window) {
  const value = window?.resetsAtIso || (Number.isFinite(Number(window?.resetsAt))
    ? new Date(Number(window.resetsAt) * 1000).toISOString()
    : null);
  if (!value) return "未提供";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未提供";
  return date.toLocaleString("zh-Hant-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function latestAvailableUsageSnapshot(records) {
  return [...records]
    .sort((a, b) => new Date(b.endedAt || b.createdAt || 0) - new Date(a.endedAt || a.createdAt || 0))
    .map((record) => record.accountUsageSnapshot || record?.receipt?.accountUsageSnapshot || null)
    .find((snapshot) => rateLimitWindows(snapshot).length > 0) || null;
}

function historyPageHtml(records, paths = projectDataPaths({})) {
  const normalized = Array.isArray(records) ? records.map(withTokenSpend) : [];
  const summary = summarize(normalized, paths);
  const latestSnapshot = latestAvailableUsageSnapshot(normalized);
  const latestWindows = rateLimitWindows(latestSnapshot);
  const historyData = normalized.map((record) => ({
    id: record.id,
    receiptNo: record?.receipt?.receiptNo || record.id || "-",
    href: receiptHrefFor(record),
    task: record.task || "Untitled task",
    category: record.category || "uncategorized",
    model: displayModelForRecord(record),
    endedAt: record.endedAt || record.createdAt || null,
    accountUsageSnapshot: record.accountUsageSnapshot || record?.receipt?.accountUsageSnapshot || null
  }));
  const historyJson = JSON.stringify(historyData).replace(/</g, "\\u003c");
  const categoriesByCount = [...summary.categories].sort((a, b) => (
    Number(b.records || 0) - Number(a.records || 0)
    || String(a.category || "").localeCompare(String(b.category || ""), "zh-Hant-TW")
  ));
  const categoryRows = categoriesByCount.map((category) => `<tr><td>${escapeHtml(category.category)}</td><td class="num"><a class="category-count-link" href="#category=${escapeHtml(encodeURIComponent(category.category))}">${escapeHtml(Number(category.records || 0).toLocaleString("zh-Hant-TW"))}</a></td></tr>`).join("");
  const usageCards = latestWindows.map((window) => `
      <article class="usage-card">
        <div class="usage-card-head"><span>${escapeHtml(rateLimitWindowLabel(window))}</span><strong>${escapeHtml(Number(window.remainingPercent ?? 100 - Number(window.usedPercent || 0)).toLocaleString("zh-Hant-TW"))}%</strong></div>
        <div class="usage-bar" aria-label="已使用 ${escapeHtml(Number(window.usedPercent || 0))}%"><span style="width:${escapeHtml(Number(window.usedPercent || 0))}%"></span></div>
        <div class="usage-meta"><span>已使用 ${escapeHtml(Number(window.usedPercent || 0).toLocaleString("zh-Hant-TW"))}%</span><span>重置 ${escapeHtml(formatRateLimitReset(window))}</span></div>
      </article>`).join("");
  const usageSection = usageCards || '<div class="empty">目前無法取得 Codex 官方用量</div>';
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mission Invoice History</title>
  <style>
    :root { color-scheme: light; --ink: #20242b; --muted: #69707a; --line: #d8dee8; --panel: #fff; --bg: #f3f5f8; --accent: #2563eb; --accent-bg: #eaf1ff; --success: #087f5b; --success-bg: #e8f7f1; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
    header { padding: 24px 28px 18px; background: rgba(255,255,255,.92); border-bottom: 1px solid var(--line); backdrop-filter: blur(14px); }
    h1 { margin: 0; font-size: 24px; letter-spacing: -.02em; }
    h2 { margin: 0; font-size: 20px; letter-spacing: 0; }
    h3 { margin: 0; font-size: 15px; letter-spacing: 0; }
    main { padding: 24px 28px 36px; }
    .panel { width: 100%; max-width: 640px; margin: 0 auto; background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 22px; box-shadow: 0 16px 42px rgba(31,41,55,.08); }
    .panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .count { color: var(--muted); font-size: 13px; white-space: nowrap; }
    .category-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
    .category-head .count { display: block; margin-top: 5px; }
    .category-count-link, .back-link { color: var(--accent); font-weight: 800; text-decoration: none; }
    .category-count-link:hover, .back-link:hover { text-decoration: underline; }
    .back-link { flex: 0 0 auto; font-size: 13px; }
    .usage-grid { display: grid; gap: 12px; margin: 18px 0 24px; }
    .usage-card { border: 1px solid var(--line); border-radius: 13px; padding: 15px 16px; background: #fbfcff; }
    .usage-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .usage-card-head span { color: var(--muted); font-size: 13px; font-weight: 700; }
    .usage-card-head strong { color: var(--success); font-size: 26px; letter-spacing: -.03em; }
    .usage-bar { height: 8px; margin: 12px 0 9px; overflow: hidden; border-radius: 999px; background: #e5e9f0; }
    .usage-bar span { display: block; height: 100%; border-radius: inherit; background: var(--accent); }
    .usage-meta { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 12px; }
    .section-title { margin: 0 0 8px; color: var(--muted); font-size: 13px; font-weight: 800; }
    .receipt-list { display: grid; gap: 10px; }
    .receipt-card { display: flex; width: 100%; min-width: 0; align-items: center; gap: 14px; border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: #fbfcff; color: var(--ink); text-decoration: none; transition: border-color .16s ease, background .16s ease, box-shadow .16s ease, transform .16s ease; }
    .receipt-card:hover { border-color: var(--accent); background: var(--accent-bg); box-shadow: 0 8px 18px rgba(37,99,235,.12); transform: translateY(-1px); }
    .receipt-index { flex: 0 0 34px; color: var(--muted); font-size: 16px; font-weight: 800; line-height: 1; text-align: center; }
    .receipt-info { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; }
    .receipt-title { color: var(--ink); font-size: 14px; font-weight: 800; line-height: 1.4; overflow-wrap: anywhere; }
    .receipt-meta { color: var(--muted); font-size: 12px; font-weight: 700; line-height: 1.45; }
    .empty { color: var(--muted); text-align: center; border: 1px dashed var(--line); border-radius: 13px; padding: 28px 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
    th { color: var(--muted); font-weight: 700; }
    .num { text-align: right; }
    [data-view-panel] { display: none; }
    [data-view-panel].active { display: block; }
    @media (max-width: 720px) {
      header, main { padding-left: 14px; padding-right: 14px; }
      .panel { padding: 16px; border-radius: 14px; }
      table { font-size: 13px; }
      .panel-head { display: block; }
      .count { display: block; margin-top: 6px; }
      .usage-meta { display: grid; gap: 4px; }
    }
  </style>
</head>
<body>
  <header><h1>Mission Invoice</h1></header>
  <main>
    <section class="panel" data-view-panel="stats"><div class="panel-head"><h2>Codex 官方用量</h2><span class="count">${latestSnapshot?.capturedAt ? `更新 ${escapeHtml(new Date(latestSnapshot.capturedAt).toLocaleString("zh-Hant-TW"))}` : "尚無成功快照"}</span></div><div class="usage-grid">${usageSection}</div><h3 class="section-title">發票任務類型</h3><table><thead><tr><th>任務類型</th><th class="num">筆數</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="2">尚無發票資料</td></tr>'}</tbody></table></section>
    <section class="panel" data-view-panel="category">
      <div class="category-head"><div><h2 id="category-title"></h2><span class="count" id="category-count"></span></div><a class="back-link" href="#stats">返回統計資訊</a></div>
      <div class="receipt-list" id="category-grid"></div>
    </section>
  </main>
  <script type="application/json" id="mission-invoice-history-data">${historyJson}</script>
  <script>
    var records = JSON.parse(document.getElementById("mission-invoice-history-data").textContent || "[]");
    function renderCategory(category) {
      var categoryRecords = records.filter(function(record) {
        return record.category === category;
      }).sort(function(a, b) {
        return new Date(b.endedAt || 0) - new Date(a.endedAt || 0);
      });
      document.getElementById("category-title").textContent = category + " 發票";
      document.getElementById("category-count").textContent = categoryRecords.length.toLocaleString("zh-Hant-TW") + " 筆";
      var grid = document.getElementById("category-grid");
      if (!categoryRecords.length) {
        grid.innerHTML = '<div class="empty">這個任務類型沒有發票紀錄</div>';
        return;
      }
      grid.innerHTML = categoryRecords.map(function(record, index) {
        return '<a class="receipt-card" href="' + escapeAttribute(record.href) + '" aria-label="查看項次 ' + (index + 1) + ' 的發票"><span class="receipt-index">' + (index + 1) + '</span><span class="receipt-info"><strong class="receipt-title">' + escapeText(record.task || "未命名任務") + '</strong><span class="receipt-meta">' + escapeText(recordUsageText(record)) + '</span></span></a>';
      }).join("");
    }
    function recordUsageText(record) {
      var snapshot = record.accountUsageSnapshot;
      if (!snapshot || snapshot.status !== "available") return "官方用量無法取得";
      var windows = [snapshot.primary, snapshot.secondary].filter(function(window) {
        return window && Number.isFinite(Number(window.usedPercent));
      }).sort(function(a, b) {
        return Number(a.windowDurationMins || 0) - Number(b.windowDurationMins || 0);
      });
      if (!windows.length) return "官方用量無法取得";
      return windows.map(function(window) {
        var duration = Number(window.windowDurationMins || 0);
        var label = duration >= 6 * 24 * 60 ? "每週" : (duration > 0 && duration % 60 === 0 ? (duration / 60) + " 小時" : "短期");
        return label + "已使用 " + Number(window.usedPercent || 0).toLocaleString("zh-Hant-TW") + "%";
      }).join(" · ");
    }
    function escapeText(value) {
      var node = document.createElement("div");
      node.textContent = String(value == null ? "" : value);
      return node.innerHTML;
    }
    function escapeAttribute(value) {
      return escapeText(value).replace(/"/g, "&quot;");
    }
    function categoryFromHash() {
      if (location.hash.indexOf("#category=") !== 0) return "";
      try {
        return decodeURIComponent(location.hash.slice("#category=".length));
      } catch (error) {
        return "";
      }
    }
    function setViewFromHash() {
      var category = categoryFromHash();
      var hasCategory = category && records.some(function(record) { return record.category === category; });
      var next = hasCategory ? "category" : "stats";
      document.querySelectorAll("[data-view-panel]").forEach(function(panel) { panel.classList.toggle("active", panel.dataset.viewPanel === next); });
      if (hasCategory) renderCategory(category);
    }
    window.addEventListener("hashchange", setViewFromHash);
    setViewFromHash();
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
        model: { type: "string", description: "Actual Codex model used for the task, such as gpt-5.6-sol." },
        actualModel: { type: "string", description: "Explicit actual model identifier. Takes precedence over model." },
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
        captureRateLimits: { type: "boolean", description: "Set false to skip the official Codex usage snapshot for an intentional test." },
        rateLimitsTimeoutMs: { type: "number", description: "Codex app-server rate-limit query timeout in milliseconds. Defaults to 5000." },
        force: { type: "boolean", description: "Record a receipt even when invoice mode is disabled." },
        forceEmpty: { type: "boolean", description: "Allow an intentional 0-token test receipt. Do not use for normal task records." }
      }
    }
  },
  {
    name: "get_account_rate_limits",
    description: "Read the current official Codex rate-limit percentage and reset window from the signed-in local Codex app-server.",
    inputSchema: {
      type: "object",
      properties: {
        rateLimitsTimeoutMs: { type: "number", description: "Timeout in milliseconds. Defaults to 5000." }
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
    name: "inspect_codex_events",
    description: "Inspect local Codex token usage events from ~/.codex/logs_2.sqlite without importing them.",
    inputSchema: {
      type: "object",
      properties: {
        dbPath: { type: "string", description: "Optional path to Codex logs_2.sqlite. Defaults to ~/.codex/logs_2.sqlite." },
        threadId: { type: "string", description: "Optional Codex thread id filter." },
        turnId: { type: "string", description: "Optional Codex turn id filter." },
        limit: { type: "number", description: "Maximum SQLite rows to scan. Defaults to 2000." },
        count: { type: "number", description: "Number of recent collapsed events to return. Defaults to 12." }
      }
    }
  },
  {
    name: "import_codex_events",
    description: "Import the latest local Codex token usage event into the project Mission Invoice ledger.",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: { type: "string", description: "Absolute path to the project root. Defaults to the MCP process working directory." },
        dbPath: { type: "string", description: "Optional path to Codex logs_2.sqlite. Defaults to ~/.codex/logs_2.sqlite." },
        threadId: { type: "string", description: "Optional Codex thread id filter." },
        turnId: { type: "string", description: "Optional Codex turn id filter." },
        limit: { type: "number", description: "Maximum SQLite rows to scan. Defaults to 2000." },
        task: { type: "string" },
        category: { type: "string" },
        model: { type: "string" },
        inputRatio: { type: "number", description: "Estimated input share when local logs only expose total tokens. Defaults to 0.75." },
        includeActive: { type: "boolean", description: "Allow importing an in-progress event where needsFollowUp is true. Defaults to false." },
        force: { type: "boolean", description: "Record even when invoice mode is disabled or the event was already imported." }
      }
    }
  },
  {
    name: "get_invoice_mode",
    description: "Return whether automatic Mission Invoice generation is enabled.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_popup_mode",
    description: "Return whether the optional Mission Invoice macOS floating receipt is enabled.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_reference_models",
    description: "List available Mission Invoice reference models and the selected credits rate basis.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_runtime_status",
    description: "Return Mission Invoice runtime version, active runtime path, and update guidance.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "update_runtime",
    description: "Download and install the latest Mission Invoice runtime override without changing plugin metadata.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Optional runtime source URL. Defaults to the official Mission Invoice GitHub raw runtime." },
        sha256: { type: "string", description: "Optional expected SHA-256 checksum for the downloaded runtime." }
      }
    }
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
    name: "set_popup_mode",
    description: "Enable or disable the optional Mission Invoice macOS floating receipt.",
    inputSchema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        mode: { type: "string", description: "on/off or mission popup on/off" }
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
  if (name === "record_task_usage") return await recordTaskUsage(args);
  if (name === "get_account_rate_limits") return await readCodexAccountRateLimits(args);
  if (name === "get_usage_summary") return getUsageSummary(args);
  if (name === "inspect_codex_events") return inspectCodexEvents(args);
  if (name === "import_codex_events") return await importCodexEvents(args);
  if (name === "get_invoice_mode") return getInvoiceMode();
  if (name === "get_popup_mode") return getPopupMode();
  if (name === "get_reference_models") return { referenceModel: getReferenceModelInfo(), models: listReferenceModels(), command: "/mission model <model>" };
  if (name === "get_runtime_status") return getRuntimeStatus(args);
  if (name === "update_runtime") return updateRuntime(args);
  if (name === "set_reference_model") return setReferenceModel(args);
  if (name === "set_invoice_mode") return setInvoiceMode(args);
  if (name === "set_popup_mode") return setPopupMode(args);
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
  "rate-limits": "get_account_rate_limits",
  summary: "get_usage_summary",
  "inspect-events": "inspect_codex_events",
  "import-events": "import_codex_events",
  mode: "get_invoice_mode",
  popup: "get_popup_mode",
  models: "get_reference_models",
  runtime: "get_runtime_status",
  update: "update_runtime",
  "set-model": "set_reference_model",
  "set-mode": "set_invoice_mode",
  "set-popup": "set_popup_mode",
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

module.exports = {
  MISSION_INVOICE_RUNTIME_VERSION,
  DEFAULT_RUNTIME_UPDATE_URL,
  tools,
  cliAliases,
  ensureStore,
  callTool,
  content,
  handle,
  parseCliArgs,
  runCli,
  runMcpServer,
  inspectCodexEvents,
  importCodexEvents,
  getRuntimeStatus,
  updateRuntime
};
