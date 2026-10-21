# Planned local SQLite data model (not implemented in scaffold)

Use SQLite migrations in `packages/db-sqlite/migrations/` as needed:

- `001_initials.sql`: reference capabilities/status/unit types (SQLite-compatible)
- `002_functions.sql`: reserved no-op; SQLite functions live in TypeScript
- `003_observations.sql`: devices, runtimes, model identities, per-request summaries, host samples,
  context sessions, context epochs, retention configuration and adapter version metadata

Do **not** store prompts, responses, tool arguments, or account identifiers. Every observation records
source (`host`, `runtime`, `benchmark`, `client_plugin`, `local_proxy`), sampled_at, freshness, and
nullability. Model names are not user identities. Session IDs should be random local UUIDs, never
reuse remote providers' account/user identifiers.

History should be opt-in, bounded (7/30/90 days, configurable) and disabled by default.
Export CSV/JSON only on explicit user action. Deleting history should be irreversible and transactional.

Widget position, opacity and high-contrast preferences are not telemetry and do not justify this
database. They live in a validated machine-local JSON file under Electron `userData`; corrupt or
unsupported values fall back to safe defaults.
