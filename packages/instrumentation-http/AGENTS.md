# AGENTS.md — packages/instrumentation-http

Read `../../AGENTS.md` and, when available, workspace-level `../../../AGENTS.md`.

Scope: explicit opt-in, authenticated HTTP ingestion of numeric client instrumentation on IPv4
loopback only. Bind to `127.0.0.1`, use an ephemeral strong token, enforce strict schemas, body and
rate limits, and never log or retain request bodies. This package must not inspect prompts,
completions, tool arguments, credentials or arbitrary event fields.
