# Migration: LRI → LPI terminology

The repository previously used **LRI** to refer to the interface/protocol layer ("Liminal Resonance Interface"). The interface/protocol name is now **LPI (Liminal Presence Interface)**. **LRI** is reserved exclusively for **Living Relational Identity**.

## Legacy names (no code changes in this PR)

Some package and tool names still carry legacy identifiers and should be treated as aliases for the LPI interface layer until code renames land:

- `packages/node-lri`
- `packages/python-lri`
- `packages/lrictl`

This PR is documentation-only and does not rename any code or packages.
