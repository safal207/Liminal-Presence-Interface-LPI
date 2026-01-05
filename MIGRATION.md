# Renaming: LRI → LPI

This repository previously used **LRI** to name the interface/protocol layer.
That naming has been retired in favor of **LPI (Liminal Presence Interface)** to
avoid confusion with **LRI = Living Relational Identity**.

## What changed

- Package names:
  - `node-lri` → `node-lpi`
  - `python-lri` → `python-lpi`
- CLI tool:
  - `lpictl` is the new name.
  - `lrictl` remains as a legacy alias and prints a deprecation warning.
- API surface:
  - Express middleware `lriMiddleware` → `lpiMiddleware`
  - Request attachment `req.lri` → `req.lpi`
  - WebSocket helpers `LRIWS*` → `LPIWS*`
  - Handshake headers `LRI-LHS*` → `LPI-LHS*`
  - Handshake fields `lri_version` → `lpi_version`

## Quick migration checklist

1. Update imports and package names in your apps.
2. Rename middleware usage and request accessors (`req.lpi`).
3. Update any LHS header names and payload fields to `LPI-LHS*` / `lpi_version`.
4. Replace `lrictl` with `lpictl` in scripts (the alias still works for now).

For terminology rules, see [docs/glossary.md](docs/glossary.md).
