# AGENTS.md — infra/packaging

Read `../../AGENTS.md` and the workspace-level `../../../AGENTS.md` if available.

Normal users must be able to download an installer and run it without Git/Node/pnpm credentials.
Targets: Windows x64 NSIS, macOS universal DMG, Linux x64 AppImage and DEB. Do not include
code-signing certificates in repository. No auto-updater by default. CI release and trademark
approval are prerequisites before calling any distribution official. No unapproved brand artwork.
