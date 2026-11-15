# AGENTS.md — packages/runtime-ollama

Read `../../AGENTS.md` and, if available, workspace-level `../../../AGENTS.md`.

Scope: Ollama infrastructure adapter only; restrict to fixed loopback base URL and validate
upstream payloads. `Take control` may adopt only the unique PID listening on Ollama's fixed port,
after identity verification and explicit user confirmation. Stop/quit may terminate that process
and its provider-app descendants until the user releases control. Never use a process name alone.
Its manifest must never claim credential storage, model deletion or inference-content access.

The repository's privacy, ownership, process lifecycle, truthful-metrics and Clean Architecture policies remain authoritative.
