# Admin page boundary

Khu vực studio quản trị, dashboard và tool launcher. React/TypeScript + Supabase Auth/RLS. Các workspace lớn được export qua boundary riêng để sửa độc lập.

- `index.ts`: exports dashboard/tool.
- `../../AdminWorkspacePage.tsx`: dashboard.
- `../../AdminToolPage.tsx`: legacy tool switch.
