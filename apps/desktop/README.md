# Hometown Desktop

Tauri 2 shell for the offline designer workflow. It reuses the web viewer and geometry package, while the Rust layer is reserved for local file access, export acceleration, and autosave/recovery commands.

Run from the workspace root:

```bash
pnpm dev:desktop
pnpm tauri:build
```

The Tauri configuration declares Windows and macOS targets. Release signing/notarization still requires the developer's platform certificates.
