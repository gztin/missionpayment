# Mission Invoice

Mission Invoice is a Codex plugin marketplace package that records estimated Codex token usage as local receipt-style invoices.

The plugin is local-only. Receipts and settings are stored on the user's machine under `~/.codex-token-billing`.

## Install

Run these commands in a terminal:

```bash
codex plugin marketplace add gztin/missionpayment --ref main --sparse dist/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

Restart Codex if the plugin does not appear immediately.

## First Use

In each project where you want more reliable automatic receipts, run:

```text
/mission setup
```

Mission Invoice will ask before adding a marked rule block to that project's `AGENTS.md`.

## Commands

```text
/mission setup
/mission on
/mission off
```

General Codex tasks do not need any prefix. When Mission Invoice is enabled and loaded, the agent records a receipt before the final response and includes the receipt URL.

## What It Includes

- Local token receipt records
- Local dashboard at `http://127.0.0.1:48732`
- Project setup with `/mission setup`
- Global invoice mode with `/mission on` and `/mission off`

## Documentation

- [Marketplace README](dist/mission-invoice-marketplace/README.md)
- [Install Guide](dist/mission-invoice-marketplace/INSTALL.md)
- [Changelog](dist/mission-invoice-marketplace/CHANGELOG.md)

## Privacy

Mission Invoice does not read official Codex account plans, hosted billing records, or real account usage. Token counts are estimates unless actual usage data is provided by the runtime.
