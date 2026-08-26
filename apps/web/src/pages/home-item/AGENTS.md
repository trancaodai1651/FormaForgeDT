# Home Item page boundary

This folder owns the protected `/admin/home-item` parametric home-decor workspace.

- Keep the page, controls, local procedural geometry and export adapters isolated here.
- Preview and STL export must use the same `HomeItemConfig`, with export quality selecting a denser rebuild.
- The page reads the shared `LanguageProvider`; do not introduce a second language store or route this tool publicly.
- Do not place credentials, remote design payloads or generated build artifacts in this folder.
