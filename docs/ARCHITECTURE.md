# Architecture

## Dependency graph

```
React compact/monitor/settings UI <- typed preload <- Electron main (composition + sampler)
                                      |-> Application -> Domain
                                      |         |-> Contracts (runtime & host ports)
                                      |-> Ollama / LM Studio adapters (runtime infrastructure)
                                      |-> Host metrics adapter (OS infrastructure)
                                      |-> Owned-process metrics adapter (OS infrastructure)
                                      |-> Opt-in loopback instrumentation adapter
```

Runtime providers expose a `RuntimeAdapterManifest` contract at version `1.0.0`, not pretend feature
parity. The manifest is the single static source for capabilities plus loopback, server-control,
credential and prohibited-action permissions. `RuntimePort` supports
`controlAuthority`, `ownedProcessId`, `state`, `listInstalled`, `listLoaded`, `startServer`, `stopServer`, `takeControl`, `releaseControl`,
`loadModel`, `unloadModel` and `benchmark`. Each adapter returns _unsupported_ for unimplemented operations;
`manifest.capabilities` drives disabled UI. Dynamic `controlAuthority` remains outside the manifest:
support for an operation does not mean Pulse currently has authority to execute it.
The llama.cpp implementation is a third static adapter with `serverControl: none`: it uses only
official health/model-read endpoints at the fixed default loopback address and always remains an
observer.
MLX-LM is another `serverControl: none` adapter, disabled by default. Its fixed model-list endpoint
proves only a compatible reachable catalog; records remain installed/available and never loaded.

**UI surfaces**: the native window retains only `compact` and `expanded` geometry. Renderer-local
navigation separates `monitor` from `settings` so configuration does not leak into the operational
dashboard. Opening settings requests expanded geometry first; receiving compact geometry always
returns the renderer to monitor. The narrow `pulse:open-settings` event preserves the tray shortcut
without exposing generic renderer navigation through IPC.

**Multi-runtime observation**: `MonitorService.snapshot()` observes all enabled adapters concurrently
and returns both the selected detail and the complete runtime list. Each observation has a 2.5-second
application-layer bound and its own error state; model or provider failure does not discard healthy
cards. Concurrent UI/sampler consumers share the same in-flight poll. Commands carry a validated
runtime ID, remain blocked for disabled adapters and still delegate lifecycle authority to the
adapter. The renderer never discovers or terminates processes; explicit takeover and PID identity
checks stay in the adapter/process-control boundary.

**Lifecycle**: `disconnected`, `external-running`, `managed-running`. `startServer()` spawns `ollama serve`
only when API isn't already responding. External Ollama remains observer-only until Take control
resolves the fixed loopback port to exactly one PID and captures its process identity. Stop and app
quit may terminate that process tree only while the identity still matches; Release returns it to
external observation without stopping it.
For LM Studio, an explicit start checks `lms daemon status --json` and starts headless `llmster` with
`lms daemon up --json` only when no daemon is already running. It records the returned PID and starts
the local server on `127.0.0.1:1234`. Stop and app quit call `lms daemon down` only after a fresh
status confirms that same PID. A pre-existing daemon remains external until user-confirmed
`takeControl()` resolves the loopback listener to one PID and captures its identity. Stop or app quit
terminates the adopted process tree after revalidation. `releaseControl()` leaves any adopted
process running. A multi-instance model
is not unloaded until the UI can identify the intended runtime instance explicitly.

**Control authority** is explicit and typed: `observer`, `session-managed`, `delegated`,
`service-managed` or `process-owned`. Current Ollama and LM Studio use `observer`/`process-owned`
for spawned or explicitly adopted processes; LM Studio also uses `session-managed` for a server
toggle on an already-running daemon. Capability metadata hides handover where process identity
cannot be proven.

**Metric boundaries**:

- Host total CPU / host RAM are not the selected model CPU / RAM.
- Process CPU/RAM is sampled only from the listener/child PID retained by an adapter for a service
  that OB-Pulse started or the user explicitly adopted. It excludes descendants and is not model-specific. CPU is core-equivalent
  and may exceed 100% for multithreaded work; RAM is resident bytes. This can undercount runtimes
  that delegate model work to helper processes.
- Unadopted external Ollama/LM Studio, llama.cpp and a failed/unsupported process probe report
  process metrics as unavailable. Lifecycle takeover resolves a listener by fixed port only after
  explicit user confirmation; metrics sampling itself never discovers processes.
- Ollama `/api/ps` reports loaded models, `size`, `size_vram`, `context_length`; it does not report live requests/sessions.
- A per-request final response reports prompt/response token counts and evaluation durations; these may calculate tps **only for that request**.
- LM Studio's native v1 benchmark reports decode tokens/sec and first-token latency directly. Its
  response output is discarded, `store:false` prevents chat persistence, and absent prefill timing
  remains unavailable.
- No claim that the most recent model equals the model currently receiving tokens.
- Context utilisation is client-session-based; configured window is an upper bound, not the effective remaining user-token budget (system/tool overhead matters).

**Current rolling history**: `InMemoryMetricHistory` belongs to the application layer. Electron main
captures one isolated sample per enabled runtime every three seconds while the application process
is alive, including when the window is hidden in the tray. Samples older than one hour are evicted
and nothing is restored after quit or restart. Benchmark throughput is stored once as a sparse event
for its runtime, not repeated or transferred when selection changes.

**Owned-process sampling**: `@obpulse/process-metrics` is separate from host-wide metrics. On macOS
and Linux it invokes fixed `/bin/ps` flags. On Windows it invokes the system Windows PowerShell
executable without profiles or interaction and reads only .NET `Process` start time, cumulative
processor time and `WorkingSet64`. Both paths receive only the validated positive PID provided by
`RuntimePort.ownedProcessId()` and never use a shell or discover processes. Windows requires two
valid observations before deriving CPU; its first sample still exposes resident RAM. PID plus start
time guards the CPU baseline against PID reuse. `MonitorService` requests a sample only for an
enabled runtime that reports `managed-running` and supplies its owned PID. Process samples appear on
their runtime card/detail and are neither persisted nor misattributed to external services.

**Descendant attribution decision (5.3)**: do not aggregate descendants on macOS, Linux or Windows.
Recursively enumerating PPID/child-PID snapshots would add process discovery and still leave races
when a child exits, reparents or its PID is reused. Apple's process-list APIs expose PIDs, not a
durable ownership group ([process-list API family](https://developer.apple.com/documentation/endpointsecurity/es_proc_check_type_listpids)).
Linux cgroup v2 can scope resource accounting to a managed group, but Pulse does not currently create
and retain a delegated cgroup for each launched runtime ([kernel cgroup v2 documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html)).
Windows Job Objects provide group accounting when a process is assigned; the current Node spawn path
does not assign the runtime to a Job Object at creation ([Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)).
Adding these OS-specific containment mechanisms would change lifecycle and packaging boundaries and
is not justified for v1. Direct-child samples remain truthful and bounded; descendants and
model-level resource use remain unavailable.

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

**Runtime credentials**: LM Studio bearer authentication is write-only from the sandboxed renderer.
Electron main validates the token, encrypts it with asynchronous Electron `safeStorage`, and writes
only a versioned base64 ciphertext envelope with `0600` permissions under `userData`. macOS uses
Keychain and Windows uses DPAPI. Linux persistence is refused when the reported backend is
`basic_text` or `unknown`; there is no plaintext or preferences-file fallback. At startup the token
is decrypted directly into the LM Studio adapter, and IPC exposes only configured/storage/error
status plus replace/remove operations—never credential readback. Key rotation requests rewrite the
ciphertext atomically.

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
