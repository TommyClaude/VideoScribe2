// Camera model: a list of {time, keyframe} pairs over the timeline, plus
// ease-in-out interpolation between them, and cursor-anchored zoom math for the
// editor. Pure + deterministic + unit-tested.

import { ease } from "./easing";
import type { Project, CameraKeyframe, Size, Vec2 } from "./types";
import type { TimelineLayout } from "./timeline";
import { cameraViewport, screenToStage } from "./view";

export interface CamKey {
  t: number;
  cam: CameraKeyframe;
}

function findElement(project: Project, id: string) {
  for (const scene of project.scenes) {
    const el = scene.elements.find((e) => e.id === id);
    if (el) return el;
  }
  return undefined;
}

/**
 * Build camera keyframes over time: the scene's base camera at t=0, then each
 * element with its own `camera` adds a keyframe at the moment it starts drawing
 * (so the camera arrives just as the element appears).
 */
export function cameraKeyframes(project: Project, timeline: TimelineLayout): CamKey[] {
  const canvas = project.meta.canvasSize;
  const base: CameraKeyframe =
    project.scenes[0]?.cameraKeyframe ?? { x: canvas.width / 2, y: canvas.height / 2, zoom: 1 };
  const keys: CamKey[] = [{ t: 0, cam: base }];
  for (const timing of timeline.timings) {
    const el = findElement(project, timing.elementId);
    if (el?.camera) keys.push({ t: timing.start, cam: el.camera });
  }
  return keys;
}

function lerpCam(a: CameraKeyframe, b: CameraKeyframe, u: number): CameraKeyframe {
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    zoom: a.zoom + (b.zoom - a.zoom) * u,
  };
}

/** The interpolated camera at time `t` (ease-in-out between keyframes). */
export function cameraAt(keys: CamKey[], t: number): CameraKeyframe {
  if (keys.length === 0) return { x: 0, y: 0, zoom: 1 };
  if (t <= keys[0].t) return keys[0].cam;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b.t) {
      const span = b.t - a.t || 1;
      return lerpCam(a.cam, b.cam, ease("easeInOut", (t - a.t) / span));
    }
  }
  return keys[keys.length - 1].cam;
}

export function clampZoom(z: number, min = 0.1, max = 8): number {
  return z < min ? min : z > max ? max : z;
}

/**
 * Zoom by `factor` while keeping the stage point under `cursor` fixed on
 * screen. Returns the new camera. Used by the editor wheel-zoom.
 */
export function zoomAround(
  cam: CameraKeyframe,
  canvas: Size,
  screen: Size,
  cursor: Vec2,
  factor: number,
): CameraKeyframe {
  const stagePt = screenToStage(cursor, cameraViewport(canvas, screen, cam));
  const newZoom = clampZoom(cam.zoom * factor);
  const base = Math.min(screen.width / canvas.width, screen.height / canvas.height);
  const scaleNew = base * newZoom;
  return {
    x: stagePt.x - (cursor.x - screen.width / 2) / scaleNew,
    y: stagePt.y - (cursor.y - screen.height / 2) / scaleNew,
    zoom: newZoom,
  };
}
