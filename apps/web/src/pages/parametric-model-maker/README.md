# Parametric Model Maker

Public route: `/#/parametric-model-maker` (also `/admin/parametric-model-maker`).
Independent of the existing ParamaCraft workspace. Launch from the public tools hub.

## Features

- Native circular wavy text: all 27 observed controls, seven bundled fonts, independent base/text colors, custom palette, quality and part selection.
- OpenSCAD editor: syntax highlighting, completion, search, code undo, Ctrl+Enter generation; auto-generated forms for strings, numbers, ranges, lists, vectors, booleans, fonts, colors and input files.
- Seven library packages, include insertion, local SCAD/STL/SVG/PNG/font uploads and folder imports retaining relative paths.
- Searchable Google Fonts catalog (3,894 actual font files in the bundled snapshot). Selecting a font downloads its TTF and license from the pinned Google Fonts commit. These files are saved with the project; the bundled seven work without this download.
- Named projects, favorite projects/history entries, search/category/sort, IndexedDB autosave, 30 generation snapshots, parameter undo/redo/reset, JSON project backup/import including assets.
- Z-up Three.js preview, orbit/pan/pinch, view presets, wireframe, printer profiles matching the observed MakerWorld list, rectangular build plates and custom width/depth. Geometry changes preserve the camera.
- Binary STL union, ZIP of individual STL parts, standard multi-material 3MF with one assembly, independent materials and slicer flush metadata. Desktop saves use the shared Tauri-aware `downloadFile` helper.
- Responsive phone/tablet/desktop layout, visible dirty state, disabled stale exports, generation cancellation and a 120-second OpenSCAD timeout.

## Geometry and compilation

`wavyGeometry.ts` gives each character a cell, centers its native font advance, clips wide glyphs to that cell, and warps vertical strips. The supplied MakerWorld file established the 0.965 outer-row width ratio, 48 strips per cell and 120 base segments for Balanced quality. Fitting a whole word's ink, rotating glyph anchors, or packing/shrinking rows produced a different shape. Spaces use weighted cells; glyph size and letter spacing remain editable. Numerical islands smaller than 0.0001 mm² are discarded.

`wavyLayout.ts` contains column-height/baseline coefficients fitted to the user-supplied three-line TRAN / CAO / DAI mesh. Other text still uses actual font outlines; no reference mesh or fixed letter shapes are embedded. The fit is a calibration of this observed preset, not the protected SCAD formula. One/two-line layouts and other parameter combinations remain independently implemented and have not been verified against corresponding MakerWorld exports.

Text height is measured above the base. Text Embed adds material below its surface, rather than lowering the visible top. The measured top round uses five overlapping offset layers in Balanced quality, with midpoint-sampled circular insets and 0.005 mm overlap; the reference's overall height is consequently 5.005 mm. The base subtracts the text volume to partition colors without overlap while retaining a continuous substrate. Preview and export consume the same meshes. The orthographic initial view occupies about half the viewport height, while Fit gives a closer view. Orbit/pan/zoom survives rebuilds.

When saved parameters differ, the panel offers the observed reference preset. Matching settings do not show a redundant status card. **Dùng thông số tham chiếu** restores the complete preset, including White / Hot Pink and Balanced, through normal undo history. Wavy projects generate their first preview when opened; SCAD projects retain explicit generation. A persistent generate/update action stays at the bottom of the inspector, including while the user scrolls parameters or switches to code and files. Opening a saved project does not silently overwrite custom values.

On desktop and wide tablets, the editor fills the screen with one compact project toolbar, a dark parameter inspector on the left, and the model preview on the right. The preview stays in view while the inspector scrolls independently. At phone and portrait-tablet widths, the preview appears before the inspector and both use normal page scrolling; toolbar actions remain reachable with horizontal scrolling.

Wavy generation also runs in its own worker (`wavyRuntime.ts` / `wavy.worker.ts`), keeping the UI responsive and allowing cancellation during geometry construction. Asset roots are passed from the page so both subpath hosting and relative desktop URLs resolve correctly.

The upstream WebAssembly build does not enable 3MF export or the Manifold backend. `scad.worker.ts` therefore compiles evaluated CSG, partitions materials in `csgMaterials.ts`, then renders each region through OpenSCAD OFF output. This preserves transforms and cutters. Earlier materials win overlapping union volumes; subtraction/intersection take the first operand's material, and hull/minkowski take the first child's material. These operations do not interpolate colors. A new compiler instance is required for each phase because this upstream C++ main cannot safely run twice. Everything runs locally in a cancellable worker; user SCAD is never evaluated as JavaScript or uploaded.

## Reference boundary

Reference survey: `docs/references/makerworld-wavy-popsocket/README.md`. The protected MakerWorld model's SCAD code was not available. On 19 October 2026 the user supplied both actual 3MF files. Matching parameters had produced only about 30.7% XY footprint intersection-over-union with the reference. Calibration raised this to about 98.5% at 0.025 mm raster resolution, with 0.019 mm mean boundary distance. This is one cross section of one preset, not 100% mesh or parameter parity. See the measured comparison in the reference survey. The sample is a decorative circular topper, not a mechanical phone grip. MakerWorld accounts, cloud/community services and its private model/font collection are not copied; this workspace provides local project storage and an open font catalog.

## Assets and licenses

Run `node scripts/sync-parametric-maker-assets.mjs` from the repository root to refresh redistributable assets. Commit the resulting manifest and assets together. `public/parametric-maker-assets/manifest.json` records upstream runtime URLs, library commits and sources; `font-catalog.json` records the Google Fonts commit. Licenses are retained next to bundled fonts, in library archives, and as `COPYING-OpenSCAD`. OpenSCAD source/build instructions: https://github.com/openscad/openscad-wasm and https://github.com/openscad/openscad (upstream runtime build recorded in the manifest). Imported and downloaded fonts travel with JSON project backups.

## Validation

`corepack pnpm --filter @hometown/geometry exec vitest run test/parametricModelMaker.test.ts`

The regression fixture stores only scalar measurements and 12 scan-line probes from the supplied reference, identified by SHA-256; it does not distribute the original mesh. Generated boundaries must stay within 0.25 mm of these probes and overall height within 0.0001 mm. Tests cover parsing without code evaluation, vector ranges, independent colors, closed meshes, zero material overlap, substrate/text Z bounds, dimensions, STL union, 3MF assembly/material metadata and part selection. The 3MF package XML is parsed with a namespace-aware XML parser, including names containing reserved characters. This catches malformed component hierarchies before a slicer opens the file. Browser verification must also cover actual SCAD compilation, font/file imports, downloads, camera preservation and responsive layouts. A passing build alone is insufficient.
