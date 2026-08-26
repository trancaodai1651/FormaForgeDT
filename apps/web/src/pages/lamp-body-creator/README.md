# Lamp Body Creator

Reusable admin workspace module for creating a printable lamp stand/body from a rotational profile. It is embedded in the Tulip Creator workspace so the body and lampshade share one 3D preview.

Host route: `/admin/tulip-creator` (select `Lamp Body Creator` in the component switch). There is intentionally no standalone admin route.

The page supports cylinder, taper, hourglass, pedestal, and lampshade profiles; a preset/advanced profile editor with four editable radius stations and curvature controls; body, base, neck, socket, wall, resolution, finish, and simulation controls; a real bottom cable/socket through-hole; live Three.js preview; and local ASCII STL export. It is intentionally isolated from `pages/tulip-creator/` and `FlexLampWorkspacePage.tsx`.
