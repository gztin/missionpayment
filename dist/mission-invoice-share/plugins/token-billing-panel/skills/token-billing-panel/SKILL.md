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

Supported reference models:

- `GPT-5.5`
- `GPT-5.4`
- `GPT-5.3-Codex`
- `GPT-5.2`

Default reference model: `GPT-5.5`.

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
   node scripts/token-billing-mcp.js record '{"projectPath":"<absolute-project-path>","task":"<short task title>","taskType":"coding","model":"GPT-5.5","inputTokens":0,"outputTokens":0,"elapsedMs":0,"notes":"Estimated from visible task context."}'
   ```

4. Use the returned `receiptUrl` in the final response as a clickable Markdown link with this exact text:

   ```markdown
   [本次mission payment](file:///.../.codex-token-billing/projects/<project-id>/receipts/TX-....html)
   ```

Use `historyUrl` when the user asks for historical bills or statistics.

If actual runtime usage is unavailable, mark the receipt as estimated. Do not claim it is official billing data.

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
