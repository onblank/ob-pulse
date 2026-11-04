# AGENTS.md — packages/runtime-llamacpp

Read `../../AGENTS.md` and, if available, workspace-level `../../../AGENTS.md`.

Scope: llama.cpp `llama-server` observation adapter only. Connect exclusively to the fixed official
default `http://127.0.0.1:9931`, validate upstream payloads and report only the loaded model exposed
by the server. Do not start or stop processes, enumerate local model files, send inference requests,
load or unload models, accept credentials or claim process/GPU ownership.

The repository's privacy, ownership, process lifecycle, truthful-metrics and Clean Architecture
policies remain authoritative.
