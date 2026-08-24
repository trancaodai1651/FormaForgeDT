# Tauri boundary

`tauri.conf.json` cấu hình app/window, frontendDist và NSIS/DMG bundle. Rust commands dưới `src/` là boundary native; chỉ thêm command khi web không thể làm an toàn/hiệu quả.

`target/` và generated files không phải source review. Kiểm tra release workflow thay vì commit artifact thủ công.
