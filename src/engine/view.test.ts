import { describe, it, expect } from "vitest";
import {
  cameraViewport,
  fitViewport,
  screenToStage,
  stageToScreen,
} from "./view";
import { parseSvgSize, parseViewBox } from "./svg";

describe("fitViewport", () => {
  it("fits a 1920x1080 canvas into a wide screen and centers it", () => {
    const vp = fitViewport({ width: 1920, height: 1080 }, { width: 1920, height: 1080 });
    expect(vp.scale).toBeCloseTo(1, 6);
    expect(vp.offsetX).toBeCloseTo(0, 6);
  });

  it("letterboxes when aspect ratios differ", () => {
    const vp = fitViewport({ width: 1920, height: 1080 }, { width: 1920, height: 2000 });
    expect(vp.scale).toBeCloseTo(1, 6); // limited by width
    expect(vp.offsetY).toBeCloseTo((2000 - 1080) / 2, 6);
  });
});

describe("stageToScreen / screenToStage", () => {
  it("round-trips a point", () => {
    const vp = fitViewport({ width: 1920, height: 1080 }, { width: 800, height: 600 });
    const p = { x: 1234, y: 567 };
    const back = screenToStage(stageToScreen(p, vp), vp);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.y).toBeCloseTo(p.y, 6);
  });
});

describe("cameraViewport", () => {
  it("centers the camera target on screen", () => {
    const screen = { width: 1920, height: 1080 };
    const canvas = { width: 1920, height: 1080 };
    const vp = cameraViewport(canvas, screen, { x: 960, y: 540, zoom: 1 });
    const c = stageToScreen({ x: 960, y: 540 }, vp);
    expect(c.x).toBeCloseTo(960, 6);
    expect(c.y).toBeCloseTo(540, 6);
  });

  it("zoom magnifies about the camera center", () => {
    const screen = { width: 1920, height: 1080 };
    const canvas = { width: 1920, height: 1080 };
    const vp = cameraViewport(canvas, screen, { x: 960, y: 540, zoom: 2 });
    expect(vp.scale).toBeCloseTo(2, 6);
    const c = stageToScreen({ x: 960, y: 540 }, vp);
    expect(c.x).toBeCloseTo(960, 6); // center stays put under zoom
  });
});

describe("parseSvgSize", () => {
  it("reads explicit width/height", () => {
    expect(parseSvgSize('<svg width="300" height="150"></svg>')).toEqual({
      width: 300,
      height: 150,
    });
  });

  it("strips units", () => {
    expect(parseSvgSize('<svg width="24px" height="24px"></svg>')).toEqual({
      width: 24,
      height: 24,
    });
  });

  it("falls back to viewBox", () => {
    expect(parseSvgSize('<svg viewBox="0 0 64 32"></svg>')).toEqual({
      width: 64,
      height: 32,
    });
  });

  it("uses fallback when nothing is present", () => {
    expect(parseSvgSize("<svg></svg>", 100)).toEqual({ width: 100, height: 100 });
  });
});

describe("parseViewBox", () => {
  it("parses comma/space separated values", () => {
    expect(parseViewBox('<svg viewBox="0,0,10,20"></svg>')).toEqual([0, 0, 10, 20]);
  });

  it("returns null without a viewBox", () => {
    expect(parseViewBox("<svg></svg>")).toBeNull();
  });
});
