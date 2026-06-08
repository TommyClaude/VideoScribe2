// Web Audio glue: decode audio assets, cache waveform peaks, and play tracks
// synced to the timeline. DOM/Web-Audio dependent — needs QC on a real device.
// The timing math (clipWindow / sourceOffsetAt) is pure + tested in engine/audio.

import { clipWindow, computePeaks } from "../engine/audio";
import type { Asset, Project } from "../engine/types";

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext {
  if (!ctx) {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  }
  return ctx;
}

export interface DecodedAudio {
  buffer: AudioBuffer;
  peaks: number[];
  duration: number;
}

const decoded = new Map<string, DecodedAudio>();
const WAVE_BUCKETS = 1200;

/** Decode an audio asset (by its src URL) and cache buffer + waveform peaks. */
export async function decodeAudioAsset(asset: Asset): Promise<DecodedAudio> {
  const cached = decoded.get(asset.id);
  if (cached) return cached;
  const res = await fetch(asset.src ?? "");
  const arr = await res.arrayBuffer();
  const buffer = await audioCtx().decodeAudioData(arr);
  const peaks = computePeaks(buffer.getChannelData(0), WAVE_BUCKETS);
  const d: DecodedAudio = { buffer, peaks, duration: buffer.duration };
  decoded.set(asset.id, d);
  return d;
}

export function getPeaks(assetId: string): number[] | null {
  return decoded.get(assetId)?.peaks ?? null;
}

// ---- playback ----

let active: AudioBufferSourceNode[] = [];

export function stopAudio(): void {
  for (const s of active) {
    try {
      s.stop();
    } catch {
      /* already stopped */
    }
  }
  active = [];
}

/** Start (or schedule) all audio tracks so they're in sync with global time `t`. */
export function playAudioAt(project: Project, t: number): void {
  stopAudio();
  const c = audioCtx();
  if (c.state === "suspended") void c.resume();

  for (const track of [project.audio.music, project.audio.voiceover]) {
    if (!track) continue;
    const dec = decoded.get(track.assetId);
    if (!dec) continue;
    const w = clipWindow(track, dec.duration);
    if (t >= w.timelineEnd) continue;

    const when = Math.max(0, w.timelineStart - t);
    const offset = t > w.timelineStart ? w.srcStart + (t - w.timelineStart) : w.srcStart;
    const playDur = Math.max(0, w.srcEnd - offset);
    if (playDur <= 0) continue;

    const src = c.createBufferSource();
    src.buffer = dec.buffer;
    const gain = c.createGain();
    gain.gain.value = track.volume;
    src.connect(gain).connect(c.destination);
    src.start(c.currentTime + when, offset, playDur);
    active.push(src);
  }
}
