// Easing functions on the unit interval. Pure + deterministic.

import type { EasingName } from "./types";

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function ease(name: EasingName, tRaw: number): number {
  const t = clamp01(tRaw);
  switch (name) {
    case "linear":
      return t;
    case "easeIn":
      return t * t;
    case "easeOut":
      return 1 - (1 - t) * (1 - t);
    case "easeInOut":
      // smoothstep
      return t * t * (3 - 2 * t);
    default:
      return t;
  }
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
