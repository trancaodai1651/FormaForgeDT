# FormaSplit 3MF

Admin-only browser workspace at `#/admin/split-3mf` for importing a multi-material 3MF, selecting color regions, smoothing seams, separating regions, cutting with a plane or sketch, adding printable connectors, undo/redo, per-model visibility, and exporting print-ready 3MF projects.

The page owns its reference-inspired UI. Reusable mesh booleans and archive exports remain in `src/stlCutter`, while material-aware 3MF import and boundary smoothing live in `src/split3mf/model.ts`.

Validation must cover the protected route, a real 3MF file-picker import, visible color regions, split/cut behavior, and the downloaded 3MF archive. Build success alone is not runtime proof.
