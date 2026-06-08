// Draw-on engine: deterministic state of a drawing at a given progress.
//
// `svgDrawAt(flat, p)` returns which strokes are fully drawn, which one is
// mid-draw (with its progressive prefix), and where the pen tip is — all in the
// SVG's natural pixel space. The compositor maps this to the screen and places
// the hand. Pure + deterministic (no time, no DOM): the same `p` always yields
// the same plan, so preview and export match exactly.

import { clamp01, ease } from "./easing";
import { pointAtLength, polylinePrefix, tangentAtLength, type Pt } from "./geometry";
import type { FlatStroke, FlatSvg } from "./svgParse";
import type { ElementAnim } from "./types";

const EPS = 1e-6;

/** Eased draw progress (0..1) for an element, given time since its start. */
export function elementDrawProgress(anim: ElementAnim, localT: number): number {
  if (localT <= 0) return 0;
  if (anim.drawDuration <= 0) return 1;
  return ease(anim.easing, clamp01(localT / anim.drawDuration));
}

export interface ActiveStroke {
  stroke: FlatStroke;
  prefix: Pt[];
}

export interface PenState {
  point: Pt; // pen tip in natural SVG space
  tangent: Pt; // unit direction of travel
}

export interface SvgRenderPlan {
  completed: FlatStroke[];
  active: ActiveStroke | null;
  pen: PenState | null;
}

/** Compute the render plan for an SVG drawing at overall progress `p` (0..1). */
export function svgDrawAt(flat: FlatSvg, p: number): SvgRenderPlan {
  const progress = clamp01(p);
  if (flat.totalLength <= 0 || progress <= 0) {
    return { completed: [], active: null, pen: null };
  }
  if (progress >= 1 - EPS) {
    return { completed: flat.strokes.slice(), active: null, pen: null };
  }

  const target = progress * flat.totalLength;
  const completed: FlatStroke[] = [];
  let active: ActiveStroke | null = null;
  let pen: PenState | null = null;

  for (const stroke of flat.strokes) {
    const end = stroke.cumStart + stroke.length;
    if (end <= target + EPS) {
      completed.push(stroke);
    } else if (stroke.cumStart <= target) {
      const local = target - stroke.cumStart;
      active = { stroke, prefix: polylinePrefix(stroke.points, local) };
      pen = {
        point: pointAtLength(stroke.points, local),
        tangent: tangentAtLength(stroke.points, local),
      };
      break;
    } else {
      break;
    }
  }

  return { completed, active, pen };
}
