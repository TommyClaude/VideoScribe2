// Asset import + an image cache for the stage/compositor.
//
// Works both inside Tauri (native file dialog + fs) and in a plain browser dev
// session (hidden <input type=file>), so the editor is at least partially
// exercisable with `npm run dev`. The native path needs visual QC on a Mac.

import { newId } from "../engine/factory";
import { parseSvgSize } from "../engine/svg";
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

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function beginLoad(asset: Asset) {
  cache.set(asset.id, { status: "loading", resolved: null });
  const img = new Image();
  const src = asset.type === "svg" ? svgDataUrl(asset.svg ?? "") : asset.src ?? "";
  img.onload = () => {
    cache.set(asset.id, {
      status: "ready",
      resolved: {
        source: img,
        width: asset.width ?? img.naturalWidth,
        height: asset.height ?? img.naturalHeight,
      },
    });
    notify();
  };
  img.onerror = () => {
    cache.set(asset.id, { status: "error", resolved: null });
    notify();
  };
  img.src = src;
}

/**
 * Resolve an asset's image for the compositor. Returns null while loading;
 * triggers a load + notification on first request.
 */
export function resolveAssetImage(asset: Asset | undefined): ResolvedImage | null {
  if (!asset || asset.type === "audio") return null;
  const entry = cache.get(asset.id);
  if (!entry) {
    beginLoad(asset);
    return null;
  }
  return entry.resolved;
}
