# AGENTS.md — packages/runtime-ollama

Read `../../AGENTS.md` and, if available, workspace-level `../../../AGENTS.md`.

Scope: Ollama infrastructure adapter only; restrict to fixed loopback base URL, validate upstream payloads, manage only own child process.
Its manifest must never claim external-process control, credential storage, model deletion or
inference-content access.

The repository's privacy, ownership, process lifecycle, truthful-metrics and Clean Architecture policies remain authoritative.
