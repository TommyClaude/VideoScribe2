// Top toolbar: project name, asset import, background color, and the Phase 0
// ffmpeg sidecar self-test (kept reachable from the editor).

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../state/store";
import type { AudioKind } from "../state/store";
import { importAudio, importImage, importSvg } from "./assets";
import { decodeAudioAsset } from "./audioEngine";
import { openProject, saveProject } from "./projectIO";
import { RATIO_PRESETS, type RatioName } from "../engine/exporter";
import { TEMPLATES } from "../engine/templates";
import { createProject } from "../engine/factory";

export function Toolbar(props: { onExport: () => void; onAi: () => void; onSettings: () => void }) {
  const project = useEditor((s) => s.project);
  const name = useEditor((s) => s.project.meta.name);
  const background = useEditor((s) => s.project.meta.background);
  const canvasSize = useEditor((s) => s.project.meta.canvasSize);
  const setProject = useEditor((s) => s.setProject);
  const setProjectName = useEditor((s) => s.setProjectName);
  const setBackground = useEditor((s) => s.setBackground);
  const setCanvasSize = useEditor((s) => s.setCanvasSize);
  const addElementForAsset = useEditor((s) => s.addElementForAsset);
  const addAsset = useEditor((s) => s.addAsset);
  const setAudio = useEditor((s) => s.setAudio);
  const fitView = useEditor((s) => s.fitView);

  const currentRatio = (Object.keys(RATIO_PRESETS) as RatioName[]).find(
    (r) => RATIO_PRESETS[r].width === canvasSize.width && RATIO_PRESETS[r].height === canvasSize.height,
  );

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

  async function onImportAudio(kind: AudioKind) {
    setBusy(true);
    try {
      const asset = await importAudio();
      if (!asset) return;
      const info = await decodeAudioAsset(asset);
      asset.duration = info.duration;
      addAsset(asset);
      setAudio(kind, {
        assetId: asset.id,
        startTime: 0,
        trimStart: 0,
        trimEnd: null,
        volume: 1,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onOpen() {
    setBusy(true);
    try {
      const p = await openProject();
      if (p) setProject(p);
    } catch (e) {
      setFfmpeg(`open error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    setBusy(true);
    try {
      await saveProject(project);
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

      <button className="ghost" onClick={() => setProject(createProject())} disabled={busy}>
        New
      </button>
      <button className="ghost" onClick={onOpen} disabled={busy}>
        Open
      </button>
      <button className="ghost" onClick={onSave} disabled={busy}>
        Save
      </button>
      <select
        className="template-select"
        value=""
        onChange={(e) => {
          const def = TEMPLATES.find((t) => t.id === e.target.value);
          if (def) setProject(def.build());
        }}
        title="Load a template"
      >
        <option value="">Template…</option>
        {TEMPLATES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <div className="spacer" />

      <button onClick={onImportSvg} disabled={busy}>
        + SVG
      </button>
      <button onClick={onImportImage} disabled={busy}>
        + Image
      </button>
      <button onClick={() => onImportAudio("music")} disabled={busy}>
        + Music
      </button>
      <button onClick={() => onImportAudio("voiceover")} disabled={busy}>
        + Voice
      </button>

      <button className="ghost" onClick={fitView} title="Fit stage to view">
        Fit
      </button>

      <label className="bg-picker" title="Canvas size">
        Size
        <select
          value={currentRatio ?? ""}
          onChange={(e) => {
            const r = e.target.value as RatioName;
            const d = RATIO_PRESETS[r];
            if (d) setCanvasSize(d.width, d.height);
          }}
        >
          {!currentRatio && <option value="">custom</option>}
          {(Object.keys(RATIO_PRESETS) as RatioName[]).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="bg-picker">
        BG
        <input
          type="color"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
        />
      </label>

      <button className="ghost" onClick={props.onAi}>
        AI
      </button>
      <button onClick={props.onExport}>Export</button>
      <button className="ghost" onClick={props.onSettings} title="Settings" aria-label="settings">
        ⚙
      </button>

      <button className="ghost" onClick={testFfmpeg} title="Phase 0 sidecar test">
        Test ffmpeg
      </button>
      {ffmpeg && <span className="ffmpeg-status" title={ffmpeg}>{ffmpeg}</span>}
    </header>
  );
}
