import { describe, it, expect } from "vitest";
import {
  cumulativeLengths,
  flattenPath,
  pointAtLength,
  polylineLength,
  polylinePrefix,
  tangentAtLength,
  type Pt,
} from "./geometry";

function len(d: string): number {
  return flattenPath(d).reduce((s, p) => s + polylineLength(p.points), 0);
}

describe("flattenPath — lines", () => {
  it("flattens a single line", () => {
    const sp = flattenPath("M0 0 L100 0");
    expect(sp).toHaveLength(1);
    expect(sp[0].points[0]).toEqual({ x: 0, y: 0 });
    expect(sp[0].points[sp[0].points.length - 1]).toEqual({ x: 100, y: 0 });
    expect(polylineLength(sp[0].points)).toBeCloseTo(100, 6);
  });

  it("handles H/V and a closing Z (square = 400)", () => {
    expect(len("M0 0 H100 V100 H0 Z")).toBeCloseTo(400, 6);
  });

  it("handles relative commands", () => {
    const sp = flattenPath("m10 10 l10 0 l0 10");
    expect(sp[0].points[0]).toEqual({ x: 10, y: 10 });
    expect(sp[0].points[sp[0].points.length - 1]).toEqual({ x: 20, y: 20 });
  });

  it("treats extra M coordinate pairs as implicit L", () => {
    const sp = flattenPath("M0 0 10 0 10 10");
    expect(polylineLength(sp[0].points)).toBeCloseTo(20, 6);
  });

  it("splits multiple subpaths", () => {
    const sp = flattenPath("M0 0 L10 0 M0 10 L10 10");
    expect(sp).toHaveLength(2);
  });
});

describe("flattenPath — curves", () => {
  it("flattens a cubic with correct endpoints and length > chord", () => {
    const sp = flattenPath("M0 0 C0 50 100 50 100 0");
    const pts = sp[0].points;
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    const last = pts[pts.length - 1];
    expect(last.x).toBeCloseTo(100, 4);
    expect(last.y).toBeCloseTo(0, 4);
    expect(polylineLength(pts)).toBeGreaterThan(100);
  });

  it("approximates a quarter ellipse arc length", () => {
    // Semicircle radius 50: arc length = pi*50 ≈ 157.08
    expect(len("M0 0 A50 50 0 0 1 100 0")).toBeCloseTo(Math.PI * 50, 0);
  });

  it("flattens smooth cubic S using the reflected control point", () => {
    const sp = flattenPath("M0 0 C0 50 50 50 50 0 S100 -50 100 0");
    const last = sp[0].points[sp[0].points.length - 1];
    expect(last.x).toBeCloseTo(100, 4);
    expect(last.y).toBeCloseTo(0, 4);
  });
});

describe("measuring", () => {
  const line: Pt[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];

  it("pointAtLength interpolates and clamps", () => {
    expect(pointAtLength(line, 50)).toEqual({ x: 50, y: 0 });
    expect(pointAtLength(line, -10)).toEqual({ x: 0, y: 0 });
    expect(pointAtLength(line, 999)).toEqual({ x: 100, y: 0 });
  });

  it("pointAtLength on an L-shape crosses the corner", () => {
    const L: Pt[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    expect(pointAtLength(L, 150)).toEqual({ x: 100, y: 50 });
  });

  it("tangent points along travel", () => {
    const t = tangentAtLength(line, 50);
    expect(t.x).toBeCloseTo(1, 6);
    expect(t.y).toBeCloseTo(0, 6);
  });

  it("cumulativeLengths is monotonic and ends at total", () => {
    const cum = cumulativeLengths(line);
    expect(cum[0]).toBe(0);
    expect(cum[cum.length - 1]).toBeCloseTo(100, 6);
  });

  it("polylinePrefix grows monotonically with length", () => {
    const square: Pt[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(polylineLength(polylinePrefix(square, 50))).toBeCloseTo(50, 6);
    expect(polylineLength(polylinePrefix(square, 250))).toBeCloseTo(250, 6);
    expect(polylinePrefix(square, 9999).length).toBe(square.length);
  });
});

describe("determinism", () => {
  it("produces identical output for identical input", () => {
    const a = flattenPath("M0 0 C0 50 100 50 100 0 A50 50 0 0 1 200 0");
    const b = flattenPath("M0 0 C0 50 100 50 100 0 A50 50 0 0 1 200 0");
    expect(a).toEqual(b);
  });
});
