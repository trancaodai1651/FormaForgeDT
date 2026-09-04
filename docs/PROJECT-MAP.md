# Project map

## Runtime surfaces

| Khu vực | Route chính | Boundary | Ghi chú |
| --- | --- | --- | --- |
| Storefront | `/`, `/products`, `/customize/*` | `apps/web/src/pages/storefront` | Catalog, cart, checkout |
| Module Studio | `/module-studio/*` | `apps/web/src/pages/module-studio` | Lắp module đèn, sketch |
| Clicker tools | `/admin/clicker`, `/admin/flex-*` | `apps/web/src/pages/clicker` | Image, blocks, keychain, organizer |
| Flex Lamp | `/admin/flex-lamp` | `apps/web/src/pages/flex-lamp` | Lamp geometry workspace |
| Paramacraft | `/paramacraft*`, `/admin/paramacraft` | `apps/web/src/pages/paramacraft` | Parametric editor |
| Price Reader | `/price-reader` | `apps/web/src/pages/price-reader` | Customer price reader |
| Hunyuan 3D | `/admin/hunyuan-3d` | `apps/web/src/pages/hunyuan-3d` | Desktop-only generation gate |
| Split 3MF | `/admin/split-3mf` | `apps/web/src/pages/split-3mf` | Admin-only multi-color 3MF splitting and export |
| Downloads | `/downloads` | `apps/web/src/pages/downloads` | Web/desktop/extension links |

## Data and build

- `apps/web`: React, TypeScript, Vite, Three.js, Supabase client.
- `apps/desktop`: Tauri 2 shell, Rust commands, web frontend bundled into NSIS/DMG.
- `services/api`: API service, TypeScript and Drizzle/Supabase integrations.
- `extensions/forma-forge-market-reader`: Chrome Manifest V3, vanilla TypeScript/JavaScript.
- `packages/*`: shared types and geometry engines.
- `supabase/migrations`: SQL schema, RLS policies and data migrations.

## Token-saving search

```powershell
rg -n "route|export|generate|download|STL|ThreeMF|Paramacraft" apps/web/src/pages apps/web/src/clicker apps/web/src/moduleStudio
rg -n "tauri|bundle|nsis|dmg|release" apps/desktop .github/workflows
```
