# AGENTS.md — packages/process-metrics

Read `../../AGENTS.md` and, if available, workspace-level `../../../AGENTS.md`.

Scope: OS metrics for an explicit process ID that the caller has already proved is owned by
OB-Pulse. Never discover processes by name, port or service, traverse unrelated processes, or claim
the direct child's metrics include descendants or model-specific usage. Fixed executable paths and
arguments only; no shell.

The repository's privacy, ownership, process lifecycle, truthful-metrics and Clean Architecture
policies remain authoritative.
