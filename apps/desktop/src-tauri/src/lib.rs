use serde::Serialize;
use std::{env, path::PathBuf, process::Command};

const MIN_HUNYUAN_VRAM_MB: u64 = 4 * 1024;
const SAFE_HUNYUAN_VRAM_MB: u64 = 8 * 1024;

#[derive(Serialize)]
struct DesktopStatus {
    offline: bool,
    platform: String,
    version: &'static str,
}

#[tauri::command]
fn desktop_status() -> DesktopStatus {
    DesktopStatus {
        offline: true,
        platform: std::env::consts::OS.to_string(),
        version: "0.1.0",
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HunyuanStatus {
    configured: bool,
    python_found: bool,
    repository_found: bool,
    home: Option<String>,
    python_version: Option<String>,
    vram_mb: Option<u64>,
    vram_source: Option<String>,
    vram_ok: bool,
    safe_mode: bool,
    minimum_vram_mb: u64,
    message: String,
}

struct VramInfo {
    mb: Option<u64>,
    source: Option<&'static str>,
}

fn hunyuan_home() -> Option<PathBuf> {
    env::var_os("HUNYUAN3D_HOME")
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
}

fn hunyuan_python() -> String {
    env::var("HUNYUAN3D_PYTHON").unwrap_or_else(|_| {
        if cfg!(windows) {
            "python".to_string()
        } else {
            "python3".to_string()
        }
    })
}

fn parse_memory_lines(output: &[u8], divisor: u64, round_up: bool) -> Option<u64> {
    String::from_utf8_lossy(output)
        .lines()
        .filter_map(|line| {
            let number = line
                .split_whitespace()
                .find_map(|part| part.trim().parse::<u64>().ok())?;
            if round_up {
                Some(number.saturating_add(divisor.saturating_sub(1)) / divisor)
            } else {
                Some(number / divisor)
            }
        })
        .max()
}

fn nvidia_vram_mb() -> Option<u64> {
    let output = Command::new("nvidia-smi")
        .args(["--query-gpu=memory.total", "--format=csv,noheader,nounits"])
        .output()
        .ok()?;
    parse_memory_lines(&output.stdout, 1, false)
}

#[cfg(windows)]
fn platform_vram_mb() -> Option<u64> {
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_VideoController | ForEach-Object { $_.AdapterRAM }",
        ])
        .output()
        .ok()?;
    parse_memory_lines(&output.stdout, 1024 * 1024, true)
}

#[cfg(target_os = "macos")]
fn platform_vram_mb() -> Option<u64> {
    let output = Command::new("system_profiler")
        .arg("SPDisplaysDataType")
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .filter(|line| line.to_ascii_lowercase().contains("vram"))
        .filter_map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            let value = parts.iter().find_map(|part| part.parse::<f64>().ok())?;
            let unit = parts
                .iter()
                .find(|part| part.eq_ignore_ascii_case(&"gb") || part.eq_ignore_ascii_case(&"mb"))
                .map(|part| part.to_ascii_lowercase())?;
            Some(if unit == "gb" {
                (value * 1024.0) as u64
            } else {
                value as u64
            })
        })
        .max()
}

#[cfg(not(any(windows, target_os = "macos")))]
fn platform_vram_mb() -> Option<u64> {
    None
}

fn detect_vram() -> VramInfo {
    if let Some(mb) = nvidia_vram_mb() {
        return VramInfo {
            mb: Some(mb),
            source: Some("nvidia-smi"),
        };
    }
    if let Some(mb) = platform_vram_mb() {
        return VramInfo {
            mb: Some(mb),
            source: Some(if cfg!(windows) {
                "Windows GPU adapter"
            } else {
                "system profiler"
            }),
        };
    }
    VramInfo {
        mb: None,
        source: None,
    }
}

#[tauri::command]
fn hunyuan3d_status() -> HunyuanStatus {
    let home = hunyuan_home();
    let python = hunyuan_python();
    let vram = detect_vram();
    let python_version = Command::new(&python)
        .arg("--version")
        .output()
        .ok()
        .and_then(|output| {
            let combined = [output.stdout, output.stderr].concat();
            let value = String::from_utf8_lossy(&combined).trim().to_string();
            (!value.is_empty()).then_some(value)
        });
    let repository_found = home
        .as_ref()
        .map(|path| path.join("gradio_app.py").is_file() && path.join("hy3dshape").is_dir())
        .unwrap_or(false);
    let python_found = python_version.is_some();
    let configured = python_found && repository_found;
    let vram_ok = vram.mb.map(|mb| mb >= MIN_HUNYUAN_VRAM_MB).unwrap_or(true);
    let safe_mode = vram.mb.map(|mb| mb <= SAFE_HUNYUAN_VRAM_MB).unwrap_or(true);
    let message = if !vram_ok {
        "The detected GPU has less than the 4 GB minimum; launch is blocked to prevent an out-of-memory crash."
    } else if configured {
        "Local Hunyuan3D workspace is ready."
    } else if home.is_none() {
        "Set HUNYUAN3D_HOME to the Hunyuan3D-2.1 checkout."
    } else if !python_found {
        "Python was not found. Set HUNYUAN3D_PYTHON or install Python 3.10."
    } else {
        "The Hunyuan3D checkout is incomplete."
    };
    HunyuanStatus {
        configured,
        python_found,
        repository_found,
        home: home.map(|path| path.display().to_string()),
        python_version,
        vram_mb: vram.mb,
        vram_source: vram.source.map(str::to_string),
        vram_ok,
        safe_mode,
        minimum_vram_mb: MIN_HUNYUAN_VRAM_MB,
        message: message.to_string(),
    }
}

#[tauri::command]
fn hunyuan3d_launch() -> Result<String, String> {
    let home = hunyuan_home()
        .ok_or_else(|| "HUNYUAN3D_HOME is not configured or does not exist.".to_string())?;
    let python = hunyuan_python();
    if !home.join("gradio_app.py").is_file() {
        return Err("gradio_app.py was not found in HUNYUAN3D_HOME.".to_string());
    }
    let vram = detect_vram();
    if let Some(mb) = vram.mb.filter(|mb| *mb < MIN_HUNYUAN_VRAM_MB) {
        return Err(format!("Detected {mb} MB VRAM. Hunyuan3D requires at least 4096 MB; launch was blocked to prevent an out-of-memory crash."));
    }
    let mut command = Command::new(&python);
    command
        .current_dir(&home)
        .env(
            "PYTORCH_CUDA_ALLOC_CONF",
            "expandable_segments:True,max_split_size_mb:128",
        )
        .env("CUDA_MODULE_LOADING", "LAZY")
        .env("TOKENIZERS_PARALLELISM", "false")
        .env("OMP_NUM_THREADS", "4")
        .env("MKL_NUM_THREADS", "4")
        .args([
            "gradio_app.py",
            "--model_path",
            "tencent/Hunyuan3D-2.1",
            "--subfolder",
            "hunyuan3d-dit-v2-1",
            "--texgen_model_path",
            "tencent/Hunyuan3D-2.1",
            "--low_vram_mode",
        ]);
    if vram.mb.map(|mb| mb <= SAFE_HUNYUAN_VRAM_MB).unwrap_or(true) {
        command.env("HUNYUAN3D_SAFE_MODE", "1");
    }
    command
        .spawn()
        .map_err(|error| format!("Could not start Hunyuan3D: {error}"))?;
    Ok(
        if vram.mb.map(|mb| mb <= SAFE_HUNYUAN_VRAM_MB).unwrap_or(true) {
            "Hunyuan3D local workspace started in low-VRAM safe mode.".to_string()
        } else {
            "Hunyuan3D local workspace started.".to_string()
        },
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            desktop_status,
            hunyuan3d_status,
            hunyuan3d_launch
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hometown Desktop");
}
