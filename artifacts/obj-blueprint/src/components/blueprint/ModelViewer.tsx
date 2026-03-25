import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Bounds, Center } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useBlueprintStore } from '@/store/use-blueprint-store';

export const ModelViewer: React.FC = () => {
  const objData = useBlueprintStore(state => state.objData);
  const viewMode = useBlueprintStore(state => state.viewMode);

  const obj = useMemo(() => {
    if (!objData) return null;
    try {
      const loader = new OBJLoader();
      const loadedObj = loader.parse(objData);
      
      // Apply blueprint materials to all meshes
      loadedObj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Wireframe material for blueprint look
          child.material = new THREE.MeshBasicMaterial({ 
            color: viewMode === '3d' ? 0x88ccff : 0x58a6ff, 
            wireframe: viewMode !== '3d', // Wireframe in 2D views
            transparent: true,
            opacity: 0.8
          });
          
          // Add a solid dark background material for 3D view to give it volume
          if (viewMode === '3d') {
             const solidMat = new THREE.MeshStandardMaterial({
               color: 0x0d1117,
               roughness: 0.7,
               metalness: 0.3,
               polygonOffset: true,
               polygonOffsetFactor: 1, // push solid back slightly
               polygonOffsetUnits: 1
             });
             child.material = [solidMat, child.material];
          }
        }
      });
      return loadedObj;
    } catch (e) {
      console.error("Failed to parse OBJ", e);
      return null;
    }
  }, [objData, viewMode]);

  if (!obj) return null;

  return (
    <Center>
      <primitive object={obj} />
    </Center>
  );
};
