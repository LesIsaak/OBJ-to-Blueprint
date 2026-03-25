import React, { useMemo, useEffect, useRef } from 'react';
import { Center } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { vertexStore } from './vertexStore';

export const ModelViewer: React.FC = () => {
  const objData = useBlueprintStore(state => state.objData);
  const viewMode = useBlueprintStore(state => state.viewMode);
  const groupRef = useRef<THREE.Group>(null);

  const obj = useMemo(() => {
    if (!objData) return null;
    try {
      const loader = new OBJLoader();
      const loadedObj = loader.parse(objData);

      loadedObj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Dispose any old material first
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m: THREE.Material) => m.dispose());
            } else {
              (child.material as THREE.Material).dispose();
            }
          }

          if (viewMode === '3d') {
            // Solid shaded material — single material so geometry groups aren't needed
            child.material = new THREE.MeshStandardMaterial({
              color: 0x4a90d9,
              roughness: 0.5,
              metalness: 0.1,
              side: THREE.DoubleSide,
            });
          } else {
            // Blueprint wireframe style for 2D orthographic views
            child.material = new THREE.MeshBasicMaterial({
              color: 0x58a6ff,
              wireframe: true,
              transparent: true,
              opacity: 0.9,
            });
          }
        }
      });

      return loadedObj;
    } catch (e) {
      console.error('Failed to parse OBJ', e);
      return null;
    }
  }, [objData, viewMode]);

  // After the group is mounted and Center has repositioned it, extract world-space vertices
  useEffect(() => {
    if (!obj || !groupRef.current) {
      vertexStore.clear();
      return;
    }

    // Wait one frame for Center to apply its offset to matrixWorld
    const raf = requestAnimationFrame(() => {
      const verts: THREE.Vector3[] = [];
      const seen = new Set<string>();

      groupRef.current?.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geo = child.geometry;
          if (!geo.attributes.position) return;
          const pos = geo.attributes.position;
          const worldMat = child.matrixWorld;

          for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3()
              .fromBufferAttribute(pos, i)
              .applyMatrix4(worldMat);
            // Deduplicate to a ~0.01 grid to keep the vertex list small
            const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
            if (!seen.has(key)) {
              seen.add(key);
              verts.push(v.clone());
            }
          }
        }
      });

      vertexStore.set(verts);
    });

    return () => {
      cancelAnimationFrame(raf);
      vertexStore.clear();
    };
  }, [obj]);

  if (!obj) return null;

  return (
    <Center>
      <group ref={groupRef}>
        <primitive object={obj} />
      </group>
    </Center>
  );
};
