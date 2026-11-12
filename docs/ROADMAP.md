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
- Versioned `1.0.0` adapter manifests and an expanded capability/permission view are implemented,
  with static support kept separate from dynamic control authority.
- A built-in observation-only llama.cpp adapter detects the official default loopback server and
  reports its loaded model. Lifecycle, model management, credentials and inference remain disabled.
- An opt-in observation-only MLX-LM adapter detects the official default loopback model catalog and
  keeps available-model semantics separate from loaded-model observations.
- LM Studio v1 model load/unload, session-owned loopback server start/stop and explicit
  session-scoped handover of a reachable pre-existing server are implemented for unprotected
  servers. Session-managed or delegated control can be explicitly released while leaving the
  server running. OS-protected bearer-token configuration is implemented without plaintext fallback
  or renderer readback. GUI/daemon process ownership, Ollama external-server handover,
  llama.cpp/MLX-LM management and broader managed-service attach policy remain pending.
- LM Studio has an explicit non-persistent native v1 benchmark for provider-reported decode speed,
  token counts and first-token latency; prefill speed remains unavailable rather than estimated.
- Direct-child CPU/RAM is implemented on Windows, macOS and Linux for an Ollama server started and
  owned by OB-Pulse. Windows CPU becomes available after its second valid observation; descendant
  aggregation, reliable GPU metrics and multi-device profiles remain pending.
- Widget customization is implemented with tray/corner positioning, safe opacity presets,
  accessible high-contrast mode and a tray/header shortcut to a dedicated settings surface. The
  expanded monitor is limited to model operations, resource history and KPIs. Programmatic
  positioning remains best-effort on Wayland, where the compositor may control placement.
- A multi-runtime control center observes every enabled adapter concurrently with bounded,
  failure-isolated polling. Runtime cards show truthful authority, models, owned-process metrics and
  safe manifest-driven actions; selection scopes per-runtime history and benchmarks.
- Host NVIDIA GPU utilization and VRAM use are read per device through a bounded `nvidia-smi`
  probe where available. Linux AMDGPU utilization and VRAM use are read through documented sysfs
  device counters. macOS GPU monitoring and per-model GPU attribution remain pending.
- Available host GPU utilization and used VRAM are included in the bounded, volatile one-hour
  history per device.

## 1.0 — public release

- Confirm official brand assets, trademark, release CI, signed/notarized installers,
  reproducible builds, security review, integration and regression tests on all OSes.
