# OB-Pulse — Local AI Monitor

> Open-source, local-first, compact desktop monitor for local LLM runtimes. Part of the onBlank product family. **Initial technical scaffold**, not a finished user release.

**Provisional brand/name:** OB-Pulse (`ob-pulse`, `@obpulse/*`, `com.onblanksystems.obpulse`). Verify trademark availability before public launch.

## What currently works in the scaffold

- Electron tray application with tray-only, compact gadget and expanded dashboard surfaces, an always-on-top toggle and hide-to-tray behavior.
- Ollama detection, list installed/loaded models, **app-managed** Ollama start/stop, and explicit model load/unload.
- LM Studio local server detection and loaded-model listing (**read-only experimental adapter**).
- Host-wide CPU and RAM samples with totals and percentages; loaded Ollama model RAM/VRAM residency as reported by the API.
- A rolling one-hour chart kept only in process memory for host RAM, provider-reported GPU residency and explicit benchmark output speed.
- A user-invoked Ollama sample request with real prompt-eval and generation tokens/sec metrics, **clearly labeled as a benchmark**, not a live stream from unrelated clients.
- A typed, provider-agnostic contract plus domain tests for token throughput/context semantics.

## Not yet shipped

- Passive token-speed capture from third-party apps (requires an opt-in proxy/plugin or runtime-specific event feed).
- Real session-context utilization from arbitrary clients and automatic compaction detection.
- Per-model CPU/GPU utilization on every OS, persistent/long-term chart history and external model installs.
- LM Studio start/stop/load/unload, llama.cpp/MLX adapters, signing/notarization, production native installers, automated distribution.

Unsupported values appear as `—`, **never** as fabricated zero.

## Why no cloud account?

OB-Pulse monitors user-approved local runtimes on loopback. No login, onBlank Central dependency, tracking telemetry, remote analytics, subscription, update ping or cloud sync. Works without internet once built/installed. The runtime itself may have separate behavior controlled by the user; OB-Pulse does not configure it to phone home.

## Developer quickstart

Requires Node 24 and pnpm 12.6.0. A local Ollama installation is optional (the UI displays disconnected otherwise).

```bash
corepack enable
corepack prepare pnpm@12.6.0 --activate
pnpm install
pnpm dev
```

First install creates `pnpm-lock.yaml`: review and commit it before enabling CI and release workflows. The release template also requires the organization GitHub App variables/secrets to be set up.

```bash
pnpm check
pnpm package:mac
pnpm package:win
pnpm package:linux
```

Packages for end users will be hosted in GitHub Releases after the packaging matrix and signing requirements are validated; **a source ZIP is not an installer**.

## Governance

Read [`AGENTS.md`](AGENTS.md) and each scoped `AGENTS.md` before editing. The central onBlank workspace file `../AGENTS.md` must also be reviewed by the maintainer for cross-product/security/licensing changes; it is not in this ZIP.

- Branches: task branch from `dev` → reviewed PR into protected `dev` → reviewed promotion into protected `main`.
- Conventional Commits, SemVer, CI; no direct pushes to protected branches.
- Runtime boundaries, privacy and metric semantics are documented under [`docs/`](docs/).
- Product/repository is independent from OB-Tracker, OB-DaVi and onBlank Agent OS; no shared code or contracts.

## Attribution & license

Apache-2.0 code; brand/trademark policy separate. See `LICENSE`, `NOTICE`, `TRADEMARK.md`. Brand SVG assets are development placeholders awaiting official approved artwork.
