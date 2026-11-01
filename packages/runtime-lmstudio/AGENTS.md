# AGENTS.md — packages/runtime-lmstudio

Read `../../AGENTS.md` and, if available, workspace-level `../../../AGENTS.md`.

Scope: LM Studio v1 infrastructure adapter only; nullable response parsing, explicit model
load/unload and user-invoked benchmark through the native loopback REST API. Benchmarks use a fixed
synthetic prompt, request `store:false`, discard generated output and retain numeric stats only. The
machine-local `lms` CLI may start a server pinned to `127.0.0.1:1234` after an explicit user action
and stop that server only during the same OB-Pulse process lifetime. Invoke only the resolved
`~/.lmstudio/bin/lms` executable with fixed arguments and no shell. Never stop a pre-existing server,
invoke `daemon down`, close the LM Studio GUI, claim its process PID, assume authentication
credentials or unload an ambiguous model instance.

The repository's privacy, ownership, process lifecycle, truthful-metrics and Clean Architecture policies remain authoritative.
