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
          child.material = new THREE.MeshBasicMaterial({
            color: viewMode === '3d' ? 0x88ccff : 0x58a6ff,
            wireframe: viewMode !== '3d',
            transparent: true,
            opacity: 0.8,
          });

          if (viewMode === '3d') {
            const solidMat = new THREE.MeshStandardMaterial({
              color: 0x0d1117,
              roughness: 0.7,
              metalness: 0.3,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
            });
            child.material = [solidMat, child.material];
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

    // Wait one frame for Center to apply its offset
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
            const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(worldMat);
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
