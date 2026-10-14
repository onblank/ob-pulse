# Security & privacy

- No cloud/backend/login/telemetry. No background API calls beyond opted-in local runtime health polls.
- The renderer has zero access to Node, `fs`, environment variables, subprocesses or arbitrary URLs.
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, narrow IPC.
- Only fixed known loopback endpoints allowed in v0.1; no runtime URL field supplied from renderer.
- The Ollama binary is launched by `spawn(binary, ['serve'])` without a shell; never evaluate user strings.
- Server stop applies only to a tracked child PID that OB-Pulse itself created during this process lifetime.
- Loading/unloading models is a user-initiated action and must not delete local model files.
- No model pull/remove UI until a separate approval/security design and progress feedback exist.
- Keep metrics/content separation: never store user prompts, generated answers, tool arguments, full context,
  provider credentials or HTTP request/response bodies.
- Future proxy and external adapters require explicit local opt-in and threat modeling, especially for
  prompt redaction, credentials, local bind address, other process traffic and GDPR considerations.
- Repository CI tokens and package signing certificates are GitHub secrets, never checked into source.
- App icons/logos are bundled; never fetch remote runtime assets.
