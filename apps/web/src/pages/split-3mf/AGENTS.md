# FormaSplit 3MF page guide

- Keep this route wrapped in `AdminGuard`; never add a public alias.
- Preserve material/color regions during 3MF import and export.
- Geometry preview and downloaded files are separate paths; test both.
- Keep camera/orbit state when smoothing or splitting; reframe only after import/reset.
- Imported models stay local to the browser. Do not upload them to an API.
