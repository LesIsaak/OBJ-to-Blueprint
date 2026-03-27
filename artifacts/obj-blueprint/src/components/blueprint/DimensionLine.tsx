import React, { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Dimension, ModelBounds, useBlueprintStore } from '@/store/use-blueprint-store';

interface DimensionLineProps {
  dimension: Dimension;
}

type Pt = [number, number, number];

/**
 * Build architectural dimension chain geometry.
 *
 * Extension line convention (avoids crossing through the model):
 *   - Horizontal dims  → ext lines drop from the model's bottom edge (min[1]) downward.
 *   - Vertical dims    → ext lines project from the model's side edge outward.
 *
 * This mirrors standard architectural drafting where extension lines originate
 * at the model boundary (not from inside the model body).
 */
function buildDimGeometry(
  dim: Dimension,
  bounds: ModelBounds,
): {
  ext1: [Pt, Pt];
  ext2: [Pt, Pt];
  mainLine: [Pt, Pt];
  tick1: [Pt, Pt];
  tick2: [Pt, Pt];
  labelPos: Pt;
  measuredDist: number;
} | null {
  const { p1, p2, axis, chainIndex = 0, chainOffset = 0, view } = dim;
  const { min, max } = bounds;

  const bSize = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const maxSize = Math.max(...bSize, 0.001);

  const GAP      = maxSize * 0.08;
  const SPACING  = maxSize * 0.10;
  const TICK     = maxSize * 0.025;
  const OVERSHOOT = maxSize * 0.012;
  // chainOffset lets the user manually shift this chain row further/closer
  const effectiveIndex = Math.max(0, chainIndex + chainOffset);
  const offset   = GAP + effectiveIndex * SPACING;

  const isLeftRight = view === 'left' || view === 'right';

  // ─── HORIZONTAL DIMENSIONS ───────────────────────────────────────────────────
  if (axis === 'horizontal') {
    const dimY = min[1] - offset;

    const h1 = isLeftRight ? p1[2] : p1[0];
    const h2 = isLeftRight ? p2[2] : p2[0];
    const hMin = Math.min(h1, h2);
    const hMax = Math.max(h1, h2);

    // Extension lines start at model bottom edge — they never cross into the model
    if (isLeftRight) {
      const startY = min[1];  // model bottom in Y
      const ext1: [Pt, Pt] = [[0, startY, hMin], [0, dimY - OVERSHOOT, hMin]];
      const ext2: [Pt, Pt] = [[0, startY, hMax], [0, dimY - OVERSHOOT, hMax]];
      const mainLine: [Pt, Pt] = [[0, dimY, hMin], [0, dimY, hMax]];
      const tick1: [Pt, Pt] = [[0, dimY - TICK, hMin - TICK], [0, dimY + TICK, hMin + TICK]];
      const tick2: [Pt, Pt] = [[0, dimY - TICK, hMax - TICK], [0, dimY + TICK, hMax + TICK]];
      const labelPos: Pt = [0, dimY - TICK * 2.5, (hMin + hMax) / 2];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(hMax - hMin) };
    } else {
      const startY = min[1];
      const ext1: [Pt, Pt] = [[hMin, startY, 0], [hMin, dimY - OVERSHOOT, 0]];
      const ext2: [Pt, Pt] = [[hMax, startY, 0], [hMax, dimY - OVERSHOOT, 0]];
      const mainLine: [Pt, Pt] = [[hMin, dimY, 0], [hMax, dimY, 0]];
      const tick1: [Pt, Pt] = [[hMin - TICK, dimY - TICK, 0], [hMin + TICK, dimY + TICK, 0]];
      const tick2: [Pt, Pt] = [[hMax - TICK, dimY - TICK, 0], [hMax + TICK, dimY + TICK, 0]];
      const labelPos: Pt = [(hMin + hMax) / 2, dimY - TICK * 2.5, 0];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(hMax - hMin) };
    }
  }

  // ─── VERTICAL DIMENSIONS ─────────────────────────────────────────────────────
  if (axis === 'vertical') {
    const vMin = Math.min(p1[1], p2[1]);
    const vMax = Math.max(p1[1], p2[1]);

    if (view === 'left') {
      // Screen-left in left view = +Z; ext lines start from model right edge (+Z max)
      const dimZ = max[2] + offset;
      const startZ = max[2];
      const ext1: [Pt, Pt] = [[0, p1[1], startZ], [0, p1[1], dimZ + OVERSHOOT]];
      const ext2: [Pt, Pt] = [[0, p2[1], startZ], [0, p2[1], dimZ + OVERSHOOT]];
      const mainLine: [Pt, Pt] = [[0, vMin, dimZ], [0, vMax, dimZ]];
      const tick1: [Pt, Pt] = [[0, vMin - TICK, dimZ - TICK], [0, vMin + TICK, dimZ + TICK]];
      const tick2: [Pt, Pt] = [[0, vMax - TICK, dimZ - TICK], [0, vMax + TICK, dimZ + TICK]];
      const labelPos: Pt = [0, (vMin + vMax) / 2, dimZ + TICK * 3];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(vMax - vMin) };
    }

    if (view === 'right') {
      // Screen-left in right view = −Z; ext lines start from model left edge (−Z min)
      const dimZ = min[2] - offset;
      const startZ = min[2];
      const ext1: [Pt, Pt] = [[0, p1[1], startZ], [0, p1[1], dimZ - OVERSHOOT]];
      const ext2: [Pt, Pt] = [[0, p2[1], startZ], [0, p2[1], dimZ - OVERSHOOT]];
      const mainLine: [Pt, Pt] = [[0, vMin, dimZ], [0, vMax, dimZ]];
      const tick1: [Pt, Pt] = [[0, vMin - TICK, dimZ + TICK], [0, vMin + TICK, dimZ - TICK]];
      const tick2: [Pt, Pt] = [[0, vMax - TICK, dimZ + TICK], [0, vMax + TICK, dimZ - TICK]];
      const labelPos: Pt = [0, (vMin + vMax) / 2, dimZ - TICK * 3];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(vMax - vMin) };
    }

    if (view === 'back') {
      // Screen-left in back view = +X; ext lines start from model right edge
      const dimX = max[0] + offset;
      const startX = max[0];
      const ext1: [Pt, Pt] = [[startX, p1[1], 0], [dimX + OVERSHOOT, p1[1], 0]];
      const ext2: [Pt, Pt] = [[startX, p2[1], 0], [dimX + OVERSHOOT, p2[1], 0]];
      const mainLine: [Pt, Pt] = [[dimX, vMin, 0], [dimX, vMax, 0]];
      const tick1: [Pt, Pt] = [[dimX - TICK, vMin - TICK, 0], [dimX + TICK, vMin + TICK, 0]];
      const tick2: [Pt, Pt] = [[dimX - TICK, vMax - TICK, 0], [dimX + TICK, vMax + TICK, 0]];
      const labelPos: Pt = [dimX + TICK * 3, (vMin + vMax) / 2, 0];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(vMax - vMin) };
    }

    // front (default): screen-left = −X; ext lines start from model left edge
    const dimX = min[0] - offset;
    const startX = min[0];
    const ext1: [Pt, Pt] = [[startX, p1[1], 0], [dimX - OVERSHOOT, p1[1], 0]];
    const ext2: [Pt, Pt] = [[startX, p2[1], 0], [dimX - OVERSHOOT, p2[1], 0]];
    const mainLine: [Pt, Pt] = [[dimX, vMin, 0], [dimX, vMax, 0]];
    const tick1: [Pt, Pt] = [[dimX - TICK, vMin - TICK, 0], [dimX + TICK, vMin + TICK, 0]];
    const tick2: [Pt, Pt] = [[dimX - TICK, vMax - TICK, 0], [dimX + TICK, vMax + TICK, 0]];
    const labelPos: Pt = [dimX - TICK * 3, (vMin + vMax) / 2, 0];
    return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(vMax - vMin) };
  }

  // ─── DIAGONAL (fallback) ─────────────────────────────────────────────────────
  const v1 = new THREE.Vector3(...p1);
  const v2 = new THREE.Vector3(...p2);
  const dir = new THREE.Vector3().subVectors(v2, v1).normalize();
  const perp = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar(TICK);
  const mid: Pt = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
  const t1s = new THREE.Vector3(...p1).add(perp);
  const t1e = new THREE.Vector3(...p1).sub(perp);
  const t2s = new THREE.Vector3(...p2).add(perp);
  const t2e = new THREE.Vector3(...p2).sub(perp);
  return {
    ext1: [p1, p1],
    ext2: [p2, p2],
    mainLine: [p1, p2],
    tick1: [t1s.toArray() as Pt, t1e.toArray() as Pt],
    tick2: [t2s.toArray() as Pt, t2e.toArray() as Pt],
    labelPos: mid,
    measuredDist: v1.distanceTo(v2),
  };
}

export const DimensionLine: React.FC<DimensionLineProps> = ({ dimension }) => {
  const { id, p1, p2, customText } = dimension;
  const { selectedDimensionId, setSelectedDimension, scale, unit, modelBounds } = useBlueprintStore();

  const isSelected = selectedDimensionId === id;
  const color = isSelected ? '#58a6ff' : '#d2a8ff';

  const geo = useMemo(() => {
    if (!modelBounds) return null;
    return buildDimGeometry(dimension, modelBounds);
  }, [dimension, modelBounds]);

  const handleSelect = (e: any) => { e.stopPropagation(); setSelectedDimension(id); };

  // Fallback if no bounds yet: plain line
  if (!geo) {
    const mid: Pt = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
    const dist = (new THREE.Vector3(...p1).distanceTo(new THREE.Vector3(...p2)) * scale).toFixed(2);
    return (
      <group onClick={handleSelect}>
        <Line points={[p1, p2]} color={color} lineWidth={2} depthTest={false} renderOrder={10} />
        <Html position={mid} center zIndexRange={[100, 0]}>
          <div className="px-2 py-1 rounded text-xs font-mono font-bold bg-card text-accent border border-border cursor-pointer"
            onClick={handleSelect}>
            {customText || `${dist} ${unit}`}
          </div>
        </Html>
      </group>
    );
  }

  const { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist } = geo;
  const displayText = customText || `${(measuredDist * scale).toFixed(2)} ${unit}`;

  // Dashed size proportional to model
  const bounds = modelBounds!;
  const maxSize = Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
    0.001,
  );
  const dashSize = maxSize * 0.025;
  const gapSize  = maxSize * 0.015;

  const lw = isSelected ? 2.5 : 1.5;

  return (
    <group onClick={handleSelect}>
      {/* Extension lines — dashed, start at model boundary, never cross through model */}
      <Line
        points={ext1}
        color={color}
        lineWidth={lw}
        depthTest={false}
        renderOrder={10}
        dashed
        dashSize={dashSize}
        gapSize={gapSize}
      />
      <Line
        points={ext2}
        color={color}
        lineWidth={lw}
        depthTest={false}
        renderOrder={10}
        dashed
        dashSize={dashSize}
        gapSize={gapSize}
      />

      {/* Main dimension line — solid */}
      <Line points={mainLine} color={color} lineWidth={isSelected ? 2.5 : 2} depthTest={false} renderOrder={10} />

      {/* Architectural slash ticks */}
      <Line points={tick1} color={color} lineWidth={2} depthTest={false} renderOrder={10} />
      <Line points={tick2} color={color} lineWidth={2} depthTest={false} renderOrder={10} />

      {/* Invisible fat hit area for easier clicking */}
      <Line points={mainLine} color="#000000" transparent opacity={0} lineWidth={14} depthTest={false} renderOrder={9} />

      <Html position={labelPos} center zIndexRange={[100, 0]}>
        <div
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer whitespace-nowrap select-none
            ${isSelected
              ? 'bg-primary text-primary-foreground border border-primary'
              : 'bg-[#0d1117]/90 text-[#d2a8ff] border border-[#d2a8ff]/60'
            }`}
          onClick={handleSelect}
        >
          {displayText}
        </div>
      </Html>
    </group>
  );
};
