# Admin pages agent guide

Phạm vi: `/admin` và các route admin tool. Kiểm tra quyền admin trước khi thêm capability; không biến route admin thành public customer route.

- `AdminWorkspacePage` là dashboard; `AdminToolPage` là entry cho các tool cũ.
- Page-specific geometry phải đi qua boundary clicker/flex-lamp/hunyuan.
- Không để secret trong bundle; Supabase policies là lớp bảo vệ thật.
