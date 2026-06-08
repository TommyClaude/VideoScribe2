// Timeline track: one row per element (in play order) showing its draw + hold
// windows on a shared time axis. Click/drag the ruler to seek; drag a block's
// right edge to resize draw/hold; reorder with the ▲▼ buttons.
//
// Time math comes from engine/timeline.ts (pure + tested); this is canvas-free
// DOM glue and needs visual QC on a Mac.

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "../state/store";
import { computeTimeline, type ElementTiming } from "../engine/timeline";
import type { Element } from "../engine/types";

const LABEL_W = 150;
const MIN_PPS = 24;
const MAX_PPS = 160;

type DragKind = "seek" | "draw" | "hold";
interface Drag {
  kind: DragKind;
  elementId?: string;
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

  const timeline = useMemo(() => computeTimeline(project), [project]);
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
  const pps = clamp(trackW / Math.max(timeline.duration, 4), MIN_PPS, MAX_PPS);
  const fullW = Math.max(trackW, timeline.duration * pps);

  function secAtClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left) / pps, 0, timeline.duration || 0);
  }

  function startDrag(kind: DragKind, clientX: number, elementId?: string) {
    drag.current = { kind, elementId };
    if (kind === "seek") {
      setPlaying(false);
      setPlayhead(secAtClientX(clientX));
    }
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const sec = secAtClientX(e.clientX);
      if (d.kind === "seek") {
        setPlayhead(sec);
      } else if (d.elementId) {
        const t = timeline.byId.get(d.elementId);
        if (!t) return;
        if (d.kind === "draw") {
          updateAnim(d.elementId, { drawDuration: Math.max(0, sec - t.start) });
        } else if (d.kind === "hold") {
          updateAnim(d.elementId, { holdDuration: Math.max(0, sec - t.drawEnd) });
        }
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

  const ticks = useMemo(() => buildTicks(timeline.duration, pps), [timeline.duration, pps]);

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
              onResizeStart={(kind, clientX) => startDrag(kind, clientX, t.elementId)}
              onMove={(dir) => moveDrawOrder(t.elementId, dir)}
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
