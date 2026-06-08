import { describe, it, expect } from "vitest";
import { migrateProject, parseProjectJson, serializeProject } from "./projectFile";
import { createProject } from "./factory";
import { libraryAsset, LIBRARY } from "./library";
import { createElement } from "./factory";

describe("serialize/parse round-trip", () => {
  it("preserves a project through serialize → parse", () => {
    const p = createProject("My Project");
    const asset = libraryAsset(LIBRARY[1].items[0]); // a circle
    p.assets.push(asset);
    p.scenes[0].elements.push(createElement(asset, 0));
    const parsed = parseProjectJson(serializeProject(p));
    expect(parsed.meta.name).toBe("My Project");
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.scenes[0].elements).toHaveLength(1);
    expect(parsed).toEqual(p);
  });
});

describe("migrateProject", () => {
  it("fills missing audio/transition defaults", () => {
    const p = migrateProject({
      meta: { name: "x", canvasSize: { width: 1080, height: 1080 }, fps: 24, background: "#000" },
      assets: [],
      scenes: [{ id: "s", name: "S", elements: [] }],
    });
    expect(p.audio).toEqual({ music: null, voiceover: null });
    expect(p.scenes[0].transition).toEqual({ type: "none", duration: 0.5 });
    expect(p.meta.fps).toBe(24);
  });

  it("applies defaults for malformed meta", () => {
    const p = migrateProject({ scenes: [{ id: "s", name: "S", elements: [] }] });
    expect(p.meta.canvasSize).toEqual({ width: 1920, height: 1080 });
    expect(p.meta.background).toBe("#ffffff");
  });

  it("rejects projects with no scenes", () => {
    expect(() => migrateProject({ scenes: [] })).toThrow();
  });

  it("rejects invalid JSON", () => {
    expect(() => parseProjectJson("{not json")).toThrow();
  });
});
