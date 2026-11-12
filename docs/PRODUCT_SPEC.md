# OB-Pulse product specification — 0.1 to 1.0

## One-sentence proposition

See and control _your local AI runtimes and loaded models_ at a glance, with accurate metrics and
zero cloud dependency. Keep it out of the way until you need it.

## Intended audience

- Developers using Ollama, LM Studio, local OpenAI-compatible servers, IDE agents and Agent OS.
- Non-programmers using local AI: later native installers must not require development tooling.
- Privacy-conscious users who prefer a local observability dashboard.

## Navigation / surface

OB-Pulse has four surfaces: tray-only while hidden, a compact 360×430 gadget for daily monitoring
and control, an expanded 900×680 monitor for model operations and detailed readings, and a settings
surface rendered at the expanded size. The compact surface is fixed-size; expanded surfaces are
resizable. The window header provides pin, settings, expand/compact and hide controls. Opening
settings from the compact gadget expands the window first; compacting always returns to monitoring.

The compact gadget shows the runtime-safe power action, loaded model and one-hour RAM, reported GPU
residency and benchmark output-speed charts, plus total online-runtime and loaded-model counts. The
expanded monitor begins with a control-center card for every enabled runtime. Each card isolates
health, authority, model counts, owned-process readings and a manifest-authorized primary action;
selecting it scopes the detail panel below. The detail contains runtime/model controls, model
load/unload and benchmark actions, history and resource KPIs. Settings contains
appearance/position, runtime visibility, credentials, instrumentation controls/history and adapter
capability/permission detail. Widget settings persist a tray/corner position, one of four bounded
opacity levels and an accessible high-contrast mode. Window placement is best-effort on display
servers such as Wayland that reserve placement decisions for the compositor. Runtime settings can
hide or re-enable each built-in adapter while preserving at least one active choice; hiding an
adapter never stops its service or deletes model files.
A background/tray process is not a promise of monitoring when the **application quits**.

## Core acceptance tests for v1

### Runtime control

- Enable/disable a built-in runtime from a settings list while keeping at least one active adapter.
  Each adapter exposes versioned capability and permission metadata independently of live authority.
- Observe all enabled runtimes concurrently. A timeout or read failure in one adapter must remain on
  that card and must not hide healthy runtimes or block the dashboard indefinitely.
- Keep benchmark state and the volatile one-hour history attributed to their runtime across
  selection changes.
- Show `unavailable`, `external-running` or `managed-running` distinctly.
- Start a supported _managed_ runtime on demand with no shell injection.
- Stop only an OB-Pulse-owned process or an explicitly delegated provider server control, with
  confirmation before taking delegated control.
- Load/unload supported models from RAM without deleting downloaded model weights.
- External servers are observed, never generically killed. Handover appears only when an adapter
  proves a reviewed provider-native stop mechanism.
- LM Studio is managed at the local HTTP-server toggle only: Pulse may stop a toggle it enabled or
  one explicitly delegated for the current Pulse session. Delegation is released without stopping
  on exit; GUI/daemon lifecycle remains external.
- Release LM Studio control explicitly without stopping its server; the runtime immediately returns
  to external observation and will not be stopped when Pulse exits.
- Manager permissions and process ownership survive UI hide, not OS reboot.
- Show the selected adapter's contract version, supported actions, loopback scope, server-control
  boundary, credential mode and prohibited content/model/process actions in settings.
- Detect a llama.cpp server at its official default loopback address and show its reported loaded
  model without implying lifecycle, cache, load/unload or inference authority.
- Allow explicit opt-in observation of MLX-LM's default loopback catalog while keeping every model
  unloaded/unknown until a future provider signal proves residency.

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
- The current implementation attributes only the direct Ollama server child started by OB-Pulse on
  Windows, macOS or Linux. Windows CPU requires two valid observations. It must not imply descendant,
  loaded-model or external-service attribution.
- GPU load/VRAM percentages only where a platform-specific probe provides a trustworthy numerator and denominator.
- NVIDIA host GPU utilization and used/total VRAM come from `nvidia-smi` per device when present;
  unavailable devices show no reading. These are host-device values, not model attribution.
- Available host GPU utilization is graphed per device for the latest hour in process memory;
  model residency remains a separate chart with different semantics.
- Report provider-resident model bytes separately from VRAM utilization.
- Prefill/read and decode/write token/s from provider timing or opted-in client adapter;
  label as `last request`, `rolling average`, `benchmark` or `unavailable` explicitly.
- Resets and model switches never transfer one session's telemetry to another.

### Storage and controls

- A rolling one-hour numeric history lives in process memory and disappears on quit/restart.
- Widget appearance preferences are machine-local, contain no telemetry and are independent from
  the volatile metric history.
- Enabled runtime identifiers are machine-local preferences; they contain no endpoint, credential
  or runtime observation data.
- A user may configure an LM Studio API token. It is encrypted by an acceptable operating-system
  credential backend, never persisted in plaintext or returned to the renderer, and can be replaced
  or removed explicitly. If protected storage is unavailable, persistence is disabled.
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
