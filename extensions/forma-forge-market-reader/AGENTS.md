# Market Reader extension agent guide

Chrome Manifest V3 extension đọc giá/phân loại/trang thương mại, dịch và gửi snapshot của user đã đăng nhập.

- `content.js`: DOM extraction/translation injection; phải chịu được thay đổi markup của sàn.
- `background.js`: message/event boundary và API calls.
- `popup.*`: sidebar/popup UI.
- `options.*`: chỉ cấu hình public URL/anon key và translation endpoint; không nhúng service-role key.
- Đóng gói bằng `pnpm build:market-reader`, kiểm tra bằng `pnpm validate:market-reader`.
