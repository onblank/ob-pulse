# Verification report

Current local verification as of 2026-11-01:

- `pnpm install` completed with the pinned pnpm 12.6.0 workspace.
- `pnpm check` passes formatting, ESLint, TypeScript checks for all nine packages, 48 tests and
  the Electron main/preload/renderer production builds.
- Instrumentation tests open an ephemeral IPv4 loopback port and cover bearer authentication,
  schema/content rejection, request limiting, replay/session semantics, context compaction,
  throughput calculations and warning/overflow state.
- LM Studio adapter tests cover v1 model parsing, fixed CLI lifecycle commands, session-owned versus
  external server behavior, native load/unload requests, ambiguous-instance refusal and a
  non-persistent benchmark that keeps only numeric stats. A local LM Studio 0.4.26 smoke test started
  and stopped the server, detected six installed linked models and loaded no model.
- Widget preference tests cover strict value validation, safe corrupt/missing-file fallback,
  atomic persistence and work-area-clamped tray/corner placement.
- Runtime preference and application tests cover non-empty/unique registered adapter validation,
  filtered discovery, disabled-selection rejection and deterministic selection fallback.
- Owned-process tests cover strict `ps` and Windows reading parsing, Windows CPU delta and PID-reuse
  semantics, a live self-PID probe on macOS/Linux, absent Ollama ownership and the application rule
  that only a managed runtime with an owned PID receives a process sample. A dedicated
  `windows-latest` CI job runs the same live self-PID probe and package typecheck natively.
- The macOS development app launches at 360×430 and changes to the 900×680 expanded surface.

Still required before an official release:

- Manual end-to-end client instrumentation smoke testing through the packaged desktop UI.
- Native packaging/install/upgrade/quit/tray tests on Windows, macOS and Linux.
- Signing/notarization, official brand review and installer checksum verification.
