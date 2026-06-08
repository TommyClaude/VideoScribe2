// AI settings: API keys + endpoints. Stored locally only (never in the project
// file). All optional — leave blank to disable a module.

import { useSettings } from "../state/settings";

export function SettingsDialog(props: { onClose: () => void }) {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings · AI (tuỳ chọn)</h2>
        <p className="muted">
          Khoá API chỉ lưu trên máy này (localStorage), không nằm trong file .scribe.
        </p>

        <div className="group">
          <h3>Script (Anthropic)</h3>
          <label className="field">
            <span>API key</span>
            <input
              type="password"
              value={settings.anthropicKey}
              onChange={(e) => update({ anthropicKey: e.target.value })}
              placeholder="sk-ant-…"
            />
          </label>
          <label className="field">
            <span>Model</span>
            <input value={settings.scriptModel} onChange={(e) => update({ scriptModel: e.target.value })} />
          </label>
        </div>

        <div className="group">
          <h3>Image generation</h3>
          <label className="field">
            <span>Endpoint URL</span>
            <input
              value={settings.imageEndpoint}
              onChange={(e) => update({ imageEndpoint: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="field">
            <span>API key</span>
            <input
              type="password"
              value={settings.imageKey}
              onChange={(e) => update({ imageKey: e.target.value })}
            />
          </label>
        </div>

        <div className="group">
          <h3>Text-to-speech</h3>
          <label className="field">
            <span>Endpoint URL</span>
            <input
              value={settings.ttsEndpoint}
              onChange={(e) => update({ ttsEndpoint: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="field">
            <span>API key</span>
            <input
              type="password"
              value={settings.ttsKey}
              onChange={(e) => update({ ttsKey: e.target.value })}
            />
          </label>
        </div>

        <div className="group">
          <h3>About</h3>
          <p className="muted small">
            <strong>Scribely</strong> v0.1.0 — whiteboard animation cho macOS (Apple Silicon).
            <br />
            Phím tắt: Space = play/pause · Delete = xoá phần tử · Esc = bỏ chọn ·
            cuộn = zoom · kéo nền = pan.
          </p>
        </div>

        <div className="modal-actions">
          <button onClick={props.onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
