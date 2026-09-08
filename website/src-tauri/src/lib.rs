mod watcher;

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn open_overlay(app: AppHandle, x: f64, y: f64, w: f64, h: f64) -> Result<(), String> {
    let overlay = app
        .get_webview_window("eve-overlay")
        .ok_or_else(|| "eve-overlay window not found".to_string())?;
    overlay
        .set_size(LogicalSize::new(w, h))
        .map_err(|e| e.to_string())?;
    overlay
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    overlay.show().map_err(|e| e.to_string())?;
    overlay.set_always_on_top(true).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn close_overlay(app: AppHandle) -> Result<(), String> {
    let overlay = app
        .get_webview_window("eve-overlay")
        .ok_or_else(|| "eve-overlay window not found".to_string())?;
    overlay.hide().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn move_overlay(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    let overlay = app
        .get_webview_window("eve-overlay")
        .ok_or_else(|| "eve-overlay window not found".to_string())?;
    overlay
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn resize_overlay(app: AppHandle, w: f64, h: f64) -> Result<(), String> {
    let overlay = app
        .get_webview_window("eve-overlay")
        .ok_or_else(|| "eve-overlay window not found".to_string())?;
    overlay
        .set_size(LogicalSize::new(w, h))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            watcher::watch_folder,
            watcher::stop_watcher,
            open_overlay,
            close_overlay,
            move_overlay,
            resize_overlay,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
