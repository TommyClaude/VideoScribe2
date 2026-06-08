// SVG helpers. Phase 1 only needs intrinsic-size parsing; Phase 2 extends this
// file with path flattening for the draw-on effect. Pure string parsing, no DOM
// (so it runs in tests and during deterministic export).

import type { Size } from "./types";

const NUM = "[-+]?[0-9]*\\.?[0-9]+(?:e[-+]?[0-9]+)?";

/** Strip a unit suffix (px, pt, etc.) and parse the leading number. */
function parseLen(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(new RegExp(`^(${NUM})`));
  return m ? parseFloat(m[1]) : null;
}

function attr(svg: string, name: string): string | undefined {
  const m = svg.match(new RegExp(`<svg[^>]*\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m?.[1];
}

/**
 * Determine an SVG's intrinsic size. Prefers explicit width/height, then the
 * viewBox, falling back to a square default.
 */
export function parseSvgSize(svg: string, fallback = 512): Size {
  const w = parseLen(attr(svg, "width"));
  const h = parseLen(attr(svg, "height"));
  if (w && h) return { width: w, height: h };

  const vb = attr(svg, "viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  return { width: w ?? fallback, height: h ?? fallback };
}

/** Read a viewBox as [minX, minY, width, height], if present. */
export function parseViewBox(
  svg: string,
): [number, number, number, number] | null {
  const vb = attr(svg, "viewBox");
  if (!vb) return null;
  const p = vb.trim().split(/[\s,]+/).map(Number);
  if (p.length === 4 && p.every((n) => Number.isFinite(n))) {
    return [p[0], p[1], p[2], p[3]];
  }
  return null;
}
