# Roadmap

## 0.1 — initial scaffold (in this archive)

- Runtime contracts, Ollama adapter, read-only LM Studio detection, host metrics, tray widget,
  manually started Ollama server control and explicit speed test.
- Tray-only, compact gadget and expanded dashboard surfaces with a volatile one-hour numeric history.

## 0.2 — trustworthy history and instrumentation

- Evaluate opt-in SQLite history only if users need persistence beyond the current one-hour in-memory
  window; require retention/off controls and metrics-only import/export.
- Typed opt-in client instrumentation (`session.started`, `request.completed`,
  `context.compacted`, `session.ended`) over an authenticated loopback bridge. Implemented without
  credentials or inference content.
- Accurate latest-session context, warning/overflow state, measured prefill/decode speed and
  first-token latency are implemented. Per-request context, prefill/decode speed and first-token
  latency now have a volatile one-hour timeseries with a hard sample bound and multi-session view.

## 0.3 — deeper OS/runtime integrations

- Built-in runtime visibility settings are implemented with validated local persistence, a
  mandatory active adapter and safe selection fallback. Disabling an adapter does not stop its
  service or remove models.
- LM Studio v1 model load/unload is implemented for unprotected loopback servers. LM Studio server
  lifecycle/authentication, llama.cpp/MLX adapters and managed service attach policy remain pending.
- LM Studio has an explicit non-persistent native v1 benchmark for provider-reported decode speed,
  token counts and first-token latency; prefill speed remains unavailable rather than estimated.
- Direct-child CPU/RAM is implemented on Windows, macOS and Linux for an Ollama server started and
  owned by OB-Pulse. Windows CPU becomes available after its second valid observation; descendant
  aggregation, reliable GPU metrics and multi-device profiles remain pending.
- Widget customization is implemented with tray/corner positioning, safe opacity presets,
  accessible high-contrast mode and a tray shortcut to settings. Programmatic positioning remains
  best-effort on Wayland, where the compositor may control placement.

## 1.0 — public release

- Confirm official brand assets, trademark, release CI, signed/notarized installers,
  reproducible builds, security review, integration and regression tests on all OSes.
