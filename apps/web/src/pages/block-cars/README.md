# Block Cars

Public modular block-car workspace inspired by the 17 model references in the supplied assembly PDF. The supplied PDF has reference renders and parts tables, not CAD; this page rebuilds the vehicles as parametric, printable module geometry. Names describe the visible vehicle types.

- `BlockCarsPage.tsx` owns selection, language, scale, gallery, exploded/isolated preview, reference comparison, and STL ZIP download. Orbit state is preserved during rebuilds; Fit view explicitly reframes the current geometry.
- `carGeometry.ts` owns the page's solid model engine. Manifold unions and differences create actual recesses, ribs, sockets and joints. Shared meshes are cached; flat surfaces have crease normals. Wheels use a closed ring mesh with sidewall grooves and staggered tread.
- `catalog.ts` maps all 17 PDF references to the vehicle modules and colors.
- `printKit.ts` exports solid per-module STLs, a printed cross screwdriver, README and assembly JSON. Wheels/screws have different print orientations. The manifest preserves colors and the transforms needed to restore each print mesh into the assembly.
- `validate-mesh.mjs` checks all 17 models: module counts, finite positive-volume connected solids, closed exported STL edges, bed alignment, scaled dimensions and restoration transforms. Run `node apps/web/src/pages/block-cars/validate-mesh.mjs [output.zip]` from the repository root. Scratch transpiled files are removed automatically.
- `block-cars.css` owns page-local styling.
- `assets/page-02.jpg` through `page-21.jpg` are extracted reference pages. The original PDF is not bundled.
- Models use a shared chassis, cabin, wheel, axle, and interchangeable cargo/tool modules.

## Reference and estimated dimensions

References are the supplied assembly PDF and https://makerworld.com/en/crowdfunding/140-creative-buildable-block-car. The current kit uses three cabin shapes and four chassis configurations. It includes a road roller on the crate carrier, both buckets on the loader, a telescopic fire ladder, and the SUV's spare wheel.

| Base parameter | Estimated size at 1x |
| --- | --- |
| Chassis pitch / width / height | 36 / 34 / 21 mm |
| Tyre diameter / width | 20 / 6.8 mm |
| Locating stud / socket diameter | 5.6 / 6.1 mm |
| Top mounting clearance | 0.25 mm radially |

The slider supports 0.2x to 10x; direct length entry accepts 30-600 mm. All dimensions and joint clearances scale together. Hidden joints are estimated slide pockets and retention ridges, not verified reproductions of the original mechanism. Source CAD parity, 100% visual detail parity, and physical printed fits remain unverified; do not describe this reconstruction as the original CAD or as physically tested.
