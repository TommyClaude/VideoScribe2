// Timeline track: element rows (draw + hold windows) plus audio rows (waveform)
// on a shared time axis. Click/drag the ruler to seek; drag a block's right
// edge to resize draw/hold; ▲▼ reorder; drag audio to move / trim it.
//
// Time math comes from engine/timeline + engine/audio (pure + tested); this is
// DOM glue and needs visual QC on a Mac.

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, type AudioKind } from "../state/store";
import { computeTimeline, projectDuration, type ElementTiming } from "../engine/timeline";
import { clipWindow } from "../engine/audio";
import type { Element } from "../engine/types";
import { getPeaks } from "./audioEngine";

const LABEL_W = 150;
const MIN_PPS = 24;
const MAX_PPS = 160;

type DragKind = "seek" | "draw" | "hold" | "audio-move" | "audio-trim-start" | "audio-trim-end";

interface Drag {
  kind: DragKind;
  elementId?: string;
  audioKind?: AudioKind;
  startSec: number;
  startStartTime: number;
  startTrimStart: number;
  startTrimEnd: number;
  assetDuration: number;
}

export function Timeline() {
  const project = useEditor((s) => s.project);
  const playhead = useEditor((s) => s.playhead);
  const selectedId = useEditor((s) => s.selectedElementId);
  const selectElement = useEditor((s) => s.selectElement);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const setPlaying = useEditor((s) => s.setPlaying);
  const updateAnim = useEditor((s) => s.updateAnim);
  const moveDrawOrder = useEditor((s) => s.moveDrawOrder);
  const updateAudio = useEditor((s) => s.updateAudio);
  const setAudio = useEditor((s) => s.setAudio);

  const timeline = useMemo(() => computeTimeline(project), [project]);
  const duration = useMemo(() => projectDuration(project, timeline), [project, timeline]);
  const elementsById = useMemo(() => {
    const m = new Map<string, Element>();
    for (const scene of project.scenes) for (const el of scene.elements) m.set(el.id, el);
    return m;
  }, [project]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(800);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setWidth(node.getBoundingClientRect().width));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const trackW = Math.max(120, width - LABEL_W - 16);
  const pps = clamp(trackW / Math.max(duration, 4), MIN_PPS, MAX_PPS);
  const fullW = Math.max(trackW, duration * pps);

  function secAtClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left) / pps, 0, duration || 0);
  }

  function durationOfAsset(assetId: string): number {
    return project.assets.find((a) => a.id === assetId)?.duration ?? 0;
  }

  function startDrag(kind: DragKind, clientX: number, opts: Partial<Drag> = {}) {
    const sec = secAtClientX(clientX);
    drag.current = {
      kind,
      startSec: sec,
      startStartTime: 0,
      startTrimStart: 0,
      startTrimEnd: 0,
      assetDuration: 0,
      ...opts,
    };
    if (kind === "seek") {
      setPlaying(false);
      setPlayhead(sec);
    }
  }

  function startAudioDrag(kind: DragKind, clientX: number, audioKind: AudioKind) {
    const track = project.audio[audioKind];
    if (!track) return;
    const assetDuration = durationOfAsset(track.assetId);
    startDrag(kind, clientX, {
      audioKind,
      startStartTime: track.startTime,
      startTrimStart: track.trimStart,
      startTrimEnd: track.trimEnd ?? assetDuration,
      assetDuration,
    });
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const sec = secAtClientX(e.clientX);
      const delta = sec - d.startSec;
      switch (d.kind) {
        case "seek":
          setPlayhead(sec);
          break;
        case "draw": {
          if (!d.elementId) break;
          const t = timeline.byId.get(d.elementId);
          if (t) updateAnim(d.elementId, { drawDuration: Math.max(0, sec - t.start) });
          break;
        }
        case "hold": {
          if (!d.elementId) break;
          const t = timeline.byId.get(d.elementId);
          if (t) updateAnim(d.elementId, { holdDuration: Math.max(0, sec - t.drawEnd) });
          break;
        }
        case "audio-move":
          if (d.audioKind) updateAudio(d.audioKind, { startTime: Math.max(0, d.startStartTime + delta) });
          break;
        case "audio-trim-start":
          if (d.audioKind) {
            updateAudio(d.audioKind, {
              trimStart: clamp(d.startTrimStart + delta, 0, d.startTrimEnd - 0.05),
            });
          }
          break;
        case "audio-trim-end":
          if (d.audioKind) {
            updateAudio(d.audioKind, {
              trimEnd: clamp(d.startTrimEnd + delta, d.startTrimStart + 0.05, d.assetDuration),
            });
          }
          break;
      }
    }
    function onUp() {
      drag.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline, pps]);

  const ticks = useMemo(() => buildTicks(duration, pps), [duration, pps]);

  return (
    <div className="timeline" ref={wrapRef}>
      <div className="tl-row tl-ruler-row">
        <div className="tl-label tl-corner">Timeline</div>
        <div
          className="tl-track tl-ruler"
          ref={trackRef}
          style={{ width: fullW }}
          onPointerDown={(e) => startDrag("seek", e.clientX)}
        >
          {ticks.map((tk) => (
            <div key={tk.sec} className="tl-tick" style={{ left: tk.x }}>
              <span>{tk.sec}s</span>
            </div>
          ))}
          <div className="tl-playhead" style={{ left: playhead * pps }} />
        </div>
      </div>

      <div className="tl-rows">
        {timeline.timings.length === 0 && (
          <div className="tl-empty muted">Chưa có phần tử. Import SVG/ảnh để bắt đầu.</div>
        )}
        {timeline.timings.map((t) => {
          const el = elementsById.get(t.elementId);
          if (!el) return null;
          return (
            <ElementRow
              key={t.elementId}
              timing={t}
              element={el}
              pps={pps}
              fullW={fullW}
              selected={selectedId === t.elementId}
              onSelect={() => selectElement(t.elementId)}
              onResizeStart={(kind, clientX) => startDrag(kind, clientX, { elementId: t.elementId })}
              onMove={(dir) => moveDrawOrder(t.elementId, dir)}
            />
          );
        })}

        {(["music", "voiceover"] as AudioKind[]).map((kind) => {
          const track = project.audio[kind];
          if (!track) return null;
          const w = clipWindow(track, durationOfAsset(track.assetId));
          return (
            <AudioRow
              key={kind}
              kind={kind}
              label={kind === "music" ? "Music" : "Voiceover"}
              start={w.timelineStart}
              end={w.timelineEnd}
              srcStart={w.srcStart}
              srcEnd={w.srcEnd}
              assetDuration={durationOfAsset(track.assetId)}
              peaks={getPeaks(track.assetId)}
              pps={pps}
              fullW={fullW}
              onMoveStart={(clientX) => startAudioDrag("audio-move", clientX, kind)}
              onTrimStart={(clientX) => startAudioDrag("audio-trim-start", clientX, kind)}
              onTrimEnd={(clientX) => startAudioDrag("audio-trim-end", clientX, kind)}
              onRemove={() => setAudio(kind, null)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ElementRow(props: {
  timing: ElementTiming;
  element: Element;
  pps: number;
  fullW: number;
  selected: boolean;
  onSelect: () => void;
  onResizeStart: (kind: "draw" | "hold", clientX: number) => void;
  onMove: (dir: "earlier" | "later") => void;
}) {
  const { timing, element, pps, fullW, selected } = props;
  const assetById = useEditor((s) => s.assetById);
  const asset = assetById(element.assetId);
  const drawW = (timing.drawEnd - timing.start) * pps;
  const holdW = (timing.holdEnd - timing.drawEnd) * pps;

  return (
    <div className={`tl-row${selected ? " selected" : ""}`}>
      <div className="tl-label">
        <button className="tl-ord" title="earlier" onClick={() => props.onMove("earlier")}>
          ▲
        </button>
        <button className="tl-ord" title="later" onClick={() => props.onMove("later")}>
          ▼
        </button>
        <span className="tl-name" onClick={props.onSelect} title={asset?.name}>
          {asset?.name ?? element.id}
        </span>
      </div>
      <div className="tl-track" style={{ width: fullW }} onPointerDown={props.onSelect}>
        <div className="tl-block" style={{ left: timing.start * pps, width: drawW + holdW }}>
          <div className="tl-draw" style={{ width: drawW }}>
            <span className="tl-dur">{(timing.drawEnd - timing.start).toFixed(1)}s</span>
            <div
              className="tl-handle"
              onPointerDown={(e) => {
                e.stopPropagation();
                props.onResizeStart("draw", e.clientX);
              }}
            />
          </div>
          <div className="tl-hold" style={{ width: holdW }}>
            <div
              className="tl-handle"
              onPointerDown={(e) => {
                e.stopPropagation();
                props.onResizeStart("hold", e.clientX);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioRow(props: {
  kind: AudioKind;
  label: string;
  start: number;
  end: number;
  srcStart: number;
  srcEnd: number;
  assetDuration: number;
  peaks: number[] | null;
  pps: number;
  fullW: number;
  onMoveStart: (clientX: number) => void;
  onTrimStart: (clientX: number) => void;
  onTrimEnd: (clientX: number) => void;
  onRemove: () => void;
}) {
  const { start, end, srcStart, srcEnd, assetDuration, peaks, pps, fullW } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blockW = Math.max(2, (end - start) * pps);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const h = 30;
    cv.width = Math.max(1, Math.round(blockW * dpr));
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, blockW, h);
    if (!peaks || peaks.length === 0 || assetDuration <= 0) return;
    const from = Math.floor((srcStart / assetDuration) * peaks.length);
    const to = Math.ceil((srcEnd / assetDuration) * peaks.length);
    const slice = peaks.slice(Math.max(0, from), Math.min(peaks.length, to));
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    const mid = h / 2;
    for (let x = 0; x < blockW; x++) {
      const idx = Math.floor((x / blockW) * slice.length);
      const amp = (slice[idx] ?? 0) * (h / 2 - 1);
      ctx.moveTo(x + 0.5, mid - amp);
      ctx.lineTo(x + 0.5, mid + amp);
    }
    ctx.stroke();
  }, [blockW, peaks, srcStart, srcEnd, assetDuration]);

  return (
    <div className="tl-row tl-audio-row">
      <div className="tl-label">
        <span className="tl-name" title={props.label}>
          🎵 {props.label}
        </span>
        <button className="tl-ord" title="remove" onClick={props.onRemove}>
          ✕
        </button>
      </div>
      <div className="tl-track" style={{ width: fullW }}>
        <div
          className="tl-audio-block"
          style={{ left: start * pps, width: blockW }}
          onPointerDown={(e) => props.onMoveStart(e.clientX)}
        >
          <canvas ref={canvasRef} style={{ width: blockW, height: 30, display: "block" }} />
          <div
            className="tl-handle tl-handle-left"
            onPointerDown={(e) => {
              e.stopPropagation();
              props.onTrimStart(e.clientX);
            }}
          />
          <div
            className="tl-handle"
            onPointerDown={(e) => {
              e.stopPropagation();
              props.onTrimEnd(e.clientX);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function buildTicks(duration: number, pps: number): { sec: number; x: number }[] {
  const out: { sec: number; x: number }[] = [];
  const step = niceStep(duration);
  for (let s = 0; s <= duration + 0.001; s += step) {
    out.push({ sec: Math.round(s * 10) / 10, x: s * pps });
  }
  return out;
}

function niceStep(duration: number): number {
  if (duration <= 6) return 1;
  if (duration <= 15) return 2;
  if (duration <= 40) return 5;
  return 10;
}
