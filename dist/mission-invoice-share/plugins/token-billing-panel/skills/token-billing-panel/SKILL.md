---
name: token-billing-panel
description: Estimate planned Codex token usage, record Mission Invoice static receipts, control invoice mode, switch the reference model, and review local receipt history. Use for every token-consuming Codex task by default, and whenever the user asks about token usage, Mission Invoice, payment records, receipt history, or model-based credit estimates.
---

# Mission Invoice

Use this skill for every Codex interaction that consumes tokens unless Mission Invoice is disabled.

General tasks do not require any prefix. Complete the task normally, then generate a Mission Invoice receipt before the final response.

## Invoice Mode

Mission Invoice is ON by default when this plugin is active.

Supported commands:

- `/mission on`: enable automatic receipt generation.
- `/mission off`: disable automatic receipt generation.
- `/mission setup`: ask before adding Mission Invoice rules to the current project's `AGENTS.md`.
- `/mission model <model>`: set the reference model for credit estimates.
- `/mission model list`: list supported reference models.

Supported reference models:

- `GPT-5.5`
- `GPT-5.4`
- `GPT-5.3-Codex`
- `GPT-5.2`

Default reference model: `GPT-5.5`.

## Project Setup

Mission Invoice must not silently modify project instructions.

For `/mission setup`:

1. Check whether the current project already has the Mission Invoice rule.
2. If not, ask the user for explicit confirmation.
3. Only after confirmation, write or refresh the marked block in `AGENTS.md`.

The block is bounded by:

```text
<!-- mission-invoice:start -->
...
<!-- mission-invoice:end -->
```

## Recording Workflow

Before the final response of a token-consuming interaction:

1. Check invoice mode when the tool is available.
2. If Mission Invoice is OFF, do not record a receipt and mention `/mission off` mode.
3. If ON, call `record_task_usage`.
4. Include task title, category, model when known, elapsed time when known, token estimates, and line items when possible.
5. If actual usage is unavailable, mark the receipt as estimated.
6. Include the returned receipt link in the final response as a clickable Markdown link with this text:

```markdown
[本次mission payment](file:///.../.codex-token-billing/receipts/TX-....html)
```

Use `historyUrl` when the user asks for historical bills.

## Static Receipt UI

Generated receipts are static HTML files stored locally.

Receipt behavior:

- Chinese-only UI.
- No language toggle.
- Footer links:
  - `歷史帳單` opens `index.html#history`.
  - `統計資訊` opens `index.html#stats`.

History behavior:

- `歷史帳單` shows receipt number, token spend, and a view link.
- `統計資訊` shows total token usage and task-type token statistics grouped by model name.
- The page is static and does not require a local server.

## Data Location

```text
~/.codex-token-billing/usage-log.json
~/.codex-token-billing/settings.json
~/.codex-token-billing/receipts/
~/.codex-token-billing/receipts/index.html
```

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
