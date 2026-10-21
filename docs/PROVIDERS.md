# Provider support matrix (v0.1 scaffold)

| Provider                         | Detect server | Installed models | Loaded models |     Start/stop server | Load/unload model | Speeds              |
| -------------------------------- | ------------: | ---------------: | ------------: | --------------------: | ----------------: | ------------------- |
| Ollama                           |           yes |              yes |           yes | managed instance only |               yes | explicit local test |
| LM Studio v1                     |           yes |        yes (API) |     yes (API) |  no (external server) |         yes (API) | not instrumented    |
| llama.cpp server                 |       planned |                — |             — |                     — |                 — | —                   |
| MLX server                       |       planned |                — |             — |                     — |                 — | —                   |
| Other OpenAI-compatible runtimes |       planned |                — |             — |                     — |                 — | —                   |

Provider addresses are pinned to loopback; no connection to external URL or LAN in this scaffold.
No process manager or launch-daemon/service setting is changed.
`ollama serve` binary must be installed/available; inability to spawn is presented as an error.
`lms` install/uninstall and service management are **not** yet implemented.
LM Studio model load/unload uses only its native v1 loopback API. An unload is refused when a model
has multiple loaded instances because the current UI selects the model key, not a specific instance.
Servers requiring an API token are detected but cannot yet be configured in OB-Pulse.

Follow upstream API contracts, do not scrape provider UIs:

- https://docs.ollama.com/api/ps
- https://docs.ollama.com/api/generate
- https://lmstudio.ai/docs/developer/rest
