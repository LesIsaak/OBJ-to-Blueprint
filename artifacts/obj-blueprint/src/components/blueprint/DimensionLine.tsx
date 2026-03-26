import React, { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Dimension, ModelBounds, useBlueprintStore } from '@/store/use-blueprint-store';

interface DimensionLineProps {
  dimension: Dimension;
}

type Pt = [number, number, number];

/**
 * Compute all geometry for an architectural dimension chain line.
 *
 * Rules (mirroring standard architectural drawing conventions):
 *  - Horizontal dims  →  extension lines drop in −Y; dimension line is placed
 *    below the model, stacked further out per chainIndex.
 *  - Vertical dims    →  extension lines go toward −X (front/back) or +/−Z
 *    (left/right); dimension line is placed to the left of the model.
 *  - Diagonal dims    →  simple line between p1 and p2 (fallback).
 *
 * All positions are in the view's natural plane (z=0 for front/back, x=0 for left/right).
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
  const { p1, p2, axis, chainIndex = 0, view } = dim;
  const { min, max } = bounds;

  const bSize = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const maxSize = Math.max(...bSize, 0.001);

  // Scale spacing with model size
  const GAP     = maxSize * 0.08;   // gap between model edge and first chain
  const SPACING = maxSize * 0.10;   // gap between consecutive chains
  const TICK    = maxSize * 0.025;  // half-length of tick slash
  const OVERSHOOT = maxSize * 0.015; // ext-line extends past dim line by this amount
  const offset  = GAP + chainIndex * SPACING;

  const isLeftRight = view === 'left' || view === 'right';

  // ─── HORIZONTAL DIMENSIONS ──────────────────────────────────────────────────
  if (axis === 'horizontal') {
    // Dimension line sits below the model (always −Y regardless of view)
    const dimY = min[1] - offset;

    // Horizontal coord of each point (Z for left/right, X for front/back)
    const h1 = isLeftRight ? p1[2] : p1[0];
    const h2 = isLeftRight ? p2[2] : p2[0];
    const hMin = Math.min(h1, h2);
    const hMax = Math.max(h1, h2);

    // Y of the measured points (where extension lines start)
    const y1 = p1[1];
    const y2 = p2[1];

    if (isLeftRight) {
      const ext1: [Pt, Pt] = [[0, y1, hMin], [0, dimY - OVERSHOOT, hMin]];
      const ext2: [Pt, Pt] = [[0, y2, hMax], [0, dimY - OVERSHOOT, hMax]];
      const mainLine: [Pt, Pt] = [[0, dimY, hMin], [0, dimY, hMax]];
      // Architectural slash: 45° line at each end
      const tick1: [Pt, Pt] = [[0, dimY - TICK, hMin - TICK], [0, dimY + TICK, hMin + TICK]];
      const tick2: [Pt, Pt] = [[0, dimY - TICK, hMax - TICK], [0, dimY + TICK, hMax + TICK]];
      const labelPos: Pt = [0, dimY - TICK * 2.5, (hMin + hMax) / 2];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(hMax - hMin) };
    } else {
      const ext1: [Pt, Pt] = [[hMin, y1, 0], [hMin, dimY - OVERSHOOT, 0]];
      const ext2: [Pt, Pt] = [[hMax, y2, 0], [hMax, dimY - OVERSHOOT, 0]];
      const mainLine: [Pt, Pt] = [[hMin, dimY, 0], [hMax, dimY, 0]];
      const tick1: [Pt, Pt] = [[hMin - TICK, dimY - TICK, 0], [hMin + TICK, dimY + TICK, 0]];
      const tick2: [Pt, Pt] = [[hMax - TICK, dimY - TICK, 0], [hMax + TICK, dimY + TICK, 0]];
      const labelPos: Pt = [(hMin + hMax) / 2, dimY - TICK * 2.5, 0];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(hMax - hMin) };
    }
  }

  // ─── VERTICAL DIMENSIONS ───────────────────────────────────────────────────
  if (axis === 'vertical') {
    const vMin = Math.min(p1[1], p2[1]);
    const vMax = Math.max(p1[1], p2[1]);

    if (view === 'left') {
      // Screen-left in left view = +Z in world
      const dimZ = max[2] + offset;
      const ext1: [Pt, Pt] = [[0, p1[1], p1[2]], [0, p1[1], dimZ + OVERSHOOT]];
      const ext2: [Pt, Pt] = [[0, p2[1], p2[2]], [0, p2[1], dimZ + OVERSHOOT]];
      const mainLine: [Pt, Pt] = [[0, vMin, dimZ], [0, vMax, dimZ]];
      const tick1: [Pt, Pt] = [[0, vMin - TICK, dimZ - TICK], [0, vMin + TICK, dimZ + TICK]];
      const tick2: [Pt, Pt] = [[0, vMax - TICK, dimZ - TICK], [0, vMax + TICK, dimZ + TICK]];
      const labelPos: Pt = [0, (vMin + vMax) / 2, dimZ + TICK * 3];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(vMax - vMin) };
    }

    if (view === 'right') {
      // Screen-left in right view = −Z in world
      const dimZ = min[2] - offset;
      const ext1: [Pt, Pt] = [[0, p1[1], p1[2]], [0, p1[1], dimZ - OVERSHOOT]];
      const ext2: [Pt, Pt] = [[0, p2[1], p2[2]], [0, p2[1], dimZ - OVERSHOOT]];
      const mainLine: [Pt, Pt] = [[0, vMin, dimZ], [0, vMax, dimZ]];
      const tick1: [Pt, Pt] = [[0, vMin - TICK, dimZ + TICK], [0, vMin + TICK, dimZ - TICK]];
      const tick2: [Pt, Pt] = [[0, vMax - TICK, dimZ + TICK], [0, vMax + TICK, dimZ - TICK]];
      const labelPos: Pt = [0, (vMin + vMax) / 2, dimZ - TICK * 3];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(vMax - vMin) };
    }

    if (view === 'back') {
      // Screen-left in back view = +X in world
      const dimX = max[0] + offset;
      const ext1: [Pt, Pt] = [[p1[0], p1[1], 0], [dimX + OVERSHOOT, p1[1], 0]];
      const ext2: [Pt, Pt] = [[p2[0], p2[1], 0], [dimX + OVERSHOOT, p2[1], 0]];
      const mainLine: [Pt, Pt] = [[dimX, vMin, 0], [dimX, vMax, 0]];
      const tick1: [Pt, Pt] = [[dimX - TICK, vMin - TICK, 0], [dimX + TICK, vMin + TICK, 0]];
      const tick2: [Pt, Pt] = [[dimX - TICK, vMax - TICK, 0], [dimX + TICK, vMax + TICK, 0]];
      const labelPos: Pt = [dimX + TICK * 3, (vMin + vMax) / 2, 0];
      return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(vMax - vMin) };
    }

    // front (default): screen-left = −X in world
    const dimX = min[0] - offset;
    const ext1: [Pt, Pt] = [[p1[0], p1[1], 0], [dimX - OVERSHOOT, p1[1], 0]];
    const ext2: [Pt, Pt] = [[p2[0], p2[1], 0], [dimX - OVERSHOOT, p2[1], 0]];
    const mainLine: [Pt, Pt] = [[dimX, vMin, 0], [dimX, vMax, 0]];
    const tick1: [Pt, Pt] = [[dimX - TICK, vMin - TICK, 0], [dimX + TICK, vMin + TICK, 0]];
    const tick2: [Pt, Pt] = [[dimX - TICK, vMax - TICK, 0], [dimX + TICK, vMax + TICK, 0]];
    const labelPos: Pt = [dimX - TICK * 3, (vMin + vMax) / 2, 0];
    return { ext1, ext2, mainLine, tick1, tick2, labelPos, measuredDist: Math.abs(vMax - vMin) };
  }

  // ─── DIAGONAL (fallback) ────────────────────────────────────────────────────
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

  const lw = isSelected ? 2.5 : 1.5;

  return (
    <group onClick={handleSelect}>
      {/* Extension lines */}
      <Line points={ext1} color={color} lineWidth={lw} depthTest={false} renderOrder={10} />
      <Line points={ext2} color={color} lineWidth={lw} depthTest={false} renderOrder={10} />

      {/* Main dimension line */}
      <Line points={mainLine} color={color} lineWidth={isSelected ? 2.5 : 2} depthTest={false} renderOrder={10} />

      {/* Architectural slash ticks */}
      <Line points={tick1} color={color} lineWidth={2} depthTest={false} renderOrder={10} />
      <Line points={tick2} color={color} lineWidth={2} depthTest={false} renderOrder={10} />

      {/* Invisible fat hit area */}
      <Line points={mainLine} color="#000000" transparent opacity={0} lineWidth={14} depthTest={false} renderOrder={9} />

      <Html position={labelPos} center zIndexRange={[100, 0]}>
        <div
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer whitespace-nowrap
            ${isSelected
              ? 'bg-primary text-primary-foreground border border-primary'
              : 'bg-[#0d1117]/80 text-[#d2a8ff] border border-[#d2a8ff]/50'
            }`}
          onClick={handleSelect}
        >
          {displayText}
        </div>
      </Html>
    </group>
  );
};
