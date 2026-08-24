# Downloads page agent guide

Trang public `/downloads` chỉ là catalog link tải. Không build binary trong browser và không chứa secret.

- Giữ URL asset đồng bộ với `.github/workflows/release-desktop.yml`.
- Khi đổi tên asset, cập nhật workflow, README root, Hunyuan page và trang này trong cùng commit.
- Kiểm tra các link HTTP sau khi release hoàn tất.
