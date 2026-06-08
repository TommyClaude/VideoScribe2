// The editing stage: a canvas that renders the active scene via the engine
// compositor and supports select / drag / scale / rotate with the mouse.
//
// Interaction math lives in engine/transform.ts (pure + unit-tested); this file
// is the DOM/canvas glue and needs visual QC on a Mac.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "../state/store";
import { renderSceneAt, type FrameOptions } from "../engine/compositor";
import { computeTimeline, progressAt } from "../engine/timeline";
import { cameraAt, cameraKeyframes, zoomAround } from "../engine/camera";
import {
  elementCorners,
  pointInElement,
  rotationFromHandle,
  scaleFromHandle,
} from "../engine/transform";
import { cameraViewport, screenToStage, stageToScreen, type Viewport } from "../engine/view";
import type { CameraKeyframe, Element, Size, Transform, Vec2 } from "../engine/types";
import { onImageLoaded, resolveAssetImage, resolveHandImage, resolveSvg } from "./assets";

const HANDLE = 9; // half-size of a corner handle, screen px
const HANDLE_HIT = 12; // hit tolerance, screen px
const ROTATE_OFFSET = 28; // distance of rotate handle above the top edge

type DragMode = "none" | "move" | "scale" | "rotate" | "pan";

interface DragState {
  mode: DragMode;
  start: Vec2; // stage-space pointer at drag start
  startTransform: Transform;
  startScreen: Vec2; // screen-space pointer at drag start (for pan)
  startCam: CameraKeyframe; // viewCam at drag start (for pan)
}

export function Stage() {
  const project = useEditor((s) => s.project);
  const activeScene = useEditor((s) => s.activeScene());
  const selectedId = useEditor((s) => s.selectedElementId);
  const selectElement = useEditor((s) => s.selectElement);
  const updateTransform = useEditor((s) => s.updateTransform);
  const assetById = useEditor((s) => s.assetById);
  const playhead = useEditor((s) => s.playhead);
  const isPlaying = useEditor((s) => s.isPlaying);
  const viewCam = useEditor((s) => s.viewCam);
  const setViewCam = useEditor((s) => s.setViewCam);

  // While editing (stopped at t=0) every element shows fully so it can be
  // positioned; while playing or scrubbed, render the animated state at the
  // playhead. Same compositor either way.
  const timeline = useMemo(() => computeTimeline(project), [project]);
  const camKeys = useMemo(() => cameraKeyframes(project, timeline), [project, timeline]);
  const previewing = isPlaying || playhead > 0;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [box, setBox] = useState<Size>({ width: 800, height: 450 });
  const [, setImgTick] = useState(0);
  const drag = useRef<DragState>(idleDrag());

  const canvas = project.meta.canvasSize;

  const elementSize = useCallback(
    (el: Element): Size => {
      const a = assetById(el.assetId);
      return { width: a?.width ?? 100, height: a?.height ?? 100 };
    },
    [assetById],
  );

  // Track container size.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => {
      const r = node.getBoundingClientRect();
      setBox({ width: Math.max(1, r.width), height: Math.max(1, r.height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // Redraw when images finish loading.
  useEffect(() => onImageLoaded(() => setImgTick((n) => n + 1)), []);

  // Edit mode frames the stage with the editor view camera; preview mode uses
  // the animated camera path. The compositor is identical for both.
  const viewport = (): Viewport =>
    previewing
      ? cameraViewport(canvas, box, cameraAt(camKeys, playhead))
      : cameraViewport(canvas, box, viewCam);

  // Draw.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(box.width * dpr);
    cv.height = Math.round(box.height * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const vp = viewport();

    // Backdrop.
    ctx.fillStyle = "#15151a";
    ctx.fillRect(0, 0, box.width, box.height);

    // Stage rectangle (project background) + frame.
    const tl = stageToScreen({ x: 0, y: 0 }, vp);
    const w = canvas.width * vp.scale;
    const h = canvas.height * vp.scale;
    ctx.fillStyle = project.meta.background;
    ctx.fillRect(tl.x, tl.y, w, h);
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;
    ctx.strokeRect(tl.x + 0.5, tl.y + 0.5, w, h);

    // Elements (animated via the engine compositor).
    const opts: FrameOptions = {
      vp,
      canvas,
      resolvers: {
        image: (id) => resolveAssetImage(assetById(id)),
        svg: (id) => resolveSvg(assetById(id)),
        handImage: (id) => resolveHandImage(id),
      },
      progressOf: previewing ? (el) => progressAt(timeline, el, playhead) : () => 1,
    };
    renderSceneAt(ctx, activeScene, opts);

    // Selection overlay (only while editing, not during playback).
    if (!previewing) {
      const sel = activeScene.elements.find((e) => e.id === selectedId);
      if (sel) drawSelection(ctx, sel, elementSize(sel), vp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, activeScene, selectedId, box, playhead, isPlaying, viewCam]);

  // ---- Pointer interaction ----

  function pointerStage(e: React.PointerEvent | PointerEvent): Vec2 {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return screenToStage({ x: e.clientX - r.left, y: e.clientY - r.top }, viewport());
  }

  function pointerScreen(e: React.PointerEvent | PointerEvent): Vec2 {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (previewing) return; // no editing during playback/scrub
    const screen = pointerScreen(e);
    const stage = pointerStage(e);
    const vp = viewport();
    const sel = activeScene.elements.find((el) => el.id === selectedId);
    const base = { start: stage, startScreen: screen, startCam: viewCam };

    // 1) handles of the currently selected element
    if (sel) {
      const handles = handlePositions(sel, elementSize(sel), vp);
      if (dist(screen, handles.rotate) <= HANDLE_HIT) {
        drag.current = { ...base, mode: "rotate", startTransform: { ...sel.transform } };
        return;
      }
      for (const c of handles.corners) {
        if (dist(screen, c) <= HANDLE_HIT) {
          drag.current = { ...base, mode: "scale", startTransform: { ...sel.transform } };
          return;
        }
      }
    }

    // 2) topmost element under the pointer
    const ordered = [...activeScene.elements].sort((a, b) => b.transform.z - a.transform.z);
    const hit = ordered.find((el) => pointInElement(stage, el.transform, elementSize(el)));
    if (hit) {
      selectElement(hit.id);
      drag.current = { ...base, mode: "move", startTransform: { ...hit.transform } };
      return;
    }

    // 3) empty space: deselect + pan the editor view
    selectElement(null);
    drag.current = { ...base, mode: "pan", startTransform: zeroT() };
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = drag.current;
      if (d.mode === "none") return;

      // Panning the editor view (no element involved).
      if (d.mode === "pan") {
        const screen = pointerScreen(e);
        const base = Math.min(box.width / canvas.width, box.height / canvas.height);
        const scale = base * d.startCam.zoom || 1;
        setViewCam({
          x: d.startCam.x - (screen.x - d.startScreen.x) / scale,
          y: d.startCam.y - (screen.y - d.startScreen.y) / scale,
          zoom: d.startCam.zoom,
        });
        return;
      }

      if (!selectedId) return;
      const stage = pointerStage(e);
      const sel = activeScene.elements.find((el) => el.id === selectedId);
      if (!sel) return;
      const size = elementSize(sel);
      if (d.mode === "move") {
        updateTransform(selectedId, {
          x: d.startTransform.x + (stage.x - d.start.x),
          y: d.startTransform.y + (stage.y - d.start.y),
        });
      } else if (d.mode === "scale") {
        const next = scaleFromHandle(d.startTransform, size, stage);
        updateTransform(selectedId, { scale: next.scale });
      } else if (d.mode === "rotate") {
        const deg = rotationFromHandle(
          { x: sel.transform.x, y: sel.transform.y },
          stage,
          e.shiftKey ? 15 : 0,
        );
        updateTransform(selectedId, { rotation: deg });
      }
    }
    function onUp() {
      drag.current.mode = "none";
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeScene, box, project]);

  // Wheel = zoom the editor view around the cursor (editing only).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    function onWheel(e: WheelEvent) {
      if (previewing) return;
      e.preventDefault();
      const r = cv!.getBoundingClientRect();
      const cursor = { x: e.clientX - r.left, y: e.clientY - r.top };
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setViewCam(zoomAround(viewCam, canvas, box, cursor, factor));
    }
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewing, viewCam, box, project]);

  return (
    <div className="stage" ref={containerRef}>
      <canvas
        ref={canvasRef}
        style={{ width: box.width, height: box.height, display: "block" }}
        onPointerDown={onPointerDown}
      />
    </div>
  );
}

// ---- drawing helpers (screen space) ----

function handlePositions(el: Element, size: Size, vp: Viewport) {
  const corners = elementCorners(el.transform, size).map((p) => stageToScreen(p, vp));
  const topMid = mid(corners[0], corners[1]);
  const normal = edgeNormal(corners[0], corners[1]);
  const rotate = { x: topMid.x + normal.x * ROTATE_OFFSET, y: topMid.y + normal.y * ROTATE_OFFSET };
  return { corners, topMid, rotate };
}

function drawSelection(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  el: Element,
  size: Size,
  vp: Viewport,
) {
  const { corners, topMid, rotate } = handlePositions(el, size, vp);
  ctx.save();
  ctx.strokeStyle = "#4c8dff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.stroke();

  // rotate handle stem + knob
  ctx.beginPath();
  ctx.moveTo(topMid.x, topMid.y);
  ctx.lineTo(rotate.x, rotate.y);
  ctx.stroke();
  ctx.fillStyle = "#4c8dff";
  ctx.beginPath();
  ctx.arc(rotate.x, rotate.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // corner handles
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#4c8dff";
  for (const c of corners) {
    ctx.fillRect(c.x - HANDLE / 2, c.y - HANDLE / 2, HANDLE, HANDLE);
    ctx.strokeRect(c.x - HANDLE / 2, c.y - HANDLE / 2, HANDLE, HANDLE);
  }
  ctx.restore();
}

function zeroT(): Transform {
  return { x: 0, y: 0, scale: 1, rotation: 0, z: 0 };
}
function idleDrag(): DragState {
  return {
    mode: "none",
    start: { x: 0, y: 0 },
    startTransform: zeroT(),
    startScreen: { x: 0, y: 0 },
    startCam: { x: 0, y: 0, zoom: 1 },
  };
}
function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function mid(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function edgeNormal(a: Vec2, b: Vec2): Vec2 {
  // outward normal of the top edge (points away from the box)
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dy / len, y: -dx / len };
}
