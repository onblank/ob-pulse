# OB-Pulse — Development Roadmap

> Canonical phase and iteration plan. Agents update this file with each implementation PR.
> `docs/PRODUCT_SPEC.md` defines product behavior; `docs/ARCHITECTURE.md` and `docs/METRICS.md`
> define technical boundaries. Checkboxes describe validated state, not merely code that exists.

**Roadmap version:** 2026-11-12

**Last completed iteration:** 4.5 — Compact runtime selection ([PR #72](https://github.com/onblank/ob-pulse/pull/72), [promotion #73](https://github.com/onblank/ob-pulse/pull/73))

**Next planned iteration:** 5.1 — End-to-end desktop journeys

## Objective

OB-Pulse is a small, local-first desktop companion for observing and safely controlling local AI
runtimes. The compact gadget answers which runtime is selected, whether its server can be controlled,
which models are loaded, and what host resources and measured output speed have done in the last
hour. The expanded monitor supports runtime/model operations, per-runtime detail and resource
history. Settings holds configuration, permissions, credentials and instrumentation.

The v1 target works without an account, cloud service or database. It distinguishes observed from
managed runtimes, loaded from available models, device metrics from model metrics, and explicit
benchmark/client measurements from unknown traffic. Missing values remain unavailable. Pulse does
not capture inference content or stop external processes by PID, name or port.

The plan prioritizes a reliable daily experience for Ollama and LM Studio, truthful observation
for other supported runtimes, bounded one-hour history and installable desktop builds. Additional
management requires a proven provider control plane. Persistent history, remote monitoring,
automatic inference interception and product/Gateway integration are outside v1.

## How agents use this roadmap

- `[x]` means acceptance criteria and relevant checks passed and the implementation PR merged into
  protected `dev`. `[ ]` means open. Existing partial code is not closure. Every iteration is then
  promoted to `main` by a separate PR before starting the next one.
- A phase is `[x]` only when all required iterations and its exit criteria are complete. Feasibility
  work may close with a documented unsupported decision when a safe or truthful implementation is
  unavailable. Deferred items never block a phase unless explicitly promoted into scope.
- Unless the user chooses another item, take the first unchecked iteration whose dependencies are
  met. Create a task branch from current `dev`; use a PR into `dev` and a separate promotion PR to
  `main` as required by `AGENTS.md` and `docs/GIT_WORKFLOW.md`.
- In each implementation PR, propose the `[x]` checkbox, add its PR link and short verification
  result, and update **Last completed** and **Next planned**. The checkbox becomes authoritative
  when that PR merges into `dev`; the separate promotion PR carries the same file to `main`.
  Record the promotion link in the PR description; add it to this file when the roadmap is next
  edited. Do not start another iteration until promotion passes. Do not duplicate completed work.
- If discovery changes scope or order, explain it in the PR and update dependencies. A manifest,
  UI placeholder or plan alone is never evidence of a shipped capability.

**Iteration done:** behavior and failure path work at the real boundary; contracts, UI and docs
agree; authority, privacy and metric semantics hold; targeted tests and `pnpm check` pass; manual
smoke evidence is recorded where relevant; the implementation PR passes and merges into `dev`, then
the promotion PR passes and merges into `main`. A docs-only iteration needs
reviewable evidence, not code tests. If a required check cannot run, keep the item open.

**Phase done:** required iterations are complete, combined behavior has been exercised and no known
issue contradicts the phase goal. Owner action is required for signing credentials, final brand
approval and public release.

| Phase | Outcome                                      | Status                           |
| ----- | -------------------------------------------- | -------------------------------- |
| 1     | Local-first foundation and desktop shell     | Complete                         |
| 2     | Safe runtime and model control               | Complete for v1 scope            |
| 3     | Truthful telemetry and one-hour history      | Complete for implemented sources |
| 4     | Compact, expanded and settings surfaces      | Complete in code                 |
| 5     | End-to-end validation and platform decisions | Next                             |
| 6     | Native distribution and public v1            | Planned                          |

## [x] Phase 1 — Foundation and desktop shell

**Goal:** an offline desktop app with narrow runtime boundaries.

- [x] **1.1 — Repository and contracts.** pnpm/Turborepo packages, Electron sandbox/preload,
      typed runtime/host ports, local-first policy and CI. Evidence: repository structure and `AGENTS.md`.
- [x] **1.2 — Tray and window lifecycle.** Tray-only, compact and expanded surfaces, hide-to-tray,
      optional always-on-top; no automatic runtime start or benchmark on boot. Evidence:
      `apps/desktop/src/main` and `docs/PRODUCT_SPEC.md`.
- [x] **1.3 — Volatile history foundation.** Per-runtime one-hour in-memory samples, sample cap,
      no persistence across quit. Evidence: `packages/application/src/index.ts` and monitor tests.

**Exit:** app starts locally, renderer has no generic OS/HTTP/process access and history disappears
on quit. Native packaged-app smoke remains in phase 5.

## [x] Phase 2 — Safe runtime and model control

**Goal:** observe enabled runtimes together and offer only authorized actions.

- [x] **2.1 — Ollama managed lifecycle and models.** Detect/list, start/stop only the Pulse-owned
      child, explicit load/unload and benchmark. External Ollama remains observation-only.
- [x] **2.2 — LM Studio server and models.** Session-owned server toggle, explicit delegated
      handover/release, native load/unload and benchmark, OS-protected local API token. GUI/daemon
      ownership remains unsupported. Evidence: adapter tests and `docs/ARCHITECTURE.md`.
- [x] **2.3 — Read-only additional runtimes.** llama.cpp observer and opt-in MLX-LM catalog
      observer, without implied authority. Evidence: [PR #49](https://github.com/onblank/ob-pulse/pull/49),
      [PR #52](https://github.com/onblank/ob-pulse/pull/52).
- [x] **2.4 — Capability and control center.** Versioned manifests, enabled-runtime settings,
      concurrent bounded failure-isolated polling, runtime-scoped actions and history. Evidence:
      [PR #43](https://github.com/onblank/ob-pulse/pull/43), [PR #61](https://github.com/onblank/ob-pulse/pull/61).

**Exit:** external servers cannot be generically killed; unsupported actions stay disabled; one
adapter failure does not erase healthy cards. Current adapters and CI meet this v1 scope.

## [x] Phase 3 — Truthful telemetry and one-hour history

**Goal:** show provenance and availability for host, runtime and explicit client measurements.

- [x] **3.1 — Host/process baseline.** Host CPU/RAM and direct-child Ollama CPU/RAM on
      Windows/macOS/Linux where attributable. External and descendant process use remains unknown.
- [x] **3.2 — Session/request instrumentation.** Opt-in authenticated content-free loopback bridge;
      session/context/compaction semantics; measured prefill, decode and first-token data with bounded
      one-hour numeric history. Evidence: `docs/METRICS.md` and bridge tests.
- [x] **3.3 — Host GPU probes.** NVIDIA and Linux AMD per-device utilization and VRAM with unknown
      values when unavailable. Evidence: [PR #64](https://github.com/onblank/ob-pulse/pull/64),
      [PR #66](https://github.com/onblank/ob-pulse/pull/66).
- [x] **3.4 — GPU history and gaps.** One-hour utilization and used-VRAM curves, separate from
      provider-reported model residency; recent curves persist during probe loss with live readings
      marked unavailable. Evidence: [PR #67](https://github.com/onblank/ob-pulse/pull/67),
      [PR #69](https://github.com/onblank/ob-pulse/pull/69), [PR #70](https://github.com/onblank/ob-pulse/pull/70).

**Exit:** measured zero and unavailable are distinct; benchmark points are labeled; no inference
content is retained. Manual bridge and hardware smoke remains in phase 5.

## [x] Phase 4 — Daily-use desktop surfaces

**Goal:** a small default widget with detailed operations and configuration in separate places.

- [x] **4.1 — Widget appearance.** Tray/corner position, opacity presets and high-contrast mode.
- [x] **4.2 — Dedicated settings.** Gear/header/tray entry, expansion from compact, runtime
      visibility, credentials, instrumentation and capability details. Evidence:
      [PR #58](https://github.com/onblank/ob-pulse/pull/58).
- [x] **4.3 — Expanded monitor.** Runtime cards, model operations, resource KPIs and one-hour
      charts without settings clutter. Evidence: [PR #61](https://github.com/onblank/ob-pulse/pull/61).
- [x] **4.4 — Corporate asset.** Owner-provided onBlank mark bundled locally; Pulse product mark
      remains provisional. Evidence: [PR #55](https://github.com/onblank/ob-pulse/pull/55).
- [x] **4.5 — Compact runtime selection.** Enabled-runtime selector beside the safe power action;
      redundant expanded power toolbar removed. Evidence: [PR #72](https://github.com/onblank/ob-pulse/pull/72),
      [promotion #73](https://github.com/onblank/ob-pulse/pull/73).

**Exit:** compact mode selects the runtime whose model/history it shows; expanded cards own server
actions; settings has its own surface. Manual visual/interaction smoke remains in 5.1.

## [ ] Phase 5 — End-to-end validation and platform decisions

**Goal:** prove assembled behavior on real systems and make unsupported metrics explicit.

- [ ] **5.1 — End-to-end desktop journeys.** On macOS exercise tray, compact selector, power,
      expanded cards/model operations, settings and return paths with Ollama/LM Studio. On Windows and
      Linux exercise equivalent flows in a real target or native CI. Depends on phases 1–4. Closure:
      actual behavior, error/reconnect states and quit cleanup are recorded; observed defects are fixed.
- [ ] **5.2 — Instrumentation and metric smoke.** Use a local client through the opt-in bridge;
      verify session reset/compaction, sparse speed/TTFT, disable/clear and no content persistence.
      Exercise NVIDIA/AMD probes on available hardware and unavailable paths. Depends on 5.1.
      Closure: observed readings match their source and stale/unknown labels.
- [ ] **5.3 — Owned-process attribution decision.** Evaluate descendant aggregation per OS without
      attributing unrelated processes. Implement only where ownership can be proven; otherwise document
      the direct-child limit and keep values unavailable. Depends on 5.1. Closure: tested supported
      platforms and explicit unsupported behavior.
- [ ] **5.4 — macOS GPU feasibility decision.** Evaluate a non-privileged, stable, trustworthy local
      GPU utilization/VRAM source. Implement if semantics hold; otherwise document the limitation and
      keep readings unavailable. Depends on 5.2. Closure: evidence-backed decision, no invented zero
      or model attribution.
- [ ] **5.5 — Integrated safety/regression gate.** Verify authority transitions, disabled adapters,
      malformed provider responses, credential refusal, bridge auth, one-hour caps, keyboard/focus and
      cross-platform CI. Depends on 5.1–5.4. Closure: `pnpm check` and relevant native smoke pass with
      known limitations recorded.

**Exit:** users can complete observe/control/inspect journeys on target systems; unsupported cases
are documented from observed behavior.

## [ ] Phase 6 — Installable v1 and release

**Goal:** trustworthy native installers usable without development tooling.

- [ ] **6.1 — Packaging matrix.** Windows `.exe`, macOS universal `.dmg`, Linux `.AppImage`/`.deb`;
      clean install, upgrade, quit/tray, discovery and offline-launch checks on each OS. Depends on
      phase 5. Closure: artifacts and results for every target.
- [ ] **6.2 — Signing, identity and supply chain.** Owner approves final mark/trademark; Windows
      signing and macOS Developer ID signing/notarization; release checksums and reproducibility
      expectations verified. Depends on 6.1. Owner provides credentials/brand approval.
- [ ] **6.3 — Public release gate.** Security/privacy review, installation guide, supported
      hardware/runtime matrix, rollback instructions and release CI. Depends on 6.1–6.2. Closure:
      owner approves publication and verified versioned downloads exist.

**Exit:** installers are usable and verifiable on supported OSes; v1 claims match evidence.

## Deferred candidates, not v1 commitments

- Opt-in SQLite history beyond one hour only if users need it, with retention/off controls and
  metrics-only export. One-hour volatile history remains the default.
- Additional lifecycle/model management only through a reviewed provider-native control plane.
  Ollama external-server handover is unsupported with the current adapter; generic process kills
  are prohibited. llama.cpp and MLX-LM remain observers until separately designed.
- Per-model CPU/GPU attribution, passive third-party token streams, model downloads/removal,
  multi-device preferences and remote monitoring need separate evidence and scope decisions.

## Dependency order and next handoff

Phases 1–4 are the implemented baseline. Complete 5.1 before interpreting manual metrics and
process behavior in 5.2–5.4, then run 5.5. Packaging 6.1 follows that gate; signing/brand work
can be prepared in parallel but cannot close before artifacts exist. Publication 6.3 follows
6.1–6.2. Revisit deferred candidates only when the user changes scope.

Next agent: inspect this file and `git status`, take **5.1**, create a task branch from current
`dev`, record evidence and update its checkbox only after validated promotion to `main`.
