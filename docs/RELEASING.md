# Releasing OB-Pulse

Current scaffold provides electron-builder platform configuration and CI checks, **not** proven
signed builds or a ready-made official release. Onboarding normal users requires signed/notarized
packages and smoke tests on all three native OS targets.

Target artifacts: Windows x64 NSIS `.exe`; macOS universal `.dmg`; Linux x64 `.AppImage` + `.deb`;
`SHA256SUMS` generated after asset collection. Build each target on its own GitHub-hosted OS runner.

Release Please runs from `main` using the organization-owned GitHub App credentials
`ONBLANK_RELEASE_APP_ID` and `ONBLANK_RELEASE_APP_PRIVATE_KEY`. Its release PR is not approval to
publish: owner identity approval and signing credentials are separate gates. Do not bypass branch
protections, merge a release PR or dispatch a rebuild until those gates are satisfied.

## Release workflow configuration

Before an official release, configure these repository or organization Actions values without
putting their contents in source control:

| Kind     | Name                             | Purpose                                                                                                                                         |
| -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Variable | `OBPULSE_PRODUCT_BRAND_APPROVED` | Set to `true` only after the owner approves final product mark and installer icons.                                                             |
| Secret   | `WIN_CSC_LINK`                   | Windows code-signing certificate file reference or supported base64 certificate.                                                                |
| Secret   | `WIN_CSC_KEY_PASSWORD`           | Password for the Windows signing certificate.                                                                                                   |
| Secret   | `MAC_CSC_LINK`                   | Apple Developer ID Application certificate file reference or supported base64 certificate.                                                      |
| Secret   | `MAC_CSC_KEY_PASSWORD`           | Password for the Apple signing certificate.                                                                                                     |
| Secret   | `APPLE_API_KEY_BASE64`           | Base64-encoded App Store Connect `.p8` API key; the workflow writes it to a mode-600 runner-temp file and removes it with the ephemeral runner. |
| Variable | `APPLE_API_KEY_ID`               | App Store Connect API key ID.                                                                                                                   |
| Variable | `APPLE_API_ISSUER`               | App Store Connect issuer UUID.                                                                                                                  |

The Release Please App also needs `ONBLANK_RELEASE_APP_ID` and
`ONBLANK_RELEASE_APP_PRIVATE_KEY`. The native release jobs fail closed if product approval or the
platform-specific signing/notarization credentials are missing. Never paste secret values into an
issue, PR, log or this document.

The workflow pins GitHub Actions to full commit SHAs, produces a deterministic
`release-manifest.json` containing the tagged source commit and SHA-256 for each native installer,
verifies the manifest and `SHA256SUMS` before upload, and creates a GitHub artifact provenance
attestation. Windows and macOS builds additionally verify Authenticode, Developer ID, Gatekeeper and
notarization stapling before upload. Linux currently uses checksum and provenance verification;
there is no Linux code-signing identity configured.

These controls are implemented but not yet proven with owner-approved production credentials or
final artwork. Do not describe OB-Pulse installers as signed/notarized until a release run passes on
the actual credentials and the owner approves the identity assets. The open Release Please PR is not
part of this implementation task and must remain subject to the normal release decision.

Future onBlank website should only link/mirror **identical checksummed** GitHub release artifacts.
Do not add silent app auto-updates without a separate review of consent, privacy and update signatures.
