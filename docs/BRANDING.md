# Brand system — OB-Pulse

Canonical palette copied from the independent OB-Tracker brand reference and verified in its CSS:

- Navy `#182332` — primary dark surface
- Blue `#5C6BFF` — interaction/brand blue
- Cloud White `#F7F8FC` — typography/light surfaces
- Soft Blue Gray `#DCEBFF` — subtle text
- Graphite `#2D3645` — panels
- Signal Lime `#B8FFD8` — positive/live signal

Use **HEX** as the source of truth, not inconsistent source-document RGB annotations. Font stack: `Inter` if locally installed; system sans-serif fallback. Do not fetch remote fonts.

Provisional product: **OB-Pulse** / subtitle **Local AI Monitor**. The logo is a project-specific placeholder: pulse/wave symbol in the corporate palette. Footer: "by onBlank Systems". It must be possible to replace these in-place assets without CSS changes:

```
apps/desktop/src/renderer/assets/brand/onblank-logo.svg
apps/desktop/src/renderer/assets/brand/ob-pulse-logo.svg
apps/desktop/src/renderer/assets/brand/powered-by-onblank.svg
```

Official onBlank branding may only be added after owner approval. Separate code license and trademark rights. App icon files for `.icns`, `.ico` and `.png` also require owner approval before official signing/release.
