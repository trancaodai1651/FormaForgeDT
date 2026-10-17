# Model Maker verification — 2026-10-16

## Reference default correction (latest)

Rechecked the logged-in MakerWorld page against the user's two screenshots. The numeric preset already matched: diameter 40, margin 1.5, row spacing 0.9, letter spacing 0.15, word space 35, width fill 94, round warp and glyph dimensions 100, wave enabled / 2.5 / 1 / 0 / 40, base 1, text 4, embed 0.12 and rounding 0.15. Font is Lilita One, quality Balanced, parts Both, base White and text Hot Pink. Color names were observed; exact vendor RGB values were not exposed by the page.

The saved `Model Maker Demo` had three different fields (quality, base color, text color). Applied the new reference-preset action, verified Undo restored those three differences, reapplied and generated in the existing production browser tab. Custom projects are not silently reset.

Corrected horizontal squeezing by fitting row heights to circular chords, centered actual outline bounds, corrected outer-edge wave influence and contained beveled text inside the base. Both preview and exports use this geometry. The wavy preview now uses orthographic projection so text height cannot enlarge its apparent footprint relative to the base.

Latest gates: web typecheck and production build passed; full suite **96 passed, one existing fixture-dependent skip**, including 12 feature tests. The new regression checks vertical circular fitting, row gaps, wave edge influence, preset appearance and radial containment alongside the existing closed-solid/export checks.

Exact production browser download `Model Maker Demo (2).3mf`, validated by `scripts/validate-parametric-export.mjs`:

- One assembly, two closed parts, zero bad edges.
- Base: 8,544 triangles, bounds −20…20 in X/Y, Z 0…1 mm.
- Text: 95,144 triangles, X ±17.39, Y −18.676…18.671, Z 0.88…4.88 mm.
- Material overlap: 0.000000443 mm³ (numeric residue).
- Preview total: 103,688 triangles, 40 × 40 × 4.88 mm, White / Hot Pink.

[Corrected reference preset](reference-defaults-fixed.jpg). This is an independent reconstruction; the protected source formula and physical slicer/print parity remain unverified. The sections below record the earlier feature baseline and its historical artifacts.

The editor now stays within the available desktop height, keeps the model visible, and scrolls its inspector independently. At 1440 × 900, the document stays one screen tall; scrolling the parameter panel leaves document scroll at zero and the preview in place. At 768 × 1024 and 390 × 844, the inspector and preview return to normal page scrolling with no horizontal overflow. Main input groups start open, with the less frequent base, quality, and color groups collapsed. The default camera is a shallow three-quarter orthographic view with a wider initial framing to show the raised letters at a reference-like scale without perspective size distortion. [The current production view](reference-defaults-fixed.jpg).

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
