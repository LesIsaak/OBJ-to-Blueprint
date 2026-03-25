import React, { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Dimension, useBlueprintStore } from '@/store/use-blueprint-store';

interface DimensionLineProps {
  dimension: Dimension;
}

export const DimensionLine: React.FC<DimensionLineProps> = ({ dimension }) => {
  const { id, p1, p2, customText } = dimension;
  const { selectedDimensionId, setSelectedDimension, scale, unit } = useBlueprintStore();
  
  const isSelected = selectedDimensionId === id;
  const color = isSelected ? '#58a6ff' : '#d2a8ff'; // Blue if selected, purple/orange otherwise

  // Calculate mid point for text
  const midPoint = useMemo(() => {
    return [
      (p1[0] + p2[0]) / 2,
      (p1[1] + p2[1]) / 2,
      (p1[2] + p2[2]) / 2
    ] as [number, number, number];
  }, [p1, p2]);

  // Calculate real distance
  const distance = useMemo(() => {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    return (v1.distanceTo(v2) * scale).toFixed(2);
  }, [p1, p2, scale]);

  // Direction vector for tick marks
  const { dir, perp } = useMemo(() => {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    const direction = new THREE.Vector3().subVectors(v2, v1).normalize();
    // Perpendicular vector for tick marks (assuming 2D drawing on XY mostly, but generalize)
    // For architectural style, usually ticks are 45 degrees or perpendicular
    const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize().multiplyScalar(2);
    return { dir: direction, perp: perpendicular };
  }, [p1, p2]);

  const t1_start = new THREE.Vector3(...p1).add(perp);
  const t1_end = new THREE.Vector3(...p1).sub(perp);
  
  const t2_start = new THREE.Vector3(...p2).add(perp);
  const t2_end = new THREE.Vector3(...p2).sub(perp);

  const handleSelect = (e: any) => {
    e.stopPropagation();
    setSelectedDimension(id);
  };

  return (
    <group onClick={handleSelect}>
      {/* Main Line */}
      <Line points={[p1, p2]} color={color} lineWidth={isSelected ? 3 : 2} depthTest={false} renderOrder={10} />
      
      {/* Tick Marks (Architectural slashes) */}
      <Line points={[t1_start.toArray(), t1_end.toArray()]} color={color} lineWidth={2} depthTest={false} renderOrder={10} />
      <Line points={[t2_start.toArray(), t2_end.toArray()]} color={color} lineWidth={2} depthTest={false} renderOrder={10} />

      {/* Invisible thicker line for easier clicking */}
      <Line points={[p1, p2]} color="#000000" transparent opacity={0} lineWidth={15} depthTest={false} renderOrder={9} />

      <Html position={midPoint} center zIndexRange={[100, 0]}>
        <div 
          className={`
            px-2 py-1 rounded shadow-sm text-xs font-mono font-bold cursor-pointer whitespace-nowrap transition-all
            ${isSelected ? 'bg-primary text-primary-foreground border-2 border-primary ring-2 ring-primary/50' : 'bg-card text-accent border border-border'}
          `}
          onClick={handleSelect}
        >
          {customText || `${distance} ${unit}`}
        </div>
      </Html>
    </group>
  );
};
