import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useBlueprintStore } from '@/store/use-blueprint-store';
import { ModelViewer } from './ModelViewer';
import { DimensionLine } from './DimensionLine';

const CameraManager = () => {
  const viewMode = useBlueprintStore(state => state.viewMode);
  const { camera } = useThree();

  useEffect(() => {
    if (viewMode === '3d') {
      camera.position.set(50, 50, 50);
      camera.lookAt(0, 0, 0);
    } else if (viewMode === 'front') {
      camera.position.set(0, 0, 100);
      camera.lookAt(0, 0, 0);
    } else if (viewMode === 'back') {
      camera.position.set(0, 0, -100);
      camera.lookAt(0, 0, 0);
    } else if (viewMode === 'left') {
      camera.position.set(-100, 0, 0);
      camera.lookAt(0, 0, 0);
    } else if (viewMode === 'right') {
      camera.position.set(100, 0, 0);
      camera.lookAt(0, 0, 0);
    }
  }, [viewMode, camera]);

  return (
    <>
      {viewMode === '3d' ? (
        <PerspectiveCamera makeDefault fov={45} position={[50, 50, 50]} />
      ) : (
        <OrthographicCamera makeDefault zoom={10} position={[0, 0, 100]} near={-1000} far={1000} />
      )}
      <OrbitControls
        enableRotate={viewMode === '3d'}
        enablePan={true}
        enableZoom={true}
        makeDefault
      />
    </>
  );
};

const InteractionPlane = () => {
  const { viewMode, isDrawing, draftPoint, setDraftPoint, addDimension } = useBlueprintStore();

  if (viewMode === '3d' || !isDrawing) return null;

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    const point = [e.point.x, e.point.y, e.point.z] as [number, number, number];

    if (!draftPoint) {
      setDraftPoint(point);
    } else {
      addDimension(draftPoint, point);
    }
  };

  return (
    <mesh visible={false} onPointerDown={handlePointerDown} position={[0, 0, 0]}>
      <planeGeometry args={[10000, 10000]} />
      <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0.01} />
    </mesh>
  );
};

const ThreeCanvas = React.forwardRef<HTMLCanvasElement>((_props, ref) => {
  const dimensions = useBlueprintStore(state => state.dimensions);
  const viewMode = useBlueprintStore(state => state.viewMode);
  const draftPoint = useBlueprintStore(state => state.draftPoint);
  const isDrawing = useBlueprintStore(state => state.isDrawing);

  return (
    <div className="w-full h-full relative cursor-crosshair">
      <Canvas
        ref={ref}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
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

        {dimensions.filter(d => d.view === viewMode || viewMode === '3d').map(dim => (
          <DimensionLine key={dim.id} dimension={dim} />
        ))}

        {isDrawing && draftPoint && (
          <mesh position={draftPoint}>
            <sphereGeometry args={[0.5]} />
            <meshBasicMaterial color="#ffaa00" />
          </mesh>
        )}

        <InteractionPlane />
      </Canvas>
    </div>
  );
});

ThreeCanvas.displayName = 'ThreeCanvas';
export default ThreeCanvas;
