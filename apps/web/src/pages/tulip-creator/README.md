# Tulip Creator

Admin-only lamp-shade generator inspired by the Tulip Creator reference
at `shaperlab.es/apps/tulip-creator`.

- `TulipCreatorPage.tsx` owns the controls, Three.js preview and STL export.
- `tulip-creator.css` owns the page-local dark workspace styling.
- The route is `/admin/tulip-creator` and is protected by the existing admin guard.
- Page copy follows the shared VN/EN `LanguageProvider`; it has no private language state.
