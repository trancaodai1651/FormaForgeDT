# Clicker geometry agent guide

Đây là engine/feature boundary dùng bởi Clicker pages. Trước khi sửa, xác định feature: `blocks`, `flexKeychain`, `flexOrganizer`, `imageVectorizer` hoặc `svgLayers`.

- `core/`, `geometry/`, `viewer/`, `export/` là shared pipeline; sửa ở đây có thể ảnh hưởng nhiều trang.
- `features/*` chứa behavior riêng từng tool.
- Không trộn Price Reader, Paramacraft hoặc desktop inference vào Clicker.
- Kiểm tra model centering, camera preservation, resize canvas và file STL/3MF sau thay đổi geometry.
