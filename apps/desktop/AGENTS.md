# Desktop agent guide

Ứng dụng Tauri 2 cho workflow offline và Hunyuan 3D. Web frontend nằm ở `apps/web`; Rust commands và bundle config ở `src-tauri`.

- Chạy `corepack pnpm --filter @hometown/desktop tauri build` sau thay đổi desktop.
- Không commit `src-tauri/target/`, model weights hoặc secrets.
- Release installer được build từ tag bằng `.github/workflows/release-desktop.yml`.
- Hunyuan runtime phải giữ guard VRAM tối thiểu 4 GB và low-VRAM mode.
