# Parametric Model Maker

Public route: `/#/parametric-model-maker` (also `/admin/parametric-model-maker`).
Independent of the existing ParamaCraft workspace. Launch from the public tools hub.

## Features

- Native circular wavy text: all 27 observed controls, seven bundled fonts, independent base/text colors, custom palette, quality and part selection.
- OpenSCAD editor: syntax highlighting, completion, search, code undo, Ctrl+Enter generation; auto-generated forms for strings, numbers, ranges, lists, vectors, booleans, fonts, colors and input files.
- Seven library packages, include insertion, local SCAD/STL/SVG/PNG/font uploads and folder imports retaining relative paths.
- Searchable Google Fonts catalog (3,894 actual font files in the bundled snapshot). Selecting a font downloads its TTF and license from the pinned Google Fonts commit. These files are saved with the project; the bundled seven work without this download.
- Named projects, favorite projects/history entries, search/category/sort, IndexedDB autosave, 30 generation snapshots, parameter undo/redo/reset, JSON project backup/import including assets.
- Z-up Three.js preview, orbit/pan/pinch, view presets, wireframe, plate/printer selection and custom square plate size. Geometry changes preserve the camera.
- Binary STL union, ZIP of individual STL parts, standard multi-material 3MF with one assembly, independent materials and slicer flush metadata. Desktop saves use the shared Tauri-aware `downloadFile` helper.
- Responsive phone/tablet/desktop layout, visible dirty state, disabled stale exports, generation cancellation and a 120-second OpenSCAD timeout.

## Geometry and compilation

`wavyGeometry.ts` uses font outlines and Manifold to create closed solids. Each glyph is positioned on a curved row baseline and rotated to follow its local tangent; wave displacement applies to the glyph anchor so chunky letter shapes keep their proportions. The text is embedded into the base; subtracting the text from the base partitions color volumes without overlap and leaves a continuous substrate. Preview and export consume the same meshes.

`wavyLayout.ts` lays out row centers along a shallow circular arc and retains flat row height. Outline bounds, rather than font advance widths, center the ink. Glyphs rotate to the local arc tangent, keep their designed spacing, and each row is recentered after rotation. A row is proportionally scaled only when its radial extent crosses the configured circular margin, preserving letter size balance; the final intersection with the base outline also prevents geometry from extending beyond the disk. The top/bottom percentage controls wave amplitude at its outer edges. Rounded solids are clipped to the base outline after beveling. The wavy viewer uses an orthographic camera with a shallow three-quarter starting view, and retains the camera through parameter rebuilds.

The parameter panel compares saved projects with the observed reference settings. **Dùng thông số mẫu gốc** restores the complete preset, including White / Hot Pink and Balanced, through normal undo history. Wavy projects generate their first preview when opened; SCAD projects retain explicit generation. A persistent generate/update action stays at the bottom of the inspector, including while the user scrolls parameters or switches to code and files. Opening a saved project does not silently overwrite custom values.

On desktop and wide tablets, the editor fills the screen with one compact project toolbar, a dark parameter inspector on the left, and the model preview on the right. The preview stays in view while the inspector scrolls independently. At phone and portrait-tablet widths, the preview appears before the inspector and both use normal page scrolling; toolbar actions remain reachable with horizontal scrolling.

Wavy generation also runs in its own worker (`wavyRuntime.ts` / `wavy.worker.ts`), keeping the UI responsive and allowing cancellation during geometry construction. Asset roots are passed from the page so both subpath hosting and relative desktop URLs resolve correctly.

The upstream WebAssembly build does not enable 3MF export or the Manifold backend. `scad.worker.ts` therefore compiles evaluated CSG, partitions materials in `csgMaterials.ts`, then renders each region through OpenSCAD OFF output. This preserves transforms and cutters. Earlier materials win overlapping union volumes; subtraction/intersection take the first operand's material, and hull/minkowski take the first child's material. These operations do not interpolate colors. A new compiler instance is required for each phase because this upstream C++ main cannot safely run twice. Everything runs locally in a cancellable worker; user SCAD is never evaluated as JavaScript or uploaded.

## Reference boundary

Reference survey: `docs/references/makerworld-wavy-popsocket/README.md`. The protected MakerWorld model's SCAD code was not available. Wavy geometry is an independent implementation, so exact formula/output parity cannot be guaranteed. The sample is a decorative circular topper, not a mechanical phone grip. MakerWorld accounts, cloud/community services and its private model/font collection are not copied; this workspace provides local project storage and an open font catalog.

## Assets and licenses

Run `node scripts/sync-parametric-maker-assets.mjs` from the repository root to refresh redistributable assets. Commit the resulting manifest and assets together. `public/parametric-maker-assets/manifest.json` records upstream runtime URLs, library commits and sources; `font-catalog.json` records the Google Fonts commit. Licenses are retained next to bundled fonts, in library archives, and as `COPYING-OpenSCAD`. OpenSCAD source/build instructions: https://github.com/openscad/openscad-wasm and https://github.com/openscad/openscad (upstream runtime build recorded in the manifest). Imported and downloaded fonts travel with JSON project backups.

## Validation

`corepack pnpm --filter @hometown/geometry exec vitest run test/parametricModelMaker.test.ts`

Tests cover parsing without code evaluation, vector ranges, independent colors, closed meshes, zero material overlap, substrate/text Z bounds, dimensions, STL union, 3MF assembly/material metadata and part selection. Browser verification must also cover actual SCAD compilation, font/file imports, downloads, camera preservation and responsive layouts. A passing build alone is insufficient.
