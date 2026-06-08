// Built-in starter SVG library. Simple stroke-based icons that animate well
// with the draw-on effect. Authored inline so they ship with the app (no asset
// folder needed); users can still import their own SVGs.

import { newId } from "./factory";
import { parseSvgSize } from "./svg";
import type { Asset } from "./types";

export interface LibraryItem {
  id: string;
  name: string;
  svg: string;
}

export interface LibraryCategory {
  category: string;
  items: LibraryItem[];
}

const S = '#222';
function wrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${inner}</svg>`;
}
function stroke(d: string, w = 5): string {
  return `<path d="${d}" fill="none" stroke="${S}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export const LIBRARY: LibraryCategory[] = [
  {
    category: "Arrows",
    items: [
      { id: "arrow-right", name: "Arrow", svg: wrap(stroke("M12 50 H82") + stroke("M62 30 L84 50 L62 70")) },
      { id: "arrow-curve", name: "Curved arrow", svg: wrap(stroke("M15 80 C15 30 60 25 85 30") + stroke("M70 18 L88 30 L72 44")) },
    ],
  },
  {
    category: "Shapes",
    items: [
      { id: "circle", name: "Circle", svg: wrap(`<circle cx="50" cy="50" r="36" fill="none" stroke="${S}" stroke-width="5"/>`) },
      { id: "square", name: "Square", svg: wrap(`<rect x="16" y="16" width="68" height="68" rx="6" fill="none" stroke="${S}" stroke-width="5"/>`) },
      { id: "star", name: "Star", svg: wrap(stroke("M50 10 L61 39 L92 39 L67 58 L77 90 L50 70 L23 90 L33 58 L8 39 L39 39 Z")) },
      { id: "heart", name: "Heart", svg: wrap(stroke("M50 82 C16 58 18 24 50 38 C82 24 84 58 50 82 Z")) },
    ],
  },
  {
    category: "Icons",
    items: [
      { id: "check", name: "Check", svg: wrap(stroke("M18 54 L42 76 L84 28", 7)) },
      {
        id: "lightbulb",
        name: "Idea",
        svg: wrap(
          `<circle cx="50" cy="42" r="26" fill="none" stroke="${S}" stroke-width="5"/>` +
            stroke("M40 66 H60") +
            stroke("M42 76 H58") +
            stroke("M46 86 H54"),
        ),
      },
      {
        id: "cloud",
        name: "Cloud",
        svg: wrap(stroke("M28 66 C12 66 12 46 30 46 C30 28 60 28 62 44 C82 40 86 66 70 66 Z")),
      },
      {
        id: "smiley",
        name: "Smiley",
        svg: wrap(
          `<circle cx="50" cy="50" r="36" fill="none" stroke="${S}" stroke-width="5"/>` +
            `<circle cx="38" cy="42" r="3.5" fill="${S}"/>` +
            `<circle cx="62" cy="42" r="3.5" fill="${S}"/>` +
            stroke("M34 60 C42 74 58 74 66 60"),
        ),
      },
    ],
  },
  {
    category: "People",
    items: [
      {
        id: "person",
        name: "Person",
        svg: wrap(
          `<circle cx="50" cy="22" r="12" fill="none" stroke="${S}" stroke-width="5"/>` +
            stroke("M50 34 V64") +
            stroke("M50 42 L30 56") +
            stroke("M50 42 L70 56") +
            stroke("M50 64 L34 88") +
            stroke("M50 64 L66 88"),
        ),
      },
    ],
  },
];

/** Build a fresh SVG asset from a library item. */
export function libraryAsset(item: LibraryItem): Asset {
  const size = parseSvgSize(item.svg);
  return { id: newId("asset"), type: "svg", name: item.name, svg: item.svg, ...size };
}
