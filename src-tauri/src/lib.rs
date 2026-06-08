use base64::Engine;
use tauri::Manager;
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

/// Run the bundled ffmpeg sidecar with arbitrary args (built + validated on the
/// TS side via engine/exporter.buildFfmpegArgs). Returns stdout, or stderr on
/// failure.
#[tauri::command]
async fn run_ffmpeg(app: tauri::AppHandle, args: Vec<String>) -> Result<String, String> {
    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("could not create ffmpeg sidecar: {e}"))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("ffmpeg execution failed: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(format!(
            "ffmpeg failed (code {:?}):\n{}",
            output.status.code(),
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

/// Create a unique temp directory to hold rendered PNG frames during export.
#[tauri::command]
fn create_export_dir() -> Result<String, String> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let mut dir = std::env::temp_dir();
    dir.push(format!("scribely-export-{stamp}"));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Write one base64-encoded PNG frame to the export dir as frame_NNNNNN.png.
#[tauri::command]
fn write_frame(dir: String, index: u32, data: String) -> Result<(), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data.as_bytes())
        .map_err(|e| e.to_string())?;
    let path = std::path::Path::new(&dir).join(format!("frame_{index:06}.png"));
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove an export temp dir (guarded to our own naming scheme).
#[tauri::command]
fn remove_export_dir(dir: String) -> Result<(), String> {
    if dir.contains("scribely-export-") {
        let _ = std::fs::remove_dir_all(&dir);
    }
    Ok(())
}

/// Write text to an absolute path (used for saving .scribe projects).
#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Read a text file (used for opening .scribe projects).
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

fn draft_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("draft.scribe.json"))
}

/// Auto-save the working project to the app data dir.
#[tauri::command]
fn save_draft(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let path = draft_file(&app)?;
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

/// Load the auto-saved draft, if any.
#[tauri::command]
fn load_draft(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = draft_file(&app)?;
    if path.exists() {
        Ok(Some(std::fs::read_to_string(path).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            ffmpeg_version,
            run_ffmpeg,
            create_export_dir,
            write_frame,
            remove_export_dir,
            save_text_file,
            read_text_file,
            save_draft,
            load_draft
        ])
        .run(tauri::generate_context!())
        .expect("error while running Scribely");
}
