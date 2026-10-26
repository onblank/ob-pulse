# Architecture

## Dependency graph

```
React compact/expanded UI <- typed preload <- Electron main (composition + sampler)
                                      |-> Application -> Domain
                                      |         |-> Contracts (runtime & host ports)
                                      |-> Ollama / LM Studio adapters (runtime infrastructure)
                                      |-> Host metrics adapter (OS infrastructure)
                                      |-> Owned-process metrics adapter (OS infrastructure)
                                      |-> Opt-in loopback instrumentation adapter
```

Runtime providers report capabilities, not pretend feature parity. `RuntimePort` supports
`ownedProcessId`, `state`, `listInstalled`, `listLoaded`, `startServer`, `stopServer`, `loadModel`,
`unloadModel` and `benchmark`. Each adapter returns _unsupported_ for unimplemented operations;
`capabilities` drives disabled UI.

**Lifecycle**: `disconnected`, `external-running`, `managed-running`. `startServer()` spawns `ollama serve`
only when API isn't already responding; `stopServer()` only kills the process created by this app.
When Ollama was started by LaunchAgent/Brew/another app, the button must not terminate it.
LM Studio remains an external server in this iteration: OB-Pulse may call its native v1 model
load/unload endpoints, but it neither invokes `lms` nor stops the service. A multi-instance model
is not unloaded until the UI can identify the intended runtime instance explicitly.

**Metric boundaries**:

- Host total CPU / host RAM are not the selected model CPU / RAM.
- Process CPU/RAM is sampled only from the direct child PID retained by an adapter for a service
  that OB-Pulse started. It excludes descendants and is not model-specific. CPU is the `/bin/ps`
  core-equivalent percentage and may exceed 100% for multithreaded work; RAM is resident bytes.
- External Ollama, LM Studio, Windows and a failed/unsupported process probe report process metrics
  as unavailable. OB-Pulse never discovers a process by name, port or service.
- Ollama `/api/ps` reports loaded models, `size`, `size_vram`, `context_length`; it does not report live requests/sessions.
- A per-request final response reports prompt/response token counts and evaluation durations; these may calculate tps **only for that request**.
- LM Studio's native v1 benchmark reports decode tokens/sec and first-token latency directly. Its
  response output is discarded, `store:false` prevents chat persistence, and absent prefill timing
  remains unavailable.
- No claim that the most recent model equals the model currently receiving tokens.
- Context utilisation is client-session-based; configured window is an upper bound, not the effective remaining user-token budget (system/tool overhead matters).

**Current rolling history**: `InMemoryMetricHistory` belongs to the application layer. Electron main
captures a snapshot every three seconds while the application process is alive, including when the
window is hidden in the tray. Samples older than one hour are evicted and nothing is restored after
quit or restart. Benchmark throughput is stored as a sparse event, not repeated as if it were live
traffic.

**Owned-process sampling**: `@obpulse/process-metrics` is separate from host-wide metrics. On macOS
and Linux it invokes the fixed `/bin/ps` executable with fixed flags and the validated positive PID
provided by `RuntimePort.ownedProcessId()`, never through a shell. `MonitorService` requests a sample
only while the selected runtime reports `managed-running`. The current sample is neither added to
the one-hour history nor persisted. Windows returns unavailable until a separately reviewed native
probe exists.

**Widget preferences**: Electron main validates and atomically stores a small
`widget-preferences.json` file under Electron's machine-local `userData` directory. The renderer can
read or replace only the typed position, opacity and high-contrast values through narrow IPC. The
opacity presets stop at 75% so a saved preference cannot make the frameless window effectively
invisible. These preferences contain no runtime observations and do not alter the one-hour volatile
history boundary. Tray-relative and corner placement is clamped to the selected display's work area;
placement is best-effort where the OS compositor prohibits programmatic positioning.

**Runtime preferences**: Electron main validates and atomically stores enabled built-in runtime IDs
in a separate `runtime-preferences.json` file under `userData`. `MonitorService` remains the policy
boundary: it requires at least one registered runtime, rejects disabled selections and switches to
the first enabled adapter if the current selection is disabled. The renderer receives only a typed
catalog and narrow get/set methods. Disabling changes OB-Pulse visibility and control eligibility;
it does not stop an external or app-managed service and never removes model weights.

**Persistence (planned, optional)**: if durable history is later justified, local SQLite in
`packages/db-sqlite` must use explicit numbered migrations, opt-in retention and numeric telemetry
only. Its candidate schema is described in `docs/DATA_MODEL.md`; it is not wired into the current UI.

**Adapter extension**: built-in, statically registered adapters first. Future signed/community adapters need capability contracts, threat model and opt-in permissions; never execute arbitrary third-party code from a discovered directory.

**Client instrumentation**: the HTTP adapter is inactive at startup. A user action creates a fresh
256-bit bearer token and binds an ephemeral port on `127.0.0.1`; disable or quit closes the server
and discards the token. The adapter limits bodies and request rates, rejects unknown fields and
passes only validated v1 numeric events to the in-memory application session store. That store
retains at most one hour and 7,200 request samples, supports multiple observed sessions and clears
all instrumentation state when the bridge is disabled. It has no runtime-control, filesystem,
product or Agent OS permissions.
