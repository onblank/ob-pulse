# Verification report

Current local verification as of 2026-10-21:

- `pnpm install` completed with the pinned pnpm 12.6.0 workspace.
- `pnpm check` passes formatting, ESLint, TypeScript checks for all eight packages, 31 tests and
  the Electron main/preload/renderer production builds.
- Instrumentation tests open an ephemeral IPv4 loopback port and cover bearer authentication,
  schema/content rejection, request limiting, replay/session semantics, context compaction,
  throughput calculations and warning/overflow state.
- LM Studio adapter tests cover v1 model parsing, native load/unload requests, ambiguous-instance
  refusal, external server ownership and a non-persistent benchmark that keeps only numeric stats.
- Widget preference tests cover strict value validation, safe corrupt/missing-file fallback,
  atomic persistence and work-area-clamped tray/corner placement.
- The macOS development app launches at 360×430 and changes to the 900×680 expanded surface.

Still required before an official release:

- Manual end-to-end client instrumentation smoke testing through the packaged desktop UI.
- Native packaging/install/upgrade/quit/tray tests on Windows, macOS and Linux.
- Signing/notarization, official brand review and installer checksum verification.
