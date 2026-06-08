// Top toolbar: project name, asset import, background color, and the Phase 0
// ffmpeg sidecar self-test (kept reachable from the editor).

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../state/store";
import { importImage, importSvg } from "./assets";

export function Toolbar() {
  const name = useEditor((s) => s.project.meta.name);
  const background = useEditor((s) => s.project.meta.background);
  const setProjectName = useEditor((s) => s.setProjectName);
  const setBackground = useEditor((s) => s.setBackground);
  const addElementForAsset = useEditor((s) => s.addElementForAsset);
  const fitView = useEditor((s) => s.fitView);

  const [busy, setBusy] = useState(false);
  const [ffmpeg, setFfmpeg] = useState<string>("");

  async function onImportSvg() {
    setBusy(true);
    try {
      const asset = await importSvg();
      if (asset) addElementForAsset(asset);
    } finally {
      setBusy(false);
    }
  }

  async function onImportImage() {
    setBusy(true);
    try {
      const asset = await importImage();
      if (asset) addElementForAsset(asset);
    } finally {
      setBusy(false);
    }
  }

  async function testFfmpeg() {
    try {
      const out = await invoke<string>("ffmpeg_version");
      setFfmpeg(out.split("\n")[0] ?? out);
    } catch (e) {
      setFfmpeg(`error: ${String(e)}`);
    }
  }

  return (
    <header className="toolbar">
      <strong className="brand">Scribely</strong>
      <input
        className="project-name"
        value={name}
        onChange={(e) => setProjectName(e.target.value)}
        aria-label="project name"
      />

      <div className="spacer" />

      <button onClick={onImportSvg} disabled={busy}>
        + SVG
      </button>
      <button onClick={onImportImage} disabled={busy}>
        + Image
      </button>

      <button className="ghost" onClick={fitView} title="Fit stage to view">
        Fit
      </button>

      <label className="bg-picker">
        BG
        <input
          type="color"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
        />
      </label>

      <button className="ghost" onClick={testFfmpeg} title="Phase 0 sidecar test">
        Test ffmpeg
      </button>
      {ffmpeg && <span className="ffmpeg-status" title={ffmpeg}>{ffmpeg}</span>}
    </header>
  );
}
