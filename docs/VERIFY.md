# Verification report

Current local verification as of 2026-11-13:

- `pnpm install` completed with the pinned pnpm 12.6.0 workspace.
- Formatting, ESLint, TypeScript checks for all twelve packages, 78 tests and
  the Electron main/preload/renderer production builds.
- Instrumentation tests open an ephemeral IPv4 loopback port and cover bearer authentication,
  schema/content rejection, request limiting, replay/session semantics, context compaction,
  throughput calculations and warning/overflow state.
- LM Studio adapter tests cover v1 model parsing, fixed CLI lifecycle commands, session-owned,
  delegated and observer server behavior, delegation release without shutdown, native load/unload
  requests, ambiguous-instance refusal and a
  non-persistent benchmark that keeps only numeric stats. A local LM Studio 0.4.26 smoke test started
  and stopped the server, detected six installed linked models and loaded no model.
- Widget preference tests cover strict value validation, safe corrupt/missing-file fallback,
  atomic persistence and work-area-clamped tray/corner placement.
- Panel-navigation tests cover compact-to-settings expansion, settings-to-monitor return and the
  invariant that compacting always closes settings.
- Runtime preference and application tests cover non-empty/unique registered adapter validation,
  filtered discovery, disabled-selection/command rejection, deterministic selection fallback,
  concurrent multi-runtime snapshots, failure/timeout isolation, in-flight poll sharing,
  runtime-scoped benchmarks/history and manifest propagation without duplicating capability state.
- Renderer control-center tests prove that primary actions follow state/capabilities, prefer safe
  release over shutdown and remain absent for observation-only runtimes.
- Provider tests lock manifest contract version, loopback scope, server-control boundary, credential
  mode and prohibited process/model/content permissions for Ollama, LM Studio and llama.cpp.
- llama.cpp adapter tests cover the fixed official loopback endpoint, ready/loading/absent states,
  strict loaded-model parsing, unavailable metrics and refusal of every lifecycle, model-management
  and benchmark operation.
- MLX-LM adapter tests cover its opt-in fixed loopback endpoint, strict available-model parsing,
  the distinction between available and loaded models, absent/malformed server responses and
  refusal of every lifecycle, model-management and benchmark operation. The shared OpenAI-compatible
  parser tests preserve the same strict payload and identifier validation for MLX-LM and llama.cpp.
- Credential tests cover strict token validation, absent secure-storage refusal, encrypted-only
  atomic persistence, malformed-envelope rejection, deletion and re-encryption after key rotation.
  LM Studio adapter tests verify bearer headers and secret-free rejection errors.
- Owned-process tests cover strict `ps` and Windows reading parsing, Windows CPU delta and PID-reuse
  semantics, a live self-PID probe on macOS/Linux, absent Ollama ownership and the application rule
  that only a managed runtime with an owned PID receives a process sample. A dedicated
  `windows-latest` CI job runs the same live self-PID probe and package typecheck natively.
- Iteration 5.3 keeps process metrics scoped to the one PID Pulse launched on every platform. The
  self-PID probe is exercised on macOS locally and on Ubuntu/Windows CI; parsing rejects multiple
  process rows. Descendant aggregation is intentionally unsupported: macOS/Linux parent-PID
  snapshots are not durable ownership, Linux cgroups would require a new managed containment path,
  and Windows Job Objects are not assigned by the current spawn path. Runtime helper/model processes
  may therefore be absent from displayed CPU/RAM; no descendant values are inferred.
- The macOS development app launches with the four statically registered adapters; its compact,
  multi-runtime monitor and dedicated settings surfaces build successfully.
- Manual macOS end-to-end smoke confirmed the tray, compact runtime selector and power action,
  expanded runtime cards/model operations, settings and return paths work with no observed defects.
  Confirmation recorded from the maintainer on 2026-11-12. Native startup and window/tray lifecycle
  smoke on Windows and Linux is covered by iteration 6.1; full manual control-flow journeys remain
  unverified on those platforms.
- The instrumentation integration smoke sends authenticated loopback session/request/compaction
  events through the HTTP bridge into the session store; checks context reset, measured tps/TTFT,
  content rejection and clearing on disable. 11 related tests pass. This macOS host has no
  `nvidia-smi` and no Linux AMDGPU sysfs, so no host GPU sample is expected; probe parser and
  unavailable readings remain covered by tests.
- Iteration 5.4 evaluated macOS GPU feasibility on macOS 26.5.2 arm64 / Apple M5 (10-core GPU).
  `powermetrics -n 1 -i 1000 -s gpu_power` returned “must be invoked as the superuser”; its local
  help/man page describes estimated subsystem power, not GPU utilization or VRAM. Unprivileged
  `ioreg -r -d 1 -c IOAccelerator` exposed AGX `PerformanceStatistics` (`Device Utilization %`,
  allocation/in-use system-memory fields), but these driver fields are undocumented and the memory
  values do not provide dedicated VRAM capacity. Apple documents Metal performance counters for
  measured passes/commands in an app GPU trace, not system-wide utilization ([counter statistics](https://developer.apple.com/documentation/xcode/analyzing-apple-gpu-performance-using-counter-statistics)).
  No source met Pulse's stability and metric-semantics criteria; macOS host GPU readings stay
  unavailable. No privileged command or GPU workload was run.
- Iteration 5.5 closes the assembled safety/regression gate. Added regression coverage for disabled
  adapter commands reaching no disabled provider, default host-history one-hour and total-sample
  bounds, default instrumentation one-hour/7,200-request retention, and visible keyboard focus styles
  for buttons, selectors and inputs. Existing tests cover LM Studio authority transitions, malformed
  responses, OS credential-storage refusal, bridge bearer authentication/content rejection, adapter
  failure isolation and panel navigation. `pnpm check` passes: 90 tests across 18 files, all 12
  package typechecks, ESLint, formatting and Electron production builds. GitHub CI provides full
  validation on Ubuntu and native owned-process probing on Windows. The app's macOS navigation smoke
  was confirmed by the maintainer on 2026-11-12; native Windows/Linux GUI and installer smoke remains
  native Windows/Linux UI-control journeys remain unverified; the package lifecycle smoke is now
  recorded in iteration 6.1.
- Iteration 6.1 passed on native GitHub Actions runners with unsigned Windows NSIS `.exe`, universal
  macOS `.dmg`, and Linux `.AppImage`/`.deb` builds. Each platform installed/launched a same-source
  `0.0.1` baseline, checked renderer readiness, four-runtime discovery and close-to-tray behavior,
  then ran the current build and verified local user-data continuity. Linux launched both AppImage
  builds and installed/upgraded the DEB. All three jobs passed in [workflow run #43458682550](https://github.com/onblank/ob-pulse/actions/runs/43458682550).
  GitHub retains the current artifacts for seven days: `native-smoke-Windows` (224 MB),
  `native-smoke-macOS` (456 MB) and `native-smoke-Linux` (451 MB). The baseline packages are used
  for tests and are not retained. This smoke checks packaged startup and tray/window lifecycle; it
  does not replace manual interaction checks for each platform.

Still required before an official release:

- Manual end-to-end client instrumentation smoke testing through the packaged desktop UI.
- Signing/notarization, official brand review and installer checksum verification.
