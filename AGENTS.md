# AGENTS.md — OB-Pulse

## Branch policy

Create ordinary work from current `dev` in `feature/*`, `fix/*`, `refactor/*`, `docs/*` or `chore/*`.
Merge into protected `dev` only by reviewed PR with required checks; promote `dev` to protected `main`
through a separate reviewed PR. Never push directly to `dev` or `main`. Conventional Commits, SemVer.
See `docs/GIT_WORKFLOW.md`.

## Group context

This repository belongs to the onBlank Group workspace. Before AI, security, licensing, privacy,
brand, cross-product or integration changes, read `../AGENTS.md` (global onBlank workspace instructions).
If unavailable, stop **that class of change** and request the global policy file from the owner.
The scaffold includes a minimal local policy, not a replacement for the authoritative global file.

## Product identity

- Product: **OB-Pulse — Local AI Monitor** (provisional name)
- Repository: `ob-pulse`, app ID: `com.onblanksystems.obpulse`, packages: `@obpulse/*`
- License: Apache-2.0 (trademarks reserved separately)
- Targets: Windows, macOS, Linux
- No dependence on OB-Tracker, OB-DaVi, Central, Gateway or Agent OS.

## Authoritative principles

1. Local-first and no required account, remote service, cloud backend, telemetry, tracking SDK or update ping.
2. Network: **only user-approved loopback runtime endpoints** by default; never expose listeners on LAN/public interfaces. The local instrumentation bridge stays disabled until explicit opt-in, binds only to `127.0.0.1`, authenticates with an ephemeral bearer token and accepts only the reviewed content-free event schema.
3. Never record prompts, completions, tool arguments, API secrets or context contents. Persist only minimized numeric/resource telemetry if users opt in.
4. Never claim metrics to be more precise than the adapter can prove. `null` means unobserved/not supported; `0` means measured zero.
5. Model context is scoped to a **client session**, not to loaded model/host. A reset needs an observed client session boundary or explicit user command; compaction has explicit semantics.
6. Reading/prefill tps and writing/decode tps require provider response timing or instrumented per-request events. Polling `/api/ps` cannot reveal live prompt throughput of unrelated clients.
7. Separate **server management**, **loaded-model management**, and **observation**. Only stop a server owned/spawned by OB-Pulse. Never kill user/other-app services.
8. Never let a UI model-unload action delete downloaded weights. Installation/removal of model binaries needs separate confirmation.
9. No shell interpolation for runtime commands, no renderer subprocess access. OS process lifecycle stays behind adapters and typed IPC.
10. UI remains in background/tray; no invasive floating overlays by default. Always-on-top is optional.
11. Third-party runtime adapters are individually registered through an internal interface. No untrusted executable plugin loading by default.
12. All branding assets are bundled locally; official logos need review prior to release.

## Clean Architecture

```
Electron/React (composition + typed IPC) -> application -> domain
                                         -> contracts <- provider/host adapters
```

- Pure types/formulas/semantic rules in `packages/domain`.
- Ports, capability contracts and schemas in `packages/contracts`.
- Use-case orchestration in `packages/application`.
- Ollama implementation only in `packages/runtime-ollama`.
- LM Studio implementation only in `packages/runtime-lmstudio`.
- OS metrics in `packages/host-metrics`.
- Electron main owns composition and OS UI; renderer never calls localhost APIs directly.

## Security

`contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, narrow preload, strictly validated
IPC payloads, no generic filesystem/HTTP/CLI bridge to renderer. User-controlled URLs must be rejected
unless loopback; production permissions can be expanded only through reviewed architecture decisions.
Do not start, kill, load or benchmark anything automatically at app boot.

## Truth-in-delivery

This is an early implementation. Do not claim model-specific CPU/GPU telemetry, passive external-client token
streams, database history, updater or signed installers have shipped unless implemented and tested. Explicitly
authenticated clients may report content-free session/request/compaction events only while the user-enabled
loopback bridge is active. The app can control **Ollama it started itself**; for already-running Ollama it
attaches in observation mode.

## Workflow

Write domain tests first, then contracts/use case, then adapter, then IPC/renderer, then release tests.
Run `pnpm check` (where dependencies are available), update scope AGENTS and docs with new decisions.
