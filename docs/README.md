# Tài liệu FormaForgeDT

Đây là mục lục vận hành nhanh cho agent và người phát triển. Tài liệu cấp repo như `ARCHITECTURE.md`, `DATABASE.md`, `DEPLOYMENT.md` vẫn là nguồn chi tiết; các README gần source mô tả boundary nhỏ hơn.

## Bắt đầu theo task

- Sơ đồ source: [PROJECT-MAP.md](./PROJECT-MAP.md)
- Kiến trúc tổng quan: [../ARCHITECTURE.md](../ARCHITECTURE.md)
- Web: [../apps/web/README.md](../apps/web/README.md)
- Desktop: [../apps/desktop/README.md](../apps/desktop/README.md)
- Extension: [../extensions/forma-forge-market-reader/README.md](../extensions/forma-forge-market-reader/README.md)
- Database: [../supabase/README.md](../supabase/README.md)

## Quy ước

Tên folder theo trang dùng kebab-case. File `index.ts` hoặc `index.tsx` trong page boundary chỉ làm nhiệm vụ export/route shell; logic geometry đặt trong feature folder chuyên biệt.
