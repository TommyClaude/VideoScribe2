// Compositor: draws a scene onto a 2D context at a given moment.
//
// Each element is rendered at its draw `progress` (0..1):
//   - SVG + style "draw": progressive strokes + fill reveal, with the hand
//     following the pen tip (the core whiteboard effect).
//   - style "fade": cross-fade in.
//   - style "pop": scale-in.
//   - raster images: fade/scale (true raster "reveal" arrives in Phase 7).
//
// This single function powers preview AND export (only the source of `t`/dt and
// the canvas resolution differ), so output matches exactly. The geometry it
// relies on is pure + unit-tested; this file is the canvas glue.

import { svgDrawAt } from "./drawing";
import type { Pt } from "./geometry";
import { getHand, handPlacement } from "./hands";
import { defaultReveal, revealRegions } from "./reveal";
import { deg2rad, naturalToWorld } from "./transform";
import type { Element, Scene, Size } from "./types";
import type { FlatStroke, FlatSvg } from "./svgParse";
import { stageToScreen, type Viewport } from "./view";

const DEFAULT_INK = "#1b1b1b";
const MIN_STROKE_W = 1.2;
const HAND_FRACTION = 0.3; // hand height as a fraction of canvas height

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** An image source plus its natural pixel dimensions. */
export interface ResolvedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface FrameResolvers {
  /** Raster image for an asset id (or null while loading / not raster). */
  image: (assetId: string) => ResolvedImage | null;
  /** Parsed + flattened SVG for an asset id (or null if not an SVG). */
  svg: (assetId: string) => FlatSvg | null;
  /** Loaded hand sprite image for a hand id. */
  handImage: (handId: string) => ResolvedImage | null;
}

export interface FrameOptions {
  vp: Viewport;
  canvas: Size; // project canvas size (for hand sizing)
  resolvers: FrameResolvers;
  /** Draw progress (already eased) for an element, 0..1. */
  progressOf: (el: Element) => number;
}

function ink(s: FlatStroke): string {
  return s.stroke ?? s.fill ?? DEFAULT_INK;
}

function trace(ctx: Ctx2D, points: Pt[]): void {
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
}

/** Run `fn` with the context mapped into the element's natural pixel space. */
function withElementTransform(
  ctx: Ctx2D,
  el: Element,
  size: Size,
  vp: Viewport,
  extraScale: number,
  fn: () => void,
): void {
  const center = stageToScreen({ x: el.transform.x, y: el.transform.y }, vp);
  const s = el.transform.scale * vp.scale * extraScale;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(deg2rad(el.transform.rotation));
  ctx.scale(s, s);
  ctx.translate(-size.width / 2, -size.height / 2);
  fn();
  ctx.restore();
}

function paintStrokeFull(ctx: Ctx2D, s: FlatStroke): void {
  if (s.fill && s.closed) {
    ctx.beginPath();
    trace(ctx, s.points);
    ctx.closePath();
    ctx.fillStyle = s.fill;
    ctx.fill();
  }
  ctx.beginPath();
  trace(ctx, s.points);
  if (s.closed) ctx.closePath();
  ctx.strokeStyle = ink(s);
  ctx.lineWidth = Math.max(s.strokeWidth, MIN_STROKE_W);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function paintStrokePrefix(ctx: Ctx2D, s: FlatStroke, prefix: Pt[]): void {
  if (prefix.length < 2) return;
  ctx.beginPath();
  trace(ctx, prefix);
  ctx.strokeStyle = ink(s);
  ctx.lineWidth = Math.max(s.strokeWidth, MIN_STROKE_W);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawHand(ctx: Ctx2D, el: Element, size: Size, penNatural: Pt, opts: FrameOptions): void {
  const hand = getHand(el.anim.handId);
  if (!hand) return;
  const img = opts.resolvers.handImage(hand.id);
  if (!img) return;
  const penWorld = naturalToWorld(penNatural, el.transform, size);
  const penScreen = stageToScreen(penWorld, opts.vp);
  const handHeightStage = HAND_FRACTION * opts.canvas.height;
  const displayScale = (handHeightStage * opts.vp.scale) / hand.height;
  const box = handPlacement(penScreen, hand, displayScale);
  ctx.drawImage(img.source, box.x, box.y, box.width, box.height);
}

function drawSvgElement(ctx: Ctx2D, el: Element, flat: FlatSvg, progress: number, opts: FrameOptions): void {
  const size: Size = { width: flat.width, height: flat.height };

  if (el.anim.style === "fade") {
    ctx.save();
    ctx.globalAlpha = progress;
    withElementTransform(ctx, el, size, opts.vp, 1, () => {
      for (const s of flat.strokes) paintStrokeFull(ctx, s);
    });
    ctx.restore();
    return;
  }

  if (el.anim.style === "pop") {
    const popScale = 0.6 + 0.4 * progress;
    ctx.save();
    ctx.globalAlpha = Math.min(1, progress * 2);
    withElementTransform(ctx, el, size, opts.vp, popScale, () => {
      for (const s of flat.strokes) paintStrokeFull(ctx, s);
    });
    ctx.restore();
    return;
  }

  // style "draw": progressive strokes + hand.
  const plan = svgDrawAt(flat, progress);
  withElementTransform(ctx, el, size, opts.vp, 1, () => {
    for (const s of plan.completed) paintStrokeFull(ctx, s);
    if (plan.active) paintStrokePrefix(ctx, plan.active.stroke, plan.active.prefix);
  });
  if (plan.pen) drawHand(ctx, el, size, plan.pen.point, opts);
}

function drawRasterElement(
  ctx: Ctx2D,
  el: Element,
  img: ResolvedImage,
  progress: number,
  opts: FrameOptions,
): void {
  const size: Size = { width: img.width, height: img.height };

  // style "draw": progressive "scan reveal" with the hand at the edge.
  if (el.anim.style === "draw") {
    const plan = revealRegions(el.reveal ?? defaultReveal(), progress, size.width, size.height);
    withElementTransform(ctx, el, size, opts.vp, 1, () => {
      if (plan.regions.length === 0) return;
      ctx.save();
      ctx.beginPath();
      for (const r of plan.regions) ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.drawImage(img.source, 0, 0, size.width, size.height);
      ctx.restore();
    });
    if (plan.pen) drawHand(ctx, el, size, plan.pen, opts);
    return;
  }

  // fade / pop
  const extraScale = el.anim.style === "pop" ? 0.6 + 0.4 * progress : 1;
  const alpha = el.anim.style === "pop" ? Math.min(1, progress * 2) : progress;
  ctx.save();
  ctx.globalAlpha = alpha;
  withElementTransform(ctx, el, size, opts.vp, extraScale, () => {
    ctx.drawImage(img.source, 0, 0, size.width, size.height);
  });
  ctx.restore();
}

/** Draw a single element at its current progress. */
export function drawElementAt(ctx: Ctx2D, el: Element, opts: FrameOptions): void {
  const progress = opts.progressOf(el);
  if (progress <= 0) return; // pending: nothing visible yet

  const flat = opts.resolvers.svg(el.assetId);
  if (flat) {
    drawSvgElement(ctx, el, flat, progress, opts);
    return;
  }
  const img = opts.resolvers.image(el.assetId);
  if (img) {
    drawRasterElement(ctx, el, img, progress, opts);
  }
}

/** Draw a whole scene (elements back-to-front by z) at the given options. */
export function renderSceneAt(ctx: Ctx2D, scene: Scene, opts: FrameOptions): void {
  const ordered = [...scene.elements].sort((a, b) => a.transform.z - b.transform.z);
  for (const el of ordered) drawElementAt(ctx, el, opts);
}
