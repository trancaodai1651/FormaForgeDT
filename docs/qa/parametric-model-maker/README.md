# Model Maker verification — 2026-10-16

## Gates

- Full monorepo typecheck passed.
- Web production build passed, including separate SCAD and wavy workers and a lazy workspace chunk.
- Full geometry suite: 93 passed, one pre-existing fixture-dependent test skipped. Nine tests cover the new feature.
- `git diff --check` passed.

## Browser checks

Chromium in-app browser, both Vite development and production at the `/FormaForgeDT/` subpath. Responsive viewport checks: 390 × 844, 768 × 1024 and 1440 × 1000; no horizontal overflow. These are browser viewport tests, not physical iOS/Android device tests.

- Native wavy text: generated both bundled Lilita One and downloaded Bebas Neue, two independent material colors, quality selection, orbit and view presets. Rebuilding retained the rotated view. Both native and SCAD generation could be cancelled.
- SCAD cylinder with a hole: 20 × 20 × 12 mm, 512 triangles. Changed size disabled stale export; Undo restored the original parameters and export availability.
- Two-color SCAD name tag: 65 × 24 × 3 mm, 2,488 triangles, two material regions.
- BOSL2 rounded cuboid: 24 × 16 × 10 mm, 92 triangles, in both development and final production bundle. Fixed compiler include resolution by mounting libraries at the working directory as well as `/libraries` and setting the environment before C++ startup.
- Uploaded SCAD created a file parameter; uploaded `rectangle.svg` was selected for that parameter and extruded into 20 × 10 × 2 mm, 12 triangles.
- Searched Google Fonts for Bebas, downloaded its TTF and license, generated with it, saved a JSON project and imported it in another local origin. The imported font and geometry regenerated successfully.
- Parameter undo, generation history restoration, project autosave and named project recovery were exercised. Malformed SCAD displayed an error, retained the previous preview and disabled stale exports.
- Corrected the inherited fixed-height app shell within this page boundary. The phone page now scrolls through all parameter groups, with generation controls remaining visible.

## Exact downloaded artifacts

Validated the browser downloads using `scripts/validate-parametric-export.mjs`, not a separately regenerated substitute.

Final production worker export, `Model Maker Demo (1).3mf`:

- One assembly, two closed mesh parts; zero open/non-manifold edges.
- Base: 10,630 triangles, bounds −20…20 mm in X/Y and 0…1 mm in Z.
- Text: 39,816 triangles, bottom Z 0.88 mm, top Z 4.88 mm.
- Intersection volume: approximately 0.000000415 mm³ (floating-point residue).
- Distinct material colors: base `#356CD1`, text `#FF329A`.

The STL download contained 34,940 triangles with the expected binary byte length. The ZIP download contained `01-base.stl` and `02-text.stl`, with 10,630 and 39,816 triangles respectively. The unit suite additionally checks closed STL union topology, material partitioning, single-assembly placement, text-only grounding and slicer flush-array sizes.

Actual Flashforge/Bambu application slicing and physical printing were not performed in this feature task. The proprietary reference SCAD was unavailable, so exact formula parity is not claimed.

## Screenshots

- [Desktop](desktop.jpg)
- [Phone](phone.jpg)
- [Tablet](tablet.jpg)
- [OpenSCAD editor / BOSL2](scad-editor.jpg)
