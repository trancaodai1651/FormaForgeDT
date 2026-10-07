# Block Cars

Public modular block-car workspace inspired by the 17 model references in the supplied assembly PDF. The supplied PDF has reference renders and parts tables, not CAD; this page rebuilds the vehicles as parametric, printable module geometry. Names describe the visible vehicle types.

- `BlockCarsPage.tsx` owns selection, language, scale, gallery, independent cabin/front-equipment module selection, width and clearance controls, exploded/isolated preview, reference comparison, and STL ZIP download. Orbit state is preserved during rebuilds; Fit view and the PDF/front/side/top/underside buttons explicitly reframe the current geometry.
- `carGeometry.ts` owns the page's solid model engine. Manifold unions and differences create actual recesses, ribs, sockets and joints. Shared meshes are cached; flat surfaces have crease normals. Wheels use a closed ring mesh with sidewall grooves and staggered tread.
- `catalog.ts` maps all 17 PDF references to the vehicle modules and colors.
- `printKit.ts` exports solid per-module STLs, a printed cross screwdriver, README and assembly JSON. Wheels/screws have different print orientations. The manifest preserves colors and the transforms needed to restore each print mesh into the assembly.
- `validate-mesh.mjs` checks all 17 models: module counts, finite positive-volume connected solids, closed exported STL edges, bed alignment, scaled dimensions and restoration transforms. It also intersects mating solids to detect collisions in assembled chassis rails, cabin/cargo feet, wheel axles/hubs, front tools, boom/bucket pivots, turntables, rear door hinges and drum/ladder pivots. Four custom builds cover the width/clearance endpoints, including the boom pivot. Run `node apps/web/src/pages/block-cars/validate-mesh.mjs [output.zip]` from the repository root; use `--models=id,id` for targeted repairs. Scratch transpiled files are removed automatically.
- `block-cars.css` owns page-local styling.
- `assets/page-02.jpg` through `page-21.jpg` are extracted reference pages. The original PDF is not bundled.
- Models use a shared chassis, cabin, wheel, axle, and interchangeable cargo/tool modules.

## Reference and estimated dimensions

References are the supplied assembly PDF and https://makerworld.com/en/crowdfunding/140-creative-buildable-block-car. The current kit uses three cabin shapes and four chassis configurations. It includes a road roller on the crate carrier, both buckets on the loader, a telescopic fire ladder, and the SUV's spare wheel.

| Base parameter | Estimated size at 1x |
| --- | --- |
| Chassis pitch / width / height | 36 / 42 / 21 mm |
| Tyre diameter / width | 20 / 6.8 mm |
| Locating stud / socket diameter | 6 / 6.5 mm |
| Top mounting clearance | 0.25 mm radially |

The slider supports 0.2x to 10x; direct length entry accepts 30-600 mm. Chassis width can be changed independently from 34 to 60 mm at 1x; lateral panel dimensions and mounting positions follow the width, while wheel diameter/width, round peg diameters and the turret/boom/bucket joint standard remain constant. Joint clearance accepts 0.1-0.6 mm at 1x. All dimensions and joint clearances then scale with the size control.

PDF pages 3-4 and the public MakerWorld joint animation show downward sliding chassis rails, inset mounting feet, central locating studs and interchangeable front tools. The geometry models these as bottom-open T sockets, keyed feet with blind round sockets and paired pivot cheeks. Wheel stems have matching retention recesses; the driver socket has a rounded four-lobe outline. The v3 export manifest records the chosen width, clearance and fitting dimensions.

Visible reference proportions and the assembly direction guide these reconstructions. Dimensions and hidden joint profiles are estimates, not verified reproductions of the original CAD. Collision checks confirm clearance in the modeled assembled positions; they do not establish snap insertion force, full articulation, print shrinkage, strength or physical printed fit. Source CAD parity and 100% visual detail parity remain unverified.
