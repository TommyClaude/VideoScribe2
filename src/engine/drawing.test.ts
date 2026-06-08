import { describe, it, expect } from "vitest";
import { elementDrawProgress, svgDrawAt } from "./drawing";
import { polylineLength } from "./geometry";
import type { FlatStroke, FlatSvg } from "./svgParse";
import type { ElementAnim } from "./types";

function stroke(points: { x: number; y: number }[], cumStart: number): FlatStroke {
  return {
    points,
    closed: false,
    length: polylineLength(points),
    cumStart,
    fill: null,
    stroke: "#000",
    strokeWidth: 1,
  };
}

// Two horizontal lines, each length 100, total 200.
const A = stroke([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0);
const B = stroke([{ x: 0, y: 10 }, { x: 100, y: 10 }], 100);
const flat: FlatSvg = { width: 100, height: 20, strokes: [A, B], totalLength: 200 };

const anim: ElementAnim = {
  drawDuration: 4,
  holdDuration: 1,
  drawOrder: 0,
  style: "draw",
  handId: "default",
  easing: "linear",
};

describe("elementDrawProgress", () => {
  it("is 0 before start and clamps at 1", () => {
    expect(elementDrawProgress(anim, -1)).toBe(0);
    expect(elementDrawProgress(anim, 0)).toBe(0);
    expect(elementDrawProgress(anim, 2)).toBeCloseTo(0.5, 6);
    expect(elementDrawProgress(anim, 4)).toBe(1);
    expect(elementDrawProgress(anim, 10)).toBe(1);
  });

  it("treats zero drawDuration as instant", () => {
    expect(elementDrawProgress({ ...anim, drawDuration: 0 }, 0.001)).toBe(1);
  });
});

describe("svgDrawAt", () => {
  it("draws nothing at progress 0", () => {
    const plan = svgDrawAt(flat, 0);
    expect(plan.completed).toHaveLength(0);
    expect(plan.active).toBeNull();
    expect(plan.pen).toBeNull();
  });

  it("mid-first-stroke: pen halfway along A", () => {
    const plan = svgDrawAt(flat, 0.25); // target 50
    expect(plan.completed).toHaveLength(0);
    expect(plan.active?.stroke).toBe(A);
    expect(plan.pen?.point).toEqual({ x: 50, y: 0 });
    expect(polylineLength(plan.active!.prefix)).toBeCloseTo(50, 6);
  });

  it("at the boundary: A complete, pen at the start of B", () => {
    const plan = svgDrawAt(flat, 0.5); // target 100
    expect(plan.completed).toContain(A);
    expect(plan.active?.stroke).toBe(B);
    expect(plan.pen?.point).toEqual({ x: 0, y: 10 });
  });

  it("mid-second-stroke: A complete, pen halfway along B", () => {
    const plan = svgDrawAt(flat, 0.75); // target 150
    expect(plan.completed).toContain(A);
    expect(plan.active?.stroke).toBe(B);
    expect(plan.pen?.point).toEqual({ x: 50, y: 10 });
  });

  it("at progress 1: everything complete, hand lifted", () => {
    const plan = svgDrawAt(flat, 1);
    expect(plan.completed).toHaveLength(2);
    expect(plan.active).toBeNull();
    expect(plan.pen).toBeNull();
  });

  it("is deterministic", () => {
    expect(svgDrawAt(flat, 0.42)).toEqual(svgDrawAt(flat, 0.42));
  });
});
