# FormaForgeDT agent guide

## Mục tiêu

FormaForgeDT là monorepo cho storefront, các workspace 3D, API Supabase, Chrome extension và ứng dụng desktop Tauri. Khi sửa lỗi, chỉ đọc phạm vi gần nhất với file cần đổi để tiết kiệm token.

## Quy tắc định tuyến phạm vi

1. Đọc file `AGENTS.md` gần nhất, sau đó đọc `README.md` của folder đó.
2. Chỉ mở source, test và asset liên quan trực tiếp đến lỗi. Không quét toàn repo nếu chưa có dấu hiệu cần thiết.
3. Thay đổi UI của một trang phải nằm trong page boundary tương ứng dưới `apps/web/src/pages/` hoặc module feature của trang.
4. Geometry preview và geometry export là hai đường đi khác nhau: luôn kiểm tra cả preview Three.js và file xuất nếu lỗi liên quan mesh.
5. Giữ camera, tâm model, pan/zoom/orbit khi rebuild hình học; kiểm tra runtime bằng browser nếu lỗi là hiển thị.
6. Không đưa secret, service-role key hoặc file build desktop lớn vào Git. Public Supabase anon key chỉ được dùng ở client/extension theo tài liệu.

## Lệnh kiểm tra chuẩn

```powershell
corepack pnpm typecheck
corepack pnpm test
corepack pnpm --filter @hometown/web build
corepack pnpm build:market-reader
corepack pnpm validate:market-reader
```

Với thay đổi desktop, chạy thêm `corepack pnpm tauri:build`. Với thay đổi release, kiểm tra workflow trong `.github/workflows/` và asset name trong trang `/downloads`.

## Quy trình fix ngắn

- Xác định page/module bằng `docs/PROJECT-MAP.md`.
- Reproduce lỗi tối thiểu.
- Sửa trong boundary nhỏ nhất.
- Chạy gate phù hợp, ưu tiên typecheck trước build.
- `git diff --check`, xem `git status`, commit mô tả đúng phạm vi.

## Không làm

- Không sửa ngẫu nhiên các page khác để giải quyết lỗi cục bộ.
- Không gọi build thành công là hoàn thành nếu chưa kiểm tra artifact/runtime khi task yêu cầu.
- Không commit `target/`, `dist/`, `.env` hay installer binary.
