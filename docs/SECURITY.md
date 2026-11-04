# Security & privacy

- No cloud/backend/login/telemetry. No background API calls beyond opted-in local runtime health polls.
- The renderer has zero access to Node, `fs`, environment variables, subprocesses or arbitrary URLs.
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, narrow IPC.
- Runtime endpoints remain fixed loopback addresses; no runtime URL field is supplied from the renderer.
  The llama.cpp observer is fixed to `127.0.0.1:9931` and performs only health/model-list reads.
- The optional instrumentation listener is disabled by default, binds only to `127.0.0.1` on an
  ephemeral port and requires a fresh 256-bit bearer token. It enforces a strict v1 numeric schema,
  16 KiB bodies, a rolling request limit and bounded replay suppression. Disable/quit closes it.
- Instrumentation session state and numeric request samples exist only while the bridge is enabled;
  disabling it clears them. The request history is additionally capped at one hour and 7,200
  samples and is never persisted.
- Explicit LM Studio benchmarks use a fixed synthetic prompt with `store:false`; response content is
  neither logged nor retained, and only numeric provider stats enter the in-memory dashboard.
- Renderer clipboard access is not generic: narrow IPC may copy only the active bridge endpoint or
  token after an explicit user click.
- Widget settings cross narrow typed IPC, are validated again in Electron main and are written
  atomically to a machine-local preferences file. Opacity accepts only safe presets from 75–100%.
- Runtime visibility settings accept only registered built-in IDs, reject duplicates and never
  permit disabling every adapter. Changing visibility cannot start, stop or delete runtime assets.
- Versioned adapter manifests describe static support and invariant permission boundaries only.
  They cannot grant live authority; process ownership or explicit provider delegation is still
  required at execution time. The current schema cannot represent external-process termination,
  model-file deletion or inference-content access as allowed.
- Observation-only manifest scope `none` disables server control even when llama.cpp is reachable.
  The adapter has no CLI, process discovery, filesystem scan, credential field or inference request.
- LM Studio API tokens cross one write-only IPC method, are bounded/validated in Electron main and
  are encrypted with asynchronous `safeStorage`. Disk contains only a versioned ciphertext envelope
  written atomically with `0600` mode. The renderer can query only configured/storage/error status.
  Pulse refuses Linux `basic_text`/`unknown` and any unavailable encryption backend; it has no
  plaintext fallback. Removing a token deletes the encrypted envelope and clears adapter memory.
- The Ollama binary is launched by `spawn(binary, ['serve'])` without a shell; never evaluate user strings.
- Ollama server stop applies only to a tracked child PID that OB-Pulse itself created during this process lifetime.
- LM Studio server start/stop uses the resolved `~/.lmstudio/bin/lms` executable, fixed arguments,
  loopback port/bind and no shell. Pulse stops only a server toggle it enabled or a reachable toggle
  the user explicitly delegated for the current session. Delegated control is released without a
  stop on app exit; Pulse never runs `daemon down`, closes the GUI, claims ownership of its PID or
  discovers/kills it by process name or port.
- Explicit LM Studio control release changes only in-memory authority. It does not invoke the CLI,
  stop the server or persist permission beyond the current Pulse process.
- Process metrics use only that tracked direct child PID, only while its adapter reports
  `managed-running`. The macOS/Linux probe executes fixed `/bin/ps` arguments; the Windows probe
  executes the system Windows PowerShell without profiles or interaction and reads only the process
  identified by the validated numeric environment value. Neither path uses a shell, discovers by
  name/port/service or persists PIDs/samples. Windows also verifies process start time before reusing
  a cumulative CPU baseline.
- Loading/unloading models is a user-initiated action and must not delete local model files.
- No model pull/remove UI until a separate approval/security design and progress feedback exist.
- Keep metrics/content separation: never store user prompts, generated answers, tool arguments, full
  context, plaintext provider credentials or HTTP request/response bodies. The sole credential
  exception is the user-approved OS-encrypted LM Studio loopback token described above.
- A future proxy or broader external adapter still requires separate opt-in and threat modeling,
  especially for prompt redaction, credentials, other-process traffic and GDPR considerations.
- Repository CI tokens and package signing certificates are GitHub secrets, never checked into source.
- App icons/logos are bundled; never fetch remote runtime assets.
