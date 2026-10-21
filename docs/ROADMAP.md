# Roadmap

## 0.1 — initial scaffold (in this archive)

- Runtime contracts, Ollama adapter, read-only LM Studio detection, host metrics, tray widget,
  manually started Ollama server control and explicit speed test.
- Tray-only, compact gadget and expanded dashboard surfaces with a volatile one-hour numeric history.

## 0.2 — trustworthy history and instrumentation

- Evaluate opt-in SQLite history only if users need persistence beyond the current one-hour in-memory
  window; require retention/off controls and metrics-only import/export.
- Typed opt-in Agent OS/Hermes client instrumentation (`session_started`, `request_completed`,
  `context_compacted`, `session_ended`). Never intercept credentials or content.
- Accurate session-specific context, overflow alert, per-request timeseries and first-token latency.

## 0.3 — deeper OS/runtime integrations

- LM Studio v1 management; llama.cpp/MLX adapters; managed service state and attach policy.
- Runtime PID CPU/RAM, reliable GPU metrics per platform where supported, multi-device profiles.
- Widget customization (corner/dock/opacity), tray menu and accessible high-contrast mode.

## 1.0 — public release

- Confirm official brand assets, trademark, release CI, signed/notarized installers,
  reproducible builds, security review, integration and regression tests on all OSes.
