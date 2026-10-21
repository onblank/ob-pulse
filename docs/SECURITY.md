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
- Renderer clipboard access is not generic: narrow IPC may copy only the active bridge endpoint or
  token after an explicit user click.
- The Ollama binary is launched by `spawn(binary, ['serve'])` without a shell; never evaluate user strings.
- Server stop applies only to a tracked child PID that OB-Pulse itself created during this process lifetime.
- Loading/unloading models is a user-initiated action and must not delete local model files.
- No model pull/remove UI until a separate approval/security design and progress feedback exist.
- Keep metrics/content separation: never store user prompts, generated answers, tool arguments, full context,
  provider credentials or HTTP request/response bodies.
- A future proxy or broader external adapter still requires separate opt-in and threat modeling,
  especially for prompt redaction, credentials, other-process traffic and GDPR considerations.
- Repository CI tokens and package signing certificates are GitHub secrets, never checked into source.
- App icons/logos are bundled; never fetch remote runtime assets.
