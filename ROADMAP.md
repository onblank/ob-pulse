# OB-Pulse — Development Roadmap

> Canonical phase and iteration plan. Agents update this file with each implementation PR.
> `docs/PRODUCT_SPEC.md` defines product behavior; `docs/ARCHITECTURE.md` and `docs/METRICS.md`
> define technical boundaries. Checkboxes describe validated state, not merely code that exists.

**Roadmap version:** 2026-11-15

**Last completed iteration:** 2.5 — Owned runtime shutdown and native tray assets

**Next planned iteration:** 5.7 — Current Windows/Linux user journeys before 6.2

## Objective

OB-Pulse is a small, local-first desktop companion for observing and safely controlling local AI
runtimes. The compact gadget answers which runtime is selected, whether its server can be controlled,
which models are loaded, and what host resources and measured output speed have done in the last
hour. The expanded monitor supports runtime/model operations, per-runtime detail and resource
history. Settings holds configuration, permissions, credentials and instrumentation.

The v1 target works without an account, cloud service or database. It distinguishes observed from
managed runtimes, loaded from available models, device metrics from model metrics, and explicit
benchmark/client measurements from unknown traffic. Missing values remain unavailable. Pulse does
not capture inference content or stop an external process without explicit takeover, unique listener
resolution and process identity validation.

The plan prioritizes a reliable daily experience for Ollama and LM Studio, truthful observation
for other supported runtimes, bounded one-hour history and installable desktop builds. External
process control requires explicit takeover, unique loopback listener discovery and process identity
revalidation. Persistent history, remote monitoring,
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
- At the start and end of every remaining iteration, review the audit register below. Close a
  finding only with the specified evidence and record the implementation/promotion PRs. A passed
  build does not close a manual journey, signing, or ownership finding.

**Iteration done:** behavior and failure path work at the real boundary; contracts, UI and docs
agree; authority, privacy and metric semantics hold; targeted tests and `pnpm check` pass; manual
smoke evidence is recorded where relevant; the implementation PR passes and merges into `dev`, then
the promotion PR passes and merges into `main`. A docs-only iteration needs
reviewable evidence, not code tests. If a required check cannot run, keep the item open.

**Phase done:** required iterations are complete, combined behavior has been exercised and no known
issue contradicts the phase goal. Owner action is required for signing credentials, final brand
approval and public release.

| Phase | Outcome                                      | Status                                                                 |
| ----- | -------------------------------------------- | ---------------------------------------------------------------------- |
| 1     | Local-first foundation and desktop shell     | Complete                                                               |
| 2     | Safe runtime and model control               | Complete: 2.5 ownership, real-engine and tray acceptance recorded      |
| 3     | Truthful telemetry and one-hour history      | Complete for implemented sources                                       |
| 4     | Compact, expanded and settings surfaces      | Complete in code                                                       |
| 5     | End-to-end validation and platform decisions | Open: current Windows/Linux manual control journeys remain unverified  |
| 6     | Native distribution and public v1            | Open: 6.1 passed; 6.2 signing and release safety, then 6.3 publication |

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
      child, explicit load/unload and benchmark. External Ollama was observation-only at closure.
- [x] **2.2 — LM Studio server and models.** Session-owned server toggle, delegated server
      handover/release, native load/unload and benchmark, OS-protected local API token. External
      GUI/daemon ownership remained outside that iteration. Evidence: adapter implementation and
      `docs/ARCHITECTURE.md`.
- [x] **2.3 — Read-only additional runtimes.** llama.cpp observer and opt-in MLX-LM catalog
      observer, without implied authority. Evidence: [PR #49](https://github.com/onblank/ob-pulse/pull/49),
      [PR #52](https://github.com/onblank/ob-pulse/pull/52).
- [x] **2.4 — Capability and control center.** Versioned manifests, enabled-runtime settings,
      concurrent bounded failure-isolated polling, runtime-scoped actions and history. Evidence:
      [PR #43](https://github.com/onblank/ob-pulse/pull/43), [PR #61](https://github.com/onblank/ob-pulse/pull/61).
- [x] **2.5 — Owned runtime shutdown and native tray assets.** Track the PID returned when the LM
      Studio CLI opens either a GUI service or a headless daemon; explicitly adopt only a uniquely
      identified LM Studio/Ollama listener; close the
      adopted application process tree on Stop/quit and leave it alive on Release. Bundle valid PNG
      tray assets: monochrome template on macOS and compact brand color on Windows/Linux. Process
      control no longer adopts an unrelated GUI by unique name; it requires a provider host in the
      verified listener's ancestry and records daemon creation identity. Manual real-engine smoke
      on macOS passed LM Studio Start→Take control→Release→Take control→Stop and Ollama
      Start→Release→Take control→Stop; both left no owned processes after Stop. Both runtimes
      also passed Start→shutdownOwned (the runtime cleanup invoked by app quit), with servers
      unreachable afterward. CI verifies termination of the adopted PID tree while preserving a
      parallel matching process on macOS, Linux and Windows. Unsigned native install/start/tray
      smoke passed on all three systems. Real GUI control on Windows/Linux remains in phase 5.7.
      Evidence: process-control changes in [PR #102](https://github.com/onblank/ob-pulse/pull/102),
      [PR #104](https://github.com/onblank/ob-pulse/pull/104),
      [PR #106](https://github.com/onblank/ob-pulse/pull/106),
      [PR #110](https://github.com/onblank/ob-pulse/pull/110), plus current iteration CI.

**Exit:** unadopted external servers cannot be stopped; unsupported actions stay disabled; one
adapter failure does not erase healthy cards. Real-engine ownership, release and quit cleanup are
verified for LM Studio and Ollama on macOS, with process-tree safety CI on all OSes.

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

- [x] **5.1 — macOS end-to-end desktop journeys.** On macOS exercise tray, compact selector, power,
      expanded cards/model operations, settings and return paths with Ollama/LM Studio. The maintainer
      confirmed these journeys work and reported no observed defect (2026-11-12). Iteration 6.1
      validates native Windows/Linux launch and tray/window lifecycle; full manual control-flow
      journeys remain unverified. Evidence: maintainer's manual smoke confirmation;
      local launch compiled Electron main/preload and Vite renderer successfully.
- [x] **5.2 — Instrumentation and metric smoke.** An end-to-end loopback integration test sends
      authenticated session, request, compaction and new-session events; verifies sparse throughput,
      TTFT, context reset and clear-on-disable; rejects content-bearing payloads without retaining
      them. Eleven integration/application tests pass. This macOS host has neither `nvidia-smi` nor
      Linux AMDGPU sysfs, so both hardware probes correctly remain unavailable here. Evidence:
      `apps/desktop/src/main/instrumentation-smoke.test.ts`; local hardware probe availability check.
- [x] **5.3 — Owned-process attribution decision.** Descendant aggregation is not enabled on any OS.
      macOS/Linux PID-parent snapshots can race with exit, reparenting and PID reuse; Windows Job
      Objects offer group accounting, but Pulse does not currently assign spawned processes to a job
      at creation. Keep direct-child CPU/RAM only and document that it can undercount helper/model
      processes. Existing self-PID probes run in macOS development, Linux CI and Windows CI; parser
      tests reject multiple rows. Evidence: `docs/VERIFY.md`, `docs/ARCHITECTURE.md`.
      [Implementation PR](https://github.com/onblank/ob-pulse/pull/80); [promotion PR](https://github.com/onblank/ob-pulse/pull/81).
- [x] **5.4 — macOS GPU feasibility decision.** No suitable system-wide utilization plus memory
      source is available within the no-privilege, stable API boundary. On macOS 26.5.2 / Apple M5,
      `powermetrics` requires superuser and reports estimated power rather than GPU utilization/VRAM;
      `ioreg` exposes AGX `PerformanceStatistics` but these undocumented driver properties have no
      stability contract and expose unified-memory allocation without a dedicated-VRAM denominator.
      Public Metal counters measure profiled app work, not host-wide load. Keep macOS host GPU values
      unavailable. Evidence: `docs/VERIFY.md`; local `powermetrics`, `ioreg`, `system_profiler` probes.
      [Implementation PR](https://github.com/onblank/ob-pulse/pull/82); [promotion PR](https://github.com/onblank/ob-pulse/pull/83).
- [x] **5.5 — Integrated safety/regression gate.** Rechecked authority transitions, failure-isolated
      malformed provider responses, OS-protected credential refusal, bridge authentication/content
      rejection, one-hour telemetry retention and count caps, disabled-runtime command routing, and
      renderer keyboard focus indication. CI covers the full check on Linux and owned-process probe
      on Windows; macOS app navigation was manually confirmed in 5.1. `pnpm check` passes with 90 tests.
      Native Windows/Linux install/upgrade and basic window/tray smoke is covered in 6.1; manual
      control-flow journeys remain unverified. Evidence: `docs/VERIFY.md`,
      `apps/desktop/src/renderer/focus-style.test.ts`, `packages/application/src/monitor.test.ts`,
      `packages/application/src/instrumentation.test.ts`.
      [Implementation PR](https://github.com/onblank/ob-pulse/pull/84); [promotion PR](https://github.com/onblank/ob-pulse/pull/85).

**Exit (open):** users must complete observe/control/inspect journeys on supported systems, with
unsupported cases documented from observed behavior. Native Windows/Linux install, launch and
basic window/tray lifecycle passed in 6.1. Current macOS ownership and full Windows/Linux control
journeys remain unverified (A3–A5).

### Phase 5/6 audit register — 2026-11-15

These are findings from source, workflow and evidence review, not claims that a failure has been
reproduced on every OS. Review each open row at every subsequent iteration. The cited paths are
the implementation to inspect; closure requires the evidence in the last column.

| ID  | Priority             | Finding and evidence                                                                                                                                                                                                                                             | Required closure                                                                                                                                                                                                          |
| --- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Resolved in 2.5      | The name-based fallback was removed. Host processes are included only when ancestry to the verified listener is proven. New process-control CI kills the adopted target while a parallel process with the same marker remains alive on macOS, Linux and Windows. | Resolved by implementation PR #110 and the all-OS process-control job in this iteration. The test fails closed on identity mismatch and verifies sibling preservation.                                                    |
| A2  | Resolved in 2.5      | LM Studio headless daemon ownership now stores PID, creation time and executable and revalidates all three before Stop/quit. If a newly started GUI/daemon PID cannot be verified, Pulse reports that the service may remain and must be closed manually.        | Resolved by implementation PR #110; local LM Studio Stop and shutdownOwned smoke passed. The residual-on-verification-failure is explicit because terminating an unverified process would violate the ownership boundary. |
| A3  | Resolved for 2.5     | Real LM Studio and Ollama control/release/quit cleanup passed on macOS; parallel-process preservation CI and native package startup/tray passed on all OSes.                                                                                                     | Remaining Windows/Linux real GUI journeys are tracked in 5.7 and do not block 2.5.                                                                                                                                        |
| A4  | Open, phase 5.7      | 6.1 CI installs and launches Windows/Linux packages but does not click through runtime controls, model load/unload, settings or instrumented sessions.                                                                                                           | Record manual or OS-level automated Windows/Linux control journeys, or narrow supported claims before v1.                                                                                                                 |
| A5  | Resolved in this PR  | Verification report/test counts were stale and did not include current ownership or real-engine evidence.                                                                                                                                                        | Update the dated verification record and align phase status.                                                                                                                                                              |
| A6  | High, release        | `.github/workflows/release.yml` runs Release Please first; a release may exist before native signing/notarization jobs pass. `gh release upload --clobber` also permits replacing files for an existing tag, despite the workflow input calling tags immutable.  | Gate public publication on complete signed assets and owner approval; define draft/failure recovery and a no-overwrite policy or reviewed replacement procedure. Verify with a controlled release rehearsal.              |
| A7  | Medium, identity     | The release workflow checks signature _validity_ (`Get-AuthenticodeSignature`, `codesign`, `spctl`) but does not assert the expected Windows publisher or Apple Team ID. It has never completed with production credentials.                                     | Pin and verify expected publisher/Team ID against owner-approved identities; archive the signed/notarized run, installer hashes, manifest and provenance evidence.                                                        |
| A8  | Medium, supply chain | `release-assets.mjs` validates filenames, sizes and SHA-256, but source reproducibility expectations and tag movement protection are not yet demonstrated. A manual `workflow_dispatch` can rebuild and overwrite existing assets.                               | Document what is and is not reproducible (including signing timestamps), protect version tags, rehearse artifact/attestation verification from a clean download, and enforce the A6 replacement policy.                   |

- [x] **5.6 — Process ownership hardening.** Resolve A1–A2 before another control feature or a
      signed release. Record provider-specific identity, rollback and parallel-instance evidence;
      preserve fail-closed behavior. Depends on 2.5 diagnosis but may implement before its manual
      acceptance is complete.
- [ ] **5.7 — Current cross-platform journey evidence.** Resolve A4: current macOS LM Studio and
      Ollama ownership matrix; Windows/Linux runtime controls, model actions, settings and
      instrumentation; update `docs/VERIFY.md` with dates, versions and observed limits. Depends
      on 5.6. Phase 5 closes only when these journeys support its exit claim.

## [ ] Phase 6 — Installable v1 and release

**Goal:** trustworthy native installers usable without development tooling.

- [x] **6.1 — Packaging matrix.** Windows `.exe`, macOS universal `.dmg`, Linux `.AppImage`/`.deb`;
      clean install, upgrade, quit/tray, discovery and offline-launch checks on each OS. Its
      packaging evidence remains valid while phase 5 control journeys are reopened. An unsigned CI
      smoke installs a same-source `0.0.1` baseline, upgrades it to the
      current build, checks that local user data survives, verifies the tray remains after closing
      the widget, and launches with the four runtime adapters available while no service is required.
      Linux additionally launches both AppImage artifacts and upgrades the DEB package. Closure:
      all three native jobs passed; current unsigned artifacts are retained for seven days. Evidence:
      [implementation PR #87](https://github.com/onblank/ob-pulse/pull/87), [native run #43458682550](https://github.com/onblank/ob-pulse/actions/runs/43458682550).
- [ ] **6.2 — Signing, identity and supply chain.** Owner approves final mark/trademark; Windows
      signing and macOS Developer ID signing/notarization; release checksums and reproducibility
      expectations verified. Depends on 6.1 and the phase 5 safety/validation findings A1–A5.
      Pipeline gates, pinned actions, manifest/checksum verification and provenance attestation
      code exist; the production signing path has not been proven. Closure checklist:

      1. Owner approves the final product name, trademark clearance, app/tray/installer artwork,
         Windows publisher and Apple Team ID. Record approval before setting the brand gate.
      2. Configure the organization release GitHub App and signing/notarization values in
         `docs/RELEASING.md`; verify availability without exposing secrets.
      3. Resolve A6: gate public publication on validated assets; prevent silent replacement of
         assets for an existing version and document draft/failure recovery.
      4. Resolve A7–A8: verify expected signer identity, protect tags, document reproducibility
         limits and independently verify downloaded hashes, manifest and provenance.
      5. Run a controlled signed Windows and Developer ID signed/notarized macOS release build;
         check Authenticode, Gatekeeper, stapling and clean installation. Record run, tag, artifact
         hashes and installer versions. Linux remains checksum/provenance verified.

      The open Release Please PR #8 is release metadata, not evidence of these gates. No verified
      signed release exists yet.

- [ ] **6.3 — Public release gate.** Security/privacy review, installation guide, supported
      hardware/runtime matrix, rollback instructions and release CI. Depends on 6.1–6.2. Closure:
      owner approves publication and verified versioned downloads exist.

**Exit:** installers are usable and verifiable on supported OSes; v1 claims match evidence.

## Deferred candidates, not v1 commitments

- Opt-in SQLite history beyond one hour only if users need it, with retention/off controls and
  metrics-only export. One-hour volatile history remains the default. Create a dashboard view with historical data and KPIs when SQLite implemented. This dashboard view have to be a new button as config is and have to be available just in extended view.
- Additional lifecycle/model management only through a reviewed provider-native control plane.
  Ollama external-server handover is unsupported with the current adapter; generic process kills
  are prohibited. llama.cpp and MLX-LM remain observers until separately designed.
- Per-model CPU/GPU attribution, passive third-party token streams, model downloads/removal,
  multi-device preferences and remote monitoring need separate evidence and scope decisions.

## Dependency order and next handoff

Phase 2 is complete; phase 5 remains open. Reconcile the audit register at each iteration: complete
5.7's Windows/Linux user journeys. Packaging 6.1 remains validated. Prepare owner
identity/credential prerequisites and A6–A8 in parallel, but close 6.2 only after
the signed release rehearsal and independent verification above. Publication 6.3 follows 6.2.
Revisit deferred candidates only when the user changes scope.
