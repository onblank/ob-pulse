# AGENTS.md — packages/runtime-lmstudio

Read `../../AGENTS.md` and, if available, workspace-level `../../../AGENTS.md`.

Scope: LM Studio v1 infrastructure adapter only; nullable response parsing, explicit model
load/unload and user-invoked benchmark through the native loopback REST API. Benchmarks use a fixed
synthetic prompt, request `store:false`, discard generated output and retain numeric stats only. On
an explicit start, the machine-local `lms` CLI may start headless `llmster` only after confirming
that no daemon is running. Track the PID returned by `lms daemon up --json`; run `lms daemon down`
only while `lms daemon status --json` confirms that same PID. If a daemon already exists, Pulse may
start a server toggle and capture its listener process identity. A reachable external server may receive explicit
`Take control` after Pulse resolves the unique loopback listener to one process identity. Stop or
app quit may then terminate that verified process and its LM Studio app descendants. `Release
control` leaves the adopted process tree alive. Invoke only the resolved `~/.lmstudio/bin/lms`
executable with fixed arguments and no shell. Releasing Pulse-owned daemon control clears its
ownership without invoking the lifecycle CLI, leaving the daemon running.
Bearer authentication may use only an explicitly supplied in-memory token. Add it to native v1
requests, never expose/log it, and distinguish missing from rejected credentials without echoing the
secret. Never infer takeover, kill by process name alone, stop an unadopted daemon or unload an
ambiguous model instance. Only an explicitly adopted, PID-verified process may be terminated.
Its manifest describes explicit process takeover and OS-protected write-only credentials; model
deletion and inference-content access remain prohibited.

The repository's privacy, ownership, process lifecycle, truthful-metrics and Clean Architecture policies remain authoritative.
