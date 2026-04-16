# Migration: LRI → LPI terminology

The repository previously used **LRI** to refer to the interface/protocol layer (formerly "Liminal Resonance Interface"). The interface/protocol name is now **LPI (Liminal Presence Interface)**. **LRI** is reserved exclusively for **Living Relational Identity**.

This document-only change introduces no code changes.
SDK and example code will be updated to LPI naming in follow-up releases. This PR intentionally does not change any public APIs.

## Legacy names (no code changes in this PR)

Some package and tool names still carry legacy identifiers and should be treated as aliases for the LPI interface layer until code renames land:

- `packages/node-lri`
- `packages/python-lri`
- `packages/lrictl`

This PR is documentation-only and does not rename any code or packages.

# Migration: protocol version option rename (lriVersion -> lpiVersion)

## What changed
The canonical option for configuring the advertised WebSocket protocol version is now:

- `lpiVersion` (new, canonical)

The legacy alias is still supported:

- `lriVersion` (deprecated)

Wire-level handshake payload remains unchanged:
- the JSON field is still `lri_version` for backwards compatibility.

## Do I need to change anything?
Only if you set `lriVersion` explicitly.

### Before
```ts
new LPIWSClient({ url, lriVersion: "0.1" });
new LPIWSServer({ port, lriVersion: "0.1" });
```

### After (recommended)
```ts
new LPIWSClient({ url, lpiVersion: "0.1" });
new LPIWSServer({ port, lpiVersion: "0.1" });
```

### Resolution order
`lpiVersion` -> `lriVersion` -> default (`0.1`)
