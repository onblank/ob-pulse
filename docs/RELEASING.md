# Releasing OB-Pulse

Current scaffold provides electron-builder platform configuration and CI checks, **not** proven
signed builds or a ready-made official release. Onboarding normal users requires signed/notarized
packages and smoke tests on all three native OS targets.

Target artifacts: Windows x64 NSIS `.exe`; macOS universal `.dmg`; Linux x64 `.AppImage` + `.deb`;
`SHA256SUMS` generated after asset collection. Build each target on its own GitHub-hosted OS runner.

Organization standard: Release Please PR with org-owned GitHub App credentials
`ONBLANK_RELEASE_APP_ID` and `ONBLANK_RELEASE_APP_PRIVATE_KEY`; release workflow is included as a **configuration template**. It cannot run until the new GitHub repository exists, the App is installed, the two organization variables/secrets are configured, and the lockfile has been committed. Do not bypass
branch protections or create pseudo-releases. See existing `ob-tracker` / `ob-davi` release workflows.

Future onBlank website should only link/mirror **identical checksummed** GitHub release artifacts.
Do not add silent app auto-updates without a separate review of consent, privacy and update signatures.
