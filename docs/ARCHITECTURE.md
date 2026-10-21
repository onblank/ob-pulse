# Architecture

## Dependency graph

```
React compact/expanded UI <- typed preload <- Electron main (composition + sampler)
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

**Current rolling history**: `InMemoryMetricHistory` belongs to the application layer. Electron main
captures a snapshot every three seconds while the application process is alive, including when the
window is hidden in the tray. Samples older than one hour are evicted and nothing is restored after
quit or restart. Benchmark throughput is stored as a sparse event, not repeated as if it were live
traffic.

**Persistence (planned, optional)**: if durable history is later justified, local SQLite in
`packages/db-sqlite` must use explicit numbered migrations, opt-in retention and numeric telemetry
only. Its candidate schema is described in `docs/DATA_MODEL.md`; it is not wired into the current UI.

**Adapter extension**: built-in, statically registered adapters first. Future signed/community adapters need capability contracts, threat model and opt-in permissions; never execute arbitrary third-party code from a discovered directory.
