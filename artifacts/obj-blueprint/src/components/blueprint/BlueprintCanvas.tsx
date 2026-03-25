import React, { useEffect, useState, Component } from 'react';
import { useBlueprintStore } from '@/store/use-blueprint-store';

const ThreeCanvas = React.lazy(() => import('./ThreeCanvas'));

// ─── Fallback: shown when no OBJ is loaded or WebGL fails ────────────────────

const FallbackCanvas = () => {
  const { viewMode, dimensions, objData } = useBlueprintStore();

  const viewLabels: Record<string, string> = {
    '3d': '3D View',
    front: 'Front View',
    back: 'Back View',
    left: 'Left View',
    right: 'Right View',
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d1117] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(#30363d 1px, transparent 1px), linear-gradient(90deg, #30363d 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10 text-center space-y-6 max-w-md px-6">
        <div className="inline-flex items-center gap-2 text-blue-400 font-mono text-sm border border-blue-400/30 bg-blue-400/10 px-3 py-1 rounded">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          {viewLabels[viewMode] || viewMode}
        </div>
        <div className="border border-[#30363d] bg-[#161b22] rounded-xl p-8 text-left font-mono">
          <div className="text-blue-300 text-xs mb-4 uppercase tracking-wider">Blueprint Viewport</div>
          {objData ? (
            <div className="space-y-2">
              <p className="text-green-400 text-sm">✓ Model loaded successfully</p>
              <p className="text-muted-foreground text-xs">
                {objData.split('\n').filter((l: string) => l.startsWith('v ')).length} vertices
              </p>
              <p className="text-muted-foreground text-xs">
                {objData.split('\n').filter((l: string) => l.startsWith('f ')).length} faces
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No model loaded. Import an .obj file from the sidebar.
            </p>
          )}
          {dimensions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#30363d]">
              <p className="text-blue-300 text-xs mb-2">{dimensions.length} dimension(s) defined</p>
              {dimensions.slice(0, 3).map((d: any) => (
                <div key={d.id} className="text-xs text-muted-foreground flex justify-between py-1">
                  <span className="text-blue-400">{d.view}</span>
                  <span>{d.customText || 'unlabeled'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          3D rendering requires WebGL. Open in a standard browser for full 3D functionality.
        </p>
      </div>
    </div>
  );
};

// ─── Error Boundary: catches WebGL / Three.js init failures ──────────────────

interface EBState { hasError: boolean }

class ThreeErrorBoundary extends Component<{ children: React.ReactNode; fallback: React.ReactNode }, EBState> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Suppress WebGL errors from propagating to Vite's overlay
    if (error.message.includes('WebGL') || error.message.includes('Context')) return;
    console.error('[ThreeErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── WebGL probe: returns result synchronously without creating a Three.js renderer ──

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;
    // Check for actual functionality
    const ext = (gl as WebGLRenderingContext).getExtension?.('WEBGL_debug_renderer_info');
    const vendor = ext
      ? (gl as WebGLRenderingContext).getParameter?.((ext as any).UNMASKED_VENDOR_WEBGL)
      : null;
    // "0xffff" vendor is the Replit sandbox stub — it reports no GPU
    if (typeof vendor === 'number' && vendor === 0xffff) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface BlueprintCanvasProps {}

export const BlueprintCanvas = React.forwardRef<HTMLCanvasElement, BlueprintCanvasProps>(
  (_props, ref) => {
    const [hasWebGL, setHasWebGL] = useState<boolean | null>(null);

    useEffect(() => {
      setHasWebGL(checkWebGLSupport());
    }, []);

    if (hasWebGL === null) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
          <div className="text-blue-400 font-mono text-sm animate-pulse">Initializing viewport…</div>
        </div>
      );
    }

    if (!hasWebGL) {
      return <FallbackCanvas />;
    }

    return (
      <ThreeErrorBoundary fallback={<FallbackCanvas />}>
        <React.Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
              <div className="text-blue-400 font-mono text-sm animate-pulse">Loading 3D renderer…</div>
            </div>
          }
        >
          <ThreeCanvas ref={ref} />
        </React.Suspense>
      </ThreeErrorBoundary>
    );
  }
);

BlueprintCanvas.displayName = 'BlueprintCanvas';
