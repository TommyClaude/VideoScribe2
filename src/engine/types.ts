// Core data model for Scribely projects.
//
// Pure type definitions — no runtime dependencies, no DOM, no React.
// Everything the engine and UI share about a project lives here.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Placement of an element on the virtual stage canvas.
 * `x`/`y` is the element CENTER (in stage coordinates), which makes uniform
 * scaling and rotation handles behave intuitively.
 */
export interface Transform {
  x: number;
  y: number;
  scale: number; // uniform scale (1 = asset natural size)
  rotation: number; // degrees, clockwise
  z: number; // z-order, higher = in front
}

export type DrawStyle = "draw" | "fade" | "pop";

export type EasingName = "linear" | "easeIn" | "easeOut" | "easeInOut";

/** How an element animates in. */
export interface ElementAnim {
  drawDuration: number; // seconds spent drawing the element in
  holdDuration: number; // seconds to hold after drawing before the next element
  drawOrder: number; // global sequence index
  style: DrawStyle;
  handId: string | null; // which hand sprite follows the pen (null = no hand)
  easing: EasingName;
}

export type AssetType = "svg" | "image" | "audio";

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  /** Absolute path on disk (Tauri). Optional for inline/generated assets. */
  path?: string;
  /** For svg assets: the raw SVG markup. */
  svg?: string;
  /** For image assets: a renderer-usable src (data URL or asset URL). */
  src?: string;
  /** Natural pixel size, when known. */
  width?: number;
  height?: number;
}

export interface CameraKeyframe {
  x: number; // center of the view in stage coordinates
  y: number;
  zoom: number; // 1 = fit the whole canvas, >1 = zoomed in
}

/** Raster "reveal" parameters (Phase 7). */
export interface RevealParams {
  direction: "left" | "right" | "up" | "down" | "diagonal";
  rows: number; // number of zig-zag bands
  jitter: number; // 0..1 scribble irregularity
}

export interface TextSpec {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: number;
}

export interface Element {
  id: string;
  assetId: string;
  transform: Transform;
  anim: ElementAnim;
  /** Optional per-element camera target ("camera bám phần tử"). */
  camera?: CameraKeyframe;
  /** Optional reveal config for raster images. */
  reveal?: RevealParams;
  /** Inline text element (rendered without an asset). */
  text?: TextSpec;
}

export interface SceneTransition {
  type: "none" | "fade";
  duration: number;
}

export interface Scene {
  id: string;
  name: string;
  cameraKeyframe: CameraKeyframe;
  transition: SceneTransition;
  elements: Element[];
}

export interface AudioTrack {
  assetId: string;
  startTime: number; // when playback starts on the timeline (s)
  trimStart: number; // offset into the source clip (s)
  trimEnd: number | null; // end offset into the source clip (s), null = to end
  volume: number; // 0..1
}

export interface ProjectAudio {
  music: AudioTrack | null;
  voiceover: AudioTrack | null;
}

export interface ProjectMeta {
  name: string;
  canvasSize: Size;
  fps: number;
  background: string; // CSS color
}

export interface Project {
  version: number;
  meta: ProjectMeta;
  assets: Asset[];
  scenes: Scene[];
  audio: ProjectAudio;
}

/** Current schema version, bumped when the model changes incompatibly. */
export const PROJECT_VERSION = 1;
