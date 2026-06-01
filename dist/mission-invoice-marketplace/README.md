# Mission Invoice Marketplace

This folder is a Codex plugin marketplace that distributes the Mission Invoice plugin.

Mission Invoice records estimated Codex token usage as local receipt-style invoices. It stores receipts and settings on the user's own machine under `~/.codex-token-billing`.

## Included Plugin

- Marketplace name: `mission-invoice`
- Plugin id: `token-billing-panel`
- Display name: `Mission Invoice`
- Version: `0.1.0+codex.20260601083233`
- Category: `Productivity`

## Install

See [INSTALL.md](./INSTALL.md).

## Usage

After installation, use these commands inside Codex:

```text
/mission setup
/mission on
/mission off
```

For each project, run `/mission setup` once if you want more reliable automatic receipts. Mission Invoice asks before adding a marked rule block to that project's `AGENTS.md`.

## Privacy

Mission Invoice is local-only:

- It writes records to `~/.codex-token-billing`.
- It does not read official Codex account plans.
- It does not read hosted billing records.
- It does not send receipt records to an external service.

## Limitations

- Token counts are estimates unless the runtime provides actual usage data.
- Automatic receipt generation depends on Codex loading the plugin skill or project instructions.
- Project persistence requires user-approved `/mission setup`.
