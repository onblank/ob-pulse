# Verification report

Current local verification as of 2026-11-04:

- `pnpm install` completed with the pinned pnpm 12.6.0 workspace.
- Formatting, ESLint, TypeScript checks for all ten packages, 63 tests and
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
- Runtime preference and application tests cover non-empty/unique registered adapter validation,
  filtered discovery, disabled-selection rejection, deterministic selection fallback and manifest
  propagation without duplicating capability state.
- Provider tests lock manifest contract version, loopback scope, server-control boundary, credential
  mode and prohibited process/model/content permissions for Ollama, LM Studio and llama.cpp.
- llama.cpp adapter tests cover the fixed official loopback endpoint, ready/loading/absent states,
  strict loaded-model parsing, unavailable metrics and refusal of every lifecycle, model-management
  and benchmark operation.
- Credential tests cover strict token validation, absent secure-storage refusal, encrypted-only
  atomic persistence, malformed-envelope rejection, deletion and re-encryption after key rotation.
  LM Studio adapter tests verify bearer headers and secret-free rejection errors.
- Owned-process tests cover strict `ps` and Windows reading parsing, Windows CPU delta and PID-reuse
  semantics, a live self-PID probe on macOS/Linux, absent Ollama ownership and the application rule
  that only a managed runtime with an owned PID receives a process sample. A dedicated
  `windows-latest` CI job runs the same live self-PID probe and package typecheck natively.
- The macOS development app launches with the three statically registered adapters; its compact and
  expanded surfaces build successfully.

Still required before an official release:

- Manual end-to-end client instrumentation smoke testing through the packaged desktop UI.
- Native packaging/install/upgrade/quit/tray tests on Windows, macOS and Linux.
- Signing/notarization, official brand review and installer checksum verification.
