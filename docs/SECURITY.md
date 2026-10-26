# Security & privacy

- No cloud/backend/login/telemetry. No background API calls beyond opted-in local runtime health polls.
- The renderer has zero access to Node, `fs`, environment variables, subprocesses or arbitrary URLs.
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, narrow IPC.
- Runtime endpoints remain fixed loopback addresses; no runtime URL field is supplied from the renderer.
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
- The Ollama binary is launched by `spawn(binary, ['serve'])` without a shell; never evaluate user strings.
- Server stop applies only to a tracked child PID that OB-Pulse itself created during this process lifetime.
- Process metrics use only that tracked direct child PID, only while its adapter reports
  `managed-running`. The macOS/Linux probe executes fixed `/bin/ps` arguments without a shell and
  never discovers or attaches to processes by name, port or service. PIDs and samples are not persisted.
- Loading/unloading models is a user-initiated action and must not delete local model files.
- No model pull/remove UI until a separate approval/security design and progress feedback exist.
- Keep metrics/content separation: never store user prompts, generated answers, tool arguments, full context,
  provider credentials or HTTP request/response bodies.
- A future proxy or broader external adapter still requires separate opt-in and threat modeling,
  especially for prompt redaction, credentials, other-process traffic and GDPR considerations.
- Repository CI tokens and package signing certificates are GitHub secrets, never checked into source.
- App icons/logos are bundled; never fetch remote runtime assets.
