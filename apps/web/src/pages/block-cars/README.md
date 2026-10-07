# Block Cars

Public modular block-car workspace inspired by the 17 model references in the supplied assembly PDF. The supplied PDF has reference renders and parts tables, not CAD; this page rebuilds the vehicles as parametric, printable module geometry. Names describe the visible vehicle types.

- `BlockCarsPage.tsx` owns selection, language, scale, independent cabin/front-equipment module selection, width and clearance controls, exploded/isolated preview, reference comparison, standalone module STL and assembly ZIP downloads. Orbit state is preserved during dimension rebuilds; selecting a different isolated part explicitly fits it.
- `ModuleLibrary.tsx` replaces the vehicle gallery with a four-column desktop parts grid. It renders thumbnails from the actual solid meshes through one temporary WebGL renderer, building between frames. Semantic variants remove repeated wheels, screws and shared bodies, while retaining wheeled/unwheeled frames and different boom/pivot joints. Selecting a cab preserves the current rear equipment; front-tool selection preserves the rear; rear parts switch to their compatible rear assembly. Every part can be isolated, resized through the shared scale, downloaded alone, and viewed in its assembly. The 17 PDF presets remain in a secondary disclosure.
- `carGeometry.ts` owns the page's solid model engine. Manifold unions and differences create actual recesses, ribs, sockets and joints. Shared meshes are cached; flat surfaces have crease normals. Wheels use a closed ring mesh with sidewall grooves and 32 repeated chevrons.
- `catalog.ts` maps all 17 PDF references to the vehicle modules and colors.
- `printKit.ts` exports solid per-module binary STLs, a printed four-lobe screwdriver, README and assembly JSON. Wheels/screws have different print orientations. The manifest preserves colors and the transforms needed to restore each print mesh into the assembly. ZIP compression uses fflate workers so the export button can show progress without blocking the controls.
- `validate-mesh.mjs` checks all 17 models: module counts, finite positive-volume connected solids, closed exported STL edges, bed alignment, scaled dimensions and restoration transforms. It intersects mating solids, including cabin/rear-module seams. Top mounts must fit when seated and intersect the retaining cap by more than 0.05 mm³ when the upper module is lifted 0.75 mm. This tests the modeled retaining undercut, not physical snap force. Chassis rails are checked along vertical travel and for horizontal retention. Wheel, roller, spare and mixer threads are checked through rotation plus pitch advance; moving axially without rotation must intersect a thread flank. Four custom builds cover width/clearance endpoints and the boom pivot. Run `node apps/web/src/pages/block-cars/validate-mesh.mjs [output.zip]` from the repository root; use `--models=id,id` for targeted repairs. Scratch transpiled files are removed automatically.
- `block-cars.css` owns page-local styling.
- `assets/page-02.jpg` through `page-21.jpg` are extracted reference pages. The original PDF is not bundled.
- Models use a shared chassis, cabin, wheel, axle, and interchangeable cargo/tool modules.

## Reference and estimated dimensions

References are the supplied assembly PDF, https://makerworld.com/en/crowdfunding/140-creative-buildable-block-car and the user-supplied photographs of physical printed parts. Those photographs show a broad sloped hood nose, tapered front corners, a stepped cap on the top stud, three curved flexure slots around the matching socket, and a bucket tongue between the boom-tip cheeks. Their dimensions are estimated from visible proportions. The current kit uses three cabin shapes and four chassis configurations. It includes a road roller on the crate carrier, both buckets on the loader, a telescopic fire ladder, and the SUV's spare wheel.

| Base parameter | Estimated size at 1x |
| --- | --- |
| Chassis pitch / width / height | 36 / 42 / 21 mm |
| Tyre diameter / width | 20 / 6.8 mm |
| Wheel thread major / root diameter / pitch | 5.4 / 4.4 / 2.2 mm |
| Four-lobe wheel drive maximum / minimum diameter / approximate recess depth | 6.3 / 3.5 / 1 mm |
| Boom base pivot pin / bearing bore at default clearance | 4 / 4.5 mm |
| Bucket tip pin / bearing bore at default clearance | 3.6 / 4.1 mm |
| Bucket tip fork width / slot width / tongue width at default clearance | 8 / 4.5 / 4 mm |
| Bucket integral pivot span at default clearance | 7.5 mm |
| Machinery dome total height / hemisphere radius / base cylinder height | 13.7 / 7.7 / 6 mm |
| Machinery dome base height / main boom pivot height | 37 / 47 mm |
| Crane and loader assembled boom angle | -0.25 radians |
| Chassis axle height / slide height | 8 / 14 mm |
| Top stud base / neck / cap diameter | 8.4 / 6.6 / 8 mm |
| Top stud exposed height above tray floor | 3.4 mm |
| Top socket chamber / throat diameter at default clearance | 8.5 / 7.1 mm |
| Top socket chamber blind height above seating plane | 2.35 mm |
| Three-arc socket slot outer diameter / slit width / blind height | 11.8 / 0.65 / 2.6 mm |
| Top mounting clearance / maximum throat clearance | 0.25 / 0.35 mm per side |
| Hood front facet horizontal run / vertical rise | 5 / 4.5 mm |
| Hood nose corner taper in plan / chassis lower nose bevel | 3 / 3 mm |

The slider supports 0.2x to 10x; direct length entry accepts 30-600 mm. Chassis width can be changed independently from 34 to 60 mm at 1x; lateral panel dimensions and mounting positions follow the width, while wheel diameter/width, round peg diameters and the turret/boom/bucket joint standard remain constant. Joint clearance accepts 0.1-0.6 mm at 1x. All dimensions and joint clearances then scale with the size control.

PDF pages 3-4 and the public MakerWorld joint animation show downward sliding chassis rails, inset mounting feet, central locating studs and interchangeable front tools. Both slide halves use one twin-shoulder section, with chamfered shoulders, central relief and an offset female contour. The physical-part close-up guides the top mount: a spool-shaped stud rises from the recessed chassis tray; its matching foot has a stepped blind cavity with three curved flexure arcs and radial relief branches. The retaining throat uses the selected clearance up to 0.35 mm per side, so increasing cavity clearance to 0.6 mm still leaves a modeled retaining undercut. Flexure slots end inside the upper body. Wheel screws use continuous single-start right-hand helices with tapered runout and matching female helices. The photo-based drive recess uses an organic four-lobe outline, `r(theta) = 2.45 + 0.7 cos(4 theta)` in millimetres at 1x; the matching screwdriver tip is 0.87 times this profile. Tyre chevrons use 32 repeats and a tread phase of `abs(z) * 0.12` cycles at 1x. Low rounded heads seat on the hub with zero modeled axial gap and project 0.4 mm beyond the tyre sidewall at 1x, including the spare. Wheel placement preserves thread engagement and head seating across width changes. Thread clearance is diametral; the other fitting clearances are per side. The v6 export manifest records these estimates, the photo reference basis and the lack of original CAD or physical fit verification.

Body rounding is real mesh geometry: chassis radius 2.1 mm, main box bodies/trays 1.8 mm, cabin silhouette corner distance 2.2 mm with 1.1 mm extrusion bevel. Box corners use four subdivisions and profile bevels six. Large profile outlines are inset before beveling to preserve the outer envelope and avoid clipping a rounded rear edge into a sharp seam. The hood roof cap follows the roof footprint. The hood has a broad 5 mm by 4.5 mm sloping front facet, with its nose corners tapered 3 mm in plan. A 3 mm lower nose bevel continues the sloped chassis outline seen in the physical prints. The excavator bucket has a 4 mm male tongue and 3.6 mm integral tip pivot; the female boom-tip fork is 8 mm wide with a slot of `4 + 2 * clearance` mm and bearing bore of `3.6 + 2 * clearance` mm. The integral bucket pivot spans `8 - 2 * clearance` mm. The separate boom base pivot keeps its 4 mm pin and `4 + 2 * clearance` mm bore.

The photo-estimated machinery turret uses a 6 mm cylinder and a 7.7 mm radius hemisphere for 13.7 mm total dome height. It starts at Y=37 mm; the main pivot is at Y=47 mm. Crane and loader booms rotate -0.25 radians about the base pivot, raising the distal tip, and the excavator bucket follows that tip while remaining vertical. The hook boom uses the same lowered pivot height and stays at 0 radians. These dimensions and poses follow the physical photos and remain estimates.

Exploded preview separates every chassis station and its upper modules along X, and lifts the cabin further than the cargo tray so they remain visibly distinct in the PDF camera angle. This affects only preview transforms. Actual cabin/rear meshes have a seam rather than overlapping bevels. Wheel arches leave the top tray intact; the display lifts the assembly to the ground without changing exported assembly coordinates.

Numeric controls keep a text draft while typing, then commit valid dimensions after 300 ms; intermediate empty/out-of-range text is reset on blur. The validator writes temporary modules under `node_modules/.cache`, outside Vite's watcher. `--custom-only` runs just the four width/clearance builds.

Visible reference proportions and the assembly direction guide these reconstructions. Dimensions and hidden joint profiles are estimates, not verified reproductions of the original CAD. Collision checks confirm clearance in the modeled assembled positions and the existence of a rigid retaining undercut; they do not establish snap insertion force, flexure life, full articulation, print shrinkage, strength or physical printed fit. Source CAD parity and 100% visual detail parity remain unverified.
