// Export planning: deterministic frame timing, output presets, and the ffmpeg
// argument builder. All pure + unit-tested. The actual frame rendering + IPC to
// the ffmpeg sidecar lives in ui/exportRunner.ts (it needs a canvas + Tauri).

export type RatioName = "16:9" | "1:1" | "9:16" | "4:5";
export type ExportFormat = "mp4" | "gif" | "mov";

export interface Dimensions {
  width: number;
  height: number;
}

export const RATIO_PRESETS: Record<RatioName, Dimensions> = {
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
};

export const FPS_OPTIONS = [24, 30, 60] as const;

/**
 * Deterministic frame times for a clip: t = i / fps for i in [0, n). With a
 * fixed dt the export is reproducible and matches the preview compositor.
 */
export function frameTimes(duration: number, fps: number): number[] {
  const n = Math.max(1, Math.round(duration * fps));
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i / fps);
  return out;
}

export interface ExportAudioInput {
  path: string;
  seek: number; // -ss into the source (s)
  duration: number; // -t length to take (s)
  delayMs: number; // placement on the timeline (ms)
  volume: number; // 0..1
}

export interface FfmpegBuildOpts {
  framePattern: string; // absolute, e.g. /tmp/xx/frame_%06d.png
  fps: number;
  width: number;
  height: number;
  format: ExportFormat;
  outPath: string;
  audio: ExportAudioInput[];
}

function n(v: number): string {
  return String(v);
}

/**
 * Build the ffmpeg argument list for encoding the rendered PNG frame sequence
 * (with optional audio mux). Pure — unit-tested so the central export command
 * can be verified without running ffmpeg.
 */
export function buildFfmpegArgs(o: FfmpegBuildOpts): string[] {
  if (o.format === "gif") {
    const gfps = Math.min(o.fps, 20);
    return [
      "-y",
      "-framerate",
      n(o.fps),
      "-i",
      o.framePattern,
      "-filter_complex",
      `fps=${gfps},scale=${o.width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer`,
      o.outPath,
    ];
  }

  const args: string[] = ["-y", "-framerate", n(o.fps), "-i", o.framePattern];

  // Audio inputs (each: seek + length + file).
  for (const a of o.audio) {
    args.push("-ss", n(a.seek), "-t", n(a.duration), "-i", a.path);
  }

  if (o.audio.length > 0) {
    const labels: string[] = [];
    const parts = o.audio.map((a, i) => {
      const label = `a${i}`;
      labels.push(`[${label}]`);
      return `[${i + 1}:a]adelay=${Math.round(a.delayMs)}:all=1,volume=${a.volume}[${label}]`;
    });
    const filter = `${parts.join(";")};${labels.join("")}amix=inputs=${o.audio.length}:normalize=0[aout]`;
    args.push("-filter_complex", filter, "-map", "0:v", "-map", "[aout]");
  } else {
    args.push("-map", "0:v");
  }

  if (o.format === "mov") {
    // qtrle keeps the RGBA alpha channel (transparent export).
    args.push("-c:v", "qtrle");
  } else {
    args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
  }
  args.push("-r", n(o.fps), o.outPath);
  return args;
}
