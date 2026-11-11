# AGENTS.md — packages/runtime-mlxlm

Read `../../AGENTS.md` and, if available, workspace-level `../../../AGENTS.md`.

Scope: opt-in MLX-LM server observation at the fixed official default `127.0.0.1:8080`. Treat
`/v1/models` as an available-model catalog, never as proof that a model is loaded. Do not execute
the CLI, start or stop processes, send inference, accept credentials or manage model files.
