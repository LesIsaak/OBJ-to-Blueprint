import React, { useMemo, useEffect, useRef } from 'react';
import { Center } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { vertexStore } from './vertexStore';

const WIRE_COLOR = 0x58a6ff;

const disposeMaterial = (mat: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
  else mat.dispose();
};

export const ModelViewer: React.FC = () => {
  const objData = useBlueprintStore(state => state.objData);
  const setModelBounds = useBlueprintStore(state => state.setModelBounds);
  const groupRef = useRef<THREE.Group>(null);

  const obj = useMemo(() => {
    if (!objData) return null;
    try {
      const loader = new OBJLoader();
      const loadedObj = loader.parse(objData);

      loadedObj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) disposeMaterial(child.material);
          child.material = new THREE.MeshBasicMaterial({
            color: WIRE_COLOR,
            wireframe: true,
          });
        }
        if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
          if (child.material) disposeMaterial(child.material);
          child.material = new THREE.LineBasicMaterial({ color: WIRE_COLOR, linewidth: 1 });
        }
      });

      return loadedObj;
    } catch (e) {
      console.error('Failed to parse OBJ', e);
      return null;
    }
  }, [objData]);

  // Publish centered model bounds to the store (safe: runs after render)
  useEffect(() => {
    if (!obj) {
      setModelBounds(null);
      return;
    }
    const box = new THREE.Box3().setFromObject(obj);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      setModelBounds({
        min: [-size.x / 2, -size.y / 2, -size.z / 2],
        max: [ size.x / 2,  size.y / 2,  size.z / 2],
      });
    }
  }, [obj, setModelBounds]);

  // Extract world-space vertices for snap after Center repositions the group
  useEffect(() => {
    if (!obj || !groupRef.current) {
      vertexStore.clear();
      return;
    }

    const raf = requestAnimationFrame(() => {
      const verts: THREE.Vector3[] = [];
      const seen = new Set<string>();

      groupRef.current?.traverse((child) => {
        if (
          !(child instanceof THREE.Mesh) &&
          !(child instanceof THREE.LineSegments) &&
          !(child instanceof THREE.Line)
        ) return;

        // Ensure matrixWorld is up to date after Center applies its transform
        child.updateWorldMatrix(true, false);

        const geo = child.geometry as THREE.BufferGeometry;
        if (!geo.attributes.position) return;
        const pos = geo.attributes.position;
        const worldMat = child.matrixWorld;

        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3()
            .fromBufferAttribute(pos, i)
            .applyMatrix4(worldMat);
          const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
          if (!seen.has(key)) {
            seen.add(key);
            verts.push(v.clone());
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
