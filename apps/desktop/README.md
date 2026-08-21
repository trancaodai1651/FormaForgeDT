# Hometown Desktop

Tauri 2 shell for the offline designer workflow. It reuses the web viewer and geometry package, while the Rust layer is reserved for local file access, export acceleration, and autosave/recovery commands.

Run from the workspace root:

```bash
pnpm dev:desktop
pnpm tauri:build
```

The Tauri configuration declares Windows and macOS targets. Release signing/notarization still requires the developer's platform certificates.

## Hunyuan3D-2.1 bridge

The Hunyuan3D workspace is intentionally desktop-only. The web dashboard shows an installer gate and never loads model weights. Clone the [upstream Hunyuan3D-2.1 repository](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1), install its Python dependencies, then configure the desktop process before launching FormaForge:

```powershell
$env:HUNYUAN3D_HOME = 'C:\path\to\Hunyuan3D-2.1'
$env:HUNYUAN3D_PYTHON = 'python'
corepack pnpm dev:desktop
```

The Hunyuan3D page checks for `gradio_app.py`, the `hy3dshape` folder and the configured Python executable, then starts the upstream Gradio workspace with its documented model arguments. The model files and GPU workload stay on the desktop machine.
