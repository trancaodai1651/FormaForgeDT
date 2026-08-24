# Clicker pages agent guide

Phạm vi: `/admin/clicker`, `/admin/flex-keychain`, `/admin/flex-organizer`, `/admin/svg-layers`. `AdminToolPage` là facade; logic đã chia trong `src/clicker/features/*`.

- Tìm feature đúng trước khi sửa: blocks, flexKeychain, flexOrganizer, imageVectorizer, svgLayers.
- Không sửa camera chung để chữa lỗi hình học của một feature; model phải centered và rebuild không làm mất orbit/pan/zoom.
- STL/3MF/ZIP export phải được kiểm tra bằng artifact thực tế khi thay đổi export.
- Gate: web typecheck/build và geometry tests nếu thay đổi engine.
