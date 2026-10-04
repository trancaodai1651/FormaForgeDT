# Clicker feature library

Thư viện React/TypeScript/Three.js cho các công cụ tạo vật thể in 3D. Worker và geometry helpers tách khỏi UI để giảm coupling.

## Luồng chính

`features/*` -> `core/engine.ts`/geometry -> `viewer/` -> `export/`. Khi sửa một feature, ưu tiên không chạm core; nếu phải chạm core thì chạy toàn bộ geometry tests và kiểm tra các route Clicker liên quan.

## Màu từng tầng Extrude

- Bật **Color by Extrude level** để gán màu chung cho từng bước +1, +2… trên mặt gốc. Mỗi bước là một khối vật liệu kín, không phải lớp màu phủ trong preview.
- **Mixed colors within each layer** cho phép mở từng tầng để chỉnh màu riêng các vùng, hoặc bấm vùng trên mô hình ở chế độ Color. Tắt xen kẽ sẽ dùng màu chung và giữ các màu riêng để bật lại.
- Dùng chung cho Image, SVG, Icon, Text, Blocks, Image + Blocks và Image + Imported Block. Các khối 3MF nhập sẵn không bị cắt hoặc đổi màu theo tầng của artwork.
- Các builder cung cấp `extrudeOrigin` (mặt gốc/chiều dày một bước); worker chạy `applyExtrudeLayerColors` sau khi bố trí geometry. `extrudePartName` giữ danh tính vùng khi tăng/giảm Extrude; `extrudeLayer` giữ màu riêng của vùng trong từng tầng.
- Project và Undo/Redo lưu `extrudeLayerColors`. Preview và 3MF dùng chung kết quả mesh đã chia tầng; STL không chứa thông tin màu.
