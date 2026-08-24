# Price Reader page

Customer price reader cho Taobao/1688 và các sàn Trung Quốc. Công nghệ: React/TypeScript, Supabase Auth/DB, extension Manifest V3 và translation/FX services.

## File

- `index.ts`: public export.
- `../../PriceReaderPage.tsx`: web UI, login/signup, sản phẩm đã lưu, PDF/ZIP actions.
- `../../lib/`: Supabase client, i18n và shared utilities.
- `../../public/downloads/`: extension package dùng để tải.

Giá live và translation phụ thuộc provider; UI phải có trạng thái loading/error rõ ràng và không giả vờ có dữ liệu khi parser chưa đọc được.
