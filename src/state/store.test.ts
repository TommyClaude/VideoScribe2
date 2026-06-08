import { describe, it, expect } from "vitest";
import { reorderZ, normalizeZ } from "./store";
import type { Element } from "../engine/types";

function el(id: string, z: number): Element {
  return {
    id,
    assetId: "a",
    transform: { x: 0, y: 0, scale: 1, rotation: 0, z },
    anim: { drawDuration: 1, holdDuration: 0, drawOrder: 0, style: "draw", handId: null, easing: "linear" },
  };
}

function zOrder(els: Element[]): string[] {
  return [...els].sort((a, b) => a.transform.z - b.transform.z).map((e) => e.id);
}

describe("reorderZ", () => {
  const base = [el("a", 0), el("b", 1), el("c", 2)];

  it("brings an element to the front", () => {
    expect(zOrder(reorderZ(base, "a", "front"))).toEqual(["b", "c", "a"]);
  });

  it("sends an element to the back", () => {
    expect(zOrder(reorderZ(base, "c", "back"))).toEqual(["c", "a", "b"]);
  });

  it("moves one step forward", () => {
    expect(zOrder(reorderZ(base, "a", "forward"))).toEqual(["b", "a", "c"]);
  });

  it("moves one step backward", () => {
    expect(zOrder(reorderZ(base, "c", "backward"))).toEqual(["a", "c", "b"]);
  });

  it("is a no-op moving the front element forward", () => {
    expect(zOrder(reorderZ(base, "c", "forward"))).toEqual(["a", "b", "c"]);
  });

  it("ignores unknown ids", () => {
    expect(zOrder(reorderZ(base, "zzz", "front"))).toEqual(["a", "b", "c"]);
  });
});

describe("normalizeZ", () => {
  it("compacts z values to 0..n-1 preserving order", () => {
    const out = normalizeZ([el("a", 5), el("b", 10), el("c", 7)]);
    const byId = new Map(out.map((e) => [e.id, e.transform.z]));
    expect(byId.get("a")).toBe(0);
    expect(byId.get("c")).toBe(1);
    expect(byId.get("b")).toBe(2);
  });
});
