// Pure 2D transform / hit-testing math for the stage.
//
// All functions are deterministic and DOM-free so they can be unit tested
// headlessly. The stage UI uses these for selection, dragging, scaling and
// rotation; nothing here touches React or canvas.

import type { Size, Transform, Vec2 } from "./types";

const DEG2RAD = Math.PI / 180;
export const MIN_SCALE = 0.02;

export function deg2rad(deg: number): number {
  return deg * DEG2RAD;
}

/** Half-extents of an element's box in world units (after scale). */
function halfExtents(t: Transform, size: Size): Vec2 {
  return { x: (size.width * t.scale) / 2, y: (size.height * t.scale) / 2 };
}

/**
 * The four corners of an element in world (stage) coordinates, in order:
 * top-left, top-right, bottom-right, bottom-left.
 */
export function elementCorners(t: Transform, size: Size): Vec2[] {
  const h = halfExtents(t, size);
  const local: Vec2[] = [
    { x: -h.x, y: -h.y },
    { x: h.x, y: -h.y },
    { x: h.x, y: h.y },
    { x: -h.x, y: h.y },
  ];
  const cos = Math.cos(deg2rad(t.rotation));
  const sin = Math.sin(deg2rad(t.rotation));
  return local.map((p) => ({
    x: t.x + p.x * cos - p.y * sin,
    y: t.y + p.x * sin + p.y * cos,
  }));
}

/** Axis-aligned bounding box of a set of points. */
export function boundingBox(points: Vec2[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Convert a world point into the element's local frame (origin = center,
 * axes un-rotated, NOT divided by scale). Useful for hit-testing and scaling.
 */
export function worldToLocal(point: Vec2, t: Transform): Vec2 {
  const dx = point.x - t.x;
  const dy = point.y - t.y;
  const cos = Math.cos(deg2rad(-t.rotation));
  const sin = Math.sin(deg2rad(-t.rotation));
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** True if a world point lies inside the (rotated, scaled) element box. */
export function pointInElement(point: Vec2, t: Transform, size: Size): boolean {
  const local = worldToLocal(point, t);
  const h = halfExtents(t, size);
  return Math.abs(local.x) <= h.x && Math.abs(local.y) <= h.y;
}

/** Translate an element by a world-space delta. */
export function translated(t: Transform, dx: number, dy: number): Transform {
  return { ...t, x: t.x + dx, y: t.y + dy };
}

/**
 * Uniform scale derived from dragging a corner handle toward/away from the
 * (fixed) center. Returns a new transform with updated `scale`.
 */
export function scaleFromHandle(t: Transform, size: Size, pointer: Vec2): Transform {
  const local = worldToLocal(pointer, t);
  const sx = Math.abs(local.x) / (size.width / 2);
  const sy = Math.abs(local.y) / (size.height / 2);
  const scale = Math.max(MIN_SCALE, Math.max(sx, sy));
  return { ...t, scale };
}

/**
 * Rotation (degrees) such that the rotation handle, which sits directly above
 * the element center, points toward `pointer`. Optionally snap to `snapDeg`.
 */
export function rotationFromHandle(
  center: Vec2,
  pointer: Vec2,
  snapDeg = 0,
): number {
  const angle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
  let deg = (angle * 180) / Math.PI + 90; // handle is above center
  deg = ((deg % 360) + 360) % 360;
  if (snapDeg > 0) deg = Math.round(deg / snapDeg) * snapDeg;
  return deg;
}
