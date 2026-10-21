# Metrics accuracy contract

| Datum                           | Source                                                         | Scope                 | Availability                                         |
| ------------------------------- | -------------------------------------------------------------- | --------------------- | ---------------------------------------------------- |
| Host RAM bytes/percent          | `os.totalmem()` + `os.freemem()`                               | entire device         | initial scaffold                                     |
| Host CPU percent                | deltas of `os.cpus()` ticks                                    | entire device         | initial scaffold                                     |
| Loaded model file size          | Ollama `GET /api/ps` `size`                                    | loaded model          | initial scaffold                                     |
| Loaded model GPU-resident bytes | Ollama `size_vram`                                             | reported residency    | initial scaffold, not true instantaneous utilization |
| Model context _capacity_        | Ollama `context_length`                                        | loaded model          | initial scaffold                                     |
| Context **used** / percentage   | client integration with explicit session ID                    | client session        | planned; `null` until observed                       |
| Prefill/read tokens/sec         | `prompt_eval_count` / `prompt_eval_duration` in final response | instrumented request  | benchmark only in scaffold                           |
| Decode/write tokens/sec         | `eval_count` / `eval_duration` in final response               | instrumented request  | benchmark only in scaffold                           |
| Model CPU and GPU utilization   | runtime/OS-specific process instrumentation                    | model/runtime process | planned/unsupported                                  |
| GPU max capacity                | OS-specific reliable hardware API                              | physical GPU          | planned/unsupported                                  |

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
third-party live traffic; labels must say "Test" / "Benchmark".

For future passive observation, implement explicit client plugins for Agent OS/Hermes/IDE clients,
or an opt-in loopback reverse proxy with per-request events and session IDs; do not assume third-party
requests automatically traverse OB-Pulse.
