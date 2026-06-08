// Audio math: waveform peak reduction, clip-window computation, and the
// project's audio end time. Pure + deterministic + unit-tested. Actual
// decoding/playback (Web Audio) lives in the UI layer.

import type { Project, AudioTrack } from "./types";

/**
 * Reduce a channel of PCM samples to `buckets` peak magnitudes (0..1) for
 * waveform drawing. Each bucket holds the max |sample| in its slice.
 */
export function computePeaks(channel: Float32Array | number[], buckets: number): number[] {
  const peaks = new Array(buckets).fill(0) as number[];
  const n = channel.length;
  if (n === 0 || buckets <= 0) return peaks;
  const size = n / buckets;
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * size);
    const end = Math.min(n, Math.floor((i + 1) * size));
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}

export interface ClipWindow {
  timelineStart: number; // when the clip starts on the timeline (s)
  timelineEnd: number; // when it ends on the timeline (s)
  srcStart: number; // offset into the source (s)
  srcEnd: number; // end offset into the source (s)
}

/** The playable window of a track given its source asset duration. */
export function clipWindow(track: AudioTrack, assetDuration: number): ClipWindow {
  const srcStart = clampNum(track.trimStart, 0, assetDuration);
  const srcEnd = clampNum(track.trimEnd ?? assetDuration, srcStart, assetDuration);
  const length = srcEnd - srcStart;
  return {
    timelineStart: track.startTime,
    timelineEnd: track.startTime + length,
    srcStart,
    srcEnd,
  };
}

/**
 * Source offset to start playback from at global time `t`, or null if `t` is
 * outside the clip's window. Used to (re)start a Web Audio source mid-timeline.
 */
export function sourceOffsetAt(
  track: AudioTrack,
  assetDuration: number,
  t: number,
): number | null {
  const w = clipWindow(track, assetDuration);
  if (t < w.timelineStart || t >= w.timelineEnd) return null;
  return w.srcStart + (t - w.timelineStart);
}

/** Latest time any audio track ends, given asset durations by id. */
export function audioEndTime(project: Project, durationOf: (assetId: string) => number): number {
  let end = 0;
  for (const track of [project.audio.music, project.audio.voiceover]) {
    if (!track) continue;
    const w = clipWindow(track, durationOf(track.assetId));
    if (w.timelineEnd > end) end = w.timelineEnd;
  }
  return end;
}

function clampNum(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}
