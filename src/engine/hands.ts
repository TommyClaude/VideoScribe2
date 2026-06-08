// Hand sprites for the draw-on effect.
//
// Each hand is an image with a known "pen tip" pixel (`tip`). The compositor
// positions the hand so its tip sits exactly on the current pen point on the
// path. Hands are defined as inline SVGs (crisp, easy to author, exact tip
// coordinate). They're placeholders — real artwork + visual QC come in Phase 10.

import type { Vec2 } from "./types";

export interface HandDef {
  id: string;
  name: string;
  src: string; // data URL
  width: number; // natural pixel width
  height: number; // natural pixel height
  tip: Vec2; // pen-tip location in image pixels
}

const W = 240;
const H = 300;
const TIP: Vec2 = { x: 30, y: 286 };

interface PenStyle {
  pen: string;
  penHi: string;
  skin: string;
  skinEdge: string;
  sleeve: string;
  penWidth?: number;
  tipColor?: string;
  tipR?: number;
}

/** Build a hand+pen SVG with the given pen and skin colors. */
function handSvg(p: PenStyle): string {
  const pw = p.penWidth ?? 22;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    // forearm / sleeve
    `<rect x="150" y="150" width="120" height="170" rx="34" fill="${p.sleeve}"/>` +
    // hand / fist
    `<g fill="${p.skin}" stroke="${p.skinEdge}" stroke-width="3">` +
    `<ellipse cx="178" cy="158" rx="60" ry="46"/>` +
    `<rect x="138" y="120" width="80" height="46" rx="22"/>` +
    `<rect x="150" y="150" width="70" height="70" rx="26"/>` +
    `</g>` +
    // pen body + highlight + tip
    `<line x1="${TIP.x}" y1="${TIP.y}" x2="158" y2="118" stroke="${p.pen}" stroke-width="${pw}" stroke-linecap="round"/>` +
    `<line x1="44" y1="270" x2="150" y2="120" stroke="${p.penHi}" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="${TIP.x}" cy="${TIP.y}" r="${p.tipR ?? 7}" fill="${p.tipColor ?? "#16223b"}"/>` +
    `</svg>`
  );
}

function dataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function makeHand(id: string, name: string, svg: string): HandDef {
  return { id, name, src: dataUrl(svg), width: W, height: H, tip: { ...TIP } };
}

export const HANDS: HandDef[] = [
  makeHand(
    "default",
    "Pen · light skin",
    handSvg({ pen: "#2f6fe0", penHi: "#7ea8f2", skin: "#f1c9a5", skinEdge: "#d9a877", sleeve: "#3a4a66" }),
  ),
  makeHand(
    "dark",
    "Pen · dark skin",
    handSvg({ pen: "#2f6fe0", penHi: "#7ea8f2", skin: "#8d5a3c", skinEdge: "#6e4631", sleeve: "#2b3242" }),
  ),
  makeHand(
    "marker",
    "Marker · light skin",
    handSvg({ pen: "#e0562f", penHi: "#f2a07e", skin: "#f1c9a5", skinEdge: "#d9a877", sleeve: "#3a4a66", penWidth: 30, tipColor: "#a83518", tipR: 11 }),
  ),
  makeHand(
    "brush",
    "Brush · medium skin",
    handSvg({ pen: "#5a3b22", penHi: "#9c6f47", skin: "#c98d5a", skinEdge: "#a06a3d", sleeve: "#384a2f", penWidth: 26, tipColor: "#1d1d1d", tipR: 13 }),
  ),
];

const BY_ID = new Map(HANDS.map((h) => [h.id, h]));

export function getHand(id: string | null | undefined): HandDef | undefined {
  if (!id) return undefined;
  return BY_ID.get(id);
}

export interface HandBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where to draw the hand image (screen space) so its pen tip lands on `pen`.
 * `displayScale` is screen pixels per hand-image pixel.
 */
export function handPlacement(pen: Vec2, hand: HandDef, displayScale: number): HandBox {
  return {
    x: pen.x - hand.tip.x * displayScale,
    y: pen.y - hand.tip.y * displayScale,
    width: hand.width * displayScale,
    height: hand.height * displayScale,
  };
}
