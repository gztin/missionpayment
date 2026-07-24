---
name: token-billing-panel
description: Estimate planned Codex token usage, record Mission Invoice static receipts, control invoice mode, switch the reference model, and review local receipt history. Use for every token-consuming Codex task by default, and whenever the user asks about token usage, Mission Invoice, payment records, receipt history, or model-based credit estimates.
---

# Mission Invoice

Use this skill for every Codex interaction that consumes tokens unless Mission Invoice is disabled.

Mission Invoice records estimated token and credits usage as local static HTML receipts. Settings are global, while ledgers and receipts are separated by project path. All data stays on the user's machine in:

```text
~/.codex-token-billing/settings.json
~/.codex-token-billing/projects/<project-id>/usage-log.json
~/.codex-token-billing/projects/<project-id>/receipts/
~/.codex-token-billing/projects/<project-id>/receipts/index.html
```

`<project-id>` is generated from the absolute project path, so two projects do not share receipt history by default. Older global ledger files are not imported into a new project automatically.

## Commands

Support these user-facing commands:

- `/mission setup`: ask before adding Mission Invoice rules to the current project's `AGENTS.md`.
- `/mission on`: enable automatic receipt generation.
- `/mission off`: disable automatic receipt generation.
- `/mission model <model>`: set the reference model used for credit estimates.
- `/mission model list`: list supported reference models.
- `/mission runtime`: show the active Mission Invoice runtime version and update guidance.
- `/mission update`: download the latest runtime override for receipt logic fixes without changing plugin metadata.
- `/mission inspect-events`: inspect local Codex token events from `~/.codex/logs_2.sqlite` without writing a receipt.
- `/mission import-events`: import the latest positive local Codex token event into this project's Mission Invoice ledger.

Supported reference models:

- `GPT-5.5`
- `GPT-5.4`
- `GPT-5.4-Mini`
- `GPT-5.3-Codex`
- `GPT-5.2`

Default reference model: `GPT-5.5`.

Credit estimates use the official Codex token-based rate card:

```text
https://help.openai.com/zh-hant/articles/20001106-codex-rate-card
```

## Use The Script

The bundled script is:

```text
scripts/token-billing-mcp.js
```

It can run as an MCP stdio server, but in generic skill installs it is easiest to call its CLI mode:

```bash
node scripts/token-billing-mcp.js <command> '<json-args>'
```

Available CLI commands:

- `record` or `record-task`
- `summary`
- `mode`
- `models`
- `runtime`
- `update`
- `inspect-events`
- `import-events`
- `set-model`
- `set-mode`
- `setup-status`
- `setup`

Examples:

```bash
node scripts/token-billing-mcp.js models "{}"
node scripts/token-billing-mcp.js runtime "{}"
node scripts/token-billing-mcp.js set-model "{\"model\":\"GPT-5.5\"}"
node scripts/token-billing-mcp.js set-mode "{\"mode\":\"on\"}"
node scripts/token-billing-mcp.js inspect-events "{\"count\":5}"
node scripts/token-billing-mcp.js import-events "{\"projectPath\":\"<absolute-project-path>\"}"
```

On Windows PowerShell, prefer single quotes around JSON:

```powershell
node scripts/token-billing-mcp.js set-model '{"model":"GPT-5.5"}'
```

When running from outside the skill folder, use the absolute path to `scripts/token-billing-mcp.js`.

## Project Setup

Mission Invoice must not silently modify project instructions.

For `/mission setup`:

1. Check whether the current project already has the Mission Invoice rule:

   ```bash
   node scripts/token-billing-mcp.js setup-status "{\"projectPath\":\"<absolute-project-path>\"}"
   ```

2. If the rule is missing or stale, ask the user for explicit confirmation.
3. Only after the user agrees, write or refresh the marked block:

   ```bash
   node scripts/token-billing-mcp.js setup "{\"projectPath\":\"<absolute-project-path>\",\"confirmed\":true}"
   ```

The block is bounded by:

```text
<!-- mission-invoice:start -->
...
<!-- mission-invoice:end -->
```

## Recording Workflow

Before the final response of a token-consuming task:

1. Check whether Mission Invoice is enabled:

   ```bash
   node scripts/token-billing-mcp.js mode "{}"
   ```

2. If disabled, do not record a receipt and mention that `/mission off` is active.
3. If enabled, record the task:

   ```bash
   node scripts/token-billing-mcp.js record '{"projectPath":"<absolute-project-path>","task":"<short task title>","taskType":"coding","model":"GPT-5.5","inputTokens":1200,"outputTokens":600,"totalTokens":1800,"elapsedMs":0,"notes":"Estimated from visible task context."}'
   ```

4. Use the returned `receiptUrl` in the final response as a clickable Markdown link with this exact text:

   ```markdown
   [本次mission payment](file:///.../.codex-token-billing/projects/<project-id>/receipts/TX-....html)
   ```

Use `historyUrl` when the user asks for historical bills or statistics.

If actual runtime usage is unavailable, mark the receipt as estimated. Do not claim it is official billing data.
Do not record a normal task with zero tokens. If token usage is unavailable, estimate positive input/output/total token counts before recording. `forceEmpty` is reserved for intentional 0-token test receipts.

## Runtime Updates

The MCP entry script is a stable shell. It loads the bundled runtime from:

```text
runtime/mission-invoice-runtime.cjs
```

It also checks for a user-local override before each CLI command or MCP tool call:

```text
~/.codex-token-billing/runtime/mission-invoice-runtime.cjs
```

Use `/mission runtime` to inspect the active runtime path and version. Use `/mission update` only when the user asks to update Mission Invoice or when a bugfix is needed. Runtime updates can change receipt logic, generated HTML, and local data handling without reinstalling the plugin. A Codex restart or new thread is still recommended when plugin metadata, skill descriptions, MCP server configuration, or marketplace entries change.

## Codex Local Event Import

When the user asks whether Mission Invoice can read Codex CLI/app token usage, use local event import:

1. Inspect local Codex token events:

   ```bash
   node scripts/token-billing-mcp.js inspect-events "{\"count\":5}"
   ```

2. Import the latest positive event into the current project ledger:

   ```bash
   node scripts/token-billing-mcp.js import-events "{\"projectPath\":\"<absolute-project-path>\"}"
   ```

This reads `~/.codex/logs_2.sqlite` and only returns/imports token metadata such as `threadId`, `turnId`, model, timestamp, and token totals. It must not expose prompt text or raw log bodies in user-facing output.

Current Codex local logs expose turn-level `total_usage_tokens` snapshots. Mission Invoice computes the task amount by subtracting the previous total in the same thread. If input/output token split is not available, the imported receipt marks the total as observed and the input/output split as estimated. Import defaults to completed events only; pass `includeActive:true` only when intentionally importing an in-progress turn snapshot.

## Static Receipt UI

Generated receipts are static HTML files:

- Chinese-only UI.
- No language toggle.
- Receipt footer links:
  - `歷史帳單` opens `index.html#history`.
  - `統計資訊` opens `index.html#stats`.
- The static pages do not require a local dashboard server.

## Categories

Use these categories when recording:

- `planning`
- `coding`
- `frontend-review`
- `analysis`
- `documentation`
- `debugging`

## Limitations

Mission Invoice does not read official Codex account plans, hosted billing records, or real account usage. Token counts and credits are estimates unless the runtime provides actual usage data.
