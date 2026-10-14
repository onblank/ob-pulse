# Contributing to OB-Pulse

1. Read root `AGENTS.md`, nearest scope `AGENTS.md`, `docs/SECURITY.md` and `docs/METRICS.md`.
2. Branch from current `dev`; do not commit directly to protected branches.
3. `pnpm install` on Node 24; run `pnpm check` before a PR.
4. Conventional Commits: `feat(ollama): ...`, `fix(monitor): ...`, `docs(metrics): ...`.
5. Add adapter contract tests (including failures and null/no-data semantics) for providers.
6. Do not commit production logos, credentials, prompts/completions, tokens or private usage logs.
7. No cross-product package dependencies; respect product ownership.
