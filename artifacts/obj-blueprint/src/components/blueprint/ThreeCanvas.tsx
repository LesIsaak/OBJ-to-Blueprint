import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { ModelViewer } from './ModelViewer';
import { DimensionLine } from './DimensionLine';
import { vertexStore } from './vertexStore';

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

  // Fit camera whenever model or view changes
  useEffect(() => {
    const R = bounds?.radius ?? 50;
    const boxSize = bounds?.size ?? new THREE.Vector3(R * 2, R * 2, R * 2);

    if (camera instanceof THREE.PerspectiveCamera) {
      const fovRad = (camera.fov * Math.PI) / 180;
      const aspect = size.width / size.height;
      const fovMin = Math.min(fovRad, 2 * Math.atan(Math.tan(fovRad / 2) * aspect));
      const dist = (R / Math.sin(fovMin / 2)) * 1.3;
      camera.position.set(dist * 0.577, dist * 0.577, dist * 0.577); // normalized (1,1,1)
      camera.lookAt(0, 0, 0);
    } else if (camera instanceof THREE.OrthographicCamera) {
      // Projected extents per view direction
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

      // Fixed offset — ortho rendering is independent of camera distance.
      // near/far on the component span ±100000 so the model is never clipped.
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
  // In ortho views, snap radius scales with zoom
  if (camera instanceof THREE.OrthographicCamera) {
    const zoom = camera.zoom || 1;
    return 30 / zoom; // world-unit snap radius, adapts to zoom level
  }
  return 3; // perspective: fixed world-unit radius
}

// ─── Point Indicator (hover + placed) ─────────────────────────────────────────

interface PointIndicatorProps {
  position: [number, number, number];
  snapped: boolean;
  pulsing?: boolean;
  label?: string;
}

const PointIndicator: React.FC<PointIndicatorProps> = ({ position, snapped, pulsing = false, label }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!pulsing) return;
    t.current += delta * 3;
    const s = 1 + 0.25 * Math.sin(t.current);
    if (ringRef.current) {
      ringRef.current.scale.setScalar(s);
    }
  });

  const color = snapped ? '#00ff99' : '#ffaa00';

  return (
    <group position={position} renderOrder={100}>
      {/* Outer pulsing ring */}
      <mesh ref={ringRef} renderOrder={99}>
        <ringGeometry args={[0.55, 0.85, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner dot */}
      <mesh ref={meshRef} renderOrder={100}>
        <circleGeometry args={[0.35, 32]} />
        <meshBasicMaterial color={color} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Center crosshair lines */}
      <lineSegments renderOrder={101}>
        <bufferGeometry attach="geometry" onUpdate={(geo) => {
          const pts = new Float32Array([-0.8, 0, 0, 0.8, 0, 0, 0, -0.8, 0, 0, 0.8, 0]);
          geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        }} />
        <lineBasicMaterial color={color} depthTest={false} />
      </lineSegments>
      {/* Label */}
      {label && (
        <Html position={[0, 1.2, 0]} center zIndexRange={[200, 0]}>
          <div className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap pointer-events-none"
            style={{ background: snapped ? '#00ff9922' : '#ffaa0022', border: `1px solid ${color}`, color }}>
            {label}
          </div>
        </Html>
      )}
    </group>
  );
};

// ─── Snap + Interaction Controller ────────────────────────────────────────────

interface SnapState {
  hoverPos: THREE.Vector3 | null;
  snapped: boolean;
}

const SnapController: React.FC = () => {
  // All hooks must be called unconditionally at the top
  const { viewMode, isDrawing, draftPoint, setDraftPoint, addDimension } = useBlueprintStore();
  const { camera } = useThree();
  const [snapState, setSnapState] = useState<SnapState>({ hoverPos: null, snapped: false });

  const resolvePoint = useCallback((rawPoint: THREE.Vector3): { pos: THREE.Vector3; snapped: boolean } => {
    const radius = getSnapRadius(camera);
    // Use projected 2D distance so snapping works correctly in orthographic views
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
    }
  }, [isDrawing, resolvePoint, draftPoint, setDraftPoint, addDimension]);

  const handlePointerLeave = useCallback(() => {
    setSnapState({ hoverPos: null, snapped: false });
  }, []);

  // Only active in 2D views — conditional return AFTER all hooks
  if (viewMode === '3d') return null;

  // Plane must be perpendicular to the camera's look direction:
  //   front / back  → camera along Z  → XY plane  → no rotation
  //   left  / right → camera along X  → YZ plane  → rotate Y by 90°
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
          pulsing={snapState.snapped}
          label={snapState.snapped ? '⊕ snap' : undefined}
        />
      )}

      {/* Draft (first placed) point indicator */}
      {isDrawing && draftPoint && (
        <PointIndicator
          position={draftPoint}
          snapped={false}
          pulsing
          label="P1"
        />
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
        color="#ffaa00"
        depthTest={false}
        transparent
        opacity={0.6}
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
          <div className="flex items-center gap-2 bg-black/60 border border-yellow-400/40 text-yellow-300 font-mono text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Click to place point · Snaps to model vertices · Press Esc to cancel
          </div>
        </div>
      )}
    </div>
  );
});

ThreeCanvas.displayName = 'ThreeCanvas';
export default ThreeCanvas;
