# Parametric Model Maker

Public route: `/#/parametric-model-maker` (also `/admin/parametric-model-maker`).
Independent of the existing ParamaCraft workspace. Launch from the public tools hub.

## Features

- Native circular wavy text: all 27 observed controls plus continuous smoothing, corner fillets and Image keyring settings, seven bundled fonts, independent base/text colors, custom palette, quality and part selection.
- OpenSCAD editor: syntax highlighting, completion, search, code undo, Ctrl+Enter generation; auto-generated forms for strings, numbers, ranges, lists, vectors, booleans, fonts, colors and input files.
- Seven library packages, include insertion, local SCAD/STL/SVG/PNG/font uploads and folder imports retaining relative paths.
- Searchable Google Fonts catalog (3,894 actual font files in the bundled snapshot). Selecting a font downloads its TTF and license from the pinned Google Fonts commit. These files are saved with the project; the bundled seven work without this download.
- Named projects, favorite projects/history entries, search/category/sort, IndexedDB autosave, 30 generation snapshots, parameter undo/redo/reset, JSON project backup/import including assets.
- Z-up Three.js preview, orbit/pan/pinch, view presets, wireframe, printer profiles matching the observed MakerWorld list, rectangular build plates and custom width/depth. Geometry changes preserve the camera.
- Binary STL union, ZIP of individual STL parts, standard multi-material 3MF with one assembly, independent materials and slicer flush metadata. Desktop saves use the shared Tauri-aware `downloadFile` helper.
- Responsive phone/tablet/desktop layout, visible dirty state, disabled stale exports, generation cancellation and a 120-second OpenSCAD timeout.

## Geometry and compilation

`wavyGeometry.ts` gives each character a cell and centers its native font advance. **Làm mượt thành và mép chữ** is enabled by default: densely sampled outlines are deformed continuously instead of assigning a constant warp to each vertical strip. XY corner opening rounds convex corners; the top fillet uses a continuous bevel mesh. Simplification tolerance is 0.008 / 0.003 / 0.001 mm for Fast / Balanced / Fine, reducing redundant triangles without restoring the staircase. This changes printable geometry, not just normals. Turning smoothing off retains the measured 48-strip Balanced reference mode. Spaces use weighted cells; glyph size and letter spacing remain editable. Numerical islands smaller than 0.0001 mm² are discarded.

`wavyLayout.ts` contains column-height/baseline coefficients fitted to the user-supplied three-line TRAN / CAO / DAI mesh. Other text still uses actual font outlines; no reference mesh or fixed letter shapes are embedded. The fit is a calibration of this observed preset, not the protected SCAD formula. One/two-line layouts and other parameter combinations remain independently implemented and have not been verified against corresponding MakerWorld exports.

Text height is measured above the base. Text Embed adds material below its surface, rather than lowering the visible top. Smooth mode ends at Base Depth + Text Height (5 mm for the default). The optional reference mode uses the five measured overlapping offset layers, resulting in 5.005 mm. The base subtracts the text volume to partition colors without overlap while retaining a continuous substrate. Preview and export consume the same meshes. Orbit/pan/zoom survives rebuilds.

## Image keyring

The **Móc khóa** group reuses `clicker/geometry/geometry/imageKeyring.ts` through a small page adapter. It is the same round loop, long bridge, angular position, tangential slide and 3–16 mm bore as Clicker Lab Image. Tab thickness follows Base Depth by default, including existing projects and changes to the base. Turn off **Độ dày móc bằng nền** to adjust it separately from 0.1–6 mm. A short 0.8 mm neck overlaps the base rim; the inward bridge is trimmed so it does not cover the letters. The tab is fused into the base material, and text keeps its separate material. Base Only includes the attachment; Text Only excludes it. The attachment travels through STL, 3MF, ZIP, project backups, autosave and undo/redo with the other model geometry/settings.

The builder rejects a missing base or a placement with no usable connection, rather than exporting a detached tab. Existing projects receive the new smoothing and disabled-keyring defaults when opened; their text, colors and existing dimensions are preserved. Keyring controls appear when the feature is enabled.

When saved parameters differ, the panel offers the observed reference preset. Matching settings do not show a redundant status card. **Dùng thông số tham chiếu** restores the complete preset, including White / Hot Pink and Balanced, through normal undo history. Wavy projects generate their first preview when opened; SCAD projects retain explicit generation. A persistent generate/update action stays at the bottom of the inspector, including while the user scrolls parameters or switches to code and files. Opening a saved project does not silently overwrite custom values.

The page-local `workspace-ui.css` maps Model Maker to the existing Creator Hub theme tokens: navy surfaces, red actions, rounded cards, readable fields and shared light/dark colors. Library cards, editor controls and dialogs use the same palette. Parameter search matches Vietnamese labels and groups with or without accents; matching groups open automatically and empty results offer guidance. Reference settings are collapsed by default. Selecting text or base in the 3D preview clears the search and opens its color group. On desktop above 980 px, the inspector and preview fill the workspace with an independently scrolling form. At phone and portrait-tablet widths, the preview appears first and the form uses normal page scrolling; inspector tabs and Generate stay reachable while scrolling. The mobile toolbar retains labeled Export and accessible icon actions without horizontal overflow. The transparent WebGL canvas inherits the themed preview surface; initial framing is tighter while rebuilds still preserve orbit/pan/zoom.

Wavy generation also runs in its own worker (`wavyRuntime.ts` / `wavy.worker.ts`), keeping the UI responsive and allowing cancellation during geometry construction. Asset roots are passed from the page so both subpath hosting and relative desktop URLs resolve correctly.

The upstream WebAssembly build does not enable 3MF export or the Manifold backend. `scad.worker.ts` therefore compiles evaluated CSG, partitions materials in `csgMaterials.ts`, then renders each region through OpenSCAD OFF output. This preserves transforms and cutters. Earlier materials win overlapping union volumes; subtraction/intersection take the first operand's material, and hull/minkowski take the first child's material. These operations do not interpolate colors. A new compiler instance is required for each phase because this upstream C++ main cannot safely run twice. Everything runs locally in a cancellable worker; user SCAD is never evaluated as JavaScript or uploaded.

## Reference boundary

Reference survey: `docs/references/makerworld-wavy-popsocket/README.md`. The protected MakerWorld model's SCAD code was not available. On 19 October 2026 the user supplied both actual 3MF files. Matching parameters had produced only about 30.7% XY footprint intersection-over-union with the reference. The optional stepped reference mode raised this to about 98.5% at 0.025 mm raster resolution, with 0.019 mm mean boundary distance. This is one cross section of one preset, not 100% mesh or parameter parity. See the measured comparison in the reference survey. The sample is a decorative circular topper, not a mechanical phone grip. MakerWorld accounts, cloud/community services and its private model/font collection are not copied; this workspace provides local project storage and an open font catalog.

## Assets and licenses

Run `node scripts/sync-parametric-maker-assets.mjs` from the repository root to refresh redistributable assets. Commit the resulting manifest and assets together. `public/parametric-maker-assets/manifest.json` records upstream runtime URLs, library commits and sources; `font-catalog.json` records the Google Fonts commit. Licenses are retained next to bundled fonts, in library archives, and as `COPYING-OpenSCAD`. OpenSCAD source/build instructions: https://github.com/openscad/openscad-wasm and https://github.com/openscad/openscad (upstream runtime build recorded in the manifest). Imported and downloaded fonts travel with JSON project backups.

## Validation

`corepack pnpm --filter @hometown/geometry exec vitest run test/parametricModelMaker.test.ts`

Tests also verify continuous wall outlines, fillet Z levels, connected Image keyrings, open bores, placement errors, persisted export settings and closed STL/3MF geometry. The regression fixture stores only scalar measurements and 12 scan-line probes from the supplied reference, identified by SHA-256; it does not distribute the original mesh. Generated boundaries must stay within 0.25 mm of these probes and overall height within 0.0001 mm. Tests cover parsing without code evaluation, vector ranges, independent colors, closed meshes, zero material overlap, substrate/text Z bounds, dimensions, STL union, 3MF assembly/material metadata and part selection. The 3MF package XML is parsed with a namespace-aware XML parser, including names containing reserved characters. This catches malformed component hierarchies before a slicer opens the file. Browser verification must also cover actual SCAD compilation, font/file imports, downloads, camera preservation and responsive layouts. A passing build alone is insufficient.
