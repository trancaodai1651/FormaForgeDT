# Public tools page guide

Phạm vi: public tools launcher và các route công cụ không yêu cầu tài khoản.

- Launcher chỉ điều hướng tới các workspace tạo hình, không hiển thị catalog, cart,
  checkout hoặc tài khoản.
- Các workspace phải chạy được khi chưa có Supabase session.
- Không thêm API secret vào client; dữ liệu tạm thời của người dùng phải ở browser
  hoặc qua endpoint công khai có giới hạn phù hợp.
