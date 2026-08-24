# Clicker tool pages

Bộ công cụ admin cho mô hình in 3D từ ảnh, SVG, text và blocks. Công nghệ: React/TypeScript, Three.js, workers và geometry packages.

## Feature folders

- `../../clicker/features/blocks`: keycap, switch, base và block layout.
- `../../clicker/features/flexKeychain`: text/keychain generation.
- `../../clicker/features/flexOrganizer`: organizer layout.
- `../../clicker/features/imageVectorizer`: ảnh raster/vector.
- `../../clicker/features/svgLayers`: tách layer SVG.
- `../../clicker/export`: STL/3MF/export pipeline.

`index.ts` giữ API page; tránh đưa logic thương mại, Paramacraft hoặc Price Reader vào Clicker.
