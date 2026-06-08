// Viewport mapping between stage (virtual canvas) coordinates and screen
// coordinates. Pure + deterministic. Phase 4 layers a camera on top of the
// base "fit" viewport via `cameraViewport`.

import type { CameraKeyframe, Size, Vec2 } from "./types";

export interface Viewport {
  scale: number; // stage units -> screen pixels
  offsetX: number; // screen px added after scaling
  offsetY: number;
}

/** Fit the whole stage canvas inside a screen area, centered, with padding. */
export function fitViewport(canvas: Size, screen: Size, padding = 0): Viewport {
  const availW = Math.max(1, screen.width - padding * 2);
  const availH = Math.max(1, screen.height - padding * 2);
  const scale = Math.min(availW / canvas.width, availH / canvas.height);
  const offsetX = (screen.width - canvas.width * scale) / 2;
  const offsetY = (screen.height - canvas.height * scale) / 2;
  return { scale, offsetX, offsetY };
}

export function stageToScreen(p: Vec2, vp: Viewport): Vec2 {
  return { x: p.x * vp.scale + vp.offsetX, y: p.y * vp.scale + vp.offsetY };
}

export function screenToStage(p: Vec2, vp: Viewport): Vec2 {
  return { x: (p.x - vp.offsetX) / vp.scale, y: (p.y - vp.offsetY) / vp.scale };
}

/**
 * Build a viewport that frames the stage according to a camera keyframe.
 * `zoom` multiplies the base fit scale; the camera center maps to the screen
 * center. Used by both preview and export so they stay identical.
 */
export function cameraViewport(
  canvas: Size,
  screen: Size,
  cam: CameraKeyframe,
): Viewport {
  const base = Math.min(screen.width / canvas.width, screen.height / canvas.height);
  const scale = base * cam.zoom;
  const offsetX = screen.width / 2 - cam.x * scale;
  const offsetY = screen.height / 2 - cam.y * scale;
  return { scale, offsetX, offsetY };
}
