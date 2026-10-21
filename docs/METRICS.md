# Metrics accuracy contract

| Datum                           | Source                                              | Scope                 | Availability                                         |
| ------------------------------- | --------------------------------------------------- | --------------------- | ---------------------------------------------------- |
| Host RAM bytes/percent          | `os.totalmem()` + `os.freemem()`                    | entire device         | initial scaffold                                     |
| Host CPU percent                | deltas of `os.cpus()` ticks                         | entire device         | initial scaffold                                     |
| Loaded model file size          | Ollama `GET /api/ps` `size`                         | loaded model          | initial scaffold                                     |
| Loaded model GPU-resident bytes | Ollama `size_vram`                                  | reported residency    | initial scaffold, not true instantaneous utilization |
| Model context _capacity_        | Ollama `context_length`                             | loaded model          | initial scaffold                                     |
| Context **used** / percentage   | authenticated client event with explicit session ID | client session        | opt-in bridge; `null` until observed                 |
| Prefill/read tokens/sec         | token count / evaluation duration in final response | instrumented request  | benchmark or opt-in client event                     |
| Decode/write tokens/sec         | token count / evaluation duration in final response | instrumented request  | benchmark or opt-in client event                     |
| First-token latency             | client event or LM Studio v1 benchmark stats        | request/benchmark     | opt-in event or explicit LM Studio test              |
| Model CPU and GPU utilization   | runtime/OS-specific process instrumentation         | model/runtime process | planned/unsupported                                  |
| GPU max capacity                | OS-specific reliable hardware API                   | physical GPU          | planned/unsupported                                  |

**Units**: tps = token count × 1e9 / nanoseconds; zero/null/negative duration yields `null`.
**Sampling**: host and runtime snapshots every 3 seconds while the application process is alive,
including when its window is hidden in the tray. No sampling occurs after the application quits.
The in-memory window retains at most the latest hour and has no restart persistence. Host RAM is a
continuous series; loaded-model GPU-resident bytes are provider-reported residency, not GPU load;
decode/write tps is a sparse point recorded once per explicit benchmark.
**Staleness**: mark disconnected when provider request fails. Never keep last live figure without stale marker.
**Context reset**: new conversation/session (unique session ID) starts at 0 by _explicitly observed_ event.
Observed compaction advances to a new epoch with known summary/prefix tokens if provided;
otherwise used becomes `null` until the next instrumented request. App window opening is **not**
necessarily a new context session; never reset merely because it was reopened.
**Missing information**: `null` -> em dash, not `0`. Percentages require meaningful nonzero denominator.
**Benchmark**: only user-initiated, runs a tiny synthetic prompt with selected model; never mixed with
third-party live traffic; labels must say "Test" / "Benchmark". LM Studio requests set `store:false`,
discard the generated response and retain only numeric stats. Its v1 response provides decode speed
and first-token latency but not prefill speed, which remains `null`.

The opt-in bridge accepts explicit client events with session IDs. It is not a reverse proxy and
does not observe third-party traffic automatically; a client must deliberately implement the
versioned contract and receive the ephemeral token from the user.
