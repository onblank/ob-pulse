# Verification report

Current local verification as of 2026-11-16:

- Iteration 2.5 ownership follow-up: full `vitest run` passes 94 tests locally. The new process-control
  probe terminates an adopted child process while preserving a parallel process with the same
  marker. CI now runs that probe on macOS, Linux and Windows; native package/install/tray smoke also
  passes on all three. Real macOS LM Studio passed Start→Take control→Release→Take control→Stop
  and Start→shutdownOwned. Real Ollama passed Start→Release→Take control→Stop and
  Start→shutdownOwned. Both servers were unreachable after Stop/quit cleanup and process checks
  found no residual owned engine processes. Real GUI journeys on Windows/Linux remain open in 5.7.

## Phase 5.7 — Cross-platform runtime journeys

Status checked 2026-11-16. The available host is macOS 26.5.2 (build 25F84, arm64). Installed
providers are LM Studio 0.4.26+4 (CLI commit `dcefd5a`) and Ollama client 0.40.5. At this check,
neither provider server was running: `127.0.0.1:1234/api/v1/models` and
`127.0.0.1:11434/api/version` refused connections. This is an environment inventory, not a new
control-flow result.

The real macOS LM Studio and Ollama ownership journeys were exercised on 2026-11-15 and are recorded
above under iteration 2.5. The assembled macOS UI journey (tray, compact selector, expanded runtime
cards/model controls, settings and return paths) was maintainer-confirmed on 2026-11-12. The current
native package CI verifies install/upgrade, launch and tray/window behavior on Windows, Linux and
macOS, while the process-control probe verifies owned-tree termination and parallel-process
preservation on all three operating systems. This branch adds a native packaged-app control journey
to that matrix using isolated in-memory runtime fixtures. It drives runtime controls, model
load/unload, runtime visibility, settings navigation and the authenticated instrumentation bridge.
Because the providers are simulated, this covers Electron UI/IPC and OS window/tray behavior but does
not validate provider-specific Windows/Linux integration.

**5.7 remains open.** The maintainer has access to Windows but not Linux. Neither platform's
real-provider runtime-control journey has been performed yet, and the new native control journey is
pending CI on this branch. Do not use package startup or macOS evidence to infer that either
platform's provider integration passed. The native fixture journey passed on Windows, Linux and
macOS in [workflow run #43920026730](https://github.com/onblank/ob-pulse/actions/runs/43920026730).
It drives the packaged UI/IPC and instrumentation paths with simulated providers; it does not
exercise the actual LM Studio/Ollama services, CLIs or models on Windows/Linux. The maintainer has
no Windows providers or models installed; the real Windows journey requires installing Ollama and
LM Studio and at least one local test model for each. Linux uses the native automated fixture
journey plus the real process-tree probe, with its provider-specific limits recorded. Record
OS/build/architecture, Pulse commit, engine versions, test model identifiers, date, each observed
result and any error text. Do not record prompts, completions, API tokens or other inference content.

Local verification for this branch: 3 fixture tests pass; the full Vitest suite passes 97 tests in
20 files; desktop typecheck and main/preload/renderer production builds pass; changed-file ESLint,
Prettier and diff checks pass. The full Turborepo typecheck did not complete locally. GitHub
`pnpm check` passes in [workflow run #43920026708](https://github.com/onblank/ob-pulse/actions/runs/43920026708),
and native package/install/control-journey smoke passes on all three OSes in
[workflow run #43920026730](https://github.com/onblank/ob-pulse/actions/runs/43920026730).

Run this acceptance sequence on Windows and, if using a Linux host, on Linux for each installed
provider:

1. Start Pulse with the provider service stopped. Confirm the selected runtime is observable and
   that settings can enable/disable runtime visibility; a disabled runtime must not receive actions.
2. Start the provider from Pulse. Confirm the server becomes reachable, its state changes to
   managed, installed/loaded model data is displayed, and host/runtime values show unavailable when
   the provider or OS cannot measure them.
3. Load then unload an already-installed small test model. Confirm it appears/disappears from the
   loaded list and remains installed; do not trigger model download or file deletion.
4. Stop the managed provider from Pulse. Confirm its server and Pulse-owned process tree exit.
   Repeat with the app quit action and confirm owned services are cleaned up.
5. Start a provider independently, then launch Pulse. Confirm it is shown as external and Stop does
   not close it. Where Take control is offered, take control then Release; confirm the provider stays
   reachable after Release and after Pulse quits. Retake control and Stop, then verify only the
   uniquely adopted provider process tree exits; an unrelated parallel instance stays running.
6. In Settings, enable the instrumentation bridge explicitly. Verify its status is loopback-only,
   submit a content-free test event through the
   [instrumentation contract](INSTRUMENTATION_CONTRACT.md), and confirm numeric session data appears.
   Verify a content-bearing event is rejected and disabling the bridge clears the session data.
7. Verify compact-to-expanded, the settings surface and return-to-monitor paths, plus tray hide,
   reopen and quit behavior. Record any platform-specific differences instead of assuming parity.

**Required evidence before closing 5.7:** native packaged-app control journeys pass on all three
OSes (now recorded above); the maintainer completes a real Windows LM Studio/Ollama control and model
load/unload journey after installing both providers and local models; settings, instrumentation and
tray/window results pass on Windows; or the owner approves a decision that narrows supported
platform claims. Add dated results here and resolve A4 in `ROADMAP.md`.

- `pnpm install` completed with the pinned pnpm 12.6.0 workspace.
- Previous full-suite baseline: formatting, ESLint, TypeScript checks for all packages, 78 tests and
  Electron main/preload/renderer production builds passed before the runtime takeover change.
- Tray and ownership changes: macOS `pnpm dev` startup completed without the tray icon initialization
  error. TypeScript, ESLint and formatting checks passed; the Electron production bundles passed in
  CI. Iteration 2.5 process-tree and real-engine validation is recorded above.
- Instrumentation tests open an ephemeral IPv4 loopback port and cover bearer authentication,
  schema/content rejection, request limiting, replay/session semantics, context compaction,
  throughput calculations and warning/overflow state.
- LM Studio adapter tests cover v1 model parsing, fixed CLI lifecycle commands, session-owned,
  adopted-process and observer server behavior, release without shutdown, native load/unload
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
  was confirmed by the maintainer on 2026-11-12; native Windows/Linux install/upgrade and basic
  window/tray smoke is recorded in iteration 6.1 and the packaged UI/IPC control-journey fixture
  now passes natively; actual provider-service/model integration remains unverified on Windows/Linux.
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
