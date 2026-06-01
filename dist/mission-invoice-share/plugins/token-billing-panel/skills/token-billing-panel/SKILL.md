---
name: token-billing-panel
description: Estimate planned Codex token cost, record task token usage, control Mission Invoice mode, and review a local Mission Invoice dashboard. Use for every token-consuming Codex task by default, and whenever the user asks about token usage, cost estimates, Mission Invoice, invoice mode, consumption records, or billing dashboards.
---

# Mission Invoice

Use this skill for every Codex interaction that consumes tokens unless Mission Invoice is disabled. General tasks do not require any prefix or command from the user; complete the task normally, then generate the receipt before the final response. Only use slash commands when the user wants to change the invoice feature state.

## Invoice Mode

Default behavior is **Mission Invoice ON** for all projects and conversations when this plugin is active.

Supported user commands:

- `/mission on`: turn automatic invoice generation ON globally on this machine.
- `/mission off`: turn automatic invoice generation OFF globally on this machine.
- `/mission setup`: ask to add Mission Invoice rules to the current project's `AGENTS.md`, then write them only after explicit user confirmation.
- Legacy aliases still accepted: `/Token Billing Invoice`, `/Token Billing texfree`, and `/Token Billing taxfree`.

When the user sends one of these commands:

1. For `/mission on` or `/mission off`, call `set_invoice_mode` with `mode: "mission on"` or `mode: "mission off"`.
2. For `/mission setup`, call `get_project_setup_status` for the current project path first. If the project is not set up yet, ask the user whether to add the Mission Invoice rule to that project's `AGENTS.md`. Only call `setup_project_instructions` with `confirmed: true` after the user agrees.
3. Confirm the new state in the final response.
4. Do not generate a receipt for the command that disables invoice generation.
5. When enabling invoice generation or setting up a project, generate a receipt only if the interaction involved meaningful follow-up work beyond the toggle/setup.

## Project Setup Workflow

Mission Invoice should not silently modify project instructions during plugin installation. Project-level persistence is opt-in:

1. On a project's first Mission Invoice use, call `get_project_setup_status` when available.
2. If `hasMissionInvoiceRule` is false, tell the user that automatic receipts will be more reliable if the project rule is added to `AGENTS.md`, then ask for confirmation.
3. If the user agrees, call `setup_project_instructions` with the absolute project root and `confirmed: true`.
4. If the user declines, continue the task without writing project files.
5. If `hasMissionInvoiceRule` is true, continue normally and do not ask again.

The setup writes a clearly marked `<!-- mission-invoice:start --> ... <!-- mission-invoice:end -->` block, so rerunning `/mission setup` refreshes the rule without duplicating it.

Before recording a task receipt, call `get_invoice_mode` when available. If Mission Invoice is OFF, do not call `record_task_usage`; state that `/mission off` mode is active and no invoice was generated.

## Plan Estimate Workflow

When you present an execution plan for approval:

1. Estimate the likely token usage before the user approves implementation.
2. Prefer calling the `estimate_plan_cost` MCP tool when available.
3. Show a compact "預期 token 帳單" block after the plan.
4. Clearly mark the estimate as an estimate unless a real usage API is available.

Suggested output shape:

```text
預期 token 帳單
- 預估輸入：約 N tokens
- 預估輸出：約 N tokens
- 預估總量：約 N tokens
- 區間：低 / 中 / 高
- 主要原因：讀檔範圍、修改量、驗證步驟
```

## Usage Recording Workflow

After completing a task:

1. You must call `get_invoice_mode` when available.
2. If Mission Invoice is OFF, do not generate a receipt and explicitly say `/mission off` mode is active.
3. If Mission Invoice is ON, you must call `record_task_usage` before the final response whenever the user interaction consumed tokens, including planning, analysis, code changes, browsing, file inspection, and verification.
4. Pass the task title, category, model when known, elapsed time when known, estimate, and any known actual usage.
5. If actual token counts are unavailable, record the estimate and set `confidence` to `estimated`.
6. Include `lineItems` when possible so the dashboard can render a receipt-like breakdown.
7. After recording, always include the returned `receiptUrl` in the final response so the user can inspect this task's cost details.
8. If `record_task_usage` is unavailable or fails, say that the receipt could not be generated and briefly explain why.
9. Use categories such as:
   - `planning`
   - `coding`
   - `frontend-review`
   - `analysis`
   - `documentation`
   - `debugging`

This receipt rule applies even when the user did not explicitly ask for a receipt, as long as the plugin is active, Mission Invoice is ON, and the interaction consumed tokens.

Suggested receipt alert:

```text
Mission Invoice
- 發票號碼：TX-...
- 店名：Codex Token Mart
- 任務：...
- 模型：...
- 耗時：...
- TOTAL：N tokens
- PAYMENT：Estimated
- 明細網址：http://127.0.0.1:48732/receipt/...
```

## Dashboard Workflow

When the user asks to view token usage:

1. Prefer `get_usage_summary` for a text summary.
2. Prefer `open_billing_panel` when the user wants the GUI dashboard.
3. Prefer `open_latest_receipt` when the user wants the newest receipt page.
4. Explain that records are local to this machine.

The default page opens the latest receipt:

- `/`: latest token receipt.
- `/receipt/:id`: one task's receipt details.
- `/dashboard`: history bills and wallet information.

The history bill table should stay compact: receipt number, token cost, and a link to view the receipt.

## Limitation

Codex plugin manifests currently may not provide a supported plan-submitted hook. If no hook or modal API is available, agents should explicitly invoke the estimate workflow before proceeding with implementation.
