---
name: mission-invoice
description: Record Mission Invoice receipts for Codex tasks, set up project AGENTS.md rules, switch the reference model for token and credit estimates, and review local receipt history. Use when the user wants Mission Invoice behavior through a generic skill install, asks for /mission setup, or needs token/credits receipt records without installing the full Codex plugin marketplace package.
---

# Mission Invoice

Use this skill when Mission Invoice is installed as a generic Codex skill instead of the full plugin marketplace package.

Mission Invoice records estimated token and credits usage as local static HTML receipts. All data stays on the user's machine in:

```text
~/.codex-token-billing
```

## Commands

Support these user-facing commands:

- `/mission setup`: ask before adding Mission Invoice rules to the current project's `AGENTS.md`.
- `/mission on`: enable automatic receipt generation.
- `/mission off`: disable automatic receipt generation.
- `/mission model <model>`: set the reference model used for credit estimates.
- `/mission model list`: list supported reference models.

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
- `set-model`
- `set-mode`
- `setup-status`
- `setup`

Examples:

```bash
node scripts/token-billing-mcp.js models "{}"
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
   [本次mission payment](file:///.../.codex-token-billing/receipts/TX-....html)
   ```

Use `historyUrl` when the user asks for historical bills or statistics.

If actual runtime usage is unavailable, mark the receipt as estimated. Do not claim it is official billing data.

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
