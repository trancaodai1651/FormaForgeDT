# Desktop

The Tauri 2 shell points at the same Vite frontend, opens directly in `#/module-studio`, and declares Windows NSIS and macOS DMG bundle targets. Module Lamp Studio works offline for sketch-to-3D editing, E27/Bambu LED Kit 001 adapter selection, joint presets, module arrangement, local autosave, project files and STL export. Rust exposes a `desktop_status` command and filesystem/dialog plugins for future native filesystem and recovery workflows.

Run `pnpm dev:desktop` on a machine with Rust, the Tauri system prerequisites and workspace dependencies. Release signing and macOS notarization need external certificates.
