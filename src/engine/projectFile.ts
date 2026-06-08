// Project (de)serialization. A .scribe file is self-contained JSON: assets are
// embedded (SVG inline; raster/audio as data URLs) so a project is one portable
// file. Pure + deterministic + unit-tested; blob→dataURL conversion (async DOM)
// happens in ui/projectIO before calling serializeProject.

import {
  PROJECT_VERSION,
  type Asset,
  type Project,
  type ProjectAudio,
  type Scene,
} from "./types";

export function serializeProject(project: Project): string {
  return JSON.stringify({ ...project, version: PROJECT_VERSION }, null, 2);
}

/** Parse + validate + migrate a .scribe JSON string into a Project. */
export function parseProjectJson(text: string): Project {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error("File .scribe không hợp lệ (JSON lỗi).");
  }
  return migrateProject(obj);
}

function asRecord(v: unknown): Record<string, unknown> {
  if (typeof v !== "object" || v === null) throw new Error("File .scribe không hợp lệ.");
  return v as Record<string, unknown>;
}

function softRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

/** Coerce an unknown parsed object into a valid Project, filling defaults. */
export function migrateProject(input: unknown): Project {
  const obj = asRecord(input);
  const meta = softRecord(obj.meta);
  const canvas = softRecord(meta.canvasSize);

  const project: Project = {
    version: PROJECT_VERSION,
    meta: {
      name: typeof meta.name === "string" ? meta.name : "Untitled",
      canvasSize: {
        width: numOr(canvas.width, 1920),
        height: numOr(canvas.height, 1080),
      },
      fps: numOr(meta.fps, 30),
      background: typeof meta.background === "string" ? meta.background : "#ffffff",
    },
    assets: Array.isArray(obj.assets) ? (obj.assets as Asset[]) : [],
    scenes: Array.isArray(obj.scenes) ? (obj.scenes as Scene[]).map(normalizeScene) : [],
    audio: normalizeAudio(obj.audio),
  };

  if (project.scenes.length === 0) {
    throw new Error("File .scribe không có scene nào.");
  }
  return project;
}

function normalizeScene(scene: Scene): Scene {
  return {
    ...scene,
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    cameraKeyframe: scene.cameraKeyframe ?? { x: 960, y: 540, zoom: 1 },
    transition: scene.transition ?? { type: "none", duration: 0.5 },
  };
}

function normalizeAudio(audio: unknown): ProjectAudio {
  if (typeof audio !== "object" || audio === null) return { music: null, voiceover: null };
  const a = audio as Partial<ProjectAudio>;
  return { music: a.music ?? null, voiceover: a.voiceover ?? null };
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
