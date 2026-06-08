// Starter templates: ready-made projects built from the built-in library that
// users can load and edit. Pure factory functions (deterministic structure).

import { createElement, createProject, newId } from "./factory";
import { LIBRARY, libraryAsset } from "./library";
import type { Project } from "./types";

interface Placement {
  libId: string;
  x: number;
  y: number;
  scale?: number;
  draw?: number;
  hold?: number;
  camera?: { x: number; y: number; zoom: number };
}

function findItem(libId: string) {
  for (const cat of LIBRARY) {
    const it = cat.items.find((i) => i.id === libId);
    if (it) return it;
  }
  return LIBRARY[0].items[0];
}

function build(name: string, background: string, placements: Placement[]): Project {
  const project = createProject(name);
  project.meta.background = background;
  const scene = project.scenes[0];
  scene.elements = [];
  placements.forEach((p, i) => {
    const asset = libraryAsset(findItem(p.libId));
    asset.id = newId("asset");
    project.assets.push(asset);
    const el = createElement(asset, i, project.meta.canvasSize);
    el.transform.x = p.x;
    el.transform.y = p.y;
    if (p.scale != null) el.transform.scale = p.scale;
    el.transform.z = i;
    el.anim.drawOrder = i;
    el.anim.drawDuration = p.draw ?? 2.5;
    el.anim.holdDuration = p.hold ?? 0.8;
    if (p.camera) el.camera = p.camera;
    scene.elements.push(el);
  });
  return project;
}

export interface TemplateDef {
  id: string;
  name: string;
  build: () => Project;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "explainer",
    name: "Explainer",
    build: () =>
      build("Explainer", "#ffffff", [
        { libId: "lightbulb", x: 520, y: 360, scale: 3, draw: 3, camera: { x: 520, y: 360, zoom: 1.4 } },
        { libId: "arrow-right", x: 960, y: 540, scale: 3, draw: 2 },
        { libId: "person", x: 1400, y: 620, scale: 3.2, draw: 3, camera: { x: 1400, y: 600, zoom: 1.5 } },
      ]),
  },
  {
    id: "promo",
    name: "Promo",
    build: () =>
      build("Promo", "#0e1730", [
        { libId: "star", x: 960, y: 420, scale: 4, draw: 2.5, camera: { x: 960, y: 420, zoom: 1.2 } },
        { libId: "heart", x: 620, y: 720, scale: 2.4, draw: 2 },
        { libId: "check", x: 1320, y: 720, scale: 2.4, draw: 1.8 },
      ]),
  },
  {
    id: "education",
    name: "Education",
    build: () =>
      build("Education", "#fffdf5", [
        { libId: "person", x: 560, y: 560, scale: 3.4, draw: 3, camera: { x: 560, y: 540, zoom: 1.5 } },
        { libId: "arrow-curve", x: 960, y: 480, scale: 3, draw: 2 },
        { libId: "lightbulb", x: 1380, y: 470, scale: 2.8, draw: 2.5, camera: { x: 1380, y: 460, zoom: 1.5 } },
      ]),
  },
];
