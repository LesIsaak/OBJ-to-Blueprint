import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { ModelViewer } from './ModelViewer';
import { DimensionLine } from './DimensionLine';
import { vertexStore } from './vertexStore';

import { exportCameraRef } from './exportCamera';

// ─── Bounding info from OBJ ────────────────────────────────────────────────────

function computeBounds(objData: string | null) {
  if (!objData) return null;
  try {
    const obj = new OBJLoader().parse(objData);
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    return { size, radius: sphere.radius };
  } catch {
    return null;
  }
}

// ─── Camera & Controls ────────────────────────────────────────────────────────

const CameraManager = () => {
  const viewMode = useBlueprintStore(state => state.viewMode);
  const objData  = useBlueprintStore(state => state.objData);
  const { camera, size } = useThree();

  const bounds = useMemo(() => computeBounds(objData), [objData]);

  // Keep exportCameraRef up to date every frame
  useFrame(() => {
    exportCameraRef.current = camera;
    exportCameraRef.size = { w: size.width, h: size.height };
  });

  // Fit camera whenever model or view changes
  useEffect(() => {
    const R = bounds?.radius ?? 50;
    const boxSize = bounds?.size ?? new THREE.Vector3(R * 2, R * 2, R * 2);

    if (camera instanceof THREE.PerspectiveCamera) {
      const fovRad = (camera.fov * Math.PI) / 180;
      const aspect = size.width / size.height;
      const fovMin = Math.min(fovRad, 2 * Math.atan(Math.tan(fovRad / 2) * aspect));
      const dist = (R / Math.sin(fovMin / 2)) * 1.3;
      camera.position.set(dist * 0.577, dist * 0.577, dist * 0.577);
      camera.lookAt(0, 0, 0);
    } else if (camera instanceof THREE.OrthographicCamera) {
      const [projW, projH] = (() => {
        if (viewMode === 'front' || viewMode === 'back') return [boxSize.x, boxSize.y];
        if (viewMode === 'left' || viewMode === 'right') return [boxSize.z, boxSize.y];
        return [boxSize.x, boxSize.y];
      })();

      const padding = 1.25;
      camera.zoom = Math.min(
        size.width  / (projW  * padding),
        size.height / (projH * padding),
      );

      const OFFSET = 500;
      const positions: Record<string, [number, number, number]> = {
        front: [0, 0,      OFFSET],
        back:  [0, 0,     -OFFSET],
        left:  [-OFFSET, 0, 0],
        right: [OFFSET,  0, 0],
      };
      const pos = positions[viewMode] ?? [0, 0, OFFSET];
      camera.position.set(...pos);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
  }, [objData, viewMode, camera, size, bounds]);

  return (
    <>
      {viewMode === '3d' ? (
        <PerspectiveCamera makeDefault fov={45} near={0.01} far={100000} position={[50, 50, 50]} />
      ) : (
        <OrthographicCamera makeDefault zoom={10} position={[0, 0, 500]} near={-100000} far={100000} />
      )}
      <OrbitControls
        enableRotate={viewMode === '3d'}
        enablePan
        enableZoom
        makeDefault
        mouseButtons={{
          LEFT:   viewMode === '3d' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: viewMode === '3d' ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  );
};

// ─── Snap radius helper ───────────────────────────────────────────────────────

function getSnapRadius(camera: THREE.Camera): number {
  if (camera instanceof THREE.OrthographicCamera) {
    const zoom = camera.zoom || 1;
    return 30 / zoom;
  }
  return 3;
}

// ─── Point Indicator (hover + placed) ─────────────────────────────────────────

interface PointIndicatorProps {
  position: [number, number, number];
  snapped: boolean;
}

const PointIndicator: React.FC<PointIndicatorProps> = ({ position, snapped }) => {
  const { camera } = useThree();
  // Scale with camera zoom so indicator is always ~6px equivalent on screen
  const zoom = camera instanceof THREE.OrthographicCamera ? camera.zoom : 1;
  const r = Math.max(0.2, 6 / zoom);

  const ringColor = snapped ? '#00ff88' : '#ffcc00';

  return (
    <group position={position} renderOrder={200}>
      {/* Thin colored ring — transparent center so model shows through */}
      <mesh renderOrder={200}>
        <ringGeometry args={[r, r * 1.6, 20]} />
        <meshBasicMaterial color={ringColor} depthTest={false} side={THREE.DoubleSide} transparent opacity={0.9} />
      </mesh>
      {/* Short cross-hair lines */}
      <line renderOrder={201}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([-r * 2, 0, 0, r * 2, 0, 0]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={ringColor} depthTest={false} transparent opacity={0.7} />
      </line>
      <line renderOrder={201}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([0, -r * 2, 0, 0, r * 2, 0]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={ringColor} depthTest={false} transparent opacity={0.7} />
      </line>
    </group>
  );
};

// ─── Snap + Interaction Controller ────────────────────────────────────────────

interface SnapState {
  hoverPos: THREE.Vector3 | null;
  snapped: boolean;
}

const SnapController: React.FC = () => {
  const { viewMode, isDrawing, draftPoint, setDraftPoint, addDimension } = useBlueprintStore();
  const { camera } = useThree();
  const [snapState, setSnapState] = useState<SnapState>({ hoverPos: null, snapped: false });

  const resolvePoint = useCallback((rawPoint: THREE.Vector3): { pos: THREE.Vector3; snapped: boolean } => {
    const radius = getSnapRadius(camera);
    const nearest = vertexStore.findNearestProjected(rawPoint, radius, viewMode as any);
    if (nearest) {
      return { pos: nearest.clone(), snapped: true };
    }
    return { pos: rawPoint.clone(), snapped: false };
  }, [camera, viewMode]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDrawing) return;
    e.stopPropagation();
    const raw = new THREE.Vector3(e.point.x, e.point.y, e.point.z);
    const { pos, snapped } = resolvePoint(raw);
    setSnapState({ hoverPos: pos, snapped });
  }, [isDrawing, resolvePoint]);

  const handlePointerDown = useCallback((e: any) => {
    if (!isDrawing) return;
    e.stopPropagation();
    const raw = new THREE.Vector3(e.point.x, e.point.y, e.point.z);
    const { pos } = resolvePoint(raw);
    const pt: [number, number, number] = [pos.x, pos.y, pos.z];

    if (!draftPoint) {
      setDraftPoint(pt);
    } else {
      addDimension(draftPoint, pt);
      // After placing, clear hover so indicator resets
      setSnapState({ hoverPos: null, snapped: false });
    }
  }, [isDrawing, resolvePoint, draftPoint, setDraftPoint, addDimension]);

  const handlePointerLeave = useCallback(() => {
    setSnapState({ hoverPos: null, snapped: false });
  }, []);

  // Only active in 2D views
  if (viewMode === '3d') return null;

  const planeRotation: [number, number, number] =
    viewMode === 'left' || viewMode === 'right'
      ? [0, Math.PI / 2, 0]
      : [0, 0, 0];

  return (
    <>
      {/* Large invisible plane to capture pointer events */}
      <mesh
        visible={false}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        position={[0, 0, 0]}
        rotation={planeRotation}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0.001} />
      </mesh>

      {/* Hover indicator */}
      {isDrawing && snapState.hoverPos && (
        <PointIndicator
          position={[snapState.hoverPos.x, snapState.hoverPos.y, snapState.hoverPos.z]}
          snapped={snapState.snapped}
        />
      )}

      {/* Draft (first placed) point indicator */}
      {isDrawing && draftPoint && (
        <PointIndicator position={draftPoint} snapped={true} />
      )}

      {/* Live rubber-band dimension line from draft point to hover */}
      {isDrawing && draftPoint && snapState.hoverPos && (
        <RubberBandLine from={draftPoint} to={[snapState.hoverPos.x, snapState.hoverPos.y, snapState.hoverPos.z]} />
      )}
    </>
  );
};

// ─── Rubber-band preview line ─────────────────────────────────────────────────

interface RubberBandLineProps {
  from: [number, number, number];
  to: [number, number, number];
}

const RubberBandLine: React.FC<RubberBandLineProps> = ({ from, to }) => {
  const lineRef = useRef<THREE.BufferGeometry>(null);

  useFrame(() => {
    if (!lineRef.current) return;
    const pts = new Float32Array([...from, ...to]);
    lineRef.current.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    lineRef.current.computeBoundingSphere();
  });

  return (
    <line renderOrder={90}>
      <bufferGeometry ref={lineRef} />
      <lineBasicMaterial
        color="#ffcc00"
        depthTest={false}
        transparent
        opacity={0.7}
      />
    </line>
  );
};

// ─── Main Canvas ──────────────────────────────────────────────────────────────

const ThreeCanvas = React.forwardRef<HTMLCanvasElement>((_props, ref) => {
  const dimensions = useBlueprintStore(state => state.dimensions);
  const viewMode = useBlueprintStore(state => state.viewMode);
  const isDrawing = useBlueprintStore(state => state.isDrawing);
  const toggleDrawing = useBlueprintStore(state => state.toggleDrawing);
  const setDraftPoint = useBlueprintStore(state => state.setDraftPoint);

  // Escape cancels drawing mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawing) {
        setDraftPoint(null);
        toggleDrawing();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isDrawing, toggleDrawing, setDraftPoint]);

  return (
    <div className={`w-full h-full relative ${isDrawing ? 'cursor-crosshair' : 'cursor-grab'}`}>
      <Canvas
        ref={ref}
        gl={{ preserveDrawingBuffer: true, antialias: true, logarithmicDepthBuffer: true }}
        className="outline-none"
      >
        <color attach="background" args={['#0d1117']} />

        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} />
        <directionalLight position={[-10, -10, -10]} intensity={0.5} />

        <CameraManager />

        <Grid
          infiniteGrid
          fadeDistance={200}
          sectionColor="#30363d"
          cellColor="#161b22"
          sectionSize={10}
          cellSize={2}
          position={[0, -0.1, 0]}
          rotation={viewMode === 'front' || viewMode === 'back' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
        />

        <ModelViewer />

        {dimensions
          .filter(d => d.view === viewMode || viewMode === '3d')
          .map(dim => (
            <DimensionLine key={dim.id} dimension={dim} />
          ))}

        <SnapController />
      </Canvas>

      {/* Drawing mode hint overlay */}
      {isDrawing && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/70 border border-yellow-400/60 text-yellow-300 font-mono text-xs px-4 py-2 rounded-full backdrop-blur-sm shadow-lg">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            {!useBlueprintStore.getState().draftPoint
              ? 'Click first point · Snaps to model vertices'
              : 'Click second point to complete measurement'}
            <span className="text-yellow-400/60 ml-1">· Esc to cancel</span>
          </div>
        </div>
      )}
    </div>
  );
});

ThreeCanvas.displayName = 'ThreeCanvas';
export default ThreeCanvas;
