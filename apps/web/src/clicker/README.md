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

## Xuất 3MF cho slicer

- **Merge base & image** chuyển Image/SVG/Icon/Text thành một tấm móc khóa phẳng, bỏ đế clicker, trụ MX và switch. **Flat plate thickness** đặt độ dày toàn tấm; Extrude riêng từng vùng vẫn được giữ.
- **Keep meshes separate** giữ các vùng màu ảnh trong tấm phẳng để chỉnh màu và xuất 3MF; tắt sẽ gộp hình học ảnh vào vật liệu của base. **Flat keychain** trong Keychain là cùng chế độ với Merge, và hai công tắc luôn đồng bộ.

- Mở **3MF export settings**, chọn **Bambu Studio** hoặc **Flashforge Studio / Orca-Flashforge**. Mở file dưới dạng project để giữ các part, màu filament và cấu hình support.
- **Automatic** đặt mặt ảnh có Extrude hướng lên và bật support cho phần nhô ra/stem. Mẫu phẳng được đặt úp để mặt ảnh nằm trên bàn in. Có thể chọn hướng và support riêng.
- Đặt toàn bộ từng cụm top/base xuống Z=0, giữ nguyên vị trí tương đối của các tầng màu; không hạ từng màu riêng xuống bàn in. Preview không bị đổi hướng bởi tùy chọn xuất.
- Profile mặc định là Flashforge Creator 5 Pro, nozzle 0.4 mm; có thể chọn thêm Bambu A1. Chọn lại đúng máy, nozzle, vật liệu và số slot màu trong slicer trước khi in. File xuất là project 3MF, không phải G-code.
