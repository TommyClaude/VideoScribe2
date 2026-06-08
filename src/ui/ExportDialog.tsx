// Export modal: choose ratio / fps / format, run the export with progress, and
// cancel. Rendering uses the same compositor as preview (fixed dt). The actual
// encode runs through the ffmpeg sidecar — needs a Mac for real verification.

import { useRef, useState } from "react";
import { useEditor } from "../state/store";
import { FPS_OPTIONS, RATIO_PRESETS, type ExportFormat, type RatioName } from "../engine/exporter";
import { runExport, type ExportProgress } from "./exportRunner";
import { isTauri } from "./assets";

export function ExportDialog(props: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const [ratio, setRatio] = useState<RatioName>("16:9");
  const [fps, setFps] = useState<number>(30);
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [transparent, setTransparent] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string>("");
  const [running, setRunning] = useState(false);
  const canceled = useRef(false);

  async function start() {
    setError("");
    setRunning(true);
    canceled.current = false;
    try {
      await runExport(
        project,
        { ratio, fps, format, transparent },
        (p) => setProgress(p),
        () => canceled.current,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  const pct =
    progress?.phase === "rendering" && progress.total
      ? Math.round((100 * (progress.frame ?? 0)) / progress.total)
      : progress?.phase === "encoding"
        ? 100
        : 0;

  return (
    <div className="modal-backdrop" onClick={running ? undefined : props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export video</h2>

        {!isTauri() && (
          <p className="warn">
            Export cần app desktop (ffmpeg sidecar). Trong trình duyệt chỉ preview được.
          </p>
        )}

        <div className="group">
          <h3>Tỉ lệ</h3>
          <div className="chips">
            {(Object.keys(RATIO_PRESETS) as RatioName[]).map((r) => (
              <button
                key={r}
                className={`chip${ratio === r ? " active" : ""}`}
                onClick={() => setRatio(r)}
              >
                {r}
                <small>
                  {RATIO_PRESETS[r].width}×{RATIO_PRESETS[r].height}
                </small>
              </button>
            ))}
          </div>
        </div>

        <div className="group grid2">
          <label className="field">
            <span>FPS</span>
            <select value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              {FPS_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Định dạng</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              <option value="mp4">MP4 (H.264)</option>
              <option value="gif">GIF</option>
              <option value="mov">MOV (alpha)</option>
            </select>
          </label>
        </div>

        {format === "mov" && (
          <label className="field-row">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            <span>Nền trong suốt (alpha)</span>
          </label>
        )}

        {progress && (
          <div className="export-progress">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="muted">
              {progress.phase === "rendering" &&
                `Đang render frame ${progress.frame}/${progress.total}…`}
              {progress.phase === "encoding" && "Đang encode (ffmpeg)…"}
              {progress.phase === "preparing" && "Đang chuẩn bị…"}
              {progress.phase === "done" && `Xong: ${progress.outPath}`}
              {progress.phase === "canceled" && "Đã hủy."}
            </p>
          </div>
        )}

        {error && <pre className="result err">{error}</pre>}

        <div className="modal-actions">
          {running ? (
            <button className="danger" onClick={() => (canceled.current = true)}>
              Cancel
            </button>
          ) : (
            <>
              <button className="ghost" onClick={props.onClose}>
                Đóng
              </button>
              <button onClick={start}>Export</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
