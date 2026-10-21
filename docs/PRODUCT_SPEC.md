# OB-Pulse product specification — 0.1 to 1.0

## One-sentence proposition

See and control _your local AI runtimes and loaded models_ at a glance, with accurate metrics and
zero cloud dependency. Keep it out of the way until you need it.

## Intended audience

- Developers using Ollama, LM Studio, local OpenAI-compatible servers, IDE agents and Agent OS.
- Non-programmers using local AI: later native installers must not require development tooling.
- Privacy-conscious users who prefer a local observability dashboard.

## Navigation / surface

OB-Pulse has three surfaces: tray-only while hidden, a compact 360×430 gadget for daily monitoring
and control, and an expanded 900×680 dashboard for model selection and detailed readings. The
compact surface is fixed-size; the expanded surface is resizable. Both provide a manual
pin/always-on-top control, and closing the window hides it in the tray.

The compact gadget shows the runtime-safe power action, loaded model and one-hour RAM, reported GPU
residency and benchmark output-speed charts. The expanded dashboard adds runtime/model controls and
the detailed host and benchmark readings. Accessible settings and further customization remain
later deliverables.
A background/tray process is not a promise of monitoring when the **application quits**.

## Core acceptance tests for v1

### Runtime control

- Add/disable a built-in runtime from a settings list; versioned capability and permissions metadata.
- Show `unavailable`, `external-running` or `managed-running` distinctly.
- Start a supported _managed_ runtime on demand with no shell injection.
- Stop only an OB-Pulse-owned process, with confirmation if inference is running.
- Load/unload supported models from RAM without deleting downloaded model weights.
- External servers are observed, not killed. Explicit management handover must be designed separately.
- Manager permissions and process ownership survive UI hide, not OS reboot.

### Models and sessions

- Model identity is `runtime ID` + provider model key + instance ID where supplied.
- Distinguish installed, loaded and recently observed inference model; do not call loaded model "active inference".
- A session-based context bar shows `used / capacity` and percentage ONLY if a client has reported use.
- New _client conversation_ starts at `0 / capacity` from explicit start event.
- Compaction sets a new epoch: reported compacted prefix usage if known, else `—` until measured.
- A new widget window does not reset an existing agent conversation's context.

### Resource & speed semantics

- Host CPU and host RAM in absolute and percentage terms (RAM: used/total; CPU: utilization of logical host).
- Process-specific CPU/RAM only where the OS probe can attribute the process; otherwise `—`.
- GPU load/VRAM percentages only where a platform-specific probe provides a trustworthy numerator and denominator.
- Report provider-resident model bytes separately from VRAM utilization.
- Prefill/read and decode/write token/s from provider timing or opted-in client adapter;
  label as `last request`, `rolling average`, `benchmark` or `unavailable` explicitly.
- Resets and model switches never transfer one session's telemetry to another.

### Storage and controls

- A rolling one-hour numeric history lives in process memory and disappears on quit/restart.
- Opt-in client request history uses the same volatile boundary, has a 7,200-sample hard cap and is
  cleared immediately when its loopback bridge is disabled.
- Any future SQLite sample history is opt-in, bounded by retention and contains no inference content.
- No remote account, onBlank telemetry, cloud sync or access to Central/Gateway.
- No prompts, completions or tool arguments in sample data.
- Never bind monitoring bridge to a public IP or unspecified interface.
- Client instrumentation stays disabled at launch and requires an ephemeral bearer token per activation.

### Release

- Windows `.exe`, macOS `.dmg` universal, Linux `.AppImage`/`.deb`.
- Windows signing and macOS Developer ID signing/notarization before official release where applicable.
- SHA-256 sums and checksums linked with GitHub Releases; later official corporate site may mirror.
- Install, upgrade, quit, tray, permissions and no-network-required smoke tests on each OS.

## Non-goals

OB-Pulse is **not** Agent OS, Hermes, an inference server, a model hosting platform, a prompt logger,
a Gateway alternative, a remote fleet control panel or an MCP tool provider with unrestricted execution.
It may consume _numeric instrumentation_ from agents, but must not own their execution policies.
