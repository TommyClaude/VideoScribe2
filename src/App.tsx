import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Phase 0 landing screen.
 *
 * Verifies the Tauri shell + ffmpeg sidecar wiring by invoking the Rust
 * command `ffmpeg_version`, which runs `ffmpeg -version` through the bundled
 * sidecar and returns its output.
 *
 * (The full editor UI is introduced from Phase 1 onward.)
 */
function App() {
  const [version, setVersion] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function testFfmpeg() {
    setLoading(true);
    setError("");
    setVersion("");
    try {
      const out = await invoke<string>("ffmpeg_version");
      // Show just the first line ("ffmpeg version ...") to keep it readable.
      setVersion(out.split("\n")[0] ?? out);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="phase0">
      <h1>Scribely</h1>
      <p className="tagline">Whiteboard animation cho macOS — bản dựng đang phát triển.</p>

      <button onClick={testFfmpeg} disabled={loading}>
        {loading ? "Đang kiểm tra…" : "Test ffmpeg"}
      </button>

      {version && (
        <pre className="result ok" aria-label="ffmpeg-version">
          {version}
        </pre>
      )}
      {error && (
        <pre className="result err" aria-label="ffmpeg-error">
          {error}
        </pre>
      )}

      <p className="hint">
        Bấm "Test ffmpeg" để gọi sidecar <code>ffmpeg -version</code> qua Rust.
      </p>
    </main>
  );
}

export default App;
