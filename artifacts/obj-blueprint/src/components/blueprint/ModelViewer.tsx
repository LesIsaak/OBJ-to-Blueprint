import React, { useMemo, useEffect, useRef } from 'react';
import { Center } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { vertexStore } from './vertexStore';

const WIRE_COLOR_DARK  = 0x58a6ff;
const WIRE_COLOR_LIGHT = 0x000000;
const CREASE_ANGLE = 15;
const COS_CREASE = Math.cos((CREASE_ANGLE * Math.PI) / 180);

// Direction FROM scene origin TOWARD camera for each orthographic view
const VIEW_DIRS: Record<string, THREE.Vector3> = {
  front: new THREE.Vector3( 0,  0,  1),
  back:  new THREE.Vector3( 0,  0, -1),
  left:  new THREE.Vector3(-1,  0,  0),
  right: new THREE.Vector3( 1,  0,  0),
};

const disposeMaterial = (mat: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(mat)) mat.forEach(m => m.dispose());
  else mat.dispose();
};

// ─── Hidden-line edge geometry ────────────────────────────────────────────────
// Builds edge segments (crease-filtered) that have at least one front-facing
// adjacent face relative to `viewDir`.  All output positions are in the
// parent-group coordinate space (meshMatrix already applied).
function buildVisibleEdgeGeometry(
  geometry: THREE.BufferGeometry,
  meshMatrix: THREE.Matrix4,
  viewDir: THREE.Vector3,
): THREE.BufferGeometry {
  const geo = geometry.index ? geometry.clone().toNonIndexed() : geometry;
  const pos = geo.attributes.position;
  if (!pos || pos.count < 3) return new THREE.BufferGeometry();

  const triCount = Math.floor(pos.count / 3);

  // Round to 3 decimal places so shared vertices from adjacent triangles key alike
  const key3 = (v: THREE.Vector3) =>
    `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;

  type EdgeInfo = { v0: THREE.Vector3; v1: THREE.Vector3; normals: THREE.Vector3[] };
  const edgeMap = new Map<string, EdgeInfo>();

  for (let i = 0; i < triCount; i++) {
    // Transform vertices to group space so normals compare correctly to viewDir
    const a = new THREE.Vector3().fromBufferAttribute(pos, i * 3    ).applyMatrix4(meshMatrix);
    const b = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 1).applyMatrix4(meshMatrix);
    const c = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 2).applyMatrix4(meshMatrix);

    const faceNormal = new THREE.Vector3()
      .crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (faceNormal.lengthSq() < 1e-12) continue; // degenerate triangle
    faceNormal.normalize();

    for (const [v0, v1] of [[a, b], [b, c], [c, a]] as [THREE.Vector3, THREE.Vector3][]) {
      const k0 = key3(v0), k1 = key3(v1);
      const edgeKey = k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`;
      if (!edgeMap.has(edgeKey))
        edgeMap.set(edgeKey, { v0: v0.clone(), v1: v1.clone(), normals: [] });
      edgeMap.get(edgeKey)!.normals.push(faceNormal.clone());
    }
  }

  const segments: number[] = [];

  for (const { v0, v1, normals } of edgeMap.values()) {
    // Must have at least one adjacent face pointing toward the camera
    if (!normals.some(n => n.dot(viewDir) > 0)) continue;

    // Crease-angle filter — same 15° threshold as EdgesGeometry
    if (normals.length === 2 && normals[0].dot(normals[1]) > COS_CREASE) continue;

    segments.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z);
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  return result;
}

// ─── ModelViewer ─────────────────────────────────────────────────────────────

export const ModelViewer: React.FC = () => {
  const objData      = useBlueprintStore(state => state.objData);
  const viewMode     = useBlueprintStore(state => state.viewMode);
  const theme        = useBlueprintStore(state => state.theme);
  const setModelBounds = useBlueprintStore(state => state.setModelBounds);
  const groupRef     = useRef<THREE.Group>(null);

  // ── Step 1: parse OBJ → raw mesh data (once per file load) ─────────────────
  const rawMeshes = useMemo(() => {
    if (!objData) return null;
    try {
      const loader = new OBJLoader();
      const loaded = loader.parse(objData);
      const meshes: Array<{ geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }> = [];
      loaded.traverse(child => {
        if (child instanceof THREE.Mesh) {
          meshes.push({
            geometry: child.geometry as THREE.BufferGeometry,
            matrix: child.matrix.clone(),
          });
        }
      });
      return meshes;
    } catch (e) {
      console.error('Failed to parse OBJ', e);
      return null;
    }
  }, [objData]);

  // ── Step 2: build edge lines for the current view (cheap, view-reactive) ───
  const renderGroup = useMemo(() => {
    if (!rawMeshes) return null;

    const group     = new THREE.Group();
    const is3d      = viewMode === '3d';
    const viewDir   = VIEW_DIRS[viewMode] ?? VIEW_DIRS.front;
    const wireColor = theme === 'light' ? WIRE_COLOR_LIGHT : WIRE_COLOR_DARK;

    for (const { geometry, matrix } of rawMeshes) {
      let edgesGeo: THREE.BufferGeometry;

      if (is3d) {
        // Standard all-edge wireframe for 3D view
        edgesGeo = new THREE.EdgesGeometry(geometry, CREASE_ANGLE);
        const lines = new THREE.LineSegments(
          edgesGeo,
          new THREE.LineBasicMaterial({ color: wireColor }),
        );
        lines.matrix.copy(matrix);
        lines.matrixAutoUpdate = false;
        group.add(lines);
      } else {
        // Hidden-line removal: only edges on front-facing faces
        // Output positions are already in group space (matrix applied inside fn)
        edgesGeo = buildVisibleEdgeGeometry(geometry, matrix, viewDir);
        const lines = new THREE.LineSegments(
          edgesGeo,
          new THREE.LineBasicMaterial({ color: wireColor }),
        );
        group.add(lines);
      }
    }

    return group;
  }, [rawMeshes, viewMode, theme]);

  // ── Publish model bounds (for PDF/SVG title block scale) ───────────────────
  useEffect(() => {
    if (!renderGroup) { setModelBounds(null); return; }
    const box = new THREE.Box3().setFromObject(renderGroup);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      setModelBounds({
        min: [-size.x / 2, -size.y / 2, -size.z / 2],
        max: [ size.x / 2,  size.y / 2,  size.z / 2],
      });
    }
  }, [renderGroup, setModelBounds]);

  // ── Extract world-space vertices for snap (after Center repositions group) ─
  useEffect(() => {
    if (!renderGroup || !groupRef.current) { vertexStore.clear(); return; }

    const raf = requestAnimationFrame(() => {
      const verts: THREE.Vector3[] = [];
      const seen  = new Set<string>();

      groupRef.current?.traverse(child => {
        if (
          !(child instanceof THREE.Mesh) &&
          !(child instanceof THREE.LineSegments) &&
          !(child instanceof THREE.Line)
        ) return;

        child.updateWorldMatrix(true, false);
        const geo = child.geometry as THREE.BufferGeometry;
        if (!geo.attributes.position) return;
        const pos     = geo.attributes.position;
        const worldMat = child.matrixWorld;

        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(worldMat);
          const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
          if (!seen.has(key)) { seen.add(key); verts.push(v.clone()); }
        }
      });

      vertexStore.set(verts);
    });

    return () => { cancelAnimationFrame(raf); vertexStore.clear(); };
  }, [renderGroup]);

  if (!renderGroup) return null;

  return (
    <Center>
      <group ref={groupRef}>
        <primitive object={renderGroup} />
      </group>
    </Center>
  );
};
