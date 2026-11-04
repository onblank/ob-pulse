# Provider support matrix (v0.1 scaffold)

| Provider                         | Detect server | Installed models | Loaded models |         Start/stop server | Load/unload model | Speeds              |
| -------------------------------- | ------------: | ---------------: | ------------: | ------------------------: | ----------------: | ------------------- |
| Ollama                           |           yes |              yes |           yes |     managed instance only |               yes | explicit local test |
| LM Studio v1                     |           yes |        yes (API) |     yes (API) | owned or delegated server |         yes (API) | explicit local test |
| llama.cpp server                 |           yes |               no |           yes |          observation only |                no | no                  |
| MLX server                       |       planned |                — |             — |                         — |                 — | —                   |
| Other OpenAI-compatible runtimes |       planned |                — |             — |                         — |                 — | —                   |

Provider addresses are pinned to loopback; no connection to external URL or LAN in this scaffold.
Each built-in adapter exposes manifest contract `1.0.0`. Ollama declares owned-child process control
and no credential storage; LM Studio declares provider-server-toggle control and OS-protected
write-only credentials. llama.cpp declares no server control or credential storage. All three
explicitly deny external-process termination, model-file deletion and inference-content access. The
live authority shown by Pulse is evaluated separately.
No process manager or launch-daemon/service setting is changed.
`ollama serve` binary must be installed/available; inability to spawn is presented as an error.
LM Studio server start uses the resolved machine-local `lms` executable with fixed loopback
arguments and no shell. Pulse may stop a server it enabled or a reachable server whose control the
user explicitly delegates for the current Pulse session. Delegation is released without stopping
that server on app exit. Pulse can also explicitly release session-owned or delegated server
control without invoking the lifecycle CLI, leaving the server running in observation-only mode.
The CLI may wake the LM Studio app, but Pulse neither closes that app nor invokes `daemon down`; no
LM Studio process PID is attributed to Pulse. `lms` installation and removal remain external.
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

Follow upstream API contracts, do not scrape provider UIs:

- https://docs.ollama.com/api/ps
- https://docs.ollama.com/api/generate
- https://lmstudio.ai/docs/developer/rest
