# MeKey Studio agent guide

- Keep UI and state in this page boundary.
- Keep CSG off the main thread in `geometry.worker.ts`.
- Preview and exported 3MF must use the same returned `ClickerPart[]` contract.
- Preserve separate colors/material objects and verify batch bed arrangement before claiming export parity.
