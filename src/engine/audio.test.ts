import { describe, it, expect } from "vitest";
import { audioEndTime, clipWindow, computePeaks, sourceOffsetAt } from "./audio";
import { createProject } from "./factory";
import type { AudioTrack } from "./types";

describe("computePeaks", () => {
  it("returns one peak per bucket as the max magnitude", () => {
    const data = [0, 0.5, -0.9, 0.2, 0.1, -0.3, 1, -1];
    const peaks = computePeaks(data, 4);
    expect(peaks).toHaveLength(4);
    expect(peaks[0]).toBeCloseTo(0.5, 6); // [0,0.5]
    expect(peaks[1]).toBeCloseTo(0.9, 6); // [-0.9,0.2]
    expect(peaks[3]).toBeCloseTo(1, 6); // [1,-1]
  });

  it("handles empty input", () => {
    expect(computePeaks([], 3)).toEqual([0, 0, 0]);
  });
});

describe("clipWindow", () => {
  const track: AudioTrack = { assetId: "a", startTime: 2, trimStart: 1, trimEnd: 5, volume: 1 };

  it("maps trim + start onto the timeline", () => {
    const w = clipWindow(track, 10);
    expect(w).toEqual({ timelineStart: 2, timelineEnd: 6, srcStart: 1, srcEnd: 5 });
  });

  it("defaults trimEnd to the asset duration", () => {
    const w = clipWindow({ ...track, trimEnd: null }, 10);
    expect(w.srcEnd).toBe(10);
    expect(w.timelineEnd).toBe(11); // start 2 + (10-1)
  });
});

describe("sourceOffsetAt", () => {
  const track: AudioTrack = { assetId: "a", startTime: 2, trimStart: 1, trimEnd: 5, volume: 1 };

  it("returns null before/after the window", () => {
    expect(sourceOffsetAt(track, 10, 1)).toBeNull();
    expect(sourceOffsetAt(track, 10, 6)).toBeNull();
  });

  it("returns the source offset inside the window", () => {
    expect(sourceOffsetAt(track, 10, 3)).toBeCloseTo(2, 6); // srcStart 1 + (3-2)
  });
});

describe("audioEndTime", () => {
  it("is the max end across music + voiceover", () => {
    const p = createProject();
    p.audio.music = { assetId: "m", startTime: 0, trimStart: 0, trimEnd: null, volume: 1 };
    p.audio.voiceover = { assetId: "v", startTime: 5, trimStart: 0, trimEnd: null, volume: 1 };
    const end = audioEndTime(p, (id) => (id === "m" ? 8 : 4));
    expect(end).toBe(9); // voiceover 5 + 4
  });

  it("is 0 with no audio", () => {
    expect(audioEndTime(createProject(), () => 10)).toBe(0);
  });
});
