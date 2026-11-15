# Provider support matrix (v0.1 scaffold)

| Provider                         | Detect server | Installed models | Loaded models |                    Start/stop server | Load/unload model | Speeds              |
| -------------------------------- | ------------: | ---------------: | ------------: | -----------------------------------: | ----------------: | ------------------- |
| Ollama                           |           yes |              yes |           yes |      owned or explicitly adopted PID |               yes | explicit local test |
| LM Studio v1                     |           yes |        yes (API) |     yes (API) | owned daemon or adopted process tree |         yes (API) | explicit local test |
| llama.cpp server                 |           yes |               no |           yes |                     observation only |                no | no                  |
| MLX-LM server                    |  yes (opt-in) |  yes (available) |            no |                     observation only |                no | no                  |
| Other OpenAI-compatible runtimes |       planned |                — |             — |                                    — |                 — | —                   |

Provider addresses are pinned to loopback; no connection to external URL or LAN in this scaffold.
Each built-in adapter exposes manifest contract `1.0.0`. Ollama and LM Studio declare explicit
process takeover and no external credentials; LM Studio also declares OS-protected write-only token
storage. llama.cpp declares no server control or credential storage. Every adapter denies model-file
deletion and inference-content access. The live authority shown by Pulse is evaluated separately.
No process manager or launch-daemon/service setting is changed.
`ollama serve` binary must be installed/available; inability to spawn is presented as an error.
LM Studio lifecycle commands use the resolved machine-local `lms` executable with fixed arguments
and no shell. On explicit start, Pulse calls `lms daemon up --json` only when
`lms daemon status --json` reports no daemon, then tracks the returned PID. This CLI may open the
GUI service (`isDaemon:false`); Stop/quit terminate its verified process tree. A headless daemon
uses `lms daemon down` only when a fresh status confirms the same PID. A pre-existing server remains
external until the user explicitly takes control; Pulse then records the unique listener PID and
process identity. Stop/quit closes that process tree, while Release leaves it running. Ambiguous
listener ownership disables takeover. `lms` installation and removal remain external.
LM Studio model load/unload uses only its native v1 loopback API. An unload is refused when a model
has multiple loaded instances because the current UI selects the model key, not a specific instance.
LM Studio bearer tokens can be configured through write-only IPC and are attached to every native
v1 request. The saved token is OS-encrypted and never readable back through the UI; missing and
rejected/under-permissioned credentials remain distinct errors. Tokens and permissions are created
and managed in LM Studio, not by Pulse. See the official
[LM Studio authentication guide](https://lmstudio.ai/docs/developer/core/authentication).
Its manual benchmark calls native `/api/v1/chat` with `store:false`, discards output immediately and
keeps only input/output counts, provider-reported decode speed and first-token latency. LM Studio v1
does not report prefill speed in this response, so that value remains unavailable.

The llama.cpp adapter is pinned to the official default `http://127.0.0.1:9931`. It checks
`GET /health` and reads the currently loaded model from `GET /v1/models`. It does not inspect the
model cache, use `/models`, send inference, accept an API key, execute the CLI, discover a process or
expose lifecycle/model controls. Custom ports and authenticated servers are not supported yet.

MLX-LM is disabled by default and becomes reachable only after the user enables it in runtime
visibility. It is pinned to `http://127.0.0.1:8080/v1/models`. That endpoint is treated as an
available-model catalog, not evidence of loaded residency. Pulse sends no inference, executes no
Python/CLI, accepts no credential and exposes no lifecycle or model-management action.

Follow upstream API contracts, do not scrape provider UIs:

- https://docs.ollama.com/api/ps
- https://docs.ollama.com/api/generate
- https://lmstudio.ai/docs/developer/rest
- https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md
