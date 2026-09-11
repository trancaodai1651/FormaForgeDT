# Web application

Ứng dụng web dùng React 19, TypeScript, Vite, React Router, Three.js, Framer Motion và Supabase JS. `src/App.tsx` giữ routing; page boundary dưới `src/pages/` là lớp tổ chức theo màn hình.

## Các vùng chính

- `src/pages/public-tools`: trang công cụ public và thư mục workspace.
- `src/pages/module-studio`: studio module lamp và sketch.
- `src/pages/clicker`: Clicker Lab, Flex Keychain Text, Flex Organizer và SVG layers.
- `src/pages/flex-lamp`: Flex Lamp workspace.
- `src/pages/paramacraft`: editor tham số và preset.
- `src/pages/price-reader`: đọc/lưu giá sàn thương mại.
- `src/pages/hunyuan-3d`: hướng dẫn desktop Hunyuan 3D.
- `src/pages/downloads`: link tải web asset, extension và installer Release.

Các file page lịch sử ở `src/*.tsx` đang được re-export qua boundary để giữ tương thích. Khi tách tiếp, di chuyển logic theo từng commit nhỏ và giữ public export trong `index.ts`.
