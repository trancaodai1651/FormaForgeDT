# Flex Lamp agent guide

Phạm vi: `/admin/flex-lamp`. Đây là workspace tạo chụp đèn 3D từ pattern và image; không trộn với Image + Blocks của Clicker.

- Sửa UI trong `FlexLampWorkspacePage.tsx`, geometry dùng `src/flexLamp`.
- Với mesh lỗi, kiểm tra contour, winding, manifold và export trước khi chỉnh CSS.
- Giữ camera center/resize và không reset camera khi đổi slider.
- Gate: web typecheck/build, browser preview và kiểm tra STL nếu có export.
