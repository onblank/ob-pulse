# Architecture

## Dependency graph

```
React widget <- typed preload <- Electron main (composition)
                                      |-> Application -> Domain
                                      |         |-> Contracts (runtime & host ports)
                                      |-> Ollama / LM Studio adapters (runtime infrastructure)
                                      |-> Host metrics adapter (OS infrastructure)
```

Runtime providers report capabilities, not pretend feature parity. `RuntimePort` supports `probe`,
`listInstalled`, `listLoaded`, `startServer`, `stopServer`, `loadModel`, `unloadModel`, `benchmark`.
Each adapter returns _unsupported_ for unimplemented operations; `capabilities` drives disabled UI.

**Lifecycle**: `disconnected`, `external-running`, `managed-running`. `startServer()` spawns `ollama serve`
only when API isn't already responding; `stopServer()` only kills the process created by this app.
When Ollama was started by LaunchAgent/Brew/another app, the button must not terminate it.

**Metric boundaries**:

- Host total CPU / host RAM are not the selected model CPU / RAM.
- Ollama `/api/ps` reports loaded models, `size`, `size_vram`, `context_length`; it does not report live requests/sessions.
- A per-request final response reports prompt/response token counts and evaluation durations; these may calculate tps **only for that request**.
- No claim that the most recent model equals the model currently receiving tokens.
- Context utilisation is client-session-based; configured window is an upper bound, not the effective remaining user-token budget (system/tool overhead matters).

**Persistence (planned)**: local SQLite in `packages/db-sqlite` with explicit numbered migrations, optional retention,
no raw prompts/content, opt-in history; schema is designed in `docs/DATA_MODEL.md`. Not wired in v0.1 scaffold.

**Adapter extension**: built-in, statically registered adapters first. Future signed/community adapters need capability contracts, threat model and opt-in permissions; never execute arbitrary third-party code from a discovered directory.
