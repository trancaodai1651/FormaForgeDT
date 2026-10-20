# Product Studio verification — 2026-10-20

## Automated and build checks

- `corepack pnpm typecheck`: passed across types, geometry, web and API.
- `corepack pnpm test`: 12 files passed, 225 tests passed and one pre-existing skip;
  the two subsequent circular-QR/magnet dimension regressions also passed.
- Twelve separate MX caps and the three existing clicker defaults passed. Two
  CSP adapter regressions pass, including a real Manifold process started with
  `--disallow-code-generation-from-strings`.
- The Product Studio inventory covers 95 presets and 23 families. Each default
  export is reimported into Manifold to verify positive closed geometry and Z=0.
- Advanced variants include circular/friction/magnet frames, X/Y/Z bead bores,
  segmented trays, woven basket floors, vase lattices, ring-pull boxes, brayer and
  spinning axles, solid-back stamps, stencil bridges/handle, angled hanging tabs,
  front/reverse QR, seeded roller patterns and calibration round trips.
- `corepack pnpm --filter @hometown/web build`: passed. Existing dependency
  externalisation and large-chunk notices remain; rendering and worker operations
  are checked separately in the browser.
- `corepack pnpm build:market-reader` and `validate:market-reader`: passed. The
  generated ZIP is excluded from this source change.

## Browser checks

The actual workspace was exercised at `127.0.0.1:5176/#/product-studio` in the
in-app browser, including a 390 × 844 phone and 1024 × 768 tablet viewport.

- Model fits the phone screen; model/edit navigation and inspector scrolling work.
  Tablet has no horizontal page overflow (`scrollWidth === innerWidth === 1024`).
- Language switching and bilingual catalog/search work. All 95 presets are present
  under seven translated categories.
- A real stroke SVG (snowflake) created independently editable regions and rendered
  as printable relief. Raster input was cropped, vertically flipped and traced
  into selectable components.
- A generated PNG QR containing `https://example.com/qa?demo=1` was imported through
  the file chooser and decoded to the exact payload on the device.
- Exported `Name Keychain.3mf`: two meshes, 39,670 triangles, separate blue/white
  material assignments and embedded Product Studio project with `lato-regular`.
- Exported `Name Keychain.stl`: 21,228 triangles, correct binary STL length,
  31,842 geometric edges all used exactly twice, no degenerate triangles and
  positive signed volume. The verification compares exact stored float coordinates.
- Full JSON was exported, an artwork was added, and that JSON was imported again;
  the original two-part, two-colour model was restored.
- A CSV with Alice × 2 and Bob × 1 produced one plate containing exactly three
  items and the correct order IDs/copy numbers in `manifest.csv`. The ZIP includes
  `plate-1.3mf`, `manifest.csv`, `settings.json` and `orders.csv`. All vertices fit
  the selected 256 mm bed, within the configured 5 mm margin.
- The production build renders at 360 × 800 with no horizontal overflow, and its
  light/dark interface and English labels work. Both phone and tablet screenshots
  are saved in the local `FormaForgeDT-Product-Studio-QA` download folder.
- A desktop-mode bundle was served with the exact desktop CSP. This exposed the
  upstream Embind dynamic-invoker failure. The static-binding adapter fixes it;
  the same bundle now renders 39,670 triangles and exports the real merged STL
  under that CSP, with JavaScript string evaluation still blocked.
- `corepack pnpm tauri:build --bundles nsis --ci` completed a Windows x64 NSIS
  installer. The final tagged CI rebuild includes the static-binding adapter.

These checks establish working native workflows. They do not establish identical
provider meshes/artwork, a hardware camera session, physical print fit, or provider
account/subscription services.
