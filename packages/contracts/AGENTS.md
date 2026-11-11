# AGENTS.md — packages/contracts

Read `../../AGENTS.md` and, if available, workspace-level `../../../AGENTS.md`.

Scope: Provider capabilities, ports and typed snapshot contracts only. No Electron/React/OS/persistence implementations. Keep nullable truthfulness.
Adapter manifests are versioned contracts and the single source for static capabilities and
permission boundaries; dynamic authority remains a separate snapshot field.
Dashboard snapshots expose every enabled runtime plus the selected detail. Runtime-specific errors,
process metrics and benchmarks must remain attached to their own runtime snapshot.
An observation-only adapter uses server-control scope `none`; it must not be represented as an owned
process or provider toggle merely because its loopback endpoint is reachable.

The repository's privacy, ownership, process lifecycle, truthful-metrics and Clean Architecture policies remain authoritative.
