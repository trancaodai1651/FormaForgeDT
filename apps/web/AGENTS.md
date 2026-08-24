# Web agent guide

Đọc `README.md` của page trước khi sửa. Page boundary nằm trong `src/pages/`; geometry dùng chung nằm trong `src/clicker`, `src/flexLamp` hoặc `src/moduleStudio`.

- Sửa route/layout của một trang trong `src/pages/<page>/`.
- Sửa render/geometry cụ thể trong feature folder gần nhất, không nhân bản engine.
- Sau thay đổi React/TypeScript: chạy `corepack pnpm --filter @hometown/web typecheck` và `corepack pnpm --filter @hometown/web build`.
- Khi sửa canvas/Three.js: kiểm tra resize, pixel ratio, camera center và thao tác orbit/pan/zoom trong browser.
- Khi sửa download: kiểm tra cả URL ổn định và fallback về GitHub Releases.
