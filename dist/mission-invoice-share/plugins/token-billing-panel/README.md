# Mission Invoice

Mission Invoice is a local Codex plugin that records estimated token usage as receipt-style invoices.

The plugin stores all records on the user's own machine under `~/.codex-token-billing`. It does not read official Codex account plans, actual account billing, or hosted usage data.

## Features

- Creates local token receipt records after Codex tasks.
- Opens a local dashboard at `http://127.0.0.1:48732`.
- Supports project setup with `/mission setup`.
- Supports global invoice mode commands:
  - `/mission on`
  - `/mission off`
- Keeps project setup opt-in. It only writes to a project's `AGENTS.md` after the user confirms.

## Install From Shared Package

After receiving and unzipping the shared package:

```bash
codex plugin marketplace add /path/to/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

Restart Codex after installation if the plugin does not appear immediately.

## First Use In A Project

In a project where you want more reliable automatic receipts, run:

```text
/mission setup
```

Mission Invoice will ask whether it should add a marked rule block to that project's `AGENTS.md`. It writes only after the user agrees.

The inserted block is bounded by:

```text
<!-- mission-invoice:start -->
...
<!-- mission-invoice:end -->
```

Running `/mission setup` again refreshes the block without duplicating it.

## Usage

General Codex tasks do not need any prefix. When Mission Invoice is enabled, the agent should record a receipt before the final response and include the receipt URL.

Use these commands only when changing Mission Invoice behavior:

```text
/mission on
/mission off
/mission setup
```

## Local Data

Mission Invoice writes local files under:

```text
~/.codex-token-billing/
```

Typical files:

- `usage-log.json`
- `settings.json`

## Limitations

- Token counts are estimates unless a real usage source is provided by the environment.
- Automatic receipt behavior depends on Codex loading the plugin skill or project instructions.
- For best reliability per project, run `/mission setup` once and approve the `AGENTS.md` rule.
