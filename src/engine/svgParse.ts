// Parse an SVG document into an ordered list of flattened, transform-resolved
// strokes in the SVG's natural pixel space, with paint info and cumulative
// arc-lengths. Pure + DOM-free so it runs in tests and during export.
//
// Supports: path, line, rect, circle, ellipse, polyline, polygon; nested <g>
// groups; transform attributes (translate/scale/rotate/matrix/skewX/skewY);
// fill/stroke/stroke-width via presentation attrs or inline style; viewBox
// normalization. Unsupported/advanced features (gradients, clip paths, text)
// are skipped gracefully.

import { flattenPath, polylineLength, type Pt } from "./geometry";
import { parseSvgSize, parseViewBox } from "./svg";

export interface FlatStroke {
  points: Pt[];
  closed: boolean;
  length: number;
  cumStart: number; // cumulative length of all earlier strokes
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
}

export interface FlatSvg {
  width: number;
  height: number;
  strokes: FlatStroke[];
  totalLength: number;
}

const DEFAULT_INK = "#1b1b1b";

// ---- minimal XML parser ----

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

function parseXml(src: string): XmlNode {
  const clean = src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  const root: XmlNode = { tag: "#root", attrs: {}, children: [] };
  const stack: XmlNode[] = [root];
  const tagRe = /<(\/?)([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(clean)) !== null) {
    const [, closing, tag, rawAttrs, selfClose] = m;
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const node: XmlNode = { tag, attrs: parseAttrs(rawAttrs), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out[m[1]] = m[2] ?? m[3] ?? "";
  }
  return out;
}

// ---- 2x3 affine matrix [a,b,c,d,e,f] : (x,y) -> (a x + c y + e, b x + d y + f) ----

export type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m: Mat, p: Pt): Pt {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

const NUM_RE = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;
function nums(s: string): number[] {
  return (s.match(NUM_RE) ?? []).map(Number);
}

export function parseTransform(str: string | undefined): Mat {
  if (!str) return IDENTITY;
  let m: Mat = IDENTITY;
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let f: RegExpExecArray | null;
  while ((f = re.exec(str)) !== null) {
    const a = nums(f[2]);
    switch (f[1]) {
      case "translate":
        m = mul(m, [1, 0, 0, 1, a[0] || 0, a[1] || 0]);
        break;
      case "scale":
        m = mul(m, [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]);
        break;
      case "rotate": {
        const r = ((a[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        const rot: Mat = [cos, sin, -sin, cos, 0, 0];
        if (a.length >= 3) {
          m = mul(m, [1, 0, 0, 1, a[1], a[2]]);
          m = mul(m, rot);
          m = mul(m, [1, 0, 0, 1, -a[1], -a[2]]);
        } else {
          m = mul(m, rot);
        }
        break;
      }
      case "matrix":
        if (a.length === 6) m = mul(m, a as Mat);
        break;
      case "skewX":
        m = mul(m, [1, 0, Math.tan(((a[0] || 0) * Math.PI) / 180), 1, 0, 0]);
        break;
      case "skewY":
        m = mul(m, [1, Math.tan(((a[0] || 0) * Math.PI) / 180), 0, 1, 0, 0]);
        break;
    }
  }
  return m;
}

// ---- style inheritance ----

interface Style {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
}

function parseInlineStyle(s: string | undefined): Partial<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!s) return out;
  for (const decl of s.split(";")) {
    const idx = decl.indexOf(":");
    if (idx > 0) out[decl.slice(0, idx).trim()] = decl.slice(idx + 1).trim();
  }
  return out;
}

function resolveColor(v: string | undefined): string | null | undefined {
  if (v == null) return undefined;
  const t = v.trim().toLowerCase();
  if (t === "none" || t === "transparent") return null;
  if (t === "currentcolor") return DEFAULT_INK;
  return v.trim();
}

function inheritStyle(parent: Style, node: XmlNode): Style {
  const style = parseInlineStyle(node.attrs.style);
  const fillAttr = resolveColor(style.fill ?? node.attrs.fill);
  const strokeAttr = resolveColor(style.stroke ?? node.attrs.stroke);
  const swRaw = style["stroke-width"] ?? node.attrs["stroke-width"];
  return {
    fill: fillAttr === undefined ? parent.fill : fillAttr,
    stroke: strokeAttr === undefined ? parent.stroke : strokeAttr,
    strokeWidth: swRaw != null ? parseFloat(swRaw) || parent.strokeWidth : parent.strokeWidth,
  };
}

// ---- shape -> subpaths (user space) ----

const SKIP = new Set(["defs", "clippath", "mask", "symbol", "style", "title", "desc", "metadata"]);

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, n = 64): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function shapeSubpaths(node: XmlNode): { points: Pt[]; closed: boolean }[] {
  const a = node.attrs;
  const n = (k: string) => parseFloat(a[k] ?? "") || 0;
  switch (node.tag.toLowerCase()) {
    case "path":
      return flattenPath(a.d ?? "").map((p) => ({ points: p.points, closed: p.closed }));
    case "line":
      return [{ points: [{ x: n("x1"), y: n("y1") }, { x: n("x2"), y: n("y2") }], closed: false }];
    case "rect": {
      const x = n("x");
      const y = n("y");
      const w = n("width");
      const h = n("height");
      return [
        {
          points: [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
            { x, y },
          ],
          closed: true,
        },
      ];
    }
    case "circle":
      return [{ points: ellipsePoints(n("cx"), n("cy"), n("r"), n("r")), closed: true }];
    case "ellipse":
      return [{ points: ellipsePoints(n("cx"), n("cy"), n("rx"), n("ry")), closed: true }];
    case "polyline":
    case "polygon": {
      const coords = nums(a.points ?? "");
      const pts: Pt[] = [];
      for (let i = 0; i + 1 < coords.length; i += 2) pts.push({ x: coords[i], y: coords[i + 1] });
      const closed = node.tag.toLowerCase() === "polygon";
      if (closed && pts.length) pts.push({ ...pts[0] });
      return pts.length >= 2 ? [{ points: pts, closed }] : [];
    }
    default:
      return [];
  }
}

// ---- walk ----

function walk(node: XmlNode, parentMat: Mat, parentStyle: Style, out: FlatStroke[]): void {
  for (const child of node.children) {
    const tag = child.tag.toLowerCase();
    if (SKIP.has(tag)) continue;
    const mat = mul(parentMat, parseTransform(child.attrs.transform));
    const style = inheritStyle(parentStyle, child);

    if (tag === "g" || tag === "svg" || tag === "a") {
      walk(child, mat, style, out);
      continue;
    }

    for (const sp of shapeSubpaths(child)) {
      if (sp.points.length < 2) continue;
      const pts = sp.points.map((p) => apply(mat, p));
      const length = polylineLength(pts);
      if (length <= 0) continue;
      // Ensure something is visible: if neither fill nor stroke, ink the outline.
      let stroke = style.stroke;
      const fill = style.fill;
      if (!stroke && !fill) stroke = DEFAULT_INK;
      out.push({
        points: pts,
        closed: sp.closed,
        length,
        cumStart: 0, // filled in after sorting
        fill,
        stroke,
        strokeWidth: style.strokeWidth,
      });
    }
  }
}

/** Parse an SVG string into a flattened, measured FlatSvg. */
export function parseSvg(svg: string): FlatSvg {
  const size = parseSvgSize(svg);
  const vb = parseViewBox(svg);
  let root: Mat = IDENTITY;
  if (vb && vb[2] > 0 && vb[3] > 0) {
    root = mul([size.width / vb[2], 0, 0, size.height / vb[3], 0, 0], [1, 0, 0, 1, -vb[0], -vb[1]]);
  }
  const tree = parseXml(svg);
  const baseStyle: Style = { fill: DEFAULT_INK, stroke: null, strokeWidth: 1 };
  const strokes: FlatStroke[] = [];
  walk(tree, root, baseStyle, strokes);

  let cum = 0;
  for (const s of strokes) {
    s.cumStart = cum;
    cum += s.length;
  }
  return { width: size.width, height: size.height, strokes, totalLength: cum };
}
