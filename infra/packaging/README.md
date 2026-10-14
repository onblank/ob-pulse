# Native packaging

Electron-builder config is at `apps/desktop/electron-builder.yml`. This scaffold has no
signed production assets yet. Package builds should happen on their respective OS runners.
The tray PNG in `apps/desktop/assets/` is a development placeholder.

Release gate: app smoke test, no unsigned-dmg claim, CI matrix green, accepted official logos,
identity/license review, installer checksum manifest and GitHub Release approval workflow.
