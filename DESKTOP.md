# Desktop

The Tauri 2 shell points at the same Vite frontend and declares Windows NSIS and macOS DMG bundle targets. Rust exposes a `desktop_status` command and filesystem/dialog plugins, leaving room for offline project open/save, autosave/recovery, measurement and export commands.

Run `pnpm dev:desktop` on a machine with Rust, the Tauri system prerequisites and workspace dependencies. Release signing and macOS notarization need external certificates.
