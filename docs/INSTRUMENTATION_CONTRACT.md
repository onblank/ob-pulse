# Future opt-in instrumentation contract (design, not yet implemented)

This is **not** an active local HTTP listener. It specifies the future versioned protocol used by
Agent OS, Hermes clients, editor plugins or an opt-in loopback proxy to provide trustworthy usage
and session context without importing their code or violating repository ownership.

## Observation envelope

```json
{
  "version": "1.0.0",
  "event_id": "uuid-v4",
  "origin": "approved-client-id",
  "at": "2026-10-14T18:00:00.000Z",
  "runtime_id": "ollama",
  "model_id": "qwen3.6:27b-coding",
  "session_id": "opaque-random-uuid",
  "type": "request.completed",
  "data": {
    "prompt_tokens": 481,
    "completion_tokens": 110,
    "prompt_eval_duration_ns": 115000000,
    "completion_eval_duration_ns": 4020000000,
    "context_capacity_tokens": 32768,
    "context_used_tokens": 481
  }
}
```

Possible types:

- `session.started` — new unique client conversation starts at zero tokens.
- `request.completed` — provider-reported counters/timings (not estimated from text length unless flagged).
- `context.compacted` — increments epoch; `summary_context_tokens` may be null until measured.
- `session.ended` — closes the context session.
- `model.changed` — model switch within a session (must specify context reset semantics explicitly).

## Security requirements

- Explicit opt-in per client; no passive network sniffing.
- Loopback only, no mDNS or LAN binds.
- Strong locally stored bridge token or authenticated IPC, version negotiation and replay rejection.
- Strict body size/rate limits, event IDs and input schema validation.
- Prompt text, completion text, tool arguments, secrets, personal identifiers and provider credentials
  are **never fields in the event schema** and must not be retained in debug logs.
- Unknown fields should be rejected, or explicitly versioned; never persist arbitrary event JSON.
- Retention disabled by default; if enabled, bounded and user-deletable history.

## Integration boundary with Agent OS

Agent OS (separate repository) owns permission, routing, actions and memory. The OB-Pulse adapter
would report sanitized usage/context events from its orchestration hooks **outbound on explicit
consent**; OB-Pulse never imports Agent OS packages, nor does it receive tool-use permissions.
