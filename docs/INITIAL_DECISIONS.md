# Initial architecture decisions / confirmation register

No clarification blocked this scaffold. Decisions recorded for owner approval before public launch:

| ID    | Decision                                                                           | Status                                          |
| ----- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| D-001 | Provisional name **OB-Pulse**, repo `onblank/ob-pulse`                             | suggested, owner to confirm                     |
| D-002 | Independent pnpm/Turbo + Electron 44 + React + TS                                  | scaffolded                                      |
| D-003 | Local loopback only; no cloud dependency, auth or app telemetry                    | enforced in scaffold architecture               |
| D-004 | Only manage child servers started by OB-Pulse; never kill external services        | implemented for Ollama                          |
| D-005 | Context usage/speed from client integrations or explicit benchmark, never invented | documented + benchmark implemented              |
| D-006 | Default compact widget + tray, always-on-top opt-in                                | scaffolded                                      |
| D-007 | Code Apache-2.0, protected trademarks, local placeholder art                       | scaffolded, final legal/artwork review required |
| D-008 | Official installers via GitHub Releases after native QA/signing                    | planned                                         |
| D-009 | Local history SQLite opt-in, no prompt contents                                    | planned                                         |
| D-010 | Provider adapters built-in/static, plugin ABI after threat model                   | planned                                         |

**External requirement**: global onBlank workspace instructions `../AGENTS.md` are referenced by
all repositories but are not represented by a root repository in the GitHub list. Owner must attach
or review that file before privacy, integration, branding and release decisions are finalized.
