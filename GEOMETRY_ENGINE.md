# Geometry engine

`@hometown/geometry` keeps the shape-to-lamp pipeline explicit:

`normalize → clean/profile → scale → extrude preview → hollow metadata → wall checks → pattern metadata → connector checks → FDM report → export`

The current preview generator produces a deterministic side mesh for cylinder, half-cylinder, landmark, tower, geometric, organic, pattern, multi-panel, stackable and modular shape types. It supports STL text export and a GLB-compatible metadata payload for a future binary GLB exporter.

`generateLampMesh`, `validateGeometry`, `exportSTL` and `exportGLB` are stable API entry points. The input is non-destructive and can be persisted as project JSON.
