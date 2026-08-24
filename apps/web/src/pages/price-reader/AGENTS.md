# Price Reader agent guide

Phạm vi: `/price-reader` và `/admin/price-reader`. Customer được dùng route public sau đăng nhập; admin route chỉ dành cho admin tools.

- UI gọi Supabase/API qua `PriceReaderPage` và extension contract; không để service-role key trong client.
- Khi sửa parser giá/phân loại, kiểm tra CNY, VND, bản dịch, promotion và ownership/RLS.
- Khi sửa extension, đọc thêm `extensions/forma-forge-market-reader/AGENTS.md`.
- Gate: web typecheck/build, extension package/zip validation và migration review nếu đổi schema.
