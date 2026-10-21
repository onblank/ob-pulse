# Opt-in instrumentation contract v1

This versioned protocol is implemented by an optional local HTTP bridge. It lets Agent OS, Hermes
clients or editor plugins provide trustworthy numeric usage and session context without importing
their code or violating repository ownership. The bridge is disabled on startup and must be enabled
explicitly in OB-Pulse's expanded view.

When enabled, the UI shows an ephemeral endpoint such as
`http://127.0.0.1:54321/v1/events` and a fresh bearer token. Clients send `POST` requests with
`Content-Type: application/json` and `Authorization: Bearer <token>`. The port and token may change
after disable/enable or restart and are never persisted.

## Observation envelope

```json
{
  "version": "1.0.0",
  "event_id": "uuid-v4",
  "origin": "approved-client-id",
  "at": "2026-10-14T18:00:00.000Z",
  "runtime_id": "ollama",
  "model_id": "qwen3.6:27b-coding",
  "session_id": "a6c0294a-2fe2-4e8d-a02a-3661a3e3e86c",
  "type": "request.completed",
  "data": {
    "prompt_tokens": 481,
    "completion_tokens": 110,
    "prompt_eval_duration_ns": 115000000,
    "completion_eval_duration_ns": 4020000000,
    "context_used_tokens": 481,
    "time_to_first_token_ms": 83.4
  }
}
```

Possible types:

- `session.started` — new unique client conversation starts at zero tokens.
- `request.completed` — provider-reported counters/timings (not estimated from text length unless flagged).
- `context.compacted` — increments epoch; `summary_context_tokens` may be null until measured.
- `session.ended` — closes the context session.

Model changes require ending the current session and starting a new session. A `model.changed` event
is not part of v1 because reset semantics must not be guessed.

## Security requirements

- Explicit opt-in per client; no passive network sniffing.
- Loopback only, no mDNS or LAN binds.
- A new 256-bit bridge token per activation, version negotiation and bounded replay suppression.
- Strict body size/rate limits, event IDs and input schema validation.
- Prompt text, completion text, tool arguments, secrets, personal identifiers and provider credentials
  are **never fields in the event schema** and must not be retained in debug logs.
- Unknown fields should be rejected, or explicitly versioned; never persist arbitrary event JSON.
- Retention disabled by default; if enabled, bounded and user-deletable history.

The current adapter enforces a 16 KiB request-body limit and 120 requests per rolling minute. It
rejects unknown envelope/data fields, non-v1 events, malformed measurements, unsupported runtimes,
unauthenticated requests, mismatched event-ID replay and invalid session transitions. Exact replay
is handled idempotently. Accepted state remains in
process memory and disappears on quit.

## Integration boundary with Agent OS

Agent OS (separate repository) owns permission, routing, actions and memory. The OB-Pulse adapter
may report sanitized usage/context events from its orchestration hooks **outbound on explicit
consent**. OB-Pulse never imports Agent OS packages, nor does it receive tool-use permissions.
