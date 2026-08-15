use serde::Serialize;

#[derive(Serialize)]
struct DesktopStatus { offline: bool, platform: String, version: &'static str }

#[tauri::command]
fn desktop_status() -> DesktopStatus {
    DesktopStatus { offline: true, platform: std::env::consts::OS.to_string(), version: "0.1.0" }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![desktop_status])
        .run(tauri::generate_context!())
        .expect("error while running Hometown Desktop");
}
