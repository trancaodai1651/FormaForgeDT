# Paramacraft agent guide

Phạm vi: `/paramacraft`, `/paramacraft/viewer/:presetId`, `/admin/paramacraft`. Đây là editor parametric, không dùng state của Clicker.

- Sửa UI/editor flow trong `ParamacraftPage.tsx` hoặc entrypoint folder này.
- Giữ preset import/export JSON, camera ổn định và slider không làm model nhảy.
- Không thêm plate, switch hoặc logic Clicker vào Paramacraft.
- Gate: web typecheck/build và kiểm tra thao tác slider, preset, export JSON/STL.
