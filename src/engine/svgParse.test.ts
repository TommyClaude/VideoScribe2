import { describe, it, expect } from "vitest";
import { parseSvg, parseTransform } from "./svgParse";

describe("parseTransform", () => {
  it("parses translate", () => {
    expect(parseTransform("translate(10,20)")).toEqual([1, 0, 0, 1, 10, 20]);
  });

  it("parses scale (single arg = uniform)", () => {
    expect(parseTransform("scale(2)")).toEqual([2, 0, 0, 2, 0, 0]);
  });

  it("composes translate then scale left-to-right", () => {
    // point (1,1) -> scale -> (2,2) -> translate -> (12,22)
    const m = parseTransform("translate(10,20) scale(2)");
    const x = m[0] * 1 + m[2] * 1 + m[4];
    const y = m[1] * 1 + m[3] * 1 + m[5];
    expect([x, y]).toEqual([12, 22]);
  });
});

describe("parseSvg", () => {
  it("reads a single line stroke with correct length", () => {
    const flat = parseSvg('<svg viewBox="0 0 100 100"><line x1="0" y1="0" x2="100" y2="0"/></svg>');
    expect(flat.width).toBe(100);
    expect(flat.strokes).toHaveLength(1);
    expect(flat.totalLength).toBeCloseTo(100, 6);
    expect(flat.strokes[0].cumStart).toBe(0);
  });

  it("applies a group transform to coordinates", () => {
    const flat = parseSvg(
      '<svg viewBox="0 0 100 100"><g transform="translate(10,0)"><line x1="0" y1="0" x2="10" y2="0"/></g></svg>',
    );
    expect(flat.strokes[0].points[0]).toEqual({ x: 10, y: 0 });
    expect(flat.strokes[0].points[1]).toEqual({ x: 20, y: 0 });
  });

  it("normalizes viewBox into natural width/height space", () => {
    // viewBox 0..50 but width 100 => scale x2.
    const flat = parseSvg('<svg width="100" height="100" viewBox="0 0 50 50"><line x1="0" y1="0" x2="50" y2="0"/></svg>');
    expect(flat.strokes[0].points[1].x).toBeCloseTo(100, 6);
  });

  it("resolves fill/stroke per SVG defaults", () => {
    const flat = parseSvg(
      '<svg viewBox="0 0 30 30">' +
        '<rect x="0" y="0" width="10" height="10" fill="none" stroke="red"/>' +
        '<rect x="0" y="0" width="10" height="10"/>' +
        '<rect x="0" y="0" width="10" height="10" fill="#00f" stroke="none"/>' +
        '<rect x="0" y="0" width="10" height="10" fill="none"/>' +
        "</svg>",
    );
    // explicit none fill + red stroke
    expect(flat.strokes[0].stroke).toBe("red");
    expect(flat.strokes[0].fill).toBeNull();
    // no attributes => SVG default fill is black, no stroke
    expect(flat.strokes[1].fill).toBe("#1b1b1b");
    expect(flat.strokes[1].stroke).toBeNull();
    // explicit blue fill, stroke none
    expect(flat.strokes[2].fill).toBe("#00f");
    expect(flat.strokes[2].stroke).toBeNull();
    // fill none + no stroke => outline inked so it stays visible
    expect(flat.strokes[3].fill).toBeNull();
    expect(flat.strokes[3].stroke).toBe("#1b1b1b");
  });

  it("inherits style from parent groups", () => {
    const flat = parseSvg(
      '<svg viewBox="0 0 30 30"><g stroke="green" fill="none"><line x1="0" y1="0" x2="5" y2="0"/></g></svg>',
    );
    expect(flat.strokes[0].stroke).toBe("green");
  });

  it("accumulates cumulative start lengths across strokes", () => {
    const flat = parseSvg(
      '<svg viewBox="0 0 100 100"><line x1="0" y1="0" x2="40" y2="0"/><line x1="0" y1="10" x2="60" y2="10"/></svg>',
    );
    expect(flat.strokes[0].cumStart).toBeCloseTo(0, 6);
    expect(flat.strokes[1].cumStart).toBeCloseTo(40, 6);
    expect(flat.totalLength).toBeCloseTo(100, 6);
  });

  it("skips content inside <defs>", () => {
    const flat = parseSvg('<svg viewBox="0 0 10 10"><defs><line x1="0" y1="0" x2="10" y2="0"/></defs></svg>');
    expect(flat.strokes).toHaveLength(0);
  });
});
