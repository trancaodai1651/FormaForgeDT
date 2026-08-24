# Supabase

`migrations/` chứa schema, RLS và ownership policies. Mọi thay đổi bảng phải có migration mới, kiểm tra policy `authenticated` và cập nhật `DATABASE.md` khi contract đổi.

Client web/extension chỉ dùng URL và anon key public. Service-role key chỉ nằm trong môi trường server/CI, không commit vào repo hay gói Chrome.
