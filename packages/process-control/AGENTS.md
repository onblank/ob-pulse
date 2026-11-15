# AGENTS.md — packages/process-control

This package is the main-process-only OS boundary for explicit runtime process adoption. It may
resolve a fixed loopback port to one PID, capture PID plus creation time/executable identity and
terminate that process tree only after the adapter confirms provider identity and user authority.

Use fixed executable paths and argument arrays; never use a shell, process-name-only matching,
renderer access, persisted PID ownership or fallback guesses. Refuse missing, ambiguous or changed
identity. Keep provider-specific matching in the runtime adapter and do not broaden the supported
process scope without updating the capability manifest and security documentation.
