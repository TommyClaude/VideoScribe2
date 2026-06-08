// Asset import + an image cache for the stage/compositor.
//
// Works both inside Tauri (native file dialog + fs) and in a plain browser dev
// session (hidden <input type=file>), so the editor is at least partially
// exercisable with `npm run dev`. The native path needs visual QC on a Mac.

import { newId } from "../engine/factory";
import { getHand } from "../engine/hands";
import { parseSvgSize } from "../engine/svg";
import { parseSvg, type FlatSvg } from "../engine/svgParse";
import type { Asset, Size } from "../engine/types";
import type { ResolvedImage } from "../engine/compositor";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  flac: "audio/flac",
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Load an image src and resolve its natural size. */
export function loadImageSize(src: string): Promise<Size> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("failed to load image"));
    img.src = src;
  });
}

// ---- Native (Tauri) import ----

async function tauriOpen(extensions: string[]): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    filters: [{ name: "Asset", extensions }],
  });
  return typeof selected === "string" ? selected : null;
}

async function tauriReadText(path: string): Promise<string> {
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  return readTextFile(path);
}

async function tauriReadBytes(path: string): Promise<Uint8Array> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  return readFile(path);
}

function baseName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

// ---- Browser fallback ----

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/** Import an SVG file as an asset (reads markup, parses intrinsic size). */
export async function importSvg(): Promise<Asset | null> {
  let name: string;
  let svg: string;
  if (isTauri()) {
    const path = await tauriOpen(["svg"]);
    if (!path) return null;
    name = baseName(path);
    svg = await tauriReadText(path);
    const size = parseSvgSize(svg);
    return { id: newId("asset"), type: "svg", name, path, svg, ...size };
  }
  const file = await pickFile("image/svg+xml,.svg");
  if (!file) return null;
  name = file.name;
  svg = await file.text();
  const size = parseSvgSize(svg);
  return { id: newId("asset"), type: "svg", name, svg, ...size };
}

/** Import a raster image as an asset (object URL + natural size). */
export async function importImage(): Promise<Asset | null> {
  if (isTauri()) {
    const path = await tauriOpen(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
    if (!path) return null;
    const bytes = await tauriReadBytes(path);
    const mime = MIME[extOf(path)] ?? "application/octet-stream";
    // Copy into a plain ArrayBuffer so the Blob typing is unambiguous.
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([ab], { type: mime }));
    const size = await loadImageSize(url);
    return { id: newId("asset"), type: "image", name: baseName(path), path, src: url, ...size };
  }
  const file = await pickFile("image/*");
  if (!file) return null;
  const url = URL.createObjectURL(file);
  const size = await loadImageSize(url);
  return { id: newId("asset"), type: "image", name: file.name, src: url, ...size };
}

/** Import an audio file (mp3/wav/…) as an audio asset (object URL + path). */
export async function importAudio(): Promise<Asset | null> {
  if (isTauri()) {
    const path = await tauriOpen(["mp3", "wav", "m4a", "aac", "ogg", "flac"]);
    if (!path) return null;
    const bytes = await tauriReadBytes(path);
    const mime = MIME[extOf(path)] ?? "audio/mpeg";
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const url = URL.createObjectURL(new Blob([ab], { type: mime }));
    return { id: newId("asset"), type: "audio", name: baseName(path), path, src: url };
  }
  const file = await pickFile("audio/*");
  if (!file) return null;
  const url = URL.createObjectURL(file);
  return { id: newId("asset"), type: "audio", name: file.name, src: url };
}

// ---- Image cache for rendering ----
//
// Keyed by asset id. SVGs are rasterized via a data URL so the compositor can
// drawImage them. The cache notifies a listener when an image finishes loading
// so the stage can redraw.

interface CacheEntry {
  status: "loading" | "ready" | "error";
  resolved: ResolvedImage | null;
}

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function onImageLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Load `src` into an Image under `key`, notifying listeners when ready. */
function beginLoad(key: string, src: string, width?: number, height?: number) {
  cache.set(key, { status: "loading", resolved: null });
  const img = new Image();
  img.onload = () => {
    cache.set(key, {
      status: "ready",
      resolved: { source: img, width: width ?? img.naturalWidth, height: height ?? img.naturalHeight },
    });
    notify();
  };
  img.onerror = () => {
    cache.set(key, { status: "error", resolved: null });
    notify();
  };
  img.src = src;
}

function resolveImage(key: string, src: string, width?: number, height?: number): ResolvedImage | null {
  const entry = cache.get(key);
  if (!entry) {
    beginLoad(key, src, width, height);
    return null;
  }
  return entry.resolved;
}

/**
 * Resolve a raster asset's image for the compositor. Returns null while loading;
 * triggers a load + notification on first request. SVG assets resolve to null
 * here (they go through resolveSvg / the stroke renderer instead).
 */
export function resolveAssetImage(asset: Asset | undefined): ResolvedImage | null {
  if (!asset || asset.type !== "image") return null;
  return resolveImage(asset.id, asset.src ?? "", asset.width, asset.height);
}

/** Resolve a loaded hand sprite image by hand id. */
export function resolveHandImage(handId: string): ResolvedImage | null {
  const hand = getHand(handId);
  if (!hand) return null;
  return resolveImage(`hand:${hand.id}`, hand.src, hand.width, hand.height);
}

// ---- SVG flatten cache (pure parse, no async load) ----

const svgCache = new Map<string, FlatSvg>();

/** Parse + cache an SVG asset into a FlatSvg for the stroke renderer. */
export function resolveSvg(asset: Asset | undefined): FlatSvg | null {
  if (!asset || asset.type !== "svg" || !asset.svg) return null;
  let flat = svgCache.get(asset.id);
  if (!flat) {
    flat = parseSvg(asset.svg);
    svgCache.set(asset.id, flat);
  }
  return flat;
}
