/**
 * Module-level mutable store for OBJ world-space vertices.
 * Kept outside React/Zustand to avoid expensive re-renders on every vertex update.
 * Updated by ModelViewer after OBJ parsing, read by SnapController during pointer move.
 */
import * as THREE from 'three';

export const vertexStore = {
  vertices: [] as THREE.Vector3[],

  set(verts: THREE.Vector3[]) {
    this.vertices = verts;
  },

  clear() {
    this.vertices = [];
  },

  /**
   * Find the nearest vertex to a query point, within a snap radius (world units).
   * Returns null if no vertices or none within radius.
   */
  findNearest(query: THREE.Vector3, radius: number): THREE.Vector3 | null {
    if (this.vertices.length === 0) return null;
    let best: THREE.Vector3 | null = null;
    let bestDist = radius;

    for (const v of this.vertices) {
      const d = query.distanceTo(v);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  },
};
