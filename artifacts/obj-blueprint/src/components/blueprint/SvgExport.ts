import * as THREE from 'three';
import { exportCameraRef } from './exportCamera';
import type { Dimension, ModelBounds, Unit } from '@/store/use-blueprint-store';

type Pt3 = [number, number, number];
type Seg3 = [Pt3, Pt3];

const UNIT_TO_MM: Record<Unit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };

// ── Helpers ────────────────────────────────────────────────────────────────────

function project(pt: Pt3, cam: THREE.Camera, w: number, h: number): [number, number] {
  const v = new THREE.Vector3(...pt).project(cam);
  return [((v.x + 1) / 2) * w, ((-v.y + 1) / 2) * h];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function snapToStandard(n: number): number {
  const standards = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
  return standards.reduce((b, s) => Math.abs(s - n) < Math.abs(b - n) ? s : b);
}

function computePrintScale(
  cam: THREE.Camera, bounds: ModelBounds,
  scale: number, unit: Unit,
  w: number, h: number,
): string {
  const { min, max } = bounds;
  const [ax, ay] = project(min, cam, w, h);
  const [bx, by] = project(max, cam, w, h);
  const paperPx = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
  if (paperPx < 1) return '—';
  const worldDist = Math.sqrt((max[0]-min[0])**2 + (max[1]-min[1])**2 + (max[2]-min[2])**2);
  const realMm = worldDist * scale * UNIT_TO_MM[unit];
  // 1 px on canvas ≈ how many mm? (96 dpi → 1px = 0.2646 mm)
  const mmPerPx = 25.4 / 96;
  const paperMm = paperPx * mmPerPx;
  const ratio = realMm / paperMm;
  if (ratio >= 1) return `1:${snapToStandard(ratio)}`;
  return `${Math.round((1 / ratio) * 10) / 10}:1`;
}

// ── Geometry ───────────────────────────────────────────────────────────────────

interface DimGeo {
  ext1: Seg3; ext2: Seg3;
  mainLine: Seg3;
  tick1: Seg3; tick2: Seg3;
  labelPos: Pt3;
  measuredDist: number;
}

function buildGeo(dim: Dimension, bounds: ModelBounds): DimGeo | null {
  const { p1, p2, axis, chainIndex = 0, chainOffset = 0, view } = dim;
  const { min, max } = bounds;
  const bSize = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];
  const ms = Math.max(...bSize, 0.001);
  const GAP = ms * 0.08, SPACING = ms * 0.10, TICK = ms * 0.015, OVS = ms * 0.012;
  const ei = Math.max(0, chainIndex + chainOffset);
  const offset = GAP + ei * SPACING;
  const lr = view === 'left' || view === 'right';

  if (axis === 'horizontal') {
    const dimY = min[1] - offset;
    const startY = min[1];
    const h1 = lr ? p1[2] : p1[0];
    const h2 = lr ? p2[2] : p2[0];
    const hMin = Math.min(h1, h2), hMax = Math.max(h1, h2);
    const labelPos: Pt3 = lr
      ? [0, dimY - TICK, (hMin + hMax) / 2]
      : [(hMin + hMax) / 2, dimY - TICK, 0];
    if (lr) {
      return {
        ext1: [[0, startY, hMin], [0, dimY - OVS, hMin]],
        ext2: [[0, startY, hMax], [0, dimY - OVS, hMax]],
        mainLine: [[0, dimY, hMin], [0, dimY, hMax]],
        tick1: [[0, dimY - TICK, hMin - TICK], [0, dimY + TICK, hMin + TICK]],
        tick2: [[0, dimY - TICK, hMax - TICK], [0, dimY + TICK, hMax + TICK]],
        labelPos, measuredDist: Math.abs(hMax - hMin),
      };
    }
    return {
      ext1: [[hMin, startY, 0], [hMin, dimY - OVS, 0]],
      ext2: [[hMax, startY, 0], [hMax, dimY - OVS, 0]],
      mainLine: [[hMin, dimY, 0], [hMax, dimY, 0]],
      tick1: [[hMin - TICK, dimY - TICK, 0], [hMin + TICK, dimY + TICK, 0]],
      tick2: [[hMax - TICK, dimY - TICK, 0], [hMax + TICK, dimY + TICK, 0]],
      labelPos, measuredDist: Math.abs(hMax - hMin),
    };
  }

  if (axis === 'vertical') {
    const vMin = Math.min(p1[1], p2[1]), vMax = Math.max(p1[1], p2[1]);
    const midV = (vMin + vMax) / 2;
    if (view === 'left') {
      const dimZ = max[2] + offset;
      return {
        ext1: [[0, p1[1], max[2]], [0, p1[1], dimZ + OVS]],
        ext2: [[0, p2[1], max[2]], [0, p2[1], dimZ + OVS]],
        mainLine: [[0, vMin, dimZ], [0, vMax, dimZ]],
        tick1: [[0, vMin - TICK, dimZ - TICK], [0, vMin + TICK, dimZ + TICK]],
        tick2: [[0, vMax - TICK, dimZ - TICK], [0, vMax + TICK, dimZ + TICK]],
        labelPos: [0, midV, dimZ + TICK * 1.2], measuredDist: Math.abs(vMax - vMin),
      };
    }
    if (view === 'right') {
      const dimZ = min[2] - offset;
      return {
        ext1: [[0, p1[1], min[2]], [0, p1[1], dimZ - OVS]],
        ext2: [[0, p2[1], min[2]], [0, p2[1], dimZ - OVS]],
        mainLine: [[0, vMin, dimZ], [0, vMax, dimZ]],
        tick1: [[0, vMin - TICK, dimZ + TICK], [0, vMin + TICK, dimZ - TICK]],
        tick2: [[0, vMax - TICK, dimZ + TICK], [0, vMax + TICK, dimZ - TICK]],
        labelPos: [0, midV, dimZ - TICK * 1.2], measuredDist: Math.abs(vMax - vMin),
      };
    }
    if (view === 'back') {
      const dimX = max[0] + offset;
      return {
        ext1: [[max[0], p1[1], 0], [dimX + OVS, p1[1], 0]],
        ext2: [[max[0], p2[1], 0], [dimX + OVS, p2[1], 0]],
        mainLine: [[dimX, vMin, 0], [dimX, vMax, 0]],
        tick1: [[dimX - TICK, vMin - TICK, 0], [dimX + TICK, vMin + TICK, 0]],
        tick2: [[dimX - TICK, vMax - TICK, 0], [dimX + TICK, vMax + TICK, 0]],
        labelPos: [dimX + TICK * 1.2, midV, 0], measuredDist: Math.abs(vMax - vMin),
      };
    }
    // front
    const dimX = min[0] - offset;
    return {
      ext1: [[min[0], p1[1], 0], [dimX - OVS, p1[1], 0]],
      ext2: [[min[0], p2[1], 0], [dimX - OVS, p2[1], 0]],
      mainLine: [[dimX, vMin, 0], [dimX, vMax, 0]],
      tick1: [[dimX - TICK, vMin - TICK, 0], [dimX + TICK, vMin + TICK, 0]],
      tick2: [[dimX - TICK, vMax - TICK, 0], [dimX + TICK, vMax + TICK, 0]],
      labelPos: [dimX - TICK * 1.2, midV, 0], measuredDist: Math.abs(vMax - vMin),
    };
  }

  // diagonal
  return null;
}

// ── SVG line helper ────────────────────────────────────────────────────────────

function svgLine(a: [number, number], b: [number, number], cls: string): string {
  return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="${cls}"/>`;
}

// ── Export ─────────────────────────────────────────────────────────────────────

export function exportToSvg(
  canvas: HTMLCanvasElement | null,
  projectName: string,
  dimensions: Dimension[],
  scale: number,
  unit: Unit,
  modelBounds: ModelBounds | null,
): boolean {
  if (!canvas) return false;

  try {
    const imgData = canvas.toDataURL('image/png', 1.0);
    const W = canvas.width;
    const H = canvas.height;
    const TITLE_H = 72;
    const TOTAL_H = H + TITLE_H;

    const cam = exportCameraRef.current;
    const cw = exportCameraRef.size.w || W;
    const ch = exportCameraRef.size.h || H;

    // Scale canvas pixels to SVG viewBox
    const scaleX = W / cw;
    const scaleY = H / ch;

    const dimLines: string[] = [];

    if (cam && modelBounds) {
      for (const dim of dimensions) {
        const geo = buildGeo(dim, modelBounds);
        if (!geo) continue;

        const segs: Seg3[] = [geo.mainLine, geo.ext1, geo.ext2];
        const ticks: Seg3[] = [geo.tick1, geo.tick2];

        for (const [a, b] of segs) {
          const [ax, ay] = project(a, cam, cw, ch);
          const [bx, by] = project(b, cam, cw, ch);
          dimLines.push(svgLine(
            [ax * scaleX, ay * scaleY],
            [bx * scaleX, by * scaleY],
            'dim-line',
          ));
        }
        for (const [a, b] of ticks) {
          const [ax, ay] = project(a, cam, cw, ch);
          const [bx, by] = project(b, cam, cw, ch);
          dimLines.push(svgLine(
            [ax * scaleX, ay * scaleY],
            [bx * scaleX, by * scaleY],
            'dim-tick',
          ));
        }

        // Label
        const [lx, ly] = project(geo.labelPos, cam, cw, ch);
        const svgLx = lx * scaleX, svgLy = ly * scaleY;
        if (svgLx > 2 && svgLx < W - 2 && svgLy > 2 && svgLy < H - 2) {
          const labelText = dim.customText
            || `${(geo.measuredDist * scale).toFixed(2)} ${unit}`;
          const tw = labelText.length * 5.2; // approx char width at font-size 9
          dimLines.push(`<rect x="${(svgLx - tw / 2 - 3).toFixed(1)}" y="${(svgLy - 7).toFixed(1)}" width="${(tw + 6).toFixed(1)}" height="12" rx="2" class="label-bg"/>`);
          dimLines.push(`<text x="${svgLx.toFixed(1)}" y="${(svgLy + 4).toFixed(1)}" class="label-text">${esc(labelText)}</text>`);
        }
      }
    }

    const printScale = (cam && modelBounds)
      ? computePrintScale(cam, modelBounds, scale, unit, cw, ch)
      : `${scale}:1`;

    const dateStr = new Date().toLocaleDateString();
    const titleLine1 = esc(projectName || 'Untitled Blueprint');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${TOTAL_H}" width="${W}" height="${TOTAL_H}">
  <defs>
    <style>
      .dim-line { stroke: #58a6ff; stroke-width: 1.2; fill: none; stroke-dasharray: none; }
      .dim-ext  { stroke: #58a6ff; stroke-width: 0.8; fill: none; stroke-dasharray: 3 2; }
      .dim-tick { stroke: #58a6ff; stroke-width: 1.6; fill: none; }
      .label-bg { fill: #0d1117; opacity: 0.85; }
      .label-text { fill: #d2a8ff; font-family: monospace; font-size: 9px; text-anchor: middle; font-weight: bold; }
      .tb-label { fill: #58a6ff; font-family: sans-serif; font-size: 7px; }
      .tb-value { fill: #ffffff; font-family: sans-serif; font-size: 11px; font-weight: bold; }
      .tb-sub   { fill: #96aac8; font-family: sans-serif; font-size: 8px; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${TOTAL_H}" fill="#0d1117"/>

  <!-- Model screenshot -->
  <image x="0" y="0" width="${W}" height="${H}" href="${imgData}" preserveAspectRatio="xMidYMid meet"/>

  <!-- Dimension annotations -->
  <g id="dimensions">
    ${dimLines.join('\n    ')}
  </g>

  <!-- Title block -->
  <rect x="0" y="${H}" width="${W}" height="${TITLE_H}" fill="#161b22" stroke="#58a6ff" stroke-width="1"/>
  <line x1="${W * 0.45}" y1="${H}" x2="${W * 0.45}" y2="${H + TITLE_H}" stroke="#58a6ff" stroke-width="0.5"/>
  <line x1="${W * 0.70}" y1="${H}" x2="${W * 0.70}" y2="${H + TITLE_H}" stroke="#58a6ff" stroke-width="0.5"/>

  <!-- Column 1: project -->
  <text x="12" y="${H + 16}" class="tb-label">PROJECT</text>
  <text x="12" y="${H + 34}" class="tb-value">${titleLine1}</text>
  <text x="12" y="${H + 50}" class="tb-sub">OBJ BLUEPRINT MAKER</text>
  <text x="12" y="${H + 64}" class="tb-sub">OBJ.PRINT</text>

  <!-- Column 2: measurements -->
  <text x="${W * 0.45 + 12}" y="${H + 16}" class="tb-label">MEASUREMENTS</text>
  <text x="${W * 0.45 + 12}" y="${H + 34}" class="tb-value">${dimensions.length} dimension${dimensions.length !== 1 ? 's' : ''}</text>
  <text x="${W * 0.45 + 12}" y="${H + 50}" class="tb-sub">Unit: ${esc(unit)}</text>
  <text x="${W * 0.45 + 12}" y="${H + 64}" class="tb-sub">Print scale: ${esc(printScale)}</text>

  <!-- Column 3: date -->
  <text x="${W * 0.70 + 12}" y="${H + 16}" class="tb-label">DATE</text>
  <text x="${W * 0.70 + 12}" y="${H + 34}" class="tb-value">${esc(dateStr)}</text>
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(projectName || 'Blueprint').replace(/\s+/g, '_')}_Blueprint.svg`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('SVG export failed', err);
    return false;
  }
}
