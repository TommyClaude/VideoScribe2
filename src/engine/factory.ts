// Factory helpers: create well-formed projects/scenes/elements with sane
// defaults. Kept out of the render path — id generation here is fine to be
// non-deterministic (it never feeds render(project, t)).

import {
  type Asset,
  type CameraKeyframe,
  type Element,
  type ElementAnim,
  type Project,
  type Scene,
  type Size,
  PROJECT_VERSION,
} from "./types";

let idCounter = 0;

/** Generate a unique id. Uses crypto.randomUUID when available. */
export function newId(prefix = "id"): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return `${prefix}_${g.crypto.randomUUID()}`;
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export const DEFAULT_CANVAS: Size = { width: 1920, height: 1080 };

export function defaultCamera(canvas: Size = DEFAULT_CANVAS): CameraKeyframe {
  return { x: canvas.width / 2, y: canvas.height / 2, zoom: 1 };
}

export function defaultAnim(drawOrder: number): ElementAnim {
  return {
    drawDuration: 3,
    holdDuration: 1,
    drawOrder,
    style: "draw",
    handId: "default",
    easing: "easeInOut",
  };
}

export function createScene(name = "Scene 1", canvas: Size = DEFAULT_CANVAS): Scene {
  return {
    id: newId("scene"),
    name,
    cameraKeyframe: defaultCamera(canvas),
    transition: { type: "none", duration: 0.5 },
    elements: [],
  };
}

export function createProject(name = "Untitled"): Project {
  return {
    version: PROJECT_VERSION,
    meta: {
      name,
      canvasSize: { ...DEFAULT_CANVAS },
      fps: 30,
      background: "#ffffff",
    },
    assets: [],
    scenes: [createScene()],
    audio: { music: null, voiceover: null },
  };
}

/**
 * Create an element for an asset, centered on the canvas and scaled so its
 * largest dimension fits comfortably within the canvas.
 */
export function createElement(
  asset: Asset,
  drawOrder: number,
  canvas: Size = DEFAULT_CANVAS,
): Element {
  const w = asset.width ?? 400;
  const h = asset.height ?? 400;
  const target = Math.min(canvas.width, canvas.height) * 0.5;
  const scale = target / Math.max(w, h);
  return {
    id: newId("el"),
    assetId: asset.id,
    transform: {
      x: canvas.width / 2,
      y: canvas.height / 2,
      scale,
      rotation: 0,
      z: drawOrder,
    },
    anim: defaultAnim(drawOrder),
  };
}
