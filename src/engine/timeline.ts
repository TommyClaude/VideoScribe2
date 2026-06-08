// Timeline scheduling: turn a project into a deterministic, sequential schedule
// of element draw windows, and answer "what is element X's progress at time t".
//
// The whiteboard model is sequential: elements draw one after another in
// drawOrder; each occupies [start, start+drawDuration] to draw, then holds for
// holdDuration before the next begins. Pure + tested. The visual timeline UI
// (Phase 3) is built on top of this.

import { audioEndTime } from "./audio";
import { elementDrawProgress } from "./drawing";
import type { Element, Project } from "./types";

export interface ElementTiming {
  elementId: string;
  sceneId: string;
  order: number; // global sequence position
  start: number; // global seconds when drawing begins
  drawEnd: number; // start + drawDuration
  holdEnd: number; // drawEnd + holdDuration (next element starts here)
}

export interface TimelineLayout {
  timings: ElementTiming[]; // in play order
  byId: Map<string, ElementTiming>;
  duration: number; // total seconds
}

interface SceneElement {
  sceneId: string;
  el: Element;
  sceneIndex: number;
}

/** Flatten all elements across scenes into global play order. */
function orderedElements(project: Project): SceneElement[] {
  const all: SceneElement[] = [];
  project.scenes.forEach((scene, sceneIndex) => {
    for (const el of scene.elements) all.push({ sceneId: scene.id, el, sceneIndex });
  });
  // Sort by scene order, then by the element's drawOrder, then z as a tiebreak.
  all.sort((a, b) => {
    if (a.sceneIndex !== b.sceneIndex) return a.sceneIndex - b.sceneIndex;
    if (a.el.anim.drawOrder !== b.el.anim.drawOrder) {
      return a.el.anim.drawOrder - b.el.anim.drawOrder;
    }
    return a.el.transform.z - b.el.transform.z;
  });
  return all;
}

export function computeTimeline(project: Project): TimelineLayout {
  const ordered = orderedElements(project);
  const timings: ElementTiming[] = [];
  const byId = new Map<string, ElementTiming>();
  let cursor = 0;
  ordered.forEach(({ el, sceneId }, i) => {
    const draw = Math.max(0, el.anim.drawDuration);
    const hold = Math.max(0, el.anim.holdDuration);
    const timing: ElementTiming = {
      elementId: el.id,
      sceneId,
      order: i,
      start: cursor,
      drawEnd: cursor + draw,
      holdEnd: cursor + draw + hold,
    };
    timings.push(timing);
    byId.set(el.id, timing);
    cursor = timing.holdEnd;
  });
  return { timings, byId, duration: cursor };
}

/** Total play/export duration: the later of the element timeline and audio. */
export function projectDuration(project: Project, layout?: TimelineLayout): number {
  const tl = layout ?? computeTimeline(project);
  const durationOf = (id: string) => project.assets.find((a) => a.id === id)?.duration ?? 0;
  return Math.max(tl.duration, audioEndTime(project, durationOf));
}

/** Element draw progress (0..1) at global time `t`, using its timing window. */
export function progressAt(layout: TimelineLayout, el: Element, t: number): number {
  const timing = layout.byId.get(el.id);
  if (!timing) return 1; // not scheduled -> treat as fully drawn (editor view)
  return elementDrawProgress(el.anim, t - timing.start);
}

/** Phase of an element at time t. */
export function phaseAt(
  layout: TimelineLayout,
  elementId: string,
  t: number,
): "pending" | "drawing" | "hold" | "done" {
  const timing = layout.byId.get(elementId);
  if (!timing) return "done";
  if (t < timing.start) return "pending";
  if (t < timing.drawEnd) return "drawing";
  if (t < timing.holdEnd) return "hold";
  return "done";
}
