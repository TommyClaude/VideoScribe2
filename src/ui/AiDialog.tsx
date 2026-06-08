// AI assistant modal: script generation, image generation, and TTS voiceover.
// Each is optional and needs a key/endpoint configured in Settings.

import { useState } from "react";
import { useEditor } from "../state/store";
import { useSettings } from "../state/settings";
import { generateImage, generateScript, generateTTS } from "./ai";

export function AiDialog(props: { onClose: () => void; onOpenSettings: () => void }) {
  const settings = useSettings((s) => s.settings);
  const addElementForAsset = useEditor((s) => s.addElementForAsset);
  const addAsset = useEditor((s) => s.addAsset);
  const setAudio = useEditor((s) => s.setAudio);

  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [imgPrompt, setImgPrompt] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNote("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : props.onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>AI assistant</h2>

        <div className="group">
          <h3>Script</h3>
          <label className="field">
            <span>Chủ đề</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="vd: quang hợp ở cây" />
          </label>
          <button
            disabled={!!busy || !topic}
            onClick={() => run("script", async () => setScript(await generateScript(topic, settings)))}
          >
            {busy === "script" ? "Đang tạo…" : "Tạo script"}
          </button>
          {script && (
            <textarea
              className="ai-script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={5}
            />
          )}
        </div>

        <div className="group">
          <h3>Image → stage</h3>
          <label className="field">
            <span>Prompt</span>
            <input value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder="vd: a smiling sun, flat icon" />
          </label>
          <button
            disabled={!!busy || !imgPrompt}
            onClick={() =>
              run("image", async () => {
                const asset = await generateImage(imgPrompt, settings);
                addElementForAsset(asset);
                setNote("Đã thêm ảnh vào stage.");
              })
            }
          >
            {busy === "image" ? "Đang tạo…" : "Tạo ảnh"}
          </button>
        </div>

        <div className="group">
          <h3>Voiceover (TTS)</h3>
          <button
            disabled={!!busy || !script}
            onClick={() =>
              run("tts", async () => {
                const asset = await generateTTS(script, settings);
                addAsset(asset);
                setAudio("voiceover", {
                  assetId: asset.id,
                  startTime: 0,
                  trimStart: 0,
                  trimEnd: null,
                  volume: 1,
                });
                setNote("Đã thêm voiceover vào timeline.");
              })
            }
          >
            {busy === "tts" ? "Đang tạo…" : "Đọc script → voiceover"}
          </button>
          {!script && <p className="muted small">Tạo script trước để dùng TTS.</p>}
        </div>

        {note && <p className="ok-note">{note}</p>}
        {error && <pre className="result err">{error}</pre>}

        <div className="modal-actions">
          <button className="ghost" onClick={props.onOpenSettings}>
            Settings
          </button>
          <button onClick={props.onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
