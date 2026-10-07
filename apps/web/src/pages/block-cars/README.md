# Block Cars

Public modular block-car workspace inspired by the 17 model references in the supplied assembly PDF. The supplied PDF has reference renders and parts tables, not CAD; this page rebuilds the vehicles as parametric, printable module geometry. Names describe the visible vehicle types.

- `BlockCarsPage.tsx` owns selection, language, scale, independent cabin/front-equipment module selection, width and clearance controls, exploded/isolated preview, reference comparison, standalone module STL and assembly ZIP downloads. Orbit state is preserved during dimension rebuilds; selecting a different isolated part explicitly fits it.
- `ModuleLibrary.tsx` replaces the vehicle gallery with a three-column parts grid. It renders thumbnails from the actual solid meshes through one temporary WebGL renderer, building between frames. Semantic variants remove repeated wheels, screws and shared bodies, while retaining wheeled/unwheeled frames and different boom/pivot joints. Selecting a cab preserves the current rear equipment; front-tool selection preserves the rear; rear parts switch to their compatible rear assembly. Every part can be isolated, resized through the shared scale, downloaded alone, and viewed in its assembly. The 17 PDF presets remain in a secondary disclosure.
- `carGeometry.ts` owns the page's solid model engine. Manifold unions and differences create actual recesses, ribs, sockets and joints. Shared meshes are cached; flat surfaces have crease normals. Wheels use a closed ring mesh with sidewall grooves and staggered tread.
- `catalog.ts` maps all 17 PDF references to the vehicle modules and colors.
- `printKit.ts` exports solid per-module binary STLs, a printed cross screwdriver, README and assembly JSON. Wheels/screws have different print orientations. The manifest preserves colors and the transforms needed to restore each print mesh into the assembly. ZIP compression uses fflate workers so the export button can show progress without blocking the controls.
- `validate-mesh.mjs` checks all 17 models: module counts, finite positive-volume connected solids, closed exported STL edges, bed alignment, scaled dimensions and restoration transforms. It intersects mating solids, including cabin/rear-module seams. Chassis rails are checked along vertical travel and for horizontal retention. Wheel, roller, spare and mixer threads are checked through rotation plus pitch advance; moving axially without rotation must intersect a thread flank. Four custom builds cover width/clearance endpoints and the boom pivot. Run `node apps/web/src/pages/block-cars/validate-mesh.mjs [output.zip]` from the repository root; use `--models=id,id` for targeted repairs. Scratch transpiled files are removed automatically.
- `block-cars.css` owns page-local styling.
- `assets/page-02.jpg` through `page-21.jpg` are extracted reference pages. The original PDF is not bundled.
- Models use a shared chassis, cabin, wheel, axle, and interchangeable cargo/tool modules.

## Reference and estimated dimensions

References are the supplied assembly PDF and https://makerworld.com/en/crowdfunding/140-creative-buildable-block-car. The current kit uses three cabin shapes and four chassis configurations. It includes a road roller on the crate carrier, both buckets on the loader, a telescopic fire ladder, and the SUV's spare wheel.

| Base parameter | Estimated size at 1x |
| --- | --- |
| Chassis pitch / width / height | 36 / 42 / 21 mm |
| Tyre diameter / width | 20 / 6.8 mm |
| Wheel thread major / root diameter / pitch | 5.4 / 4.4 / 2.2 mm |
| Chassis axle height / slide height | 8 / 14 mm |
| Locating stud / socket diameter | 6 / 6.5 mm |
| Top mounting clearance | 0.25 mm radially |

The slider supports 0.2x to 10x; direct length entry accepts 30-600 mm. Chassis width can be changed independently from 34 to 60 mm at 1x; lateral panel dimensions and mounting positions follow the width, while wheel diameter/width, round peg diameters and the turret/boom/bucket joint standard remain constant. Joint clearance accepts 0.1-0.6 mm at 1x. All dimensions and joint clearances then scale with the size control.

PDF pages 3-4 and the public MakerWorld joint animation show downward sliding chassis rails, inset mounting feet, central locating studs and interchangeable front tools. Both slide halves use one twin-shoulder section, with chamfered shoulders, central relief and an offset female contour. Feet have blind round sockets. Wheel screws use continuous single-start right-hand helices with tapered runout and matching female helices; the driver socket is a rounded cross. Low rounded heads seat on the hub with zero modeled axial gap and project 0.4 mm beyond the tyre sidewall at 1x, including the spare. Wheel placement preserves thread engagement and head seating across width changes. Thread clearance is diametral; the other fitting clearances are per side. The v5 export manifest records these parameters.

Body rounding is real mesh geometry: chassis radius 2.1 mm, main box bodies/trays 1.8 mm, cabin silhouette corner distance 2.2 mm with 1.1 mm extrusion bevel. Box corners use four subdivisions and profile bevels six. Large profile outlines are inset before beveling to preserve the outer envelope and avoid clipping a rounded rear edge into a sharp seam. The hood roof cap follows the roof footprint.

Exploded preview separates every chassis station and its upper modules along X, and lifts the cabin further than the cargo tray so they remain visibly distinct in the PDF camera angle. This affects only preview transforms. Actual cabin/rear meshes have a seam rather than overlapping bevels. Wheel arches leave the top tray intact; the display lifts the assembly to the ground without changing exported assembly coordinates.

Numeric controls keep a text draft while typing, then commit valid dimensions after 300 ms; intermediate empty/out-of-range text is reset on blur. The validator writes temporary modules under `node_modules/.cache`, outside Vite's watcher. `--custom-only` runs just the four width/clearance builds.

Visible reference proportions and the assembly direction guide these reconstructions. Dimensions and hidden joint profiles are estimates, not verified reproductions of the original CAD. Collision checks confirm clearance in the modeled assembled positions; they do not establish snap insertion force, full articulation, print shrinkage, strength or physical printed fit. Source CAD parity and 100% visual detail parity remain unverified.
