import { describe, it, expect } from "vitest";
import {
  boundingBox,
  elementCorners,
  pointInElement,
  rotationFromHandle,
  scaleFromHandle,
  translated,
  worldToLocal,
} from "./transform";
import type { Size, Transform } from "./types";

const size: Size = { width: 200, height: 100 };

function t(over: Partial<Transform> = {}): Transform {
  return { x: 500, y: 300, scale: 1, rotation: 0, z: 0, ...over };
}

describe("elementCorners", () => {
  it("returns axis-aligned corners when unrotated", () => {
    const c = elementCorners(t(), size);
    expect(c[0]).toEqual({ x: 400, y: 250 }); // top-left
    expect(c[2]).toEqual({ x: 600, y: 350 }); // bottom-right
  });

  it("applies uniform scale about the center", () => {
    const c = elementCorners(t({ scale: 2 }), size);
    expect(c[0]).toEqual({ x: 300, y: 200 });
    expect(c[2]).toEqual({ x: 700, y: 400 });
  });

  it("rotates corners about the center", () => {
    const c = elementCorners(t({ rotation: 90 }), size);
    // After 90° the half-width (100) maps to the y axis and half-height (50) to x.
    expect(c[0].x).toBeCloseTo(550, 6);
    expect(c[0].y).toBeCloseTo(200, 6);
  });
});

describe("boundingBox", () => {
  it("grows with rotation", () => {
    const flat = boundingBox(elementCorners(t(), size));
    expect(flat.maxX - flat.minX).toBeCloseTo(200, 6);
    const rot = boundingBox(elementCorners(t({ rotation: 45 }), size));
    expect(rot.maxX - rot.minX).toBeGreaterThan(200);
  });
});

describe("pointInElement", () => {
  it("detects inside/outside for an unrotated box", () => {
    expect(pointInElement({ x: 500, y: 300 }, t(), size)).toBe(true);
    expect(pointInElement({ x: 599, y: 349 }, t(), size)).toBe(true);
    expect(pointInElement({ x: 601, y: 300 }, t(), size)).toBe(false);
  });

  it("respects rotation", () => {
    const rotated = t({ rotation: 90 });
    // A point 40px above center is inside a 90°-rotated 200x100 box
    // (the long axis is now vertical, half-length 100).
    expect(pointInElement({ x: 500, y: 260 }, rotated, size)).toBe(true);
    // A point 90px to the side is now outside (half-width is only 50).
    expect(pointInElement({ x: 590, y: 300 }, rotated, size)).toBe(false);
  });
});

describe("worldToLocal", () => {
  it("inverts translation and rotation", () => {
    const local = worldToLocal({ x: 500, y: 300 }, t({ rotation: 33 }));
    expect(local.x).toBeCloseTo(0, 6);
    expect(local.y).toBeCloseTo(0, 6);
  });
});

describe("translated", () => {
  it("shifts the center", () => {
    expect(translated(t(), 10, -5)).toMatchObject({ x: 510, y: 295 });
  });
});

describe("scaleFromHandle", () => {
  it("computes uniform scale so the corner follows the pointer", () => {
    // Dragging the corner to (700,400) => half extents become (200,100)
    // => scale 2 for both axes.
    const result = scaleFromHandle(t(), size, { x: 700, y: 400 });
    expect(result.scale).toBeCloseTo(2, 6);
  });

  it("clamps to a minimum", () => {
    const result = scaleFromHandle(t(), size, { x: 500, y: 300 });
    expect(result.scale).toBeGreaterThan(0);
  });
});

describe("rotationFromHandle", () => {
  it("returns 0 when the pointer is directly above the center", () => {
    expect(rotationFromHandle({ x: 0, y: 0 }, { x: 0, y: -100 })).toBeCloseTo(0, 6);
  });

  it("returns 90 when the pointer is to the right", () => {
    expect(rotationFromHandle({ x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(90, 6);
  });

  it("snaps to the requested increment", () => {
    const r = rotationFromHandle({ x: 0, y: 0 }, { x: 5, y: -100 }, 15);
    expect(r % 15).toBeCloseTo(0, 6);
  });
});
