# AGENTS.md — apps/desktop

Read `../../AGENTS.md` and `../../../AGENTS.md` when present.

Electron main composes injected application and adapters, never owns performance formulas. Renderer
may invoke only narrow preload methods, no native modules/HTTP clients/process APIs. Electron must
use context isolation, sandboxed renderer, no Node integration, strict payload validation. The app
never controls an external Ollama process it did not spawn. It may stop a pre-existing LM Studio
server only after an explicit current-session handover and confirmation through the narrow typed
control path. LM Studio server control never implies ownership of its GUI or daemon process, and
delegated control never triggers shutdown on app exit. Never claim benchmark readings to be live external usage. Hide-to-tray and
always-on-top settings must never trap the user in an overlay.
The user may explicitly release LM Studio server control without stopping it; the UI must confirm
that action and immediately show observation-only state.
Runtime credentials are Restricted. The renderer may submit an LM Studio token through one narrow
write-only IPC method and query non-secret status; it must never retrieve, log or persist the token.
Electron main must refuse persistence when OS-protected storage is unavailable or weak.
The settings surface must present adapter capabilities separately from current control authority and
use only the typed versioned manifest; it must not infer permissions from server reachability.
The expanded monitor is reserved for runtime/model operations, resource history and KPIs. Appearance,
runtime visibility, credentials, instrumentation setup/history and capability/permission detail stay
behind the settings control, which expands the window before rendering settings.
The runtime control center observes every enabled adapter but must keep selection, state, authority,
models, process metrics, errors and actions isolated per runtime. One failed adapter must not erase
healthy runtime cards. Card actions use typed runtime IDs through narrow IPC and never infer control.
The built-in llama.cpp adapter may only observe health and the loaded model at `127.0.0.1:9931`;
its UI controls remain disabled because reachability never grants process or model authority.
MLX-LM is disabled by default and may only be enabled explicitly through runtime visibility. Its
`/v1/models` entries are available models and must never be presented as loaded observations.

Brand files live in `src/renderer/assets/brand`. `onblank-logo.png` is the owner-provided corporate
mark; the OB-Pulse product logo remains provisional pending approved product artwork. App packaging
is prepared, not yet signed/tested on target OSes.
