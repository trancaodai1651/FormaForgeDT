# Model Maker verification — 2026-10-16

## MakerWorld feature audit — 2026-10-17

Compared the live protected MakerWorld customizer with the workspace route `/#/parametric-model-maker`. All 27 controls for the selected wavy-text model are represented, and the source preset in `DEFAULT_WAVY` matches the observed text, font, numeric values, quality, part selection, and White / Hot Pink colors. The open browser tab showed a locally saved customization (Fast, Blue / Light Pink), which explains its current difference from MakerWorld's Balanced, White / Hot Pink preset; opening a saved project preserves those edits.

Matched the source's 16 sliders and Word Space number stepper, and expanded the printer menu to the 14 observed profiles plus custom. Printer build areas now keep separate width and depth in the viewer, fit warning, and 3MF placement.

The main model workflow is implemented locally, but the UI and service are not identical to MakerWorld: MakerWorld model metadata/community history and server/license-gated export are not reproduced. More importantly, the source SCAD is protected, so the native geometry is an independent reconstruction; exact formula, mesh, and visual parity cannot be verified or claimed. The route is already linked from the public tools hub and is included in the Pages web build.

## UI and circular-fit follow-up — 2026-10-17

Reduced the inspector width with a viewport-based 320–430 px clamp, removed the duplicate model title from the canvas, and moved print-bed/grid controls into a compact top-right overlay. Numeric controls now place the editable value before the slider, matching the reference interaction order. The default orthographic framing is slightly closer.

Restored chord-based circular fitting after the row-arc experiment broke the expected gaps at the circular edges. In the production browser, the saved three-line model regenerated at 40 × 40 × 4.88 mm with 89,744 triangles across two parts. Geometry feature tests passed 12/12; monorepo typecheck and web production build passed. The app's exact 3MF download is still unavailable in the shared Downloads folder, so this latest mesh was not independently checked by the export validator. Exact parity remains limited by the protected upstream SCAD.

## Production and dialog follow-up — 2026-10-17

On the final production bundle at 1280 × 720, the saved wavy-text project auto-generated on open with the source preset: 40 × 40 × 4.88 mm, 91,094 triangles, two parts. The export dialog now uses readable dark text and controls on its white surface; the 3MF, merged STL and split STL ZIP choices were visible. Choosing 3MF showed the app's successful export message. The browser download did not appear in the shared Downloads folder, so this exact latest 3MF could not be passed to `validate-parametric-export.mjs`; the older artifact validation below remains historical and is not evidence for the current mesh.

The opened MakerWorld page and current preview were compared directly. They share the reference's default values and three-line arrangement, while the protected SCAD formula is unavailable for exact shape parity. Web typecheck and production build passed. `git diff --check` passed. No test suite was run in this follow-up.

## Reference and layout follow-up — 2026-10-17

Reopened the logged-in protected MakerWorld reference and compared it with the live development preview. It confirms the source's three curved rows, tangent-rotated chunky letters, 40 mm disk, Lilita One, White base and Hot Pink text. The source SCAD remains protected, so the implementation can match observed appearance and exposed controls but cannot claim formula-level or exact-mesh parity.

The latest geometry recenters each row after tangent rotation to correct horizontal drift, preserves the layout's glyph spacing, and scales a complete row uniformly only if it crosses the configured circular margin. Preview and export consume the same generated meshes. The first preview of a wavy project is generated automatically when it is opened; SCAD compilation remains user-triggered.

The active editor now has one project toolbar; the back-to-library control replaces its duplicate library action. The preview was enlarged for its panel, toolbar labels and parameter headings were made clearer, and the narrow layout keeps the preview above the inspector with touch-sized actions. Final typecheck, production build, and browser verification are recorded under the latest follow-up below.

## Visual and first-open follow-up — 2026-10-17

Removed the glyph-anchor compression that caused chunky neighboring letters to collide after tangent rotation. Preserved each glyph's original layout spacing, recentered the completed row, and added an inward proportional correction for a complete row only when its radial extent exceeds the configured circular margin. Moved the persistent generate/update action to the inspector footer so it stays available while controls scroll. Wavy projects now create their first preview on open to match the reference's immediately visible model. Protected MakerWorld source code is unavailable, so this improves the observed shape and interaction without claiming exact SCAD or mesh parity.

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

The editor now uses a compact two-row toolbar, a dark 430 px parameter inspector on the left, and a gray model preview on the right. At 1440 × 900, the document stays one screen tall; scrolling the parameter panel leaves document scroll at zero and the preview in place. At 768 × 1024 and 390 × 844, the inspector and preview return to normal page scrolling with no horizontal overflow. Main input groups start open, with the less frequent base, quality, and color groups collapsed. The default camera is a shallow orthographic view and the disk fills about two thirds of the preview height, matching the MakerWorld reference framing while keeping the raised letters visible. The saved screenshot below documents the earlier geometry correction and does not show this latest workspace styling.

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
