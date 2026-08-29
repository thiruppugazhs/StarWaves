use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config, Event};
use std::sync::Mutex;
use std::path::Path;
use tauri::{AppHandle, Emitter};

pub struct WatcherState {
    pub watcher: Option<RecommendedWatcher>,
}

static WATCHER_STATE: Mutex<WatcherState> = Mutex::new(WatcherState { watcher: None });

#[tauri::command]
pub fn watch_folder(app: AppHandle, path: String) -> Result<String, String> {
    let mut state = WATCHER_STATE.lock().map_err(|e| e.to_string())?;

    // Stop existing watcher if any
    state.watcher = None;

    let path_clone = path.clone();
    let app_clone = app.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = app_clone.emit("workspace:file-changed", serde_json::json!({
                    "kind": format!("{:?}", event.kind),
                    "paths": event.paths.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>()
                }));
            }
        },
        Config::default(),
    ).map_err(|e| e.to_string())?;

    watcher.watch(Path::new(&path_clone), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    state.watcher = Some(watcher);

    Ok(format!("Watching folder: {}", path))
}

#[tauri::command]
pub fn stop_watcher() -> Result<String, String> {
    let mut state = WATCHER_STATE.lock().map_err(|e| e.to_string())?;
    state.watcher = None;
    Ok("Watcher stopped".to_string())
}
