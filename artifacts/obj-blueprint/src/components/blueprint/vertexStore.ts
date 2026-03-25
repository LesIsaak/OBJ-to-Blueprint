/**
 * Module-level mutable store for OBJ world-space vertices.
 * Kept outside React/Zustand to avoid expensive re-renders on every vertex update.
 * Updated by ModelViewer after OBJ parsing, read by SnapController during pointer move.
 */
import * as THREE from 'three';

export type ViewMode = '3d' | 'front' | 'back' | 'left' | 'right';

export const vertexStore = {
  vertices: [] as THREE.Vector3[],

  set(verts: THREE.Vector3[]) {
    this.vertices = verts;
  },

  clear() {
    this.vertices = [];
  },

  /**
   * Find the nearest vertex using full 3D distance (used in perspective/3D view).
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

  /**
   * Find the nearest vertex using projected 2D distance for orthographic views.
   * - front / back  →  compare X and Y only
   * - left  / right →  compare Y and Z only
   * This way vertices that appear at the same screen pixel are treated as the same snap target.
   */
  findNearestProjected(
    query: THREE.Vector3,
    radius: number,
    viewMode: ViewMode,
  ): THREE.Vector3 | null {
    if (this.vertices.length === 0) return null;
    let best: THREE.Vector3 | null = null;
    let bestDist = radius;

    for (const v of this.vertices) {
      let d: number;
      if (viewMode === 'left' || viewMode === 'right') {
        const dy = v.y - query.y;
        const dz = v.z - query.z;
        d = Math.sqrt(dy * dy + dz * dz);
      } else {
        // front / back
        const dx = v.x - query.x;
        const dy = v.y - query.y;
        d = Math.sqrt(dx * dx + dy * dy);
      }
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  },
};
