import { describe, it, expect } from "vitest";
import { cameraAt, cameraKeyframes, zoomAround, type CamKey } from "./camera";
import { computeTimeline } from "./timeline";
import { createProject, createScene } from "./factory";
import { cameraViewport, screenToStage } from "./view";
import type { Element } from "./types";

describe("cameraAt", () => {
  const keys: CamKey[] = [
    { t: 0, cam: { x: 0, y: 0, zoom: 1 } },
    { t: 10, cam: { x: 100, y: 0, zoom: 2 } },
  ];

  it("holds the first keyframe before its time", () => {
    expect(cameraAt(keys, -5)).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("holds the last keyframe after its time", () => {
    expect(cameraAt(keys, 99)).toEqual({ x: 100, y: 0, zoom: 2 });
  });

  it("eases between keyframes (midpoint at 50% via smoothstep)", () => {
    const mid = cameraAt(keys, 5);
    // smoothstep(0.5) = 0.5 exactly
    expect(mid.x).toBeCloseTo(50, 6);
    expect(mid.zoom).toBeCloseTo(1.5, 6);
  });

  it("ease-in-out is past the midpoint at 75% of the interval", () => {
    const q = cameraAt(keys, 7.5);
    expect(q.x).toBeGreaterThan(50);
  });
});

describe("cameraKeyframes", () => {
  it("starts from the scene camera and adds element camera targets at their start", () => {
    const p = createProject();
    const scene = createScene();
    scene.cameraKeyframe = { x: 960, y: 540, zoom: 1 };
    const a: Element = {
      id: "a",
      assetId: "x",
      transform: { x: 0, y: 0, scale: 1, rotation: 0, z: 0 },
      anim: { drawDuration: 2, holdDuration: 0, drawOrder: 0, style: "draw", handId: null, easing: "linear" },
    };
    const b: Element = {
      ...a,
      id: "b",
      anim: { ...a.anim, drawOrder: 1 },
      camera: { x: 200, y: 200, zoom: 3 },
    };
    scene.elements = [a, b];
    p.scenes = [scene];
    const tl = computeTimeline(p);
    const keys = cameraKeyframes(p, tl);
    expect(keys[0]).toEqual({ t: 0, cam: { x: 960, y: 540, zoom: 1 } });
    expect(keys[1]).toEqual({ t: 2, cam: { x: 200, y: 200, zoom: 3 } });
  });
});

describe("zoomAround", () => {
  const canvas = { width: 1920, height: 1080 };
  const screen = { width: 1920, height: 1080 };

  it("keeps the stage point under the cursor fixed while zooming in", () => {
    const cam = { x: 960, y: 540, zoom: 1 };
    const cursor = { x: 1400, y: 300 };
    const before = screenToStage(cursor, cameraViewport(canvas, screen, cam));
    const zoomed = zoomAround(cam, canvas, screen, cursor, 1.5);
    const after = screenToStage(cursor, cameraViewport(canvas, screen, zoomed));
    expect(after.x).toBeCloseTo(before.x, 4);
    expect(after.y).toBeCloseTo(before.y, 4);
    expect(zoomed.zoom).toBeCloseTo(1.5, 6);
  });

  it("clamps zoom to the allowed range", () => {
    const cam = { x: 0, y: 0, zoom: 7 };
    expect(zoomAround(cam, canvas, screen, { x: 0, y: 0 }, 4).zoom).toBeLessThanOrEqual(8);
  });
});
