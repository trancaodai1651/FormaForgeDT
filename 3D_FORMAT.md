# 3D formats

- GLB: browser preview asset.
- STL: manufacturing export from the desktop/custom studio.
- 3MF: generated from validated mesh data using a minimal standards-compatible ZIP package containing model XML, relationships and content types.
- SVG/DXF/PNG: source/reference shape inputs for the designer pipeline.
- `.hometownlamp`: versioned JSON project format containing product, shape, hardware, pattern, material, print profile, generated geometry metadata and export history.

The MVP exposes the project data contract through `GeometryConfig`; browser custom studio autosaves the active configuration and supports Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z.
