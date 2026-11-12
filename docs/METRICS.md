# Metrics accuracy contract

| Datum                            | Source                                              | Scope                 | Availability                                         |
| -------------------------------- | --------------------------------------------------- | --------------------- | ---------------------------------------------------- |
| Host RAM bytes/percent           | `os.totalmem()` + `os.freemem()`                    | entire device         | initial scaffold                                     |
| Host CPU percent                 | deltas of `os.cpus()` ticks                         | entire device         | initial scaffold                                     |
| Host NVIDIA GPU utilization/VRAM | bounded `nvidia-smi` probe                          | physical GPU          | supported devices; unavailable otherwise             |
| Host AMD GPU utilization/VRAM    | Linux AMDGPU sysfs device counters                  | physical GPU          | supported devices; unavailable otherwise             |
| Owned-process resident bytes     | `ps` RSS / .NET `Process.WorkingSet64`              | direct owned child    | managed Ollama on Windows/macOS/Linux                |
| Owned-process CPU percent        | `ps` / cumulative .NET processor-time delta         | direct owned child    | managed Ollama; second sample on Windows             |
| Loaded model file size           | Ollama `GET /api/ps` `size`                         | loaded model          | initial scaffold                                     |
| Loaded model GPU-resident bytes  | Ollama `size_vram`                                  | reported residency    | initial scaffold, not true instantaneous utilization |
| Model context _capacity_         | Ollama `context_length`                             | loaded model          | initial scaffold                                     |
| Context **used** / percentage    | authenticated client event with explicit session ID | client session        | opt-in bridge; `null` until observed                 |
| Prefill/read tokens/sec          | token count / evaluation duration in final response | instrumented request  | benchmark or opt-in client event                     |
| Decode/write tokens/sec          | token count / evaluation duration in final response | instrumented request  | benchmark or opt-in client event                     |
| First-token latency              | client event or LM Studio v1 benchmark stats        | request/benchmark     | opt-in event or explicit LM Studio test              |
| Model CPU and GPU utilization    | runtime/OS-specific process instrumentation         | model/runtime process | planned/unsupported                                  |
| GPU VRAM capacity                | `nvidia-smi` or Linux AMDGPU sysfs per device       | physical GPU          | supported devices; unavailable otherwise             |

**Units**: tps = token count × 1e9 / nanoseconds; zero/null/negative duration yields `null`.
**Sampling**: host and every enabled runtime are observed concurrently every 3 seconds while the
application process is alive, including when its window is hidden in the tray. Each adapter poll is
bounded to 2.5 seconds and failures remain runtime-local. No sampling occurs after the application
quits. The in-memory window retains at most the latest hour per runtime and has no restart
persistence. Host RAM is repeated only as that runtime's aligned series; loaded-model GPU-resident
bytes are provider-reported residency, not GPU load; host GPU utilization and used VRAM are kept as
separate one-hour per-device series while the device is present; decode/write tps is a runtime-scoped sparse
point recorded once per explicit benchmark.
If a host GPU stops reporting, its curve remains visible until its final sample expires from the
rolling window. Its current value shows unavailable; historical points are not presented as live.
Owned-process CPU is core-equivalent and may exceed 100% when the direct child uses more than one
logical processor. On Windows the first valid observation has no prior cumulative-CPU baseline, so
CPU is `null` while resident memory is already available.

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
