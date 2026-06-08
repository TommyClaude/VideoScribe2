// Compositor: draws a scene onto a 2D context for a given viewport.
//
// Phase 1 draws every element fully (no animation). Phase 2 extends this with
// per-element draw progress so the SAME function powers preview, export and
// (math-wise) the unit tests. The compositor is intentionally the only piece
// that touches a canvas context; all geometry it relies on is pure + tested.

import { deg2rad } from "./transform";
import type { Element, Scene } from "./types";
import { stageToScreen, type Viewport } from "./view";

/** An image source plus its natural pixel dimensions. */
export interface ResolvedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export type ImageResolver = (assetId: string) => ResolvedImage | null;

export interface SceneRenderOptions {
  vp: Viewport;
  images: ImageResolver;
}

/** Draw all elements of a scene, sorted back-to-front by z. */
export function renderScene(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  scene: Scene,
  opts: SceneRenderOptions,
): void {
  const ordered = [...scene.elements].sort((a, b) => a.transform.z - b.transform.z);
  for (const el of ordered) {
    drawElementFull(ctx, el, opts);
  }
}

/** Draw one element fully (used in Phase 1 and as the "done" state later). */
export function drawElementFull(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  el: Element,
  opts: SceneRenderOptions,
): void {
  const resolved = opts.images(el.assetId);
  if (!resolved) return;
  const center = stageToScreen({ x: el.transform.x, y: el.transform.y }, opts.vp);
  const drawScale = el.transform.scale * opts.vp.scale;
  const w = resolved.width * drawScale;
  const h = resolved.height * drawScale;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(deg2rad(el.transform.rotation));
  ctx.drawImage(resolved.source, -w / 2, -h / 2, w, h);
  ctx.restore();
}
