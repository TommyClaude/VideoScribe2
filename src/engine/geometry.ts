// Pure 2D path geometry: parse an SVG path `d` string into flattened polylines
// and measure them. This is the math behind the "draw-on" effect and the hand
// position, so it is fully deterministic and DOM-free (testable in Node).
//
// Beziers are flattened by recursive de Casteljau subdivision to a flatness
// tolerance; arcs are converted (endpoint -> center param) and sampled by
// angle. Same input always yields the same points.

export interface Pt {
  x: number;
  y: number;
}

export interface Polyline {
  points: Pt[];
  closed: boolean;
}

const DEFAULT_TOL = 0.3;
const MAX_DEPTH = 18;

// ---- number / command tokenizing ----

const NUM_RE = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;

function readNumbers(s: string): number[] {
  const out: number[] = [];
  const m = s.match(NUM_RE);
  if (m) for (const t of m) out.push(parseFloat(t));
  return out;
}

interface Command {
  code: string;
  args: number[];
}

function tokenize(d: string): Command[] {
  const cmds: Command[] = [];
  const re = /([astvzqmhlcASTVZQMHLC])([^astvzqmhlcASTVZQMHLC]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    cmds.push({ code: m[1], args: readNumbers(m[2]) });
  }
  return cmds;
}

// ---- bezier flattening ----

function flat3(
  p0: Pt,
  p1: Pt,
  p2: Pt,
  p3: Pt,
  out: Pt[],
  tol: number,
  depth: number,
): void {
  // Distance of control points from the chord; cheap flatness test.
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const d1 = Math.abs((p1.x - p3.x) * dy - (p1.y - p3.y) * dx);
  const d2 = Math.abs((p2.x - p3.x) * dy - (p2.y - p3.y) * dx);
  if (depth >= MAX_DEPTH || (d1 + d2) * (d1 + d2) < tol * tol * (dx * dx + dy * dy)) {
    out.push(p3);
    return;
  }
  const p01 = mid(p0, p1);
  const p12 = mid(p1, p2);
  const p23 = mid(p2, p3);
  const p012 = mid(p01, p12);
  const p123 = mid(p12, p23);
  const p0123 = mid(p012, p123);
  flat3(p0, p01, p012, p0123, out, tol, depth + 1);
  flat3(p0123, p123, p23, p3, out, tol, depth + 1);
}

function flat2(p0: Pt, p1: Pt, p2: Pt, out: Pt[], tol: number): void {
  // Elevate the quadratic to a cubic and reuse flat3.
  const c1 = { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) };
  const c2 = { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) };
  flat3(p0, c1, c2, p2, out, tol, 0);
}

function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ---- arc conversion (endpoint -> sampled polyline) ----

function arcToPoints(
  p0: Pt,
  rx: number,
  ry: number,
  phiDeg: number,
  largeArc: number,
  sweep: number,
  end: Pt,
  out: Pt[],
): void {
  if (rx === 0 || ry === 0 || (p0.x === end.x && p0.y === end.y)) {
    out.push(end);
    return;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0.x - end.x) / 2;
  const dy = (p0.y - end.y) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;

  let rxs = rx * rx;
  let rys = ry * ry;
  const x1ps = x1p * x1p;
  const y1ps = y1p * y1p;
  // Correct out-of-range radii.
  const lambda = x1ps / rxs + y1ps / rys;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxs = rx * rx;
    rys = ry * ry;
  }

  let factor = (rxs * rys - rxs * y1ps - rys * x1ps) / (rxs * y1ps + rys * x1ps);
  factor = Math.sqrt(Math.max(0, factor));
  if (largeArc === sweep) factor = -factor;
  const cxp = (factor * (rx * y1p)) / ry;
  const cyp = (factor * -(ry * x1p)) / rx;
  const cx = cos * cxp - sin * cyp + (p0.x + end.x) / 2;
  const cy = sin * cxp + cos * cyp + (p0.y + end.y) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const segments = Math.max(2, Math.ceil(Math.abs(dTheta) / (Math.PI / 16)));
  for (let i = 1; i <= segments; i++) {
    const t = theta1 + (dTheta * i) / segments;
    const ex = cos * rx * Math.cos(t) - sin * ry * Math.sin(t) + cx;
    const ey = sin * rx * Math.cos(t) + cos * ry * Math.sin(t) + cy;
    out.push({ x: ex, y: ey });
  }
}

// ---- main path flattener ----

/** Parse and flatten an SVG path `d` string into subpaths of points. */
export function flattenPath(d: string, tol: number = DEFAULT_TOL): Polyline[] {
  const cmds = tokenize(d);
  const subpaths: Polyline[] = [];
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let points: Pt[] = [];
  let lastCtrl: Pt | null = null;
  let lastCode = "";

  const flush = (closed: boolean) => {
    if (points.length >= 2) subpaths.push({ points, closed });
    points = [];
  };

  for (const { code, args } of cmds) {
    const rel = code === code.toLowerCase();
    const C = code.toUpperCase();
    let i = 0;
    const num = () => args[i++];
    const pt = (): Pt => {
      const x = num();
      const y = num();
      return rel ? { x: cur.x + x, y: cur.y + y } : { x, y };
    };

    switch (C) {
      case "M": {
        if (points.length) flush(false);
        cur = pt();
        start = { ...cur };
        points = [{ ...cur }];
        // Subsequent pairs are implicit L.
        while (i < args.length) {
          cur = pt();
          points.push({ ...cur });
        }
        break;
      }
      case "L":
        while (i < args.length) {
          cur = pt();
          points.push({ ...cur });
        }
        break;
      case "H":
        while (i < args.length) {
          const x = num();
          cur = { x: rel ? cur.x + x : x, y: cur.y };
          points.push({ ...cur });
        }
        break;
      case "V":
        while (i < args.length) {
          const y = num();
          cur = { x: cur.x, y: rel ? cur.y + y : y };
          points.push({ ...cur });
        }
        break;
      case "C":
        while (i < args.length) {
          const c1 = pt();
          const c2 = pt();
          const end = pt();
          flat3(cur, c1, c2, end, points, tol, 0);
          lastCtrl = c2;
          cur = end;
        }
        break;
      case "S":
        while (i < args.length) {
          const c1: Pt =
            lastCode === "C" || lastCode === "S"
              ? { x: 2 * cur.x - (lastCtrl?.x ?? cur.x), y: 2 * cur.y - (lastCtrl?.y ?? cur.y) }
              : { ...cur };
          const c2 = pt();
          const end = pt();
          flat3(cur, c1, c2, end, points, tol, 0);
          lastCtrl = c2;
          cur = end;
        }
        break;
      case "Q":
        while (i < args.length) {
          const c1 = pt();
          const end = pt();
          flat2(cur, c1, end, points, tol);
          lastCtrl = c1;
          cur = end;
        }
        break;
      case "T":
        while (i < args.length) {
          const c1: Pt =
            lastCode === "Q" || lastCode === "T"
              ? { x: 2 * cur.x - (lastCtrl?.x ?? cur.x), y: 2 * cur.y - (lastCtrl?.y ?? cur.y) }
              : { ...cur };
          const end = pt();
          flat2(cur, c1, end, points, tol);
          lastCtrl = c1;
          cur = end;
        }
        break;
      case "A":
        while (i < args.length) {
          const rx = num();
          const ry = num();
          const rot = num();
          const large = num();
          const sweep = num();
          const end = pt();
          arcToPoints(cur, rx, ry, rot, large, sweep, end, points);
          cur = end;
        }
        break;
      case "Z":
        if (points.length) {
          points.push({ ...start });
          flush(true);
        }
        cur = { ...start };
        break;
    }
    if (C !== "C" && C !== "S" && C !== "Q" && C !== "T") lastCtrl = null;
    lastCode = C;
  }
  flush(false);
  return subpaths;
}

// ---- measuring ----

export function polylineLength(points: Pt[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

export function cumulativeLengths(points: Pt[]): number[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return cum;
}

/** Point at arc-length `len` along a polyline (clamped to its ends). */
export function pointAtLength(points: Pt[], len: number): Pt {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || len <= 0) return { ...points[0] };
  const cum = cumulativeLengths(points);
  const total = cum[cum.length - 1];
  if (len >= total) return { ...points[points.length - 1] };
  let i = 1;
  while (i < cum.length && cum[i] < len) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = (len - cum[i - 1]) / segLen;
  const a = points[i - 1];
  const b = points[i];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Unit tangent at arc-length `len` (direction of travel). */
export function tangentAtLength(points: Pt[], len: number): Pt {
  if (points.length < 2) return { x: 1, y: 0 };
  const cum = cumulativeLengths(points);
  const total = cum[cum.length - 1];
  const clamped = Math.min(Math.max(len, 0), total);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < clamped) i++;
  const a = points[i - 1];
  const b = points[i];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const m = Math.hypot(dx, dy) || 1;
  return { x: dx / m, y: dy / m };
}

/** Prefix of a polyline up to arc-length `len` (for progressive stroking). */
export function polylinePrefix(points: Pt[], len: number): Pt[] {
  if (points.length === 0 || len <= 0) return [];
  const cum = cumulativeLengths(points);
  const total = cum[cum.length - 1];
  if (len >= total) return points.slice();
  const out: Pt[] = [points[0]];
  let i = 1;
  while (i < cum.length && cum[i] <= len) {
    out.push(points[i]);
    i++;
  }
  if (i < points.length) out.push(pointAtLength(points, len));
  return out;
}
