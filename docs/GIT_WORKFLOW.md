# Git and GitHub workflow

- Repository `onblank/ob-pulse` **not created** by this scaffold.
- Protected development branch `dev`; protected stable release branch `main`.
- New work branches from current `dev`: `feature/*`, `fix/*`, `docs/*`, `refactor/*`, `chore/*`.
- Reviewed PR + required CI into `dev`, then separate reviewed PR `dev` -> `main`.
- Conventional Commits, SemVer and Release Please release PRs.
- Never re-create Release Please's machine-readable PR manually.
- Distribution: GitHub Releases, later `onblanksystems.com/OpenSource` may link/mirror artifacts.
- Release signing credentials stored in Actions secrets, not source.
- Align specific required checks and protection settings with the organization before creating branch rules.
