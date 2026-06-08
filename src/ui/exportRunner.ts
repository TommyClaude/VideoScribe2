// Export orchestration: render every frame with the SAME compositor as preview
// (only the time source differs — a fixed dt), write PNGs to a temp dir via
// Rust, then invoke the ffmpeg sidecar to encode + mux. Tauri-only; needs Mac QC.

import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { renderSceneAt, type FrameOptions } from "../engine/compositor";
import { cameraAt, cameraKeyframes } from "../engine/camera";
import { clipWindow } from "../engine/audio";
import {
  buildFfmpegArgs,
  frameTimes,
  RATIO_PRESETS,
  type ExportAudioInput,
  type ExportFormat,
  type RatioName,
} from "../engine/exporter";
import { computeTimeline, progressAt, projectDuration } from "../engine/timeline";
import type { Project } from "../engine/types";
import { cameraViewport } from "../engine/view";
import {
  preloadHandImage,
  preloadImageAsset,
  resolveAssetImage,
  resolveHandImage,
  resolveSvg,
} from "./assets";

export interface ExportOptions {
  ratio: RatioName;
  fps: number;
  format: ExportFormat;
  transparent: boolean; // only meaningful for mov
}

export interface ExportProgress {
  phase: "preparing" | "rendering" | "encoding" | "done" | "canceled";
  frame?: number;
  total?: number;
  outPath?: string;
}

function byId(project: Project, id: string) {
  return project.assets.find((a) => a.id === id);
}

function sanitize(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 60) || "scribely";
}

async function preloadMedia(project: Project): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  for (const asset of project.assets) {
    if (asset.type === "image") tasks.push(preloadImageAsset(asset));
  }
  const handIds = new Set<string>();
  for (const scene of project.scenes) {
    for (const el of scene.elements) if (el.anim.handId) handIds.add(el.anim.handId);
  }
  for (const id of handIds) tasks.push(preloadHandImage(id));
  await Promise.all(tasks);
}

function buildAudioInputs(project: Project): ExportAudioInput[] {
  const inputs: ExportAudioInput[] = [];
  for (const track of [project.audio.music, project.audio.voiceover]) {
    if (!track) continue;
    const asset = byId(project, track.assetId);
    if (!asset?.path || !asset.duration) continue; // need a real file path to mux
    const w = clipWindow(track, asset.duration);
    inputs.push({
      path: asset.path,
      seek: w.srcStart,
      duration: w.srcEnd - w.srcStart,
      delayMs: w.timelineStart * 1000,
      volume: track.volume,
    });
  }
  return inputs;
}

function frameToBase64(canvas: HTMLCanvasElement): string {
  // toDataURL is synchronous and already base64-encodes the PNG.
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

/**
 * Run a full export. Returns the output path, or null if the user canceled the
 * save dialog or aborted. `isCanceled` is polled between frames.
 */
export async function runExport(
  project: Project,
  opts: ExportOptions,
  onProgress: (p: ExportProgress) => void,
  isCanceled: () => boolean,
): Promise<string | null> {
  onProgress({ phase: "preparing" });

  const outPath = await save({
    defaultPath: `${sanitize(project.meta.name)}.${opts.format}`,
    filters: [{ name: opts.format.toUpperCase(), extensions: [opts.format] }],
  });
  if (!outPath) return null;

  await preloadMedia(project);

  const { width, height } = RATIO_PRESETS[opts.ratio];
  const timeline = computeTimeline(project);
  const camKeys = cameraKeyframes(project, timeline);
  const duration = projectDuration(project, timeline);
  const times = frameTimes(duration, opts.fps);
  const projectCanvas = project.meta.canvasSize;
  const transparent = opts.format === "mov" && opts.transparent;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: transparent });
  if (!ctx) throw new Error("could not get 2D context for export");

  const dir = await invoke<string>("create_export_dir");

  try {
    onProgress({ phase: "rendering", frame: 0, total: times.length });
    for (let i = 0; i < times.length; i++) {
      if (isCanceled()) {
        await invoke("remove_export_dir", { dir });
        onProgress({ phase: "canceled" });
        return null;
      }
      const t = times[i];

      if (transparent) {
        ctx.clearRect(0, 0, width, height);
      } else {
        ctx.fillStyle = project.meta.background;
        ctx.fillRect(0, 0, width, height);
      }

      const vp = cameraViewport(projectCanvas, { width, height }, cameraAt(camKeys, t));
      const frameOpts: FrameOptions = {
        vp,
        canvas: projectCanvas,
        resolvers: {
          image: (id) => resolveAssetImage(byId(project, id)),
          svg: (id) => resolveSvg(byId(project, id)),
          handImage: (id) => resolveHandImage(id),
        },
        progressOf: (el) => progressAt(timeline, el, t),
      };
      for (const scene of project.scenes) renderSceneAt(ctx, scene, frameOpts);

      await invoke("write_frame", { dir, index: i, data: frameToBase64(canvas) });
      onProgress({ phase: "rendering", frame: i + 1, total: times.length });

      // Yield so the UI/progress can update.
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    onProgress({ phase: "encoding", frame: times.length, total: times.length });
    const args = buildFfmpegArgs({
      framePattern: `${dir}/frame_%06d.png`,
      fps: opts.fps,
      width,
      height,
      format: opts.format,
      outPath,
      audio: opts.format === "gif" ? [] : buildAudioInputs(project),
    });
    await invoke("run_ffmpeg", { args });

    onProgress({ phase: "done", outPath });
    return outPath;
  } finally {
    await invoke("remove_export_dir", { dir });
  }
}
