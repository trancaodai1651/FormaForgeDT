# 3D formats

- GLB: browser preview asset.
- STL: manufacturing export from the desktop/custom studio.
- 3MF: reserved for the next manufacturing exporter; it should be generated from validated mesh data rather than treated as a renamed STL.
- SVG/DXF/PNG: source/reference shape inputs for the designer pipeline.
- `.hometownlamp`: versioned JSON project format containing product, shape, hardware, pattern, material, print profile, generated geometry metadata and export history.

The MVP exposes the project data contract through `GeometryConfig`; a desktop persistence command can wrap that contract without changing geometry functions.
