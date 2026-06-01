# Mission Invoice Share Package

This folder is a local Codex plugin marketplace package for Mission Invoice.

## Install

From the machine where Codex is installed:

```bash
codex plugin marketplace add /absolute/path/to/mission-invoice-share
codex plugin add token-billing-panel@mission-invoice-share
```

If Codex is already open, restart it after installation.

## Included Plugin

- Plugin id: `token-billing-panel`
- Display name: `Mission Invoice`
- Version: `0.1.0+codex.20260601083233`

## First Project Setup

In each project where you want Mission Invoice to persist reliably, run:

```text
/mission setup
```

The plugin will ask before adding Mission Invoice rules to that project's `AGENTS.md`.

## Data Location

Receipts and settings are stored locally on the user's machine:

```text
~/.codex-token-billing/
```
