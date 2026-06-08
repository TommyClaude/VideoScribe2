import { describe, it, expect } from "vitest";
import { computeTimeline, phaseAt, progressAt } from "./timeline";
import { createProject, createScene } from "./factory";
import type { Element, Project } from "./types";

function el(id: string, drawOrder: number, draw: number, hold: number): Element {
  return {
    id,
    assetId: "a",
    transform: { x: 0, y: 0, scale: 1, rotation: 0, z: drawOrder },
    anim: { drawDuration: draw, holdDuration: hold, drawOrder, style: "draw", handId: null, easing: "linear" },
  };
}

function projectWith(elements: Element[]): Project {
  const p = createProject();
  const scene = createScene();
  scene.elements = elements;
  p.scenes = [scene];
  return p;
}

describe("computeTimeline", () => {
  it("sequences elements with draw + hold and sums total duration", () => {
    const p = projectWith([el("a", 0, 3, 1), el("b", 1, 2, 0.5)]);
    const tl = computeTimeline(p);
    expect(tl.byId.get("a")).toMatchObject({ start: 0, drawEnd: 3, holdEnd: 4 });
    expect(tl.byId.get("b")).toMatchObject({ start: 4, drawEnd: 6, holdEnd: 6.5 });
    expect(tl.duration).toBeCloseTo(6.5, 6);
  });

  it("orders by drawOrder regardless of array order", () => {
    const p = projectWith([el("b", 1, 1, 0), el("a", 0, 1, 0)]);
    const tl = computeTimeline(p);
    expect(tl.timings.map((t) => t.elementId)).toEqual(["a", "b"]);
  });
});

describe("progressAt", () => {
  const p = projectWith([el("a", 0, 4, 1), el("b", 1, 2, 0)]);
  const tl = computeTimeline(p);
  const a = p.scenes[0].elements[0];
  const b = p.scenes[0].elements[1];

  it("ramps the first element 0..1 over its draw window", () => {
    expect(progressAt(tl, a, 0)).toBe(0);
    expect(progressAt(tl, a, 2)).toBeCloseTo(0.5, 6);
    expect(progressAt(tl, a, 4)).toBe(1);
    expect(progressAt(tl, a, 5)).toBe(1); // stays drawn during hold + after
  });

  it("keeps the second element pending until its start (t=5)", () => {
    expect(progressAt(tl, b, 4)).toBe(0);
    expect(progressAt(tl, b, 6)).toBeCloseTo(0.5, 6);
    expect(progressAt(tl, b, 7)).toBe(1);
  });
});

describe("phaseAt", () => {
  const p = projectWith([el("a", 0, 4, 1)]);
  const tl = computeTimeline(p);
  it("reports pending/drawing/hold/done", () => {
    expect(phaseAt(tl, "a", -1)).toBe("pending");
    expect(phaseAt(tl, "a", 2)).toBe("drawing");
    expect(phaseAt(tl, "a", 4.5)).toBe("hold");
    expect(phaseAt(tl, "a", 10)).toBe("done");
  });
});
