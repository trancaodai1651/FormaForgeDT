# Clicker feature library

Thư viện React/TypeScript/Three.js cho các công cụ tạo vật thể in 3D. Worker và geometry helpers tách khỏi UI để giảm coupling.

## Luồng chính

`features/*` -> `core/engine.ts`/geometry -> `viewer/` -> `export/`. Khi sửa một feature, ưu tiên không chạm core; nếu phải chạm core thì chạy toàn bộ geometry tests và kiểm tra các route Clicker liên quan.
