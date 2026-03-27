import React, { useRef } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { RightPanel } from '@/components/layout/RightPanel';
import { BlueprintCanvas } from '@/components/blueprint/BlueprintCanvas';
import { useBlueprintStore } from '@/store/use-blueprint-store';

export default function Dashboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leftPanelOpen  = useBlueprintStore(s => s.leftPanelOpen);
  const rightPanelOpen = useBlueprintStore(s => s.rightPanelOpen);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">

      {/* Left Sidebar — collapses to 0 width */}
      <div
        style={{ width: leftPanelOpen ? 288 : 0 }}
        className="flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      >
        <div className="w-72 h-full">
          <Sidebar />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        <div className="absolute inset-0 blueprint-grid opacity-20 pointer-events-none" />
        <Topbar canvasRef={canvasRef} />
        <main className="flex-1 relative">
          <BlueprintCanvas ref={canvasRef} />
        </main>
      </div>

      {/* Right Properties Panel — collapses to 0 width */}
      <div
        style={{ width: rightPanelOpen ? 288 : 0 }}
        className="flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
      >
        <div className="w-72 h-full">
          <RightPanel />
        </div>
      </div>
    </div>
  );
}
