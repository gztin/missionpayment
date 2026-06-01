# Install Mission Invoice

## Install From A Local Folder

Unzip or clone this marketplace folder, then run:

```bash
codex plugin marketplace add /absolute/path/to/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

Restart Codex if the plugin does not appear immediately.

## Install From A Git Repository

If this marketplace is published as a Git repository:

```bash
codex plugin marketplace add owner/repo --ref main
codex plugin add token-billing-panel@mission-invoice
```

If the marketplace lives in a subfolder of a repository, add the sparse path:

```bash
codex plugin marketplace add owner/repo --ref main --sparse path/to/mission-invoice-marketplace
codex plugin add token-billing-panel@mission-invoice
```

## Verify Installation

List configured marketplaces:

```bash
codex plugin marketplace list
```

List available plugins:

```bash
codex plugin list
```

Mission Invoice should appear with plugin id:

```text
token-billing-panel
```

## First Project Setup

In each Codex project where you want more reliable automatic receipts, run:

```text
/mission setup
```

Mission Invoice will ask before writing rules to that project's `AGENTS.md`.

## Open The Dashboard

Ask Codex:

```text
打開我的 Mission Invoice Dashboard
```

The dashboard runs locally at:

```text
http://127.0.0.1:48732
```
