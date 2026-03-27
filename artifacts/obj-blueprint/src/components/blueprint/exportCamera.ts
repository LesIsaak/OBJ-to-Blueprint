import * as THREE from 'three';

/**
 * Module-level ref updated every frame by CameraManager.
 * Used by PdfExport to project 3D dimension labels into PDF space.
 */
export const exportCameraRef: {
  current: THREE.Camera | null;
  size: { w: number; h: number };
} = {
  current: null,
  size: { w: 1, h: 1 },
};
