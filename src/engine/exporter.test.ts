import { describe, it, expect } from "vitest";
import { buildFfmpegArgs, frameTimes, RATIO_PRESETS, type FfmpegBuildOpts } from "./exporter";

describe("frameTimes", () => {
  it("produces fps*duration frames at fixed dt", () => {
    const t = frameTimes(2, 30);
    expect(t).toHaveLength(60);
    expect(t[0]).toBe(0);
    expect(t[1]).toBeCloseTo(1 / 30, 6);
    expect(t[59]).toBeCloseTo(59 / 30, 6);
  });

  it("always yields at least one frame", () => {
    expect(frameTimes(0, 30)).toHaveLength(1);
  });

  it("is deterministic", () => {
    expect(frameTimes(1.5, 24)).toEqual(frameTimes(1.5, 24));
  });
});

describe("RATIO_PRESETS", () => {
  it("uses even, standard dimensions", () => {
    for (const dim of Object.values(RATIO_PRESETS)) {
      expect(dim.width % 2).toBe(0);
      expect(dim.height % 2).toBe(0);
    }
    expect(RATIO_PRESETS["9:16"]).toEqual({ width: 1080, height: 1920 });
  });
});

const base: FfmpegBuildOpts = {
  framePattern: "/tmp/x/frame_%06d.png",
  fps: 30,
  width: 1920,
  height: 1080,
  format: "mp4",
  outPath: "/out/video.mp4",
  audio: [],
};

describe("buildFfmpegArgs — mp4", () => {
  it("encodes H.264 yuv420p with faststart and no audio map", () => {
    const a = buildFfmpegArgs(base);
    expect(a).toContain("libx264");
    expect(a).toContain("yuv420p");
    expect(a).toContain("+faststart");
    expect(a).toContain("/tmp/x/frame_%06d.png");
    expect(a[a.length - 1]).toBe("/out/video.mp4");
    expect(a).toContain("0:v");
    expect(a).not.toContain("[aout]");
  });

  it("muxes audio with delay + volume + amix", () => {
    const a = buildFfmpegArgs({
      ...base,
      audio: [
        { path: "/m.mp3", seek: 0, duration: 10, delayMs: 0, volume: 0.8 },
        { path: "/v.wav", seek: 1, duration: 5, delayMs: 2000, volume: 1 },
      ],
    });
    const fc = a[a.indexOf("-filter_complex") + 1];
    expect(fc).toContain("adelay=2000:all=1");
    expect(fc).toContain("volume=0.8");
    expect(fc).toContain("amix=inputs=2:normalize=0[aout]");
    expect(a).toContain("[aout]");
    // each audio gets its own -ss/-t/-i
    expect(a.filter((x) => x === "-i")).toHaveLength(3); // frames + 2 audio
  });
});

describe("buildFfmpegArgs — gif & mov", () => {
  it("gif uses a palette filtergraph", () => {
    const a = buildFfmpegArgs({ ...base, format: "gif", outPath: "/out/x.gif" });
    const fc = a[a.indexOf("-filter_complex") + 1];
    expect(fc).toContain("palettegen");
    expect(fc).toContain("paletteuse");
  });

  it("mov keeps alpha via qtrle", () => {
    const a = buildFfmpegArgs({ ...base, format: "mov", outPath: "/out/x.mov" });
    expect(a).toContain("qtrle");
    expect(a).not.toContain("yuv420p");
  });
});
