# Page boundaries

Mỗi folder con đại diện cho một route/workspace lớn. `index.ts` là public entrypoint; `AGENTS.md` nêu phạm vi được phép sửa; `README.md` mô tả dependency và đường đi dữ liệu.

Không đặt geometry engine dùng chung vào page folder. Page chỉ điều phối state, UI và export handler; engine/worker/asset phải ở feature hoặc package tương ứng.
