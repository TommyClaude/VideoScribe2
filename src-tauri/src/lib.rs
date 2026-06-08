use tauri_plugin_shell::ShellExt;

/// Phase 0 sanity command: runs the bundled `ffmpeg` sidecar with `-version`
/// and returns its stdout. Used by the "Test ffmpeg" button to prove the
/// sidecar wiring works end-to-end.
#[tauri::command]
async fn ffmpeg_version(app: tauri::AppHandle) -> Result<String, String> {
    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("could not create ffmpeg sidecar: {e}"))?
        .args(["-version"])
        .output()
        .await
        .map_err(|e| format!("ffmpeg execution failed: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).into_owned())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![ffmpeg_version])
        .run(tauri::generate_context!())
        .expect("error while running Scribely");
}
