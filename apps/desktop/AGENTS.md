# AGENTS.md — apps/desktop

Read `../../AGENTS.md` and `../../../AGENTS.md` when present.

Electron main composes injected application and adapters, never owns performance formulas. Renderer
may invoke only narrow preload methods, no native modules/HTTP clients/process APIs. Electron must
use context isolation, sandboxed renderer, no Node integration, strict payload validation. The app
never controls an external Ollama process it did not spawn. Never claim benchmark readings to be
live external usage. Hide-to-tray and always-on-top settings must never trap the user in an overlay.

Brand files in `src/renderer/assets/brand` are local placeholders and must be replaced with approved
onBlank artwork before release. App packaging is prepared, not yet signed/tested on target OSes.
