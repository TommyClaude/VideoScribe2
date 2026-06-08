// Zustand store: the single source of truth for the project + editor UI state.
// Engine code never imports this; the store calls into the (pure) engine.

import { create } from "zustand";
import type {
  Asset,
  Element,
  ElementAnim,
  Project,
  Scene,
  Transform,
} from "../engine/types";
import { createElement, createProject, newId } from "../engine/factory";

export type ZDir = "front" | "back" | "forward" | "backward";

interface EditorState {
  project: Project;
  activeSceneId: string;
  selectedElementId: string | null;
  /** Timeline playhead (seconds) — used from Phase 3 on. */
  playhead: number;
  isPlaying: boolean;

  // ---- selectors (cheap helpers) ----
  activeScene: () => Scene;
  selectedElement: () => Element | null;
  assetById: (id: string) => Asset | undefined;

  // ---- mutations ----
  setProject: (project: Project) => void;
  addAsset: (asset: Asset) => void;
  addElementForAsset: (asset: Asset) => Element;
  selectElement: (id: string | null) => void;
  updateTransform: (id: string, patch: Partial<Transform>) => void;
  updateAnim: (id: string, patch: Partial<ElementAnim>) => void;
  removeElement: (id: string) => void;
  moveZ: (id: string, dir: ZDir) => void;
  moveDrawOrder: (id: string, dir: "earlier" | "later") => void;
  setBackground: (color: string) => void;
  setCanvasSize: (width: number, height: number) => void;
  setProjectName: (name: string) => void;
  setPlayhead: (t: number) => void;
  setPlaying: (playing: boolean) => void;
}

const initialProject = createProject();

/** Replace the active scene via an updater, returning a new project. */
function withActiveScene(
  project: Project,
  sceneId: string,
  fn: (scene: Scene) => Scene,
): Project {
  return {
    ...project,
    scenes: project.scenes.map((s) => (s.id === sceneId ? fn(s) : s)),
  };
}

function withElement(scene: Scene, id: string, fn: (el: Element) => Element): Scene {
  return { ...scene, elements: scene.elements.map((e) => (e.id === id ? fn(e) : e)) };
}

/** Reassign sequential z values based on current z ordering. */
function normalizeZ(elements: Element[]): Element[] {
  const sorted = [...elements].sort((a, b) => a.transform.z - b.transform.z);
  const order = new Map(sorted.map((e, i) => [e.id, i]));
  return elements.map((e) => ({
    ...e,
    transform: { ...e.transform, z: order.get(e.id) ?? e.transform.z },
  }));
}

export const useEditor = create<EditorState>((set, get) => ({
  project: initialProject,
  activeSceneId: initialProject.scenes[0].id,
  selectedElementId: null,
  playhead: 0,
  isPlaying: false,

  activeScene: () => {
    const { project, activeSceneId } = get();
    return project.scenes.find((s) => s.id === activeSceneId) ?? project.scenes[0];
  },
  selectedElement: () => {
    const { selectedElementId } = get();
    if (!selectedElementId) return null;
    return get().activeScene().elements.find((e) => e.id === selectedElementId) ?? null;
  },
  assetById: (id) => get().project.assets.find((a) => a.id === id),

  setProject: (project) =>
    set({
      project,
      activeSceneId: project.scenes[0]?.id ?? "",
      selectedElementId: null,
      playhead: 0,
      isPlaying: false,
    }),

  addAsset: (asset) =>
    set((s) => ({ project: { ...s.project, assets: [...s.project.assets, asset] } })),

  addElementForAsset: (asset) => {
    const state = get();
    const scene = state.activeScene();
    const drawOrder = totalElementCount(state.project);
    const el = createElement(asset, drawOrder, state.project.meta.canvasSize);
    el.transform.z = scene.elements.length;
    const hasAsset = state.project.assets.some((a) => a.id === asset.id);
    set((s) => ({
      project: withActiveScene(
        hasAsset ? s.project : { ...s.project, assets: [...s.project.assets, asset] },
        s.activeSceneId,
        (sc) => ({ ...sc, elements: [...sc.elements, el] }),
      ),
      selectedElementId: el.id,
    }));
    return el;
  },

  selectElement: (id) => set({ selectedElementId: id }),

  updateTransform: (id, patch) =>
    set((s) => ({
      project: withActiveScene(s.project, s.activeSceneId, (sc) =>
        withElement(sc, id, (el) => ({ ...el, transform: { ...el.transform, ...patch } })),
      ),
    })),

  updateAnim: (id, patch) =>
    set((s) => ({
      project: withActiveScene(s.project, s.activeSceneId, (sc) =>
        withElement(sc, id, (el) => ({ ...el, anim: { ...el.anim, ...patch } })),
      ),
    })),

  removeElement: (id) =>
    set((s) => ({
      selectedElementId: s.selectedElementId === id ? null : s.selectedElementId,
      project: withActiveScene(s.project, s.activeSceneId, (sc) => ({
        ...sc,
        elements: normalizeZ(sc.elements.filter((e) => e.id !== id)),
      })),
    })),

  moveZ: (id, dir) =>
    set((s) => ({
      project: withActiveScene(s.project, s.activeSceneId, (sc) => ({
        ...sc,
        elements: reorderZ(sc.elements, id, dir),
      })),
    })),

  moveDrawOrder: (id, dir) =>
    set((s) => ({
      project: withActiveScene(s.project, s.activeSceneId, (sc) => ({
        ...sc,
        elements: reorderByDrawOrder(sc.elements, id, dir),
      })),
    })),

  setBackground: (color) =>
    set((s) => ({ project: { ...s.project, meta: { ...s.project.meta, background: color } } })),

  setCanvasSize: (width, height) =>
    set((s) => ({
      project: { ...s.project, meta: { ...s.project.meta, canvasSize: { width, height } } },
    })),

  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, meta: { ...s.project.meta, name } } })),

  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
  setPlaying: (playing) => set({ isPlaying: playing }),
}));

function totalElementCount(project: Project): number {
  return project.scenes.reduce((n, s) => n + s.elements.length, 0);
}

/** Pure z-order reordering used by moveZ (also unit-tested). */
export function reorderZ(elements: Element[], id: string, dir: ZDir): Element[] {
  const sorted = [...elements].sort((a, b) => a.transform.z - b.transform.z);
  const idx = sorted.findIndex((e) => e.id === id);
  if (idx < 0) return elements;
  let target = idx;
  if (dir === "front") target = sorted.length - 1;
  else if (dir === "back") target = 0;
  else if (dir === "forward") target = Math.min(sorted.length - 1, idx + 1);
  else if (dir === "backward") target = Math.max(0, idx - 1);
  if (target === idx) return normalizeZ(elements);
  const [moved] = sorted.splice(idx, 1);
  sorted.splice(target, 0, moved);
  const order = new Map(sorted.map((e, i) => [e.id, i]));
  return elements.map((e) => ({
    ...e,
    transform: { ...e.transform, z: order.get(e.id) ?? e.transform.z },
  }));
}

/** Pure drawOrder reordering used by moveDrawOrder (also unit-tested). */
export function reorderByDrawOrder(
  elements: Element[],
  id: string,
  dir: "earlier" | "later",
): Element[] {
  const sorted = [...elements].sort((a, b) => a.anim.drawOrder - b.anim.drawOrder);
  const idx = sorted.findIndex((e) => e.id === id);
  if (idx < 0) return elements;
  let target = dir === "earlier" ? idx - 1 : idx + 1;
  if (target < 0 || target >= sorted.length) target = idx;
  if (target !== idx) {
    const [moved] = sorted.splice(idx, 1);
    sorted.splice(target, 0, moved);
  }
  const order = new Map(sorted.map((e, i) => [e.id, i]));
  return elements.map((e) => ({
    ...e,
    anim: { ...e.anim, drawOrder: order.get(e.id) ?? e.anim.drawOrder },
  }));
}

// Re-export so tests can reach the helper without DOM/store wiring.
export { normalizeZ };

export { newId };
