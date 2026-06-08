// Project save/open/draft. Works in Tauri (native dialogs + Rust fs) and in a
// plain browser (download / file input / localStorage) so it's usable in dev.
// Assets are embedded as data URLs at save time so a .scribe file is portable.

import { invoke } from "@tauri-apps/api/core";
import { serializeProject, parseProjectJson } from "../engine/projectFile";
import type { Project } from "../engine/types";
import { isTauri } from "./assets";
import { decodeAudioAsset } from "./audioEngine";

const DRAFT_KEY = "scribely-draft";

function toDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = () => reject(new Error("could not read blob"));
          fr.readAsDataURL(blob);
        }),
    );
}

/** Embed blob-URL assets as data URLs so the project is self-contained. */
async function embedAssets(project: Project): Promise<Project> {
  const assets = await Promise.all(
    project.assets.map(async (a) => {
      if ((a.type === "image" || a.type === "audio") && a.src?.startsWith("blob:")) {
        return { ...a, src: await toDataUrl(a.src) };
      }
      return a;
    }),
  );
  return { ...project, assets };
}

export async function serializeForSave(project: Project): Promise<string> {
  return serializeProject(await embedAssets(project));
}

/** Decode audio assets so waveforms + playback work after load. */
export async function hydrateAudio(project: Project): Promise<void> {
  for (const a of project.assets) {
    if (a.type === "audio" && a.src) {
      try {
        await decodeAudioAsset(a);
      } catch {
        /* ignore decode errors */
      }
    }
  }
}

function fileName(project: Project): string {
  return `${project.meta.name.replace(/[^\w.-]+/g, "_") || "scribely"}.scribe`;
}

/** Save the project. Returns the path (Tauri) or true (browser), null if canceled. */
export async function saveProject(project: Project): Promise<string | boolean | null> {
  const json = await serializeForSave(project);
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: fileName(project),
      filters: [{ name: "Scribely", extensions: ["scribe"] }],
    });
    if (!path) return null;
    await invoke("save_text_file", { path, contents: json });
    return path;
  }
  // browser: download
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName(project);
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Open a .scribe project. Returns the parsed project, or null if canceled. */
export async function openProject(): Promise<Project | null> {
  let json: string | null = null;
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ multiple: false, filters: [{ name: "Scribely", extensions: ["scribe"] }] });
    if (typeof path !== "string") return null;
    json = await invoke<string>("read_text_file", { path });
  } else {
    json = await pickTextFile();
    if (json == null) return null;
  }
  const project = parseProjectJson(json);
  await hydrateAudio(project);
  return project;
}

function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".scribe,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.click();
  });
}

// ---- auto-save draft ----

export async function saveDraft(project: Project): Promise<void> {
  const json = await serializeForSave(project);
  if (isTauri()) {
    await invoke("save_draft", { contents: json });
  } else {
    try {
      localStorage.setItem(DRAFT_KEY, json);
    } catch {
      /* quota / disabled */
    }
  }
}

export async function loadDraft(): Promise<Project | null> {
  let json: string | null = null;
  if (isTauri()) {
    json = await invoke<string | null>("load_draft");
  } else {
    json = localStorage.getItem(DRAFT_KEY);
  }
  if (!json) return null;
  try {
    const project = parseProjectJson(json);
    await hydrateAudio(project);
    return project;
  } catch {
    return null;
  }
}
