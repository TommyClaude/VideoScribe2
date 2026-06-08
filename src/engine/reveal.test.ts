import { describe, it, expect } from "vitest";
import { revealRegions } from "./reveal";
import type { RevealParams } from "./types";

const right: RevealParams = { direction: "right", rows: 4, jitter: 0 };

function area(regions: { w: number; h: number }[]): number {
  return regions.reduce((s, r) => s + r.w * r.h, 0);
}

describe("revealRegions", () => {
  it("reveals nothing at p=0 (pen at the first band start)", () => {
    const plan = revealRegions(right, 0, 100, 100);
    expect(area(plan.regions)).toBe(0);
    expect(plan.pen).toEqual({ x: 0, y: 12.5 }); // first band centre, left edge
  });

  it("reveals everything at p=1 with the hand lifted", () => {
    const plan = revealRegions(right, 1, 100, 100);
    expect(area(plan.regions)).toBeCloseTo(100 * 100, 6);
    expect(plan.pen).toBeNull();
  });

  it("fills full bands plus a partial sweep", () => {
    // 4 bands; p=0.375 => 1.5 bands => 1 full + half of band 2
    const plan = revealRegions(right, 0.375, 100, 100);
    expect(area(plan.regions)).toBeCloseTo(100 * 25 + 50 * 25, 6);
  });

  it("zig-zags: the second band sweeps from the right", () => {
    const plan = revealRegions(right, 0.3, 100, 100); // 1.2 bands: band#1 active
    const active = plan.regions[plan.regions.length - 1];
    // band index 1 is odd => sweeps from the right edge
    expect(active.x).toBeGreaterThan(0);
    expect(plan.pen!.x).toBeLessThan(100);
  });

  it("monotonically increases revealed area with progress", () => {
    let prev = -1;
    for (let p = 0; p <= 1.0001; p += 0.1) {
      const a = area(revealRegions(right, p, 200, 120).regions);
      expect(a).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = a;
    }
  });

  it("supports vertical sweep (down)", () => {
    const plan = revealRegions({ direction: "down", rows: 2, jitter: 0 }, 0.25, 100, 100);
    // 2 vertical bands; p=0.25 => half of band 0 swept downward
    const r = plan.regions[0];
    expect(r.w).toBeCloseTo(50, 6); // band width
    expect(r.h).toBeCloseTo(50, 6); // half height swept
    expect(plan.pen!.y).toBeCloseTo(50, 6);
  });
});
