// Raster "reveal" animation: progressively uncover a bitmap with a zig-zag band
// sweep, with the pen/hand riding the revealing edge. Pure + deterministic +
// unit-tested; the compositor clips the image to these regions.

import type { RevealParams, Vec2 } from "./types";

export interface RevealRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RevealPlan {
  regions: RevealRegion[]; // revealed area in the image's natural pixel space
  pen: Vec2 | null; // current revealing edge (null when complete)
}

export function defaultReveal(): RevealParams {
  return { direction: "right", rows: 8, jitter: 0 };
}

/**
 * Regions revealed at progress `p` (0..1) for an image of `width`×`height`.
 * Bands fill in order; the active band sweeps across, alternating direction
 * (zig-zag). The pen sits at the active sweep edge.
 */
export function revealRegions(
  params: RevealParams,
  p: number,
  width: number,
  height: number,
): RevealPlan {
  const prog = p < 0 ? 0 : p > 1 ? 1 : p;
  const bands = Math.max(1, Math.floor(params.rows));
  const vertical = params.direction === "up" || params.direction === "down";

  if (vertical) {
    return sweep(prog, bands, width, height, true, params.direction === "down");
  }
  // left / right / diagonal(→ horizontal fallback)
  return sweep(prog, bands, width, height, false, params.direction !== "left");
}

/**
 * @param vertical bands stacked along x, sweeping along y; else bands stacked
 *   along y, sweeping along x.
 * @param forward first band sweeps in the +axis direction.
 */
function sweep(
  prog: number,
  bands: number,
  width: number,
  height: number,
  vertical: boolean,
  forward: boolean,
): RevealPlan {
  const bandSize = (vertical ? width : height) / bands;
  const total = prog * bands;
  const full = Math.floor(total);
  const within = total - full;
  const regions: RevealRegion[] = [];

  for (let i = 0; i < Math.min(full, bands); i++) {
    regions.push(vertical ? { x: i * bandSize, y: 0, w: bandSize, h: height } : { x: 0, y: i * bandSize, w: width, h: bandSize });
  }

  if (full >= bands) return { regions, pen: null };
  if (within <= 0) {
    // exactly at a band boundary: pen at the start of the next band
    const dirFwd = (full % 2 === 0) === forward;
    const main = vertical ? height : width;
    const edge = dirFwd ? 0 : main;
    return {
      regions,
      pen: vertical
        ? { x: full * bandSize + bandSize / 2, y: edge }
        : { x: edge, y: full * bandSize + bandSize / 2 },
    };
  }

  const dirFwd = (full % 2 === 0) === forward;
  const main = vertical ? height : width;
  const sweepLen = within * main;
  const start = dirFwd ? 0 : main - sweepLen;
  const edge = dirFwd ? sweepLen : main - sweepLen;

  if (vertical) {
    regions.push({ x: full * bandSize, y: start, w: bandSize, h: sweepLen });
    return { regions, pen: { x: full * bandSize + bandSize / 2, y: edge } };
  }
  regions.push({ x: start, y: full * bandSize, w: sweepLen, h: bandSize });
  return { regions, pen: { x: edge, y: full * bandSize + bandSize / 2 } };
}
