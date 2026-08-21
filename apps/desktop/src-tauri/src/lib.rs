use serde::Serialize;
use std::{env, path::PathBuf, process::Command};

#[derive(Serialize)]
struct DesktopStatus { offline: bool, platform: String, version: &'static str }

#[tauri::command]
fn desktop_status() -> DesktopStatus {
    DesktopStatus { offline: true, platform: std::env::consts::OS.to_string(), version: "0.1.0" }
}

#[derive(Serialize)]
struct HunyuanStatus {
    configured: bool,
    python_found: bool,
    repository_found: bool,
    home: Option<String>,
    python_version: Option<String>,
    message: String,
}

fn hunyuan_home() -> Option<PathBuf> {
    env::var_os("HUNYUAN3D_HOME").map(PathBuf::from).filter(|path| path.is_dir())
}

fn hunyuan_python() -> String {
    env::var("HUNYUAN3D_PYTHON").unwrap_or_else(|_| if cfg!(windows) { "python".to_string() } else { "python3".to_string() })
}

#[tauri::command]
fn hunyuan3d_status() -> HunyuanStatus {
    let home = hunyuan_home();
    let python = hunyuan_python();
    let python_version = Command::new(&python).arg("--version").output().ok().and_then(|output| {
        let combined = [output.stdout, output.stderr].concat();
        let value = String::from_utf8_lossy(&combined).trim().to_string();
        (!value.is_empty()).then_some(value)
    });
    let repository_found = home.as_ref().map(|path| path.join("gradio_app.py").is_file() && path.join("hy3dshape").is_dir()).unwrap_or(false);
    let python_found = python_version.is_some();
    let configured = python_found && repository_found;
    let message = if configured { "Local Hunyuan3D workspace is ready." } else if home.is_none() { "Set HUNYUAN3D_HOME to the Hunyuan3D-2.1 checkout." } else if !python_found { "Python was not found. Set HUNYUAN3D_PYTHON or install Python 3.10." } else { "The Hunyuan3D checkout is incomplete." };
    HunyuanStatus { configured, python_found, repository_found, home: home.map(|path| path.display().to_string()), python_version, message: message.to_string() }
}

#[tauri::command]
fn hunyuan3d_launch() -> Result<String, String> {
    let home = hunyuan_home().ok_or_else(|| "HUNYUAN3D_HOME is not configured or does not exist.".to_string())?;
    let python = hunyuan_python();
    if !home.join("gradio_app.py").is_file() { return Err("gradio_app.py was not found in HUNYUAN3D_HOME.".to_string()); }
    Command::new(&python)
        .current_dir(&home)
        .args([
            "gradio_app.py",
            "--model_path", "tencent/Hunyuan3D-2.1",
            "--subfolder", "hunyuan3d-dit-v2-1",
            "--texgen_model_path", "tencent/Hunyuan3D-2.1",
            "--low_vram_mode",
        ])
        .spawn()
        .map_err(|error| format!("Could not start Hunyuan3D: {error}"))?;
    Ok("Hunyuan3D local workspace started.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![desktop_status, hunyuan3d_status, hunyuan3d_launch])
        .run(tauri::generate_context!())
        .expect("error while running Hometown Desktop");
}
