# Paramacraft page

Trang editor tham số lấy cảm hứng từ ParaMaCraft: profile body, surface/pattern, material, image reference, preset và export mesh.

## File

- `index.ts`: public export của page boundary.
- `../../ParamacraftPage.tsx`: implementation hiện tại; React + TypeScript + Three.js helpers dùng trong page.
- `../../tahoe.css`, `../../styles.css`: theme/layout dùng chung.

Khi refactor tiếp, tách panel Body/Pattern/Global và renderer thành các file con dưới folder này, nhưng giữ `ParamacraftPage` làm facade để route cũ không đổi.
